import { buildRuntimeSpawnDropSummary } from "./buildRuntimeSpawnDropSummary.js";
import { buildRuntimePlayerStartPlacement } from "./buildRuntimePlayerStartPlacement.js";

// Builds a compact runtime-ready player spawn packet from existing spawn helpers.
export function buildRuntimePlayerSpawnPacket(worldPacket) {
  // Compose drop summary + resolved placement so status and coordinates stay aligned.
  const dropSummary = buildRuntimeSpawnDropSummary(worldPacket);
  const placement = buildRuntimePlayerStartPlacement(worldPacket);

  const placementSource = placement?.source ?? "missing-spawn";
  const errors = Array.isArray(placement?.errors) ? [...placement.errors] : [];
  const warnings = [];

  // Keep warnings short and deterministic for harness comparisons.
  if (placementSource === "spawn-cell-no-landing") {
    warnings.push("Using raw spawn cell because no landing cell was found.");
  }
  if (dropSummary?.status === "fall-to-landing") {
    warnings.push("Spawn resolves to a landing cell below the authored spawn.");
  }

  return {
    ok: placement?.ok === true,
    status: dropSummary?.status ?? "missing-spawn",
    placementSource,
    startGrid: {
      x: Number.isFinite(placement?.grid?.x) ? placement.grid.x : null,
      y: Number.isFinite(placement?.grid?.y) ? placement.grid.y : null,
    },
    startPixel: {
      x: Number.isFinite(placement?.pixel?.x) ? placement.pixel.x : null,
      y: Number.isFinite(placement?.pixel?.y) ? placement.pixel.y : null,
    },
    tileSize: Number.isFinite(placement?.tileSize) ? placement.tileSize : null,
    debug: {
      spawnValid: dropSummary?.spawnValid === true,
      landingFound: dropSummary?.landingFound === true,
      dropDistanceRows: Number.isFinite(dropSummary?.dropDistanceRows)
        ? dropSummary.dropDistanceRows
        : null,
    },
    errors,
    warnings,
  };
}
