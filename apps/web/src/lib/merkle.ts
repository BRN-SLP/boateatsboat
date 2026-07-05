import { keccak256, encodePacked, toBytes, bytesToHex, type Hex } from "viem";
import { BOARD_SIZE } from "./game-config";

// Must mirror the contract leaf hashing:
//   leaf = keccak256(bytes.concat(keccak256(abi.encodePacked(cellType, x, y))))
function cellLeaf(cellType: number, index: number): Uint8Array {
  const x = index % BOARD_SIZE;
  const y = Math.floor(index / BOARD_SIZE);
  const inner = new Uint8Array([cellType & 0xff, x & 0xff, y & 0xff]);
  const innerHash = keccak256(inner);
  return toBytes(keccak256(toBytes(innerHash)));
}

function cmpBytes(a: Uint8Array, b: Uint8Array): number {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  }
  return a.length - b.length;
}

export interface MerkleTree {
  root: Hex;
  layers: Uint8Array[][];
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
      const pair = cmpBytes(left, right) <= 0 ? concatBytes(left, right) : concatBytes(right, left);
      next.push(toBytes(keccak256(pair)));
    }
    layers.push(next);
    current = next;
  }
  return { root: bytesToHex(current[0]) as Hex, layers };
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

function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

// Suppress unused-import warning for encodePacked (kept for parity reference).
void encodePacked;
