# Plan: Artist-Style Venue Tracing Pipeline

**Status:** � COMPLETE
**Goal:** Replace the current seat-cluster-first detector with a phased tracing pipeline that follows the real floor-plan geometry, rejects text, and exposes enough debug output to tune accuracy reliably.

---

## Context

The current output is poor because the detector is not actually tracing the plan first and interpreting it second.

Confirmed from the current code and latest sample result:

- `venue_contour_detect.py` detects global connected-component seat candidates first, then forces them into up to three clusters with k-means.
- Seating polygons are derived from blobbed seat dots instead of traced from the actual seating boundaries drawn on the image.
- The latest output for `.github/example2.jpg` shows exactly that failure mode: three small seat hulls with 680 seats, one giant void, no stage, and only one opening.
- Text rejection is narrow: it mostly suppresses left-edge text/table artifacts and ruled lines, but it does not robustly remove labels embedded inside the plan.
- Void detection is computed as `interior - seating_mask`, so once the seating mask is wrong, the void mask becomes a giant catch-all polygon and destroys later stage/opening inference.
- Seat numbering is done by y-sorting within each section, which breaks for curved, rotated, or wedge-shaped rows.
- The preview tooling shows the final overlay, but it does not surface each intermediate mask or confidence bucket well enough to diagnose where a trace failed.

### Root Cause Summary

1. The parser is using seat detections to invent section geometry instead of tracing section geometry from the floor plan.
2. The hardcoded `k=3` section grouping is a structural guess, not an observation from the image.
3. Text is treated as a side artifact, not a first-class exclusion mask.
4. Morphology is doing too much semantic work; large close/open kernels blur real edges and merge unrelated features.
5. The pipeline has no phase-level scoring or debug views, so improvements cannot be measured precisely.

### Target Architecture

The detector should behave like an artist tracing over the plan in this order:

1. Remove text and legend/table artifacts without removing structural linework.
2. Trace structural shells, walls, and interior boundaries from the actual drawn lines.
3. Trace seating regions from enclosed geometry and repeated seat-row patterns.
4. Detect individual seats only inside accepted seating regions.
5. Trace aisles/stairs/ADA gaps as negative space inside seating regions.
6. Detect stage and openings only from the remaining unexplained geometry.
7. Expose every intermediate mask and candidate family in the preview for tuning.

---

## Steps

### Step 1: Replace seat-cluster-first parsing with a true phased trace pipeline — `venue_contour_detect.py`

**Operation:** `REPLACE`

**Anchor:**

```python
def extract_contours(image_path, table_right_frac=None):
```

**Code:**

```python
def extract_contours(image_path, table_right_frac=None):
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError(f"Cannot read image: {image_path}")

    H, W = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    image_area = float(W * H)

    preprocess = build_preprocess_masks(gray, W, H, image_area)
    shell_phase = trace_shells_and_walls(preprocess, W, H, image_area)
    seating_phase = trace_seating_regions(preprocess, shell_phase, W, H, image_area)
    void_phase = trace_internal_voids(preprocess, shell_phase, seating_phase, W, H, image_area)
    carved_seating = subtract_voids_from_sections(seating_phase, void_phase, W, H)
    seat_phase = detect_seats_within_sections(preprocess, carved_seating, W, H, image_area)
    row_phase = assign_rows_and_numbers(carved_seating, seat_phase, W, H)
    stage_phase = detect_remaining_stage_geometry(preprocess, shell_phase, carved_seating, void_phase, W, H, image_area)
    opening_phase = detect_openings_from_wall_gaps(preprocess, shell_phase, W, H, image_area)

    phases = {
        "text_mask": preprocess["text_components"],
        "artifact_mask": preprocess["artifact_components"],
        "walls": shell_phase["records"],
        "seating_sections": carved_seating["records"],
        "voids": void_phase["records"],
        "seats": row_phase["records"],
        "stages": stage_phase["records"],
        "openings": opening_phase["records"],
    }

    flat = flatten_phases(phases)
    return {
        "phases": phases,
        "elements": flat,
        "debug": {
            "imageWidth": W,
            "imageHeight": H,
            "maskCoverage": preprocess["coverage"],
            "candidateCounts": {
                "shells": len(shell_phase["records"]),
                "seating": len(carved_seating["records"]),
                "voids": len(void_phase["records"]),
                "seats": len(row_phase["records"]),
                "stages": len(stage_phase["records"]),
                "openings": len(opening_phase["records"]),
            },
        },
    }, table_right_frac
```

**Verify:** `cd /Users/alexwaldmann/Desktop/TripleAApps && python3 -m py_compile venue_contour_detect.py`

### Step 2: Add explicit text rejection and artifact separation before any geometry tracing — `venue_contour_detect.py`

**Operation:** `INSERT_BEFORE`

**Anchor:**

```python
def extract_contours(image_path, table_right_frac=None):
```

**Code:**

```python
def build_preprocess_masks(gray, W, H, image_area):
    _, ink = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    cc_count, labels, stats, _ = cv2.connectedComponentsWithStats(ink, connectivity=8)
    text_mask = np.zeros_like(ink)
    structure_mask = np.zeros_like(ink)

    for label_idx in range(1, cc_count):
        x, y, w, h, area = stats[label_idx]
        if area < 4:
            continue

        fill_ratio = area / max(1, w * h)
        aspect = w / max(1, h)
        small_text_like = h <= max(18, H // 80) and w <= max(120, W // 8)
        stroke_dense = fill_ratio >= 0.18
        highly_elongated = aspect >= 6.0 or aspect <= 0.18
        edge_legend_like = x <= int(W * 0.22) or y <= int(H * 0.10)

        if small_text_like and stroke_dense:
            text_mask[labels == label_idx] = 255
            continue

        if highly_elongated and area >= max(40, image_area * 0.00003):
            structure_mask[labels == label_idx] = 255
            continue

        if edge_legend_like and small_text_like:
            text_mask[labels == label_idx] = 255
            continue

        structure_mask[labels == label_idx] = 255

    ruled_h = cv2.morphologyEx(structure_mask, cv2.MORPH_OPEN, np.ones((1, max(15, W // 45)), np.uint8))
    ruled_v = cv2.morphologyEx(structure_mask, cv2.MORPH_OPEN, np.ones((max(15, H // 45), 1), np.uint8))
    ruled_mask = cv2.bitwise_or(ruled_h, ruled_v)
    artifact_mask = cv2.dilate(text_mask, np.ones((3, 3), np.uint8), iterations=1)

    return {
        "gray": gray,
        "ink": ink,
        "structure": structure_mask,
        "text": text_mask,
        "ruled": ruled_mask,
        "artifact": artifact_mask,
        "text_components": [],
        "artifact_components": [],
        "coverage": {
            "inkPct": round(100.0 * cv2.countNonZero(ink) / (W * H), 2),
            "textPct": round(100.0 * cv2.countNonZero(text_mask) / (W * H), 2),
            "artifactPct": round(100.0 * cv2.countNonZero(artifact_mask) / (W * H), 2),
        },
    }
```

**Verify:** `cd /Users/alexwaldmann/Desktop/TripleAApps && python3 -m py_compile venue_contour_detect.py`

### Step 3: Trace seating from geometry plus seat texture, not from forced k-means clusters — `venue_contour_detect.py`

**Operation:** `REPLACE`

**Anchor:**

```python
    # ── Phase 2: global seat candidate detection, then cluster into 3 sections ──
```

**Code:**

```python
    # Phase 2: trace seating regions from enclosed geometry and repeated seat texture.
    seating_phase = trace_seating_regions(preprocess, shell_phase, W, H, image_area)

    # Phase 3: carve aisles, stairs, ADA gaps, and rail voids from inside seating geometry.
    void_phase = trace_internal_voids(preprocess, shell_phase, seating_phase, W, H, image_area)
    carved_seating = subtract_voids_from_sections(seating_phase, void_phase, W, H)

    # Phase 4: detect seats only inside carved seating polygons.
    seat_phase = detect_seats_within_sections(preprocess, carved_seating, W, H, image_area)
    row_phase = assign_rows_and_numbers(carved_seating, seat_phase, W, H)

def trace_seating_regions(preprocess, shell_phase, W, H, image_area):
    shell_interior = shell_phase["interior_mask"]
    structure = cv2.bitwise_and(preprocess["structure"], shell_interior)
    seat_texture = detect_repeating_seat_texture(structure, W, H)
    row_band_mask = bridge_parallel_rows(seat_texture, W, H)
    bounded_mask = split_regions_by_traced_boundaries(row_band_mask, structure, W, H)
    records = contour_records_from_mask(bounded_mask, W, H, image_area, phase="seating_sections", role_hint="seating")
    return {"mask": bounded_mask, "records": prune_nested_sections(records)}

def detect_repeating_seat_texture(structure_mask, W, H):
    seat_like = cv2.morphologyEx(structure_mask, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8), iterations=1)
    return retain_components_with_local_repeat_density(seat_like, W, H, min_neighbors=3)

def bridge_parallel_rows(seat_texture, W, H):
    horiz = cv2.morphologyEx(seat_texture, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (max(9, W // 80), 3)), iterations=1)
    diag = bridge_with_local_orientation(horiz, window=max(25, min(W, H) // 25))
    return diag

def split_regions_by_traced_boundaries(row_band_mask, structure_mask, W, H):
    boundaries = trace_boundary_graph(structure_mask, W, H)
    return cut_mask_by_graph(row_band_mask, boundaries, W, H)
```

**Verify:** `cd /Users/alexwaldmann/Desktop/TripleAApps && python3 venue_contour_detect.py .github/example2.jpg > /tmp/venue_trace.json`

### Step 4: Add seat glyph validation and local row assignment so seat placement follows the traced region — `venue_contour_detect.py`

**Operation:** `INSERT_AFTER`

**Anchor:**

```python
def point_in_poly(px, py, polygon):
```

**Code:**

