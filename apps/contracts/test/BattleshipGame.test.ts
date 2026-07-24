import { expect } from "chai";
import hre from "hardhat";
import { getAddress } from "viem";
import { buildMerkleTree, getProof } from "./helpers/merkle";

// Standard fleet for tests: Carrier(5) + Battleship(4) + Cruiser(3) + Submarine(3) = 15 cells.
const FLEET_CELLS = 15;

// Build a board where ships occupy the top-left corner deterministically.
// cellType: 0 = water, 1 = ship hp1, 21 = ship hp2 (armor), 41 = submarine stealth.
function buildTestBoard(): { type: number; salt: number }[] {
  const board = Array.from({ length: 100 }, (_, i) => ({ type: 0, salt: i }));
  // Carrier (5 cells) horizontal row 0
  for (let x = 0; x < 5; x++) board[0 * 10 + x] = { type: 1, salt: 100 + x };
  // Battleship (4 cells) row 1, armored (hp=2)
  for (let x = 0; x < 4; x++) board[1 * 10 + x] = { type: 21, salt: 200 + x };
  // Cruiser (3 cells) row 2
  for (let x = 0; x < 3; x++) board[2 * 10 + x] = { type: 1, salt: 300 + x };
  // Submarine (3 cells) row 3, stealth
  for (let x = 0; x < 3; x++) board[3 * 10 + x] = { type: 41, salt: 400 + x };
  return board;
}

