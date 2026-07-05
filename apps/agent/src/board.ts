import { keccak256, concat, toBytes, bytesToHex, type Hex } from "viem";

// Must match the contract's leaf hashing EXACTLY:
//   leaf = keccak256(bytes.concat(keccak256(abi.encodePacked(cellType, x, y))))
export const BOARD_SIZE = 10;
const TOTAL_CELLS = 100;

// Cell type encoding mirrors BattleshipGame.sol constants.
export const TYPE_WATER = 0;
export const TYPE_SHIP_HP1 = 1; // Carrier / Cruiser / standard cells
export const TYPE_SHIP_HP2 = 21; // Battleship armored cell
export const TYPE_SUB_STEALTH = 41; // Submarine stealth cell

export interface ShipPlacement {
  size: number;
  type: number; // TYPE_SHIP_HP1 | TYPE_SHIP_HP2 | TYPE_SUB_STEALTH
  cells: number[]; // cell indices occupied
}

// v1 fleet: Carrier(5) + Battleship(4,armor) + Cruiser(3) + Submarine(3,stealth) = 15 cells.
const FLEET: { size: number; type: number }[] = [
  { size: 5, type: TYPE_SHIP_HP1 }, // Carrier
  { size: 4, type: TYPE_SHIP_HP2 }, // Battleship (armored)
  { size: 3, type: TYPE_SHIP_HP1 }, // Cruiser
  { size: 3, type: TYPE_SUB_STEALTH }, // Submarine (stealth)
];

export const FLEET_CELL_COUNT = FLEET.reduce((a, s) => a + s.size, 0);

/**
 * Random fleet placement. Returns the cell-type array (length 100) and the list
 * of ships for the agent's own tracking.
 */
export function randomBoard(seed?: number): { types: number[]; ships: ShipPlacement[] } {
  const rng = mulberry32(seed ?? Math.floor(Math.random() * 2 ** 32));
  for (let attempt = 0; attempt < 500; attempt++) {
    const types = new Array(TOTAL_CELLS).fill(TYPE_WATER);
    const ships: ShipPlacement[] = [];
    let ok = true;
    for (const spec of FLEET) {
      const placed = tryPlaceShip(types, spec.size, rng);
      if (!placed) {
        ok = false;
        break;
      }
      ships.push({ size: spec.size, type: spec.type, cells: placed });
      for (const idx of placed) types[idx] = spec.type;
    }
    if (ok) return { types, ships };
  }
  throw new Error("Failed to place fleet after 500 attempts");
}

function tryPlaceShip(types: number[], size: number, rng: () => number): number[] | null {
  for (let attempt = 0; attempt < 200; attempt++) {
    const horizontal = rng() < 0.5;
    const maxX = horizontal ? BOARD_SIZE - size : BOARD_SIZE - 1;
    const maxY = horizontal ? BOARD_SIZE - 1 : BOARD_SIZE - size;
    const x = Math.floor(rng() * (maxX + 1));
    const y = Math.floor(rng() * (maxY + 1));
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

function mulberry32(a: number): () => number {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------
// Merkle tree (OZ double-hash standard) -- mirrors test/helpers/merkle.ts
// ---------------------------------------------------------------------

export interface MerkleTree {
  root: Hex;
  layers: Uint8Array[][];
}

function cellLeaf(cellType: number, index: number): Uint8Array {
  const x = index % BOARD_SIZE;
  const y = Math.floor(index / BOARD_SIZE);
  // abi.encodePacked(cellType uint8, x uint8, y uint8) -> 3 bytes
  const inner = new Uint8Array([cellType & 0xff, x & 0xff, y & 0xff]);
  const innerHash = keccak256(inner);
  // bytes.concat(keccak256(...)) then keccak256 again for OZ double-hash.
  return toBytes(keccak256(toBytes(innerHash)));
}

function cmpBytes(a: Uint8Array, b: Uint8Array): number {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  }
  return a.length - b.length;
}

export function buildMerkleTree(types: number[]): MerkleTree {
  const leaves = types.map((t, i) => cellLeaf(t, i));
  const layers: Uint8Array[][] = [leaves];
  let current = leaves;
  while (current.length > 1) {
    const next: Uint8Array[] = [];
    for (let i = 0; i < current.length; i += 2) {
      const left = current[i];
      const right = i + 1 < current.length ? current[i + 1] : current[i];
      const pair = cmpBytes(left, right) <= 0 ? concat([left, right]) : concat([right, left]);
      next.push(toBytes(keccak256(pair)));
    }
    layers.push(next);
    current = next;
  }
  const root = bytesToHex(current[0]) as Hex;
  return { root, layers };
}

export function getProof(tree: MerkleTree, index: number): Hex[] {
  const proof: Hex[] = [];
  let idx = index;
  for (let layer = 0; layer < tree.layers.length - 1; layer++) {
    const current = tree.layers[layer];
    const siblingIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
    const sibling = siblingIdx < current.length ? current[siblingIdx] : current[idx];
    proof.push(bytesToHex(sibling) as Hex);
    idx = Math.floor(idx / 2);
  }
  return proof;
}