```python
def detect_seats_within_sections(preprocess, carved_seating, W, H, image_area):
    seat_records = []
    for section_idx, section in enumerate(carved_seating["records"], start=1):
        section_mask = polygon_mask(section["points"], W, H)
        section_source = cv2.bitwise_and(preprocess["structure"], section_mask)
        cc_candidates = seat_candidates_from_connected_components(section_source, W, H, image_area)
        circle_candidates = seat_candidates_from_hough(section_source, W, H)
        merged = merge_seat_candidates(cc_candidates, circle_candidates, max_dist_px=4)
        validated = retain_seats_with_local_spacing_consistency(merged)
        for seat in validated:
            seat["sectionId"] = section_idx
        seat_records.extend(validated)
    return {"records": seat_records}

def assign_rows_and_numbers(carved_seating, seat_phase, W, H):
    records = []
    for section_idx, section in enumerate(carved_seating["records"], start=1):
        section_seats = [seat for seat in seat_phase["records"] if seat["sectionId"] == section_idx]
        if not section_seats:
            continue
        basis = estimate_section_axes(section["points"], section_seats)
        projected = project_seats_to_section_axes(section_seats, basis)
        row_groups = cluster_rows_by_projected_offset(projected)
        numbered = sort_seats_within_rows(row_groups)
        records.extend(numbered)
    return {"records": records}
```

**Verify:** `cd /Users/alexwaldmann/Desktop/TripleAApps && python3 -m py_compile venue_contour_detect.py`

### Step 5: Restrict Qwen to semantic cleanup only after geometry is already stable — `venue_ai_generate.mjs`

**Operation:** `REPLACE`

**Anchor:**

```javascript
Important ordering rule from the detector:
- Walls are numbered first
- Stage is next
- Seating sections come after that
- Aisles, stairs, and gap-fill regions come later
```

**Code:**

```javascript
Important ordering rule from the detector:
- Walls and shell fragments are traced first
- Seating sections are traced from geometry before seat dots are accepted
- Internal voids are carved from seating after section tracing
- Stage and openings are detected only from remaining unexplained geometry

Important limitation:
- Text labels, legends, and capacity notes are not structural regions and must not be traced or labeled as geometry
- If a numbered region looks like text contamination or a malformed trace, label it as "other"
```

**Verify:** `cd /Users/alexwaldmann/Desktop/TripleAApps && node --check venue_ai_generate.mjs`

### Step 6: Add phase-by-phase debug overlays and rejection diagnostics to the preview — `venue_preview.html`

**Operation:** `INSERT_AFTER`

**Anchor:**

```html
<button id="grid-btn" onclick="toggleGrid()">⊞ Grid</button>
```

**Code:**

```html
<button id="phase-btn" onclick="togglePhasePanel()">◫ Phases</button>
```

**Verify:** `cd /Users/alexwaldmann/Desktop/TripleAApps && python3 -m http.server 8000 >/tmp/venue_preview_server.log 2>&1 & SERVER_PID=$!; sleep 2; curl -I http://127.0.0.1:8000/venue_preview.html >/tmp/venue_preview_head.txt; kill $SERVER_PID; head -5 /tmp/venue_preview_head.txt`

### Step 7: Add explicit phase debugging controls and per-candidate failure reasons — `venue_preview.html`

**Operation:** `REPLACE`

**Anchor:**

```javascript
          if (d.phases) {
            const phaseBits = Object.entries(d.phases)
```

**Code:**

```javascript
if (d.phases) {
  const phaseBits = Object.entries(d.phases)
    .filter(([, items]) => Array.isArray(items) && items.length)
    .map(([name, items]) => `${name}:${items.length}`)
    .join(" | ");

  rows.push(
    `<tr><td colspan="3" style="padding:4px 8px;font-size:11px;color:#9ca3af">phases: ${phaseBits}</td></tr>`,
  );

  if (d.debug?.maskCoverage) {
    rows.push(
      `<tr><td colspan="3" style="padding:4px 8px;font-size:11px;color:#9ca3af">mask coverage: ink ${d.debug.maskCoverage.inkPct}% | text ${d.debug.maskCoverage.textPct}% | artifact ${d.debug.maskCoverage.artifactPct}%</td></tr>`,
    );
  }

  if (d.debug?.candidateCounts) {
    rows.push(
      `<tr><td colspan="3" style="padding:4px 8px;font-size:11px;color:#9ca3af">candidates: shells ${d.debug.candidateCounts.shells} | seating ${d.debug.candidateCounts.seating} | voids ${d.debug.candidateCounts.voids} | seats ${d.debug.candidateCounts.seats} | stages ${d.debug.candidateCounts.stages} | openings ${d.debug.candidateCounts.openings}</td></tr>`,
    );
  }
}
```

**Verify:** `cd /Users/alexwaldmann/Desktop/TripleAApps && python3 -m http.server 8000 >/tmp/venue_preview_server.log 2>&1 & SERVER_PID=$!; sleep 2; curl -s http://127.0.0.1:8000/ollama_latest_result.json | head -20; kill $SERVER_PID`

### Step 8: Add an accuracy harness so tuning is driven by measurable tracing quality instead of visual guesses — `venue_parser_eval.mjs`

**Operation:** `CREATE_FILE`

**Code:**

```javascript
#!/usr/bin/env node
import { readFileSync } from "fs";

const result = JSON.parse(readFileSync("./ollama_latest_result.json", "utf8"));

function score(result) {
  const phases = result.phases || {};
  const seats = phases.seats || [];
  const sections = phases.seating_sections || [];
  const voids = phases.voids || [];
  const openings = phases.openings || [];
  const stages = phases.stages || [];

  return {
    sectionCount: sections.length,
    seatCount: seats.length,
    stageCount: stages.length,
    openingCount: openings.length,
    giantVoidFlag: voids.some((v) => v.areaPct > 15),
    orphanSeatFlag: seats.some((s) => !s.sectionId),
    tinySectionFlag: sections.some(
      (s) => s.areaPct < 0.25 && (s._seatCount || 0) > 30,
    ),
  };
}

console.log(JSON.stringify(score(result), null, 2));
```

**Verify:** `cd /Users/alexwaldmann/Desktop/TripleAApps && node --check venue_parser_eval.mjs`

---

## Decision Required

- Text rejection path: use pure OpenCV connected-component heuristics first, or add OCR-backed text boxes as a second pass for embedded labels. Pure OpenCV is faster and simpler; OCR-backed rejection is more accurate on dense annotated plans.
- Boundary tracing path: keep a raster-mask pipeline with morphology plus contour splitting, or add skeleton/graph tracing for line-following. Raster is easier to implement; graph tracing is closer to the “artist tracing” behavior and will preserve thin boundaries better.
- Seat detector path: rely on connected components with local spacing validation, or add template matching / Hough fallback for circular and semi-circular seat symbols. The fallback is slower but more robust across varied seat glyphs.

## Out of Scope

- Learning-based segmentation or a custom trained model is not scheduled in this plan because there is no labeled dataset in the repo yet.
- Full manual correction workflows are not scheduled beyond debug visibility; the priority here is making the automatic trace materially more accurate first.# Plan: Hierarchical Venue Floor-Plan Parser + Validation Harness

**Status:** 🔴 NOT STARTED
**Goal:** Replace the current flat OpenCV+Qwen venue parser with a hierarchical, layout-agnostic pipeline that detects walls first, then seating sections, then internal negative-space features, then seats, then stage and doors/openings, with repeatable verification.

---

## Context

The current workflow is structurally close, but it is not yet a hierarchical parser.

Confirmed from the existing code and a live run against `.github/example2.jpg`:

- `venue_contour_detect.py` still begins with left-side table boundary detection and artifact rejection keyed off `table_right_frac`, so it is still fundamentally table-mask driven rather than layout-preserving.
- `venue_contour_detect.py` currently promotes `stage` before `seating`, which conflicts with the required parsing order.
- `venue_contour_detect.py` classifies most regions with flat bbox/area heuristics, not phased geometry derived from shell -> seating -> void subtraction.
- `venue_ai_generate.mjs` reinforces the wrong ordering by telling Qwen that stage is numbered before seating.
- `venue_ai_generate.mjs` uses Qwen as a single whole-image labeler, which is expensive and gives it too much responsibility for ambiguous geometry.
- `venue_preview.html` already has a polygon editor and a simple point-in-polygon seat generator, but seat detection is manual and not part of parser output.

### Root Cause Summary

1. Table handling is still crop-style in practice: the detector suppresses regions based on overlap with a left cutoff instead of filtering artifacts by component features.
2. The detector is still a flat contour collector with early role guesses, not a progressive mask pipeline.
3. Negative-space features are detected as positive contours rather than carved from seating occupancy.
4. Seats are not detected from the image at all; they are generated later in the preview with a generic grid.
5. Stage and opening detection are not isolated to the final pass and are not expressed as remaining candidates after the rest of the structure is known.

### Required Algorithm Split

OpenCV owns geometry and topology:

- shell/wall masks
- seating block geometry
- negative-space carving
- seat candidate extraction and row assignment
- remaining stage/opening candidate geometry
- artifact filtering, contour simplification, mask boolean ops, and debug overlays

Qwen owns semantics only where geometry is already known:

- naming wall fragments and seating sections
- distinguishing carved void candidates as `aisle`, `stair`, `railing`, `ada_gap`, or `other`
- disambiguating remaining solid candidates as `stage`, `platform`, `booth`, or `other`
- disambiguating shell gaps as `door`, `opening`, `service_access`, or `other`

### Phase Algorithms To Implement

- Walls/shells: detect multiple shell polygons and wall fragments using closed linework, contour hierarchy, enclosure scoring, and fragment retention. No hard crop of the left table area.
- Seating sections: derive seating occupancy from the shell interior, merge repeated seat-row texture into blocks with anisotropic morphology, then split into section polygons with connected components.
- Stairs/aisles/railings/ADA gaps: compute voids from `shell interior - seating occupancy`, then classify and subtract those void polygons from seating sections.
- Seats: detect repeated seat glyphs inside carved seating polygons using connected components plus shape filtering and a Hough-circle fallback, then assign rows/seat numbers by section-local PCA.
- Stage: choose from the remaining non-seat solid candidates after seating and void carving. Do not gate by orientation or image side.
- Doors/openings: detect wall-edge gaps on the shell perimeter after wall polygons are known; classify with geometry first and Qwen only if ambiguous.

### Likely Pitfalls

- Large table blocks can mimic seating unless filtered by edge anchoring, ruled-line density, and text-component statistics rather than cropping.
- Over-closing morphology will merge adjacent seating sections into one polygon.
- If void carving runs before seating occupancy is stable, aisles will absorb legitimate seat areas.
- Seat glyphs often touch row lines or section borders, so size/circularity filters need a fallback path.
- Stage symbols can be curved, boxed, or centered; any top/bottom/left/right assumption will fail.
- Door openings can appear as pure gaps, double-line door symbols, or fragment breaks in the shell.

