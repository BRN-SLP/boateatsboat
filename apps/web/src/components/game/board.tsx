"use client";

import { BOARD_SIZE } from "@/lib/game-config";
import { BoardCell, type CellVisual } from "./cell";
import { ShipOverlay, extractShipRuns, type ShipRun, type FleetColor } from "./ship-overlay";

export interface BoardState {
  // 100-cell visual array, indexed y*BOARD_SIZE + x.
  cells: CellVisual[];
}

export type { CellVisual };

/**
 * Board rendered with an EXPLICIT pixel cell size. This is deterministic and
 * avoids all aspect-ratio / flex-fit fragility: whoever owns the layout
 * measures the available space and passes the cellSize that fits.
 */
export function Board({
  state,
  theme,
  label,
  clickable,
  onCellClick,
  previewCells,
  cellSize = 28,
  shipTypes,
  fleet = "blue",
}: {
  state: BoardState;
  theme: "inferno" | "classic";
  label?: string;
  clickable?: boolean;
  onCellClick?: (x: number, y: number) => void;
  previewCells?: Set<number>;
  cellSize?: number;
  shipTypes?: number[];
  fleet?: FleetColor;
}) {
  const colLetters = "ABCDEFGHIJ";
  const gap = 2;
  const ships: ShipRun[] = shipTypes ? extractShipRuns(shipTypes) : [];

  const labelStyle: React.CSSProperties = { width: cellSize, fontSize: Math.max(9, cellSize * 0.4) };
  const gridStyle: React.CSSProperties = {
    gridTemplateColumns: `repeat(${BOARD_SIZE}, ${cellSize}px)`,
    gap,
  };

  return (
    <div className="mx-auto flex flex-col gap-1">
      {label && (
        <div className="text-center font-marker text-xs text-slate-600">{label}</div>
      )}
      {/* Column letters */}
      <div className="flex gap-[2px] pl-[18px]">
        {Array.from({ length: BOARD_SIZE }, (_, x) => (
          <span
            key={x}
            className="flex items-center justify-center font-bold text-[#1a1a1a]"
            style={labelStyle}
          >
            {colLetters[x]}
          </span>
        ))}
      </div>
      {/* Body: row labels + cell area */}
      <div className="flex gap-[2px]">
        {/* Row labels */}
        <div className="flex w-[16px] flex-col gap-[2px]">
          {Array.from({ length: BOARD_SIZE }, (_, y) => (
            <span
              key={y}
              className="flex items-center justify-end pr-1 font-bold text-[#1a1a1a]"
              style={{ height: cellSize, fontSize: Math.max(9, cellSize * 0.4) }}
            >
              {y + 1}
            </span>
          ))}
        </div>
        {/* Cell area — relative for ship overlay */}
        <div className="relative">
          <div className="grid" style={gridStyle}>
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
                  size={cellSize}
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
