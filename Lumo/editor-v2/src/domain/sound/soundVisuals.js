const SOUND_VISUALS = {
  spot: {
    key: "spot",
    label: "Spot",
    stroke: "#65d6ff",
    fill: "rgba(101, 214, 255, 0.20)",
    accent: "#d7f6ff",
  },
  trigger: {
    key: "trigger",
    label: "Trigger",
    stroke: "#ffb36b",
    fill: "rgba(255, 179, 107, 0.18)",
    accent: "#ffe6c4",
  },
  ambientZone: {
    key: "ambientZone",
    label: "Ambient Zone",
    stroke: "#7ef0c7",
    fill: "rgba(126, 240, 199, 0.16)",
    accent: "#dffff5",
  },
  musicZone: {
    key: "musicZone",
    label: "Music Zone",
    stroke: "#c89dff",
    fill: "rgba(200, 157, 255, 0.16)",
    accent: "#f3e7ff",
  },
  fallback: {
    key: "spot",
    label: "Sound",
    stroke: "#65d6ff",
    fill: "rgba(101, 214, 255, 0.20)",
    accent: "#d7f6ff",
  },
};

const SOUND_TYPE_ALIASES = new Map([
  ["spot", "spot"],
  ["trigger", "trigger"],
  ["ambient", "ambientZone"],
  ["ambientzone", "ambientZone"],
  ["ambient_zone", "ambientZone"],
  ["ambient zone", "ambientZone"],
  ["ambient-zone", "ambientZone"],
  ["music", "musicZone"],
  ["musiczone", "musicZone"],
  ["music_zone", "musicZone"],
  ["music zone", "musicZone"],
  ["music-zone", "musicZone"],
]);

export function normalizeSoundType(type) {
  const input = String(type || "spot").trim();
  return SOUND_TYPE_ALIASES.get(input.toLowerCase()) || input || "spot";
}

export function getSoundVisual(soundType) {
  const normalizedType = normalizeSoundType(soundType);
  return SOUND_VISUALS[normalizedType] || SOUND_VISUALS.fallback;
}
