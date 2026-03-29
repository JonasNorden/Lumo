import { BRUSH_SPRITE_OPTIONS, isTileCatalogIdTaken } from "../tiles/tileSpriteCatalog.js";
import { BACKGROUND_MATERIAL_OPTIONS } from "../background/materialCatalog.js";
import { DECOR_PRESETS } from "../decor/decorPresets.js";
import { ENTITY_PRESETS } from "../entities/entityPresets.js";

export const ASSET_WIZARD_MODES = {
  CREATE: "create",
  EDIT: "edit",
};

export const ASSET_WIZARD_TYPES = {
  TILE: "tiles",
  BACKGROUND: "background",
  DECOR: "decor",
  ENTITY: "entities",
};

export const ASSET_WIZARD_STEP_ORDER = ["mode", "type", "identity", "metadata", "review", "save"];

export const ASSET_WIZARD_TYPE_OPTIONS = [
  { id: ASSET_WIZARD_TYPES.TILE, label: "Tile" },
  { id: ASSET_WIZARD_TYPES.BACKGROUND, label: "Background" },
  { id: ASSET_WIZARD_TYPES.DECOR, label: "Decor" },
  { id: ASSET_WIZARD_TYPES.ENTITY, label: "Entity" },
];

const TILE_BEHAVIOR_DEFINITIONS = [
  {
    id: "solid",
    label: "Solid",
    tileId: 15,
    collisionType: "solid",
    helpText: "Standard blocking ground/wall tile.",
  },
  {
    id: "ice",
    label: "Ice",
    tileId: 4,
    collisionType: "solid",
    helpText: "Slippery solid surface with low friction.",
  },
  {
    id: "one-way",
    label: "One-way Platform",
    tileId: 2,
    collisionType: "oneWay",
    helpText: "Pass upward through it, land on top.",
  },
  {
    id: "hazard",
    label: "Hazard",
    tileId: 3,
    collisionType: "hazard",
    helpText: "Damaging surface; does not block movement.",
  },
  {
    id: "brake",
    label: "Brake",
    tileId: 5,
    collisionType: "solid",
    helpText: "Very high-friction solid surface that slows movement.",
  },
];

const TILE_BEHAVIOR_BY_ID = new Map(TILE_BEHAVIOR_DEFINITIONS.map((item) => [item.id, item]));

const TILE_ID_TO_BEHAVIOR_ID = new Map([
  [1, "solid"],
  [2, "one-way"],
  [3, "hazard"],
  [4, "ice"],
  [5, "brake"],
  [6, "solid"],
  [7, "solid"],
  [8, "solid"],
  [9, "solid"],
  [10, "solid"],
  [11, "solid"],
  [12, "solid"],
  [13, "solid"],
  [14, "solid"],
  [15, "solid"],
  [16, "ice"],
]);

function getBehaviorIdForTileId(tileId) {
  const numericTileId = Number.parseInt(tileId, 10);
  if (!Number.isInteger(numericTileId)) return "solid";
  return TILE_ID_TO_BEHAVIOR_ID.get(numericTileId) || "solid";
}

export function getTileBehaviorAuditGroups() {
  const idsByBehavior = new Map(TILE_BEHAVIOR_DEFINITIONS.map((item) => [item.id, new Set()]));
  for (const option of BRUSH_SPRITE_OPTIONS) {
    if (!Number.isInteger(option?.tileId)) continue;
    const behaviorId = getBehaviorIdForTileId(option.tileId);
    idsByBehavior.get(behaviorId)?.add(option.tileId);
  }

  return TILE_BEHAVIOR_DEFINITIONS.map((behavior) => {
    const available = Array.from(idsByBehavior.get(behavior.id) || []).sort((a, b) => a - b);
    return {
      behaviorId: behavior.id,
      label: behavior.label,
      canonicalTileId: behavior.tileId,
      exposedTileIds: available,
      includesCanonicalId: available.includes(behavior.tileId),
    };
  });
}

