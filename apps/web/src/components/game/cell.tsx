"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export type CellVisual =
  | "fog" // unknown (enemy cell, not fired upon)
  | "water" // miss / confirmed empty
  | "ship" // own ship, intact
  | "hit" // own ship, damaged (armor) or enemy confirmed hit
  | "burning" // ship on fire (Inferno theme, just hit)
  | "sunk"; // ship destroyed

export function BoardCell({
  visual,
  theme,
  clickable,
  onCellClick,
  x,
  y,
  preview,
}: {
  visual: CellVisual;
  theme: "inferno" | "classic";
  clickable?: boolean;
  onCellClick?: (x: number, y: number) => void;
  x: number;
  y: number;
  preview?: boolean; // hover preview during placement
}) {
  const base =
    "relative aspect-square rounded-[3px] border border-slate-300/40 transition-colors select-none";

  const palette = CELL_PALETTES[theme][visual];

  return (
    <motion.button
      type="button"
      data-cell
      disabled={!clickable && !preview}
      onClick={() => clickable && onCellClick?.(x, y)}
      whileHover={clickable ? { scale: 1.05 } : undefined}
      whileTap={clickable ? { scale: 0.95 } : undefined}
      className={cn(base, palette.bg, clickable && "cursor-pointer", preview && "ring-2 ring-rose-400")}
      animate={visual === "burning" ? { scale: [1, 1.04, 1] } : undefined}
      transition={visual === "burning" ? { repeat: Infinity, duration: 0.7, ease: "easeInOut" } : undefined}
      aria-label={`cell ${x},${y} ${visual}`}
    >
      {visual === "water" && <MissMark />}
      {visual === "burning" && <Flame theme={theme} />}
      {visual === "sunk" && <SunkMark theme={theme} />}
      {visual === "hit" && <HitMark />}
    </motion.button>
  );
}

const CELL_PALETTES = {
  inferno: {
    fog: { bg: "bg-sky-100/80 hover:bg-sky-200/80" },
    water: { bg: "bg-white/90 border-slate-400" },
    ship: { bg: "bg-blue-200/50" },
    hit: { bg: "bg-amber-500" },
    burning: { bg: "bg-orange-600" },
    sunk: { bg: "bg-slate-800" },
  },
  classic: {
    fog: { bg: "bg-sky-100/80 hover:bg-sky-200/80" },
    water: { bg: "bg-white/90 border-slate-400" },
    ship: { bg: "bg-blue-200/50" },
    hit: { bg: "bg-blue-700" },
    burning: { bg: "bg-blue-800" },
    sunk: { bg: "bg-slate-900" },
  },
} as const;

function Splash({ theme }: { theme: "inferno" | "classic" }) {
  const color = theme === "inferno" ? "bg-white/70" : "bg-white/70";
  return (
    <motion.span
      className={cn("absolute inset-0 m-auto h-2 w-2 rounded-full", color)}
      initial={{ scale: 0.4, opacity: 0.8 }}
      animate={{ scale: [0.4, 1.4, 0.6], opacity: [0.8, 0, 0] }}
      transition={{ duration: 0.8, ease: "easeOut" }}
    />
  );
}

function MissMark() {
  return (
    <span className="absolute inset-0 m-auto flex items-center justify-center">
      <span className="h-1/4 w-1/4 rounded-full bg-slate-400" />
    </span>
  );
}

function Flame({ theme }: { theme: "inferno" | "classic" }) {
  // Toy-ship on fire: cartoon flame. Classic theme uses a dimmer glow.
  return (
    <motion.span
      className={cn(
        "absolute inset-0 m-auto rounded-full blur-[3px]",
        theme === "inferno" ? "bg-gradient-to-t from-amber-500 via-orange-500 to-yellow-300" : "bg-blue-500/50"
      )}
      animate={{ opacity: [0.7, 1, 0.7], scale: [0.9, 1.1, 0.9] }}
      transition={{ repeat: Infinity, duration: 0.6 }}
    />
  );
}

function SunkMark({ theme }: { theme: "inferno" | "classic" }) {
  return (
    <span
      className={cn(
        "absolute inset-0 m-auto flex items-center justify-center text-[10px]",
        theme === "inferno" ? "text-orange-300" : "text-blue-300"
      )}
    >
      x
    </span>
  );
}

function HitMark() {
  return (
    <span className="absolute inset-0 m-auto flex items-center justify-center text-base font-black text-white leading-none">
      ✕
    </span>
  );
}
