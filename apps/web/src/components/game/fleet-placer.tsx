"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BOARD_SIZE, FLEET_SPEC, TYPE_WATER } from "@/lib/game-config";
import { buildMerkleTree, type MerkleTree } from "@/lib/merkle";
import { Board, emptyBoard } from "./board";
import { cn } from "@/lib/utils";

export interface PlacementResult {
  types: number[]; // 100-cell type array
  tree: MerkleTree;
  shipCellCount: number;
}

interface ShipState {
  id: string;
  size: number;
  type: number;
  cells: number[]; // occupied cells
}

// Ship display metadata (emoji, HP, rule) keyed by FLEET_SPEC id. Mirrors the
// FleetLegend cards so placement + battle use the same ship visuals.
const FLEET_SHIPS = [
  { id: "carrier", emoji: "🛳️", hp: 1 },
  { id: "battleship", emoji: "🚢", hp: 2 },
  { id: "cruiser", emoji: "⛴️", hp: 1 },
  { id: "submarine", emoji: "🤿", hp: 1 },
] as const;

export function FleetPlacer({
  onReady,
  randomize,
}: {
  onReady: (result: PlacementResult) => void;
  randomize?: () => { types: number[] };
}) {
  const [types, setTypes] = useState<number[]>(() =>
    Array.from({ length: BOARD_SIZE * BOARD_SIZE }, () => TYPE_WATER)
  );
  const [ships, setShips] = useState<ShipState[]>([]);
  const [selectedShipIdx, setSelectedShipIdx] = useState<number>(0);
  const [orientation, setOrientation] = useState<"h" | "v">("h");
  const [hoverCell, setHoverCell] = useState<number | null>(null);

  const remainingShips = useMemo(
    () => FLEET_SPEC.filter((s) => !ships.find((p) => p.id === s.id)),
    [ships]
  );

  const currentSpec = remainingShips[selectedShipIdx] ?? remainingShips[0];

  const hoverCells = useMemo(() => {
    if (hoverCell === null || !currentSpec) return new Set<number>();
    const x = hoverCell % BOARD_SIZE;
    const y = Math.floor(hoverCell / BOARD_SIZE);
    const cells: number[] = [];
    for (let i = 0; i < currentSpec.size; i++) {
      const cx = orientation === "h" ? x + i : x;
      const cy = orientation === "h" ? y : y + i;
      if (cx >= BOARD_SIZE || cy >= BOARD_SIZE) return new Set<number>();
      cells.push(cy * BOARD_SIZE + cx);
    }
    return new Set(cells);
  }, [hoverCell, currentSpec, orientation]);

  const canPlace = useMemo(() => {
    if (!currentSpec || hoverCells.size === 0) return false;
    for (const idx of hoverCells) {
      if (types[idx] !== TYPE_WATER) return false;
    }
    return true;
  }, [currentSpec, hoverCells, types]);

  const place = useCallback(
    (x: number, y: number) => {
      if (!currentSpec) return;
      // Compute cells directly from click coords + orientation.
      const cells: number[] = [];
      for (let i = 0; i < currentSpec.size; i++) {
        const cx = orientation === "h" ? x + i : x;
        const cy = orientation === "h" ? y : y + i;
        if (cx >= BOARD_SIZE || cy >= BOARD_SIZE) return; // out of bounds
        const idx = cy * BOARD_SIZE + cx;
        if (types[idx] !== TYPE_WATER) return; // occupied
        cells.push(idx);
      }
      const newTypes = [...types];
      for (const idx of cells) newTypes[idx] = currentSpec.type;
      const newShip: ShipState = {
        id: currentSpec.id,
        size: currentSpec.size,
        type: currentSpec.type,
        cells,
      };
      setTypes(newTypes);
      setShips([...ships, newShip]);
      setSelectedShipIdx(0);
      setHoverCell(null);
    },
    [currentSpec, orientation, types, ships]
  );

  const reset = useCallback(() => {
    setTypes(Array.from({ length: BOARD_SIZE * BOARD_SIZE }, () => TYPE_WATER));
    setShips([]);
    setSelectedShipIdx(0);
  }, []);

  const allPlaced = remainingShips.length === 0;

  const ready = useCallback(() => {
    if (!allPlaced) return;
    const tree = buildMerkleTree(types);
    const shipCellCount = types.filter((t) => t !== TYPE_WATER).length;
    onReady({ types: [...types], tree, shipCellCount });
  }, [allPlaced, types, onReady]);

  const doRandomize = useCallback(() => {
    if (!randomize) return;
    const { types: randTypes } = randomize();
    setTypes(randTypes);
    // Reconstruct ship cells from types (just for the "all placed" check).
    const newShips: ShipState[] = FLEET_SPEC.map((spec) => {
      const cells: number[] = [];
      for (let i = 0; i < randTypes.length; i++) {
        if (randTypes[i] === spec.type && !cells.includes(i)) cells.push(i);
      }
      return { id: spec.id, size: spec.size, type: spec.type, cells };
    });
    setShips(newShips);
    setSelectedShipIdx(0);
  }, [randomize]);

  // Build a visual board where own ships are shown.
  const visualCells = types.map((t) => (t === TYPE_WATER ? "water" : "ship")) as any;

  // Measure the board area so the board scales to fit on small screens.
  // Without this, <Board> defaults to 28px cells and overflows on mobile.
  const boardAreaRef = useRef<HTMLDivElement>(null);
  const [cellSize, setCellSize] = useState<number | undefined>(undefined);
  useEffect(() => {
    const el = boardAreaRef.current;
    if (!el) return;
    const compute = () => {
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;
      // Board = ~18px row-label column + 10 cells + gaps + border.
      // 24px overhead covers labels/border rounding; 5% safety margin.
      const byW = Math.floor((r.width - 24) / 10);
      const byH = Math.floor((r.height - 36) / 11);
      const cs = Math.max(14, Math.floor(Math.min(byW, byH) * 0.95));
      setCellSize(cs);
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="flex h-full flex-col gap-4 md:flex-row md:gap-6">
      {/* Board area — gets the larger share of horizontal space on desktop. */}
      <div ref={boardAreaRef} className="flex min-h-[260px] flex-[2] justify-center gap-3 md:min-h-0">
        <Board
          state={{ cells: visualCells }}
          theme="inferno"
          label="Your bathtub fleet"
          clickable={!!currentSpec}
          onCellClick={(x, y) => place(x, y)}
          previewCells={canPlace ? hoverCells : undefined}
          shipTypes={types}
          fleet="blue"
          cellSize={cellSize}
        />
      </div>

      {/* Fleet control panel — wider, doodle-styled, with ship cards. */}
      <div className="doodle-border doodle-shadow flex flex-col gap-3 rounded-2xl bg-[#F9F7F2] p-4 md:w-72">
        <div className="flex items-center justify-between">
          <h3 className="font-marker text-lg uppercase tracking-wide text-[#1a1a1a]">
            Place your fleet
          </h3>
          <button
            onClick={() => setOrientation((o) => (o === "h" ? "v" : "h"))}
            className="doodle-border rounded-lg bg-white px-3 py-1 font-marker text-xs uppercase text-[#1a1a1a] hover:scale-105"
          >
            {orientation === "h" ? "↔ Horiz" : "↕ Vert"}
          </button>
        </div>

        {/* Ship cards: emoji + name + size/HP + status badge. */}
        <div className="flex flex-col gap-2">
          {FLEET_SHIPS.map((s) => {
            const spec = FLEET_SPEC.find((f) => f.id === s.id)!;
            const placed = ships.find((p) => p.id === s.id);
            const isActive = currentSpec?.id === s.id && !placed;
            return (
              <div
                key={s.id}
                className={cn(
                  "flex items-center gap-2 rounded-lg border-2 px-3 py-2 transition-colors",
                  placed
                    ? "border-emerald-400 bg-emerald-50"
                    : isActive
                    ? "border-rose-400 bg-rose-50"
                    : "border-[#1a1a1a]/10 bg-white"
                )}
              >
                <span className="text-2xl leading-none">{s.emoji}</span>
                <div className="flex flex-1 flex-col">
                  <span className="font-marker text-sm uppercase text-[#1a1a1a]">{spec.label}</span>
                  <span className="font-mono text-[10px] text-[#1a1a1a]/50">
                    {spec.size} cells · {s.hp} HP
                  </span>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 font-marker text-[10px] uppercase",
                    placed
                      ? "bg-emerald-500 text-white"
                      : "bg-[#1a1a1a]/10 text-[#1a1a1a]/60"
                  )}
                >
                  {placed ? "✓ ready" : "pending"}
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-1 flex flex-wrap gap-2">
          <button
            onClick={doRandomize}
            disabled={!randomize}
            className="doodle-border doodle-shadow rounded-xl bg-[#257ABB] px-4 py-2 font-marker text-sm uppercase tracking-wide text-white transition-transform hover:scale-105 disabled:opacity-30"
          >
            ⚂ Random
          </button>
          <button
            onClick={reset}
            className="doodle-border rounded-xl bg-white px-4 py-2 font-marker text-sm uppercase tracking-wide text-[#1a1a1a] transition-transform hover:scale-105"
          >
            Reset
          </button>
          <button
            disabled={!allPlaced}
            onClick={ready}
            className="doodle-border doodle-shadow ml-auto rounded-xl bg-[#d33a30] px-5 py-2 font-marker text-base uppercase tracking-wide text-white transition-transform hover:scale-105 disabled:opacity-30"
          >
            Deploy ⚓
          </button>
        </div>

        <AnimatePresence>
          {allPlaced && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-lg border-2 border-emerald-400 bg-emerald-50 px-3 py-2 text-xs text-emerald-700"
            >
              Fleet ready. Hit <strong>Deploy</strong> to lock in your layout.
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Suppress unused import warning.
void emptyBoard;
