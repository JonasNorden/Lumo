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
  return JSON.stringify(doc, null, 2);
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
