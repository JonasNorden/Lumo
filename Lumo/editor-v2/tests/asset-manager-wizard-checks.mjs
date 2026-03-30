import assert from "node:assert/strict";

import {
  ASSET_WIZARD_MODES,
  ASSET_WIZARD_TYPES,
  createInitialAssetManagerWizardState,
  getAssetWizardDraftWithDefaults,
  getEntitySafeParamSchema,
  getBehaviorProfileIdForTileBehavior,
  getCanonicalTileIdForBehavior,
  getStepValidation,
  suggestEntityPresetId,
  getTileBehaviorAuditGroups,
  getTileBehaviorOptions,
  isStepComplete,
  suggestDecorPresetId,
  suggestBackgroundMaterialId,
  suggestTileCatalogId,
} from "../src/domain/assets/assetManagerWizardModel.js";
import { isBackgroundMaterialIdTaken, registerBackgroundMaterialOption } from "../src/domain/background/materialCatalog.js";
import { findDecorPresetById, isDecorPresetIdTaken, registerDecorPresetOption } from "../src/domain/decor/decorPresets.js";
import {
  findBrushSpriteOptionByValue,
  getTileAssetByTileValue,
  isTileCatalogIdTaken,
  registerTileSpriteOption,
} from "../src/domain/tiles/tileSpriteCatalog.js";
import {
  buildPersistedDecorEntry,
  buildPersistedEntityPresetEntry,
  buildPersistedTileEntry,
  computeNextCustomTileId,
  isPhase1EntityFamilySupported,
} from "../dev/localTileSaveBridge.js";
import { ENTITY_PRESETS, isEntityPresetIdTaken, registerEntityPresetOption } from "../src/domain/entities/entityPresets.js";

const wizard = createInitialAssetManagerWizardState();
assert.equal(wizard.stepId, "mode");
assert.equal(isStepComplete("mode", wizard), false);

wizard.mode = ASSET_WIZARD_MODES.CREATE;
assert.equal(isStepComplete("mode", wizard), true);
assert.equal(isStepComplete("type", wizard), false);

wizard.assetType = ASSET_WIZARD_TYPES.TILE;
const behaviorOptions = getTileBehaviorOptions();
const knownBehavior = behaviorOptions[0]?.value || "solid";
const knownTileId = String(getCanonicalTileIdForBehavior(knownBehavior) || 15);
wizard.draft = {
  catalogId: "stone-floor",
  displayName: "Stone Floor",
  tileBehavior: knownBehavior,
  tileNumericId: knownTileId,
  spritePath: "assets/tiles/stone_floor.png",
};
assert.equal(isStepComplete("identity", wizard), true);
assert.equal(getStepValidation("identity", wizard).isValid, true);

assert.ok(behaviorOptions.length >= 5);

wizard.draft.tileBehavior = "hazard";
const syncedHazardDraft = getAssetWizardDraftWithDefaults(ASSET_WIZARD_TYPES.TILE, wizard.draft);
assert.equal(syncedHazardDraft.tileNumericId, "3");
assert.equal(syncedHazardDraft.collisionType, "hazard");
wizard.draft = { ...syncedHazardDraft, tileBehavior: knownBehavior, tileNumericId: knownTileId, collisionType: "solid" };

wizard.draft.collisionType = "solid";
wizard.draft.drawAnchor = "BL";
wizard.draft.drawWidth = "16";
wizard.draft.drawHeight = "16";
wizard.draft.footprint = "{\"w\":1,\"h\":1}";
assert.equal(isStepComplete("metadata", wizard), true);

wizard.assetType = ASSET_WIZARD_TYPES.DECOR;
wizard.mode = ASSET_WIZARD_MODES.CREATE;
wizard.draft = {
  presetId: "custom_banner",
  displayName: "Custom Banner",
  spritePath: "assets/sprites/decor/custom_banner.png",
  drawAnchor: "TL",
  drawWidth: "48",
  drawHeight: "96",
  footprint: "{\"w\":2,\"h\":4}",
};
assert.equal(isStepComplete("identity", wizard), true);
assert.equal(isStepComplete("metadata", wizard), true);

