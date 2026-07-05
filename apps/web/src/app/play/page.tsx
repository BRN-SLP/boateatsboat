"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { Button } from "@/components/ui/button";
import { gameAbi } from "@/lib/game-abi";
import { gameProxyFor } from "@/lib/game-config";

export default function PlayPage() {
  const router = useRouter();
  const { address, chain } = useAccount();
  const { writeContract, isPending } = useWriteContract();
  const publicClient = usePublicClient();
  const [joinId, setJoinId] = useState("");
  const [lastCreated, setLastCreated] = useState<bigint | null>(null);

  // After createDuel, read nextGameId-1 to navigate to the new game.
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
        args: [0n], // free duel (agent joins automatically)
      },
      {
        onSuccess: async (hash) => {
          if (!publicClient) return;
          const receipt = await publicClient.waitForTransactionReceipt({ hash });
          // GameCreated event topic = first log from the proxy in this tx.
          const log = receipt.logs.find((l) => l.address.toLowerCase() === proxy.toLowerCase());
          if (log && log.topics[1]) {
            // gameId is the first indexed topic.
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
    <div className="container mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-bold text-slate-800 mb-2">Pick your tub</h1>
      <p className="text-slate-500 mb-8">
        Start a new duel or join one. Free duels get an AI opponent automatically.
      </p>

      {!address && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-700 mb-6">
          Connect your wallet to play.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 p-5 flex flex-col gap-3">
          <h2 className="font-semibold text-slate-700">New duel</h2>
          <p className="text-xs text-slate-500">
            Free entry. The AI agent joins within seconds. Real on-chain shots, real Merkle proofs.
          </p>
          <Button disabled={!address || isPending} onClick={onCreate} className="mt-auto">
            {isPending ? "Creating..." : "Create duel"}
          </Button>
        </div>

        <div className="rounded-lg border border-slate-200 p-5 flex flex-col gap-3">
          <h2 className="font-semibold text-slate-700">Join a duel</h2>
          <p className="text-xs text-slate-500">
            Got a game id from a friend? Drop it here.
          </p>
          <input
            type="text"
            inputMode="numeric"
            value={joinId}
            onChange={(e) => setJoinId(e.target.value)}
            placeholder="e.g. 3"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <Button
            disabled={!address || isPending || !joinId}
            variant="outline"
            onClick={onJoin}
          >
            Join
          </Button>
        </div>
      </div>

      <p className="mt-8 text-xs text-slate-400">
        Each shot is on-chain. Every duel = dozens of real Celo transactions. Boat eats boat.
      </p>
    </div>
  );
}