---

## Steps

### Step 1: Replace the flat detector with a phased parser and richer JSON schema — `venue_contour_detect.py`

**Operation:** `REPLACE`

**Anchor:**

```python
def extract_contours(image_path, table_right_frac=None):
```

**Code:**

```python
def extract_contours(image_path, table_right_frac=None):
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError(f"Cannot read image: {image_path}")

    H, W = img.shape[:2]
    image_area = float(W * H)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Base ink mask: preserve all layout pixels first, do not crop the table area.
    _, ink = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    # Table-artifact filtering is now feature-driven instead of crop-driven.
    # Long ruled lines + edge-anchored text clusters become a penalty mask only.
    horiz = cv2.morphologyEx(ink, cv2.MORPH_OPEN, np.ones((1, max(15, W // 45)), np.uint8))
    vert = cv2.morphologyEx(ink, cv2.MORPH_OPEN, np.ones((max(15, H // 45), 1), np.uint8))
    ruled = cv2.bitwise_or(horiz, vert)

    n_labels, labels, stats, _ = cv2.connectedComponentsWithStats(ink, connectivity=8)
    text_mask = np.zeros_like(ink)
    for label_idx in range(1, n_labels):
        x, y, w, h, area = stats[label_idx]
        if area < 6:
            continue
        at_left_edge = x <= int(W * 0.18)
        text_like = h <= max(14, H // 90) and w <= max(90, W // 9)
        dense = area / max(1, w * h) > 0.25
        if at_left_edge and text_like and dense:
            text_mask[labels == label_idx] = 255

    artifact_mask = cv2.dilate(cv2.bitwise_or(ruled, text_mask), np.ones((5, 5), np.uint8), iterations=1)

    def contour_to_record(contour, phase, role_hint, simplify=0.006, extra=None):
        record = contour_record(contour, W, H, image_area, role_hint=role_hint, simplify=simplify)
        if record is None:
            return None
        record["phase"] = phase
        record["artifactOverlapPct"] = round(
            100.0
            * cv2.countNonZero(
                cv2.bitwise_and(
                    artifact_mask,
                    cv2.fillPoly(np.zeros_like(artifact_mask), [cv2.approxPolyDP(contour, simplify * cv2.arcLength(contour, True), True)], 255),
                )
            )
            / max(1.0, cv2.contourArea(contour)),
            2,
        )
        if extra:
            record.update(extra)
        return record

    def keep_artifact(record, allow_edge_anchor=False):
        width = record["xRight"] - record["xLeft"]
        edge_anchor = record["xLeft"] <= 0.03 or record["xRight"] >= 0.97 or record["yTop"] <= 0.03 or record["yBottom"] >= 0.97
        if allow_edge_anchor and edge_anchor:
            return True
        if record["artifactOverlapPct"] >= 72 and width <= 0.35 and record["areaPct"] <= 3.5:
            return False
        return True

    def mask_from_records(records):
        mask = np.zeros_like(ink)
        for record in records:
            pts = np.array([[int(x * W), int(y * H)] for x, y in record["points"]], dtype=np.int32)
            cv2.fillPoly(mask, [pts], 255)
        return mask

    phases = {
        "walls": [],
        "seating_sections": [],
        "voids": [],
        "seats": [],
        "stages": [],
        "openings": [],
    }

    # Phase 1: walls/shells first. Keep multiple shells/fragments when supported by geometry.
    shell_mask = cv2.morphologyEx(ink, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8), iterations=2)
    shell_mask = cv2.morphologyEx(shell_mask, cv2.MORPH_CLOSE, np.ones((17, 5), np.uint8), iterations=1)
    shell_mask = cv2.morphologyEx(shell_mask, cv2.MORPH_CLOSE, np.ones((5, 17), np.uint8), iterations=1)
    shell_contours, shell_hierarchy = cv2.findContours(shell_mask, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
    for contour in sorted(shell_contours, key=cv2.contourArea, reverse=True):
        area = cv2.contourArea(contour)
        if area < image_area * 0.0015:
            continue
        record = contour_to_record(contour, "walls", "wall", simplify=0.012)
        if record is None:
            continue
        width = record["xRight"] - record["xLeft"]
        height = record["yBottom"] - record["yTop"]
        enclosure_score = (
            (2.0 if record["areaPct"] >= 8.0 else 0.0)
            + (1.0 if width >= 0.30 else 0.0)
            + (1.0 if height >= 0.30 else 0.0)
            + (1.0 if len(record["points"]) >= 5 else 0.0)
        )
        if enclosure_score < 2.5:
            continue
        if not keep_artifact(record, allow_edge_anchor=True):
            continue
        phases["walls"].append(record)

    wall_mask = mask_from_records(phases["walls"])

    # Shell interior for all subsequent phases.
    shell_fill = cv2.morphologyEx(wall_mask, cv2.MORPH_CLOSE, np.ones((11, 11), np.uint8), iterations=2)
    interior_mask = cv2.erode(shell_fill, np.ones((3, 3), np.uint8), iterations=1)

    # Phase 2: seating sections. Merge seat rows into blocks, but avoid over-merging.
    seating_seed = cv2.bitwise_and(ink, interior_mask)
    seating_seed = cv2.bitwise_and(seating_seed, cv2.bitwise_not(artifact_mask))
    seating_seed = cv2.morphologyEx(seating_seed, cv2.MORPH_CLOSE, np.ones((9, 3), np.uint8), iterations=2)
    seating_seed = cv2.morphologyEx(seating_seed, cv2.MORPH_CLOSE, np.ones((3, 9), np.uint8), iterations=1)
    seating_seed = cv2.medianBlur(seating_seed, 5)
    seating_contours, _ = cv2.findContours(seating_seed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    for contour in sorted(seating_contours, key=cv2.contourArea, reverse=True):
        area = cv2.contourArea(contour)
        if area < image_area * 0.002:
            continue
        record = contour_to_record(contour, "seating_sections", "seating", simplify=0.008)
        if record is None or not keep_artifact(record):
            continue
        phases["seating_sections"].append(record)

    seating_mask = mask_from_records(phases["seating_sections"])

    # Phase 3: negative space is derived AFTER seating, then carved back out.
    void_seed = cv2.bitwise_and(interior_mask, cv2.bitwise_not(seating_mask))
    void_seed = cv2.bitwise_and(void_seed, cv2.bitwise_not(artifact_mask))
    void_seed = cv2.morphologyEx(void_seed, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8), iterations=1)
    void_contours, _ = cv2.findContours(void_seed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    carved_void_mask = np.zeros_like(ink)
    for contour in sorted(void_contours, key=cv2.contourArea, reverse=True):
        area = cv2.contourArea(contour)
        if area < image_area * 0.0008:
            continue
        record = contour_to_record(contour, "voids", "void", simplify=0.006)
        if record is None:
            continue
        x_span = record["xRight"] - record["xLeft"]
        y_span = record["yBottom"] - record["yTop"]
        elongated = max(x_span, y_span) / max(0.0001, min(x_span, y_span)) >= 2.0
        if not elongated and record["areaPct"] < 0.12:
            continue
        pts = np.array([[int(x * W), int(y * H)] for x, y in record["points"]], dtype=np.int32)
        cv2.fillPoly(carved_void_mask, [pts], 255)
        phases["voids"].append(record)

    carved_seating_mask = cv2.bitwise_and(seating_mask, cv2.bitwise_not(carved_void_mask))
    carved_seating_contours, _ = cv2.findContours(carved_seating_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    phases["seating_sections"] = []
    for contour in sorted(carved_seating_contours, key=cv2.contourArea, reverse=True):
        area = cv2.contourArea(contour)
        if area < image_area * 0.0015:
            continue
        record = contour_to_record(contour, "seating_sections", "seating", simplify=0.008)
        if record is None:
            continue
        phases["seating_sections"].append(record)

    # Phase 4: detect seats as repeated glyphs inside carved seating polygons.
    seat_source = cv2.bitwise_and(ink, carved_seating_mask)
    seat_source = cv2.morphologyEx(seat_source, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8), iterations=1)
    seat_labels, seat_cc, seat_stats, seat_centroids = cv2.connectedComponentsWithStats(seat_source, connectivity=8)
    raw_seats = []
    for label_idx in range(1, seat_labels):
        x, y, w, h, area = seat_stats[label_idx]
        if area < 4 or area > max(250, image_area * 0.00018):
            continue
        aspect = w / max(1, h)
        if aspect < 0.35 or aspect > 2.8:
            continue
        cx, cy = seat_centroids[label_idx]
        raw_seats.append({
            "id": f"seat-{len(raw_seats) + 1}",
            "phase": "seats",
            "roleHint": "seat",
            "cx": round(float(cx) / W, 4),
            "cy": round(float(cy) / H, 4),
            "xLeft": round(float(x) / W, 4),
            "xRight": round(float(x + w) / W, 4),
            "yTop": round(float(y) / H, 4),
            "yBottom": round(float(y + h) / H, 4),
            "clickable": True,
        })

    # Assign seats to the carved seating polygon that contains them.
    def point_in_poly(px, py, polygon):
        inside = False
        for i in range(len(polygon)):
            x1, y1 = polygon[i]
            x2, y2 = polygon[(i + 1) % len(polygon)]
            if ((y1 > py) != (y2 > py)) and (px < (x2 - x1) * (py - y1) / max(1e-9, (y2 - y1)) + x1):
                inside = not inside
        return inside

    for section_idx, section in enumerate(phases["seating_sections"], start=1):
        polygon = section["points"]
        section_seats = [seat for seat in raw_seats if point_in_poly(seat["cx"], seat["cy"], polygon)]
        section_seats.sort(key=lambda s: (round(s["cy"], 3), s["cx"]))
        last_y = None
        row_idx = 0
        seat_idx = 0
        for seat in section_seats:
            if last_y is None or abs(seat["cy"] - last_y) > 0.018:
                row_idx += 1
                seat_idx = 0
                last_y = seat["cy"]
            seat_idx += 1
            seat["sectionId"] = section_idx
            seat["row"] = row_idx
            seat["seatNumber"] = seat_idx
        phases["seats"].extend(section_seats)

    # Phase 5: remaining solid geometry becomes stage/opening candidates.
    consumed = cv2.bitwise_or(shell_fill, carved_seating_mask)
    remaining_solids = cv2.bitwise_and(ink, cv2.bitwise_not(consumed))
    remaining_solids = cv2.bitwise_and(remaining_solids, cv2.bitwise_not(artifact_mask))
    solid_contours, _ = cv2.findContours(remaining_solids, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    for contour in sorted(solid_contours, key=cv2.contourArea, reverse=True):
        area = cv2.contourArea(contour)
        if area < image_area * 0.0012:
            continue
        record = contour_to_record(contour, "stages", "stage_candidate", simplify=0.008)
        if record is None:
            continue
        phases["stages"].append(record)

    perimeter = cv2.morphologyEx(wall_mask, cv2.MORPH_GRADIENT, np.ones((3, 3), np.uint8), iterations=1)
    opening_seed = cv2.bitwise_and(perimeter, cv2.bitwise_not(ink))
    opening_seed = cv2.morphologyEx(opening_seed, cv2.MORPH_DILATE, np.ones((5, 5), np.uint8), iterations=1)
    opening_contours, _ = cv2.findContours(opening_seed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    for contour in sorted(opening_contours, key=cv2.contourArea, reverse=True):
        area = cv2.contourArea(contour)
        if area < image_area * 0.00025:
            continue
        record = contour_to_record(contour, "openings", "opening_candidate", simplify=0.006)
        if record is None:
            continue
        phases["openings"].append(record)

    # Stable order for downstream tools.
    flat = []
    for phase_name in ["walls", "seating_sections", "voids", "seats", "stages", "openings"]:
        flat.extend(phases[phase_name])
    for idx, item in enumerate(flat, start=1):
        item["id"] = idx
        item.pop("bbox", None)
        item.pop("vertexCount", None)

    return {
        "phases": phases,
        "elements": flat,
        "debug": {
            "tableBoundaryHint": detect_table_boundary(gray, W, H),
            "artifactMaskCoveragePct": round(100.0 * cv2.countNonZero(artifact_mask) / image_area, 2),
            "imageWidth": W,
            "imageHeight": H,
        },
    }, (table_right_frac if table_right_frac is not None else detect_table_boundary(gray, W, H))
```

