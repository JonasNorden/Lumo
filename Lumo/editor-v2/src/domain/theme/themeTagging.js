import { getThemeCatalog } from "./themeCatalog.js";

const THEME_ID_ORDER = getThemeCatalog()
  .map((theme) => String(theme?.id || "").trim().toLowerCase())
  .filter((themeId) => themeId.length > 0);

const THEME_ID_SET = new Set(THEME_ID_ORDER);
const THEME_ORDER_BY_ID = new Map(THEME_ID_ORDER.map((themeId, index) => [themeId, index]));

function normalizeThemeToken(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function normalizeThemeIds(themeIds) {
  if (!Array.isArray(themeIds) || !themeIds.length) return [];
  const seen = new Set();
  const normalized = [];
  for (const themeId of themeIds) {
    const normalizedThemeId = normalizeThemeToken(themeId);
    if (!normalizedThemeId || !THEME_ID_SET.has(normalizedThemeId) || seen.has(normalizedThemeId)) continue;
    seen.add(normalizedThemeId);
    normalized.push(normalizedThemeId);
  }
  normalized.sort((left, right) => (THEME_ORDER_BY_ID.get(left) ?? Number.MAX_SAFE_INTEGER) - (THEME_ORDER_BY_ID.get(right) ?? Number.MAX_SAFE_INTEGER));
  return normalized;
}

export function hasThemeAffinity(themeIds, themeId) {
  const normalizedThemeIds = normalizeThemeIds(themeIds);
  const candidateThemeId = normalizeThemeToken(themeId);
  if (!candidateThemeId) return false;
  return normalizedThemeIds.includes(candidateThemeId);
}
