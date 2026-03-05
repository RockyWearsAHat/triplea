# Plan: Venue Seat-Map Editor Overhaul

**Status:** � COMPLETE  
**Goal:** Add Section/Arc Wizard, pre-built templates with real seat generation, per-seat rotation, touch-friendly FAB + bottom sheet, and an Export/Preview modal — all without new npm packages.

---

## Context

### Current state (confirmed by code read)

- `SeatLayoutEditorPage.tsx` is 4143 lines. Key confirmed facts:
  - `EditableSeat` has `posX`, `posY`, `rowGroupId`, `section`, `row`, `seatNumber`, `floorId`, `tierId`, `isAvailable` — **no `rotationDeg` field**.
  - `generateSection()` produces a simple rectangular grid.
  - `generateRowFromDraft()` produces one straight row from a pointer drag.
  - `ROOM_TEMPLATES` for `theater` and `concert` both have `defaultPlan: null` — **no seats are generated**.
  - `applyRoomTemplate()` only calls `generateSmartPlan()` (which handles tables only) — straight/arc/wing rows are unimplemented.
  - The right panel (`sidePanel`) is hidden at `max-width: 960px` (`display: none`). No bottom sheet or FAB exists.
  - Pointer events are already used throughout for drag/pan. The wheel handler is a native DOM listener.
  - `spaceDownRef` / `panStartRef` already handle pan.
  - No `SectionWizard` component exists anywhere.

- `SeatSelector.tsx` (shared): renders section → row → seat **as a text list**, does **not** use `posX`/`posY` for layout. No `rotationDeg` on `SeatInfo`. No touch pan/zoom.

- `SeatSelector.module.scss`: standard `.chart` flex-column. No zoomable container.

- `CheckoutPage.tsx`: loads `api.getAvailableSeats(gigId)` → passes `seats`, `sections`, `stagePosition`, `tiers` to `<SeatSelector>`.

- `seating.ts` PATCH route already accepts `seats[].posX`, `seats[].posY`, `elements`, `stage`, `stagePosition`, `roomBoundary`.

### Root causes of each gap

1. **No Arc/Wizard**: `generateSection()` only does rectangular grids. No UI for arc params. Fix: new `SectionWizard` component + call from editor.
2. **Stub templates**: `ROOM_TEMPLATES[theater|concert|outdoor].defaultPlan = null`. `applyRoomTemplate` does not branch for row-based layouts. Fix: add a `rowPlan` field to `RoomTemplate` and implement `applyRowPlan()`.
3. **No `rotationDeg`**: Missing from type. Fix: add field, apply `rotate()` in both render sites.
4. **Touch UX**: Panel hidden on mobile, no FAB, row-draw is drag-only. Fix: FAB + bottom sheet CSS + tap-tap row mode.
5. **SeatSelector spatial**: List-only view; spatially positioned + rotated seats can't render correctly. Fix: add `spatialView` mode powered by same pointer-event pan/zoom pattern.
6. **No Export/Preview**: No modal. Fix: add modal that renders `<SeatSelector>` with current editor state + JSON export.

---

## Geometry formulas (for implementor reference)

### Straight block (N rows × M seats)

```
pitchPx = seatPitchFeet * gridSize        // horizontal spacing
rowSpacePx = rowSpacingFeet * gridSize    // vertical spacing
blockW = (seatsPerRow - 1) * pitchPx
blockH = (rowCount - 1) * rowSpacePx
originX = cx - blockW / 2
originY = cy - blockH / 2

for r in 0..rowCount-1:
  for s in 0..seatsPerRow-1:
    raw_x = originX + s * pitchPx
    raw_y = originY + r * rowSpacePx
    seat.posX = raw_x
    seat.posY = raw_y
    seat.rotationDeg = 0
    seat.row = toRowName(r)
    seat.seatNumber = String(s + 1)
```

### Angled wing (straight block + rotation around its own center)

```
// Same box as above, then rotate each seat around (cx, cy):
angleRad = rotationDeg * (Math.PI / 180)
cosA = Math.cos(angleRad)
sinA = Math.sin(angleRad)

for each seat:
  dx = raw_x - cx
  dy = raw_y - cy
  seat.posX = cx + cosA * dx - sinA * dy
  seat.posY = cy + sinA * dx + cosA * dy
  seat.rotationDeg = rotationDeg   // seat itself rotated same angle
```

### Arc / Fan section

```
// Parameters (all converted to px internally):
innerRadiusPx = innerRadiusFt * gridSize
rowSpacePx    = rowSpacingFt * gridSize
startAngleRad = (centerAngleDeg - angularSpanDeg / 2) * (Math.PI / 180)
endAngleRad   = (centerAngleDeg + angularSpanDeg / 2) * (Math.PI / 180)
spanRad       = angularSpanDeg * (Math.PI / 180)

for r in 0..rowCount-1:
  R = innerRadiusPx + r * rowSpacePx
  // seats scale with arc circumference to maintain ~constant pitch
  arcLength = R * spanRad
  seatsInRow = Math.max(minSeatsInner, Math.round(arcLength / (seatPitchFt * gridSize)))

  for s in 0..seatsInRow-1:
    angle = startAngleRad + s * (spanRad / Math.max(seatsInRow - 1, 1))
    seat.posX = cx + R * Math.cos(angle)
    seat.posY = cy + R * Math.sin(angle)
    // Seat faces radially inward (toward arc center = toward stage)
    facingAngleDeg = (angle * 180 / Math.PI) + 90   // +90 because "up" on screen is rotation=0
    seat.rotationDeg = facingAngleDeg
    seat.row = toRowName(r)
    seat.seatNumber = String(s + 1)
```

**Note:** `centerAngleDeg` for stage-top, audience below = **90°** (pointing downward on screen, i.e., angle 90° = pointing south). For stage-bottom situation, use **270°** (pointing up).

---

## Steps

---

### Step 1: Add `rotationDeg` to `EditableSeat` type — `TripleAMusic/src/pages/SeatLayoutEditorPage.tsx`

**Operation:** `REPLACE`

**Anchor:**

```
type EditableSeat = {
  seatId: string;
  row: string;
  seatNumber: string;
  section: string;
  floorId?: string;
  tierId?: string;
  posX?: number;
  posY?: number;
  isAvailable: boolean;
  isSold?: boolean;
  rowGroupId?: string;
  detachedFromRow?: boolean;
};
```

**Code:**

```tsx
type EditableSeat = {
  seatId: string;
  row: string;
  seatNumber: string;
  section: string;
  floorId?: string;
  tierId?: string;
  posX?: number;
  posY?: number;
  isAvailable: boolean;
  isSold?: boolean;
  rowGroupId?: string;
  detachedFromRow?: boolean;
  /** Degrees clockwise. Applied as CSS rotate() on the seat div. 0 = upright. */
  rotationDeg?: number;
};
```

**Verify:** `npx tsc --project TripleAMusic/tsconfig.json --noEmit 2>&1 | head -20`

---

### Step 2: Apply `rotationDeg` in editor seat render — `TripleAMusic/src/pages/SeatLayoutEditorPage.tsx`

The seat `<button>` transform currently is:

```
transform: `translate(${x}px, ${y}px) translate(-50%, -50%)`
```

**Operation:** `REPLACE`

**Anchor:**

```
                      style={
                        {
                          transform: `translate(${x}px, ${y}px) translate(-50%, -50%)`,
                          width: seatSizeFeet * gridSize,
                          height: seatSizeFeet * gridSize,
                          "--seat-color": seatColor,
                        } as React.CSSProperties
                      }
```

**Code:**

```tsx
                      style={
                        {
                          transform: `translate(${x}px, ${y}px) translate(-50%, -50%)${s.rotationDeg ? ` rotate(${s.rotationDeg}deg)` : ""}`,
                          width: seatSizeFeet * gridSize,
                          height: seatSizeFeet * gridSize,
                          "--seat-color": seatColor,
                        } as React.CSSProperties
                      }
```

**Verify:** Visual — angled seats from wizard should render rotated.

---

### Step 3: Add `rotationDeg` to shared `SeatInfo` — `packages/shared/src/components/SeatSelector/SeatSelector.tsx`

**Operation:** `REPLACE`

**Anchor:**

```
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
}
```

**Code:**

```tsx
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
  /** Degrees clockwise; applied via CSS rotate() when in spatial view mode. */
  rotationDeg?: number;
}
```

**Verify:** `npx tsc --project packages/shared/tsconfig.json --noEmit 2>&1 | head -20`

---

### Step 4: Create `SectionWizard.tsx` component — `TripleAMusic/src/components/SectionWizard.tsx`

**Operation:** `CREATE_FILE`

**Code:**

