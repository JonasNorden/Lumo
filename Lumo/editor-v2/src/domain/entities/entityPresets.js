import { cloneEntityParams, mergeEntityParams } from "./entityParams.js";
import { normalizeEditableObjectType } from "../placeables/editableObjectBuckets.js";

export const ENTITY_PRESETS = [
  {
    id: "player-spawn",
    type: "player-spawn",
    defaultName: "Player Spawn",
    defaultParams: {},
    img: "../data/assets/sprites/lumo/lumo_idle_1.png",
    drawW: 24,
    drawH: 24,
    footprintW: 24,
    footprintH: 24,
    drawAnchor: "BL",
    hitRadius: 8.5,
  },
  {
    id: "player-exit",
    type: "player-exit",
    defaultName: "Exit",
    defaultParams: {},
    img: null,
    drawW: 24,
    drawH: 24,
    footprintW: 24,
    footprintH: 24,
    drawAnchor: "BL",
    hitRadius: 8.5,
  },
  {
    id: "lantern_01",
    type: "lantern_01",
    defaultName: "Lantern",
    defaultParams: {
      radius: 170,
      strength: 0.85,
    },
    img: "../data/assets/sprites/lights/lantern_01.png",
    drawW: 14,
    drawH: 14,
    footprintW: 14,
    footprintH: 14,
    drawAnchor: "BL",
    hitRadius: 8,
  },
  {
    id: "firefly_01",
    type: "firefly_01",
    defaultName: "Firefly",
    defaultParams: {
      lightDiameter: 240,
      lightStrength: 0.8,
      aggroTiles: 6,
      flyRadius: 5,
      flyRangeX: 5,
      flyRangeYUp: 5,
      flySpeed: 45,
      smooth: 7,
      flyTime: 2.5,
      cooldown: 2,
      fadeIn: 0.35,
      fadeOut: 0.45,
      perchSearchRadius: 6,
    },
    img: "../data/assets/sprites/lights/firefly_01.png",
    drawW: 12,
    drawH: 12,
    footprintW: 12,
    footprintH: 12,
    drawAnchor: "BL",
    hitRadius: 7,
  },
  {
    id: "dark_creature_01",
    type: "dark_creature_01",
    defaultName: "Dark Creature",
    defaultParams: {
      hp: 3,
      hitCooldown: 0.6,
      safeDelay: 0.6,
      patrolTiles: 0,
      aggroTiles: 0,
      castCooldown: 5.5,
      energyLoss: 40,
      knockbackX: 260,
      knockbackY: -220,
      reactsToFlares: true,
    },
    img: "../data/assets/sprites/creatures/dc_idle_3.png",
    drawW: 18,
    drawH: 18,
    footprintW: 18,
    footprintH: 18,
    drawAnchor: "BL",
    hitRadius: 9,
  },
  {
    id: "hover_void_01",
    type: "hover_void_01",
    defaultName: "Hover Void",
    defaultParams: {
      aggroTiles: 7,
      followTiles: 7,
      maxHp: 3,
      loseSightTiles: 11,
      attackCooldownMin: 1,
      attackCooldownMax: 3,
      attackDamage: 12,
      attackPushback: 180,
      braveGroupSize: 3,
      swarmGroupSize: 6,
    },
    img: "../data/assets/sprites/creatures/void_m_04.png",
    drawW: 16,
    drawH: 16,
    footprintW: 16,
    footprintH: 16,
    drawAnchor: "BL",
    hitRadius: 8.5,
  },
  {
    id: "trigger",
    type: "trigger",
    defaultName: "Trigger",
    defaultParams: {
      event: "",
      radius: 2,
    },
    img: "../data/assets/sprites/sound/trigger.png",
    drawW: 24,
    drawH: 24,
    footprintW: 24,
    footprintH: 24,
    drawAnchor: "BL",
    hitRadius: 8.5,
  },
  {
    id: "checkpoint",
    type: "checkpoint",
    defaultName: "Checkpoint",
    defaultParams: {
      respawnId: "",
    },
    img: "../data/assets/sprites/lights/lantern_2.png",
    drawW: 24,
    drawH: 24,
    footprintW: 24,
    footprintH: 24,
    drawAnchor: "BL",
    hitRadius: 8.5,
  },
  {
    id: "powercell_01",
    type: "powercell_01",
    defaultName: "Power-cell",
    defaultParams: {},
    img: "../data/assets/sprites/energy/powercell_01.png",
    drawW: 24,
    drawH: 24,
    footprintW: 24,
    footprintH: 24,
    drawAnchor: "BL",
    hitRadius: 7.5,
  },
  {
    id: "flare_pickup_01",
    type: "flare_pickup_01",
    defaultName: "Flare Pickup",
    defaultParams: {},
    img: "../data/assets/sprites/pickups/flare_pickup_01.png",
    drawW: 24,
    drawH: 24,
    footprintW: 24,
    footprintH: 24,
    drawAnchor: "BL",
    hitRadius: 7.5,
  },
  {
    id: "fog_volume",
    type: "fog_volume",
    defaultName: "Fog Volume",
    defaultParams: {
      area: { x0: 0, x1: 240, y0: 0, falloff: 120 },
      look: { density: 0.28, lift: 14, thickness: 56, layers: 20, noise: 0.14, drift: 0, color: "#E1EEFF", exposure: 1 },
      smoothing: { diffuse: 0.2, relax: 0.22, visc: 0.9 },
      interaction: { radius: 92, push: 2.2, behind: 1, bulge: 1.2, gate: 70 },
      organic: { strength: 0.35, scale: 1, speed: 0.65 },
      render: { blend: "screen", lumoBehindFog: true },
    },
    img: null,
    drawW: 24,
    drawH: 24,
    footprintW: 24,
    footprintH: 24,
    drawAnchor: "BL",
    hitRadius: 12,
  },
  {
    id: "water_volume",
    type: "water_volume",
    defaultName: "Water Volume",
    defaultParams: {
      area: { x0: 0, x1: 240, y0: 0, depth: 96 },
      motion: { waveAmount: 0.35, waveSpeed: 0.9 },
      look: { topColor: "#4EB8F2", bottomColor: "#0A4B93" },
      hazard: { instantDeath: true },
    },
    img: null,
    drawW: 24,
    drawH: 24,
    footprintW: 24,
    footprintH: 24,
    drawAnchor: "BL",
    hitRadius: 12,
  },
  {
    id: "lava_volume",
    type: "lava_volume",
    defaultName: "Lava Volume",
    defaultParams: {
      area: { x0: 0, x1: 240, y0: 0, depth: 88 },
      flow: { speed: 0.55 },
      look: { temperature: 0.72, crustAmount: 45 },
      hazard: { instantDeath: true },
    },
    img: null,
    drawW: 24,
    drawH: 24,
    footprintW: 24,
    footprintH: 24,
    drawAnchor: "BL",
    hitRadius: 12,
  },
  {
    id: "bubbling_liquid_volume",
    type: "bubbling_liquid_volume",
    defaultName: "Liquid Acid / Swamp",
    defaultParams: {
      area: { x0: 0, x1: 240, y0: 0, depth: 92 },
      look: { topColor: "#7FD12E", bottomColor: "#2F5E1C" },
      behavior: { surfaceActivity: 0.45, bubbleAmount: 58, fumeAmount: 40 },
      hazard: { instantDeath: true },
    },
    img: null,
    drawW: 24,
    drawH: 24,
    footprintW: 24,
    footprintH: 24,
    drawAnchor: "BL",
    hitRadius: 12,
  },
  {
    id: "generic",
    type: "generic",
    defaultName: "Generic",
    defaultParams: {},
    img: "../data/assets/sprites/pickups/flare_pickup_01.png",
    drawW: 24,
    drawH: 24,
    footprintW: 24,
    footprintH: 24,
    drawAnchor: "BL",
    hitRadius: 7.5,
  },
];

