"use client";

import { BOARD_SIZE } from "@/lib/game-config";
import { ShipSprite, type FleetColor, type ShipType } from "./ship-sprites";

export type { FleetColor };

// Ship type encoding mirrors BattleshipGame.sol:
//   0  = water
//   1  = TYPE_SHIP_HP1 (Carrier 5, Cruiser 3)
//   21 = TYPE_SHIP_HP2 (Battleship 4)
//   41 = TYPE_SUB_STEALTH (Submarine 3)
// Since Carrier and Cruiser share type 1, we distinguish by run length.

const TYPE_CLASSES = {
  1: "hp1",    // HP1 ships: carrier (5) or cruiser (3)
  21: "hp2",   // HP2 ship: battleship (4)
  41: "sub",   // Stealth sub: submarine (3)
} as const;

function classifyShip(type: number, cells: number): ShipType {
  if (type === 41) return "submarine";
  if (type === 21) return "battleship";
  // HP1: 5 cells = carrier, 3 cells = cruiser
  return cells >= 5 ? "carrier" : "cruiser";
}

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

    const right = x < BOARD_SIZE - 1 ? types[i + 1] : 0;
    const down = y < BOARD_SIZE - 1 ? types[i + BOARD_SIZE] : 0;

    if (right === type) {
      let cx = x;
      while (cx < BOARD_SIZE && types[y * BOARD_SIZE + cx] === type) {
        visited.add(y * BOARD_SIZE + cx);
        cx++;
      }
      runs.push({ type, cells: cx - x, startX: x, startY: y, vertical: false });
    } else if (down === type) {
      let cy = y;
      while (cy < BOARD_SIZE && types[cy * BOARD_SIZE + x] === type) {
        visited.add(cy * BOARD_SIZE + x);
        cy++;
      }
      runs.push({ type, cells: cy - y, startX: x, startY: y, vertical: true });
    } else {
      visited.add(i);
      runs.push({ type, cells: 1, startX: x, startY: y, vertical: false });
    }
  }

  return runs;
}

/**
 * Renders ship silhouettes as an absolutely-positioned overlay on the board grid.
 */
export function ShipOverlay({
  ships,
  cellSize,
  gap = 2,
  fleet = "blue",
  sunk = false,
}: {
  ships: ShipRun[];
  cellSize: number;
  gap?: number;
  fleet?: FleetColor;
  sunk?: boolean;
}) {
  const step = cellSize + gap;
  const state = sunk ? "sunk" : "intact";

  return (
    <div className="pointer-events-none absolute inset-0">
      {ships.map((ship, i) => {
        const left = ship.startX * step;
        const top = ship.startY * step;
        const label = classifyShip(ship.type, ship.cells);

        return (
          <div key={i} className="absolute" style={{ left, top }}>
            {ship.vertical ? (
              <div
                style={{
                  transform: `translate(${cellSize}px, 0) rotate(90deg)`,
                  transformOrigin: "0 0",
                }}
              >
                <ShipSprite
                  type={label}
                  fleet={fleet}
                  cellSize={cellSize}
                  cells={ship.cells}
                  state={state}
                />
              </div>
            ) : (
              <ShipSprite
                type={label}
                fleet={fleet}
                cellSize={cellSize}
                cells={ship.cells}
                state={state}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
