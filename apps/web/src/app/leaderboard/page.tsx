"use client";

import { useEffect, useState } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { type Address } from "viem";
import { gameAbi } from "@/lib/game-abi";
import { gameProxyFor } from "@/lib/game-config";
import { motion } from "framer-motion";
import { Trophy, Flame } from "lucide-react";

interface Row {
  player: string;
  wins: number;
  losses: number;
  elo: number;
}

export default function LeaderboardPage() {
  const { chain } = useAccount();
  const publicClient = usePublicClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  // Leaderboard is read off recent GameFinished events (winners + losers seen).
  useEffect(() => {
    if (!publicClient || !chain) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const run = async () => {
      try {
        const proxy = gameProxyFor(chain.id);
        // Read GameFinished events from the last ~5000 blocks.
        const block = await publicClient.getBlockNumber();
        const from = block > 5000n ? block - 5000n : 0n;
        const logs = await publicClient.getLogs({
          address: proxy,
          event: parseGameFinished(),
          fromBlock: from,
          toBlock: block,
        });
        const tally = new Map<string, { wins: number; losses: number; seen: boolean }>();
        for (const l of logs) {
          const winner = (l.args.winner ?? "").toLowerCase();
          const byForfeit = l.args.byForfeit;
          // GameFinished(uint256 indexed gameId, address indexed winner, bool byForfeit)
          if (winner) {
            const e = tally.get(winner) ?? { wins: 0, losses: 0, seen: true };
            e.wins += 1;
            tally.set(winner, e);
          }
          // Loser is implicit (the other player); we cannot derive it from the event alone,
          // so the leaderboard is win-count + ELO (read separately). Losses stay 0 here.
          void byForfeit;
        }
        // Read ELO for each winner and assemble rows.
        const addresses = Array.from(tally.keys()) as Address[];
        const eloReads = await Promise.all(
          addresses.map((a) =>
            publicClient
              .readContract({
                address: proxy,
                abi: gameAbi,
                functionName: "elo",
                args: [a],
              })
              .then((e) => Number(e))
              .catch(() => 0)
          )
        );
        const winsReads = await Promise.all(
          addresses.map((a) =>
            publicClient
              .readContract({
                address: proxy,
                abi: gameAbi,
                functionName: "wins",
                args: [a],
              })
              .then((w) => Number(w))
              .catch(() => 0)
          )
        );
        if (cancelled) return;
        const assembled: Row[] = addresses.map((a, i) => ({
          player: a,
          wins: winsReads[i],
          losses: 0,
          elo: eloReads[i] || 1000,
        }));
        assembled.sort((x, y) => y.elo - x.elo || y.wins - x.wins);
        setRows(assembled);
      } catch {
        // ignore -- empty leaderboard is fine
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [publicClient, chain]);

  return (
    <div className="container mx-auto max-w-3xl px-4 py-12">
      <div className="flex items-center gap-3 mb-8">
        <Trophy className="h-7 w-7 text-amber-500" />
        <h1 className="text-3xl font-bold text-slate-800">Admirals of the Tub</h1>
      </div>
      <p className="text-slate-500 mb-8 text-sm">
        Ranked by ELO. Earned in real on-chain duels -- no farming, just fleet.
      </p>

      {loading ? (
        <p className="text-slate-400 text-sm">Rounding up the ducks...</p>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 p-10 text-center">
          <p className="text-slate-500 text-sm">
            No admirals yet. <a href="/play" className="text-rose-600 underline">Be the first.</a>
          </p>
        </div>
      ) : (
        <ol className="flex flex-col gap-2">
          {rows.map((r, i) => (
            <motion.li
              key={r.player}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-mono text-slate-400 w-6">#{i + 1}</span>
                <span className="font-mono text-sm text-slate-700">
                  {shortAddr(r.player)}
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="inline-flex items-center gap-1 text-amber-600">
                  <Flame className="h-3.5 w-3.5" /> {r.wins}
                </span>
                <span className="font-mono text-slate-500">ELO {r.elo}</span>
              </div>
            </motion.li>
          ))}
        </ol>
      )}
    </div>
  );
}

function shortAddr(a: string): string {
  return a.slice(0, 6) + "..." + a.slice(-4);
}

function parseGameFinished() {
  return {
    type: "event",
    name: "GameFinished",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true },
      { name: "winner", type: "address", indexed: true },
      { name: "byForfeit", type: "bool", indexed: false },
    ],
  } as const;
}