describe("BattleshipGame", function () {
  let owner: any;
  let alice: any;
  let bob: any;
  let carol: any;
  let dave: any;
  let publicClient: any;

  before(async () => {
    [owner, alice, bob, carol, dave] = await hre.viem.getWalletClients();
    publicClient = await hre.viem.getPublicClient();
  });

  async function deployToken() {
    return await hre.viem.deployContract("MockERC20");
  }

  async function deploy(tokenAddr?: `0x${string}`) {
    const token = tokenAddr ?? (await deployToken()).address;
    const factory = await hre.ethers.getContractFactory("BattleshipGame");
    const proxy = await hre.upgrades.deployProxy(factory, [token], { kind: "uups" });
    await proxy.waitForDeployment();
    const address = await proxy.getAddress();
    // Return a viem contract instance for ergonomic reads/writes.
    const contract = await hre.viem.getContractAt("BattleshipGame", address as `0x${string}`);
    // Attach the address for tests that need it (e.g. token approvals).
    (contract as any)._address = address as `0x${string}`;
    return contract;
  }

  // Create a duel and return the (now random, unpredictable) gameId by reading
  // the GameCreated event from the receipt. Replaces the old assumption that
  // game ids were sequential starting at 1.
  async function createGame(g: any, account: any, wager: bigint = 0n): Promise<bigint> {
    const hash = await g.write.createDuel([wager], { account });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    const log = receipt.logs.find((l: any) => l.address.toLowerCase() === (g as any)._address.toLowerCase());
    if (!log || !log.topics[1]) throw new Error("GameCreated not found");
    return BigInt(log.topics[1]);
  }

  // Helper: Alice fires at a ship cell on Bob's board.
  // Turn rule: if the cell is DESTROYED by this shot, Alice keeps the turn
  // (no Bob response needed). If only wounded (armor first hit), Bob gets the
  // turn and misses on Alice's water to hand it back. If Alice's shot ends the
  // game, the helper returns immediately.
  async function aliceHitBobMiss(
    g: any,
    gameId: bigint,
    bobTree: any,
    bobBoard: ReturnType<typeof buildTestBoard>,
    aliceTree: any,
    cellIdx: number
  ) {
    const x = cellIdx % 10;
    const y = Math.floor(cellIdx / 10);
    // Alice fires at Bob's cell.
    await g.write.fire([gameId, BigInt(x), BigInt(y)], { account: alice.account });
    const proof = getProof(bobTree, cellIdx);
    await g.write.respondShot([gameId, BigInt(bobBoard[cellIdx].type), proof], {
      account: bob.account,
    });
    // If the hit ended the game, nothing more to do.
    const state = (await g.read.getGame([gameId])).state;
    if (Number(state) === 3) return; // Finished
    // If the cell was destroyed, the turn stays with Alice — no Bob miss needed.
    // (cellsRemaining dropped). Otherwise (armor wounded) the turn went to Bob,
    // so Bob misses on Alice's water to return the turn to Alice.
    const game = (await g.read.getGame([gameId])) as any;
    const turn = Number(game.turn);
    if (turn === 0) return; // Alice still has the turn (cell destroyed)
    // turn === 1: Bob's turn — he misses on water.
    await g.write.fire([gameId, 9, 9], { account: bob.account });
    const missProof = getProof(aliceTree, 99);
    await g.write.respondShot([gameId, 0, missProof], { account: alice.account });
  }

  it("initializes with owner and zero game nonce", async () => {
    const g = await deploy();
    const ownerAddr = (await g.read.owner()) as `0x${string}`;
    expect(getAddress(ownerAddr)).to.equal(getAddress(owner.account.address));
    expect((await g.read.nextGameId()).toString()).to.equal("0");
  });

  it("creates a duel with a wager", async () => {
    const g = await deploy();
    const gameId = await createGame(g, alice.account);
    expect(gameId > 0n).to.equal(true); // random, non-zero
    const game = await g.read.getGame([gameId]);
    expect(Number(game.state)).to.equal(0); // Open
    expect(getAddress(game.players[0].account)).to.equal(getAddress(alice.account.address));
    expect(game.wager).to.equal(0n);
  });

  it("lets a second player join and transitions to Placing", async () => {
    const g = await deploy();
    const gameId = await createGame(g, alice.account);
    await g.write.joinDuel([gameId], { account: bob.account });
    const game = await g.read.getGame([gameId]);
    expect(Number(game.state)).to.equal(1); // Placing
    expect(getAddress(game.players[1].account)).to.equal(getAddress(bob.account.address));
  });

  it("accepts board commits from both players and starts the game", async () => {
    const g = await deploy();
    const gameId = await createGame(g, alice.account);
    await g.write.joinDuel([gameId], { account: bob.account });

    const aliceBoard = buildTestBoard();
    const bobBoard = buildTestBoard();
    const aliceTree = buildMerkleTree(aliceBoard);
    const bobTree = buildMerkleTree(bobBoard);

    await g.write.commitBoard([gameId, aliceTree.root, FLEET_CELLS], { account: alice.account });
    await g.write.commitBoard([gameId, bobTree.root, FLEET_CELLS], { account: bob.account });

    const game = await g.read.getGame([gameId]);
    expect(Number(game.state)).to.equal(2); // Active
    expect(Number(game.turn)).to.equal(0);
  });

  it("rejects fire from the wrong player", async () => {
    const g = await deploy();
    const gameId = await createGame(g, alice.account);
    await g.write.joinDuel([gameId], { account: bob.account });
    const board = buildTestBoard();
    const tree = buildMerkleTree(board);
    await g.write.commitBoard([gameId, tree.root, FLEET_CELLS], { account: alice.account });
    await g.write.commitBoard([gameId, tree.root, FLEET_CELLS], { account: bob.account });

    // Bob tries to fire first but it is Alice's turn (turn=0).
    await expect(
      g.write.fire([gameId, 0, 0], { account: bob.account })
    ).to.be.rejected;
  });

  it("resolves a hit that DESTROYS a cell and keeps the turn with the shooter", async () => {
    const g = await deploy();
    const gameId = await createGame(g, alice.account);
    await g.write.joinDuel([gameId], { account: bob.account });
    const aliceBoard = buildTestBoard();
    const bobBoard = buildTestBoard();
    const aliceTree = buildMerkleTree(aliceBoard);
    const bobTree = buildMerkleTree(bobBoard);
    await g.write.commitBoard([gameId, aliceTree.root, FLEET_CELLS], { account: alice.account });
    await g.write.commitBoard([gameId, bobTree.root, FLEET_CELLS], { account: bob.account });

    // Alice fires at (0,0) which is a Carrier cell (hp=1) on Bob's board.
    await g.write.fire([gameId, 0, 0], { account: alice.account });
    const pending = await g.read.getPendingShot([gameId]);
    expect(pending.active).to.equal(true);

    // Bob answers with proof for cell (0,0) type=1 (hit, cell destroyed).
    const proof = getProof(bobTree, 0);
    await g.write.respondShot([gameId, 1, proof], { account: bob.account });

    const game = await g.read.getGame([gameId]);
    // Classic rule: destroying a cell keeps the turn with the shooter (Alice, idx 0).
    expect(Number(game.turn)).to.equal(0);
    // Bob lost one cell.
    expect(Number(game.players[1].cellsRemaining)).to.equal(FLEET_CELLS - 1);
    expect(Number(game.players[0].shotsHit)).to.equal(1);
  });

  it("emits ShotResolved with the ACTUAL fired coordinates (not 0,0)", async () => {
    // Regression: the contract used to `delete pendingShots[gameId]` BEFORE
    // emitting ShotResolved, zeroing ps.x/ps.y so every shot resolved as (0,0).
    const g = await deploy();
    const gameId = await createGame(g, alice.account);
    await g.write.joinDuel([gameId], { account: bob.account });
    const aliceBoard = buildTestBoard();
    const bobBoard = buildTestBoard();
    const aliceTree = buildMerkleTree(aliceBoard);
    const bobTree = buildMerkleTree(bobBoard);
    await g.write.commitBoard([gameId, aliceTree.root, FLEET_CELLS], { account: alice.account });
    await g.write.commitBoard([gameId, bobTree.root, FLEET_CELLS], { account: bob.account });

    // Alice fires at (7,2) — deliberately NOT (0,0). Cell index 27 is water.
    const tx = await g.write.fire([gameId, 7, 2], { account: alice.account });
    void tx;
    const proof = getProof(bobTree, 27); // water cell
    const respTx = await g.write.respondShot([gameId, 0, proof], { account: bob.account });

    // Find the ShotResolved event in the respondShot receipt.
    const receipt = await publicClient.waitForTransactionReceipt({ hash: respTx });
    const log = receipt.logs.find((l: any) => l.address.toLowerCase() === (g as any)._address.toLowerCase());
    expect(log, "ShotResolved log should exist").to.exist;
    // Non-indexed args start at data offset 0: x, y, cellType, hit, ...
    // topic0 = keccak(ShotResolved sig), topic1=gameId, topic2=defenderIdx.
    // The data field holds the non-indexed params ABI-encoded.
    const data = (log as any).data;
    // First two words = x and y (each padded to 32 bytes).
    const x = Number(BigInt(data.slice(0, 66)));
    const y = Number(BigInt("0x" + data.slice(66, 130)));
    expect(x).to.equal(7, "ShotResolved.x must match fired coordinate");
    expect(y).to.equal(2, "ShotResolved.y must match fired coordinate");
  });

  it("resolves a miss and still flips turn", async () => {
    const g = await deploy();
    const gameId = await createGame(g, alice.account);
    await g.write.joinDuel([gameId], { account: bob.account });
    const aliceBoard = buildTestBoard();
    const bobBoard = buildTestBoard();
    const aliceTree = buildMerkleTree(aliceBoard);
    const bobTree = buildMerkleTree(bobBoard);
    await g.write.commitBoard([gameId, aliceTree.root, FLEET_CELLS], { account: alice.account });
    await g.write.commitBoard([gameId, bobTree.root, FLEET_CELLS], { account: bob.account });

    // Alice fires at (9,9) which is water.
    await g.write.fire([gameId, 9, 9], { account: alice.account });
    const proof = getProof(bobTree, 9 * 10 + 9);
    await g.write.respondShot([gameId, 0, proof], { account: bob.account });

    const game = await g.read.getGame([gameId]);
    expect(Number(game.turn)).to.equal(1);
    expect(Number(game.players[1].cellsRemaining)).to.equal(FLEET_CELLS);
    expect(Number(game.players[0].shotsHit)).to.equal(0);
  });

  it("rejects an invalid proof (wrong cell type)", async () => {
    const g = await deploy();
    const gameId = await createGame(g, alice.account);
    await g.write.joinDuel([gameId], { account: bob.account });
    const bobBoard = buildTestBoard();
    const bobTree = buildMerkleTree(bobBoard);
    await g.write.commitBoard([gameId, buildMerkleTree(buildTestBoard()).root, FLEET_CELLS], { account: alice.account });
    await g.write.commitBoard([gameId, bobTree.root, FLEET_CELLS], { account: bob.account });

    // Alice fires at water cell (9,9) but Bob lies that it is a ship.
    await g.write.fire([gameId, 9, 9], { account: alice.account });
    // Build a fake proof claiming type=1 at (9,9) -- this will not verify.
    const fakeBoard = buildTestBoard();
    fakeBoard[99] = { type: 1, salt: 999 };
    const fakeTree = buildMerkleTree(fakeBoard);
    const fakeProof = getProof(fakeTree, 99);
    await expect(
      g.write.respondShot([gameId, 1, fakeProof], { account: bob.account })
    ).to.be.rejected;
  });

  it("finishes the game when all enemy cells are destroyed", async () => {
    const g = await deploy();
    const gameId = await createGame(g, alice.account);
    await g.write.joinDuel([gameId], { account: bob.account });
    const aliceBoard = buildTestBoard();
    const bobBoard = buildTestBoard();
    const aliceTree = buildMerkleTree(aliceBoard);
    const bobTree = buildMerkleTree(bobBoard);
    await g.write.commitBoard([gameId, aliceTree.root, FLEET_CELLS], { account: alice.account });
    await g.write.commitBoard([gameId, bobTree.root, FLEET_CELLS], { account: bob.account });

    // Sink all of Bob's cells. Standard cells (hp=1) need one hit; armored
    // Battleship cells (hp=2, type=21 at indices 10-13) need two hits each.
    // Alice hits on her turns; Bob misses (water) on his so Alice keeps the offensive.
    const hp1Cells = [0, 1, 2, 3, 4, 20, 21, 22, 30, 31, 32]; // 11 cells, sink on 1st
    const armorCells = [10, 11, 12, 13]; // 4 cells, need 2 hits each
    // First, wound every armor cell once (still afloat). After wounding, the cell
    // remains hp=2 with cellHits=1; the second hit sinks it.
    for (const cellIdx of armorCells) {
      await aliceHitBobMiss(g, gameId, bobTree, bobBoard, aliceTree, cellIdx);
    }
    // Now sink all hp=1 cells in one hit each.
    for (const cellIdx of hp1Cells) {
      await aliceHitBobMiss(g, gameId, bobTree, bobBoard, aliceTree, cellIdx);
    }
    // Finally, finish off the wounded armor cells (second hit sinks them).
    for (const cellIdx of armorCells) {
      await aliceHitBobMiss(g, gameId, bobTree, bobBoard, aliceTree, cellIdx);
    }

    const game = await g.read.getGame([gameId]);
    expect(Number(game.state)).to.equal(3); // Finished
    expect(getAddress(game.winner)).to.equal(getAddress(alice.account.address));
  });

  it("updates ELO and win/loss counters", async () => {
    const g = await deploy();
    const gameId = await createGame(g, alice.account);
    await g.write.joinDuel([gameId], { account: bob.account });
    const aliceBoard = buildTestBoard();
    const bobBoard = buildTestBoard();
    const aliceTree = buildMerkleTree(aliceBoard);
    const bobTree = buildMerkleTree(bobBoard);
    await g.write.commitBoard([gameId, aliceTree.root, FLEET_CELLS], { account: alice.account });
    await g.write.commitBoard([gameId, bobTree.root, FLEET_CELLS], { account: bob.account });

    const hp1Cells = [0, 1, 2, 3, 4, 20, 21, 22, 30, 31, 32];
    const armorCells = [10, 11, 12, 13];
    for (const cellIdx of armorCells) {
      await aliceHitBobMiss(g, gameId, bobTree, bobBoard, aliceTree, cellIdx);
    }
    for (const cellIdx of hp1Cells) {
      await aliceHitBobMiss(g, gameId, bobTree, bobBoard, aliceTree, cellIdx);
    }
    for (const cellIdx of armorCells) {
      await aliceHitBobMiss(g, gameId, bobTree, bobBoard, aliceTree, cellIdx);
    }

    expect(Number(await g.read.wins([alice.account.address]))).to.equal(1);
    expect(Number(await g.read.losses([bob.account.address]))).to.equal(1);
    expect(Number(await g.read.elo([alice.account.address]))).to.be.greaterThan(1000);
    expect(Number(await g.read.elo([bob.account.address]))).to.be.lessThan(1000);
  });

  it("armor: Battleship cell (hp=2) survives the first hit and sinks on the second", async () => {
    const g = await deploy();
    const gameId = await createGame(g, alice.account);
    await g.write.joinDuel([gameId], { account: bob.account });
    const aliceBoard = buildTestBoard();
    const bobBoard = buildTestBoard();
    const aliceTree = buildMerkleTree(aliceBoard);
    const bobTree = buildMerkleTree(bobBoard);
    await g.write.commitBoard([gameId, aliceTree.root, FLEET_CELLS], { account: alice.account });
    await g.write.commitBoard([gameId, bobTree.root, FLEET_CELLS], { account: bob.account });

    // Alice hits the armored cell at index 10 (row 1, col 0) -- type=21, hp=2.
    await g.write.fire([gameId, 0, 1], { account: alice.account });
    const proof1 = getProof(bobTree, 10);
    await g.write.respondShot([gameId, 21, proof1], { account: bob.account });

    // After the first hit: armored cell is wounded but afloat. cellsRemaining unchanged.
    let game = await g.read.getGame([gameId]);
    expect(Number(game.players[1].cellsRemaining)).to.equal(FLEET_CELLS);
    expect(Number(game.state)).to.equal(2); // still Active
    // Turn rule: a hit that only WOUNDS (does not destroy) passes the turn to
    // the defender (Bob, idx 1).
    expect(Number(game.turn)).to.equal(1);
    // Armor memory records one hit on cell 10 (defender idx 1).
    const hits = await g.read.cellHits([gameId, 1n, 10n]);
    expect(Number(hits)).to.equal(1);

    // Bob misses on his turn so Alice gets the offensive back.
    await g.write.fire([gameId, 9, 9], { account: bob.account });
    const missProof = getProof(aliceTree, 99);
    await g.write.respondShot([gameId, 0, missProof], { account: alice.account });

    // Alice hits the same cell again -- now it sinks.
    await g.write.fire([gameId, 0, 1], { account: alice.account });
    const proof2 = getProof(bobTree, 10);
    await g.write.respondShot([gameId, 21, proof2], { account: bob.account });

    game = await g.read.getGame([gameId]);
    expect(Number(game.players[1].cellsRemaining)).to.equal(FLEET_CELLS - 1);
    // Destroying the armored cell on the second hit keeps the turn with Alice.
    expect(Number(game.turn)).to.equal(0);
  });

  it("stealth: Submarine cell (type=41) sinks on a single hit like a normal ship", async () => {
    const g = await deploy();
    const gameId = await createGame(g, alice.account);
    await g.write.joinDuel([gameId], { account: bob.account });
    const aliceBoard = buildTestBoard();
    const bobBoard = buildTestBoard();
    const aliceTree = buildMerkleTree(aliceBoard);
    const bobTree = buildMerkleTree(bobBoard);
    await g.write.commitBoard([gameId, aliceTree.root, FLEET_CELLS], { account: alice.account });
    await g.write.commitBoard([gameId, bobTree.root, FLEET_CELLS], { account: bob.account });

    // Alice hits the stealth submarine cell at index 30 (row 3, col 0) -- type=41.
    await g.write.fire([gameId, 0, 3], { account: alice.account });
    const proof = getProof(bobTree, 30);
    await g.write.respondShot([gameId, 41, proof], { account: bob.account });

    const game = await g.read.getGame([gameId]);
    // Stealth subs have hp=1, so the cell sinks immediately (unlike armored battleships).
    expect(Number(game.players[1].cellsRemaining)).to.equal(FLEET_CELLS - 1);
  });

  it("cUSD wager flow: escrows both stakes and pays out the winner", async () => {
    const token = await deployToken();
    const g = await deploy(token.address);
    const WAGER = 1_000_000n; // 1 mUSD

    // Fund both players and approve the contract.
    await token.write.mint([alice.account.address, WAGER], { account: owner.account });
    await token.write.mint([bob.account.address, WAGER], { account: owner.account });
    const gameAddr = (g as any)._address;
    await token.write.approve([gameAddr, WAGER], { account: alice.account });
    await token.write.approve([gameAddr, WAGER], { account: bob.account });

    const gameId = await createGame(g, alice.account, WAGER);
    await g.write.joinDuel([gameId], { account: bob.account });

    // Contract holds 2 * WAGER.
    expect(await token.read.balanceOf([gameAddr])).to.equal(WAGER * 2n);

    // Alice sinks all of Bob's fleet (hp1 once, armor twice).
    const aliceBoard = buildTestBoard();
    const bobBoard = buildTestBoard();
    const aliceTree = buildMerkleTree(aliceBoard);
    const bobTree = buildMerkleTree(bobBoard);
    await g.write.commitBoard([gameId, aliceTree.root, FLEET_CELLS], { account: alice.account });
    await g.write.commitBoard([gameId, bobTree.root, FLEET_CELLS], { account: bob.account });

    const hp1Cells = [0, 1, 2, 3, 4, 20, 21, 22, 30, 31, 32];
    const armorCells = [10, 11, 12, 13];
    for (const cellIdx of armorCells) {
      await aliceHitBobMiss(g, gameId, bobTree, bobBoard, aliceTree, cellIdx);
    }
    for (const cellIdx of hp1Cells) {
      await aliceHitBobMiss(g, gameId, bobTree, bobBoard, aliceTree, cellIdx);
    }
    for (const cellIdx of armorCells) {
      await aliceHitBobMiss(g, gameId, bobTree, bobBoard, aliceTree, cellIdx);
    }

    // Alice (winner) should have received the full 2 * WAGER payout.
    expect(await token.read.balanceOf([alice.account.address])).to.equal(WAGER * 2n);
    expect(await token.read.balanceOf([gameAddr])).to.equal(0n);
  });

  it("cancelDuel: creator reclaims the wager when nobody joined", async () => {
    const token = await deployToken();
    const g = await deploy(token.address);
    const WAGER = 1_000_000n;
    await token.write.mint([alice.account.address, WAGER], { account: owner.account });
    const gameAddr = (g as any)._address;
    await token.write.approve([gameAddr, WAGER], { account: alice.account });

    const gameId = await createGame(g, alice.account, WAGER);
    // Nobody joined; contract holds the wager.
    expect(await token.read.balanceOf([gameAddr])).to.equal(WAGER);

    // Bob (not the creator) cannot cancel.
    await expect(g.write.cancelDuel([gameId], { account: bob.account })).to.be.rejected;

    // Alice cancels and reclaims.
    await g.write.cancelDuel([gameId], { account: alice.account });
    expect(await token.read.balanceOf([alice.account.address])).to.equal(WAGER);
    expect(await token.read.balanceOf([gameAddr])).to.equal(0n);

    // The game is gone (state Finished + zeroed).
    const after = (await g.read.getGame([gameId])) as any;
    expect(Number(after.state)).to.equal(3); // Finished
    // Cannot cancel twice or rejoin.
    await expect(g.write.joinDuel([gameId], { account: bob.account })).to.be.rejected;
  });

  it("cancelDuel: free duels can be cancelled too (no transfer)", async () => {
    const g = await deploy();
    const gameId = await createGame(g, alice.account, 0n);
    await g.write.cancelDuel([gameId], { account: alice.account });
    const after = (await g.read.getGame([gameId])) as any;
    expect(Number(after.state)).to.equal(3); // Finished
  });

  it("tournament: 4-player single elimination, top3 payout, escrow + claim", async () => {
    const token = await deployToken();
    const g = await deploy(token.address);
    const ENTRY = 500_000n; // 0.5 mUSD per player
    const players = [alice, bob, carol, dave];

    // Fund + approve.
    const gameAddr = (g as any)._address;
    for (const p of players) {
      await token.write.mint([p.account.address, ENTRY], { account: owner.account });
      await token.write.approve([gameAddr, ENTRY], { account: p.account });
    }

    // Create a 4-player Top3 tournament with a far-future deadline.
    const farDeadline = BigInt(Math.floor(Date.now() / 1000) + 86400);
    await g.write.createTournament([ENTRY, 4, farDeadline, 1], { account: owner.account });
    const tid = 1n;

    // Register all 4.
    for (const p of players) {
      await g.write.registerForTournament([tid], { account: p.account });
    }

    // Contract holds 4 * ENTRY.
    expect(await token.read.balanceOf([gameAddr])).to.equal(ENTRY * 4n);

    // Start the tournament: pairs into 2 semifinals.
    const startHash = await g.write.startTournament([tid], { account: owner.account });
    const startReceipt = await publicClient.waitForTransactionReceipt({ hash: startHash });
    const info: any[] = (await g.read.getTournamentInfo([tid])) as any[];
    // (creator, entryFee, maxPlayers, rounds, scheme, state, prizePool, ...)
    expect(Number(info[5])).to.equal(1); // Active
    expect(Number(info[3])).to.equal(2); // rounds

    // _pairNextRound created two semifinal games. Game ids are now random, so
    // read them from the GameCreated logs in the startTournament receipt.
    const GAME_CREATED_TOPIC = "0x7dfb67e9ff596fca4da65c7eedb128cd1aac553af54b3c0cb733625a2480d8bd";
    const sfLogs = startReceipt.logs.filter(
      (l: any) =>
        l.address.toLowerCase() === gameAddr.toLowerCase() &&
        l.topics[0]?.toLowerCase() === GAME_CREATED_TOPIC
    );
    // Each GameCreated carries gameId in topics[1]. Order matches slot pairing.
    const sfGameIds = sfLogs.map((l: any) => BigInt(l.topics[1]));
    const sfGame1 = sfGameIds[0];
    const sfGame2 = sfGameIds[1];

    // Each semifinal is in Placing state. Both players commit boards.
    const board = buildTestBoard();
    const tree = buildMerkleTree(board);
    // SF1: slots 0,1 -> alice, bob
    await g.write.commitBoard([sfGame1, tree.root, FLEET_CELLS], { account: alice.account });
    await g.write.commitBoard([sfGame1, tree.root, FLEET_CELLS], { account: bob.account });
    // SF2: slots 2,3 -> carol, dave
    await g.write.commitBoard([sfGame2, tree.root, FLEET_CELLS], { account: carol.account });
    await g.write.commitBoard([sfGame2, tree.root, FLEET_CELLS], { account: dave.account });

    // Helper to play a full game where `winner` sinks `loser`'s entire fleet.
    // The loser's board cells are the same shape (buildTestBoard) so proofs reuse the same tree.
    const shipCells = [0, 1, 2, 3, 4, 20, 21, 22, 30, 31, 32];
    const armor = [10, 11, 12, 13];

    async function playWin(winner: any, loser: any, gameId: bigint) {
      async function shot(cellIdx: number, ct: number) {
        await g.write.fire([gameId, BigInt(cellIdx % 10), BigInt(Math.floor(cellIdx / 10))], {
          account: winner.account,
        });
        await g.write.respondShot([gameId, BigInt(ct), getProof(tree, cellIdx)], { account: loser.account });
        const state = (await g.read.getGame([gameId])).state;
        if (Number(state) === 3) return true; // game over
        // If the turn stayed with winner (cell destroyed), no loser miss needed.
        const game = (await g.read.getGame([gameId])) as any;
        if (Number(game.turn) !== (winner === alice || winner === carol ? 0 : 1)) {
          // Turn went to loser — loser misses on water to hand back the turn.
          await g.write.fire([gameId, 9, 9], { account: loser.account });
          await g.write.respondShot([gameId, 0, getProof(tree, 99)], { account: winner.account });
        }
        return false;
      }
      // winner is always player 0 in semifinals (slot order), player 0 in final.
      const winnerIdx = 0;
      const loserIdx = 1;
      void loserIdx;
      // Wound armor first (first hit does not destroy — turn passes to loser).
      for (const cellIdx of armor) {
        if (await shot(cellIdx, 21)) return;
      }
      // Sink all hp=1 cells (one hit destroys — winner keeps the turn).
      for (const cellIdx of shipCells) {
        const ct = cellIdx >= 30 && cellIdx <= 32 ? 41 : 1;
        if (await shot(cellIdx, ct)) return;
      }
      // Finish off wounded armor (second hit destroys).
      for (const cellIdx of armor) {
        if (await shot(cellIdx, 21)) return;
      }
      void winnerIdx;
    }

    // SF1: alice beats bob; SF2: carol beats dave.
    await playWin(alice, bob, sfGame1);
    await playWin(carol, dave, sfGame2);

    // The final game is created once both semifinals resolve. Its random id is
    // emitted in a GameCreated log after sfGame2 finishes. Read recent logs and
    // pick the newest GameCreated that is neither semifinal.
    const bn = await publicClient.getBlockNumber();
    const recentLogs = await publicClient.getLogs({
      address: gameAddr,
      event: { type: "event", name: "GameCreated", inputs: [
        { name: "gameId", type: "uint256", indexed: true },
        { name: "creator", type: "address", indexed: true },
        { name: "wager", type: "uint256", indexed: false },
      ] },
      fromBlock: bn > 1000n ? bn - 1000n : 0n,
      toBlock: bn,
    });
    const finalGame = recentLogs
      .map((l: any) => BigInt(l.args.gameId))
      .filter((id: bigint) => id !== sfGame1 && id !== sfGame2)
      .pop() as bigint;

    // Final: alice vs carol. Alice wins the championship.
    await g.write.commitBoard([finalGame, tree.root, FLEET_CELLS], { account: alice.account });
    await g.write.commitBoard([finalGame, tree.root, FLEET_CELLS], { account: carol.account });
    await playWin(alice, carol, finalGame);

    const finalInfo: any[] = (await g.read.getTournamentInfo([tid])) as any[];
    // (creator, entryFee, maxPlayers, rounds, scheme, state, prizePool, firstPlace, secondPlace, thirdPlace)
    expect(Number(finalInfo[5])).to.equal(2); // Finished
    expect(getAddress(finalInfo[7])).to.equal(getAddress(alice.account.address));

    // Prize claim: Top3 split = 70/20/10 of 4*ENTRY = 2_000_000.
    await g.write.claimTournamentPrize([tid], { account: owner.account });
    const total = ENTRY * 4n;
    const firstShare = (total * 70n) / 100n;
    const secondShare = (total * 20n) / 100n;
    const thirdShare = total - firstShare - secondShare;
    expect(await token.read.balanceOf([alice.account.address])).to.equal(firstShare);
    expect(await token.read.balanceOf([finalInfo[8]])).to.equal(secondShare);
    expect(await token.read.balanceOf([finalInfo[9]])).to.equal(thirdShare);
    expect(await token.read.balanceOf([gameAddr])).to.equal(0n);
  });
});
