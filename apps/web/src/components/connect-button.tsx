"use client";

import { ConnectButton as RainbowKitConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { useMiniPay } from "@/hooks/use-minipay";

export function ConnectButton() {
  const inMiniPay = useMiniPay();
  const { address } = useAccount();

  // MiniPay connects implicitly -- no Connect button. Once auto-connected,
  // show a compact address chip so the user still sees which wallet is active.
  if (inMiniPay) {
    if (!address) return null;
    const short = `${address.slice(0, 6)}…${address.slice(-4)}`;
    return (
      <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-medium text-emerald-700">
        {short}
      </span>
    );
  }

  return <RainbowKitConnectButton />;
}
