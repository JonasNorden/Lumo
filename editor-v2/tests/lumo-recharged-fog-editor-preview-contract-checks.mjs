import assert from "node:assert/strict";
import { renderPlacementPreviewOverlay } from "../../Lumo/editor-v2/src/render/layers/previewLayer.js";
import { renderSelectionOverlay } from "../../Lumo/editor-v2/src/render/layers/selectionLayer.js";

function createMockCtx() {
  const ops = {
    fillRect: [],
    strokeRect: [],
    roundRect: 0,
    beginPath: 0,
    moveTo: [],
    lineTo: [],
    fill: 0,
    stroke: 0,
  };

  const gradient = { addColorStop() {} };
  const ctx = {
    save() {},
    restore() {},
    setLineDash() {},
    clearRect() {},
    arc() {},
    fillText() {},
    roundRect(...args) {
      void args;
      ops.roundRect += 1;
    },
    beginPath() {
      ops.beginPath += 1;
    },
    moveTo(x, y) {
      ops.moveTo.push({ x, y });
    },
    lineTo(x, y) {
      ops.lineTo.push({ x, y });
    },
    fillRect(x, y, width, height) {
      ops.fillRect.push({ x, y, width, height });
    },
    strokeRect(x, y, width, height) {
      ops.strokeRect.push({ x, y, width, height });
    },
    createLinearGradient() {
      return gradient;
    },
    fill() {
      ops.fill += 1;
    },
    stroke() {
      ops.stroke += 1;
    },
    set fillStyle(value) { void value; },
    set strokeStyle(value) { void value; },
    set lineWidth(value) { void value; },
    set globalAlpha(value) { void value; },
    get globalAlpha() { return 1; },
  };

  return { ctx, ops };
}

function approxEqual(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) < 1e-6, `${message}: expected ${expected}, got ${actual}`);
}

const doc = { dimensions: { tileSize: 24, width: 40, height: 30 } };
const viewport = { offsetX: 10, offsetY: 20, zoom: 1.5 };

{
  const { ctx, ops } = createMockCtx();
  renderPlacementPreviewOverlay(
    ctx,
    doc,
    viewport,
    {
      activeTool: "inspect",
      activeLayer: "entities",
      hoverCell: { x: 5, y: 9 },
      volumePlacementDrag: {
        active: true,
        type: "fog_volume",
        startCell: { x: 2, y: 7 },
        endCell: { x: 4, y: 8 },
        thicknessPx: null,
      },
    },
    {
      entity: { id: "fog_volume", type: "fog_volume" },
      decor: null,
      sound: null,
    },
  );

  assert.equal(ops.roundRect, 0, "expected no generic fog entity hover preview while fog drag preview is active");
  assert.ok(ops.fillRect.length >= 1, "expected dedicated fog drag preview fill to render");

  const placementFill = ops.fillRect[0];
  approxEqual(placementFill.x, 82, "expected fog preview x to align to authored drag rect");
  approxEqual(placementFill.y, 272, "expected fog preview y to align to authored drag rect top");
  approxEqual(placementFill.width, 108, "expected fog preview width to align to authored drag rect");
  approxEqual(placementFill.height, 72, "expected fog preview height to align to authored drag rect");
}

{
  const { ctx, ops } = createMockCtx();
  renderPlacementPreviewOverlay(
    ctx,
    doc,
    viewport,
    {
      activeTool: "inspect",
      activeLayer: "entities",
      hoverCell: { x: 6, y: 9 },
      volumePlacementDrag: {
        active: true,
        type: "water_volume",
        startCell: { x: 2, y: 7 },
        endCell: { x: 4, y: 8 },
        depthPx: null,
      },
    },
    {
      entity: { id: "water_volume", type: "water_volume" },
      decor: null,
      sound: null,
    },
  );

  assert.equal(ops.roundRect, 0, "expected no generic entity hover preview for active special-volume drag");
  assert.ok(ops.fillRect.length >= 1, "expected water drag preview to remain rendered");
}

{
  const { ctx, ops } = createMockCtx();
  renderSelectionOverlay(
    ctx,
    doc,
    viewport,
    {
      hoverCell: { x: 8, y: 8 },
      selectedCell: { x: 8, y: 8 },
      volumePlacementDrag: {
        active: true,
        type: "fog_volume",
      },
    },
  );

  assert.equal(ops.fillRect.length, 0, "expected 1x1 hover/selected cell markers to be suppressed for fog drag previews");
  assert.equal(ops.strokeRect.length, 0, "expected no 1x1 outline markers during fog drag previews");
}

{
  const { ctx, ops } = createMockCtx();
  renderSelectionOverlay(
    ctx,
    doc,
    viewport,
    {
      hoverCell: { x: 8, y: 8 },
      selectedCell: { x: 8, y: 8 },
      volumePlacementDrag: null,
    },
  );

  assert.ok(ops.fillRect.length >= 2, "expected regular cell overlays to remain when no special-volume drag is active");
  assert.ok(ops.strokeRect.length >= 2, "expected regular cell outlines to remain when no special-volume drag is active");
}

console.log("recharged fog editor preview contracts ok");
