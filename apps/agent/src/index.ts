import { gameAddress, publicClient, walletClient, AGENT_ADDRESS, CHAIN } from "./config.js";
import { gameAbi } from "./abi.js";
import {
  randomBoard,
  buildMerkleTree,
  getProof,
  TYPE_WATER,
  BOARD_SIZE,
} from "./board.js";
import { HuntTargetAI } from "./strategy.js";

// Active games the agent is participating in. Keyed by gameId.
interface AgentGame {
  boardTypes: number[];
  tree: ReturnType<typeof buildMerkleTree>;
  ai: HuntTargetAI;
  myIdx: 0 | 1;
}
const activeGames: Map<bigint, AgentGame> = new Map();

const POLL_INTERVAL_MS = 12_000; // poll every 12s

console.log(`[BoatEatsBoat agent] address=${AGENT_ADDRESS} chain=${CHAIN.name}`);
console.log(`[BoatEatsBoat agent] game=${gameAddress}`);

async function main() {
  // Seed: scan existing games and adopt any in Open/Placing/Active where we are a player.
  await catchUpExistingGames();
  // Then poll.
  setInterval(tick, POLL_INTERVAL_MS);
  // Run an immediate first tick.
  tick();
}

// Read every GameCreated log within a recent block window and consider those
// games. Game ids are now random (not sequential), so we discover them via the
// GameCreated event rather than iterating 1..n.
async function recentGameIds(): Promise<bigint[]> {
  const currentBlock = await publicClient.getBlockNumber();
  const fromBlock = currentBlock > 100000n ? currentBlock - 100000n : 0n;
  const logs = await publicClient.getLogs({
    address: gameAddress,
    event: {
      type: "event",
      name: "GameCreated",
      inputs: [
        { name: "gameId", type: "uint256", indexed: true },
        { name: "creator", type: "address", indexed: true },
        { name: "wager", type: "uint256", indexed: false },
      ],
    },
    fromBlock,
    toBlock: "latest",
  });
  return logs.map((l) => (l.args as any).gameId as bigint);
}

async function catchUpExistingGames() {
  const ids = await recentGameIds();
  for (const id of ids) {
    try {
      await considerGame(id);
    } catch (e) {
      // ignore individual game errors during catch-up
    }
  }
}

async function tick() {
  try {
    const ids = await recentGameIds();
    for (const id of ids) {
      try {
        await considerGame(id);
      } catch (e) {
        // log but keep going
        console.error(`[agent] error on game ${id}:`, (e as Error).message);
      }
    }
  } catch (e) {
    console.error(`[agent] tick failed:`, (e as Error).message);
  }
}

async function considerGame(gameId: bigint) {
  const game = (await publicClient.readContract({
    address: gameAddress,
    abi: gameAbi,
    functionName: "getGame",
    args: [gameId],
  })) as any;

  const state = Number(game.state);
  // 0=Open 1=Placing 2=Active 3=Finished
  if (state === 3) {
    activeGames.delete(gameId);
    return;
  }

  const p0 = (game.players[0].account ?? "").toLowerCase();
  const p1 = (game.players[1].account ?? "").toLowerCase();
  const me = AGENT_ADDRESS.toLowerCase();

  // Open: join ONLY if the creator explicitly requested the bot. This lets a
  // player start a free "vs friend" duel and share the id without the bot
  // snatching it. Agent never joins wagered duels.
  if (state === 0) {
    if (p0.toLowerCase() === me) return; // we created it, wait
    if (p1.toLowerCase() === me) return;
    if (game.wager > 0n) return;
    const wantBot = await publicClient.readContract({
      address: gameAddress,
      abi: gameAbi,
      functionName: "botRequested",
      args: [gameId],
    });
    if (!wantBot) return;
    await joinGame(gameId);
    return;
  }

  // If we are a participant in Placing/Active, handle our responsibilities.
  let myIdx: 0 | 1 | null = null;
  if (p0.toLowerCase() === me) myIdx = 0;
  else if (p1.toLowerCase() === me) myIdx = 1;
  if (myIdx === null) return;

  if (state === 1) {
    await commitIfNeeded(gameId, game, myIdx);
    return;
  }
  if (state === 2) {
    await playActiveTurn(gameId, game, myIdx);
    return;
  }
}

async function joinGame(gameId: bigint) {
  try {
    const hash = await walletClient.writeContract({
      address: gameAddress,
      abi: gameAbi,
      functionName: "joinDuel",
      args: [gameId],
      account: walletClient.account,
      chain: CHAIN,
    });
    await publicClient.waitForTransactionReceipt({ hash });
    console.log(`[agent] joined game ${gameId} (tx ${hash})`);
  } catch (e) {
    console.error(`[agent] joinDuel ${gameId} failed:`, (e as Error).message);
  }
}

