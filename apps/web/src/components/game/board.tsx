"use client";

import { motion } from "framer-motion";
import { BOARD_SIZE } from "@/lib/game-config";
import { BoardCell, type CellVisual } from "./cell";
import { cn } from "@/lib/utils";

export interface BoardState {
  // 100-cell visual array, indexed y*BOARD_SIZE + x.
  cells: CellVisual[];
}

export type { CellVisual };

export function Board({
  state,
  theme,
  label,
  clickable,
  onCellClick,
  previewCells,
  compact,
}: {
  state: BoardState;
  theme: "inferno" | "classic";
  label?: string;
  clickable?: boolean;
  onCellClick?: (x: number, y: number) => void;
  previewCells?: Set<number>; // cell indices hovered during placement
  compact?: boolean;
}) {
  const colLetters = "ABCDEFGHIJ";
  return (
    <div className={cn("flex flex-col gap-1", compact ? "w-full max-w-[260px]" : "w-full max-w-[400px]")}>
      {label && (
        <div className="text-xs font-medium text-slate-500 text-center">{label}</div>
      )}
      <div className="grid grid-cols-[16px_repeat(10,1fr)] gap-[2px]">
        {/* top corner + column letters */}
        <span />
        {Array.from({ length: BOARD_SIZE }, (_, x) => (
          <span
            key={x}
            className="text-center text-[10px] text-slate-400 font-mono"
          >
            {colLetters[x]}
          </span>
        ))}
        {/* rows */}
        {Array.from({ length: BOARD_SIZE }, (_, y) => (
          <Row
            key={y}
            y={y}
            state={state}
            theme={theme}
            clickable={clickable}
            onCellClick={onCellClick}
            previewCells={previewCells}
          />
        ))}
      </div>
    </div>
  );
}

function Row({
  y,
  state,
  theme,
  clickable,
  onCellClick,
  previewCells,
}: {
  y: number;
  state: BoardState;
  theme: "inferno" | "classic";
  clickable?: boolean;
  onCellClick?: (x: number, y: number) => void;
  previewCells?: Set<number>;
}) {
  return (
    <>
      <span className="text-right pr-1 text-[10px] text-slate-400 font-mono leading-6">
        {y + 1}
      </span>
      {Array.from({ length: BOARD_SIZE }, (_, x) => {
        const idx = y * BOARD_SIZE + x;
        return (
          <BoardCell
            key={idx}
            x={x}
            y={y}
            visual={state.cells[idx]}
            theme={theme}
            clickable={clickable}
            onCellClick={onCellClick}
            preview={previewCells?.has(idx)}
          />
        );
      })}
    </>
  );
}

// Build an empty 100-cell board (all fog).
export function emptyBoard(): BoardState {
  return { cells: Array.from({ length: BOARD_SIZE * BOARD_SIZE }, () => "fog" as CellVisual) };
}

// Build a board from explicit cell types (own board during placement reveal).
export function boardFromTypes(types: number[]): BoardState {
  return {
    cells: types.map((t) => (t === 0 ? "water" : "ship")) as CellVisual[],
  };
}
