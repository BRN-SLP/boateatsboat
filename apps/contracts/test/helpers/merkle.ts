import { keccak256, concat, toBytes, bytesToHex } from "viem";

// Must match the contract leaf hashing exactly:
//   leaf = keccak256(bytes.concat(keccak256(abi.encodePacked(cellType, x, y))))
// cellType: uint8, x: uint8, y: uint8 (per abi.encodePacked).
export interface BoardCell {
  type: number;
  salt: number;
}

function cellLeaf(cell: BoardCell, index: number): Uint8Array {
  const x = index % 10;
  const y = Math.floor(index / 10);
  // abi.encodePacked(cellType uint8, x uint8, y uint8) -> 3 bytes
  const inner = new Uint8Array([cell.type & 0xff, x & 0xff, y & 0xff]);
  const innerHash = keccak256(inner);
  // bytes.concat(keccak256(...)) then keccak256 again for OZ double-hash.
  return toBytes(keccak256(toBytes(innerHash)));
}

// Lexicographic compare for byte arrays (Uint8Array).
function cmpBytes(a: Uint8Array, b: Uint8Array): number {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  }
  return a.length - b.length;
}

// Build a binary Merkle tree with OZ-standard hashing (double-hash leaves and pairs).
export interface MerkleTree {
  root: `0x${string}`;
  layers: Uint8Array[][];
}

export function buildMerkleTree(board: BoardCell[]): MerkleTree {
  const leaves = board.map((c, i) => cellLeaf(c, i));
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
  const root = bytesToHex(current[0]) as `0x${string}`;
  return { root, layers };
}

export function getProof(tree: MerkleTree, index: number): `0x${string}`[] {
  const proof: `0x${string}`[] = [];
  let idx = index;
  for (let layer = 0; layer < tree.layers.length - 1; layer++) {
    const current = tree.layers[layer];
    const siblingIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
    const sibling = siblingIdx < current.length ? current[siblingIdx] : current[idx];
    proof.push(bytesToHex(sibling) as `0x${string}`);
    idx = Math.floor(idx / 2);
  }
  return proof;
}