export function getTileBehaviorOptions() {
  return TILE_BEHAVIOR_DEFINITIONS.map((behavior) => ({
    value: behavior.id,
    label: `${behavior.label} · tileId ${behavior.tileId}`,
    helpText: behavior.helpText,
  }));
}

export function getTileBehaviorById(behaviorId) {
  const normalized = normalizeString(behaviorId);
  return TILE_BEHAVIOR_BY_ID.get(normalized) || null;
}

export function getCanonicalTileIdForBehavior(behaviorId) {
  return getTileBehaviorById(behaviorId)?.tileId ?? null;
}

export function getTileBehaviorForTileId(tileId) {
  return getTileBehaviorById(getBehaviorIdForTileId(tileId));
}

export function syncTileBehaviorDraftFields(draft = {}) {
  const nextDraft = { ...(draft || {}) };
  const behaviorFromField = getTileBehaviorById(nextDraft.tileBehavior);
  const behaviorFromTileId = getTileBehaviorForTileId(nextDraft.tileNumericId);
  const resolvedBehavior = behaviorFromField || behaviorFromTileId || TILE_BEHAVIOR_DEFINITIONS[0];
  if (!resolvedBehavior) return nextDraft;

  nextDraft.tileBehavior = resolvedBehavior.id;
  nextDraft.tileNumericId = String(resolvedBehavior.tileId);
  nextDraft.collisionType = resolvedBehavior.collisionType;
  return nextDraft;
}

export function getTileNumericIdOptions() {
  return BRUSH_SPRITE_OPTIONS
    .filter((item) => Number.isInteger(item?.tileId))
    .map((item) => ({
      value: String(item.tileId),
      label: `${item.label || item.value || `Tile ${item.tileId}`} · tileId ${item.tileId}`,
    }))
    .sort((a, b) => Number.parseInt(a.value, 10) - Number.parseInt(b.value, 10));
}

export function isKnownTileNumericId(value) {
  const normalized = normalizeString(value);
  if (!isInteger(normalized)) return false;
  const knownIds = new Set(TILE_BEHAVIOR_DEFINITIONS.map((behavior) => String(behavior.tileId)));
  return knownIds.has(normalized);
}

export function createInitialAssetManagerWizardState() {
  return {
    mode: null,
    assetType: null,
    stepId: "mode",
    selectedExistingAssetId: "",
    draft: {},
  };
}

