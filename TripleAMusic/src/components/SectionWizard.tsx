import { useState } from "react";
import styles from "./SectionWizard.module.scss";
import ui from "@shared/styles/primitives.module.scss";

// ─── Types ────────────────────────────────────────────────────────────────────

export type WizardShape = "straight" | "arc" | "wing";

export interface SectionWizardParams {
  shape: WizardShape;
  sectionName: string;
  rowCount: number;
  seatsPerRow: number;
  maxSeatsPerRow?: number;
  rowSpacingFt: number;
  seatPitchFt: number;
  innerRadiusFt?: number;
  arcSpanDeg?: number;
  centerAngleDeg?: number;
  centerX?: number;
  centerY?: number;
  rotationDeg?: number;
  startX?: number;
  startY?: number;
  floorId: string;
}

export interface EditableSeatBlueprint {
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
  rotationDeg?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Geometry builders ────────────────────────────────────────────────────────

function buildStraightSection(
  p: SectionWizardParams,
  gridSize: number,
): EditableSeatBlueprint[] {
  const pitchPx = p.seatPitchFt * gridSize;
  const rowSpacePx = p.rowSpacingFt * gridSize;
  const seats: EditableSeatBlueprint[] = [];
  for (let r = 0; r < p.rowCount; r++) {
    const rowName = toRowName(r);
    const rowGroupId = `wizard-${p.sectionName}-${rowName}-${Date.now() + r}`;
    const rowY = (p.startY ?? 0) + r * rowSpacePx;
    const rowWidth = (p.seatsPerRow - 1) * pitchPx;
    const rowStartX = (p.startX ?? 0) - rowWidth / 2;
    for (let s = 0; s < p.seatsPerRow; s++) {
      seats.push({
        seatId: `${rowGroupId}-${s + 1}`,
        section: p.sectionName,
        row: rowName,
        seatNumber: String(s + 1),
        posX: rowStartX + s * pitchPx,
        posY: rowY,
        floorId: p.floorId,
        isAvailable: true,
        rowGroupId,
        rotationDeg: 0,
      });
    }
  }
  return seats;
}

function buildArcSection(
  p: SectionWizardParams,
  gridSize: number,
): EditableSeatBlueprint[] {
  const innerRadiusPx = (p.innerRadiusFt ?? 20) * gridSize;
  const rowSpacePx = p.rowSpacingFt * gridSize;
  const spanRad = ((p.arcSpanDeg ?? 120) * Math.PI) / 180;
  const centerAngleRad = ((p.centerAngleDeg ?? 90) * Math.PI) / 180;
  const cx = p.centerX ?? 0;
  const cy = p.centerY ?? 0;
  const minSeats = p.seatsPerRow;
  const maxSeats = p.maxSeatsPerRow ?? p.seatsPerRow;
  const seats: EditableSeatBlueprint[] = [];

  for (let r = 0; r < p.rowCount; r++) {
    const radius = innerRadiusPx + r * rowSpacePx;
    const nSeats = Math.round(
      minSeats + (maxSeats - minSeats) * (r / Math.max(1, p.rowCount - 1)),
    );
    const rowName = toRowName(r);
    const rowGroupId = `wizard-${p.sectionName}-${rowName}-${Date.now() + r}`;

    for (let s = 0; s < nSeats; s++) {
      const t = nSeats === 1 ? 0.5 : s / (nSeats - 1);
      const angleRad = centerAngleRad - spanRad / 2 + t * spanRad;
      const px = cx + Math.cos(angleRad) * radius;
      const py = cy + Math.sin(angleRad) * radius;
      const facingAngleDeg =
        (Math.atan2(cy - py, cx - px) * 180) / Math.PI + 90;

      seats.push({
        seatId: `${rowGroupId}-${s + 1}`,
        section: p.sectionName,
        row: rowName,
        seatNumber: String(s + 1),
        posX: px,
        posY: py,
        floorId: p.floorId,
        isAvailable: true,
        rowGroupId,
        rotationDeg: facingAngleDeg,
      });
    }
  }
  return seats;
}

function buildWingSection(
  p: SectionWizardParams,
  gridSize: number,
): EditableSeatBlueprint[] {
  const straight = buildStraightSection({ ...p, rotationDeg: 0 }, gridSize);
  const angleDeg = p.rotationDeg ?? 0;
  const angleRad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const cx = p.startX ?? 0;
  const cy = p.startY ?? 0;
  return straight.map((seat) => {
    const dx = (seat.posX ?? 0) - cx;
    const dy = (seat.posY ?? 0) - cy;
    return {
      ...seat,
      posX: cx + dx * cos - dy * sin,
      posY: cy + dx * sin + dy * cos,
      rotationDeg: angleDeg,
    };
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function generateSectionSeats(
  params: SectionWizardParams,
  gridSize: number,
): EditableSeatBlueprint[] {
  switch (params.shape) {
    case "arc":
      return buildArcSection(params, gridSize);
    case "wing":
      return buildWingSection(params, gridSize);
    default:
      return buildStraightSection(params, gridSize);
  }
}

// ─── Wizard component ─────────────────────────────────────────────────────────

interface SectionWizardProps {
  onGenerate: (seats: EditableSeatBlueprint[]) => void;
  onClose: () => void;
  floorId: string;
  gridSize: number;
  stageX?: number;
  stageY?: number;
  stageWidth?: number;
  stageHeight?: number;
}

export function SectionWizard({
  onGenerate,
  onClose,
  floorId,
  gridSize,
  stageX = 0,
  stageY = 0,
  stageWidth = 0,
  stageHeight = 0,
}: SectionWizardProps) {
  const defaultCenterX = stageX + stageWidth / 2;
  const defaultCenterY = stageY + stageHeight / 2;

  const [shape, setShape] = useState<WizardShape>("straight");
  const [sectionName, setSectionName] = useState("Main");
  const [rowCount, setRowCount] = useState(8);
  const [seatsPerRow, setSeatsPerRow] = useState(12);
  const [maxSeatsPerRow, setMaxSeatsPerRow] = useState(20);
  const [rowSpacingFt, setRowSpacingFt] = useState(3);
  const [seatPitchFt, setSeatPitchFt] = useState(2.5);
  const [innerRadiusFt, setInnerRadiusFt] = useState(20);
  const [arcSpanDeg, setArcSpanDeg] = useState(120);
  const [rotationDeg, setRotationDeg] = useState(0);

  const estimatedSeats =
    shape === "arc"
      ? Math.round(rowCount * ((seatsPerRow + maxSeatsPerRow) / 2))
      : rowCount * seatsPerRow;

  function handleGenerate() {
    const params: SectionWizardParams = {
      shape,
      sectionName: sectionName.trim() || "Section",
      rowCount,
      seatsPerRow,
      maxSeatsPerRow: shape === "arc" ? maxSeatsPerRow : undefined,
      rowSpacingFt,
      seatPitchFt,
      innerRadiusFt: shape === "arc" ? innerRadiusFt : undefined,
      arcSpanDeg: shape === "arc" ? arcSpanDeg : undefined,
      centerAngleDeg: shape === "arc" ? 270 : undefined,
      centerX: shape === "arc" ? defaultCenterX : undefined,
      centerY: shape === "arc" ? defaultCenterY : undefined,
      startX: defaultCenterX,
      startY: defaultCenterY + stageHeight / 2 + 2 * gridSize,
      rotationDeg: shape === "wing" ? rotationDeg : 0,
      floorId,
    };
    onGenerate(generateSectionSeats(params, gridSize));
  }

  const shapeCards: {
    id: WizardShape;
    icon: string;
    label: string;
    desc: string;
  }[] = [
    {
      id: "straight",
      icon: "⬛",
      label: "Straight Block",
      desc: "Parallel rows, flat front",
    },
    {
      id: "arc",
      icon: "🌙",
      label: "Arc Fan",
      desc: "Curved rows around stage",
    },
    {
      id: "wing",
      icon: "↗",
      label: "Angled Wing",
      desc: "Rotated block for sides",
    },
  ];

  return (
    <div
      className={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label="Add Section"
      >
        <div className={styles.dialogHeader}>
          <span className={styles.dialogTitle}>Add Section</span>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className={styles.dialogBody}>
          {/* Shape picker */}
          <div className={styles.shapeRow}>
            {shapeCards.map((card) => (
              <button
                key={card.id}
                type="button"
                className={styles.shapeCard}
                data-selected={shape === card.id}
                onClick={() => setShape(card.id)}
              >
                <span className={styles.shapeIcon}>{card.icon}</span>
                <span className={styles.shapeLabel}>{card.label}</span>
                <span className={styles.shapeDesc}>{card.desc}</span>
              </button>
            ))}
          </div>

          {/* Fields */}
          <div className={styles.fields}>
            <label className={styles.field}>
              <span className={ui.help}>Section Name</span>
              <input
                className={ui.input}
                value={sectionName}
                onChange={(e) => setSectionName(e.target.value)}
                placeholder="e.g. Center, Left"
              />
            </label>

            <div className={styles.fieldRow}>
              <label className={styles.field}>
                <span className={ui.help}>Rows</span>
                <input
                  className={ui.input}
                  type="number"
                  min={1}
                  max={40}
                  value={rowCount}
                  onChange={(e) =>
                    setRowCount(
                      Math.max(1, Math.min(40, Number(e.target.value) || 1)),
                    )
                  }
                />
              </label>
              <label className={styles.field}>
                <span className={ui.help}>
                  {shape === "arc" ? "Min seats (front)" : "Seats / Row"}
                </span>
                <input
                  className={ui.input}
                  type="number"
                  min={1}
                  max={50}
                  value={seatsPerRow}
                  onChange={(e) =>
                    setSeatsPerRow(
                      Math.max(1, Math.min(50, Number(e.target.value) || 1)),
                    )
                  }
                />
              </label>
            </div>

            {shape === "arc" && (
              <>
                <div className={styles.fieldRow}>
                  <label className={styles.field}>
                    <span className={ui.help}>Max seats (back)</span>
                    <input
                      className={ui.input}
                      type="number"
                      min={1}
                      max={80}
                      value={maxSeatsPerRow}
                      onChange={(e) =>
                        setMaxSeatsPerRow(
                          Math.max(1, Number(e.target.value) || 1),
                        )
                      }
                    />
                  </label>
                  <label className={styles.field}>
                    <span className={ui.help}>Inner radius (ft)</span>
                    <input
                      className={ui.input}
                      type="number"
                      min={5}
                      max={200}
                      value={innerRadiusFt}
                      onChange={(e) =>
                        setInnerRadiusFt(
                          Math.max(5, Number(e.target.value) || 20),
                        )
                      }
                    />
                  </label>
                </div>
                <label className={styles.field}>
                  <span className={ui.help}>Arc span (degrees, 10–360)</span>
                  <input
                    className={ui.input}
                    type="number"
                    min={10}
                    max={360}
                    value={arcSpanDeg}
                    onChange={(e) =>
                      setArcSpanDeg(
                        Math.max(
                          10,
                          Math.min(360, Number(e.target.value) || 120),
                        ),
                      )
                    }
                  />
                </label>
              </>
            )}

            {shape === "wing" && (
              <label className={styles.field}>
                <span className={ui.help}>
                  Rotation angle (degrees, -180 to 180)
                </span>
                <div className={styles.rangeRow}>
                  <input
                    type="range"
                    min={-180}
                    max={180}
                    value={rotationDeg}
                    onChange={(e) => setRotationDeg(Number(e.target.value))}
                    className={styles.range}
                  />
                  <input
                    className={ui.input}
                    type="number"
                    min={-180}
                    max={180}
                    value={rotationDeg}
                    onChange={(e) =>
                      setRotationDeg(
                        Math.max(
                          -180,
                          Math.min(180, Number(e.target.value) || 0),
                        ),
                      )
                    }
                    style={{ width: 72 }}
                  />
                </div>
              </label>
            )}

            <div className={styles.fieldRow}>
              <label className={styles.field}>
                <span className={ui.help}>Row spacing (ft)</span>
                <input
                  className={ui.input}
                  type="number"
                  min={1}
                  max={20}
                  step={0.5}
                  value={rowSpacingFt}
                  onChange={(e) =>
                    setRowSpacingFt(Math.max(1, Number(e.target.value) || 3))
                  }
                />
              </label>
              <label className={styles.field}>
                <span className={ui.help}>Seat pitch (ft)</span>
                <input
                  className={ui.input}
                  type="number"
                  min={1}
                  max={10}
                  step={0.25}
                  value={seatPitchFt}
                  onChange={(e) =>
                    setSeatPitchFt(Math.max(1, Number(e.target.value) || 2.5))
                  }
                />
              </label>
            </div>
          </div>

          {/* Preview */}
          <div className={styles.preview}>
            ~{estimatedSeats} seats across {rowCount} row
            {rowCount !== 1 ? "s" : ""}
          </div>
        </div>

        <div className={styles.dialogFooter}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.generateBtn}
            onClick={handleGenerate}
          >
            Generate Section
          </button>
        </div>
      </div>
    </div>
  );
}
