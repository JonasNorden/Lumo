#!/usr/bin/env node
import { createServer } from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../..");
const TILE_ASSET_DIR = path.join(REPO_ROOT, "data/assets/tiles");
const TILE_CATALOG_FILE = path.join(REPO_ROOT, "data/catalog_tiles.js");
const BACKGROUND_ASSET_DIR = path.join(REPO_ROOT, "data/assets/sprites/bg");
const BACKGROUND_RUNTIME_CATALOG_FILE = path.join(REPO_ROOT, "data/catalog_bg.js");
const BACKGROUND_EDITOR_MATERIAL_FILE = path.join(
  REPO_ROOT,
  "editor-v2/src/domain/background/materialCatalog.js"
);
const PORT = Number.parseInt(process.env.LUMO_TILE_BRIDGE_PORT || "4180", 10);

function writeJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(payload));
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 25 * 1024 * 1024) reject(new Error("request-too-large"));
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(raw || "{}"));
      } catch {
        reject(new Error("invalid-json"));
      }
    });
    req.on("error", reject);
  });
}

function isSafeCatalogId(value) {
  return typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.trim());
}

function isSafeBackgroundMaterialId(value) {
  return typeof value === "string" && /^[a-z0-9]+(?:[_-][a-z0-9]+)*$/.test(value.trim());
}

function sanitizeSpriteBaseName(value) {
  const base = String(value || "tile")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "tile";
}

function getExtensionFromFileName(fileName) {
  const ext = path.extname(String(fileName || "")).toLowerCase();
  if (ext === ".png" || ext === ".jpg" || ext === ".jpeg" || ext === ".webp") return ext;
  return ".png";
}

function parseDataUrl(dataUrl) {
  const match = /^data:([^;,]+);base64,(.+)$/i.exec(String(dataUrl || ""));
  if (!match) return null;
  return { mimeType: match[1].toLowerCase(), base64Data: match[2] };
}

function readCatalogTiles(catalogSource) {
  const context = vm.createContext({ window: {} });
  vm.runInContext(catalogSource, context, { filename: "catalog_tiles.js" });
  return Array.isArray(context.window.LUMO_CATALOG_TILES) ? context.window.LUMO_CATALOG_TILES : [];
}

function serializeCatalogEntry(entry) {
  return `  {\n    id: ${JSON.stringify(entry.id)},\n    name: ${JSON.stringify(entry.name)},\n    group: ${JSON.stringify(entry.group)},\n    img: ${JSON.stringify(entry.img)},\n    footprint: { w: ${entry.footprint.w}, h: ${entry.footprint.h} },\n    tileId: ${entry.tileId},\n    collisionType: ${JSON.stringify(entry.collisionType)},\n    special: null,\n    drawW: ${entry.drawW},\n    drawH: ${entry.drawH},\n    drawAnchor: ${JSON.stringify(entry.drawAnchor)},\n    drawOffX: 0,\n    drawOffY: 0\n  }`;
}

function serializeBackgroundMaterialEntry(entry) {
  return `  {\n    id: ${JSON.stringify(entry.id)},\n    label: ${JSON.stringify(entry.label)},\n    img: ${JSON.stringify(entry.img)},\n    drawW: ${entry.drawW},\n    drawH: ${entry.drawH},\n    drawAnchor: "BL",\n    drawOffX: 0,\n    drawOffY: 0,\n    footprint: { w: ${entry.footprint.w}, h: ${entry.footprint.h} },\n    fallbackColor: ${JSON.stringify(entry.fallbackColor)},\n    group: ${JSON.stringify(entry.group)}\n  }`;
}

function serializeRuntimeBackgroundCatalogEntry(entry) {
  return `  {\n    "id": ${JSON.stringify(entry.id)},\n    "name": ${JSON.stringify(entry.name)},\n    "group": ${JSON.stringify(entry.group)},\n    "img": ${JSON.stringify(entry.img)},\n    "w": ${entry.w},\n    "h": ${entry.h},\n    "anchor": "BL"\n  }`;
}

