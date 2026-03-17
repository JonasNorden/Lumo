import { getTileIndex } from "../level/levelDocument.js";

function isCellWithinBounds(x, y, width, height) {
  return x >= 0 && y >= 0 && x < width && y < height;
}

export function getFloodFillCells(doc, startCell, replacementValue) {
  if (!doc || !startCell) return [];

  const { width, height } = doc.dimensions;
  if (!isCellWithinBounds(startCell.x, startCell.y, width, height)) return [];

  const startIndex = getTileIndex(width, startCell.x, startCell.y);
  const targetValue = doc.tiles.base[startIndex];

  if (targetValue === replacementValue) {
    return [];
  }

  const queue = [{ x: startCell.x, y: startCell.y }];
  const visited = new Set([startIndex]);
  const fillCells = [];

  while (queue.length > 0) {
    const cell = queue.shift();
    if (!cell) continue;

    const index = getTileIndex(width, cell.x, cell.y);
    if (doc.tiles.base[index] !== targetValue) continue;

    fillCells.push(cell);

    const neighbors = [
      { x: cell.x, y: cell.y - 1 },
      { x: cell.x, y: cell.y + 1 },
      { x: cell.x - 1, y: cell.y },
      { x: cell.x + 1, y: cell.y },
    ];

    for (const neighbor of neighbors) {
      if (!isCellWithinBounds(neighbor.x, neighbor.y, width, height)) continue;

      const neighborIndex = getTileIndex(width, neighbor.x, neighbor.y);
      if (visited.has(neighborIndex)) continue;

      visited.add(neighborIndex);
      queue.push(neighbor);
    }
  }

  return fillCells;
}