**Operation:** `REPLACE`

**Anchor:**

```python
    contours, detected_frac = extract_contours(image_path, table_frac)

    debug_path = image_path.rsplit(".", 1)[0] + "_contours_debug.jpg"
    try:
        build_debug_image(image_path, contours, debug_path)
```

**Code:**

```python
    result, detected_frac = extract_contours(image_path, table_frac)

    debug_path = image_path.rsplit(".", 1)[0] + "_contours_debug.jpg"
    try:
        build_debug_image(image_path, result["elements"], debug_path)
```

**Operation:** `REPLACE`

**Anchor:**

```python
    print(
        f"# Detected {len(contours)} contours  (table masked at x < {detected_frac:.2f})",
        file=sys.stderr,
    )
    print(json.dumps(contours, indent=2))
```

**Code:**

```python
    print(
        f"# Parsed walls={len(result['phases']['walls'])} seating={len(result['phases']['seating_sections'])} voids={len(result['phases']['voids'])} seats={len(result['phases']['seats'])} stages={len(result['phases']['stages'])} openings={len(result['phases']['openings'])}  (table hint x={detected_frac:.2f}, filtering only)",
        file=sys.stderr,
    )
    print(json.dumps(result, indent=2))
```

**Verify:** `cd /Users/alexwaldmann/Desktop/TripleAApps && python3 -m py_compile venue_contour_detect.py && python3 venue_contour_detect.py .github/example2.jpg >/tmp/venue_phases.json && python3 - <<'PY'
import json
with open('/tmp/venue_phases.json') as f:
    data = json.load(f)
print(sorted(data['phases'].keys()))
print('walls', len(data['phases']['walls']))
print('seating', len(data['phases']['seating_sections']))
print('voids', len(data['phases']['voids']))
print('seats', len(data['phases']['seats']))
print('stages', len(data['phases']['stages']))
print('openings', len(data['phases']['openings']))
PY`

### Step 2: Make the generator phase-aware and restrict Qwen to semantic labeling only — `venue_ai_generate.mjs`

**Operation:** `REPLACE`

**Anchor:**

```javascript
function runContourDetector(imgPath) {
```

**Code:**

```javascript
function runContourDetector(imgPath) {
  if (!existsSync(DETECTOR_PY)) {
    throw new Error(`venue_contour_detect.py not found at ${DETECTOR_PY}`);
  }
  console.log("Step 1 — Running hierarchical OpenCV parser...");
  const result = spawnSync("python3", [DETECTOR_PY, imgPath], {
    encoding: "utf8",
    timeout: 30_000,
  });
  if (result.status !== 0) {
    throw new Error(`Contour detector failed:\n${result.stderr}`);
  }
  if (result.stderr) {
    for (const line of result.stderr.split("\n").filter(Boolean)) {
      console.log(" ", line);
    }
  }
  const parsed = JSON.parse(result.stdout.trim());
  const phases = parsed.phases || {};
  console.log(
    `  ✅ walls=${(phases.walls || []).length} seating=${(phases.seating_sections || []).length} voids=${(phases.voids || []).length} seats=${(phases.seats || []).length} stages=${(phases.stages || []).length} openings=${(phases.openings || []).length}`,
  );
  return parsed;
}
```

**Operation:** `REPLACE`

**Anchor:**

```javascript
const LABEL_PROMPT = (n, contours) =>
```

**Code:**

```javascript
const PHASE_PROMPTS = {
  seatingSections: (
    items,
  ) => `You are labeling already-detected venue seating polygons.

Return one JSON object only:
{
  "labels": [
    {"id": 1, "label": "Upper Bowl Left", "notes": "Short semantic description"}
  ]
}

Rules:
- Do not change geometry.
- Do not emit coordinates.
- Name every visible seating block.
- Prefer audience-facing labels such as Left, Right, Center, Balcony, Floor, Mezzanine, VIP.

Candidates:
${items.map((item) => `- #${item.id} bbox x:${Math.round(item.xLeft * 100)}-${Math.round(item.xRight * 100)} y:${Math.round(item.yTop * 100)}-${Math.round(item.yBottom * 100)}`).join("\n")}`,

  voids: (
    items,
  ) => `You are classifying already-detected negative-space polygons inside a venue.

Return one JSON object only:
{
  "labels": [
    {"id": 1, "type": "aisle", "label": "Center Aisle", "notes": "Short semantic description"}
  ]
}

Allowed types: "aisle" | "stair" | "railing" | "ada_gap" | "other"

Rules:
- These are carved voids, not solid sections.
- Use geometry and context in the numbered atlas only.
- Do not emit coordinates.

Candidates:
${items.map((item) => `- #${item.id} bbox x:${Math.round(item.xLeft * 100)}-${Math.round(item.xRight * 100)} y:${Math.round(item.yTop * 100)}-${Math.round(item.yBottom * 100)}`).join("\n")}`,

  solids: (
    items,
  ) => `You are classifying remaining solid venue candidates after walls, seating, voids, and seats are already known.

Return one JSON object only:
{
  "labels": [
    {"id": 1, "type": "stage", "label": "Main Stage", "notes": "Short semantic description"}
  ]
}

Allowed types: "stage" | "platform" | "booth" | "other"

Rules:
- Stage is not orientation-gated.
- Choose by shape and contextual relationship to seating, not by top/bottom assumptions.
- Do not emit coordinates.

Candidates:
${items.map((item) => `- #${item.id} bbox x:${Math.round(item.xLeft * 100)}-${Math.round(item.xRight * 100)} y:${Math.round(item.yTop * 100)}-${Math.round(item.yBottom * 100)}`).join("\n")}`,

  openings: (
    items,
  ) => `You are classifying shell-perimeter gap candidates in a venue floor plan.

Return one JSON object only:
{
  "labels": [
    {"id": 1, "type": "door", "label": "North Entry", "notes": "Short semantic description"}
  ]
}

Allowed types: "door" | "opening" | "service_access" | "other"

Rules:
- Candidates are already detected shell gaps.
- Do not emit coordinates.

Candidates:
${items.map((item) => `- #${item.id} bbox x:${Math.round(item.xLeft * 100)}-${Math.round(item.xRight * 100)} y:${Math.round(item.yTop * 100)}-${Math.round(item.yBottom * 100)}`).join("\n")}`,
};
```

**Operation:** `REPLACE`

**Anchor:**

```javascript
async function qwenLabel(imageBytes, contours) {
```

**Code:**

```javascript
async function qwenLabel(imageBytes, phaseName, items) {
  if (!items.length) {
    return { labels: [] };
  }

  const base64 = imageBytes.toString("base64");
  const body = JSON.stringify({
    model: MODEL,
    prompt: PHASE_PROMPTS[phaseName](items),
    images: [base64],
    stream: true,
    keep_alive: "5m",
    options: {
      num_ctx: NUM_CTX,
      num_predict: NUM_PREDICT,
      seed: RUN_SEED,
      temperature: 0.1,
    },
  });

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: 11434,
        path: "/api/generate",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let fullText = "";
        res.on("data", (chunk) => {
          for (const line of chunk.toString().split("\n").filter(Boolean)) {
            try {
              const obj = JSON.parse(line);
              if (obj.response) {
                process.stdout.write(obj.response);
                fullText += obj.response;
              }
            } catch {
              /* partial chunk */
            }
          }
        });
        res.on("end", () => {
          process.stdout.write("\n");
          try {
            const match = fullText.match(/\{[\s\S]*\}/);
            resolve(match ? JSON.parse(match[0]) : { labels: [] });
          } catch {
            resolve({ labels: [] });
          }
        });
      },
    );
    req.setTimeout(300_000, () => req.destroy(new Error("timeout 5min")));
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}
```

**Operation:** `REPLACE`

**Anchor:**

```javascript
function mergeAndSave(contours, labelResponse) {
```

**Code:**

