"use client";

import { useRef, useState, useEffect } from "react";
import { BOARD_SIZE } from "@/lib/game-config";
import { BoardCell, type CellVisual } from "./cell";
import { ShipOverlay, extractShipRuns, type ShipRun, type FleetColor } from "./ship-overlay";
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
  shipTypes,
  fleet = "blue",
}: {
  state: BoardState;
  theme: "inferno" | "classic";
  label?: string;
  clickable?: boolean;
  onCellClick?: (x: number, y: number) => void;
  previewCells?: Set<number>;
  compact?: boolean;
  shipTypes?: number[];
  fleet?: FleetColor;
}) {
  const colLetters = "ABCDEFGHIJ";
  const cellAreaRef = useRef<HTMLDivElement>(null);
  const [cellSize, setCellSize] = useState(compact ? 24 : 34);
  const gap = 2;

  useEffect(() => {
    if (!cellAreaRef.current) return;
    const measure = () => {
      const cell = cellAreaRef.current?.querySelector("[data-cell]");
      if (cell) {
        const w = cell.getBoundingClientRect().width;
        if (w > 0) setCellSize(w);
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const ships: ShipRun[] = shipTypes ? extractShipRuns(shipTypes) : [];

  return (
    <div className={cn("flex flex-col gap-1 mx-auto", compact ? "w-full max-w-[260px]" : "w-full max-w-[440px]")}>
      {label && (
        <div className="text-xs font-medium text-slate-500 text-center">{label}</div>
      )}
      {/* Column letters */}
      <div className="flex gap-[2px] pl-[18px]">
        {Array.from({ length: BOARD_SIZE }, (_, x) => (
          <span key={x} className="flex-1 text-center text-[10px] text-slate-400 font-mono">
            {colLetters[x]}
          </span>
        ))}
      </div>
      {/* Body: row labels + cell area */}
      <div className="flex gap-[2px]">
        {/* Row labels */}
        <div className="flex w-[16px] flex-col">
          {Array.from({ length: BOARD_SIZE }, (_, y) => (
            <span
              key={y}
              className="flex flex-1 items-center justify-end pr-1 text-[10px] text-slate-400 font-mono"
            >
              {y + 1}
            </span>
          ))}
        </div>
        {/* Cell area — relative for ship overlay */}
        <div ref={cellAreaRef} className="relative flex-1">
          <div className="grid grid-cols-10 gap-[2px]">
            {Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, idx) => {
              const x = idx % BOARD_SIZE;
              const y = Math.floor(idx / BOARD_SIZE);
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
          </div>
          {/* Ship silhouettes overlay */}
          {ships.length > 0 && (
            <ShipOverlay ships={ships} cellSize={cellSize} gap={gap} fleet={fleet} />
          )}
        </div>
      </div>
    </div>
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
