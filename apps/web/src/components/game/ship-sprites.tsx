// SVG ship silhouettes for BoatEatsBoat.
// Each ship is drawn as a connected horizontal run of N cell-sized segments.
// Style: flat doodling, bold black ink outlines, flat fills.
// Colors per DESIGN.md: Blue fleet #257ABB, Green fleet #678443.

interface ShipSpriteProps {
  /** Number of cells the ship occupies (5/4/3/3). */
  cells: number;
  /** Ship type determines silhouette details. */
  type: "carrier" | "battleship" | "cruiser" | "submarine";
  /** Team color for the hull fill. */
  color: string;
  /** Visual state. */
  state?: "intact" | "hit" | "sunk";
  /** Cell size in px (each segment is square). */
  cellSize?: number;
}

const INK = "#000000";
const INK_WIDTH = 2.5;

export function ShipSprite({
  cells,
  type,
  color,
  state = "intact",
  cellSize = 40,
}: ShipSpriteProps) {
  const w = cells * cellSize;
  const h = cellSize;
  const opacity = state === "sunk" ? 0.4 : 1;

  // Slightly darken fill for hit state
  const fill =
    state === "hit" ? shadeColor(color, -20) : state === "sunk" ? "#555555" : color;

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      style={{ opacity, display: "block" }}
      aria-label={`${type} ${state}`}
    >
      {/* Hull base - rounded rectangle spanning all cells */}
      <rect
        x={INK_WIDTH / 2 + 1}
        y={h * 0.15}
        width={w - INK_WIDTH - 2}
        height={h * 0.7}
        rx={h * 0.35}
        ry={h * 0.35}
        fill={fill}
        stroke={INK}
        strokeWidth={INK_WIDTH}
      />

      {/* Ship-specific details */}
      {type === "carrier" && <CarrierDetails cellSize={cellSize} cells={cells} />}
      {type === "battleship" && <BattleshipDetails cellSize={cellSize} cells={cells} />}
      {type === "cruiser" && <CruiserDetails cellSize={cellSize} cells={cells} />}
      {type === "submarine" && <SubmarineDetails cellSize={cellSize} cells={cells} />}

      {/* Cell divider lines (thin) */}
      {Array.from({ length: cells - 1 }, (_, i) => (
        <line
          key={i}
          x1={(i + 1) * cellSize}
          y1={h * 0.15}
          x2={(i + 1) * cellSize}
          y2={h * 0.85}
          stroke={INK}
          strokeWidth={0.8}
          strokeDasharray="2 3"
          opacity={0.4}
        />
      ))}

      {/* Hit marker - flame on damaged cell (shown on first cell for hit state) */}
      {state === "hit" && (
        <FlameIcon x={cellSize * 0.5} y={h * 0.5} size={cellSize * 0.6} />
      )}

      {/* Sunk marker - X over the ship */}
      {state === "sunk" && (
        <>
          <line
            x1={cellSize * 0.3}
            y1={h * 0.25}
            x2={w - cellSize * 0.3}
            y2={h * 0.75}
            stroke={INK}
            strokeWidth={3}
            strokeLinecap="round"
          />
          <line
            x1={w - cellSize * 0.3}
            y1={h * 0.25}
            x2={cellSize * 0.3}
            y2={h * 0.75}
            stroke={INK}
            strokeWidth={3}
            strokeLinecap="round"
          />
        </>
      )}
    </svg>
  );
}

// --- Carrier: flight deck stripe + tiny airplanes ---
function CarrierDetails({ cellSize, cells }: { cellSize: number; cells: number }) {
  const w = cells * cellSize;
  const h = cellSize;
  return (
    <g>
      {/* Flight deck stripe (lighter) */}
      <rect
        x={cellSize * 0.15}
        y={h * 0.3}
        width={w - cellSize * 0.3}
        height={h * 0.4}
        rx={h * 0.2}
        fill="rgba(255,255,255,0.25)"
        stroke={INK}
        strokeWidth={1}
      />
      {/* Tiny airplane doodles (simple triangles) */}
      {[1, 2.5, 4].map((pos, i) => {
        if (pos > cells - 0.5) return null;
        const cx = pos * cellSize;
        return (
          <g key={i}>
            <path
              d={`M ${cx} ${h * 0.35} L ${cx - 4} ${h * 0.55} L ${cx + 4} ${h * 0.55} Z`}
              fill="rgba(255,255,255,0.6)"
              stroke={INK}
              strokeWidth={1}
            />
            <line
              x1={cx}
              y1={h * 0.35}
              x2={cx}
              y2={h * 0.6}
              stroke={INK}
              strokeWidth={1}
            />
          </g>
        );
      })}
      {/* Control tower bump near the end */}
      <rect
        x={w - cellSize * 0.7}
        y={h * 0.05}
        width={cellSize * 0.2}
        height={h * 0.15}
        rx={2}
        fill="rgba(255,255,255,0.4)"
        stroke={INK}
        strokeWidth={1}
      />
    </g>
  );
}