```javascript
function mergeAndSave(parsed, labelsByPhase) {
  const phases = parsed.phases || {};

  const applyLabels = (items, labels, fallbackType) => {
    const labelMap = Object.fromEntries(
      (labels || []).map((entry) => [entry.id, entry]),
    );
    return (items || []).map((item) => {
      const lbl = labelMap[item.id] || {};
      return {
        ...item,
        type: lbl.type || item.roleHint || fallbackType,
        label: lbl.label || item.label || `Region ${item.id}`,
        notes: lbl.notes || item.notes || "",
      };
    });
  };

  const walls = (phases.walls || []).map((item) => ({
    ...item,
    type: "wall",
    label: item.label || "Wall Shell",
    notes: item.notes || "",
  }));
  const seating = applyLabels(
    phases.seating_sections,
    labelsByPhase.seatingSections?.labels,
    "seating",
  );
  const voids = applyLabels(phases.voids, labelsByPhase.voids?.labels, "void");
  const seats = (phases.seats || []).map((seat) => ({ ...seat, type: "seat" }));
  const stages = applyLabels(
    phases.stages,
    labelsByPhase.solids?.labels,
    "stage_candidate",
  );
  const openings = applyLabels(
    phases.openings,
    labelsByPhase.openings?.labels,
    "opening_candidate",
  );

  const output = {
    phases: {
      walls,
      seatingSections: seating,
      voids,
      seats,
      stages,
      openings,
    },
    elements: [
      ...walls,
      ...seating,
      ...voids,
      ...seats,
      ...stages,
      ...openings,
    ],
    debug: parsed.debug || {},
    _version: "v23",
    _pipeline: "hierarchical-opencv+targeted-qwen",
    _model: MODEL,
    _ranAt: new Date().toISOString(),
  };

  writeFileSync(
    join(WORKSPACE, "ollama_latest_result.json"),
    JSON.stringify(output, null, 2),
  );

  console.log("\n✅ Wrote ollama_latest_result.json");
  console.log(
    `   walls=${walls.length} seating=${seating.length} voids=${voids.length} seats=${seats.length} stages=${stages.length} openings=${openings.length}`,
  );
}
```

**Operation:** `REPLACE`

**Anchor:**

```javascript
const contours = runContourDetector(imagePath);
if (contours.length === 0) {
  throw new Error("No contours detected — check image path and table fraction");
}
```

**Code:**

```javascript
const parsed = runContourDetector(imagePath);
if (!(parsed.elements || []).length) {
  throw new Error(
    "No parser elements detected — check image path and detector output",
  );
}
```

**Operation:** `REPLACE`

**Anchor:**

```javascript
const labelResponse = await qwenLabel(annotationBytes, contours);
const elapsed = ((Date.now() - start) / 1000).toFixed(1);
console.log(`  Qwen done in ${elapsed}s`);

// Step 4: Merge and save
mergeAndSave(contours, labelResponse);
```

**Code:**

```javascript
const labelsByPhase = {};

console.log("\nStep 3a — Qwen labeling seating sections...");
labelsByPhase.seatingSections = await qwenLabel(
  annotationBytes,
  "seatingSections",
  parsed.phases?.seating_sections || [],
);

console.log("\nStep 3b — Qwen classifying carved voids...");
labelsByPhase.voids = await qwenLabel(
  annotationBytes,
  "voids",
  parsed.phases?.voids || [],
);

console.log("\nStep 3c — Qwen classifying remaining solid candidates...");
labelsByPhase.solids = await qwenLabel(
  annotationBytes,
  "solids",
  parsed.phases?.stages || [],
);

console.log("\nStep 3d — Qwen classifying wall openings...");
labelsByPhase.openings = await qwenLabel(
  annotationBytes,
  "openings",
  parsed.phases?.openings || [],
);

const elapsed = ((Date.now() - start) / 1000).toFixed(1);
console.log(`  Qwen done in ${elapsed}s`);

// Step 4: Merge and save
mergeAndSave(parsed, labelsByPhase);
```

**Verify:** `cd /Users/alexwaldmann/Desktop/TripleAApps && node --check venue_ai_generate.mjs && node venue_ai_generate.mjs .github/example2.jpg >/tmp/venue_ai.log && node - <<'NODE'
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('ollama_latest_result.json', 'utf8'));
console.log(Object.keys(data.phases));
console.log('seats', data.phases.seats.length);
console.log('stages', data.phases.stages.length);
console.log('openings', data.phases.openings.length);
NODE`

### Step 3: Render the hierarchy in the preview and make detected seats selectable — `venue_preview.html`

**Operation:** `INSERT_AFTER`

**Anchor:**

```html
<button id="run-btn" onclick="runAI()">▶ Run AI</button>
```

**Code:**

```html
<label style="margin-left:12px;font-size:12px;color:#888">Phases:</label>
<label style="margin-left:8px;font-size:12px"
  ><input type="checkbox" id="toggle-walls" checked onchange="load(true)" />
  walls</label
>
<label style="margin-left:8px;font-size:12px"
  ><input type="checkbox" id="toggle-seating" checked onchange="load(true)" />
  seating</label
>
<label style="margin-left:8px;font-size:12px"
  ><input type="checkbox" id="toggle-voids" checked onchange="load(true)" />
  voids</label
>
<label style="margin-left:8px;font-size:12px"
  ><input type="checkbox" id="toggle-seats" checked onchange="load(true)" />
  seats</label
>
<label style="margin-left:8px;font-size:12px"
  ><input type="checkbox" id="toggle-stage" checked onchange="load(true)" />
  stage</label
>
<label style="margin-left:8px;font-size:12px"
  ><input type="checkbox" id="toggle-openings" checked onchange="load(true)" />
  openings</label
>
```

**Operation:** `REPLACE`

**Anchor:**

```javascript
      function renderV18(d, svg) {
```

**Code:**

```javascript
function renderV18(d, svg) {
  const showWalls = document.getElementById("toggle-walls")?.checked ?? true;
  const showSeating =
    document.getElementById("toggle-seating")?.checked ?? true;
  const showVoids = document.getElementById("toggle-voids")?.checked ?? true;
  const showSeats = document.getElementById("toggle-seats")?.checked ?? true;
  const showStage = document.getElementById("toggle-stage")?.checked ?? true;
  const showOpenings =
    document.getElementById("toggle-openings")?.checked ?? true;

  const phaseData = d.phases || {};
  const walls =
    phaseData.walls ||
    (d.elements || []).filter((e) => e.phase === "walls" || e.type === "wall");
  const seating =
    phaseData.seatingSections ||
    (d.elements || []).filter(
      (e) => e.phase === "seating_sections" || e.type === "seating",
    );
  const voids =
    phaseData.voids || (d.elements || []).filter((e) => e.phase === "voids");
  const seats =
    phaseData.seats ||
    (d.elements || []).filter((e) => e.phase === "seats" || e.type === "seat");
  const stages =
    phaseData.stages ||
    (d.elements || []).filter(
      (e) => e.phase === "stages" || /stage/.test(e.type || ""),
    );
  const openings =
    phaseData.openings ||
    (d.elements || []).filter((e) => e.phase === "openings");

  const drawPolyList = (items, fill, stroke, labelColor) => {
    items.forEach((e, idx) => {
      if (!Array.isArray(e.points) || e.points.length < 3) return;
      const pts = e.points.map(([x, y]) => [S(x), S(y)]);
      addPoly(
        svg,
        pts,
        fill,
        stroke,
        `${e.label || e.type || "region"}${e.notes ? " — " + e.notes : ""}`,
      );
      const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
      const cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
      addSvgLabel(
        svg,
        cx,
        cy,
        e.label || `${e.type || "region"} ${idx + 1}`,
        labelColor,
      );
    });
  };

  if (showWalls)
    drawPolyList(walls, "rgba(120,120,120,0.10)", "#64748b", "#cbd5e1");
  if (showSeating)
    drawPolyList(seating, "rgba(100,180,255,0.22)", "#60a5fa", "#dbeafe");
  if (showVoids)
    drawPolyList(voids, "rgba(255,220,120,0.16)", "#facc15", "#fde68a");
  if (showStage)
    drawPolyList(stages, "rgba(229,157,13,0.22)", "#e59d0d", "#fcd34d");
  if (showOpenings)
    drawPolyList(openings, "rgba(192,132,252,0.18)", "#c084fc", "#e9d5ff");

  if (showSeats) {
    seats.forEach((seat) => {
      const dot = svgEl("circle", {
        cx: S(seat.cx ?? seat.x ?? 0),
        cy: S(seat.cy ?? seat.y ?? 0),
        r: "0.55",
        class: "seat-dot",
        style: "pointer-events:all;cursor:pointer",
      });
      dot.addEventListener("click", (ev) => {
        ev.stopPropagation();
        document.getElementById("meta").innerHTML =
          `<strong>Selected seat:</strong> ${seat.id} | section ${seat.sectionId || "?"} | row ${seat.row || "?"} | seat ${seat.seatNumber || "?"}`;
        svg
          .querySelectorAll(".seat-dot.selected")
          .forEach((el) => el.classList.remove("selected"));
        dot.classList.add("selected");
      });
      svg.appendChild(dot);
    });
  }
}
```

**Operation:** `REPLACE`

**Anchor:**

```javascript
const isV18 = Array.isArray(d.elements);
```

**Code:**

```javascript
const isV18 = Array.isArray(d.elements) || !!d.phases;
```

**Operation:** `REPLACE`

**Anchor:**

```javascript
const palette = {
  wall: "#94a3b8",
  seating: "#60a5fa",
  stage: "#e59d0d",
  aisle: "#facc15",
  other: "#a3a3a3",
};
```

**Code:**

```javascript
const palette = {
  wall: "#94a3b8",
  seating: "#60a5fa",
  void: "#facc15",
  seat: "#22c55e",
  stage: "#e59d0d",
  opening: "#c084fc",
  other: "#a3a3a3",
};
```

**Verify:** `cd /Users/alexwaldmann/Desktop/TripleAApps && python3 -m http.server 8000 >/tmp/venue_preview_server.log 2>&1 & SERVER_PID=$!; sleep 2; curl -I http://127.0.0.1:8000/venue_preview.html >/tmp/venue_preview_head.txt; kill $SERVER_PID; cat /tmp/venue_preview_head.txt | head -5`

### Step 4: Add a repeatable parser evaluation harness and fixture manifest — `venue_parser_cases.json`

**Operation:** `CREATE_FILE`

**Code:**

