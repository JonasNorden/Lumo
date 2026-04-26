function toFiniteNumber(value) {
  return Number.isFinite(value) ? value : null;
}

function toWholeNumber(value) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : null;
}

function toComboMultiplier(value) {
  if (!Number.isFinite(value)) {
    return null;
  }
  if (value >= 2) {
    return 2;
  }
  if (value >= 1.5) {
    return 1.5;
  }
  return 1;
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
  const runtimeScore = Number.isFinite(state?.score) ? Math.max(0, Math.floor(state.score || 0)) : null;
  const runtimeCombo = toComboMultiplier(state?.comboMultiplier);
  const snapshotScore = toWholeNumber(playerSnapshot?.score);
  const snapshotCombo = toComboMultiplier(playerSnapshot?.comboMultiplier);
  const payloadScore = toWholeNumber(payload?.score);
  const payloadCombo = toComboMultiplier(payload?.comboMultiplier);
  const levelComplete = playerSnapshot?.levelComplete === true;
  const respawnCountdown = playerSnapshot?.respawnCountdown && typeof playerSnapshot.respawnCountdown === "object"
    ? playerSnapshot.respawnCountdown
    : null;
  const respawnPending = playerSnapshot?.respawnPending === true
    || payload?.respawnPending === true
    || respawnCountdown?.active === true
    || playerSnapshot?.status === "respawn-pending";
  const respawnCountFromCountdown = Number.isFinite(respawnCountdown?.countdown) ? Math.max(0, Math.ceil(respawnCountdown.countdown)) : null;
  const respawnCountFromSnapshot = Number.isFinite(playerSnapshot?.respawnCount) ? Math.max(0, Math.ceil(playerSnapshot.respawnCount)) : null;
  const respawnCountFromPayload = Number.isFinite(payload?.respawnCount) ? Math.max(0, Math.ceil(payload.respawnCount)) : null;
  const respawnCount = respawnCountFromCountdown ?? respawnCountFromSnapshot ?? respawnCountFromPayload ?? 0;

  const gameState = typeof playerSnapshot?.gameState === "string" ? playerSnapshot.gameState : "playing";

  return {
    flareStash: toWholeNumber(playerSnapshot?.flareStash),
    energy: toFiniteNumber(playerSnapshot?.energy),
    lives: toWholeNumber(playerSnapshot?.lives),
    score: runtimeScore ?? snapshotScore ?? payloadScore ?? 0,
    comboMultiplier: runtimeCombo ?? snapshotCombo ?? payloadCombo ?? 1,
    levelComplete,
    intermissionReadyForInput: playerSnapshot?.intermissionReadyForInput === true,
    gameState,
    respawnPending,
    respawnCount: respawnPending ? respawnCount : 0,
    ...((gameState === "gameover") ? { statusText: "Game Over" } : {}),
    ...(levelComplete ? { statusText: "Level complete" } : {}),
  };
}
