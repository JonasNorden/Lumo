function uniqueMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return [...new Set(messages.filter((message) => typeof message === "string" && message.length > 0))];
}

function normalizeKeyDescriptor(eventLike = {}) {
  const code = typeof eventLike?.code === "string" ? eventLike.code : "";
  const key = typeof eventLike?.key === "string" ? eventLike.key : "";
  return {
    code,
    key,
    normalizedCode: code.trim().toLowerCase(),
    normalizedKey: key.trim().toLowerCase(),
  };
}

function hasActiveKey(pressedKeys, candidates = []) {
  return candidates.some((candidate) => pressedKeys.has(candidate));
}

export function normalizeRuntimeBrowserInput(pressedKeySet) {
  const pressedKeys = pressedKeySet instanceof Set ? pressedKeySet : new Set();

  const leftActive = hasActiveKey(pressedKeys, ["arrowleft", "keya"]);
  const rightActive = hasActiveKey(pressedKeys, ["arrowright", "keyd"]);
  const jumpActive = hasActiveKey(pressedKeys, ["space", "arrowup", "keyw"]);
  const runActive = hasActiveKey(pressedKeys, ["shiftleft", "shiftright", "shift"]);

  const moveX = leftActive === rightActive ? 0 : (leftActive ? -1 : 1);

  return {
    moveX,
    jump: jumpActive,
    run: runActive,
    leftActive,
    rightActive,
    jumpActive,
    runActive,
  };
}

// Creates a defensive browser keyboard input-state facade for runtime bridge loops.
export function createRuntimeBrowserInputState(options = {}) {
  const pressedKeys = new Set();
  const warnings = [];

  const state = {
    attached: false,
    lastChangedAt: null,
    listenerTarget: null,
  };

  function applyKeyboardEvent(eventLike, isPressed) {
    const descriptor = normalizeKeyDescriptor(eventLike);
    const keyId = descriptor.normalizedCode || descriptor.normalizedKey;
    if (!keyId) {
      return {
        ok: false,
        changed: false,
        errors: ["Runtime browser input event did not include key or code."],
        warnings: [],
      };
    }

    const hadKey = pressedKeys.has(keyId);
    if (isPressed) {
      pressedKeys.add(keyId);
    } else {
      pressedKeys.delete(keyId);
    }

    const changed = hadKey !== isPressed;
    if (changed) {
      state.lastChangedAt = Date.now();
    }

    return {
      ok: true,
      changed,
      errors: [],
      warnings: [],
    };
  }

  const onKeyDown = (event) => {
    const result = applyKeyboardEvent(event, true);
    if (result.ok !== true) {
      warnings.push(...result.errors);
    }
  };

  const onKeyUp = (event) => {
    const result = applyKeyboardEvent(event, false);
    if (result.ok !== true) {
      warnings.push(...result.errors);
    }
  };

  function attach(target = options?.eventTarget ?? globalThis) {
    if (state.attached) {
      return {
        ok: true,
        attached: true,
        errors: [],
        warnings: uniqueMessages(warnings),
      };
    }

    if (!target || typeof target.addEventListener !== "function") {
      return {
        ok: false,
        attached: false,
        errors: ["Runtime browser input attach requires an event target with addEventListener."],
        warnings: uniqueMessages(warnings),
      };
    }

    target.addEventListener("keydown", onKeyDown);
    target.addEventListener("keyup", onKeyUp);
    state.listenerTarget = target;
    state.attached = true;

    return {
      ok: true,
      attached: true,
      errors: [],
      warnings: uniqueMessages(warnings),
    };
  }

  function clear() {
    pressedKeys.clear();
    state.lastChangedAt = Date.now();
  }

  function detach() {
    if (!state.attached || !state.listenerTarget) {
      return {
        ok: true,
        attached: false,
        errors: [],
        warnings: uniqueMessages(warnings),
      };
    }

    state.listenerTarget.removeEventListener("keydown", onKeyDown);
    state.listenerTarget.removeEventListener("keyup", onKeyUp);
    state.listenerTarget = null;
    state.attached = false;
    clear();

    return {
      ok: true,
      attached: false,
      errors: [],
      warnings: uniqueMessages(warnings),
    };
  }

  function getNormalizedInput() {
    const normalized = normalizeRuntimeBrowserInput(pressedKeys);
    return {
      moveX: normalized.moveX,
      jump: normalized.jump,
      run: normalized.run,
    };
  }

  function getSnapshot() {
    const normalized = normalizeRuntimeBrowserInput(pressedKeys);
    return {
      attached: state.attached,
      lastChangedAt: state.lastChangedAt,
      activeKeys: [...pressedKeys.values()].sort(),
      input: {
        moveX: normalized.moveX,
        jump: normalized.jump,
        run: normalized.run,
      },
      flags: {
        left: normalized.leftActive,
        right: normalized.rightActive,
        jump: normalized.jumpActive,
        run: normalized.runActive,
      },
      warnings: uniqueMessages(warnings),
    };
  }

  return {
    attach,
    detach,
    clear,
    applyKeyboardEvent,
    getNormalizedInput,
    getSnapshot,
  };
}