const behaviorAuditGroups = getTileBehaviorAuditGroups();
const solidGroup = behaviorAuditGroups.find((entry) => entry.behaviorId === "solid");
assert.ok(solidGroup);
assert.ok(Array.isArray(solidGroup.exposedTileIds));
assert.ok(solidGroup.exposedTileIds.length > 0);

wizard.mode = ASSET_WIZARD_MODES.EDIT;
wizard.selectedExistingAssetId = "";
assert.equal(isStepComplete("identity", wizard), false);
assert.equal(getStepValidation("identity", wizard).fieldErrors.selectedExistingAssetId, "Pick an existing asset before continuing.");
wizard.selectedExistingAssetId = "tile_stone_01";
assert.equal(isStepComplete("identity", wizard), true);

wizard.assetType = ASSET_WIZARD_TYPES.BACKGROUND;
wizard.mode = ASSET_WIZARD_MODES.CREATE;
wizard.draft = {
  materialId: "bg_stone",
  displayName: "Stone",
  spritePath: "assets/sprites/bg/stone.png",
  drawAnchor: "BL",
  drawWidth: "16",
  drawHeight: "16",
  fallbackColor: "#334455",
};
assert.equal(isStepComplete("identity", wizard), true);
assert.equal(isStepComplete("metadata", wizard), true);

wizard.draft.spritePath = "";
const backgroundIdentityValidation = getStepValidation("identity", wizard);
assert.equal(backgroundIdentityValidation.isValid, false);
assert.equal(backgroundIdentityValidation.fieldErrors.spritePath, "Select a sprite file.");

const tileDefaults = getAssetWizardDraftWithDefaults(ASSET_WIZARD_TYPES.TILE, {});
assert.equal(tileDefaults.drawWidth, "24");
assert.equal(tileDefaults.drawHeight, "24");
assert.equal(tileDefaults.tileBehavior, "solid");
assert.equal(tileDefaults.tileNumericId, "15");
assert.equal(getBehaviorProfileIdForTileBehavior("solid"), "tile.solid.default");
assert.equal(getBehaviorProfileIdForTileBehavior("one-way"), "tile.one-way.default");

const suggestedId = suggestTileCatalogId({ displayName: "Crystal Brick" });
assert.equal(suggestedId, "crystal-brick");
assert.equal(isTileCatalogIdTaken(suggestedId), false);

const registration = registerTileSpriteOption({
  catalogId: suggestedId,
  label: "Crystal Brick",
  tileId: 99,
  img: "selected://crystal.png",
  drawW: 24,
  drawH: 24,
  drawAnchor: "TL",
  footprint: { w: 1, h: 1 },
  collisionType: "solid",
});
assert.equal(registration.ok, true);
assert.equal(isTileCatalogIdTaken(suggestedId), true);
assert.equal(computeNextCustomTileId([{ tileId: 15 }, { tileId: 16 }, { tileId: 27 }]), 28);
const existingTileEntries = [
  { id: "stone_ct", tileId: 15, behaviorProfileId: "tile.solid.default" },
  { id: "ice_01", tileId: 16, behaviorProfileId: "tile.solid.ice" },
];
const existingTileSnapshot = JSON.stringify(existingTileEntries);
const persistedTileEntry = buildPersistedTileEntry({
  tile: {
    label: "Wizard Tile",
    tileId: 15,
    tileNumericId: 15,
    tileBehavior: "solid",
    behaviorProfileId: "tile.solid.default",
    collisionType: "solid",
    drawW: 24,
    drawH: 24,
    drawAnchor: "TL",
    footprint: { w: 1, h: 1 },
    group: "Custom",
  },
  existingEntries: existingTileEntries,
  catalogId: "wizard-tile",
  spriteFileName: "wizard-tile.png",
});
assert.equal(persistedTileEntry.tileId, 17);
assert.ok(!existingTileEntries.some((entry) => entry.tileId === persistedTileEntry.tileId));
assert.equal(JSON.stringify(existingTileEntries), existingTileSnapshot);
const nextEntries = [...existingTileEntries, persistedTileEntry];
assert.equal(nextEntries.length, existingTileEntries.length + 1);
assert.ok(nextEntries.some((entry) => entry.id === "stone_ct"));
assert.ok(nextEntries.some((entry) => entry.id === "wizard-tile"));
assert.equal(findBrushSpriteOptionByValue("stone_ct")?.tileId, 15);
assert.equal(findBrushSpriteOptionByValue(suggestedId)?.tileId, 99);
assert.equal(getTileAssetByTileValue(15)?.id, "stone_ct");
assert.equal(getTileAssetByTileValue(99)?.id, suggestedId);

