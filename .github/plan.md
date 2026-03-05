# Plan: Fix Ollama analyze-image + Photoshop-style Editor Layout

**Status:** 🟢 COMPLETE (Task 2)
**Goal:** (1) Kill the "fetch failed" 5-minute hang on analyze-image by fixing undici bodyTimeout. (2) Restructure SeatLayoutEditorPage into a Photoshop-style layout with a vertical left toolbar, horizontal top bar, and always-visible right panel.

---

## Context

### Task 1 — Ollama "fetch failed" Root Cause

The server uses Node.js 22 whose global `fetch()` is backed by undici. undici has two separate timeout values:

- **`headersTimeout`** (default 30 s) — time to receive the first byte of the response headers
- **`bodyTimeout`** (default **300 s = 5 min**) — time allowed for reading the full body after headers arrive

With `stream: true`, Ollama sends response headers immediately, so `headersTimeout` never fires. But undici's `bodyTimeout` fires at exactly 300,000 ms while the body stream is still being read — this is the 300,000+ ms hang observed in the network panel. The connection is then dropped by undici, which surfaces as `"fetch failed"`.

The existing `AbortController` timeout (600 s) never fires because undici's internal 300 s `bodyTimeout` fires first and drops the connection.

**Fix**: Import `Agent` from `undici` (bundled with Node.js 18+, no new package needed) and set `bodyTimeout: 0` and `headersTimeout: 0`. Switch back to `stream: false` — simpler single-response JSON, no NDJSON accumulator needed now that the timeout issue is solved.

**Secondary fix**: Downscale the background image to ≤ 640 px on the long edge before base64-encoding. A 3000×2000 px JPEG is ~4 MB base64; at 640 px it is ~70 KB. This cuts generation time from 5+ minutes to ~30 s. Requires `sharp` (not yet installed in server).

---

### Task 2 — Photoshop-style Editor Layout

Current structure (abbreviated):

```
HostDashboardShell
  div.page (flex col, gap 16px)
    div.headerCard (ui.card)       ← name, stagePos, desc, Done/Save
    div.editorBody (grid: 1fr 280px)
      div.viewportCard (ui.card)
        div.viewportToolbar        ← floors | tools | zoom
        div.viewport               ← canvas
      div.sidePanel                ← right panel (hidden ≤960px)
  AI overlay (fixed)
  FAB (fixed, mobile)
```

Target (Photoshop-style):

```
HostDashboardShell
  div.editorRoot (grid: 48px 1fr 28px)
    div.editorTopBar               ← name | stagePos | floors | zoom | Done/Save
    div.editorMain (grid: 52px 1fr 280px)
      div.leftToolbar              ← vertical tool strip
      div.canvasWrap
        div.viewport               ← canvas (unchanged internals)
      div.sidePanel                ← always visible ≥1100px, drawer on mobile
    div.statusBar                  ← seat count, coords, zoom %
  AI overlay (fixed)
  FAB (fixed, mobile)
```

---

## Steps

---

### TASK 1 — Steps

---

#### Step 1: Install `sharp` — `server/`

**Operation:** `RUN_COMMAND`

```bash
cd server && pnpm add sharp && pnpm add -D @types/sharp
```

**Verify:** `grep '"sharp"' server/package.json`

---

#### Step 2: Replace the Ollama fetch block — `server/src/routes/seating.ts` lines ~1125–1270

**Operation:** `REPLACE`

Replace the entire analyze-image route handler opening (from the JSDoc comment through the end of the `} catch (fetchErr` catch block opener). The exact anchor and replacement are shown below.

**What changes:**

1. After loading `blob.data`, add a `sharp` resize step (wrapped in try/catch so it degrades gracefully if sharp unavailable)
2. Replace the `fetch()` + `getReader()` streaming block with an undici `Agent`-based fetch using `stream: false`
3. Parse the single JSON object response directly (no NDJSON accumulator)

**Anchor — find this exact block starting at line ~1125:**

```typescript
      const base64Image = blob.data.toString("base64");

      // Concise prompt — fewer output tokens = much faster generation
      const OLLAMA_PROMPT = `Analyze this venue floor plan. Return ONLY valid JSON, no markdown or explanation.
