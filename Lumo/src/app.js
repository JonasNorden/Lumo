(() => {
  window.Lumo = window.Lumo || {};

  const canvas = document.getElementById("game");
  const r = new Lumo.Renderer(canvas);
  const cam = new Lumo.Camera();

  const world = new Lumo.World();
  const ents = new Lumo.Entities();
  const player = new Lumo.Player();

  const GameState = Object.freeze({
    BOOTING: "booting",
    MENU: "menu",
    PLAYING: "playing",
    PAUSED: "paused",
    GAME_OVER: "game_over",
    INTERMISSION: "intermission"
  });

  class LevelManager {
    constructor(levels){
      this.levels = levels || {};
      this.startLevelKey = "level01";
      this.lastLoadedLevel = null;
      this.levelOrder = Object.keys(this.levels);
    }

    getStartLevel(){
      return this.levels[this.startLevelKey] || null;
    }

    remember(levelObj){
      this.lastLoadedLevel = levelObj || null;
    }

    getNextLevel(){
      if (!this.levelOrder.length) return null;

      const current = this.lastLoadedLevel;
      let currentIdx = -1;

      if (current){
        for (let i = 0; i < this.levelOrder.length; i++){
          const key = this.levelOrder[i];
          if (this.levels[key] === current){
            currentIdx = i;
            break;
          }
        }
      }

      if (currentIdx < 0){
        const start = this.getStartLevel();
        return start || this.levels[this.levelOrder[0]] || null;
      }

      const nextIdx = (currentIdx + 1) % this.levelOrder.length;
      return this.levels[this.levelOrder[nextIdx]] || null;
    }
  }

  const levelManager = new LevelManager((Lumo && Lumo.Levels) ? Lumo.Levels : {});

  // Gamla HUD-element i HTML (högerpanel) - vi gömmer dem men uppdaterar fortfarande text
  const hudLives = document.getElementById("hudLives");
  const hudEnergy = document.getElementById("hudEnergy");
  const hudLight = document.getElementById("hudLight");
  const hudCP = document.getElementById("hudCP");
  const hudDebug = document.getElementById("hudDebug");

  let checkpoint = null; // derived from player.checkpoint
  let _cpKey = "";

  const hudAside = document.querySelector("aside.hud");
  if (hudAside) hudAside.style.display = "none";

  let paused = false;
  let bootActive = false;
  let intermissionReadyForInput = false;
  let gameOverReadyForInput = false;
  let gameState = GameState.BOOTING;
  const BOOT_MS = 5000;
// HUD-state för canvasoverlay
  const hudCanvas = {
    energyPct: 100,
    lives: 4,
    livesMax: 4,
    flares: 1,
    flareFlash: 0,
    score: 0,

    _pauseBtn: null,
    popups: [],

    checkpointLit: false,
    checkpointRingT: 0,   // 0..1

    _barGeom: null,

    _prevPulseActive: false,
    _prevFlares: 1,
    _boostAcc: 0
  };

  const intermissionImage = new Image();
  intermissionImage.src = "data/assets/ui/intermission_level_complete.png";

  const gameOverImage = new Image();
  gameOverImage.src = "data/assets/ui/gameover.png";

  const menuBackgroundImage = new Image();
  menuBackgroundImage.src = "data/assets/ui/menu_background.png";

  const menuItems = ["Begin Quest", "Settings", "Score Board", "Credits", "Fan Art"];
  const menuUi = {
    beginQuestBounds: null
  };

  function startMenuQuest(){
    const lvl = levelManager.getStartLevel();
    if (!lvl){
      hudDebug.textContent = "Menu start failed: level01 not found";
      return;
    }

    loadLevel(lvl);
    paused = false;
    gameState = GameState.PLAYING;
    hudDebug.textContent = "Begin Quest -> level01";
  }

  function startNextQuest(){
    const nextLevel = levelManager.getNextLevel();
    if (!nextLevel){
      hudDebug.textContent = "Next level not found";
      return;
    }

    loadLevel(nextLevel);
    paused = false;
    intermissionReadyForInput = false;
    gameState = GameState.PLAYING;
  }

  function completeLevel(){
    hudDebug.textContent = "Level complete";
    intermissionReadyForInput = true;
    gameState = GameState.INTERMISSION;
  }

  function returnToStartAfterGameOver(){
    restart();
    paused = false;
    gameOverReadyForInput = false;
    hudDebug.textContent = "Game Over -> restarted at start level";
  }

  // Klick på canvas = toggle pause / klicka på paus-knappen
  canvas.addEventListener("mousedown", (e) => {
    if (bootActive) return;
    if (gameState === GameState.MENU){
      const b = menuUi.beginQuestBounds;
      if (!b) return;

      const rect = canvas.getBoundingClientRect();
      const sx = r.w / rect.width;
      const sy = r.h / rect.height;
      const mx = (e.clientX - rect.left) * sx;
      const my = (e.clientY - rect.top) * sy;

      if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h){
        startMenuQuest();
      }
      return;
    }
    if (paused){
      paused = false;
      gameState = GameState.PLAYING;
      return;
    }
const b = hudCanvas._pauseBtn;
    if (!b) return;

    const rect = canvas.getBoundingClientRect();
    const sx = r.w / rect.width;
    const sy = r.h / rect.height;
    const mx = (e.clientX - rect.left) * sx;
    const my = (e.clientY - rect.top) * sy;

    if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h){
      paused = true;
      gameState = GameState.PAUSED;
    }
  });

  // P = pause/resume
  window.addEventListener("keydown", (e) => {
    if (gameState === GameState.MENU){
      if (e.repeat) return;
      if (e.key === "Enter" || e.key === " "){
        startMenuQuest();
        e.preventDefault();
      }
      return;
    }

    if (gameState === GameState.GAME_OVER){
      if (e.repeat) return;
      if (gameOverReadyForInput) returnToStartAfterGameOver();
      e.preventDefault();
      return;
    }

    if (gameState === GameState.INTERMISSION){
      if (e.repeat) return;
      if (intermissionReadyForInput) startNextQuest();
      e.preventDefault();
      return;
    }

    if (e.repeat) return;
    if (e.key === "p" || e.key === "P"){
      paused = !paused;
      gameState = paused ? GameState.PAUSED : GameState.PLAYING;
      e.preventDefault();
    }
  });

  Lumo.debug = { player, world, ents, hudCanvas, levelManager, GameState };

  function syncGameState(){
    const prevState = gameState;

    if (bootActive){
      gameState = GameState.BOOTING;
      return;
    }
    if (gameState === GameState.INTERMISSION){
      return;
    }
    if (paused){
      gameState = GameState.PAUSED;
      return;
    }
    if (gameState === GameState.MENU){
      return;
    }
    if (player.lives <= 0){
      gameState = GameState.GAME_OVER;
      gameOverReadyForInput = true;
      if (prevState !== GameState.GAME_OVER){
        hudDebug.textContent = "Game Over";
      }
      return;
    }
    gameState = GameState.PLAYING;
    gameOverReadyForInput = false;
  }

  function drawTrackedText(ctx, text, x, y, spacing){
    const glyphWidths = Array.from(text, (ch) => ctx.measureText(ch).width);
    const totalSpacing = Math.max(0, text.length - 1) * spacing;
    const totalWidth = glyphWidths.reduce((sum, w) => sum + w, 0) + totalSpacing;
    let cursor = x - totalWidth * 0.5 + (glyphWidths[0] || 0) * 0.5;
    for (let i = 0; i < text.length; i++){
      const ch = text[i];
      ctx.fillText(ch, cursor, y);
      cursor += glyphWidths[i] * 0.5 + spacing + (glyphWidths[i + 1] || 0) * 0.5;
    }
  }

  function strokeTrackedText(ctx, text, x, y, spacing){
    const glyphWidths = Array.from(text, (ch) => ctx.measureText(ch).width);
    const totalSpacing = Math.max(0, text.length - 1) * spacing;
    const totalWidth = glyphWidths.reduce((sum, w) => sum + w, 0) + totalSpacing;
    let cursor = x - totalWidth * 0.5 + (glyphWidths[0] || 0) * 0.5;
    for (let i = 0; i < text.length; i++){
      const ch = text[i];
      ctx.strokeText(ch, cursor, y);
      cursor += glyphWidths[i] * 0.5 + spacing + (glyphWidths[i + 1] || 0) * 0.5;
    }
  }

  function pushEnergyPopup(pctLoss){
    const geom = hudCanvas._barGeom;
    const xBase = geom ? (geom.x + geom.w + 12) : (r.w * 0.06);
    const yBase = geom ? (geom.y + geom.h * 0.5) : (r.h * 0.5);

    const txt = `-${Math.max(1, Math.round(pctLoss))}%`;

    hudCanvas.popups.push({
      txt,
      x: xBase,
      y: yBase,
      vy: -52,
      t: 0.7,
      ttl: 0.7,
      a: 1
    });
  }

  function updateHudPopups(dt){
    if (!hudCanvas.popups.length) return;
    const out = [];
    for (const p of hudCanvas.popups){
      p.t -= dt;
      if (p.t <= 0) continue;
      p.y += p.vy * dt;
      p.a = Math.max(0, p.t / p.ttl);
      out.push(p);
    }
    hudCanvas.popups = out;
  }

  function setCheckpoint(px, py){
    // Source of truth: player.checkpoint (tile-based)
    if (typeof player.setCheckpoint === "function"){
      player.setCheckpoint(px, py);
    }

    // sync to local + HUD
    const ts = (world && world.tileSize) ? world.tileSize : (Lumo.TILE || 24);
    const tx = Math.max(0, Math.floor(px / ts));
    const ty = Math.max(0, Math.floor(py / ts));
    checkpoint = { tx, ty, x: tx*ts, y: ty*ts };

    hudCP.textContent = `${tx}, ${ty}`;

    hudCanvas.checkpointLit = true;
    hudCanvas.checkpointRingT = 1.0;   // start full, decay mot 0
  }


  function syncCheckpointFromPlayer(){
    const cp = player.checkpoint;
    if (!cp) return;

    const key = `${cp.tx},${cp.ty}`;
    if (key === _cpKey && !player._checkpointChanged) return;

    _cpKey = key;
    player._checkpointChanged = false;

    checkpoint = { tx: cp.tx, ty: cp.ty, x: cp.px, y: cp.py };

    hudCP.textContent = `${cp.tx}, ${cp.ty}`;

    hudCanvas.checkpointLit = true;
    hudCanvas.checkpointRingT = 1.0;
    if (hudDebug) hudDebug.textContent = `Checkpoint set`;
  }

  // ✅ CHANGED: spawn fallback från editor-format (start_01 i layers.ents)
  function loadLevel(levelObj){
    if (!levelObj){
      console.error("loadLevel: levelObj is falsy");
      return;
    }

    world.loadLevel(levelObj);
    ents.loadFromLevel(levelObj);
    levelManager.remember(levelObj);

    // tileSize
    const ts = (levelObj.meta && levelObj.meta.tileSize) ? levelObj.meta.tileSize
      : (world && world.tileSize) ? world.tileSize
      : (Lumo.TILE || 24);

    // spawn primary
    let spawnDef = levelObj.spawn || (levelObj.meta && levelObj.meta.spawn) || null;

    // spawn fallback: editor mandatory "start_01"
    if (!spawnDef && levelObj.layers && Array.isArray(levelObj.layers.ents)){
      const start = levelObj.layers.ents.find(e => e && e.id === "start_01");
      if (start){
        spawnDef = { x: start.x|0, y: start.y|0 };
      }
    }

    // last fallback
    if (!spawnDef) spawnDef = { x:0, y:0 };

    const sx = (typeof spawnDef.x === "number") ? spawnDef.x * ts : 0;
    const sy = (typeof spawnDef.y === "number") ? spawnDef.y * ts : 0;

    player.setSpawn(sx, sy);
    player.refill();

    setCheckpoint(sx, sy);

    const metaId = (levelObj.meta && levelObj.meta.id) ? levelObj.meta.id : "(no-id)";
    const metaName = (levelObj.meta && levelObj.meta.name) ? levelObj.meta.name : "";
    hudDebug.textContent = `Loaded: ${metaId} ${metaName}`;
  }

  function restart(){
    player.lives = 4;
    player.flares = 1;

    const lvl = levelManager.getStartLevel();
    if (!lvl){
      hudDebug.textContent = "Restart failed: level01 not found";
      console.error("restart: Lumo.Levels.level01 missing");
      return;
    }

    hudCanvas.popups = [];
    hudCanvas._prevPulseActive = false;
    hudCanvas._prevFlares = player.flares|0;
    hudCanvas._boostAcc = 0;
    hudCanvas.flareFlash = 0;
    hudCanvas.checkpointLit = false;
    hudCanvas.checkpointRingT = 0;
    gameOverReadyForInput = false;

    loadLevel(lvl);
    gameState = GameState.PLAYING;
  }

  function resize(){
    const changed = r.resizeToDisplaySize();
    if (changed) cam.resize(r.w, r.h);
  }

  function updateHUD(dt){
    // gamla DOM-fält
    hudLives.textContent = player.lives;
    hudEnergy.textContent = `${Math.round(player.energy * 100)}%`;
    hudLight.textContent = `${Math.round(player.lightRadius)} px`;

    // canvas-HUD
    hudCanvas.lives = player.lives;
    hudCanvas.livesMax = 4;
    hudCanvas.energyPct = Math.round(player.energy * 100);
    hudCanvas.flares = player.flares|0;

    hudCanvas.flareFlash = Math.max(0, hudCanvas.flareFlash - dt);

    // checkpoint-ring: 1 → 0 med ca 0.65 s duration
    if (hudCanvas.checkpointRingT > 0){
      const speed = 1 / 0.65;
      hudCanvas.checkpointRingT = Math.max(0, hudCanvas.checkpointRingT - speed * dt);
    }
  }

  function handleInteractions(){
    for (const e of ents.items){
      if (!e.active) continue;

      if (Lumo.U.aabb(player.x, player.y, player.w, player.h, e.x, e.y, e.w, e.h)){
        if (e.type === "powerCell"){
          e.active = false;
          player.refill();
          hudDebug.textContent = `Power-cell collected → light max`;
        }

        if (e.type === "flarePickup" || e.type === "flairPickup"){
          e.active = false;
          const n = (typeof e.amount === "number" ? e.amount : 1) | 0;
          if (typeof player.addFlares === "function") player.addFlares(Math.max(1, n));
          hudDebug.textContent = `Flare collected`;
        }

        if (e.type === "checkpoint"){
          setCheckpoint(e.x, e.y);
          hudDebug.textContent = `Checkpoint set`;
        }

        if (e.type === "exit"){
          e.active = false;
          completeLevel();
        }
      }
    }

    if ((player.invuln || 0) <= 0 && !(player.isRespawning && player.isRespawning())){
      const tiles = world.queryTiles(player.x, player.y, player.w, player.h);
      for (const t of tiles){
        if (t.def.hazard){
          if (checkpoint){
            player.beginRespawn();
            hudDebug.textContent = `Ouch → respawn`;
          }
          break;
        }
      }
    }

    if ((player.invuln || 0) <= 0 && !(player.isRespawning && player.isRespawning())){
      for (const e of ents.items){
        if (!e.active) continue;
        if (!(e.type === "enemy" || e.type === "patrolEnemy")) continue;

        if (Lumo.U.aabb(player.x, player.y, player.w, player.h, e.x, e.y, e.w, e.h)){
          if (checkpoint){
            player.beginRespawn();
            hudDebug.textContent = `Enemy hit → respawn`;
          }
          break;
        }
      }
    }

    if (player.y > (world.pxH || 0) + 200){
      if (checkpoint){
        player.beginRespawn();
        hudDebug.textContent = `Fell → respawn`;
      }
    }

    if (player.lives <= 0){
      hudDebug.textContent = `Game Over → press Restart`;
      gameState = GameState.GAME_OVER;
    }
  }

  function detectHudEvents(dt){
    // Pulse-start
    const pulseNow = !!(player.pulse && player.pulse.active);
    if (pulseNow && !hudCanvas._prevPulseActive){
      pushEnergyPopup(8);
    }
    hudCanvas._prevPulseActive = pulseNow;

    // Flare-minskning/ökning
    const fNow = player.flares|0;
    if (fNow < (hudCanvas._prevFlares|0)){
      const c = (typeof player.flareEnergyCost === "number") ? player.flareEnergyCost : 0.11;
      pushEnergyPopup(c * 100);
      hudCanvas.flareFlash = 0.25;
    } else if (fNow > (hudCanvas._prevFlares|0)){
      hudCanvas.flareFlash = 0.25;
    }
    hudCanvas._prevFlares = fNow;

    // Boost-drain (chunkad)
    if (player.boosting){
      const perSec = (typeof player.drainBoostPerSec === "number") ? player.drainBoostPerSec : 0.18;
      hudCanvas._boostAcc += perSec * dt;

      while (hudCanvas._boostAcc >= 0.05){
        pushEnergyPopup(5);
        hudCanvas._boostAcc -= 0.05;
      }
    } else {
      hudCanvas._boostAcc = Math.max(0, hudCanvas._boostAcc - 0.12 * dt);
    }
  }

  // ✅ CHANGED: ents.getLights(cam) och INGEN extra cam-subtraktion
  function draw(){
    r.clear();
    const ctx = r.ctx;

    // WORLD_CLIP_BEGIN: prevent drawing outside level bounds (eg BG stamps below grid)
    const worldHpx = (world.h || 30) * (world.tileSize || 24);
    const worldTop = Math.round(-cam.y); // screen-space Y where world y=0 begins (handles letterboxing)
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, worldTop, r.w, worldHpx);
    ctx.clip();
    world.draw(ctx, cam);
    ents.draw(ctx, cam);
    player.draw(ctx, cam);
    ctx.restore();
    // WORLD_CLIP_END

    const lights = [];

    // player light (screen-space)
    // kind/energy används bara för visuella FX (ingen gameplay-logik i renderer)
    lights.push({
      kind: "player",
      x: (player.x + player.w/2) - cam.x,
      y: (player.y + 10) - cam.y,
      r: player.lightRadius,
      strength: 0.6,
      energy: (typeof player.energy === "number") ? player.energy : 1
    });

    // world static lights are world-space -> convert here
    for (const L of (world.staticLights || [])){
      lights.push({ kind: "static", x: L.x - cam.x, y: L.y - cam.y, r: L.r, strength: L.strength });
    }

    // entities lights: our new entities.js returns screen-space when given cam
    const entLights = (typeof ents.getLights === "function") ? ents.getLights(cam) : [];
    for (const L of (entLights || [])){
      // Already screen-space
      lights.push({ kind: L.kind, x: L.x, y: L.y, r: L.r, strength: L.strength, _seed: L._seed });
    }

    const cx = (player.x + player.w/2) - cam.x;
    const cy = (player.y + 10) - cam.y;
    r.drawPulse(cx, cy, player.pulse);

    // Light occlusion wiring (visual only)


    if (r && typeof r.setOcclusionContext === "function") r.setOcclusionContext(world, cam);


    // Fog/volumes: in front of world/entities, but BEHIND darkness (revealed by punch-out)



    if (ents && typeof ents.drawOverDarkness === "function") ents.drawOverDarkness(ctx, cam);




    r.drawDarkness(lights);

    if (gameState === GameState.MENU){
      const img = menuBackgroundImage;
      if (img && img.complete && img.naturalWidth > 0){
        ctx.drawImage(img, 0, 0, r.w, r.h);
      } else {
        ctx.fillStyle = "#03131A";
        ctx.fillRect(0, 0, r.w, r.h);
      }

      ctx.save();

      const panelX = r.w * 0.235;
      const panelY = r.h * 0.485;
      const tilt = -0.065;
      const lineH = Math.max(26, r.h * 0.048);

      ctx.translate(panelX, panelY);
      ctx.rotate(tilt);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `${Math.max(20, Math.round(r.h * 0.042))}px "Orbitron","Eurostile","Trebuchet MS",sans-serif`;

      for (let i = 0; i < menuItems.length; i++){
        const isActive = i === 0;
        const y = (i - (menuItems.length - 1) * 0.5) * lineH;
        const label = menuItems[i];

        ctx.shadowColor = isActive ? "rgba(88,255,255,0.55)" : "rgba(70,220,240,0.35)";
        ctx.shadowBlur = isActive ? 10 : 6;
        ctx.lineWidth = 4;
        ctx.strokeStyle = "rgba(0,32,38,0.62)";
        ctx.strokeText(label, 0, y);
        ctx.fillStyle = isActive ? "#BFFFFF" : "#87EAF6";
        ctx.fillText(label, 0, y);

        if (isActive){
          const metrics = ctx.measureText(label);
          const textW = metrics.width;
          const textH = lineH * 0.72;
          const c = Math.cos(tilt);
          const s = Math.sin(tilt);
          const cx = panelX + (0 * c - y * s);
          const cy = panelY + (0 * s + y * c);
          menuUi.beginQuestBounds = {
            x: cx - textW * 0.5,
            y: cy - textH * 0.5,
            w: textW,
            h: textH
          };
        }
      }
      ctx.restore();
    } else if (gameState === GameState.GAME_OVER){
      const img = gameOverImage;
      if (img && img.complete && img.naturalWidth > 0){
        const scale = Math.min(r.w / img.naturalWidth, r.h / img.naturalHeight);
        const drawW = img.naturalWidth * scale;
        const drawH = img.naturalHeight * scale;
        const drawX = (r.w - drawW) * 0.5;
        const drawY = (r.h - drawH) * 0.5;
        ctx.drawImage(img, drawX, drawY, drawW, drawH);
      } else {
        ctx.fillStyle = "#080A13";
        ctx.fillRect(0, 0, r.w, r.h);
      }

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      ctx.font = '24px "Trebuchet MS",Arial,sans-serif';
      ctx.lineWidth = 7;
      ctx.strokeStyle = "rgba(0,0,0,0.7)";
      ctx.strokeText("Press any key to return to main menu", r.w * 0.5, r.h * 0.9);
      ctx.fillStyle = "#F4E8C7";
      ctx.fillText("Press any key to return to main menu", r.w * 0.5, r.h * 0.9);

      ctx.restore();
    } else if (paused && !bootActive){
      r.drawPauseOverlay();
    } else if (gameState === GameState.INTERMISSION){
      const img = intermissionImage;
      if (img && img.complete && img.naturalWidth > 0){
        ctx.drawImage(img, 0, 0, r.w, r.h);
      } else {
        ctx.fillStyle = "#0E1530";
        ctx.fillRect(0, 0, r.w, r.h);
      }

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Keep text inside the board area and match existing retro UI style.
      const titleX = ctx.canvas.width / 2;
      const titleY = r.h * 0.255;
      const promptX = r.w * 0.5;
      const promptY = r.h * 0.76;
      const titleText = "LEVEL COMPLETE";
      const titleSpacing = Math.max(1.2, r.w * 0.0018);

      // Main title
      ctx.textAlign = "center";
      ctx.font = '34px "Trebuchet MS","Arial Black",sans-serif';
      ctx.lineJoin = "round";
      ctx.miterLimit = 2;
      ctx.lineWidth = 10;
      ctx.strokeStyle = "rgba(0,0,0,0.5)";
      strokeTrackedText(ctx, titleText, titleX, titleY + 2, titleSpacing);

      ctx.lineWidth = 5;
      ctx.strokeStyle = "rgba(69,27,8,0.95)";
      strokeTrackedText(ctx, titleText, titleX, titleY, titleSpacing);

      const titleGrad = ctx.createLinearGradient(0, titleY - 22, 0, titleY + 16);
      titleGrad.addColorStop(0.0, "#FFE3A4");
      titleGrad.addColorStop(0.5, "#F8C96A");
      titleGrad.addColorStop(1.0, "#CB7A2A");
      ctx.fillStyle = titleGrad;
      drawTrackedText(ctx, titleText, titleX, titleY, titleSpacing);

      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(255,237,176,0.58)";
      strokeTrackedText(ctx, titleText, titleX, titleY - 1, titleSpacing);

      // Prompt text
      ctx.textAlign = "center";
      ctx.font = '30px "Cooper Black","Arial Black",Impact,sans-serif';
      ctx.lineWidth = 9;
      ctx.strokeStyle = "rgba(0,0,0,0.7)";
      ctx.strokeText("Press any key to start next quest", promptX, promptY);
      ctx.fillStyle = "#F5E8C6";
      ctx.fillText("Press any key to start next quest", promptX, promptY);
      ctx.restore();
    } else {
      r.drawHUD(hudCanvas);
    }

    // Respawn overlay (CANON)
    if (gameState !== GameState.GAME_OVER && player.lives > 0 && player.isRespawning && player.isRespawning()){
      const ctx = r.ctx;
      const n = (typeof player.getRespawnCount === "function") ? player.getRespawnCount() : 0;

      ctx.save();
      ctx.setTransform(1,0,0,1,0,0);
      ctx.globalCompositeOperation = "source-over";

      // subtle dark veil
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(0,0,r.w,r.h);

      const cx = r.w * 0.5;
      const cy = r.h * 0.45;

      // Layout: [ RESPAWN ]  [ N ]
      const gap = 60;

      // Word
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.font = '78px "Cooper Black","Arial Black",Impact,sans-serif';

      // gold gradient fill
      const gWord = ctx.createLinearGradient(0, cy-60, 0, cy+60);
      gWord.addColorStop(0.00, "#FFF3B0");
      gWord.addColorStop(0.45, "#FFD44D");
      gWord.addColorStop(1.00, "#FF8A00");
      ctx.fillStyle = gWord;

      // blue outline + dark outer stroke
      ctx.lineJoin = "round";
      ctx.miterLimit = 2;
      ctx.lineWidth = 22;
      ctx.strokeStyle = "rgba(0,0,0,0.55)";
      ctx.strokeText("RESPAWN", cx - gap*0.5, cy);
      ctx.lineWidth = 14;
      ctx.strokeStyle = "rgba(40,90,170,0.95)";
      ctx.strokeText("RESPAWN", cx - gap*0.5, cy);
      ctx.fillText("RESPAWN", cx - gap*0.5, cy);

      // Number (beside the word)
      ctx.textAlign = "left";
      ctx.font = '86px "Cooper Black","Arial Black",Impact,sans-serif';

      const gNum = ctx.createLinearGradient(0, cy-70, 0, cy+70);
      gNum.addColorStop(0.00, "#111");
      gNum.addColorStop(0.55, "#B10014");
      gNum.addColorStop(1.00, "#FF2B2B");
      ctx.fillStyle = gNum;

      ctx.lineWidth = 16;
      ctx.strokeStyle = "rgba(0,0,0,0.70)";
      ctx.strokeText(String(n||0), cx + gap*0.5, cy);
      ctx.lineWidth = 8;
      ctx.strokeStyle = "rgba(255,210,120,0.95)";
      ctx.strokeText(String(n||0), cx + gap*0.5, cy);
      ctx.fillText(String(n||0), cx + gap*0.5, cy);

      ctx.restore();
    }
  }


  function tick(){
    resize();
    const dt = Lumo.Time.tick();
    syncGameState();

    if (!paused && gameState === GameState.PLAYING){
      if (player.lives > 0){
        player.update(dt, world);

        const req = (typeof player.popThrowFlareRequest === "function")
          ? player.popThrowFlareRequest()
          : null;

        if (req){
          if (typeof ents.spawnFlare === "function"){
            ents.spawnFlare(req.x, req.y, req.vx, req.vy);
          } else if (typeof ents.spawnThrownFlare === "function"){
            ents.spawnThrownFlare(req.x, req.y);
          }
        }

        ents.update(dt, world, player);

        // checkpoint activation comes from Entities.update → player.setCheckpoint()
        syncCheckpointFromPlayer();

        // if we just respawned, snap camera immediately (CANON)
        if (player._justRespawned){
          player._justRespawned = false;
          if (typeof cam.snapTo === "function"){
            cam.snapTo(player, world.pxW, world.pxH);
          } else {
            cam.follow(player, world.pxW, world.pxH);
          }
        } else {
          cam.follow(player, world.pxW, world.pxH);
        }

        handleInteractions();
      }

      detectHudEvents(dt);
      updateHudPopups(dt);
    }

    updateHUD(dt);

    draw();
    requestAnimationFrame(tick);
  }

  function wireImport(){
    const fileInput = document.getElementById("fileLevel");
    fileInput.addEventListener("change", async () => {
      const f = fileInput.files && fileInput.files[0];
      if (!f) return;

      try{
        const txt = await f.text();
        let obj = null;

        // 1) Prefer JSON (runtime-native)
        try{
          obj = JSON.parse(txt);
        }catch(_){
          obj = null;
        }

        // 2) Fallback: Editor-exported .js (IIFE that sets window.Lumo.Levels[...])
        if (!obj){
          window.Lumo = window.Lumo || {};
          const prevLevels = window.Lumo.Levels;
          window.Lumo.Levels = {};

          try{
            // file:// local import; we intentionally support this for parity with LumoEditor export
            // eslint-disable-next-line no-eval
            eval(txt);

            const keys = Object.keys(window.Lumo.Levels || {});
            if (!keys.length) throw new Error("No Lumo.Levels[...] found in .js");
            obj = window.Lumo.Levels[keys[0]];
          } finally {
            // Restore previous Levels to avoid polluting runtime state
            window.Lumo.Levels = prevLevels;
          }
        }

        if (!obj || !obj.meta || !obj.layers || !obj.layers.main){
          throw new Error("Import saknar meta/layers.main");
        }

        obj.meta.tileSize = obj.meta.tileSize || 24;
        loadLevel(obj);
        syncGameState();

      } catch (err){
        hudDebug.textContent = `Import failed: ${err.message}`;
      } finally {
        fileInput.value = "";
      }
    });

    const btn = document.getElementById("btnRestart");
    if (btn) btn.addEventListener("click", restart);
    else console.warn("wireImport: btnRestart not found in DOM");
  }


  function bootStart(){
    const overlay = document.getElementById("bootOverlay");
    if (!overlay) return;

    bootActive = true;
    paused = true;
    gameState = GameState.BOOTING;

    overlay.classList.add("is-on");
    overlay.setAttribute("aria-hidden", "false");

    const bar = document.getElementById("bootBar");
    if (bar && !bar._built){
      bar._built = true;
      // match CSS language: segmented ticks
      const SEGMENTS = 12;
      bar.innerHTML = '<div class="bootBarInner"></div>';
      const inner = bar.firstElementChild;
      for (let i = 0; i < SEGMENTS; i++){
        const seg = document.createElement("div");
        seg.className = "bootSeg";
        inner.appendChild(seg);
      }
    }

    const segs = bar ? Array.from(bar.querySelectorAll(".bootSeg")) : [];
    const stepMs = BOOT_MS / Math.max(1, segs.length);
    let i = 0;

    const iv = setInterval(() => {
      if (segs[i]) segs[i].classList.add("is-on");
      i++;
      if (i >= segs.length){
        clearInterval(iv);
        setTimeout(() => {
          overlay.classList.remove("is-on");
          overlay.setAttribute("aria-hidden", "true");
          bootActive = false;
          paused = true;
          gameState = GameState.MENU;
        }, 250);
      }
    }, stepMs);
  }

  // Boot
  Lumo.Input.init();
  Lumo.Time.start();
  wireImport();
  restart();
  bootStart();
  requestAnimationFrame(tick);
})();
