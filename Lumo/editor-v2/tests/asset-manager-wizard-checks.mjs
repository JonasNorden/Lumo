import assert from "node:assert/strict";

import {
  ASSET_WIZARD_MODES,
  ASSET_WIZARD_TYPES,
  createInitialAssetManagerWizardState,
  isStepComplete,
} from "../src/domain/assets/assetManagerWizardModel.js";

const wizard = createInitialAssetManagerWizardState();
assert.equal(wizard.stepId, "mode");
assert.equal(isStepComplete("mode", wizard), false);

wizard.mode = ASSET_WIZARD_MODES.CREATE;
assert.equal(isStepComplete("mode", wizard), true);
assert.equal(isStepComplete("type", wizard), false);

wizard.assetType = ASSET_WIZARD_TYPES.TILE;
wizard.draft = {
  catalogId: "stone-floor",
  displayName: "Stone Floor",
  tileNumericId: "401",
  spritePath: "assets/tiles/stone_floor.png",
};
assert.equal(isStepComplete("identity", wizard), true);

wizard.draft.collisionType = "solid";
wizard.draft.drawAnchor = "BL";
wizard.draft.drawWidth = "16";
wizard.draft.drawHeight = "16";
assert.equal(isStepComplete("metadata", wizard), true);

wizard.mode = ASSET_WIZARD_MODES.EDIT;
wizard.selectedExistingAssetId = "";
assert.equal(isStepComplete("identity", wizard), false);
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

console.log("asset-manager wizard checks passed");
