import { useMemo, useState } from "react";
import { SeatSelector } from "@shared";
import type { SeatInfo, SectionInfo } from "@shared";
import styles from "./LayoutPreviewModal.module.scss";

type StagePosition = "top" | "bottom" | "left" | "right";

interface EditableSeat {
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

interface EditableSection {
  sectionId: string;
  name: string;
  floorId?: string;
  color?: string;
  defaultTierId?: string;
  rows: string[];
  seatsPerRow: number[];
}

interface LayoutPreviewModalProps {
  seats: EditableSeat[];
  sections: EditableSection[];
  stagePosition: StagePosition;
  layoutName: string;
  onClose: () => void;
  onSave: () => void;
}

export function LayoutPreviewModal({
  seats,
  sections,
  stagePosition,
  layoutName,
  onClose,
  onSave,
}: LayoutPreviewModalProps) {
  const [tab, setTab] = useState<"preview" | "json">("preview");
  const [copied, setCopied] = useState(false);

  const seatInfos: SeatInfo[] = useMemo(
    () =>
      seats.map((s) => ({
        seatId: s.seatId,
        row: s.row,
        seatNumber: s.seatNumber,
        section: s.section,
        tierId: s.tierId,
        posX: s.posX,
        posY: s.posY,
        isAvailable: s.isAvailable,
        isSold: s.isSold,
        rotationDeg: s.rotationDeg,
      })),
    [seats],
  );

  const sectionInfos: SectionInfo[] = useMemo(
    () =>
      sections.map((s) => ({
        sectionId: s.sectionId,
        name: s.name,
        color: s.color,
        defaultTierId: s.defaultTierId,
      })),
    [sections],
  );

  // Build seat counts per section for JSON tab
  const sectionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of seats) {
      counts.set(s.section, (counts.get(s.section) ?? 0) + 1);
    }
    return counts;
  }, [seats]);

  const floorIds = useMemo(() => {
    return [...new Set(seats.map((s) => s.floorId ?? "Main Floor"))];
  }, [seats]);

  function handleCopy() {
    const json = JSON.stringify({ seats, sections, stagePosition }, null, 2);
    navigator.clipboard.writeText(json).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleSave() {
    onSave();
    onClose();
  }

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
        aria-label="Preview Layout"
      >
        <div className={styles.dialogHeader}>
          <span className={styles.dialogTitle}>Preview: {layoutName}</span>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className={styles.tabs}>
          <button
            type="button"
            className={styles.tab}
            data-active={tab === "preview"}
            onClick={() => setTab("preview")}
          >
            Preview
          </button>
          <button
            type="button"
            className={styles.tab}
            data-active={tab === "json"}
            onClick={() => setTab("json")}
          >
            JSON
          </button>
        </div>

        <div className={styles.body}>
          {tab === "preview" ? (
            <div className={styles.previewWrap}>
              <SeatSelector
                seats={seatInfos}
                sections={sectionInfos}
                tiers={[]}
                stagePosition={stagePosition}
                selectedSeats={[]}
                maxSeats={0}
                onSelectionChange={() => {}}
              />
            </div>
          ) : (
            <div className={styles.jsonWrap}>
              <div className={styles.jsonSummary}>
                <div>
                  <strong>Layout:</strong> "{layoutName}"
                </div>
                <div>
                  <strong>Total seats:</strong> {seats.length}
                </div>
                <div>
                  <strong>Sections:</strong>{" "}
                  {[...sectionCounts.entries()]
                    .map(([name, count]) => `${name} (${count})`)
                    .join(", ") || "—"}
                </div>
                <div>
                  <strong>Floors:</strong> {floorIds.join(", ") || "—"}
                </div>
              </div>
              <button
                type="button"
                className={styles.copyBtn}
                onClick={handleCopy}
              >
                {copied ? "✓ Copied!" : "Copy JSON"}
              </button>
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>
            Close
          </button>
          <button type="button" className={styles.saveBtn} onClick={handleSave}>
            Save Layout
          </button>
        </div>
      </div>
    </div>
  );
}
