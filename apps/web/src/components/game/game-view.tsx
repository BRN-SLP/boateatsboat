"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { useGame } from "@/hooks/use-game";
import { gameAbi } from "@/lib/game-abi";
import { gameProxyFor, BOARD_SIZE } from "@/lib/game-config";
import { getProof, buildMerkleTree } from "@/lib/merkle";
import { randomBoard } from "@/lib/random-board";
import { Board, emptyBoard, type BoardState, type CellVisual } from "./board";
import { FleetPlacer, type PlacementResult } from "./fleet-placer";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

type Theme = "inferno" | "classic";

// Per-cell shot outcome. For hits, cellType is the revealed type and destroyed
// flags whether THIS shot destroyed the cell (drives sunk-ship detection).
type ShotInfo = { kind: "hit" | "miss"; cellType?: number; destroyed?: boolean };

// Map a hit outcome to its visual. Distinguishes armor-wounded, stealth-revealed
// and destroyed cells so the player understands what each hit means.
//   type 41 (Submarine stealth) -> stealth (revealed, 🤿)
//   type 21 (Battleship armor), not destroyed -> armor (holds, 🛡️)
//   any other hit, or an armor cell that IS destroyed -> hit (✕)
function hitVisual(shot: ShotInfo): CellVisual {
  const ct = shot.cellType ?? 0;
  if (ct === 41) return "stealth";
  if (ct >= 21 && ct < 41 && !shot.destroyed) return "armor";
  return "hit";
}