```json
{
  "cases": [
    {
      "name": "example2",
      "image": ".github/example2.jpg",
      "expect": {
        "minWalls": 1,
        "allowMultipleWalls": true,
        "minSeatingSections": 3,
        "minVoids": 4,
        "minSeats": 40,
        "requireStageCandidate": true,
        "requireOpeningCandidate": false,
        "maxArtifactMaskCoveragePct": 20,
        "forbidCropStyleLeftCutoffAbove": 0.3
      }
    }
  ]
}
```

**Verify:** `cd /Users/alexwaldmann/Desktop/TripleAApps && node -e "const f=require('./venue_parser_cases.json'); console.log(f.cases.map(c=>c.name).join(','))"`

### Step 5: Add a CLI evaluator for regression checks — `venue_parser_eval.mjs`

**Operation:** `CREATE_FILE`

**Code:**

```javascript
#!/usr/bin/env node

import { readFileSync } from "fs";
import { spawnSync } from "child_process";

const cases = JSON.parse(
  readFileSync("./venue_parser_cases.json", "utf8"),
).cases;

let failures = 0;

for (const testCase of cases) {
  const result = spawnSync(
    "python3",
    ["venue_contour_detect.py", testCase.image],
    {
      encoding: "utf8",
      timeout: 30000,
    },
  );

  if (result.status !== 0) {
    failures += 1;
    console.error(`[FAIL] ${testCase.name}: detector exited ${result.status}`);
    continue;
  }

  const parsed = JSON.parse(result.stdout);
  const phases = parsed.phases || {};
  const debug = parsed.debug || {};
  const expect = testCase.expect || {};

  const checks = [
    [
      "minWalls",
      (phases.walls || []).length >= (expect.minWalls || 0),
      `walls=${(phases.walls || []).length}`,
    ],
    [
      "minSeatingSections",
      (phases.seating_sections || []).length >=
        (expect.minSeatingSections || 0),
      `seating=${(phases.seating_sections || []).length}`,
    ],
    [
      "minVoids",
      (phases.voids || []).length >= (expect.minVoids || 0),
      `voids=${(phases.voids || []).length}`,
    ],
    [
      "minSeats",
      (phases.seats || []).length >= (expect.minSeats || 0),
      `seats=${(phases.seats || []).length}`,
    ],
    [
      "requireStageCandidate",
      !expect.requireStageCandidate || (phases.stages || []).length > 0,
      `stages=${(phases.stages || []).length}`,
    ],
    [
      "artifactCoverage",
      debug.artifactMaskCoveragePct == null ||
        debug.artifactMaskCoveragePct <=
          (expect.maxArtifactMaskCoveragePct ?? Infinity),
      `artifactMaskCoveragePct=${debug.artifactMaskCoveragePct}`,
    ],
    [
      "tableFilteringNotCropping",
      debug.tableBoundaryHint == null ||
        debug.tableBoundaryHint <= (expect.forbidCropStyleLeftCutoffAbove ?? 1),
      `tableBoundaryHint=${debug.tableBoundaryHint}`,
    ],
  ];

  const failed = checks.filter(([, ok]) => !ok);
  if (failed.length) {
    failures += 1;
    console.error(`[FAIL] ${testCase.name}`);
    for (const [name, , details] of failed) {
      console.error(`  - ${name}: ${details}`);
    }
  } else {
    console.log(`[PASS] ${testCase.name}`);
  }
}

process.exit(failures ? 1 : 0);
```

**Verify:** `cd /Users/alexwaldmann/Desktop/TripleAApps && node --check venue_parser_eval.mjs && node venue_parser_eval.mjs`# Plan: OpenCV + Qwen Hybrid Venue Floor Plan Parser (v22)

**Status:** 🟢 COMPLETE
**Completed:** 2026-03-08

## Summary

- Installed opencv-python-headless 4.13
- Created venue_contour_detect.py: RETR_LIST contour detection, 0.3% area threshold, IOU dedup, debug image output
- Rewrote venue_ai_generate.mjs as v22: runs Python detector (Step 1), copies annotation image (Step 2), sends to Qwen for labels-only (Step 3), merges + saves (Step 4)
- Result: 10 pixel-accurate polygons detected from example2.jpg (outer wall 34-verts, upper arc 27-verts, fan sections, corner regions)
- Qwen asked only to NAME regions, not produce coordinates — much more reliable

---

# Plan: Qwen Polygon-First Seat Map Analysis + Interactive SVG Seat Picker

**Status:** � COMPLETE
**Goal:** Upgrade Qwen floor plan analysis to polygon-first (proven in venue_ai_generate.mjs v19), convert polygons into correctly-placed ISeat[] records with posX/posY, and surface through an interactive SVG seat picker with section outlines at checkout.

---

## Context

### Locked Decisions

- Auto-generate behavior: warn first, then overwrite existing seats (`clearExisting: true` only after explicit confirmation)

### Root Causes (6 confirmed problems)

1. **`format: "json"` in Ollama request** — forces Qwen into a completion template instead of reasoning through the image. `venue_ai_generate.mjs` v19 proved removing it + using a free-form polygon prompt gives dramatically better polygon accuracy.
2. **No `points` field in MongoDB schema** — `SeatingLayout.aiSuggestions.suggestions[]` only stores `{xPct, yPct, widthPct, heightPct}` bounding boxes, so polygon vertex arrays are discarded.
3. **`applySuggestion()` uses bbox→rectangle math** — even if the AI returns polygon data, the editor converts it to a plain rectangle section, losing the real outline shape.
4. **No server-side `polygonToSeats` algorithm** — there is no bulk "fill this polygon with seats" endpoint; the only seat placement is manual drag or the `SectionWizard` rectangular grid.
5. **`SeatSelector` has no polygon section outlines** — the shared SVG seat picker renders individual seat dots but draws no section overlay polygons, so spatial context is missing.
6. **`backgroundImageUrl` and polygon zones discarded in checkout** — `CheckoutPage` and `ConcertDetailPage` both call `getAvailableSeats()` but only store `{seats, sections, stagePosition}`, silently dropping the background image URL and any AI zone data.

### Key verified facts

- Qwen model tag in use: `qwen2.5vl:32b` via Ollama HTTP at `http://localhost:11434`
- v19 prompt: sends PNG bytes as base64, no `format` key, `num_ctx: 16384`, `num_predict: 4000`; expects free-form JSON with `elements[].points[][]` (0–1 fraction space)
- Server endpoint `POST /layouts/:layoutId/analyze-image` (seating.ts ~line 1125): currently uses `format: "json"`, `num_ctx: 8192`, `num_predict: 1500`, bbox-only schema
- Coordinate system: editor world units = feet × 24 (gridSize). `roomBoundary.width/height` is already stored on layouts and should be the authoritative physical footprint when present. `suggestionToWorld()` converts `xPct → (xPct/100) * roomWidth * gridSize`
- AI analysis already persists real-world calibration fields: `estimatedVenueWidthFeet`, `estimatedVenueHeightFeet`, and `referenceSeat.widthFeet/depthFeet/rowPitchFeet`; these should be treated as labeled-length inputs, not ignored metadata
- `SeatSelector.tsx` already supports `backgroundImageUrl` prop and renders it as an SVG `<image>` at opacity 0.35
- `available-seats` endpoint already returns `backgroundImageUrl` but the client-side state type omits it

---

## Steps

### Step 1: Add `points` field to MongoDB suggestions schema — `server/src/models/SeatingLayout.ts`

**Operation:** `REPLACE`

**Anchor:**

```
        rotationDeg: { type: Number },
        isAccessible: { type: Boolean },
        notes: { type: String },
```

**Code:**

```typescript
        rotationDeg: { type: Number },
        isAccessible: { type: Boolean },
        notes: { type: String },
        points: { type: [[Number]], default: undefined },
```

**Operation:** `REPLACE` (add `points` to the TypeScript interface for `AiSuggestionItem`)

**Anchor:**

```
  rotationDeg?: number;
  isAccessible?: boolean;
  notes?: string;
}
```

**Code:**

```typescript
  rotationDeg?: number;
  isAccessible?: boolean;
  notes?: string;
  /** Polygon vertices in 0-1 fraction space, e.g. [[0.1,0.2],[0.4,0.2],...] */
  points?: [number, number][];
}
```

**Verify:** `cd server && npx tsc --noEmit 2>&1 | head -20`

---

### Step 2: Upgrade Qwen prompt + fix Ollama request options — `server/src/routes/seating.ts`

**Operation:** `REPLACE` (replace the old OLLAMA_PROMPT array with the polygon-first version)

**Anchor:**

```
  // Concise prompt — fewer output tokens = much faster generation
```

**Code:**

```typescript
// Polygon-first prompt (matches venue_ai_generate.mjs v19 — proven superior to bbox format)
const OLLAMA_PROMPT = [
  "You are a professional venue floor-plan analyzer.",
  "Study the image carefully and return ONLY a raw JSON object with this exact shape:",
  "{",
  '  "elements": [',
  "    {",
  '      "type": "seating_zone"|"stage"|"aisle"|"entrance"|"other",',
  '      "label": "<short name>",',
  '      "points": [[x0,y0],[x1,y1],...],',
  '      "estimatedSeats": <integer or null>,',
  '      "isAccessible": <bool or null>,',
  '      "rotationDeg": <degrees or 0>,',
  '      "notes": "<optional>"',
  "    }",
  "  ],",
  '  "stagePosition": "top"|"bottom"|"left"|"right"|null,',
  '  "capacityEstimate": <integer or null>,',
  '  "observations": "<one sentence>"',
  "}",
  "",
  "RULES:",
  "- points[] are [x, y] pairs as 0-1 FRACTIONS of image width/height (not pixels, not percentages).",
  "- Trace each distinct zone with a tight polygon (4-8 vertices is fine; irregular shapes welcome).",
  "- Include ALL seating zones visible. Label each with a short audience-friendly name (e.g. 'Floor', 'Balcony', 'VIP', 'Left Wing').",
  "- Do NOT include markdown, code fences, or any text outside the JSON object.",
].join("\n");
```

**Operation:** `REPLACE` (remove `format: "json"` and increase context budget)

**Anchor:**

```
    stream: false, format: "json", keep_alive: "5m",
    options: { num_ctx: 8192, num_predict: 1500, temperature: 0.1 },
```

**Code:**

