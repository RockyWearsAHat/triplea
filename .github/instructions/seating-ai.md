# Seating AI — Agent Instructions

This file is the canonical reference for any agent working on the **venue seating layout editor** and the **`analyze-image` AI feature** in Triple A Music.

---

## What This Feature Does

A host/admin uploads a floor plan image for a venue. The server sends the image to a local **Qwen 2.5 VL 32B** model via Ollama. The model returns a JSON description of the venue — stage position, seating zones (as percentage bounding boxes), aisles, and entrances. The frontend editor displays these as overlay suggestions; the user accepts, adjusts, and then auto-generates individual seat rows from each zone.

---

## File Map

| File                                                           | Role                                                           |
| -------------------------------------------------------------- | -------------------------------------------------------------- |
| `server/src/routes/seating.ts`                                 | All seating API routes; `analyze-image` endpoint at ~line 1125 |
| `server/src/models/SeatingLayout.ts`                           | Mongoose model — stores layout JSON + `backgroundImageBlob`    |
| `TripleAMusic/src/pages/SeatLayoutEditorPage.tsx`              | Main editor React page                                         |
| `TripleAMusic/src/pages/SeatLayoutEditorPage.module.scss`      | Editor SCSS (Photoshop-style layout)                           |
| `packages/shared/src/components/SeatSelector/SeatSelector.tsx` | Seat selection component used by customers                     |

---

## The `analyze-image` Endpoint

**Route:** `POST /api/seating/layouts/:layoutId/analyze-image`

**Auth:** requires `customer` role (or `admin`)

**What it does:**

1. Loads the layout's `backgroundImageBlob` from MongoDB
2. **Resizes the image to ≤ 800 px** using `sharp` (installed in `server/`) — this is critical; without it, a 4K image fills the model's entire context
3. Base64-encodes the resized buffer
4. Sends to Ollama via `http.request` (Node.js built-in — avoids undici's 300 s `bodyTimeout` which used to kill the call)
5. 12-minute hard timeout via `req.setTimeout(720_000)`
6. Parses the model's JSON response
7. Auto-normalizes coordinates: if all values are ≤ 1.0, multiplies by 100 (Qwen sometimes returns 0.0–1.0 fractions instead of 0–100 integers)
8. Returns sanitized suggestions array

**Response shape:**

```ts
{
  description: string;
  stagePosition: 'top' | 'bottom' | 'left' | 'right' | null;
  capacityEstimate: number | null;
  estimatedVenueWidthFeet: number | null;
  estimatedVenueHeightFeet: number | null;
  referenceSeat: { widthFeet: number; depthFeet: number; rowPitchFeet: number } | null;
  aiSuggestions: {
    suggestions: Array<{
      type: 'stage' | 'seating_zone' | 'aisle' | 'entrance' | 'table' | ...;
      label: string;
      xPct: number;     // 0–100: left edge of bounding box as % of image width
      yPct: number;     // 0–100: top edge of bounding box as % of image height
      widthPct: number; // 0–100: box width as % of image width
      heightPct: number;// 0–100: box height as % of image height
      estimatedSeats: number | null;
      rotationDeg: number | null; // clockwise rotation of seating zone
      isAccessible: boolean | null;
    }>;
    raw: string; // the raw model output, for debugging
  };
}
```

---

## Coordinate System

- All positions are **percentage of the image dimensions** (0–100 integers)
- `xPct / yPct` = top-left corner of the bounding box
- `widthPct / heightPct` = box dimensions
- `rotationDeg` = clockwise rotation in degrees (0 = rows run left-right)
- The canvas editor maps these percentages onto the viewport size

---

## Known Qwen Edge Cases

1. **Fraction vs. integer coordinates:** Qwen sometimes returns `xPct: 0.5` instead of `xPct: 50`. The server auto-detects this (if max coordinate ≤ 1.0, multiply all by 100) and the frontend must also handle intermediate values gracefully.

2. **Markdown in JSON response:** Qwen sometimes wraps its JSON in code fences even when instructed not to. The server strips ` ```json ` fences before parsing.

3. **Merged zones:** The prompt explicitly asks Qwen to keep separate seating wings as separate zone objects. Even so, Qwen may merge distinct sections. If suggestions look merged, an improved prompt with few-shot examples can help.

4. **Inaccurate seat counts:** `estimatedSeats` is a rough estimate. Use it as a starting point for row auto-generation, not as ground truth.

---

## The Sharp Resize Pipeline

```ts
// In server/src/routes/seating.ts (before base64 encoding)
let imageBuffer = blob.data;
try {
  const sharpLib = (await import("sharp")).default;
  imageBuffer = await sharpLib(blob.data)
    .resize({
      width: 800,
      height: 800,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 85 })
    .toBuffer();
} catch (sharpErr) {
  // graceful degradation — original buffer used
}
const base64Image = imageBuffer.toString("base64");
```

**Why 800 px?** A 4K floor plan at 800 px on the long edge retains all structural information needed for zone identification (walls, rows, stage) while reducing base64 payload from ~6 MB to ~80–120 KB. This keeps the image within the model's effective visual attention range.

**Why JPEG quality 85?** Floor plans are line-art; even JPEG at 85 preserves all edges. PNG would be larger.

---

## Ollama Model Config

- **Model:** `qwen2.5vl:32b`
- **stream:** `false` (single JSON response; simplest to parse)
- **format:** `"json"` (instructs Ollama to constrain output to valid JSON)
- **num_ctx:** `8192` (8K context; sufficient for a resized floor plan + short JSON response)
- **num_predict:** `1500` (limits output tokens; prevents runaway generation)
- **keep_alive:** `"5m"` (keeps the model loaded between calls for faster repeat requests)
- **Transport:** Node.js `http.request` with `req.setTimeout(720_000)` — avoids undici `bodyTimeout`

---

## Improving Accuracy Further (Future Work)

### Option B: Two-pass zone analysis

1. Pass 1: send full resized image → get zone bounding boxes
2. For each `seating_zone` suggestion: crop that region from the image using sharp, send the crop to Qwen with a different prompt asking for row count, seat count per row, and aisle spacing
3. Use the crop results to generate precise seat grids within each zone

### Option C: Few-shot calibration

Add a reference floor plan image + its ideal JSON output in the `images` array alongside the user's image. Qwen VL supports multi-image inputs. One good example significantly improves coordinate consistency.

### Tests needed

- A Jest test that sends a known 100×100 px test image and mocks the Ollama response
- An integration test that verifies the fraction-normalization edge case
- A test verifying graceful degradation when sharp is unavailable
