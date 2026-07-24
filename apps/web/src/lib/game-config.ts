import { celoSepolia, celo } from "wagmi/chains";
import type { Address } from "viem";

/**
 * BoatEatsBoat contract config. Proxy addresses per chain.
 * Set NEXT_PUBLIC_GAME_PROXY_SEPOLIA / MAINNET in the web .env to override.
 */

export const GAME_PROXY: Record<number, Address> = {
  [celoSepolia.id]: (process.env.NEXT_PUBLIC_GAME_PROXY_SEPOLIA as Address) ??
    "0x1c8780b202af9917ba8CaeD65202ffD2013d2205",
  [celo.id]: (process.env.NEXT_PUBLIC_GAME_PROXY_MAINNET as Address) ??
    "0xa05E6B19Dd828E955331C097e8Af4DBd0c42d3f9",
};

// USDm on Sepolia, cUSD on mainnet (per celopedia / celo-stablecoins skills).
export const PAYMENT_TOKEN: Record<number, Address> = {
  [celoSepolia.id]: "0xEF4d55D6dE8e8d73232827Cd1e9b2F2dBb45bC80",
  [celo.id]: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
};

export function gameProxyFor(chainId: number): Address {
  const a = GAME_PROXY[chainId];
  if (!a || a === "0x0000000000000000000000000000000000000000") {
    throw new Error(`BattleshipGame not deployed on chain ${chainId}`);
  }
  return a;
}

export function paymentTokenFor(chainId: number): Address {
  return PAYMENT_TOKEN[chainId];
}

// Cell-type encoding mirrors BattleshipGame.sol.
export const TYPE_WATER = 0;
export const TYPE_SHIP_HP1 = 1;
export const TYPE_SHIP_HP2 = 21;
export const TYPE_SUB_STEALTH = 41;

export const BOARD_SIZE = 10;
export const FLEET_SPEC = [
  { id: "carrier", size: 5, type: TYPE_SHIP_HP1, label: "Carrier" },
  { id: "battleship", size: 4, type: TYPE_SHIP_HP2, label: "Battleship" },
  { id: "cruiser", size: 3, type: TYPE_SHIP_HP1, label: "Cruiser" },
  { id: "submarine", size: 3, type: TYPE_SUB_STEALTH, label: "Submarine" },
] as const;

export function cellHp(cellType: number): number {
  if (cellType === TYPE_WATER) return 0;
  if (cellType >= TYPE_SUB_STEALTH) return 1;
  if (cellType >= TYPE_SHIP_HP2) return 2;
  return 1;
}

export function isStealth(cellType: number): boolean {
  return cellType >= TYPE_SUB_STEALTH;
}
