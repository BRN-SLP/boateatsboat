"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { gameAbi } from "@/lib/game-abi";
import { gameProxyFor } from "@/lib/game-config";
import { StarConnect } from "@/components/star-connect";

export default function PlayPage() {
  const router = useRouter();
  const { address, chain } = useAccount();
  const { writeContract, isPending } = useWriteContract();
  const publicClient = usePublicClient();
  const [joinId, setJoinId] = useState("");
  const [lastCreated, setLastCreated] = useState<bigint | null>(null);

  useEffect(() => {
    if (lastCreated !== null) {
      router.push(`/game/${lastCreated}`);
    }
  }, [lastCreated, router]);

  const onCreate = () => {
    if (!chain) return;
    const proxy = gameProxyFor(chain.id);
    writeContract(
      {
        address: proxy,
        abi: gameAbi,
        functionName: "createDuel",
        args: [0n],
      },
      {
        onSuccess: async (hash) => {
          if (!publicClient) return;
          const receipt = await publicClient.waitForTransactionReceipt({ hash });
          const log = receipt.logs.find((l) => l.address.toLowerCase() === proxy.toLowerCase());
          if (log && log.topics[1]) {
            const gameId = BigInt(log.topics[1]);
            setLastCreated(gameId);
          }
        },
      }
    );
  };

  const onJoin = () => {
    if (!chain || !joinId) return;
    const proxy = gameProxyFor(chain.id);
    const id = BigInt(joinId);
    writeContract(
      {
        address: proxy,
        abi: gameAbi,
        functionName: "joinDuel",
        args: [id],
      },
      {
        onSuccess: () => {
          router.push(`/game/${id}`);
        },
      }
    );
  };

  return (
    <main className="relative flex h-screen w-screen items-center justify-center overflow-hidden bg-gray-900">
      <div className="relative aspect-video h-full max-h-screen w-full overflow-hidden bg-[#A8D8EA] shadow-2xl">
        {/* UI Layer */}
        <div className="absolute inset-0 flex h-full w-full flex-col p-6">
          {/* Top: Nav + Title */}
          <div className="flex items-start justify-between">
            <nav className="flex w-28 flex-col gap-2 pl-2 pt-2">
              <Link href="/" className="sticker-btn doodle-border doodle-shadow -rotate-6 origin-bottom-right bg-white px-3 py-1.5 text-center font-marker text-lg uppercase tracking-wider">
                Home
              </Link>
              <Link href="/play" className="sticker-btn doodle-border doodle-shadow rotate-3 origin-center bg-[#d33a30] px-3 py-1.5 text-center font-marker text-lg uppercase tracking-wider text-white">
                Arena
              </Link>
              <Link href="/about" className="sticker-btn doodle-border doodle-shadow -rotate-2 origin-top-left bg-white px-3 py-1.5 text-center font-marker text-lg uppercase tracking-wider">
                About
              </Link>
            </nav>

            <header className="flex flex-1 flex-col items-center justify-start pt-2">
              <h1 className="text-center font-creepster text-4xl leading-tight tracking-widest text-[#1a1a1a] md:text-5xl lg:text-6xl">
                PICK YOUR TUB
              </h1>
              <p className="mt-1 font-marker text-sm text-[#1a1a1a]/70">
                Start a duel or join one. Free duels get an AI opponent.
              </p>
            </header>

            <div className="flex w-28 justify-end pt-2">
              <StarConnect size="sm" />
            </div>
          </div>

          {/* Center: Action Cards */}
          <div className="flex flex-1 items-center justify-center">
            <div className="grid w-full max-w-3xl gap-6 sm:grid-cols-2">
              {/* New Duel */}
              <div className="sticker-btn doodle-border doodle-shadow -rotate-2 flex flex-col gap-3 bg-[#F9F7F2] p-5">
                <h2 className="font-marker text-2xl uppercase text-[#1a1a1a]">New duel</h2>
                <p className="text-xs leading-relaxed text-[#1a1a1a]/60">
                  Free entry. The AI agent joins within seconds. Real on-chain shots, real Merkle proofs.
                </p>
                <button
                  disabled={!address || isPending}
                  onClick={onCreate}
                  className="play-btn doodle-shadow-large mt-auto rounded-2xl border-[3px] border-[#1a1a1a] bg-[#d33a30] px-6 py-3 font-marker text-xl uppercase tracking-wider text-white disabled:opacity-40"
                >
                  {isPending ? "Creating..." : "Create duel"}
                </button>
              </div>

              {/* Join Duel */}
              <div className="sticker-btn doodle-border doodle-shadow rotate-2 flex flex-col gap-3 bg-[#F9F7F2] p-5">
                <h2 className="font-marker text-2xl uppercase text-[#1a1a1a]">Join a duel</h2>
                <p className="text-xs leading-relaxed text-[#1a1a1a]/60">
                  Got a game id from a friend? Drop it here.
                </p>
                <input
                  type="text"
                  inputMode="numeric"
                  value={joinId}
                  onChange={(e) => setJoinId(e.target.value)}
                  placeholder="e.g. 3"
                  className="doodle-border rounded-md bg-white px-3 py-2 font-marker text-lg text-[#1a1a1a] placeholder:text-[#1a1a1a]/30"
                />
                <button
                  disabled={!address || isPending || !joinId}
                  onClick={onJoin}
                  className="play-btn doodle-shadow-large rounded-2xl border-[3px] border-[#1a1a1a] bg-[#257ABB] px-6 py-3 font-marker text-xl uppercase tracking-wider text-white disabled:opacity-40"
                >
                  Join
                </button>
              </div>
            </div>
          </div>

          {/* Wallet warning */}
          {!address && (
            <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <div className="doodle-border doodle-shadow rotate-2 bg-[#fff3cd] px-6 py-3 font-marker text-sm uppercase text-[#856404]">
                Connect your wallet to play
              </div>
            </div>
          )}

          {/* Bottom caption */}
          <div className="flex justify-center pb-2">
            <p className="font-marker text-xs uppercase tracking-wider text-[#1a1a1a]/50">
              Each shot is on-chain · Every duel = dozens of real Celo txs · Boat eats boat
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
