"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { GameView } from "@/components/game/game-view";

export default function GamePage() {
  const params = useParams<{ id: string }>();
  const gameId = BigInt(params.id);
  const [theme, setTheme] = useState<"inferno" | "classic">("inferno");

  return (
    <main className="relative flex h-screen w-screen items-center justify-center overflow-hidden bg-gray-900">
      <div className="relative aspect-video h-full max-h-screen w-full overflow-hidden bg-[#A8D8EA]">
        <div className="absolute inset-0 flex h-full w-full flex-col p-4">
          {/* Top bar: compact nav + title */}
          <div className="flex shrink-0 items-center justify-between">
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

            <h1 className="font-creepster text-2xl tracking-widest text-[#1a1a1a] md:text-3xl">
              DUEL <span className="font-mono">#{params.id}</span>
            </h1>

            <div className="flex items-center gap-1">
              <ThemeToggle label="🔥" active={theme === "inferno"} onClick={() => setTheme("inferno")} />
              <ThemeToggle label="⚓" active={theme === "classic"} onClick={() => setTheme("classic")} />
            </div>
          </div>

          {/* Game content — fills remaining space */}
          <div className="mt-2 flex-1 overflow-y-auto">
            <GameView gameId={gameId} theme={theme} />
          </div>
        </div>
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
