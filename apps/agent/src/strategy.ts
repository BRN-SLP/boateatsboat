import { BOARD_SIZE } from "./board.js";

/**
 * Hunt/Target strategy -- the classic Battleship AI.
 *
 * Hunt mode: pick cells using a "parity" search (only cells where a ship of the
 * smallest remaining size could fit). This halves the search space and finds ships
 * faster than uniform random.
 *
 * Target mode: once we have a hit, walk along the two axes from the hit to sink
 * the rest of that ship before returning to hunt mode.
 *
 * Stealth submarines (TYPE_SUB_STEALTH) get no proximity hint in the contract, so
 * the agent relies purely on parity + brute-force for those -- same as a normal ship.
 */

export interface ShotOutcome {
  x: number;
  y: number;
  hit: boolean;
  cellType: number;
}

export class HuntTargetAI {
  private tried: Set<number> = new Set();
  private hits: Set<number> = new Set();
  // Target queue: candidate cells to try next (neighbors of recent hits).
  private targetQueue: number[] = [];

  /** Returns the next cell index to fire at, or null if the board is exhausted. */
  nextShot(): number | null {
    // 1. Drain the target queue first (we have a live hit to chase).
    while (this.targetQueue.length > 0) {
      const candidate = this.targetQueue.shift()!;
      if (!this.tried.has(candidate)) return candidate;
    }
    // 2. Hunt mode: parity search.
    // Smallest remaining ship is at least 2 cells, so only every other cell
    // can be the start of a hit. We use parity = (x + y) % 2.
    const candidates: number[] = [];
    for (let i = 0; i < BOARD_SIZE * BOARD_SIZE; i++) {
      if (this.tried.has(i)) continue;
      const x = i % BOARD_SIZE;
      const y = Math.floor(i / BOARD_SIZE);
      if ((x + y) % 2 === 0) candidates.push(i);
    }
    if (candidates.length > 0) {
      return candidates[Math.floor(Math.random() * candidates.length)];
    }
    // 3. Fall back to any untried cell (odd parity, edge cases).
    for (let i = 0; i < BOARD_SIZE * BOARD_SIZE; i++) {
      if (!this.tried.has(i)) return i;
    }
    return null;
  }

  /** Record the outcome of a shot and update target mode accordingly. */
  recordOutcome(cellIndex: number, outcome: ShotOutcome) {
    this.tried.add(cellIndex);
    if (outcome.hit) {
      this.hits.add(cellIndex);
      // Queue orthogonal neighbors as target candidates.
      const x = cellIndex % BOARD_SIZE;
      const y = Math.floor(cellIndex / BOARD_SIZE);
      const neighbors = [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ];
      for (const [nx, ny] of neighbors) {
        if (nx < 0 || nx >= BOARD_SIZE || ny < 0 || ny >= BOARD_SIZE) continue;
        const idx = ny * BOARD_SIZE + nx;
        if (!this.tried.has(idx) && !this.targetQueue.includes(idx)) {
          this.targetQueue.push(idx);
        }
      }
      // If we have two adjacent hits, prefer extending along that line.
      this.preferLineDirection();
    }
  }

  /** If two adjacent hits exist, deprioritize perpendicular neighbors. */
  private preferLineDirection() {
    const hitsArr = Array.from(this.hits);
    for (let i = 0; i < hitsArr.length; i++) {
      for (let j = i + 1; j < hitsArr.length; j++) {
        const a = hitsArr[i];
        const b = hitsArr[j];
        const ax = a % BOARD_SIZE;
        const ay = Math.floor(a / BOARD_SIZE);
        const bx = b % BOARD_SIZE;
        const by = Math.floor(b / BOARD_SIZE);
        if (ax === bx && Math.abs(ay - by) === 1) {
          // Vertical line -- prioritize the cells above/below the pair ends.
          this.promoteLineExtension(a, b, "vertical");
        } else if (ay === by && Math.abs(ax - bx) === 1) {
          // Horizontal line -- prioritize the cells left/right of the pair ends.
          this.promoteLineExtension(a, b, "horizontal");
        }
      }
    }
  }

  private promoteLineExtension(a: number, b: number, dir: "vertical" | "horizontal") {
    // Move continuation candidates to the front of the queue.
    const [lo, hi] = a < b ? [a, b] : [b, a];
    const continuations =
      dir === "vertical"
        ? [lo - BOARD_SIZE, hi + BOARD_SIZE]
        : [lo - 1, hi + 1];
    for (const c of continuations.reverse()) {
      const x = c % BOARD_SIZE;
      const y = Math.floor(c / BOARD_SIZE);
      if (x < 0 || x >= BOARD_SIZE || y < 0 || y >= BOARD_SIZE) continue;
      if (c < 0 || c >= BOARD_SIZE * BOARD_SIZE) continue;
      if (this.tried.has(c)) continue;
      // Remove and re-insert at the front.
      this.targetQueue = this.targetQueue.filter((q) => q !== c);
      this.targetQueue.unshift(c);
    }
  }
}
