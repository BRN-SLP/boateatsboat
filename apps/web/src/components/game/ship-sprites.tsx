// PNG ship sprites for BoatEatsBoat.
// Uses pre-rendered doodle illustrations from /public/ships/.
// Each ship PNG is normalized to exactly (cells×200)x200px with transparent background.

import Image from "next/image";

const SHIP_IMAGES = {
  carrier: {
    blue: { src: "/ships/carrier-blue.webp", cells: 5 },
    green: { src: "/ships/carrier-green.webp", cells: 5 },
  },
  battleship: {
    blue: { src: "/ships/battleship-blue.webp", cells: 4 },
    green: { src: "/ships/battleship-green.webp", cells: 4 },
  },
  cruiser: {
    blue: { src: "/ships/cruiser-blue.webp", cells: 3 },
    green: { src: "/ships/cruiser-green.webp", cells: 3 },
  },
  submarine: {
    blue: { src: "/ships/submarine-blue.webp", cells: 3 },
    green: { src: "/ships/submarine-green.webp", cells: 3 },
  },
} as const;

export type ShipType = keyof typeof SHIP_IMAGES;
export type FleetColor = "blue" | "green";

interface ShipSpriteProps {
  type: ShipType;
  fleet: FleetColor;
  cellSize: number;
  cells?: number; // override (defaults to type's natural cell count)
  state?: "intact" | "hit" | "sunk";
}

export function ShipSprite({
  type,
  fleet,
  cellSize,
  cells,
  state = "intact",
}: ShipSpriteProps) {
  const config = SHIP_IMAGES[type][fleet];
  const numCells = cells ?? config.cells;
  const w = numCells * cellSize;
  const h = cellSize;
  const opacity = state === "sunk" ? 0.2 : state === "hit" ? 0.7 : 1;

  return (
    <div style={{ width: w, height: h, opacity, position: "relative", display: "flex", alignItems: "flex-end" }}>
      <Image
        src={config.src}
        alt={`${fleet} ${type} ${state}`}
        width={w}
        height={h}
        style={{ objectFit: "contain", objectPosition: "bottom" }}
      />
    </div>
  );
}

// --- Team color constants (kept for reference / legacy) ---
export const SHIP_COLORS = {
  blue: "#257ABB",
  green: "#678443",
  navy: "#1F4E79",
  teal: "#3FA8A0",
  yellowGreen: "#8FA850",
} as const;

export const SHIP_META = {
  carrier: { cells: 5, label: "Carrier", color: SHIP_COLORS.blue },
  battleship: { cells: 4, label: "Battleship", color: SHIP_COLORS.navy, hp: 2 },
  cruiser: { cells: 3, label: "Cruiser", color: SHIP_COLORS.teal },
  submarine: { cells: 3, label: "Submarine", color: SHIP_COLORS.yellowGreen, stealth: true },
} as const;
