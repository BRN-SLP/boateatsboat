"use client";

import { BOARD_SIZE } from "@/lib/game-config";
import { ShipSprite, SHIP_COLORS } from "./ship-sprites";

// Ship type encoding matches placement.types[]: 0=water, 1-4 = ships.
const TYPE_LABELS = {
  1: "carrier",
  2: "battleship",
  3: "cruiser",
  4: "submarine",
} as const;

const TYPE_COLORS = {
  1: SHIP_COLORS.blue,
  2: SHIP_COLORS.navy,
  3: SHIP_COLORS.teal,
  4: SHIP_COLORS.yellowGreen,
} as const;

export interface ShipRun {
  type: number; // 1-4
  cells: number; // length in cells
  startX: number;
  startY: number;
  vertical: boolean;
}

/**
 * Groups the flat types[] array into ship runs.
 * Each ship is a contiguous horizontal or vertical line of same-type cells.
 */
export function extractShipRuns(types: number[]): ShipRun[] {
  const runs: ShipRun[] = [];
  const visited = new Set<number>();

  for (let i = 0; i < types.length; i++) {
    if (types[i] === 0 || visited.has(i)) continue;

    const type = types[i];
    const x = i % BOARD_SIZE;
    const y = Math.floor(i / BOARD_SIZE);

    // Check which direction the ship extends.
    const right = x < BOARD_SIZE - 1 ? types[i + 1] : 0;
    const down = y < BOARD_SIZE - 1 ? types[i + BOARD_SIZE] : 0;

    if (right === type) {
      // Horizontal run.
      let cx = x;
      while (cx < BOARD_SIZE && types[y * BOARD_SIZE + cx] === type) {
        visited.add(y * BOARD_SIZE + cx);
        cx++;
      }
      runs.push({ type, cells: cx - x, startX: x, startY: y, vertical: false });
    } else if (down === type) {
      // Vertical run.
      let cy = y;
      while (cy < BOARD_SIZE && types[cy * BOARD_SIZE + x] === type) {
        visited.add(cy * BOARD_SIZE + x);
        cy++;
      }
      runs.push({ type, cells: cy - y, startX: x, startY: y, vertical: true });
    } else {
      // Single-cell (shouldn't happen, but handle gracefully).
      visited.add(i);
      runs.push({ type, cells: 1, startX: x, startY: y, vertical: false });
    }
  }

  return runs;
}

/**
 * Renders ship silhouettes as an absolutely-positioned overlay on the board grid.
 * Must be placed inside a `relative` container that exactly wraps the 10×10 cell grid.
 */
export function ShipOverlay({
  ships,
  cellSize,
  gap = 2,
}: {
  ships: ShipRun[];
  cellSize: number;
  gap?: number;
}) {
  const step = cellSize + gap;

  return (
    <div className="pointer-events-none absolute inset-0">
      {ships.map((ship, i) => {
        const left = ship.startX * step;
        const top = ship.startY * step;
        const label = TYPE_LABELS[ship.type as keyof typeof TYPE_LABELS] ?? "carrier";
        const color = TYPE_COLORS[ship.type as keyof typeof TYPE_COLORS] ?? SHIP_COLORS.blue;

        return (
          <div
            key={i}
            className="absolute"
            style={{ left, top }}
          >
            {ship.vertical ? (
              <div
                style={{
                  transform: `translate(${cellSize}px, 0) rotate(90deg)`,
                  transformOrigin: "0 0",
                }}
              >
                <ShipSprite
                  cells={ship.cells}
                  type={label}
                  color={color}
                  cellSize={cellSize}
                />
              </div>
            ) : (
              <ShipSprite
                cells={ship.cells}
                type={label}
                color={color}
                cellSize={cellSize}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
