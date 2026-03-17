import { validateLevelDocument } from "../domain/level/levelDocument.js";
import { mockLevelDocument } from "./mockLevelDocument.js";

export async function loadLevelDocument() {
  await new Promise((resolve) => setTimeout(resolve, 20));
  return validateLevelDocument(structuredClone(mockLevelDocument));
}
