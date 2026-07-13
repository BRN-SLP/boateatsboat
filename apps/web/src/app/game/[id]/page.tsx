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
      <div className="relative aspect-video h-full max-h-screen w-full overflow-hidden bg-[#A8D8EA] shadow-2xl">
        <div className="absolute inset-0 flex h-full w-full flex-col p-6">
          {/* Top: Nav + Title + Theme toggle */}
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
                DUEL <span className="font-mono">#{params.id}</span>
              </h1>
              <div className="mt-1 flex items-center gap-1">
                <ThemeToggle
                  label="Inferno"
                  active={theme === "inferno"}
                  onClick={() => setTheme("inferno")}
                />
                <ThemeToggle
                  label="Classic"
                  active={theme === "classic"}
                  onClick={() => setTheme("classic")}
                />
              </div>
            </header>

            <div className="w-28" />
          </div>

          {/* Scrollable game content */}
          <div className="doodle-border doodle-shadow mt-4 flex-1 overflow-y-auto bg-[#F9F7F2] p-4">
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
      className={`rounded-full px-3 py-0.5 font-marker text-xs uppercase tracking-wider transition-colors ${
        active
          ? "bg-[#1a1a1a] text-white"
          : "bg-white/50 text-[#1a1a1a]/50 hover:text-[#1a1a1a]"
      }`}
    >
      {label}
    </button>
  );
}
