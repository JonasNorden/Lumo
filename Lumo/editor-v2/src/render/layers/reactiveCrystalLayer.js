import { buildCrystalClusters } from "../shared/proceduralReactiveCrystal.js";

const worldToCanvas = (v, x, y) => ({ x: (v?.offsetX || 0) + x * (v?.zoom || 1), y: (v?.offsetY || 0) + y * (v?.zoom || 1) });
function normalize(patch, index) {
  const p = patch && typeof patch === "object" ? patch : {};
  const min = Number.isFinite(p.heightMin) ? Number(p.heightMin) : 18;
  const max = Number.isFinite(p.heightMax) ? Number(p.heightMax) : 92;
  return { id: typeof p.id === "string" && p.id.trim() ? p.id.trim() : `reactive_crystal_patch_${index + 1}`, x: Number.isFinite(p.x) ? Number(p.x) : 0, y: Number.isFinite(p.y) ? Number(p.y) : 0, width: Number.isFinite(p.width) && p.width > 0 ? Number(p.width) : 168, seed: Number.isFinite(p.seed) ? Number(p.seed) : index * 937 + 11, heightMin: min, heightMax: Math.max(1, Math.round(Math.max(min, max))) };
}

export function renderReactiveCrystalPatches(ctx, doc, viewport, interaction = null) {
  const patches = Array.isArray(doc?.reactiveCrystalPatches) ? doc.reactiveCrystalPatches : [];
  const selectedId = typeof interaction?.selectedReactiveCrystalPatchId === "string" ? interaction.selectedReactiveCrystalPatchId : null;
  const selectedIndex = Number.isInteger(interaction?.selectedReactiveCrystalPatchIndex) ? interaction.selectedReactiveCrystalPatchIndex : null;

  for (let i = 0; i < patches.length; i += 1) {
    const p = normalize(patches[i], i);
    const selected = (selectedId && selectedId === p.id) || (selectedId === null && selectedIndex === i);
    const crystal = buildCrystalClusters(p);
    const center = worldToCanvas(viewport, p.x, p.y);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const glow = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, p.width * (viewport?.zoom || 1) * 0.9);
    glow.addColorStop(0, "rgba(116,49,255,0.18)"); glow.addColorStop(0.38, "rgba(88,231,255,0.08)"); glow.addColorStop(1, "rgba(116,49,255,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(center.x - p.width * 0.9, center.y - p.heightMax * 0.45, p.width * 1.8, p.heightMax * 0.7);
    ctx.restore();

    for (const c of crystal.chips) { const cp = worldToCanvas(viewport, c.x, c.y); ctx.save(); ctx.translate(cp.x, cp.y); ctx.rotate(c.a); ctx.fillStyle = "rgba(124,65,230,.55)"; ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h); ctx.restore(); }
    for (const s of crystal.shards) {
      const x = s.x; const y = s.y; const w = s.w; const h = s.h; const topX = x + s.lean;
      const p0 = worldToCanvas(viewport, x - w * 0.55, y); const p1 = worldToCanvas(viewport, x - w * 0.42 + s.jag, y - h * 0.58); const p2 = worldToCanvas(viewport, topX, y - h); const p3 = worldToCanvas(viewport, x + w * 0.46 - s.jag * 0.4, y - h * 0.52); const p4 = worldToCanvas(viewport, x + w * 0.55, y);
      ctx.save(); ctx.globalAlpha = s.alpha; ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(p3.x, p3.y); ctx.lineTo(p4.x, p4.y); ctx.closePath();
      const grad = ctx.createLinearGradient(p0.x, p0.y, p2.x, p2.y); grad.addColorStop(0, "rgba(35,10,88,.95)"); grad.addColorStop(.42, "rgba(92,40,205,.88)"); grad.addColorStop(.75, "rgba(129,72,255,.72)"); grad.addColorStop(1, "rgba(218,185,255,.85)");
      ctx.fillStyle = grad; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = "rgba(218,190,255,.55)"; ctx.stroke();
      ctx.globalAlpha = .23; ctx.fillStyle = "rgba(112,231,255,.75)"; ctx.beginPath(); ctx.moveTo(p2.x, p2.y); ctx.lineTo(worldToCanvas(viewport, x, y - h * .45).x, worldToCanvas(viewport, x, y - h * .45).y); ctx.lineTo(worldToCanvas(viewport, x + w * .35, y).x, worldToCanvas(viewport, x + w * .35, y).y); ctx.lineTo(p3.x, p3.y); ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    const left = p.x - p.width * 0.5; const tl = worldToCanvas(viewport, left, p.y - p.heightMax); const br = worldToCanvas(viewport, left + p.width, p.y);
    ctx.strokeStyle = selected ? "rgba(255,225,164,0.98)" : "rgba(141,155,255,0.7)"; ctx.lineWidth = Math.max(1, (selected ? 2 : 1.2) * (viewport?.zoom || 1)); ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
    ctx.fillStyle = "rgba(219, 246, 255, 0.92)"; ctx.font = `600 ${Math.max(10, Math.round(11 * (viewport?.zoom || 1)))}px Inter, system-ui, sans-serif`; ctx.textBaseline = "top"; ctx.fillText("◇ Reactive Crystal", tl.x + 8 * (viewport?.zoom || 1), tl.y + 8 * (viewport?.zoom || 1));
  }
}

export function findReactiveCrystalPatchAtCanvasPoint(doc, viewport, x, y, radius = 2) {
  const patches = Array.isArray(doc?.reactiveCrystalPatches) ? doc.reactiveCrystalPatches : []; const pad = Math.max(2, radius * (viewport?.zoom || 1));
  for (let i = patches.length - 1; i >= 0; i -= 1) { const p = normalize(patches[i], i); const tl = worldToCanvas(viewport, p.x - p.width * 0.5, p.y - p.heightMax); const br = worldToCanvas(viewport, p.x + p.width * 0.5, p.y); if (x >= Math.min(tl.x, br.x) - pad && x <= Math.max(tl.x, br.x) + pad && y >= Math.min(tl.y, br.y) - pad && y <= Math.max(tl.y, br.y) + pad) return i; }
  return -1;
}
