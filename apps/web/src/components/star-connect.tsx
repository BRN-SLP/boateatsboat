"use client";

import { useAccount } from "wagmi";
import { useMiniPay } from "@/hooks/use-minipay";
import { ConnectButton } from "./connect-button";
import { cn } from "@/lib/utils";

/**
 * Star-shaped connect wallet button.
 * size="lg" for landing page (160px), size="sm" for other pages (80px).
 * Wraps RainbowKit ConnectButton functionality.
 */
export function StarConnect({ size = "lg" }: { size?: "lg" | "sm" }) {
  const { address } = useAccount();
  const inMiniPay = useMiniPay();

  // In MiniPay, fall back to standard connect button (auto-connects).
  if (inMiniPay) {
    return <ConnectButton />;
  }

  const dim = size === "lg" ? "h-40 w-40" : "h-20 w-20";
  const textSize = size === "lg" ? "text-xs w-16" : "text-[8px] w-10";
  const translate = size === "lg" ? "translate-y-[10px]" : "translate-y-[5px]";

  const shortAddr = address
    ? `${address.slice(0, 4)}…${address.slice(-3)}`
    : null;

  return (
    <StarButton dim={dim} textSize={textSize} translate={translate} connected={!!address}>
      {shortAddr ?? (
        <>
          Connect
          <br />
          Wallet
        </>
      )}
    </StarButton>
  );
}

/**
 * The star is an overlay. The actual click target is a transparent
 * RainbowKit ConnectButton rendered behind it.
 */
function StarButton({
  dim,
  textSize,
  translate,
  connected,
  children,
}: {
  dim: string;
  textSize: string;
  translate: string;
  connected: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("star-btn group relative flex rotate-[15deg] items-center justify-center", dim)}>
      {/* RainbowKit ConnectButton — invisible but clickable */}
      <div className="absolute inset-0 z-20 opacity-0 [&_button]:!h-full [&_button]:!w-full [&>div]:!h-full [&>div]:!w-full">
        <ConnectButton />
      </div>

      {/* Star SVG */}
      <svg
        className="absolute inset-0 h-full w-full fill-yellow-400 stroke-[#1a1a1a] stroke-[3px] drop-shadow-[4px_4px_0_rgba(26,26,26,1)]"
        viewBox="0 0 100 100"
      >
        <path
          d="M50 5 L62 38 L95 40 L70 62 L78 95 L50 78 L22 95 L30 62 L5 40 L38 38 Z"
          stroke-linejoin="round"
        />
      </svg>

      {/* Label */}
      <span
        className={cn(
          "relative z-10 block -rotate-[15deg] text-center font-marker font-bold uppercase leading-tight text-black",
          textSize,
          translate
        )}
      >
        {children}
      </span>

      {/* Green dot when connected */}
      {connected && (
        <span className="absolute right-3 top-3 z-10 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-black" />
      )}
    </div>
  );
}
