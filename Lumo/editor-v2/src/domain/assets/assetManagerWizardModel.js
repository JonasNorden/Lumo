import { BRUSH_SPRITE_OPTIONS } from "../tiles/tileSpriteCatalog.js";
import { BACKGROUND_MATERIAL_OPTIONS } from "../background/materialCatalog.js";
import { DECOR_PRESETS } from "../decor/decorPresets.js";
import { ENTITY_PRESETS } from "../entities/entityPresets.js";
import { GRID_SIZE } from "../../../core/constants.js";

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
  const knownIds = new Set(getTileNumericIdOptions().map((option) => option.value));
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

function normalizeDrawSizeValue(value) {
  const resolved = toPositiveNumberOrNull(value);
  return resolved === null ? String(GRID_SIZE) : String(Math.round(resolved));
}

export function getAssetWizardDraftWithDefaults(assetType, draft = {}) {
  const baseDraft = { ...(draft || {}) };
  if (assetType === ASSET_WIZARD_TYPES.TILE) {
    return {
      ...baseDraft,
      collisionType: normalizeString(baseDraft.collisionType) || "solid",
      drawAnchor: normalizeString(baseDraft.drawAnchor) || "BL",
      drawWidth: normalizeDrawSizeValue(baseDraft.drawWidth),
      drawHeight: normalizeDrawSizeValue(baseDraft.drawHeight),
      footprint: normalizeString(baseDraft.footprint) || '{"w":1,"h":1}',
    };
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
      if (!normalizeString(draft.displayName)) fieldErrors.displayName = "Display name is required.";
      if (!isKnownTileNumericId(draft.tileNumericId)) fieldErrors.tileNumericId = "Tile numeric id must be selected from known runtime tile ids.";
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
