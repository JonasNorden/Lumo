import assert from "node:assert/strict";

import {
  getSoundAssetCatalog,
  getSoundAssetOptionsForType,
  findSoundAssetByPath,
} from "../src/domain/sound/audioAssetCatalog.js";

const SOUND_TYPES = ["musicZone", "ambientZone", "spot", "trigger"];

function runPerTypeFilteringChecks() {
  const catalog = getSoundAssetCatalog();

  for (const soundType of SOUND_TYPES) {
    const options = getSoundAssetOptionsForType(soundType);
    assert.ok(options.length > 0, `${soundType} should have at least one option`);

    for (const option of options) {
      assert.equal(
        option.allowedUsages.includes(soundType),
        true,
        `${soundType} options should include only assets explicitly allowed for ${soundType}`,
      );
    }

    const disallowed = catalog.filter((entry) => !entry.allowedUsages.includes(soundType));
    for (const entry of disallowed) {
      assert.equal(
        options.some((option) => option.value === entry.value),
        false,
        `${soundType} should not include disallowed asset ${entry.value}`,
      );
    }
  }
}

function runFolderDefaultChecks() {
  const triggerEventAsset = findSoundAssetByPath("data/assets/audio/events/creatures/alien_presence.ogg");
  assert.deepEqual(triggerEventAsset?.allowedUsages, ["trigger"], "events assets should default to trigger usage");

  const triggerSfxAsset = findSoundAssetByPath("data/assets/audio/sfx/hit/slap_01.wav");
  assert.deepEqual(triggerSfxAsset?.allowedUsages, ["trigger"], "sfx assets should default to trigger usage");

  const spotAsset = findSoundAssetByPath("data/assets/audio/spot/wind/wind.wav");
  assert.deepEqual(spotAsset?.allowedUsages, ["spot"], "spot assets should default to spot usage");

  const ambientAsset = findSoundAssetByPath("data/assets/audio/ambient/rain/rain.wav");
  assert.deepEqual(ambientAsset?.allowedUsages, ["ambientZone"], "ambient assets should default to ambientZone usage");

  const musicAsset = findSoundAssetByPath("data/assets/audio/music/game_play_1.ogg");
  assert.deepEqual(musicAsset?.allowedUsages, ["musicZone"], "music assets should default to musicZone usage");
}

function runExplicitOverrideChecks() {
  const overrideAsset = findSoundAssetByPath("data/assets/audio/music/space_loop_short.wav");
  assert.deepEqual(
    overrideAsset?.allowedUsages,
    ["musicZone", "ambientZone"],
    "space_loop_short.wav should explicitly allow musicZone and ambientZone",
  );

  const ambientOptions = getSoundAssetOptionsForType("ambientZone");
  assert.equal(
    ambientOptions.some((entry) => entry.value === "data/assets/audio/music/space_loop_short.wav"),
    true,
    "ambientZone options should include explicitly overridden music asset",
  );
}

runPerTypeFilteringChecks();
runFolderDefaultChecks();
runExplicitOverrideChecks();

console.log("audio asset catalog checks passed");