const duplicateValidation = getStepValidation("identity", {
  mode: ASSET_WIZARD_MODES.CREATE,
  assetType: ASSET_WIZARD_TYPES.TILE,
  draft: {
    catalogId: suggestedId,
    displayName: "Another Crystal",
    tileBehavior: knownBehavior,
    tileNumericId: knownTileId,
    spritePath: "selected://another.png",
  },
});
assert.equal(duplicateValidation.isValid, false);
assert.equal(duplicateValidation.fieldErrors.catalogId, "Catalog id already exists. Choose a different id.");

const suggestedMaterialId = suggestBackgroundMaterialId({ displayName: "Crystal Wall" });
assert.equal(suggestedMaterialId, "bg_crystal_wall");
assert.equal(isBackgroundMaterialIdTaken(suggestedMaterialId), false);

const backgroundRegistration = registerBackgroundMaterialOption({
  materialId: suggestedMaterialId,
  label: "Crystal Wall",
  img: "selected://bg-crystal.png",
  drawW: 24,
  drawH: 24,
  footprint: { w: 1, h: 1 },
  fallbackColor: "#3d4b63",
  group: "Custom",
});
assert.equal(backgroundRegistration.ok, true);
assert.equal(isBackgroundMaterialIdTaken(suggestedMaterialId), true);
assert.equal(
  suggestBackgroundMaterialId({ displayName: "Crystal Wall", currentMaterialId: suggestedMaterialId }),
  suggestedMaterialId,
);
assert.equal(
  suggestBackgroundMaterialId({ displayName: "Crystal Wall" }),
  "bg_crystal_wall_2",
);

const suggestedDecorPresetId = suggestDecorPresetId({ displayName: "Crystal Banner" });
assert.equal(suggestedDecorPresetId, "crystal_banner");
assert.equal(isDecorPresetIdTaken(suggestedDecorPresetId), false);

const builtinFlowerPreset = findDecorPresetById("decor_flower_01");
assert.ok(builtinFlowerPreset, "builtin decor preset should exist before registration");
const decorRegistration = registerDecorPresetOption({
  presetId: suggestedDecorPresetId,
  defaultName: "Crystal Banner",
  img: "../data/assets/sprites/decor/crystal_banner.png",
  drawW: 48,
  drawH: 96,
  drawAnchor: "TL",
  footprint: { w: 2, h: 4 },
  group: "Decor",
});
assert.equal(decorRegistration.ok, true);
assert.equal(isDecorPresetIdTaken(suggestedDecorPresetId), true);
assert.equal(findDecorPresetById("decor_flower_01")?.type, builtinFlowerPreset.type, "builtin decor preset should remain intact");
assert.equal(
  suggestDecorPresetId({ displayName: "Crystal Banner" }),
  "crystal_banner_2",
);

const duplicateDecorValidation = getStepValidation("identity", {
  mode: ASSET_WIZARD_MODES.CREATE,
  assetType: ASSET_WIZARD_TYPES.DECOR,
  draft: {
    presetId: suggestedDecorPresetId,
    displayName: "Duplicate Crystal Banner",
    spritePath: "selected://another.png",
  },
});
assert.equal(duplicateDecorValidation.isValid, false);
assert.equal(duplicateDecorValidation.fieldErrors.presetId, "Decor id already exists. Choose a different id.");

const persistedDecorEntry = buildPersistedDecorEntry({
  decor: {
    label: "Bridge Decor",
    drawW: 32,
    drawH: 64,
    drawAnchor: "TL",
    group: "Decor",
  },
  presetId: "bridge_decor",
  spriteFileName: "bridge_decor.png",
});
assert.equal(persistedDecorEntry.id, "bridge_decor");
assert.equal(persistedDecorEntry.category, "decor");
assert.equal(persistedDecorEntry.img, "data/assets/sprites/decor/bridge_decor.png");
assert.equal(persistedDecorEntry.anchor, "TL");

