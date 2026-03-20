const imageCache = new Map();

function canCreateImage() {
  return typeof Image !== "undefined";
}

export function getSpriteImage(src) {
  if (!src || !canCreateImage()) return null;

  const cached = imageCache.get(src);
  if (cached) return cached;

  const image = new Image();
  image.decoding = "async";
  image.loading = "eager";
  image._loaded = false;
  image._error = false;
  image.addEventListener("load", () => {
    image._loaded = true;
    image._error = false;
  });
  image.addEventListener("error", () => {
    image._error = true;
  });
  image.src = src;
  imageCache.set(src, image);
  return image;
}

export function isSpriteReady(image) {
  return Boolean(image && !image._error && (image._loaded || image.complete) && image.naturalWidth > 0 && image.naturalHeight > 0);
}
