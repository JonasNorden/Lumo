import { getThemeById, normalizeThemeId } from "./themeCatalog.js";

function normalizeToken(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeTokenList(values) {
  if (!Array.isArray(values)) return [];
  const seen = new Set();
  const normalized = [];
  for (const value of values) {
    const token = normalizeToken(value);
    if (!token || seen.has(token)) continue;
    seen.add(token);
    normalized.push(token);
  }
  return normalized;
}

function getScoreByOrderedMatch(value, preferredValues, maxScore = 100) {
  const normalizedValue = normalizeToken(value);
  if (!normalizedValue || !preferredValues.length) return 0;
  const index = preferredValues.indexOf(normalizedValue);
  return index >= 0 ? Math.max(1, maxScore - index * 8) : 0;
}

function getScoreByKeywordMatch(rawValue, keywords, scorePerMatch = 6, maxScore = 24) {
  const value = normalizeToken(rawValue);
  if (!value || !keywords.length) return 0;
  let matches = 0;
  for (const keyword of keywords) {
    if (value.includes(keyword)) matches += 1;
  }
  return Math.min(maxScore, matches * scorePerMatch);
}

function buildThemeProfile(theme) {
  const editor = theme?.editorProfile && typeof theme.editorProfile === "object" ? theme.editorProfile : {};
  const tile = editor.tile && typeof editor.tile === "object" ? editor.tile : {};
  const background = editor.background && typeof editor.background === "object" ? editor.background : {};
  const audio = editor.audio && typeof editor.audio === "object" ? editor.audio : {};

  return Object.freeze({
    themeId: normalizeThemeId(theme?.id),
    tile: Object.freeze({
      preferredCatalogIds: normalizeTokenList(tile.preferredCatalogIds),
      preferredGroups: normalizeTokenList(tile.preferredGroups),
      preferredBehaviorProfileIds: normalizeTokenList(tile.preferredBehaviorProfileIds),
      keywordHints: normalizeTokenList(tile.keywordHints),
    }),
    background: Object.freeze({
      preferredMaterialIds: normalizeTokenList(background.preferredMaterialIds),
      keywordHints: normalizeTokenList(background.keywordHints),
      // Future hook: parallax/background authored sets for runtime bridge in later passes.
      preferredBackgroundSetIds: normalizeTokenList(background.preferredBackgroundSetIds),
    }),
    audio: Object.freeze({
      preferredAmbientAssetPaths: normalizeTokenList(audio.preferredAmbientAssetPaths),
      preferredCategories: normalizeTokenList(audio.preferredCategories),
      preferredPathKeywords: normalizeTokenList(audio.preferredPathKeywords),
      preferredHintKeywords: normalizeTokenList(audio.preferredHintKeywords),
      defaultAmbientAssetPath: normalizeToken(audio.defaultAmbientAssetPath) || null,
    }),
    // Future hook: theme-guided entity/decor and lighting authoring, editor-side only for now.
    decor: Object.freeze({
      preferredPresetIds: normalizeTokenList(editor?.decor?.preferredPresetIds),
    }),
    entity: Object.freeze({
      preferredPresetIds: normalizeTokenList(editor?.entity?.preferredPresetIds),
    }),
    lighting: Object.freeze({
      preferredPresetIds: normalizeTokenList(editor?.lighting?.preferredPresetIds),
    }),
  });
}

export function getThemeProfile(themeId) {
  const theme = getThemeById(themeId);
  return buildThemeProfile(theme);
}

function sortByThemeScore(items, getScore) {
  return items
    .map((item, index) => ({ item, index, score: getScore(item) }))
    .sort((left, right) => {
      if (left.score !== right.score) return right.score - left.score;
      return left.index - right.index;
    })
    .map(({ item }) => item);
}

export function rankTileSpriteOptionsForTheme(tileOptions, themeId) {
  const profile = getThemeProfile(themeId);
  const options = Array.isArray(tileOptions) ? tileOptions : [];
  if (!options.length) return [];

  return sortByThemeScore(options, (option) => {
    const catalogId = normalizeToken(option?.id || option?.value);
    const group = normalizeToken(option?.group);
    const behaviorProfileId = normalizeToken(option?.behaviorProfileId);
    const label = normalizeToken(option?.label);

    let score = 0;
    score += getScoreByOrderedMatch(catalogId, profile.tile.preferredCatalogIds, 120);
    score += getScoreByOrderedMatch(group, profile.tile.preferredGroups, 70);
    score += getScoreByOrderedMatch(behaviorProfileId, profile.tile.preferredBehaviorProfileIds, 55);
    score += getScoreByKeywordMatch(`${catalogId} ${group} ${label}`, profile.tile.keywordHints, 5, 20);
    return score;
  });
}

export function rankBackgroundMaterialOptionsForTheme(materialOptions, themeId) {
  const profile = getThemeProfile(themeId);
  const options = Array.isArray(materialOptions) ? materialOptions : [];
  if (!options.length) return [];

  return sortByThemeScore(options, (option) => {
    const materialId = normalizeToken(option?.id);
    const label = normalizeToken(option?.label);
    const group = normalizeToken(option?.group);
    const img = normalizeToken(option?.img);

    let score = 0;
    score += getScoreByOrderedMatch(materialId, profile.background.preferredMaterialIds, 120);
    score += getScoreByKeywordMatch(`${materialId} ${label} ${group} ${img}`, profile.background.keywordHints, 6, 30);
    return score;
  });
}

export function rankSoundAssetOptionsForTheme(soundAssetOptions, themeId, soundType = "") {
  const profile = getThemeProfile(themeId);
  const options = Array.isArray(soundAssetOptions) ? soundAssetOptions : [];
  if (!options.length) return [];

  const normalizedSoundType = normalizeToken(soundType);
  const ambientWeightBoost = normalizedSoundType === "ambientzone" ? 1 : 0.35;

  return sortByThemeScore(options, (option) => {
    const path = normalizeToken(option?.value);
    const category = normalizeToken(option?.category);
    const hint = normalizeToken(option?.hint);
    const label = normalizeToken(option?.label);

    let score = 0;
    score += getScoreByOrderedMatch(path, profile.audio.preferredAmbientAssetPaths, 120) * ambientWeightBoost;
    score += getScoreByOrderedMatch(category, profile.audio.preferredCategories, 36) * ambientWeightBoost;
    score += getScoreByKeywordMatch(path, profile.audio.preferredPathKeywords, 5, 24) * ambientWeightBoost;
    score += getScoreByKeywordMatch(`${hint} ${label}`, profile.audio.preferredHintKeywords, 4, 12) * ambientWeightBoost;
    return score;
  });
}

export function getThemeDefaultAmbientAssetPath(themeId) {
  const profile = getThemeProfile(themeId);
  return profile.audio.defaultAmbientAssetPath || null;
}
