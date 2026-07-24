"use client";

import { ShipSprite } from "@/components/game/ship-sprites";

// Dev sandbox: visualize how each ship sprite renders over a grid in both
// orientations, using the real ShipSprite component (with the new `vertical`
// prop). Used to confirm the Carrier no longer overflows its 5 cells.
// Visit /dev/ships — not linked anywhere in the app.

const CELL = 40; // fixed cell size for the demo
const GAP = 2;
const SHIPS = [
  { type: "carrier" as const, cells: 5, label: "Carrier (5)" },
  { type: "battleship" as const, cells: 4, label: "Battleship (4)" },
  { type: "cruiser" as const, cells: 3, label: "Cruiser (3)" },
  { type: "submarine" as const, cells: 3, label: "Submarine (3)" },
];

function GridBg({ w, h }: { w: number; h: number }) {
  return (
    <div
      className="absolute inset-0"
      style={{
        backgroundImage:
          "linear-gradient(to right, rgba(0,0,0,0.18) 1px, transparent 1px)," +
          "linear-gradient(to bottom, rgba(0,0,0,0.18) 1px, transparent 1px)",
        backgroundSize: `${CELL + GAP}px ${CELL + GAP}px`,
        width: w,
        height: h,
      }}
    />
  );
}

export default function ShipsDevPage() {
  return (
    <main className="min-h-screen bg-slate-100 p-8">
      <h1 className="mb-2 text-2xl font-bold">Ship sprite sandbox (vertical prop)</h1>
      <p className="mb-4 max-w-2xl text-sm text-slate-600">
        Each ship is shown in both orientations over a faint grid (1 cell = {CELL}px). The rose
        rectangle marks the exact <code>cells × cellSize</code> footprint the sprite SHOULD occupy.
        If art extends beyond the rose box, the bug is still present.
      </p>

      <div className="flex flex-col gap-8">
        {SHIPS.map((s) => {
          const horizBoxW = s.cells * CELL + (s.cells - 1) * GAP;
          const vertBoxH = s.cells * CELL + (s.cells - 1) * GAP;
          return (
            <div key={s.type} className="rounded-lg bg-white p-4 shadow">
              <h2 className="mb-3 text-lg font-semibold">{s.label}</h2>

              {/* Horizontal */}
              <div className="mb-4">
                <div className="mb-1 text-xs uppercase text-slate-500">Horizontal</div>
                <div className="relative bg-blue-50" style={{ width: horizBoxW, height: CELL }}>
                  <GridBg w={horizBoxW} h={CELL} />
                  <div
                    className="absolute border-2 border-rose-500"
                    style={{ width: horizBoxW, height: CELL }}
                  />
                  <div className="absolute left-0 top-0">
                    <ShipSprite type={s.type} fleet="blue" cellSize={CELL} cells={s.cells} />
                  </div>
                </div>
              </div>

              {/* Vertical */}
              <div>
                <div className="mb-1 text-xs uppercase text-slate-500">Vertical</div>
                <div className="relative bg-blue-50" style={{ width: CELL, height: vertBoxH }}>
                  <GridBg w={CELL} h={vertBoxH} />
                  <div
                    className="absolute border-2 border-rose-500"
                    style={{ width: CELL, height: vertBoxH }}
                  />
                  <div className="absolute left-0 top-0">
                    <ShipSprite type={s.type} fleet="blue" cellSize={CELL} cells={s.cells} vertical />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-8 text-xs text-slate-500">
        Rose rectangle = intended footprint. If the ship art pokes outside it, that&apos;s the bug.
      </p>
    </main>
  );
}
