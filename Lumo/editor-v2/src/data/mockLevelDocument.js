import { getTileIndex } from "../domain/level/levelDocument.js";
import { BACKGROUND_MATERIAL_OPTIONS } from "../domain/background/materialCatalog.js";

const width = 40;
const height = 22;
const tileSize = 24;
const base = new Array(width * height).fill(0);

for (let x = 0; x < width; x += 1) {
  base[getTileIndex(width, x, height - 3)] = 12;
  base[getTileIndex(width, x, height - 2)] = 9;
}

for (let x = 8; x < 18; x += 1) {
  base[getTileIndex(width, x, 12)] = 15;
}

for (let y = 7; y < 13; y += 1) {
  base[getTileIndex(width, 23, y)] = 16;
}

for (let x = 26; x < 33; x += 1) {
  base[getTileIndex(width, x, 9)] = 3;
}

const backgroundBase = new Array(width * height).fill(null);
for (let x = 0; x < width; x += 1) {
  backgroundBase[getTileIndex(width, x, height - 1)] = "bg_stone_wall";
  backgroundBase[getTileIndex(width, x, height - 2)] = "bg_stone_wall";
}
for (let x = 12; x < 20; x += 1) {
  backgroundBase[getTileIndex(width, x, height - 4)] = "bg_arch";
}

export const mockLevelDocument = {
  meta: {
    id: "v2-demo-01",
    name: "Lumo Demo Chamber",
    version: "2.0.0",
  },
  dimensions: {
    width,
    height,
    tileSize,
  },
  tiles: {
    base,
    placements: [],
  },
  backgrounds: {
    layers: [
      {
        id: "sky",
        name: "Sky",
        type: "color",
        depth: 0,
        visible: true,
        color: "#19253a",
      },
      {
        id: "mountains",
        name: "Mountains",
        type: "color",
        depth: 0.3,
        visible: true,
        color: "#243047",
      },
      {
        id: "hills",
        name: "Hills",
        type: "color",
        depth: 0.55,
        visible: true,
        color: "#2f3d5d",
      },
    ],
  },
  background: {
    base: backgroundBase,
    placements: [],
    materials: BACKGROUND_MATERIAL_OPTIONS.map((material) => ({ ...material })),
  },
  decor: [
    {
      id: "decor-1",
      name: "Flower",
      type: "decor_flower_01",
      x: 7,
      y: 15,
      visible: true,
      variant: "a",
    },
    {
      id: "decor-3",
      name: "Power-cell",
      type: "powercell_01",
      x: 27,
      y: 8,
      visible: true,
      variant: "a",
    },
  ],
  entities: [
    {
      id: "entity-1",
      name: "Player Spawn",
      type: "player-spawn",
      x: 6,
      y: 14,
      visible: true,
      params: {},
    },
    {
      id: "entity-2",
      name: "Lantern",
      type: "lantern_01",
      x: 15,
      y: 11,
      visible: true,
      params: {
        radius: 170,
        strength: 0.85,
      },
    },
    {
      id: "entity-3",
      name: "Firefly",
      type: "firefly_01",
      x: 18,
      y: 10,
      visible: true,
      params: {
        lightDiameter: 240,
        lightStrength: 0.8,
        aggroTiles: 6,
        flyRangeX: 5,
        flyRangeYUp: 5,
        flySpeed: 45,
        smooth: 7,
        flyTime: 2.5,
        cooldown: 2,
        fadeIn: 0.35,
        fadeOut: 0.45,
        perchSearchRadius: 6,
      },
    },
    {
      id: "entity-4",
      name: "Trigger",
      type: "trigger",
      x: 19,
      y: 14,
      visible: true,
      params: {
        event: "open-door",
        radius: 2,
      },
    },
    {
      id: "entity-5",
      name: "Checkpoint",
      type: "checkpoint",
      x: 29,
      y: 8,
      visible: true,
      params: {
        respawnId: "cp-1",
      },
    },
    {
      id: "entity-6",
      name: "Dark Creature",
      type: "dark_creature_01",
      x: 30,
      y: 16,
      visible: true,
      params: {
        hp: 3,
        hitCooldown: 0.6,
        safeDelay: 0.6,
        patrolTiles: 0,
        aggroTiles: 0,
        castCooldown: 5.5,
        energyLoss: 40,
        knockbackX: 260,
        knockbackY: -220,
        reactsToFlares: true,
      },
    },
    {
      id: "entity-7",
      name: "Hover Void",
      type: "hover_void_01",
      x: 34,
      y: 17,
      visible: true,
      params: {
        aggroTiles: 7,
        followTiles: 7,
        maxHp: 3,
        colorVariant: 0,
        loseSightTiles: 11,
        attackCooldownMin: 1,
        attackCooldownMax: 3,
        attackDamage: 12,
        attackPushback: 180,
        braveGroupSize: 3,
        swarmGroupSize: 6,
      },
    },
    {
      id: "entity-8",
      name: "Generic",
      type: "generic",
      x: 34,
      y: 17,
      visible: true,
      params: {},
    },
  ],
  sounds: [
    {
      id: "sound-1",
      name: "Drip Spot",
      type: "spot",
      x: 10,
      y: 10,
      visible: true,
      source: "data/assets/audio/spot/drip/waterdrip.ogg",
      params: {
        volume: 0.7,
        pitch: 0.95,
        radius: 4,
        spatial: true,
      },
    },
    {
      id: "sound-2",
      name: "Bell Trigger",
      type: "trigger",
      x: 17,
      y: 9,
      visible: true,
      source: "data/assets/audio/events/creatures/alien_presence.ogg",
      params: {
        volume: 0.9,
        pitch: 1,
        radius: 3,
        loop: false,
        spatial: true,
      },
    },
    {
      id: "sound-3",
      name: "Ruin Ambience",
      type: "ambientZone",
      x: 22,
      y: 6,
      visible: true,
      source: "data/assets/audio/ambient/ruin/dark-ambient-horror.ogg",
      params: {
        volume: 0.5,
        pitch: 1,
        loop: true,
        spatial: false,
        width: 7,
        height: 5,
      },
    },
    {
      id: "sound-4",
      name: "Music Lift",
      type: "musicZone",
      x: 30,
      y: 14,
      visible: true,
      source: "data/assets/audio/music/game_play_1.ogg",
      params: {
        volume: 0.85,
        pitch: 1,
        loop: true,
        spatial: false,
        width: 6,
        height: 4,
        fadeDistance: 1.5,
        sustainWidth: 3,
      },
    },
  ],
  extra: {
    notes: "Read-only demo document for the Lumo editor pipeline.",
  },
};
