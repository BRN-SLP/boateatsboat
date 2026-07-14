"use client";

import { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BOARD_SIZE, FLEET_SPEC, TYPE_WATER } from "@/lib/game-config";
import { buildMerkleTree, type MerkleTree } from "@/lib/merkle";
import { Board, emptyBoard } from "./board";
import { Button } from "@/components/ui/button";
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
      if (!currentSpec || !canPlace) return;
      const cells = Array.from(hoverCells);
      const newTypes = [...types];
      for (const idx of cells) newTypes[idx] = currentSpec.type;
      const newShip: ShipState = {
        id: currentSpec.id,
        size: currentSpec.size,
        type: currentSpec.type,
        cells,
      };
      const newShips = [...ships, newShip];
      setTypes(newTypes);
      setShips(newShips);
      setSelectedShipIdx(0);
      setHoverCell(null);
    },
    [currentSpec, canPlace, hoverCells, types, ships]
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

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:gap-8">
      <div className="flex flex-col gap-3">
        <Board
          state={{ cells: visualCells }}
          theme="inferno"
          label="Your bathtub fleet"
          clickable={!!currentSpec}
          onCellClick={(x, y) => place(x, y)}
          previewCells={canPlace ? hoverCells : undefined}
          shipTypes={types}
          fleet="blue"
        />
        <div
          className="grid grid-cols-[16px_repeat(10,1fr)] gap-[2px] opacity-0 pointer-events-none h-0"
          aria-hidden
        />
      </div>

      <div className="flex flex-col gap-3 max-w-xs">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-slate-700">Place your fleet</h3>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setOrientation((o) => (o === "h" ? "v" : "h"))}
            >
              {orientation === "h" ? "Horizontal" : "Vertical"}
            </Button>
          </div>
        </div>

        <ul className="flex flex-col gap-1.5 text-xs">
          {FLEET_SPEC.map((spec) => {
            const placed = ships.find((p) => p.id === spec.id);
            return (
              <li
                key={spec.id}
                className={cn(
                  "flex items-center justify-between rounded-md border px-2 py-1",
                  placed
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                    : currentSpec?.id === spec.id
                    ? "border-rose-300 bg-rose-50 text-rose-700"
                    : "border-slate-200 text-slate-600"
                )}
              >
                <span>{spec.label} ({spec.size})</span>
                <span>{placed ? "ready" : "pending"}</span>
              </li>
            );
          })}
        </ul>

        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={reset}>
            Reset
          </Button>
          {randomize && (
            <Button size="sm" variant="ghost" onClick={doRandomize}>
              Random
            </Button>
          )}
          <Button
            size="sm"
            disabled={!allPlaced}
            onClick={ready}
            className="ml-auto"
          >
            Ready
          </Button>
        </div>

        <AnimatePresence>
          {allPlaced && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-700"
            >
              Fleet ready. Hit Ready to lock in your layout.
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Suppress unused import warning.
void emptyBoard;
