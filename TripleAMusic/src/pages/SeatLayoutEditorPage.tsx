import { useEffect, useMemo, useRef, useState } from "react";
import type { Location } from "@shared";
import { Button, spacing } from "@shared";
import ui from "@shared/styles/primitives.module.scss";
import { useNavigate, useParams } from "react-router-dom";
import { HostDashboardShell } from "../components/HostDashboardShell";
import { createApiClient, getAssetUrl } from "../lib/urls";
import styles from "./SeatLayoutEditorPage.module.scss";

type StagePosition = "top" | "bottom" | "left" | "right";

type EditableFloor = {
  floorId: string;
  name: string;
  order: number;
};

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
  accessibility?: string[];
};

type EditableSection = {
  sectionId: string;
  name: string;
  floorId?: string;
  color?: string;
  defaultTierId?: string;
  rows: string[];
  seatsPerRow: number[];
};

type BuilderTool = "select" | "pan";

type ViewState = {
  scale: number;
  offsetX: number; // px
  offsetY: number; // px
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function stableSortFloors(floors: EditableFloor[]): EditableFloor[] {
  return [...floors].sort(
    (a, b) => a.order - b.order || a.name.localeCompare(b.name),
  );
}

function ensureDefaultFloor(floors?: EditableFloor[]): EditableFloor[] {
  const list =
    floors && floors.length > 0
      ? floors
      : [{ floorId: "floor-1", name: "Main Floor", order: 0 }];
  const seen = new Set<string>();
  const deduped: EditableFloor[] = [];
  for (const f of list) {
    if (!f.floorId || seen.has(f.floorId)) continue;
    seen.add(f.floorId);
    deduped.push({ ...f, order: typeof f.order === "number" ? f.order : 0 });
  }
  return stableSortFloors(
    deduped.length
      ? deduped
      : [{ floorId: "floor-1", name: "Main Floor", order: 0 }],
  );
}

function isLegacyPercentPosition(posX?: number, posY?: number): boolean {
  if (typeof posX !== "number" || typeof posY !== "number") return false;
  return posX >= 0 && posX <= 100 && posY >= 0 && posY <= 100;
}

function normalizeSeatPositions(
  seats: EditableSeat[],
  defaultFloorId: string,
  gridSize: number,
): EditableSeat[] {
  const hasAnyPosition = seats.some(
    (s) => typeof s.posX === "number" && typeof s.posY === "number",
  );
  const needsAnyPosition = seats.some(
    (s) => typeof s.posX !== "number" || typeof s.posY !== "number",
  );

  const normalized = seats.map((s) => {
    const floorId = s.floorId || defaultFloorId;
    if (isLegacyPercentPosition(s.posX, s.posY)) {
      // Convert 0..100 "percent" into world coords around origin.
      const x = ((s.posX ?? 50) - 50) * 10;
      const y = ((s.posY ?? 50) - 50) * 10;
      return { ...s, floorId, posX: x, posY: y };
    }
    return {
      ...s,
      floorId,
    };
  });

  if (!needsAnyPosition) return normalized;

  // If most seats were missing coordinates, place them in a simple grid near origin.
  const coordsSeats = normalized.filter(
    (s) => typeof s.posX === "number" && typeof s.posY === "number",
  );
  if (
    hasAnyPosition &&
    coordsSeats.length >= Math.max(3, Math.ceil(normalized.length / 4))
  ) {
    return normalized.map((s) => {
      if (typeof s.posX === "number" && typeof s.posY === "number") return s;
      return { ...s, posX: 0, posY: 0 };
    });
  }

  const cols = Math.max(1, Math.ceil(Math.sqrt(normalized.length)));
  const rows = Math.max(1, Math.ceil(normalized.length / cols));
  const startX = -((cols - 1) * gridSize) / 2;
  const startY = -((rows - 1) * gridSize) / 2;

  return normalized.map((s, i) => {
    if (typeof s.posX === "number" && typeof s.posY === "number") return s;
    const col = i % cols;
    const row = Math.floor(i / cols);
    return {
      ...s,
      posX: startX + col * gridSize,
      posY: startY + row * gridSize,
    };
  });
}

function computeSectionsFromSeats(seats: EditableSeat[]): EditableSection[] {
  const bySection = new Map<string, Map<string, number>>();

  for (const seat of seats) {
    const sectionName = seat.section || "Main";
    const row = seat.row || "A";
    const floorId = seat.floorId || "floor-1";
    const key = `${floorId}::${sectionName}`;
    if (!bySection.has(key)) bySection.set(key, new Map());
    const rowCounts = bySection.get(key)!;
    rowCounts.set(row, (rowCounts.get(row) ?? 0) + 1);
  }

  const sectionKeys = Array.from(bySection.keys()).sort();
  return sectionKeys.map((key, idx) => {
    const [floorId, name] = key.split("::");
    const rowCounts = bySection.get(key)!;
    const rows = Array.from(rowCounts.keys()).sort();
    const seatsPerRow = rows.map((r) => rowCounts.get(r) ?? 0);
    return {
      sectionId: `section-${idx}`,
      name,
      floorId,
      rows,
      seatsPerRow,
    };
  });
}

function snap(n: number, gridSize: number) {
  if (!isFinite(n) || gridSize <= 0) return n;
  return Math.round(n / gridSize) * gridSize;
}

function toRowName(idx: number): string {
  // A..Z, AA..AZ, BA.. etc
  const base = 26;
  let n = idx;
  let s = "";
  while (n >= 0) {
    s = String.fromCharCode(65 + (n % base)) + s;
    n = Math.floor(n / base) - 1;
  }
  return s;
}

export function SeatLayoutEditorPage() {
  const { locationId, layoutId } = useParams();
  const navigate = useNavigate();
  const api = useMemo(() => createApiClient(), []);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [location, setLocation] = useState<Location | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [stagePosition, setStagePosition] = useState<StagePosition>("top");
  const [seats, setSeats] = useState<EditableSeat[]>([]);
  const [floors, setFloors] = useState<EditableFloor[]>([
    { floorId: "floor-1", name: "Main Floor", order: 0 },
  ]);
  const [activeFloorId, setActiveFloorId] = useState<string>("floor-1");

  const [tool, setTool] = useState<BuilderTool>("select");
  const [gridSize, setGridSize] = useState<number>(24);
  const [snapToGrid, setSnapToGrid] = useState<boolean>(true);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showSeatText, setShowSeatText] = useState<boolean>(true);
  const [showAllFloors, setShowAllFloors] = useState<boolean>(false);

  const [view, setView] = useState<ViewState>({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  });

  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragSeatIdRef = useRef<string | null>(null);
  const dragStartRef = useRef<{
    seatId: string;
    x: number;
    y: number;
    startX: number;
    startY: number;
  } | null>(null);
  const panStartRef = useRef<{
    x: number;
    y: number;
    startOffsetX: number;
    startOffsetY: number;
  } | null>(null);
  const spaceDownRef = useRef(false);

  const [newSectionName, setNewSectionName] = useState("Main");
  const [newSectionRows, setNewSectionRows] = useState(10);
  const [newSectionSeatsPerRow, setNewSectionSeatsPerRow] = useState(12);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!layoutId) return;
      setLoading(true);
      setError(null);
      try {
        const layoutRes = await api.getSeatingLayout(layoutId);
        if (cancelled) return;

        const layout = layoutRes.layout;
        setName(layout.name);
        setDescription(layout.description ?? "");
        setStagePosition((layout.stagePosition ?? "top") as StagePosition);

        const loadedFloors = ensureDefaultFloor(
          (layout.floors as EditableFloor[] | undefined) ?? undefined,
        );
        setFloors(loadedFloors);
        const defaultFloorId = loadedFloors[0]?.floorId || "floor-1";
        setActiveFloorId(defaultFloorId);

        setSeats(
          normalizeSeatPositions(
            (layout.seats as EditableSeat[]) ?? [],
            defaultFloorId,
            gridSize,
          ),
        );

        if (locationId) {
          const myLocations = await api.listMyStageLocations();
          if (cancelled) return;
          setLocation(myLocations.find((l) => l.id === locationId) ?? null);
        }
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [api, layoutId, locationId, gridSize]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code === "Space") {
        spaceDownRef.current = true;
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code === "Space") {
        spaceDownRef.current = false;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    // On first paint after loading, center origin in the viewport.
    if (!viewportRef.current) return;
    const el = viewportRef.current;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    setView((prev) => {
      if (prev.offsetX !== 0 || prev.offsetY !== 0) return prev;
      return { ...prev, offsetX: rect.width / 2, offsetY: rect.height / 2 };
    });
  }, [loading]);

  const selectedSeat = selectedSeatId
    ? (seats.find((s) => s.seatId === selectedSeatId) ?? null)
    : null;

  const visibleSeats = useMemo(() => {
    if (showAllFloors) return seats;
    return seats.filter((s) => (s.floorId || activeFloorId) === activeFloorId);
  }, [seats, activeFloorId, showAllFloors]);

  function updateSeat(seatId: string, patch: Partial<EditableSeat>) {
    setSeats((prev) =>
      prev.map((s) => (s.seatId === seatId ? { ...s, ...patch } : s)),
    );
  }

  function deleteSeat(seatId: string) {
    setSeats((prev) => prev.filter((s) => s.seatId !== seatId));
    if (selectedSeatId === seatId) setSelectedSeatId(null);
  }

  function addSeat() {
    const id = `seat-${Date.now()}`;
    setSeats((prev) => [
      ...prev,
      {
        seatId: id,
        section: newSectionName.trim() || "Main",
        row: "A",
        seatNumber: String(prev.length + 1),
        floorId: activeFloorId,
        posX: 0,
        posY: 0,
        isAvailable: true,
      },
    ]);
    setSelectedSeatId(id);
  }

  function generateSection() {
    const section = newSectionName.trim() || "Main";
    const rows = Math.max(1, Math.min(52, Number(newSectionRows) || 1));
    const perRow = Math.max(
      1,
      Math.min(80, Number(newSectionSeatsPerRow) || 1),
    );

    const existingSectionKeys = new Set(
      seats
        .filter((s) => (s.floorId || activeFloorId) === activeFloorId)
        .map((s) => `${s.floorId || activeFloorId}::${s.section}`),
    );
    const sectionIndex = Array.from(existingSectionKeys).filter(Boolean).length;
    const sectionGap = gridSize * 6;
    const blockTopY = sectionIndex * (rows * gridSize + sectionGap);

    const startX = -((perRow - 1) * gridSize) / 2;
    const startY = -((rows - 1) * gridSize) / 2 + blockTopY;

    const generated: EditableSeat[] = [];

    for (let r = 0; r < rows; r++) {
      const rowLetter = toRowName(r);
      const y = startY + r * gridSize;
      for (let s = 1; s <= perRow; s++) {
        const x = startX + (s - 1) * gridSize;
        const seatId = `${activeFloorId}-${section}-${rowLetter}-${s}`.replace(
          /\s+/g,
          "-",
        );
        generated.push({
          seatId,
          section,
          floorId: activeFloorId,
          row: rowLetter,
          seatNumber: String(s),
          posX: x,
          posY: y,
          isAvailable: true,
        });
      }
    }

    setSeats((prev) => {
      const existingIds = new Set(prev.map((p) => p.seatId));
      const deduped = generated.filter((g) => !existingIds.has(g.seatId));
      return [...prev, ...deduped];
    });
  }

  async function handleSave() {
    if (!layoutId) return;
    setSaving(true);
    setSaveError(null);
    setSaveOk(false);

    try {
      const sections = computeSectionsFromSeats(seats);
      await api.updateSeatingLayout(layoutId, {
        name: name.trim() || "Seating",
        description: description.trim() || undefined,
        stagePosition,
        floors,
        sections,
        seats,
      });
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 2500);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  function screenToWorld(
    e: React.PointerEvent | WheelEvent,
  ): { x: number; y: number } | null {
    const el = viewportRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const screenX = ("clientX" in e ? e.clientX : 0) - rect.left;
    const screenY = ("clientY" in e ? e.clientY : 0) - rect.top;
    return {
      x: (screenX - view.offsetX) / view.scale,
      y: (screenY - view.offsetY) / view.scale,
    };
  }

  function handleSeatPointerDown(e: React.PointerEvent, seatId: string) {
    if (tool === "pan" || spaceDownRef.current) return;
    const world = screenToWorld(e);
    if (!world) return;

    const seat = seats.find((s) => s.seatId === seatId);
    if (!seat) return;

    dragSeatIdRef.current = seatId;
    dragStartRef.current = {
      seatId,
      x: world.x,
      y: world.y,
      startX: typeof seat.posX === "number" ? seat.posX : 0,
      startY: typeof seat.posY === "number" ? seat.posY : 0,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handleViewportPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    if (!(tool === "pan" || spaceDownRef.current)) return;

    panStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startOffsetX: view.offsetX,
      startOffsetY: view.offsetY,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handleViewportPointerMove(e: React.PointerEvent) {
    const pan = panStartRef.current;
    if (pan) {
      const dx = e.clientX - pan.x;
      const dy = e.clientY - pan.y;
      setView((prev) => ({
        ...prev,
        offsetX: pan.startOffsetX + dx,
        offsetY: pan.startOffsetY + dy,
      }));
      return;
    }

    const drag = dragStartRef.current;
    if (!drag) return;
    const world = screenToWorld(e);
    if (!world) return;

    const dx = world.x - drag.x;
    const dy = world.y - drag.y;
    let nextX = drag.startX + dx;
    let nextY = drag.startY + dy;
    if (snapToGrid) {
      nextX = snap(nextX, gridSize);
      nextY = snap(nextY, gridSize);
    }
    updateSeat(drag.seatId, { posX: nextX, posY: nextY });
  }

  function handleViewportPointerUp() {
    dragSeatIdRef.current = null;
    dragStartRef.current = null;
    panStartRef.current = null;
  }

  function handleWheel(e: React.WheelEvent) {
    // macOS pinch-to-zoom often sets ctrlKey.
    const zoomIntent = e.ctrlKey || e.metaKey;
    if (!zoomIntent) return;
    e.preventDefault();

    const el = viewportRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    const worldX = (screenX - view.offsetX) / view.scale;
    const worldY = (screenY - view.offsetY) / view.scale;

    const delta = -e.deltaY;
    const zoomFactor = Math.exp(delta / 500);
    const nextScale = clamp(view.scale * zoomFactor, 0.25, 3);

    const nextOffsetX = screenX - worldX * nextScale;
    const nextOffsetY = screenY - worldY * nextScale;
    setView({ scale: nextScale, offsetX: nextOffsetX, offsetY: nextOffsetY });
  }

  function autoLabelActiveFloor() {
    setSeats((prev) => {
      const floorId = activeFloorId;
      const updated = [...prev];
      const indices = updated
        .map((seat, idx) => ({ seat, idx }))
        .filter(({ seat }) => (seat.floorId || floorId) === floorId);

      const bySection = new Map<
        string,
        Array<{ seat: EditableSeat; idx: number }>
      >();
      for (const item of indices) {
        const section = item.seat.section || "Main";
        if (!bySection.has(section)) bySection.set(section, []);
        bySection.get(section)!.push(item);
      }

      for (const [section, items] of bySection) {
        void section;
        // Bucket into rows based on snapped Y.
        const byRowY = new Map<
          number,
          Array<{ seat: EditableSeat; idx: number }>
        >();
        for (const it of items) {
          const y = typeof it.seat.posY === "number" ? it.seat.posY : 0;
          const ry = snapToGrid ? snap(y, gridSize) : y;
          if (!byRowY.has(ry)) byRowY.set(ry, []);
          byRowY.get(ry)!.push(it);
        }

        const sortedRowYs = Array.from(byRowY.keys()).sort((a, b) => a - b);
        sortedRowYs.forEach((rowY, rowIdx) => {
          const rowName = toRowName(rowIdx);
          const rowItems = byRowY.get(rowY)!;
          rowItems.sort((a, b) => {
            const ax = typeof a.seat.posX === "number" ? a.seat.posX : 0;
            const bx = typeof b.seat.posX === "number" ? b.seat.posX : 0;
            return ax - bx;
          });
          rowItems.forEach((it, seatIdx) => {
            updated[it.idx] = {
              ...updated[it.idx],
              row: rowName,
              seatNumber: String(seatIdx + 1),
            };
          });
        });
      }

      return updated;
    });
  }

  if (loading) {
    return (
      <HostDashboardShell title="Seat map editor" subtitle="Loading...">
        <p className={ui.help}>Loading seat map…</p>
      </HostDashboardShell>
    );
  }

  const scaledGrid = Math.max(8, gridSize * view.scale);
  const gridOffsetX = ((view.offsetX % scaledGrid) + scaledGrid) % scaledGrid;
  const gridOffsetY = ((view.offsetY % scaledGrid) + scaledGrid) % scaledGrid;

  return (
    <HostDashboardShell
      title="Seat map editor"
      subtitle={
        location ? `Editing ${location.name}` : "Edit your venue seating"
      }
    >
      <div className={styles.page}>
        {error ? <p className={ui.error}>{error}</p> : null}

        <div className={[ui.card, ui.cardPad, styles.headerCard].join(" ")}>
          <div className={styles.headerLeft}>
            <div className={styles.headerRow}>
              <input
                className={ui.input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Layout name"
              />
              <select
                className={ui.input}
                value={stagePosition}
                onChange={(e) =>
                  setStagePosition(e.target.value as StagePosition)
                }
              >
                <option value="top">Stage: top</option>
                <option value="bottom">Stage: bottom</option>
                <option value="left">Stage: left</option>
                <option value="right">Stage: right</option>
              </select>
            </div>
            <input
              className={ui.input}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optional)"
            />
            <div className={ui.help}>
              Drag seats to place them. Hold Space to pan. Pinch/⌘+scroll to
              zoom.
            </div>
          </div>

          <div className={styles.headerRight}>
            <Button
              variant="secondary"
              onClick={() =>
                navigate(
                  `/venues/${encodeURIComponent(locationId || "")}/seating`,
                )
              }
            >
              Back
            </Button>
            <Button onClick={handleSave} disabled={saving || !layoutId}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>

        {saveError ? <p className={ui.error}>{saveError}</p> : null}
        {saveOk ? (
          <p className={ui.help} style={{ color: "var(--success)" }}>
            Saved.
          </p>
        ) : null}

        <div className={styles.grid}>
          <div className={[ui.card, styles.viewportCard].join(" ")}>
            <div className={styles.viewportToolbar}>
              <div className={styles.floors}>
                {stableSortFloors(floors).map((f) => (
                  <button
                    key={f.floorId}
                    type="button"
                    className={styles.floorTab}
                    data-active={f.floorId === activeFloorId}
                    onClick={() => setActiveFloorId(f.floorId)}
                  >
                    {f.name}
                  </button>
                ))}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const id = `floor-${Date.now()}`;
                    setFloors((prev) =>
                      stableSortFloors([
                        ...prev,
                        { floorId: id, name: "New floor", order: prev.length },
                      ]),
                    );
                    setActiveFloorId(id);
                  }}
                >
                  + Floor
                </Button>
              </div>

              <div className={styles.tools}>
                <Button
                  size="sm"
                  variant={tool === "select" ? "secondary" : "ghost"}
                  onClick={() => setTool("select")}
                >
                  Select
                </Button>
                <Button
                  size="sm"
                  variant={tool === "pan" ? "secondary" : "ghost"}
                  onClick={() => setTool("pan")}
                >
                  Pan
                </Button>
                <select
                  className={ui.input}
                  value={gridSize}
                  onChange={(e) => setGridSize(Number(e.target.value) || 24)}
                  style={{ height: 30, paddingTop: 0, paddingBottom: 0 }}
                  aria-label="Grid size"
                >
                  {[16, 20, 24, 28, 32, 40, 48].map((n) => (
                    <option key={n} value={n}>
                      Grid {n}
                    </option>
                  ))}
                </select>
                <label className={styles.toggle}>
                  <input
                    type="checkbox"
                    checked={showGrid}
                    onChange={(e) => setShowGrid(e.target.checked)}
                  />
                  Grid
                </label>
                <label className={styles.toggle}>
                  <input
                    type="checkbox"
                    checked={snapToGrid}
                    onChange={(e) => setSnapToGrid(e.target.checked)}
                  />
                  Snap
                </label>
                <label className={styles.toggle}>
                  <input
                    type="checkbox"
                    checked={showSeatText}
                    onChange={(e) => setShowSeatText(e.target.checked)}
                  />
                  Labels
                </label>
              </div>
            </div>

            <div
              ref={viewportRef}
              className={styles.viewport}
              onPointerDown={handleViewportPointerDown}
              onPointerMove={handleViewportPointerMove}
              onPointerUp={handleViewportPointerUp}
              onPointerCancel={handleViewportPointerUp}
              onWheel={handleWheel}
              style={{
                backgroundImage: showGrid
                  ? `linear-gradient(to right, color-mix(in srgb, var(--border) 55%, transparent) 1px, transparent 1px),\n                     linear-gradient(to bottom, color-mix(in srgb, var(--border) 55%, transparent) 1px, transparent 1px)`
                  : undefined,
                backgroundSize: `${scaledGrid}px ${scaledGrid}px`,
                backgroundPosition: `${gridOffsetX}px ${gridOffsetY}px`,
              }}
            >
              {location?.imageUrl ? (
                <img
                  src={getAssetUrl(location.imageUrl)}
                  alt=""
                  className={styles.venueImage}
                />
              ) : null}

              {/* Stage */}
              <div className={styles.stage} data-position={stagePosition}>
                Stage
              </div>

              {/* Seats */}
              <div
                className={styles.world}
                style={{
                  transform: `translate(${view.offsetX}px, ${view.offsetY}px) scale(${view.scale})`,
                }}
              >
                {visibleSeats.map((s) => {
                  const active = s.seatId === selectedSeatId;
                  const x = typeof s.posX === "number" ? s.posX : 0;
                  const y = typeof s.posY === "number" ? s.posY : 0;

                  return (
                    <button
                      key={s.seatId}
                      type="button"
                      onClick={() => setSelectedSeatId(s.seatId)}
                      onPointerDown={(e) => handleSeatPointerDown(e, s.seatId)}
                      className={styles.seat}
                      data-active={active}
                      data-available={s.isAvailable}
                      style={{
                        transform: `translate(${x}px, ${y}px) translate(-50%, -50%)`,
                      }}
                      title={`${s.section} ${s.row}${s.seatNumber}`}
                    >
                      {showSeatText ? (
                        <span className={styles.seatText}>
                          {s.row}
                          {s.seatNumber}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <aside className={[ui.card, ui.cardPad].join(" ")}>
            <h3
              className={ui.sectionTitle}
              style={{ marginBottom: spacing.sm }}
            >
              Tools
            </h3>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: spacing.md,
              }}
            >
              <div>
                <div className={ui.help} style={{ marginBottom: 6 }}>
                  View
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      if (!viewportRef.current) return;
                      const rect = viewportRef.current.getBoundingClientRect();
                      setView({
                        scale: 1,
                        offsetX: rect.width / 2,
                        offsetY: rect.height / 2,
                      });
                    }}
                  >
                    Reset view
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setView((prev) => ({ ...prev, scale: 1 }));
                    }}
                  >
                    100%
                  </Button>
                </div>
              </div>

              <div className={ui.divider} />

              <div>
                <div className={ui.help} style={{ marginBottom: 6 }}>
                  Floor
                </div>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                  <select
                    className={ui.input}
                    value={activeFloorId}
                    onChange={(e) => setActiveFloorId(e.target.value)}
                  >
                    {stableSortFloors(floors).map((f) => (
                      <option key={f.floorId} value={f.floorId}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                  <label
                    className={ui.help}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      paddingLeft: 4,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={showAllFloors}
                      onChange={(e) => setShowAllFloors(e.target.checked)}
                    />
                    Show all floors
                  </label>
                </div>
              </div>

              <div className={ui.divider} />

              <div>
                <div className={ui.help} style={{ marginBottom: 6 }}>
                  Quick generator
                </div>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                  <input
                    className={ui.input}
                    value={newSectionName}
                    onChange={(e) => setNewSectionName(e.target.value)}
                    placeholder="Section name"
                  />
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 8,
                    }}
                  >
                    <input
                      className={ui.input}
                      type="number"
                      min={1}
                      value={newSectionRows}
                      onChange={(e) =>
                        setNewSectionRows(Number(e.target.value))
                      }
                      placeholder="Rows"
                    />
                    <input
                      className={ui.input}
                      type="number"
                      min={1}
                      value={newSectionSeatsPerRow}
                      onChange={(e) =>
                        setNewSectionSeatsPerRow(Number(e.target.value))
                      }
                      placeholder="Seats/row"
                    />
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
                </div>
              </div>

              <div className={ui.divider} />

              <div>
                <div className={ui.help} style={{ marginBottom: 6 }}>
                  Labeling
                </div>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={autoLabelActiveFloor}
                  >
                    Auto-label active floor
                  </Button>
                  <div className={ui.help}>
                    Uses seat Y to form rows (A, B, C…) and seat X to number
                    left→right.
                  </div>
                </div>
              </div>

              <div className={ui.divider} />

              <div>
                <div className={ui.help} style={{ marginBottom: 6 }}>
                  Selected seat
                </div>

                {!selectedSeat ? (
                  <p className={ui.help}>Click a seat to edit.</p>
                ) : (
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 8 }}
                  >
                    <div className={ui.cardText}>
                      <strong>{selectedSeat.seatId}</strong>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 8,
                      }}
                    >
                      <input
                        className={ui.input}
                        value={selectedSeat.section}
                        onChange={(e) =>
                          updateSeat(selectedSeat.seatId, {
                            section: e.target.value,
                          })
                        }
                        placeholder="Section"
                      />
                      <input
                        className={ui.input}
                        value={selectedSeat.row}
                        onChange={(e) =>
                          updateSeat(selectedSeat.seatId, {
                            row: e.target.value,
                          })
                        }
                        placeholder="Row"
                      />
                      <input
                        className={ui.input}
                        value={selectedSeat.seatNumber}
                        onChange={(e) =>
                          updateSeat(selectedSeat.seatId, {
                            seatNumber: e.target.value,
                          })
                        }
                        placeholder="Seat #"
                      />
                      <select
                        className={ui.input}
                        value={selectedSeat.floorId || activeFloorId}
                        onChange={(e) =>
                          updateSeat(selectedSeat.seatId, {
                            floorId: e.target.value,
                          })
                        }
                      >
                        {stableSortFloors(floors).map((f) => (
                          <option key={f.floorId} value={f.floorId}>
                            {f.name}
                          </option>
                        ))}
                      </select>
                      <label
                        className={ui.help}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          paddingLeft: 4,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedSeat.isAvailable}
                          onChange={(e) =>
                            updateSeat(selectedSeat.seatId, {
                              isAvailable: e.target.checked,
                            })
                          }
                        />
                        Available
                      </label>
                    </div>

                    <div style={{ display: "flex", gap: 8 }}>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          updateSeat(selectedSeat.seatId, { posX: 0, posY: 0 });
                        }}
                      >
                        Center
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteSeat(selectedSeat.seatId)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <div className={ui.divider} />

              <div className={ui.help}>
                Total seats:{" "}
                <strong style={{ color: "var(--text)" }}>{seats.length}</strong>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </HostDashboardShell>
  );
}

export default SeatLayoutEditorPage;