async function commitIfNeeded(gameId: bigint, game: any, myIdx: 0 | 1) {
  if (game.players[myIdx].acknowledged) return;
  // Lazily build our board + tree.
  if (!activeGames.has(gameId)) {
    const { types } = randomBoard();
    const tree = buildMerkleTree(types);
    activeGames.set(gameId, {
      boardTypes: types,
      tree,
      ai: new HuntTargetAI(),
      myIdx,
    });
  }
  const ag = activeGames.get(gameId)!;
  const cellCount = ag.boardTypes.filter((t) => t !== TYPE_WATER).length;
  try {
    const hash = await walletClient.writeContract({
      address: gameAddress,
      abi: gameAbi,
      functionName: "commitBoard",
      args: [gameId, ag.tree.root, cellCount],
      account: walletClient.account,
      chain: CHAIN,
    });
    await publicClient.waitForTransactionReceipt({ hash });
    console.log(`[agent] committed board for game ${gameId} (root ${ag.tree.root.slice(0, 10)}...)`);
  } catch (e) {
    console.error(`[agent] commitBoard ${gameId} failed:`, (e as Error).message);
  }
}

async function playActiveTurn(gameId: bigint, game: any, myIdx: 0 | 1) {
  // Ensure we have an AgentGame entry (in case we joined mid-flight).
  if (!activeGames.has(gameId)) {
    // Cannot reconstruct our board if we did not commit -- skip defensively.
    console.warn(`[agent] game ${gameId}: active but no local board, skipping`);
    return;
  }
  const ag = activeGames.get(gameId)!;

  // Check for a pending shot against us (we are the defender).
  const pending = (await publicClient.readContract({
    address: gameAddress,
    abi: gameAbi,
    functionName: "getPendingShot",
    args: [gameId],
  })) as any;

  if (pending.active && Number(pending.shooterIdx) !== myIdx) {
    // We must answer with a Merkle proof.
    const cellIdx = Number(pending.y) * BOARD_SIZE + Number(pending.x);
    const cellType = ag.boardTypes[cellIdx];
    const proof = getProof(ag.tree, cellIdx);
    try {
      const hash = await walletClient.writeContract({
        address: gameAddress,
        abi: gameAbi,
        functionName: "respondShot",
        args: [gameId, cellType, proof],
        account: walletClient.account,
        chain: CHAIN,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      console.log(
        `[agent] answered shot at (${pending.x},${pending.y}) in game ${gameId} -> ${
          cellType === TYPE_WATER ? "miss" : "hit"
        }`
      );
    } catch (e) {
      console.error(`[agent] respondShot ${gameId} failed:`, (e as Error).message);
    }
    return;
  }

  // If it is our turn and no pending shot, fire using the AI.
  if (Number(game.turn) === myIdx && !pending.active) {
    // First, check if we have previous shots that were resolved while we were away.
    // Read recent ShotResolved events for this game where we were the shooter.
    await syncResolvedShots(gameId, ag, myIdx);

    const target = ag.ai.nextShot();
    if (target === null) return;
    const x = target % BOARD_SIZE;
    const y = Math.floor(target / BOARD_SIZE);
    try {
      const hash = await walletClient.writeContract({
        address: gameAddress,
        abi: gameAbi,
        functionName: "fire",
        args: [gameId, x, y],
        account: walletClient.account,
        chain: CHAIN,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      // Result comes when defender responds — synced on next tick via syncResolvedShots.
      console.log(`[agent] fired at (${x},${y}) in game ${gameId}, awaiting response`);
    } catch (e) {
      console.error(`[agent] fire ${gameId} failed:`, (e as Error).message);
    }
  }
}

/**
 * Scan ShotResolved events to update the AI with outcomes it hasn't seen yet.
 * This handles the async nature: fire() and respondShot() are separate txs.
 */
async function syncResolvedShots(gameId: bigint, ag: AgentGame, myIdx: 0 | 1) {
  try {
    const currentBlock = await publicClient.getBlockNumber();
    const fromBlock = currentBlock > 1000n ? currentBlock - 1000n : 0n;
    const logs = await publicClient.getLogs({
      address: gameAddress,
      event: {
        type: "event",
        name: "ShotResolved",
        inputs: [
          { name: "gameId", type: "uint256", indexed: true },
          { name: "defenderIdx", type: "uint8", indexed: true },
          { name: "x", type: "uint8", indexed: false },
          { name: "y", type: "uint8", indexed: false },
          { name: "cellType", type: "uint8", indexed: false },
          { name: "hit", type: "bool", indexed: false },
          { name: "armored", type: "bool", indexed: false },
          { name: "stealth", type: "bool", indexed: false },
          { name: "sunk", type: "bool", indexed: false },
          { name: "cellDestroyed", type: "bool", indexed: false },
        ],
      },
      args: { gameId },
      fromBlock,
      toBlock: currentBlock,
    });
    // We are the shooter when defenderIdx != myIdx.
    for (const log of logs) {
      const args = log.args as any;
      if (Number(args.defenderIdx) === myIdx) continue; // we were defender, not shooter
      const x = Number(args.x);
      const y = Number(args.y);
      const cellIndex = y * BOARD_SIZE + x;
      const outcome = {
        x,
        y,
        hit: Boolean(args.hit),
        cellType: Number(args.cellType),
      };
      ag.ai.recordOutcome(cellIndex, outcome);
    }
  } catch {
    // non-critical: AI just won't have perfect info for this tick
  }
}

main().catch((e) => {
  console.error("[agent] fatal:", e);
  process.exit(1);
});
