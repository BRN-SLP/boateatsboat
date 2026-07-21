"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { useGame } from "@/hooks/use-game";
import { gameAbi } from "@/lib/game-abi";
import { gameProxyFor, BOARD_SIZE } from "@/lib/game-config";
import { getProof } from "@/lib/merkle";
import { randomBoard } from "@/lib/random-board";
import { Board, emptyBoard, type BoardState, type CellVisual } from "./board";
import { FleetPlacer, type PlacementResult } from "./fleet-placer";
import { cn } from "@/lib/utils";

type Theme = "inferno" | "classic";

export function GameView({ gameId, theme }: { gameId: bigint; theme: Theme }) {
  const { game, pending, loading, error, myAddress } = useGame(gameId);
  const { chain } = useAccount();
  const { writeContract } = useWriteContract();

  // Persist placement in localStorage so it survives page refresh.
  const storageKey = `beb-placement-${gameId}`;
  const [placement, setPlacement] = useState<PlacementResult | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed as PlacementResult;
    } catch {
      return null;
    }
  });

  const savePlacement = useCallback((res: PlacementResult | null) => {
    setPlacement(res);
    if (typeof window !== "undefined") {
      if (res) {
        localStorage.setItem(storageKey, JSON.stringify(res));
      } else {
        localStorage.removeItem(storageKey);
      }
    }
  }, [storageKey]);

  // Enemy board: shots I have fired (hit/miss markers).
  const [enemyShots, setEnemyShots] = useState<Map<number, "hit" | "miss">>(new Map());
  // My board: shots opponent has fired at me.
  const [myShots, setMyShots] = useState<Map<number, "hit" | "miss">>(new Map());

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
    return (
      <div className="p-8 text-center">
        <p className="text-slate-600">Waiting for an opponent to join...</p>
        <p className="mt-2 text-xs text-slate-400">
          Share gameId <code className="font-mono">{gameId.toString()}</code>. The AI agent
          joins free duels automatically.
        </p>
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
  enemyShots: Map<number, "hit" | "miss">;
  setEnemyShots: React.Dispatch<React.SetStateAction<Map<number, "hit" | "miss">>>;
  myShots: Map<number, "hit" | "miss">;
  setMyShots: React.Dispatch<React.SetStateAction<Map<number, "hit" | "miss">>>;
  pending: { active: boolean; shooterIdx: number; x: number; y: number } | null;
  theme: Theme;
  cellsRemaining: number;
  enemyCellsRemaining: number;
  turn: number;
}) {
  const { writeContract, isPending } = useWriteContract();
  const { chain } = useAccount();
  const publicClient = usePublicClient();

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
      ],
    } as const;

    const applyLogs = (logs: any[]) => {
      for (const log of logs) {
        const { defenderIdx, x, y, hit } = log.args ?? {};
        if (x == null || y == null) continue;
        const idx = Number(y) * BOARD_SIZE + Number(x);
        const isHit = Boolean(hit);
        if (Number(defenderIdx) === meIdx) {
          setMyShots((prev) => {
            const next = new Map(prev);
            next.set(idx, isHit ? "hit" : "miss");
            return next;
          });
        } else {
          setEnemyShots((prev) => {
            const next = new Map(prev);
            next.set(idx, isHit ? "hit" : "miss");
            return next;
          });
        }
      }
    };

    // 1. Load historical ShotResolved events for this game.
    publicClient.getLogs({
      address: proxy,
      event: shotEvent,
      args: { gameId },
      fromBlock: 0n,
      toBlock: "latest",
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
      cells.push(shot === "hit" ? "burning" : shot === "miss" ? "water" : "fog");
    }
    return { cells };
  }, [enemyShots]);

  // Build own board visual: ship where placed, hit/miss on incoming shots.
  const ownBoard = useMemo<BoardState>(() => {
    const cells: CellVisual[] = [];
    for (let i = 0; i < BOARD_SIZE * BOARD_SIZE; i++) {
      const placed = placement?.types[i] ?? 0;
      const shot = myShots.get(i);
      if (shot === "hit") cells.push("burning");
      else if (placed !== 0) cells.push("ship");
      else if (shot === "miss") cells.push("water");
      else cells.push("fog");
    }
    return { cells };
  }, [placement, myShots]);

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
          setMyShots((prev) => {
            const next = new Map(prev);
            next.set(idx, cellType === 0 ? "miss" : "hit");
            return next;
          });
        },
      }
    );
  }, [chain, mustRespond, placement, pending, gameId, setMyShots]);

  return (
    <div className="flex flex-col gap-4">
      {/* Status bar */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <StatusLine
          myTurn={myTurn}
          mustRespond={mustRespond}
          cellsRemaining={cellsRemaining}
        />
        {mustRespond && (
          <button
            disabled={isPending}
            onClick={onRespond}
            className="doodle-border doodle-shadow rounded-xl bg-[#d33a30] px-4 py-2 font-marker text-sm uppercase text-white disabled:opacity-40"
          >
            {isPending ? "Answering..." : "Answer shot (proof)"}
          </button>
        )}
      </div>

      {/* Two boards side by side */}
      <div className="flex flex-wrap items-start justify-center gap-4">
        <div className="min-w-0 flex-1" style={{ maxWidth: "50%" }}>
          <BoardColumn
            title="Their fleet"
            subtitle={`${enemyCellsRemaining} cells afloat`}
            board={enemyBoard}
            theme={theme}
            clickable={myTurn}
            onCellClick={onFire}
            fleet="green"
          />
        </div>
        <div className="min-w-0 flex-1" style={{ maxWidth: "50%" }}>
          <BoardColumn
            title="Your fleet"
            subtitle={`${cellsRemaining} cells afloat`}
            board={ownBoard}
            theme={theme}
            shipTypes={placement?.types}
            fleet="blue"
          />
        </div>
      </div>
    </div>
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
  fleet = "blue",
}: {
  title: string;
  subtitle: string;
  board: BoardState;
  theme: Theme;
  clickable?: boolean;
  onCellClick?: (x: number, y: number) => void;
  shipTypes?: number[];
  fleet?: "blue" | "green";
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        <span className="text-[10px] text-slate-400">{subtitle}</span>
      </div>
      <Board state={board} theme={theme} clickable={clickable} onCellClick={onCellClick} shipTypes={shipTypes} fleet={fleet} />
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
  let text = "Waiting...";
  if (mustRespond) text = "Incoming shot! Answer with proof.";
  else if (myTurn) text = "Your turn -- fire at their fleet.";
  return (
    <AnimatePresence mode="wait">
      <motion.p
        key={text}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        className={cn(
          "text-sm font-medium",
          mustRespond ? "text-rose-600" : myTurn ? "text-emerald-600" : "text-slate-500"
        )}
      >
        {text}
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
