import { useMemo, useRef, useState } from "react";
import styles from "./SeatSelector.module.scss";
import ui from "@shared/styles/primitives.module.scss";

export interface SeatInfo {
  seatId: string;
  row: string;
  seatNumber: string;
  section: string;
  tierId?: string;
  posX?: number;
  posY?: number;
  isAvailable: boolean;
  isSold?: boolean;
  rotationDeg?: number;
}

export interface SectionInfo {
  sectionId: string;
  name: string;
  color?: string;
  defaultTierId?: string;
}

export interface TierInfo {
  id: string;
  name: string;
  price: number;
  color?: string;
  remaining: number;
}

export interface PolygonZone {
  label: string;
  /** Polygon vertices in 0-100 PCT space (matches AI suggestion points) */
  points: [number, number][];
  color?: string;
}

interface SeatSelectorProps {
  /** Seat IDs that other users currently have in their cart (soft indicator only). */
  inCartSeats?: string[];
  seats: SeatInfo[];
  sections: SectionInfo[];
  tiers: TierInfo[];
  stagePosition?: "top" | "bottom" | "left" | "right";
  /** Floor plan background image URL — shows the actual venue map behind the seat overlay. */
  backgroundImageUrl?: string;
  /** AI-detected polygon zone outlines rendered as SVG overlays in map mode. */
  polygonZones?: PolygonZone[];
  selectedSeats: string[];
  maxSeats: number;
  onSelectionChange: (seatIds: string[]) => void;
}

// ─── Status helper (shared between modes) ────────────────────────────────────
function getSeatStatus(
  seat: SeatInfo,
  selectedSeats: string[],
  inCartSeats: string[],
): string {
  if (seat.isSold) return "sold";
  if (!seat.isAvailable) return "unavailable";
  if (selectedSeats.includes(seat.seatId)) return "selected";
  if (inCartSeats.includes(seat.seatId)) return "in-cart";
  return "available";
}

// SVG seat fill colours — matches SCSS data-status rules
const STATUS_FILL: Record<string, string> = {
  available: "var(--success, #22c55e)",
  selected: "var(--primary, #E59D0D)",
  "in-cart": "var(--taa-gold-500, #f59e0b)",
  sold: "var(--text-subtle, #6b7280)",
  unavailable: "var(--text-subtle, #6b7280)",
};
const STATUS_STROKE: Record<string, string> = {
  available: "rgba(0,0,0,.18)",
  selected: "#b87900",
  "in-cart": "#b45309",
  sold: "rgba(0,0,0,.10)",
  unavailable: "rgba(0,0,0,.10)",
};

