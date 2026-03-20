export function normalizeSoundSourceValue(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export function getAuthoredSoundSource(sound) {
  const candidates = [
    sound?.source,
    sound?.asset,
    sound?.params?.source,
    sound?.params?.src,
    sound?.params?.url,
    sound?.params?.path,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeSoundSourceValue(candidate);
    if (normalized) return normalized;
  }

  return null;
}
