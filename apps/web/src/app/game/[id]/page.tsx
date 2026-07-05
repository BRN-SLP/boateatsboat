"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { GameView } from "@/components/game/game-view";

export default function GamePage() {
  const params = useParams<{ id: string }>();
  const gameId = BigInt(params.id);
  const [theme, setTheme] = useState<"inferno" | "classic">("inferno");

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Duel <span className="font-mono text-slate-500">#{params.id}</span>
          </h1>
          <p className="text-xs text-slate-400">Bathtub Arena</p>
        </div>
        <div className="flex items-center gap-1 rounded-full border border-slate-200 p-1">
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
      </div>
      <GameView gameId={gameId} theme={theme} />
    </div>
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
      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        active ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-700"
      }`}
    >
      {label}
    </button>
  );
}
