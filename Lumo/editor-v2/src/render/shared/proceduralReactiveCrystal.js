export function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
export function clamp01(v) { return clamp(v, 0, 1); }
export function lerp(a, b, t) { return a + ((b - a) * t); }
export function seeded(seed) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}
export function parseColorHex(value, fallback) {
  const source = typeof value === "string" ? value.trim() : "";
  const normalized = /^#[0-9a-fA-F]{6}$/.test(source) ? source : fallback;
  return { r: parseInt(normalized.slice(1, 3), 16), g: parseInt(normalized.slice(3, 5), 16), b: parseInt(normalized.slice(5, 7), 16) };
}
export function buildCrystalClusters(patch) {
  const clusterTotal = clamp(Math.round((patch.clusterCount || 8) * 0.85 + patch.width / 60), 2, 16);
  const clusters = [];
  for (let i = 0; i < clusterTotal; i += 1) {
    const u = clusterTotal <= 1 ? 0.5 : i / (clusterTotal - 1);
    const cx = patch.x - patch.width * 0.5 + u * patch.width + (seeded(patch.seed + i * 29.7) - 0.5) * (patch.width / clusterTotal) * 0.55;
    const shardCount = clamp(Math.round(5 + seeded(patch.seed + i * 7.1) * 9), 5, 14);
    const baseRadius = 8 + seeded(patch.seed + i * 3.31) * 14;
    const shards = [];
    for (let s = 0; s < shardCount; s += 1) {
      const sideJitter = (seeded(patch.seed + i * 17.11 + s * 5.3) - 0.5) * baseRadius * 1.25;
      const height = lerp(patch.heightMin, patch.heightMax, seeded(patch.seed + i * 13.9 + s * 4.7));
      const lean = (seeded(patch.seed + i * 19.7 + s * 6.1) - 0.5) * 0.34;
      shards.push({ sideJitter, height, lean, halfW: 2.6 + seeded(patch.seed + i * 11.4 + s * 3.6) * 6.2, facet: seeded(patch.seed + i * 31.2 + s * 9.9), phase: seeded(patch.seed + i * 41.2 + s * 7.7) * Math.PI * 2 });
    }
    clusters.push({ x: cx, y: patch.y, baseRadius, phase: seeded(patch.seed + i * 47.9) * Math.PI * 2, sparklePhase: seeded(patch.seed + i * 59.3) * Math.PI * 2, shards });
  }
  return clusters;
}
