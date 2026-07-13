"use client";

import Link from "next/link";
import { ConnectButton } from "@/components/connect-button";

// Floating transparent nav for the landing page.
// Overlays the artwork directly — no header bar, no background.
export function FloatingNav() {
  return (
    <nav className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-6 py-4 sm:px-10">
      {/* Wordmark */}
      <Link
        href="/"
        className="text-sm font-black uppercase tracking-wider text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] sm:text-lg"
      >
        BoatEatsBoat
      </Link>

      {/* Center links */}
      <div className="flex items-center gap-6 text-xs font-bold uppercase tracking-wider text-white/90 drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)] sm:gap-8 sm:text-sm">
        <Link href="/" className="transition hover:text-[#FFD700]">
          Home
        </Link>
        <Link href="/play" className="transition hover:text-[#FFD700]">
          Arena
        </Link>
        <Link href="/about" className="transition hover:text-[#FFD700]">
          About
        </Link>
      </div>

      {/* Connect wallet */}
      <ConnectButton />
    </nav>
  );
}
