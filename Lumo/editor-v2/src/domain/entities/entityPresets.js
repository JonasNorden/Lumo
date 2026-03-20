import { cloneEntityParams } from "./entityParams.js";

export const ENTITY_PRESETS = [
  {
    id: "player-spawn",
    type: "player-spawn",
    defaultName: "Player Spawn",
    defaultParams: {},
    img: "../data/assets/sprites/lumo/lumo_idle_1.png",
    drawW: 24,
    drawH: 24,
    drawAnchor: "BL",
  },
  {
    id: "lantern",
    type: "lantern",
    defaultName: "Lantern",
    defaultParams: {
      lightRadius: 170,
      flicker: true,
    },
    img: "../data/assets/sprites/lights/lantern_01.png",
    drawW: 24,
    drawH: 24,
    drawAnchor: "BL",
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
    drawAnchor: "BL",
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
    drawAnchor: "BL",
  },
  {
    id: "generic",
    type: "generic",
    defaultName: "Generic",
    defaultParams: {},
    img: "../data/assets/sprites/pickups/flare_pickup_01.png",
    drawW: 24,
    drawH: 24,
    drawAnchor: "BL",
  },
];

export const DEFAULT_ENTITY_PRESET_ID = "generic";

export function findEntityPresetById(presetId) {
  return ENTITY_PRESETS.find((preset) => preset.id === presetId) || null;
}

export function findEntityPresetByType(type) {
  return ENTITY_PRESETS.find((preset) => preset.type === type) || null;
}

export function getEntityPresetDefaultParams(presetId) {
  const preset = findEntityPresetById(presetId);
  return cloneEntityParams(preset?.defaultParams || {});
}
