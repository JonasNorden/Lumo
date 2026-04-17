function slugifyFilePart(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function getLevelExportFileName(doc) {
  const namePart = slugifyFilePart(doc?.meta?.name ?? "");
  const idPart = slugifyFilePart(doc?.meta?.id ?? "");
  const base = namePart || idPart || "lumo-level";
  return `${base}.json`;
}

export function serializeLevelDocument(doc) {
  console.log("[EXPORT INPUT BACKGROUND]", {
    background: doc?.background,
    backgroundBase: doc?.background?.base,
    backgrounds: doc?.backgrounds,
    backgroundLayers: doc?.backgrounds?.layers,
  });

  const exportDoc = { ...doc };
  if (!exportDoc.layers) exportDoc.layers = {};

  const runtimeBackground = [];
  const tilemapBackgroundData = doc?.background?.base;
  if (tilemapBackgroundData != null) {
    runtimeBackground.push({
      backgroundId: "tilemap_background",
      order: 0,
      type: "tilemap",
      data: tilemapBackgroundData,
    });
  }

  const backgroundLayers = doc?.backgrounds?.layers;
  if (Array.isArray(backgroundLayers)) {
    backgroundLayers.forEach((layer, index) => {
      if (!layer || typeof layer !== "object") return;

      const nextEntry = {
        backgroundId: layer.id,
        order: Number.isFinite(layer.depth) ? layer.depth : index,
        type: layer.type,
      };

      if (layer.color !== undefined) {
        nextEntry.color = layer.color;
      }

      runtimeBackground.push(nextEntry);
    });
  }

  runtimeBackground.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  exportDoc.layers.background = runtimeBackground;

  if (doc?.background?.base) {
    if (!exportDoc.layers) exportDoc.layers = {};

    const width = doc.dimensions?.width;
    const height = doc.dimensions?.height;
    const baseData = Array.isArray(doc.background.base) ? [...doc.background.base] : [];
    const placements = Array.isArray(doc?.background?.placements) ? doc.background.placements : [];

    // Flatten authored sized placements into the runtime tilemap.
    // Placement `y` is the bottom anchor row (same semantics as backgroundLayer.js).
    const canFlattenPlacements = Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0;
    for (const placement of placements) {
      if (!canFlattenPlacements) break;
      if (!placement?.materialId) continue;
      if (!Number.isInteger(placement?.x) || !Number.isInteger(placement?.y)) continue;

      const size = Number.isInteger(placement?.size) ? Math.max(1, placement.size) : 1;
      const startX = placement.x;
      const endX = placement.x + size - 1;
      const startY = placement.y - (size - 1);
      const endY = placement.y;

      for (let y = startY; y <= endY; y += 1) {
        if (y < 0 || y >= height) continue;
        for (let x = startX; x <= endX; x += 1) {
          if (x < 0 || x >= width) continue;
          baseData[y * width + x] = placement.materialId;
        }
      }
    }

    exportDoc.layers.bg = {
      type: "tilemap",
      data: baseData,
      width,
      height,
      tileSize: doc.dimensions?.tileSize,
    };
  }

  if (Array.isArray(doc?.backgrounds?.layers)) {
    if (!exportDoc.layers) exportDoc.layers = {};

    exportDoc.layers.background = doc.backgrounds.layers.map((layer, i) => ({
      backgroundId: layer?.id || `bg_${i}`,
      order: layer?.depth ?? i,
      type: layer?.type || "color",
      ...(layer?.color ? { color: layer.color } : {}),
    }));
  }

  console.log("[EXPORT BACKGROUND CHECK]", {
    hasBg: !!exportDoc.layers?.bg,
    hasBackgroundLayers: !!exportDoc.layers?.background,
  });

  return JSON.stringify(exportDoc, null, 2);
}

export function triggerLevelDocumentDownload(doc) {
  const json = serializeLevelDocument(doc);
  const fileName = getLevelExportFileName(doc);
  const blob = new Blob([json], { type: "application/json" });
  const objectUrl = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(objectUrl);
}
