import { getTileIndex } from "../level/levelDocument.js";

export function getBackgroundFloodFillCells(doc, startCell, replacementValue) {
  if (!doc || !startCell) return [];
  const { width, height } = doc.dimensions;
  if (startCell.x < 0 || startCell.y < 0 || startCell.x >= width || startCell.y >= height) return [];

  const startIndex = getTileIndex(width, startCell.x, startCell.y);
  const targetValue = doc.background.base[startIndex] ?? null;
  if (targetValue === replacementValue) return [];

  const queue = [{ x: startCell.x, y: startCell.y }];
  const visited = new Set([startIndex]);
  const fillCells = [];

  while (queue.length > 0) {
    const cell = queue.shift();
    if (!cell) continue;
    const index = getTileIndex(width, cell.x, cell.y);
    if ((doc.background.base[index] ?? null) !== targetValue) continue;
    fillCells.push(cell);

    const neighbors = [
      { x: cell.x - 1, y: cell.y },
      { x: cell.x + 1, y: cell.y },
      { x: cell.x, y: cell.y - 1 },
      { x: cell.x, y: cell.y + 1 },
    ];

    for (const neighbor of neighbors) {
      if (neighbor.x < 0 || neighbor.y < 0 || neighbor.x >= width || neighbor.y >= height) continue;
      const neighborIndex = getTileIndex(width, neighbor.x, neighbor.y);
      if (visited.has(neighborIndex)) continue;
      visited.add(neighborIndex);
      queue.push(neighbor);
    }
  }

  return fillCells;
}