```

**Code — replace from that anchor through (and including) the line `let ollamaResponse: { response: string };` and the entire inner try block up to but NOT including the `} catch (fetchErr: unknown) {` line:**

> NOTE TO IMPLEMENTER: The replacement block below is self-contained. Delete everything between `const base64Image = blob.data.toString("base64");` and `} catch (fetchErr: unknown) {` (exclusive), then insert the following code in its place:

```typescript
      // ── Downscale to ≤ 640 px before sending to Ollama ─────────────────
      // Full-res images encode to several MB of base64 and drastically slow
      // vision model generation. 640 px keeps enough detail for floor plans.
      let imageBuffer = blob.data;
      try {
        const sharp = (await import("sharp")).default;
        imageBuffer = await sharp(blob.data)
          .resize({ width: 640, height: 640, fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 82 })
          .toBuffer();
      } catch {
        // sharp unavailable — use original buffer unchanged
      }
      const base64Image = imageBuffer.toString("base64");

      // Concise prompt — fewer output tokens = much faster generation
      const OLLAMA_PROMPT = `Analyze this venue floor plan. Return ONLY valid JSON, no markdown or explanation.

{"description":"one sentence","stagePosition":"top"|"bottom"|"left"|"right"|null,"capacityEstimate":integer|null,"suggestions":[{"type":"stage"|"aisle"|"table"|"railing"|"stairs"|"dance_floor"|"entrance"|"seating_zone","label":"short name","xPct":0-100,"yPct":0-100,"widthPct":0-100,"heightPct":0-100,"estimatedSeats":integer|null}]}

Rules: xPct/yPct = top-left corner % of image. Include stage, seating areas, aisles, entrances. stagePosition = where stage is relative to audience.`;

      let ollamaResponse: { response: string };
      try {
        // ── Use undici Agent with bodyTimeout:0 and headersTimeout:0 ────────
        // Node.js global fetch() uses undici internally. undici's bodyTimeout
        // defaults to 300 s, which fires before a 32B vision model finishes
        // generating, causing "fetch failed". Setting both timeouts to 0
        // disables them; we rely solely on the AbortController for the hard cap.
        const {
          Agent,
          fetch: undiciFetch,
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        } = require("undici") as typeof import("undici");

        const noTimeoutAgent = new Agent({
          headersTimeout: 0,
          bodyTimeout: 0,
          connectTimeout: 10_000,
        });

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 720_000); // 12-min hard cap

        let ollamaFetchRes: Response;
        try {
          ollamaFetchRes = (await undiciFetch(
            "http://localhost:11434/api/generate",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                model: "qwen2.5vl:32b",
                prompt: OLLAMA_PROMPT,
                images: [base64Image],
                stream: false,       // single JSON response; simpler than NDJSON
                format: "json",
                keep_alive: "30m",
              }),
              // @ts-expect-error: undici dispatcher not in DOM RequestInit types
              dispatcher: noTimeoutAgent,
              signal: controller.signal,
            },
          )) as Response;
        } finally {
          clearTimeout(timeoutId);
        }

        if (!ollamaFetchRes.ok) {
          const errText = await ollamaFetchRes.text();
          throw new Error(`Ollama error ${ollamaFetchRes.status}: ${errText}`);
        }

        // stream:false → single JSON object:
        // { "model":"...", "response":"<full generated text>", "done":true, ... }
        const ollamaJson = (await ollamaFetchRes.json()) as {
          response?: string;
          message?: { content?: string };
        };

        const responseText =
          typeof ollamaJson.response === "string"
            ? ollamaJson.response
            : (ollamaJson.message?.content ?? "");

        ollamaResponse = { response: responseText };
```

**Verify:** `npx tsc --project server/tsconfig.json --noEmit 2>&1 | head -30`

---

### TASK 2 — Steps

---

#### Step 3: Add new CSS classes to `SeatLayoutEditorPage.module.scss`

**Operation:** `INSERT_AFTER`

**Anchor:**

```scss
/* ─── Page shell ──────────────────────────────────────────────────── */
.page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 100%;
}
```

**Code (insert immediately after the `.page {}` closing brace):**

```scss
/* ═══════════════════════════════════════════════════════════════════
   Photoshop-style editor layout
   ═══════════════════════════════════════════════════════════════════ */

