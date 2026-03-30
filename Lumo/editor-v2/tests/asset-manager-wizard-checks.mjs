import assert from "node:assert/strict";

import {
  ASSET_WIZARD_MODES,
  ASSET_WIZARD_TYPES,
  createInitialAssetManagerWizardState,
  getAssetWizardDraftWithDefaults,
  getBehaviorProfileIdForTileBehavior,
  getCanonicalTileIdForBehavior,
  getStepValidation,
  getTileBehaviorAuditGroups,
  getTileBehaviorOptions,
  isStepComplete,
  suggestBackgroundMaterialId,
  suggestTileCatalogId,
} from "../src/domain/assets/assetManagerWizardModel.js";
import { isBackgroundMaterialIdTaken, registerBackgroundMaterialOption } from "../src/domain/background/materialCatalog.js";
import {
  findBrushSpriteOptionByValue,
  getTileAssetByTileValue,
  isTileCatalogIdTaken,
  registerTileSpriteOption,
} from "../src/domain/tiles/tileSpriteCatalog.js";
import { buildPersistedTileEntry, computeNextCustomTileId } from "../dev/localTileSaveBridge.js";

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

console.log("asset-manager wizard checks passed");
