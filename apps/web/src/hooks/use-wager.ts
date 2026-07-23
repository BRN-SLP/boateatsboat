"use client";

import { useCallback, useState } from "react";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { erc20Abi, type Address } from "viem";
import { gameAbi } from "@/lib/game-abi";
import { gameProxyFor, paymentTokenFor } from "@/lib/game-config";

/**
 * Create a duel with an optional cUSD wager. Handles ERC20 approve when needed.
 * wager = 0n for a friendly (free) duel; > 0n stakes cUSD into the contract escrow.
 * Returns the new gameId on success, or null while pending/failed.
 */
export function useCreateDuel() {
  const { chain } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(
    async (wager: bigint, vsBot = false): Promise<bigint | null> => {
      if (!chain || !publicClient) {
        setError("Connect your wallet first");
        return null;
      }
      setPending(true);
      setError(null);
      try {
        const proxy = gameProxyFor(chain.id);
        // If there is a wager, approve the payment token for the exact amount.
        // Most tokens need approve-before-transferFrom; we set it to the wager.
        if (wager > 0n) {
          const token = paymentTokenFor(chain.id);
          // Approve the wager amount. Re-approving each time is simplest and safe.
          const approveTx = await writeContractAsync({
            address: token,
            abi: erc20Abi,
            functionName: "approve",
            args: [proxy, wager],
          });
          await publicClient.waitForTransactionReceipt({ hash: approveTx });
        }
        // Create the duel; the contract escrows the wager via transferFrom.
        const createTx = await writeContractAsync({
          address: proxy,
          abi: gameAbi,
          functionName: "createDuel",
          args: [wager],
        });
        const receipt = await publicClient.waitForTransactionReceipt({ hash: createTx });
        // GameCreated is indexed by gameId (topic1). Filter by its topic0 to avoid
        // matching other events that also carry an indexed first arg.
        const GAME_CREATED_TOPIC = "0x7dfb67e9ff596fca4da65c7eedb128cd1aac553af54b3c0cb733625a2480d8bd";
        const log = receipt.logs.find(
          (l) =>
            l.address.toLowerCase() === proxy.toLowerCase() &&
            l.topics[0]?.toLowerCase() === GAME_CREATED_TOPIC &&
            l.topics.length > 1
        );
        if (!log || !log.topics[1]) return null;
        const gameId = BigInt(log.topics[1]);
        // For the "vs AI" free mode, summon the bot so it auto-joins this duel.
        if (vsBot && wager === 0n) {
          const botTx = await writeContractAsync({
            address: proxy,
            abi: gameAbi,
            functionName: "requestBot",
            args: [gameId],
          });
          await publicClient.waitForTransactionReceipt({ hash: botTx });
        }
        return gameId;
      } catch (e) {
        const err = e as Error & { shortMessage?: string };
        setError(err.shortMessage || err.message || "Transaction failed");
        return null;
      } finally {
        setPending(false);
      }
    },
    [chain, publicClient, writeContractAsync]
  );

  return { create, pending, error };
}

/** Join an existing duel. Matches the wager via transferFrom if needed. */
export function useJoinDuel() {
  const { chain } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const join = useCallback(
    async (gameId: bigint): Promise<boolean> => {
      if (!chain || !publicClient) {
        setError("Connect your wallet first");
        return false;
      }
      setPending(true);
      setError(null);
      try {
        const proxy = gameProxyFor(chain.id);
        // Read the wager to know how much to approve.
        const game = (await publicClient.readContract({
          address: proxy,
          abi: gameAbi,
          functionName: "getGame",
          args: [gameId],
        })) as any;
        const wager: bigint = game.wager;
        if (wager > 0n) {
          const token = paymentTokenFor(chain.id);
          const approveTx = await writeContractAsync({
            address: token,
            abi: erc20Abi,
            functionName: "approve",
            args: [proxy, wager],
          });
          await publicClient.waitForTransactionReceipt({ hash: approveTx });
        }
        const joinTx = await writeContractAsync({
          address: proxy,
          abi: gameAbi,
          functionName: "joinDuel",
          args: [gameId],
        });
        await publicClient.waitForTransactionReceipt({ hash: joinTx });
        return true;
      } catch (e) {
        const err = e as Error & { shortMessage?: string };
        setError(err.shortMessage || err.message || "Transaction failed");
        return false;
      } finally {
        setPending(false);
      }
    },
    [chain, publicClient, writeContractAsync]
  );

  return { join, pending, error };
}
