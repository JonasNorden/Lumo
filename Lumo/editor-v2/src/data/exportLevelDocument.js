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

  if (doc?.background?.base && Array.isArray(doc.background.base)) {
    if (!exportDoc.layers) exportDoc.layers = {};

    exportDoc.layers.bg = {
      type: "tilemap",
      data: doc.background.base,
      width: doc.dimensions?.width,
      height: doc.dimensions?.height,
      tileSize: doc.dimensions?.tileSize,
    };
  }

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
