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

  before(async () => {
    [owner, alice, bob] = await hre.viem.getWalletClients();
  });

  async function deploy() {
    const factory = await hre.ethers.getContractFactory("BattleshipGame");
    const proxy = await hre.upgrades.deployProxy(factory, [], { kind: "uups" });
    await proxy.waitForDeployment();
    const address = await proxy.getAddress();
    // Return a viem contract instance for ergonomic reads/writes.
    return await hre.viem.getContractAt("BattleshipGame", address as `0x${string}`);
  }

  // Helper: Alice hits a ship cell on Bob's board, then Bob misses water on Alice's
  // board, returning the turn to Alice. One call = one full turn pair.
  // If Alice's hit finishes the game, the helper returns without the Bob miss step.
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
    // If the hit ended the game, skip Bob's miss step.
    const state = (await g.read.getGame([gameId])).state;
    if (Number(state) === 3) return; // Finished
    // Bob fires at water (9,9) on Alice's board and misses.
    await g.write.fire([gameId, 9, 9], { account: bob.account });
    const missProof = getProof(aliceTree, 99);
    await g.write.respondShot([gameId, 0, missProof], { account: alice.account });
  }

  it("initializes with owner and starting game id", async () => {
    const g = await deploy();
    const ownerAddr = (await g.read.owner()) as `0x${string}`;
    expect(getAddress(ownerAddr)).to.equal(getAddress(owner.account.address));
    expect((await g.read.nextGameId()).toString()).to.equal("1");
  });

  it("creates a duel with a wager", async () => {
    const g = await deploy();
    await g.write.createDuel([0n], { account: alice.account });
    const game = await g.read.getGame([1n]);
    expect(Number(game.state)).to.equal(0); // Open
    expect(getAddress(game.players[0].account)).to.equal(getAddress(alice.account.address));
    expect(game.wager).to.equal(0n);
  });

  it("lets a second player join and transitions to Placing", async () => {
    const g = await deploy();
    await g.write.createDuel([0n], { account: alice.account });
    await g.write.joinDuel([1n], { account: bob.account, value: 0n });
    const game = await g.read.getGame([1n]);
    expect(Number(game.state)).to.equal(1); // Placing
    expect(getAddress(game.players[1].account)).to.equal(getAddress(bob.account.address));
  });

  it("accepts board commits from both players and starts the game", async () => {
    const g = await deploy();
    await g.write.createDuel([0n], { account: alice.account });
    await g.write.joinDuel([1n], { account: bob.account, value: 0n });

    const aliceBoard = buildTestBoard();
    const bobBoard = buildTestBoard();
    const aliceTree = buildMerkleTree(aliceBoard);
    const bobTree = buildMerkleTree(bobBoard);

    await g.write.commitBoard([1n, aliceTree.root, FLEET_CELLS], { account: alice.account });
    await g.write.commitBoard([1n, bobTree.root, FLEET_CELLS], { account: bob.account });

    const game = await g.read.getGame([1n]);
    expect(Number(game.state)).to.equal(2); // Active
    expect(Number(game.turn)).to.equal(0);
  });

  it("rejects fire from the wrong player", async () => {
    const g = await deploy();
    await g.write.createDuel([0n], { account: alice.account });
    await g.write.joinDuel([1n], { account: bob.account, value: 0n });
    const board = buildTestBoard();
    const tree = buildMerkleTree(board);
    await g.write.commitBoard([1n, tree.root, FLEET_CELLS], { account: alice.account });
    await g.write.commitBoard([1n, tree.root, FLEET_CELLS], { account: bob.account });

    // Bob tries to fire first but it is Alice's turn (turn=0).
    await expect(
      g.write.fire([1n, 0, 0], { account: bob.account })
    ).to.be.rejected;
  });

  it("resolves a hit with a valid Merkle proof and flips turn", async () => {
    const g = await deploy();
    await g.write.createDuel([0n], { account: alice.account });
    await g.write.joinDuel([1n], { account: bob.account, value: 0n });
    const aliceBoard = buildTestBoard();
    const bobBoard = buildTestBoard();
    const aliceTree = buildMerkleTree(aliceBoard);
    const bobTree = buildMerkleTree(bobBoard);
    await g.write.commitBoard([1n, aliceTree.root, FLEET_CELLS], { account: alice.account });
    await g.write.commitBoard([1n, bobTree.root, FLEET_CELLS], { account: bob.account });

    // Alice fires at (0,0) which is a Carrier cell on Bob's board.
    await g.write.fire([1n, 0, 0], { account: alice.account });
    const pending = await g.read.getPendingShot([1n]);
    expect(pending.active).to.equal(true);

    // Bob answers with proof for cell (0,0) type=1 (hit).
    const proof = getProof(bobTree, 0);
    await g.write.respondShot([1n, 1, proof], { account: bob.account });

    const game = await g.read.getGame([1n]);
    // Turn flipped to defender (Bob, idx 1).
    expect(Number(game.turn)).to.equal(1);
    // Bob lost one cell.
    expect(Number(game.players[1].cellsRemaining)).to.equal(FLEET_CELLS - 1);
    expect(Number(game.players[0].shotsHit)).to.equal(1);
  });

  it("resolves a miss and still flips turn", async () => {
    const g = await deploy();
    await g.write.createDuel([0n], { account: alice.account });
    await g.write.joinDuel([1n], { account: bob.account, value: 0n });
    const aliceBoard = buildTestBoard();
    const bobBoard = buildTestBoard();
    const aliceTree = buildMerkleTree(aliceBoard);
    const bobTree = buildMerkleTree(bobBoard);
    await g.write.commitBoard([1n, aliceTree.root, FLEET_CELLS], { account: alice.account });
    await g.write.commitBoard([1n, bobTree.root, FLEET_CELLS], { account: bob.account });

    // Alice fires at (9,9) which is water.
    await g.write.fire([1n, 9, 9], { account: alice.account });
    const proof = getProof(bobTree, 9 * 10 + 9);
    await g.write.respondShot([1n, 0, proof], { account: bob.account });

    const game = await g.read.getGame([1n]);
    expect(Number(game.turn)).to.equal(1);
    expect(Number(game.players[1].cellsRemaining)).to.equal(FLEET_CELLS);
    expect(Number(game.players[0].shotsHit)).to.equal(0);
  });

  it("rejects an invalid proof (wrong cell type)", async () => {
    const g = await deploy();
    await g.write.createDuel([0n], { account: alice.account });
    await g.write.joinDuel([1n], { account: bob.account, value: 0n });
    const bobBoard = buildTestBoard();
    const bobTree = buildMerkleTree(bobBoard);
    await g.write.commitBoard([1n, buildMerkleTree(buildTestBoard()).root, FLEET_CELLS], { account: alice.account });
    await g.write.commitBoard([1n, bobTree.root, FLEET_CELLS], { account: bob.account });

    // Alice fires at water cell (9,9) but Bob lies that it is a ship.
    await g.write.fire([1n, 9, 9], { account: alice.account });
    // Build a fake proof claiming type=1 at (9,9) -- this will not verify.
    const fakeBoard = buildTestBoard();
    fakeBoard[99] = { type: 1, salt: 999 };
    const fakeTree = buildMerkleTree(fakeBoard);
    const fakeProof = getProof(fakeTree, 99);
    await expect(
      g.write.respondShot([1n, 1, fakeProof], { account: bob.account })
    ).to.be.rejected;
  });

  it("finishes the game when all enemy cells are destroyed", async () => {
    const g = await deploy();
    await g.write.createDuel([0n], { account: alice.account });
    await g.write.joinDuel([1n], { account: bob.account, value: 0n });
    const aliceBoard = buildTestBoard();
    const bobBoard = buildTestBoard();
    const aliceTree = buildMerkleTree(aliceBoard);
    const bobTree = buildMerkleTree(bobBoard);
    await g.write.commitBoard([1n, aliceTree.root, FLEET_CELLS], { account: alice.account });
    await g.write.commitBoard([1n, bobTree.root, FLEET_CELLS], { account: bob.account });

    // Sink all of Bob's cells. Standard cells (hp=1) need one hit; armored
    // Battleship cells (hp=2, type=21 at indices 10-13) need two hits each.
    // Alice hits on her turns; Bob misses (water) on his so Alice keeps the offensive.
    const hp1Cells = [0, 1, 2, 3, 4, 20, 21, 22, 30, 31, 32]; // 11 cells, sink on 1st
    const armorCells = [10, 11, 12, 13]; // 4 cells, need 2 hits each
    // First, wound every armor cell once (still afloat). After wounding, the cell
    // remains hp=2 with cellHits=1; the second hit sinks it.
    for (const cellIdx of armorCells) {
      await aliceHitBobMiss(g, 1n, bobTree, bobBoard, aliceTree, cellIdx);
    }
    // Now sink all hp=1 cells in one hit each.
    for (const cellIdx of hp1Cells) {
      await aliceHitBobMiss(g, 1n, bobTree, bobBoard, aliceTree, cellIdx);
    }
    // Finally, finish off the wounded armor cells (second hit sinks them).
    for (const cellIdx of armorCells) {
      await aliceHitBobMiss(g, 1n, bobTree, bobBoard, aliceTree, cellIdx);
    }

    const game = await g.read.getGame([1n]);
    expect(Number(game.state)).to.equal(3); // Finished
    expect(getAddress(game.winner)).to.equal(getAddress(alice.account.address));
  });

  it("updates ELO and win/loss counters", async () => {
    const g = await deploy();
    await g.write.createDuel([0n], { account: alice.account });
    await g.write.joinDuel([1n], { account: bob.account, value: 0n });
    const aliceBoard = buildTestBoard();
    const bobBoard = buildTestBoard();
    const aliceTree = buildMerkleTree(aliceBoard);
    const bobTree = buildMerkleTree(bobBoard);
    await g.write.commitBoard([1n, aliceTree.root, FLEET_CELLS], { account: alice.account });
    await g.write.commitBoard([1n, bobTree.root, FLEET_CELLS], { account: bob.account });

    const hp1Cells = [0, 1, 2, 3, 4, 20, 21, 22, 30, 31, 32];
    const armorCells = [10, 11, 12, 13];
    for (const cellIdx of armorCells) {
      await aliceHitBobMiss(g, 1n, bobTree, bobBoard, aliceTree, cellIdx);
    }
    for (const cellIdx of hp1Cells) {
      await aliceHitBobMiss(g, 1n, bobTree, bobBoard, aliceTree, cellIdx);
    }
    for (const cellIdx of armorCells) {
      await aliceHitBobMiss(g, 1n, bobTree, bobBoard, aliceTree, cellIdx);
    }

    expect(Number(await g.read.wins([alice.account.address]))).to.equal(1);
    expect(Number(await g.read.losses([bob.account.address]))).to.equal(1);
    expect(Number(await g.read.elo([alice.account.address]))).to.be.greaterThan(1000);
    expect(Number(await g.read.elo([bob.account.address]))).to.be.lessThan(1000);
  });

  it("armor: Battleship cell (hp=2) survives the first hit and sinks on the second", async () => {
    const g = await deploy();
    await g.write.createDuel([0n], { account: alice.account });
    await g.write.joinDuel([1n], { account: bob.account, value: 0n });
    const aliceBoard = buildTestBoard();
    const bobBoard = buildTestBoard();
    const aliceTree = buildMerkleTree(aliceBoard);
    const bobTree = buildMerkleTree(bobBoard);
    await g.write.commitBoard([1n, aliceTree.root, FLEET_CELLS], { account: alice.account });
    await g.write.commitBoard([1n, bobTree.root, FLEET_CELLS], { account: bob.account });

    // Alice hits the armored cell at index 10 (row 1, col 0) -- type=21, hp=2.
    await g.write.fire([1n, 0, 1], { account: alice.account });
    const proof1 = getProof(bobTree, 10);
    await g.write.respondShot([1n, 21, proof1], { account: bob.account });

    // After the first hit: armored cell is wounded but afloat. cellsRemaining unchanged.
    let game = await g.read.getGame([1n]);
    expect(Number(game.players[1].cellsRemaining)).to.equal(FLEET_CELLS);
    expect(Number(game.state)).to.equal(2); // still Active
    // Armor memory records one hit on cell 10 (defender idx 1).
    const hits = await g.read.cellHits([1n, 1n, 10n]);
    expect(Number(hits)).to.equal(1);

    // Bob misses on his turn so Alice gets the offensive back.
    await g.write.fire([1n, 9, 9], { account: bob.account });
    const missProof = getProof(aliceTree, 99);
    await g.write.respondShot([1n, 0, missProof], { account: alice.account });

    // Alice hits the same cell again -- now it sinks.
    await g.write.fire([1n, 0, 1], { account: alice.account });
    const proof2 = getProof(bobTree, 10);
    await g.write.respondShot([1n, 21, proof2], { account: bob.account });

    game = await g.read.getGame([1n]);
    expect(Number(game.players[1].cellsRemaining)).to.equal(FLEET_CELLS - 1);
  });

  it("stealth: Submarine cell (type=41) sinks on a single hit like a normal ship", async () => {
    const g = await deploy();
    await g.write.createDuel([0n], { account: alice.account });
    await g.write.joinDuel([1n], { account: bob.account, value: 0n });
    const aliceBoard = buildTestBoard();
    const bobBoard = buildTestBoard();
    const aliceTree = buildMerkleTree(aliceBoard);
    const bobTree = buildMerkleTree(bobBoard);
    await g.write.commitBoard([1n, aliceTree.root, FLEET_CELLS], { account: alice.account });
    await g.write.commitBoard([1n, bobTree.root, FLEET_CELLS], { account: bob.account });

    // Alice hits the stealth submarine cell at index 30 (row 3, col 0) -- type=41.
    await g.write.fire([1n, 0, 3], { account: alice.account });
    const proof = getProof(bobTree, 30);
    await g.write.respondShot([1n, 41, proof], { account: bob.account });

    const game = await g.read.getGame([1n]);
    // Stealth subs have hp=1, so the cell sinks immediately (unlike armored battleships).
    expect(Number(game.players[1].cellsRemaining)).to.equal(FLEET_CELLS - 1);
  });
});
