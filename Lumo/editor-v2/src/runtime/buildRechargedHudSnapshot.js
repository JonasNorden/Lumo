function toFiniteNumber(value) {
  return Number.isFinite(value) ? value : null;
}

function toWholeNumber(value) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : null;
}

function readAdapterPlayerSnapshot(payload, state) {
  const adapter = payload?.adapter && typeof payload.adapter === "object" ? payload.adapter : null;
  const adapterSnapshot = adapter?.getPlayerSnapshot?.();
  if (adapterSnapshot && typeof adapterSnapshot === "object") {
    return adapterSnapshot;
  }

  if (state?.currentPlayerSnapshot && typeof state.currentPlayerSnapshot === "object") {
    return state.currentPlayerSnapshot;
  }

  if (payload?.player && typeof payload.player === "object") {
    return payload.player;
  }

  return null;
}

// Builds one compact Recharged HUD snapshot from live adapter-facing player state.
export function buildRechargedHudSnapshot(payload = {}, state = null) {
  const playerSnapshot = readAdapterPlayerSnapshot(payload, state);

  return {
    flareStash: toWholeNumber(playerSnapshot?.flareStash),
    energy: toFiniteNumber(playerSnapshot?.energy),
    lives: toWholeNumber(playerSnapshot?.lives),
    score: toWholeNumber(playerSnapshot?.score),
    levelComplete: playerSnapshot?.levelComplete === true,
    intermissionReadyForInput: playerSnapshot?.intermissionReadyForInput === true,
    gameState: typeof playerSnapshot?.gameState === "string" ? playerSnapshot.gameState : "playing",
  };
}