export function GameView({ gameId, theme }: { gameId: bigint; theme: Theme }) {
  const { game, pending, loading, error, myAddress } = useGame(gameId);
  const { chain } = useAccount();
  const { writeContract } = useWriteContract();

  // Persist placement in localStorage so it survives page refresh.
  // We store ONLY the types[] array (numbers) — the Merkle tree contains
  // Uint8Array[][] layers which JSON.stringify mangles into objects, breaking
  // getProof() after reload. Rebuild the tree from types on load instead.
  const storageKey = `beb-placement-${gameId}`;
  const [placement, setPlacement] = useState<PlacementResult | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      // Validate we got a 100-cell number array.
      const types: number[] | undefined = parsed?.types;
      if (!Array.isArray(types) || types.length !== BOARD_SIZE * BOARD_SIZE) return null;
      if (!types.every((t) => typeof t === "number")) return null;
      const tree = buildMerkleTree(types);
      const shipCellCount = types.filter((t) => t !== 0).length;
      return { types, tree, shipCellCount };
    } catch {
      return null;
    }
  });

  const savePlacement = useCallback((res: PlacementResult | null) => {
    setPlacement(res);
    if (typeof window !== "undefined") {
      if (res) {
        // Store only the serializable parts — tree is rebuilt on load.
        localStorage.setItem(storageKey, JSON.stringify({ types: res.types }));
      } else {
        localStorage.removeItem(storageKey);
      }
    }
  }, [storageKey]);

  // Enemy board: shots I have fired. Value carries hit/miss + reveal details.
  const [enemyShots, setEnemyShots] = useState<Map<number, ShotInfo>>(new Map());
  // My board: shots opponent has fired at me.
  const [myShots, setMyShots] = useState<Map<number, ShotInfo>>(new Map());

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading the bathtub...</div>;
  }
  if (error) {
    return <div className="p-8 text-center text-rose-600 text-sm">{error}</div>;
  }
  if (!game) {
    return <div className="p-8 text-center text-slate-500">Game not found.</div>;
  }

  const meIdx = (() => {
    if (!myAddress) return -1;
    if (game.players[0].account.toLowerCase() === myAddress.toLowerCase()) return 0;
    if (game.players[1].account.toLowerCase() === myAddress.toLowerCase()) return 1;
    return -1;
  })();

  if (meIdx === -1) {
    return <SpectatorView game={game} theme={theme} />;
  }

  if (game.state === 0) {
    const isCreator = meIdx === 0;
    const onWaitCancel = () => {
      if (!chain) return;
      writeContract({
        address: gameProxyFor(chain.id),
        abi: gameAbi,
        functionName: "cancelDuel",
        args: [gameId],
      });
    };
    return (
      <div className="flex flex-col items-center gap-4 p-8 text-center">
        <p className="text-slate-600">Waiting for an opponent to join...</p>
        <p className="text-xs text-slate-400">
          Share gameId <code className="font-mono">{gameId.toString()}</code>.{" "}
          {game.wager > 0n
            ? "Wagered duel — a real opponent must join."
            : "Free duel — request the AI agent, or invite a friend."}
        </p>
        {isCreator && (
          <button
            onClick={onWaitCancel}
            className="doodle-border doodle-shadow rounded-xl bg-[#1a1a1a] px-4 py-2 font-marker text-xs uppercase text-white"
          >
            Cancel &amp; refund
          </button>
        )}
      </div>
    );
  }

  if (game.state === 1) {
    if (game.players[meIdx].acknowledged) {
      return (
        <div className="p-8 text-center text-slate-600">
          Fleet locked in. Waiting for opponent to commit their board...
        </div>
      );
    }
    return (
      <div className="p-4">
        <FleetPlacer
          onReady={(res) => {
            savePlacement(res);
            // Commit immediately on-chain.
            if (chain) {
              const proxy = gameProxyFor(chain.id);
              writeContract({
                address: proxy,
                abi: gameAbi,
                functionName: "commitBoard",
                args: [gameId, res.tree.root, res.shipCellCount],
              });
            }
          }}
          randomize={randomBoard}
        />
      </div>
    );
  }

  if (game.state === 2) {
    return (
      <ActiveBattle
        gameId={gameId}
        meIdx={meIdx}
        placement={placement}
        enemyShots={enemyShots}
        setEnemyShots={setEnemyShots}
        myShots={myShots}
        setMyShots={setMyShots}
        pending={pending}
        theme={theme}
        cellsRemaining={game.players[meIdx].cellsRemaining}
        enemyCellsRemaining={game.players[1 - meIdx].cellsRemaining}
        turn={game.turn}
      />
    );
  }

  // Finished
  const iWon = game.winner.toLowerCase() === myAddress?.toLowerCase();
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-8 text-center flex flex-col items-center gap-4"
    >
      <motion.div
        initial={{ scale: 0, rotate: -30 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 14 }}
        className="text-6xl"
        aria-hidden
      >
        {iWon ? "🏆" : "🛁"}
      </motion.div>
      <motion.h2
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={cn("text-3xl font-bold", iWon ? "text-emerald-600" : "text-rose-600")}
      >
        {iWon ? "Admiral of the Tub" : "Your fleet is now bath toys."}
      </motion.h2>
      <p className="text-slate-500">
        {iWon ? "The rubber ducks salute you." : "Drain and try again."}
      </p>
      <a
        href="/play"
        className="mt-3 inline-flex items-center rounded-md bg-slate-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-700"
      >
        Sail again
      </a>
      {/* Celebratory duck wobble on win */}
      {iWon && (
        <div className="flex justify-center gap-6 text-2xl mt-2" aria-hidden>
          {[0, 0.3, 0.6].map((d, i) => (
            <motion.span
              key={i}
              animate={{ rotate: [-8, 8, -8], y: [0, -4, 0] }}
              transition={{ repeat: Infinity, duration: 1.6, delay: d, ease: "easeInOut" }}
            >
              🦆
            </motion.span>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ---------------------------------------------------------------
// Active battle: two boards + fire/respond.
// ---------------------------------------------------------------
function ActiveBattle({
  gameId,
  meIdx,
  placement,
  enemyShots,
  setEnemyShots,
  myShots,
  setMyShots,
  pending,
  theme,
  cellsRemaining,
  enemyCellsRemaining,
  turn,
}: {
  gameId: bigint;
  meIdx: number;
  placement: PlacementResult | null;
  enemyShots: Map<number, ShotInfo>;
  setEnemyShots: React.Dispatch<React.SetStateAction<Map<number, ShotInfo>>>;
  myShots: Map<number, ShotInfo>;
  setMyShots: React.Dispatch<React.SetStateAction<Map<number, ShotInfo>>>;
  pending: { active: boolean; shooterIdx: number; x: number; y: number; deadline: bigint } | null;
  theme: Theme;
  cellsRemaining: number;
  enemyCellsRemaining: number;
  turn: number;
}) {
  const { writeContract, isPending } = useWriteContract();
  const { chain } = useAccount();
  const publicClient = usePublicClient();

  // Measure the boards area and compute the largest square cell that fits both
  // boards side-by-side AND within the available height. Deterministic: no
  // aspect-ratio/flex fragility.
  const boardsRef = useRef<HTMLDivElement>(null);
  const infoRef = useRef<HTMLDivElement>(null);
  const [cellSize, setCellSize] = useState(28);
  useEffect(() => {
    const el = boardsRef.current;
    if (!el) return;
    const compute = () => {
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;
      // Measure the real central-column width (responsive: w-32 on mobile,
      // w-44 on desktop) instead of a hard-coded constant, plus both gaps
      // (2 × gap-3 = 24px). Falls back to 200 if the ref isn't ready yet.
      const infoW = infoRef.current?.getBoundingClientRect().width ?? 176;
      const infoColW = infoW + 24;
      const perBoardW = (r.width - infoColW) / 2;
      // Each board: ~18px row-label column + 10 cells + gaps + borders.
      // 24px per-board overhead covers labels/border rounding.
      const byW = Math.floor((perBoardW - 24) / 10);
      // Height: title (~20px) + column-letter row (~ one cell) + 10 cells,
      // plus a 16px safety margin.
      const byH = Math.floor((r.height - 36) / 11);
      // Small 5% safety so border/padding rounding never pushes overflow.
      const cs = Math.max(14, Math.floor(Math.min(byW, byH) * 0.95));
      setCellSize(cs);
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const myTurn = turn === meIdx && !pending?.active;
  const mustRespond = Boolean(pending?.active && pending.shooterIdx !== meIdx);

  // Subscribe to ShotResolved events to update boards with real outcomes.
  useEffect(() => {
    if (!publicClient || !chain) return;
    const proxy = gameProxyFor(chain.id);

    const shotEvent = {
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
    } as const;

    const applyLogs = (logs: any[]) => {
      for (const log of logs) {
        const { defenderIdx, x, y, hit, cellType, cellDestroyed } = log.args ?? {};
        if (x == null || y == null) continue;
        const idx = Number(y) * BOARD_SIZE + Number(x);
        const isHit = Boolean(hit);
        const info = { kind: (isHit ? "hit" : "miss") as "hit" | "miss", cellType: Number(cellType), destroyed: Boolean(cellDestroyed) };
        if (Number(defenderIdx) === meIdx) {
          setMyShots((prev) => {
            const next = new Map(prev);
            next.set(idx, info);
            return next;
          });
        } else {
          setEnemyShots((prev) => {
            const next = new Map(prev);
            next.set(idx, info);
            return next;
          });
        }
      }
    };

    // 1. Load historical ShotResolved events for this game.
    // Use a recent fromBlock — Celo rejects getLogs from genesis.
    publicClient.getBlockNumber().then((currentBlock) => {
      const fromBlock = currentBlock > 45000n ? currentBlock - 45000n : 0n;
      return publicClient.getLogs({
        address: proxy,
        event: shotEvent,
        args: { gameId },
        fromBlock,
        toBlock: "latest",
      });
    }).then(applyLogs).catch(() => {});

    // 2. Watch for new events.
    const unwatch = publicClient.watchEvent({
      address: proxy,
      event: shotEvent,
      args: { gameId },
      onLogs: applyLogs,
      pollingInterval: 4000,
    });
    return () => { unwatch(); };
  }, [publicClient, chain, gameId, meIdx, setEnemyShots, setMyShots]);

  // Build enemy board visual: fog for un-fired cells, hit/miss for fired.
  const enemyBoard = useMemo<BoardState>(() => {
    const cells: CellVisual[] = [];
    for (let i = 0; i < BOARD_SIZE * BOARD_SIZE; i++) {
      const shot = enemyShots.get(i);
      if (shot?.kind === "hit") cells.push(hitVisual(shot));
      else if (shot?.kind === "miss") cells.push("water");
      else cells.push("fog");
    }
    return { cells };
  }, [enemyShots]);

  // Build own board visual: ship where placed, hit/miss on incoming shots.
  const ownBoard = useMemo<BoardState>(() => {
    const cells: CellVisual[] = [];
    for (let i = 0; i < BOARD_SIZE * BOARD_SIZE; i++) {
      const placed = placement?.types[i] ?? 0;
      const shot = myShots.get(i);
      if (shot?.kind === "hit") cells.push(hitVisual(shot));
      else if (placed !== 0) cells.push("ship");
      else if (shot?.kind === "miss") cells.push("water");
      else cells.push("fog");
    }
    return { cells };
  }, [placement, myShots]);

  // Detect sunk enemy ships from revealed hits. Group adjacent destroyed cells
  // of the same type into a ship run; a ship is sunk when every cell in the run
  // is destroyed. carrier=5/type1, cruiser=3/type1, battleship=4/type21, sub=3/type41.
  const { sunkNames, sunkRuns } = useMemo<{
    sunkNames: string[];
    sunkRuns: { type: number; cells: number; startX: number; startY: number; vertical: boolean }[];
  }>(() => {
    const destroyed = new Set<number>();
    const types = new Map<number, number>();
    for (const [idx, info] of enemyShots) {
      if (info.kind === "hit" && info.destroyed) {
        destroyed.add(idx);
        if (info.cellType != null) types.set(idx, info.cellType);
      }
    }
    const names: string[] = [];
    const runs: { type: number; cells: number; startX: number; startY: number; vertical: boolean }[] = [];
    const visited = new Set<number>();
    for (const start of destroyed) {
      if (visited.has(start)) continue;
      const t = types.get(start) ?? 1;
      // Expand run horizontally and vertically from start, same type.
      const run = [start];
      visited.add(start);
      const expand = (idx: number, dx: number, dy: number) => {
        let cx = idx % BOARD_SIZE, cy = Math.floor(idx / BOARD_SIZE);
        for (;;) {
          cx += dx; cy += dy;
          if (cx < 0 || cx >= BOARD_SIZE || cy < 0 || cy >= BOARD_SIZE) break;
          const n = cy * BOARD_SIZE + cx;
          if (destroyed.has(n) && (types.get(n) ?? 1) === t) { run.push(n); visited.add(n); }
          else break;
        }
      };
      expand(start, 1, 0); expand(start, -1, 0);
      expand(start, 0, 1); expand(start, 0, -1);
      // Classify by (type, length).
      const len = run.length;
      const minX = Math.min(...run.map((i) => i % BOARD_SIZE));
      const minY = Math.min(...run.map((i) => Math.floor(i / BOARD_SIZE)));
      const vertical = run.some((i) => Math.floor(i / BOARD_SIZE) !== minY);
      let name: string | null = null;
      if (t === 41 && len >= 3) name = "Submarine";
      else if (t === 21 && len >= 4) name = "Battleship";
      else if (t === 1 && len >= 5) name = "Carrier";
      else if (t === 1 && len >= 3) name = "Cruiser";
      if (name) {
        names.push(name);
        runs.push({ type: t, cells: len, startX: minX, startY: minY, vertical });
      }
    }
    return { sunkNames: names, sunkRuns: runs };
  }, [enemyShots]);

  const onFire = useCallback(
    (x: number, y: number) => {
      if (!chain || !myTurn) return;
      const proxy = gameProxyFor(chain.id);
      writeContract(
        {
          address: proxy,
          abi: gameAbi,
          functionName: "fire",
          args: [gameId, x, y],
        },
        {
          onSuccess: () => {
            // Real outcome arrives via ShotResolved event listener above.
            // useGame polling will refresh pending shot + turn state.
          },
        }
      );
    },
    [chain, myTurn, gameId]
  );

  const onRespond = useCallback(() => {
    if (!chain || !mustRespond || !placement || !pending) return;
    const idx = pending.y * BOARD_SIZE + pending.x;
    const cellType = placement.types[idx];
    const proof = getProof(placement.tree, idx);
    const proxy = gameProxyFor(chain.id);
    writeContract(
      {
        address: proxy,
        abi: gameAbi,
        functionName: "respondShot",
        args: [gameId, cellType, proof],
      },
      {
        onSuccess: () => {
          // Optimistic mark until the ShotResolved event confirms. For hits we
          // cannot know destroyed/armor yet, so only set kind + revealed type.
          setMyShots((prev) => {
            const next = new Map(prev);
            next.set(idx, { kind: cellType === 0 ? "miss" : "hit", cellType });
            return next;
          });
        },
      }
    );
  }, [chain, mustRespond, placement, pending, gameId, setMyShots]);

  // Claim a forfeit win: if the opponent fired at us and then stalled past the
  // move timeout, we (the defender) can claim the win. The contract's
  // claimForfeit is callable by the SHOOTER when the defender times out, but
  // also by us when an incoming shot is unanswered — here we expose it for the
  // case where it is OUR turn to respond and the deadline has passed.
  const now = Date.now();
  const canForfeit = Boolean(
    pending?.active && pending.shooterIdx === meIdx && pending.deadline > 0n && Number(pending.deadline) * 1000 < now
  );
  const onClaimForfeit = useCallback(() => {
    if (!chain || !canForfeit) return;
    const proxy = gameProxyFor(chain.id);
    writeContract({
      address: proxy,
      abi: gameAbi,
      functionName: "claimForfeit",
      args: [gameId],
    });
  }, [chain, canForfeit, gameId]);

  return (
    <div className="flex h-full flex-col gap-2">
      {/* Battle area: three columns — Their fleet | info | Your fleet.
          The whole area is measured and cellSize computed so both boards +
          the central info column fit one screen without scroll. */}
      <div ref={boardsRef} className="flex min-h-0 flex-1 items-stretch justify-center gap-3">
        <BoardColumn
          title="Their fleet"
          subtitle={`${enemyCellsRemaining} cells afloat`}
          board={enemyBoard}
          theme={theme}
          clickable={myTurn}
          onCellClick={onFire}
          fleet="green"
          cellSize={cellSize}
          sunkShips={sunkRuns}
        />

        {/* Central info column: turn status, action button, sunk ships, legend.
            Responsive width: narrower on mobile so both boards keep room. */}
        <div ref={infoRef} className="flex w-32 shrink-0 flex-col items-center justify-center gap-2 md:w-44 md:gap-3">
          <StatusLine
            myTurn={myTurn}
            mustRespond={mustRespond}
            cellsRemaining={cellsRemaining}
          />
          {mustRespond ? (
            <button
              disabled={isPending}
              onClick={onRespond}
              className="doodle-border doodle-shadow rounded-xl bg-[#d33a30] px-3 py-2 text-center font-marker text-xs uppercase text-white disabled:opacity-40"
            >
              {isPending ? "Answering..." : "Answer shot"}
            </button>
          ) : canForfeit ? (
            <button
              disabled={isPending}
              onClick={onClaimForfeit}
              className="doodle-border doodle-shadow rounded-xl bg-[#1a1a1a] px-3 py-2 text-center font-marker text-xs uppercase text-white disabled:opacity-40"
            >
              {isPending ? "Claiming..." : "Claim win 🏳️"}
            </button>
          ) : (
            <span className="px-3 py-2 font-marker text-xs uppercase opacity-0">&nbsp;</span>
          )}

          {/* Sunk enemy ships indicator */}
          <div className="flex min-h-[1.5rem] flex-wrap items-center justify-center gap-1.5 overflow-hidden">
            {sunkNames.map((name, i) => (
              <span
                key={i}
                className="doodle-border doodle-shadow rounded-lg bg-[#1a1a1a] px-2 py-1 text-center font-marker text-[10px] uppercase text-white"
              >
                🎯 {name}
              </span>
            ))}
          </div>
        </div>

        <BoardColumn
          title="Your fleet"
          subtitle={`${cellsRemaining} cells afloat`}
          board={ownBoard}
          theme={theme}
          shipTypes={placement?.types}
          fleet="blue"
          cellSize={cellSize}
        />
      </div>

      {/* Fleet legend. Desktop: inline toggle. Mobile: button -> bottom sheet
          (so it never steals vertical space from the boards). */}
      <div className="hidden shrink-0 justify-center md:flex">
        <FleetLegend />
      </div>
      <div className="flex shrink-0 justify-center md:hidden">
        <FleetLegendMobile />
      </div>
    </div>
  );
}

// The four-ship reference cards. Shared between the inline (desktop) toggle
// and the mobile bottom-sheet so the content stays in sync.
const FLEET_SHIPS = [
  { emoji: "🛳️", name: "Carrier", size: 5, hp: 1, rule: "Standard — sinks in one hit per cell" },
  { emoji: "🚢", name: "Battleship", size: 4, hp: 2, rule: "🛡️ Armor — first hit wounds (steals the turn), second hit destroys" },
  { emoji: "⛴️", name: "Cruiser", size: 3, hp: 1, rule: "Standard — sinks in one hit per cell" },
  { emoji: "🤿", name: "Submarine", size: 3, hp: 1, rule: "🌊 Stealth — hidden until hit, revealed on first shot" },
];

function FleetLegendCards() {
  return (
    <div className="doodle-border doodle-shadow rounded-xl bg-[#F9F7F2] p-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {FLEET_SHIPS.map((s) => (
          <div key={s.name} className="flex flex-col gap-0.5 rounded-lg border border-[#1a1a1a]/10 bg-white px-2 py-1.5">
            <div className="flex items-center gap-1">
              <span className="text-base leading-none">{s.emoji}</span>
              <span className="font-marker text-xs uppercase text-[#1a1a1a]">{s.name}</span>
            </div>
            <div className="font-mono text-[10px] text-[#1a1a1a]/50">{s.size} cells · {s.hp} HP</div>
            <div className="text-[10px] leading-tight text-[#1a1a1a]/70">{s.rule}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Compact fleet reference showing each ship, its size, HP and special rule.
// Collapsible: a small info button toggles the card grid.
function FleetLegend() {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="doodle-border doodle-shadow flex items-center gap-1.5 rounded-full bg-white px-3 py-1 font-marker text-xs uppercase tracking-wider text-[#1a1a1a] hover:scale-105"
        aria-expanded={open}
      >
        <span className="text-sm">ℹ️</span>
        Fleet intel
        <span className="text-[10px] text-[#1a1a1a]/40">{open ? "▲" : "▼"}</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="legend"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="w-full overflow-hidden"
          >
            <FleetLegendCards />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Mobile version: hidden behind a button that opens a bottom sheet, so the
// legend no longer competes with the boards for vertical space on phones.
function FleetLegendMobile() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          className="doodle-border doodle-shadow flex items-center gap-1.5 rounded-full bg-white px-3 py-1 font-marker text-xs uppercase tracking-wider text-[#1a1a1a]"
        >
          <span className="text-sm">🚢</span>
          Fleet intel
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[80dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-marker uppercase">Fleet intel</SheetTitle>
        </SheetHeader>
        <FleetLegendCards />
      </SheetContent>
    </Sheet>
  );
}

function BoardColumn({
  title,
  subtitle,
  board,
  theme,
  clickable,
  onCellClick,
  shipTypes,
  sunkShips,
  fleet = "blue",
  cellSize = 28,
}: {
  title: string;
  subtitle: string;
  board: BoardState;
  theme: Theme;
  clickable?: boolean;
  onCellClick?: (x: number, y: number) => void;
  shipTypes?: number[];
  sunkShips?: { type: number; cells: number; startX: number; startY: number; vertical: boolean }[];
  fleet?: "blue" | "green";
  cellSize?: number;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        <span className="text-[10px] text-slate-400">{subtitle}</span>
      </div>
      <Board state={board} theme={theme} clickable={clickable} onCellClick={onCellClick} shipTypes={shipTypes} sunkShips={sunkShips} fleet={fleet} cellSize={cellSize} />
    </div>
  );
}

function StatusLine({
  myTurn,
  mustRespond,
  cellsRemaining,
}: {
  myTurn: boolean;
  mustRespond: boolean;
  cellsRemaining: number;
}) {
  let lines: string[] = ["Opponent's turn", "waiting for their move..."];
  let tone: "rose" | "emerald" | "slate" = "slate";
  if (mustRespond) {
    lines = ["Incoming shot!", "Answer with proof."];
    tone = "rose";
  } else if (myTurn) {
    lines = ["Your turn", "fire at their fleet."];
    tone = "emerald";
  }
  void cellsRemaining;
  const key = lines.join("|");
  return (
    <AnimatePresence mode="wait">
      <motion.p
        key={key}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        className={cn(
          "text-center text-xs font-medium leading-tight",
          tone === "rose" ? "text-rose-600" : tone === "emerald" ? "text-emerald-600" : "text-slate-500"
        )}
      >
        {lines.map((l, i) => (
          <span key={i} className="block">{l}</span>
        ))}
      </motion.p>
    </AnimatePresence>
  );
}

function SpectatorView({ game, theme }: { game: any; theme: Theme }) {
  // Spectators only see whose turn it is and the score; no board details.
  return (
    <div className="p-8 text-center">
      <p className="text-slate-600 text-sm">
        Spectating game. Turn: player {game.turn + 1}. Scores:{" "}
        {game.players[0].shotsHit} / {game.players[1].shotsHit} hits.
      </p>
    </div>
  );
}