function findArrayBoundsFromIndex(source, startIndex) {
  if (!Number.isInteger(startIndex) || startIndex < 0) return null;
  const arrayStartIndex = source.indexOf("[", startIndex);
  if (arrayStartIndex < 0) return null;
  const arrayEndIndex = findMatchingArrayEndIndex(source, arrayStartIndex);
  if (arrayEndIndex < 0) return null;
  return { arrayStartIndex, arrayEndIndex };
}

function findMatchingArrayEndIndex(source, arrayStartIndex) {
  let depth = 0;
  let inString = false;
  let stringQuote = "";
  let inLineComment = false;
  let inBlockComment = false;
  let isEscaped = false;

  for (let index = arrayStartIndex; index < source.length; index += 1) {
    const current = source[index];
    const next = source[index + 1] || "";

    if (inLineComment) {
      if (current === "\n") inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (current === "*" && next === "/") {
        inBlockComment = false;
        index += 1;
      }
      continue;
    }
    if (inString) {
      if (isEscaped) {
        isEscaped = false;
        continue;
      }
      if (current === "\\") {
        isEscaped = true;
        continue;
      }
      if (current === stringQuote) {
        inString = false;
        stringQuote = "";
      }
      continue;
    }

    if (current === "/" && next === "/") {
      inLineComment = true;
      index += 1;
      continue;
    }
    if (current === "/" && next === "*") {
      inBlockComment = true;
      index += 1;
      continue;
    }
    if (current === "'" || current === "\"" || current === "`") {
      inString = true;
      stringQuote = current;
      continue;
    }
    if (current === "[") {
      depth += 1;
      continue;
    }
    if (current === "]") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function findArrayBoundsByMarker(source, marker) {
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) return null;
  return findArrayBoundsFromIndex(source, markerIndex);
}

function findTileCatalogArrayBounds(catalogSource) {
  const catalogKeyIndex = catalogSource.indexOf("window.LUMO_CATALOG_TILES");
  if (catalogKeyIndex < 0) return null;
  return findArrayBoundsFromIndex(catalogSource, catalogKeyIndex);
}

function findBackgroundEditorMaterialArrayBounds(source) {
  const declarationMarker = "const BUILTIN_BACKGROUND_MATERIALS";
  const declarationIndex = source.indexOf(declarationMarker);
  if (declarationIndex < 0) return null;

  const assignmentIndex = source.indexOf("=", declarationIndex + declarationMarker.length);
  if (assignmentIndex < 0) return null;

  const arrayStartIndex = source.indexOf("[", assignmentIndex);
  if (arrayStartIndex < 0) return null;

  const arrayEndIndex = findMatchingArrayEndIndex(source, arrayStartIndex);
  if (arrayEndIndex < 0) return null;
  if (arrayStartIndex <= declarationIndex || arrayEndIndex <= arrayStartIndex) return null;

  return { arrayStartIndex, arrayEndIndex };
}

function buildCatalogSourceWithInsertedEntry(source, arrayBounds, entryText, hasExistingEntries) {
  const { arrayEndIndex } = arrayBounds;
  const beforeEnd = source.slice(0, arrayEndIndex);
  const afterEnd = source.slice(arrayEndIndex);
  const trimmedBeforeEnd = beforeEnd.replace(/\s*$/, "");

  if (!hasExistingEntries) {
    return `${trimmedBeforeEnd}\n${entryText}\n${afterEnd}`;
  }

  const needsComma = !trimmedBeforeEnd.endsWith(",");
  const commaPrefix = needsComma ? "," : "";
  return `${trimmedBeforeEnd}${commaPrefix}\n\n${entryText}\n${afterEnd}`;
}

async function pickAvailableSpriteFileName(targetDir, catalogId, sourceFileName) {
  const ext = getExtensionFromFileName(sourceFileName);
  const base = sanitizeSpriteBaseName(catalogId);
  let attempt = 1;
  while (attempt <= 500) {
    const name = attempt === 1 ? `${base}${ext}` : `${base}-${attempt}${ext}`;
    const fullPath = path.join(targetDir, name);
    try {
      await fs.access(fullPath);
      attempt += 1;
    } catch {
      return name;
    }
  }
  throw new Error("sprite-name-exhausted");
}

async function saveTile(payload) {
  const tile = payload?.tile || {};
  const sprite = payload?.sprite || {};

  const catalogId = String(tile.catalogId || "").trim();
  if (!isSafeCatalogId(catalogId)) {
    return {
      ok: false,
      statusCode: 400,
      reason: "invalid-catalog-id",
      message: "Catalog id must be lowercase kebab-case (a-z, 0-9, -).",
    };
  }

  const dataUrlParts = parseDataUrl(sprite.dataUrl);
  if (!dataUrlParts) {
    return {
      ok: false,
      statusCode: 400,
      reason: "invalid-sprite-data",
      message: "Sprite payload must be a base64 data URL.",
    };
  }
  if (!dataUrlParts.mimeType.startsWith("image/")) {
    return {
      ok: false,
      statusCode: 400,
      reason: "invalid-sprite-type",
      message: "Sprite payload must be an image file.",
    };
  }

  const catalogSource = await fs.readFile(TILE_CATALOG_FILE, "utf8");
  const tiles = readCatalogTiles(catalogSource);
  if (tiles.some((entry) => String(entry?.id || "").toLowerCase() === catalogId.toLowerCase())) {
    return {
      ok: false,
      statusCode: 409,
      reason: "duplicate-catalog-id",
      message: `Tile catalog id "${catalogId}" already exists.`,
    };
  }

  await fs.mkdir(TILE_ASSET_DIR, { recursive: true });
  const spriteFileName = await pickAvailableSpriteFileName(TILE_ASSET_DIR, catalogId, sprite.fileName);
  const spriteFilePath = path.join(TILE_ASSET_DIR, spriteFileName);
  await fs.writeFile(spriteFilePath, Buffer.from(dataUrlParts.base64Data, "base64"));

  const numericTileId = Number.parseInt(tile.tileId, 10);
  const drawW = Number.parseInt(tile.drawW, 10);
  const drawH = Number.parseInt(tile.drawH, 10);
  const footprintW = Math.max(1, Number.parseInt(tile?.footprint?.w, 10) || 1);
  const footprintH = Math.max(1, Number.parseInt(tile?.footprint?.h, 10) || 1);

  const tileEntry = {
    id: catalogId,
    name: String(tile.label || catalogId).trim() || catalogId,
    group: String(tile.group || "Custom").trim() || "Custom",
    img: `data/assets/tiles/${spriteFileName}`,
    footprint: { w: footprintW, h: footprintH },
    tileId: Number.isInteger(numericTileId) ? numericTileId : 15,
    collisionType: String(tile.collisionType || "solid"),
    drawW: Number.isInteger(drawW) && drawW > 0 ? drawW : 24,
    drawH: Number.isInteger(drawH) && drawH > 0 ? drawH : 24,
    drawAnchor: tile.drawAnchor === "BL" ? "BL" : "TL",
  };

  const arrayBounds = findTileCatalogArrayBounds(catalogSource);
  if (!arrayBounds) {
    return {
      ok: false,
      statusCode: 500,
      reason: "catalog-format-unsupported",
      message: "Could not safely locate tile catalog array",
    };
  }

  const nextCatalogSource = buildCatalogSourceWithInsertedEntry(
    catalogSource,
    arrayBounds,
    serializeCatalogEntry(tileEntry),
    tiles.length > 0
  );
  await fs.writeFile(TILE_CATALOG_FILE, nextCatalogSource, "utf8");

  return {
    ok: true,
    statusCode: 200,
    message: `Tile persisted as ${catalogId}.`,
    persistedTile: {
      catalogId: tileEntry.id,
      label: tileEntry.name,
      tileId: tileEntry.tileId,
      img: `../${tileEntry.img}`,
      drawW: tileEntry.drawW,
      drawH: tileEntry.drawH,
      drawAnchor: tileEntry.drawAnchor,
      footprint: tileEntry.footprint,
      collisionType: tileEntry.collisionType,
      group: tileEntry.group,
      spriteFileName,
    },
  };
}

function readBackgroundMaterialEntries(source) {
  const context = vm.createContext({});
  const executableSource = source.replace(/^export\s+/gm, "");
  vm.runInContext(
    `${executableSource}\n;globalThis.__bg = BUILTIN_BACKGROUND_MATERIALS;`,
    context,
    { filename: "materialCatalog.js" }
  );
  return Array.isArray(context.__bg) ? context.__bg : [];
}

function readRuntimeBackgroundCatalogEntries(source) {
  const context = vm.createContext({ window: {} });
  vm.runInContext(source, context, { filename: "catalog_bg.js" });
  return Array.isArray(context.window.LUMO_CATALOG_BG) ? context.window.LUMO_CATALOG_BG : [];
}

async function saveBackground(payload) {
  const background = payload?.background || {};
  const sprite = payload?.sprite || {};
  const materialId = String(background.materialId || "").trim();

  if (!isSafeBackgroundMaterialId(materialId)) {
    return {
      ok: false,
      statusCode: 400,
      reason: "invalid-material-id",
      message: "Material id must be lowercase with letters, numbers, underscores, or hyphens.",
    };
  }

  const dataUrlParts = parseDataUrl(sprite.dataUrl);
  if (!dataUrlParts) {
    return {
      ok: false,
      statusCode: 400,
      reason: "invalid-sprite-data",
      message: "Sprite payload must be a base64 data URL.",
    };
  }
  if (!dataUrlParts.mimeType.startsWith("image/")) {
    return {
      ok: false,
      statusCode: 400,
      reason: "invalid-sprite-type",
      message: "Sprite payload must be an image file.",
    };
  }

  const [editorMaterialSource, runtimeCatalogSource] = await Promise.all([
    fs.readFile(BACKGROUND_EDITOR_MATERIAL_FILE, "utf8"),
    fs.readFile(BACKGROUND_RUNTIME_CATALOG_FILE, "utf8"),
  ]);

  const editorMaterials = readBackgroundMaterialEntries(editorMaterialSource);
  const runtimeCatalogEntries = readRuntimeBackgroundCatalogEntries(runtimeCatalogSource);

  const hasDuplicate =
    editorMaterials.some((entry) => String(entry?.id || "").toLowerCase() === materialId.toLowerCase()) ||
    runtimeCatalogEntries.some((entry) => String(entry?.id || "").toLowerCase() === materialId.toLowerCase());

  if (hasDuplicate) {
    return {
      ok: false,
      statusCode: 409,
      reason: "duplicate-material-id",
      message: `Background material id "${materialId}" already exists.`,
    };
  }

  await fs.mkdir(BACKGROUND_ASSET_DIR, { recursive: true });
  const spriteFileName = await pickAvailableSpriteFileName(
    BACKGROUND_ASSET_DIR,
    materialId,
    sprite.fileName
  );
  const spriteFilePath = path.join(BACKGROUND_ASSET_DIR, spriteFileName);
  await fs.writeFile(spriteFilePath, Buffer.from(dataUrlParts.base64Data, "base64"));

  const drawW = Number.parseInt(background.drawW, 10);
  const drawH = Number.parseInt(background.drawH, 10);
  const footprintW = Math.max(1, Number.parseInt(background?.footprint?.w, 10) || 1);
  const footprintH = Math.max(1, Number.parseInt(background?.footprint?.h, 10) || 1);

  const entry = {
    id: materialId,
    label: String(background.label || materialId).trim() || materialId,
    group: String(background.group || "Custom").trim() || "Custom",
    img: `../data/assets/sprites/bg/${spriteFileName}`,
    runtimeImg: `data/assets/sprites/bg/${spriteFileName}`,
    drawW: Number.isInteger(drawW) && drawW > 0 ? drawW : 24,
    drawH: Number.isInteger(drawH) && drawH > 0 ? drawH : 24,
    fallbackColor: String(background.fallbackColor || "#3d4b63"),
    footprint: { w: footprintW, h: footprintH },
  };

  const editorBounds = findBackgroundEditorMaterialArrayBounds(editorMaterialSource);
  if (!editorBounds) {
    return {
      ok: false,
      statusCode: 500,
      reason: "catalog-format-unsupported",
      message: "Could not safely locate BUILTIN_BACKGROUND_MATERIALS array",
    };
  }

  const runtimeBounds = findArrayBoundsByMarker(runtimeCatalogSource, "window.LUMO_CATALOG_BG");
  if (!runtimeBounds) {
    return {
      ok: false,
      statusCode: 500,
      reason: "catalog-format-unsupported",
      message: "Could not safely locate runtime background catalog array.",
    };
  }

  const nextEditorSource = buildCatalogSourceWithInsertedEntry(
    editorMaterialSource,
    editorBounds,
    serializeBackgroundMaterialEntry(entry),
    editorMaterials.length > 0
  );

  const nextRuntimeSource = buildCatalogSourceWithInsertedEntry(
    runtimeCatalogSource,
    runtimeBounds,
    serializeRuntimeBackgroundCatalogEntry({
      id: entry.id,
      name: entry.label,
      group: entry.group,
      img: entry.runtimeImg,
      w: entry.drawW,
      h: entry.drawH,
    }),
    runtimeCatalogEntries.length > 0
  );

  await Promise.all([
    fs.writeFile(BACKGROUND_EDITOR_MATERIAL_FILE, nextEditorSource, "utf8"),
    fs.writeFile(BACKGROUND_RUNTIME_CATALOG_FILE, nextRuntimeSource, "utf8"),
  ]);

  return {
    ok: true,
    statusCode: 200,
    message: `Background persisted as ${materialId}.`,
    persistedBackground: {
      materialId: entry.id,
      label: entry.label,
      img: entry.img,
      drawW: entry.drawW,
      drawH: entry.drawH,
      drawAnchor: "BL",
      drawOffX: 0,
      drawOffY: 0,
      footprint: entry.footprint,
      fallbackColor: entry.fallbackColor,
      group: entry.group,
      spriteFileName,
    },
  };
}

const server = createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    writeJson(res, 204, {});
    return;
  }

  if (req.method === "POST" && req.url === "/api/editor-v2/tiles/save") {
    try {
      const body = await parseJsonBody(req);
      const result = await saveTile(body);
      writeJson(res, result.statusCode, result);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown-error";
      writeJson(res, 500, {
        ok: false,
        reason,
        message: "Tile persistence bridge failed while writing local files.",
      });
    }
    return;
  }

  if (req.method === "POST" && req.url === "/api/editor-v2/background/save") {
    try {
      const body = await parseJsonBody(req);
      const result = await saveBackground(body);
      writeJson(res, result.statusCode, result);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown-error";
      writeJson(res, 500, {
        ok: false,
        reason,
        message: "Background persistence bridge failed while writing local files.",
      });
    }
    return;
  }

  writeJson(res, 404, { ok: false, reason: "not-found", message: "Endpoint not found." });
});

server.listen(PORT, () => {
  console.log(`[tile-save-bridge] listening on http://localhost:${PORT}`);
  console.log(`[tile-save-bridge] tile assets => ${TILE_ASSET_DIR}`);
  console.log(`[tile-save-bridge] tile catalog => ${TILE_CATALOG_FILE}`);
  console.log(`[tile-save-bridge] background assets => ${BACKGROUND_ASSET_DIR}`);
  console.log(`[tile-save-bridge] background editor catalog => ${BACKGROUND_EDITOR_MATERIAL_FILE}`);
  console.log(`[tile-save-bridge] background runtime catalog => ${BACKGROUND_RUNTIME_CATALOG_FILE}`);
});