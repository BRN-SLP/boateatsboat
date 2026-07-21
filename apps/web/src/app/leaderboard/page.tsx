"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAccount, usePublicClient } from "wagmi";
import { type Address } from "viem";
import { gameAbi } from "@/lib/game-abi";
import { gameProxyFor } from "@/lib/game-config";
import { motion } from "framer-motion";
import { Flame } from "lucide-react";
import { StarConnect } from "@/components/star-connect";

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

  useEffect(() => {
    if (!publicClient || !chain) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const run = async () => {
      try {
        const proxy = gameProxyFor(chain.id);
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
          if (winner) {
            const e = tally.get(winner) ?? { wins: 0, losses: 0, seen: true };
            e.wins += 1;
            tally.set(winner, e);
          }
        }
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
        // ignore
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
    <main className="relative flex h-screen w-screen items-center justify-center overflow-hidden bg-gray-900">
      <div className="relative aspect-video h-full max-h-screen w-full overflow-hidden bg-[#A8D8EA] shadow-2xl">
        <div className="absolute inset-0 flex h-full w-full flex-col p-6">
          {/* Top: Nav + Title */}
          <div className="flex items-start justify-between">
            <nav className="flex w-28 flex-col gap-2 pl-2 pt-2">
              <Link href="/" className="sticker-btn doodle-border doodle-shadow -rotate-6 origin-bottom-right bg-white px-3 py-1.5 text-center font-marker text-lg uppercase tracking-wider">
                Home
              </Link>
              <Link href="/play" className="sticker-btn doodle-border doodle-shadow rotate-3 origin-center bg-white px-3 py-1.5 text-center font-marker text-lg uppercase tracking-wider">
                Arena
              </Link>
              <Link href="/about" className="sticker-btn doodle-border doodle-shadow -rotate-2 origin-top-left bg-white px-3 py-1.5 text-center font-marker text-lg uppercase tracking-wider">
                About
              </Link>
            </nav>

            <header className="flex flex-1 flex-col items-center justify-start pt-2">
              <h1 className="text-center font-creepster text-4xl leading-tight tracking-widest text-[#1a1a1a] md:text-5xl lg:text-6xl">
                ADMIRALS OF THE TUB
              </h1>
              <p className="mt-1 font-marker text-sm text-[#1a1a1a]/70">
                Ranked by ELO · Earned in real on-chain duels
              </p>
            </header>

            <div className="flex w-28 justify-end pt-2">
              <StarConnect size="sm" />
            </div>
          </div>

          {/* Scrollable leaderboard list */}
          <div className="doodle-border doodle-shadow mt-4 flex-1 overflow-y-auto bg-[#F9F7F2] p-4">
            {loading ? (
              <p className="font-marker text-sm uppercase text-[#1a1a1a]/50">
                Rounding up the ducks...
              </p>
            ) : rows.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3">
                <p className="font-marker text-sm uppercase text-[#1a1a1a]/50">
                  No admirals yet.
                </p>
                <Link href="/play" className="play-btn doodle-shadow-large rounded-2xl border-[3px] border-[#1a1a1a] bg-[#d33a30] px-6 py-2 font-marker text-lg uppercase tracking-wider text-white">
                  Be the first
                </Link>
              </div>
            ) : (
              <ol className="flex flex-col gap-2">
                {rows.map((r, i) => (
                  <motion.li
                    key={r.player}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="doodle-border flex items-center justify-between bg-white px-4 py-2"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-marker text-sm text-[#1a1a1a]/40">#{i + 1}</span>
                      <span className="font-mono text-sm text-[#1a1a1a]">
                        {shortAddr(r.player)}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="inline-flex items-center gap-1 font-marker text-sm text-[#DF4949]">
                        <Flame className="h-3.5 w-3.5" /> {r.wins}
                      </span>
                      <span className="font-mono text-sm text-[#1a1a1a]/60">ELO {r.elo}</span>
                    </div>
                  </motion.li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </main>
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