export default function SeatSelector({
  seats,
  sections,
  tiers,
  stagePosition = "top",
  backgroundImageUrl,
  selectedSeats,
  inCartSeats = [],
  maxSeats,
  onSelectionChange,
  polygonZones = [],
}: SeatSelectorProps) {
  const [hoveredSeat, setHoveredSeat] = useState<string | null>(null);
  // Tooltip pixel position (for SVG map mode)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(
    null,
  );

  // ─── Detect whether we have spatial layout data ───────────────────────────
  const hasSpatialLayout = useMemo(() => {
    if (!seats.length) return false;
    const withCoords = seats.filter(
      (s) => typeof s.posX === "number" && typeof s.posY === "number",
    );
    return withCoords.length / seats.length >= 0.7;
  }, [seats]);

  // ─── Compute SVG viewBox from seat positions (map mode only) ─────────────
  const mapBounds = useMemo(() => {
    if (!hasSpatialLayout) return null;
    const spatialSeats = seats.filter(
      (s) => typeof s.posX === "number" && typeof s.posY === "number",
    );
    const xs = spatialSeats.map((s) => s.posX as number);
    const ys = spatialSeats.map((s) => s.posY as number);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    // Estimate seat size as % of range / count — fallback to 24 (1 grid unit)
    const xRange = maxX - minX || 120;
    const yRange = maxY - minY || 120;
    // seat radius: ~40% of estimated grid spacing, min 6 max 18 world-units
    const approxCols = Math.round(xRange / 24) + 1;
    const approxRows = Math.round(yRange / 24) + 1;
    void approxCols;
    void approxRows;
    const r = Math.min(
      18,
      Math.max(6, Math.round((Math.min(xRange, yRange) / seats.length) * 2)),
    );
    // Stage bar thickness
    const stageH = Math.max(20, yRange * 0.06);
    const pad = Math.max(r * 3, 30);
    return { minX, minY, maxX, maxY, xRange, yRange, r, stageH, pad };
  }, [hasSpatialLayout, seats]);

  // ─── Tier / section lookups ───────────────────────────────────────────────
  const tierById = useMemo(() => new Map(tiers.map((t) => [t.id, t])), [tiers]);
  const sectionByName = useMemo(
    () => new Map(sections.map((s) => [s.name, s])),
    [sections],
  );

  // ─── Seat click ───────────────────────────────────────────────────────────
  const handleSeatClick = (seat: SeatInfo) => {
    if (!seat.isAvailable || seat.isSold) return;
    const isSelected = selectedSeats.includes(seat.seatId);
    if (isSelected) {
      onSelectionChange(selectedSeats.filter((id) => id !== seat.seatId));
    } else if (selectedSeats.length < maxSeats) {
      onSelectionChange([...selectedSeats, seat.seatId]);
    }
  };

  // ─── Hovered seat info ────────────────────────────────────────────────────
  const hoveredInfo = hoveredSeat
    ? (seats.find((s) => s.seatId === hoveredSeat) ?? null)
    : null;
  const hoveredTier = hoveredInfo?.tierId
    ? tierById.get(hoveredInfo.tierId)
    : null;

  // ─── Pan (shared between modes) ───────────────────────────────────────────
  const panRef = useRef<{
    startX: number;
    startY: number;
    offsetX: number;
    offsetY: number;
    active: boolean;
    moved: boolean;
  } | null>(null);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  // SVG zoom (map mode)
  const [zoom, setZoom] = useState(1);
  const mapWrapRef = useRef<SVGSVGElement>(null);

  function handlePointerDown(e: React.PointerEvent) {
    if ((e.target as Element).closest("[data-seat]")) return;
    panRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      offsetX: panOffset.x,
      offsetY: panOffset.y,
      active: true,
      moved: false,
    };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }
  function handlePointerMove(e: React.PointerEvent) {
    const pan = panRef.current;
    if (!pan?.active) return;
    pan.moved = true;
    setPanOffset({
      x: pan.offsetX + (e.clientX - pan.startX),
      y: pan.offsetY + (e.clientY - pan.startY),
    });
  }
  function handlePointerUp() {
    if (panRef.current) panRef.current.active = false;
  }
  function handleWheel(e: React.WheelEvent<HTMLDivElement>) {
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    // Cursor position relative to element center
    const cx = e.clientX - rect.left - rect.width / 2;
    const cy = e.clientY - rect.top - rect.height / 2;
    setZoom((prev) => {
      const next = Math.min(8, Math.max(0.4, prev * (1 - e.deltaY * 0.001)));
      const ratio = next / prev;
      // Shift pan so the point under the cursor stays fixed
      setPanOffset((p) => ({
        x: cx - ratio * (cx - p.x),
        y: cy - ratio * (cy - p.y),
      }));
      return next;
    });
  }

  // ─── Total price of selected seats ───────────────────────────────────────
  const totalPrice = useMemo(() => {
    let total = 0;
    for (const seatId of selectedSeats) {
      const seat = seats.find((s) => s.seatId === seatId);
      if (seat?.tierId) {
        const tier = tierById.get(seat.tierId);
        if (tier) total += tier.price;
      }
    }
    return total;
  }, [selectedSeats, seats, tierById]);

  // ─── Legend (shared) ──────────────────────────────────────────────────────
  const legend = (
    <div className={styles.legend}>
      <div className={styles.legendItem}>
        <span className={`${styles.legendSwatch} ${styles.legendAvailable}`} />
        <span>Available</span>
      </div>
      <div className={styles.legendItem}>
        <span className={`${styles.legendSwatch} ${styles.legendSelected}`} />
        <span>Selected</span>
      </div>
      <div className={styles.legendItem}>
        <span className={`${styles.legendSwatch} ${styles.legendInCart}`} />
        <span>Viewing</span>
      </div>
      <div className={styles.legendItem}>
        <span className={`${styles.legendSwatch} ${styles.legendSold}`} />
        <span>Sold</span>
      </div>
      {tiers.map((tier) => (
        <div key={tier.id} className={styles.legendItem}>
          <span
            className={styles.legendSwatch}
            style={{ backgroundColor: tier.color || "var(--color-accent)" }}
          />
          <span>
            {tier.name} (${tier.price})
          </span>
        </div>
      ))}
    </div>
  );

  // ─── Summary (shared) ─────────────────────────────────────────────────────
  const summary = (
    <div className={styles.summary}>
      <p className={styles.summaryCount}>
        {selectedSeats.length} of {maxSeats} seat{maxSeats !== 1 ? "s" : ""}{" "}
        selected
      </p>
      {selectedSeats.length > 0 && (
        <>
          <div className={styles.selectedList}>
            {selectedSeats.map((seatId) => {
              const seat = seats.find((s) => s.seatId === seatId);
              if (!seat) return null;
              const tier = seat.tierId ? tierById.get(seat.tierId) : null;
              return (
                <span key={seatId} className={ui.chip}>
                  {seat.row}
                  {seat.seatNumber}
                  {tier && ` — $${tier.price}`}
                </span>
              );
            })}
          </div>
          {totalPrice > 0 && (
            <p className={styles.summaryTotal}>
              Total: <strong>${totalPrice.toFixed(2)}</strong>
            </p>
          )}
        </>
      )}
    </div>
  );

  // ─── Tooltip ──────────────────────────────────────────────────────────────
  const tooltip = hoveredInfo && (
    <div
      className={styles.tooltip}
      style={
        tooltipPos
          ? {
              position: "fixed",
              left: tooltipPos.x + 14,
              top: tooltipPos.y - 10,
              bottom: "auto",
              transform: "none",
            }
          : undefined
      }
    >
      <p className={styles.tooltipTitle}>
        {hoveredInfo.section} · Row {hoveredInfo.row} · Seat{" "}
        {hoveredInfo.seatNumber}
      </p>
      {hoveredTier && (
        <p className={styles.tooltipPrice}>
          {hoveredTier.name}: ${hoveredTier.price}
        </p>
      )}
      {hoveredInfo.isSold && <p className={styles.tooltipSold}>Sold out</p>}
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════
  //  MAP MODE (spatial SVG layout)
  // ══════════════════════════════════════════════════════════════════════════
  if (hasSpatialLayout && mapBounds) {
    const { minX, minY, maxX, maxY, xRange, yRange, r, stageH, pad } =
      mapBounds;

    // Full viewBox including padding + stage bar
    const vbX = minX - pad;
    const vbY = stagePosition === "top" ? minY - pad - stageH : minY - pad;
    const vbW = xRange + pad * 2;
    const vbH = yRange + pad * 2 + stageH;

    // Stage rect
    let stageRect: {
      x: number;
      y: number;
      w: number;
      h: number;
      labelX: number;
      labelY: number;
    };
    if (stagePosition === "top") {
      stageRect = {
        x: vbX,
        y: minY - pad - stageH,
        w: vbW,
        h: stageH,
        labelX: vbX + vbW / 2,
        labelY: minY - pad - stageH / 2 + 2,
      };
    } else if (stagePosition === "bottom") {
      stageRect = {
        x: vbX,
        y: maxY + pad,
        w: vbW,
        h: stageH,
        labelX: vbX + vbW / 2,
        labelY: maxY + pad + stageH / 2 + 2,
      };
    } else if (stagePosition === "left") {
      stageRect = {
        x: vbX,
        y: vbY,
        w: stageH,
        h: vbH,
        labelX: vbX + stageH / 2,
        labelY: vbY + vbH / 2,
      };
    } else {
      stageRect = {
        x: maxX + pad,
        y: vbY,
        w: stageH,
        h: vbH,
        labelX: maxX + pad + stageH / 2,
        labelY: vbY + vbH / 2,
      };
    }

    return (
      <div className={styles.container}>
        {legend}

        <div
          className={styles.mapWrap}
          onWheel={handleWheel}
          style={{ touchAction: "none" }}
        >
          <svg
            ref={mapWrapRef}
            className={styles.mapSvg}
            viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
            preserveAspectRatio="xMidYMid meet"
            style={{
              transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
              transformOrigin: "50% 50%",
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            {/* Background floor plan image */}
            {backgroundImageUrl && (
              <image
                href={backgroundImageUrl}
                x={vbX}
                y={vbY}
                width={vbW}
                height={vbH}
                preserveAspectRatio="xMidYMid meet"
                opacity={0.35}
              />
            )}

            {/* Section polygon outlines from AI analysis */}
            {(polygonZones as PolygonZone[]).map((zone, zi) => {
              if (!zone.points || zone.points.length < 3) return null;
              // Scale from 0-100 PCT -> world coords matching seat posX/posY range
              const scaled = zone.points.map(([px, py]) => [
                minX + (px / 100) * xRange,
                minY + (py / 100) * yRange,
              ]);
              const ptStr = scaled.map(([sx, sy]) => `${sx},${sy}`).join(" ");
              const zColor =
                zone.color ?? `hsl(${(zi * 47 + 210) % 360}, 55%, 65%)`;
              const cx = scaled.reduce((s, [sx]) => s + sx, 0) / scaled.length;
              const cy =
                scaled.reduce((s, [, sy]) => s + sy, 0) / scaled.length;
              return (
                <g key={`zone-${zi}`} style={{ pointerEvents: "none" }}>
                  <polygon
                    points={ptStr}
                    fill={zColor}
                    fillOpacity={0.06}
                    stroke={zColor}
                    strokeWidth={r * 0.3}
                    strokeOpacity={0.45}
                    strokeDasharray={`${r * 1.5} ${r * 0.8}`}
                  />
                  <text
                    x={cx}
                    y={cy}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={r * 1.4}
                    fontWeight="600"
                    fontFamily="system-ui, sans-serif"
                    fill={zColor}
                    fillOpacity={0.65}
                    style={{ userSelect: "none" }}
                  >
                    {zone.label}
                  </text>
                </g>
              );
            })}

            {/* Stage */}
            <rect
              x={stageRect.x}
              y={stageRect.y}
              width={stageRect.w}
              height={stageRect.h}
              fill="rgba(229,157,13,0.18)"
              stroke="#E59D0D"
              strokeWidth={r * 0.25}
              rx={r * 0.3}
            />
            <text
              x={stageRect.labelX}
              y={stageRect.labelY}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={stageH * 0.45}
              fontWeight="700"
              fontFamily="system-ui, sans-serif"
              letterSpacing="0.12em"
              fill="#E59D0D"
              style={{ pointerEvents: "none", userSelect: "none" }}
            >
              STAGE
            </text>

            {/* Seats */}
            {seats.map((seat) => {
              if (
                typeof seat.posX !== "number" ||
                typeof seat.posY !== "number"
              )
                return null;
              const status = getSeatStatus(seat, selectedSeats, inCartSeats);
              const isClickable = seat.isAvailable && !seat.isSold;
              return (
                <circle
                  key={seat.seatId}
                  data-seat={seat.seatId}
                  cx={seat.posX}
                  cy={seat.posY}
                  r={r}
                  fill={STATUS_FILL[status] || STATUS_FILL.available}
                  stroke={STATUS_STROKE[status] || STATUS_STROKE.available}
                  strokeWidth={status === "selected" ? r * 0.35 : r * 0.15}
                  opacity={
                    status === "sold" || status === "unavailable" ? 0.45 : 1
                  }
                  style={{
                    cursor: isClickable ? "pointer" : "not-allowed",
                    transition: "fill 0.12s, r 0.12s",
                  }}
                  onClick={() => handleSeatClick(seat)}
                  onMouseEnter={(e) => {
                    setHoveredSeat(seat.seatId);
                    setTooltipPos({ x: e.clientX, y: e.clientY });
                  }}
                  onMouseMove={(e) =>
                    setTooltipPos({ x: e.clientX, y: e.clientY })
                  }
                  onMouseLeave={() => {
                    setHoveredSeat(null);
                    setTooltipPos(null);
                  }}
                />
              );
            })}

            {/* Row labels: one label per row per section, positioned at leftmost seat */}
            {Array.from(
              seats
                .reduce((acc, s) => {
                  if (typeof s.posX !== "number" || typeof s.posY !== "number")
                    return acc;
                  const key = `${s.section}__${s.row}`;
                  const existing = acc.get(key);
                  if (!existing || s.posX < (existing.posX ?? Infinity))
                    acc.set(key, s);
                  return acc;
                }, new Map<string, SeatInfo>())
                .values(),
            ).map((s) => (
              <text
                key={`rowlabel-${s.section}-${s.row}`}
                x={(s.posX as number) - r * 1.8}
                y={s.posY as number}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={r * 1.1}
                fontWeight="600"
                fontFamily="system-ui, sans-serif"
                fill="var(--text-muted, rgba(255,255,255,0.55))"
                style={{ pointerEvents: "none", userSelect: "none" }}
              >
                {s.row}
              </text>
            ))}
          </svg>

          <div className={styles.mapHint}>Scroll to zoom · Drag to pan</div>
        </div>

        {tooltip}
        {summary}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  LIST MODE (fallback — no posX/posY data)
  // ══════════════════════════════════════════════════════════════════════════

  // Group seats by section and row
  const seatsBySection = (() => {
    const grouped = new Map<string, Map<string, SeatInfo[]>>();
    for (const seat of seats) {
      if (!grouped.has(seat.section)) grouped.set(seat.section, new Map());
      const sectionMap = grouped.get(seat.section)!;
      if (!sectionMap.has(seat.row)) sectionMap.set(seat.row, []);
      sectionMap.get(seat.row)!.push(seat);
    }
    for (const sectionMap of grouped.values()) {
      for (const [row, rowSeats] of sectionMap) {
        sectionMap.set(
          row,
          rowSeats.sort((a, b) => {
            const na = parseInt(a.seatNumber, 10);
            const nb = parseInt(b.seatNumber, 10);
            return !isNaN(na) && !isNaN(nb)
              ? na - nb
              : a.seatNumber.localeCompare(b.seatNumber);
          }),
        );
      }
    }
    return grouped;
  })();

  void sectionByName; // available for future themed sections

  return (
    <div className={styles.container}>
      {/* Stage indicator */}
      <div className={styles.stage} data-position={stagePosition}>
        STAGE
      </div>

      {legend}

      {/* Seating chart — list layout */}
      <div
        className={styles.chart}
        style={
          panOffset.x || panOffset.y
            ? { transform: `translate(${panOffset.x}px, ${panOffset.y}px)` }
            : undefined
        }
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest("button")) return;
          panRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            offsetX: panOffset.x,
            offsetY: panOffset.y,
            active: true,
            moved: false,
          };
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {Array.from(seatsBySection.entries()).map(([sectionName, rows]) => (
          <div key={sectionName} className={styles.section}>
            <h4 className={styles.sectionName}>{sectionName}</h4>
            <div className={styles.rows}>
              {Array.from(rows.entries())
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([rowName, rowSeats]) => (
                  <div key={rowName} className={styles.row}>
                    <span className={styles.rowLabel}>{rowName}</span>
                    <div className={styles.seats}>
                      {rowSeats.map((seat) => {
                        const status = getSeatStatus(
                          seat,
                          selectedSeats,
                          inCartSeats,
                        );
                        return (
                          <button
                            key={seat.seatId}
                            className={styles.seat}
                            data-status={status}
                            onClick={() => handleSeatClick(seat)}
                            onMouseEnter={() => setHoveredSeat(seat.seatId)}
                            onMouseLeave={() => setHoveredSeat(null)}
                            disabled={!seat.isAvailable || seat.isSold}
                            title={`${seat.section} ${seat.row}${seat.seatNumber}`}
                          >
                            {seat.seatNumber}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>

      {/* Hover tooltip */}
      {hoveredInfo && (
        <div className={styles.tooltip}>
          <p className={styles.tooltipTitle}>
            {hoveredInfo.section} · Row {hoveredInfo.row} · Seat{" "}
            {hoveredInfo.seatNumber}
          </p>
          {hoveredTier && (
            <p className={styles.tooltipPrice}>
              {hoveredTier.name}: ${hoveredTier.price}
            </p>
          )}
          {hoveredInfo.isSold && <p className={styles.tooltipSold}>Sold out</p>}
        </div>
      )}

      {summary}
    </div>
  );
}
