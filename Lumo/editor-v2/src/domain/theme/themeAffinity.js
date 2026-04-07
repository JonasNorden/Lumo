import { hasThemeAffinity } from "./themeTagging.js";

export function getThemeMatchScore(assetThemeIds, activeThemeId) {
  if (!assetThemeIds || !activeThemeId) return 0;
  return hasThemeAffinity(assetThemeIds, activeThemeId) ? 100 : 0;
}