const ENTITY_PRESET_BY_ID = new Map(ENTITY_PRESETS.map((preset) => [preset.id, preset]));

export const DEFAULT_ENTITY_PRESET_ID = "generic";

function remapLegacyEntityParams(type, params) {
  const normalizedType = normalizeEditableObjectType(type);
  const nextParams = cloneEntityParams(params);

  if (normalizedType === "lantern_01") {
    if (nextParams.radius == null && Number.isFinite(Number(nextParams.lightRadius))) {
      nextParams.radius = Number(nextParams.lightRadius);
    }
    if (nextParams.strength == null && Number.isFinite(Number(nextParams.lightStrength))) {
      nextParams.strength = Number(nextParams.lightStrength);
    }
    delete nextParams.lightRadius;
    delete nextParams.lightStrength;
    delete nextParams.flicker;
  }

  if (normalizedType === "firefly_01") {
    if (nextParams.lightDiameter == null && Number.isFinite(Number(nextParams.lightRadius))) {
      nextParams.lightDiameter = Number(nextParams.lightRadius) * 2;
    }
    delete nextParams.lightRadius;
  }

  if (normalizedType === "dark_creature_01" && nextParams.aggroTiles == null && Number.isFinite(Number(nextParams.aggroRadius))) {
    nextParams.aggroTiles = Number(nextParams.aggroRadius) / 24;
  }

  return nextParams;
}

