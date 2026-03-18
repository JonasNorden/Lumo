function hashSeed(value) {
  const input = String(value || "layer");
  let hash = 0;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function getParallaxOffset(viewportOffset, depth, axisScale = 1) {
  return viewportOffset * depth * axisScale;
}

function getLayerBandMetrics(canvasHeight, index, depth) {
  const bandBase = canvasHeight * (0.42 + Math.min(0.26, depth * 0.22));
  const bandSpacing = Math.min(canvasHeight * 0.12, 42);
  const topY = bandBase + index * bandSpacing;
  const amplitude = 12 + depth * 26 + index * 4;

  return {
    topY,
    amplitude,
  };
}

function createLayerProfile(layer, topY, amplitude) {
  const seed = hashSeed(layer.id);
  const profile = [];

  for (let index = 0; index < 6; index += 1) {
    const noise = ((seed >> ((index % 4) * 6)) & 0x3f) / 63;
    const wave = Math.sin((index + 1) * (0.75 + layer.depth)) * 0.5 + 0.5;
    const pointY = topY + (noise - 0.5) * amplitude * 0.8 + (wave - 0.5) * amplitude * 0.65;
    profile.push(pointY);
  }

  return profile;
}

function renderColorLayer(ctx, canvas, layer, index, viewport) {
  const depth = Number.isFinite(layer.depth) ? Math.max(0, Math.min(1, layer.depth)) : 0;
  const color = layer.color || "#1b2436";
  const parallaxX = getParallaxOffset(viewport.offsetX, depth, 0.65);
  const parallaxY = getParallaxOffset(viewport.offsetY, depth, 0.18);
  const bandMetrics = getLayerBandMetrics(canvas.height, index, depth);
  const topY = bandMetrics.topY + parallaxY;
  const profile = createLayerProfile(layer, topY, bandMetrics.amplitude);
  const startX = -canvas.width * 0.3 + parallaxX;
  const segmentWidth = (canvas.width * 1.6) / (profile.length - 1);

  ctx.fillStyle = color;

  if (index === 0) {
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.beginPath();
  ctx.moveTo(startX, canvas.height);

  for (let profileIndex = 0; profileIndex < profile.length; profileIndex += 1) {
    ctx.lineTo(startX + segmentWidth * profileIndex, profile[profileIndex]);
  }

  ctx.lineTo(startX + segmentWidth * (profile.length - 1), canvas.height);
  ctx.closePath();
  ctx.fill();
}

export function renderBackgroundLayers(ctx, doc, viewport) {
  const layers = (doc.backgrounds?.layers || []).filter((layer) => layer?.visible);
  if (!layers.length) return;

  const canvasRect = ctx.canvas.getBoundingClientRect();
  const canvas = {
    width: canvasRect.width || ctx.canvas.width,
    height: canvasRect.height || ctx.canvas.height,
  };
  const orderedLayers = [...layers].sort((left, right) => (left.depth ?? 0) - (right.depth ?? 0));

  for (let index = 0; index < orderedLayers.length; index += 1) {
    const layer = orderedLayers[index];

    if (layer.type !== "color") {
      continue;
    }

    renderColorLayer(ctx, canvas, layer, index, viewport);
  }
}
