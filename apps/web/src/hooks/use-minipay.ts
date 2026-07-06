"use client";

import { useEffect, useState } from "react";
import { usePublicClient, useAccount } from "wagmi";
import { formatUnits, parseAbiItem, type Address } from "viem";
import { PAYMENT_TOKEN } from "@/lib/game-config";

// Detects whether the dApp is running inside the MiniPay wallet
// (Opera Mini on Android / standalone MiniPay app) per the official
// minipay-integration skill. MiniPay injects window.ethereum.isMiniPay = true
// and connects implicitly -- no Connect button should be shown.

export function useMiniPay(): boolean {
  const [inMiniPay, setInMiniPay] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const eth = (window as Window & { ethereum?: { isMiniPay?: boolean } })
      .ethereum;
    setInMiniPay(!!eth?.isMiniPay);
  }, []);
  return inMiniPay;
}

// Reads the player's cUSD (mainnet) / USDm (testnet) balance for the active
// chain's payment token. Returns null while loading or when no wallet is
// connected. Refreshes every intervalMs (default 10s).
export function usePaymentBalance(intervalMs = 10000): {
  balance: string | null;
  decimals: number;
  refresh: () => void;
} {
  const publicClient = usePublicClient();
  const { address, chain } = useAccount();
  const [balance, setBalance] = useState<string | null>(null);

  const token = chain ? PAYMENT_TOKEN[chain.id] : undefined;

  const read = async () => {
    if (!publicClient || !address || !token) {
      setBalance(null);
      return;
    }
    try {
      const bal = (await publicClient.readContract({
        address: token,
        abi: [
          parseAbiItem(
            "function balanceOf(address account) view returns (uint256)"
          ),
        ],
        functionName: "balanceOf",
        args: [address],
      })) as bigint;
      setBalance(formatUnits(bal, 18));
    } catch {
      setBalance(null);
    }
  };

  useEffect(() => {
    read();
    if (!intervalMs) return;
    const id = setInterval(read, intervalMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, chain?.id, token, intervalMs]);

  return { balance, decimals: 18, refresh: read };
}
