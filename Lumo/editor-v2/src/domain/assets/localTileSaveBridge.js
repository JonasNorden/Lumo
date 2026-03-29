const LOCAL_TILE_SAVE_BRIDGE_URL = "http://localhost:4180/api/editor-v2/tiles/save";

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const value = typeof reader.result === "string" ? reader.result : "";
      if (!value) {
        reject(new Error("unable-to-read-file"));
        return;
      }
      resolve(value);
    }, { once: true });
    reader.addEventListener("error", () => {
      reject(reader.error || new Error("unable-to-read-file"));
    }, { once: true });
    reader.readAsDataURL(file);
  });
}

export async function saveTileThroughLocalBridge({ draft, tilePayload, spriteFile }) {
  if (!(spriteFile instanceof File)) {
    return { ok: false, reason: "missing-sprite-file", message: "Select a sprite file before saving this tile." };
  }

  const spriteDataUrl = await fileToDataUrl(spriteFile);
  let response;
  try {
    response = await fetch(LOCAL_TILE_SAVE_BRIDGE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tile: tilePayload,
        sprite: {
          fileName: draft?.spriteFileName || spriteFile.name,
          mimeType: spriteFile.type || "application/octet-stream",
          dataUrl: spriteDataUrl,
        },
      }),
    });
  } catch {
    return {
      ok: false,
      reason: "bridge-unavailable",
      message: "Persistent save bridge is unavailable. Start editor-v2/dev/localTileSaveBridge.js and try again.",
    };
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok || !payload?.ok) {
    return {
      ok: false,
      reason: payload?.reason || "save-failed",
      message: payload?.message || "Persistent tile save failed.",
    };
  }

  return {
    ok: true,
    message: payload.message || "Tile saved to local catalog.",
    persistedTile: payload.persistedTile || null,
  };
}