export function getStepsForWizard() {
  return ASSET_WIZARD_STEP_ORDER.slice();
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function toPositiveNumberOrNull(value) {
  const numeric = Number.parseFloat(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function isPositiveNumber(value) {
  return toPositiveNumberOrNull(value) !== null;
}

function isInteger(value) {
  const numeric = Number.parseInt(value, 10);
  return Number.isInteger(numeric);
}

function isHexColor(value) {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(normalizeString(value));
}

function isValidFootprint(value) {
  const normalized = normalizeString(value);
  if (!normalized) return false;
  try {
    const parsed = JSON.parse(normalized);
    return isPositiveNumber(parsed?.w) && isPositiveNumber(parsed?.h);
  } catch {
    return false;
  }
}

function normalizeDrawSizeValue(value) {
  const resolved = toPositiveNumberOrNull(value);
  return resolved === null ? "24" : String(Math.round(resolved));
}

function toSlugToken(value) {
  return normalizeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function suggestTileCatalogId({ displayName = "", spriteFileName = "", currentCatalogId = "" } = {}) {
  const current = toSlugToken(currentCatalogId);
  const fromDisplayName = toSlugToken(displayName);
  const fromSprite = toSlugToken(spriteFileName.replace(/\.[a-z0-9]+$/i, ""));
  const base = fromDisplayName || fromSprite || current || "tile";
  let candidate = base;
  let suffix = 2;
  while (isTileCatalogIdTaken(candidate) && candidate !== current) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

export function getAssetWizardDraftWithDefaults(assetType, draft = {}) {
  const baseDraft = { ...(draft || {}) };
  if (assetType === ASSET_WIZARD_TYPES.TILE) {
    return syncTileBehaviorDraftFields({
      ...baseDraft,
      collisionType: normalizeString(baseDraft.collisionType) || "solid",
      drawAnchor: normalizeString(baseDraft.drawAnchor) || "BL",
      drawWidth: normalizeDrawSizeValue(baseDraft.drawWidth),
      drawHeight: normalizeDrawSizeValue(baseDraft.drawHeight),
      footprint: normalizeString(baseDraft.footprint) || '{"w":1,"h":1}',
    });
  }
  if (assetType === ASSET_WIZARD_TYPES.BACKGROUND) {
    return {
      ...baseDraft,
      drawAnchor: normalizeString(baseDraft.drawAnchor) || "BL",
      drawWidth: normalizeDrawSizeValue(baseDraft.drawWidth),
      drawHeight: normalizeDrawSizeValue(baseDraft.drawHeight),
      fallbackColor: normalizeString(baseDraft.fallbackColor) || "#3d4b63",
      footprint: normalizeString(baseDraft.footprint) || '{"w":1,"h":1}',
    };
  }
  return baseDraft;
}

export function getStepValidation(stepId, wizardState) {
  const mode = wizardState?.mode;
  const assetType = wizardState?.assetType;
  const draft = getAssetWizardDraftWithDefaults(assetType, wizardState?.draft || {});
  const fieldErrors = {};

  if (stepId === "mode") {
    if (!(mode === ASSET_WIZARD_MODES.CREATE || mode === ASSET_WIZARD_MODES.EDIT)) {
      return {
        isValid: false,
        fieldErrors,
        blockingReason: "Choose Create New Asset or Edit Existing Asset to continue.",
      };
    }
    return { isValid: true, fieldErrors, blockingReason: "" };
  }

  if (stepId === "type") {
    if (!assetType) {
      return {
        isValid: false,
        fieldErrors,
        blockingReason: "Choose an asset type to continue.",
      };
    }
    return { isValid: true, fieldErrors, blockingReason: "" };
  }

  if (stepId === "identity") {
    if (!assetType) {
      return { isValid: false, fieldErrors, blockingReason: "Choose an asset type first." };
    }
    if (mode === ASSET_WIZARD_MODES.EDIT) {
      if (!normalizeString(wizardState?.selectedExistingAssetId)) {
        return {
          isValid: false,
          fieldErrors: { selectedExistingAssetId: "Pick an existing asset before continuing." },
          blockingReason: "Pick an existing asset before continuing.",
        };
      }
      return { isValid: true, fieldErrors, blockingReason: "" };
    }
    if (assetType === ASSET_WIZARD_TYPES.TILE) {
      if (!normalizeString(draft.catalogId)) fieldErrors.catalogId = "Catalog id is required.";
      else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalizeString(draft.catalogId))) fieldErrors.catalogId = "Catalog id must be lowercase letters, numbers, and hyphens only.";
      else if (isTileCatalogIdTaken(draft.catalogId)) fieldErrors.catalogId = "Catalog id already exists. Choose a different id.";
      if (!normalizeString(draft.displayName)) fieldErrors.displayName = "Display name is required.";
      if (!getTileBehaviorById(draft.tileBehavior)) fieldErrors.tileBehavior = "Choose a tile behavior from supported runtime behaviors.";
      if (!isKnownTileNumericId(draft.tileNumericId)) fieldErrors.tileNumericId = "Selected behavior must map to a known runtime tile id.";
      if (!normalizeString(draft.spritePath)) fieldErrors.spritePath = "Select a sprite file.";
      const isValid = Object.keys(fieldErrors).length === 0;
      return { isValid, fieldErrors, blockingReason: isValid ? "" : "Complete required identity fields to continue." };
    }
    if (assetType === ASSET_WIZARD_TYPES.BACKGROUND) {
      if (!normalizeString(draft.materialId)) fieldErrors.materialId = "Material id is required.";
      if (!normalizeString(draft.displayName)) fieldErrors.displayName = "Display name is required.";
      if (!normalizeString(draft.spritePath)) fieldErrors.spritePath = "Select a sprite file.";
      const isValid = Object.keys(fieldErrors).length === 0;
      return { isValid, fieldErrors, blockingReason: isValid ? "" : "Complete required identity fields to continue." };
    }
    return { isValid: false, fieldErrors, blockingReason: "This flow is not fully implemented yet." };
  }

  if (stepId === "metadata") {
    if (assetType === ASSET_WIZARD_TYPES.TILE) {
      if (!normalizeString(draft.collisionType)) fieldErrors.collisionType = "Collision/behavior type is required.";
      if (!normalizeString(draft.drawAnchor)) fieldErrors.drawAnchor = "Draw anchor is required.";
      if (!isPositiveNumber(draft.drawWidth)) fieldErrors.drawWidth = "Draw width must be a positive number.";
      if (!isPositiveNumber(draft.drawHeight)) fieldErrors.drawHeight = "Draw height must be a positive number.";
      if (!isValidFootprint(draft.footprint)) fieldErrors.footprint = 'Footprint must be JSON with positive w/h, e.g. {"w":1,"h":1}.';
      const isValid = Object.keys(fieldErrors).length === 0;
      return { isValid, fieldErrors, blockingReason: isValid ? "" : "Resolve metadata validation issues to continue." };
    }
    if (assetType === ASSET_WIZARD_TYPES.BACKGROUND) {
      if (!normalizeString(draft.drawAnchor)) fieldErrors.drawAnchor = "Draw anchor is required.";
      if (!isPositiveNumber(draft.drawWidth)) fieldErrors.drawWidth = "Draw width must be a positive number.";
      if (!isPositiveNumber(draft.drawHeight)) fieldErrors.drawHeight = "Draw height must be a positive number.";
      if (!isHexColor(draft.fallbackColor)) fieldErrors.fallbackColor = "Fallback color must be a hex value like #3d4b63.";
      const isValid = Object.keys(fieldErrors).length === 0;
      return { isValid, fieldErrors, blockingReason: isValid ? "" : "Resolve metadata validation issues to continue." };
    }
    return { isValid: true, fieldErrors, blockingReason: "" };
  }

  return { isValid: true, fieldErrors, blockingReason: "" };
}

export function getExistingAssetOptions(assetType) {
  if (assetType === ASSET_WIZARD_TYPES.TILE) {
    return BRUSH_SPRITE_OPTIONS.map((item) => ({
      id: item.id,
      label: `${item.label || item.id} · tileId ${item.tileId}`,
    }));
  }
  if (assetType === ASSET_WIZARD_TYPES.BACKGROUND) {
    return BACKGROUND_MATERIAL_OPTIONS.map((item) => ({
      id: item.id,
      label: item.label || item.id,
    }));
  }
  if (assetType === ASSET_WIZARD_TYPES.DECOR) {
    return DECOR_PRESETS.map((item) => ({
      id: item.id,
      label: item.defaultName || item.id,
    }));
  }
  if (assetType === ASSET_WIZARD_TYPES.ENTITY) {
    return ENTITY_PRESETS.map((item) => ({
      id: item.id,
      label: item.defaultName || item.id,
    }));
  }
  return [];
}

export function isStepComplete(stepId, wizardState) {
  if (stepId === "review" || stepId === "save") return true;
  return getStepValidation(stepId, wizardState).isValid;
}

export function getFirstIncompleteStep(wizardState) {
  return ASSET_WIZARD_STEP_ORDER.find((stepId) => !isStepComplete(stepId, wizardState)) || "save";
}