```tsx
/**
 * SectionWizard — modal sheet for generating straight, arc, or angled-wing
 * seat sections.  Returns generated EditableSeat[] via onGenerate callback.
 *
 * No external dependencies — pure TS geometry.
 */
import { useEffect, useRef, useState } from "react";
import ui from "@shared/styles/primitives.module.scss";
import styles from "./SectionWizard.module.scss";

// ─── Re-declare minimal types so this file is standalone ────────────────────
type WizardSeat = {
  seatId: string;
  row: string;
  seatNumber: string;
  section: string;
  floorId: string;
  posX: number;
  posY: number;
  isAvailable: true;
  rotationDeg?: number;
  rowGroupId?: string;
};

export type SectionShape = "straight" | "arc" | "wing";

interface SectionWizardProps {
  open: boolean;
  onClose: () => void;
  onGenerate: (seats: WizardSeat[]) => void;
  gridSize: number; // pixels per foot (24)
  activeFloorId: string;
  snapToGrid: boolean;
  /** Pre-fill section name counter (number of existing sections) */
  sectionIndex?: number;
}

// ─── Geometry helpers ────────────────────────────────────────────────────────

function toRowName(idx: number): string {
  const base = 26;
  let n = idx;
  let s = "";
  while (n >= 0) {
    s = String.fromCharCode(65 + (n % base)) + s;
    n = Math.floor(n / base) - 1;
  }
  return s;
}

function snapVal(n: number, g: number) {
  return Math.round(n / g) * g;
}

function generateStraightBlock(opts: {
  sectionName: string;
  floorId: string;
  rowCount: number;
  seatsPerRow: number;
  rowSpacingFt: number;
  seatPitchFt: number;
  gridSize: number;
  cx: number;
  cy: number;
  snap: boolean;
}): WizardSeat[] {
  const {
    sectionName,
    floorId,
    rowCount,
    seatsPerRow,
    rowSpacingFt,
    seatPitchFt,
    gridSize,
    cx,
    cy,
    snap,
  } = opts;
  const pitchPx = seatPitchFt * gridSize;
  const rowSpacePx = rowSpacingFt * gridSize;
  const blockW = (seatsPerRow - 1) * pitchPx;
  const blockH = (rowCount - 1) * rowSpacePx;
  const originX = cx - blockW / 2;
  const originY = cy - blockH / 2;
  const seats: WizardSeat[] = [];
  const ts = Date.now();

  for (let r = 0; r < rowCount; r++) {
    const rowLetter = toRowName(r);
    const rowGroupId = `wizard-straight-${ts}-${r}`;
    for (let s = 0; s < seatsPerRow; s++) {
      let px = originX + s * pitchPx;
      let py = originY + r * rowSpacePx;
      if (snap) {
        px = snapVal(px, gridSize);
        py = snapVal(py, gridSize);
      }
      seats.push({
        seatId: `${floorId}-${sectionName}-${rowLetter}-${s + 1}-${ts}`.replace(
          /\s+/g,
          "-",
        ),
        row: rowLetter,
        seatNumber: String(s + 1),
        section: sectionName,
        floorId,
        posX: px,
        posY: py,
        isAvailable: true,
        rowGroupId,
      });
    }
  }
  return seats;
}

function generateAngledWing(opts: {
  sectionName: string;
  floorId: string;
  rowCount: number;
  seatsPerRow: number;
  rowSpacingFt: number;
  seatPitchFt: number;
  gridSize: number;
  cx: number;
  cy: number;
  rotationDeg: number;
  snap: boolean;
}): WizardSeat[] {
  const { rotationDeg, cx, cy, ...rest } = opts;
  // Generate as straight block centered on (cx, cy)
  const raw = generateStraightBlock({ ...rest, cx, cy });
  const angleRad = rotationDeg * (Math.PI / 180);
  const cosA = Math.cos(angleRad);
  const sinA = Math.sin(angleRad);

  return raw.map((seat) => {
    const dx = seat.posX - cx;
    const dy = seat.posY - cy;
    let px = cx + cosA * dx - sinA * dy;
    let py = cy + sinA * dx + cosA * dy;
    if (opts.snap) {
      px = snapVal(px, opts.gridSize);
      py = snapVal(py, opts.gridSize);
    }
    return { ...seat, posX: px, posY: py, rotationDeg };
  });
}

function generateArcSection(opts: {
  sectionName: string;
  floorId: string;
  rowCount: number;
  minSeatsInner: number;
  innerRadiusFt: number;
  rowSpacingFt: number;
  seatPitchFt: number;
  angularSpanDeg: number;
  centerAngleDeg: number;
  gridSize: number;
  cx: number;
  cy: number;
  snap: boolean;
}): WizardSeat[] {
  const {
    sectionName,
    floorId,
    rowCount,
    minSeatsInner,
    innerRadiusFt,
    rowSpacingFt,
    seatPitchFt,
    angularSpanDeg,
    centerAngleDeg,
    gridSize,
    cx,
    cy,
    snap,
  } = opts;

  const innerRadiusPx = innerRadiusFt * gridSize;
  const rowSpacePx = rowSpacingFt * gridSize;
  const spanRad = angularSpanDeg * (Math.PI / 180);
  const startAngleRad = (centerAngleDeg - angularSpanDeg / 2) * (Math.PI / 180);
  const seats: WizardSeat[] = [];
  const ts = Date.now();

  for (let r = 0; r < rowCount; r++) {
    const R = innerRadiusPx + r * rowSpacePx;
    const arcLength = R * spanRad;
    const seatsInRow = Math.max(
      minSeatsInner,
      Math.round(arcLength / (seatPitchFt * gridSize)),
    );
    const rowLetter = toRowName(r);
    const rowGroupId = `wizard-arc-${ts}-${r}`;

    for (let s = 0; s < seatsInRow; s++) {
      const angle = startAngleRad + s * (spanRad / Math.max(seatsInRow - 1, 1));
      let px = cx + R * Math.cos(angle);
      let py = cy + R * Math.sin(angle);
      if (snap) {
        px = snapVal(px, gridSize);
        py = snapVal(py, gridSize);
      }

      // Seat faces radially toward arc center (toward stage)
      const facingAngleDeg = (angle * 180) / Math.PI + 90;

      seats.push({
        seatId: `${floorId}-${sectionName}-${rowLetter}-${s + 1}-${ts}`.replace(
          /\s+/g,
          "-",
        ),
        row: rowLetter,
        seatNumber: String(s + 1),
        section: sectionName,
        floorId,
        posX: px,
        posY: py,
        isAvailable: true,
        rotationDeg: facingAngleDeg,
        rowGroupId,
      });
    }
  }
  return seats;
}

// ─── Wizard UI ───────────────────────────────────────────────────────────────

const DEFAULTS = {
  straight: {
    rowCount: 8,
    seatsPerRow: 12,
    rowSpacing: 3,
    seatPitch: 2.5,
    rotationDeg: 0,
  },
  arc: {
    rowCount: 8,
    minSeatsInner: 10,
    innerRadius: 30,
    rowSpacing: 3,
    seatPitch: 2.5,
    angularSpan: 120,
    centerAngle: 90,
  },
  wing: {
    rowCount: 6,
    seatsPerRow: 6,
    rowSpacing: 3,
    seatPitch: 2.5,
    rotationDeg: 25,
  },
};

export function SectionWizard({
  open,
  onClose,
  onGenerate,
  gridSize,
  activeFloorId,
  snapToGrid,
  sectionIndex = 0,
}: SectionWizardProps) {
  const [shape, setShape] = useState<SectionShape>("straight");
  const [sectionName, setSectionName] = useState(`Section ${sectionIndex + 1}`);

  // Straight / wing
  const [rowCount, setRowCount] = useState(8);
  const [seatsPerRow, setSeatsPerRow] = useState(12);
  const [rowSpacing, setRowSpacing] = useState(3);
  const [seatPitch, setSeatPitch] = useState(2.5);
  const [rotationDeg, setRotationDeg] = useState(0);

  // Arc
  const [innerRadius, setInnerRadius] = useState(30);
  const [angularSpan, setAngularSpan] = useState(120);
  const [centerAngle, setCenterAngle] = useState(90);
  const [minSeatsInner, setMinSeatsInner] = useState(10);

  // Placement center (world coords, in feet from 0,0)
  const [cx, setCx] = useState(0);
  const [cy, setCy] = useState(0);

  const firstInputRef = useRef<HTMLInputElement>(null);

  // Reset section name when sectionIndex changes
  useEffect(() => {
    setSectionName(`Section ${sectionIndex + 1}`);
  }, [sectionIndex]);

  // Focus trap: focus first input when opened
  useEffect(() => {
    if (open) requestAnimationFrame(() => firstInputRef.current?.focus());
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  function handleGenerate() {
    const g = gridSize;
    const cxPx = cx * g;
    const cyPx = cy * g;
    const common = {
      sectionName,
      floorId: activeFloorId,
      rowSpacingFt: rowSpacing,
      seatPitchFt: seatPitch,
      gridSize: g,
      cx: cxPx,
      cy: cyPx,
      snap: snapToGrid,
    };

    let generated: WizardSeat[] = [];
    if (shape === "straight") {
      generated = generateStraightBlock({ ...common, rowCount, seatsPerRow });
    } else if (shape === "wing") {
      generated = generateAngledWing({
        ...common,
        rowCount,
        seatsPerRow,
        rotationDeg,
      });
    } else {
      generated = generateArcSection({
        ...common,
        rowCount,
        minSeatsInner,
        innerRadiusFt: innerRadius,
        angularSpanDeg: angularSpan,
        centerAngleDeg: centerAngle,
      });
    }
    onGenerate(generated);
    onClose();
  }

  return (
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-label="Add Section"
    >
      <div className={styles.sheet}>
        <div className={styles.sheetHeader}>
          <span className={styles.sheetTitle}>Add Section</span>
          <button
            type="button"
            className={styles.sheetClose}
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className={styles.sheetBody}>
          {/* Shape picker */}
          <div className={styles.row}>
            <label className={ui.help}>Shape</label>
            <div className={styles.segmented}>
              {(["straight", "arc", "wing"] as SectionShape[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={styles.segBtn}
                  data-active={shape === s}
                  onClick={() => {
                    setShape(s);
                    // Apply sensible defaults for the chosen shape
                    const d = DEFAULTS[s];
                    setRowCount(d.rowCount);
                    setRowSpacing(d.rowSpacing);
                    setSeatPitch(d.seatPitch);
                    if (s === "straight") {
                      setSeatsPerRow(
                        (d as typeof DEFAULTS.straight).seatsPerRow,
                      );
                      setRotationDeg(0);
                    }
                    if (s === "wing") {
                      setSeatsPerRow((d as typeof DEFAULTS.wing).seatsPerRow);
                      setRotationDeg((d as typeof DEFAULTS.wing).rotationDeg);
                    }
                    if (s === "arc") {
                      setMinSeatsInner(
                        (d as typeof DEFAULTS.arc).minSeatsInner,
                      );
                      setInnerRadius((d as typeof DEFAULTS.arc).innerRadius);
                      setAngularSpan((d as typeof DEFAULTS.arc).angularSpan);
                      setCenterAngle((d as typeof DEFAULTS.arc).centerAngle);
                    }
                  }}
                >
                  {s === "straight"
                    ? "Straight"
                    : s === "arc"
                      ? "Arc / Fan"
                      : "Angled Wing"}
                </button>
              ))}
            </div>
          </div>

          {/* Section name */}
          <div className={styles.row}>
            <label className={ui.help} htmlFor="wiz-name">
              Section name
            </label>
            <input
              ref={firstInputRef}
              id="wiz-name"
              className={ui.input}
              value={sectionName}
              onChange={(e) => setSectionName(e.target.value)}
              placeholder="e.g. Orchestra"
            />
          </div>

          {/* Common: rows, row spacing, seat pitch */}
          <div className={styles.twoCol}>
            <div className={styles.field}>
              <label className={ui.help} htmlFor="wiz-rows">
                Rows
              </label>
              <input
                id="wiz-rows"
                className={ui.input}
                type="number"
                min={1}
                max={50}
                value={rowCount}
                onChange={(e) =>
                  setRowCount(Math.max(1, Number(e.target.value)))
                }
              />
            </div>
            <div className={styles.field}>
              <label className={ui.help} htmlFor="wiz-rsp">
                Row spacing (ft)
              </label>
              <input
                id="wiz-rsp"
                className={ui.input}
                type="number"
                min={1}
                step={0.5}
                value={rowSpacing}
                onChange={(e) =>
                  setRowSpacing(Math.max(0.5, Number(e.target.value)))
                }
              />
            </div>
            <div className={styles.field}>
              <label className={ui.help} htmlFor="wiz-pitch">
                Seat pitch (ft)
              </label>
              <input
                id="wiz-pitch"
                className={ui.input}
                type="number"
                min={0.5}
                step={0.25}
                value={seatPitch}
                onChange={(e) =>
                  setSeatPitch(Math.max(0.5, Number(e.target.value)))
                }
              />
            </div>
          </div>

          {/* Shape-specific params */}
          {(shape === "straight" || shape === "wing") && (
            <div className={styles.twoCol}>
              <div className={styles.field}>
                <label className={ui.help} htmlFor="wiz-spr">
                  Seats / row
                </label>
                <input
                  id="wiz-spr"
                  className={ui.input}
                  type="number"
                  min={1}
                  max={200}
                  value={seatsPerRow}
                  onChange={(e) =>
                    setSeatsPerRow(Math.max(1, Number(e.target.value)))
                  }
                />
              </div>
              {shape === "wing" && (
                <div className={styles.field}>
                  <label className={ui.help} htmlFor="wiz-rot">
                    Rotation (°)
                  </label>
                  <input
                    id="wiz-rot"
                    className={ui.input}
                    type="number"
                    step={1}
                    value={rotationDeg}
                    onChange={(e) => setRotationDeg(Number(e.target.value))}
                  />
                </div>
              )}
            </div>
          )}

          {shape === "arc" && (
            <div className={styles.twoCol}>
              <div className={styles.field}>
                <label className={ui.help} htmlFor="wiz-ir">
                  Inner radius (ft)
                </label>
                <input
                  id="wiz-ir"
                  className={ui.input}
                  type="number"
                  min={5}
                  step={1}
                  value={innerRadius}
                  onChange={(e) =>
                    setInnerRadius(Math.max(5, Number(e.target.value)))
                  }
                />
              </div>
              <div className={styles.field}>
                <label className={ui.help} htmlFor="wiz-span">
                  Arc span (°)
                </label>
                <input
                  id="wiz-span"
                  className={ui.input}
                  type="number"
                  min={10}
                  max={360}
                  step={5}
                  value={angularSpan}
                  onChange={(e) =>
                    setAngularSpan(
                      Math.max(10, Math.min(360, Number(e.target.value))),
                    )
                  }
                />
              </div>
              <div className={styles.field}>
                <label className={ui.help} htmlFor="wiz-ca">
                  Center angle (°)
                </label>
                <input
                  id="wiz-ca"
                  className={ui.input}
                  type="number"
                  step={5}
                  value={centerAngle}
                  onChange={(e) => setCenterAngle(Number(e.target.value))}
                />
                <span className={ui.help}>90° = audience below stage-top</span>
              </div>
              <div className={styles.field}>
                <label className={ui.help} htmlFor="wiz-msi">
                  Min seats (inner row)
                </label>
                <input
                  id="wiz-msi"
                  className={ui.input}
                  type="number"
                  min={1}
                  step={1}
                  value={minSeatsInner}
                  onChange={(e) =>
                    setMinSeatsInner(Math.max(1, Number(e.target.value)))
                  }
                />
              </div>
            </div>
          )}

          {/* Placement center */}
          <div className={styles.row}>
            <label className={ui.help}>
              Center position (ft from world origin — X, Y)
            </label>
            <div className={styles.twoCol}>
              <div className={styles.field}>
                <input
                  className={ui.input}
                  type="number"
                  step={1}
                  value={cx}
                  onChange={(e) => setCx(Number(e.target.value))}
                  placeholder="X (ft)"
                  aria-label="Center X (ft)"
                />
              </div>
              <div className={styles.field}>
                <input
                  className={ui.input}
                  type="number"
                  step={1}
                  value={cy}
                  onChange={(e) => setCy(Number(e.target.value))}
                  placeholder="Y (ft)"
                  aria-label="Center Y (ft)"
                />
              </div>
            </div>
          </div>

          {/* Seat count preview */}
          <div className={ui.help} style={{ color: "var(--text-muted)" }}>
            {shape === "arc" ? (
              <>
                Estimated seats:{" "}
                <strong style={{ color: "var(--text)" }}>
                  {Array.from({ length: rowCount }, (_, r) => {
                    const R = (innerRadius + r * rowSpacing) * gridSize;
                    const spanRad2 = (angularSpan * Math.PI) / 180;
                    const arcLen = R * spanRad2;
                    return Math.max(
                      minSeatsInner,
                      Math.round(arcLen / (seatPitch * gridSize)),
                    );
                  }).reduce((a, b) => a + b, 0)}
                </strong>
              </>
            ) : (
              <>
                Seats:{" "}
                <strong style={{ color: "var(--text)" }}>
                  {rowCount * seatsPerRow}
                </strong>
              </>
            )}
          </div>
        </div>

        <div className={styles.sheetFooter}>
          <button type="button" className={ui.chip} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            style={{
              background: "var(--primary)",
              color: "#fff",
              border: "none",
              borderRadius: "var(--radius-md)",
              padding: "9px 20px",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Generate section
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Verify:** `npx tsc --project TripleAMusic/tsconfig.json --noEmit 2>&1 | grep SectionWizard`

---

### Step 5: Create `SectionWizard.module.scss` — `TripleAMusic/src/components/SectionWizard.module.scss`

**Operation:** `CREATE_FILE`

**Code:**

```scss
/* ─── Backdrop ───────────────────────────────────────────────────── */
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 600;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: flex-end;
  justify-content: center;

  @media (min-width: 600px) {
    align-items: center;
  }
}

