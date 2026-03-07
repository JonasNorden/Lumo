(() => {
  window.Lumo = window.Lumo || {};

  class Camera {
    constructor(){
      this.x = 0; this.y = 0;
      this.w = 1280; this.h = 720;
      this.smooth = 0.10;
    }
    resize(w,h){ this.w = w; this.h = h; }

    _clampAxis(pos, worldSize, viewSize){
      if (worldSize <= viewSize){
        // Center the world in the viewport (letterbox evenly)
        return -Math.floor((viewSize - worldSize) / 2);
      }
      return Math.max(0, Math.min(pos, worldSize - viewSize));
    }


    follow(target, worldPxW, worldPxH){
      const desiredX = target.x + target.w/2 - this.w/2;
      const desiredY = target.y + target.h/2 - this.h/2;

      this.x += (desiredX - this.x) * this.smooth;
      this.y += (desiredY - this.y) * this.smooth;

      // Clamp
      this.x = this._clampAxis(this.x, worldPxW, this.w);
      this.y = this._clampAxis(this.y, worldPxH, this.h);
    }

    snapTo(target, worldPxW, worldPxH){
      const desiredX = target.x + target.w/2 - this.w/2;
      const desiredY = target.y + target.h/2 - this.h/2;

      this.x = desiredX;
      this.y = desiredY;

      // Clamp (same as follow)
      this.x = Math.max(0, Math.min(this.x, worldPxW - this.w));
      this.y = Math.max(0, Math.min(this.y, worldPxH - this.h));
    }


    worldToScreen(wx, wy){
      return { x: wx - this.x, y: wy - this.y };
    }
  }

  Lumo.Camera = Camera;
})();
