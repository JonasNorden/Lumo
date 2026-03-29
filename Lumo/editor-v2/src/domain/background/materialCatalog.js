const BUILTIN_BACKGROUND_MATERIALS = [
  {
    id: "bg_stone_wall",
    label: "Stone Wall",
    img: "../data/assets/sprites/bg/wall_05.png",
    drawW: 24,
    drawH: 24,
    drawAnchor: "BL",
    drawOffX: 0,
    drawOffY: 0,
    footprint: { w: 1, h: 1 },
    fallbackColor: "#324058",
    group: "Core",
  },
  {
    id: "bg_arch",
    label: "Arch",
    img: "../data/assets/tiles/stone_02.png",
    drawW: 48,
    drawH: 48,
    drawAnchor: "BL",
    drawOffX: 0,
    drawOffY: 0,
    footprint: { w: 2, h: 2 },
    fallbackColor: "#44546f",
    group: "Core",
  },
  {
    id: "bg_pillar",
    label: "Pillar",
    img: "../data/assets/tiles/stone_03.png",
    drawW: 24,
    drawH: 48,
    drawAnchor: "BL",
    drawOffX: 0,
    drawOffY: 0,
    footprint: { w: 1, h: 2 },
    fallbackColor: "#50627f",
    group: "Core",
  },
];

const materialMap = new Map(BUILTIN_BACKGROUND_MATERIALS.map((material) => [material.id, material]));

export const BACKGROUND_MATERIAL_OPTIONS = BUILTIN_BACKGROUND_MATERIALS;
export const DEFAULT_BACKGROUND_MATERIAL_ID = BACKGROUND_MATERIAL_OPTIONS[0]?.id || "bg_placeholder";

export function getBackgroundMaterialById(id, authoredMaterials = null) {
  if (Array.isArray(authoredMaterials)) {
    const authored = authoredMaterials.find((material) => material?.id === id);
    if (authored) return authored;
  }
  return materialMap.get(id) || null;
}

export function normalizeBackgroundMaterial(material, index = 0) {
  const fallback = BACKGROUND_MATERIAL_OPTIONS[index % Math.max(1, BACKGROUND_MATERIAL_OPTIONS.length)] || null;
  const rawId = typeof material?.id === "string" && material.id.trim() ? material.id.trim() : fallback?.id || `bg_material_${index + 1}`;
  return {
    id: rawId,
    label: typeof material?.label === "string" && material.label.trim() ? material.label.trim() : fallback?.label || `Background ${index + 1}`,
    img: typeof material?.img === "string" && material.img.trim() ? material.img.trim() : fallback?.img || null,
    drawW: Number.isFinite(material?.drawW) ? Math.max(1, Math.round(material.drawW)) : Number.isFinite(fallback?.drawW) ? fallback.drawW : 24,
    drawH: Number.isFinite(material?.drawH) ? Math.max(1, Math.round(material.drawH)) : Number.isFinite(fallback?.drawH) ? fallback.drawH : 24,
    drawAnchor: "BL",
    drawOffX: Number.isFinite(material?.drawOffX) ? Math.round(material.drawOffX) : Number.isFinite(fallback?.drawOffX) ? fallback.drawOffX : 0,
    drawOffY: Number.isFinite(material?.drawOffY) ? Math.round(material.drawOffY) : Number.isFinite(fallback?.drawOffY) ? fallback.drawOffY : 0,
    footprint: {
      w: Number.isFinite(material?.footprint?.w) ? Math.max(1, Math.round(material.footprint.w)) : Math.max(1, Math.round((material?.drawW || fallback?.drawW || 24) / 24)),
      h: Number.isFinite(material?.footprint?.h) ? Math.max(1, Math.round(material.footprint.h)) : Math.max(1, Math.round((material?.drawH || fallback?.drawH || 24) / 24)),
    },
    fallbackColor: typeof material?.fallbackColor === "string" && material.fallbackColor.trim()
      ? material.fallbackColor
      : fallback?.fallbackColor || "#44546f",
    group: typeof material?.group === "string" && material.group.trim() ? material.group.trim() : fallback?.group || "Custom",
  };
}

function normalizeMaterialIdForCompare(value) {
  return String(value || "").trim().toLowerCase();
}

export function isBackgroundMaterialIdTaken(materialId) {
  const normalized = normalizeMaterialIdForCompare(materialId);
  return normalized.length > 0 && BACKGROUND_MATERIAL_OPTIONS.some((material) => normalizeMaterialIdForCompare(material?.id) === normalized);
}

export function registerBackgroundMaterialOption(entry) {
  const materialId = String(entry?.materialId || entry?.id || "").trim();
  if (!materialId) return { ok: false, reason: "missing-material-id" };
  if (isBackgroundMaterialIdTaken(materialId)) return { ok: false, reason: "duplicate-material-id" };

  const normalizedMaterial = normalizeBackgroundMaterial({
    id: materialId,
    label: entry?.label || materialId,
    img: entry?.img || null,
    drawW: entry?.drawW,
    drawH: entry?.drawH,
    drawAnchor: "BL",
    drawOffX: entry?.drawOffX,
    drawOffY: entry?.drawOffY,
    footprint: entry?.footprint,
    fallbackColor: entry?.fallbackColor,
    group: entry?.group || "Custom",
  }, BACKGROUND_MATERIAL_OPTIONS.length);

  BACKGROUND_MATERIAL_OPTIONS.push(normalizedMaterial);
  materialMap.set(normalizedMaterial.id, normalizedMaterial);
  return { ok: true, material: normalizedMaterial };
}
