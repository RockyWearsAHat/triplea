import { useEffect, useMemo, useRef, useState } from "react";
import type { Location } from "@shared";
import { Button, spacing } from "@shared";
import ui from "@shared/styles/primitives.module.scss";
import { useNavigate, useParams } from "react-router-dom";
import { useBeforeUnload, useBlocker } from "react-router";
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
  rowGroupId?: string;
  detachedFromRow?: boolean;
};

type LayoutElement = {
  elementId: string;
  type: "aisle";
  floorId?: string;
  orientation: "vertical" | "horizontal";
  x: number;
  y: number;
  length: number;
  thickness: number;
  label?: string;
};

type StageConfig = {
  x: number;
  y: number;
  width: number;
  height: number;
  shape?: "rect" | "rounded";
  cornerRadius?: number;
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

type BuilderTool =
  | "select"
  | "pan"
  | "row"
  | "measure"
  | "stage"
  | "aisle"
  | "path";

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
  // Keep placements aligned to the 1ft grid.
  const startX = -Math.floor(cols / 2) * gridSize;
  const startY = -Math.floor(rows / 2) * gridSize;

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

function quantizeAngle45(rad: number): number {
  const step = Math.PI / 4;
  return Math.round(rad / step) * step;
}

function closestPointOnRectEdge(
  p: { x: number; y: number },
  rect: { left: number; right: number; top: number; bottom: number },
): { x: number; y: number } {
  const cx = Math.max(rect.left, Math.min(rect.right, p.x));
  const cy = Math.max(rect.top, Math.min(rect.bottom, p.y));
  const dLeft = Math.abs(p.x - rect.left);
  const dRight = Math.abs(p.x - rect.right);
  const dTop = Math.abs(p.y - rect.top);
  const dBottom = Math.abs(p.y - rect.bottom);

  const m = Math.min(dLeft, dRight, dTop, dBottom);
  if (m === dLeft) return { x: rect.left, y: cy };
  if (m === dRight) return { x: rect.right, y: cy };
  if (m === dTop) return { x: cx, y: rect.top };
  return { x: cx, y: rect.bottom };
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function formatFeet(feet: number): string {
  if (!isFinite(feet)) return "—";
  if (feet < 10) return `${feet.toFixed(1)} ft`;
  return `${Math.round(feet)} ft`;
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

  const allowNavigationRef = useRef(false);
  const savedSnapshotRef = useRef<string>("");

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
  // 1 tile = 1ft. We represent 1ft as 24 "world" units.
  const [gridSize] = useState<number>(24);
  const [snapToGrid, setSnapToGrid] = useState<boolean>(true);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showSeatText, setShowSeatText] = useState<boolean>(true);
  const [showAllFloors, setShowAllFloors] = useState<boolean>(false);
  const [toolsOpen, setToolsOpen] = useState<boolean>(false);

  const [seatSizeFeet, setSeatSizeFeet] = useState<number>(2.5);
  const [seatPitchFeet, setSeatPitchFeet] = useState<number>(3);

  const [elements, setElements] = useState<LayoutElement[]>([]);
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string>("");
  const [showBackgroundImage, setShowBackgroundImage] =
    useState<boolean>(false);

  const [stage, setStage] = useState<StageConfig>({
    x: 0,
    y: -10 * 24,
    width: 24 * 20,
    height: 24 * 6,
    shape: "rounded",
    cornerRadius: 24,
  });

  const [view, setView] = useState<ViewState>({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  });

  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null);
  const [selectedRowGroupId, setSelectedRowGroupId] = useState<string | null>(
    null,
  );
  const [selectedElementId, setSelectedElementId] = useState<string | null>(
    null,
  );

  const [measure, setMeasure] = useState<{
    start: { x: number; y: number };
    end: { x: number; y: number };
    floorId: string;
    done?: boolean;
  } | null>(null);

  const [pathDraft, setPathDraft] = useState<{
    points: Array<{ x: number; y: number }>;
    floorId: string;
  } | null>(null);
  const [pathHover, setPathHover] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [pathSpacingFeet, setPathSpacingFeet] = useState<number>(0);
  const [pathSeatCount, setPathSeatCount] = useState<number>(0);

  const [rowDraft, setRowDraft] = useState<{
    start: { x: number; y: number };
    end: { x: number; y: number };
    floorId: string;
  } | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);

  function getLayoutSnapshotString(args?: {
    name?: string;
    description?: string;
    stagePosition?: StagePosition;
    floors?: EditableFloor[];
    elements?: LayoutElement[];
    backgroundImageUrl?: string;
    stage?: StageConfig;
    seats?: EditableSeat[];
  }): string {
    const snapshot = {
      name: (args?.name ?? name).trim() || "Seating",
      description: (args?.description ?? description).trim() || "",
      stagePosition: args?.stagePosition ?? stagePosition,
      floors: args?.floors ?? floors,
      elements: args?.elements ?? elements,
      backgroundImageUrl: (args?.backgroundImageUrl ?? backgroundImageUrl)
        .trim()
        .toString(),
      stage: args?.stage ?? stage,
      seats: args?.seats ?? seats,
    };

    return JSON.stringify(snapshot);
  }

  function hasUnsavedChanges(): boolean {
    if (!savedSnapshotRef.current) return false;
    return getLayoutSnapshotString() !== savedSnapshotRef.current;
  }

  function navigateToVenueLayouts() {
    allowNavigationRef.current = true;
    navigate(`/venues/${encodeURIComponent(locationId || "")}/seating`);
  }

  function handleDone() {
    if (hasUnsavedChanges()) {
      const ok = window.confirm(
        "You have unsaved changes. Exit the seat editor without saving?",
      );
      if (!ok) return;
    }
    navigateToVenueLayouts();
  }

  useBeforeUnload((event) => {
    if (!hasUnsavedChanges()) return;
    event.preventDefault();
    event.returnValue = "";
  });

  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (allowNavigationRef.current) return false;
    if (currentLocation.pathname === nextLocation.pathname) return false;
    return hasUnsavedChanges();
  });

  useEffect(() => {
    if (blocker.state !== "blocked") return;
    const ok = window.confirm(
      "You have unsaved changes. Leave this page without saving?",
    );
    if (ok) {
      allowNavigationRef.current = true;
      blocker.proceed();
    } else {
      blocker.reset();
    }
  }, [blocker]);

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

  const dragRowRef = useRef<{
    rowGroupId: string;
    startWorld: { x: number; y: number };
    seatStarts: Map<string, { x: number; y: number }>;
  } | null>(null);

  const dragStageRef = useRef<{
    startWorld: { x: number; y: number };
    startStage: StageConfig;
  } | null>(null);

  const dragElementRef = useRef<{
    elementId: string;
    startWorld: { x: number; y: number };
    startEl: LayoutElement;
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

        const loadedName = layout.name;
        const loadedDescription = layout.description ?? "";
        const loadedStagePosition = (layout.stagePosition ??
          "top") as StagePosition;
        const loadedElements = ((layout as any).elements ??
          []) as LayoutElement[];
        const loadedBackgroundImageUrl = ((layout as any).backgroundImageUrl ??
          "") as string;
        const loadedStage = ((layout as any).stage ?? stage) as StageConfig;

        const loadedFloors = ensureDefaultFloor(
          (layout.floors as EditableFloor[] | undefined) ?? undefined,
        );
        const defaultFloorId = loadedFloors[0]?.floorId || "floor-1";
        const normalizedSeats = normalizeSeatPositions(
          (layout.seats as EditableSeat[]) ?? [],
          defaultFloorId,
          gridSize,
        );

        setName(loadedName);
        setDescription(loadedDescription);
        setStagePosition(loadedStagePosition);
        setElements(loadedElements);
        setBackgroundImageUrl(loadedBackgroundImageUrl);
        setStage(loadedStage);
        setFloors(loadedFloors);
        setActiveFloorId(defaultFloorId);
        setSeats(normalizedSeats);

        savedSnapshotRef.current = getLayoutSnapshotString({
          name: loadedName,
          description: loadedDescription,
          stagePosition: loadedStagePosition,
          floors: loadedFloors,
          elements: loadedElements,
          backgroundImageUrl: loadedBackgroundImageUrl,
          stage: loadedStage,
          seats: normalizedSeats,
        });

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

  const visibleElements = useMemo(() => {
    if (showAllFloors) return elements;
    return elements.filter(
      (e) => (e.floorId || activeFloorId) === activeFloorId,
    );
  }, [elements, activeFloorId, showAllFloors]);

  const selectedRowSeats = useMemo(() => {
    if (!selectedRowGroupId) return [];
    return seats.filter((s) => s.rowGroupId === selectedRowGroupId);
  }, [seats, selectedRowGroupId]);

  function updateSeat(seatId: string, patch: Partial<EditableSeat>) {
    setSeats((prev) =>
      prev.map((s) => (s.seatId === seatId ? { ...s, ...patch } : s)),
    );
  }

  function updateRow(
    rowGroupId: string,
    patchFn: (s: EditableSeat) => EditableSeat,
  ) {
    setSeats((prev) =>
      prev.map((s) => (s.rowGroupId === rowGroupId ? patchFn(s) : s)),
    );
  }

  function reflowSelectedRow() {
    if (!selectedRowGroupId) return;
    const rowSeats = seats
      .filter((s) => s.rowGroupId === selectedRowGroupId)
      .filter((s) => !s.detachedFromRow);

    if (rowSeats.length < 2) return;
    const sorted = [...rowSeats].sort((a, b) => {
      const na = Number.parseInt(a.seatNumber, 10);
      const nb = Number.parseInt(b.seatNumber, 10);
      if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
      return a.seatNumber.localeCompare(b.seatNumber);
    });

    const first = sorted[0]!;
    const last = sorted[sorted.length - 1]!;
    const ax = typeof first.posX === "number" ? first.posX : 0;
    const ay = typeof first.posY === "number" ? first.posY : 0;
    const bx = typeof last.posX === "number" ? last.posX : ax + gridSize;
    const by = typeof last.posY === "number" ? last.posY : ay;

    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.max(1e-6, Math.sqrt(dx * dx + dy * dy));
    const ux = dx / len;
    const uy = dy / len;

    const pitchPx = Math.max(gridSize, seatPitchFeet * gridSize);
    const start = { x: ax, y: ay };

    const indexById = new Map(sorted.map((s, i) => [s.seatId, i]));
    updateRow(selectedRowGroupId, (s) => {
      if (s.detachedFromRow) return s;
      const i = indexById.get(s.seatId);
      if (i === undefined) return s;
      let nx = start.x + ux * pitchPx * i;
      let ny = start.y + uy * pitchPx * i;
      if (snapToGrid) {
        nx = snap(nx, gridSize);
        ny = snap(ny, gridSize);
      }
      return { ...s, posX: nx, posY: ny };
    });
  }

  function clearArrangement() {
    if (
      !window.confirm(
        "Clear all seats and aisle guides? This cannot be undone.",
      )
    ) {
      return;
    }
    setSeats([]);
    setElements([]);
    setSelectedSeatId(null);
    setSelectedRowGroupId(null);
    setSelectedElementId(null);
    setMeasure(null);
    setRowDraft(null);
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

    // Keep generator aligned to the 1ft grid.
    const startX = -Math.floor(perRow / 2) * gridSize;
    const startY = -Math.floor(rows / 2) * gridSize + blockTopY;

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
        elements,
        backgroundImageUrl: backgroundImageUrl.trim() || undefined,
        stage,
        sections,
        seats,
      });
      savedSnapshotRef.current = getLayoutSnapshotString();
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

  function getNearestObjectSnapPoint(
    p: { x: number; y: number },
    floorId: string,
  ): { x: number; y: number } | null {
    const snapThreshold = 0.85 * gridSize; // ~0.85ft
    let best: { x: number; y: number } | null = null;
    let bestD = Number.POSITIVE_INFINITY;

    const seatW = seatSizeFeet * gridSize;
    const seatH = seatSizeFeet * gridSize;

    for (const s of seats) {
      if ((s.floorId || activeFloorId) !== floorId) continue;
      const cx = typeof s.posX === "number" ? s.posX : 0;
      const cy = typeof s.posY === "number" ? s.posY : 0;
      const rect = {
        left: cx - seatW / 2,
        right: cx + seatW / 2,
        top: cy - seatH / 2,
        bottom: cy + seatH / 2,
      };
      const q = closestPointOnRectEdge(p, rect);
      const d = dist(p, q);
      if (d < bestD) {
        bestD = d;
        best = q;
      }
    }

    for (const el of elements) {
      if (el.type !== "aisle") continue;
      if ((el.floorId || activeFloorId) !== floorId) continue;
      const w = el.orientation === "vertical" ? el.thickness : el.length;
      const h = el.orientation === "vertical" ? el.length : el.thickness;
      const rect = {
        left: el.x - w / 2,
        right: el.x + w / 2,
        top: el.y - h / 2,
        bottom: el.y + h / 2,
      };
      const q = closestPointOnRectEdge(p, rect);
      const d = dist(p, q);
      if (d < bestD) {
        bestD = d;
        best = q;
      }
    }

    if (floorId === activeFloorId) {
      const rect = {
        left: stage.x - stage.width / 2,
        right: stage.x + stage.width / 2,
        top: stage.y - stage.height / 2,
        bottom: stage.y + stage.height / 2,
      };
      const q = closestPointOnRectEdge(p, rect);
      const d = dist(p, q);
      if (d < bestD) {
        bestD = d;
        best = q;
      }
    }

    if (!best || bestD > snapThreshold) return null;
    return best;
  }

  function applyMeasureModifiers(
    raw: { x: number; y: number },
    start: { x: number; y: number } | null,
    e: Pick<React.PointerEvent, "altKey" | "metaKey" | "shiftKey">,
  ): { x: number; y: number } {
    let p = raw;

    if (start && e.shiftKey) {
      const dx = p.x - start.x;
      const dy = p.y - start.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 1e-6) {
        const a = quantizeAngle45(Math.atan2(dy, dx));
        p = { x: start.x + Math.cos(a) * len, y: start.y + Math.sin(a) * len };
      }
    }

    // Cmd = fully freehand: no snapping/nudging.
    if (e.metaKey) return p;

    // Alt = force grid snap (no object nudging).
    if (e.altKey) {
      return { x: snap(p.x, gridSize), y: snap(p.y, gridSize) };
    }

    // Default = nudge to nearest object edge when close.
    return getNearestObjectSnapPoint(p, activeFloorId) ?? p;
  }

  function polylineLength(points: Array<{ x: number; y: number }>): number {
    let sum = 0;
    for (let i = 1; i < points.length; i++) {
      sum += dist(points[i - 1]!, points[i]!);
    }
    return sum;
  }

  function minNonOverlapSpacingFeetForAngle(angleRad: number): number {
    const c = Math.abs(Math.cos(angleRad));
    const s = Math.abs(Math.sin(angleRad));
    const maxComp = Math.max(1e-6, Math.max(c, s));
    return seatSizeFeet / maxComp;
  }

  function computeAutoPathSpacingFeet(points: Array<{ x: number; y: number }>) {
    let worst = seatSizeFeet;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1]!;
      const b = points[i]!;
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      worst = Math.max(worst, minNonOverlapSpacingFeetForAngle(ang));
    }
    return worst;
  }

  function samplePolyline(
    points: Array<{ x: number; y: number }>,
    spacingPx: number,
  ): Array<{ x: number; y: number }> {
    if (points.length < 2 || !(spacingPx > 0)) return [];
    const out: Array<{ x: number; y: number }> = [points[0]!];
    let carried = 0;

    for (let i = 1; i < points.length; i++) {
      let a = points[i - 1]!;
      const b = points[i]!;
      let segLen = dist(a, b);
      if (segLen < 1e-6) continue;
      const ux = (b.x - a.x) / segLen;
      const uy = (b.y - a.y) / segLen;

      while (carried + segLen >= spacingPx) {
        const need = spacingPx - carried;
        const nx = a.x + ux * need;
        const ny = a.y + uy * need;
        out.push({ x: nx, y: ny });
        a = { x: nx, y: ny };
        segLen = dist(a, b);
        carried = 0;
        if (segLen < 1e-6) break;
      }

      carried += segLen;
    }

    return out;
  }

  function generateSeatsAlongPath(opts: {
    points: Array<{ x: number; y: number }>;
    floorId: string;
    spacingFeet?: number;
    count?: number;
  }) {
    if (opts.points.length < 2) return;
    const totalPx = polylineLength(opts.points);
    const totalFeet = totalPx / gridSize;
    const autoSpacingFeet = computeAutoPathSpacingFeet(opts.points);

    let spacingFeet = opts.spacingFeet ?? 0;
    const count = opts.count ?? 0;
    if (count >= 2) {
      spacingFeet = totalFeet / (count - 1);
      if (spacingFeet < autoSpacingFeet) {
        // Largest seat size that fits at this spacing across the worst segment direction.
        let maxComp = 0.000001;
        for (let i = 1; i < opts.points.length; i++) {
          const a = opts.points[i - 1]!;
          const b = opts.points[i]!;
          const ang = Math.atan2(b.y - a.y, b.x - a.x);
          maxComp = Math.max(
            maxComp,
            Math.max(Math.abs(Math.cos(ang)), Math.abs(Math.sin(ang))),
          );
        }
        const maxSeatSize = spacingFeet * maxComp;
        const ok = window.confirm(
          `These ${count} seats would overlap at the current seat size (${seatSizeFeet.toFixed(2)} ft).\n\nResize seats automatically to ~${maxSeatSize.toFixed(2)} ft to fit?`,
        );
        if (!ok) return;
        // Snap to quarter-foot increments.
        setSeatSizeFeet(Math.max(1, Math.floor(maxSeatSize * 4) / 4));
      }
    }

    if (!(spacingFeet > 0)) spacingFeet = Math.max(0.5, autoSpacingFeet);
    const spacingPx = spacingFeet * gridSize;
    const centers = samplePolyline(opts.points, spacingPx);
    if (centers.length < 2) return;

    const section = newSectionName.trim() || "Main";
    const stamp = Date.now();
    const generated: EditableSeat[] = centers.map((c, idx) => {
      let x = c.x;
      let y = c.y;
      if (snapToGrid) {
        x = snap(x, gridSize);
        y = snap(y, gridSize);
      }
      return {
        seatId: `path-${opts.floorId}-${stamp}-${idx + 1}`,
        section,
        floorId: opts.floorId,
        row: "P",
        seatNumber: String(idx + 1),
        posX: x,
        posY: y,
        isAvailable: true,
      };
    });

    setSeats((prev) => [...prev, ...generated]);
    setSelectedSeatId(generated[0]?.seatId ?? null);
  }

  function finalizePathDraft() {
    if (!pathDraft || pathDraft.points.length < 2) return;
    const points = [...pathDraft.points];

    const count = pathSeatCount >= 2 ? pathSeatCount : undefined;
    const spacingFeet = pathSpacingFeet > 0 ? pathSpacingFeet : undefined;
    generateSeatsAlongPath({
      points,
      floorId: pathDraft.floorId,
      count,
      spacingFeet,
    });
    setPathDraft(null);
    setPathHover(null);
  }

  function handleSeatPointerDown(e: React.PointerEvent, seatId: string) {
    if (
      tool === "pan" ||
      tool === "measure" ||
      tool === "path" ||
      tool === "aisle" ||
      tool === "stage" ||
      spaceDownRef.current
    )
      return;
    const world = screenToWorld(e);
    if (!world) return;

    const seat = seats.find((s) => s.seatId === seatId);
    if (!seat) return;

    if (tool === "row") {
      const rowGroupId = seat.rowGroupId;
      if (!rowGroupId) {
        setSelectedSeatId(seatId);
        return;
      }
      setSelectedRowGroupId(rowGroupId);
      setSelectedSeatId(seatId);
      setSelectedElementId(null);

      const seatStarts = new Map<string, { x: number; y: number }>();
      for (const s of seats) {
        if (s.rowGroupId !== rowGroupId) continue;
        if (s.detachedFromRow) continue;
        seatStarts.set(s.seatId, {
          x: typeof s.posX === "number" ? s.posX : 0,
          y: typeof s.posY === "number" ? s.posY : 0,
        });
      }
      dragRowRef.current = { rowGroupId, startWorld: world, seatStarts };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }

    // Default: individual seat drag (Alt will effectively let the user pull a seat off-grid)
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

  function handleStagePointerDown(e: React.PointerEvent) {
    if (tool !== "stage") return;
    const world = screenToWorld(e);
    if (!world) return;
    dragStageRef.current = { startWorld: world, startStage: { ...stage } };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handleElementPointerDown(e: React.PointerEvent, elementId: string) {
    if (tool !== "aisle") return;
    const world = screenToWorld(e);
    if (!world) return;
    const el = elements.find((x) => x.elementId === elementId);
    if (!el) return;
    setSelectedElementId(elementId);
    setSelectedSeatId(null);
    setSelectedRowGroupId(null);
    dragElementRef.current = {
      elementId,
      startWorld: world,
      startEl: { ...el },
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handleViewportPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;

    // Measure tool: click once to place point A, click again to place point B.
    if (tool === "measure") {
      const world = screenToWorld(e);
      if (!world) return;
      setMeasure((prev) => {
        if (!prev || prev.done) {
          const p = applyMeasureModifiers(world, null, e);
          return { start: p, end: p, floorId: activeFloorId, done: false };
        }
        const p = applyMeasureModifiers(world, prev.start, e);
        return { ...prev, end: p, done: true };
      });
      return;
    }

    // Path tool: click to add points (double-click will finalize).
    if (tool === "path") {
      const world = screenToWorld(e);
      if (!world) return;
      const p =
        snapToGrid && !e.altKey
          ? { x: snap(world.x, gridSize), y: snap(world.y, gridSize) }
          : world;
      setPathDraft((prev) => {
        if (!prev || prev.floorId !== activeFloorId) {
          return { points: [p], floorId: activeFloorId };
        }
        return { ...prev, points: [...prev.points, p] };
      });
      setPathHover(null);
      return;
    }

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
    const measureDraft = measure && !measure.done ? measure : null;
    if (tool === "measure" && measureDraft) {
      const world = screenToWorld(e);
      if (!world) return;
      const end = applyMeasureModifiers(world, measureDraft.start, e);
      setMeasure((prev) => (prev ? { ...prev, end } : prev));
      return;
    }

    if (tool === "path" && pathDraft) {
      const world = screenToWorld(e);
      if (!world) return;
      const p =
        snapToGrid && !e.altKey
          ? { x: snap(world.x, gridSize), y: snap(world.y, gridSize) }
          : world;
      setPathHover(p);
      return;
    }

    if (tool === "row" && rowDraft) {
      const world = screenToWorld(e);
      if (!world) return;
      const snapped =
        snapToGrid && !e.altKey
          ? { x: snap(world.x, gridSize), y: snap(world.y, gridSize) }
          : world;
      setRowDraft((prev) => (prev ? { ...prev, end: snapped } : prev));
      return;
    }

    const dragRow = dragRowRef.current;
    if (dragRow) {
      const world = screenToWorld(e);
      if (!world) return;
      const dx = world.x - dragRow.startWorld.x;
      const dy = world.y - dragRow.startWorld.y;
      const snapMove = snapToGrid && !e.altKey;

      setSeats((prev) =>
        prev.map((s) => {
          if (s.rowGroupId !== dragRow.rowGroupId) return s;
          if (s.detachedFromRow) return s;
          const start = dragRow.seatStarts.get(s.seatId);
          if (!start) return s;
          let nx = start.x + dx;
          let ny = start.y + dy;
          if (snapMove) {
            nx = snap(nx, gridSize);
            ny = snap(ny, gridSize);
          }
          return { ...s, posX: nx, posY: ny };
        }),
      );
      return;
    }

    const dragStage = dragStageRef.current;
    if (dragStage) {
      const world = screenToWorld(e);
      if (!world) return;
      const dx = world.x - dragStage.startWorld.x;
      const dy = world.y - dragStage.startWorld.y;
      let nx = dragStage.startStage.x + dx;
      let ny = dragStage.startStage.y + dy;
      if (snapToGrid && !e.altKey) {
        nx = snap(nx, gridSize);
        ny = snap(ny, gridSize);
      }
      setStage((prev) => ({ ...prev, x: nx, y: ny }));
      return;
    }

    const dragEl = dragElementRef.current;
    if (dragEl) {
      const world = screenToWorld(e);
      if (!world) return;
      const dx = world.x - dragEl.startWorld.x;
      const dy = world.y - dragEl.startWorld.y;
      let nx = dragEl.startEl.x + dx;
      let ny = dragEl.startEl.y + dy;
      if (snapToGrid && !e.altKey) {
        nx = snap(nx, gridSize);
        ny = snap(ny, gridSize);
      }
      setElements((prev) =>
        prev.map((el) =>
          el.elementId === dragEl.elementId ? { ...el, x: nx, y: ny } : el,
        ),
      );
      return;
    }

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
    const snapMove = snapToGrid && !e.altKey;
    if (snapMove) {
      nextX = snap(nextX, gridSize);
      nextY = snap(nextY, gridSize);
    }

    // If the user drags off-grid, implicitly detach from row edits.
    const movingSeat = seats.find((s) => s.seatId === drag.seatId);
    updateSeat(drag.seatId, {
      posX: nextX,
      posY: nextY,
      detachedFromRow:
        movingSeat?.rowGroupId && !snapMove
          ? true
          : movingSeat?.detachedFromRow,
    });
  }

  function handleViewportPointerUp() {
    dragSeatIdRef.current = null;
    dragStartRef.current = null;
    panStartRef.current = null;
    dragRowRef.current = null;
    dragStageRef.current = null;
    dragElementRef.current = null;
  }

  // Measure now finalizes on second click; no implicit finalize on leave.

  function generateRowFromDraft(draft: {
    start: { x: number; y: number };
    end: { x: number; y: number };
    floorId: string;
  }) {
    const pitchPx = seatPitchFeet * gridSize;
    const count = Math.max(
      2,
      Math.min(200, Math.round(dist(draft.start, draft.end) / pitchPx + 1)),
    );
    const dx = draft.end.x - draft.start.x;
    const dy = draft.end.y - draft.start.y;
    const len = Math.max(1e-6, Math.sqrt(dx * dx + dy * dy));
    const ux = dx / len;
    const uy = dy / len;
    const rowGroupId = `row-${draft.floorId}-${Date.now()}`;

    const section = newSectionName.trim() || "Main";
    const rowLabel = "R";

    const generated: EditableSeat[] = [];
    for (let i = 0; i < count; i++) {
      const x = draft.start.x + ux * pitchPx * i;
      const y = draft.start.y + uy * pitchPx * i;
      const seatId = `${rowGroupId}-${i + 1}`;
      generated.push({
        seatId,
        section,
        floorId: draft.floorId,
        row: rowLabel,
        seatNumber: String(i + 1),
        posX: snapToGrid ? snap(x, gridSize) : x,
        posY: snapToGrid ? snap(y, gridSize) : y,
        isAvailable: true,
        rowGroupId,
        detachedFromRow: false,
      });
    }

    setSeats((prev) => {
      const existingIds = new Set(prev.map((p) => p.seatId));
      const deduped = generated.filter((g) => !existingIds.has(g.seatId));
      return [...prev, ...deduped];
    });
    setSelectedRowGroupId(rowGroupId);
    setSelectedSeatId(generated[0]?.seatId ?? null);
  }

  function handleWheel(e: React.WheelEvent) {
    // Trackpad:
    // - two-finger scroll = pan
    // - pinch zoom = WheelEvent with ctrlKey=true (macOS)
    e.preventDefault();

    const el = viewportRef.current;
    if (!el) return;

    if (!e.ctrlKey) {
      setView((prev) => ({
        ...prev,
        offsetX: prev.offsetX - e.deltaX,
        offsetY: prev.offsetY - e.deltaY,
      }));
      return;
    }

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
      <HostDashboardShell
        title="Seat map editor"
        subtitle="Loading..."
        hideTabs
      >
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
      hideTabs
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
              Drag seats to place them. Trackpad scroll pans. Pinch zooms. Hold
              Space to drag-pan.
            </div>
          </div>

          <div className={styles.headerRight}>
            <Button variant="secondary" onClick={handleDone}>
              Done
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
                  variant={tool === "row" ? "secondary" : "ghost"}
                  onClick={() => setTool("row")}
                >
                  Row
                </Button>
                <Button
                  size="sm"
                  variant={tool === "pan" ? "secondary" : "ghost"}
                  onClick={() => setTool("pan")}
                >
                  Pan
                </Button>
                <Button
                  size="sm"
                  variant={tool === "measure" ? "secondary" : "ghost"}
                  onClick={() => setTool("measure")}
                >
                  Measure
                </Button>
                <Button
                  size="sm"
                  variant={tool === "path" ? "secondary" : "ghost"}
                  onClick={() => setTool("path")}
                >
                  Path
                </Button>
                <Button
                  size="sm"
                  variant={tool === "aisle" ? "secondary" : "ghost"}
                  onClick={() => setTool("aisle")}
                >
                  Aisle
                </Button>
                <Button
                  size="sm"
                  variant={tool === "stage" ? "secondary" : "ghost"}
                  onClick={() => setTool("stage")}
                >
                  Stage
                </Button>
                <Button size="sm" variant="ghost" onClick={clearArrangement}>
                  Clear
                </Button>
                <Button
                  size="sm"
                  variant={toolsOpen ? "secondary" : "ghost"}
                  onClick={() => setToolsOpen((v) => !v)}
                >
                  Tools
                </Button>
              </div>
            </div>

            <div
              ref={viewportRef}
              className={styles.viewport}
              data-tool={tool}
              onPointerDown={handleViewportPointerDown}
              onPointerMove={handleViewportPointerMove}
              onPointerUp={handleViewportPointerUp}
              onPointerCancel={handleViewportPointerUp}
              onDoubleClick={() => {
                if (tool === "path") finalizePathDraft();
              }}
              onPointerLeave={() => {
                if (tool === "row" && rowDraft) {
                  generateRowFromDraft(rowDraft);
                  setRowDraft(null);
                }
                if (tool === "path") setPathHover(null);
              }}
              onWheel={handleWheel}
              style={{
                backgroundImage: showGrid
                  ? `linear-gradient(to right, color-mix(in srgb, var(--border) 55%, transparent) 1px, transparent 1px),\n                     linear-gradient(to bottom, color-mix(in srgb, var(--border) 55%, transparent) 1px, transparent 1px)`
                  : undefined,
                backgroundSize: `${scaledGrid}px ${scaledGrid}px`,
                backgroundPosition: `${gridOffsetX}px ${gridOffsetY}px`,
              }}
            >
              {showBackgroundImage && backgroundImageUrl ? (
                <img
                  src={getAssetUrl(backgroundImageUrl)}
                  alt=""
                  className={styles.layoutImage}
                />
              ) : null}

              {/* Seats */}
              <div
                className={styles.world}
                style={{
                  transform: `translate(${view.offsetX}px, ${view.offsetY}px) scale(${view.scale})`,
                }}
              >
                {/* Stage (world coords) */}
                <div
                  className={styles.stageWorld}
                  data-shape={stage.shape || "rect"}
                  onPointerDown={handleStagePointerDown}
                  style={{
                    transform: `translate(${stage.x}px, ${stage.y}px) translate(-50%, -50%)`,
                    width: stage.width,
                    height: stage.height,
                    borderRadius:
                      stage.shape === "rounded"
                        ? Math.max(0, stage.cornerRadius ?? gridSize)
                        : 0,
                  }}
                  title={
                    tool === "stage"
                      ? "Drag to reposition stage (Alt for off-grid)"
                      : ""
                  }
                >
                  <div className={styles.stageLabel}>Stage</div>
                </div>

                {/* Aisles */}
                {visibleElements
                  .filter((el) => el.type === "aisle")
                  .map((el) => (
                    <div
                      key={el.elementId}
                      className={styles.aisle}
                      data-selected={el.elementId === selectedElementId}
                      data-orientation={el.orientation}
                      onPointerDown={(e) =>
                        handleElementPointerDown(e, el.elementId)
                      }
                      style={{
                        transform: `translate(${el.x}px, ${el.y}px) translate(-50%, -50%)`,
                        width:
                          el.orientation === "vertical"
                            ? el.thickness
                            : el.length,
                        height:
                          el.orientation === "vertical"
                            ? el.length
                            : el.thickness,
                      }}
                      title={
                        tool === "aisle"
                          ? "Drag aisle (Alt for off-grid)"
                          : el.label || "Aisle"
                      }
                    >
                      {el.label ? (
                        <div className={styles.aisleLabel}>{el.label}</div>
                      ) : null}
                    </div>
                  ))}

                {/* Measure overlay */}
                {measure &&
                (showAllFloors || measure.floorId === activeFloorId) ? (
                  <div className={styles.measureLayer}>
                    {(() => {
                      const dx = measure.end.x - measure.start.x;
                      const dy = measure.end.y - measure.start.y;
                      const len = Math.max(1, Math.sqrt(dx * dx + dy * dy));
                      const angle = Math.atan2(dy, dx);
                      // Keep stroke/dots roughly constant in screen pixels.
                      const strokeW = Math.max(
                        1,
                        2 / Math.max(0.25, view.scale),
                      );
                      const dotSize = Math.max(
                        6,
                        9 / Math.max(0.25, view.scale),
                      );
                      const dotBorder = Math.max(
                        1,
                        1.5 / Math.max(0.25, view.scale),
                      );

                      return (
                        <>
                          <div
                            className={styles.measureLine}
                            style={{
                              left: measure.start.x,
                              top: measure.start.y,
                              width: len,
                              height: strokeW,
                              transformOrigin: "0 50%",
                              transform: `rotate(${angle}rad) translateY(-50%)`,
                              borderRadius: strokeW,
                              boxShadow: `0 0 0 ${dotBorder}px rgba(0,0,0,0.35)`,
                            }}
                          />
                          <div
                            style={{
                              position: "absolute",
                              left: measure.start.x,
                              top: measure.start.y,
                              width: dotSize,
                              height: dotSize,
                              transform: "translate(-50%, -50%)",
                              borderRadius: 999,
                              background: "var(--accent)",
                              border: `${dotBorder}px solid var(--surface-3)`,
                              boxShadow: `0 0 0 ${dotBorder}px rgba(0,0,0,0.35)`,
                            }}
                          />
                          <div
                            style={{
                              position: "absolute",
                              left: measure.end.x,
                              top: measure.end.y,
                              width: dotSize,
                              height: dotSize,
                              transform: "translate(-50%, -50%)",
                              borderRadius: 999,
                              background: "var(--accent)",
                              border: `${dotBorder}px solid var(--surface-3)`,
                              boxShadow: `0 0 0 ${dotBorder}px rgba(0,0,0,0.35)`,
                            }}
                          />
                        </>
                      );
                    })()}
                    <div
                      className={styles.measureLabel}
                      style={{
                        left: (measure.start.x + measure.end.x) / 2,
                        top: (measure.start.y + measure.end.y) / 2,
                        transform: "translate(-50%, -50%)",
                      }}
                    >
                      {formatFeet(dist(measure.start, measure.end) / gridSize)}
                    </div>
                  </div>
                ) : null}

                {/* Row draw preview */}
                {rowDraft ? (
                  <div className={styles.rowDraft}>
                    <div
                      className={styles.rowDraftLine}
                      style={{
                        left: rowDraft.start.x,
                        top: rowDraft.start.y,
                        width: Math.max(1, dist(rowDraft.start, rowDraft.end)),
                        transformOrigin: "0 50%",
                        transform: `rotate(${Math.atan2(rowDraft.end.y - rowDraft.start.y, rowDraft.end.x - rowDraft.start.x)}rad)`,
                      }}
                    />
                    <div
                      className={styles.rowDraftHint}
                      style={{
                        left: (rowDraft.start.x + rowDraft.end.x) / 2,
                        top: (rowDraft.start.y + rowDraft.end.y) / 2,
                      }}
                    >
                      Row (
                      {formatFeet(
                        dist(rowDraft.start, rowDraft.end) / gridSize,
                      )}
                      )
                    </div>
                  </div>
                ) : null}

                {/* Path draw preview */}
                {pathDraft && pathDraft.points.length ? (
                  <div className={styles.pathDraft}>
                    {[
                      ...pathDraft.points,
                      ...(pathHover ? [pathHover] : []),
                    ].map((p, idx, arr) => {
                      if (idx === 0) return null;
                      const a = arr[idx - 1]!;
                      const b = p;
                      return (
                        <div
                          key={`seg-${idx}`}
                          className={styles.pathDraftLine}
                          style={{
                            left: a.x,
                            top: a.y,
                            width: Math.max(1, dist(a, b)),
                            transformOrigin: "0 50%",
                            transform: `rotate(${Math.atan2(b.y - a.y, b.x - a.x)}rad)`,
                          }}
                        />
                      );
                    })}
                  </div>
                ) : null}

                {visibleSeats.map((s) => {
                  const active = s.seatId === selectedSeatId;
                  const x = typeof s.posX === "number" ? s.posX : 0;
                  const y = typeof s.posY === "number" ? s.posY : 0;

                  const rowSelected =
                    !!selectedRowGroupId && s.rowGroupId === selectedRowGroupId;

                  return (
                    <button
                      key={s.seatId}
                      type="button"
                      onClick={() => setSelectedSeatId(s.seatId)}
                      onPointerDown={(e) => handleSeatPointerDown(e, s.seatId)}
                      className={styles.seat}
                      data-active={active}
                      data-available={s.isAvailable}
                      data-row-selected={rowSelected}
                      data-detached={!!s.detachedFromRow}
                      style={{
                        transform: `translate(${x}px, ${y}px) translate(-50%, -50%)`,
                        width: seatSizeFeet * gridSize,
                        height: seatSizeFeet * gridSize,
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

            {toolsOpen ? (
              <div
                className={[ui.card, ui.cardPad, styles.toolsOverlay].join(" ")}
                onWheel={(e) => e.stopPropagation()}
              >
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
                      Canvas
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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

                  <div className={ui.divider} />

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
                          const rect =
                            viewportRef.current.getBoundingClientRect();
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
                      Navigation
                    </div>
                    <div className={ui.help}>
                      Trackpad scroll pans. Pinch zooms. Hold Space to drag-pan.
                    </div>
                  </div>

                  <div className={ui.divider} />

                  <div>
                    <div className={ui.help} style={{ marginBottom: 6 }}>
                      Measure tool
                    </div>
                    <div className={ui.help}>
                      Click A, move, click B. Shift locks to 0/45/90°. Alt snaps
                      to grid. ⌘ disables snapping.
                    </div>
                  </div>

                  <div className={ui.divider} />

                  <div>
                    <div className={ui.help} style={{ marginBottom: 6 }}>
                      Seat size
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        className={ui.input}
                        type="number"
                        min={1}
                        step={0.5}
                        value={seatSizeFeet}
                        onChange={(e) =>
                          setSeatSizeFeet(Number(e.target.value) || 2.5)
                        }
                        aria-label="Seat size (ft)"
                      />
                      <div className={ui.help} style={{ alignSelf: "center" }}>
                        ft
                      </div>
                    </div>
                    <div className={ui.help} style={{ marginTop: 6 }}>
                      Default is ~2.5 ft per seat.
                    </div>
                  </div>

                  <div className={ui.divider} />

                  <div>
                    <div className={ui.help} style={{ marginBottom: 6 }}>
                      Path tool
                    </div>
                    <div className={ui.help} style={{ marginBottom: 8 }}>
                      Click to add points, then double-click to place seats.
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
                        type="number"
                        min={0}
                        step={0.25}
                        value={pathSpacingFeet}
                        onChange={(e) =>
                          setPathSpacingFeet(Number(e.target.value) || 0)
                        }
                        placeholder="Spacing (ft)"
                        aria-label="Path spacing (ft)"
                      />
                      <input
                        className={ui.input}
                        type="number"
                        min={0}
                        step={1}
                        value={pathSeatCount}
                        onChange={(e) =>
                          setPathSeatCount(Number(e.target.value) || 0)
                        }
                        placeholder="# Seats"
                        aria-label="Path seat count"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && tool === "path")
                            finalizePathDraft();
                        }}
                      />
                    </div>
                    <div className={ui.help} style={{ marginTop: 6 }}>
                      Leave spacing at 0 for auto-min spacing.
                    </div>
                  </div>

                  <div className={ui.divider} />

                  <div>
                    <div className={ui.help} style={{ marginBottom: 6 }}>
                      Row spacing
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        className={ui.input}
                        type="number"
                        min={2}
                        step={0.5}
                        value={seatPitchFeet}
                        onChange={(e) =>
                          setSeatPitchFeet(Number(e.target.value) || 3)
                        }
                        aria-label="Seat pitch (ft)"
                      />
                      <div className={ui.help} style={{ alignSelf: "center" }}>
                        ft
                      </div>
                    </div>
                    <div className={ui.help} style={{ marginTop: 6 }}>
                      Used when drawing/reflowing rows.
                    </div>

                    {selectedRowGroupId ? (
                      <div
                        style={{
                          marginTop: 10,
                          display: "flex",
                          gap: 8,
                          flexWrap: "wrap",
                        }}
                      >
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={reflowSelectedRow}
                        >
                          Reflow row
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelectedRowGroupId(null)}
                        >
                          Clear row select
                        </Button>
                        <div
                          className={ui.help}
                          style={{ alignSelf: "center" }}
                        >
                          Seats:{" "}
                          <strong style={{ color: "var(--text)" }}>
                            {selectedRowSeats.length}
                          </strong>
                        </div>
                      </div>
                    ) : (
                      <div className={ui.help} style={{ marginTop: 10 }}>
                        Use the Row tool to select/drag a row.
                      </div>
                    )}
                  </div>

                  <div className={ui.divider} />

                  <div>
                    <div className={ui.help} style={{ marginBottom: 6 }}>
                      Background image
                    </div>
                    <label
                      className={ui.help}
                      style={{ display: "flex", gap: 8, alignItems: "center" }}
                    >
                      <input
                        type="checkbox"
                        checked={showBackgroundImage}
                        onChange={(e) =>
                          setShowBackgroundImage(e.target.checked)
                        }
                      />
                      Show layout image
                    </label>
                    <input
                      className={ui.input}
                      value={backgroundImageUrl}
                      onChange={(e) => setBackgroundImageUrl(e.target.value)}
                      placeholder="/api/... or https://..."
                      style={{ marginTop: 8 }}
                    />
                    <div className={ui.help} style={{ marginTop: 6 }}>
                      This is NOT the venue cover photo.
                    </div>
                  </div>

                  <div className={ui.divider} />

                  <div>
                    <div className={ui.help} style={{ marginBottom: 6 }}>
                      Floor
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
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
                      Aisles
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          const id = `aisle-${Date.now()}`;
                          setElements((prev) => [
                            ...prev,
                            {
                              elementId: id,
                              type: "aisle",
                              floorId: activeFloorId,
                              orientation: "vertical",
                              x: 0,
                              y: 0,
                              length: 24 * 40,
                              thickness: 24,
                              label: "Aisle",
                            },
                          ]);
                          setSelectedElementId(id);
                          setTool("aisle");
                        }}
                      >
                        Add aisle
                      </Button>
                      {selectedElementId ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setElements((prev) =>
                              prev.filter(
                                (e) => e.elementId !== selectedElementId,
                              ),
                            );
                            setSelectedElementId(null);
                          }}
                        >
                          Delete aisle
                        </Button>
                      ) : null}
                    </div>
                    <div className={ui.help} style={{ marginTop: 6 }}>
                      Use the Aisle tool to drag guides.
                    </div>
                  </div>

                  <div className={ui.divider} />

                  <div>
                    <div className={ui.help} style={{ marginBottom: 6 }}>
                      Stage
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
                        type="number"
                        min={1}
                        step={1}
                        value={Math.round(stage.width / gridSize)}
                        onChange={(e) => {
                          const ft = Number(e.target.value) || 20;
                          setStage((prev) => ({
                            ...prev,
                            width: ft * gridSize,
                          }));
                        }}
                        aria-label="Stage width (ft)"
                      />
                      <input
                        className={ui.input}
                        type="number"
                        min={1}
                        step={1}
                        value={Math.round(stage.height / gridSize)}
                        onChange={(e) => {
                          const ft = Number(e.target.value) || 6;
                          setStage((prev) => ({
                            ...prev,
                            height: ft * gridSize,
                          }));
                        }}
                        aria-label="Stage depth (ft)"
                      />
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <Button
                        size="sm"
                        variant={tool === "stage" ? "secondary" : "ghost"}
                        onClick={() => setTool("stage")}
                      >
                        Edit stage
                      </Button>
                      <select
                        className={ui.input}
                        value={stage.shape || "rect"}
                        onChange={(e) =>
                          setStage((prev) => ({
                            ...prev,
                            shape: e.target.value as any,
                          }))
                        }
                        style={{ height: 30, paddingTop: 0, paddingBottom: 0 }}
                        aria-label="Stage shape"
                      >
                        <option value="rect">Rect</option>
                        <option value="rounded">Rounded</option>
                      </select>
                    </div>
                    <div className={ui.help} style={{ marginTop: 6 }}>
                      Stage is fixed in the layout; drag it only in Stage tool.
                    </div>
                  </div>

                  <div className={ui.divider} />

                  <div>
                    <div className={ui.help} style={{ marginBottom: 6 }}>
                      Quick generator
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
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
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
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
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 8,
                        }}
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

                          {selectedSeat.rowGroupId ? (
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
                                checked={!!selectedSeat.detachedFromRow}
                                onChange={(e) =>
                                  updateSeat(selectedSeat.seatId, {
                                    detachedFromRow: e.target.checked,
                                  })
                                }
                              />
                              Detached
                            </label>
                          ) : null}
                        </div>

                        <div style={{ display: "flex", gap: 8 }}>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              updateSeat(selectedSeat.seatId, {
                                posX: 0,
                                posY: 0,
                              });
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
                    <strong style={{ color: "var(--text)" }}>
                      {seats.length}
                    </strong>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </HostDashboardShell>
  );
}

export default SeatLayoutEditorPage;
