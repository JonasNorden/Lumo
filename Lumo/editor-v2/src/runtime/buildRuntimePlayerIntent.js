function uniqueMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return [...new Set(messages.filter((message) => typeof message === "string" && message.length > 0))];
}

// Normalizes horizontal input into a deterministic -1, 0, or 1 value.
function normalizeMoveX(rawMoveX, warnings) {
  if (Number.isFinite(rawMoveX)) {
    if (rawMoveX > 0) {
      return 1;
    }

    if (rawMoveX < 0) {
      return -1;
    }

    return 0;
  }

  if (typeof rawMoveX === "string") {
    const normalized = rawMoveX.trim().toLowerCase();

    if (normalized === "left" || normalized === "-1") {
      return -1;
    }

    if (normalized === "right" || normalized === "1") {
      return 1;
    }

    if (normalized === "none" || normalized === "idle" || normalized === "0") {
      return 0;
    }

    warnings.push(`Unknown moveX string \"${rawMoveX}\"; defaulted to 0.`);
    return 0;
  }

  if (rawMoveX === true) {
    warnings.push("Boolean moveX=true is ambiguous; defaulted to 0.");
  }

  return 0;
}

// Builds a tiny defensive runtime input intent object for a single deterministic step.
export function buildRuntimePlayerIntent(input = {}) {
  const warnings = [];
  const errors = [];
  const source = input && typeof input === "object" ? input : {};

  if (input !== undefined && (input === null || typeof input !== "object")) {
    warnings.push("Runtime player intent input was not an object; defaults were applied.");
  }

  // Accept browser-friendly left/right booleans when explicit moveX is not provided.
  const hasMoveX = source.moveX !== undefined;
  const leftPressed = source.left === true;
  const rightPressed = source.right === true;
  const derivedMoveX = rightPressed === leftPressed ? 0 : rightPressed ? 1 : -1;
  const moveX = hasMoveX ? normalizeMoveX(source.moveX, warnings) : derivedMoveX;

  if (source.jump !== undefined && source.jump !== true && source.jump !== false) {
    warnings.push("Runtime jump intent must be a boolean; defaulted to false.");
  }

  if (source.flare !== undefined && source.flare !== true && source.flare !== false) {
    warnings.push("Runtime flare intent must be a boolean; defaulted to false.");
  }

  if (source.pulse !== undefined && source.pulse !== true && source.pulse !== false) {
    warnings.push("Runtime pulse intent must be a boolean; defaulted to false.");
  }

  if (source.boost !== undefined && source.boost !== true && source.boost !== false) {
    warnings.push("Runtime boost intent must be a boolean; defaulted to false.");
  }

  const jump = source.jump === true;
  const flare = source.flare === true;
  const pulse = source.pulse === true;
  const boost = source.boost === true;
  const run = source.run === true;

  return {
    ok: errors.length === 0,
    moveX,
    jump,
    flare,
    pulse,
    boost,
    run,
    errors: uniqueMessages(errors),
    warnings: uniqueMessages(warnings),
  };
}