// --- Battleship: two gun turrets + rivets ---
function BattleshipDetails({ cellSize, cells }: { cellSize: number; cells: number }) {
  const w = cells * cellSize;
  const h = cellSize;
  const turretPositions = [cells * 0.3, cells * 0.7];
  return (
    <g>
      {/* Armor plating darker band */}
      <rect
        x={cellSize * 0.1}
        y={h * 0.25}
        width={w - cellSize * 0.2}
        height={h * 0.5}
        rx={h * 0.25}
        fill="rgba(0,0,0,0.15)"
        stroke="none"
      />
      {/* Two gun turrets */}
      {turretPositions.map((pos, i) => {
        const cx = pos * cellSize;
        return (
          <g key={i}>
            <circle
              cx={cx}
              cy={h * 0.5}
              r={cellSize * 0.18}
              fill="rgba(0,0,0,0.3)"
              stroke={INK}
              strokeWidth={1.5}
            />
            {/* Barrel */}
            <rect
              x={cx - 1.5}
              y={h * 0.2}
              width={3}
              height={cellSize * 0.2}
              fill={INK}
            />
            {/* Rivets */}
            <circle cx={cx - cellSize * 0.1} cy={h * 0.7} r={1.5} fill={INK} />
            <circle cx={cx + cellSize * 0.1} cy={h * 0.7} r={1.5} fill={INK} />
          </g>
        );
      })}
    </g>
  );
}

// --- Cruiser: funnel + radar dish ---
function CruiserDetails({ cellSize, cells }: { cellSize: number; cells: number }) {
  const w = cells * cellSize;
  const h = cellSize;
  const midX = w / 2;
  const rearX = w - cellSize * 0.5;
  return (
    <g>
      {/* Pointed bow (left tip) */}
      <path
        d={`M ${INK_WIDTH} ${h * 0.5} L ${cellSize * 0.3} ${h * 0.2} L ${cellSize * 0.3} ${h * 0.8} Z`}
        fill="rgba(255,255,255,0.2)"
        stroke={INK}
        strokeWidth={1}
      />
      {/* Funnel bump in middle */}
      <circle
        cx={midX}
        cy={h * 0.25}
        r={cellSize * 0.12}
        fill="rgba(0,0,0,0.2)"
        stroke={INK}
        strokeWidth={1.5}
      />
      {/* Tiny smoke curl */}
      <path
        d={`M ${midX} ${h * 0.1} Q ${midX + 3} ${h * 0.05} ${midX} 0`}
        fill="none"
        stroke={INK}
        strokeWidth={1.5}
        strokeLinecap="round"
        opacity={0.5}
      />
      {/* Radar dish on rear */}
      <g>
        <line
          x1={rearX}
          y1={h * 0.3}
          x2={rearX}
          y2={h * 0.1}
          stroke={INK}
          strokeWidth={1.5}
        />
        <ellipse
          cx={rearX}
          cy={h * 0.08}
          rx={cellSize * 0.1}
          ry={2}
          fill="none"
          stroke={INK}
          strokeWidth={1.5}
        />
      </g>
    </g>
  );
}

// --- Submarine: periscope + ripple rings ---
function SubmarineDetails({ cellSize, cells }: { cellSize: number; cells: number }) {
  const w = cells * cellSize;
  const h = cellSize;
  const midX = w / 2;
  return (
    <g>
      {/* Waterline band (darker) */}
      <rect
        x={cellSize * 0.1}
        y={h * 0.55}
        width={w - cellSize * 0.2}
        height={h * 0.2}
        rx={h * 0.1}
        fill="rgba(0,0,0,0.25)"
        stroke="none"
      />
      {/* Periscope tube in center */}
      <line
        x1={midX}
        y1={h * 0.2}
        x2={midX}
        y2={h * 0.05}
        stroke={INK}
        strokeWidth={2}
      />
      {/* Periscope lens */}
      <circle
        cx={midX}
        cy={h * 0.04}
        r={3}
        fill="rgba(255,255,255,0.5)"
        stroke={INK}
        strokeWidth={1.5}
      />
      {/* Ripple rings around hull (submerged feel) */}
      <ellipse
        cx={midX}
        cy={h * 0.9}
        rx={w * 0.4}
        ry={h * 0.08}
        fill="none"
        stroke={INK}
        strokeWidth={1}
        strokeDasharray="3 4"
        opacity={0.3}
      />
    </g>
  );
}

// --- Flame icon for hit state ---
function FlameIcon({ x, y, size }: { x: number; y: number; size: number }) {
  return (
    <g transform={`translate(${x - size / 2}, ${y - size / 2})`}>
      <path
        d={`M ${size / 2} ${size}
            C ${size * 0.15} ${size * 0.7} ${size * 0.2} ${size * 0.4} ${size / 2} ${size * 0.1}
            C ${size * 0.8} ${size * 0.4} ${size * 0.85} ${size * 0.7} ${size / 2} ${size} Z`}
        fill="#FF4500"
        stroke={INK}
        strokeWidth={1.5}
      />
      <path
        d={`M ${size / 2} ${size * 0.8}
            C ${size * 0.35} ${size * 0.6} ${size * 0.4} ${size * 0.4} ${size / 2} ${size * 0.25}
            C ${size * 0.6} ${size * 0.4} ${size * 0.65} ${size * 0.6} ${size / 2} ${size * 0.8} Z`}
        fill="#FFD700"
      />
    </g>
  );
}

// --- Helper: darken/lighten hex color ---
function shadeColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + percent));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00ff) + percent));
  const b = Math.max(0, Math.min(255, (num & 0x0000ff) + percent));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

// --- Team color constants ---
export const SHIP_COLORS = {
  blue: "#257ABB",
  green: "#678443",
  navy: "#1F4E79",
  teal: "#3FA8A0",
  yellowGreen: "#8FA850",
} as const;

// --- Ship type metadata for quick reference ---
export const SHIP_META = {
  carrier: { cells: 5, label: "Carrier", color: SHIP_COLORS.blue },
  battleship: { cells: 4, label: "Battleship", color: SHIP_COLORS.navy, hp: 2 },
  cruiser: { cells: 3, label: "Cruiser", color: SHIP_COLORS.teal },
  submarine: { cells: 3, label: "Submarine", color: SHIP_COLORS.yellowGreen, stealth: true },
} as const;
