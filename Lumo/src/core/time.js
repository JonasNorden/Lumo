(() => {
  window.Lumo = window.Lumo || {};
  const Time = {
    dt: 0,
    t: 0,
    _last: 0,
    start(){
      this._last = performance.now();
    },
    tick(){
      const now = performance.now();
      let dt = (now - this._last) / 1000;
      this._last = now;
      // Clamp for stability
      dt = Math.min(dt, 1/30);
      this.dt = dt;
      this.t += dt;
      return dt;
    }
  };

  Lumo.Time = Time;
})();