const suggestedEntityPresetId = suggestEntityPresetId({ displayName: "Blue Lantern" });
assert.equal(suggestedEntityPresetId, "blue_lantern");
assert.equal(isEntityPresetIdTaken(suggestedEntityPresetId), false);

const entityIdentityValidation = getStepValidation("identity", {
  mode: ASSET_WIZARD_MODES.CREATE,
  assetType: ASSET_WIZARD_TYPES.ENTITY,
  draft: {
    behaviorFamilyId: "lantern_01",
    presetId: suggestedEntityPresetId,
    displayName: "Blue Lantern",
    spritePath: "selected://blue_lantern.png",
  },
});
assert.equal(entityIdentityValidation.isValid, true);

const excludedEntityFamilyValidation = getStepValidation("identity", {
  mode: ASSET_WIZARD_MODES.CREATE,
  assetType: ASSET_WIZARD_TYPES.ENTITY,
  draft: {
    behaviorFamilyId: "player-spawn",
    presetId: "bad_spawn_variant",
    displayName: "Bad Spawn",
    spritePath: "selected://bad.png",
  },
});
assert.equal(excludedEntityFamilyValidation.isValid, false);
assert.equal(excludedEntityFamilyValidation.fieldErrors.behaviorFamilyId, "This family is not available in Phase 1.");

const entityMetadataValidation = getStepValidation("metadata", {
  mode: ASSET_WIZARD_MODES.CREATE,
  assetType: ASSET_WIZARD_TYPES.ENTITY,
  draft: {
    behaviorFamilyId: "lantern_01",
    drawAnchor: "BL",
    drawWidth: "24",
    drawHeight: "24",
    safeDefaults: { radius: "180", strength: "0.9", unsupported: "123" },
  },
});
assert.equal(entityMetadataValidation.isValid, true);

const lanternSchema = getEntitySafeParamSchema("lantern_01");
assert.deepEqual(lanternSchema.map((field) => field.key), ["radius", "strength"]);

const registrationCountBefore = ENTITY_PRESETS.length;
const entityRegistration = registerEntityPresetOption({
  presetId: suggestedEntityPresetId,
  type: "lantern_01",
  defaultName: "Blue Lantern",
  defaultParams: { radius: 180, strength: 0.9 },
  img: "../data/assets/sprites/entities/blue_lantern.png",
  drawW: 24,
  drawH: 24,
  drawAnchor: "BL",
});
assert.equal(entityRegistration.ok, true);
assert.equal(ENTITY_PRESETS.length, registrationCountBefore + 1);
assert.equal(isEntityPresetIdTaken(suggestedEntityPresetId), true);
assert.equal(entityRegistration.preset.type, "lantern_01");
assert.equal(entityRegistration.preset.defaultParams.radius, 180);

const entityDuplicateValidation = getStepValidation("identity", {
  mode: ASSET_WIZARD_MODES.CREATE,
  assetType: ASSET_WIZARD_TYPES.ENTITY,
  draft: {
    behaviorFamilyId: "lantern_01",
    presetId: suggestedEntityPresetId,
    displayName: "Duplicate Blue Lantern",
    spritePath: "selected://duplicate.png",
  },
});
assert.equal(entityDuplicateValidation.isValid, false);
assert.equal(entityDuplicateValidation.fieldErrors.presetId, "Preset id already exists. Choose a different id.");

assert.equal(isPhase1EntityFamilySupported("lantern_01"), true);
assert.equal(isPhase1EntityFamilySupported("player-spawn"), false);

const persistedEntityEntry = buildPersistedEntityPresetEntry({
  presetId: "lantern_blue_runtime",
  spriteFileName: "lantern_blue_runtime.png",
  entity: {
    type: "lantern_01",
    label: "Lantern Blue Runtime",
    drawW: 24,
    drawH: 24,
    defaultParams: {
      radius: 190,
      strength: 0.8,
      unsupportedParam: 999,
    },
  },
});
assert.equal(persistedEntityEntry.type, "lantern_01");
assert.equal(persistedEntityEntry.defaultParams.radius, 190);
assert.equal("unsupportedParam" in persistedEntityEntry.defaultParams, false);

console.log("asset-manager wizard checks passed");
