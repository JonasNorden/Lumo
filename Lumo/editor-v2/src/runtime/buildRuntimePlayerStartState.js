import { buildRuntimePlayerSpawnPacket } from "./buildRuntimePlayerSpawnPacket.js";
import { buildRuntimeSpawnPoint } from "./buildRuntimeSpawnPoint.js";
import { buildRuntimeSpawnValidation } from "./buildRuntimeSpawnValidation.js";
import { hasRuntimeGroundBelowSpawn } from "./hasRuntimeGroundBelowSpawn.js";

// Builds the first gameplay-facing runtime player start state from authored spawn data.
export function buildRuntimePlayerStartState(worldPacket) {
  const playerSpawnPacket = buildRuntimePlayerSpawnPacket(worldPacket);
  const spawnValidation = buildRuntimeSpawnValidation(worldPacket);
  const authoredSpawnPoint = buildRuntimeSpawnPoint({
    world: worldPacket?.world,
    spawn: worldPacket?.spawn,
  });

  const hasAuthoredSpawnX = Number.isFinite(worldPacket?.spawn?.x);
  const hasAuthoredSpawnY = Number.isFinite(worldPacket?.spawn?.y);
  const hasAuthoredSpawnPosition = hasAuthoredSpawnX && hasAuthoredSpawnY;
  const authoredSpawnUsable = spawnValidation.ok === true && hasAuthoredSpawnPosition;

  const groundProbe = authoredSpawnUsable
    ? hasRuntimeGroundBelowSpawn(worldPacket, authoredSpawnPoint)
    : { solidBelow: false };
  const grounded = authoredSpawnUsable ? groundProbe.solidBelow === true : false;
  const falling = authoredSpawnUsable ? groundProbe.solidBelow !== true : false;

  return {
    ok: authoredSpawnUsable,
    status: playerSpawnPacket.status,
    position: {
      x: hasAuthoredSpawnX ? worldPacket.spawn.x : null,
      y: hasAuthoredSpawnY ? worldPacket.spawn.y : null,
    },
    velocity: { x: 0, y: 0 },
    grounded,
    falling,
    spawnSource: playerSpawnPacket.placementSource,
    errors: [...playerSpawnPacket.errors],
    warnings: [...playerSpawnPacket.warnings],
  };
}
