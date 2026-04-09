import { buildRuntimeSpawnValidation } from "./buildRuntimeSpawnValidation.js";
import { findRuntimeLandingCellBelowSpawn } from "./findRuntimeLandingCellBelowSpawn.js";

// Builds a defensive snapshot of spawn viability plus drop/landing details for debug output.
export function buildRuntimeSpawnDropSummary(worldPacket) {
  // Reuse existing validation and landing helpers so this stays a thin composition layer.
  const validation = buildRuntimeSpawnValidation(worldPacket);
  const landing = findRuntimeLandingCellBelowSpawn(worldPacket);

  const spawnValid = validation?.ok === true;
  const spawnBlocked = validation?.checks?.spawnTileSolid === true;
  const hasGroundBelowSpawn = validation?.checks?.groundBelowSpawn === true;
  const landingFound = landing?.found === true;

  const startGridX = Number.isFinite(landing?.start?.gridX) ? landing.start.gridX : null;
  const startGridY = Number.isFinite(landing?.start?.gridY) ? landing.start.gridY : null;
  const landingCell =
    Number.isFinite(landing?.landingCell?.gridX) && Number.isFinite(landing?.landingCell?.gridY)
      ? { gridX: landing.landingCell.gridX, gridY: landing.landingCell.gridY }
      : null;
  const supportCell =
    Number.isFinite(landing?.supportCell?.gridX) && Number.isFinite(landing?.supportCell?.gridY)
      ? { gridX: landing.supportCell.gridX, gridY: landing.supportCell.gridY }
      : null;

  const dropDistanceRows =
    landingFound && Number.isFinite(startGridY) && Number.isFinite(landingCell?.gridY)
      ? landingCell.gridY - startGridY
      : null;

  // Keep status priority strict and deterministic for harness comparisons.
  let status = "no-landing-found";
  if (validation?.checks?.hasSpawn !== true) {
    status = "missing-spawn";
  } else if (validation?.checks?.spawnInsideWorld !== true) {
    status = "spawn-outside-world";
  } else if (spawnBlocked) {
    status = "spawn-blocked";
  } else if (hasGroundBelowSpawn && !landingFound) {
    status = "grounded-at-spawn";
  } else if (landingFound && dropDistanceRows > 0) {
    status = "fall-to-landing";
  } else if (landingFound && dropDistanceRows === 0) {
    status = "standing-on-landing";
  }

  return {
    spawnValid,
    spawnBlocked,
    hasGroundBelowSpawn,
    landingFound,
    dropDistanceRows,
    start: {
      gridX: startGridX,
      gridY: startGridY,
    },
    landingCell,
    supportCell,
    status,
  };
}
