import { useMemo, useState } from "react";
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

interface SeatSelectorProps {
  seats: SeatInfo[];
  sections: SectionInfo[];
  tiers: TierInfo[];
  stagePosition?: "top" | "bottom" | "left" | "right";
  selectedSeats: string[];
  maxSeats: number;
  onSelectionChange: (seatIds: string[]) => void;
}

export default function SeatSelector({
  seats,
  sections,
  tiers,
  stagePosition = "top",
  selectedSeats,
  maxSeats,
  onSelectionChange,
}: SeatSelectorProps) {
  const [hoveredSeat, setHoveredSeat] = useState<string | null>(null);

  // Group seats by section and row
  const seatsBySection = useMemo(() => {
    const grouped = new Map<string, Map<string, SeatInfo[]>>();

    for (const seat of seats) {
      if (!grouped.has(seat.section)) {
        grouped.set(seat.section, new Map());
      }
      const sectionMap = grouped.get(seat.section)!;
      if (!sectionMap.has(seat.row)) {
        sectionMap.set(seat.row, []);
      }
      sectionMap.get(seat.row)!.push(seat);
    }

    // Sort seats within each row by seat number
    for (const sectionMap of grouped.values()) {
      for (const [row, rowSeats] of sectionMap) {
        sectionMap.set(
          row,
          rowSeats.sort((a, b) => {
            const numA = parseInt(a.seatNumber, 10);
            const numB = parseInt(b.seatNumber, 10);
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            return a.seatNumber.localeCompare(b.seatNumber);
          }),
        );
      }
    }

    return grouped;
  }, [seats]);

  // Create tier lookup
  const tierById = useMemo(() => {
    return new Map(tiers.map((t) => [t.id, t]));
  }, [tiers]);

  // Create section lookup
  const sectionByName = useMemo(() => {
    return new Map(sections.map((s) => [s.name, s]));
  }, [sections]);

  const handleSeatClick = (seat: SeatInfo) => {
    if (!seat.isAvailable || seat.isSold) return;

    const isSelected = selectedSeats.includes(seat.seatId);

    if (isSelected) {
      // Deselect
      onSelectionChange(selectedSeats.filter((id) => id !== seat.seatId));
    } else if (selectedSeats.length < maxSeats) {
      // Select
      onSelectionChange([...selectedSeats, seat.seatId]);
    }
  };

  const getSeatColor = (seat: SeatInfo): string => {
    if (seat.isSold) return "var(--color-surface-tertiary)";
    if (!seat.isAvailable) return "var(--color-surface-tertiary)";
    if (selectedSeats.includes(seat.seatId)) return "var(--color-gold)";

    // Use tier color if available
    if (seat.tierId) {
      const tier = tierById.get(seat.tierId);
      if (tier?.color) return tier.color;
    }

    // Use section color if available
    const section = sectionByName.get(seat.section);
    if (section?.color) return section.color;

    return "var(--color-accent)";
  };

  const getSeatStatus = (seat: SeatInfo): string => {
    if (seat.isSold) return "sold";
    if (!seat.isAvailable) return "unavailable";
    if (selectedSeats.includes(seat.seatId)) return "selected";
    return "available";
  };

  const getHoveredSeatInfo = (): SeatInfo | null => {
    if (!hoveredSeat) return null;
    return seats.find((s) => s.seatId === hoveredSeat) ?? null;
  };

  const hoveredInfo = getHoveredSeatInfo();
  const hoveredTier = hoveredInfo?.tierId
    ? tierById.get(hoveredInfo.tierId)
    : null;

  // Calculate total price of selected seats
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

  return (
    <div className={styles.container}>
      {/* Stage indicator */}
      <div className={styles.stage} data-position={stagePosition}>
        STAGE
      </div>

      {/* Legend */}
      <div className={styles.legend}>
        <div className={styles.legendItem}>
          <span
            className={styles.legendSwatch}
            style={{ backgroundColor: "var(--color-accent)" }}
          />
          <span>Available</span>
        </div>
        <div className={styles.legendItem}>
          <span
            className={styles.legendSwatch}
            style={{ backgroundColor: "var(--color-gold)" }}
          />
          <span>Selected</span>
        </div>
        <div className={styles.legendItem}>
          <span
            className={styles.legendSwatch}
            style={{ backgroundColor: "var(--color-surface-tertiary)" }}
          />
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

      {/* Seating chart */}
      <div className={styles.chart}>
        {Array.from(seatsBySection.entries()).map(([sectionName, rows]) => {
          const _section = sectionByName.get(sectionName);
          void _section; // Available for future styling based on section
          return (
            <div key={sectionName} className={styles.section}>
              <h4 className={styles.sectionName}>{sectionName}</h4>
              <div className={styles.rows}>
                {Array.from(rows.entries())
                  .sort((a, b) => a[0].localeCompare(b[0]))
                  .map(([rowName, rowSeats]) => (
                    <div key={rowName} className={styles.row}>
                      <span className={styles.rowLabel}>{rowName}</span>
                      <div className={styles.seats}>
                        {rowSeats.map((seat) => (
                          <button
                            key={seat.seatId}
                            className={styles.seat}
                            data-status={getSeatStatus(seat)}
                            style={{
                              backgroundColor: getSeatColor(seat),
                            }}
                            onClick={() => handleSeatClick(seat)}
                            onMouseEnter={() => setHoveredSeat(seat.seatId)}
                            onMouseLeave={() => setHoveredSeat(null)}
                            disabled={!seat.isAvailable || seat.isSold}
                            title={`${seat.section} ${seat.row}${seat.seatNumber}`}
                          >
                            {seat.seatNumber}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          );
        })}
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
          {hoveredInfo.isSold && <p className={styles.tooltipSold}>Sold</p>}
        </div>
      )}

      {/* Selection summary */}
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
                    {tier && ` - $${tier.price}`}
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
    </div>
  );
}
