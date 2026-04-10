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

  const moveX = normalizeMoveX(source.moveX, warnings);
  const jump = source.jump === true;
  const run = source.run === true;

  return {
    ok: errors.length === 0,
    moveX,
    jump,
    run,
    errors: uniqueMessages(errors),
    warnings: uniqueMessages(warnings),
  };
}
