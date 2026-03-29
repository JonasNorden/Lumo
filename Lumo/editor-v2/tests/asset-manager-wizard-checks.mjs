import assert from "node:assert/strict";

import {
  ASSET_WIZARD_MODES,
  ASSET_WIZARD_TYPES,
  createInitialAssetManagerWizardState,
  getAssetWizardDraftWithDefaults,
  getTileNumericIdOptions,
  suggestTileCatalogId,
  getStepValidation,
  isStepComplete,
} from "../src/domain/assets/assetManagerWizardModel.js";
import { isTileCatalogIdTaken, registerTileSpriteOption } from "../src/domain/tiles/tileSpriteCatalog.js";

const wizard = createInitialAssetManagerWizardState();
assert.equal(wizard.stepId, "mode");
assert.equal(isStepComplete("mode", wizard), false);

wizard.mode = ASSET_WIZARD_MODES.CREATE;
assert.equal(isStepComplete("mode", wizard), true);
assert.equal(isStepComplete("type", wizard), false);

wizard.assetType = ASSET_WIZARD_TYPES.TILE;
const knownTileId = getTileNumericIdOptions()[0]?.value || "15";
wizard.draft = {
  catalogId: "stone-floor",
  displayName: "Stone Floor",
  tileNumericId: knownTileId,
  spritePath: "assets/tiles/stone_floor.png",
};
assert.equal(isStepComplete("identity", wizard), true);
assert.equal(getStepValidation("identity", wizard).isValid, true);

wizard.draft.tileNumericId = "401";
const unknownTileValidation = getStepValidation("identity", wizard);
assert.equal(unknownTileValidation.isValid, false);
assert.equal(unknownTileValidation.fieldErrors.tileNumericId, "Tile numeric id must be selected from known runtime tile ids.");
wizard.draft.tileNumericId = knownTileId;

wizard.draft.collisionType = "solid";
wizard.draft.drawAnchor = "BL";
wizard.draft.drawWidth = "16";
wizard.draft.drawHeight = "16";
wizard.draft.footprint = "{\"w\":1,\"h\":1}";
assert.equal(isStepComplete("metadata", wizard), true);

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

const suggestedId = suggestTileCatalogId({ displayName: "Crystal Brick" });
assert.equal(suggestedId, "crystal-brick");
assert.equal(isTileCatalogIdTaken(suggestedId), false);

const registration = registerTileSpriteOption({
  catalogId: suggestedId,
  label: "Crystal Brick",
  tileId: Number.parseInt(knownTileId, 10),
  img: "selected://crystal.png",
  drawW: 24,
  drawH: 24,
  drawAnchor: "TL",
  footprint: { w: 1, h: 1 },
  collisionType: "solid",
});
assert.equal(registration.ok, true);
assert.equal(isTileCatalogIdTaken(suggestedId), true);

const duplicateValidation = getStepValidation("identity", {
  mode: ASSET_WIZARD_MODES.CREATE,
  assetType: ASSET_WIZARD_TYPES.TILE,
  draft: {
    catalogId: suggestedId,
    displayName: "Another Crystal",
    tileNumericId: knownTileId,
    spritePath: "selected://another.png",
  },
});
assert.equal(duplicateValidation.isValid, false);
assert.equal(duplicateValidation.fieldErrors.catalogId, "Catalog id already exists. Choose a different id.");

console.log("asset-manager wizard checks passed");