```typescript
    stream: false, keep_alive: "5m",
    options: { num_ctx: 16384, num_predict: 4000, temperature: 0.1 },
```

**Verify:** No compile error — `cd server && npx tsc --noEmit 2>&1 | head -20`

---

### Step 3: Replace response parser to handle `elements[]` polygon format — `server/src/routes/seating.ts`

This is the largest single change. The old parser expected `parsed.suggestions[]` with `xPct/yPct/widthPct/heightPct`. The new one must handle `parsed.elements[]` with `points[][]` AND fall back gracefully to the old bbox format for backwards compatibility.

**Operation:** `REPLACE`

Find the block beginning just before `let rawSuggestions` (after JSON.parse) through to before `layout.aiSuggestions = {`. The exact anchor start/end:

**Anchor:**

```
      // --- Normalise: accept both 0-1 and 0-100 ranges ---
      const rawSuggestions = (parsed.suggestions ?? []) as Array<Record<string, unknown>>;
```

**Code:**

```typescript
// --- Normalise: accept elements[] (polygon-first v19) OR legacy suggestions[] ---
type RawEl = Record<string, unknown>;
const rawElements: RawEl[] = Array.isArray(parsed.elements)
  ? (parsed.elements as RawEl[])
  : [];
const rawLegacy: RawEl[] = Array.isArray(parsed.suggestions)
  ? (parsed.suggestions as RawEl[])
  : [];

// Convert v19 element (points in 0-1 fraction) to normalised suggestion
const fromElements = rawElements.map((el) => {
  const pts = Array.isArray(el.points)
    ? (el.points as [number, number][]).filter(
        (p) => Array.isArray(p) && p.length === 2,
      )
    : [];
  // Derive bbox from polygon bounding box for backward compat
  const xs = pts.map(([x]) => x);
  const ys = pts.map(([, y]) => y);
  const xMinF = xs.length ? Math.min(...xs) : 0;
  const xMaxF = xs.length ? Math.max(...xs) : 1;
  const yMinF = ys.length ? Math.min(...ys) : 0;
  const yMaxF = ys.length ? Math.max(...ys) : 1;
  return {
    type: el.type ?? "seating_zone",
    label: el.label ?? "Section",
    xPct: Math.round(xMinF * 100),
    yPct: Math.round(yMinF * 100),
    widthPct: Math.round((xMaxF - xMinF) * 100),
    heightPct: Math.round((yMaxF - yMinF) * 100),
    estimatedSeats:
      typeof el.estimatedSeats === "number" ? el.estimatedSeats : null,
    rotationDeg: typeof el.rotationDeg === "number" ? el.rotationDeg : 0,
    isAccessible:
      typeof el.isAccessible === "boolean" ? el.isAccessible : false,
    notes: typeof el.notes === "string" ? el.notes : "",
    // polygon vertices scaled to 0-100 for storage
    points: pts.map(
      ([x, y]) =>
        [Math.round(x * 100), Math.round(y * 100)] as [number, number],
    ),
  };
});

const rawSuggestions = fromElements.length > 0 ? fromElements : rawLegacy;
```

**Verify:** `cd server && npx tsc --noEmit 2>&1 | head -30`

---

### Step 4: Add `aiPolygonZones` to the `available-seats` endpoint response — `server/src/routes/seating.ts`

**Operation:** `REPLACE`

**Anchor:**

```
        backgroundImageUrl: (layout as any).backgroundImageUrl ?? null,
```

**Code:**

```typescript
        backgroundImageUrl: (layout as any).backgroundImageUrl ?? null,
        aiPolygonZones: ((layout as any).aiSuggestions?.suggestions ?? [])
          .filter((s: Record<string, unknown>) => Array.isArray(s.points) && (s.points as unknown[]).length >= 3)
          .map((s: Record<string, unknown>) => ({
            type: s.type ?? "seating_zone",
            label: s.label ?? "Section",
            points: s.points as [number, number][],
          })),
```

**Verify:** `cd server && npx tsc --noEmit 2>&1 | head -20`

---

### Step 5: Create `polygonToSeats` algorithm — `server/src/lib/polygonToSeats.ts`

**Operation:** `CREATE_FILE`

**Code:**

```typescript
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
  const sectionHeightFeet = (yMax - yMin) * feetPerPctY;
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

      // Convert PCT → world units using calibrated physical scale
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
```

**Verify:** `cd server && npx tsc --noEmit 2>&1 | head -20`

---

### Step 6: Add `POST /layouts/:layoutId/generate-from-ai` endpoint — `server/src/routes/seating.ts`

**Operation:** `INSERT_BEFORE`

**Anchor:**

```
// POST /layouts/:layoutId/analyze-image
```

**Code:**

```typescript
// POST /layouts/:layoutId/generate-from-ai
// One-click: reads stored AI suggestion polygons → generates ISeat[] with posX/posY
router.post(
  "/layouts/:layoutId/generate-from-ai",
  requireAuth,
  requireRole(["admin", "employee"]),
  async (req: Request, res: Response) => {
    try {
      const { layoutId } = req.params;
      const { clearExisting = false } = req.body as { clearExisting?: boolean };

      const layout = await SeatingLayout.findById(layoutId);
      if (!layout) return res.status(404).json({ error: "Layout not found" });

      const suggestions: Array<Record<string, unknown>> =
        (layout as any).aiSuggestions?.suggestions ?? [];
      const seatingZones = suggestions.filter(
        (s) =>
          s.type === "seating_zone" &&
          Array.isArray(s.points) &&
          (s.points as unknown[]).length >= 3,
      );

      if (seatingZones.length === 0) {
        return res.status(400).json({
          error: "No polygon seating zones found. Run AI analysis first.",
        });
      }

      const aiMeta = (layout as any).aiSuggestions ?? {};
      const roomBoundary = (layout as any).roomBoundary ?? null;
      const estimatedVenueFeet = {
        width: aiMeta.estimatedVenueWidthFeet,
        height: aiMeta.estimatedVenueHeightFeet,
      };
      const referenceSeat = aiMeta.referenceSeat;
      const GRID = 24; // px per foot

      if (
        !roomBoundary?.width &&
        !roomBoundary?.height &&
        !estimatedVenueFeet.width &&
        !estimatedVenueFeet.height
      ) {
        return res.status(400).json({
          error:
            "Seat generation needs either layout roomBoundary dimensions or AI-detected labeled venue lengths.",
        });
      }

      const { polygonToSeats } = await import("../lib/polygonToSeats.js");

      let newSeats: ReturnType<typeof polygonToSeats> = [];
      let offset = 0;

      for (const zone of seatingZones) {
        const generated = polygonToSeats({
          points: zone.points as [number, number][],
          sectionName: (zone.label as string) ?? "Section",
          roomBoundaryFeet: roomBoundary ?? undefined,
          estimatedVenueFeet,
          referenceSeat,
          gridSize: GRID,
          estimatedSeats:
            typeof zone.estimatedSeats === "number"
              ? zone.estimatedSeats
              : null,
          isAccessible:
            typeof zone.isAccessible === "boolean" ? zone.isAccessible : false,
          seatNumberOffset: offset,
        });
        newSeats = newSeats.concat(generated);
        offset += generated.length;
      }

      if (clearExisting) {
        (layout as any).seats = newSeats;
      } else {
        (layout as any).seats = [...((layout as any).seats ?? []), ...newSeats];
      }

      await (layout as any).save();

      res.json({
        seatsGenerated: newSeats.length,
        totalSeats: (layout as any).seats.length,
      });
    } catch (err) {
      console.error("[generate-from-ai]", err);
      res
        .status(500)
        .json({ error: "Failed to generate seats from AI polygons" });
    }
  },
);
```

**Verify:** `cd server && npx tsc --noEmit 2>&1 | head -20`

---

### Step 7: Add `points` field to local `AiSuggestion` type in the editor — `TripleAMusic/src/pages/SeatLayoutEditorPage.tsx`

**Operation:** `REPLACE`

**Anchor:**

```
  rotationDeg?: number;
  isAccessible?: boolean;
  notes?: string;
}
// ---- end of AiSuggestion type
```

If that exact closing comment doesn't exist, find the unique anchor via the surrounding interface block.

