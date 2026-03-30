// data/catalog_profiles.js
// Migration-safe additive metadata registries.
// NOTE: Runtime/editor still resolve behavior from legacy fields (tileId/id/defaults/img/etc).

window.LUMO_TILE_BEHAVIOR_PROFILES = [
  {
    id: "tile.solid.default",
    collisionType: "solid",
    special: null
  },
  {
    id: "tile.solid.ice",
    collisionType: "solid",
    special: "ice"
  },
  {
    id: "tile.solid.brake",
    collisionType: "solid",
    special: "brake"
  },
  {
    id: "tile.one-way.default",
    collisionType: "oneWay",
    special: null
  },
  {
    id: "tile.hazard.default",
    collisionType: "hazard",
    special: null
  }
];

window.LUMO_ENTITY_BEHAVIOR_PROFILES = [
  {
    id: "entity.sound.music_zone.v1",
    defaults: {
      soundFile: "data/assets/audio/music/space_loop_short.wav",
      xStart: 0,
      xEnd: 240,
      volume: 0.7,
      loop: true,
      fadeTiles: 4
    },
    shownParams: ["soundFile", "xStart", "xEnd", "volume", "loop", "fadeTiles"]
  },
  {
    id: "entity.creature.dark_creature.v1",
    defaults: {
      hp: 3,
      hitCooldown: 0.6,
      safeDelay: 0.6,
      patrolTiles: 0,
      aggroTiles: 0,
      castCooldown: 5.5,
      energyLoss: 40,
      knockbackX: 260,
      knockbackY: -220,
      reactsToFlares: true
    },
    shownParams: [
      "hp",
      "hitCooldown",
      "safeDelay",
      "patrolTiles",
      "aggroTiles",
      "castCooldown",
      "energyLoss",
      "knockbackX",
      "knockbackY",
      "reactsToFlares"
    ]
  },
  {
    id: "entity.creature.hover_void.v1",
    defaults: {
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
      swarmGroupSize: 6
    },
    shownParams: [
      "aggroTiles",
      "followTiles",
      "maxHp",
      "colorVariant",
      "loseSightTiles",
      "attackCooldownMin",
      "attackCooldownMax",
      "attackDamage",
      "attackPushback",
      "braveGroupSize",
      "swarmGroupSize"
    ]
  }
];

window.LUMO_VISUAL_PROFILES = [
  {
    id: "visual.tile.24x24.tl",
    anchor: "TL",
    drawW: 24,
    drawH: 24,
    drawOffX: 0,
    drawOffY: 0
  },
  {
    id: "visual.tile.24x32.bl",
    anchor: "BL",
    drawW: 24,
    drawH: 32,
    drawOffX: 0,
    drawOffY: 0
  },
  {
    id: "visual.tile.48x48.bl",
    anchor: "BL",
    drawW: 48,
    drawH: 48,
    drawOffX: 0,
    drawOffY: 0
  },
  {
    id: "visual.entity.bl",
    anchor: "BL"
  },
  {
    id: "visual.bg.tl",
    anchor: "TL"
  }
];

window.LUMO_THEME_DEFS = [
  { id: "theme.nature", tags: ["nature", "organic"] },
  { id: "theme.cave", tags: ["cave", "stone"] },
  { id: "theme.void", tags: ["void", "dark"] },
  { id: "theme.tech", tags: ["tech", "constructed"] }
];
