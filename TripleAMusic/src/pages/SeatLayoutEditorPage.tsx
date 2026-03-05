import { useEffect, useMemo, useRef, useState } from "react";
import type { Location } from "@shared";
import { Button, spacing } from "@shared";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { SectionWizard } from "../components/SectionWizard";
import type {
  EditableSeatBlueprint,
  SectionWizardParams,
} from "../components/SectionWizard";
import { generateSectionSeats } from "../components/SectionWizard";
import { LayoutPreviewModal } from "../components/LayoutPreviewModal";
import ui from "@shared/styles/primitives.module.scss";
import { useNavigate, useParams } from "react-router-dom";
import { useBeforeUnload } from "react-router";
import { HostDashboardShell } from "../components/HostDashboardShell";
import { createApiClient, getAssetUrl } from "../lib/urls";
import styles from "./SeatLayoutEditorPage.module.scss";

type StagePosition = "top" | "bottom" | "left" | "right";

// Domain types used across this file
type EditableFloor = { floorId: string; name: string; order: number };

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
  rotationDeg?: number;
};

type LayoutElement = {
  elementId: string;
  type: "aisle" | "table" | "railing" | "stairs" | "dance_floor" | "entrance";
  floorId?: string;
  /** Used by aisle/railing/stairs */
  orientation?: "vertical" | "horizontal";
  x: number;
  y: number;
  /** Used by aisle/railing lines */
  length?: number;
  thickness?: number;
  label?: string;
  /** Table-specific */
  tableShape?: "round" | "rect";
  width?: number;
  height?: number;
  seatCount?: number;
  /** Stairs/entrance direction */
  arrowDir?: "up" | "down" | "left" | "right";
  accessibilityNote?: string;
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
  | "path"
  | "table";

type AiSuggestion = {
  type:
    | "stage"
    | "aisle"
    | "table"
    | "railing"
    | "stairs"
    | "dance_floor"
    | "entrance"
    | "seating_zone";
  label: string;
  xPct: number;
  yPct: number;
  widthPct?: number;
  heightPct?: number;
  estimatedSeats?: number;
  notes?: string;
};

type AiAnalysisResult = {
  analyzedAt: string;
  model: string;
  description?: string;
  stagePosition?: "top" | "bottom" | "left" | "right";
  capacityEstimate?: number;
  /** Real-world venue dimensions detected from the image (feet) */
  estimatedVenueWidthFeet?: number;
  estimatedVenueHeightFeet?: number;
  /** Real-world size of a single seat detected from the image */
  referenceSeat?: {
    widthFeet: number;
    depthFeet: number;
    rowPitchFeet: number;
  };
  suggestions: AiSuggestion[];
};

type ViewState = { scale: number; offsetX: number; offsetY: number };

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function stableSortFloors(floors: EditableFloor[]) {
  return [...floors].sort((a, b) => {
    const oa = typeof a.order === "number" ? a.order : 0;
    const ob = typeof b.order === "number" ? b.order : 0;
    if (oa !== ob) return oa - ob;
    return (a.name || "").localeCompare(b.name || "");
  });
}

function ensureDefaultFloor(
  floors: EditableFloor[] | undefined,
): EditableFloor[] {
  if (floors && floors.length > 0) return floors;
  return [{ floorId: "floor-1", name: "Main floor", order: 0 }];
}

function normalizeSeatPositions(
  seats: EditableSeat[] | undefined,
  defaultFloorId: string,
  gridSize: number,
) {
  const normalized: EditableSeat[] = (seats ?? []).map((s) => ({
    ...s,
    floorId: s.floorId ?? defaultFloorId,
  }));

  const hasAnyPosition = normalized.some(
    (s) => typeof s.posX === "number" && typeof s.posY === "number",
  );

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

type SectionBlockSpec = {
  shape: "straight" | "arc" | "wing";
  sectionName: string;
  rowCount: number;
  seatsPerRow: number;
  maxSeatsPerRow?: number;
  rowSpacingFt: number;
  seatPitchFt: number;
  innerRadiusFt?: number;
  arcSpanDeg?: number;
  centerAngleDeg?: number;
  offsetXFt?: number;
  offsetYFt?: number;
  rotationDeg?: number;
};

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
  rowPlan?: SectionBlockSpec[] | null;
};

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
    id: "theater",
    label: "Theater",
    icon: "🎭",
    description: "Traditional theater with main section and angled side wings",
    roomWidth: 70,
    roomHeight: 50,
    stagePosition: "top",
    defaultPlan: null,
    rowPlan: [
      {
        shape: "straight",
        sectionName: "Center",
        rowCount: 10,
        seatsPerRow: 14,
        rowSpacingFt: 3,
        seatPitchFt: 2.5,
        offsetXFt: 0,
        offsetYFt: 12,
      },
      {
        shape: "wing",
        sectionName: "Left",
        rowCount: 7,
        seatsPerRow: 7,
        rowSpacingFt: 3,
        seatPitchFt: 2.5,
        rotationDeg: -25,
        offsetXFt: -28,
        offsetYFt: 20,
      },
      {
        shape: "wing",
        sectionName: "Right",
        rowCount: 7,
        seatsPerRow: 7,
        rowSpacingFt: 3,
        seatPitchFt: 2.5,
        rotationDeg: 25,
        offsetXFt: 28,
        offsetYFt: 20,
      },
    ],
  },
  {
    id: "arena",
    label: "Arena (¾)",
    icon: "🏟️",
    description: "Three-sided arena seating around a center stage",
    roomWidth: 80,
    roomHeight: 80,
    stagePosition: "bottom",
    defaultPlan: null,
    rowPlan: [
      {
        shape: "straight",
        sectionName: "Front",
        rowCount: 4,
        seatsPerRow: 14,
        rowSpacingFt: 3,
        seatPitchFt: 2.5,
        offsetXFt: 0,
        offsetYFt: -18,
      },
      {
        shape: "wing",
        sectionName: "Left Bank",
        rowCount: 8,
        seatsPerRow: 8,
        rowSpacingFt: 3,
        seatPitchFt: 2.5,
        rotationDeg: -45,
        offsetXFt: -28,
        offsetYFt: 0,
      },
      {
        shape: "wing",
        sectionName: "Right Bank",
        rowCount: 8,
        seatsPerRow: 8,
        rowSpacingFt: 3,
        seatPitchFt: 2.5,
        rotationDeg: 45,
        offsetXFt: 28,
        offsetYFt: 0,
      },
      {
        shape: "straight",
        sectionName: "Rear",
        rowCount: 8,
        seatsPerRow: 12,
        rowSpacingFt: 3,
        seatPitchFt: 2.5,
        offsetXFt: 0,
        offsetYFt: 25,
      },
    ],
  },
  {
    id: "amphitheater",
    label: "Amphitheater",
    icon: "🎪",
    description: "Fan-curved rows for outdoor or semicircular venues",
    roomWidth: 100,
    roomHeight: 60,
    stagePosition: "bottom",
    defaultPlan: null,
    rowPlan: [
      {
        shape: "arc",
        sectionName: "Main",
        rowCount: 12,
        seatsPerRow: 10,
        maxSeatsPerRow: 22,
        rowSpacingFt: 3.5,
        seatPitchFt: 2.5,
        innerRadiusFt: 20,
        arcSpanDeg: 160,
        centerAngleDeg: 270,
        offsetXFt: 0,
        offsetYFt: 0,
      },
    ],
  },
  {
    id: "small_club",
    label: "Small Club",
    icon: "🎺",
    description: "Intimate venue, 5 short rows facing stage",
    roomWidth: 25,
    roomHeight: 20,
    stagePosition: "top",
    defaultPlan: null,
    rowPlan: [
      {
        shape: "straight",
        sectionName: "Main",
        rowCount: 5,
        seatsPerRow: 8,
        rowSpacingFt: 2.5,
        seatPitchFt: 2.2,
        offsetXFt: 0,
        offsetYFt: 8,
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
    rowPlan: null,
  },
];

// Palette for auto-assigning section colors
const SECTION_COLORS = [
  "#3b82f6", // blue
  "#a855f7", // purple
  "#22c55e", // green
  "#f97316", // orange
  "#ec4899", // pink
  "#14b8a6", // teal
  "#eab308", // yellow
  "#ef4444", // red
  "#6366f1", // indigo
  "#06b6d4", // cyan
];

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
  const [advancedOpen, setAdvancedOpen] = useState<boolean>(false);

  // In-page confirm dialog — replaces all window.confirm() calls.
  const [confirmState, setConfirmState] = useState<{
    message: string;
    onConfirm: () => void;
  } | null>(null);

  function confirmThen(message: string, onConfirm: () => void) {
    setConfirmState({ message, onConfirm });
  }

  const [seatSizeFeet, setSeatSizeFeet] = useState<number>(2.5);
  const [seatPitchFeet, setSeatPitchFeet] = useState<number>(3);

  const [elements, setElements] = useState<LayoutElement[]>([]);
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string>("");
  const [showBackgroundImage, setShowBackgroundImage] =
    useState<boolean>(false);
  // Local file for background image (before upload)
  const [localBgFile, setLocalBgFile] = useState<File | null>(null);
  const [localBgBlob, setLocalBgBlob] = useState<string | null>(null);

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

  // Ref to the latest view state — native DOM wheel handler reads this to avoid stale closures.
  const viewStateRef = useRef<ViewState>({ scale: 1, offsetX: 0, offsetY: 0 });
  useEffect(() => {
    viewStateRef.current = view;
  }, [view]);

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
  const [wizardOpen, setWizardOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);

  // AI analysis state
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<AiAnalysisResult | null>(null);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [rejectedSuggestionIds, setRejectedSuggestionIds] = useState<
    Set<number>
  >(new Set());
  const [uploadingBgNow, setUploadingBgNow] = useState(false);

  // Room boundary + planner state
  const [roomBoundary, setRoomBoundary] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [showRoomBoundary, setShowRoomBoundary] = useState(true);
  const [plannerTableShape, setPlannerTableShape] = useState<"round" | "rect">(
    "round",
  );
  const [plannerTableDiameter, setPlannerTableDiameter] = useState(4);
  const [plannerSeatsPerTable, setPlannerSeatsPerTable] = useState(4);
  const [plannerRows, setPlannerRows] = useState(2);
  const [plannerCols, setPlannerCols] = useState(3);
  const [plannerAisleWidth, setPlannerAisleWidth] = useState(3);
  const [plannerSectionName, setPlannerSectionName] = useState("Main");
  const [plannerRoomWidth, setPlannerRoomWidth] = useState(40);
  const [plannerRoomHeight, setPlannerRoomHeight] = useState(30);

  function getLayoutSnapshotString(args?: {
    name?: string;
    description?: string;
    stagePosition?: StagePosition;
    floors?: EditableFloor[];
    elements?: LayoutElement[];
    backgroundImageUrl?: string;
    stage?: StageConfig;
    seats?: EditableSeat[];
    roomBoundary?: { width: number; height: number } | null;
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
      roomBoundary:
        args !== undefined && "roomBoundary" in args
          ? args.roomBoundary
          : roomBoundary,
    };

    return JSON.stringify(snapshot);
  }

  function hasUnsavedChanges(): boolean {
    if (!savedSnapshotRef.current) return false;
    if (localBgFile) return true; // pending local image upload
    return getLayoutSnapshotString() !== savedSnapshotRef.current;
  }

  function navigateToVenueLayouts() {
    allowNavigationRef.current = true;
    navigate(`/venues/${encodeURIComponent(locationId || "")}/seating`);
  }

  function handleDone() {
    if (hasUnsavedChanges()) {
      confirmThen(
        "You have unsaved changes. Exit the seat editor without saving?",
        navigateToVenueLayouts,
      );
      return;
    }
    navigateToVenueLayouts();
  }

  useBeforeUnload((event) => {
    if (!hasUnsavedChanges()) return;
    event.preventDefault();
    event.returnValue = "";
  });

  // Block browser back/forward when there are unsaved changes.
  // useBlocker requires a data router; we're using BrowserRouter so we use
  // the popstate approach instead.
  useEffect(() => {
    // Push an extra history entry so we can catch the first back-press.
    window.history.pushState(null, "", window.location.href);

    function handlePopState() {
      if (allowNavigationRef.current) return;
      if (!hasUnsavedChanges()) return;
      // Re-push so the URL doesn't change while the dialog renders.
      window.history.pushState(null, "", window.location.href);
      confirmThen(
        "You have unsaved changes. Leave this page without saving?",
        () => {
          allowNavigationRef.current = true;
          window.history.back();
        },
      );
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  // Tracks screen-space pointerdown position for tap vs drag detection in row tool
  const rowDownScreenRef = useRef<{ x: number; y: number } | null>(null);

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
        const loadedRoomBoundary = ((layout as any).roomBoundary ?? null) as {
          width: number;
          height: number;
        } | null;

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
        setRoomBoundary(loadedRoomBoundary);
        if (loadedRoomBoundary) {
          setPlannerRoomWidth(loadedRoomBoundary.width);
          setPlannerRoomHeight(loadedRoomBoundary.height);
        }
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
          roomBoundary: loadedRoomBoundary,
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
      // Skip shortcuts when typing in an input/textarea/select
      const tag = (e.target as HTMLElement)?.tagName ?? "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      switch (e.key.toUpperCase()) {
        case "V":
          setTool("select");
          break;
        case "H":
          setTool("pan");
          break;
        case "R":
          setTool("row");
          break;
        case "T":
          setTool("table");
          break;
        case "M":
          setTool("measure");
          break;
        case "S":
          setTool("stage");
          break;
        case "A":
          setTool("aisle");
          break;
        case "DELETE":
        case "BACKSPACE":
          if (selectedSeatId) deleteSeat(selectedSeatId);
          break;
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
    // Wait for layout paint before reading dimensions — rAF ensures getBoundingClientRect
    // returns real values instead of zero during the loading→loaded transition.
    if (loading) return;
    const el = viewportRef.current;
    if (!el) return;
    const raf = requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      setView((prev) => {
        if (prev.offsetX !== 0 || prev.offsetY !== 0) return prev;
        return { ...prev, offsetX: rect.width / 2, offsetY: rect.height / 2 };
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [loading]);

  const selectedSeat = selectedSeatId
    ? (seats.find((s) => s.seatId === selectedSeatId) ?? null)
    : null;

  const visibleSeats = useMemo(() => {
    if (showAllFloors) return seats;
    return seats.filter((s) => (s.floorId || activeFloorId) === activeFloorId);
  }, [seats, activeFloorId, showAllFloors]);

  // Map section name → color for the current canvas view
  const sectionColorMap = useMemo(() => {
    const map = new Map<string, string>();
    const uniqueNames = Array.from(
      new Set(seats.map((s) => s.section || "Main")),
    );
    uniqueNames.forEach((name, i) => {
      map.set(name, SECTION_COLORS[i % SECTION_COLORS.length]!);
    });
    return map;
  }, [seats]);

  const visibleElements = useMemo(() => {
    if (showAllFloors) return elements;
    return elements.filter(
      (e) => (e.floorId || activeFloorId) === activeFloorId,
    );
  }, [elements, activeFloorId, showAllFloors]);

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
    confirmThen(
      "Clear all seats and aisle guides? This cannot be undone.",
      () => {
        setSeats([]);
        setElements([]);
        setSelectedSeatId(null);
        setSelectedRowGroupId(null);
        setSelectedElementId(null);
        setMeasure(null);
        setRowDraft(null);
      },
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

  // ─── Room Planner helpers ────────────────────────────────────────────────

  function generateTableSeats(
    tableEl: LayoutElement,
    floorId: string,
  ): EditableSeat[] {
    const seatCount = tableEl.seatCount ?? 4;
    const cx = tableEl.x + (tableEl.width ?? 0) / 2;
    const cy = tableEl.y + (tableEl.height ?? 0) / 2;
    const radius =
      (tableEl.width ?? tableEl.height ?? gridSize * 4) / 2 +
      seatSizeFeet * gridSize * 0.6 +
      4;
    const tableSeatArr: EditableSeat[] = [];
    const tableLabel = tableEl.label ?? "T";
    for (let i = 0; i < seatCount; i++) {
      const angle = (2 * Math.PI * i) / seatCount - Math.PI / 2;
      tableSeatArr.push({
        seatId: `seat-${tableEl.elementId}-${i}-${Date.now() + i}`,
        rowGroupId: `table-${tableEl.elementId}`,
        row: tableLabel,
        seatNumber: `${i + 1}`,
        section: "",
        posX: cx + Math.cos(angle) * radius - (seatSizeFeet * gridSize) / 2,
        posY: cy + Math.sin(angle) * radius - (seatSizeFeet * gridSize) / 2,
        floorId,
        isAvailable: true,
        detachedFromRow: true,
      });
    }
    return tableSeatArr;
  }

  function generateSmartPlan(opts?: {
    tableShape?: "round" | "rect";
    tableDiameterFeet?: number;
    tableHeightFeet?: number;
    seatsPerTable?: number;
    cols?: number;
    rows?: number;
    aisleWidthFeet?: number;
    roomWidthFeet?: number;
    roomHeightFeet?: number;
    sectionName?: string;
    floorId?: string;
  }) {
    const shape = opts?.tableShape ?? plannerTableShape;
    const diam = opts?.tableDiameterFeet ?? plannerTableDiameter;
    const tableH = opts?.tableHeightFeet ?? (shape === "rect" ? 3 : diam);
    const perTable = opts?.seatsPerTable ?? plannerSeatsPerTable;
    const cols = opts?.cols ?? plannerCols;
    const rows = opts?.rows ?? plannerRows;
    const aisleW = opts?.aisleWidthFeet ?? plannerAisleWidth;
    const rW = opts?.roomWidthFeet ?? plannerRoomWidth;
    const rH = opts?.roomHeightFeet ?? plannerRoomHeight;
    const secName = opts?.sectionName ?? plannerSectionName;
    const floorId =
      opts?.floorId ?? activeFloorId ?? floors[0]?.floorId ?? "floor-1";

    const doGenerate = () => {
      // Room boundary (in pixels)
      const rbPx = { width: rW * gridSize, height: rH * gridSize };
      setRoomBoundary({ width: rW, height: rH });
      setPlannerRoomWidth(rW);
      setPlannerRoomHeight(rH);

      const tableWPx = diam * gridSize;
      const tableHPx = tableH * gridSize;
      const cellW = tableWPx + aisleW * gridSize;
      const cellH = tableHPx + aisleW * gridSize;
      const gridW = cols * cellW;
      const gridH = rows * cellH;
      const startX = (rbPx.width - gridW) / 2;
      const startY = (rbPx.height - gridH) / 2 + 4 * gridSize; // offset from stage

      const newElements: LayoutElement[] = [];
      const newSeats: EditableSeat[] = [];

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const elemId = `table-${Date.now()}-${r}-${c}`;
          const ex = startX + c * cellW;
          const ey = startY + r * cellH;
          const tableEl: LayoutElement = {
            elementId: elemId,
            type: "table",
            floorId,
            tableShape: shape,
            x: ex,
            y: ey,
            width: tableWPx,
            height: tableHPx,
            seatCount: perTable,
            label: `T${r * cols + c + 1}`,
          };
          newElements.push(tableEl);
          const tableSeats = generateTableSeats(tableEl, floorId);
          tableSeats.forEach((s) => {
            s.section = secName;
          });
          newSeats.push(...tableSeats);
        }
      }

      setElements((prev) => [
        ...prev.filter((e) => e.type !== "table"),
        ...newElements,
      ]);
      setSeats((prev) => {
        const withoutTableSeats = prev.filter(
          (s) => !s.rowGroupId?.startsWith("table-"),
        );
        return [...withoutTableSeats, ...newSeats];
      });
    };

    const floorElements = elements.filter((e) => e.floorId === floorId);
    if (floorElements.some((e) => e.type === "table")) {
      confirmThen(
        `Replace the ${floorElements.filter((e) => e.type === "table").length} existing table(s) and their seats on this floor?`,
        doGenerate,
      );
    } else {
      doGenerate();
    }
  }

  function applyRoomTemplate(templateId: string) {
    const tpl = ROOM_TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return;
    setRoomBoundary({ width: tpl.roomWidth, height: tpl.roomHeight });
    setPlannerRoomWidth(tpl.roomWidth);
    setPlannerRoomHeight(tpl.roomHeight);
    // Move stage to match template preference
    const stageW = Math.round(tpl.roomWidth * 0.4) * gridSize;
    const centerX = (tpl.roomWidth * gridSize) / 2;
    const stageX = centerX - stageW / 2;
    const stageY =
      tpl.stagePosition === "bottom"
        ? (tpl.roomHeight - 6) * gridSize
        : gridSize;
    const stageH = 6 * gridSize;
    setStage((prev) => ({
      ...prev,
      x: stageX,
      y: stageY,
      width: stageW,
      height: stageH,
    }));
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
    if (tpl.rowPlan && tpl.rowPlan.length > 0) {
      const stageCx = stageX + stageW / 2;
      const stageCy = stageY + stageH / 2;
      const allSeats: EditableSeat[] = [];
      for (const spec of tpl.rowPlan) {
        const sectionCx = stageCx + (spec.offsetXFt ?? 0) * gridSize;
        const sectionCy = stageCy + (spec.offsetYFt ?? 0) * gridSize;
        const params: SectionWizardParams = {
          shape: spec.shape,
          sectionName: spec.sectionName,
          rowCount: spec.rowCount,
          seatsPerRow: spec.seatsPerRow,
          maxSeatsPerRow: spec.maxSeatsPerRow,
          rowSpacingFt: spec.rowSpacingFt,
          seatPitchFt: spec.seatPitchFt,
          innerRadiusFt: spec.innerRadiusFt,
          arcSpanDeg: spec.arcSpanDeg,
          centerAngleDeg: spec.centerAngleDeg,
          centerX: sectionCx,
          centerY: sectionCy,
          startX: sectionCx,
          startY: sectionCy,
          rotationDeg: spec.rotationDeg,
          floorId: activeFloorId ?? floors[0]?.floorId ?? "floor-1",
        };
        const blueprints = generateSectionSeats(params, gridSize);
        allSeats.push(...(blueprints as EditableSeat[]));
      }
      setSeats((prev) => [...prev, ...allSeats]);
    }
  }

  function handleWizardGenerate(blueprints: EditableSeatBlueprint[]) {
    setSeats((prev) => {
      const ids = new Set(prev.map((s) => s.seatId));
      return [
        ...prev,
        ...(blueprints.filter((b) => !ids.has(b.seatId)) as EditableSeat[]),
      ];
    });
    setWizardOpen(false);
  }

  function addPresetElement(
    type: LayoutElement["type"],
    opts?: Partial<LayoutElement>,
  ) {
    const floorId = activeFloorId ?? floors[0]?.floorId ?? "floor-1";
    const elemId = `${type}-${Date.now()}`;
    const defaults: Record<string, Partial<LayoutElement>> = {
      table: {
        tableShape: "round",
        width: 4 * gridSize,
        height: 4 * gridSize,
        seatCount: 4,
      },
      railing: {
        orientation: "horizontal",
        length: 8 * gridSize,
        thickness: gridSize / 3,
      },
      stairs: {
        orientation: "horizontal",
        width: 4 * gridSize,
        height: 3 * gridSize,
        arrowDir: "up",
      },
      dance_floor: { width: 10 * gridSize, height: 10 * gridSize },
      entrance: {
        width: 3 * gridSize,
        height: 2 * gridSize,
        arrowDir: "up",
        label: "Entrance",
      },
    };
    const el: LayoutElement = {
      elementId: elemId,
      type,
      floorId,
      x: 100,
      y: 100,
      ...defaults[type],
      ...opts,
    };
    setElements((prev) => [...prev, el]);
    if (type === "table") {
      const tSeats = generateTableSeats(el, floorId);
      setSeats((prev) => [...prev, ...tSeats]);
    }
  }

  /**
   * Convert an AI suggestion's percentage coordinates into world-space pixels.
   * Uses roomBoundary if set; falls back to a 40×30 ft default.
   * Pass overrideW/H (in feet) to use freshly-computed dimensions before state settles.
   */
  function suggestionToWorld(
    s: AiSuggestion,
    overrideWFeet?: number,
    overrideHFeet?: number,
  ): { x: number; y: number; width: number; height: number } {
    const rW = (overrideWFeet ?? roomBoundary?.width ?? 40) * gridSize;
    const rH = (overrideHFeet ?? roomBoundary?.height ?? 30) * gridSize;
    return {
      x: (s.xPct / 100) * rW,
      y: (s.yPct / 100) * rH,
      width: ((s.widthPct ?? 10) / 100) * rW,
      height: ((s.heightPct ?? 10) / 100) * rH,
    };
  }

  function applySuggestion(
    s: AiSuggestion,
    roomWFeet?: number,
    roomHFeet?: number,
  ) {
    const { x, y, width, height } = suggestionToWorld(s, roomWFeet, roomHFeet);
    const floorId = activeFloorId ?? floors[0]?.floorId ?? "floor-1";

    if (s.type === "stage") {
      setStage((prev) => ({
        ...prev,
        x: x + width / 2,
        y: y + height / 2,
        width: Math.max(gridSize * 4, width),
        height: Math.max(gridSize * 3, height),
      }));
    } else if (s.type === "seating_zone") {
      // Generate a block of seats
      const cols = Math.max(1, Math.round(width / (gridSize * 1.2)));
      const rows = Math.max(1, Math.round(height / (gridSize * 1.2)));
      const generated: EditableSeat[] = [];
      for (let r = 0; r < rows; r++) {
        const rowLetter = toRowName(r);
        for (let c = 0; c < cols; c++) {
          const seatId = `ai-${floorId}-${s.label.replace(/\s+/g, "-")}-${r}-${c}-${Date.now()}`;
          generated.push({
            seatId,
            section: s.label,
            floorId,
            row: rowLetter,
            seatNumber: String(c + 1),
            posX: x + c * gridSize * 1.2,
            posY: y + r * gridSize * 1.2,
            isAvailable: true,
          });
        }
      }
      setSeats((prev) => [...prev, ...generated]);
    } else {
      // All other element types
      const elemType = s.type as LayoutElement["type"];
      const elemId = `${elemType}-ai-${Date.now()}`;
      const el: LayoutElement = {
        elementId: elemId,
        type: elemType,
        floorId,
        x,
        y,
        width,
        height,
        label: s.label,
        ...(elemType === "aisle"
          ? {
              orientation:
                width >= height
                  ? ("horizontal" as const)
                  : ("vertical" as const),
              length: Math.max(width, height),
              thickness: Math.min(width, height),
            }
          : {}),
        ...(elemType === "table"
          ? { tableShape: "round" as const, seatCount: s.estimatedSeats ?? 4 }
          : {}),
        ...(elemType === "entrance" ? { arrowDir: "up" as const } : {}),
      };
      setElements((prev) => [...prev, el]);
      if (elemType === "table") {
        const tSeats = generateTableSeats(el, floorId);
        setSeats((prev) => [...prev, ...tSeats]);
      }
    }
  }

  function applyAllSuggestions() {
    if (!aiResult) return;

    // ── Auto-scale: apply real-world measurements from AI analysis ────────────
    // The AI returns estimated venue dimensions and a reference seat size.
    // We use these to set the room boundary and seat size so the generated
    // layout is 1:1 with real-world feet on the grid (1 grid cell = 1 ft).
    const roomWFeet =
      typeof aiResult.estimatedVenueWidthFeet === "number" &&
      aiResult.estimatedVenueWidthFeet > 0
        ? aiResult.estimatedVenueWidthFeet
        : undefined;
    const roomHFeet =
      typeof aiResult.estimatedVenueHeightFeet === "number" &&
      aiResult.estimatedVenueHeightFeet > 0
        ? aiResult.estimatedVenueHeightFeet
        : undefined;

    if (roomWFeet && roomHFeet) {
      // Update room boundary so canvas shows the correct area
      setRoomBoundary({ width: roomWFeet, height: roomHFeet });
      setPlannerRoomWidth(Math.round(roomWFeet));
      setPlannerRoomHeight(Math.round(roomHFeet));
    }

    if (
      aiResult.referenceSeat &&
      typeof aiResult.referenceSeat.widthFeet === "number" &&
      aiResult.referenceSeat.widthFeet > 0
    ) {
      // Scale seats to their detected real-world width
      setSeatSizeFeet(aiResult.referenceSeat.widthFeet);
    }

    // Pass the freshly-computed room dims directly to each suggestion so they
    // use the updated scale even before React re-renders with new state.
    aiResult.suggestions.forEach((s, idx) => {
      if (!rejectedSuggestionIds.has(idx)) {
        applySuggestion(s, roomWFeet, roomHFeet);
      }
    });
    setShowAiPanel(false);
    setAiResult(null);
  }

  /** Upload background image immediately (before Save) + trigger analysis */
  async function handleUploadAndAnalyze() {
    if (!layoutId || !localBgFile) return;
    setUploadingBgNow(true);
    setAiError(null);
    try {
      const result = await api.uploadSeatingLayoutBackgroundImage(
        layoutId,
        localBgFile,
      );
      setBackgroundImageUrl(result.imageUrl);
      if (localBgBlob) {
        URL.revokeObjectURL(localBgBlob);
        setLocalBgBlob(null);
      }
      setLocalBgFile(null);
      setShowBackgroundImage(true);
      // Now analyze
      await triggerAnalysis();
    } catch (e) {
      setAiError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploadingBgNow(false);
    }
  }

  async function triggerAnalysis() {
    if (!layoutId) return;
    setAiAnalyzing(true);
    setAiError(null);
    try {
      const resp = await api.analyzeSeatingLayoutImage(layoutId);
      setAiResult(resp.aiSuggestions);
      setRejectedSuggestionIds(new Set());
      setShowAiPanel(true);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : String(e));
    } finally {
      setAiAnalyzing(false);
    }
  }

  async function handleSave() {
    if (!layoutId) return;
    setSaving(true);
    setSaveError(null);
    setSaveOk(false);

    try {
      let resolvedBgUrl = backgroundImageUrl.trim() || undefined;

      // If the user picked a local file, upload it first to get a persisted URL
      if (localBgFile) {
        const result = await api.uploadSeatingLayoutBackgroundImage(
          layoutId,
          localBgFile,
        );
        resolvedBgUrl = result.imageUrl;
        setBackgroundImageUrl(result.imageUrl);
        // Release the blob URL since we now have a server URL
        if (localBgBlob) {
          URL.revokeObjectURL(localBgBlob);
          setLocalBgBlob(null);
        }
        setLocalBgFile(null);
      }

      const sections = computeSectionsFromSeats(seats);
      await api.updateSeatingLayout(layoutId, {
        name: name.trim() || "Seating",
        description: description.trim() || undefined,
        stagePosition,
        floors,
        elements,
        backgroundImageUrl: resolvedBgUrl,
        stage,
        sections,
        seats,
        roomBoundary: roomBoundary ?? undefined,
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
      const w = (el.orientation === "vertical" ? el.thickness : el.length) ?? 0;
      const h = (el.orientation === "vertical" ? el.length : el.thickness) ?? 0;
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
        const newSeatSizeFt = Math.max(1, Math.floor(maxSeatSize * 4) / 4);
        const deferredSpacingFeet = spacingFeet;
        const deferredOpts = opts;
        confirmThen(
          `These ${count} seats would overlap at the current seat size (${seatSizeFeet.toFixed(2)} ft).\n\nResize seats automatically to ~${maxSeatSize.toFixed(2)} ft to fit?`,
          () => {
            setSeatSizeFeet(newSeatSizeFt);
            const sPx = deferredSpacingFeet * gridSize;
            const ctr = samplePolyline(deferredOpts.points, sPx);
            if (ctr.length < 2) return;
            const sec = newSectionName.trim() || "Main";
            const ts = Date.now();
            const gen: EditableSeat[] = ctr.map((c, idx) => {
              let x = c.x,
                y = c.y;
              if (snapToGrid) {
                x = snap(x, gridSize);
                y = snap(y, gridSize);
              }
              return {
                seatId: `path-${deferredOpts.floorId}-${ts}-${idx + 1}`,
                section: sec,
                floorId: deferredOpts.floorId,
                row: "P",
                seatNumber: String(idx + 1),
                posX: x,
                posY: y,
                isAvailable: true,
              };
            });
            setSeats((prev) => [...prev, ...gen]);
            setSelectedSeatId(gen[0]?.seatId ?? null);
          },
        );
        return;
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

      // Tap-tap mode: if rowDraft already exists, this is the second tap →
      // finalize immediately with the new end point.
      if (rowDraft) {
        const finalDraft = { ...rowDraft, end: snapped };
        generateRowFromDraft(finalDraft);
        setRowDraft(null);
        rowDownScreenRef.current = null;
        return;
      }

      // First tap / start of drag: set the draft start point.
      rowDownScreenRef.current = { x: e.clientX, y: e.clientY };
      setRowDraft({ start: snapped, end: snapped, floorId: activeFloorId });
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }

    if (tool === "table") {
      const world = screenToWorld(e);
      if (!world) return;
      const id = `table-${Date.now()}`;
      const tableEl: LayoutElement = {
        elementId: id,
        type: "table",
        floorId: activeFloorId,
        tableShape: "round",
        x: snapToGrid ? snap(world.x, gridSize) : world.x,
        y: snapToGrid ? snap(world.y, gridSize) : world.y,
        width: 4 * gridSize,
        height: 4 * gridSize,
        seatCount: 4,
        label: `T${elements.filter((el) => el.type === "table").length + 1}`,
      };
      setElements((prev) => [...prev, tableEl]);
      const tSeats = generateTableSeats(tableEl, activeFloorId);
      setSeats((prev) => [...prev, ...tSeats]);
      setSelectedElementId(id);
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

  function handleViewportPointerUp(e: React.PointerEvent) {
    dragSeatIdRef.current = null;
    dragStartRef.current = null;
    panStartRef.current = null;
    dragRowRef.current = null;
    dragStageRef.current = null;
    dragElementRef.current = null;

    // Row tool: if the pointer moved >= 8px it was a drag → finalize now.
    // If it moved < 8px (a tap), keep rowDraft for the second tap.
    if (tool === "row" && rowDraft && rowDownScreenRef.current) {
      const dx = e.clientX - rowDownScreenRef.current.x;
      const dy = e.clientY - rowDownScreenRef.current.y;
      if (dx * dx + dy * dy >= 64) {
        generateRowFromDraft(rowDraft);
        setRowDraft(null);
      }
      rowDownScreenRef.current = null;
    }
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

  // Native wheel handler attached with { passive: false } so e.preventDefault() is honoured.
  // Reads latest pan/zoom from viewStateRef to avoid stale closures.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      if (!e.ctrlKey) {
        // Two-finger trackpad scroll → pan
        setView((prev) => ({
          ...prev,
          offsetX: prev.offsetX - e.deltaX,
          offsetY: prev.offsetY - e.deltaY,
        }));
        return;
      }
      // Pinch zoom (ctrlKey=true on macOS trackpad / Ctrl+scroll on mouse)
      const rect = el!.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const { offsetX, offsetY, scale } = viewStateRef.current;
      const worldX = (screenX - offsetX) / scale;
      const worldY = (screenY - offsetY) / scale;
      const delta = -e.deltaY;
      const zoomFactor = Math.exp(delta / 500);
      const nextScale = clamp(scale * zoomFactor, 0.25, 3);
      const nextOffsetX = screenX - worldX * nextScale;
      const nextOffsetY = screenY - worldY * nextScale;
      setView({ scale: nextScale, offsetX: nextOffsetX, offsetY: nextOffsetY });
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const toolHintText: Record<string, string> = {
    select:
      "V — Click seat to select. Drag to move. Delete/Backspace to remove.",
    row: "R — Click and drag to draw a row of seats.",
    pan: "H — Click and drag to pan. Space+drag also pans.",
    table: "T — Click anywhere to place a table.",
    measure: "M — Click and drag to measure distance.",
    path: "P — Click to lay path points, double-click to finalize.",
    aisle: "A — Click to place an aisle guide.",
    stage: "S — Click to reposition the stage.",
  };

  return (
    <HostDashboardShell
      title="Seat map editor"
      subtitle={
        location ? `Editing ${location.name}` : "Edit your venue seating"
      }
      hideTabs
    >
      <div className={styles.editorRoot}>
        {error ? <p className={ui.error}>{error}</p> : null}
        {saveError ? <p className={ui.error}>{saveError}</p> : null}
        {saveOk ? (
          <p className={ui.help} style={{ color: "var(--success)" }}>
            Saved.
          </p>
        ) : null}

        {/* ── Top bar ── */}
        <div className={styles.editorTopBar}>
          <div className={styles.editorTopBarLeft}>
            {/* Floor tabs */}
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
          </div>
          <div className={styles.editorTopBarCenter}>
            <input
              className={ui.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Layout name"
              style={{ minWidth: 0, flex: "1 1 140px", maxWidth: 220 }}
            />
            <select
              className={ui.input}
              value={stagePosition}
              onChange={(e) =>
                setStagePosition(e.target.value as StagePosition)
              }
              style={{ flex: "0 0 auto" }}
            >
              <option value="top">Stage: top</option>
              <option value="bottom">Stage: bottom</option>
              <option value="left">Stage: left</option>
              <option value="right">Stage: right</option>
            </select>
          </div>
          <div className={styles.editorTopBarRight}>
            <span className={styles.zoomBadge}>
              {Math.round(view.scale * 100)}%
            </span>
            <button
              type="button"
              className={styles.toolBtn}
              onClick={() =>
                setView((prev) => ({
                  ...prev,
                  scale: Math.max(0.1, prev.scale / 1.2),
                }))
              }
              title="Zoom out (-)"
            >
              <span className={styles.toolIcon}>−</span>
            </button>
            <button
              type="button"
              className={styles.toolBtn}
              onClick={() =>
                setView((prev) => ({
                  ...prev,
                  scale: Math.min(10, prev.scale * 1.2),
                }))
              }
              title="Zoom in (+)"
            >
              <span className={styles.toolIcon}>+</span>
            </button>
            <Button variant="secondary" onClick={handleDone}>
              Done
            </Button>
            <Button onClick={handleSave} disabled={saving || !layoutId}>
              {saving ? "Saving…" : "Save"}
            </Button>
            <button
              type="button"
              className={[styles.toolBtn, styles.panelToggle].join(" ")}
              data-active={toolsOpen}
              onClick={() => setToolsOpen((v) => !v)}
              title="Toggle settings panel"
            >
              <span className={styles.toolIcon}>⚙</span>
            </button>
          </div>
        </div>

        {/* ── Main area ── */}
        <div className={styles.editorMain}>
          {/* Left vertical toolbar */}
          <div className={styles.leftToolbar}>
            {/* Select */}
            <button
              type="button"
              className={styles.leftToolItem}
              data-active={tool === "select"}
              onClick={() => setTool("select")}
              title="Select & move seats (S)"
            >
              <span className={styles.leftToolItemIcon}>↖</span>
              <span className={styles.leftToolItemLabel}>Select</span>
            </button>
            {/* Row */}
            <button
              type="button"
              className={styles.leftToolItem}
              data-active={tool === "row"}
              onClick={() => setTool("row")}
              title="Draw a row of seats (R)"
            >
              <span className={styles.leftToolItemIcon}>⊟</span>
              <span className={styles.leftToolItemLabel}>Row</span>
            </button>
            {/* Pan */}
            <button
              type="button"
              className={styles.leftToolItem}
              data-active={tool === "pan"}
              onClick={() => setTool("pan")}
              title="Pan the canvas (H)"
            >
              <span className={styles.leftToolItemIcon}>✥</span>
              <span className={styles.leftToolItemLabel}>Pan</span>
            </button>
            {/* Table */}
            <button
              type="button"
              className={styles.leftToolItem}
              data-active={tool === "table"}
              onClick={() => setTool("table")}
              title="Place table (T)"
            >
              <span className={styles.leftToolItemIcon}>⬛</span>
              <span className={styles.leftToolItemLabel}>Table</span>
            </button>
            <div className={styles.leftToolSeparator} />
            {/* Measure */}
            <button
              type="button"
              className={styles.leftToolItem}
              data-active={tool === "measure"}
              onClick={() => setTool("measure" as BuilderTool)}
              title="Measure distances"
            >
              <span className={styles.leftToolItemIcon}>↔</span>
              <span className={styles.leftToolItemLabel}>Measure</span>
            </button>
            {/* Path */}
            <button
              type="button"
              className={styles.leftToolItem}
              data-active={tool === "path"}
              onClick={() => setTool("path" as BuilderTool)}
              title="Seats along a path"
            >
              <span className={styles.leftToolItemIcon}>〜</span>
              <span className={styles.leftToolItemLabel}>Path</span>
            </button>
            {/* Aisle */}
            <button
              type="button"
              className={styles.leftToolItem}
              data-active={tool === "aisle"}
              onClick={() => setTool("aisle" as BuilderTool)}
              title="Add aisle guide"
            >
              <span className={styles.leftToolItemIcon}>⊩</span>
              <span className={styles.leftToolItemLabel}>Aisle</span>
            </button>
            {/* Stage */}
            <button
              type="button"
              className={styles.leftToolItem}
              data-active={tool === "stage"}
              onClick={() => setTool("stage" as BuilderTool)}
              title="Reposition stage"
            >
              <span className={styles.leftToolItemIcon}>⬜</span>
              <span className={styles.leftToolItemLabel}>Stage</span>
            </button>
            <div className={styles.leftToolSeparator} />
            {/* Clear all */}
            <button
              type="button"
              className={styles.leftToolItem}
              data-destructive
              onClick={clearArrangement}
              title="Clear all seats"
            >
              <span className={styles.leftToolItemIcon}>🗑</span>
              <span className={styles.leftToolItemLabel}>Clear</span>
            </button>
          </div>
          <div className={styles.canvasWrap}>
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
              style={{
                backgroundImage: showGrid
                  ? `linear-gradient(to right, color-mix(in srgb, var(--border) 55%, transparent) 1px, transparent 1px),\n                     linear-gradient(to bottom, color-mix(in srgb, var(--border) 55%, transparent) 1px, transparent 1px)`
                  : undefined,
                backgroundSize: `${scaledGrid}px ${scaledGrid}px`,
                backgroundPosition: `${gridOffsetX}px ${gridOffsetY}px`,
              }}
            >
              {showBackgroundImage && (localBgBlob || backgroundImageUrl) ? (
                <img
                  src={localBgBlob ?? getAssetUrl(backgroundImageUrl)}
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
                            ? (el.thickness ?? gridSize / 3)
                            : (el.length ?? 8 * gridSize),
                        height:
                          el.orientation === "vertical"
                            ? (el.length ?? 8 * gridSize)
                            : (el.thickness ?? gridSize / 3),
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

                {/* Room boundary */}
                {showRoomBoundary && roomBoundary && (
                  <div
                    className={styles.roomBoundary}
                    style={{
                      width: roomBoundary.width * gridSize,
                      height: roomBoundary.height * gridSize,
                    }}
                  />
                )}

                {/* Tables */}
                {visibleElements
                  .filter((el) => el.type === "table")
                  .map((el) => (
                    <div
                      key={el.elementId}
                      className={styles.elementTable}
                      data-selected={el.elementId === selectedElementId}
                      data-shape={el.tableShape ?? "round"}
                      onPointerDown={(e) =>
                        handleElementPointerDown(e, el.elementId)
                      }
                      style={{
                        transform: `translate(${el.x}px, ${el.y}px)`,
                        width: el.width ?? 4 * gridSize,
                        height: el.height ?? 4 * gridSize,
                      }}
                      title={el.label || "Table"}
                    >
                      {el.label ? (
                        <span className={styles.elementLabel}>{el.label}</span>
                      ) : null}
                    </div>
                  ))}

                {/* Railings */}
                {visibleElements
                  .filter((el) => el.type === "railing")
                  .map((el) => (
                    <div
                      key={el.elementId}
                      className={styles.elementRailing}
                      data-selected={el.elementId === selectedElementId}
                      data-orientation={el.orientation ?? "horizontal"}
                      onPointerDown={(e) =>
                        handleElementPointerDown(e, el.elementId)
                      }
                      style={{
                        transform: `translate(${el.x}px, ${el.y}px) translate(-50%, -50%)`,
                        width:
                          (el.orientation ?? "horizontal") === "vertical"
                            ? (el.thickness ?? gridSize / 3)
                            : (el.length ?? 8 * gridSize),
                        height:
                          (el.orientation ?? "horizontal") === "vertical"
                            ? (el.length ?? 8 * gridSize)
                            : (el.thickness ?? gridSize / 3),
                      }}
                      title={el.label || "Railing"}
                    />
                  ))}

                {/* Stairs */}
                {visibleElements
                  .filter((el) => el.type === "stairs")
                  .map((el) => (
                    <div
                      key={el.elementId}
                      className={styles.elementStairs}
                      data-selected={el.elementId === selectedElementId}
                      onPointerDown={(e) =>
                        handleElementPointerDown(e, el.elementId)
                      }
                      style={{
                        transform: `translate(${el.x}px, ${el.y}px)`,
                        width: el.width ?? 4 * gridSize,
                        height: el.height ?? 3 * gridSize,
                      }}
                      title={el.label || "Stairs"}
                    >
                      <div className={styles.stairsStripes} />
                      {el.label ? (
                        <span className={styles.elementLabel}>{el.label}</span>
                      ) : null}
                    </div>
                  ))}

                {/* Dance floors */}
                {visibleElements
                  .filter((el) => el.type === "dance_floor")
                  .map((el) => (
                    <div
                      key={el.elementId}
                      className={styles.elementDanceFloor}
                      data-selected={el.elementId === selectedElementId}
                      onPointerDown={(e) =>
                        handleElementPointerDown(e, el.elementId)
                      }
                      style={{
                        transform: `translate(${el.x}px, ${el.y}px)`,
                        width: el.width ?? 10 * gridSize,
                        height: el.height ?? 10 * gridSize,
                      }}
                      title={el.label || "Dance Floor"}
                    >
                      <span className={styles.elementLabel}>
                        {el.label ?? "Dance Floor"}
                      </span>
                    </div>
                  ))}

                {/* Entrances / Exits */}
                {visibleElements
                  .filter((el) => el.type === "entrance")
                  .map((el) => (
                    <div
                      key={el.elementId}
                      className={styles.elementEntrance}
                      data-selected={el.elementId === selectedElementId}
                      data-dir={el.arrowDir ?? "up"}
                      onPointerDown={(e) =>
                        handleElementPointerDown(e, el.elementId)
                      }
                      style={{
                        transform: `translate(${el.x}px, ${el.y}px)`,
                        width: el.width ?? 3 * gridSize,
                        height: el.height ?? 2 * gridSize,
                      }}
                      title={el.label || "Entrance"}
                    >
                      <span className={styles.elementLabel}>
                        {el.label ?? "↑"}
                      </span>
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

                  const seatColor =
                    sectionColorMap.get(s.section || "Main") ??
                    SECTION_COLORS[0]!;

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
                      style={
                        {
                          transform: `translate(${x}px, ${y}px) translate(-50%, -50%) rotate(${s.rotationDeg ?? 0}deg)`,
                          width: seatSizeFeet * gridSize,
                          height: seatSizeFeet * gridSize,
                          "--seat-color": seatColor,
                        } as React.CSSProperties
                      }
                      title={`${s.section} ${s.row}${s.seatNumber}`}
                    >
                      <span className={styles.seatBack} aria-hidden="true" />
                      <span className={styles.seatCushion}>
                        {showSeatText ? (
                          <span className={styles.seatText}>
                            {s.row}
                            {s.seatNumber}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>
              {toolHintText[tool] ? (
                <div className={styles.hintPill}>{toolHintText[tool]}</div>
              ) : null}
            </div>
          </div>

          {/* ── Right panel: always-visible settings / inspector ── */}
          <div
            className={styles.sidePanel}
            data-open={toolsOpen}
            onWheel={(e) => e.stopPropagation()}
          >
            <div className={styles.panelHeader}>
              <span className={styles.panelTitle}>
                {selectedSeat ? "Edit Seat" : "Settings"}
              </span>
              {selectedSeat ? (
                <button
                  type="button"
                  className={styles.panelClose}
                  onClick={() => {
                    setSelectedSeatId(null);
                    setSelectedRowGroupId(null);
                  }}
                  aria-label="Close inspector"
                >
                  ✕
                </button>
              ) : null}
            </div>

            <div className={styles.panelBody}>
              {selectedSeat ? (
                /* ── Seat inspector ──────────────────────────────── */
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 12 }}
                >
                  <div className={styles.seatInspectorGrid}>
                    <input
                      className={ui.input}
                      value={selectedSeat.section}
                      onChange={(e) =>
                        updateSeat(selectedSeat.seatId, {
                          section: e.target.value,
                        })
                      }
                      placeholder="Section"
                      aria-label="Section"
                    />
                    <input
                      className={ui.input}
                      value={selectedSeat.row}
                      onChange={(e) =>
                        updateSeat(selectedSeat.seatId, { row: e.target.value })
                      }
                      placeholder="Row"
                      aria-label="Row"
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
                      aria-label="Seat number"
                    />
                    <select
                      className={ui.input}
                      value={selectedSeat.floorId || activeFloorId}
                      onChange={(e) =>
                        updateSeat(selectedSeat.seatId, {
                          floorId: e.target.value,
                        })
                      }
                      aria-label="Floor"
                    >
                      {stableSortFloors(floors).map((f) => (
                        <option key={f.floorId} value={f.floorId}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                    <label className={styles.toggle}>
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
                      <label className={styles.toggle}>
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
                      onClick={() =>
                        updateSeat(selectedSeat.seatId, { posX: 0, posY: 0 })
                      }
                    >
                      Center
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteSeat(selectedSeat.seatId)}
                    >
                      Delete seat
                    </Button>
                  </div>
                  <div className={ui.help}>
                    ID:{" "}
                    <code style={{ fontSize: "11px" }}>
                      {selectedSeat.seatId}
                    </code>
                  </div>
                  <div className={ui.divider} />
                  <div className={ui.help}>
                    Total seats:{" "}
                    <strong style={{ color: "var(--text)" }}>
                      {seats.length}
                    </strong>
                  </div>
                </div>
              ) : (
                /* ── Canvas settings ─────────────────────────────── */
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: spacing.md,
                  }}
                >
                  <div>
                    <div className={ui.help} style={{ marginBottom: 4 }}>
                      Description
                    </div>
                    <input
                      className={ui.input}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Description (optional)"
                      style={{ width: "100%" }}
                    />
                  </div>
                  {/* Add Section -- primary entry point */}
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setWizardOpen(true)}
                    style={{ width: "100%" }}
                  >
                    + Add Section
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPreviewOpen(true)}
                    style={{ width: "100%" }}
                  >
                    Preview / Export
                  </Button>
                  <div className={ui.divider} />
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
                          const r = viewportRef.current.getBoundingClientRect();
                          setView({
                            scale: 1,
                            offsetX: r.width / 2,
                            offsetY: r.height / 2,
                          });
                        }}
                      >
                        Reset view
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setView((prev) => ({ ...prev, scale: 1 }))
                        }
                      >
                        100%
                      </Button>
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
                      </div>
                    ) : null}
                  </div>
                  <div className={ui.divider} />
                  <div>
                    <div className={ui.help} style={{ marginBottom: 6 }}>
                      Path tool
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
                      />
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
                      {selectedElementId
                        ? (() => {
                            const selEl = elements.find(
                              (e) => e.elementId === selectedElementId,
                            );
                            const elTypeLabel: Record<string, string> = {
                              aisle: "Aisle",
                              table: "Table",
                              railing: "Railing",
                              stairs: "Stairs",
                              dance_floor: "Dance Floor",
                              entrance: "Entrance / Exit",
                            };
                            const label = selEl
                              ? (elTypeLabel[selEl.type] ?? "Element")
                              : "Element";
                            return (
                              <>
                                {selEl?.type === "table" && (
                                  <div
                                    style={{
                                      marginBottom: 8,
                                      padding: "8px",
                                      background: "var(--surface-2)",
                                      borderRadius: "var(--radius-sm)",
                                      border: "1px solid var(--border)",
                                    }}
                                  >
                                    <div
                                      className={ui.help}
                                      style={{
                                        marginBottom: 6,
                                        fontWeight: 600,
                                      }}
                                    >
                                      {selEl.label ?? "Table"} — edit
                                    </div>
                                    <label className={ui.help}>Shape</label>
                                    <select
                                      className={ui.input}
                                      value={selEl.tableShape ?? "round"}
                                      onChange={(e) =>
                                        setElements((prev) =>
                                          prev.map((el) =>
                                            el.elementId === selectedElementId
                                              ? {
                                                  ...el,
                                                  tableShape: e.target.value as
                                                    | "round"
                                                    | "rect",
                                                }
                                              : el,
                                          ),
                                        )
                                      }
                                      style={{ marginBottom: 4 }}
                                    >
                                      <option value="round">Round</option>
                                      <option value="rect">Rectangular</option>
                                    </select>
                                    <label className={ui.help}>Seats</label>
                                    <input
                                      className={ui.input}
                                      type="number"
                                      min={1}
                                      max={30}
                                      value={selEl.seatCount ?? 4}
                                      onChange={(e) => {
                                        const n = Number(e.target.value) || 4;
                                        setElements((prev) =>
                                          prev.map((el) =>
                                            el.elementId === selectedElementId
                                              ? { ...el, seatCount: n }
                                              : el,
                                          ),
                                        );
                                        // Regenerate seats for this table
                                        setSeats((prev) => {
                                          const updated = {
                                            ...selEl,
                                            seatCount: n,
                                          };
                                          const newSeats = generateTableSeats(
                                            updated,
                                            selEl.floorId ??
                                              activeFloorId ??
                                              "floor-1",
                                          );
                                          newSeats.forEach((s) => {
                                            const existingFloorSeats =
                                              prev.filter(
                                                (ps) =>
                                                  ps.rowGroupId ===
                                                  `table-${selectedElementId}`,
                                              );
                                            if (existingFloorSeats[0]) {
                                              s.section =
                                                existingFloorSeats[0].section;
                                            }
                                          });
                                          return [
                                            ...prev.filter(
                                              (s) =>
                                                s.rowGroupId !==
                                                `table-${selectedElementId}`,
                                            ),
                                            ...newSeats,
                                          ];
                                        });
                                      }}
                                      style={{ marginBottom: 4 }}
                                      aria-label="Seat count"
                                    />
                                    <label className={ui.help}>Label</label>
                                    <input
                                      className={ui.input}
                                      type="text"
                                      value={selEl.label ?? ""}
                                      onChange={(e) =>
                                        setElements((prev) =>
                                          prev.map((el) =>
                                            el.elementId === selectedElementId
                                              ? { ...el, label: e.target.value }
                                              : el,
                                          ),
                                        )
                                      }
                                      placeholder="T1"
                                      aria-label="Table label"
                                    />
                                  </div>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    const el = elements.find(
                                      (e) => e.elementId === selectedElementId,
                                    );
                                    const doDelete = () => {
                                      setElements((prev) =>
                                        prev.filter(
                                          (e) =>
                                            e.elementId !== selectedElementId,
                                        ),
                                      );
                                      if (el?.type === "table") {
                                        setSeats((prev) =>
                                          prev.filter(
                                            (s) =>
                                              s.rowGroupId !==
                                              `table-${selectedElementId}`,
                                          ),
                                        );
                                      }
                                      setSelectedElementId(null);
                                    };
                                    if (el?.type === "table") {
                                      const seatCount = seats.filter(
                                        (s) =>
                                          s.rowGroupId ===
                                          `table-${selectedElementId}`,
                                      ).length;
                                      confirmThen(
                                        `Delete table "${el.label ?? el.elementId}" and its ${seatCount} seat(s)?`,
                                        doDelete,
                                      );
                                    } else {
                                      doDelete();
                                    }
                                  }}
                                >
                                  Delete {label}
                                </Button>
                              </>
                            );
                          })()
                        : null}
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
                        value={
                          gridSize > 0 && isFinite(stage.width / gridSize)
                            ? Math.round(stage.width / gridSize)
                            : ""
                        }
                        onChange={(e) =>
                          setStage((prev) => ({
                            ...prev,
                            width: (Number(e.target.value) || 20) * gridSize,
                          }))
                        }
                        aria-label="Stage width (ft)"
                      />
                      <input
                        className={ui.input}
                        type="number"
                        min={1}
                        step={1}
                        value={
                          gridSize > 0 && isFinite(stage.height / gridSize)
                            ? Math.round(stage.height / gridSize)
                            : ""
                        }
                        onChange={(e) =>
                          setStage((prev) => ({
                            ...prev,
                            height: (Number(e.target.value) || 6) * gridSize,
                          }))
                        }
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
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={autoLabelActiveFloor}
                    >
                      Auto-label active floor
                    </Button>
                    <div className={ui.help} style={{ marginTop: 6 }}>
                      Row A/B/C by Y position; seat numbers left→right by X.
                    </div>
                  </div>
                  <div className={ui.divider} />
                  <div>
                    <div
                      className={ui.sectionTitle}
                      style={{ marginBottom: 8 }}
                    >
                      Floor Plan Image
                    </div>
                    <label
                      className={ui.help}
                      style={{
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                        marginBottom: 8,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={showBackgroundImage}
                        onChange={(e) =>
                          setShowBackgroundImage(e.target.checked)
                        }
                      />
                      Show overlay
                    </label>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      <input
                        type="file"
                        accept="image/*"
                        style={{ fontSize: 12 }}
                        onChange={(e) => {
                          const file = e.target.files?.[0] ?? null;
                          if (localBgBlob) URL.revokeObjectURL(localBgBlob);
                          if (file) {
                            const blob = URL.createObjectURL(file);
                            setLocalBgFile(file);
                            setLocalBgBlob(blob);
                            setShowBackgroundImage(true);
                            setAiError(null);
                          } else {
                            setLocalBgFile(null);
                            setLocalBgBlob(null);
                          }
                        }}
                      />
                      {localBgBlob || backgroundImageUrl ? (
                        <img
                          src={localBgBlob ?? getAssetUrl(backgroundImageUrl)}
                          alt="Preview"
                          style={{
                            width: "100%",
                            maxHeight: 90,
                            objectFit: "contain",
                            borderRadius: 4,
                            border: "1px solid var(--border)",
                            marginTop: 4,
                          }}
                        />
                      ) : null}

                      {/* Primary action: Upload + Analyze (if local file selected) */}
                      {localBgFile ? (
                        <button
                          type="button"
                          className={styles.aiAnalyzeBtn}
                          disabled={uploadingBgNow || aiAnalyzing || !layoutId}
                          onClick={handleUploadAndAnalyze}
                        >
                          {uploadingBgNow
                            ? "Uploading…"
                            : aiAnalyzing
                              ? "Analyzing…"
                              : "✨ Upload & Analyze with AI"}
                        </button>
                      ) : null}

                      {/* Analyze again if already uploaded */}
                      {!localBgFile && backgroundImageUrl && (
                        <button
                          type="button"
                          className={styles.aiAnalyzeBtn}
                          style={{
                            background: "var(--surface-3)",
                            color: "var(--text)",
                          }}
                          disabled={aiAnalyzing || !layoutId}
                          onClick={triggerAnalysis}
                        >
                          {aiAnalyzing ? "Analyzing…" : "✨ Analyze with AI"}
                        </button>
                      )}

                      {aiAnalyzing && (
                        <span
                          className={ui.help}
                          style={{ fontSize: 11, color: "var(--text-muted)" }}
                        >
                          Qwen2.5-VL is analyzing your floor plan… this may take
                          30–90 seconds.
                        </span>
                      )}
                      {aiError && (
                        <span className={ui.error} style={{ fontSize: 11 }}>
                          {aiError}
                        </span>
                      )}
                      {aiResult && !showAiPanel && (
                        <button
                          type="button"
                          className={styles.aiAnalyzeBtn}
                          style={{
                            background: "var(--surface-3)",
                            color: "var(--text)",
                          }}
                          onClick={() => setShowAiPanel(true)}
                        >
                          📋 View {aiResult.suggestions.length} AI Suggestions
                        </button>
                      )}

                      {localBgFile && !uploadingBgNow && (
                        <span
                          className={ui.help}
                          style={{ color: "var(--warning)", fontSize: 11 }}
                        >
                          Or use "Save" to upload without analyzing.
                        </span>
                      )}
                    </div>
                    {/* URL fallback */}
                    <div style={{ marginTop: 10 }}>
                      <label className={ui.help}>Or paste a URL</label>
                      <input
                        className={ui.input}
                        value={backgroundImageUrl}
                        onChange={(e) => {
                          setBackgroundImageUrl(e.target.value);
                          // Clear local file if user switches to URL
                          if (e.target.value && localBgBlob) {
                            URL.revokeObjectURL(localBgBlob);
                            setLocalBgFile(null);
                            setLocalBgBlob(null);
                          }
                        }}
                        placeholder="/api/... or https://..."
                        style={{ marginTop: 4 }}
                      />
                    </div>
                    {localBgBlob || backgroundImageUrl ? (
                      <button
                        type="button"
                        className={ui.help}
                        style={{
                          marginTop: 6,
                          cursor: "pointer",
                          color: "var(--error)",
                          background: "none",
                          border: "none",
                          padding: 0,
                          fontSize: 11,
                        }}
                        onClick={() => {
                          if (localBgBlob) URL.revokeObjectURL(localBgBlob);
                          setLocalBgFile(null);
                          setLocalBgBlob(null);
                          setBackgroundImageUrl("");
                          setShowBackgroundImage(false);
                        }}
                      >
                        ✕ Remove image
                      </button>
                    ) : null}
                  </div>
                  <div className={ui.divider} />
                  <div className={ui.help}>
                    Total seats:{" "}
                    <strong style={{ color: "var(--text)" }}>
                      {seats.length}
                    </strong>
                  </div>

                  {/* ── Room Templates ── */}
                  <div className={ui.divider} />
                  <div className={ui.sectionTitle} style={{ marginBottom: 8 }}>
                    Room Templates
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 6,
                      marginBottom: 8,
                    }}
                  >
                    {ROOM_TEMPLATES.map((tpl) => (
                      <button
                        key={tpl.id}
                        className={ui.chip}
                        title={tpl.description}
                        onClick={() => applyRoomTemplate(tpl.id)}
                        style={{ cursor: "pointer" }}
                      >
                        {tpl.icon} {tpl.label}
                      </button>
                    ))}
                  </div>

                  {/* ── Room Planner ── */}
                  <div className={ui.divider} />
                  <div className={ui.sectionTitle} style={{ marginBottom: 8 }}>
                    Room Planner
                  </div>
                  <label className={ui.help}>Room size (ft) — W × H</label>
                  <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                    <input
                      className={ui.input}
                      type="number"
                      min={10}
                      step={1}
                      value={plannerRoomWidth}
                      onChange={(e) =>
                        setPlannerRoomWidth(Number(e.target.value) || 40)
                      }
                      aria-label="Room width (ft)"
                      style={{ width: "50%" }}
                      placeholder="W"
                    />
                    <input
                      className={ui.input}
                      type="number"
                      min={10}
                      step={1}
                      value={plannerRoomHeight}
                      onChange={(e) =>
                        setPlannerRoomHeight(Number(e.target.value) || 30)
                      }
                      aria-label="Room height (ft)"
                      style={{ width: "50%" }}
                      placeholder="H"
                    />
                  </div>
                  <div
                    style={{
                      marginBottom: 8,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <input
                      type="checkbox"
                      id="showRoomBoundary"
                      checked={showRoomBoundary}
                      onChange={(e) => {
                        setShowRoomBoundary(e.target.checked);
                        if (e.target.checked) {
                          setRoomBoundary({
                            width: plannerRoomWidth,
                            height: plannerRoomHeight,
                          });
                        }
                      }}
                    />
                    <label htmlFor="showRoomBoundary" style={{ fontSize: 12 }}>
                      Show room boundary
                    </label>
                  </div>
                  <label className={ui.help}>Table shape</label>
                  <select
                    className={ui.input}
                    value={plannerTableShape}
                    onChange={(e) =>
                      setPlannerTableShape(e.target.value as "round" | "rect")
                    }
                    style={{ marginBottom: 6 }}
                  >
                    <option value="round">Round</option>
                    <option value="rect">Rectangular</option>
                  </select>
                  <label className={ui.help}>Table size (ft)</label>
                  <input
                    className={ui.input}
                    type="number"
                    min={2}
                    max={12}
                    step={0.5}
                    value={plannerTableDiameter}
                    onChange={(e) =>
                      setPlannerTableDiameter(Number(e.target.value) || 4)
                    }
                    style={{ marginBottom: 6 }}
                    aria-label="Table size (ft)"
                  />
                  <label className={ui.help}>Seats per table</label>
                  <input
                    className={ui.input}
                    type="number"
                    min={2}
                    max={20}
                    step={1}
                    value={plannerSeatsPerTable}
                    onChange={(e) =>
                      setPlannerSeatsPerTable(Number(e.target.value) || 4)
                    }
                    style={{ marginBottom: 6 }}
                    aria-label="Seats per table"
                  />
                  <label className={ui.help}>Grid (cols × rows)</label>
                  <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                    <input
                      className={ui.input}
                      type="number"
                      min={1}
                      max={20}
                      step={1}
                      value={plannerCols}
                      onChange={(e) =>
                        setPlannerCols(Number(e.target.value) || 3)
                      }
                      aria-label="Columns"
                      style={{ width: "50%" }}
                      placeholder="Cols"
                    />
                    <input
                      className={ui.input}
                      type="number"
                      min={1}
                      max={20}
                      step={1}
                      value={plannerRows}
                      onChange={(e) =>
                        setPlannerRows(Number(e.target.value) || 2)
                      }
                      aria-label="Rows"
                      style={{ width: "50%" }}
                      placeholder="Rows"
                    />
                  </div>
                  <label className={ui.help}>Aisle width (ft)</label>
                  <input
                    className={ui.input}
                    type="number"
                    min={1}
                    max={20}
                    step={0.5}
                    value={plannerAisleWidth}
                    onChange={(e) =>
                      setPlannerAisleWidth(Number(e.target.value) || 3)
                    }
                    style={{ marginBottom: 6 }}
                    aria-label="Aisle width (ft)"
                  />
                  <label className={ui.help}>Section name</label>
                  <input
                    className={ui.input}
                    type="text"
                    value={plannerSectionName}
                    onChange={(e) => setPlannerSectionName(e.target.value)}
                    style={{ marginBottom: 10 }}
                    placeholder="Main"
                    aria-label="Section name"
                  />
                  <button
                    className={ui.chip}
                    onClick={() => generateSmartPlan()}
                    style={{
                      background: "var(--primary)",
                      color: "#fff",
                      border: "none",
                      cursor: "pointer",
                      width: "100%",
                      padding: "8px 0",
                      fontWeight: 600,
                      borderRadius: 6,
                    }}
                  >
                    ⚡ Generate Table Layout
                  </button>

                  {/* ── Add Preset Object ── */}
                  <div className={ui.divider} />
                  <div className={ui.sectionTitle} style={{ marginBottom: 8 }}>
                    Add Object
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {[
                      {
                        label: "🪑 Round 4",
                        type: "table" as const,
                        opts: {
                          tableShape: "round" as const,
                          width: 4 * gridSize,
                          height: 4 * gridSize,
                          seatCount: 4,
                        },
                      },
                      {
                        label: "🪑 Round 6",
                        type: "table" as const,
                        opts: {
                          tableShape: "round" as const,
                          width: 5 * gridSize,
                          height: 5 * gridSize,
                          seatCount: 6,
                        },
                      },
                      {
                        label: "📋 Rect 8",
                        type: "table" as const,
                        opts: {
                          tableShape: "rect" as const,
                          width: 8 * gridSize,
                          height: 3 * gridSize,
                          seatCount: 8,
                        },
                      },
                      {
                        label: "⛓️ Railing",
                        type: "railing" as const,
                        opts: {},
                      },
                      { label: "🪜 Stairs", type: "stairs" as const, opts: {} },
                      {
                        label: "💃 Dance Floor",
                        type: "dance_floor" as const,
                        opts: {},
                      },
                      {
                        label: "🚪 Entrance",
                        type: "entrance" as const,
                        opts: {},
                      },
                      {
                        label: "🚪 Exit",
                        type: "entrance" as const,
                        opts: { label: "Exit", arrowDir: "down" as const },
                      },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        className={ui.chip}
                        onClick={() =>
                          addPresetElement(preset.type, preset.opts)
                        }
                        style={{ cursor: "pointer" }}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        {/* ── Status bar ── */}
        <div className={styles.statusBar}>
          <span className={styles.statusBarItem}>
            {selectedSeat ? "1 selected" : ""}
          </span>
          <div className={styles.statusBarDivider} />
          <span className={styles.statusBarItem}>{seats.length} seats</span>
          <div className={styles.statusBarDivider} />
          <span className={styles.statusBarItem}>
            {Math.round(view.scale * 100)}%
          </span>
        </div>
      </div>

      {/* ── AI Suggestions Overlay Panel ── */}
      {showAiPanel && aiResult && (
        <div className={styles.aiPanel}>
          <div className={styles.aiPanelHeader}>
            <div>
              <span className={styles.aiPanelTitle}>✨ AI Analysis</span>
              {aiResult.capacityEstimate ? (
                <span className={styles.aiPanelBadge}>
                  ~{aiResult.capacityEstimate} seats estimated
                </span>
              ) : null}
            </div>
            <button
              type="button"
              className={styles.panelClose}
              onClick={() => setShowAiPanel(false)}
              aria-label="Close AI panel"
            >
              ✕
            </button>
          </div>

          {aiResult.description ? (
            <p className={styles.aiDescription}>{aiResult.description}</p>
          ) : null}

          {aiResult.stagePosition ? (
            <div className={styles.aiMeta}>
              Stage detected: <strong>{aiResult.stagePosition}</strong>
              <button
                type="button"
                className={styles.aiApplySmall}
                onClick={() => setStagePosition(aiResult.stagePosition!)}
              >
                Apply
              </button>
            </div>
          ) : null}

          {aiResult.estimatedVenueWidthFeet || aiResult.referenceSeat ? (
            <div className={styles.aiScaleBanner}>
              <span className={styles.aiScaleIcon}>📐</span>
              <div className={styles.aiScaleDetails}>
                <strong>Auto-scale detected</strong>
                {aiResult.estimatedVenueWidthFeet &&
                aiResult.estimatedVenueHeightFeet ? (
                  <span>
                    Venue: {Math.round(aiResult.estimatedVenueWidthFeet)} ×{" "}
                    {Math.round(aiResult.estimatedVenueHeightFeet)} ft
                  </span>
                ) : null}
                {aiResult.referenceSeat ? (
                  <span>
                    Seat: {aiResult.referenceSeat.widthFeet.toFixed(1)} ft wide
                    · {aiResult.referenceSeat.rowPitchFeet.toFixed(1)} ft row
                    pitch
                  </span>
                ) : null}
                <span className={styles.aiScaleNote}>
                  Layout will be scaled to real-world measurements when applied.
                </span>
              </div>
            </div>
          ) : null}

          <div className={styles.aiSuggestionList}>
            {aiResult.suggestions.map((s, idx) => {
              const rejected = rejectedSuggestionIds.has(idx);
              return (
                <div
                  key={idx}
                  className={styles.aiSuggestionCard}
                  data-rejected={rejected}
                >
                  <div className={styles.aiSuggestionTop}>
                    <span className={styles.aiSuggestionType}>
                      {s.type.replace(/_/g, " ")}
                    </span>
                    <span className={styles.aiSuggestionLabel}>{s.label}</span>
                    {s.estimatedSeats ? (
                      <span className={styles.aiSuggestionSeats}>
                        {s.estimatedSeats} seats
                      </span>
                    ) : null}
                  </div>
                  {s.notes ? (
                    <p className={styles.aiSuggestionNotes}>{s.notes}</p>
                  ) : null}
                  <div className={styles.aiSuggestionActions}>
                    {!rejected ? (
                      <>
                        <button
                          type="button"
                          className={styles.aiApplySmall}
                          onClick={() => {
                            applySuggestion(s);
                            setRejectedSuggestionIds(
                              (prev) => new Set([...prev, idx]),
                            );
                          }}
                        >
                          ✓ Apply
                        </button>
                        <button
                          type="button"
                          className={styles.aiRejectSmall}
                          onClick={() =>
                            setRejectedSuggestionIds(
                              (prev) => new Set([...prev, idx]),
                            )
                          }
                        >
                          ✕
                        </button>
                      </>
                    ) : (
                      <span className={ui.help} style={{ fontSize: 11 }}>
                        Skipped
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className={styles.aiPanelFooter}>
            <button
              type="button"
              className={styles.aiAnalyzeBtn}
              onClick={applyAllSuggestions}
            >
              ⚡ Apply All Remaining
            </button>
            <button
              type="button"
              className={styles.panelClose}
              style={{ fontSize: 12, padding: "4px 10px" }}
              onClick={() => setShowAiPanel(false)}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {confirmState ? (
        <ConfirmDialog
          message={confirmState.message}
          onConfirm={() => {
            const fn = confirmState.onConfirm;
            setConfirmState(null);
            fn();
          }}
          onCancel={() => setConfirmState(null)}
        />
      ) : null}

      {wizardOpen && (
        <SectionWizard
          onGenerate={handleWizardGenerate}
          onClose={() => setWizardOpen(false)}
          floorId={activeFloorId ?? floors[0]?.floorId ?? "floor-1"}
          gridSize={gridSize}
          stageX={stage.x}
          stageY={stage.y}
          stageWidth={stage.width}
          stageHeight={stage.height}
        />
      )}

      {previewOpen && (
        <LayoutPreviewModal
          seats={seats}
          sections={computeSectionsFromSeats(seats)}
          stagePosition={stagePosition}
          layoutName={name || "Layout"}
          onClose={() => setPreviewOpen(false)}
          onSave={handleSave}
        />
      )}

      {/* Mobile FAB */}
      <button
        className={styles.fab}
        onClick={() => setFabOpen((v) => !v)}
        aria-label="Actions"
      >
        ＋
      </button>
      {fabOpen && (
        <div className={styles.fabSheet}>
          <button
            className={styles.fabSheetAction}
            onClick={() => {
              setWizardOpen(true);
              setFabOpen(false);
            }}
          >
            ＋ Add Section
          </button>
          <button
            className={styles.fabSheetAction}
            onClick={() => {
              setTool("row");
              setFabOpen(false);
            }}
          >
            ＋ Add Row
          </button>
          <button
            className={styles.fabSheetAction}
            onClick={() => setPreviewOpen(true)}
          >
            Preview / Export
          </button>
        </div>
      )}
    </HostDashboardShell>
  );
}

export default SeatLayoutEditorPage;
