import { validateLevelDocument } from "../domain/level/levelDocument.js";

export async function importLevelDocumentFromFile(file) {
  if (!(file instanceof File)) {
    throw new Error("No JSON file selected");
  }

  const json = await file.text();
  let parsed;

  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Import failed: invalid JSON");
  }

  const document = validateLevelDocument(parsed);

  return {
    document,
    fileName: file.name,
  };
}