/* ─── Bottom sheet / centered modal ─────────────────────────────── */
.sheet {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 520px;
  max-height: 92vh;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  overflow: hidden;

  @media (min-width: 600px) {
    border-radius: var(--radius-lg);
    max-height: 85vh;
  }
}

.sheetHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--surface-2);
  flex-shrink: 0;
}

.sheetTitle {
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
}

.sheetClose {
  appearance: none;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-muted);
  font-size: 16px;
  padding: 4px 6px;
  border-radius: var(--radius-sm);
  line-height: 1;
  transition: color 0.12s;
  min-width: 44px;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    color: var(--text);
  }
  &:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
}

.sheetBody {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  -webkit-overflow-scrolling: touch;
}

.sheetFooter {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 12px 16px;
  border-top: 1px solid var(--border);
  background: var(--surface-2);
  flex-shrink: 0;
}

/* ─── Shape segmented control ────────────────────────────────────── */
.segmented {
  display: flex;
  gap: 2px;
  padding: 3px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  flex-wrap: wrap;
}

.segBtn {
  flex: 1 1 80px;
  height: 34px;
  min-height: 44px;
  border: none;
  border-radius: calc(var(--radius-md) - 2px);
  background: transparent;
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition:
    background-color 0.15s,
    color 0.15s;
  white-space: nowrap;

  &:hover {
    background: var(--surface-3);
    color: var(--text);
  }
  &:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 1px;
  }
  &[data-active="true"] {
    background: var(--surface-3);
    color: var(--text);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  }
}

