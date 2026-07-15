import { BOARD_SIZE, FLEET_SPEC, TYPE_WATER } from "./game-config";

/**
 * Random fleet placement. Returns the cell-type array (length 100).
 * Mirrors agent/src/board.ts randomBoard().
 */
export function randomBoard(): { types: number[] } {
  for (let attempt = 0; attempt < 500; attempt++) {
    const types = new Array(BOARD_SIZE * BOARD_SIZE).fill(TYPE_WATER);
    let ok = true;

    for (const spec of FLEET_SPEC) {
      const placed = tryPlaceShip(types, spec.size);
      if (!placed) {
        ok = false;
        break;
      }
      for (const idx of placed) types[idx] = spec.type;
    }

    if (ok) return { types };
  }
  throw new Error("Failed to place fleet after 500 attempts");
}

function tryPlaceShip(types: number[], size: number): number[] | null {
  for (let attempt = 0; attempt < 200; attempt++) {
    const horizontal = Math.random() < 0.5;
    const maxX = horizontal ? BOARD_SIZE - size : BOARD_SIZE - 1;
    const maxY = horizontal ? BOARD_SIZE - 1 : BOARD_SIZE - size;
    const x = Math.floor(Math.random() * (maxX + 1));
    const y = Math.floor(Math.random() * (maxY + 1));
    const cells: number[] = [];
    let clear = true;

    for (let i = 0; i < size; i++) {
      const cx = horizontal ? x + i : x;
      const cy = horizontal ? y : y + i;
      const idx = cy * BOARD_SIZE + cx;
      if (types[idx] !== TYPE_WATER) {
        clear = false;
        break;
      }
      cells.push(idx);
    }

    if (clear) return cells;
  }
  return null;
}
