"use client";

import { useState } from "react";
import { ShipSprite } from "@/components/game/ship-sprites";

// Dev sandbox: visualize how each ship sprite renders over a grid in both
// orientations. Used to diagnose the Carrier overflowing its 5 cells.
// Visit /dev/ships — not linked anywhere in the app.

const CELL = 40; // fixed cell size for the demo
const GAP = 2;
const SHIPS = [
  { type: "carrier" as const, cells: 5, label: "Carrier (5)" },
  { type: "battleship" as const, cells: 4, label: "Battleship (4)" },
  { type: "cruiser" as const, cells: 3, label: "Cruiser (3)" },
  { type: "submarine" as const, cells: 3, label: "Submarine (3)" },
];

function MiniGrid({ rows, cols }: { rows: number; cols: number }) {
  // A faint grid background so we can count cells under the sprite.
  return (
    <div
      className="absolute inset-0"
      style={{
        backgroundImage:
          "linear-gradient(to right, rgba(0,0,0,0.15) 1px, transparent 1px)," +
          "linear-gradient(to bottom, rgba(0,0,0,0.15) 1px, transparent 1px)",
        backgroundSize: `${CELL + GAP}px ${CELL + GAP}px`,
      }}
    />
  );
}

export default function ShipsDevPage() {
  const [fit, setFit] = useState<"contain" | "cover">("contain");

  return (
    <main className="min-h-screen bg-slate-100 p-8">
      <h1 className="mb-2 text-2xl font-bold">Ship sprite sandbox</h1>
      <p className="mb-4 text-sm text-slate-600">
        Each sprite is placed over a faint grid where 1 cell = {CELL}px. The colored box marks the
        exact {`cells × cellSize`} footprint the sprite SHOULD occupy. If art extends beyond the
        box, proportions are off.
      </p>

      <div className="mb-6 flex gap-2">
        <span className="text-sm font-medium">objectFit:</span>
        {(["contain", "cover"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFit(f)}
            className={`rounded px-3 py-1 text-sm ${
              fit === f ? "bg-slate-800 text-white" : "bg-white text-slate-700"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-8">
        {SHIPS.map((s) => (
          <div key={s.type} className="rounded-lg bg-white p-4 shadow">
            <h2 className="mb-3 text-lg font-semibold">{s.label}</h2>

            {/* Horizontal */}
            <div className="mb-4">
              <div className="mb-1 text-xs uppercase text-slate-500">Horizontal</div>
              <div
                className="relative bg-blue-50"
                style={{ width: s.cells * CELL + (s.cells - 1) * GAP, height: CELL }}
              >
                <MiniGrid rows={1} cols={s.cells} />
                <div
                  className="absolute border-2 border-rose-500"
                  style={{ width: s.cells * CELL + (s.cells - 1) * GAP, height: CELL }}
                />
                <ShipSpriteFit type={s.type} cells={s.cells} fit={fit} />
              </div>
            </div>

            {/* Vertical */}
            <div>
              <div className="mb-1 text-xs uppercase text-slate-500">Vertical</div>
              <div
                className="relative bg-blue-50"
                style={{ width: CELL, height: s.cells * CELL + (s.cells - 1) * GAP }}
              >
                <MiniGrid rows={s.cells} cols={1} />
                <div
                  className="absolute border-2 border-rose-500"
                  style={{ width: CELL, height: s.cells * CELL + (s.cells - 1) * GAP }}
                />
                <ShipSpriteFit type={s.type} cells={s.cells} fit={fit} vertical />
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-8 text-xs text-slate-500">
        Note: the rose rectangle = intended footprint. If the ship art pokes outside it, that is
        the bug we are fixing.
      </p>
    </main>
  );
}

// Local copy of ShipSprite that lets us toggle objectFit, to compare fixes
// without touching the production component yet.
function ShipSpriteFit({
  type,
  cells,
  fit,
  vertical = false,
}: {
  type: "carrier" | "battleship" | "cruiser" | "submarine";
  cells: number;
  fit: "contain" | "cover";
  vertical?: boolean;
}) {
  const w = vertical ? CELL : cells * CELL + (cells - 1) * GAP;
  const h = vertical ? cells * CELL + (cells - 1) * GAP : CELL;
  // Horizontal art rotated 90deg for vertical, mirroring ship-overlay logic.
  const transform = vertical
    ? `translate(${CELL}px, 0) rotate(90deg)`
    : undefined;
  const transformOrigin = vertical ? "0 0" : undefined;
  const innerW = vertical ? cells * CELL + (cells - 1) * GAP : w;
  const innerH = vertical ? CELL : h;

  return (
    <div
      style={{
        width: w,
        height: h,
        position: "relative",
        overflow: "visible",
      }}
    >
      <div style={{ transform, transformOrigin, width: innerW, height: innerH }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/ships/${type}-blue.webp`}
          alt={type}
          width={innerW}
          height={innerH}
          style={{ objectFit: fit, objectPosition: "bottom", width: "100%", height: "100%" }}
        />
      </div>
    </div>
  );
}
