import { BRUSH_SPRITE_OPTIONS } from "../tiles/tileSpriteCatalog.js";
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

function isPositiveNumber(value) {
  const numeric = Number.parseFloat(value);
  return Number.isFinite(numeric) && numeric > 0;
}

function isInteger(value) {
  const numeric = Number.parseInt(value, 10);
  return Number.isInteger(numeric);
}

function isHexColor(value) {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(normalizeString(value));
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
  const mode = wizardState?.mode;
  const assetType = wizardState?.assetType;
  const draft = wizardState?.draft || {};

  if (stepId === "mode") {
    return mode === ASSET_WIZARD_MODES.CREATE || mode === ASSET_WIZARD_MODES.EDIT;
  }
  if (stepId === "type") {
    return Boolean(assetType);
  }
  if (stepId === "identity") {
    if (!assetType) return false;
    if (mode === ASSET_WIZARD_MODES.EDIT) {
      return normalizeString(wizardState?.selectedExistingAssetId).length > 0;
    }
    if (assetType === ASSET_WIZARD_TYPES.TILE) {
      return Boolean(normalizeString(draft.catalogId) && normalizeString(draft.displayName) && isInteger(draft.tileNumericId) && normalizeString(draft.spritePath));
    }
    if (assetType === ASSET_WIZARD_TYPES.BACKGROUND) {
      return Boolean(normalizeString(draft.materialId) && normalizeString(draft.displayName) && normalizeString(draft.spritePath));
    }
    return false;
  }
  if (stepId === "metadata") {
    if (assetType === ASSET_WIZARD_TYPES.TILE) {
      return Boolean(normalizeString(draft.collisionType) && normalizeString(draft.drawAnchor) && isPositiveNumber(draft.drawWidth) && isPositiveNumber(draft.drawHeight));
    }
    if (assetType === ASSET_WIZARD_TYPES.BACKGROUND) {
      return Boolean(normalizeString(draft.drawAnchor) && isPositiveNumber(draft.drawWidth) && isPositiveNumber(draft.drawHeight) && isHexColor(draft.fallbackColor));
    }
    return true;
  }
  if (stepId === "review" || stepId === "save") return true;
  return false;
}

export function getFirstIncompleteStep(wizardState) {
  return ASSET_WIZARD_STEP_ORDER.find((stepId) => !isStepComplete(stepId, wizardState)) || "save";
}
