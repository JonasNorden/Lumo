const LEGACY_TILE_BEHAVIOR_BY_ID = {
  0: { name: "empty", solid: false, oneWay: false, hazard: false, groundAccelMul: 1, groundFrictionMul: 1, maxSpeedMul: 1 },
  1: { name: "stone", solid: true, oneWay: false, hazard: false, groundAccelMul: 1, groundFrictionMul: 1, maxSpeedMul: 1 },
  2: { name: "platform", solid: true, oneWay: true, hazard: false, groundAccelMul: 1, groundFrictionMul: 1, maxSpeedMul: 1 },
  3: { name: "spikes", solid: false, oneWay: false, hazard: true, groundAccelMul: 1, groundFrictionMul: 1, maxSpeedMul: 1 },
  // V1 truth from src/game/world.js fallback/runtime tile defs.
  4: { name: "ice", solid: true, oneWay: false, hazard: false, groundAccelMul: 0.85, groundFrictionMul: 0.12, maxSpeedMul: 1.25 },
  5: { name: "brake", solid: true, oneWay: false, hazard: false, groundAccelMul: 1.00, groundFrictionMul: 3.00, maxSpeedMul: 0.80 },
};

function parseMovementMul(source) {
  const parsed = Number.parseFloat(source?.movementMul);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function resolveProfileBehavior(tile = {}) {
  const behaviorProfileId = String(tile?.behaviorProfileId || "").trim().toLowerCase();
  const collisionType = String(tile?.collisionType || "").trim();
  const special = String(tile?.special || "").trim().toLowerCase();
  const byProfile = behaviorProfileId || `${collisionType}:${special}`;

  if (byProfile.includes("tile.solid.ice") || special === "ice") {
    return LEGACY_TILE_BEHAVIOR_BY_ID[4];
  }
  if (byProfile.includes("tile.solid.brake") || special === "brake") {
    return LEGACY_TILE_BEHAVIOR_BY_ID[5];
  }
  if (byProfile.includes("tile.one-way.default") || collisionType === "oneWay") {
    return LEGACY_TILE_BEHAVIOR_BY_ID[2];
  }
  if (byProfile.includes("tile.hazard.default") || collisionType === "hazard") {
    return LEGACY_TILE_BEHAVIOR_BY_ID[3];
  }

  if (byProfile.includes("tile.solid.sticky") || special === "sticky") {
    return {
      ...LEGACY_TILE_BEHAVIOR_BY_ID[1],
      maxSpeedMul: parseMovementMul(tile?.behaviorParams) ?? parseMovementMul(tile?.profileDefaults) ?? 0.5,
    };
  }

  if (byProfile.includes("tile.solid.rapid") || special === "rapid") {
    return {
      ...LEGACY_TILE_BEHAVIOR_BY_ID[1],
      maxSpeedMul: parseMovementMul(tile?.behaviorParams) ?? parseMovementMul(tile?.profileDefaults) ?? 1.35,
    };
  }

  return null;
}

export function resolveRuntimeTileBehavior(tile = {}) {
  const byId = LEGACY_TILE_BEHAVIOR_BY_ID[Number(tile?.tileId) | 0] || null;
  const byProfile = resolveProfileBehavior(tile);
  const base = byProfile || byId || LEGACY_TILE_BEHAVIOR_BY_ID[1];
  const profileResolved = byProfile != null;

  const behavior = {
    ...base,
    name: typeof tile?.name === "string" && tile.name.trim() ? tile.name : base.name,
    // V1 parity: when behavior profile/collision metadata resolves to a known behavior,
    // that semantic class is authoritative over legacy/default flags.
    solid: profileResolved ? base.solid : (typeof tile?.solid === "boolean" ? tile.solid : base.solid),
    oneWay: profileResolved ? base.oneWay : (typeof tile?.oneWay === "boolean" ? tile.oneWay : base.oneWay),
    hazard: profileResolved ? base.hazard : (typeof tile?.hazard === "boolean" ? tile.hazard : base.hazard),
    groundAccelMul: Number.isFinite(tile?.groundAccelMul) ? tile.groundAccelMul : base.groundAccelMul,
    groundFrictionMul: Number.isFinite(tile?.groundFrictionMul) ? tile.groundFrictionMul : base.groundFrictionMul,
    maxSpeedMul: Number.isFinite(tile?.maxSpeedMul) ? tile.maxSpeedMul : base.maxSpeedMul,
  };

  const movementMul = parseMovementMul(tile?.behaviorParams);
  if (movementMul !== null) {
    behavior.maxSpeedMul = movementMul;
  }

  return behavior;
}

export function isRuntimeTileBlocking(behavior, options = {}) {
  if (!behavior || behavior.solid !== true || behavior.hazard === true) {
    return false;
  }

  if (behavior.oneWay === true) {
    return options?.includeOneWay === true;
  }

  return true;
}

export function resolveRuntimeGroundSurface(worldPacket, playerState) {
  const tileSize = worldPacket?.world?.tileSize;
  const playerX = playerState?.position?.x;
  const playerY = playerState?.position?.y;

  if (!Number.isFinite(tileSize) || tileSize <= 0 || !Number.isFinite(playerX) || !Number.isFinite(playerY)) {
    return null;
  }

  const gridX = Math.floor(playerX / tileSize);
  const gridY = Math.floor((playerY + 1) / tileSize);
  const tiles = Array.isArray(worldPacket?.layers?.tiles) ? worldPacket.layers.tiles : [];

  for (const tile of tiles) {
    if (!Number.isFinite(tile?.x) || !Number.isFinite(tile?.y) || !Number.isFinite(tile?.w) || !Number.isFinite(tile?.h)) {
      continue;
    }

    const x = tile.x;
    const y = tile.y;
    const w = tile.w;
    const h = tile.h;
    const coordinateSpace = tile?.coordinateSpace === "grid" ? "grid" : "world";

    const coversCell = coordinateSpace === "grid"
      ? gridX >= x && gridX < x + w && gridY >= y && gridY < y + h
      : playerX >= x && playerX < x + w && (playerY + 1) >= y && (playerY + 1) < y + h;

    if (!coversCell) continue;

    const behavior = resolveRuntimeTileBehavior(tile);
    if (behavior.hazard === true) continue;
    return behavior;
  }

  return null;
}

export function resolveLegacyBehaviorByTileId(tileId) {
  return { ...(LEGACY_TILE_BEHAVIOR_BY_ID[Number(tileId) | 0] || LEGACY_TILE_BEHAVIOR_BY_ID[1]) };
}
