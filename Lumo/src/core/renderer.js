(() => {
  window.Lumo = window.Lumo || {};

  // Player light occlusion (visual only)
  // true = light is clipped by solid collision tiles (walls/ground)
  const ENABLE_PLAYER_LIGHT_OCCLUSION = true;

  // Premium tuning (single-point controls)
  // Master intensity for the PLAYER punch-out (core + edge + penumbra follow this)
  const PLAYER_PUNCH_INTENSITY = 0.55; // 0..1 (try 0.6..0.9)
  // How much of the player light radius is allowed to go DOWNWARDS (reduces glow under feet)
  const PLAYER_DOWNLIGHT = 0.20; // 0..1 (0.25 = less under Lumo, 1.0 = symmetric)
;
  const OCCLUSION_DEFAULTS = { rays: 312, stepPx: 1, featherPx: 45, penumbra: 1.7, contactGlowPx: 60, contactGlowIntensity: 1.2  };

  class Renderer {
    constructor(canvas){
      this.cv = canvas;
      this.ctx = canvas.getContext("2d", { alpha: true });
      this.ctx.imageSmoothingEnabled = false;

      // Offscreen darkness layer
      this.darkCv = document.createElement("canvas");
      this.darkCtx = this.darkCv.getContext("2d", { alpha: true });
      this.darkCtx.imageSmoothingEnabled = false;

      this.w = canvas.width;
      this.h = canvas.height;
      this.darkCv.width = this.w;
      this.darkCv.height = this.h;

      // UI-images (PNG) - paths relativt Lumo.html
      this.ui = {
        flare:   this._tryLoadImage("data/assets/ui/flare.png"),
        bulbOn:  this._tryLoadImage("data/assets/ui/bulb_on.png"),
        bulbOff: this._tryLoadImage("data/assets/ui/bulb_off.png")
      };

      // === Light FX tuning (visual only) ===
      // Keep changes here without hunting in logic.
      this.lightFX = {
        // Player "breathing" pulse linked to energy
        playerPulseHz: 0.35,         // tweak: speed of pulse
        playerPulseAmpMin: 0.008,    // tweak: amp at low energy
        playerPulseAmpMax: 0.030,    // tweak: amp at high energy

        // Lantern halo "comfort breathing"
        lanternBreathHz: 0.15,       // tweak: slow
        lanternBreathAmpR: 0.020,    // tweak: radius modulation
        lanternBreathAmpS: 0.040,    // tweak: strength modulation
        lanternFlickerHz: 5.5,       // tweak: tiny flicker for life
        lanternFlickerAmp: 0.010,

        // Firefly shimmer (subtle)
        fireflyShimmerHz: 2.2,
        fireflyShimmerAmp: 0.015,

        // Flare turbulence (subtle)
        flareTurbHz: 3.0,
        flareTurbAmp: 0.020
      };
    }


// === Light Occlusion context ===
setOcclusionContext(world, cam){
  this._occWorld = world || null;
  this._occCam = cam || null;
}

setOcclusionOptions(opts){
  this._occOpt = Object.assign({}, OCCLUSION_DEFAULTS, (opts||{}));
}

_occSolidAtWorld(wx, wy){
  const w = this._occWorld;
  if (!w || typeof w.queryTiles !== "function") return false;
  const tiles = w.queryTiles(wx, wy, 1, 1);
  for (const t of tiles){
    if (t && t.def && t.def.solid) return true;
  }
  return false;
}

_occBuildPolyScreen(sx, sy, radius){
  const cam = this._occCam;
  const w = this._occWorld;
  const opt = this._occOpt || OCCLUSION_DEFAULTS;
  if (!cam || !w) return null;

  const rays = Math.max(24, opt.rays|0);
  const step = Math.max(1, opt.stepPx|0);

  // Convert screen-space center -> world-space
  const wx0 = sx + cam.x;
  const wy0 = sy + cam.y;

  const pts = new Array(rays);
  const TAU = Math.PI * 2;

  for (let i=0;i<rays;i++){
    const ang = (i / rays) * TAU;
    const dx = Math.cos(ang);
    const dy = Math.sin(ang);

    // Reduce light travelling downward (under Lumo) without hard-cutting.
    const down = Math.max(0, dy); // 0 up/side, 1 straight down
    const rayRadius = radius * (1 - down * (1 - PLAYER_DOWNLIGHT));

    let hitDist = rayRadius;
    // march outward
    for (let d=0; d<=rayRadius; d+=step){
      const wx = wx0 + dx * d;
      const wy = wy0 + dy * d;
      if (this._occSolidAtWorld(wx, wy)){
        hitDist = Math.max(0, d - step); // back up one step for softness
        break;
      }
    }
    pts[i] = [ sx + dx * hitDist, sy + dy * hitDist ];
  }
  return pts;
}
    _tryLoadImage(src){
      try{
        const img = new Image();
        img.src = src;
        img._ok = false;
        img.onload = () => { img._ok = true; };
        img.onerror = () => { img._ok = false; };
        return img;
      }catch(_){
        return null;
      }
    }

    resizeToDisplaySize(){
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      const rect = this.cv.getBoundingClientRect();
      const w = Math.floor(rect.width * dpr);
      const h = Math.floor(rect.height * dpr);

      if (w !== this.cv.width || h !== this.cv.height){
        this.cv.width = w;
        this.cv.height = h;
        this.w = w; this.h = h;

        this.darkCv.width = w;
        this.darkCv.height = h;

        this.ctx.imageSmoothingEnabled = false;
        this.darkCtx.imageSmoothingEnabled = false;
        return true;
      }
      return false;
    }

    clear(){
      this.ctx.setTransform(1,0,0,1,0,0);
      this.ctx.fillStyle = "#000";
      this.ctx.fillRect(0,0,this.w,this.h);
    }

    // drawDarkness(lightX, lightY, r) ELLER drawDarkness([{x,y,r,strength}, ...])
    drawDarkness(a, b, c){
      let lights = null;

      if (Array.isArray(a)) {
        lights = a;
      } else {
        lights = [{ x:a, y:b, r:c, strength: 1.0 }];
      }

      const t = (window.Lumo && Lumo.Time && typeof Lumo.Time.t === "number") ? Lumo.Time.t : (performance.now() / 1000);
      const TAU = Math.PI * 2;
      const fx = this.lightFX || {};

      const dctx = this.darkCtx;

      dctx.setTransform(1,0,0,1,0,0);
      dctx.globalCompositeOperation = "source-over";
      dctx.clearRect(0,0,this.w,this.h);

      dctx.fillStyle = "rgba(0,0,0,0.93)";
      dctx.fillRect(0,0,this.w,this.h);

      dctx.globalCompositeOperation = "destination-out";

      for (const L of lights){
        if (!L) continue;
        const x = L.x, y = L.y;

        // Base values
        let r = Math.max(40, L.r || 0);
        let strength = (typeof L.strength === "number") ? L.strength : 1.0;

        // Visual-only modulation by kind (does NOT affect gameplay)
        const kind = L.kind || "";

// Player occlusion: clipped punch-out against solid collision tiles (visual only)
const occOn = (ENABLE_PLAYER_LIGHT_OCCLUSION === true) && (kind === "player") && this._occWorld && this._occCam;
if (occOn){
  if (!this._occOpt) this._occOpt = Object.assign({}, OCCLUSION_DEFAULTS);

  // Visual-only "breathing" pulse MUST apply even when occlusion is active.
  // Occlusion branch continues before the normal modulation below, so we mirror it here.
  const seed = (typeof L._seed === "number") ? L._seed : ((x * 0.013) + (y * 0.017)) % 1000;
  const e = Math.max(0, Math.min(1, (typeof L.energy === "number") ? L.energy : 1));
  const amp = (fx.playerPulseAmpMin ?? 0.008) + ((fx.playerPulseAmpMax ?? 0.030) - (fx.playerPulseAmpMin ?? 0.008)) * e;
  const hz  = (fx.playerPulseHz ?? 1.15);
  const s = Math.sin((t * hz) * TAU);
  r *= (1 + s * amp);
  // tiny strength breathing so light feels "alive"
  strength *= (0.985 + 0.015 * Math.sin((t * (hz * 0.9)) * TAU + seed));

  const pts = this._occBuildPolyScreen(x, y, r);

  if (pts && pts.length){
    dctx.save();
    dctx.beginPath();
    dctx.moveTo(pts[0][0], pts[0][1]);
    for (let i=1;i<pts.length;i++) dctx.lineTo(pts[i][0], pts[i][1]);
    dctx.closePath();

    const feather = Math.max(0, (this._occOpt.featherPx|0));
    dctx.shadowColor = "rgba(0,0,0,1)";
    dctx.shadowBlur = feather;

// destination-out: alpha removes darkness
const punch = Math.max(0.0, Math.min(1.0, strength * PLAYER_PUNCH_INTENSITY));

// NEW: soften only the inner/core punch (keeps feather edge hue)
const corePunch = Math.max(0.0, Math.min(1.0, punch * 0.10));

dctx.fillStyle = "rgba(0,0,0," + (Math.max(0.05, Math.min(1.0, corePunch))) + ")";
dctx.fill();

// Explicit edge feather ramp (multi-pass) for a seamless gradient (destination-out)
// NOTE: We do NOT use stroke() here because thick strokes expand in all directions
// and can "leak" light under the player. Instead we rebuild a slightly expanded
// polygon per pass, and we attenuate expansion for downward-facing rays.
const f = Math.max(0, (this._occOpt.featherPx|0));
if (f > 0){
  const passes = 10;

  // How much the feather is allowed to expand downward (0 = none, 1 = same as up).
  // Keep this near 0 to avoid lighting entire 48px ground tiles under Lumo.
  const downFeather = 0.0;

  for (let i = 0; i < passes; i++){
    const t = i / (passes - 1);        // 0..1 outer->inner
    const extra = f * (1.15 - 1.05 * t); // outer wider, inner tighter
    const a0 = 0.030 + 0.170 * (1 - t);  // faint outer, stronger inner
    const a = a0 * punch;

    // Rebuild expanded polygon
    dctx.beginPath();
    for (let k = 0; k < pts.length; k++){
      const px = pts[k][0], py = pts[k][1];
      let vx = px - x, vy = py - y;
      const n = Math.hypot(vx, vy) || 1;

      vx /= n; vy /= n;

      // Downward rays: reduce expansion aggressively (prevents "underlight" blowout)
      const down = Math.max(0, vy); // 0 up/side, 1 straight down
      const expand = extra * (1 - down * (1 - downFeather));

      const ex = px + vx * expand;
      const ey = py + vy * expand;

      if (k === 0) dctx.moveTo(ex, ey);
      else dctx.lineTo(ex, ey);
    }
    dctx.closePath();

    dctx.fillStyle = "rgba(0,0,0," + a.toFixed(3) + ")";
    dctx.fill();
  }
}

// Penumbra: a second softer pass (use softened core punch)
const pen = (typeof this._occOpt.penumbra === "number") ? this._occOpt.penumbra : 1.0;
if (pen > 1.01){
  dctx.shadowBlur = feather * 1.35;
  dctx.globalAlpha = 0.55 * corePunch;
  dctx.fill();
}
dctx.restore();


    // Skip circular light punch-out for player when occlusion is active
    continue;
  }
}
        const seed = (typeof L._seed === "number") ? L._seed : ((x * 0.013) + (y * 0.017)) % 1000;

        if (kind === "player"){
          const e = Math.max(0, Math.min(1, (typeof L.energy === "number") ? L.energy : 1));
          const amp = (fx.playerPulseAmpMin ?? 0.008) + ((fx.playerPulseAmpMax ?? 0.030) - (fx.playerPulseAmpMin ?? 0.008)) * e;
          const hz  = (fx.playerPulseHz ?? 1.15);
          const s = Math.sin((t * hz) * TAU);
          r *= (1 + s * amp);
          // tiny strength breathing so light feels "alive"
          strength *= (0.985 + 0.015 * Math.sin((t * (hz * 0.9)) * TAU + seed));
        }
        else if (kind === "lantern"){
          const bhz = (fx.lanternBreathHz ?? 0.35);
          const fhz = (fx.lanternFlickerHz ?? 5.5);
          const b = Math.sin((t * bhz) * TAU + seed);
          const f = Math.sin((t * fhz) * TAU + seed * 1.7);
          r *= (1 + b * (fx.lanternBreathAmpR ?? 0.020));
          strength *= (1 + b * (fx.lanternBreathAmpS ?? 0.040));
          strength *= (1 + f * (fx.lanternFlickerAmp ?? 0.010));
        }
        else if (kind === "firefly"){
          const hz = (fx.fireflyShimmerHz ?? 2.2);
          const s = Math.sin((t * hz) * TAU + seed * 2.3);
          r *= (1 + s * (fx.fireflyShimmerAmp ?? 0.015));
        }
        else if (kind === "flare"){
          const hz = (fx.flareTurbHz ?? 3.0);
          const s = Math.sin((t * hz) * TAU + seed * 0.8);
          r *= (1 + s * (fx.flareTurbAmp ?? 0.020));
        }

        const g = dctx.createRadialGradient(x, y, 0, x, y, r);
        const mid = 0.55;
        const a0 = 1.00 * strength;
        const a1 = 0.85 * strength;

        g.addColorStop(0.00, `rgba(0,0,0,${a0.toFixed(3)})`);
        g.addColorStop(mid,  `rgba(0,0,0,${a1.toFixed(3)})`);
        g.addColorStop(1.00, "rgba(0,0,0,0.0)");

        dctx.fillStyle = g;
        dctx.beginPath();
        dctx.arc(x, y, r, 0, Math.PI * 2);
        dctx.fill();
      }

      this.ctx.save();
      this.ctx.setTransform(1,0,0,1,0,0);
      this.ctx.globalCompositeOperation = "source-over";
      this.ctx.drawImage(this.darkCv, 0, 0);
      this.ctx.restore();
    }

    drawPulse(lightX, lightY, pulse){
      if (!pulse || !pulse.active) return;
      const ctx = this.ctx;

      ctx.save();
      ctx.setTransform(1,0,0,1,0,0);
      ctx.globalCompositeOperation = "source-over";

      ctx.strokeStyle = `rgba(170,120,255,${Math.max(0,pulse.alpha).toFixed(3)})`;
      ctx.lineWidth = Math.max(1, pulse.thickness || 2);

      ctx.beginPath();
      ctx.arc(lightX, lightY, Math.max(0.5, pulse.r), 0, Math.PI*2);
      ctx.stroke();

      const band = Math.max(20, pulse.band || 28);
      const inner = Math.max(0.5, pulse.r - band);
      const outer = Math.max(inner + 0.5, pulse.r);

      const rg = ctx.createRadialGradient(lightX, lightY, inner, lightX, lightY, outer);
      rg.addColorStop(0.00, "rgba(170,120,255,0.00)");
      rg.addColorStop(1.00, `rgba(170,120,255,${(Math.max(0,pulse.alpha)*0.10).toFixed(3)})`);

      ctx.strokeStyle = rg;
      ctx.lineWidth = band;
      ctx.beginPath();
      ctx.arc(lightX, lightY, (inner+outer)/2, 0, Math.PI*2);
      ctx.stroke();

      ctx.restore();
    }

    /* ---------------------------------------------------
       HUD helpers
       --------------------------------------------------- */

    _drawTextTracked(ctx, text, x, y, trackingPx){
      let cursorX = x;
      for (let i = 0; i < text.length; i++){
        const ch = text[i];
        ctx.strokeText(ch, cursorX, y);
        ctx.fillText(ch, cursorX, y);
        const m = ctx.measureText(ch);
        cursorX += (m.width + trackingPx);
      }
    }

    _drawRetroPopupText(ctx, text, x, y, alpha){
      const a = Math.max(0, Math.min(1, alpha));
      const tracking = 1.6;

      ctx.save();

      ctx.shadowColor = `rgba(255, 210, 80, ${(0.55*a).toFixed(3)})`;
      ctx.shadowBlur = 12;

      ctx.lineWidth = 4;
      ctx.strokeStyle = `rgba(125, 80, 0, ${(0.95*a).toFixed(3)})`;
      ctx.fillStyle = `rgba(255, 205, 70, ${(0.98*a).toFixed(3)})`;
      this._drawTextTracked(ctx, text, x, y, tracking);

      ctx.shadowBlur = 0;
      ctx.lineWidth = 1;
      ctx.strokeStyle = `rgba(255, 245, 190, ${(0.55*a).toFixed(3)})`;

      let cursorX = x;
      for (let i=0; i<text.length; i++){
        const ch = text[i];
        ctx.strokeText(ch, cursorX, y);
        const m = ctx.measureText(ch);
        cursorX += (m.width + tracking);
      }

      ctx.restore();
    }

    _drawFlareIcon(ctx, x, y, s){
      const img = this.ui.flare;
      if (img && img._ok){
        ctx.drawImage(img, x, y, s, s);
      } else {
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.fillRect(x + s*0.40, y + s*0.12, s*0.20, s*0.76);
        ctx.fillStyle = "rgba(255,235,160,0.85)";
        ctx.fillRect(x + s*0.38, y + s*0.08, s*0.24, s*0.12);
      }
    }

    _drawBulbIcon(ctx, x, y, s, on){
      const img = on ? this.ui.bulbOn : this.ui.bulbOff;
      if (img && img._ok){
        ctx.drawImage(img, x, y, s, s);
      } else {
        const r = s * 0.45;
        const cx = x + s/2;
        const cy = y + s/2;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI*2);
        ctx.fillStyle = on ? "rgba(255,240,180,0.95)" : "rgba(80,80,80,0.6)";
        ctx.fill();
      }
    }

    // Simple rounded-rect helper (safe, no deps)
    _roundRect(ctx, x, y, w, h, r){
      const rr = Math.max(0, Math.min(r, Math.min(w, h) * 0.5));
      ctx.beginPath();
      ctx.moveTo(x + rr, y);
      ctx.arcTo(x + w, y,     x + w, y + h, rr);
      ctx.arcTo(x + w, y + h, x,     y + h, rr);
      ctx.arcTo(x,     y + h, x,     y,     rr);
      ctx.arcTo(x,     y,     x + w, y,     rr);
      ctx.closePath();
    }

    /* ---------------------------------------------------
       HUD main
       --------------------------------------------------- */

    drawHUD(hud){
      const ctx = this.ctx;
      const w = this.w;
      const h = this.h;

      const padX = w * 0.03;
      const padY = h * 0.03;

      ctx.save();
      ctx.setTransform(1,0,0,1,0,0);
      ctx.globalCompositeOperation = "source-over";

      // ==================================================
      // ENERGY BAR (top strip) - fairy-clean horizontal instrument
      // ==================================================
      const topY = padY + 10;

      const barH = Math.max(12, Math.min(16, h * 0.018));
      const barW = Math.max(180, Math.min(320, w * 0.22));
      const barX = padX;
      const barY = topY;

      const e = Math.max(0, Math.min(100, hud.energyPct || 0));
      const pct = e / 100;

      // färg baserat på nivå
      let col = "#2ecc71";
      if (e < 80) col = "#9be564";
      if (e < 60) col = "#f1c40f";
      if (e < 40) col = "#e67e22";
      if (e < 20) col = "#e74c3c";

      // Frame
      const framePad = 3;
      this._roundRect(ctx, barX, barY, barW, barH, 7);
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.55)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Inner track
      const ix = barX + framePad;
      const iy = barY + framePad;
      const iw = barW - framePad*2;
      const ih = barH - framePad*2;

      this._roundRect(ctx, ix, iy, iw, ih, 5);
      ctx.fillStyle = "rgba(10,10,10,0.65)";
      ctx.fill();

      // Fill
      const fw = Math.max(0, Math.round(iw * pct));
      if (fw > 0){
        this._roundRect(ctx, ix, iy, fw, ih, 5);
        ctx.fillStyle = col;
        ctx.fill();

        // low-energy soft glow
        if (e < 30){
          ctx.save();
          ctx.globalAlpha = 0.30;
          this._roundRect(ctx, ix-1, iy-1, fw+2, ih+2, 6);
          ctx.fillStyle = col;
          ctx.fill();
          ctx.restore();
        }
      }

      // Ticks (vertical)
      ctx.strokeStyle = "rgba(0,0,0,0.45)";
      ctx.lineWidth = 1;
      const nTicks = 10;
      for (let i = 0; i <= nTicks; i++){
        const t = i / nTicks;
        const x = ix + t * iw;
        const major = (i % 2) === 0;
        const y1 = iy + (major ? 1 : 3);
        const y2 = iy + ih - (major ? 1 : 3);
        ctx.beginPath();
        ctx.moveTo(x, y1);
        ctx.lineTo(x, y2);
        ctx.stroke();
      }

      // Inner border
      this._roundRect(ctx, ix, iy, iw, ih, 5);
      ctx.strokeStyle = "rgba(255,255,255,0.10)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // ==================================================
      // SCORE (top center)
      // ==================================================
      const score = (hud.score|0);
      ctx.font = "16px monospace";
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      const scoreX = w * 0.5;
      const scoreY = topY;
      ctx.fillText(`SCORE ${String(score).padStart(6, "0")}`, scoreX, scoreY);

      // ==================================================
      // LIVES (bulbs) - vänster om SCORE
      // ==================================================
      const lives = Math.max(0, hud.lives|0);
      const livesMax = Math.max(1, hud.livesMax|0);
      const bulbSize = 20;
      const bulbGap = 6;

      const bulbsGroupW = (livesMax * bulbSize) + ((livesMax - 1) * bulbGap);
      const scoreBlockW = 170;

      let bulbsX0 = (scoreX - (scoreBlockW/2) - 18 - bulbsGroupW);
      bulbsX0 = Math.max(padX, bulbsX0);

      const bulbsY = padY;

      for(let i = 0; i < livesMax; i++){
        const bx = bulbsX0 + i * (bulbSize + bulbGap);
        const by = bulbsY;
        this._drawBulbIcon(ctx, bx, by, bulbSize, i < lives);
      }

      // ==================================================
      // CHECKPOINT LED (under SCORE)
      // ==================================================
     {
        const areaW = Math.max(140, w * 0.26); // samma som flare-rutan
        const fx0 = w - padX - areaW;
        const fy0 = padY;

     // Placera den vid högerkanten, under flare-raden
        const ledX = fx0 + areaW - 50;
        const ledY = fy0 + 20;   
        const ledR = 5;          

        ctx.beginPath();
        ctx.arc(ledX, ledY, ledR + 3, 0, Math.PI*2);
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.fill();

        ctx.beginPath();
        ctx.arc(ledX, ledY, ledR, 0, Math.PI*2);
        if (hud.checkpointLit){
          ctx.fillStyle = "rgba(70, 255, 120, 0.95)";
          ctx.fill();

          ctx.beginPath();
          ctx.arc(ledX - 2, ledY - 2, 2.2, 0, Math.PI*2);
          ctx.fillStyle = "rgba(255,255,255,0.7)";
          ctx.fill();
        } else {
          ctx.fillStyle = "rgba(20, 70, 35, 0.75)";
          ctx.fill();
        }

        const rt = Math.max(0, Math.min(1, hud.checkpointRingT || 0));
        if (rt > 0){
          const p = 1 - rt;
          const ringR = ledR + 6 + p * 18;
          const a = rt;
          ctx.beginPath();
          ctx.arc(ledX, ledY, ringR, 0, Math.PI*2);
          ctx.strokeStyle = `rgba(70,255,120,${(0.75*a).toFixed(3)})`;
          ctx.lineWidth = 3;
          ctx.stroke();
        }
      }

      // ==================================================
      // FLARE HUD (ikon per flare)
      // ==================================================
      {
        const flares = Math.max(0, hud.flares|0);

        const areaW = Math.max(140, w * 0.26);
        const areaH = 34;
        const fx0 = w - padX - areaW;
        const fy0 = padY;

        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.fillRect(fx0, fy0, areaW, areaH);

        const ff = Math.max(0, hud.flareFlash || 0);
        const scale = 1 + ff * 0.08;

        ctx.save();
        ctx.translate(fx0 + areaW/2, fy0 + areaH/2);
        ctx.scale(scale, scale);
        ctx.translate(-(fx0 + areaW/2), -(fy0 + areaH/2));

        const iconS = 18;
        const gap = 4;
        const insetX = 8;
        const insetY = Math.floor((areaH - iconS) / 2);

        const usable = areaW - insetX*2;
        const per = iconS + gap;
        const maxIcons = Math.max(1, Math.floor((usable + gap) / per));

        const shown = Math.min(flares, maxIcons);
        const overflow = flares - shown;

        for (let i=0; i<shown; i++){
          const x = fx0 + insetX + i*per;
          const y = fy0 + insetY;
          this._drawFlareIcon(ctx, x, y, iconS);
        }

        if (overflow > 0){
          const tx = fx0 + insetX + shown*per + 4;
          ctx.font = "16px monospace";
          ctx.fillStyle = "rgba(255,255,255,0.9)";
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillText(`+${overflow}`, tx, fy0 + areaH/2);
        }

        ctx.restore();
      }

      // ==================================================
      // PAUSE-knapp (nedre högra hörnet) - retro pill
      // ==================================================
{
  const bw = 92;
  const bh = 26;
  const bx = w - padX - bw;
  const by2 = h - padY - bh;

  // pill
  this._roundRect(ctx, bx, by2, bw, bh, 14);
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.fill();

  this._roundRect(ctx, bx, by2, bw, bh, 14);
  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  ctx.lineWidth = 2;
  ctx.stroke();

  this._roundRect(ctx, bx+1.5, by2+1.5, bw-3, bh-3, 13);
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // text (diskret)
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "13px monospace";
  ctx.fillText("Ⅱ  PAUSE", bx + bw/2, by2 + bh/2 + 0.5);

  // klickyta
  hud._pauseBtn = { x: bx, y: by2, w: bw, h: bh };
}

      // ==================================================
      // ENERGY POPUPS
      // ==================================================
      if (Array.isArray(hud.popups)){
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.font = '22px "Impact", "Arial Black", monospace';

        for (const p of hud.popups){
          if (!p) continue;
          const a = Math.max(0, Math.min(1, p.a));
          if (a <= 0) continue;
          this._drawRetroPopupText(ctx, p.txt, p.x, p.y, a);
        }
      }

      ctx.restore();

      // ge app.js info för var energy-baren sitter
      hud._barGeom = { x: barX, y: barY, w: barW, h: barH };
    }

    drawPauseOverlay(){
      const ctx = this.ctx;
      ctx.save();
      ctx.setTransform(1,0,0,1,0,0);
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0,0,this.w,this.h);

      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "28px monospace";
      ctx.fillText("PAUSED - press P or click to resume", this.w/2, this.h/2);
      ctx.restore();
    }
  }

  Lumo.Renderer = Renderer;
})();