export function findEntityPresetById(presetId) {
  return ENTITY_PRESET_BY_ID.get(presetId) || null;
}

export function findEntityPresetByType(type) {
  const normalizedType = normalizeEditableObjectType(type);
  return ENTITY_PRESETS.find((preset) => preset.type === normalizedType) || null;
}

function normalizeEntityPresetIdForCompare(value) {
  return String(value || "").trim().toLowerCase();
}

export function isEntityPresetIdTaken(presetId) {
  const normalized = normalizeEntityPresetIdForCompare(presetId);
  return (
    normalized.length > 0 &&
    ENTITY_PRESETS.some((preset) => normalizeEntityPresetIdForCompare(preset?.id) === normalized)
  );
}

export function registerEntityPresetOption(entry = {}) {
  const presetId = String(entry?.presetId || entry?.id || "").trim();
  if (!presetId) return { ok: false, reason: "missing-preset-id" };
  if (isEntityPresetIdTaken(presetId)) {
    return { ok: false, reason: "duplicate-preset-id" };
  }

  const entityType = normalizeEditableObjectType(entry?.type || "");
  if (!entityType) return { ok: false, reason: "missing-entity-type" };

  const normalizedPreset = {
    id: presetId,
    type: entityType,
    defaultName: String(entry?.defaultName || entry?.label || presetId).trim() || presetId,
    defaultParams: cloneEntityParams(entry?.defaultParams || {}),
    img: typeof entry?.img === "string" && entry.img.trim() ? entry.img.trim() : null,
    drawW: Math.max(1, Number.parseInt(entry?.drawW, 10) || 24),
    drawH: Math.max(1, Number.parseInt(entry?.drawH, 10) || 24),
    footprintW: Math.max(1, Number.parseInt(entry?.footprintW, 10) || Number.parseInt(entry?.drawW, 10) || 24),
    footprintH: Math.max(1, Number.parseInt(entry?.footprintH, 10) || Number.parseInt(entry?.drawH, 10) || 24),
    drawAnchor: String(entry?.drawAnchor || "BL").trim().toUpperCase() === "TL" ? "TL" : "BL",
    hitRadius: Number.isFinite(Number(entry?.hitRadius)) ? Number(entry.hitRadius) : 8.5,
  };

  ENTITY_PRESET_BY_ID.set(normalizedPreset.id, normalizedPreset);
  ENTITY_PRESETS.push(normalizedPreset);
  return { ok: true, preset: normalizedPreset };
}

export function getEntityPresetForType(type) {
  return findEntityPresetByType(type) || findEntityPresetById(type) || null;
}

export function getEntityPresetDefaultParams(presetId) {
  const preset = findEntityPresetById(presetId);
  return cloneEntityParams(preset?.defaultParams || {});
}

export function getEntityPresetParamsForType(type, params = {}) {
  const preset = getEntityPresetForType(type);
  const normalizedParams = remapLegacyEntityParams(type, params);
  return mergeEntityParams(cloneEntityParams(preset?.defaultParams || {}), normalizedParams);
}
