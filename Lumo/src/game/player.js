(() => {
  window.Lumo = window.Lumo || {};
  const U = () => Lumo.U;

  class Player {
    constructor(){
      this.x = 0; this.y = 0;
      this.w = 22; this.h = 28;
      this.vx = 0; this.vy = 0;

      this.onGround = false;
      this._airborneTime = 0;

      // new: platform reference (entity) player stood on last frame
      this.onPlatform = null;

      // Facing: -1 = left, +1 = right
      this.facing = 1;

      // Movement feel
      this.speed = 230;
      this.groundAccel = 2200;
      this.airAccel = 1400;
      this.groundFriction = 2200;
      this.airFriction = 250;

      // Base movement caches (tiles can temporarily scale values each frame)
      this._baseSpeed = this.speed;
      this._baseGroundAccel = this.groundAccel;
      this._baseGroundFriction = this.groundFriction;
      this._surfaceState = {
        lastDef: null,
        holdUntil: 0,
      };

      // Jump / gravity
      this.jumpVel = -720;
      this.gravityUp = 1450;
      this.gravityDown = 2100;
      this.maxFall = 980;

      // Jump helpers
      this.coyoteTime = 0.11;
      this.jumpBuffer = 0.10;
      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
      this.jumpCutMultiplier = 0.55;

      // Lives / invuln
      this.lives = 4;
      this.invuln = 0;
      this.invulnDuration = 1.6;

      // Checkpoint / respawn
      this.checkpoint = null; // { tx, ty, px, py }
      this.lockMinX = 0;      // backtracking lock after respawn
      this._t = 0;            // local time for flicker etc.
      this._respawn = { active:false, t:0, total:3, lastCount:0 };
      this._justRespawned = false;

      // Energy/light
      this.energy = 1.0;
      this.energyMax = 1.0;

      this.lightMin = 80;
      this.lightMax = 320;
      this.lightRadius = this.lightMax;

      this.drainMovePerSec = 0.06;
      this.drainBoostPerSec = 0.18;
      this.recoverIdlePerSec = 0.0;

      // Boost
      this.boosting = false;
      this.boostMult = 1.55;

      // Pulse
      this.pulse = { active:false, r:0, alpha:0, thickness:3, id:0 };

      // Flares
      this.flares = 1;
      this.flareEnergyCost = 0.11;
      this._throwFlareRequest = null;
      this._flareSprite = null;
      this._flareSpritePath = "";

      // HUD cache
      this._hud = {
        energy: 1,
        lives: 4,
        flares: 1,
        lightRadius: this.lightRadius
      };

      // --- Sprite animation (Lumo) ---
      // Assets:
      //   data/assets/sprites/lumo/lumo_idle_1-4.png (pingpong)
      //   data/assets/sprites/lumo/lumo_walk_1-4.png (loop; missing frames fall back to _1)
      this._spr = {
        base: "data/assets/sprites/lumo/",
        cache: new Map(),
        idle: ["lumo_idle_1.png","lumo_idle_2.png","lumo_idle_3.png","lumo_idle_4.png"],
        walk: ["lumo_walk_1.png","lumo_walk_2.png","lumo_walk_3.png","lumo_walk_4.png"],
        death: ["lumo_death_1.png","lumo_death_2.png","lumo_death_3.png","lumo_death_4.png"],
      };

      // --- Preload brake sprite so the first brake does not miss due to async image load ---
      {
        const path = this._spr.base + "lumo_brake_1.png";
        if (!this._spr.cache.has(path)){
          const img = new Image();
          img._ok = false;
          img.onload = () => { img._ok = true; };
          img.onerror = () => { img._ok = false; };
          img.src = path;
          this._spr.cache.set(path, img);
        }
      }


      this._anim = {
        mode: "idle",  // "idle" | "walk" (jump etc later)
        t: 0,
        i: 0,
        dir: +1,       // pingpong direction
        fpsIdle: 7.0,
        fpsWalk: 9.0
      };

      // --- Brake sprite state (ice) ---
      // Shows lumo_brake_1.png when releasing left/right on slippery (ice) until stopped.
      this._brake = { active:false, prevMoving:false, slipUntil:0, lockUntil:0 };

      // Short hit reaction (damage pose + push back), then death animation.
      this.knockTimer = 0;
      this._damage = {
        active: false,
        t: 0,
        duration: 0.12,
        pendingDeath: false
      };

      this._deathAnim = {
        active: false,
        t: 0,
        duration: 0.72,
        fade: 1,
        rot: 0
      };
      this._liquidDeath = {
        active: false,
        type: null,
        t: 0,
        duration: 0.95,
        fadeDelay: 0.2,
        fade: 1,
        sinkSpeed: 125,
      };
      this._sfx = {
        jump: "data/assets/audio/sfx/player/movement/player_jump_01.ogg",
        move: "data/assets/audio/sfx/player/movement/player_move.ogg",
        land: "data/assets/audio/sfx/player/movement/player_land.ogg",
      };
      this._moveLoopPlaying = false;
      this._moveLoopHandle = null;
      this._moveSfxGroundedUntil = 0;
      this._moveSfxGroundedGrace = 0.10;

    }

    _playGameplaySfx(world, path, volume = 1){
      if (!path || !world || !world._ents || typeof world._ents._playOneShot !== "function") return;
      world._ents._playOneShot(path, volume);
    }

    _setMovementLoop(world, shouldPlay){
      const ents = world && world._ents;
      const path = this._sfx && this._sfx.move;
      if (!ents || !path || typeof ents._getSoundHandle !== "function" || typeof ents._setHandleVolume !== "function"){
        this._moveLoopPlaying = false;
        this._moveLoopHandle = null;
        return;
      }
      if (!this._moveLoopHandle){
        this._moveLoopHandle = ents._getSoundHandle(path, true);
      }
      if (shouldPlay){
        ents._setHandleVolume(this._moveLoopHandle, 1.0);
        this._moveLoopPlaying = true;
        return;
      }
      if (this._moveLoopPlaying && this._moveLoopHandle && this._moveLoopHandle.audio){
        try { this._moveLoopHandle.audio.pause(); this._moveLoopHandle.audio.currentTime = 0; } catch(_){ }
      }
      ents._setHandleVolume(this._moveLoopHandle, 0);
      this._moveLoopPlaying = false;
    }

    setSpawn(px, py){
      this.x = px;
      this.y = py;
      this.vx = 0;
      this.vy = 0;
      this.onGround = false;
      this._airborneTime = 0;
      this.onPlatform = null;
      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
      this._moveLoopPlaying = false;
      this._moveLoopHandle = null;
      this._moveSfxGroundedUntil = 0;
    }

    setEnergy(p){
      this.energy = U().clamp(p, 0, 1);
      this.lightRadius = U().lerp(this.lightMin, this.lightMax, this.energy);
    }
  // >>> LUMO-PATCH: lantern charge API START
  // Adds a tiny, well-scoped API that entities (lantern) can call:
  //   player.chargeEnergy(amount)
  // amount is expected to be a small float (e.g. strength * dt)
  chargeEnergy(amount){
    try {
      if (!Number.isFinite(amount) || amount <= 0) return;
      // Prefer existing setEnergy if present
      if (typeof this.setEnergy === 'function'){
        this.setEnergy(this.energy + amount);
      } else {
        // Fallback: apply and clamp manually
        this.energy = (this.energy || 0) + amount;
        const maxE = (typeof this.energyMax === 'number') ? this.energyMax : 1;
        if (this.energy > maxE) this.energy = maxE;
        if (this.energy < 0) this.energy = 0;
        // Update lightRadius if these properties/util exist
        if (typeof window.Lumo !== 'undefined' && typeof window.Lumo.U === 'function' && typeof this.lightMin === 'number' && typeof this.lightMax === 'number') {
          try {
            const U = window.Lumo.U();
            if (typeof U.lerp === 'function') {
              this.lightRadius = U.lerp(this.lightMin, this.lightMax, this.energy);
            }
          } catch(e){}
        }
      }
    } catch(e){
      // Never break the game; fail quietly and log for debugging.
      console.warn("chargeEnergy patch error:", e && e.message);
    }
  }
  // <<< LUMO-PATCH: lantern charge API END

    refill(){ this.setEnergy(1.0); }
    halfRefill(){ this.setEnergy(0.5); }
    // --------------------------------------------------
    // Checkpoints & respawn (CANON)
    // --------------------------------------------------
    setCheckpoint(px, py){
      const ts = (typeof Lumo !== "undefined" && Lumo.TILE) ? Lumo.TILE : 24;

      // normalize to tile coords (activation rule: same tile)
      const tx = Math.max(0, Math.floor(px / ts));
      const ty = Math.max(0, Math.floor(py / ts));

      // only update if changed
      if (!this.checkpoint || this.checkpoint.tx !== tx || this.checkpoint.ty !== ty){
        this.checkpoint = { tx, ty, px: tx*ts, py: ty*ts };
        this._checkpointChanged = true;
      }
    }

    isRespawning(){
      return !!(this._respawn && this._respawn.active);
    }

    getRespawnCount(){
      if (!this.isRespawning()) return 0;
      return Math.max(0, Math.min(3, Math.ceil(this._respawn.t)));
    }

    isDeathAnimating(){
      return !!(
        (this._damage && this._damage.active)
        || (this._deathAnim && this._deathAnim.active)
        || (this._liquidDeath && this._liquidDeath.active)
      );
    }

    beginRespawn(){
      if (this.isRespawning()) return;
      if (this._damage.active || this._deathAnim.active) return;
      if (this._liquidDeath && this._liquidDeath.active) return;
      if (this.lives <= 0) return;

      // lose life now, then run short hit + death reaction.
      this.lives = Math.max(0, this.lives - 1);

      const dir = (this.facing < 0) ? 1 : -1;
      this.knockTimer = this._damage.duration;
      this.vx = 180 * dir;
      this.vy = -120;

      this._damage.active = true;
      this._damage.t = 0;
      this._damage.pendingDeath = true;

      this._deathAnim.active = false;
      this._deathAnim.t = 0;
      this._deathAnim.fade = 1;
      this._deathAnim.rot = 0;

      this.onGround = false;
      this.onPlatform = null;
    }

    beginLiquidHazardDeath(contact = null){
      if (this.isRespawning()) return;
      if ((this._damage && this._damage.active) || (this._deathAnim && this._deathAnim.active)) return;
      if (this._liquidDeath && this._liquidDeath.active) return;
      if (this.lives <= 0) return;

      this.lives = Math.max(0, this.lives - 1);

      this._liquidDeath.active = true;
      this._liquidDeath.type = String(contact?.type || "liquid_volume");
      this._liquidDeath.t = 0;
      this._liquidDeath.fade = 1;
      this._liquidDeath.duration = 0.95;
      this._liquidDeath.fadeDelay = 0.2;
      this._liquidDeath.sinkSpeed = 125;

      this.vx *= 0.16;
      this.vy = Math.max(40, (contact?.submerge01 || 0) * 80);
      this.onGround = false;
      this.onPlatform = null;
    }

    _startDeathAnimation(){
      this._damage.pendingDeath = false;
      this._deathAnim.active = true;
      this._deathAnim.t = 0;
      this._deathAnim.fade = 1;
      this._deathAnim.rot = 0;

      const dir = (this.facing < 0) ? 1 : -1;
      this.vx = 120 * dir;
      this.vy = -180;
      this.onGround = false;
      this.onPlatform = null;
    }

    _beginRespawnCountdown(){
      if (!this._respawn) this._respawn = { active:false, t:0, total:3, lastCount:0 };
      this._respawn.total = 3;
      this._respawn.t = this._respawn.total;
      this._respawn.lastCount = Math.ceil(this._respawn.t);
      this._respawn.active = true;

      this.vx = 0;
      this.vy = 0;
      this.onGround = false;
      this.onPlatform = null;
    }

    _applyRespawnEnergyPolicy(){
      // Policy is NOT final yet.
      // For now we keep the existing placeholder: respawn at ~50% energy.
      this.halfRefill();
    }

    _doRespawn(world){
      const ts = (typeof Lumo !== "undefined" && Lumo.TILE) ? Lumo.TILE : 24;

      // fallback: if no checkpoint exists, respawn where we are (tile-normalized)
      let cptx = ((this.x + this.w*0.5) / ts) | 0;
      let cpty = ((this.y + this.h*0.5) / ts) | 0;

      if (this.checkpoint){
        cptx = this.checkpoint.tx|0;
        cpty = this.checkpoint.ty|0;
      }

      // CANON: respawn 15 tiles BEFORE checkpoint in X, same Y as checkpoint
      const rtx = Math.max(0, (cptx - 15)|0);
      const rty = Math.max(0, cpty|0);

      const rx = rtx * ts;
      const ry = rty * ts;

      this.setSpawn(rx, ry);

      // CANON: after respawn, can't go left past respawn position
      this.lockMinX = rx;

      // CANON: temporary invulnerability after respawn
      this.invuln = this.invulnDuration;

      this._applyRespawnEnergyPolicy();

      // mark for app.js to snap camera etc.
      this._justRespawned = true;
    }

    // Legacy helper (kept for compatibility with earlier hazards),
    // now routes into the new countdown flow.
    damageAndRespawn(respawnX, respawnY){
      // keep signature but use checkpoint-driven flow
      this.beginRespawn();
    }

    // Pulse (D)
    startPulse(){
      if (this.energy <= 0.08) return;
      this.setEnergy(this.energy - 0.08);

      this.pulse.active = true;
      this.pulse.r = 8;
      this.pulse.alpha = 0.9;
      this.pulse.thickness = 3;
      this.pulse.id = ((this.pulse.id|0) + 1) | 0;
    }

    updatePulse(dt){
      if (!this.pulse.active) return;
      this.pulse.r += 620 * dt;
      this.pulse.alpha -= 1.25 * dt;
      this.pulse.thickness = 2 + Math.max(0, this.pulse.alpha) * 3;
      if (this.pulse.alpha <= 0) this.pulse.active = false;
    }

    // Flares (S)
    addFlares(n=1){
      this.flares = Math.max(0, (this.flares|0) + (n|0));
    }

    consumeThrowFlare(){
      if ((this.flares|0) <= 0) return false;
      if (this.energy < this.flareEnergyCost) return false;

      this.flares -= 1;
      this.setEnergy(this.energy - this.flareEnergyCost);

      const dir = (this.facing < 0) ? -1 : 1;

      const startX = (dir > 0)
        ? (this.x + this.w + 4)
        : (this.x - 4);

      const startY = this.y + 8;

      this._throwFlareRequest = {
        x: startX,
        y: startY,
        vx: 360 * dir,
        vy: -420,
        sprite: this._flareSprite || null,
        spritePath: this._flareSpritePath || "",
      };

      return true;
    }

    popThrowFlareRequest(){
      const p = this._throwFlareRequest;
      this._throwFlareRequest = null;
      return p;
    }


    // --- Surface helpers (ice/brake) ---
    _getSurfaceDef(world){
      // Only meaningful when grounded on tiles (not moving platforms).
      if (!world) return null;
      const ts = world.tileSize || (Lumo.TILE||24);
      // Sample one pixel below feet across the player's support width so
      // surface behavior remains stable on sized footprints (2x2, 3x3, ...).
      const sy = this.y + this.h + 1;
      const ty = Math.floor(sy / ts);
      const inset = Math.min(4, this.w * 0.25);
      // Sample center first so crossing tile seams does not "lag" on edge tiles.
      const sampleXs = [
        this.x + this.w * 0.5,
        this.x + inset,
        this.x + this.w - inset,
      ];

      if (typeof world.getTileBehavior === 'function'){
        const sampledTx = new Set();
        for (let i = 0; i < sampleXs.length; i++){
          const tx = Math.floor(sampleXs[i] / ts);
          if (sampledTx.has(tx)) continue;
          sampledTx.add(tx);
          const resolved = world.getTileBehavior(tx, ty);
          if (resolved) return resolved;
        }
        // Modern runtime path: behavior lookup is authoritative.
        // If none of the support samples resolve a behavior, treat as undefined.
        return null;
      }

      // Legacy fallback path for runtimes that don't expose getTileBehavior.
      const tx = Math.floor(sampleXs[1] / ts);

      let id = 0;
      if (typeof world.getTile === 'function') id = world.getTile(tx, ty) | 0;
      else if (typeof world.get === 'function') id = world.get(tx, ty) | 0;
      if (!id) return null;

      const resolvedById = (typeof world.resolveTileBehaviorById === 'function')
        ? world.resolveTileBehaviorById(id)
        : null;
      const tsDef = (Lumo.Tileset && Lumo.Tileset[id]) ? Lumo.Tileset[id] : null;
      // Some implementations store defs in world.tileDefs instead.
      const wDef = (world.tileDefs && world.tileDefs[id]) ? world.tileDefs[id] : null;
      return resolvedById || tsDef || wDef || null;
    }

    _applySurface(world){
      const now = (typeof performance !== "undefined" && performance && performance.now)
        ? performance.now()
        : Date.now();
      let def = null;

      if (this.onGround && !this.onPlatform){
        def = this._getSurfaceDef(world);
        if (def){
          this._surfaceState.lastDef = def;
          this._surfaceState.holdUntil = now + 90;
        }
      }

      if (!def && this._surfaceState.lastDef && now < (this._surfaceState.holdUntil || 0)){
        def = this._surfaceState.lastDef;
      }

      // Default to base values
      this.speed = this._baseSpeed;
      this.groundAccel = this._baseGroundAccel;
      this.groundFriction = this._baseGroundFriction;

      if (!def) return;

      // Runtime/world compatibility bridge:
      // - legacy/player naming: speedMul, accelMul, frictionMul
      // - runtime-resolved naming: maxSpeedMul, groundAccelMul, groundFrictionMul
      const sm = (typeof def.speedMul === 'number')
        ? def.speedMul
        : ((typeof def.maxSpeedMul === 'number') ? def.maxSpeedMul : 1.0);
      const am = (typeof def.accelMul === 'number')
        ? def.accelMul
        : ((typeof def.groundAccelMul === 'number') ? def.groundAccelMul : 1.0);
      const fm = (typeof def.frictionMul === 'number')
        ? def.frictionMul
        : ((typeof def.groundFrictionMul === 'number') ? def.groundFrictionMul : 1.0);

      this.speed = this._baseSpeed * sm;
      this.groundAccel = this._baseGroundAccel * am;
      this.groundFriction = this._baseGroundFriction * fm;
    }

    update(dt, world){
      this._t = (this._t || 0) + dt;

      if (this._liquidDeath && this._liquidDeath.active){
        this._setMovementLoop(world, false);
        this._liquidDeath.t += dt;
        const seqP = U().clamp(this._liquidDeath.t / Math.max(0.001, this._liquidDeath.duration), 0, 1);
        const fadeP = U().clamp((this._liquidDeath.t - this._liquidDeath.fadeDelay) / Math.max(0.001, this._liquidDeath.duration - this._liquidDeath.fadeDelay), 0, 1);

        this.vx *= Math.max(0, 1 - (7.5 * dt));
        const sinkTarget = this._liquidDeath.sinkSpeed;
        this.vy += (sinkTarget - this.vy) * Math.min(1, 5.5 * dt);
        this.y += this.vy * dt;
        this.x += this.vx * dt;
        this._liquidDeath.fade = 1 - fadeP;

        if (seqP >= 1){
          this._liquidDeath.active = false;
          this._liquidDeath.fade = 0;
          if (this.lives > 0){
            this._beginRespawnCountdown();
          }
        }
        return;
      }

      if (this._damage && this._damage.active){
        this._setMovementLoop(world, false);
        this._damage.t += dt;
        this.vy += this.gravityUp * dt;
        this.moveAndCollide(dt, world);
        this.vx *= 0.82;

        if (this._damage.t >= this._damage.duration){
          this._damage.active = false;
          this.knockTimer = 0;
          if (this._damage.pendingDeath) this._startDeathAnimation();
        }
        return;
      }

      if (this._deathAnim && this._deathAnim.active){
        this._setMovementLoop(world, false);
        this._deathAnim.t += dt;
        const p = U().clamp(this._deathAnim.t / Math.max(0.001, this._deathAnim.duration), 0, 1);

        this.vy += this.gravityDown * 0.5 * dt;
        this.vx *= (1 - Math.min(0.45, 1.7 * dt));
        this.moveAndCollide(dt, world);

        this._deathAnim.fade = 1 - p;
        this._deathAnim.rot = (Math.PI / 2.6) * p * ((this.facing < 0) ? 1 : -1);

        if (p >= 1){
          this._deathAnim.active = false;
          if (this.lives > 0){
            this._beginRespawnCountdown();
          }
        }
        return;
      }

      // Respawn countdown state: freeze player until timer expires
      if (this._respawn && this._respawn.active){
        this._setMovementLoop(world, false);
        this._respawn.t -= dt;
        if (this._respawn.t <= 0){
          this._respawn.active = false;
          this._doRespawn(world);
        }
        return;
      }

      const inp = Lumo.Input;

      // invuln tick
      this.invuln = Math.max(0, (this.invuln || 0) - dt);
	  this.knockTimer = Math.max(0, this.knockTimer - dt);

      const left  = inp.down("arrowleft");
      const right = inp.down("arrowright");

      const jumpTap  = inp.tap("a");
      const jumpHeld = inp.down("a");

      const pulseTap = inp.tap("d");
      const flareTap = inp.tap("s");

      const boostHeld = inp.down(" ");

      if (pulseTap) this.startPulse();
      if (flareTap) this.consumeThrowFlare();

      // facing
      const moveDir = (right ? 1 : 0) - (left ? 1 : 0);
      if (moveDir !== 0) this.facing = moveDir;

      // jump buffer
      if (jumpTap) this.jumpBufferTimer = this.jumpBuffer;
      else this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);

      // coyote
      if (this.onGround) this.coyoteTimer = this.coyoteTime;
      else this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);

      // boost
      this.boosting = boostHeld && this.energy > 0.04;

      const moving = moveDir !== 0;      // BRake_PATCH_V3: stable brake under ice-glide (hysteresis + minimum display time)
      try{
        const now = (performance && performance.now) ? performance.now() : Date.now();

        // slippery now? (based on surface definition in tileset)
        let slipperyNow = false;
        if (this.onGround && !this.onPlatform){
          const def = this._getSurfaceDef(world);
          if (def){
            const fm = (typeof def.frictionMul === 'number')
              ? def.frictionMul
              : ((typeof def.groundFrictionMul === 'number') ? def.groundFrictionMul : 1.0);
            const nm = (def.name || "");
            if (fm <= 0.05 || nm === "ice") slipperyNow = true;
          }
        }

        if (this._brake){
          // Remember slippery briefly to survive 1-frame ground/surface flicker
          if (slipperyNow) this._brake.slipUntil = now + 220;

          const slipperyRecent = (this._brake.slipUntil || 0) > now;
          const wasMoving = !!this._brake.prevMoving;

          // ENTER: release input while still sliding on (recently) slippery surface
          if (wasMoving && !moving && slipperyRecent && Math.abs(this.vx) > 0.8){
            this._brake.active = true;
            // Minimum visible time so it doesn't pop back to idle
            this._brake.lockUntil = now + 180;
          }

          // EXIT immediately on new input
          if (moving){
            this._brake.active = false;
            this._brake.lockUntil = 0;
          }

          // After lock time, brake ends only once we have effectively stopped
          if (this._brake.active && (this._brake.lockUntil || 0) <= now){
            if (Math.abs(this.vx) <= 0.5){
              this._brake.active = false;
            }
          }

          this._brake.prevMoving = moving;
        }
      }catch(_){}
// --- Sprite anim update (idle pingpong / walk loop) ---
      {
        const a = this._anim;
        if (a){
          const wantWalk = moving;
          a.mode = wantWalk ? "walk" : "idle";

          // Walk animation speeds up slightly with movement speed
          const sp = Math.max(0, Math.min(1.75, Math.abs(this.vx) / Math.max(1, this.speed)));
          const fps = (a.mode === "walk") ? (a.fpsWalk * (0.65 + 0.55 * sp)) : a.fpsIdle;
          const step = 1 / Math.max(1, fps);

          a.t += dt;
          while (a.t >= step){
            a.t -= step;

            if (a.mode === "idle"){
              // pingpong 0→1→2→3→2→1→...
              a.i += a.dir;
              if (a.i >= 3){ a.i = 3; a.dir = -1; }
              if (a.i <= 0){ a.i = 0; a.dir = +1; }
            } else {
              // walk loop 0→1→2→3→0...
              a.i = (a.i + 1) % 4;
              a.dir = +1;
            }
          }
        }
      }


      // horizontal accel
	  if (!this.knockTimer || this.knockTimer <= 0){
      // Apply latest grounded surface tuning before movement integration.
      this._applySurface(world);
      const targetSpeed = moveDir * this.speed * (this.boosting ? this.boostMult : 1.0);

      if (moving){
        const accel = this.onGround ? this.groundAccel : this.airAccel;
        const dv = targetSpeed - this.vx;
        const maxStep = accel * dt;
        this.vx += U().clamp(dv, -maxStep, maxStep);
      } else {
        const fr = (this.onGround ? this.groundFriction : this.airFriction) * dt;
        if (Math.abs(this.vx) <= fr) this.vx = 0;
        else this.vx -= Math.sign(this.vx) * fr;
      }
    }
      // jump execution
      if (this.jumpBufferTimer > 0 && this.coyoteTimer > 0){
        this.vy = this.jumpVel;
        this.onGround = false;
        this.onPlatform = null;
        this.coyoteTimer = 0;
        this.jumpBufferTimer = 0;
        const jumpVariants = [
          "data/assets/audio/sfx/player/movement/player_jump_01.ogg",
          "data/assets/audio/sfx/player/movement/player_jump_03.ogg",
          "data/assets/audio/sfx/player/movement/player_jump_04.ogg"
        ];
        const pick = jumpVariants[Math.floor(Math.random() * jumpVariants.length)];
        this._playGameplaySfx(world, pick, 0.75);
      }

      // variable jump
      if (!jumpHeld && this.vy < 0){
        this.vy *= this.jumpCutMultiplier;
      }

      // gravity
      const falling = this.vy > 0;
      this.vy += (falling ? this.gravityDown : this.gravityUp) * dt;
      this.vy = Math.min(this.vy, this.maxFall);

      const wasGrounded = !!this.onGround;
      const preCollideX = this.x;
      const preCollideVy = this.vy;
      const airborneTimeBeforeStep = this._airborneTime || 0;
      this.moveAndCollide(dt, world);

      const landedThisStep = (!wasGrounded && this.onGround);
      const MIN_LAND_AIRTIME = 0.05;
      const MIN_LAND_IMPACT_VY = 120;
      const qualifiesAsRealLanding = landedThisStep
        && (airborneTimeBeforeStep >= MIN_LAND_AIRTIME || preCollideVy >= MIN_LAND_IMPACT_VY);
      if (qualifiesAsRealLanding){
        this._playGameplaySfx(world, this._sfx.land, 1.0);
      }

      this._airborneTime = this.onGround ? 0 : (airborneTimeBeforeStep + dt);
      if (this.onGround){
        this._moveSfxGroundedUntil = (this._t || 0) + (this._moveSfxGroundedGrace || 0.10);
      }
      const moveSfxGrounded = this.onGround || (this._t || 0) < (this._moveSfxGroundedUntil || 0);
      const MOVE_SFX_MIN_SPEED = 0.5;
      const movedGroundedThisStep = moveSfxGrounded && Math.abs(this.x - preCollideX) >= 0.05;
      const shouldPlayMoveLoop = movedGroundedThisStep || (moveSfxGrounded && Math.abs(this.vx) >= MOVE_SFX_MIN_SPEED);
      this._setMovementLoop(world, shouldPlayMoveLoop);

      // energy drain
      if (moving){
        this.setEnergy(this.energy - this.drainMovePerSec * dt);
      } else {
        if (this.recoverIdlePerSec > 0){
          this.setEnergy(this.energy + this.recoverIdlePerSec * dt);
        }
      }
      if (this.boosting){
        this.setEnergy(this.energy - this.drainBoostPerSec * dt);
      }

      this.updatePulse(dt);

      // HUD cache
      this._hud.energy = this.energy;
      this._hud.lives = this.lives;
      this._hud.flares = this.flares;
      this._hud.lightRadius = this.lightRadius;
    }

    moveAndCollide(dt, world){
      const Ux = U();

      // X axis
      this.x += this.vx * dt;
      {
        const tiles = world.queryTiles(this.x, this.y, this.w, this.h);
        for (const t of tiles){
          // hazards don't block
          if (t.def.hazard) continue;

          if (!t.def.solid) continue;
          if (t.def.oneWay) continue;

          if (Ux.aabb(this.x,this.y,this.w,this.h, t.x,t.y,t.w,t.h)){
            if (this.vx > 0) this.x = t.x - this.w;
            else if (this.vx < 0) this.x = t.x + t.w;
            this.vx = 0;
          }
        }
      }

      // Y axis (ROBUST one-way landing)
      const yPrev = this.y;
      this.y += this.vy * dt;
      this.onGround = false;

      {
        const tiles = world.queryTiles(this.x, this.y, this.w, this.h);
        for (const t of tiles){
          if (t.def.hazard) continue;
          if (!t.def.solid) continue;

          if (!Ux.aabb(this.x,this.y,this.w,this.h, t.x,t.y,t.w,t.h)) continue;

          if (t.def.oneWay){
            // ✅ robust crossing check with epsilon
            const EPS = 3; // pixels tolerance (deterministic, fixes "never lands")
            const feet = this.y + this.h;
            const prevFeet = yPrev + this.h;
            const top = t.y;

            const withinX = (this.x + this.w) > t.x && this.x < (t.x + t.w);
            const fallingNow = this.vy >= 0;

            // Only land if we were above (or very close above) the top last frame,
            // and now our feet have crossed down onto/through it.
            const crossedDown = (prevFeet <= top + EPS) && (feet >= top);

            if (!(withinX && fallingNow && crossedDown)){
              continue;
            }
          }

          if (this.vy > 0){
            this.y = t.y - this.h;
            this.vy = 0;
            this.onGround = true;
          } else if (this.vy < 0){
            this.y = t.y + t.h;
            this.vy = 0;
          }
        }
      }

      // >>> LUMO: world X-clamp (final, tile-correct)
      {
        const tileSize =
          (typeof world.tileSize === "number")
            ? world.tileSize
            : (typeof Lumo !== "undefined" && Lumo.TILE)
              ? Lumo.TILE
              : 24;

        // World width is defined in TILES in Lumo
        const worldMaxX = world.w * tileSize;
        const minX = (typeof this.lockMinX === "number") ? this.lockMinX : 0;
        const maxX = worldMaxX - this.w;

        if (this.x < minX){
          this.x = minX;
          if (this.vx < 0) this.vx = 0;
        }

        if (this.x > maxX){
          this.x = maxX;
          if (this.vx > 0) this.vx = 0;
        }
      }
      // <<< LUMO: world X-clamp



      // --- Moving platforms support (detect & carry) ---
      // We rely on the Entities manager to have exposed itself on world._ents
      // (entities.update sets world._ents = this)
      const ents = world && world._ents ? world._ents : null;
      let foundPlatform = null;

      if (ents && Array.isArray(ents.items)){
        const EPS = 4; // tolerances in pixels
        for (const e of ents.items){
          if (!e.active) continue;
          if (e.type !== "movingPlatform") continue;

          // platform top
          const pTop = e.y;
          const pLeft = e.x;
          const pRight = e.x + e.w;

          const feet = this.y + this.h;
          const prevFeet = yPrev + this.h;

          // check horizontal overlap
          const overlapX = (this.x + this.w) > pLeft && this.x < pRight;

          // Ensure we're roughly on top (within EPS) AND we are at or just above the platform
          // We accept either having landed this frame (prevFeet <= pTop + EPS && feet >= pTop - EPS)
          // or already standing (feet === pTop within tolerance)
          const justAboveOrOn = (prevFeet <= pTop + EPS && feet >= pTop - EPS) || (Math.abs(feet - pTop) <= EPS);

          if (overlapX && justAboveOrOn && this.vy >= -50){
            // We consider player to be standing on this platform
            foundPlatform = e;
            // Snap the player onto the platform top in case of small penetration
            this.y = pTop - this.h;
            this.vy = 0;
            this.onGround = true;
            // Do not break — prefer nearest platform (but break to pick first match)
            break;
          }
        }
      }

      // Apply platform motion (carry player) AFTER we've resolved tile collisions and determined standing.
      if (foundPlatform){
        this.onPlatform = foundPlatform;
        // apply platform movement delta for this frame
        const dx = (foundPlatform.x - (foundPlatform.prevX || foundPlatform.x));
        const dy = (foundPlatform.y - (foundPlatform.prevY || foundPlatform.y));
        // move player by that delta
        this.x += dx;
        this.y += dy;

        // Safe clamp: if this pushed us into solid tiles, do a minimal pushout
        const tilesAfter = world.queryTiles(this.x, this.y, this.w, this.h);
        for (const t of tilesAfter){
          if (!t.def.solid) continue;
          if (Ux.aabb(this.x,this.y,this.w,this.h, t.x,t.y,t.w,t.h)){
            // naive resolution: push up if intersecting from above, else push left/right
            const penX = Math.min(t.x + t.w - this.x, this.x + this.w - t.x);
            const penY = Math.min(t.y + t.h - this.y, this.y + this.h - t.y);
            if (penY < penX){
              // push up
              if ((this.y + this.h/2) > (t.y + t.h/2)){
                // player center below tile center -> push down
                this.y += penY;
              } else {
                // player above -> push up
                this.y -= penY;
              }
            } else {
              // push horizontally away
              if ((this.x + this.w/2) < (t.x + t.w/2)) this.x = t.x - this.w;
              else this.x = t.x + t.w;
              this.vx = 0;
            }
          }
        }
      } else {
        // if no platform underfoot, detach
        this.onPlatform = null;
      }

      // Apply ice/brake surface tuning (deterministic)
      this._applySurface(world);
    }

    drawHUD(ctx){
      const x = 16, y = 14;

      ctx.save();
      ctx.setTransform(1,0,0,1,0,0);

      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(x-10, y-8, 360, 62);

      // Energy segmented bar
      const segCount = 28, segGap = 2, segW = 9, segH = 14;
      const barX = x, barY = y;

      const p = Math.max(0, Math.min(1, this._hud.energy));
      const lit = Math.round(p * segCount);

      for (let i=0;i<segCount;i++){
        const sx = barX + i*(segW+segGap);
        const on = i < lit;
        ctx.fillStyle = on ? "rgba(120,190,140,0.85)" : "rgba(255,255,255,0.10)";
        ctx.fillRect(sx, barY, segW, segH);
      }

      // Lives
      const livesX = x, livesY = y + 24;
      for (let i=0;i<4;i++){
        const bx = livesX + i*18;
        const alive = i < this._hud.lives;

        ctx.strokeStyle = "rgba(255,255,255,0.45)";
        ctx.lineWidth = 1;
        ctx.strokeRect(bx, livesY, 14, 10);

        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.fillRect(bx+14, livesY+3, 2, 4);

        if (alive){
          ctx.fillStyle = "rgba(210,210,210,0.35)";
          ctx.fillRect(bx+2, livesY+2, 10, 6);
        }
      }

      // Flares (symbols only)
      const flX = x + 120, flY = y + 29;
      const count = Math.max(0, this._hud.flares|0);
      const shown = Math.min(count, 6);

      for (let i=0;i<shown;i++){
        const cx = flX + i*18;
        const cy = flY;

        ctx.beginPath();
        ctx.arc(cx, cy, 5.5, 0, Math.PI*2);
        ctx.fillStyle = "rgba(170,120,255,0.75)";
        ctx.fill();

        ctx.beginPath();
        ctx.arc(cx-2, cy-2, 2, 0, Math.PI*2);
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.fill();
      }

      if (count > 6){
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.font = "12px ui-sans-serif, system-ui, Segoe UI, Arial";
        ctx.fillText("…", flX + shown*18 + 4, flY + 4);
      }

      ctx.restore();
    }

    draw(ctx, cam){
      // During respawn countdown, player is "gone"
      if (this.isRespawning && this.isRespawning()) return;

      const sx = this.x - cam.x;
      const sy = this.y - cam.y;

      ctx.save();

      // CANON: flicker while invulnerable (visual-only)
      if ((this.invuln || 0) > 0){
        const t = this._t || 0;
        const on = ((t * 12) | 0) % 2 === 0;
        ctx.globalAlpha = on ? 0.28 : 1.0;
      }

      // === LUMO HEAD HALO (ALWAYS ON) — BEGIN ==================================
      // Remove this whole block between BEGIN/END to disable the constant head halo.
      {
        if (this._liquidDeath && this._liquidDeath.active){
          ctx.globalAlpha *= U().clamp(this._liquidDeath.fade, 0, 1);
        }
        const HALO_ALPHA = 0.90;   // 0..1 (strength)
        const HALO_R0    = 1;      // inner radius (px)
        const HALO_R1    = 40;     // outer radius (px)
        const HALO_YOFF  = 2;      // head center offset from sy (px)

        const cx = sx + this.w * 0.5;
        const cy = sy + HALO_YOFF;

        ctx.save();
        ctx.globalCompositeOperation = "lighter";

        const g = ctx.createRadialGradient(cx, cy, HALO_R0, cx, cy, HALO_R1);
        g.addColorStop(0.00, "rgba(255,220,140,0)");
        g.addColorStop(0.35, `rgba(255,215,120,${(0.55 * HALO_ALPHA).toFixed(3)})`);
        g.addColorStop(0.70, `rgba(255,195,95,${(0.35 * HALO_ALPHA).toFixed(3)})`);
        g.addColorStop(1.00, "rgba(255,195,95,0)");

        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, HALO_R1, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }
      // === LUMO HEAD HALO (ALWAYS ON) — END ====================================

      // --- Render Lumo sprite (with safe fallback to placeholder) ---
      let drewSprite = false;
      try{
        const spr = this._spr;
        const a = this._anim || { mode:"idle", i:0 };

        if (spr && spr.base){
          let name = null;

          // If taking damage, force hit-pose sprite.
          if (this._damage && this._damage.active){
            name = "lumo_brake_1.png";
          } else if (this._deathAnim && this._deathAnim.active){
            const d = this._deathAnim;
            const idx = Math.max(0, Math.min(3, Math.floor((d.t / Math.max(0.001, d.duration)) * 4)));
            name = spr.death[idx] || "lumo_death_4.png";
          } else if (this._brake && this._brake.active){
            name = "lumo_brake_1.png";
          } else {
            const list = (a.mode === "walk") ? spr.walk : spr.idle;
            name = list[Math.max(0, Math.min(3, a.i|0))];
          }

          const getImg = (path) => {
            if (!spr.cache.has(path)){
              const img = new Image();
              img._ok = false;
              img.onload = () => { img._ok = true; };
              img.onerror = () => { img._ok = false; };
              img.src = path;
              spr.cache.set(path, img);
            }
            return spr.cache.get(path);
          };

          const src = spr.base + name;
          let img = getImg(src);

          // Walk frames might not exist yet → fallback to walk_1
          if (a.mode === "walk" && (!img || img._ok === false) && name !== "lumo_walk_1.png"){
            img = getImg(spr.base + "lumo_walk_1.png");
          }

          if (img && img._ok){
            const iw = img.naturalWidth || img.width;
            const ih = img.naturalHeight || img.height;

            // Align sprite feet to player bottom, center horizontally
            const px = sx + (this.w * 0.5);
            const py = sy + this.h;

            ctx.save();

            if (this._deathAnim && this._deathAnim.active){
              const px = sx + (this.w * 0.5);
              const py = sy + this.h * 0.62;
              ctx.translate(px, py);
              ctx.rotate(this._deathAnim.rot || 0);
              ctx.translate(-px, -py);
              ctx.globalAlpha *= U().clamp(this._deathAnim.fade, 0, 1);
            }

            // Facing flip around center
            if (this.facing < 0){
              ctx.translate(px, 0);
              ctx.scale(-1, 1);
              ctx.translate(-px, 0);
            }

            // CANON sprite size (visual only)
            // Default Lumo body sprite target (idle/walk etc.)
            let SPR_W = 24;
            let SPR_H = 38;

            // Brake sprite: keep aspect ratio (no squish) and keep a strong 48px height feel.
            // If the source image is wide, allow some extra width but cap it softly to avoid "giant" look.
            if (name === "lumo_brake_1.png"){
              const TARGET_H = 48;      // visual height target
              const MAX_W    = 28;      // soft width cap (keeps proportions)
              let scale = TARGET_H / Math.max(1, ih);
              SPR_W = iw * scale;
              SPR_H = ih * scale;
              if (SPR_W > MAX_W){
                const s2 = MAX_W / Math.max(1, SPR_W);
                SPR_W *= s2;
                SPR_H *= s2;
              }
            }

            const dx = Math.round(px - SPR_W * 0.5);
            const dy = Math.round(py - SPR_H);

            ctx.drawImage(img, dx, dy, Math.round(SPR_W), Math.round(SPR_H));
            ctx.restore();

            drewSprite = true;
          }
        }
      }catch(_){}

      if (!drewSprite){
        // Placeholder fallback (keeps current gameplay-visible body)
        ctx.fillStyle = "#cdbb9e";
        ctx.fillRect(sx+2, sy+12, this.w-4, this.h-12);

        ctx.fillStyle = "#7a4a2a";
        ctx.fillRect(sx+2, sy+10, this.w-4, 4);

        ctx.fillStyle = "rgba(240,240,240,0.22)";
        ctx.fillRect(sx, sy, this.w, 14);

        ctx.fillStyle = "rgba(255,209,102,0.95)";
        ctx.fillRect(sx+3, sy+2, this.w-6, 10);

        ctx.fillStyle = "rgba(90,40,20,0.95)";
        ctx.fillRect(sx+6, sy+6, 3, 3);
        ctx.fillRect(sx+this.w-9, sy+6, 3, 3);

        ctx.fillStyle = "rgba(255,180,90,0.9)";
        ctx.fillRect(sx+this.w-5, sy+16, 2, 2);
        ctx.fillRect(sx+this.w-5, sy+20, 2, 2);

        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.fillRect(sx+4, sy+this.h+2, this.w-8, 3);
      }

      ctx.restore();
    }

    getRenderLightRadius(){
      if (this._deathAnim && this._deathAnim.active){
        return Math.max(0, this.lightRadius * U().clamp(this._deathAnim.fade, 0, 1));
      }
      if (this._liquidDeath && this._liquidDeath.active){
        return Math.max(0, this.lightRadius * U().clamp(this._liquidDeath.fade, 0, 1));
      }
      return this.lightRadius;
    }
  }

  Lumo.Player = Player;
})();