**Anchor (alternative — use this if the comment doesn't exist):**

```
interface AiSuggestion {
  type: string;
  label: string;
  xPct: number;
  yPct: number;
  widthPct?: number;
  heightPct?: number;
  estimatedSeats?: number;
  rotationDeg?: number;
  isAccessible?: boolean;
  notes?: string;
}
```

**Code:**

```typescript
interface AiSuggestion {
  type: string;
  label: string;
  xPct: number;
  yPct: number;
  widthPct?: number;
  heightPct?: number;
  estimatedSeats?: number;
  rotationDeg?: number;
  isAccessible?: boolean;
  notes?: string;
  /** Polygon vertices in 0-100 PCT space from Qwen v19 polygon analysis */
  points?: [number, number][];
}
```

**Verify:** `cd TripleAMusic && npx tsc --noEmit 2>&1 | head -20`

---

### Step 8: Use polygon longest-edge rotation in `applySuggestion` — `TripleAMusic/src/pages/SeatLayoutEditorPage.tsx`

**Operation:** `REPLACE` (compute rotation from polygon when available, else use bbox fallback)

**Anchor:**

```
      shape: "straight", sectionName: s.label, ...rotationDeg: s.rotationDeg ?? 0
```

If not found verbatim, locate `applySuggestion` (line ~1414) and find the `SectionWizardParams` call containing `rotationDeg`. Replace that entire `rotationDeg` expression:

**Anchor:**

```
        shape: "straight",
        sectionName: s.label,
```

**Code:**

```typescript
        shape: "straight",
        sectionName: s.label,
```

Then ALSO replace the `rotationDeg` line immediately following it:

**Anchor:**

```
        rotationDeg: s.rotationDeg ?? 0,
```

**Code:**

```typescript
        rotationDeg: (() => {
          // Prefer polygon longest-edge angle over stored rotationDeg
          if (s.points && s.points.length >= 2) {
            let maxLen = 0;
            let bestAngle = 0;
            for (let i = 0; i < s.points.length; i++) {
              const [ax, ay] = s.points[i];
              const [bx, by] = s.points[(i + 1) % s.points.length];
              const len = Math.hypot(bx - ax, by - ay);
              if (len > maxLen) {
                maxLen = len;
                bestAngle = Math.atan2(by - ay, bx - ax) * (180 / Math.PI);
              }
            }
            return Math.round(bestAngle);
          }
          return s.rotationDeg ?? 0;
        })(),
```

**Verify:** `cd TripleAMusic && npx tsc --noEmit 2>&1 | head -20`

---

### Step 9: Add `polygonZones` prop + section outlines to `SeatSelector` — `packages/shared/src/components/SeatSelector/SeatSelector.tsx`

**Operation:** `REPLACE` (add `PolygonZone` interface + `polygonZones` prop to `SeatSelectorProps`)

**Anchor:**

```
interface SeatSelectorProps {
  /** Seat IDs that other users currently have in their cart (soft indicator only). */
  inCartSeats?: string[];
```

**Code:**

```typescript
export interface PolygonZone {
  label: string;
  /** Polygon vertices in 0-100 PCT space (matches AI suggestion points) */
  points: [number, number][];
  color?: string;
}

interface SeatSelectorProps {
  /** Seat IDs that other users currently have in their cart (soft indicator only). */
  inCartSeats?: string[];
```

**Operation:** `REPLACE` (add `polygonZones` to function destructuring)

**Anchor:**

```
  inCartSeats = [],
  maxSeats,
  onSelectionChange,
}: SeatSelectorProps) {
```

**Code:**

```typescript
  inCartSeats = [],
  maxSeats,
  onSelectionChange,
  polygonZones = [],
}: SeatSelectorProps) {
```

**Operation:** `REPLACE` (render polygon outlines in map mode SVG, after background image, before stage)

**Anchor:**

```
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

            {/* Stage */}
```

**Code:**

```typescript
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
              const zColor = zone.color ?? `hsl(${(zi * 47 + 210) % 360}, 55%, 65%)`;
              const cx = scaled.reduce((s, [sx]) => s + sx, 0) / scaled.length;
              const cy = scaled.reduce((s, [, sy]) => s + sy, 0) / scaled.length;
              return (
                <g key={`zone-${zi}`} style={{ pointerEvents: "none" }}>
                  <polygon points={ptStr} fill={zColor} fillOpacity={0.06}
                    stroke={zColor} strokeWidth={r * 0.3} strokeOpacity={0.45}
                    strokeDasharray={`${r * 1.5} ${r * 0.8}`} />
                  <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
                    fontSize={r * 1.4} fontWeight="600" fontFamily="system-ui, sans-serif"
                    fill={zColor} fillOpacity={0.65} style={{ userSelect: "none" }}>
                    {zone.label}
                  </text>
                </g>
              );
            })}

            {/* Stage */}
```

**Verify:** `cd packages/shared && npx tsc --noEmit 2>&1 | head -20`

---

### Step 10: Update API client — `packages/shared/src/api/client.ts`

**Operation:** `REPLACE` (add `aiPolygonZones` to `getAvailableSeats` return type)

**Anchor:**

```
      floors?: Array<{ floorId: string; name: string; order: number }>;
      stagePosition?: string;
      backgroundImageUrl?: string;
    };
    soldSeatIds: string[];
```

**Code:**

```typescript
      floors?: Array<{ floorId: string; name: string; order: number }>;
      stagePosition?: string;
      backgroundImageUrl?: string;
      aiPolygonZones?: Array<{ type: string; label: string; points: [number, number][] }>;
    };
    soldSeatIds: string[];
```

**Operation:** `INSERT_BEFORE` (add `generateSeatsFromAi` method)

**Anchor:**

```
  async analyzeSeatingLayoutImage(layoutId: string): Promise<{
```

**Code:**

```typescript
  async generateSeatsFromAi(
    layoutId: string,
    opts: { clearExisting?: boolean } = {},
  ): Promise<{ seatsGenerated: number; totalSeats: number }> {
    return await this.request(
      `/seating/layouts/${encodeURIComponent(layoutId)}/generate-from-ai`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(opts) },
    );
  }

  async analyzeSeatingLayoutImage(layoutId: string): Promise<{
```

**Verify:** `cd packages/shared && npx tsc --noEmit 2>&1 | head -20`

---

### Step 11: Wire `backgroundImageUrl` + `polygonZones` into `CheckoutPage` — `TripleAMusic/src/pages/CheckoutPage.tsx`

Read the file first to get exact anchor strings for all three sub-operations:

**Sub-operation A — Extend `seatingData` state type** (find the useState where layout.seats/sections/stagePosition are defined):

```typescript
    layout: {
      seats: SeatInfo[];
      sections: SectionInfo[];
      stagePosition: "top" | "bottom" | "left" | "right";
      backgroundImageUrl?: string | null;
      aiPolygonZones?: Array<{ type: string; label: string; points: [number, number][] }>;
    };
```

**Sub-operation B — Store in `setSeatingData` call** — wherever `stagePosition: seatsData.layout.stagePosition` is set, add:

```typescript
      backgroundImageUrl: seatsData.layout.backgroundImageUrl,
      aiPolygonZones: seatsData.layout.aiPolygonZones,
```

**Sub-operation C — Pass props to `<SeatSelector>`**:

**Anchor:**

```
                        stagePosition={seatingData.layout.stagePosition}
                      />
```

**Code:**

```typescript
                        stagePosition={seatingData.layout.stagePosition}
                        backgroundImageUrl={seatingData.layout.backgroundImageUrl ?? undefined}
                        polygonZones={seatingData.layout.aiPolygonZones}
                      />
```

**Verify:** `cd TripleAMusic && npx tsc --noEmit 2>&1 | head -20`

---

### Step 12: Wire same props into `ConcertDetailPage` — `TripleAMusic/src/pages/ConcertDetailPage.tsx`

Read the file to find exact anchors, then apply the same three sub-operations as Step 11:

- A: extend `seatingData` state type (add `backgroundImageUrl?` and `aiPolygonZones?`)
- B: store in `setSeatingData` call
- C: pass `backgroundImageUrl` and `polygonZones` props to `<SeatSelector>`

**Verify:** `cd TripleAMusic && npx tsc --noEmit 2>&1 | head -20`

---

### Step 13: Add "Auto-Generate All Seats" button in editor — `TripleAMusic/src/pages/SeatLayoutEditorPage.tsx`

**Operation:** `REPLACE` (read aiPanelFooter block first to get exact anchor)

Expected anchor (read lines around line 1650 to confirm exact text):

```
          <div className={styles.aiPanelFooter}>
```

Insert after the existing "Apply All Remaining" button, within the same `aiPanelFooter` div:

**Code to insert:**

```typescript
            <button
              type="button"
              className={styles.aiAnalyzeBtn}
              style={{ background: "var(--taa-blue-900)", marginLeft: 8 }}
              disabled={aiAnalyzing}
              onClick={async () => {
                if (!layoutId) return;
                if (!window.confirm("Replace all seats with AI-generated layout from polygon analysis? This cannot be undone.")) return;
                setAiAnalyzing(true);
                setAiError(null);
                try {
                  const result = await api.generateSeatsFromAi(layoutId, { clearExisting: true });
                  const refreshed = await api.getSeatingLayout(layoutId);
                  setSeats(
                    (refreshed.layout.seats ?? []).map((s: Record<string, unknown>) => ({
                      ...(s as object),
                      posX: (s.posX as number) ?? 0,
                      posY: (s.posY as number) ?? 0,
                    }))
                  );
                  setShowAiPanel(false);
                  setSaveOk(true);
                  setTimeout(() => setSaveOk(false), 3000);
                  console.log(`[generate-from-ai] ${result.seatsGenerated} seats generated`);
                } catch (e) {
                  setAiError(e instanceof Error ? e.message : String(e));
                } finally {
                  setAiAnalyzing(false);
                }
              }}
            >
              🗺️ Auto-Generate All Seats
            </button>
```

**Verify:** `cd TripleAMusic && npm run build 2>&1 | tail -20`

---

### Step 14: Final integration smoke-test

```bash
cd /Users/alexwaldmann/Desktop/TripleAApps/server && npm run build 2>&1 | tail -20
cd /Users/alexwaldmann/Desktop/TripleAApps/TripleAMusic && npm run build 2>&1 | tail -20
cd /Users/alexwaldmann/Desktop/TripleAApps/packages/shared && npx tsc --noEmit 2>&1 | head -20
```

All three must exit without TypeScript errors.

---

## Summary of Changes

| #   | File                                                           | Change                                                                             |
| --- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 1   | `server/src/models/SeatingLayout.ts`                           | Add `points` field to `aiSuggestions.suggestions` schema + interface               |
| 2   | `server/src/routes/seating.ts`                                 | Replace Qwen prompt: polygon-first + remove `format:json` + increase ctx           |
| 3   | `server/src/routes/seating.ts`                                 | Replace response parser: handle `elements[]` polygon format + legacy fallback      |
| 4   | `server/src/routes/seating.ts`                                 | Add `aiPolygonZones` to `available-seats` response                                 |
| 5   | `server/src/lib/polygonToSeats.ts`                             | **NEW FILE** — point-in-polygon fill → `ISeat[]` with `posX/posY`                  |
| 6   | `server/src/routes/seating.ts`                                 | **NEW ENDPOINT** `POST /generate-from-ai` — one-click bulk seat generation         |
| 7   | `TripleAMusic/src/pages/SeatLayoutEditorPage.tsx`              | Add `points` field to local `AiSuggestion` type                                    |
| 8   | `TripleAMusic/src/pages/SeatLayoutEditorPage.tsx`              | Use polygon longest-edge rotation in `applySuggestion`                             |
| 9   | `packages/shared/src/components/SeatSelector/SeatSelector.tsx` | Add `polygonZones` prop; render section outlines in SVG map mode                   |
| 10  | `packages/shared/src/api/client.ts`                            | Add `aiPolygonZones` to `getAvailableSeats` type; add `generateSeatsFromAi` method |
| 11  | `TripleAMusic/src/pages/CheckoutPage.tsx`                      | Store + pass `backgroundImageUrl` + `polygonZones` to `SeatSelector`               |
| 12  | `TripleAMusic/src/pages/ConcertDetailPage.tsx`                 | Same as Step 11                                                                    |
| 13  | `TripleAMusic/src/pages/SeatLayoutEditorPage.tsx`              | Add "Auto-Generate All Seats" button in AI panel footer                            |
