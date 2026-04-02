(() => {
  window.Lumo = window.Lumo || {};

  class Entities {
    constructor(){
      this.items = [];

      // Fog volumes (Smooke-style) — isolated, visual-only
      this._fogVolumes = [];
      this._fogFrame = 0;
      this._liquidVolumes = [];
      this._liquidAnimT = 0;
      this._registeredRuntimeEntityIds = new Set([
        "water_volume",
        "lava_volume",
        "bubbling_liquid_volume",
      ]);
      this._pfhLiquidDiag = {
        loadLogged: false,
        registrationLogged: false,
        spawnedByType: new Set(),
        drawLogged: false,
        afterDarknessDrawLogged: false,
      };

      // Catalog (optional): allows generic decor sizing/perch data from data/catalog_entities.js
      this._catById = null;
      if (window.LUMO_CATALOG_ENTITIES && Array.isArray(window.LUMO_CATALOG_ENTITIES)){
        this._catById = {};
        for (const d of window.LUMO_CATALOG_ENTITIES){
          if (d && typeof d.id === "string") this._catById[d.id] = d;
        }
      }

      this._autoSpawnedTestDarkCreature = false; // spawn one test creature if none exists
      this._hoverVoidAttackGlobalCd = 0;

      this._musicZones = [];
      this._spotSounds = [];
      this._triggerSounds = [];
      this._soundHandles = new Map();
      this._prevPlayerCenterX = null;

            // Sprites (HUD använder flare.png, kastad flare använder flare_2.png)
      // Runtime-sprites för entities
    this.sprites = {
  // thrown flare
  flareAir: this._tryLoadImage("data/assets/ui/flare_2.png"),

  // flare pickup (placed in level)
  flarePickup: this._tryLoadImage("data/assets/sprites/pickups/flare_pickup_01.png"),

  // power-cell variants (randomized per instance at spawn)
  powerCells: [
    this._tryLoadImage("data/assets/sprites/pickups/pc_01.png"),
    this._tryLoadImage("data/assets/sprites/pickups/pc_02.png"),
    this._tryLoadImage("data/assets/sprites/pickups/pc_03.png"),
    this._tryLoadImage("data/assets/sprites/pickups/pc_04.png")
  ],

  // fireflies (randomized per instance at spawn)
  fireflies: [
    this._tryLoadImage("data/assets/sprites/lights/firefly_01.png"),
    this._tryLoadImage("data/assets/sprites/lights/firefly_02.png"),
    this._tryLoadImage("data/assets/sprites/lights/firefly_03.png")
  ],

  // lantern (static safe light)
  lantern: this._tryLoadImage("data/assets/sprites/lights/lantern_01.png"),

  // dark creature idle loop (2-frame)
  darkCreatureIdle: [
    this._tryLoadImage("data/assets/sprites/creatures/dc_idle_3.png"),
    this._tryLoadImage("data/assets/sprites/creatures/dc_idle_4.png")
  ],

  // dark spell projectile + impact/hazard sequence
  darkSpell: {
    flight: this._tryLoadImage("data/assets/sprites/creatures/void_m_04.png"),
    impact03: this._tryLoadImage("data/assets/sprites/creatures/void_m_03.png"),
    impact02: this._tryLoadImage("data/assets/sprites/creatures/void_m_02.png"),
    impact01: this._tryLoadImage("data/assets/sprites/creatures/void_m_01.png")
  },

  // checkpoint (try a few common legacy paths)
  checkpoints: [
      this._tryLoadImage("data/assets/sprites/lights/lantern_2.png"),
      ]

};


    }

    _getSfxVolume(){
      try{
        if (window.Lumo && typeof window.Lumo.getAudioSettings === "function"){
          const s = window.Lumo.getAudioSettings();
          if (s && Number.isFinite(s.sfxVolume)) return Math.max(0, Math.min(1, s.sfxVolume));
        }
      }catch(_){ }
      return 1;
    }

    _getSoundHandle(path, loop){
      const key = `${path}::${loop ? "L" : "O"}`;
      if (this._soundHandles.has(key)) return this._soundHandles.get(key);
      const audio = new Audio(path);
      audio.preload = "auto";
      audio.loop = !!loop;
      audio.volume = 0;
      const h = { audio, path, loop: !!loop, started:false, lastTarget:0, lastCrossSide:null, oneShotCooldown:0 };
      this._soundHandles.set(key, h);
      return h;
    }

    _setHandleVolume(handle, target){
      if (!handle || !handle.audio) return;
      const t = Math.max(0, Math.min(1, target)) * this._getSfxVolume();
      handle.lastTarget = t;
      // Avoid redundant no-op volume writes when effective target is unchanged.
      if (Math.abs(handle.audio.volume - t) > 0.0001) handle.audio.volume = t;
      if (t > 0.001){
        if (handle.audio.paused){
          const p = handle.audio.play();
          if (p && typeof p.catch === "function") p.catch(() => {});
        }
      } else if (!handle.loop){
        try { handle.audio.pause(); handle.audio.currentTime = 0; } catch(_){ }
      }
    }

    _playOneShot(path, volume){
      if (!path) return;
      const a = new Audio(path);
      a.preload = "auto";
      a.loop = false;
      a.volume = Math.max(0, Math.min(1, volume)) * this._getSfxVolume();
      const p = a.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    }

    _normalizeSoundPath(soundFile, entityType){
      let path = String(soundFile || "").trim();
      if (!path) return "";
      if (path.includes("data/assets/sound/")) path = path.replace("data/assets/sound/", "data/assets/audio/");
      if (entityType === "trigger_sound" && /data\/assets\/audio\/events\/creatures\/void_creature\.wav$/i.test(path)){
        path = "data/assets/audio/events/creatures/void_creature.mp3";
      }
      return path;
    }

    _readNumParam(params, key, fallback, ctx){
      const raw = params && params[key];
      const v = Number(raw);
      if (Number.isFinite(v)) return v;
      if (params && Object.prototype.hasOwnProperty.call(params, key) && raw != null && raw !== ""){
        const levelLabel = (ctx && ctx.levelLabel) ? ctx.levelLabel : "(unknown-level)";
        const entityLabel = (ctx && ctx.entityLabel) ? ctx.entityLabel : "(unknown-entity)";
        console.warn(`[Lumo][contract] Level ${levelLabel}: entity ${entityLabel} has invalid numeric param '${key}' (${JSON.stringify(raw)}); using fallback ${fallback}.`);
      }
      return fallback;
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

    clear(){
      this.items.length = 0;
      this._fogVolumes.length = 0;
      this._fogFrame = 0;
      this._liquidVolumes.length = 0;
      this._autoSpawnedTestDarkCreature = false;
      this._hoverVoidAttackGlobalCd = 0;
      this._musicZones.length = 0;
      this._spotSounds.length = 0;
      this._triggerSounds.length = 0;
      this._prevPlayerCenterX = null;
      this.stopGameplayAudio();
      this._soundHandles.clear();
      this._pfhLiquidDiag = {
        loadLogged: false,
        registrationLogged: false,
        spawnedByType: new Set(),
        drawLogged: false,
        afterDarknessDrawLogged: false,
      };
    }

    stopGameplayAudio(){
      for (const h of this._soundHandles.values()){
        try { h.audio.pause(); h.audio.currentTime = 0; } catch(_){ }
        h.started = false;
        h.lastTarget = 0;
        h.lastCrossSide = null;
        h.oneShotCooldown = 0;
      }
    }

    loadFromLevel(levelObj){
      this.clear();

      // Accept both runtime formats:
      //  A) levelObj.entities: [{type, x, y, ...}]  (engine-native)
      //  B) levelObj.layers.ents: [{id, x, y, w, h, anchor, offsetX, offsetY, aggroRadius, params}] (LumoEditor export)
      const listA = (levelObj && Array.isArray(levelObj.entities)) ? levelObj.entities : null;
      const listB = (levelObj && levelObj.layers && Array.isArray(levelObj.layers.ents)) ? levelObj.layers.ents : null;
      console.log("[PFH DEBUG] levelObj.entities:", levelObj && levelObj.entities);
      console.log("[PFH DEBUG] levelObj.layers?.ents:", levelObj && levelObj.layers ? levelObj.layers.ents : undefined);

      const list = listA || listB || [];
      console.log("[PFH DEBUG] selected list length:", list.length);
      console.log("[PFH DEBUG] first entity:", list[0]);
      const meta = levelObj && levelObj.meta ? levelObj.meta : {};
      const levelLabel = ((meta.id || "(no-id)") + (meta.name ? `:${meta.name}` : ""));
      const diag = { levelLabel, unknownEditorIds: new Set(), unknownRuntimeTypes: new Set() };
      const incomingLiquidCounts = { water_volume: 0, lava_volume: 0, bubbling_liquid_volume: 0 };
      for (const entity of list){
        const id = String(entity?.id || entity?.type || "").trim().toLowerCase();
        if (Object.prototype.hasOwnProperty.call(incomingLiquidCounts, id)) incomingLiquidCounts[id] += 1;
      }
      console.info("[PFH liquid] runtime loader received entities", {
        levelLabel,
        totalEntities: list.length,
        liquidEntitiesByType: incomingLiquidCounts,
      });
      if (!this._pfhLiquidDiag.registrationLogged){
        console.info("[PFH liquid] registered runtime entity types: " + Array.from(this._registeredRuntimeEntityIds).join(", "));
        this._pfhLiquidDiag.registrationLogged = true;
      }

      if (listB && !listA){
        // If the level doesn't define spawn, derive it from start_01 (editor mandatory entity).
        if (!levelObj.spawn && !(levelObj.meta && levelObj.meta.spawn)){
          const start = listB.find(e => e && e.id === "start_01");
          if (start) levelObj.spawn = { x: start.x|0, y: start.y|0 };
        }
      }

      for (const e of list){
        this.spawnFromDef(e, levelObj, diag);
      }
      if (!this._pfhLiquidDiag.loadLogged){
        const spawnedCounts = { water_volume: 0, lava_volume: 0, bubbling_liquid_volume: 0 };
        for (const volume of this._liquidVolumes){
          const id = String(volume?.id || "").trim().toLowerCase();
          if (Object.prototype.hasOwnProperty.call(spawnedCounts, id)) spawnedCounts[id] += 1;
        }
        console.info("[PFH liquid] loader spawn summary", {
          levelLabel,
          spawnedVolumeCount: this._liquidVolumes.length,
          spawnedByType: spawnedCounts,
        });
        this._pfhLiquidDiag.loadLogged = true;
      }

      // If we got entities (either format), do NOT inject demo objects.
      const hadEntities = (Array.isArray(listA) && listA.length) || (Array.isArray(listB) && listB.length);

      // Om leveln saknar entities → lägg in lite test-grejer (ENDAST i debug-läge)
      // Aktivera manuellt i konsolen om du vill: window.Lumo.DEBUG_DEMO_ENTS = true;
      if (!hadEntities && (Lumo && Lumo.DEBUG_DEMO_ENTS)){
        this.items.push(this.makePowerCell(8, 24));
        this.items.push(this.makeFlarePickup(12, 24));
        this.items.push(this.makeLantern(18, 24));
        this.items.push(this.makeEnemy(40, 24));
        // Dark creature auto-spawnas nära spelaren i update()
      }
}

    spawnFromDef(e, levelObj, diag){
      if (!e) return;
      console.log("[PFH DEBUG] spawnFromDef id:", e.id);

      // Editor-export path (id-based)
      if (e.id){
        const rawId = String(e.id);
        const id = rawId.trim().toLowerCase();
        const tx = e.x|0, ty = e.y|0;
        const offX = (typeof e.offsetX === "number") ? e.offsetX : 0;
        const offY = (typeof e.offsetY === "number") ? e.offsetY : 0;
        const normalizeAnchor = (value) => {
          if (typeof value !== "string") return null;
          const normalized = value.trim().toUpperCase();
          if (normalized === "TL" || normalized === "BL") return normalized;
          return null;
        };
        const anchor = normalizeAnchor(e.anchor) || "BL";
        const params = (e.params && typeof e.params === "object") ? e.params : {};
        const paramCtx = { levelLabel: diag && diag.levelLabel, entityLabel: `${id}@${tx},${ty}` };

        // Helper: convert a tile-anchored BL entity into runtime pixels + optional y-offset
        const applyAnchor = (obj, w=null, h=null, resolvedAnchor=anchor) => {
          const ts = (levelObj && levelObj.meta && levelObj.meta.tileSize) ? levelObj.meta.tileSize : (Lumo.TILE || 24);
          const W = (w==null) ? (obj.w||0) : w;
          const H = (h==null) ? (obj.h||0) : h;

          // Default to bottom-left anchor so it "sits" on the tile.
          if (resolvedAnchor === "BL"){
            // Place object's bottom on tile bottom, then apply overlap offset.
            obj.x = (tx * ts) + offX;
            obj.y = (ty * ts) + (ts - H);
            obj._offY = offY; // applied in draw()
          } else {
            obj.x = (tx * ts) + offX;
            obj.y = (ty * ts);
            obj._offY = offY;
          }
          return obj;
        };

                if (id === "start_01"){
          // Start = ren spawn-marker (osynlig i runtime). Spawn härleds i init() via levelObj.spawn.
          return;
        }

        if (id === "checkpoint_01"){
          // Checkpoint = engine-native (placeholder tills du sätter sprite)
          const cp = this.makeCheckpoint(tx, ty, params);
          applyAnchor(cp, cp.w, cp.h);
          this.items.push(cp);
          return;
        }


                if (id === "exit_01"){
          // Exit = ren mål-marker (osynlig i runtime just nu)
          const ts = (levelObj && levelObj.meta && levelObj.meta.tileSize) ? levelObj.meta.tileSize : (Lumo.TILE || 24);
          const ex = { type:"exit", active:true, hidden:true, x:tx*ts, y:ty*ts, w:ts, h:ts };
          applyAnchor(ex, ex.w, ex.h);
          this.items.push(ex);
          return;
        }

        if (id === "lantern_01"){
          if (Object.prototype.hasOwnProperty.call(params, "radius") && !Number.isFinite(Number(params.radius))){
            console.warn(`[Lumo][contract] Level ${diag && diag.levelLabel ? diag.levelLabel : "(unknown-level)"}: entity ${id}@${tx},${ty} has invalid numeric param 'radius' (${JSON.stringify(params.radius)}); using fallback 170.`);
          }
          if (Object.prototype.hasOwnProperty.call(params, "strength") && !Number.isFinite(Number(params.strength))){
            console.warn(`[Lumo][contract] Level ${diag && diag.levelLabel ? diag.levelLabel : "(unknown-level)"}: entity ${id}@${tx},${ty} has invalid numeric param 'strength' (${JSON.stringify(params.strength)}); using fallback 0.85.`);
          }
          const radius = (typeof params.radius === "number") ? params.radius : 170;
          const strength = (typeof params.strength === "number") ? params.strength : 0.85;
          const ln = this.makeLantern(tx, ty, radius, strength, {
            customSpritePath: params.customSpritePath,
            drawW: params.drawW,
            drawH: params.drawH,
            drawAnchor: params.drawAnchor,
          });
          applyAnchor(ln, ln.w, ln.h);
          this.items.push(ln);
          return;
        }


        if (id === "music_zone"){
          const ts = (levelObj && levelObj.meta && levelObj.meta.tileSize) ? levelObj.meta.tileSize : (Lumo.TILE || 24);
          const baseX = tx * ts;
          let xStart = this._readNumParam(params, "xStart", baseX, paramCtx);
          let xEnd = this._readNumParam(params, "xEnd", baseX + ts * 8, paramCtx);
          if (xEnd < xStart){ const tmp = xStart; xStart = xEnd; xEnd = tmp; }
          const zone = {
            type:"musicZone",
            soundFile: this._normalizeSoundPath(params.soundFile, "music_zone"),
            xStart,
            xEnd,
            volume: Math.max(0, Math.min(1, this._readNumParam(params, "volume", 0.7, paramCtx))),
            loop: params.loop !== false,
            fadeTiles: Math.max(0, this._readNumParam(params, "fadeTiles", 4, paramCtx)),
          };
          this._musicZones.push(zone);
          return;
        }

        if (id === "spot_sound"){
          const ts = (levelObj && levelObj.meta && levelObj.meta.tileSize) ? levelObj.meta.tileSize : (Lumo.TILE || 24);
          const cx = tx * ts + ts * 0.5;
          const cy = ty * ts + ts * 0.5;
          const spot = {
            type:"spotSound",
            soundFile: this._normalizeSoundPath(params.soundFile, "spot_sound"),
            cx, cy,
            radius: Math.max(0, this._readNumParam(params, "radius", 120, paramCtx)),
            volume: Math.max(0, Math.min(1, this._readNumParam(params, "volume", 0.8, paramCtx))),
            loop: params.loop !== false,
            fadeTiles: Math.max(0, this._readNumParam(params, "fadeTiles", 2, paramCtx)),
          };
          this._spotSounds.push(spot);
          return;
        }

        if (id === "trigger_sound"){
          const ts = (levelObj && levelObj.meta && levelObj.meta.tileSize) ? levelObj.meta.tileSize : (Lumo.TILE || 24);
          const baseX = tx * ts + ts * 0.5;
          const trg = {
            type:"triggerSound",
            soundFile: this._normalizeSoundPath(params.soundFile, "trigger_sound"),
            triggerX: this._readNumParam(params, "triggerX", baseX, paramCtx),
            once: params.once !== false,
            volume: Math.max(0, Math.min(1, this._readNumParam(params, "volume", 1, paramCtx))),
            fired: false,
            lastSide: null,
          };
          this._triggerSounds.push(trg);
          return;
        }

        if (id === "fog_volume"){
          // FogVolume (visual-only) — accepts both export variants:
          // 1) params: { ... }  2) params: { params: { ... } }
          const P = (params.params && typeof params.params === "object") ? params.params : params;

          const area = (P.area && typeof P.area === "object") ? P.area : {};
          const look = (P.look && typeof P.look === "object") ? P.look : {};
          const smoothing = (P.smoothing && typeof P.smoothing === "object") ? P.smoothing : {};
          const interaction = (P.interaction && typeof P.interaction === "object") ? P.interaction : {};
          const organic = (P.organic && typeof P.organic === "object") ? P.organic : {};
          const render = (P.render && typeof P.render === "object") ? P.render : {};


          const ts = (levelObj && levelObj.meta && levelObj.meta.tileSize) ? levelObj.meta.tileSize : (Lumo.TILE || 24);

          // Area in pixels (preferred from Smooke export). Fallbacks are tile-based.
          // Bounds: support both tile-based entities (x/y in tiles, w/h ~ tile size) AND pixel-rect fog volumes (w/h much larger).
          const hasRect = (typeof e.w === "number" && e.w > ts * 2) || (typeof e.h === "number" && e.h > ts * 2);
          const rectX0 = hasRect ? (+e.x) : (tx * ts);
          const rectW  = hasRect ? (+e.w || 0) : (ts * 12);
          const rectX1 = hasRect ? (+e.x + (+e.w || 0)) : (rectX0 + rectW);
          const rectY0 = hasRect ? (+e.y + (+e.h || ts)) : ((ty + 1) * ts);

          const x0 = (typeof area.x0 === "number") ? area.x0 : rectX0;
          const x1 = (typeof area.x1 === "number") ? area.x1 : (rectX1);
          const y0 = (typeof area.y0 === "number") ? area.y0 : rectY0;
          const falloff = (typeof area.falloff === "number") ? area.falloff : 0;

          // Look (keep cheap defaults; we can tune later)
          const density   = (typeof look.density   === "number") ? look.density   : 0.14;
          const lift      = (typeof look.lift      === "number") ? look.lift      : 8;
          const thickness = (typeof look.thickness === "number") ? look.thickness : 44;
          let layers      = (typeof look.layers    === "number") ? (look.layers|0) : 28;
          if (layers < 8) layers = 8;
          if (layers > 36) layers = 36;
          // Look extras (premium): tint + exposure (lets you dim/boost without changing density)
          const color    = (typeof look.color === "string") ? look.color : "#E1EEFF";
          const exposure = (typeof look.exposure === "number") ? look.exposure : 1.0;

          // Render extras (premium): blend mode (screen/normal/add etc.)
          const blend = (render && typeof render.blend === "string") ? render.blend : "screen";


          // Smoothing (Smooke style)
          const diffuse = (typeof smoothing.diffuse === "number") ? smoothing.diffuse : 0.24;
          const relax   = (typeof smoothing.relax   === "number") ? smoothing.relax   : 0.24;
          const visc    = (typeof smoothing.visc    === "number") ? smoothing.visc    : 0.94;

          // Interaction
          const radius = (typeof interaction.radius === "number") ? interaction.radius : 92;
          const push   = (typeof interaction.push   === "number") ? interaction.push   : 2.4;
          const bulge  = (typeof interaction.bulge  === "number") ? interaction.bulge  : 2.2;
          const gate   = (typeof interaction.gate   === "number") ? interaction.gate   : 70;

          // Organic (premium): idle waves even when Lumo is far away.
          const orgStrength = (organic && typeof organic.strength === "number") ? organic.strength : 0.0;
          const orgScale    = (organic && typeof organic.scale    === "number") ? organic.scale    : 1.0;
          const orgSpeed    = (organic && typeof organic.speed    === "number") ? organic.speed    : 1.0;


          // 1D field resolution (hard budget: never too large)
          const widthPx = Math.max(32, x1 - x0);
          let N = Math.floor(widthPx / 10); // ~10px per cell
          if (N < 64) N = 64;
          if (N > 220) N = 220;

          const field = new Float32Array(N);
          const vel   = new Float32Array(N);

          this._fogVolumes.push({
            x0, x1, y0, falloff,
            density, lift, thickness, layers,
            color, exposure, blend,
            diffuse, relax, visc,
            radius, push, bulge, gate,
            orgStrength, orgScale, orgSpeed,
            N, field, vel,
            t: 0,
          });
          return;
        }

        if (id === "water_volume" || id === "lava_volume" || id === "bubbling_liquid_volume"){
          const P = (params.params && typeof params.params === "object") ? params.params : params;
          const area = (P.area && typeof P.area === "object") ? P.area : {};
          const ts = (levelObj && levelObj.meta && levelObj.meta.tileSize) ? levelObj.meta.tileSize : (Lumo.TILE || 24);

          const hasRect = (typeof e.w === "number" && e.w > ts * 2) || (typeof e.h === "number" && e.h > ts * 2);
          const rectX0 = hasRect ? (+e.x) : (tx * ts);
          const rectW = hasRect ? (+e.w || 0) : (ts * 8);
          const rectX1 = hasRect ? (rectX0 + rectW) : (rectX0 + rectW);
          const rectY0 = hasRect ? (+e.y + (+e.h || ts)) : ((ty + 1) * ts);
          const rectDepth = hasRect ? Math.max(ts, (+e.h || ts)) : (ts * 4);

          const x0 = Number.isFinite(Number(area.x0)) ? Number(area.x0) : rectX0;
          const x1 = Number.isFinite(Number(area.x1)) ? Number(area.x1) : rectX1;
          const y0 = Number.isFinite(Number(area.y0)) ? Number(area.y0) : rectY0;
          const depth = Math.max(ts * 0.5, Number.isFinite(Number(area.depth)) ? Number(area.depth) : rectDepth);

          const left = Math.min(x0, x1);
          const right = Math.max(x0, x1);
          const top = y0 - depth;
          const bottom = y0;
          if (!(right > left)){
            console.warn("[PFH liquid] spawn skipped: non-positive liquid width", { id, x0, x1, sourceEntity: { x: e.x, y: e.y } });
            return;
          }
          if (!(bottom > top)){
            console.warn("[PFH liquid] spawn skipped: non-positive liquid height", { id, y0, depth, sourceEntity: { x: e.x, y: e.y } });
            return;
          }

          let bodyColor = "rgba(58,145,214,0.34)";
          let surfaceColor = "rgba(135,212,255,0.9)";
          let bodyColorAfterDarkness = "rgba(84,173,232,0.24)";
          let surfaceColorAfterDarkness = "rgba(178,231,255,0.98)";
          let waveAmount = 0.35;
          let waveSpeed = 0.9;
          let lavaTemperature = 0.72;
          let lavaCrustAmount = 45;
          let lavaFlowSpeed = 0.55;
          let bubblingSurfaceActivity = 0.45;
          let bubblingBubbleAmount = 58;
          let bubblingFumeAmount = 40;
          if (id === "lava_volume"){
            const flow = (P.flow && typeof P.flow === "object") ? P.flow : {};
            const look = (P.look && typeof P.look === "object") ? P.look : {};
            const authoredTemp = Number(look.temperature);
            const authoredCrustRaw = Number(look.crustAmount);
            const authoredCrust = Number.isFinite(authoredCrustRaw)
              ? ((authoredCrustRaw <= 1) ? (authoredCrustRaw * 100) : authoredCrustRaw)
              : 45;
            const authoredFlowSpeed = Number(flow.speed);
            lavaTemperature = Number.isFinite(authoredTemp) ? Math.max(0.2, Math.min(1, authoredTemp)) : 0.72;
            lavaCrustAmount = Number.isFinite(authoredCrust) ? Math.max(0, Math.min(100, authoredCrust)) : 45;
            lavaFlowSpeed = Number.isFinite(authoredFlowSpeed) ? Math.max(0.1, Math.min(1.4, authoredFlowSpeed)) : 0.55;

            const tempMix = (lavaTemperature - 0.2) / 0.8;
            const hotR = Math.round(240 + (15 * tempMix));
            const hotG = Math.round(112 + (82 * tempMix));
            const hotB = Math.round(22 + (26 * tempMix));
            const deepR = Math.round(84 + (34 * tempMix));
            const deepG = Math.round(24 + (16 * tempMix));
            const deepB = Math.round(8 + (7 * tempMix));
            bodyColor = `rgba(${deepR},${deepG},${deepB},0.94)`;
            surfaceColor = `rgba(${hotR},${hotG},${hotB},0.98)`;
            bodyColorAfterDarkness = `rgba(${Math.min(255, deepR + 42)},${Math.min(255, deepG + 30)},${Math.min(255, deepB + 18)},0.40)`;
            surfaceColorAfterDarkness = `rgba(${Math.min(255, hotR + 8)},${Math.min(255, hotG + 16)},${Math.min(255, hotB + 18)},1)`;
            waveAmount = 0.2 + (tempMix * 0.15);
            waveSpeed = 0.35 + (lavaFlowSpeed * 0.5);
          } else if (id === "bubbling_liquid_volume"){
            const look = (P.look && typeof P.look === "object") ? P.look : {};
            const behavior = (P.behavior && typeof P.behavior === "object") ? P.behavior : {};
            const motion = (P.motion && typeof P.motion === "object") ? P.motion : {};
            if (typeof look.topColor === "string" && look.topColor.trim()) surfaceColor = look.topColor.trim();
            else surfaceColor = "rgba(187,255,130,0.92)";
            if (typeof look.bottomColor === "string" && look.bottomColor.trim()) bodyColor = look.bottomColor.trim();
            else bodyColor = "rgba(98,170,58,0.36)";

            const authoredSurfaceActivity = Number(behavior.surfaceActivity);
            const fallbackSurfaceActivity = Number(look.surfaceActivity);
            const authoredBubbleAmount = Number(behavior.bubbleAmount);
            const fallbackBubbleAmount = Number(motion.bubbleAmount);
            const authoredFumeAmount = Number(behavior.fumeAmount);
            const fallbackFumeAmount = Number(motion.fumeAmount);
            bubblingSurfaceActivity = Number.isFinite(authoredSurfaceActivity)
              ? Math.max(0, Math.min(1, authoredSurfaceActivity))
              : (Number.isFinite(fallbackSurfaceActivity) ? Math.max(0, Math.min(1, fallbackSurfaceActivity)) : 0.45);
            bubblingBubbleAmount = Number.isFinite(authoredBubbleAmount)
              ? Math.max(0, Math.min(100, authoredBubbleAmount))
              : (Number.isFinite(fallbackBubbleAmount) ? Math.max(0, Math.min(100, fallbackBubbleAmount)) : 58);
            bubblingFumeAmount = Number.isFinite(authoredFumeAmount)
              ? Math.max(0, Math.min(100, authoredFumeAmount))
              : (Number.isFinite(fallbackFumeAmount) ? Math.max(0, Math.min(100, fallbackFumeAmount)) : 40);

            const depthFactor = Math.max(0.35, Math.min(1, depth / Math.max(ts * 2, 96)));
            bodyColorAfterDarkness = "rgba(132,205,88,0.26)";
            surfaceColorAfterDarkness = "rgba(214,255,176,0.99)";
            waveAmount = 0.1 + (bubblingSurfaceActivity * 0.18 * depthFactor);
            waveSpeed = 0.35 + (bubblingSurfaceActivity * 0.45);
          } else if (id === "water_volume"){
            const motion = (P.motion && typeof P.motion === "object") ? P.motion : {};
            const look = (P.look && typeof P.look === "object") ? P.look : {};
            if (typeof look.topColor === "string" && look.topColor.trim()) surfaceColor = look.topColor.trim();
            if (typeof look.bottomColor === "string" && look.bottomColor.trim()) bodyColor = look.bottomColor.trim();
            const authoredWaveAmount = Number(motion.waveAmount);
            const authoredWaveSpeed = Number(motion.waveSpeed);
            waveAmount = Number.isFinite(authoredWaveAmount)
              ? Math.max(0, Math.min(1, authoredWaveAmount))
              : 0.35;
            waveSpeed = Number.isFinite(authoredWaveSpeed)
              ? Math.max(0.1, Math.min(3, authoredWaveSpeed))
              : 0.9;
          }

          this._liquidVolumes.push({
            id,
            x0: left,
            x1: right,
            yTop: top,
            yBottom: bottom,
            depth,
            bodyColor,
            surfaceColor,
            bodyColorAfterDarkness,
            surfaceColorAfterDarkness,
            waveAmount,
            waveSpeed,
            lavaTemperature,
            lavaCrustAmount,
            lavaFlowSpeed,
            bubblingSurfaceActivity,
            bubblingBubbleAmount,
            bubblingFumeAmount,
            bubblingSeed: ((left * 0.019) + (top * 0.031) + (right * 0.013)) % 1000,
          });
          if (!this._pfhLiquidDiag.spawnedByType.has(id)){
            this._pfhLiquidDiag.spawnedByType.add(id);
            console.info("[PFH liquid] spawned liquid type", {
              id,
              firstSpawnRect: { x0: left, x1: right, yTop: top, yBottom: bottom, depth },
            });
          }
          return;
        }

        if (id === "powercell_01"){
          const pc = this.makePowerCell(tx, ty, params);
          applyAnchor(pc, pc.w, pc.h);
          this.items.push(pc);
          return;
        }

if (id === "flare_pickup_01"){
  if (Object.prototype.hasOwnProperty.call(params, "amount") && !Number.isFinite(Number(params.amount))){
    console.warn(`[Lumo][contract] Level ${diag && diag.levelLabel ? diag.levelLabel : "(unknown-level)"}: entity ${id}@${tx},${ty} has invalid numeric param 'amount' (${JSON.stringify(params.amount)}); using fallback 1.`);
  }
  const amount = (typeof params.amount === "number") ? params.amount : 1;
  const fp = this.makeFlarePickup(tx, ty, amount, params);
  applyAnchor(fp, fp.w, fp.h);
  this.items.push(fp);
  return;
}

        
        if (id === "firefly_01"){
          const ff = this.makeFirefly(tx, ty, { w:12, h:12, params });
          applyAnchor(ff, ff.w, ff.h);
          this.items.push(ff);
          return;
        }

if (id === "dark_creature_01"){
          const mergedParams = { ...(params || {}) };
          if (!Number.isFinite(+mergedParams.aggroTiles)){
            if (Number.isFinite(+mergedParams.aggroRadius)){
              mergedParams.aggroRadius = +mergedParams.aggroRadius;
            } else if (Number.isFinite(+e.aggroRadius)){
              mergedParams.aggroRadius = +e.aggroRadius;
            }
          }
          const dc = this.makeDarkCreature(tx, ty, { params: mergedParams });
          applyAnchor(dc, dc.w, dc.h);
          this.items.push(dc);
          return;
        }

        
if (id === "hover_void_01"){
          const hv = this.makeHoverVoid(tx, ty, { params });
          applyAnchor(hv, hv.w, hv.h);
          this.items.push(hv);
          return;
        }

        

// Generic catalog-driven decor (no collision).
// Any entity id present in catalog_entities.js with category === "decor" will spawn as a visual decor sprite.
if (this._catById){
  const def = this._catById[id];
  if (def && def.category === "decor"){
    const ts = this.ts;
    const wPx = (typeof def.w === "number") ? def.w : ts;
    const hPx = (typeof def.h === "number") ? def.h : ts;
    const perchOffsetY = (typeof def.perchOffsetY === "number") ? def.perchOffsetY : 0;

    // Image path:
    // - default: catalog img
    // - flower: allow params.variant 1..4 to select flower_01..04
    let imgPath = (typeof def.img === "string") ? def.img : "";
    if (id === "decor_flower_01"){
      let vRaw = (params && Object.prototype.hasOwnProperty.call(params, "variant")) ? params.variant : 1;
      let v = (typeof vRaw === "number") ? (vRaw|0) : parseInt(vRaw, 10);
      if (!Number.isFinite(v)) v = 1;
      if (v < 1) v = 1;
      if (v > 4) v = 4;
      // If catalog img ends with flower_01.png, swap to selected variant.
      if (typeof imgPath === "string" && imgPath.indexOf("flower_01.png") !== -1){
        imgPath = imgPath.replace("flower_01.png", "flower_0" + v + ".png");
      } else if (typeof imgPath === "string" && imgPath.match(/flower_0\d\.png$/)){
        imgPath = imgPath.replace(/flower_0\d\.png$/, "flower_0" + v + ".png");
      } else {
        // Safe fallback
        imgPath = "data/assets/sprites/decor/flower_0" + v + ".png";
      }
    }

    const decorAnchor = normalizeAnchor(e.anchor) || normalizeAnchor(def.anchor) || "BL";
    const decorFlipX = (params && typeof params.flipX === "boolean") ? params.flipX : false;
    const dc = {
      type:"decor",
      active:true,
      decorId:id,
      x: tx*ts,
      y: ty*ts,
      w: wPx,
      h: hPx,
      perchOffsetY: perchOffsetY,
      img: imgPath ? this._tryLoadImage(imgPath) : null,
      anchorResolved: decorAnchor,
      flipX: decorFlipX,
    };
    applyAnchor(dc, dc.w, dc.h, decorAnchor);
    this.items.push(dc);
    return;
  }
}// Unknown editor entity id -> ignore (keeps runtime robust)
        if (diag && diag.unknownEditorIds && !diag.unknownEditorIds.has(id)){
          diag.unknownEditorIds.add(id);
          console.warn(`[Lumo][contract] Level ${diag.levelLabel}: unknown editor entity id '${id}' ignored.`);
        }
        return;
      }

      // Engine-native path (type-based)
      if (e.type === "powerCell") this.items.push(this.makePowerCell(e.x, e.y, e.params));
      else if (e.type === "checkpoint") this.items.push(this.makeCheckpoint(e.x, e.y, e.params));
      else if (e.type === "lantern") this.items.push(this.makeLantern(e.x, e.y, e.radius, e.strength));
      else if (e.type === "flarePickup") this.items.push(this.makeFlarePickup(e.x, e.y, e.amount, e.params));
      else if (e.type === "patrolEnemy") this.items.push(this.makeEnemy(e.x, e.y, e.left, e.right));
      else if (e.type === "movingPlatform") this.items.push(this.makeMovingPlatformFromDef(e, levelObj));
      else if (e.type === "darkCreature") this.items.push(this.makeDarkCreature(e.x, e.y, e));
      else if (e.type === "hoverVoid") this.items.push(this.makeHoverVoid(e.x, e.y, e));
      else {
        const t = String(e.type || "(missing-type)");
        if (diag && diag.unknownRuntimeTypes && !diag.unknownRuntimeTypes.has(t)){
          diag.unknownRuntimeTypes.add(t);
          console.warn(`[Lumo][contract] Level ${diag.levelLabel}: unknown runtime entity type '${t}' ignored.`);
        }
      }
    }

    // tile coords in, store pixels
  makePowerCell(tx, ty, params = null){
  const ts = Lumo.TILE || 24;
  const p = (params && typeof params === "object") ? params : {};
  const customSpritePath = (typeof p.customSpritePath === "string" && p.customSpritePath.trim())
    ? p.customSpritePath.trim().replace(/^(\.{1,2}\/)+/, "")
    : "";

  // Alternativ A: äkta slump per runtime-load (väljs en gång per entity)
  const pick = customSpritePath
    ? this._tryLoadImage(customSpritePath)
    : (() => {
      const arr = (this.sprites && Array.isArray(this.sprites.powerCells)) ? this.sprites.powerCells : [];
      return arr.length ? arr[(Math.random() * arr.length) | 0] : null;
    })();

  // Skala till exakt 1 tile
  return {
    type:"powerCell",
    active:true,
    x:tx*ts,
    y:ty*ts,
    w:ts,
    h:ts,
    _pcSprite: pick,
    _pcSpritePath: customSpritePath || ""
  };
}

    makeFireflyPx(px, py, w=12, h=12, params=null){
      const ts = Lumo.TILE || 24;
      const p = (params && typeof params === "object") ? params : {};

      const customSpritePath = (typeof p.customSpritePath === "string" && p.customSpritePath.trim())
        ? p.customSpritePath.trim().replace(/^(\.{1,2}\/)+/, "")
        : "";
      const pick = customSpritePath
        ? this._tryLoadImage(customSpritePath)
        : (() => {
          const arr = (this.sprites && Array.isArray(this.sprites.fireflies)) ? this.sprites.fireflies : [];
          return arr.length ? arr[(Math.random() * arr.length) | 0] : null;
        })();

      const num = (v) => {
        if (typeof v === "number") return v;
        if (typeof v === "string" && v.trim() !== ""){
          const n = parseFloat(v);
          return Number.isFinite(n) ? n : null;
        }
        return null;
      };

      // Editor shows lightDiameter; runtime uses lightRadius (radius). Support both.
      const lrRaw = num(p.lightRadius);
      const ldRaw = num(p.lightDiameter);
      const lightRadius = (ldRaw != null) ? (ldRaw * 0.5) : ((lrRaw != null) ? lrRaw : 120);
      const lsRaw = num(p.lightStrength);
      const lightStrength = (lsRaw != null) ? lsRaw : 0.8;

      const aggroTiles = (typeof p.aggroTiles === "number") ? p.aggroTiles : 6;

      const flyRangeX = (typeof p.flyRangeX === "number") ? p.flyRangeX
        : ((typeof p.flyRadius === "number") ? p.flyRadius : 5);
      const flyRangeYUp = (typeof p.flyRangeYUp === "number") ? p.flyRangeYUp
        : ((typeof p.flyRadius === "number") ? p.flyRadius : 5);

      const flySpeed = (typeof p.flySpeed === "number") ? p.flySpeed : 45;
      const smooth = (typeof p.smooth === "number") ? p.smooth : 7.0;
      const flyTime = (typeof p.flyTime === "number") ? p.flyTime : 2.5;

      const cooldown = (typeof p.cooldown === "number") ? p.cooldown : 2.0;
      const fadeIn = (typeof p.fadeIn === "number") ? p.fadeIn : 0.35;
      const fadeOut = (typeof p.fadeOut === "number") ? p.fadeOut : 0.45;

      const perchSearchRadius = (typeof p.perchSearchRadius === "number") ? p.perchSearchRadius : 6;

      return {
        type:"firefly",
        active:true,
        x:px, y:py,
        w, h,

        _ffSprite: pick,
        dir: 1,

        homeX: px,
        homeY: py,

        lightRadius,
        lightStrength,
        lightK: 0,

        aggroR: aggroTiles * ts,
        flyRX: flyRangeX * ts,
        flyRY: flyRangeYUp * ts,
        flySpeed,
        smooth,
        flyTime,
        perchR: perchSearchRadius * ts,
        cooldown,
        fadeIn,
        fadeOut,

        mode: "rest",
        cdT: 0,
        tFly: 0,
        tWander: 0,

        destX: px,
        destY: py,
        landX: px,
        landY: py,

        vx: 0,
        vy: 0,

        _tail: [],
        _tailSpawnT: 0,

        solid:false
      };
    }

    makeFirefly(tx, ty, def){
      const ts = Lumo.TILE || 24;
      const w = (def && def.w) ? (def.w|0) : 12;
      const h = (def && def.h) ? (def.h|0) : 12;
      const params = (def && def.params && typeof def.params === "object") ? def.params : null;

      const px = (tx * ts);
      const py = (ty * ts);
      return this.makeFireflyPx(px, py, w, h, params);
    }




    makeCheckpoint(tx, ty, params = null){
      const ts = Lumo.TILE || 24;
      const p = (params && typeof params === "object") ? params : {};
      const customSpritePath = (typeof p.customSpritePath === "string" && p.customSpritePath.trim())
        ? p.customSpritePath.trim().replace(/^(\.{1,2}\/)+/, "")
        : "";

      const defaultList = this.sprites && this.sprites.checkpoints;
      const defaultSprite = (defaultList && defaultList.length) ? (defaultList.find(im => im && im._ok) || defaultList[0]) : null;

      return {
        type:"checkpoint",
        active:true,
        x:tx*ts,
        y:ty*ts,
        w:ts,
        h:ts,
        _checkpointSpritePath: customSpritePath || "",
        _checkpointSprite: customSpritePath ? this._tryLoadImage(customSpritePath) : defaultSprite
      };
    }

    makeLantern(tx, ty, radius=170, strength=0.85, visualOptions=null){
      const ts = Lumo.TILE || 24;
      const options = (visualOptions && typeof visualOptions === "object") ? visualOptions : {};
      const normalizedSpritePath = (typeof options.customSpritePath === "string" && options.customSpritePath.trim())
        ? options.customSpritePath.trim().replace(/^(\.{1,2}\/)+/, "")
        : "";
      const drawW = Number.isFinite(Number(options.drawW)) ? Math.max(1, Number(options.drawW)) : 24;
      const drawH = Number.isFinite(Number(options.drawH)) ? Math.max(1, Number(options.drawH)) : 32;
      const drawAnchor = String(options.drawAnchor || "BL").trim().toUpperCase() === "TL" ? "TL" : "BL";
      return {
        type:"lantern",
        active:true,
        x:tx*ts,
        y:ty*ts,
        w:14,
        h:14,
        radius,
        strength,
        _lanternSpritePath: normalizedSpritePath || "",
        _lanternSprite: normalizedSpritePath ? this._tryLoadImage(normalizedSpritePath) : null,
        _lanternDrawW: drawW,
        _lanternDrawH: drawH,
        _lanternDrawAnchor: drawAnchor,
      };
    }

    makeFlarePickup(tx, ty, amount=1, params=null){
      const ts = Lumo.TILE || 24;
      const p = (params && typeof params === "object") ? params : {};
      const customSpritePath = (typeof p.customSpritePath === "string" && p.customSpritePath.trim())
        ? p.customSpritePath.trim().replace(/^(\.{1,2}\/)+/, "")
        : "";
      const e = {
        type:"flarePickup",
        active:true,
        x:tx*ts,
        y:ty*ts,
        w:12,
        h:12,
        amount: amount|0,
        _flareSpritePath: customSpritePath || "",
        _flareSprite: customSpritePath ? this._tryLoadImage(customSpritePath) : null,
      };
      return e;
    }

    makeEnemy(tx, ty, left=null, right=null){
      const ts = Lumo.TILE || 24;
      const x = tx*ts, y = ty*ts;
      return {
        type:"patrolEnemy",
        active:true,
        x, y,
        w:18, h:18,
        vx: 50,
        homeX: x,
        left: (left==null ? x - ts*6 : left*ts),
        right:(right==null? x + ts*6 : right*ts),
        aggroR: 140,
        chasing:false
      };
    }

    // Dark creature med pixlar direkt (används för auto-spawn nära spelaren)
    makeDarkCreaturePx(px, py, w=18, h=18, params=null){
      const ts = Lumo.TILE || 24;
      const p = (params && typeof params === "object") ? params : {};
      const nOr = (v, fallback) => {
        const n = +v;
        return Number.isFinite(n) ? n : fallback;
      };
      const boolOr = (v, fallback) => {
        if (v == null) return fallback;
        if (typeof v === "string"){
          const t = v.trim().toLowerCase();
          if (t === "false" || t === "0" || t === "no") return false;
          if (t === "true" || t === "1" || t === "yes") return true;
        }
        return !!v;
      };

      const rawAggroTiles = nOr(p.aggroTiles, null);
      const rawAggroRadiusPx = nOr(p.aggroRadius, null);
      const aggroTiles = (rawAggroTiles != null)
        ? rawAggroTiles
        : ((rawAggroRadiusPx != null) ? (rawAggroRadiusPx / ts) : 6);

      const customSpritePath = (typeof p.customSpritePath === "string" && p.customSpritePath.trim())
        ? p.customSpritePath.trim().replace(/^(\.{1,2}\/)+/, "")
        : "";
      const projectileSpritePath = (typeof p.projectileSpritePath === "string" && p.projectileSpritePath.trim())
        ? p.projectileSpritePath.trim().replace(/^(\.{1,2}\/)+/, "")
        : "";

      return {
        type:"darkCreature",
        active:true,
        x:px,
        y:py,
        w, h,
        homeX: px,
        _dangerT: 0,
        _hitCd: 0,
        isDarkActive:false,
        vx: 0,
        // params (optional)
        hp: nOr(p.hp, 3),
        hitCooldown: nOr(p.hitCooldown, 0.6),
        safeDelay: nOr(p.safeDelay, 0.6),
        patrolTiles: nOr(p.patrolTiles, 0),
        aggroTiles,
        aggroRadiusPx: (rawAggroRadiusPx != null) ? rawAggroRadiusPx : null,
        energyLoss: nOr(p.energyLoss, 40),
        knockbackX: nOr(p.knockbackX, 260),
        knockbackY: nOr(p.knockbackY, -220),
        bodyEnergyLoss: nOr(p.bodyEnergyLoss, nOr(p.energyLoss, 40)),
        bodyKnockbackX: nOr(p.bodyKnockbackX, 160),
        bodyKnockbackY: nOr(p.bodyKnockbackY, -140),
        castCooldown: nOr(p.castCooldown, 5.5),
        castChargeTime: nOr(p.castChargeTime, 0.5),
        spellSpeedX: nOr(p.spellSpeedX, 190),
        spellGravity: nOr(p.spellGravity, 760),
        targetJitterPx: nOr(p.targetJitterPx, 3),
        _castCd: Math.random() * 0.35,
        _castChargeT: 0,
        _castTargetX: 0,
        _castTargetY: 0,
        _pulseHitId: -1,
        reactsToFlares: boolOr(p.reactsToFlares, true),
        flareConsumeBurnMul: Math.max(1, nOr(p.flareConsumeBurnMul, 7.5)),
        _animT: Math.random() * 0.8,
        _darkCreatureBodySpritePath: customSpritePath || "",
        _darkCreatureBodySprite: customSpritePath ? this._tryLoadImage(customSpritePath) : null,
        _darkCreatureProjectileSpritePath: projectileSpritePath || "",
        _darkCreatureProjectileSprite: projectileSpritePath ? this._tryLoadImage(projectileSpritePath) : null,
        dying:false,
        dissolveT:0,
        dissolveDur:1.35,
        _dissolveSpawnT:0,
        solid:false
      };
    }

    makeHoverVoidPx(px, py, w=16, h=16, params=null){
      const ts = Lumo.TILE || 24;
      const nOr = (v, fallback) => {
        const n = +v;
        return Number.isFinite(n) ? n : fallback;
      };
      const customSpritePath = (typeof params?.customSpritePath === "string" && params.customSpritePath.trim())
        ? params.customSpritePath.trim().replace(/^(\.{1,2}\/)+/, "")
        : "";
      const aggroTiles = Math.max(0, nOr(params && params.aggroTiles, 7));
      const followTiles = Math.max(0, nOr(params && params.followTiles, 7));
      const maxHp = Math.max(1, Math.floor(nOr(params && params.maxHp, 3)));
      const loseSightTiles = Math.max(0, nOr(params && params.loseSightTiles, 11));
      let attackCooldownMin = Math.max(0.2, nOr(params && params.attackCooldownMin, 1));
      let attackCooldownMax = Math.max(attackCooldownMin, nOr(params && params.attackCooldownMax, 3));
      const attackDamage = Math.max(0, nOr(params && params.attackDamage, 12));
      const attackPushback = Math.max(0, nOr(params && params.attackPushback, 180));
      const braveGroupSize = Math.max(1, Math.floor(nOr(params && params.braveGroupSize, 3)));
      const swarmGroupSize = Math.max(braveGroupSize, Math.floor(nOr(params && params.swarmGroupSize, 6)));

      return {
        type:"hoverVoid",
        active:true,
        x:px,
        y:py,
        w, h,
        homeX:px,
        homeY:py,
        vx:0,
        vy:0,
        hp:maxHp,
        maxHp,
        aggroTiles,
        followTiles,
        loseSightTiles,
        attackCooldownMin,
        attackCooldownMax,
        attackDamage,
        attackPushback,
        braveGroupSize,
        swarmGroupSize,
        awake:false,
        sleepBlend:1,
        eyeBlend:0,
        _pulseHitId:-1,
        _wakeHold:0,
        _t:Math.random()*100,
        _blinkT:2 + Math.random()*5,
        _blinkDur:0,
        _angryT:0,
        _angryCd:5 + Math.random()*6,
        _bickerCd:0.2 + Math.random()*0.9,
        _targetVX:0,
        _targetVY:0,
        _isFollowing:false,
        _recoilT:0,
        _lungeState:"idle",
        _lungeActor:false,
        _lungeT:0,
        _lungeDirX:0,
        _lungeDirY:0,
        _facingX:1,
        _lungeHitDone:false,
        _attackCd:attackCooldownMin + Math.random()*(attackCooldownMax-attackCooldownMin),
        _hoverVoidBodySpritePath: customSpritePath || "",
        _hoverVoidBodySprite: customSpritePath ? this._tryLoadImage(customSpritePath) : null,
      };
    }

    makeHoverVoid(tx, ty, def){
      const ts = Lumo.TILE || 24;
      const params = (def && def.params && typeof def.params === "object") ? def.params : null;
      const fallbackW = (def && Number.isFinite(Number(def.w))) ? Math.max(1, Number(def.w)) : 16;
      const fallbackH = (def && Number.isFinite(Number(def.h))) ? Math.max(1, Number(def.h)) : 16;
      const w = (params && Number.isFinite(Number(params.drawW))) ? Math.max(1, Number(params.drawW)) : fallbackW;
      const h = (params && Number.isFinite(Number(params.drawH))) ? Math.max(1, Number(params.drawH)) : fallbackH;
      return this.makeHoverVoidPx(tx*ts, ty*ts, w, h, params);
    }

    _startDarkCreatureDissolve(e){
      if (!e || e.dying) return;
      e.dying = true;
      e.dissolveT = 0;
      e._dissolveSpawnT = 0;
      e._hitCd = 999;
      e._castCd = 999;
      e._castChargeT = 0;
      e.vx = 0;
    }

    _spawnDarkCastChargeParticles(e, dt){
      if (!e || dt <= 0) return;
      const spawnCount = Math.floor(18 * dt + Math.random());
      const cx = e.x + e.w * 0.5;
      const cy = e.y + e.h * 0.45;
      for (let i=0;i<spawnCount;i++){
        const a = Math.random() * Math.PI * 2;
        const r = 4 + Math.random() * 8;
        const px = cx + Math.cos(a) * r;
        const py = cy + Math.sin(a) * r;
        this.items.push({
          type:"darkCastChargeParticle",
          active:true,
          x:px,
          y:py,
          vx:(cx - px) * (4.2 + Math.random() * 1.8),
          vy:(cy - py) * (4.2 + Math.random() * 1.8) - (6 + Math.random() * 8),
          t:0,
          life:0.2 + Math.random() * 0.18,
          size:0.9 + Math.random() * 1.5,
          alpha:0.22 + Math.random() * 0.2
        });
      }
    }

    _spawnDarkFlareConsumeVfx(flare, darkCreature, dt){
      if (!flare || !darkCreature || dt <= 0) return;
      const spawnCount = Math.floor(13 * dt + Math.random());
      for (let i=0;i<spawnCount;i++){
        const fx = flare.x + flare.w * 0.5 + (Math.random()*2 - 1) * 5;
        const fy = flare.y + flare.h * 0.5 + (Math.random()*2 - 1) * 5;
        const tx = darkCreature.x + darkCreature.w * 0.5;
        const ty = darkCreature.y + darkCreature.h * 0.45;
        const dx = tx - fx;
        const dy = ty - fy;
        const len = Math.max(0.001, Math.hypot(dx, dy));
        const sp = 70 + Math.random() * 65;
        this.items.push({
          type:"flareConsumeVfx",
          active:true,
          x:fx,
          y:fy,
          vx:(dx / len) * sp,
          vy:(dy / len) * sp,
          tx,
          ty,
          t:0,
          life:0.42 + Math.random() * 0.20,
          size:1.8 + Math.random() * 1.6,
          alpha:0.46 + Math.random() * 0.28
        });
      }
    }

    _spawnDarkDissolveParticles(e, dt){
      if (!e || dt <= 0) return;
      const spawnCount = Math.floor(42 * dt + Math.random());
      for (let i=0;i<spawnCount;i++){
        this.items.push({
          type:"darkDissolveParticle",
          active:true,
          x:e.x + Math.random() * e.w,
          y:e.y + e.h - 1,
          vx:(Math.random()*2 - 1) * 8,
          vy:-(55 + Math.random() * 70),
          t:0,
          life:0.95 + Math.random() * 0.45,
          size:2.2 + Math.random() * 1.9,
          alpha:0.58 + Math.random() * 0.24
        });
      }
    }

    _damagePlayer(player, sourceCx, knockbackX, knockbackY, energyLoss){
      if (!player) return;
      const dir = Math.sign((player.x + player.w*0.5) - sourceCx) || 1;
      const kbX = dir * knockbackX;
      if (typeof player.takeHit === "function"){
        player.takeHit({ knockbackX: kbX, knockbackY, energyLoss });
        return;
      }
      player.vx += kbX;
      player.vy = knockbackY;
      if (typeof player.energy === "number" && typeof player.setEnergy === "function"){
        player.setEnergy(player.energy - (energyLoss / 100));
      }
    }

    spawnDarkSpellProjectile(x, y, vx, vy, source){
      const projectileSpritePath = (typeof source?._darkCreatureProjectileSpritePath === "string")
        ? source._darkCreatureProjectileSpritePath
        : "";
      const projectileSprite = source?._darkCreatureProjectileSprite
        || (projectileSpritePath ? this._tryLoadImage(projectileSpritePath) : null);
      this.items.push({
        type:"darkSpellProjectile",
        active:true,
        x, y,
        w:12,
        h:12,
        vx, vy,
        gravity: source?.spellGravity || 760,
        rot: Math.atan2(vy, vx),
        age:0,
        maxAge:4.0,
        energyLoss: source?.energyLoss ?? 40,
        knockbackX: source?.knockbackX ?? 260,
        knockbackY: source?.knockbackY ?? -220,
        _darkSpellProjectileSpritePath: projectileSpritePath,
        _darkSpellProjectileSprite: projectileSprite,
      });
    }

    spawnDarkSpellHazard(centerX, centerY, source){
      const w = 18;
      const h = 18;
      this.items.push({
        type:"darkSpellHazard",
        active:true,
        x:centerX - w*0.5,
        y:centerY - h*0.5,
        w, h,
        vy:0,
        gravity: source?.spellGravity || 760,
        t:0,
        impactSeq:0.45,
        life:5.0,
        fadeStart:3.9,
        alpha:1,
        falling:true,
        grounded:false,
        hitCd:0,
        energyLoss: source?.energyLoss ?? 40,
        knockbackX: source?.knockbackX ?? 260,
        knockbackY: source?.knockbackY ?? -220,
      });
    }

    // Dark creature från tile-coords (level-data)
    makeDarkCreature(tx, ty, def){
      const ts = Lumo.TILE || 24;
      const params = (def && def.params && typeof def.params === "object") ? def.params : null;
      const authoredW = Number.isFinite(Number(params && params.drawW)) ? Math.max(1, Number(params.drawW)) : null;
      const authoredH = Number.isFinite(Number(params && params.drawH)) ? Math.max(1, Number(params.drawH)) : null;
      const w = (def && Number.isFinite(Number(def.w))) ? Math.max(1, Number(def.w)) : (authoredW || 18);
      const h = (def && Number.isFinite(Number(def.h))) ? Math.max(1, Number(def.h)) : (authoredH || 18);
      return this.makeDarkCreaturePx(tx*ts, ty*ts, w, h, params);
    }

    // basic moving platform factory (direct pixels)
    makeMovingPlatform(x, y, w, h, path){
      return {
        type:"movingPlatform",
        active:true,
        x, y,
        w, h,
        vx:0, vy:0,

        // prev positions for player.js carry logic
        prevX: x,
        prevY: y,

        path,
        speed: 80,
        loop: "pingpong",
        oneWay:false,
        carryVelocityToPlayer:true,
        pushoutSafety:6,
        _pathIndex:0,
        _dir:1
      };
    }

    // moving platform factory (from level def)
    makeMovingPlatformFromDef(def, levelObj){
      const ts = (levelObj && levelObj.meta && levelObj.meta.tileSize) ? levelObj.meta.tileSize : (Lumo.TILE || 24);
      const px = (def.x|0) * ts;
      const py = (def.y|0) * ts;
      const w = (def.w|0) * ts;
      const h = (def.h|0) * ts;

      const path = [];
      if (def.path && Array.isArray(def.path)){
        for (const p of def.path){
          if (!p) continue;
          path.push({ x:(p.x|0)*ts, y:(p.y|0)*ts });
        }
      }

      return {
        type:"movingPlatform",
        active:true,
        x:px,
        y:py,
        w, h,
        vx:0, vy:0,

        // prev positions for player.js carry logic
        prevX: px,
        prevY: py,

        path,
        speed: def.speed || 70,
        loop: def.loop || "pingpong",
        oneWay: !!def.oneWay,
        carryVelocityToPlayer: !!def.carryVelocityToPlayer,
        pushoutSafety: def.pushoutSafety || 6,
        _pathIndex: 0,
        _dir: 1
      };
    }

    // Convenience wrapper för player: kasta flare
    spawnThrownFlare(px, py){
      const vx = 380;
      const vy = -520;
      this.spawnFlare(px, py, vx, vy);
    }

    // Skapa flare-entitet (pixlar in)
    spawnFlare(px, py, vx, vy){
      this.items.push({
        type:"flare",
        active:true,
        x:px, y:py,
        w:10, h:10,
        vx, vy,
        bounces:0,

        // rotation
        rot:0,
        rotSpeed: Math.PI / 0.4,   // lite snabbare rotation
        airborne:true,

        // ljusbeteende
        t:0,
        life:12.0,
        fadeLast:3.0,
        radius0:220
      });
    }

    update(dt, world, player){
      const g = 980;
      const ts = Lumo.TILE || 24;
      this._lastPlayer = player || null;
      this._liquidAnimT += Math.max(0, Number.isFinite(dt) ? dt : 0);
      const flareBurnNearDarkCreatureMul = 7.5;

      // Frame-gate reset (used by power-cell gradual fill) — once per update() call.
      // Must NOT depend on lanterns existing in the level.
      this.__pcFillFrame = 0;

      // auto-spawn dark creature nära spelaren (TEST-HELPER, AVSTÄNGD som default)
      // Aktivera manuellt vid behov: window.Lumo.DEBUG_TEST_DARKCREATURE = true;
      if (Lumo && Lumo.DEBUG_TEST_DARKCREATURE){
        let hasDC = false;
        if (!this._autoSpawnedTestDarkCreature){
          for (const e of this.items){
            if (e.active && e.type === "darkCreature"){ hasDC = true; break; }
          }
        }
        if (!hasDC && player){
          this.items.push(this.makeDarkCreaturePx(player.x + 300, player.y, 18, 18));
          this._autoSpawnedTestDarkCreature = true;
        } else if (hasDC){
          this._autoSpawnedTestDarkCreature = true;
        }
      }

      if (this._hoverVoidAttackGlobalCd > 0) this._hoverVoidAttackGlobalCd -= dt;
      const hoverVoids = this.items.filter((it) => it && it.active && it.type === "hoverVoid");

      const playerCx = player ? (player.x + player.w * 0.5) : null;
      const playerCy = player ? (player.y + player.h * 0.5) : null;
      const prevCx = this._prevPlayerCenterX;

      for (const z of this._musicZones){
        if (!z.soundFile) continue;
        const handle = this._getSoundHandle(z.soundFile, z.loop);
        const fadePx = Math.max(1, z.fadeTiles * ts);
        let gain = 0;
        if (playerCx != null){
          if (playerCx >= z.xStart && playerCx <= z.xEnd) gain = 1;
          else if (playerCx < z.xStart && playerCx >= z.xStart - fadePx) gain = (playerCx - (z.xStart - fadePx)) / fadePx;
          else if (playerCx > z.xEnd && playerCx <= z.xEnd + fadePx) gain = ((z.xEnd + fadePx) - playerCx) / fadePx;
        }
        this._setHandleVolume(handle, z.volume * Math.max(0, Math.min(1, gain)));
      }

      for (const sp of this._spotSounds){
        if (!sp.soundFile) continue;
        const handle = this._getSoundHandle(sp.soundFile, sp.loop);
        let gain = 0;
        if (playerCx != null && playerCy != null && sp.radius > 0){
          const d = Math.hypot(playerCx - sp.cx, playerCy - sp.cy);
          if (d < sp.radius){
            gain = 1 - (d / sp.radius);
            gain = gain * gain;
          }
        }
        this._setHandleVolume(handle, sp.volume * Math.max(0, Math.min(1, gain)));
      }

      for (const tr of this._triggerSounds){
        if (!tr.soundFile || playerCx == null){ tr.lastSide = (playerCx==null?null:(playerCx >= tr.triggerX ? 1 : -1)); continue; }
        const side = (playerCx >= tr.triggerX) ? 1 : -1;
        const crossed = (prevCx != null) && ((prevCx < tr.triggerX && playerCx >= tr.triggerX) || (prevCx > tr.triggerX && playerCx <= tr.triggerX));
        if (crossed){
          if (!tr.once || !tr.fired){
            this._playOneShot(tr.soundFile, tr.volume);
            tr.fired = true;
          }
        }
        tr.lastSide = side;
      }

      this._prevPlayerCenterX = playerCx;

            for (const e of this.items){
        if (!e.active) continue;
        if (e.hidden) continue;
if (e.type === "lantern"){
  // Subtil magisk idle-float + långsam "andning" i ljusstyrka (endast visuellt)
  // - Mer upp/ner än sidled
  // - Varje lantern osynkad via slumpade faser + individuella hastigheter
  if (e._idleInit !== true){
    e._idleInit = true;
    e._t = Math.random() * 100.0;

    // Random phases (unsynced)
    e._phx1 = Math.random() * Math.PI * 2;
    e._phx2 = Math.random() * Math.PI * 2;
    e._phy1 = Math.random() * Math.PI * 2;
    e._phy2 = Math.random() * Math.PI * 2;
    e._php  = Math.random() * Math.PI * 2; // pulse phase

    // Amplitudes (requested: more up/down)
    e._ax = 0.6 + Math.random() * 0.9;   // ~0.6..1.5 px in X
    e._ay = 7.0 + Math.random() * 4.8;   // ~3.2..8.0 px in Y (more vertical)

    // Individual speed multipliers (prevents sync)
    e._sx = 0.70 + Math.random() * 0.70; // 0.70..1.40
    e._sy = 0.65 + Math.random() * 0.75; // 0.65..1.40
    e._sp = 0.75 + Math.random() * 0.60; // 0.75..1.35 (breathing)

    // Remember base light settings (for breathing)
    e._baseStrength = (typeof e.strength === "number") ? e.strength : 0.85;
    e._baseRadius   = (typeof e.radius === "number") ? e.radius : 170;
  }

  e._t += dt;
  const t0 = e._t;

  // Smooth, layered motion (no sharp corners)
  const dx =
    Math.sin((t0 * 0.48 * e._sx) + e._phx1) * e._ax +
    Math.sin((t0 * 0.14 * e._sx) + e._phx2) * (e._ax * 0.28);

  const dy =
    Math.sin((t0 * 0.42 * e._sy) + e._phy1) * e._ay +
    Math.sin((t0 * 0.12 * e._sy) + e._phy2) * (e._ay * 0.22);

  // Apply as render offsets (draw only)
  e._offX = dx;
  e._offY = dy;

  // Slow breathing pulse for the lantern light (strength + tiny radius drift)
  const breath = 0.5 + 0.5 * Math.sin((t0 * 0.42 * e._sp) + e._php); // 0..1
  e.strength = e._baseStrength * (0.80 + 0.20 * breath);
  e.radius   = e._baseRadius   * (0.95 + 0.05 * breath);
}

        if (e.type === "flare"){
          const consumingDc = this.findDarkCreatureConsumingFlare(e, ts);
          const flareBurnMul = consumingDc
            ? Math.max(1, Number.isFinite(consumingDc.flareConsumeBurnMul) ? consumingDc.flareConsumeBurnMul : flareBurnNearDarkCreatureMul)
            : 1;
          e.t += dt * flareBurnMul;
          if (consumingDc) this._spawnDarkFlareConsumeVfx(e, consumingDc, dt);
          e.vy += g * dt;

          // integrate
          e.x += e.vx * dt;
          e.y += e.vy * dt;

          // rotation
          e.rot = (e.rot || 0) + (e.rotSpeed || 0) * dt;

          // collide with world
          const col = world.collideRect(e.x, e.y, e.w, e.h);
          if (col.hit){
            // bounce a bit on first impacts
            if (e.bounces < 2){
              if (col.nx !== 0) e.vx *= -0.4;
              if (col.ny !== 0) e.vy *= -0.4;
              e.bounces++;
            } else {
              // stop
              e.vx = 0;
              e.vy = 0;
            }

            // separate
            e.x += col.nx * col.depth;
            e.y += col.ny * col.depth;

            // if resting on ground -> stop rotation
            if (col.ny === -1){
              e.rotSpeed = 0;
              e.airborne = false;
            }
          }

          // expire
          if (e.t > e.life){
            e.active = false;
          }
        }

        if (e.type === "movingPlatform"){
          // store prev
          e.prevX = e.x;
          e.prevY = e.y;

          if (e.path && e.path.length >= 2){
            const target = e.path[e._pathIndex];
            const dx = target.x - e.x;
            const dy = target.y - e.y;
            const dist = Math.hypot(dx, dy);
            const sp = e.speed || 60;

            if (dist < 1){
              // advance
              e._pathIndex += e._dir;
              if (e._pathIndex >= e.path.length){
                if (e.loop === "loop"){
                  e._pathIndex = 0;
                } else {
                  e._pathIndex = e.path.length - 2;
                  e._dir = -1;
                }
              } else if (e._pathIndex < 0){
                e._pathIndex = 1;
                e._dir = 1;
              }
            } else {
              e.vx = (dx / dist) * sp;
              e.vy = (dy / dist) * sp;
              e.x += e.vx * dt;
              e.y += e.vy * dt;
            }
          }
        }

        if (e.type === "darkSpellProjectile"){
          e.age += dt;
          e.vy += (e.gravity || 760) * dt;
          e.x += e.vx * dt;
          e.y += e.vy * dt;
          e.rot = Math.atan2(e.vy || 0, e.vx || 0);

          let impacted = false;

          if (player && this.aabb(player.x, player.y, player.w, player.h, e.x, e.y, e.w, e.h)){
            const cx = e.x + e.w*0.5;
            this._damagePlayer(player, cx, e.knockbackX ?? 260, e.knockbackY ?? -220, e.energyLoss ?? 40);
            impacted = true;
          }

          const col = world.collideRect(e.x, e.y, e.w, e.h);
          if (!impacted && col.hit){
            e.x += col.nx * col.depth;
            e.y += col.ny * col.depth;
            impacted = true;
          }

          if (!impacted && e.age >= (e.maxAge || 4.0)) impacted = true;

          if (impacted){
            this.spawnDarkSpellHazard(e.x + e.w*0.5, e.y + e.h*0.5, e);
            e.active = false;
            continue;
          }
        }

        if (e.type === "darkSpellHazard"){
          e.t += dt;
          if (e.hitCd > 0) e.hitCd -= dt;

          if (e.falling){
            e.vy += (e.gravity || 760) * dt;
            e.y += e.vy * dt;
            const col = world.collideRect(e.x, e.y, e.w, e.h);
            if (col.hit){
              e.x += col.nx * col.depth;
              e.y += col.ny * col.depth;
              if (col.ny === -1){
                e.falling = false;
                e.grounded = true;
                e.vy = 0;
              }
            }
          }

          if (e.t >= (e.fadeStart || 3.9)){
            const left = Math.max(0.001, (e.life || 5) - (e.fadeStart || 3.9));
            e.alpha = Math.max(0, ((e.life || 5) - e.t) / left);
          } else {
            e.alpha = 1;
          }

          if (player && e.hitCd <= 0 && e.alpha > 0.02 && this.aabb(player.x, player.y, player.w, player.h, e.x, e.y, e.w, e.h)){
            const cx = e.x + e.w*0.5;
            this._damagePlayer(player, cx, e.knockbackX ?? 260, e.knockbackY ?? -220, e.energyLoss ?? 40);
            e.hitCd = 0.5;
          }

          if (e.t >= (e.life || 5)){
            e.active = false;
            continue;
          }
        }

        if (e.type === "patrolEnemy"){
          if (!e.chasing){
            e.x += e.vx * dt;
            if (e.x < e.left){ e.x = e.left; e.vx *= -1; }
            if (e.x > e.right){ e.x = e.right; e.vx *= -1; }
          }

          if (player){
            const cx = e.x + e.w/2;
            const cy = e.y + e.h/2;
            const pcx = player.x + player.w/2;
            const pcy = player.y + player.h/2;
            const d = Math.hypot(pcx - cx, pcy - cy);
            e.chasing = d < (e.aggroR || 140);
            if (e.chasing){
              const dir = Math.sign(pcx - cx);
              e.vx = dir * 90;
              e.x += e.vx * dt;
            }
          }
        }



        if (e.type === "darkCreature"){
          if (e.dying){
            e.dissolveT = (e.dissolveT || 0) + dt;
            e._dissolveSpawnT = (e._dissolveSpawnT || 0) - dt;
            if (e._dissolveSpawnT <= 0){
              e._dissolveSpawnT = 0.035;
              this._spawnDarkDissolveParticles(e, 0.035);
            }
            if (e.dissolveT >= (e.dissolveDur || 1.35)){
              e.active = false;
            }
            continue;
          }

          e._animT = (e._animT || 0) + dt;
          if (e._hitCd > 0) e._hitCd -= dt;
          if (e._castCd > 0) e._castCd -= dt;

          // lit test: player + flares only (lantern ignored intentionally)
          const cx = e.x + e.w/2;
          const cy = e.y + e.h/2;
          const lit = (e.reactsToFlares === false) ? this.isPointLitFromPlayerOnly(cx, cy, player) : this.isPointLit(cx, cy, player);

          if (lit){
            // safe while lit, but keep danger for a moment after light ends
            e.isDarkActive = false;
            e._dangerT = (e.safeDelay != null ? e.safeDelay : 0.25);
          } else {
            if (e._dangerT > 0){
              e._dangerT -= dt;
              e.isDarkActive = false;
            } else {
              e.isDarkActive = true;
            }
          }

          // Stand-ground behavior: no patrol, no chase, no facing/rotation changes.
          e.vx = 0;

          const aggroPx = (typeof e.aggroRadiusPx === "number" && e.aggroRadiusPx > 0)
            ? e.aggroRadiusPx
            : Math.max(0, (e.aggroTiles || 0) * ts || (6 * ts));

          const canCastNow = !!(player && aggroPx > 0);

          if (e._castChargeT > 0){
            if (!canCastNow){
              e._castChargeT = 0;
            } else {
              const pcx = player.x + player.w/2;
              const pcy = player.y + player.h/2;
              const d = Math.hypot(pcx - cx, pcy - cy);
              if (d > aggroPx){
                e._castChargeT = 0;
              } else {
                this._spawnDarkCastChargeParticles(e, dt);
                e._castChargeT -= dt;
                if (e._castChargeT <= 0){
                  const tx = e._castTargetX;
                  const ty = e._castTargetY;
                  const dx = tx - cx;
                  const dy = ty - cy;
                  const tFlight = Math.max(0.35, Math.min(1.2, d / Math.max(120, Math.abs(e.spellSpeedX || 190))));
                  const vx = dx / Math.max(0.001, tFlight);
                  let vy = (dy - (0.5 * (e.spellGravity || 760) * tFlight * tFlight)) / Math.max(0.001, tFlight);
                  if (!Number.isFinite(vy)) vy = -220;
                  this.spawnDarkSpellProjectile(cx - 6, cy - 10, vx, vy, e);
                  e._castCd = Math.max(0.1, e.castCooldown || 5.5);
                  e._castChargeT = 0;
                }
              }
            }
          }

          if (canCastNow && e._castChargeT <= 0 && e._castCd <= 0){
            const pcx = player.x + player.w/2;
            const pcy = player.y + player.h/2;
            const dx = pcx - cx;
            const dy = pcy - cy;
            const d = Math.hypot(dx, dy);
            if (d <= aggroPx){
              const jitter = Math.max(0, e.targetJitterPx || 0);
              e._castTargetX = pcx + (Math.random()*2 - 1) * jitter;
              e._castTargetY = pcy + (Math.random()*2 - 1) * jitter;
              e._castChargeT = Math.max(0.05, e.castChargeTime || 0.5);
              this._spawnDarkCastChargeParticles(e, Math.min(dt, 0.06));
            }
          }

          if (player && player.pulse && player.pulse.active){
            const pulseId = (typeof player.pulse.id === "number") ? player.pulse.id : 0;
            const dist = Math.hypot((player.x + player.w*0.5) - cx, (player.y + player.h*0.5) - cy);
            if (pulseId !== e._pulseHitId && dist <= (player.pulse.r + Math.max(e.w, e.h)*0.55)){
              e._pulseHitId = pulseId;
              e.hp = (Number.isFinite(e.hp) ? e.hp : 3) - 1;
              if (e.hp <= 0){
                this._startDarkCreatureDissolve(e);
              }
            }
          }

          // body-contact damage is always active (independent from casting/aura state)
          if (player && e._hitCd <= 0){
            const hit = this.aabb(player.x, player.y, player.w, player.h, e.x, e.y, e.w, e.h);
            if (hit){
              e._hitCd = (e.hitCooldown != null ? e.hitCooldown : 0.6);
              this._damagePlayer(
                player,
                cx,
                e.bodyKnockbackX ?? 160,
                e.bodyKnockbackY ?? -140,
                e.bodyEnergyLoss ?? e.energyLoss ?? 40
              );
            }
          }
        }
        if (e.type === "hoverVoid"){
          const cx = e.x + e.w*0.5;
          const cy = e.y + e.h*0.5;
          e._t = (e._t || 0) + dt;
          e._targetVX = 0;
          e._targetVY = Math.sin(e._t * 1.3 + cx * 0.01) * 12;
          if (e._attackCd > 0) e._attackCd -= dt;
          if (e._recoilT > 0) e._recoilT -= dt;

          const pcx = player ? (player.x + player.w*0.5) : cx;
          const pcy = player ? (player.y + player.h*0.5) : cy;
          const toPlayerX = pcx - cx;
          const toPlayerY = pcy - cy;
          const dPlayer = Math.hypot(toPlayerX, toPlayerY);
          const wakeR = Math.max(0, e.aggroTiles * ts);
          const followTiles = Number.isFinite(e.followTiles) ? e.followTiles : 7;
          const followR = Math.max(0, followTiles * ts);
          const loseTiles = Number.isFinite(e.loseSightTiles) ? e.loseSightTiles : 11;
          const loseR = Math.max(0, loseTiles * ts);

          if (!e.awake && player && dPlayer <= wakeR) e.awake = true;
          if (e.awake){
            if (player && dPlayer <= loseR) e._wakeHold = 1.4;
            else e._wakeHold = Math.max(0, (e._wakeHold || 0) - dt);
            if (e._wakeHold <= 0) e.awake = false;
          }

          e.eyeBlend += (e.awake ? 1 : -1) * dt * 2.5;
          e.eyeBlend = Math.max(0, Math.min(1, e.eyeBlend));
          e.sleepBlend += (e.awake ? -1 : 1) * dt * 0.8;
          e.sleepBlend = Math.max(0, Math.min(1, e.sleepBlend));

          if (e.awake){
            if (!player){
              e._isFollowing = false;
            } else if (!e._isFollowing){
              if (dPlayer <= followR) e._isFollowing = true;
            } else if (dPlayer > loseR){
              e._isFollowing = false;
            }
            e._blinkT -= dt;
            if (e._blinkT <= 0){
              e._blinkDur = 0.12 + Math.random()*0.07;
              e._blinkT = 6 + Math.random()*9;
            }
            if (e._blinkDur > 0) e._blinkDur -= dt;

            if (e._lungeState === "idle"){
              const awakeList = hoverVoids.filter((h) => h.awake);
              const groupSize = awakeList.length;
              const brave = groupSize >= e.braveGroupSize;
              const targetDist = 3 * ts;
              const shouldFollow = !!e._isFollowing;
              if (shouldFollow && dPlayer > targetDist){
                const d = Math.max(0.001, dPlayer);
                e._targetVX += (toPlayerX / d) * 52;
                e._targetVY += (toPlayerY / d) * 52;
              } else if (shouldFollow){
                const d = Math.max(0.001, dPlayer);
                e._targetVX -= (toPlayerX / d) * 22;
                e._targetVY -= (toPlayerY / d) * 22;
              }

              let neighborCount = 0;
              for (const other of awakeList){
                if (other === e) continue;
                const ocx = other.x + other.w*0.5;
                const ocy = other.y + other.h*0.5;
                const dx = ocx - cx;
                const dy = ocy - cy;
                const d = Math.hypot(dx, dy);
                const sameFollowState = !!other._isFollowing === shouldFollow;
                if (d < ts * 6){
                  neighborCount++;
                  if (sameFollowState){
                    const socialPull = Math.max(0, 1 - d / (ts * 6));
                    e._targetVX += (dx / Math.max(0.001, d)) * 24 * socialPull;
                    e._targetVY += (dy / Math.max(0.001, d)) * 24 * socialPull;
                  }
                }
                const sepR = ts * 1.25;
                if (d > 0.001 && d < sepR){
                  const push = (1 - d / sepR) * 85;
                  e._targetVX -= (dx / d) * push;
                  e._targetVY -= (dy / d) * push;
                }
                if (d > 0.001 && d < ts * 0.95 && e._bickerCd <= 0){
                  const recoil = 80;
                  e.vx -= (dx / d) * recoil;
                  e.vy -= (dy / d) * recoil;
                  e._bickerCd = 0.55 + Math.random() * 0.65;
                  e._angryT = Math.max(e._angryT, 0.22 + Math.random() * 0.3);
                }
              }
              if (e._bickerCd > 0) e._bickerCd -= dt;

              e._angryCd -= dt;
              if (neighborCount >= 1 && e._angryCd <= 0 && Math.random() < dt * 0.1){
                e._angryT = 3 + Math.random()*2;
                e._angryCd = 15;
              }

              const swarmBonus = (groupSize >= e.swarmGroupSize) ? 0.6 : 0;
              const canAttack = brave && shouldFollow && dPlayer <= Math.max(ts * 1.0, targetDist + ts * 0.5);
              if (canAttack && e._attackCd <= 0 && this._hoverVoidAttackGlobalCd <= 0){
                e._lungeState = "out";
                e._lungeActor = true;
                e._lungeT = 0;
                const d = Math.max(0.001, dPlayer);
                e._lungeDirX = toPlayerX / d;
                e._lungeDirY = toPlayerY / d;
                e._lungeHitDone = false;
                e._angryT = Math.max(e._angryT, 0.55);
                const gap = e.attackCooldownMin + Math.random() * Math.max(0.01, (e.attackCooldownMax - e.attackCooldownMin));
                e._attackCd = gap;
                this._hoverVoidAttackGlobalCd = gap + swarmBonus;
              }
            }
          } else {
            e._isFollowing = false;
            e._targetVX += (Math.sin(e._t*0.7 + cy * 0.02) * 16);
            e._targetVY += (Math.cos(e._t*0.6 + cx * 0.02) * 12);
          }

          if (!e._isFollowing && e._lungeState !== "idle"){
            e._lungeState = "idle";
            e._lungeActor = false;
            e._lungeT = 0;
            e._lungeHitDone = false;
          }

          if (e._lungeState !== "idle"){
            e._angryT = Math.max(e._angryT, 0.08);
            e._lungeT += dt;
            const speedOut = 210 + (hoverVoids.length >= e.swarmGroupSize ? 80 : 0);
            if (e._lungeState === "out"){
              e._targetVX = e._lungeDirX * speedOut;
              e._targetVY = e._lungeDirY * speedOut;
              if (!e._lungeHitDone && player){
                const near = this.aabb(player.x-4, player.y-4, player.w+8, player.h+8, e.x, e.y, e.w, e.h);
                if (near){
                  e._lungeHitDone = true;
                  this._damagePlayer(player, cx, e.attackPushback ?? 180, -95, e.attackDamage ?? 12);
                  e.vx -= e._lungeDirX * 80;
                  e.vy -= e._lungeDirY * 80;
                  e._recoilT = 0.2;
                  e._lungeState = "back";
                  e._lungeT = 0;
                }
              }
              if (e._lungeT >= 0.32){
                e._lungeState = "back";
                e._lungeT = 0;
              }
            } else if (e._lungeState === "back"){
              e._targetVX = -e._lungeDirX * 165;
              e._targetVY = -e._lungeDirY * 165;
              if (e._lungeT >= 0.28){
                e._lungeState = "idle";
                e._lungeActor = false;
                e._lungeT = 0;
              }
            }
          }

          if (e._angryT > 0) e._angryT -= dt;

          const smooth = 7.5;
          e.vx += (e._targetVX - e.vx) * Math.min(1, smooth * dt);
          e.vy += (e._targetVY - e.vy) * Math.min(1, smooth * dt);
          const faceThreshold = 14;
          if (e.vx > faceThreshold) e._facingX = 1;
          else if (e.vx < -faceThreshold) e._facingX = -1;
          if (e._recoilT > 0){
            e.vx *= 0.92;
            e.vy *= 0.92;
          }
          const maxSpd = 125 + (hoverVoids.filter((h)=>h.awake).length >= e.swarmGroupSize ? 35 : 0);
          const sp = Math.hypot(e.vx, e.vy);
          if (sp > maxSpd){
            e.vx = (e.vx / sp) * maxSpd;
            e.vy = (e.vy / sp) * maxSpd;
          }

          e.x += e.vx * dt;
          e.y += e.vy * dt;

          const col = world.collideRect(e.x, e.y, e.w, e.h);
          if (col.hit){
            e.x += col.nx * col.depth;
            e.y += col.ny * col.depth;
            if (col.nx !== 0) e.vx *= -0.18;
            if (col.ny !== 0) e.vy *= -0.18;
          }

          if (player && player.pulse && player.pulse.active){
            const pulseId = (typeof player.pulse.id === "number") ? player.pulse.id : 0;
            const dist = Math.hypot((player.x + player.w*0.5) - cx, (player.y + player.h*0.5) - cy);
            if (pulseId !== e._pulseHitId && dist <= (player.pulse.r + Math.max(e.w, e.h)*0.6)){
              e._pulseHitId = pulseId;
              e.hp = (Number.isFinite(e.hp) ? e.hp : e.maxHp || 3) - 1;
              if (e.hp <= 0){
                e.active = false;
              }
            }
          }
        }

        if (e.type === "flareConsumeVfx"){
          e.t += dt;
          const p = e.t / Math.max(0.001, e.life || 0.5);
          if (p >= 1){
            e.active = false;
            continue;
          }
          const ax = ((e.tx || e.x) - e.x) * 9.2;
          const ay = ((e.ty || e.y) - e.y) * 9.2;
          e.vx += ax * dt;
          e.vy += ay * dt;
          e.vx *= 0.9;
          e.vy *= 0.9;
          e.x += e.vx * dt;
          e.y += e.vy * dt;
        }

        if (e.type === "darkDissolveParticle"){
          e.t += dt;
          const p = e.t / Math.max(0.001, e.life || 1);
          if (p >= 1){
            e.active = false;
            continue;
          }
          e.vy -= 24 * dt;
          e.x += e.vx * dt;
          e.y += e.vy * dt;
          e.vx *= 0.985;
        }

        if (e.type === "darkCastChargeParticle"){
          e.t += dt;
          const p = e.t / Math.max(0.001, e.life || 1);
          if (p >= 1){
            e.active = false;
            continue;
          }
          e.x += e.vx * dt;
          e.y += e.vy * dt;
          e.vx *= 0.9;
          e.vy *= 0.9;
        }

        if (e.type === "firefly"){
          const ts = Lumo.TILE || 24;

          if (!e._tail) e._tail = [];
          for (let i = e._tail.length - 1; i >= 0; i--){
            e._tail[i].t += dt;
            if (e._tail[i].t > 0.35) e._tail.splice(i, 1);
          }

          const cx = e.x + e.w/2;
          const cy = e.y + e.h/2;

          const pickWanderTarget = () => {
            const rx = (typeof e.flyRX === "number") ? e.flyRX : (ts*5);
            const ry = (typeof e.flyRY === "number") ? e.flyRY : (ts*5);

            const dx = (Math.random()*2 - 1) * rx;
            const dyUp = Math.random() * ry;

            e.destX = e.homeX + dx;
            e.destY = e.homeY - dyUp;

            e.tWander = 0.9 + Math.random() * 0.9;
          };

          const findPerch = () => {
            const rx = (typeof e.flyRX === "number") ? e.flyRX : (ts*5);
            const ry = (typeof e.flyRY === "number") ? e.flyRY : (ts*5);

            let best = null;
            let bestD = Infinity;

            for (const p of this.items){
              if (!p || !p.active) continue;
              if (p === e) continue;
              if (p.type !== "decor") continue;

              const px = p.x + p.w/2;
              const perchOffset = (typeof p.perchOffsetY === "number") ? p.perchOffsetY : 0;
            const py = p.y + p.h + perchOffset;

              const inRect =
                (px >= e.homeX - rx && px <= e.homeX + rx) &&
                (py >= e.homeY - ry && py <= e.homeY);
              if (!inRect) continue;

              const d = Math.hypot(px - cx, py - cy);
              if (d <= (e.perchR || ts*6) && d < bestD){
                best = { x:px, y:py };
                bestD = d;
              }
            }
            return best;
          };

          if (e.cdT > 0) e.cdT = Math.max(0, e.cdT - dt);

          const speed = (typeof e.flySpeed === "number") ? e.flySpeed : 45;
          const smooth = (typeof e.smooth === "number") ? e.smooth : 7.0;

          const moveToward = (tx, ty, spdMul) => {
            const dx = tx - e.x;
            const dy = ty - e.y;
            const dist = Math.hypot(dx, dy) || 1;

            const desiredVx = (dx / dist) * speed * spdMul;
            const desiredVy = (dy / dist) * speed * spdMul;

            e.vx += (desiredVx - e.vx) * smooth * dt;
            e.vy += (desiredVy - e.vy) * smooth * dt;

            e.x += e.vx * dt;
            e.y += e.vy * dt;

            if (e.y > e.homeY) e.y = e.homeY;

            if (Math.abs(e.vx) > 1) e.dir = (e.vx >= 0) ? 1 : -1;

            return dist;
          };

          const fadeIn = (typeof e.fadeIn === "number" && e.fadeIn > 0) ? e.fadeIn : 0.35;
          const fadeOut = (typeof e.fadeOut === "number" && e.fadeOut > 0) ? e.fadeOut : 0.45;

          if (e.mode === "rest"){
            e.vx = 0; e.vy = 0;
            e.lightK = 0;

            if (e.cdT <= 0){
              const near = this.isFireflyTriggeredByAnyLight(cx, cy, player, (e.aggroR || ts*6), e);
              if (near){
                e.mode = "takeoff";
                e.tFly = (e.flyTime != null ? e.flyTime : 2.5);
                pickWanderTarget();
              }
            }
          }
          else if (e.mode === "takeoff"){
            e.lightK = Math.min(1, e.lightK + dt / fadeIn);
            moveToward(e.destX, e.destY, 0.65);
            if (e.lightK >= 0.999) e.mode = "fly";
          }
          else if (e.mode === "fly"){
            e.lightK = 1;

            e.tFly -= dt;
            e.tWander -= dt;

            const dist = moveToward(e.destX, e.destY, 1.0);

            e._tailSpawnT = (e._tailSpawnT || 0) - dt;
            if (e._tailSpawnT <= 0){
              e._tailSpawnT = 0.04;
              const tailX = (e.dir === 1) ? (e.x + 2) : (e.x + e.w - 2);
              const tailY = e.y + e.h * 0.65;
              e._tail.push({ x: tailX + (Math.random()*2-1), y: tailY + (Math.random()*2-1), t:0 });
              if (e._tail.length > 14) e._tail.shift();
            }

            if (e.tWander <= 0 || dist < 8){
              pickWanderTarget();
            }

            if (e.tFly <= 0){
              const perch = findPerch();
              if (perch){
                e.landX = perch.x - e.w/2;
                e.landY = perch.y - e.h;
              } else {
                e.landX = e.homeX;
                e.landY = e.homeY;
              }
              e.mode = "landing";
            }
          }
          else if (e.mode === "landing"){
            // Robust landing: don't let smoothing hover forever just above the perch.
            e._landingT = (e._landingT || 0) + dt;

            // Mild ease-in near target to feel organic.
            const dx0 = e.landX - e.x;
            const dy0 = e.landY - e.y;
            const dist0 = Math.hypot(dx0, dy0);
            const d0 = 80; // px where we start easing down (tweak: 60..110)
            const spdMul = (dist0 < d0) ? (0.25 + 0.30 * (dist0 / d0)) : 0.55;

            moveToward(e.landX, e.landY, spdMul);

            // Ljuset ska vara kvar under hela inflygningen
            e.lightK = 1;

            // Snap conditions (distance OR timeout)
            const dx1 = e.landX - e.x;
            const dy1 = e.landY - e.y;
            const dist1 = Math.hypot(dx1, dy1);
            if (dist1 < 6 || (Math.abs(dx1) < 2 && Math.abs(dy1) < 2) || (e._landingT > 3 && dist1 < 2)){
              // Touchdown: lås position och växla till "landed"
              e.x = e.landX;
              e.y = Math.min(e.landY, e.homeY);
              e.vx = 0; e.vy = 0;
              e.mode = "landed";
              e._landedT = 0;
              e._landingT = 0;
            }
          }
          else if (e.mode === "landed"){
            // Canon: fully lit while perched, then everything OFF exactly at 0.6s.
            const HOLD = 0.60; // do not change (canon)
            const FADE = 0.18; // tweak: 0.10..0.28 (after-glow before off)

            e.vx = 0; e.vy = 0;
            e._landedT = (e._landedT || 0) + dt;

            if (e._landedT < (HOLD - FADE)){
              e.lightK = 1;
            } else {
              const p = Math.max(0, Math.min(1, (e._landedT - (HOLD - FADE)) / FADE));
              const s = p*p*(3 - 2*p); // smoothstep
              e.lightK = 1 - s;
            }

            if (e._landedT >= HOLD){
              e.lightK = 0;
              e.mode = "rest";
              e.cdT = (typeof e.cooldown === "number") ? e.cooldown : 2.0;
            }
          }
        }



        // pickups
        if (player){
          // Power-cell: gradvis energifyllning (retro) — körs deterministiskt 1 gång per frame
          // Vi gör det här med en intern frame-gate, så den INTE blir snabbare ju fler entities som finns.
          if (player.__pcFill){
            // initiera gate för den här frame:n om den inte finns
            if (this.__pcFillFrame == null) this.__pcFillFrame = 0;

            // använd en frame-tick som vi nollställer per update()-anrop (se längst ner i blocket)
            if (this.__pcFillFrame === 0){
              player.__pcFill.t += dt;
              const t = Math.min(1, player.__pcFill.t / player.__pcFill.dur);

              // mjuk "ease-out" retro-känsla
              const k = 1 - Math.pow(1 - t, 3);

              // spara startvärde första gången
              if (player.__pcFill.from == null){
                player.__pcFill.from = (typeof player.energy === "number") ? player.energy : 0;
              }

              // uppdatera energi
              if (typeof player.energy === "number"){
                player.energy = player.__pcFill.from + (1 - player.__pcFill.from) * k;
              } else if (typeof player.chargeEnergy === "function"){
                // fallback om energy inte finns: pumpa i små steg mot max
                const prev = player.__pcFill.prevK || 0;
                const deltaK = Math.max(0, k - prev);
                player.__pcFill.prevK = k;
                player.chargeEnergy(999 * deltaK);
              }

              // klar
              if (t >= 1){
                player.__pcFill = null;
              }

              // markera att laddningen redan tickats denna frame
              this.__pcFillFrame = 1;
            }
          }

          if ((e.type === "powerCell" || e.type === "flarePickup") && e.active){
            const hit = this.aabb(player.x, player.y, player.w, player.h, e.x, e.y, e.w, e.h);
            if (hit){
              e.active = false;

              if (e.type === "powerCell"){
                // Starta en kort laddningsfas istället för PANG-fullt
                player.__pcFill = { t: 0, dur: 1.6, from: null, prevK: 0 };
              }

              if (e.type === "flarePickup"){
                if (typeof player.addFlares === "function") player.addFlares(e.amount || 1);
                player._flareSprite = e._flareSprite || null;
                player._flareSpritePath = e._flareSpritePath || "";
              }
            }
          }

          if (e.type === "lantern" && e.active){
            // lantern charge if player is inside radius

            const cx = e.x + e.w/2;
            const cy = e.y + e.h/2;
            const pcx = player.x + player.w/2;
            const pcy = player.y + player.h/2;
            const d = Math.hypot(pcx - cx, pcy - cy);
            if (d <= (e.radius || 170)){
              if (typeof player.chargeEnergy === "function"){
                // Charge rate tuned to visibly counter normal movement drain.
                // Per-second charge ≈ strength * 0.12
                player.chargeEnergy((e.strength || 0.85) * 0.12 * dt);
              }
            }
          }

          if (e.type === "checkpoint" && e.active){
            const hit = this.aabb(player.x, player.y, player.w, player.h, e.x, e.y, e.w, e.h);
            if (hit && typeof player.setCheckpoint === "function"){
              player.setCheckpoint(e.x, e.y);
            }
          }
        }
      }

      // --- FogVolume update (Smooke-style, hard budget) ---
      // Runs only every 3rd update() call to protect frame time and input.
      this._fogFrame++;
      if ((this._fogFrame % 3) === 0 && this._fogVolumes.length){
        const playerCenterX = player ? (player.x + player.w * 0.5) : null;
        for (const f of this._fogVolumes){
          if (playerCenterX != null){
            // Conservative first-pass relevance gate: keep sim active around player/camera space,
            // skip far-off fog volumes with generous horizontal padding to avoid visible pop-in.
            const simPadding = Math.max(480, (f.x1 - f.x0) * 0.5 + (f.radius || 0) * 2 + (f.falloff || 0));
            if (playerCenterX < (f.x0 - simPadding) || playerCenterX > (f.x1 + simPadding)) continue;
          }

          const N = f.N;
          const field = f.field;
          const vel = f.vel;

          // Diffusion (laplacian) into velocity
          const D = f.diffuse;
          for (let i=1;i<N-1;i++){
            const lap = field[i-1] - 2*field[i] + field[i+1];
            vel[i] += lap * D * 120 * dt;
          }

          // Relax + visc
          const R = f.relax;
          const V = f.visc;
          for (let i=0;i<N;i++){
            vel[i] += (0 - field[i]) * R * 120 * dt;
            vel[i] *= V;
            field[i] += vel[i] * dt;

            // Clamp to keep things stable
            if (field[i] > 2.2) field[i] = 2.2;
            else if (field[i] < -2.2) field[i] = -2.2;
          }


          // Organic idle waves (premium) — visible even without player interaction.
          if (f.orgStrength && f.orgStrength > 0){
            f.t = (f.t || 0) + dt * (f.orgSpeed || 1);
            const s = f.orgStrength;
            const sc = Math.max(0.2, f.orgScale || 1);
            for (let i=0;i<N;i++){
              const u = i / (N-1);
              const w =
                Math.sin((u * 6.283) * (1.2/sc) + f.t * 0.9) * 0.55 +
                Math.sin((u * 6.283) * (2.3/sc) - f.t * 1.3) * 0.30 +
                Math.sin((u * 6.283) * (3.7/sc) + f.t * 1.8) * 0.15;
              vel[i] += w * s * 0.22 * dt * 60;
            }
          }

          // Player interaction (gated by speed)
          if (player){
            const vx = (typeof player.vx === "number") ? player.vx : 0;
            const speed = Math.abs(vx);
            if (speed > f.gate){
              const centerX = (player.x + player.w*0.5);
          // Only react when Lumo is actually inside the fog volume (prevents early reaction).
          if (centerX < f.x0 || centerX > f.x1) continue;
              const u = (centerX - f.x0) / Math.max(1, (f.x1 - f.x0));
              const c = Math.max(0, Math.min(N-1, Math.floor(u * (N-1))));

              const radCells = Math.max(3, Math.floor((f.radius / Math.max(1,(f.x1 - f.x0))) * N));
              const dir = (vx >= 0) ? 1 : -1;
              const amp = Math.min(2.2, speed / 210);

              const ahead = Math.max(2, Math.floor(radCells * 0.35));
              const back  = Math.max(1, Math.floor(radCells * 0.15));

              // Bulge ahead
              for (let k=-radCells;k<=radCells;k++){
                const i = c + (dir * ahead) + k;
                if (i<0||i>=N) continue;
                const q = 1 - Math.abs(k)/radCells;
                field[i] += f.bulge * amp * q*q * 0.18;
              }

              // Push down behind
              for (let k=-radCells;k<=radCells;k++){
                const i = c - (dir * back) + k;
                if (i<0||i>=N) continue;
                const q = 1 - Math.abs(k)/radCells;
                field[i] -= f.push * amp * q*q * 0.22;
              }
            }
          }
        }
      }

    }

    aabb(ax, ay, aw, ah, bx, by, bw, bh){
      return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
    }

    getLethalLiquidContact(player){
      if (!player || !this._liquidVolumes.length) return null;
      const px0 = player.x;
      const px1 = player.x + player.w;
      const py0 = player.y;
      const py1 = player.y + player.h;
      const feetY = py1;

      for (const v of this._liquidVolumes){
        if (px1 <= v.x0 || px0 >= v.x1) continue;
        if (py1 <= v.yTop || py0 >= v.yBottom) continue;

        const submergePx = Math.max(0, Math.min(v.yBottom, feetY) - v.yTop);
        return {
          type: v.id,
          x0: v.x0,
          x1: v.x1,
          yTop: v.yTop,
          yBottom: v.yBottom,
          depth: v.depth,
          submergePx,
          submerge01: Math.max(0, Math.min(1, submergePx / Math.max(1, v.depth))),
        };
      }
      return null;
    }

    _hoverVoidPalette(){
      const arr = [
        { center:[72,46,112], mid:[104,70,156], edge:[126,92,182] },
        { center:[106,40,58], mid:[146,64,92], edge:[176,88,120] },
        { center:[52,82,54], mid:[84,116,72], edge:[112,146,88] },
        { center:[122,80,34], mid:[164,108,52], edge:[194,132,66] },
      ];
      return arr[0];
    }

    isPointLitAnySource(x, y, player){
      if (player && typeof player.lightRadius === "number" && player.lightRadius > 0){
        const pcx = player.x + player.w/2;
        const pcy = player.y + player.h/2;
        if (Math.hypot(x - pcx, y - pcy) <= player.lightRadius) return true;
      }
      for (const e of this.items){
        if (!e || !e.active) continue;
        if (e.type === "lantern"){
          const cx = e.x + e.w*0.5;
          const cy = e.y + e.h*0.5;
          const rad = (typeof e.radius === "number") ? e.radius : 170;
          const strength = (typeof e.strength === "number") ? e.strength : 0.85;
          if (strength > 0.01 && Math.hypot(x-cx, y-cy) <= rad) return true;
        }
        if (e.type === "firefly"){
          const k = (typeof e.lightK === "number") ? e.lightK : 0;
          if (k <= 0.01) continue;
          const cx = e.x + e.w*0.5;
          const cy = e.y + e.h*0.5;
          const baseR = (typeof e.lightDiameter === "number" && e.lightDiameter > 0) ? (e.lightDiameter * 0.5) : (e.lightRadius || 120);
          if (Math.hypot(x-cx, y-cy) <= baseR * k) return true;
        }
        if (e.type === "flare"){
          const t = e.t;
          const life = e.life;
          const fade = e.fadeLast;
          let q = 1.0;
          if (t > life - fade){
            const p = (t - (life - fade)) / fade;
            q = Math.max(0, 1.0 - p);
          }
          const r = (e.radius0 || 220) * q;
          const cx = e.x + e.w/2;
          const cy = e.y + e.h/2;
          if (Math.hypot(x-cx, y-cy) <= r) return true;
        }
      }
      return false;
    }

    // TEST MODE för dark creature:
    // Lit if inside ANY flare radius (with fade) OR player lightRadius.
    // Lanterns ignoreras med flit (lättare att verifiera CAPS/dark-beteende).
    isPointLit(x, y, player){
      // player-ljus
      if (player && typeof player.lightRadius === "number" && player.lightRadius > 0){
        const pcx = player.x + player.w/2;
        const pcy = player.y + player.h/2;
        if (Math.hypot(x - pcx, y - pcy) <= player.lightRadius) return true;
      }

      // flares
      for (const e of this.items){
        if (!e.active) continue;
        if (e.type !== "flare") continue;

        const t = e.t;
        const life = e.life;
        const fade = e.fadeLast;

        let k = 1.0;
        if (t > life - fade){
          const p = (t - (life - fade)) / fade;
          k = Math.max(0, 1.0 - p);
        }

        const r = (e.radius0 || 220) * k;
        const cx = e.x + e.w/2;
        const cy = e.y + e.h/2;
        if (Math.hypot(x - cx, y - cy) <= r) return true;
      }

      return false;
    }

    isPointLitFromPlayerOnly(x, y, player){
      if (player && typeof player.lightRadius === "number" && player.lightRadius > 0){
        const pcx = player.x + player.w/2;
        const pcy = player.y + player.h/2;
        return (Math.hypot(x - pcx, y - pcy) <= player.lightRadius);
      }
      return false;
    }

    findDarkCreatureConsumingFlare(flare, tileSize){
      if (!flare || !flare.active) return null;
      const fx = flare.x + flare.w * 0.5;
      const fy = flare.y + flare.h * 0.5;
      let best = null;
      let bestD = Infinity;

      for (const e of this.items){
        if (!e || !e.active || e.type !== "darkCreature" || e.dying) continue;
        if (e.reactsToFlares === false) continue;

        const aggroPx = (typeof e.aggroRadiusPx === "number" && e.aggroRadiusPx > 0)
          ? e.aggroRadiusPx
          : Math.max(0, (e.aggroTiles || 0) * tileSize);
        if (aggroPx <= 0) continue;

        const cx = e.x + e.w * 0.5;
        const cy = e.y + e.h * 0.5;
        const d = Math.hypot(fx - cx, fy - cy);
        if (d <= aggroPx && d < bestD){
          best = e;
          bestD = d;
        }
      }

      return best;
    }

    isFlareInsideAnyDarkCreatureAggro(flare, tileSize){
      return !!this.findDarkCreatureConsumingFlare(flare, tileSize);
    }

    _isNearCamera(e, cam, pad = 0){
      if (!cam) return true;
      const x = e.x + (e._offX || 0);
      const y = e.y + (e._offY || 0);
      const w = e.w || 0;
      const h = e.h || 0;
      const minX = cam.x - pad;
      const minY = cam.y - pad;
      const maxX = cam.x + cam.w + pad;
      const maxY = cam.y + cam.h + pad;
      return (x + w) >= minX && x <= maxX && (y + h) >= minY && y <= maxY;
    }

    // Firefly trigger: ONLY reacts to Lumo / lantern / flare (NOT itself, NOT other fireflies)
    isFireflyTriggeredByAnyLight(x, y, player, aggroR, self){
      const r = (typeof aggroR === "number") ? aggroR : 0;

      if (player && typeof player.lightRadius === "number" && player.lightRadius > 0){
        const pcx = player.x + player.w/2;
        const pcy = player.y + player.h/2;
        const d = Math.hypot(x - pcx, y - pcy);
        if (d <= r && d <= player.lightRadius) return true;
      }

      for (const e of this.items){
        if (!e || !e.active) continue;
        if (e === self) continue;

        if (e.type === "lantern"){
          const cx = e.x + e.w/2;
          const cy = e.y + e.h/2;
          const rad = (typeof e.radius === "number") ? e.radius : 170;
          const strength = (typeof e.strength === "number") ? e.strength : 0.85;
          if (strength <= 0.01) continue;
          const d = Math.hypot(x - cx, y - cy);
          if (d <= r && d <= rad) return true;
        }

        if (e.type === "flare"){
          const t = e.t;
          const life = e.life;
          const fade = e.fadeLast;
          let k = 1.0;
          if (t > life - fade){
            const p = (t - (life - fade)) / fade;
            k = Math.max(0, 1.0 - p);
          }
          if (k <= 0.01) continue;

          const rad = (e.radius0 || 220) * k;
          const cx = e.x + e.w/2;
          const cy = e.y + e.h/2;
          const d = Math.hypot(x - cx, y - cy);
          if (d <= r && d <= rad) return true;
        }

      }

      return false;
    }



    // lights
    getLights(cam){
      const lights = [];

      for (const e of this.items){
        if (!e.active) continue;

        // First-pass conservative culling: keep nearby lights only.
        // Radius-based pad avoids popping when a light source is just outside the viewport.
        const lightPad = Math.max(220, (e.radius || e.lightRadius || e.radius0 || 0));
        if (!this._isNearCamera(e, cam, lightPad)) continue;

        if (e.type === "lantern"){
          lights.push({
            x: (e.x + e.w/2) - cam.x,
            y: (e.y + e.h/2) - cam.y,
            r: e.radius || 170,
            strength: e.strength || 0.85
          });
        }

        if (e.type === "firefly"){
          const k = (typeof e.lightK === "number") ? e.lightK : 0;
          if (k > 0.01){
            // Support both radius and diameter contracts (diameter preferred if present)
            const baseR = (typeof e.lightDiameter === "number" && e.lightDiameter > 0)
              ? (e.lightDiameter * 0.5)
              : (e.lightRadius || 120);

            lights.push({
              x: (e.x + e.w/2) - cam.x,
              y: (e.y + e.h/2) - cam.y,
              r: baseR * k,
              strength: (e.lightStrength || 0.8) * k
            });
          }
        }


        if (e.type === "flare"){
          // flare light radius fades at the end
          const t = e.t;
          const life = e.life;
          const fade = e.fadeLast;
          let k = 1.0;

          if (t > life - fade){
            const p = (t - (life - fade)) / fade;
            k = Math.max(0, 1.0 - p);
          }

          const r = (e.radius0 || 220) * k;
          lights.push({
            x: (e.x + e.w/2) - cam.x,
            y: (e.y + e.h/2) - cam.y,
            r,
            strength: 0.90 * k
          });
        }

        if (e.type === "darkCreature"){
          if (e.isDarkActive){
            // används mest för debug, radius 0 = ingen extra ljus
            lights.push({
              x: (e.x + e.w/2) - cam.x,
              y: (e.y + e.h/2) - cam.y,
              r: 0,
              strength: 0
            });
          }
        }
      }
      return lights;
    }

    draw(ctx, cam){
      this._drawLiquidVolumes(ctx, cam);
      for (const e of this.items){
        if (!e.active) continue;
        if (!this._isNearCamera(e, cam, 64)) continue;

        let sx, sy;
if (e.type === "lantern"){
  // Lantern: subpixel movement for smooth float (avoid floor jitter)
  sx = (e.x - cam.x) + (e._offX || 0);
  sy = (e.y - cam.y) + (e._offY || 0);
} else {
  sx = Math.floor((e.x - cam.x) + (e._offX || 0));
  sy = Math.floor((e.y - cam.y) + (e._offY || 0));
}
if (e.type === "powerCell"){
  const img = e._pcSprite || (this.sprites.powerCells ? this.sprites.powerCells[0] : null);

  if (img && img.complete){
    // Rita som exakt 1 tile (24×24)
    ctx.drawImage(img, sx, sy, e.w, e.h);
  }
}


               if (e.type === "flarePickup"){
          const sprite = e._flareSprite || this.sprites.flarePickup;
          if (sprite && sprite.complete){
            // draw sprite slightly larger for readability
            const size = Math.max(e.w, e.h) * 2.0;
            const cx = sx + e.w/2;
            const cy = sy + e.h/2;
            ctx.drawImage(sprite, cx - size/2, cy - size/2, size, size);
          }
        }
        if (e.type === "checkpoint"){
          const img = e._checkpointSprite || ((this.sprites && this.sprites.checkpoints && this.sprites.checkpoints.length) ? (this.sprites.checkpoints.find(im => im && im._ok) || this.sprites.checkpoints[0]) : null);
          if (img && img._ok){
            // 1 tile (24×24)
            ctx.drawImage(img, Math.floor(sx), Math.floor(sy), 24, 24);
          } else {
            // Fallback (only if sprite missing)
            ctx.fillStyle = "rgba(120,255,180,0.95)";
            ctx.fillRect(sx, sy, e.w, e.h);
          }
        }
        if (e.type === "lantern"){
          // Sprite-glow in the world layer (so the lantern "glows", not only punches darkness)
          const gx = sx + e.w * 0.5;
          const gy = sy + e.h * 0.5;
          const outer = (typeof e.glowR === "number") ? e.glowR : 50; // user-tuned
          const inner = 6;
          const g = ctx.createRadialGradient(gx, gy, inner, gx, gy, outer);
          g.addColorStop(0, "rgba(255,220,140,0.55)");
          g.addColorStop(0.45, "rgba(255,200,110,0.22)");
          g.addColorStop(1, "rgba(255,200,110,0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(gx, gy, outer, 0, Math.PI * 2);
          ctx.fill();

          const img = (e._lanternSprite && e._lanternSprite._ok)
            ? e._lanternSprite
            : (this.sprites && this.sprites.lantern);
          if (img && img._ok){
            // Visual can be larger than collision/interaction box (14×14).
            // Anchor sprite to bottom-center of the lantern entity.
            const drawW = Number.isFinite(Number(e._lanternDrawW)) ? Math.max(1, Number(e._lanternDrawW)) : 24;
            const drawH = Number.isFinite(Number(e._lanternDrawH)) ? Math.max(1, Number(e._lanternDrawH)) : 32;
            const drawAnchor = String(e._lanternDrawAnchor || "BL").trim().toUpperCase() === "TL" ? "TL" : "BL";
            const cx = sx + e.w * 0.5;
            const bottom = sy + e.h;
            const drawX = cx - drawW / 2;
            const drawY = drawAnchor === "TL" ? sy : (bottom - drawH);
            ctx.drawImage(img, drawX, drawY, drawW, drawH);
          } else {
            // Fallback placeholder
            ctx.fillStyle = "rgba(255,255,160,0.95)";
            ctx.fillRect(sx, sy, e.w, e.h);
          }
        }

        if (e.type === "exit"){
          ctx.strokeStyle = "rgba(120,180,255,0.95)";
          ctx.lineWidth = 2;
          ctx.strokeRect(sx+2, sy+2, e.w-4, e.h-4);
        }
        if (e.type === "firefly"){
          const tail = e._tail || [];
          for (let i = 0; i < tail.length; i++){
            const p = tail[i];
            const a = Math.max(0, 1 - (p.t / 0.35));
            const px = Math.floor(p.x - cam.x);
            const py = Math.floor(p.y - cam.y);

            if (i === tail.length - 1){
              ctx.fillStyle = "rgba(255,230,120," + (0.85 * a).toFixed(3) + ")";
              ctx.beginPath();
              ctx.arc(px, py, 2.0, 0, Math.PI*2);
              ctx.fill();
            } else {
              ctx.fillStyle = "rgba(255,255,255," + (0.45 * a).toFixed(3) + ")";
              ctx.beginPath();
              ctx.arc(px, py, 1.2, 0, Math.PI*2);
              ctx.fill();
            }
          }

          
          // Rump glow (golden halo) while the firefly light is active
          const kGlow = (typeof e.lightK === "number") ? e.lightK : 0;
          if (kGlow > 0.01){
            const dir = (e.dir || 1);
            const gx = (dir === 1) ? (sx + 2) : (sx + e.w - 2);
            const gy = sy + e.h * 0.92;
            const r0 = 2.5;
            const r1 = 14; // outer radius
            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            const g = ctx.createRadialGradient(gx, gy, r0, gx, gy, r1);
            g.addColorStop(0.0, "rgba(255,220,140," + (0.85 * kGlow).toFixed(3) + ")");
            g.addColorStop(0.35, "rgba(255,195,95," + (0.55 * kGlow).toFixed(3) + ")");
            g.addColorStop(1.0, "rgba(255,195,95,0)");
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(gx, gy, r1, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
const img = e._ffSprite || (this.sprites && this.sprites.fireflies && this.sprites.fireflies[0]) || null;
          if (img && img._ok){
            if ((e.dir || 1) === -1){
              ctx.save();
              ctx.translate(sx + e.w, sy);
              ctx.scale(-1, 1);
              ctx.drawImage(img, 0, 0, e.w, e.h);
              ctx.restore();
            } else {
              ctx.drawImage(img, sx, sy, e.w, e.h);
            }
          } else {
            ctx.fillStyle = "rgba(255,255,180,0.85)";
            ctx.fillRect(sx, sy, e.w, e.h);
          }
        }



        if (e.type === "decor"){
          if (e.img && e.img.complete && e.img.naturalWidth > 0){
            if (e.flipX === true){
              ctx.save();
              ctx.translate(sx + e.w, sy);
              ctx.scale(-1, 1);
              ctx.drawImage(e.img, 0, 0, e.w, e.h);
              ctx.restore();
            } else {
              ctx.drawImage(e.img, sx, sy, e.w, e.h);
            }
          } else {
            ctx.fillStyle = "rgba(120,200,120,0.35)";
            ctx.fillRect(sx, sy, e.w, e.h);
          }
        }

        if (e.type === "patrolEnemy"){
          ctx.fillStyle = "rgba(255,80,80,0.70)";
          ctx.fillRect(sx, sy, e.w, e.h);
        }

        if (e.type === "flare"){
          const img = this.sprites && this.sprites.flareAir;
          if (img && img._ok){
            const cx = sx + e.w/2;
            const cy = sy + e.h/2;
            const size = Math.max(e.w, e.h) * 1.8;
            const rot = e.rot || 0;
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(rot);
            ctx.drawImage(img, -size/2, -size/2, size, size);
            ctx.restore();
          } else {
            ctx.fillStyle = "rgba(170,120,255,0.85)";
            ctx.fillRect(sx, sy, e.w, e.h);
          }
        }

        if (e.type === "darkSpellProjectile"){
          const spr = this.sprites && this.sprites.darkSpell;
          const customImg = e._darkSpellProjectileSprite;
          const img = (customImg && customImg._ok) ? customImg : (spr && spr.flight);
          if (img && img._ok){
            const cx = sx + e.w * 0.5;
            const cy = sy + e.h * 0.5;
            const size = Math.max(e.w, e.h) * 1.8;
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(e.rot || 0);
            ctx.drawImage(img, -size/2, -size/2, size, size);
            ctx.restore();
          } else {
            ctx.fillStyle = "rgba(160,120,255,0.9)";
            ctx.fillRect(sx, sy, e.w, e.h);
          }
        }

        if (e.type === "darkSpellHazard"){
          const spr = this.sprites && this.sprites.darkSpell;
          const t = e.t || 0;
          let img = spr && spr.impact01;
          if (t < 0.15) img = spr && spr.impact03;
          else if (t < 0.30) img = spr && spr.impact02;

          ctx.save();
          ctx.globalAlpha = Math.max(0, Math.min(1, (typeof e.alpha === "number") ? e.alpha : 1));
          if (img && img._ok){
            const size = Math.max(e.w, e.h) * 2.1;
            const cx = sx + e.w * 0.5;
            const cy = sy + e.h * 0.5;
            ctx.drawImage(img, cx - size*0.5, cy - size*0.5, size, size);
          } else {
            ctx.fillStyle = "rgba(145,110,210,0.85)";
            ctx.fillRect(sx, sy, e.w, e.h);
          }
          ctx.restore();
        }


        if (e.type === "flareConsumeVfx"){
          const p = Math.max(0, Math.min(1, (e.t || 0) / Math.max(0.001, e.life || 1)));
          const a = (e.alpha || 0.55) * (1 - p);
          const s = (e.size || 2) * (1 - p * 0.45);
          ctx.fillStyle = "rgba(118,82,190," + a.toFixed(3) + ")";
          ctx.beginPath();
          ctx.arc(sx + s * 0.5, sy + s * 0.5, Math.max(0.5, s), 0, Math.PI * 2);
          ctx.fill();
        }

        if (e.type === "darkDissolveParticle"){
          const p = Math.max(0, Math.min(1, (e.t || 0) / Math.max(0.001, e.life || 1)));
          const a = (e.alpha || 0.65) * (1 - p);
          const s = (e.size || 2.5) * (1 - p * 0.35);
          ctx.fillStyle = "rgba(110,74,186," + a.toFixed(3) + ")";
          ctx.beginPath();
          ctx.arc(sx + s * 0.5, sy + s * 0.5, Math.max(0.6, s), 0, Math.PI * 2);
          ctx.fill();
        }

        if (e.type === "darkCastChargeParticle"){
          const p = Math.max(0, Math.min(1, (e.t || 0) / Math.max(0.001, e.life || 1)));
          const a = (e.alpha || 0.3) * (1 - p);
          const s = (e.size || 1.5) * (1 - p * 0.3);
          ctx.fillStyle = "rgba(136,30,30," + a.toFixed(3) + ")";
          ctx.beginPath();
          ctx.arc(sx + s * 0.5, sy + s * 0.5, Math.max(0.4, s), 0, Math.PI * 2);
          ctx.fill();
        }

        if (e.type === "movingPlatform"){
          ctx.fillStyle = "rgba(100,120,140,0.95)";
          ctx.fillRect(sx, sy, e.w, e.h);
          ctx.fillStyle = "rgba(255,255,255,0.06)";
          ctx.fillRect(sx, sy, e.w, 2);
        }

        if (e.type === "hoverVoid"){
          const cx = sx + e.w * 0.5;
          const cy = sy + e.h * 0.5;
          const lit = this.isPointLitAnySource(e.x + e.w*0.5, e.y + e.h*0.5, this._lastPlayer);
          const bodyAlpha = lit ? (0.94 + (1 - (e.sleepBlend || 1)) * 0.06) : 0;
          if (bodyAlpha > 0.01){
            const bodySprite = e._hoverVoidBodySprite;
            if (bodySprite && bodySprite._ok) {
              const facingX = (e._facingX === -1) ? -1 : 1;
              ctx.save();
              ctx.globalAlpha *= Math.max(0, Math.min(1, bodyAlpha));
              if (facingX > 0){
                // Hover Void custom bodies may be authored facing left; mirror while facing right.
                ctx.translate(sx + e.w, sy);
                ctx.scale(-1, 1);
                ctx.drawImage(bodySprite, 0, 0, e.w, e.h);
              } else {
                ctx.drawImage(bodySprite, sx, sy, e.w, e.h);
              }
              ctx.restore();
            } else {
              const palette = this._hoverVoidPalette();
              const r = Math.max(e.w, e.h) * 0.95;
              const bodyScale = 1.15;
              const wobble = Math.sin((e._t || 0) * 0.7) * 0.08;

              const deepR = Math.floor(palette.center[0] * 0.22);
              const deepG = Math.floor(palette.center[1] * 0.22);
              const deepB = Math.floor(palette.center[2] * 0.22);
              const shadeR = Math.floor(palette.mid[0] * 0.34);
              const shadeG = Math.floor(palette.mid[1] * 0.34);
              const shadeB = Math.floor(palette.mid[2] * 0.34);

              const edgeR = Math.floor(palette.edge[0] * 0.5);
              const edgeG = Math.floor(palette.edge[1] * 0.5);
              const edgeB = Math.floor(palette.edge[2] * 0.5);

              const outerGlow = ctx.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 1.25);
              outerGlow.addColorStop(0.0, "rgba(" + edgeR + "," + edgeG + "," + edgeB + "," + (bodyAlpha * 0.13).toFixed(3) + ")");
              outerGlow.addColorStop(1.0, "rgba(" + edgeR + "," + edgeG + "," + edgeB + ",0)");
              ctx.fillStyle = outerGlow;
              ctx.beginPath();
              ctx.ellipse(cx, cy, e.w * 0.97 * bodyScale, e.h * 0.87 * bodyScale, wobble, 0, Math.PI*2);
              ctx.fill();

              const sphere = ctx.createRadialGradient(cx - r * 0.23, cy - r * 0.28, r * 0.11, cx, cy, r * 0.97);
              sphere.addColorStop(0.0, "rgba(" + palette.edge[0] + "," + palette.edge[1] + "," + palette.edge[2] + "," + (Math.min(1, bodyAlpha * 0.98)).toFixed(3) + ")");
              sphere.addColorStop(0.30, "rgba(" + palette.mid[0] + "," + palette.mid[1] + "," + palette.mid[2] + "," + (Math.min(1, bodyAlpha * 0.99)).toFixed(3) + ")");
              sphere.addColorStop(0.64, "rgba(" + shadeR + "," + shadeG + "," + shadeB + "," + (Math.min(1, bodyAlpha * 1.02)).toFixed(3) + ")");
              sphere.addColorStop(1.0, "rgba(" + deepR + "," + deepG + "," + deepB + "," + (Math.min(1, bodyAlpha)).toFixed(3) + ")");
              ctx.fillStyle = sphere;
              ctx.beginPath();
              ctx.ellipse(cx, cy, e.w * 0.89 * bodyScale, e.h * 0.79 * bodyScale, wobble, 0, Math.PI*2);
              ctx.fill();

              const core = ctx.createRadialGradient(cx - r * 0.1, cy - r * 0.12, r * 0.04, cx, cy, r * 0.66);
              core.addColorStop(0.0, "rgba(" + palette.center[0] + "," + palette.center[1] + "," + palette.center[2] + "," + (Math.min(1, bodyAlpha * 0.9)).toFixed(3) + ")");
              core.addColorStop(0.55, "rgba(" + shadeR + "," + shadeG + "," + shadeB + "," + (Math.min(1, bodyAlpha)).toFixed(3) + ")");
              core.addColorStop(1.0, "rgba(" + deepR + "," + deepG + "," + deepB + ",0)");
              ctx.fillStyle = core;
              ctx.beginPath();
              ctx.ellipse(cx, cy, e.w * 0.87 * bodyScale, e.h * 0.77 * bodyScale, wobble, 0, Math.PI*2);
              ctx.fill();

              const highlight = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.38, r * 0.01, cx - r * 0.35, cy - r * 0.38, r * 0.46);
              highlight.addColorStop(0.0, "rgba(255,255,255," + (bodyAlpha * 0.46).toFixed(3) + ")");
              highlight.addColorStop(0.22, "rgba(" + palette.edge[0] + "," + palette.edge[1] + "," + palette.edge[2] + "," + (bodyAlpha * 0.34).toFixed(3) + ")");
              highlight.addColorStop(1.0, "rgba(" + palette.edge[0] + "," + palette.edge[1] + "," + palette.edge[2] + ",0)");
              ctx.fillStyle = highlight;
              ctx.beginPath();
              ctx.ellipse(cx - r * 0.1, cy - r * 0.1, e.w * 0.5 * bodyScale, e.h * 0.42 * bodyScale, wobble, 0, Math.PI*2);
              ctx.fill();

              const rimFade = ctx.createRadialGradient(cx, cy, r * 0.78, cx, cy, r * 1.02);
              rimFade.addColorStop(0.0, "rgba(" + deepR + "," + deepG + "," + deepB + ",0)");
              rimFade.addColorStop(1.0, "rgba(" + deepR + "," + deepG + "," + deepB + "," + (bodyAlpha * 0.3).toFixed(3) + ")");
              ctx.fillStyle = rimFade;
              ctx.beginPath();
              ctx.ellipse(cx, cy, e.w * 0.9 * bodyScale, e.h * 0.8 * bodyScale, wobble, 0, Math.PI*2);
              ctx.fill();
            }
          }

          if (!e.awake) this._drawHoverVoidEyes(ctx, e, cx, cy, 1);
        }

        if (e.type === "darkCreature"){
          const customBodySprite = (e._darkCreatureBodySprite && e._darkCreatureBodySprite._ok)
            ? e._darkCreatureBodySprite
            : null;
          const frames = (this.sprites && Array.isArray(this.sprites.darkCreatureIdle))
            ? this.sprites.darkCreatureIdle
            : [];

          const frameDur = 0.4;
          const frameIdx = Math.floor((e._animT || 0) / frameDur) % 2;
          const fallbackIdleFrame = frames[frameIdx] || frames[0] || null;
          const img = customBodySprite || fallbackIdleFrame;

          if (img && img._ok){
            const drawW = Math.max(1, Number(e.w) || 18);
            const drawH = Math.max(1, Number(e.h) || 18);

            // Keep collision footprint unchanged; render sprite centered and bottom-aligned.
            const drawX = sx + (e.w - drawW) * 0.5;
            const drawY = sy + e.h - drawH;
            if (e.dying){
              const k = Math.max(0, 1 - ((e.dissolveT || 0) / Math.max(0.001, e.dissolveDur || 1.35)));
              ctx.globalAlpha *= k;
            }
            ctx.drawImage(img, drawX, drawY, drawW, drawH);
          } else {
            // fallback if sprite not loaded
            const color = e.isDarkActive ? "rgba(255,230,80,0.95)" : "rgba(255,80,200,0.95)";
            ctx.fillStyle = color;
            ctx.fillRect(sx, sy, e.w, e.h);
          }
        }
      }
    }

    _buildBubblingSurfaceSamples(v, sx, sy, w){
      const activity = Math.max(0, Math.min(1, Number(v.bubblingSurfaceActivity) || 0.45));
      const t = this._liquidAnimT;
      const step = 4;
      const amplitude = 0.6 + (activity * 2.6);
      const samples = [];
      for (let px = 0; px <= w; px += step){
        const p = px / Math.max(1, w);
        const phaseSeed = (Number(v.bubblingSeed) || 0) + (p * 7.9);
        const rippleA = Math.sin((p * Math.PI * 3.4) + (t * (0.7 + (activity * 0.4))) + phaseSeed) * (0.28 + (activity * 0.34));
        const rippleB = Math.sin((p * Math.PI * 8.6) - (t * (0.52 + (activity * 0.6))) + (phaseSeed * 1.9)) * (0.12 + (activity * 0.24));
        const jitter = Math.sin((p * Math.PI * 15.2) + (t * 1.7) + (phaseSeed * 2.4)) * 0.18;
        const y = sy + ((rippleA + rippleB + jitter) * amplitude);
        samples.push({ x: sx + px, y });
      }
      if ((w % step) !== 0){
        const p = 1;
        const phaseSeed = (Number(v.bubblingSeed) || 0) + 7.9;
        const rippleA = Math.sin((p * Math.PI * 3.4) + (t * (0.7 + (activity * 0.4))) + phaseSeed) * (0.28 + (activity * 0.34));
        const rippleB = Math.sin((p * Math.PI * 8.6) - (t * (0.52 + (activity * 0.6))) + (phaseSeed * 1.9)) * (0.12 + (activity * 0.24));
        const jitter = Math.sin((p * Math.PI * 15.2) + (t * 1.7) + (phaseSeed * 2.4)) * 0.18;
        const y = sy + ((rippleA + rippleB + jitter) * amplitude);
        samples.push({ x: sx + w, y });
      }
      return samples;
    }

    _sampleBubblingSurfaceY(samples, x, fallback){
      if (!Array.isArray(samples) || samples.length < 1) return fallback;
      if (samples.length === 1) return Number.isFinite(samples[0].y) ? samples[0].y : fallback;
      if (x <= samples[0].x) return samples[0].y;
      for (let i = 1; i < samples.length; i += 1){
        const left = samples[i - 1];
        const right = samples[i];
        if (x <= right.x){
          const span = Math.max(0.001, right.x - left.x);
          const blend = (x - left.x) / span;
          return left.y + ((right.y - left.y) * blend);
        }
      }
      return samples[samples.length - 1].y;
    }

    _parseColorToRgba(color, fallback){
      const fallbackColor = (fallback && typeof fallback === "object")
        ? fallback
        : { r: 127, g: 209, b: 46, a: 1 };
      if (typeof color !== "string") return { ...fallbackColor };
      const v = color.trim();
      if (!v) return { ...fallbackColor };

      const hexMatch = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
      if (hexMatch){
        const hex = hexMatch[1];
        if (hex.length === 3){
          return {
            r: parseInt(hex[0] + hex[0], 16),
            g: parseInt(hex[1] + hex[1], 16),
            b: parseInt(hex[2] + hex[2], 16),
            a: 1,
          };
        }
        return {
          r: parseInt(hex.slice(0, 2), 16),
          g: parseInt(hex.slice(2, 4), 16),
          b: parseInt(hex.slice(4, 6), 16),
          a: 1,
        };
      }

      const rgbMatch = v.match(/^rgba?\(([^)]+)\)$/i);
      if (rgbMatch){
        const parts = rgbMatch[1].split(",").map((part) => Number(part.trim()));
        if (parts.length >= 3 && parts.slice(0, 3).every((n) => Number.isFinite(n))){
          return {
            r: Math.max(0, Math.min(255, Math.round(parts[0]))),
            g: Math.max(0, Math.min(255, Math.round(parts[1]))),
            b: Math.max(0, Math.min(255, Math.round(parts[2]))),
            a: Number.isFinite(parts[3]) ? Math.max(0, Math.min(1, parts[3])) : 1,
          };
        }
      }

      return { ...fallbackColor };
    }

    _rgbaWithAlpha(color, alpha){
      const a = Math.max(0, Math.min(1, Number(alpha) || 0));
      return `rgba(${color.r|0},${color.g|0},${color.b|0},${a})`;
    }

    _mixRgb(a, b, blend){
      const t = Math.max(0, Math.min(1, Number(blend) || 0));
      return {
        r: Math.round((a.r * (1 - t)) + (b.r * t)),
        g: Math.round((a.g * (1 - t)) + (b.g * t)),
        b: Math.round((a.b * (1 - t)) + (b.b * t)),
      };
    }

    _drawBubblingLiquidVolume(ctx, v, sx, sy, w, h, afterDarkness = false){
      const activity = Math.max(0, Math.min(1, Number(v.bubblingSurfaceActivity) || 0.45));
      const bubbleIntensity = Math.max(0, Math.min(1, (Number(v.bubblingBubbleAmount) || 58) / 100));
      const fumeIntensity = Math.max(0, Math.min(1, (Number(v.bubblingFumeAmount) || 40) / 100));
      const t = this._liquidAnimT;
      const yBottom = sy + h;
      const samples = this._buildBubblingSurfaceSamples(v, sx, sy, w);
      const first = samples[0] || { x: sx, y: sy };
      const last = samples[samples.length - 1] || { x: sx + w, y: sy };
      let surfaceCrestY = first.y;
      for (let i = 1; i < samples.length; i += 1) if (samples[i].y < surfaceCrestY) surfaceCrestY = samples[i].y;
      const surfaceTone = this._parseColorToRgba(
        afterDarkness ? (v.surfaceColorAfterDarkness || v.surfaceColor) : v.surfaceColor,
        { r: 127, g: 209, b: 46, a: 1 },
      );
      const bodyTone = this._parseColorToRgba(
        afterDarkness ? (v.bodyColorAfterDarkness || v.bodyColor) : v.bodyColor,
        { r: 47, g: 94, b: 28, a: 1 },
      );
      const midTone = this._mixRgb(surfaceTone, bodyTone, afterDarkness ? 0.48 : 0.4);
      const bubbleFillTone = this._mixRgb(surfaceTone, { r: 255, g: 255, b: 255 }, 0.34);
      const bubbleRimTone = this._mixRgb(surfaceTone, { r: 255, g: 255, b: 255 }, 0.45);
      const glowTone = this._mixRgb(surfaceTone, bodyTone, 0.3);
      const fumeTone = this._mixRgb(surfaceTone, { r: 230, g: 234, b: 223 }, 0.42);

      const bodyGrad = ctx.createLinearGradient(0, surfaceCrestY - 2, 0, yBottom);
      if (!afterDarkness){
        bodyGrad.addColorStop(0, v.surfaceColor || "rgba(187,255,130,0.92)");
        bodyGrad.addColorStop(0.22, this._rgbaWithAlpha(midTone, 0.45));
        bodyGrad.addColorStop(1, v.bodyColor || "rgba(98,170,58,0.36)");
      } else {
        bodyGrad.addColorStop(0, v.surfaceColorAfterDarkness || "rgba(214,255,176,0.99)");
        bodyGrad.addColorStop(0.25, this._rgbaWithAlpha(midTone, 0.28));
        bodyGrad.addColorStop(1, v.bodyColorAfterDarkness || "rgba(132,205,88,0.26)");
      }

      ctx.beginPath();
      ctx.moveTo(first.x, yBottom);
      for (let i = 0; i < samples.length; i += 1) ctx.lineTo(samples[i].x, samples[i].y);
      ctx.lineTo(last.x, yBottom);
      ctx.closePath();
      ctx.fillStyle = bodyGrad;
      ctx.fill();

      ctx.save();
      ctx.beginPath();
      ctx.rect(sx, sy - 16, w, h + 20);
      ctx.clip();

      const bubbleCount = Math.max(4, Math.round((w * 0.012) + (Math.pow(bubbleIntensity, 1.04) * w * 0.22)));
      const popEvents = [];
      for (let i = 0; i < bubbleCount; i += 1){
        const seed = (Number(v.bubblingSeed) || 0) + (13.2 + (i * 9.1));
        const u = (Math.sin(seed * 12.71) * 0.5) + 0.5;
        const px = sx + (u * w) + (Math.sin((t * (0.34 + (activity * 0.22))) + (seed * 1.7)) * (0.8 + (bubbleIntensity * 2.2)));
        const startDepthRatio = 0.3 + (((Math.sin(seed * 8.23) * 0.5) + 0.5) * 0.64);
        const speed = 0.05 + (((Math.sin(seed * 4.37) * 0.5) + 0.5) * 0.05) + (activity * 0.055) + (bubbleIntensity * 0.04);
        const cycle = ((t * speed) + ((Math.sin(seed * 2.81) * 0.5) + 0.5)) % 1;
        const risePhase = 0.76;
        const interactPhase = 0.15;
        const popPhase = 1 - risePhase - interactPhase;
        const baseRadius = 0.8 + (((Math.sin(seed * 6.11) * 0.5) + 0.5) * (1.6 + (bubbleIntensity * 1.9)));
        const surfaceY = this._sampleBubblingSurfaceY(samples, px, sy);
        let py = yBottom - (h * startDepthRatio);
        let radius = baseRadius;
        let bubbleAlpha = (afterDarkness ? 0.11 : 0.14) + (bubbleIntensity * (afterDarkness ? 0.06 : 0.10));
        let rimAlpha = (afterDarkness ? 0.16 : 0.2) + (bubbleIntensity * (afterDarkness ? 0.12 : 0.20));

        if (cycle <= risePhase){
          const k = cycle / risePhase;
          const eased = (k * k) * (3 - (2 * k));
          py = yBottom - ((h * startDepthRatio) * eased);
        } else if (cycle <= (risePhase + interactPhase)){
          const k = (cycle - risePhase) / interactPhase;
          py = surfaceY - (0.4 + (k * (1.3 + (activity * 2.4))));
          radius = baseRadius * (1 + (k * 0.35));
          bubbleAlpha += k * 0.09;
          rimAlpha += k * 0.18;
        } else {
          const k = Math.max(0, Math.min(1, (cycle - risePhase - interactPhase) / Math.max(0.001, popPhase)));
          const eased = (k * k) * (3 - (2 * k));
          py = surfaceY - (1.7 + (eased * (2.4 + (activity * 2.2))));
          radius = baseRadius * (1 - (eased * 0.78));
          bubbleAlpha *= (1 - eased);
          rimAlpha *= (1 - eased);
          popEvents.push({
            x: px,
            y: surfaceY - 0.35,
            ringRadius: (0.7 + (baseRadius * 0.9)) + (eased * (3 + (activity * 2.8))),
            ringAlpha: ((afterDarkness ? 0.2 : 0.24) + (activity * 0.16)) * (1 - eased),
          });
        }
        if (radius <= 0.35 || bubbleAlpha <= 0.01) continue;
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fillStyle = this._rgbaWithAlpha(bubbleFillTone, bubbleAlpha);
        ctx.fill();
        ctx.strokeStyle = this._rgbaWithAlpha(bubbleRimTone, rimAlpha);
        ctx.lineWidth = py <= surfaceY + 1 ? 1.0 : 0.75;
        ctx.stroke();
      }

      if (!afterDarkness){
        for (let band = 0; band < 2; band += 1){
          const yBand = sy + h * (0.24 + (band * 0.3)) + (Math.sin((t * (0.45 + (band * 0.12))) + (sx * 0.02)) * (1.4 + band));
          const alpha = 0.05 + (activity * 0.06) - (band * 0.012);
          const glowBand = ctx.createLinearGradient(sx, yBand - 8, sx, yBand + 8);
          glowBand.addColorStop(0, this._rgbaWithAlpha(glowTone, 0));
          glowBand.addColorStop(0.5, this._rgbaWithAlpha(glowTone, Math.max(0.01, alpha)));
          glowBand.addColorStop(1, this._rgbaWithAlpha(glowTone, 0));
          ctx.fillStyle = glowBand;
          ctx.fillRect(sx, yBand - 8, w, 16);
        }
      }
      ctx.restore();

      ctx.beginPath();
      for (let i = 0; i < samples.length; i += 1){
        const sample = samples[i];
        if (i === 0) ctx.moveTo(sample.x, sample.y + 0.5);
        else ctx.lineTo(sample.x, sample.y + 0.5);
      }
      ctx.strokeStyle = afterDarkness
        ? (v.surfaceColorAfterDarkness || "rgba(214,255,176,0.99)")
        : (v.surfaceColor || "rgba(187,255,130,0.92)");
      ctx.lineWidth = afterDarkness ? 1.7 : 1.8;
      ctx.stroke();

      for (let i = 0; i < popEvents.length; i += 1){
        const pop = popEvents[i];
        if (pop.ringAlpha <= 0.01) continue;
        ctx.beginPath();
        ctx.arc(pop.x, pop.y, pop.ringRadius, 0, Math.PI * 2);
        ctx.strokeStyle = this._rgbaWithAlpha(bubbleRimTone, pop.ringAlpha);
        ctx.lineWidth = 0.95;
        ctx.stroke();
      }

      const fumeCount = Math.max(0, Math.round((w * 0.009) + (Math.pow(fumeIntensity, 1.07) * 34)));
      if (fumeCount > 0){
        for (let i = 0; i < fumeCount; i += 1){
          const seed = (Number(v.bubblingSeed) || 0) + 91.2 + (i * 7.4);
          const px = sx + ((((Math.sin(seed * 5.1) * 0.5) + 0.5) * w));
          const puffHeight = 8 + (fumeIntensity * 30) + (((Math.sin(seed * 3.3) * 0.5) + 0.5) * (13 + (fumeIntensity * 18)));
          const drift = ((Math.sin((seed * 2.4) + (t * 0.32)) * 0.5) + 0.5 - 0.5) * (4 + (fumeIntensity * 15));
          const alpha = (afterDarkness ? 0.04 : 0.03) + (((Math.sin(seed * 7.9) * 0.5) + 0.5) * ((afterDarkness ? 0.11 : 0.09) + (fumeIntensity * (afterDarkness ? 0.24 : 0.18))));
          const topY = sy - puffHeight;
          const grad = ctx.createLinearGradient(0, topY, 0, sy + 4);
          grad.addColorStop(0, this._rgbaWithAlpha(fumeTone, 0));
          grad.addColorStop(1, this._rgbaWithAlpha(fumeTone, Math.max(0.01, alpha)));
          ctx.strokeStyle = grad;
          ctx.lineWidth = 1 + (((Math.sin(seed * 11.1) * 0.5) + 0.5) * 1.9);
          ctx.beginPath();
          ctx.moveTo(px, sy + 2);
          ctx.quadraticCurveTo(px + drift, sy - (puffHeight * 0.45), px + (drift * 0.62), topY);
          ctx.stroke();
        }
      }
    }

    _drawLiquidVolumes(ctx, cam){
      if (!this._liquidVolumes.length) return;
      if (!this._pfhLiquidDiag.drawLogged){
        const counts = { water_volume: 0, lava_volume: 0, bubbling_liquid_volume: 0 };
        for (const v of this._liquidVolumes){
          const id = String(v?.id || "").trim().toLowerCase();
          if (Object.prototype.hasOwnProperty.call(counts, id)) counts[id] += 1;
        }
        console.info("[PFH liquid] draw pass reached (pre-darkness)", {
          volumeCount: this._liquidVolumes.length,
          byType: counts,
        });
        this._pfhLiquidDiag.drawLogged = true;
      }
      for (const v of this._liquidVolumes){
        const sx = Math.floor(v.x0 - cam.x);
        const sy = Math.floor(v.yTop - cam.y);
        const w = Math.max(1, Math.floor(v.x1 - v.x0));
        const h = Math.max(1, Math.floor(v.yBottom - v.yTop));
        if (v.id === "lava_volume"){
          const flowSpeed = Math.max(0.1, Number(v.lavaFlowSpeed) || 0.55);
          const temperature = Math.max(0.2, Math.min(1, Number(v.lavaTemperature) || 0.72));
          const crustAmount = Math.max(0, Math.min(100, Number(v.lavaCrustAmount) || 45));
          const crustDensity = crustAmount / 100;
          const t = this._liquidAnimT * flowSpeed;
          const waveAmpPx = Math.max(1, Math.min(h * 0.07, 1.2 + (temperature * 2.2)));
          const step = 14;
          const yBottom = sy + h;
          const yTopBase = sy;
          const yGlowTop = sy - Math.round(10 + (temperature * 10));

          const bodyGrad = ctx.createLinearGradient(0, yTopBase - waveAmpPx, 0, yBottom);
          bodyGrad.addColorStop(0, `rgba(255,${Math.round(122 + (temperature * 68))},${Math.round(28 + (temperature * 26))},0.98)`);
          bodyGrad.addColorStop(0.36, `rgba(194,${Math.round(66 + (temperature * 48))},${Math.round(18 + (temperature * 16))},0.96)`);
          bodyGrad.addColorStop(1, v.bodyColor || "rgba(102,30,12,0.94)");

          ctx.beginPath();
          ctx.moveTo(sx, yBottom);
          for (let px = 0; px <= w; px += step){
            const p = px / Math.max(1, w);
            const wave = Math.sin((p * Math.PI * 1.45) + (t * 0.95))
              + (Math.sin((p * Math.PI * 3.1) - (t * 0.62)) * 0.28);
            const yWave = yTopBase + (wave * waveAmpPx * 0.5);
            ctx.lineTo(sx + px, yWave);
          }
          if ((w % step) !== 0){
            const p = 1;
            const wave = Math.sin((p * Math.PI * 1.45) + (t * 0.95))
              + (Math.sin((p * Math.PI * 3.1) - (t * 0.62)) * 0.28);
            ctx.lineTo(sx + w, yTopBase + (wave * waveAmpPx * 0.5));
          }
          ctx.lineTo(sx + w, yBottom);
          ctx.closePath();
          ctx.fillStyle = bodyGrad;
          ctx.fill();

          ctx.save();
          ctx.beginPath();
          ctx.rect(sx, sy, w, h);
          ctx.clip();

          for (let band = 0; band < 3; band += 1){
            const yBand = sy + h * (0.2 + band * 0.24) + (Math.sin((t * (0.42 + band * 0.16)) + (sx * 0.01)) * (1.5 + band * 0.7));
            const alpha = 0.07 + (temperature * 0.08) - (band * 0.015);
            const g = ctx.createLinearGradient(sx, yBand - 8, sx, yBand + 8);
            g.addColorStop(0, "rgba(255,180,70,0)");
            g.addColorStop(0.5, `rgba(255,${Math.round(154 + (temperature * 70))},${Math.round(45 + (temperature * 26))},${Math.max(0.02, alpha)})`);
            g.addColorStop(1, "rgba(255,180,70,0)");
            ctx.fillStyle = g;
            ctx.fillRect(sx, yBand - 8, w, 16);
          }

          const crustFragments = Math.max(6, Math.round((w / 26) + (crustDensity * (w / 10))));
          for (let i = 0; i < crustFragments; i += 1){
            const seed = (i + 1) * 0.173 + (v.x0 * 0.0019);
            const pxRatio = (Math.sin(seed * 93.17) * 0.5) + 0.5;
            const px = sx + (pxRatio * w) + (Math.sin((t * 0.18) + (seed * 7.1)) * (2.8 + crustDensity * 4.2));
            const py = sy + (h * (0.06 + (Math.abs(Math.sin(seed * 57.3)) * 0.24))) + (Math.cos((t * 0.24) + (seed * 4.3)) * 1.2);
            const fragW = 2 + (Math.abs(Math.sin(seed * 41.5)) * 5.6) + (crustDensity * 1.2);
            const fragH = 1 + (Math.abs(Math.cos(seed * 29.1)) * 2.5) + (crustDensity * 0.7);
            const alpha = 0.16 + (crustDensity * 0.28) + (Math.sin((t * 0.29) + (seed * 6.2)) * 0.04);
            ctx.fillStyle = `rgba(${Math.round(55 + (temperature * 25))},${Math.round(36 + (temperature * 20))},${Math.round(24 + (temperature * 10))},${Math.max(0.08, Math.min(0.55, alpha))})`;
            ctx.fillRect(px, py, fragW, fragH);
          }
          ctx.restore();

          const heatGlow = ctx.createLinearGradient(0, yGlowTop, 0, sy + 3);
          heatGlow.addColorStop(0, "rgba(255,120,40,0)");
          heatGlow.addColorStop(0.62, `rgba(255,${Math.round(130 + (temperature * 42))},${Math.round(48 + (temperature * 25))},${0.045 + (temperature * 0.05)})`);
          heatGlow.addColorStop(1, `rgba(255,${Math.round(180 + (temperature * 45))},${Math.round(80 + (temperature * 35))},${0.08 + (temperature * 0.08)})`);
          ctx.fillStyle = heatGlow;
          ctx.fillRect(sx, yGlowTop, w, Math.max(4, sy - yGlowTop + 3));

          ctx.strokeStyle = v.surfaceColor || "rgba(255,180,80,0.95)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          for (let px = 0; px <= w; px += step){
            const p = px / Math.max(1, w);
            const wave = Math.sin((p * Math.PI * 1.45) + (t * 0.95))
              + (Math.sin((p * Math.PI * 3.1) - (t * 0.62)) * 0.28);
            const yWave = yTopBase + (wave * waveAmpPx * 0.5);
            if (px === 0) ctx.moveTo(sx + px, yWave + 0.5);
            else ctx.lineTo(sx + px, yWave + 0.5);
          }
          if ((w % step) !== 0){
            const p = 1;
            const wave = Math.sin((p * Math.PI * 1.45) + (t * 0.95))
              + (Math.sin((p * Math.PI * 3.1) - (t * 0.62)) * 0.28);
            ctx.lineTo(sx + w, yTopBase + (wave * waveAmpPx * 0.5) + 0.5);
          }
          ctx.stroke();
          continue;
        }

        if (v.id === "bubbling_liquid_volume"){
          this._drawBubblingLiquidVolume(ctx, v, sx, sy, w, h, false);
          continue;
        }

        if (v.id !== "water_volume"){
          ctx.fillStyle = v.bodyColor;
          ctx.fillRect(sx, sy, w, h);

          ctx.strokeStyle = v.surfaceColor;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(sx, Math.floor(v.yTop - cam.y) + 0.5);
          ctx.lineTo(sx + w, Math.floor(v.yTop - cam.y) + 0.5);
          ctx.stroke();
          continue;
        }

        const waveAmpPx = Math.max(1, Math.min(h * 0.15, 2 + (v.waveAmount || 0.35) * 7));
        const waveSpeed = Math.max(0.1, v.waveSpeed || 0.9);
        const t = this._liquidAnimT * waveSpeed;
        const step = 12;
        const yBase = sy;
        const yTopMin = yBase - waveAmpPx - 3;
        const yBottom = sy + h;

        const grad = ctx.createLinearGradient(0, yTopMin, 0, yBottom);
        grad.addColorStop(0, v.surfaceColor || "rgba(78,184,242,0.88)");
        grad.addColorStop(0.16, "rgba(120,198,238,0.40)");
        grad.addColorStop(1, v.bodyColor || "rgba(10,75,147,0.55)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(sx, yBottom);
        for (let px = 0; px <= w; px += step){
          const p = px / Math.max(1, w);
          const wave = Math.sin((p * Math.PI * 2.1) + (t * 1.9))
            + (Math.sin((p * Math.PI * 4.7) - (t * 2.4)) * 0.45);
          const yWave = yBase + (wave * waveAmpPx * 0.5);
          ctx.lineTo(sx + px, yWave);
        }
        if ((w % step) !== 0){
          const p = 1;
          const wave = Math.sin((p * Math.PI * 2.1) + (t * 1.9))
            + (Math.sin((p * Math.PI * 4.7) - (t * 2.4)) * 0.45);
          const yWave = yBase + (wave * waveAmpPx * 0.5);
          ctx.lineTo(sx + w, yWave);
        }
        ctx.lineTo(sx + w, yBottom);
        ctx.closePath();
        ctx.fill();

        ctx.save();
        ctx.beginPath();
        ctx.rect(sx, sy, w, h);
        ctx.clip();
        for (let band = 0; band < 2; band += 1){
          const yBand = sy + h * (0.35 + band * 0.28) + Math.sin((t * (1.1 + band * 0.3)) + (sx * 0.01)) * (2 + band);
          const g = ctx.createLinearGradient(sx, yBand - 6, sx, yBand + 6);
          g.addColorStop(0, "rgba(200,240,255,0)");
          g.addColorStop(0.5, "rgba(200,240,255,0.09)");
          g.addColorStop(1, "rgba(200,240,255,0)");
          ctx.fillStyle = g;
          ctx.fillRect(sx, yBand - 6, w, 12);
        }
        ctx.restore();

        ctx.strokeStyle = v.surfaceColor || "rgba(135,212,255,0.9)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let px = 0; px <= w; px += step){
          const p = px / Math.max(1, w);
          const wave = Math.sin((p * Math.PI * 2.1) + (t * 1.9))
            + (Math.sin((p * Math.PI * 4.7) - (t * 2.4)) * 0.45);
          const yWave = yBase + (wave * waveAmpPx * 0.5);
          if (px === 0) ctx.moveTo(sx + px, yWave + 0.5);
          else ctx.lineTo(sx + px, yWave + 0.5);
        }
        if ((w % step) !== 0){
          const p = 1;
          const wave = Math.sin((p * Math.PI * 2.1) + (t * 1.9))
            + (Math.sin((p * Math.PI * 4.7) - (t * 2.4)) * 0.45);
          const yWave = yBase + (wave * waveAmpPx * 0.5);
          ctx.lineTo(sx + w, yWave + 0.5);
        }
        ctx.stroke();
      }
    }

    _drawLiquidVolumesAfterDarkness(ctx, cam){
      if (!this._liquidVolumes.length) return;
      if (!this._pfhLiquidDiag.afterDarknessDrawLogged){
        console.info("[PFH liquid] draw pass reached (after darkness)", {
          volumeCount: this._liquidVolumes.length,
        });
        this._pfhLiquidDiag.afterDarknessDrawLogged = true;
      }
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      for (const v of this._liquidVolumes){
        const sx = Math.floor(v.x0 - cam.x);
        const sy = Math.floor(v.yTop - cam.y);
        const w = Math.max(1, Math.floor(v.x1 - v.x0));
        const h = Math.max(1, Math.floor(v.yBottom - v.yTop));

        // Runtime visibility pass: keep liquids legible after darkness without
        // changing gameplay collision/death behavior.
        if (v.id === "lava_volume"){
          const flowSpeed = Math.max(0.1, Number(v.lavaFlowSpeed) || 0.55);
          const temperature = Math.max(0.2, Math.min(1, Number(v.lavaTemperature) || 0.72));
          const t = this._liquidAnimT * flowSpeed;
          const waveAmpPx = Math.max(1, Math.min(h * 0.06, 1 + (temperature * 1.8)));
          const step = 16;

          const glowGrad = ctx.createLinearGradient(0, sy - 10, 0, sy + h);
          glowGrad.addColorStop(0, `rgba(255,${Math.round(150 + (temperature * 44))},${Math.round(70 + (temperature * 26))},0.16)`);
          glowGrad.addColorStop(0.25, v.bodyColorAfterDarkness || "rgba(236,126,52,0.38)");
          glowGrad.addColorStop(1, "rgba(120,46,20,0.16)");
          ctx.fillStyle = glowGrad;
          ctx.fillRect(sx, sy - 10, w, h + 10);

          ctx.strokeStyle = v.surfaceColorAfterDarkness || "rgba(255,210,130,1)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          for (let px = 0; px <= w; px += step){
            const p = px / Math.max(1, w);
            const wave = Math.sin((p * Math.PI * 1.45) + (t * 0.95))
              + (Math.sin((p * Math.PI * 3.1) - (t * 0.62)) * 0.28);
            const yWave = sy + (wave * waveAmpPx * 0.5) + 0.5;
            if (px === 0) ctx.moveTo(sx + px, yWave);
            else ctx.lineTo(sx + px, yWave);
          }
          if ((w % step) !== 0){
            const p = 1;
            const wave = Math.sin((p * Math.PI * 1.45) + (t * 0.95))
              + (Math.sin((p * Math.PI * 3.1) - (t * 0.62)) * 0.28);
            ctx.lineTo(sx + w, sy + (wave * waveAmpPx * 0.5) + 0.5);
          }
          ctx.stroke();
          continue;
        }

        if (v.id === "bubbling_liquid_volume"){
          this._drawBubblingLiquidVolume(ctx, v, sx, sy, w, h, true);
          continue;
        }

        if (v.id !== "water_volume"){
          ctx.fillStyle = v.bodyColorAfterDarkness || "rgba(120,180,220,0.20)";
          ctx.fillRect(sx, sy, w, h);

          ctx.strokeStyle = v.surfaceColorAfterDarkness || "rgba(200,235,255,0.95)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(sx, sy + 0.5);
          ctx.lineTo(sx + w, sy + 0.5);
          ctx.stroke();
          continue;
        }

        const waveAmpPx = Math.max(1, Math.min(h * 0.14, 1.5 + (v.waveAmount || 0.35) * 5));
        const waveSpeed = Math.max(0.1, v.waveSpeed || 0.9);
        const t = this._liquidAnimT * waveSpeed;
        const step = 14;
        ctx.fillStyle = v.bodyColorAfterDarkness || "rgba(120,180,220,0.20)";
        ctx.fillRect(sx, sy, w, h);
        ctx.strokeStyle = v.surfaceColorAfterDarkness || "rgba(200,235,255,0.95)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let px = 0; px <= w; px += step){
          const p = px / Math.max(1, w);
          const wave = Math.sin((p * Math.PI * 2.1) + (t * 1.9))
            + (Math.sin((p * Math.PI * 4.7) - (t * 2.4)) * 0.45);
          const yWave = sy + (wave * waveAmpPx * 0.5) + 0.5;
          if (px === 0) ctx.moveTo(sx + px, yWave);
          else ctx.lineTo(sx + px, yWave);
        }
        if ((w % step) !== 0){
          const p = 1;
          const wave = Math.sin((p * Math.PI * 2.1) + (t * 1.9))
            + (Math.sin((p * Math.PI * 4.7) - (t * 2.4)) * 0.45);
          const yWave = sy + (wave * waveAmpPx * 0.5) + 0.5;
          ctx.lineTo(sx + w, yWave);
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    _drawHoverVoidEyes(ctx, e, cx, cy, alphaMul = 1){
      const eyeK = Math.max(0, Math.min(1, e.eyeBlend || 0));
      if (eyeK <= 0.01) return;

      const blink = (e._blinkDur > 0) ? 0.15 : 1;
      const angry = (e._angryT > 0 || e._lungeState !== "idle");
      const hoverVoidEyeBaselineBody = 24;
      const sEye = hoverVoidEyeBaselineBody / 16;
      const facingX = (e._facingX === -1) ? -1 : 1;
      // Keep classic face geometry fixed regardless of body sprite sizing.
      const largeR = 2.8 * sEye * 0.75;
      const smallR = 1.9 * sEye * 0.75;
      const largeX = cx - (7 * sEye) * facingX + (3 * facingX);
      const largeY = cy - (6 * sEye);
      const smallX = cx + (6 * sEye) * facingX - (3 * facingX);
      const smallY = cy - (4 * sEye);
      const eyeAlpha = (1.0 * eyeK) * Math.max(0, Math.min(1, alphaMul));
      if (eyeAlpha <= 0.001) return;

      ctx.fillStyle = "rgba(246,250,255," + eyeAlpha.toFixed(3) + ")";
      ctx.shadowColor = "rgba(205,240,255," + (0.95 * eyeK * alphaMul).toFixed(3) + ")";
      ctx.shadowBlur = 11;
      if (!angry){
        ctx.beginPath();
        ctx.ellipse(largeX, largeY, largeR, largeR * blink, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(smallX, smallY, smallR, smallR * blink, 0, 0, Math.PI*2);
        ctx.fill();
      } else {
        const drawFilledAngryEye = (x, y, r, tilt) => {
          ctx.save();
          ctx.beginPath();
          ctx.translate(x, y);

          ctx.beginPath();
          if (tilt < 0) {
            ctx.moveTo(-r * 1.6, -r * 0.95);
            ctx.lineTo(r * 1.6, -r * 0.20);
            ctx.lineTo(r * 1.6, r * 1.6);
            ctx.lineTo(-r * 1.6, r * 1.6);
          } else {
            ctx.moveTo(-r * 1.6, -r * 0.20);
            ctx.lineTo(r * 1.6, -r * 0.95);
            ctx.lineTo(r * 1.6, r * 1.6);
            ctx.lineTo(-r * 1.6, r * 1.6);
          }
          ctx.closePath();
          ctx.clip();

          ctx.fillStyle = "rgba(243,240,255," + eyeAlpha.toFixed(3) + ")";
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        };
        if ((e._blinkDur || 0) <= 0) {
          drawFilledAngryEye(largeX, largeY, largeR, -1 * facingX);
          drawFilledAngryEye(smallX, smallY, smallR, 1 * facingX);
        } else {
          ctx.strokeStyle = "rgba(243,240,255," + eyeAlpha.toFixed(3) + ")";
          ctx.lineWidth = 1.8;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(largeX - 3.2 * sEye * facingX, largeY - 2.0 * sEye);
          ctx.lineTo(largeX + 2.8 * sEye * facingX, largeY + 0.2 * sEye);
          ctx.moveTo(smallX - 2.0 * sEye * facingX, smallY + 0.2 * sEye);
          ctx.lineTo(smallX + 2.2 * sEye * facingX, smallY - 2.0 * sEye);
          ctx.stroke();
        }
      }
      ctx.shadowBlur = 0;
    }

    // Pass drawn AFTER darkness, for elements that should remain visible through darkness.
    drawAfterDarkness(ctx, cam){
      this._drawLiquidVolumesAfterDarkness(ctx, cam);
      for (const e of this.items){
        if (!e.active || e.type !== "hoverVoid") continue;
        if (!e.awake) continue;
        if (!this._isNearCamera(e, cam, 96)) continue;

        const sx = Math.floor((e.x - cam.x) + (e._offX || 0));
        const sy = Math.floor((e.y - cam.y) + (e._offY || 0));
        const cx = sx + e.w * 0.5;
        const cy = sy + e.h * 0.5;
        this._drawHoverVoidEyes(ctx, e, cx, cy, 1);
      }
    }

    // Fog overlay pass (intended to be called AFTER renderer.drawDarkness()).
    // Safe even if not used by app.js.
    drawOverDarkness(ctx, cam){
      if (!this._fogVolumes.length) return;

      for (const f of this._fogVolumes){
        const N = f.N;
        const field = f.field;

        const x0s = (f.x0 - cam.x);
        const x1s = (f.x1 - cam.x);
        const width = Math.max(1, Math.round(x1s - x0s));
        const step = width / (N - 1);

        const baseYs = (f.y0 - cam.y);

        // Premium: color + exposure + blend
        const col = (typeof f.color === "string") ? f.color : "#E1EEFF";
        const exposure = (typeof f.exposure === "number") ? f.exposure : 1.0;

        // Parse color (hex "#RRGGBB" / "#RGB" or "rgb(r,g,b)" / "rgba(r,g,b,a)")
        let cr=225, cg=238, cb=255;
        if (col[0] === "#" && (col.length === 7 || col.length === 4)){
          if (col.length === 7){
            cr = parseInt(col.slice(1,3),16);
            cg = parseInt(col.slice(3,5),16);
            cb = parseInt(col.slice(5,7),16);
          } else {
            cr = parseInt(col[1]+col[1],16);
            cg = parseInt(col[2]+col[2],16);
            cb = parseInt(col[3]+col[3],16);
          }
        } else if (col.startsWith("rgb")){
          const nums = col.replace(/rgba?\(/,'').replace(/\)/,'').split(',').map(s=>parseFloat(s.trim()));
          if (nums.length >= 3){
            cr = nums[0]|0; cg = nums[1]|0; cb = nums[2]|0;
          }
        }

        // Offscreen buffer (so masking never touches the game canvas)
        let cvs = f._cvs, octx = f._ctx;
        // Height budget: only what we need above base (keeps perf stable)
        const hNeed = Math.max(64, Math.round(f.lift + f.thickness + 140));
        const height = Math.min(900, hNeed);

        if (!cvs || cvs.width !== width || cvs.height !== height){
          cvs = document.createElement("canvas");
          cvs.width = width;
          cvs.height = height;
          octx = cvs.getContext("2d");
          f._cvs = cvs;
          f._ctx = octx;
        } else {
          octx.clearRect(0,0,width,height);
        }

        const layers = Math.max(6, Math.min(32, f.layers|0));
        const baseY = height; // bottom edge for fill
        const fallPx = Math.max(0, f.falloff || 0);

        // --- draw fog into offscreen ---
        octx.save();
        octx.globalCompositeOperation = "source-over";

        for (let li=0; li<layers; li++){
          const a = (layers <= 1) ? 0 : (li / (layers - 1));
          // Much lighter by default so Lumo remains visible
          const alpha = f.density * (0.14 + (1 - a) * 0.62);
          if (alpha <= 0.001) continue;

          const lift = f.lift + a * f.thickness;

          octx.beginPath();
          for (let i=0;i<N;i++){
            const x = i * step;

            // Height falloff near the ends (uses the same falloff length the editor sets).
            // This makes the fog "drop in height" toward the ends, not just fade in opacity.
            let edgeMask = 1;
            if (fallPx > 0){
              const d = Math.min(x, width - x);          // distance to nearest end (px)
              edgeMask = Math.max(0, Math.min(1, d / fallPx));
              // smoothstep
              edgeMask = edgeMask * edgeMask * (3 - 2 * edgeMask);
            }

            const h = Math.max(0, field[i]) * (9 + (1 - a) * 18);
            const y = (baseY - lift) - (h * edgeMask);
if (i === 0) octx.moveTo(x, y);
            else octx.lineTo(x, y);
          }
          octx.lineTo(width, baseY);
          octx.lineTo(0, baseY);
          octx.closePath();

          octx.fillStyle = `rgba(${cr},${cg},${cb},${Math.max(0, Math.min(1, alpha*exposure))})`;
          octx.fill();
        }

        // --- apply true end-falloff mask (fades ALL pixels, not just height) ---
        if (fallPx > 0){
          // Allow falloff length up to the full volume length.
          // If fallPx > width/2 we smoothly taper from both ends all the way to the center (no plateau).
          const t = Math.min(0.5, fallPx / Math.max(1, width));
          const fpL = t * width;
          const fpR = width - fpL;
octx.globalCompositeOperation = "destination-in";

          const g = octx.createLinearGradient(0,0,width,0);
          g.addColorStop(0.0, "rgba(255,255,255,0)");
          g.addColorStop(fpL / width, "rgba(255,255,255,1)");
          g.addColorStop(fpR / width, "rgba(255,255,255,1)");
          g.addColorStop(1.0, "rgba(255,255,255,0)");
octx.fillStyle = g;
          octx.fillRect(0,0,width,height);
        }

        octx.restore();

        // --- draw to game canvas over darkness (soft, non-blocking) ---
        ctx.save();
        
        const b = (typeof f.blend === "string") ? f.blend : "screen";
        ctx.globalCompositeOperation = (b === "add") ? "lighter" : (b === "normal" ? "source-over" : "screen");

        ctx.globalAlpha = 0.60; // keep Lumo readable in thick fog

        // draw so the offscreen bottom aligns to fog base (y0)
        ctx.drawImage(cvs, x0s, baseYs - height);

        ctx.restore();
      }
    }

  }

  Lumo.Entities = Entities;
})();
