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

    // Sink all 15 of Bob's cells. Alice hits a ship cell each of her turns;
    // Bob shoots water (miss) on his turns so Alice keeps the offensive.
    // Turn order is enforced by the contract (flips after each respondShot).
    const shipCells = [0, 1, 2, 3, 4, 10, 11, 12, 13, 20, 21, 22, 30, 31, 32];
    let hitIdx = 0;
    let turn = 0; // Alice starts
    for (let i = 0; i < shipCells.length * 2 - 1 && hitIdx < shipCells.length; i++) {
      if (turn === 0) {
        // Alice hits Bob's next ship cell.
        const cellIdx = shipCells[hitIdx];
        const x = cellIdx % 10;
        const y = Math.floor(cellIdx / 10);
        await g.write.fire([1n, BigInt(x), BigInt(y)], { account: alice.account });
        const proof = getProof(bobTree, cellIdx);
        await g.write.respondShot([1n, BigInt(bobBoard[cellIdx].type), proof], {
          account: bob.account,
        });
        hitIdx++;
      } else {
        // Bob misses (water cell 9,9 on Alice's board).
        await g.write.fire([1n, 9, 9], { account: bob.account });
        const proof = getProof(aliceTree, 99);
        await g.write.respondShot([1n, 0, proof], { account: alice.account });
      }
      turn = 1 - turn;
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

    const shipCells = [0, 1, 2, 3, 4, 10, 11, 12, 13, 20, 21, 22, 30, 31, 32];
    let hitIdx = 0;
    let turn = 0;
    for (let i = 0; i < shipCells.length * 2 - 1 && hitIdx < shipCells.length; i++) {
      if (turn === 0) {
        const cellIdx = shipCells[hitIdx];
        await g.write.fire([1n, BigInt(cellIdx % 10), BigInt(Math.floor(cellIdx / 10))], {
          account: alice.account,
        });
        const proof = getProof(bobTree, cellIdx);
        await g.write.respondShot([1n, BigInt(bobBoard[cellIdx].type), proof], {
          account: bob.account,
        });
        hitIdx++;
      } else {
        await g.write.fire([1n, 9, 9], { account: bob.account });
        const proof = getProof(aliceTree, 99);
        await g.write.respondShot([1n, 0, proof], { account: alice.account });
      }
      turn = 1 - turn;
    }

    expect(Number(await g.read.wins([alice.account.address]))).to.equal(1);
    expect(Number(await g.read.losses([bob.account.address]))).to.equal(1);
    expect(Number(await g.read.elo([alice.account.address]))).to.be.greaterThan(1000);
    expect(Number(await g.read.elo([bob.account.address]))).to.be.lessThan(1000);
  });
});