/* ─── Editor root — full-bleed, fills shell content area ─────────── */
.editorRoot {
  display: grid;
  grid-template-rows: 48px 1fr 28px;
  height: calc(100dvh - var(--shell-header-height, 60px));
  min-height: 0;
  overflow: hidden;
  background: var(--surface);
}

/* ─── Top bar ─────────────────────────────────────────────────────── */
.editorTopBar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 10px;
  border-bottom: 1px solid var(--border);
  background: var(--surface-2);
  overflow: hidden;
  flex-shrink: 0;
}

.editorTopBarLeft {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
}

.editorTopBarCenter {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.editorTopBarRight {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

/* ─── Main triple-column grid ─────────────────────────────────────── */
.editorMain {
  display: grid;
  grid-template-columns: 52px 1fr 280px;
  min-height: 0;
  overflow: hidden;
}

@media (max-width: 1100px) {
  .editorMain {
    grid-template-columns: 52px 1fr;
  }
}

@media (max-width: 600px) {
  .editorRoot {
    grid-template-rows: 44px 1fr 24px;
  }
  .editorMain {
    grid-template-columns: 44px 1fr;
  }
}

/* ─── Left tool strip ─────────────────────────────────────────────── */
.leftToolbar {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 4px 0;
  border-right: 1px solid var(--border);
  background: var(--surface-2);
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: none;
}

.leftToolbar::-webkit-scrollbar {
  display: none;
}

.leftToolSeparator {
  width: 28px;
  height: 1px;
  background: var(--border);
  margin: 4px 0;
  flex-shrink: 0;
}

.leftToolItem {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  width: 44px;
  height: 44px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  flex-shrink: 0;
  position: relative;
  transition:
    background-color 0.12s,
    color 0.12s;
}

.leftToolItem:hover {
  background: color-mix(in srgb, var(--surface-3) 70%, transparent);
  color: var(--text);
}

.leftToolItem:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 1px;
}

.leftToolItem[data-active="true"] {
  background: var(--accent, #1c276e);
  color: #fff;
}

.leftToolItem[data-destructive]:hover {
  color: var(--error);
  background: color-mix(in srgb, var(--error) 12%, transparent);
}

.leftToolItemIcon {
  font-size: 16px;
  line-height: 1;
  pointer-events: none;
}

.leftToolItemLabel {
  font-size: 9px;
  font-weight: 600;
  line-height: 1;
  pointer-events: none;
  letter-spacing: 0.01em;
  text-transform: uppercase;
  opacity: 0.82;
}

/* Tooltip */
.leftToolItem::after {
  content: attr(title);
  position: absolute;
  left: calc(100% + 8px);
  top: 50%;
  transform: translateY(-50%);
  white-space: nowrap;
  padding: 4px 8px;
  background: var(--surface-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 600;
  color: var(--text);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  pointer-events: none;
  opacity: 0;
  z-index: 500;
  transition: opacity 0.1s 0.45s;
}

.leftToolItem:hover::after {
  opacity: 1;
}

/* ─── Canvas wrap ─────────────────────────────────────────────────── */
.canvasWrap {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  background: var(--surface);
}

/* ─── Status bar ──────────────────────────────────────────────────── */
.statusBar {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 0 12px;
  border-top: 1px solid var(--border);
  background: var(--surface-2);
  font-size: 11px;
  color: var(--text-muted);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
  overflow: hidden;
}

.statusBarItem {
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}

.statusBarDivider {
  width: 1px;
  height: 12px;
  background: var(--border);
  flex-shrink: 0;
}
```

---

#### Step 4: Update `.editorBody`, `.sidePanel`, and `.panelToggle` breakpoints — `SeatLayoutEditorPage.module.scss`

**Operation:** `REPLACE` — editorBody media query

**Anchor:**

```scss
@media (max-width: 960px) {
  .editorBody {
    grid-template-columns: minmax(0, 1fr);
  }
}
```

**Code:**

```scss
@media (max-width: 1100px) {
  .editorBody {
    grid-template-columns: minmax(0, 1fr);
  }
}
```

---

**Operation:** `REPLACE` — sidePanel media query

**Anchor:**

```scss
@media (max-width: 960px) {
  .sidePanel {
    display: none;
  }

  .sidePanel[data-open="true"] {
    display: flex;
  }
}
```

**Code:**

```scss
@media (max-width: 1100px) {
  .sidePanel {
    display: none;
  }

  .sidePanel[data-open="true"] {
    display: flex;
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: min(300px, 90vw);
    z-index: 400;
    border-radius: 0;
    border-left: 1px solid var(--border);
    box-shadow: -4px 0 20px rgba(0, 0, 0, 0.2);
  }
}
```

---

**Operation:** `REPLACE` — panelToggle media query

**Anchor:**

```scss
/* Hide panel toggle on desktop (panel always visible) */
@media (min-width: 961px) {
  .panelToggle {
    display: none;
  }
}
```

**Code:**

```scss
/* Hide panel toggle on desktop (panel always visible) */
@media (min-width: 1101px) {
  .panelToggle {
    display: none;
  }
}
```

---

#### Step 5: Restructure the JSX return block — `SeatLayoutEditorPage.tsx`

**Operation:** `REPLACE` — replace the outer wrapper + headerCard + editorBody opening + viewportToolbar with the new editorRoot + editorTopBar + editorMain + leftToolbar + canvasWrap

**Anchor (lines ~2349–2413, find this exact text):**

```tsx
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

        <div className={styles.editorBody}>
          <div className={[ui.card, styles.viewportCard].join(" ")}>
            <div className={styles.viewportToolbar}>
              {/* ── Left: floor tabs ─────────────────────────────── */}
              <div className={styles.floors}>
```

**Code:**

```tsx
  return (
    <HostDashboardShell
      title="Seat map editor"
      subtitle={
        location ? `Editing ${location.name}` : "Edit your venue seating"
      }
      hideTabs
    >
      <div className={styles.editorRoot}>
        {/* ── Top bar ─────────────────────────────────────────── */}
        <div className={styles.editorTopBar}>
          {/* Left: name + stage position */}
          <div className={styles.editorTopBarLeft}>
            <input
              className={ui.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Layout name"
              style={{ height: 28, fontSize: 13, maxWidth: 180 }}
            />
            <select
              className={ui.input}
              value={stagePosition}
              onChange={(e) =>
                setStagePosition(e.target.value as StagePosition)
              }
              style={{ height: 28, fontSize: 12, minWidth: 110 }}
            >
              <option value="top">Stage: top</option>
              <option value="bottom">Stage: bottom</option>
              <option value="left">Stage: left</option>
              <option value="right">Stage: right</option>
            </select>
          </div>

          {/* Center: floor tabs + zoom */}
          <div className={styles.editorTopBarCenter}>
            <div className={styles.floors}>
```

---

#### Step 6: Replace the end of the floor tabs + old viewportToolbar tools with closing floor-tabs div + zoom + topBarRight — `SeatLayoutEditorPage.tsx`

**Operation:** `REPLACE`

After the `+ Floor` button and before the old `{/* ── Center: primary tools + advanced dropdown */}` section, close the new top bar.

**Anchor (find lines ~2440–2580):**

```tsx
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

              {/* ── Center: primary tools + advanced dropdown ─────── */}
              <div className={styles.toolsGroup}>
                <div className={styles.primaryTools}>
                  <button
                    type="button"
                    className={styles.toolBtn}
                    data-active={tool === "select"}
                    onClick={() => setTool("select")}
                    title="Select & move seats (S)"
                  >
                    <span className={styles.toolIcon}>↖</span>
                    <span className={styles.toolLabel}>Select</span>
                  </button>
                  <button
                    type="button"
                    className={styles.toolBtn}
                    data-active={tool === "row"}
                    onClick={() => setTool("row")}
                    title="Draw a row of seats (R)"
                  >
                    <span className={styles.toolIcon}>⊟</span>
                    <span className={styles.toolLabel}>Row</span>
                  </button>
                  <button
                    type="button"
                    className={styles.toolBtn}
                    data-active={tool === "pan"}
                    onClick={() => setTool("pan")}
                    title="Pan the canvas (H)"
                  >
                    <span className={styles.toolIcon}>✥</span>
                    <span className={styles.toolLabel}>Pan</span>
                  </button>
                  <button
                    type="button"
                    className={styles.toolBtn}
                    data-active={tool === "table"}
                    onClick={() => setTool("table")}
                    title="Place table (T)"
                  >
                    <span className={styles.toolIcon}>⬛</span>
                    <span className={styles.toolLabel}>Table</span>
                  </button>
                </div>

                <div className={styles.advancedWrap}>
                  <button
                    type="button"
                    className={styles.toolBtn}
                    data-active={
                      advancedOpen ||
                      tool === "measure" ||
                      tool === "path" ||
                      tool === "aisle" ||
                      tool === "stage"
                    }
                    onClick={() => setAdvancedOpen((v) => !v)}
                    title="Advanced tools"
                  >
                    <span className={styles.toolIcon}>
                      {tool === "measure"
                        ? "↔"
                        : tool === "path"
                          ? "〜"
                          : tool === "aisle"
                            ? "⊩"
                            : tool === "stage"
                              ? "⬜"
                              : "⋯"}
                    </span>
                    <span className={styles.toolLabel}>
                      {tool === "measure"
                        ? "Measure"
                        : tool === "path"
                          ? "Path"
                          : tool === "aisle"
                            ? "Aisle"
                            : tool === "stage"
                              ? "Stage"
                              : "More"}
                    </span>
                    <span className={styles.chevron}>▾</span>
                  </button>
                  {advancedOpen && (
                    <div className={styles.advancedDropdown}>
                      {(
                        [
                          {
                            id: "measure",
                            icon: "↔",
                            label: "Measure",
                            title: "Measure distances",
                          },
                          {
                            id: "path",
                            icon: "〜",
                            label: "Path",
                            title: "Seats along a path",
                          },
                          {
                            id: "aisle",
                            icon: "⊩",
                            label: "Aisle",
                            title: "Add aisle guide",
                          },
                          {
                            id: "stage",
                            icon: "⬜",
                            label: "Stage",
                            title: "Reposition stage",
                          },
                        ] as const
                      ).map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          className={styles.dropdownItem}
                          data-active={tool === t.id}
                          title={t.title}
                          onClick={() => {
                            setTool(t.id as BuilderTool);
                            setAdvancedOpen(false);
                          }}
                        >
                          <span className={styles.toolIcon}>{t.icon}</span>
                          {t.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Right: zoom display + clear + panel toggle ───── */}
              <div className={styles.toolsRight}>
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
                <button
                  type="button"
                  className={styles.toolBtn}
                  data-destructive
                  onClick={clearArrangement}
                  title="Clear all seats"
                >
                  <span className={styles.toolIcon}>🗑</span>
                </button>
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
```

**Code (close the floor tabs → close editorTopBarCenter → add editorTopBarRight → close editorTopBar → open editorMain → left toolbar → canvasWrap):**

```tsx
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
              {/* zoom controls */}
              <div className={styles.toolsRight}>
                <button
                  type="button"
                  className={styles.toolBtn}
                  onClick={() =>
                    setView((prev) => ({
                      ...prev,
                      scale: Math.max(0.1, prev.scale / 1.2),
                    }))
                  }
                  title="Zoom out"
                >
                  <span className={styles.toolIcon}>−</span>
                </button>
                <span className={styles.zoomBadge}>
                  {Math.round(view.scale * 100)}%
                </span>
                <button
                  type="button"
                  className={styles.toolBtn}
                  onClick={() =>
                    setView((prev) => ({
                      ...prev,
                      scale: Math.min(10, prev.scale * 1.2),
                    }))
                  }
                  title="Zoom in"
                >
                  <span className={styles.toolIcon}>+</span>
                </button>
              </div>
            </div>
            {/* end editorTopBarCenter */}

            {/* Right: status feedback + panel toggle + Done/Save */}
            <div className={styles.editorTopBarRight}>
              {saveError || error ? (
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--error)",
                    maxWidth: 160,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {saveError || error}
                </span>
              ) : saveOk ? (
                <span style={{ fontSize: 11, color: "var(--success)" }}>
                  Saved ✓
                </span>
              ) : null}
              <button
                type="button"
                className={[styles.toolBtn, styles.panelToggle].join(" ")}
                data-active={toolsOpen}
                onClick={() => setToolsOpen((v) => !v)}
                title="Toggle settings panel"
              >
                <span className={styles.toolIcon}>⚙</span>
              </button>
              <Button variant="secondary" size="sm" onClick={handleDone}>
                Done
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving || !layoutId}
              >
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
          {/* end editorTopBar */}

          {/* ── Main area ──────────────────────────────────────── */}
          <div className={styles.editorMain}>
            {/* ── Left tool strip ──────────────────────────────── */}
            <div className={styles.leftToolbar}>
              <button
                type="button"
                className={styles.leftToolItem}
                data-active={tool === "select"}
                onClick={() => setTool("select")}
                title="Select & move (S)"
              >
                <span className={styles.leftToolItemIcon}>↖</span>
                <span className={styles.leftToolItemLabel}>Select</span>
              </button>
              <button
                type="button"
                className={styles.leftToolItem}
                data-active={tool === "row"}
                onClick={() => setTool("row")}
                title="Draw row (R)"
              >
                <span className={styles.leftToolItemIcon}>⊟</span>
                <span className={styles.leftToolItemLabel}>Row</span>
              </button>
              <button
                type="button"
                className={styles.leftToolItem}
                data-active={tool === "pan"}
                onClick={() => setTool("pan")}
                title="Pan canvas (H)"
              >
                <span className={styles.leftToolItemIcon}>✥</span>
                <span className={styles.leftToolItemLabel}>Pan</span>
              </button>
              <button
                type="button"
                className={styles.leftToolItem}
                data-active={tool === "path"}
                onClick={() => setTool("path")}
                title="Seats along path"
              >
                <span className={styles.leftToolItemIcon}>〜</span>
                <span className={styles.leftToolItemLabel}>Path</span>
              </button>
              <div className={styles.leftToolSeparator} />
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
              <button
                type="button"
                className={styles.leftToolItem}
                data-active={tool === "stage"}
                onClick={() => setTool("stage")}
                title="Reposition stage"
              >
                <span className={styles.leftToolItemIcon}>⬜</span>
                <span className={styles.leftToolItemLabel}>Stage</span>
              </button>
              <button
                type="button"
                className={styles.leftToolItem}
                data-active={tool === "aisle"}
                onClick={() => setTool("aisle")}
                title="Add aisle"
              >
                <span className={styles.leftToolItemIcon}>⊩</span>
                <span className={styles.leftToolItemLabel}>Aisle</span>
              </button>
              <button
                type="button"
                className={styles.leftToolItem}
                data-active={tool === "measure"}
                onClick={() => setTool("measure")}
                title="Measure distance"
              >
                <span className={styles.leftToolItemIcon}>↔</span>
                <span className={styles.leftToolItemLabel}>Measure</span>
              </button>
              <div className={styles.leftToolSeparator} />
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
            {/* end leftToolbar */}

            {/* ── Canvas area ─────────────────────────────────── */}
            <div className={styles.canvasWrap}>
```

---

#### Step 7: Replace the closing structure — `SeatLayoutEditorPage.tsx`

**Operation:** `REPLACE` — close canvasWrap, end editorMain, add statusBar, close editorRoot

**Anchor:**

```tsx
            {toolHintText[tool] ? (
                <div className={styles.hintPill}>{toolHintText[tool]}</div>
              ) : null}
            </div>

            {/* seatInspector moved to sidePanel */}
          </div>

          {/* ── Right panel: always-visible settings / inspector ── */}
          <div
            className={styles.sidePanel}
```

**Code:**

```tsx
            {toolHintText[tool] ? (
                <div className={styles.hintPill}>{toolHintText[tool]}</div>
              ) : null}
            </div>
            {/* end viewport */}
          </div>
          {/* end canvasWrap */}

          {/* ── Right panel: always-visible settings / inspector ── */}
          <div
            className={styles.sidePanel}
```

---

#### Step 8: Replace the old editorBody/page closing divs and add statusBar — `SeatLayoutEditorPage.tsx`

**Operation:** `REPLACE`

**Anchor (the closing divs just before the AI panel comment — lines ~4250):**

```tsx
            </div>
          </div>
        </div>
      </div>

      {/* ── AI Suggestions Overlay Panel ── */}
```

**Code:**

```tsx
            </div>
          </div>
          {/* end sidePanel */}
        </div>
        {/* end editorMain */}

        {/* ── Status bar ────────────────────────────────────── */}
        <div className={styles.statusBar}>
          <span className={styles.statusBarItem}>
            {seats.length} seat{seats.length !== 1 ? "s" : ""}
          </span>
          {selectedSeatId ? (() => {
            const ss = seats.find((s) => s.seatId === selectedSeatId);
            if (!ss) return null;
            return (
              <>
                <span className={styles.statusBarDivider} />
                <span className={styles.statusBarItem}>
                  {ss.section} · {ss.row}{ss.seatNumber}
                </span>
                <span className={styles.statusBarDivider} />
                <span className={styles.statusBarItem}>
                  ({Math.round(ss.posX ?? 0)}, {Math.round(ss.posY ?? 0)})
                </span>
              </>
            );
          })() : null}
          <span className={styles.statusBarDivider} />
          <span className={styles.statusBarItem}>
            {Math.round(view.scale * 100)}%
          </span>
        </div>
      </div>
      {/* end editorRoot */}

      {/* ── AI Suggestions Overlay Panel ── */}
```

**Verify:** `npx tsc --project TripleAMusic/tsconfig.json --noEmit 2>&1 | head -50`

---

## Implementation Order

1. `cd server && pnpm add sharp && pnpm add -D @types/sharp`
2. Apply Step 2 (seating.ts Ollama fetch replacement)
3. `npx tsc -p server/tsconfig.json --noEmit` — verify Task 1
4. Apply Step 3 (SCSS new classes)
5. Apply Step 4 (SCSS breakpoint updates × 3)
6. Apply Step 5 (JSX return wrapper replacement)
7. Apply Step 6 (floor tabs close + zoom + topBarRight + leftToolbar + canvasWrap)
8. Apply Step 7 (close canvasWrap)
9. Apply Step 8 (close editorMain + add statusBar + close editorRoot)
10. `npx tsc -p TripleAMusic/tsconfig.json --noEmit` — verify Task 2
11. Browser smoke test: check layout, tools activate, floor tabs work, panel toggles on mobile

---

## Risk Notes

- **undici import**: `require("undici")` works in Node.js 18+ without extra install. The `// @ts-expect-error` comment suppresses the `dispatcher` type mismatch (DOM `RequestInit` doesn't include it; undici internally accepts it).
- **sharp**: Dynamic `import("sharp")` in a try/catch gracefully degrades — no crash if not installed, image sent at full size.
- **`selectedSeatId` vs `selectedSeat`**: The existing code has `const selectedSeat = seats.find(...)` inside the JSX body (sidePanel). Step 8's status bar uses an inline IIFE to avoid redeclaration conflicts.
- **`advancedOpen` state**: The `advancedOpen` state and `advancedDropdown` dropdown are no longer used in the new toolbar (all tools are directly visible in the left strip). After the refactor both `advancedOpen` state and the `advancedWrap`/`advancedDropdown` JSX can be removed. Leaving them as dead code won't cause compile errors; can be cleaned up in a separate pass.
- **Viewport height**: `calc(100dvh - var(--shell-header-height, 60px))` relies on the shell setting `--shell-header-height`. If the shell does not set this variable, the fallback `60px` should be visually close. Can be tuned after visual review.
