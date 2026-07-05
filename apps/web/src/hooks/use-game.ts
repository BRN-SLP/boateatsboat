"use client";

import { useEffect, useState } from "react";
import { usePublicClient, useAccount } from "wagmi";
import { parseAbiItem, type Address } from "viem";
import { gameProxyFor } from "@/lib/game-config";
import { gameAbi } from "@/lib/game-abi";

// Polling-based game reader. Refreshes every `intervalMs` (default 6s) and on new blocks.
// Used by GameView to track board state, turn, pending shots, and finish.

export interface GameView {
  state: number; // 0 Open, 1 Placing, 2 Active, 3 Finished
  players: {
    account: Address;
    boardRoot: `0x${string}`;
    shotsHit: number;
    cellsRemaining: number;
    acknowledged: boolean;
  }[];
  wager: bigint;
  winner: Address;
  turn: number;
  lastActionAt: bigint;
  moveTimeout: bigint;
}

export interface PendingShotView {
  active: boolean;
  shooterIdx: number;
  x: number;
  y: number;
  deadline: bigint;
}

export function useGame(gameId: bigint | null, intervalMs = 6000) {
  const publicClient = usePublicClient();
  const { address, chain } = useAccount();
  const [game, setGame] = useState<GameView | null>(null);
  const [pending, setPending] = useState<PendingShotView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!publicClient || gameId === null) return;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const proxy = (() => {
      try {
        return gameProxyFor(chain?.id ?? 42220);
      } catch (e) {
        setError((e as Error).message);
        return null;
      }
    })();
    if (!proxy) return;

    const refresh = async () => {
      try {
        const g = (await publicClient.readContract({
          address: proxy,
          abi: gameAbi,
          functionName: "getGame",
          args: [gameId],
        })) as any;
        if (cancelled) return;
        const gameView: GameView = {
          state: Number(g.state),
          players: g.players.map((p: any) => ({
            account: p.account,
            boardRoot: p.boardRoot,
            shotsHit: Number(p.shotsHit),
            cellsRemaining: Number(p.cellsRemaining),
            acknowledged: p.acknowledged,
          })),
          wager: g.wager,
          winner: g.winner,
          turn: Number(g.turn),
          lastActionAt: g.lastActionAt,
          moveTimeout: g.moveTimeout,
        };
        setGame(gameView);
        const ps = (await publicClient.readContract({
          address: proxy,
          abi: gameAbi,
          functionName: "getPendingShot",
          args: [gameId],
        })) as any;
        if (cancelled) return;
        setPending({
          active: ps.active,
          shooterIdx: Number(ps.shooterIdx),
          x: Number(ps.x),
          y: Number(ps.y),
          deadline: ps.deadline,
        });
        setError(null);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    refresh();
    timer = setInterval(refresh, intervalMs);

    // Also watch for ShotResolved / GameFinished events to refresh faster.
    const unwatch = publicClient.watchEvent({
      address: proxy,
      onLogs: () => refresh(),
      pollingInterval: 4000,
    });

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      unwatch();
    };
  }, [publicClient, gameId, chain?.id, intervalMs]);

  return { game, pending, loading, error, myAddress: address };
}
