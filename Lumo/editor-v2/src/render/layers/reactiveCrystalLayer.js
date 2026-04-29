const FALLBACK = Object.freeze({
  base: "#335c88",
  glow: "#83e6ff",
  edge: "#7d8dff",
});

const worldToCanvas = (v, x, y) => ({ x: (v?.offsetX || 0) + x * (v?.zoom || 1), y: (v?.offsetY || 0) + y * (v?.zoom || 1) });

function normalize(patch, index) {
  const p = patch && typeof patch === "object" ? patch : {};
  const min = Number.isFinite(p.heightMin) ? Number(p.heightMin) : 18;
  const max = Number.isFinite(p.heightMax) ? Number(p.heightMax) : 92;
  return {
    id: typeof p.id === "string" && p.id.trim() ? p.id.trim() : `reactive_crystal_patch_${index + 1}`,
    x: Number.isFinite(p.x) ? Number(p.x) : 0,
    y: Number.isFinite(p.y) ? Number(p.y) : 0,
    width: Number.isFinite(p.width) && p.width > 0 ? Number(p.width) : 168,
    heightMax: Math.max(1, Math.round(Math.max(min, max))),
    baseColor: typeof p.baseColor === "string" ? p.baseColor : FALLBACK.base,
    glowColor: typeof p.glowColor === "string" ? p.glowColor : FALLBACK.glow,
    edgeColor: typeof p.edgeColor === "string" ? p.edgeColor : FALLBACK.edge,
  };
}

export function renderReactiveCrystalPatches(ctx, doc, viewport, interaction = null) {
  const patches = Array.isArray(doc?.reactiveCrystalPatches) ? doc.reactiveCrystalPatches : [];
  const selectedId = typeof interaction?.selectedReactiveCrystalPatchId === "string" ? interaction.selectedReactiveCrystalPatchId : null;
  const selectedIndex = Number.isInteger(interaction?.selectedReactiveCrystalPatchIndex) ? interaction.selectedReactiveCrystalPatchIndex : null;
  const zoom = viewport?.zoom || 1;

  for (let i = 0; i < patches.length; i += 1) {
    const p = normalize(patches[i], i);
    const left = p.x - p.width * 0.5;
    const top = p.y - p.heightMax;
    const tl = worldToCanvas(viewport, left, top);
    const br = worldToCanvas(viewport, left + p.width, p.y);
    const w = br.x - tl.x;
    const h = br.y - tl.y;
    const selected = (selectedId && selectedId === p.id) || (selectedId === null && selectedIndex === i);

    ctx.save();
    const grad = ctx.createLinearGradient(tl.x, tl.y, tl.x, br.y);
    grad.addColorStop(0, `${p.glowColor}66`);
    grad.addColorStop(1, `${p.baseColor}33`);
    ctx.fillStyle = grad;
    ctx.strokeStyle = selected ? "rgba(255,225,164,0.98)" : `${p.edgeColor}dd`;
    ctx.lineWidth = Math.max(1, (selected ? 2 : 1.2) * zoom);

    const cx = tl.x + w * 0.5;
    const cy = tl.y + h * 0.5;
    const dx = w * 0.5;
    const dy = h * 0.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy - dy);
    ctx.lineTo(cx + dx, cy);
    ctx.lineTo(cx, cy + dy);
    ctx.lineTo(cx - dx, cy);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "rgba(219, 246, 255, 0.95)";
    ctx.font = `600 ${Math.max(10, Math.round(11 * zoom))}px Inter, system-ui, sans-serif`;
    ctx.textBaseline = "top";
    ctx.fillText("◇ Reactive Crystal", tl.x + 8 * zoom, tl.y + 8 * zoom);
    ctx.restore();
  }
}

export function findReactiveCrystalPatchAtCanvasPoint(doc, viewport, x, y, radius = 2) {
  const patches = Array.isArray(doc?.reactiveCrystalPatches) ? doc.reactiveCrystalPatches : [];
  const pad = Math.max(2, radius * (viewport?.zoom || 1));
  for (let i = patches.length - 1; i >= 0; i -= 1) {
    const p = normalize(patches[i], i);
    const tl = worldToCanvas(viewport, p.x - p.width * 0.5, p.y - p.heightMax);
    const br = worldToCanvas(viewport, p.x + p.width * 0.5, p.y);
    if (x >= Math.min(tl.x, br.x) - pad && x <= Math.max(tl.x, br.x) + pad && y >= Math.min(tl.y, br.y) - pad && y <= Math.max(tl.y, br.y) + pad) return i;
  }
  return -1;
}