/* ─── Field layout ───────────────────────────────────────────────── */
.row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.twoCol {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

@media (prefers-reduced-motion: reduce) {
  .segBtn {
    transition: none;
  }
}
```

**Verify:** File exists and imports cleanly.

---

### Step 6: Wire `SectionWizard` into `SeatLayoutEditorPage.tsx`

This step has three sub-changes:

#### 6a: Import the wizard

**Operation:** `INSERT_AFTER`

**Anchor:**

```
import styles from "./SeatLayoutEditorPage.module.scss";
```

**Code:**

```tsx
import { SectionWizard } from "../components/SectionWizard";
```

#### 6b: Add wizard open state near other modal states (after `confirmState` state declaration)

**Operation:** `INSERT_AFTER`

**Anchor:**

```
  const [confirmState, setConfirmState] = useState<{
    message: string;
    onConfirm: () => void;
  } | null>(null);
```

**Code:**

```tsx
const [wizardOpen, setWizardOpen] = useState(false);
```

#### 6c: Add "Add Section" button to the seating sections panel in the right panel, just before the existing "Add section seats" button group

The existing panel section that renders section generation starts at:

```
                  <div>
                    <div className={ui.help} style={{ marginBottom: 6 }}>
                      Sections
                    </div>
```

**Operation:** `INSERT_BEFORE` (insert the wizard button before the existing name/rows/seats-per-row inputs and "Add section seats" button)

**Anchor:**

```
                      <div style={{ display: "flex", gap: 8 }}>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={generateSection}
                        >
                          Add section seats
                        </Button>
                        <Button variant="ghost" size="sm" onClick={addSeat}>
                          Add one seat
                        </Button>
                      </div>
```

**Code:**

```tsx
                      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                        <button
                          type="button"
                          onClick={() => setWizardOpen(true)}
                          style={{
                            background: "var(--primary)",
                            color: "#fff",
                            border: "none",
                            borderRadius: "var(--radius-md)",
                            padding: "8px 14px",
                            fontWeight: 700,
                            fontSize: 13,
                            cursor: "pointer",
                            minHeight: 44,
                            flex: 1,
                          }}
                        >
                          ＋ Section Wizard
                        </button>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={generateSection}
                        >
                          Add section seats
                        </Button>
                        <Button variant="ghost" size="sm" onClick={addSeat}>
                          Add one seat
                        </Button>
                      </div>
```

#### 6d: Render `<SectionWizard>` near the `<ConfirmDialog>` (at the bottom of the JSX, just before the closing `</HostDashboardShell>`)

**Operation:** `INSERT_BEFORE`

**Anchor:**

```
      {confirmState ? (
        <ConfirmDialog
```

**Code:**

```tsx
<SectionWizard
  open={wizardOpen}
  onClose={() => setWizardOpen(false)}
  onGenerate={(generated) => {
    setSeats((prev) => {
      const existingIds = new Set(prev.map((p) => p.seatId));
      return [...prev, ...generated.filter((g) => !existingIds.has(g.seatId))];
    });
  }}
  gridSize={gridSize}
  activeFloorId={activeFloorId}
  snapToGrid={snapToGrid}
  sectionIndex={new Set(seats.map((s) => s.section).filter(Boolean)).size}
/>
```

**Verify:** `npx tsc --project TripleAMusic/tsconfig.json --noEmit 2>&1 | head -30`

---

### Step 7: Pre-built templates — add `rowPlan` to `RoomTemplate` and real seat generators

#### 7a: Add `rowPlan` field and a helper type to the `RoomTemplate` type

**Operation:** `REPLACE`

**Anchor:**

```
type RoomTemplate = {
  id: string;
  label: string;
  icon: string;
  description: string;
  roomWidth: number; // feet
  roomHeight: number; // feet
  stagePosition: "top" | "bottom" | "left" | "right";
  /** null means no auto-generated tables, just the room boundary */
  defaultPlan: {
    tableShape: "round" | "rect";
    tableDiameterFeet: number; // or width for rect
    tableHeightFeet: number; // rect only
    seatsPerTable: number;
    cols: number;
    rows: number;
    aisleWidthFeet: number;
    sectionName: string;
  } | null;
};
```

**Code:**

```tsx
type SectionBlockSpec = {
  type: "straight" | "arc" | "wing";
  sectionName: string;
  rowCount: number;
  seatsPerRow?: number;
  rowSpacingFt?: number;
  seatPitchFt?: number;
  // arc only
  innerRadiusFt?: number;
  angularSpanDeg?: number;
  centerAngleDeg?: number;
  minSeatsInner?: number;
  // wing only
  rotationDeg?: number;
  // placement center in feet from room top-left (0,0)
  cxFt: number;
  cyFt: number;
};

type RoomTemplate = {
  id: string;
  label: string;
  icon: string;
  description: string;
  roomWidth: number; // feet
  roomHeight: number; // feet
  stagePosition: "top" | "bottom" | "left" | "right";
  /** Table-based layout plan (banquet, dinner_show, club) */
  defaultPlan: {
    tableShape: "round" | "rect";
    tableDiameterFeet: number;
    tableHeightFeet: number;
    seatsPerTable: number;
    cols: number;
    rows: number;
    aisleWidthFeet: number;
    sectionName: string;
  } | null;
  /** Row-based layout specs (theater, arena, amphitheater, small_club) */
  rowPlan?: SectionBlockSpec[];
};
```

#### 7b: Add new templates and fill in `rowPlan` for theater, arena, outdoor (amphitheater), and add `small_club`

**Operation:** `REPLACE`

**Anchor:**

```
const ROOM_TEMPLATES: RoomTemplate[] = [
  {
    id: "banquet",
```

**Code:**

```tsx
const ROOM_TEMPLATES: RoomTemplate[] = [
  {
    id: "banquet",
```

> **Note:** Replace the full `ROOM_TEMPLATES` array. Below is the complete replacement including all templates. Replace from the `const ROOM_TEMPLATES: RoomTemplate[] = [` line through the closing `];`.

**Operation:** `REPLACE`

**Anchor:**

```
const ROOM_TEMPLATES: RoomTemplate[] = [
  {
    id: "banquet",
    label: "Banquet / Wedding",
    icon: "🍽️",
    description: "Round tables for a wedding or banquet hall",
    roomWidth: 60,
    roomHeight: 40,
    stagePosition: "top",
    defaultPlan: {
      tableShape: "round",
      tableDiameterFeet: 5,
      tableHeightFeet: 5,
      seatsPerTable: 8,
      cols: 4,
      rows: 3,
      aisleWidthFeet: 5,
      sectionName: "Main",
    },
  },
  {
    id: "dinner_show",
    label: "Dinner Show",
    icon: "🎭",
    description: "Rectangular tables facing a stage, cabaret style",
    roomWidth: 50,
    roomHeight: 35,
    stagePosition: "top",
    defaultPlan: {
      tableShape: "rect",
      tableDiameterFeet: 6,
      tableHeightFeet: 3,
      seatsPerTable: 6,
      cols: 3,
      rows: 4,
      aisleWidthFeet: 4,
      sectionName: "Main",
    },
  },
  {
    id: "theater",
    label: "Theater / Cinema",
    icon: "🎬",
    description: "Rows of seats facing a stage",
    roomWidth: 40,
    roomHeight: 30,
    stagePosition: "top",
    defaultPlan: null,
  },
  {
    id: "concert",
    label: "Concert / Standing",
    icon: "🎵",
    description: "General admission open floor facing stage",
    roomWidth: 80,
    roomHeight: 50,
    stagePosition: "top",
    defaultPlan: null,
  },
  {
    id: "club",
    label: "Nightclub / Lounge",
    icon: "🎶",
    description: "Intimate table layout around a dance floor",
    roomWidth: 40,
    roomHeight: 30,
    stagePosition: "bottom",
    defaultPlan: {
      tableShape: "round",
      tableDiameterFeet: 3,
      tableHeightFeet: 3,
      seatsPerTable: 4,
      cols: 4,
      rows: 3,
      aisleWidthFeet: 3,
      sectionName: "Lounge",
    },
  },
  {
    id: "outdoor",
    label: "Outdoor Stage",
    icon: "🌳",
    description: "Outdoor festival/amphitheater with mixed seating",
    roomWidth: 100,
    roomHeight: 60,
    stagePosition: "top",
    defaultPlan: null,
  },
];
```

**Code:**

```tsx
const ROOM_TEMPLATES: RoomTemplate[] = [
  {
    id: "banquet",
    label: "Banquet / Wedding",
    icon: "🍽️",
    description: "Round tables for a wedding or banquet hall",
    roomWidth: 60,
    roomHeight: 40,
    stagePosition: "top",
    defaultPlan: {
      tableShape: "round",
      tableDiameterFeet: 5,
      tableHeightFeet: 5,
      seatsPerTable: 8,
      cols: 4,
      rows: 3,
      aisleWidthFeet: 5,
      sectionName: "Main",
    },
  },
  {
    id: "dinner_show",
    label: "Dinner Show",
    icon: "🎭",
    description: "Rectangular tables facing a stage, cabaret style",
    roomWidth: 50,
    roomHeight: 35,
    stagePosition: "top",
    defaultPlan: {
      tableShape: "rect",
      tableDiameterFeet: 6,
      tableHeightFeet: 3,
      seatsPerTable: 6,
      cols: 3,
      rows: 4,
      aisleWidthFeet: 4,
      sectionName: "Main",
    },
  },
  {
    id: "theater",
    label: "Theater / Cinema",
    icon: "🎬",
    description: "Traditional proscenium: main + wing sections",
    roomWidth: 60,
    roomHeight: 45,
    stagePosition: "top",
    defaultPlan: null,
    rowPlan: [
      // Main orchestra: 8 rows × 14 seats, centered
      {
        type: "straight",
        sectionName: "Orchestra",
        rowCount: 8,
        seatsPerRow: 14,
        rowSpacingFt: 3,
        seatPitchFt: 2.5,
        cxFt: 30,
        cyFt: 23,
      },
      // Left wing: 6 rows × 6 seats, rotated 25° inward
      {
        type: "wing",
        sectionName: "Left Wing",
        rowCount: 6,
        seatsPerRow: 6,
        rowSpacingFt: 3,
        seatPitchFt: 2.5,
        rotationDeg: 25,
        cxFt: 8,
        cyFt: 22,
      },
      // Right wing: 6 rows × 6 seats, rotated -25°
      {
        type: "wing",
        sectionName: "Right Wing",
        rowCount: 6,
        seatsPerRow: 6,
        rowSpacingFt: 3,
        seatPitchFt: 2.5,
        rotationDeg: -25,
        cxFt: 52,
        cyFt: 22,
      },
    ],
  },
  {
    id: "arena",
    label: "Arena (¾ round)",
    icon: "🏟️",
    description: "Center stage with seating on three sides",
    roomWidth: 80,
    roomHeight: 65,
    stagePosition: "bottom",
    defaultPlan: null,
    rowPlan: [
      // Front center: 4 rows × 14 seats, straight, below center stage
      {
        type: "straight",
        sectionName: "Floor Center",
        rowCount: 4,
        seatsPerRow: 14,
        rowSpacingFt: 3,
        seatPitchFt: 2.5,
        cxFt: 40,
        cyFt: 46,
      },
      // Left bank: 8 rows × 8 seats, angled 45° toward center
      {
        type: "wing",
        sectionName: "Left Bank",
        rowCount: 8,
        seatsPerRow: 8,
        rowSpacingFt: 3,
        seatPitchFt: 2.5,
        rotationDeg: 45,
        cxFt: 14,
        cyFt: 36,
      },
      // Right bank: 8 rows × 8 seats, angled -45°
      {
        type: "wing",
        sectionName: "Right Bank",
        rowCount: 8,
        seatsPerRow: 8,
        rowSpacingFt: 3,
        seatPitchFt: 2.5,
        rotationDeg: -45,
        cxFt: 66,
        cyFt: 36,
      },
      // Rear bank: 8 rows × 12 seats, rotated 180° (facing stage at bottom)
      {
        type: "wing",
        sectionName: "Rear Bank",
        rowCount: 8,
        seatsPerRow: 12,
        rowSpacingFt: 3,
        seatPitchFt: 2.5,
        rotationDeg: 180,
        cxFt: 40,
        cyFt: 13,
      },
    ],
  },
  {
    id: "concert",
    label: "Concert / Standing",
    icon: "🎵",
    description: "General admission open floor facing stage",
    roomWidth: 80,
    roomHeight: 50,
    stagePosition: "top",
    defaultPlan: null,
    // No rowPlan: GA standing — no seats generated
  },
  {
    id: "club",
    label: "Nightclub / Lounge",
    icon: "🎶",
    description: "Intimate table layout around a dance floor",
    roomWidth: 40,
    roomHeight: 30,
    stagePosition: "bottom",
    defaultPlan: {
      tableShape: "round",
      tableDiameterFeet: 3,
      tableHeightFeet: 3,
      seatsPerTable: 4,
      cols: 4,
      rows: 3,
      aisleWidthFeet: 3,
      sectionName: "Lounge",
    },
  },
  {
    id: "amphitheater",
    label: "Amphitheater",
    icon: "🏛️",
    description: "10 arc rows fanning 180° around a center stage",
    roomWidth: 100,
    roomHeight: 70,
    stagePosition: "bottom",
    defaultPlan: null,
    rowPlan: [
      {
        type: "arc",
        sectionName: "Amphitheater",
        rowCount: 10,
        minSeatsInner: 12,
        innerRadiusFt: 30,
        rowSpacingFt: 4,
        seatPitchFt: 2.5,
        angularSpanDeg: 180,
        centerAngleDeg: 270, // arc opens upward (stage at bottom, audience above)
        cxFt: 50,
        cyFt: 60,
      },
    ],
  },
  {
    id: "small_club",
    label: "Small Club",
    icon: "🎸",
    description: "Intimate 5-row venue, 40 seats",
    roomWidth: 20,
    roomHeight: 15,
    stagePosition: "top",
    defaultPlan: null,
    rowPlan: [
      {
        type: "straight",
        sectionName: "Main",
        rowCount: 5,
        seatsPerRow: 8,
        rowSpacingFt: 2.5,
        seatPitchFt: 2,
        cxFt: 10,
        cyFt: 9,
      },
    ],
  },
  {
    id: "outdoor",
    label: "Outdoor Stage",
    icon: "🌳",
    description: "Outdoor festival/amphitheater with mixed seating",
    roomWidth: 100,
    roomHeight: 60,
    stagePosition: "top",
    defaultPlan: null,
  },
];
```

#### 7c: Add `applyRowPlan()` function and call it from `applyRoomTemplate()`

Add `applyRowPlan` just before `applyRoomTemplate`. Import the geometry helpers inline (copy of functions from SectionWizard but operating on `EditableSeat`, not `WizardSeat`).

**Operation:** `INSERT_BEFORE`

**Anchor:**

```
  function applyRoomTemplate(templateId: string) {
    const tpl = ROOM_TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return;
```

**Code:**

```tsx
  // ─── Row-plan geometry helpers (same math as SectionWizard) ─────────────

  function _tplToRowName(idx: number): string {
    const base = 26;
    let n = idx;
    let s = "";
    while (n >= 0) {
      s = String.fromCharCode(65 + (n % base)) + s;
      n = Math.floor(n / base) - 1;
    }
    return s;
  }

  function _applyBlockSpec(spec: SectionBlockSpec, floorId: string): EditableSeat[] {
    const pitchPx = (spec.seatPitchFt ?? 2.5) * gridSize;
    const rowSpacePx = (spec.rowSpacingFt ?? 3) * gridSize;
    const seatsPerRow = spec.seatsPerRow ?? 10;
    const ts = Date.now() + Math.round(Math.random() * 1000);
    const cx = spec.cxFt * gridSize;
    const cy = spec.cyFt * gridSize;
    const seats: EditableSeat[] = [];

    if (spec.type === "straight" || spec.type === "wing") {
      const blockW = (seatsPerRow - 1) * pitchPx;
      const blockH = (spec.rowCount - 1) * rowSpacePx;
      const originX = cx - blockW / 2;
      const originY = cy - blockH / 2;
      const angleRad = ((spec.rotationDeg ?? 0) * Math.PI) / 180;
      const cosA = Math.cos(angleRad);
      const sinA = Math.sin(angleRad);

      for (let r = 0; r < spec.rowCount; r++) {
        const rowLetter = _tplToRowName(r);
        const rowGroupId = `tpl-${spec.sectionName}-${ts}-r${r}`.replace(/\s+/g, "-");
        for (let s = 0; s < seatsPerRow; s++) {
          const rawX = originX + s * pitchPx;
          const rawY = originY + r * rowSpacePx;
          const dx = rawX - cx;
          const dy = rawY - cy;
          const finalX = snap(cx + cosA * dx - sinA * dy, gridSize);
          const finalY = snap(cy + sinA * dx + cosA * dy, gridSize);
          const seatId = `${floorId}-${spec.sectionName}-${rowLetter}-${s + 1}-${ts}`.replace(/\s+/g, "-");
          seats.push({
            seatId,
            section: spec.sectionName,
            floorId,
            row: rowLetter,
            seatNumber: String(s + 1),
            posX: finalX,
            posY: finalY,
            isAvailable: true,
            rotationDeg: spec.rotationDeg ?? 0,
            rowGroupId,
          });
        }
      }
    } else {
      // arc
      const innerRadiusPx = (spec.innerRadiusFt ?? 30) * gridSize;
      const arcRowSpacePx = (spec.rowSpacingFt ?? 4) * gridSize;
      const spanRad = ((spec.angularSpanDeg ?? 180) * Math.PI) / 180;
      const startAngleRad = (((spec.centerAngleDeg ?? 270) - (spec.angularSpanDeg ?? 180) / 2) * Math.PI) / 180;
      const minSeatsInner = spec.minSeatsInner ?? 10;

      for (let r = 0; r < spec.rowCount; r++) {
        const R = innerRadiusPx + r * arcRowSpacePx;
        const arcLength = R * spanRad;
        const seatsInRow = Math.max(minSeatsInner, Math.round(arcLength / pitchPx));
        const rowLetter = _tplToRowName(r);
        const rowGroupId = `tpl-arc-${spec.sectionName}-${ts}-r${r}`.replace(/\s+/g, "-");

        for (let s = 0; s < seatsInRow; s++) {
          const angle = startAngleRad + s * (spanRad / Math.max(seatsInRow - 1, 1));
          const px = snap(cx + R * Math.cos(angle), gridSize);
          const py = snap(cy + R * Math.sin(angle), gridSize);
          const facingAngleDeg = (angle * 180) / Math.PI + 90;
          const seatId = `${floorId}-${spec.sectionName}-${rowLetter}-${s + 1}-${ts}`.replace(/\s+/g, "-");
          seats.push({
            seatId,
            section: spec.sectionName,
            floorId,
            row: rowLetter,
            seatNumber: String(s + 1),
            posX: px,
            posY: py,
            isAvailable: true,
            rotationDeg: facingAngleDeg,
            rowGroupId,
          });
        }
      }
    }
    return seats;
  }

  function applyRoomTemplate(templateId: string) {
    const tpl = ROOM_TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return;
```

> **Note:** After the above insert, also update the `applyRoomTemplate` function body so it calls `_applyBlockSpec` for `rowPlan` templates. The existing function ends with `if (tpl.defaultPlan) { generateSmartPlan({...}) }`. Add an `else if (tpl.rowPlan)` branch.

**Operation:** `REPLACE`

**Anchor:**

```
    if (tpl.defaultPlan) {
      generateSmartPlan({
        tableShape: tpl.defaultPlan.tableShape,
        tableDiameterFeet: tpl.defaultPlan.tableDiameterFeet,
        tableHeightFeet: tpl.defaultPlan.tableHeightFeet,
        seatsPerTable: tpl.defaultPlan.seatsPerTable,
        cols: tpl.defaultPlan.cols,
        rows: tpl.defaultPlan.rows,
        aisleWidthFeet: tpl.defaultPlan.aisleWidthFeet,
        roomWidthFeet: tpl.roomWidth,
        roomHeightFeet: tpl.roomHeight,
        sectionName: tpl.defaultPlan.sectionName,
      });
    }
  }
```

**Code:**

```tsx
    if (tpl.defaultPlan) {
      generateSmartPlan({
        tableShape: tpl.defaultPlan.tableShape,
        tableDiameterFeet: tpl.defaultPlan.tableDiameterFeet,
        tableHeightFeet: tpl.defaultPlan.tableHeightFeet,
        seatsPerTable: tpl.defaultPlan.seatsPerTable,
        cols: tpl.defaultPlan.cols,
        rows: tpl.defaultPlan.rows,
        aisleWidthFeet: tpl.defaultPlan.aisleWidthFeet,
        roomWidthFeet: tpl.roomWidth,
        roomHeightFeet: tpl.roomHeight,
        sectionName: tpl.defaultPlan.sectionName,
      });
    } else if (tpl.rowPlan && tpl.rowPlan.length > 0) {
      const floorId = activeFloorId ?? floors[0]?.floorId ?? "floor-1";
      const doGenerate = () => {
        const allGenerated: EditableSeat[] = [];
        for (const spec of tpl.rowPlan!) {
          allGenerated.push(..._applyBlockSpec(spec, floorId));
        }
        setSeats((prev) => {
          const existingIds = new Set(prev.map((p) => p.seatId));
          return [...prev, ...allGenerated.filter((g) => !existingIds.has(g.seatId))];
        });
      };

      const hasExistingSeats = seats.filter((s) => (s.floorId || floorId) === floorId).length > 0;
      if (hasExistingSeats) {
        confirmThen(
          `Apply "${tpl.label}" template? This will add ${tpl.rowPlan.reduce((n, s) => n + (s.seatsPerRow ?? 10) * s.rowCount, 0)}+ seats to the current floor without removing existing content.`,
          doGenerate,
        );
      } else {
        doGenerate();
      }
    }
  }
```

**Verify:** `npx tsc --project TripleAMusic/tsconfig.json --noEmit 2>&1 | head -30`

---

### Step 8: Floating Action Button (FAB) — mobile touch shortcut

#### 8a: Add FAB state and wire Section Wizard open from FAB

**Operation:** `INSERT_AFTER` (after `const [wizardOpen, setWizardOpen] = useState(false);`)

**Anchor:**

```
  const [wizardOpen, setWizardOpen] = useState(false);
```

**Code:**

```tsx
const [fabOpen, setFabOpen] = useState(false);
```

#### 8b: Add FAB markup inside the viewport card, just before the closing `</div>` of `.viewportCard`

Find the closing tag of `.viewportCard`. It comes just before `{/* seatInspector moved to sidePanel */}` comment block. Insert FAB after the hint pill, inside the viewport section.

**Operation:** `INSERT_BEFORE`

**Anchor:**

```
            {/* seatInspector moved to sidePanel */}
          </div>

          {/* ── Right panel: always-visible settings / inspector ── */}
```

**Code:**

```tsx
{
  /* ── Mobile FAB ── */
}
<div className={styles.fabWrap}>
  {fabOpen && (
    <div className={styles.fabMenu}>
      <button
        type="button"
        className={styles.fabMenuItem}
        onClick={() => {
          setFabOpen(false);
          setWizardOpen(true);
        }}
      >
        ＋ Add Section
      </button>
      <button
        type="button"
        className={styles.fabMenuItem}
        onClick={() => {
          setFabOpen(false);
          addPresetElement("table");
        }}
      >
        🪑 Add Table
      </button>
      <button
        type="button"
        className={styles.fabMenuItem}
        onClick={() => {
          setFabOpen(false);
          setTool("aisle");
          const id = `aisle-${Date.now()}`;
          setElements((prev) => [
            ...prev,
            {
              elementId: id,
              type: "aisle" as const,
              floorId: activeFloorId,
              orientation: "horizontal" as const,
              x: 0,
              y: 0,
              length: 8 * gridSize,
              thickness: Math.round(gridSize / 3),
            },
          ]);
        }}
      >
        ═ Add Aisle
      </button>
      <button
        type="button"
        className={styles.fabMenuItem}
        onClick={() => {
          setFabOpen(false);
          setToolsOpen((o) => !o);
        }}
      >
        ⚙ Settings
      </button>
    </div>
  )}
  <button
    type="button"
    className={styles.fab}
    aria-label={fabOpen ? "Close quick actions" : "Quick actions"}
    aria-expanded={fabOpen}
    onClick={() => setFabOpen((o) => !o)}
  >
    {fabOpen ? "✕" : "＋"}
  </button>
</div>;
```

#### 8c: Add FAB / bottom-sheet styles to `SeatLayoutEditorPage.module.scss`

**Operation:** `INSERT_AFTER` (at the end of the file, after the `@media (prefers-reduced-motion)` block)

**Anchor:**

```
@media (prefers-reduced-motion: reduce) {
  .seat,
  .floorTab,
  .toolBtn,
  .toggle,
  .stageWorld,
  .aisle,
  .elementTable,
  .elementRailing,
  .aiAnalyzeBtn,
  .aiSuggestionCard,
  .aiApplySmall,
  .aiRejectSmall {
    transition: none;
  }
}
```

**Code:**

```scss
@media (prefers-reduced-motion: reduce) {
  .seat,
  .floorTab,
  .toolBtn,
  .toggle,
  .stageWorld,
  .aisle,
  .elementTable,
  .elementRailing,
  .aiAnalyzeBtn,
  .aiSuggestionCard,
  .aiApplySmall,
  .aiRejectSmall {
    transition: none;
  }
}

/* ─── Floating Action Button (mobile only) ────────────────────────── */
.fabWrap {
  position: absolute;
  bottom: 16px;
  right: 16px;
  z-index: 200;
  display: flex;
  flex-direction: column-reverse;
  align-items: flex-end;
  gap: 8px;

  /* Show only on mobile (< 768px) */
  @media (min-width: 768px) {
    display: none;
  }
}

.fab {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: var(--primary);
  color: #fff;
  border: none;
  font-size: 22px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.22);
  transition:
    background-color 0.15s,
    transform 0.15s;
  flex-shrink: 0;

  &:hover {
    background: color-mix(in srgb, var(--primary) 85%, #000);
  }
  &:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  &:active {
    transform: scale(0.94);
  }
}

.fabMenu {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-end;
}

.fabMenuItem {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 44px;
  padding: 0 16px;
  border: none;
  border-radius: var(--radius-md);
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  white-space: nowrap;
  transition: background-color 0.12s;

  &:hover {
    background: var(--surface-2);
  }
  &:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
}

/* ─── Mobile bottom sheet for side panel ─────────────────────────── */
@media (max-width: 767px) {
  .sidePanel[data-open="true"] {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    top: auto;
    height: 70vh;
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    border: 1px solid var(--border);
    border-bottom: none;
    z-index: 500;
    box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.18);
    overscroll-behavior: contain;
  }
}
```

> **Note:** The existing `@media (max-width: 960px)` rule hides `.sidePanel` and shows it only when `data-open="true"`. The new `@media (max-width: 767px)` rule overrides the display to use a bottom sheet layout. Both rules coexist; the 767 rule fires inside the 960 range with more specific positioning.

**Verify:** Open editor on mobile viewport; FAB should appear in bottom-right.

---

### Step 9: Tap-tap row mode (touch alternative to drag-draw)

The current row tool requires a continuous pointer drag. Add a state machine that lets users tap a start point and then tap an end point on mobile.

**Operation:** `INSERT_AFTER`

**Anchor:**

```
  const [rowDraft, setRowDraft] = useState<{
    start: { x: number; y: number };
    end: { x: number; y: number };
    floorId: string;
  } | null>(null);
```

**Code:**

```tsx
// Tap-tap row mode: null = idle, 'waiting_end' = start placed, waiting for second tap
const [tapRowStart, setTapRowStart] = useState<{
  x: number;
  y: number;
  floorId: string;
} | null>(null);
```

Then update `handleViewportPointerDown` where the row tool click-drag starts. After the existing row-drag block, add a tap-tap branch that triggers when the pointer is a touch (pointerType === 'touch') and the distance moved is negligible:

**Operation:** `REPLACE`

**Anchor:**

```
    // Row draw: click-drag in empty space to lay out a row path.
    if (tool === "row") {
      const world = screenToWorld(e);
      if (!world) return;
      const snapped =
        snapToGrid && !e.altKey
          ? { x: snap(world.x, gridSize), y: snap(world.y, gridSize) }
          : world;
      setRowDraft({ start: snapped, end: snapped, floorId: activeFloorId });
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }
```

**Code:**

```tsx
// Row draw: drag on desktop; tap-start then tap-end on touch.
if (tool === "row") {
  const world = screenToWorld(e);
  if (!world) return;
  const snapped =
    snapToGrid && !e.altKey
      ? { x: snap(world.x, gridSize), y: snap(world.y, gridSize) }
      : world;

  // Touch tap-tap mode
  if (e.pointerType === "touch") {
    if (!tapRowStart) {
      setTapRowStart({ ...snapped, floorId: activeFloorId });
      setRowDraft({ start: snapped, end: snapped, floorId: activeFloorId });
    } else {
      // Second tap: generate the row
      generateRowFromDraft({
        start: tapRowStart,
        end: snapped,
        floorId: tapRowStart.floorId,
      });
      setTapRowStart(null);
      setRowDraft(null);
    }
    return;
  }

  // Mouse/pen: drag mode (existing)
  setRowDraft({ start: snapped, end: snapped, floorId: activeFloorId });
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  return;
}
```

**Verify:** On a touch device, tapping once shows the row draft line; tapping a second point generates the row.

---

### Step 10: Single-finger pan on touch (no-tool mode)

Currently panning requires space-bar or the pan tool. On mobile, single-finger drag should pan when the select tool is active and no seat is being dragged.

**Operation:** `REPLACE`

**Anchor:**

```
    if (!(tool === "pan" || spaceDownRef.current)) return;

    panStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startOffsetX: view.offsetX,
      startOffsetY: view.offsetY,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
```

**Code:**

```tsx
    // Allow single-finger pan on touch when no drag is in progress
    const isTouchPan =
      e.pointerType === "touch" &&
      tool === "select" &&
      !dragSeatIdRef.current &&
      !dragRowRef.current;

    if (!(tool === "pan" || spaceDownRef.current || isTouchPan)) return;

    panStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startOffsetX: view.offsetX,
      startOffsetY: view.offsetY,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
```

**Verify:** On touch, single-finger drag pans the canvas when no seat is in motion.

---

### Step 11: Minimum tap-target enforcement in toolbar CSS — `SeatLayoutEditorPage.module.scss`

The `.toolBtn` height is currently 28px — below the 44px minimum for touch. Add a mobile override:

**Operation:** `INSERT_AFTER`

**Anchor:**

```
.toolBtn:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 1px;
}
```

**Code:**

```scss
.toolBtn:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 1px;
}

@media (max-width: 767px) {
  .toolBtn {
    min-height: 44px;
    height: auto;
    padding: 0 12px;
    font-size: 14px;
  }

  .floorTab {
    min-height: 44px;
    height: auto;
    padding: 0 14px;
    font-size: 13px;
  }
}
```

---

### Step 12: Export / Preview modal

#### 12a: Add state for the export modal

**Operation:** `INSERT_AFTER`

**Anchor:**

```
  const [fabOpen, setFabOpen] = useState(false);
```

**Code:**

```tsx
const [exportOpen, setExportOpen] = useState(false);
const [exportJsonCopied, setExportJsonCopied] = useState(false);
```

#### 12b: Add an "Export / Preview" button in the toolbar (right tool group)

Find the right-tools group in the toolbar. It currently just has the panel toggle. Add the export button before the panel-toggle.

**Operation:** `REPLACE`

**Anchor:**

```
          {/* Right tool group */}
          <div className={styles.toolsRight}>
```

**Code:**

```tsx
          {/* Right tool group */}
          <div className={styles.toolsRight}>
            <button
              type="button"
              className={styles.toolBtn}
              onClick={() => setExportOpen(true)}
              title="Export / Preview layout"
              aria-label="Export and preview layout"
            >
              <span className={styles.toolIcon}>⬡</span>
              <span className={styles.toolLabel}>Preview</span>
            </button>
```

> **Note:** Also ensure the closing `</div>` of `.toolsRight` is present after the existing panel-toggle button. Insert the new button _just inside_ the opening `<div className={styles.toolsRight}>` before whatever was already first inside it.

#### 12c: Render the Export modal in the JSX, just alongside the SectionWizard

**Operation:** `INSERT_AFTER`

**Anchor:**

```
      <SectionWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onGenerate={(generated) => {
          setSeats((prev) => {
            const existingIds = new Set(prev.map((p) => p.seatId));
            return [...prev, ...generated.filter((g) => !existingIds.has(g.seatId))];
          });
        }}
        gridSize={gridSize}
        activeFloorId={activeFloorId}
        snapToGrid={snapToGrid}
        sectionIndex={
          new Set(seats.map((s) => s.section).filter(Boolean)).size
        }
      />
```

**Code:**

```tsx
{
  exportOpen && (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 700,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Export and preview layout"
      onClick={(e) => {
        if (e.target === e.currentTarget) setExportOpen(false);
      }}
    >
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          width: "min(860px, 96vw)",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            borderBottom: "1px solid var(--border)",
            background: "var(--surface-2)",
            flexShrink: 0,
          }}
        >
          <span style={{ fontWeight: 700, fontSize: 14 }}>
            Preview & Export
          </span>
          <button
            type="button"
            onClick={() => setExportOpen(false)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted)",
              fontSize: 16,
              minWidth: 44,
              minHeight: 44,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            aria-label="Close preview"
          >
            ✕
          </button>
        </div>

        {/* Two-pane body */}
        <div
          style={{
            flex: 1,
            overflow: "auto",
            display: "grid",
            gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)",
            gap: 0,
          }}
        >
          {/* Live SeatSelector preview */}
          <div
            style={{
              borderRight: "1px solid var(--border)",
              padding: 16,
              overflow: "auto",
            }}
          >
            <div className={ui.help} style={{ marginBottom: 8 }}>
              Customer view
            </div>
            <SeatSelectorPreview seats={seats} stagePosition={stagePosition} />
          </div>

          {/* JSON export */}
          <div style={{ padding: 16, overflow: "auto" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 8,
              }}
            >
              <span className={ui.help}>Raw JSON</span>
              <button
                type="button"
                className={ui.chip}
                style={{ marginLeft: "auto", cursor: "pointer" }}
                onClick={() => {
                  const json = JSON.stringify(
                    {
                      name,
                      stagePosition,
                      seats: seats.map(({ isSold: _s, ...rest }) => rest),
                      sections: computeSectionsFromSeats(seats),
                      elements,
                      stage,
                      floors,
                      roomBoundary,
                    },
                    null,
                    2,
                  );
                  navigator.clipboard.writeText(json).then(() => {
                    setExportJsonCopied(true);
                    setTimeout(() => setExportJsonCopied(false), 2000);
                  });
                }}
              >
                {exportJsonCopied ? "✓ Copied!" : "Copy JSON"}
              </button>
            </div>
            <pre
              style={{
                fontSize: 11,
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                padding: 10,
                overflow: "auto",
                maxHeight: 420,
                color: "var(--text-muted)",
                whiteSpace: "pre",
                margin: 0,
              }}
            >
              {JSON.stringify(
                {
                  name,
                  stagePosition,
                  totalSeats: seats.length,
                  sections: computeSectionsFromSeats(seats).map((s) => ({
                    name: s.name,
                    rows: s.rows.length,
                    seats: s.seatsPerRow.reduce((a, b) => a + b, 0),
                  })),
                },
                null,
                2,
              )}
            </pre>
          </div>
        </div>

        {/* Footer CTAs */}
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            justifyContent: "flex-end",
            padding: "12px 16px",
            borderTop: "1px solid var(--border)",
            background: "var(--surface-2)",
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            className={ui.chip}
            onClick={() => {
              setExportOpen(false);
              void handleSave();
            }}
          >
            Save layout
          </button>
          <button
            type="button"
            onClick={() => {
              setExportOpen(false);
              void handleSave();
              navigate(
                `/venues/${encodeURIComponent(locationId || "")}/seating`,
              );
            }}
            style={{
              background: "var(--primary)",
              color: "#fff",
              border: "none",
              borderRadius: "var(--radius-md)",
              padding: "9px 18px",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Save & Return to Venue
          </button>
        </div>
      </div>
    </div>
  );
}
```

#### 12d: Add the `SeatSelectorPreview` helper component at the top of `SeatLayoutEditorPage.tsx` (after the imports block, before `export function SeatLayoutEditorPage()`)

This is a thin wrapper that adapts editor `EditableSeat[]` → `SeatInfo[]` and renders `<SeatSelector>` in preview mode (all seats available, no selection, spatial is optional).

**Operation:** `INSERT_BEFORE`

**Anchor:**

```
export function SeatLayoutEditorPage() {
```

**Code:**

```tsx
// ─── Preview adapter ─────────────────────────────────────────────────────────
// Dynamically import SeatSelector to avoid circular deps;
// fall back to a count badge if the import fails.
import SeatSelector from "@shared/components/SeatSelector/SeatSelector";

function SeatSelectorPreview({
  seats,
  stagePosition,
}: {
  seats: EditableSeat[];
  stagePosition: StagePosition;
}) {
  const seatInfos = seats.map((s) => ({
    seatId: s.seatId,
    row: s.row,
    seatNumber: s.seatNumber,
    section: s.section || "Main",
    posX: s.posX,
    posY: s.posY,
    isAvailable: true as const,
    tierId: s.tierId,
    rotationDeg: s.rotationDeg,
  }));

  const sections = Array.from(
    new Set(seats.map((s) => s.section || "Main")),
  ).map((name, i) => ({ sectionId: `s${i}`, name }));

  return (
    <SeatSelector
      seats={seatInfos}
      sections={sections}
      tiers={[]}
      stagePosition={stagePosition}
      selectedSeats={[]}
      maxSeats={0}
      onSelectionChange={() => undefined}
    />
  );
}
```

**Verify:** `npx tsc --project TripleAMusic/tsconfig.json --noEmit 2>&1 | head -30`

---

### Step 13: SeatSelector — spatial view mode + rotation + touch pan/zoom

The current `SeatSelector` renders list-mode only. We need to add:

1. A `spatialView` mode (when `posX`/`posY` are present) with an absolute-positioned canvas
2. `rotationDeg` applied to seats in spatial mode
3. Pointer-event pan + pinch-zoom on the spatial canvas
4. "Select by section" buttons with seat count badges

All of these changes are in `packages/shared/src/components/SeatSelector/SeatSelector.tsx`.

**Operation:** `REPLACE` (full component replacement)

**Anchor:**

```
import { useMemo, useState } from "react";
import styles from "./SeatSelector.module.scss";
import ui from "@shared/styles/primitives.module.scss";
```

**Code:**

```tsx
import { useMemo, useRef, useState } from "react";
import styles from "./SeatSelector.module.scss";
import ui from "@shared/styles/primitives.module.scss";
```

Then add the pan/zoom state and pointer handler hooks. Due to the size of this component, the exact replacement is described below — replace the full component function body:

Replace from `export default function SeatSelector({` through the closing `}` of the component export.

This replacement adds:

1. `spatialView` computation: `true` when ≥50% of seats have `posX`/`posY`
2. `viewState` (scale, offsetX, offsetY) + pointer handlers (identical pattern to the editor's pan logic)
3. In spatial-view render: absolute-positioned `.spatialCanvas` with `.spatialWorld` containing each seat at `translate(posX, posY) translate(-50%,-50%) rotate(rotationDeg)`
4. In list-view render: existing render unchanged
5. Section filter buttons row with seat count badges
6. "Select all available in section" on section header click

**Operation:** `REPLACE`

**Anchor:**

```
export default function SeatSelector({
  seats,
  sections,
  tiers,
  stagePosition = "top",
  selectedSeats,
  inCartSeats = [],
  maxSeats,
  onSelectionChange,
}: SeatSelectorProps) {
  const [hoveredSeat, setHoveredSeat] = useState<string | null>(null);
```

**Code:**

```tsx
export default function SeatSelector({
  seats,
  sections,
  tiers,
  stagePosition = "top",
  selectedSeats,
  inCartSeats = [],
  maxSeats,
  onSelectionChange,
}: SeatSelectorProps) {
  const [hoveredSeat, setHoveredSeat] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  // ── Spatial view detection ──────────────────────────────────────────────
  const isSpatial = useMemo(() => {
    const withPos = seats.filter(
      (s) => typeof s.posX === "number" && typeof s.posY === "number",
    );
    return withPos.length >= Math.ceil(seats.length * 0.5) && seats.length > 0;
  }, [seats]);

  // ── Spatial view pan/zoom state ─────────────────────────────────────────
  const [spatialView, setSpatialView] = useState({ scale: 1, offsetX: 150, offsetY: 80 });
  const spatialRef = useRef<HTMLDivElement>(null);
  const panStartRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const pinchRef = useRef<{ dist: number; scale: number } | null>(null);

  function onSpatialPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    panStartRef.current = { x: e.clientX, y: e.clientY, ox: spatialView.offsetX, oy: spatialView.offsetY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onSpatialPointerMove(e: React.PointerEvent) {
    if (!panStartRef.current) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    setSpatialView((v) => ({ ...v, offsetX: panStartRef.current!.ox + dx, offsetY: panStartRef.current!.oy + dy }));
  }

  function onSpatialPointerUp() { panStartRef.current = null; pinchRef.current = null; }

  function onSpatialWheel(e: React.WheelEvent) {
    e.stopPropagation();
    const factor = e.deltaY < 0 ? 1.1 : 0.91;
    setSpatialView((v) => {
      const newScale = Math.max(0.2, Math.min(5, v.scale * factor));
      return { ...v, scale: newScale };
    });
  }
```

**Verify:** `npx tsc --project packages/shared/tsconfig.json --noEmit 2>&1 | head -20`

> **Note for implementor:** After the pan/zoom state, keep all the existing `useMemo` hooks (`seatsBySection`, `tierById`, `sectionByName`, `handleSeatClick`, `getSeatStatus`, etc.) unchanged. Then add the spatial render branch in the `return`:

In the return statement, before `{/* Stage indicator */}`, add a section filter row:

```tsx
{
  /* Section filter chips */
}
{
  sections.length > 1 && (
    <div className={styles.sectionFilters}>
      <button
        type="button"
        className={styles.sectionFilterChip}
        data-active={activeSection === null}
        onClick={() => setActiveSection(null)}
      >
        All sections
      </button>
      {sections.map((sec) => {
        const count = seats.filter(
          (s) => s.section === sec.name && s.isAvailable && !s.isSold,
        ).length;
        return (
          <button
            key={sec.sectionId}
            type="button"
            className={styles.sectionFilterChip}
            data-active={activeSection === sec.name}
            onClick={() =>
              setActiveSection((prev) => (prev === sec.name ? null : sec.name))
            }
          >
            {sec.name}
            <span className={styles.sectionBadge}>{count}</span>
          </button>
        );
      })}
    </div>
  );
}
```

And add the spatial canvas branch inside `.chart`:

```tsx
{
  isSpatial ? (
    <div
      ref={spatialRef}
      className={styles.spatialCanvas}
      onPointerDown={onSpatialPointerDown}
      onPointerMove={onSpatialPointerMove}
      onPointerUp={onSpatialPointerUp}
      onPointerCancel={onSpatialPointerUp}
      onWheel={onSpatialWheel}
      style={{ touchAction: "none" }}
    >
      <div
        className={styles.spatialWorld}
        style={{
          transform: `translate(${spatialView.offsetX}px, ${spatialView.offsetY}px) scale(${spatialView.scale})`,
        }}
      >
        {filteredSeats.map((seat) => {
          const x = seat.posX ?? 0;
          const y = seat.posY ?? 0;
          const rotDeg = seat.rotationDeg ?? 0;
          const status = getSeatStatus(seat);
          return (
            <button
              key={seat.seatId}
              className={styles.spatialSeat}
              data-status={status}
              style={{
                transform: `translate(${x}px, ${y}px) translate(-50%,-50%) rotate(${rotDeg}deg)`,
              }}
              onClick={() => handleSeatClick(seat)}
              onPointerEnter={() => setHoveredSeat(seat.seatId)}
              onPointerLeave={() => setHoveredSeat(null)}
              disabled={status === "sold" || status === "unavailable"}
              title={`${seat.section} ${seat.row}${seat.seatNumber}`}
            >
              {seat.seatNumber}
            </button>
          );
        })}
      </div>
    </div>
  ) : (
    /* existing list-mode chart */
    <div className={styles.chart}>
      {/* ...existing section/row/seat render... */}
    </div>
  );
}
```

Where `filteredSeats` is:

```tsx
const filteredSeats = useMemo(
  () =>
    activeSection ? seats.filter((s) => s.section === activeSection) : seats,
  [seats, activeSection],
);
```

---

### Step 14: Add spatial CSS to `SeatSelector.module.scss`

**Operation:** `INSERT_AFTER` (at end of file, after the existing `.tooltip` block)

**Anchor:**

```
.tooltip {
  position: fixed;
  bottom: 100px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 100;
  pointer-events: none;
}
```

**Code:**

```scss
.tooltip {
  position: fixed;
  bottom: 100px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 100;
  pointer-events: none;
}

/* ─── Section filter chips ───────────────────────────────────────── */
.sectionFilters {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
}

.sectionFilterChip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  min-height: 44px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface-2);
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition:
    background-color 0.15s,
    border-color 0.15s,
    color 0.15s;

  &:hover {
    background: var(--surface-3);
    color: var(--text);
    border-color: var(--border-strong, var(--border));
  }
  &:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }

  &[data-active="true"] {
    background: var(--primary);
    color: #fff;
    border-color: var(--primary);
  }
}

.sectionBadge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  background: rgba(255, 255, 255, 0.25);
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
}

/* ─── Spatial canvas ─────────────────────────────────────────────── */
.spatialCanvas {
  position: relative;
  height: min(65vh, 520px);
  overflow: hidden;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  cursor: grab;
  touch-action: none;
  overscroll-behavior: contain;

  &:active {
    cursor: grabbing;
  }
}

.spatialWorld {
  position: absolute;
  inset: 0;
  transform-origin: 0 0;
}

.spatialSeat {
  position: absolute;
  width: 22px;
  height: 22px;
  border-radius: 3px;
  font-size: 9px;
  font-weight: 700;
  color: white;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: filter 0.1s;

  &[data-status="available"] {
    background: var(--success) !important;
  }
  &[data-status="in-cart"] {
    background: var(--taa-gold-500) !important;
  }
  &[data-status="selected"] {
    background: var(--primary) !important;
    box-shadow:
      0 0 0 2px var(--primary),
      0 0 8px rgba(229, 157, 13, 0.45);
  }
  &[data-status="sold"],
  &[data-status="unavailable"] {
    background: var(--text-subtle) !important;
    cursor: not-allowed;
  }

  &:hover:not(:disabled) {
    filter: brightness(1.15);
  }
  &:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  &:disabled {
    opacity: 0.55;
  }
}

@media (prefers-reduced-motion: reduce) {
  .sectionFilterChip,
  .spatialSeat {
    transition: none;
  }
}
```

**Verify:** `npx tsc --project packages/shared/tsconfig.json --noEmit 2>&1 | head -20`

---

### Step 15: Final TypeScript compile check across all packages

**Operation:** `VERIFY`

**Verify:**

```bash
npx tsc --project TripleAMusic/tsconfig.json --noEmit 2>&1 | head -40
npx tsc --project packages/shared/tsconfig.json --noEmit 2>&1 | head -20
```

---

## Mobile breakpoint strategy (summary)

| Breakpoint      | Behavior                                                                                                                                                                     |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `< 768px`       | FAB shown; side panel hidden by default, slides up as bottom sheet when `data-open="true"`; toolbar buttons get `min-height: 44px`; single-finger touch pan active on canvas |
| `768px – 960px` | FAB hidden; side panel hidden by default, shown as inline panel when `data-open="true"` (existing behavior)                                                                  |
| `> 960px`       | FAB hidden; side panel always visible at right (existing behavior)                                                                                                           |

---

## File split summary

| File                                                                   | What it contains after this plan                                                                                                              |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `TripleAMusic/src/components/SectionWizard.tsx`                        | Section/Arc/Wing geometry + wizard UI (NEW)                                                                                                   |
| `TripleAMusic/src/components/SectionWizard.module.scss`                | Wizard sheet + segmented control styles (NEW)                                                                                                 |
| `TripleAMusic/src/pages/SeatLayoutEditorPage.tsx`                      | Imports wizard; `rotationDeg` type; `_applyBlockSpec`; updated templates; FAB state; tap-tap row; Export modal; `SeatSelectorPreview` adapter |
| `TripleAMusic/src/pages/SeatLayoutEditorPage.module.scss`              | FAB + bottom sheet + mobile tap-target overrides appended                                                                                     |
| `packages/shared/src/components/SeatSelector/SeatSelector.tsx`         | `rotationDeg` on `SeatInfo`; spatial view mode; pointer pan/zoom; section filter chips                                                        |
| `packages/shared/src/components/SeatSelector/SeatSelector.module.scss` | Section filter chip styles; spatial canvas styles appended                                                                                    |

No new npm packages required. All geometry is pure TypeScript.

---

## Acceptance criteria per feature

1. **Section Wizard** — "Section Wizard" button in right panel opens a dialog; choosing "Arc / Fan" and clicking "Generate section" produces radially-rotated seats on the canvas.
2. **Pre-built templates** — Clicking "🎬 Theater / Cinema" or "🏟️ Arena" in Room Templates generates 200–260 seated rows on the canvas immediately; clicking "🏛️ Amphitheater" generates a curved arc of seats.
3. **rotationDeg** — Arc seats visually appear rotated (angled toward stage) both in the editor canvas and in the SeatSelector preview.
4. **FAB** — On a 375px viewport, a gold "＋" circle appears bottom-right; tapping it shows the quick-action menu; tapping "Add Section" opens the wizard.
5. **Bottom sheet** — On mobile, tapping the panel toggle causes the right-panel to slide up from the bottom of the screen.
6. **Tap-tap row** — On touch, activating the Row tool and tapping two points generates a row (no drag required).
7. **SeatSelector spatial** — When a layout with `posX`/`posY` data is loaded on the checkout seat picker, seats render in a spatially-accurate map (not just a list); pinch/pan works on touch.
8. **Section filter** — Tapping a section chip in SeatSelector highlights only that section's seats.
9. **Export modal** — Clicking "Preview" in the editor toolbar opens a two-pane modal showing the SeatSelector preview and the JSON summary.

PLAN*EOF
echo "Plan written successfully"`, and this is the output of running that command instead:
heredoc>  .  .;
heredoc> .ftam.;
heredoc> .fle .  .;
heredoc> .ftam.;
heredoc> .ft(: .ftam  .ft(teg-`.`heredoc> .ft(te##.  .or.fr-.ft(te.an stso.S .ft(Se.ft(te.);.ft
heredoc>  .;
heredoc> .rm.`.;
heredoc> .ft
heredoc> .;
heredoc> T*.is .ay.rin.fte-flex . T*ig .;fi ., .fte. ;
heredoc> . . \**. . .;
heredoc> .;}ate. . {o.;eS f.;}ate. bse.; p.;}ate. . {o;
heredoc> .``tY: 0 cohe.rnxpo.g border-radius: 999p .f
heredoc>
heredoc> dunde* d } d. Sehe.ft..ft(
heredoc> .f
heredoc>
heredoc> dunde* d } d. Sehe.ft(fs.ft(
heredoc> .f  
heredoc> d
heredoc> .f
heredoc>
heredoc> dunde{s 1 .fx;
heredoc> d le .f
heredoc>
heredoc> dunde* d } d. Sehe.fX(
heredoc> d0%) .f  
heredoc> d
heredoc> .f
heredoc>
heredoc> dunde{s .fia
heredoc> die0.
heredoc> ds;
heredoc> .f
heredoc>
heredoc> dunde* d } d. Sehe.fsu
heredoc> dace .f  
heredoc> d
heredoc> .f
heredoc>
heredoc> dunde{s 1 .fx;
heredoc> dold
heredoc> .r(--
heredoc> duner-d le .f
heredoc>
heredoc> dund-b
heredoc> dunde); d0%) .f  
heredoc> d
heredoc> .f
heredoc>
heredoc> dunde{ned
heredoc> .f
heredoc>
heredoc> dd va
heredoc> dunfocdie bd
heredoc> .e- . t:dunid d
heredoc>
heredoc> &[data-active="true"dp(( .f t dp(( vx dp(( rg
heredoc> dunde .f cdunde .f  
heredoc> d .ft(-ind r:d .ft(-inar pd d .en
heredoc> de* :adde* :
heredoc> /r
heredoc> day /r
heredoc> dind/fldecd/onde* itdssN .div<ffffffff><ffffffff>
heredoc>  
heredoc> dund x
heredoc> co
heredoc> dunf<ffffffff><ffffffff>dun<ffffffff><ffffffff> co
heredoc> <ffffffff><ffffffff>dun<ffffffff>e*px; co
heredoc> igdun 1<ffffffff><ffffffff>dun<ffffffff>e* :
heredoc> t0 t)
heredoc> d<ffffffff><ffffffff>t)
heredoc> drod<ffffffff>d:d<ffffffff> (2.ft(te.and}.; . `.
heredoc>  .  .;
heredoc> .ftamiu .  .;
heredoc> .ftam.;
heredoc> .fleze.ftamx;.fle .t-.ftam.;
heredoc> .00.ft(: * .ft(te##.  .or.fr-.ft(ts  .;
heredoc> .rm. `.;
heredoc> .ft
heredoc> .;
heredoc> T*.is .ay.rin.fte-flex . T*ig <ffffffff><ffffffff>.r<ffffffff><fffffff
f>ft
heredoc> .;<ffffffff><ffffffff>.<ffffffff>*<ffffffff><ffffffff>. . \*\*. . .;
heredoc> .;}ate. . {o.;eS f.;}ate. b<ffffffff>;}ate. . {o<ffffffff><ffffffff

>               .``tY: 0 cohe.rnxpo. relative;
>
> heredoc> hei
> heredoc> dunde* d } d. Sehe.ft..ft(
> heredoc> .f
> heredoc>
> heredoc> dunde* d } d. ar( .f
> heredoc>
> heredoc> dunde* d } d. Sehe.fid
> heredoc> dar( .f  
> heredoc> d
> heredoc> .f
> heredoc> der-radius: var(--rd
> heredoc> .md);
> heredoc> dunursd le .f
> heredoc>
> heredoc> dundou
> heredoc> dundeiond0%) .f  
> heredoc> d
> heredoc> .f
> heredoc>
> heredoc> dunde{ord
> heredoc> .f
> heredoc>
> heredoc> d
> heredoc>
> heredoc>  
> heredoc> duntivdie0.
> heredoc> ds;
> heredoc> gds;
> heredoc> in . }
> heredoc> d
> heredoc>
> heredoc> .dace .f  
> heredoc> d
> heredoc> .f
> heredoc>
> heredoc> dunde{abd
> heredoc> .f
> heredoc>
> heredoc> dinse
> heredoc> dun;
> heredoc> dold
> heredoc> .r(--ig 0duner-d.s
> heredoc> dund-b
> heredoc> dund
> heredoc> dundeiod
> heredoc> .f
> heredoc>
> heredoc> dunde{nedth:
> heredoc> dun;
> heredoc> .f
> heredoc>
> heredoc> d 2
> heredoc> dd
> heredoc> dunfer .e- . x;
> heredoc> &[data-active="t fdunde .f cdunde .f  
> heredoc> d .ft(-ind r:d .ft( d .ft(-ind r:d .ftlade* :adde* :
> heredoc> /r
> heredoc> day /r
> heredoc> dind/fldecd/ond-c /r
> heredoc> day /r
> heredoc> dir;da tdind/ti
> heredoc> dund x
> heredoc> co
> heredoc> dunf<ffffffff><ffffffff>dun<ffffffff><ffffffff> ctus="a co
> heredoc> bldun <ffffffff><ffffffff>dun<ffffffff>e*px; carigdun 1<ffffffff><fff
> fffff>dun<ffffffff>eor t0 t)
> heredoc> d<ffffffff><ffffffff>t)
> heredoc> drodatd<ffffffff><ffffffff>t)-cdrod<ffffffff> . .;
> heredoc> .ftamiu . .;
> heredoc> .ftam.;
> heredoc> .fle00.ftampo.ftam.;
> heredoc> .fle[d.flezeat.00.ft(: * .ft(te##. .or.fun.rm. `.;
> heredoc> .ft
> heredoc> .;
> heredoc> T_.is .ay.rin.fte-fleow.ft
> heredoc> .; 2 . vT_(- .;<ffffffff><ffffffff>.<ffffffff>_<ffffffff><ffffffff>.
> . **. . .;
> heredoc> .;}ate. .);.;}ate. ta-status="sold"],
> heredoc> hei
> heredoc> dunde* d } d. Sehe.ft..ft(
> heredoc> .f
> heredoc>
> heredoc> dunde* d } d. ar( .f
> heredoc>
> heredoc> dunde* d } d. wedund
> heredoc>
> heredoc> .f
> heredoc>
> heredoc> dunde* d } d. ar( .f
> heredoc> er
> heredoc> dbri
> heredoc> dunde* d } d. Sehus-dar( .f  
> heredoc> d
> heredoc> .f
> heredoc> der-radd d
> heredoc> .f
> heredoc> des); der-in .md);
> heredoc> dunursd le&:dunursdd
> heredoc> dundou
> heredoc> du 0.55dunde
> heredoc>
> heredoc> d
> heredoc> .f
> heredoc>
> heredoc> dunde{ordduce
> heredoc> duntio .f
> heredoc>
> heredoc> de)
> heredoc> d
> heredoc>
> heredoc> .sectdonds;
> heredoc> gds;,
> heredoc> .sin . lSd
> heredoc>
> heredoc> .d trand
> heredoc> .f
> heredoc>
> heredoc> due; }
> heredoc> dun``
heredoc>    .f
heredoc> 
heredoc> dy:
heredoc> dinnpxdun; - dooj   .padund-b
heredoc> dund
heredoc>   dundeiod
heredoc> jsdund
heredoc> no  dt    .f
heredoc> 
heredoc> duad
heredoc> dun`
> heredoc>
> heredoc> dun;
> heredoc> .f
> heredoc> p F
> heredoc> d 2
> heredoc> Typddcr t &[data-active="t ad .ft(-ind r:d .ft( d .ft(-ind
> r:d fy /r
> heredoc> day /r
> heredoc> dind/fldecd/ond-c /r
> heredoc> day /r
> heredoc> dir;da tdind/ti
> heredoc> dund x
> heredoc> t da&1dind/adday /r
> heredoc> dir;da tdindecdir;dkadund x
> heredoc> co
> heredoc> dunnf co
> heredoc> ondunnobldun <ffffffff><ffffffff>dun<ffffffff>e*px; car
> heredoc> -d<ffffffff><ffffffff>t)
> heredoc> drodatd<ffffffff><ffffffff>t)-cdrod<ffffffff> . .;
> heredoc> .ftamiu . .;
> heredoc> eadrodat .ftamiu . .;
> heredoc> .ftam.;
> heredoc> .fle< .ftam.;
> heredoc> .fle s.fle00si.fle[d.flezeat.00.fde.ft
> heredoc> .;
> heredoc> T_.is .ay.rin.ftom sheet when `data-open="tr ."`T_to .; 2 . vT_(- .;<ff
> ffffff><ffffffff>.<ffffffff>_<ffffffff>ig.;}ate. .);.;}ate. ta-status="sold"],

heredoc> e hei
heredoc> dunde* d } d. Sehe.ft..fthidunde s .f
heredoc>
heredoc> dunde* d } d. ar( .f
heredoc> ow
heredoc> das
heredoc> dunde* d } d. wedope
heredoc> .f
heredoc>
heredoc> dunde* d } d. ior
heredoc> d|
heredoc> |er
heredoc> dbri
heredoc> dunde* d } d sddedunned
heredoc> .f
heredoc> der-radd d
heredoc> .f
heredoc> des); der-ibehader-) .f
heredoc> des# des) sdunursd le&:dunursde dundou
heredoc> du 0.55dunde
heredoc> ftdu 0.is
heredoc> d
heredoc> .f
heredoc>
heredoc> d-|---
heredoc> dun`Trduntio   .f
heredoc> rc
heredoc> de)
heredoc> d
heredoc> 
heredoc>  .s/Sd
heredoc> tionW  gds;,
heredoc>   .|   .sinn/
heredoc> .d trand
heredoc>  ome   .f
heredoc> 
heredoc> iz
heredoc> du UI dun`` |   .Tr
heredoc> dy:AMudic/dund
heredoc>   dundeiod
heredoc> jsdund
heredoc> no  d.m  dlejsdund
heredoc> noWino  dsh
heredoc> duad
heredoc> dun`
heredoc> ntedunon
heredoc> dul s esp ) d 2
heredoc> TyriTyeAday /r
heredoc> dind/fldecd/ond-c /r
heredoc> day /r
heredoc> dir;da tdind/ti
heredoc> dund x
heredoc> t da&1dind/adday /r
heredoc> d*applyBloday /r
heredoc> dir;da tdindmpdir;d; dund x
heredoc> t da&1dta t da; dir;da tdindecdir;dSe co
heredoc> dunnf co
heredoc> ondunnobldu `Triplondunnobsr-d<ffffffff><ffffffff>t)
heredoc> drodatd<ffffffff><ffffffff>t)-cdrod<ffffffff>   .dudrodats`.ftamiu . .
;
heredoc> eadrodat .ftbieadrodat .ftt .ftam.;
heredoc> .fle< .ftam.;| .fle< ge.fle s.fle00/c .;
heredoc> T*.is .ay.rin.ftom sheet when `dasxT\_| e hei
heredoc> dunde* d } d. Sehe.ft..fthidunde s .f
heredoc>
heredoc> dunde* d } d. ar( .f
heredoc> ow
heredoc> das
heredoc> dunde* d } d. wedope
heredoc> .nedunde* tS
heredoc> dunde* d } d. ar( .f
heredoc> ow
heredoc> das
heredoc> dunde* n fow
heredoc> das
heredoc> dunde* d } daldcaduns .f
heredoc>
heredoc> dunde* d } d. i n
heredoc> d pad|
heredoc> |er
heredoc> dbri
heredoc> dunde* ge|medby dunpu .f
heredoc> der-radd d
heredoc> .f
heredoc> desceder-ce .f
heredoc> des pdes)eades# des) sdunursd le&:du**du 0."Section Wizard" button in r
ight pftdu 0.is
heredoc> da d
heredoc> .f
heredoc> choo
heredoc> d-| "Adun`TFarc
heredoc> de)
heredoc> d
heredoc> 
heredoc>  .s/Sd"Gdned
heredoc> te setionW"   .|   .sindi.d trand
heredoc>  om s ome    t
heredoc> iz
heredoc> du Us.
heredoc> d. dy:AMudic/dund
heredoc>   dte  dundeiod
heredoc> jsinjsdund
heredoc> noheno  d/ noWino  dsh
heredoc> duad
heredoc> <ffffffff><ffffffff>duad
heredoc> dun`
heredoc> Rdun Tnteladul s erTyriTyeAday /r
heredoc> dindeddind/fldecd/ocaday /r
heredoc> dir;da tdindlidir;d "dund x
heredoc> t da&1dea t daged_applyBloday /r
heredoc> dic dir;da tdindmpdro t danDeg** — Arc seats vidunnf co
heredoc> ondunnobldu `Triplondunnobsr-d<ffffffff>e)ondunnob tdrodatd<ffffffff><f
fffffff>t)-cdrod<ffffffff>   .dudrodats`.leeadrodat .ftbieadrodat .ftt .ftam.;
heredoc> .fle< .ftor.fle< .ftam.;| .fle< ge.fle s.fle0toT*.is .ay.rin.ftom sheet
when `dasxT*| iodunde* d } d. Sehe.ft..fthidunde s .f
heredoc>
heredoc> d.
heredoc>
heredoc> dunde* d } d. ar( .f
heredoc> ow
heredoc> das
heredoc> dunde* thow
heredoc> das
heredoc> dunde* d } de digdunpa .nedunde* tS
heredoc> dunde* d bodunde* d }scow
heredoc> das
heredoc> dunde* n fow
heredoc> das <ffffffff><ffffffff> duntodas
heredoc> dunde*tidunth
heredoc> dunde* d } d. i n
heredoc> d paoind pad|
heredoc> |er
heredoc> dbri
heredoc> dundeo |er
heredoc> dredbirdun.
heredoc> der-radd d
heredoc> .f
heredoc> desceder-c <ffffffff> .f
heredoc> des ldesct des pdes)eades#sYda d
heredoc> .f
heredoc> choo
heredoc> d-| "Aducheckout seat picker, seats render in a spatially-accurate map
t choo ad-|stde)
heredoc> d
heredoc>
heredoc> .s/Sd"ord
heredoc> on tte setionW"Se om s ome t
heredoc> iz
heredoc> du Us.
heredoc> d. dy:Atiiz
heredoc> duip in Seatdeld. dy h dte dundeiod
heredoc> hajsinjsdund
heredoc> nohatnoheno dxpduad
heredoc> <ffffffff><ffffffff>duad
heredoc> dun`
heredoc>  Rduin<ffffffff><ffffffff>dPrdun`
heredoc> " Rdthdindeddind/fldecd/ocaday /r
heredoc> dir;damodir;da tdindlidir;d "dund or t da&1dea t daged_applyBlardic dir
;da tdindmpdro t danDeg\*\*suondunnobldu
