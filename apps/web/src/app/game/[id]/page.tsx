"use client";

import { useParams } from "next/navigation";
import { useState, useMemo } from "react";
import Link from "next/link";
import { GameView } from "@/components/game/game-view";
import { StarConnect } from "@/components/star-connect";

export default function GamePage() {
  const params = useParams<{ id: string }>();
  // Memoize — BigInt creates a new object every call, which would restart
  // useEffect dependencies in child components on every render.
  const gameId = useMemo(() => BigInt(params.id), [params.id]);
  // Display only a short prefix of the random uint256 game id; the full id
  // stays in the URL and is available via the title tooltip.
  const shortId = useMemo(() => params.id.slice(0, 6), [params.id]);
  const [theme, setTheme] = useState<"inferno" | "classic">("inferno");

  return (
    <main className="flex h-[100dvh] w-screen flex-col overflow-hidden bg-[#A8D8EA]">
      {/* Top bar: compact nav + title */}
      <div className="flex shrink-0 items-center justify-between px-4 pt-3 pb-2">
        <nav className="flex gap-1.5">
          <Link href="/" className="sticker-btn doodle-border doodle-shadow -rotate-3 bg-white px-2.5 py-1 text-center font-marker text-sm uppercase tracking-wider">
            Home
          </Link>
          <Link href="/play" className="sticker-btn doodle-border doodle-shadow rotate-2 bg-white px-2.5 py-1 text-center font-marker text-sm uppercase tracking-wider">
            Arena
          </Link>
          <Link href="/about" className="sticker-btn doodle-border doodle-shadow -rotate-1 bg-white px-2.5 py-1 text-center font-marker text-sm uppercase tracking-wider">
            About
          </Link>
        </nav>

        <h1
          title={`Full game id: ${params.id}`}
          className="absolute left-1/2 max-w-[40vw] -translate-x-1/2 truncate font-creepster text-2xl tracking-widest text-[#1a1a1a] md:text-3xl"
        >
          DUEL #{shortId}
        </h1>

        <div className="flex items-center gap-2">
          <StarConnect size="sm" />
          <ThemeToggle label="🔥" active={theme === "inferno"} onClick={() => setTheme("inferno")} />
          <ThemeToggle label="⚓" active={theme === "classic"} onClick={() => setTheme("classic")} />
        </div>
      </div>

      {/* Game content — fills remaining space, no scroll */}
      <div className="min-h-0 flex-1 overflow-hidden px-4 pb-3">
        <GameView gameId={gameId} theme={theme} />
      </div>
    </main>
  );
}

function ThemeToggle({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-2 py-0.5 text-sm transition-colors ${
        active ? "bg-[#1a1a1a] text-white" : "bg-white/50 text-[#1a1a1a]/50"
      }`}
    >
      {label}
    </button>
  );
}
