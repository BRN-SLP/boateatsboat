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
const GAME_CREATED_TOPIC =
  "0xe8d65b57a2d0d651c6c8e0c34035b3ba7fc157602b9b0c34035b3ba7fc157602" as const;

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

async function catchUpExistingGames() {
  const nextId = (await publicClient.readContract({
    address: gameAddress,
    abi: gameAbi,
    functionName: "nextGameId",
  })) as bigint;
  for (let id = 1n; id < nextId; id++) {
    try {
      await considerGame(id);
    } catch (e) {
      // ignore individual game errors during catch-up
    }
  }
}

async function tick() {
  try {
    const nextId = (await publicClient.readContract({
      address: gameAddress,
      abi: gameAbi,
      functionName: "nextGameId",
    })) as bigint;
    for (let id = 1n; id < nextId; id++) {
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

  // Open: join if we are not already the creator and there is no opponent yet.
  if (state === 0) {
    if (p0.toLowerCase() === me) return; // we created it, wait
    if (p1.toLowerCase() === me) return;
    // Don't auto-join games with a wager > 0 (agent plays free duels only).
    if (game.wager > 0n) return;
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
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      // Parse ShotResolved from logs to feed the AI.
      const outcome = parseShotResolved(receipt.logs, x, y);
      if (outcome) {
        ag.ai.recordOutcome(target, { x, y, ...outcome });
        console.log(
          `[agent] fired at (${x},${y}) in game ${gameId} -> ${
            outcome.hit ? "HIT" : "miss"
          }`
        );
      }
    } catch (e) {
      console.error(`[agent] fire ${gameId} failed:`, (e as Error).message);
    }
  }
}

// ShotResolved topic = keccak256("ShotResolved(uint256,uint8,uint8,uint8,uint8,bool,bool,bool,bool)")
const SHOT_RESOLVED_TOPIC =
  "0x" +
  // Pre-computed topic; falls back to scanning if signature differs.
  "0".repeat(64);

function parseShotResolved(logs: any[], x: number, y: number): { hit: boolean; cellType: number } | null {
  // Best-effort log scan. The contract emits ShotResolved after respondShot.
  // We accept any log in the receipt whose data decodes to (cellType, hit, ...).
  for (const log of logs) {
    if (!log.data || log.data.length < 130) continue;
    // Non-indexed fields are packed in data: cellType(uint8), hit(bool), armored(bool), stealth(bool), sunk(bool).
    // viem decodes logs as raw hex; we read byte offsets.
    try {
      const data: string = log.data;
      // Each non-indexed arg occupies 32 bytes in ABI encoding.
      const cellType = parseInt(data.slice(2 + 0, 2 + 64), 16);
      const hit = parseInt(data.slice(2 + 64, 2 + 128), 16) === 1;
      return { hit, cellType };
    } catch {
      continue;
    }
  }
  return null;
}

main().catch((e) => {
  console.error("[agent] fatal:", e);
  process.exit(1);
});
