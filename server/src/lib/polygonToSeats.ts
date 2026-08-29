/**
 * polygonToSeats.ts
 * Point-in-polygon fill: given a detected polygon plus physical calibration
 * (roomBoundary or AI-read labeled lengths), generate ISeat[] with posX/posY in world units.
 */

export interface PolygonToSeatsOptions {
  /** Polygon vertices in 0-100 PCT space */
  points: [number, number][];
  sectionName: string;
  /** Authoritative room footprint in feet when manually defined in the editor. */
  roomBoundaryFeet?: { width: number; height: number };
  /** AI-read labeled venue dimensions in feet when present on the plan image. */
  estimatedVenueFeet?: { width?: number; height?: number };
  /** AI-read labeled seat measurements, used to derive pitch when available. */
  referenceSeat?: {
    widthFeet: number;
    depthFeet: number;
    rowPitchFeet: number;
  };
  /** Optional physical area target for the polygon itself when provided by the user. */
  targetAreaSquareFeet?: number;
  gridSize: number;
  estimatedSeats?: number | null;
  isAccessible?: boolean;
  tierId?: string;
  floorId?: string;
  /** Starting seat number offset (for multi-section layouts) */
  seatNumberOffset?: number;
}

function polygonArea(points: [number, number][]): number {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area) / 2;
}

/** Ray-casting point-in-polygon (even-odd rule) */
function pointInPolygon(
  px: number,
  py: number,
  poly: [number, number][],
): boolean {
  let inside = false;
  const n = poly.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    const intersect =
      yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export interface GeneratedSeat {
  seatId: string;
  row: string;
  seatNumber: number;
  section: string;
  posX: number;
  posY: number;
  isAvailable: boolean;
  tierId?: string;
  floorId?: string;
  isAccessible?: boolean;
}

export function polygonToSeats(opts: PolygonToSeatsOptions): GeneratedSeat[] {
  const {
    points,
    sectionName,
    roomBoundaryFeet,
    estimatedVenueFeet,
    referenceSeat,
    targetAreaSquareFeet,
    gridSize,
    estimatedSeats,
    isAccessible = false,
    tierId,
    floorId,
    seatNumberOffset = 0,
  } = opts;

  if (points.length < 3) return [];

  // Bounding box in PCT space
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const polygonAreaPct = polygonArea(points);

  const widthFeet = roomBoundaryFeet?.width ?? estimatedVenueFeet?.width;
  const heightFeet = roomBoundaryFeet?.height ?? estimatedVenueFeet?.height;

  let feetPerPctX: number | undefined;
  let feetPerPctY: number | undefined;

  if (widthFeet && heightFeet) {
    feetPerPctX = widthFeet / 100;
    feetPerPctY = heightFeet / 100;
  } else if (targetAreaSquareFeet && polygonAreaPct > 0) {
    // Uniform scale from polygon shape + known square footage
    const feetPerPct = Math.sqrt(targetAreaSquareFeet / polygonAreaPct);
    feetPerPctX = feetPerPct;
    feetPerPctY = feetPerPct;
  } else {
    throw new Error(
      "polygonToSeats requires roomBoundary, AI-labeled venue dimensions, or a target square footage",
    );
  }

  const polygonAreaSquareFeet = polygonAreaPct * feetPerPctX * feetPerPctY;

  const seatWidthFeet = referenceSeat?.widthFeet ?? 2.5;
  const rowPitchFeet = referenceSeat?.rowPitchFeet ?? 3.2;
  const targetSeats =
    estimatedSeats ??
    Math.max(
      4,
      Math.floor(polygonAreaSquareFeet / (seatWidthFeet * rowPitchFeet)),
    );

  const sectionWidthFeet = (xMax - xMin) * feetPerPctX;
  const cols = Math.max(2, Math.floor(sectionWidthFeet / seatWidthFeet));
  const rows = Math.max(2, Math.ceil(targetSeats / cols));

  // Sample candidate seats on a physical pitch, then clip back to the detected polygon
  const stepXPct = seatWidthFeet / feetPerPctX;
  const stepYPct = rowPitchFeet / feetPerPctY;

  const seats: GeneratedSeat[] = [];
  let seatNum = 1 + seatNumberOffset;

  const rowLabels = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  for (let ri = 0; ri < rows; ri++) {
    const pyPct = yMin + ri * stepYPct;
    if (pyPct > yMax) break;
    const rowLabel = rowLabels[ri % rowLabels.length] ?? String(ri + 1);
    let rowSeatNum = 1;

    for (let ci = 0; ci < cols; ci++) {
      const pxPct = xMin + ci * stepXPct;
      if (pxPct > xMax) break;

      if (!pointInPolygon(pxPct, pyPct, points)) continue;

      // Convert PCT to world units using calibrated physical scale
      const posX = Math.round(pxPct * feetPerPctX * gridSize);
      const posY = Math.round(pyPct * feetPerPctY * gridSize);

      seats.push({
        seatId: `${sectionName.replace(/\s+/g, "-").toLowerCase()}-${rowLabel}${rowSeatNum}`,
        row: rowLabel,
        seatNumber: seatNum,
        section: sectionName,
        posX,
        posY,
        isAvailable: true,
        tierId,
        floorId,
        isAccessible,
      });
      seatNum++;
      rowSeatNum++;
    }
  }

  return seats;
}
