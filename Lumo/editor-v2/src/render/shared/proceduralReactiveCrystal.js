export function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
export function lerp(from, to, t) { return from + ((to - from) * t); }

export function clamp01(v) { return clamp(v, 0, 1); }

export function parseColorHex(value, fallback) {
  const source = typeof value === "string" ? value.trim() : "";
  const normalized = /^#[0-9a-fA-F]{6}$/.test(source) ? source : fallback;
  return { r: parseInt(normalized.slice(1, 3), 16), g: parseInt(normalized.slice(3, 5), 16), b: parseInt(normalized.slice(5, 7), 16) };
}

export function randFactory(seed) {
  let s = (Number.isFinite(seed) ? seed : 1) >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function buildCrystalClusters(patch) {
  const rnd = randFactory(patch.seed);
  const shardCount = Math.max(5, Math.min(14, Math.round(patch.width / 34) + Math.floor(rnd() * 4)));
  const shards = [];
  for (let i = 0; i < shardCount; i += 1) {
    const px = patch.x - patch.width * 0.5 + rnd() * patch.width;
    const h = patch.heightMax * (0.22 + rnd() * 0.78);
    shards.push({
      x: px,
      y: patch.y,
      w: 10 + rnd() * 22,
      h,
      lean: (rnd() - 0.5) * 28,
      jag: (rnd() - 0.5) * 8,
      alpha: 0.62 + rnd() * 0.34,
      core: rnd() > 0.55,
      layer: rnd(),
      phase: rnd() * 10,
    });
  }
  shards.sort((a, b) => a.layer - b.layer || a.h - b.h);
  const chips = Array.from({ length: Math.floor(8 + rnd() * 18) }, () => ({
    x: patch.x - patch.width * 0.5 + rnd() * patch.width,
    y: patch.y - rnd() * 14,
    w: 2 + rnd() * 8,
    h: 2 + rnd() * 5,
    a: rnd() * Math.PI,
  }));
  const sparks = Array.from({ length: Math.floor(8 + rnd() * 16) }, () => ({
    x: patch.x - patch.width * 0.5 + rnd() * patch.width,
    y: patch.y - patch.heightMax * rnd(),
    r: 0.8 + rnd() * 1.8,
    phase: rnd() * 10,
  }));
  return { shards, chips, sparks };
}
