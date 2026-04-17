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

  const pushBackgroundId = (backgroundId) => {
    if (typeof backgroundId !== "string") return;
    const normalizedId = backgroundId.trim();
    if (!normalizedId) return;

    runtimeBackground.push({
      backgroundId: normalizedId,
      order: runtimeBackground.length,
    });
  };

  const editorBackgroundLayer = exportDoc.layers?.background;
  if (Array.isArray(editorBackgroundLayer)) {
    editorBackgroundLayer.forEach((entry) => {
      if (entry && typeof entry === "object") {
        pushBackgroundId(entry.backgroundId ?? entry.id ?? entry.layerId ?? entry.themeId ?? entry.name);
      } else {
        pushBackgroundId(entry);
      }
    });
  } else {
    const backgroundCandidates = [
      exportDoc.background,
      exportDoc.editor?.background,
      exportDoc.editor?.bg,
    ];

    backgroundCandidates.forEach((candidate) => {
      if (Array.isArray(candidate)) {
        candidate.forEach((entry) => {
          if (entry && typeof entry === "object") {
            pushBackgroundId(entry.backgroundId ?? entry.id ?? entry.layerId ?? entry.themeId ?? entry.name);
          } else {
            pushBackgroundId(entry);
          }
        });
        return;
      }

      if (candidate && typeof candidate === "object") {
        pushBackgroundId(candidate.backgroundId ?? candidate.id ?? candidate.layerId ?? candidate.themeId ?? candidate.name ?? candidate.active);
        return;
      }

      pushBackgroundId(candidate);
    });
  }

  exportDoc.layers.background = runtimeBackground;
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
