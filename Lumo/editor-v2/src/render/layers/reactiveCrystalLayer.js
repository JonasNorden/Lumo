import { buildCrystalClusters, clamp, parseColorHex } from "../shared/proceduralReactiveCrystal.js";

const FALLBACK = Object.freeze({ base: "#1a1330", glow: "#6d5bff", core: "#63d3ff", edge: "#8d9bff" });
const worldToCanvas = (v, x, y) => ({ x: (v?.offsetX || 0) + x * (v?.zoom || 1), y: (v?.offsetY || 0) + y * (v?.zoom || 1) });
function normalize(patch, index) { const p = patch && typeof patch === "object" ? patch : {}; const min = Number.isFinite(p.heightMin) ? Number(p.heightMin) : 18; const max = Number.isFinite(p.heightMax) ? Number(p.heightMax) : 92; return { id: typeof p.id === "string" && p.id.trim() ? p.id.trim() : `reactive_crystal_patch_${index + 1}`, x: Number.isFinite(p.x) ? Number(p.x) : 0, y: Number.isFinite(p.y) ? Number(p.y) : 0, width: Number.isFinite(p.width) && p.width > 0 ? Number(p.width) : 168, clusterCount: Number.isFinite(p.clusterCount) ? Number(p.clusterCount) : 8, seed: Number.isFinite(p.seed) ? Number(p.seed) : index * 937 + 11, heightMin: min, heightMax: Math.max(1, Math.round(Math.max(min, max))), baseColor: typeof p.baseColor === "string" ? p.baseColor : FALLBACK.base, glowColor: typeof p.glowColor === "string" ? p.glowColor : FALLBACK.glow, coreColor: typeof p.coreColor === "string" ? p.coreColor : FALLBACK.core, edgeColor: typeof p.edgeColor === "string" ? p.edgeColor : FALLBACK.edge }; }

export function renderReactiveCrystalPatches(ctx, doc, viewport, interaction = null) {
  const patches = Array.isArray(doc?.reactiveCrystalPatches) ? doc.reactiveCrystalPatches : [];
  const selectedId = typeof interaction?.selectedReactiveCrystalPatchId === "string" ? interaction.selectedReactiveCrystalPatchId : null;
  const selectedIndex = Number.isInteger(interaction?.selectedReactiveCrystalPatchIndex) ? interaction.selectedReactiveCrystalPatchIndex : null;
  const zoom = viewport?.zoom || 1;
  for (let i = 0; i < patches.length; i += 1) {
    const p = normalize(patches[i], i); const selected = (selectedId && selectedId === p.id) || (selectedId === null && selectedIndex === i);
    const body = parseColorHex(p.baseColor, FALLBACK.base); const glow = parseColorHex(p.glowColor, FALLBACK.glow); const edge = parseColorHex(p.edgeColor, FALLBACK.edge); const core = parseColorHex(p.coreColor, FALLBACK.core);
    const localClusters = buildCrystalClusters(p);
    ctx.save();
    for (const local of localClusters) {
      const c = worldToCanvas(viewport, local.x, local.y); ctx.fillStyle = `rgba(${glow.r},${glow.g},${glow.b},0.12)`; ctx.beginPath(); ctx.arc(c.x, c.y, local.baseRadius * zoom * 2.2, 0, Math.PI * 2); ctx.fill();
      for (const shard of local.shards) { const h = shard.height; const left = worldToCanvas(viewport, local.x + shard.sideJitter - shard.halfW, local.y); const right = worldToCanvas(viewport, local.x + shard.sideJitter + shard.halfW, local.y); const tip = worldToCanvas(viewport, local.x + shard.sideJitter + shard.lean * h, local.y - h); const g = ctx.createLinearGradient(left.x, left.y, tip.x, tip.y); g.addColorStop(0, `rgba(${body.r},${body.g},${body.b},0.62)`); g.addColorStop(1, `rgba(${glow.r},${glow.g},${glow.b},0.26)`); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(left.x, left.y); ctx.lineTo(tip.x, tip.y); ctx.lineTo(right.x, right.y); ctx.closePath(); ctx.fill(); ctx.strokeStyle = `rgba(${edge.r},${edge.g},${edge.b},0.26)`; ctx.lineWidth = Math.max(0.8, zoom * 0.9); ctx.stroke(); const cc = worldToCanvas(viewport, local.x + shard.sideJitter + shard.lean * h * 0.35, local.y - h * 0.52); ctx.fillStyle = `rgba(${core.r},${core.g},${core.b},0.2)`; ctx.beginPath(); ctx.arc(cc.x, cc.y, clamp(1, 1, 2) * zoom, 0, Math.PI * 2); ctx.fill(); }
    }
    const left = p.x - p.width * 0.5; const tl = worldToCanvas(viewport, left, p.y - p.heightMax); const br = worldToCanvas(viewport, left + p.width, p.y);
    ctx.strokeStyle = selected ? "rgba(255,225,164,0.98)" : `rgba(${edge.r},${edge.g},${edge.b},0.7)`; ctx.lineWidth = Math.max(1, (selected ? 2 : 1.2) * zoom); ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
    ctx.fillStyle = "rgba(219, 246, 255, 0.92)"; ctx.font = `600 ${Math.max(10, Math.round(11 * zoom))}px Inter, system-ui, sans-serif`; ctx.textBaseline = "top"; ctx.fillText("◇ Reactive Crystal", tl.x + 8 * zoom, tl.y + 8 * zoom);
    ctx.restore();
  }
}

export function findReactiveCrystalPatchAtCanvasPoint(doc, viewport, x, y, radius = 2) {
  const patches = Array.isArray(doc?.reactiveCrystalPatches) ? doc.reactiveCrystalPatches : []; const pad = Math.max(2, radius * (viewport?.zoom || 1));
  for (let i = patches.length - 1; i >= 0; i -= 1) { const p = normalize(patches[i], i); const tl = worldToCanvas(viewport, p.x - p.width * 0.5, p.y - p.heightMax); const br = worldToCanvas(viewport, p.x + p.width * 0.5, p.y); if (x >= Math.min(tl.x, br.x) - pad && x <= Math.max(tl.x, br.x) + pad && y >= Math.min(tl.y, br.y) - pad && y <= Math.max(tl.y, br.y) + pad) return i; }
  return -1;
}
