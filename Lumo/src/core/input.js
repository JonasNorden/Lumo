(() => {
  window.Lumo = window.Lumo || {};

  class Input {
    constructor(){
      this.keys = Object.create(null);
      this.tapped = Object.create(null);
      this._tapArmed = Object.create(null);
    }

    init(){
      window.addEventListener("keydown", (e) => {
        const k = this._norm(e.key);
        if (!k) return;

        // Prevent scrolling on arrows/space
        if (k.startsWith("arrow") || k === " ") e.preventDefault();

        if (!this.keys[k]){
          // first down => can tap if armed
          if (this._tapArmed[k] !== false){
            this.tapped[k] = true;
            this._tapArmed[k] = false; // disarm until keyup
          }
        }
        this.keys[k] = true;
      }, { passive:false });

      window.addEventListener("keyup", (e) => {
        const k = this._norm(e.key);
        if (!k) return;
        this.keys[k] = false;
        this._tapArmed[k] = true; // re-arm tap only after release
      });

      // Default arm all
      for (const k of ["arrowleft","arrowright","arrowup","a","s","d"," "]){
        this._tapArmed[k] = true;
      }
    }

    _norm(key){
      if (!key) return null;
      const k = key.toLowerCase();
      if (k === " ") return " ";
      return k;
    }

    down(k){
      k = this._norm(k);
      return !!this.keys[k];
    }

    tap(k){
      k = this._norm(k);
      const v = !!this.tapped[k];
      this.tapped[k] = false;
      return v;
    }
  }

  Lumo.Input = new Input();
})();
