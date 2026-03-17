export function getLineCells(startCell, endCell) {
  const cells = [];

  let x0 = startCell.x;
  let y0 = startCell.y;
  const x1 = endCell.x;
  const y1 = endCell.y;

  const deltaX = Math.abs(x1 - x0);
  const deltaY = Math.abs(y1 - y0);
  const stepX = x0 < x1 ? 1 : -1;
  const stepY = y0 < y1 ? 1 : -1;
  let error = deltaX - deltaY;

  while (true) {
    cells.push({ x: x0, y: y0 });

    if (x0 === x1 && y0 === y1) {
      break;
    }

    const doubleError = error * 2;

    if (doubleError > -deltaY) {
      error -= deltaY;
      x0 += stepX;
    }

    if (doubleError < deltaX) {
      error += deltaX;
      y0 += stepY;
    }
  }

  return cells;
}
