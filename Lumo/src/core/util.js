(() => {
  window.Lumo = window.Lumo || {};
  const U = {};

  U.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  U.lerp  = (a, b, t) => a + (b - a) * t;

  U.aabb = (ax, ay, aw, ah, bx, by, bw, bh) =>
    ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;

  U.now = () => performance.now();

  Lumo.U = U;
})();
