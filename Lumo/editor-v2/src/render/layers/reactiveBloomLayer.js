const FALLBACK = Object.freeze({
  stem: "#2e6a41",
  petalInner: "#ffd5f4",
  petalOuter: "#b37dff",
});

const normalize = (patch, index) => {
  const p = patch && typeof patch === "object" ? patch : {};
  const min = Number.isFinite(p.heightMin) ? Number(p.heightMin) : 22;
  const max = Number.isFinite(p.heightMax) ? Number(p.heightMax) : 110;
  return {
    id: typeof p.id === "string" && p.id.trim() ? p.id.trim() : `reactive_bloom_patch_${index + 1}`,
    x: Number.isFinite(p.x) ? Number(p.x) : 0,
    y: Number.isFinite(p.y) ? Number(p.y) : 0,
    width: Number.isFinite(p.width) && p.width > 0 ? Number(p.width) : 180,
    heightMax: Math.max(1, Math.round(Math.max(min, max))),
    stemColor: typeof p.stemColor === "string" ? p.stemColor : FALLBACK.stem,
    petalInnerColor: typeof p.petalInnerColor === "string" ? p.petalInnerColor : FALLBACK.petalInner,
    petalOuterColor: typeof p.petalOuterColor === "string" ? p.petalOuterColor : FALLBACK.petalOuter,
  };
};
const worldToCanvas = (v, x, y) => ({ x: (v?.offsetX || 0) + x * (v?.zoom || 1), y: (v?.offsetY || 0) + y * (v?.zoom || 1) });

export function renderReactiveBloomPatches(ctx, doc, viewport, interaction = null) {
  const patches = Array.isArray(doc?.reactiveBloomPatches) ? doc.reactiveBloomPatches : [];
  const selectedId = typeof interaction?.selectedReactiveBloomPatchId === "string" ? interaction.selectedReactiveBloomPatchId : null;
  const selectedIndex = Number.isInteger(interaction?.selectedReactiveBloomPatchIndex) ? interaction.selectedReactiveBloomPatchIndex : null;
  for (let i = 0; i < patches.length; i += 1) {
    const p = normalize(patches[i], i);
    const left = p.x - p.width * 0.5;
    const top = p.y - p.heightMax;
    const tl = worldToCanvas(viewport, left, top);
    const br = worldToCanvas(viewport, left + p.width, p.y);
    const w = br.x - tl.x; const h = br.y - tl.y;
    const selected = (selectedId && selectedId === p.id) || (selectedId === null && selectedIndex === i);
    const g = ctx.createLinearGradient(tl.x, tl.y, tl.x, br.y);
    g.addColorStop(0, `${p.petalInnerColor}66`);
    g.addColorStop(1, `${p.stemColor}33`);
    ctx.save();
    ctx.fillStyle = g;
    ctx.strokeStyle = selected ? "rgba(255,225,164,0.98)" : `${p.petalOuterColor}dd`;
    ctx.lineWidth = Math.max(1, (selected ? 2 : 1.3) * (viewport?.zoom || 1));
    ctx.beginPath(); ctx.roundRect(tl.x, tl.y, w, h, Math.max(4, 7 * (viewport?.zoom || 1))); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = `600 ${Math.max(10, Math.round(11 * (viewport?.zoom || 1)))}px Inter, system-ui, sans-serif`;
    ctx.fillText("✿ Reactive Bloom", tl.x + 8 * (viewport?.zoom || 1), tl.y + 8 * (viewport?.zoom || 1));
    ctx.restore();
  }
}

export function findReactiveBloomPatchAtCanvasPoint(doc, viewport, x, y, radius = 2) {
  const patches = Array.isArray(doc?.reactiveBloomPatches) ? doc.reactiveBloomPatches : [];
  const pad = Math.max(2, radius * (viewport?.zoom || 1));
  for (let i = patches.length - 1; i >= 0; i -= 1) {
    const p = normalize(patches[i], i);
    const tl = worldToCanvas(viewport, p.x - p.width * 0.5, p.y - p.heightMax);
    const br = worldToCanvas(viewport, p.x + p.width * 0.5, p.y);
    if (x >= Math.min(tl.x, br.x) - pad && x <= Math.max(tl.x, br.x) + pad && y >= Math.min(tl.y, br.y) - pad && y <= Math.max(tl.y, br.y) + pad) return i;
  }
  return -1;
}
