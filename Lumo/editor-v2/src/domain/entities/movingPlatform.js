const MOVING_PLATFORM_DIRECTIONS = new Set(["right", "left", "up", "down"]);
const MOVING_PLATFORM_LOOP_MODES = new Set(["pingpong", "loop", "oneWay"]);

export const MOVING_PLATFORM_DEFAULT_PARAMS = {
  widthTiles: 4,
  heightTiles: 1,
  direction: "right",
  distanceTiles: 4,
  speed: 70,
  loop: "pingpong",
  oneWay: true,
  carryPlayer: true,
  spriteTileId: "",
};

function clampTileSpan(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isInteger(parsed) ? Math.max(1, parsed) : fallback;
}

function clampDistance(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isInteger(parsed) ? Math.max(0, parsed) : fallback;
}

export function normalizeMovingPlatformParams(params = {}) {
  const next = {
    ...MOVING_PLATFORM_DEFAULT_PARAMS,
    ...(params && typeof params === "object" ? params : {}),
  };

  next.widthTiles = clampTileSpan(next.widthTiles, MOVING_PLATFORM_DEFAULT_PARAMS.widthTiles);
  next.heightTiles = clampTileSpan(next.heightTiles, MOVING_PLATFORM_DEFAULT_PARAMS.heightTiles);
  next.distanceTiles = clampDistance(next.distanceTiles, MOVING_PLATFORM_DEFAULT_PARAMS.distanceTiles);
  next.speed = Number.isFinite(Number(next.speed)) ? Number(next.speed) : MOVING_PLATFORM_DEFAULT_PARAMS.speed;
  next.direction = MOVING_PLATFORM_DIRECTIONS.has(next.direction) ? next.direction : MOVING_PLATFORM_DEFAULT_PARAMS.direction;
  next.loop = MOVING_PLATFORM_LOOP_MODES.has(next.loop) ? next.loop : MOVING_PLATFORM_DEFAULT_PARAMS.loop;
  next.oneWay = Boolean(next.oneWay);
  next.carryPlayer = Boolean(next.carryPlayer);
  next.spriteTileId = typeof next.spriteTileId === "string" ? next.spriteTileId : "";
  if (typeof next.visualTileId === "string") {
    next.visualTileId = next.visualTileId;
  }

  return next;
}

export function getMovingPlatformPathFromAnchor(anchorX, anchorY, params = {}) {
  const normalized = normalizeMovingPlatformParams(params);
  const distance = normalized.distanceTiles;
  let dx = 0;
  let dy = 0;
  if (normalized.direction === "right") dx = distance;
  if (normalized.direction === "left") dx = -distance;
  if (normalized.direction === "down") dy = distance;
  if (normalized.direction === "up") dy = -distance;

  return {
    anchor: { x: anchorX, y: anchorY },
    end: { x: anchorX + dx, y: anchorY + dy },
    params: normalized,
  };
}
