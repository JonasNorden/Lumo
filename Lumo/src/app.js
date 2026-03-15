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
    SETTINGS: "settings",
    FAN_ART: "fan_art",
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

  const menuLumoSpriteImage = new Image();
  menuLumoSpriteImage.src = "data/assets/ui/lumo_sprite.png";

  const noSavePreviewImage = new Image();
  noSavePreviewImage.src = "data/assets/ui/no_save_preview.png";

  function loadGlobalAudioConfig(){
    const fallback = {
      musicByState: {
        [GameState.MENU]: "data/assets/audio/music/menu_music.mp3",
        [GameState.SETTINGS]: "data/assets/audio/music/menu_music.mp3",
        [GameState.FAN_ART]: "data/assets/audio/music/menu_music.mp3",
        [GameState.PLAYING]: null,
        [GameState.PAUSED]: null,
        [GameState.GAME_OVER]: null,
        [GameState.INTERMISSION]: null
      },
      behavior: {
        loopDefault: true,
        autoplayUnlockRequiredForMenu: true
      }
    };

    const cfg = window.LUMO_AUDIO_GLOBAL_CONFIG || {};
    const musicByStateSrc = (cfg.musicByState && typeof cfg.musicByState === "object") ? cfg.musicByState : {};
    const behaviorSrc = (cfg.behavior && typeof cfg.behavior === "object") ? cfg.behavior : {};
    const musicByState = {};

    for (const state of Object.values(GameState)){
      const hasConfiguredValue = Object.prototype.hasOwnProperty.call(musicByStateSrc, state);
      const rawValue = hasConfiguredValue ? musicByStateSrc[state] : fallback.musicByState[state];
      musicByState[state] = (typeof rawValue === "string" && rawValue) ? rawValue : null;
    }

    return {
      musicByState,
      behavior: {
        loopDefault: typeof behaviorSrc.loopDefault === "boolean" ? behaviorSrc.loopDefault : fallback.behavior.loopDefault,
        autoplayUnlockRequiredForMenu: typeof behaviorSrc.autoplayUnlockRequiredForMenu === "boolean"
          ? behaviorSrc.autoplayUnlockRequiredForMenu
          : fallback.behavior.autoplayUnlockRequiredForMenu
      }
    };
  }

  function createGlobalMusicState(config){
    const tracksByPath = new Map();
    const byState = {};

    for (const state of Object.values(GameState)){
      const path = config.musicByState[state];
      if (!path){
        byState[state] = null;
        continue;
      }

      let track = tracksByPath.get(path);
      if (!track){
        track = new Audio(path);
        track.loop = config.behavior.loopDefault;
        tracksByPath.set(path, track);
      }
      byState[state] = track;
    }

    const menuTrack = byState[GameState.MENU] || null;
    return {
      byState,
      tracks: Array.from(tracksByPath.values()),
      menu: menuTrack,
      current: null,
      requireMenuUnlock: Boolean(config.behavior.autoplayUnlockRequiredForMenu && menuTrack)
    };
  }

  const audioGlobalConfig = loadGlobalAudioConfig();
  const music = createGlobalMusicState(audioGlobalConfig);
  const SETTINGS_STORAGE_KEY = "lumo.settings.audio.v1";
  const SAVE_STORAGE_KEY = "lumo.save.slot1.v1";
  const defaultAudioSettings = Object.freeze({
    musicVolume: 0.42,
    sfxVolume: 0.6
  });
  const audioSettings = loadAudioSettings();
  Lumo.getAudioSettings = () => ({
    musicVolume: audioSettings.musicVolume,
    sfxVolume: audioSettings.sfxVolume
  });
  const settingsItems = ["Music Volume", "SFX Volume", "Back"];
  const settingsUi = {
    selectedIndex: 0,
    rowBounds: [],
    sliderBounds: []
  };
  let sfxCtx = null;
  let menuMusicUnlocked = !music.requireMenuUnlock;
  applyMusicVolume(audioSettings.musicVolume);

  let sessionStartedAtMs = Date.now();
  let saveSlot = loadSaveSlot();
  let pendingNewQuestConfirm = false;
  let suppressPauseOverlayForSnapshot = false;
  let saveSnapshotImage = null;
  let saveSnapshotSrc = "";
  let saveSnapshotStatus = "idle";
  let lastPreviewImageSourceLogged = "";
  const previewFallbackPlaceholder = new Image();
  previewFallbackPlaceholder.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="236" height="130" viewBox="0 0 236 130">'
    + '<rect width="236" height="130" fill="#102633"/>'
    + '<rect x="8" y="8" width="220" height="114" fill="#173646" stroke="#4fa8c2" stroke-width="1" stroke-dasharray="4 4"/>'
    + '<text x="118" y="74" font-family="Trebuchet MS, sans-serif" font-size="14" fill="#b6dbe6" text-anchor="middle">NO SAVE PREVIEW</text>'
    + '</svg>'
  );

  const menuItemsBase = ["Begin Quest", "Settings", "Fan Art"];
  const menuUi = {
    beginQuestBounds: null,
    itemBounds: [],
    selectedIndex: 0,
    creditsBounds: null,
    confirmBounds: [],
    panelMode: "menu",
    creditsBackBounds: null
  };
  const fanArtUi = {
    images: [],
    selectedIndex: 0,
    isLoading: false,
    loaded: false
  };
  const menuAmbientGlows = [
    { x: 0.135, y: 0.238, r: 0.025, amp: 0.48, speed: 0.52, phase: 0.3 },
    { x: 0.214, y: 0.322, r: 0.021, amp: 0.44, speed: 0.48, phase: 1.1 },
    { x: 0.296, y: 0.185, r: 0.024, amp: 0.47, speed: 0.40, phase: 2.5 },
    { x: 0.388, y: 0.266, r: 0.020, amp: 0.42, speed: 0.58, phase: 3.4 },
    { x: 0.462, y: 0.198, r: 0.019, amp: 0.40, speed: 0.46, phase: 4.8 },
    { x: 0.614, y: 0.232, r: 0.023, amp: 0.46, speed: 0.49, phase: 4.2 },
    { x: 0.698, y: 0.338, r: 0.020, amp: 0.42, speed: 0.44, phase: 5.0 },
    { x: 0.776, y: 0.512, r: 0.025, amp: 0.48, speed: 0.39, phase: 5.8 },
    { x: 0.862, y: 0.392, r: 0.022, amp: 0.45, speed: 0.54, phase: 0.7 },
    { x: 0.915, y: 0.296, r: 0.019, amp: 0.40, speed: 0.47, phase: 1.9 },
    { x: 0.548, y: 0.436, r: 0.021, amp: 0.43, speed: 0.42, phase: 2.9 },
    { x: 0.332, y: 0.474, r: 0.020, amp: 0.42, speed: 0.45, phase: 3.8 },
    { x: 0.184, y: 0.436, r: 0.018, amp: 0.38, speed: 0.50, phase: 2.2 },
    { x: 0.427, y: 0.545, r: 0.017, amp: 0.36, speed: 0.61, phase: 1.4 },
    { x: 0.742, y: 0.214, r: 0.018, amp: 0.39, speed: 0.57, phase: 4.9 },
    { x: 0.848, y: 0.566, r: 0.017, amp: 0.37, speed: 0.43, phase: 5.4 }
  ];
  const menuPanelReferenceSize = {
    w: 1920,
    h: 1080
  };
  const savePreviewLayout = {
    normalizedX: 70 / menuPanelReferenceSize.w,
    normalizedY: -82 / menuPanelReferenceSize.h,
    normalizedW: 236 / menuPanelReferenceSize.w,
    normalizedH: 130 / menuPanelReferenceSize.h,
    rot: 0
  };

  function drawPreviewPanelSurface(ctx, opts){
    const {
      x,
      y,
      w,
      h,
      rotRad,
      bgDrawH,
      previewImage
    } = opts;

    const sideInset = 0;
    const topLeftLift = Math.max(3, Math.round(h * 0.045));
    const topRightDrop = Math.max(1, Math.round(h * 0.015));
    const insetPad = Math.max(8, Math.round(bgDrawH * 0.008));

    const buildSurfacePath = (targetCtx, pad = 0) => {
      const leftX = -w * 0.5 + sideInset + pad;
      const rightX = w * 0.5 - sideInset - pad;
      const topBaseY = -h * 0.5 + pad;
      const topLeftY = topBaseY - topLeftLift;
      const topRightY = topBaseY + topRightDrop;
      const bottomY = h * 0.5 - pad;

      targetCtx.beginPath();
      targetCtx.moveTo(leftX, topLeftY);
      targetCtx.lineTo(rightX, topRightY);
      targetCtx.lineTo(rightX, bottomY);
      targetCtx.lineTo(leftX, bottomY);
      targetCtx.closePath();
    };

    ctx.save();
    ctx.translate(x + w * 0.5, y + h * 0.5);
    ctx.rotate(rotRad);

    const snapBack = ctx.createLinearGradient(-w * 0.5, -h * 0.5, w * 0.5, h * 0.5);
    snapBack.addColorStop(0, "rgba(12,38,52,0.58)");
    snapBack.addColorStop(1, "rgba(8,24,35,0.68)");
    ctx.fillStyle = snapBack;
    buildSurfacePath(ctx);
    ctx.fill();

    if (previewImage && previewImage.complete && previewImage.naturalWidth > 0){
      const img = previewImage;
      const imgAspect = img.naturalWidth / Math.max(1, img.naturalHeight);
      const previewAspect = w / Math.max(1, h);
      let srcW = img.naturalWidth;
      let srcH = img.naturalHeight;
      let srcX = 0;
      let srcY = 0;

      if (imgAspect > previewAspect){
        srcW = img.naturalHeight * previewAspect;
        srcX = (img.naturalWidth - srcW) * 0.5;
      } else {
        srcH = img.naturalWidth / previewAspect;
        srcY = (img.naturalHeight - srcH) * 0.5;
      }

      ctx.save();
      buildSurfacePath(ctx);
      ctx.clip();
      ctx.drawImage(img, srcX, srcY, srcW, srcH, -w * 0.5, -h * 0.5, w, h);
      ctx.restore();
    }

    const edgeGlow = ctx.createLinearGradient(-w * 0.5, -h * 0.5, w * 0.5, h * 0.5);
    edgeGlow.addColorStop(0, "rgba(168,244,255,0.38)");
    edgeGlow.addColorStop(1, "rgba(124,208,231,0.22)");
    ctx.strokeStyle = edgeGlow;
    ctx.lineWidth = 1.2;
    buildSurfacePath(ctx);
    ctx.stroke();

    ctx.strokeStyle = "rgba(150,226,245,0.16)";
    ctx.lineWidth = 1;
    buildSurfacePath(ctx, insetPad);
    ctx.stroke();
    ctx.restore();
  }

  function getSavePreviewRect(panelInner){
    const previewX = panelInner.x + panelInner.w * savePreviewLayout.normalizedX;
    const previewY = panelInner.y + panelInner.h * savePreviewLayout.normalizedY;
    const previewW = panelInner.w * savePreviewLayout.normalizedW;
    const previewH = panelInner.h * savePreviewLayout.normalizedH;

    const previewAnchorBottom = previewY + previewH;
    const previewOffsetX = 50;
    const previewScale = 2;
    const adjustedPreviewW = previewW * previewScale;
    const adjustedPreviewH = previewH * previewScale;
    const adjustedPreviewX = previewX + previewOffsetX;
    const adjustedPreviewY = previewAnchorBottom - adjustedPreviewH;

    return {
      x: adjustedPreviewX,
      y: adjustedPreviewY,
      w: adjustedPreviewW,
      h: adjustedPreviewH,
      rotDeg: savePreviewLayout.rot,
      rotRad: savePreviewLayout.rot * Math.PI / 180
    };
  }

  function clamp01(v){
    return Math.max(0, Math.min(1, Number(v) || 0));
  }

  function loadAudioSettings(){
    try {
      const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (!raw) return { ...defaultAudioSettings };
      const parsed = JSON.parse(raw);
      return {
        musicVolume: clamp01(parsed.musicVolume),
        sfxVolume: clamp01(parsed.sfxVolume)
      };
    } catch (_err){
      return { ...defaultAudioSettings };
    }
  }

  function hasSaveSlot(){
    return !!(saveSlot && saveSlot.levelKey);
  }

  function getMenuItems(){
    return hasSaveSlot() ? ["Continue", ...menuItemsBase] : [...menuItemsBase];
  }

  function ensureMenuSelectionValid(){
    const items = getMenuItems();
    if (!items.length){
      menuUi.selectedIndex = 0;
      return;
    }
    if (menuUi.selectedIndex >= items.length) menuUi.selectedIndex = items.length - 1;
    if (menuUi.selectedIndex < 0) menuUi.selectedIndex = 0;
  }

  function formatSavedTimestamp(ts){
    if (!Number.isFinite(ts) || ts <= 0) return "Unknown";
    const d = new Date(ts);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function formatSessionDuration(seconds){
    const totalSec = Math.max(0, Math.floor(Number(seconds) || 0));
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    if (mins <= 0) return `${secs}s`;
    if (mins < 60) return `${mins} min`;
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs}h ${remMins}m`;
  }

  function currentLevelKey(){
    const cur = levelManager.lastLoadedLevel;
    if (!cur || !levelManager.levels) return null;
    for (const [key, obj] of Object.entries(levelManager.levels)){
      if (obj === cur) return key;
    }
    return null;
  }

  function currentLevelName(){
    const lvl = levelManager.lastLoadedLevel;
    return (lvl && lvl.meta && lvl.meta.name) ? lvl.meta.name : "Unknown level";
  }

  function normalizeSnapshotDataUrl(value){
    if (typeof value !== "string") return "";
    const url = value.trim();
    if (!url) return "";
    return url.startsWith("data:image/png;base64,") ? url : "";
  }

  function loadSaveSlot(){
    try {
      const raw = localStorage.getItem(SAVE_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || !parsed.levelKey) return null;
      parsed.snapshotDataUrl = normalizeSnapshotDataUrl(parsed.snapshotDataUrl);
      return parsed;
    } catch (_err){
      return null;
    }
  }

  function getSaveSnapshotImage(){
    if (!saveSlot || !saveSlot.snapshotDataUrl) return null;

    const source = normalizeSnapshotDataUrl(saveSlot.snapshotDataUrl);
    if (!source){
      saveSlot.snapshotDataUrl = "";
      saveSnapshotImage = null;
      saveSnapshotSrc = "";
      saveSnapshotStatus = "idle";
      return null;
    }

    if (saveSnapshotImage && saveSnapshotSrc === source){
      if (saveSnapshotStatus === "ready") return saveSnapshotImage;
      if (saveSnapshotStatus === "loading") return null;
      saveSnapshotImage = null;
      saveSnapshotSrc = "";
      saveSnapshotStatus = "idle";
    }

    const img = new Image();
    saveSnapshotSrc = source;
    saveSnapshotImage = img;
    saveSnapshotStatus = "loading";
    img.onload = () => {
      if (saveSnapshotImage === img && saveSnapshotSrc === source){
        saveSnapshotStatus = "ready";
        console.log("[PREVIEW IMAGE] snapshot load ready");
      }
    };
    img.onerror = () => {
      if (saveSnapshotImage === img && saveSnapshotSrc === source){
        saveSnapshotStatus = "error";
        console.log("[PREVIEW IMAGE] snapshot load error");
      }
    };
    img.src = source;
    return null;
  }

  function getFallbackPreviewImage(){
    if (noSavePreviewImage.complete && noSavePreviewImage.naturalWidth > 0) return noSavePreviewImage;
    if (previewFallbackPlaceholder.complete && previewFallbackPlaceholder.naturalWidth > 0) return previewFallbackPlaceholder;
    return null;
  }

  function resolvePreviewImageForMenu(){
    const hasSnapshotData = !!(saveSlot && saveSlot.snapshotDataUrl);
    const snapshotImg = hasSnapshotData ? getSaveSnapshotImage() : null;

    if (snapshotImg && snapshotImg.complete && snapshotImg.naturalWidth > 0){
      return {
        image: snapshotImg,
        source: "snapshot"
      };
    }

    return {
      image: getFallbackPreviewImage(),
      source: "fallback"
    };
  }

  function logPreviewImageSource(source){
    if (lastPreviewImageSourceLogged === source) return;
    lastPreviewImageSourceLogged = source;
    const hasSnapshotData = !!(saveSlot && saveSlot.snapshotDataUrl);
    console.log(`[PREVIEW IMAGE] using ${source} (hasSnapshotDataUrl=${hasSnapshotData}, snapshotStatus=${saveSnapshotStatus})`);
  }

  function openCreditsPanel(){
    pendingNewQuestConfirm = false;
    menuUi.panelMode = "credits";
    menuUi.creditsBackBounds = null;
    playUiSfx("confirm");
  }

  function closeCreditsPanel(){
    if (menuUi.panelMode !== "credits") return;
    menuUi.panelMode = "menu";
    menuUi.creditsBackBounds = null;
    playUiSfx("navigate");
  }

  function captureSnapshotDataUrl(){
    if (!canvas || canvas.width <= 0 || canvas.height <= 0) return "";

    if (paused && !bootActive){
      suppressPauseOverlayForSnapshot = true;
      try {
        draw();
      } finally {
        suppressPauseOverlayForSnapshot = false;
      }
    }

    const encodePng = (srcCanvas) => {
      try {
        const encoded = srcCanvas.toDataURL("image/png");
        return (encoded && encoded.startsWith("data:image/png;base64,")) ? encoded : "";
      } catch (_err){
        return "";
      }
    };

    const scaledCapture = (() => {
      const maxW = 472;
      const maxH = 260;
      const scale = Math.min(maxW / canvas.width, maxH / canvas.height, 1);
      const w = Math.max(1, Math.round(canvas.width * scale));
      const h = Math.max(1, Math.round(canvas.height * scale));
      const temp = document.createElement("canvas");
      temp.width = w;
      temp.height = h;
      const ctx = temp.getContext("2d", { alpha: false });
      if (!ctx) return "";
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "medium";
      ctx.drawImage(canvas, 0, 0, w, h);
      return encodePng(temp);
    })();

    return scaledCapture;
  }

  function saveRunState(){
    const levelKey = currentLevelKey();
    if (!levelKey) return false;

    const sessionDurationSec = Math.max(0, Math.floor((Date.now() - sessionStartedAtMs) / 1000));
    const snapshotDataUrl = normalizeSnapshotDataUrl(captureSnapshotDataUrl());

    const payload = {
      version: 1,
      levelKey,
      levelName: currentLevelName(),
      savedAtMs: Date.now(),
      sessionDurationSec,
      snapshotDataUrl,
      player: {
        x: Number(player.x) || 0,
        y: Number(player.y) || 0,
        lives: Number(player.lives) || 4,
        flares: Number(player.flares) || 1,
        energy: Number(player.energy) || 1,
        checkpoint: player.checkpoint ? {
          tx: Number(player.checkpoint.tx) || 0,
          ty: Number(player.checkpoint.ty) || 0,
          px: Number(player.checkpoint.px) || 0,
          py: Number(player.checkpoint.py) || 0
        } : null
      }
    };

    try {
      localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(payload));
      saveSlot = loadSaveSlot() || payload;
      if (!payload.snapshotDataUrl){
        saveSnapshotImage = null;
        saveSnapshotSrc = "";
        saveSnapshotStatus = "idle";
      } else if (saveSnapshotSrc !== payload.snapshotDataUrl){
        saveSnapshotImage = null;
        saveSnapshotSrc = "";
        saveSnapshotStatus = "idle";
      }
      return true;
    } catch (_err){
      return false;
    }
  }

  function loadContinueFromSave(){
    const slot = loadSaveSlot();
    if (!slot || !slot.levelKey) return false;
    const levelObj = levelManager.levels[slot.levelKey];
    if (!levelObj) return false;

    resetRunStateForNewGame();
    loadLevel(levelObj);

    if (slot.player && typeof slot.player === "object"){
      player.x = Number(slot.player.x) || player.x;
      player.y = Number(slot.player.y) || player.y;
      player.vx = 0;
      player.vy = 0;
      player.lives = Math.max(1, Number(slot.player.lives) || 4);
      player.flares = Math.max(0, Number(slot.player.flares) || 0);
      player.setEnergy(Number(slot.player.energy) || 1);

      if (slot.player.checkpoint){
        player.checkpoint = {
          tx: Number(slot.player.checkpoint.tx) || 0,
          ty: Number(slot.player.checkpoint.ty) || 0,
          px: Number(slot.player.checkpoint.px) || 0,
          py: Number(slot.player.checkpoint.py) || 0
        };
        setCheckpoint(player.checkpoint.px, player.checkpoint.py);
      }
    }

    saveSlot = slot;
    if (!slot.snapshotDataUrl){
      saveSnapshotImage = null;
      saveSnapshotSrc = "";
      saveSnapshotStatus = "idle";
    } else if (saveSnapshotSrc !== slot.snapshotDataUrl){
      saveSnapshotImage = null;
      saveSnapshotSrc = "";
      saveSnapshotStatus = "idle";
    }
    sessionStartedAtMs = Date.now();
    paused = false;
    gameState = GameState.PLAYING;
    hudDebug.textContent = `Continue -> ${slot.levelKey}`;
    return true;
  }

  function saveAudioSettings(){
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(audioSettings));
    } catch (_err){
      // ignore write errors
    }
  }

  function applyMusicVolume(v){
    const vol = clamp01(v);
    audioSettings.musicVolume = vol;
    for (const track of music.tracks){
      track.volume = vol;
    }
  }

  function getSfxCtx(){
    if (!sfxCtx){
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return null;
      sfxCtx = new Ctor();
    }
    return sfxCtx;
  }

  function playUiSfx(kind){
    const vol = clamp01(audioSettings.sfxVolume);
    if (vol <= 0.001) return;

    const ctx = getSfxCtx();
    if (!ctx) return;
    if (ctx.state === "suspended"){
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const isConfirm = kind === "confirm";

    osc.type = isConfirm ? "triangle" : "sine";
    osc.frequency.setValueAtTime(isConfirm ? 580 : 420, now);
    osc.frequency.exponentialRampToValueAtTime(isConfirm ? 740 : 360, now + (isConfirm ? 0.09 : 0.06));

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol * (isConfirm ? 0.09 : 0.06)), now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (isConfirm ? 0.13 : 0.08));

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + (isConfirm ? 0.15 : 0.1));
  }

  function setSfxVolume(v){
    audioSettings.sfxVolume = clamp01(v);
  }

  function adjustSelectedSetting(delta){
    if (settingsUi.selectedIndex === 0){
      applyMusicVolume(audioSettings.musicVolume + delta);
      saveAudioSettings();
      playUiSfx("navigate");
    } else if (settingsUi.selectedIndex === 1){
      setSfxVolume(audioSettings.sfxVolume + delta);
      saveAudioSettings();
      playUiSfx("navigate");
    }
  }

  function returnToMenuFromSettings(){
    gameState = GameState.MENU;
    playUiSfx("confirm");
  }

  function enterSettings(){
    settingsUi.selectedIndex = 0;
    gameState = GameState.SETTINGS;
    playUiSfx("confirm");
  }

  function fanArtSrcByIndex(index){
    return `data/assets/ui/fanart/fanart_${String(index).padStart(2, "0")}.png`;
  }

  function loadImage(src){
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  async function loadFanArtGallery(){
    if (fanArtUi.loaded || fanArtUi.isLoading) return;
    fanArtUi.isLoading = true;
    const out = [];

    for (let i = 1; i <= 999; i++){
      const img = await loadImage(fanArtSrcByIndex(i));
      if (!img) break;
      out.push(img);
    }

    fanArtUi.images = out;
    fanArtUi.selectedIndex = 0;
    fanArtUi.loaded = true;
    fanArtUi.isLoading = false;
  }

  function enterFanArt(){
    gameState = GameState.FAN_ART;
    fanArtUi.selectedIndex = 0;
    loadFanArtGallery();
    playUiSfx("confirm");
  }

  function returnToMenuFromFanArt(){
    gameState = GameState.MENU;
    playUiSfx("confirm");
  }

  function activateMenuItem(index){
    const items = getMenuItems();
    const label = items[index];
    if (!label) return;

    if (label === "Continue"){
      playUiSfx("confirm");
      loadContinueFromSave();
      return;
    }

    if (label === "Begin Quest"){
      if (hasSaveSlot()){
        pendingNewQuestConfirm = true;
        playUiSfx("navigate");
        return;
      }
      playUiSfx("confirm");
      startMenuQuest();
      return;
    }

    if (label === "Settings"){
      enterSettings();
      return;
    }
    if (label === "Fan Art"){
      enterFanArt();
    }
  }

  function drawMenuAmbientGlows(ctx, drawX, drawY, drawW, drawH, t){
    const minSize = Math.min(drawW, drawH);
    ctx.save();
    ctx.globalCompositeOperation = "screen";

    for (const glow of menuAmbientGlows){
      const pulse = 0.5 + 0.5 * Math.sin((t * (glow.speed * 1.72)) + glow.phase);
      const flutter = 0.5 + 0.5 * Math.sin((t * (glow.speed * 3.7)) + (glow.phase * 2.1));
      const alpha = 0.19 + glow.amp * (pulse * 0.52 + flutter * 0.26);
      const radius = minSize * glow.r * (0.88 + pulse * 0.58);

      const driftX = Math.sin((t * (0.19 + glow.speed * 0.11)) + glow.phase * 1.9) * (drawW * 0.0048);
      const driftY = Math.cos((t * (0.17 + glow.speed * 0.09)) + glow.phase * 1.6) * (drawH * 0.0052);
      const orbitX = Math.sin((t * (0.41 + glow.speed * 0.16)) + glow.phase * 0.7) * (drawW * 0.0023);
      const orbitY = Math.cos((t * (0.37 + glow.speed * 0.14)) + glow.phase * 0.9) * (drawH * 0.0026);
      const x = drawX + drawW * glow.x + driftX + orbitX;
      const y = drawY + drawH * glow.y + driftY + orbitY;

      const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
      g.addColorStop(0, `rgba(255, 236, 196, ${(alpha * 1.02).toFixed(3)})`);
      g.addColorStop(0.28, `rgba(244, 192, 127, ${(alpha * 0.88).toFixed(3)})`);
      g.addColorStop(0.62, `rgba(216, 143, 90, ${(alpha * 0.56).toFixed(3)})`);
      g.addColorStop(0.86, `rgba(182, 102, 66, ${(alpha * 0.24).toFixed(3)})`);
      g.addColorStop(1, "rgba(168, 90, 58, 0)");

      ctx.shadowColor = `rgba(226, 158, 96, ${(alpha * 0.78).toFixed(3)})`;
      ctx.shadowBlur = radius * 0.72;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();

      const coreRadius = Math.max(2, radius * 0.16);
      ctx.shadowColor = `rgba(242, 200, 148, ${(alpha * 0.85).toFixed(3)})`;
      ctx.shadowBlur = radius * 0.3;
      ctx.fillStyle = `rgba(255, 225, 182, ${(0.28 + pulse * 0.26 + flutter * 0.12).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(x, y, coreRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function drawMenuLumoSprite(ctx, drawX, drawY, drawW, drawH, t){
    const img = menuLumoSpriteImage;
    if (!img || !img.complete || img.naturalWidth <= 0) return;

    const spriteW = drawW * 0.246;
    const spriteH = spriteW * (img.naturalHeight / img.naturalWidth);
    const baseX = (drawX + drawW * 0.72) - 40;
    const baseY = (drawY + drawH * 0.38) - 20;

    const hoverY = Math.sin(t * 0.48) * 8;
    const driftX = Math.sin((t * 0.31) + 1.8) * 5;

    const spriteX = baseX + driftX;
    const spriteY = baseY + hoverY;
    const haloPulse = 0.5 + 0.5 * Math.sin((t * 0.84) + 0.9);
    const haloRadius = spriteW * (0.96 + haloPulse * 0.16);
    const haloCenterX = spriteX + (spriteW * 0.52);
    const haloCenterY = spriteY + (spriteH * 0.49);

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const halo = ctx.createRadialGradient(haloCenterX, haloCenterY, 0, haloCenterX, haloCenterY, haloRadius);
    halo.addColorStop(0, `rgba(176, 255, 246, ${(0.34 + haloPulse * 0.12).toFixed(3)})`);
    halo.addColorStop(0.45, `rgba(132, 234, 255, ${(0.2 + haloPulse * 0.08).toFixed(3)})`);
    halo.addColorStop(0.85, "rgba(98, 206, 255, 0.08)");
    halo.addColorStop(1, "rgba(98, 206, 255, 0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(haloCenterX, haloCenterY, haloRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(img, spriteX, spriteY, spriteW, spriteH);
    ctx.restore();
  }

  function startMenuQuest(){
    const lvl = levelManager.getStartLevel();
    if (!lvl){
      hudDebug.textContent = "Menu start failed: level01 not found";
      return;
    }

    resetRunStateForNewGame();
    sessionStartedAtMs = Date.now();
    loadLevel(lvl);
    paused = false;
    gameState = GameState.PLAYING;
    hudDebug.textContent = "Begin Quest -> level01";
  }

  function resetRunStateForNewGame(){
    paused = false;
    intermissionReadyForInput = false;
    gameOverReadyForInput = false;

    // New run must not inherit anything from the previous run.
    levelManager.lastLoadedLevel = null;

    checkpoint = null;
    _cpKey = "";
    if (hudCP) hudCP.textContent = "-";

    player.lives = 4;
    player.flares = 1;
    player.invuln = 0;
    player.knockTimer = 0;
    player.lockMinX = 0;
    player.checkpoint = null;
    player._checkpointChanged = false;

    // Ensure no old run state can complete after a menu restart.
    player.x = 0;
    player.y = 0;
    player.vx = 0;
    player.vy = 0;
    player.onGround = false;
    player.onPlatform = null;
    player.coyoteTimer = 0;
    player.jumpBufferTimer = 0;

    if (player._respawn){
      player._respawn.active = false;
      player._respawn.t = 0;
      player._respawn.lastCount = 0;
    }
    if (player._damage){
      player._damage.active = false;
      player._damage.t = 0;
      player._damage.pendingDeath = false;
    }
    if (player._deathAnim){
      player._deathAnim.active = false;
      player._deathAnim.t = 0;
      player._deathAnim.fade = 1;
      player._deathAnim.rot = 0;
    }

    hudCanvas.popups = [];
    hudCanvas._prevPulseActive = false;
    hudCanvas._prevFlares = player.flares|0;
    hudCanvas._boostAcc = 0;
    hudCanvas.flareFlash = 0;
    hudCanvas.score = 0;
    hudCanvas.checkpointLit = false;
    hudCanvas.checkpointRingT = 0;
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
    paused = false;
    gameOverReadyForInput = false;
    gameState = GameState.MENU;
    hudDebug.textContent = "Game Over -> main menu";
  }

  function saveAndExitToMenu(){
    const ok = saveRunState();
    if (ents && typeof ents.stopGameplayAudio === "function"){
      ents.stopGameplayAudio();
    }
    paused = false;
    gameState = GameState.MENU;
    pendingNewQuestConfirm = false;
    menuUi.panelMode = "menu";
    menuUi.creditsBackBounds = null;
    ensureMenuSelectionValid();
    hudDebug.textContent = ok ? "Saved & returned to menu" : "Save failed";
  }

  function togglePauseState(){
    paused = !paused;
    gameState = paused ? GameState.PAUSED : GameState.PLAYING;
  }

  // Klick på canvas = toggle pause / klicka på paus-knappen
  canvas.addEventListener("mousedown", (e) => {
    if (bootActive) return;
    if (gameState === GameState.MENU){
      unlockMenuMusicFromInteraction();
      const rect = canvas.getBoundingClientRect();
      const sx = r.w / rect.width;
      const sy = r.h / rect.height;
      const mx = (e.clientX - rect.left) * sx;
      const my = (e.clientY - rect.top) * sy;

      if (pendingNewQuestConfirm){
        for (let i = 0; i < menuUi.confirmBounds.length; i++){
          const b = menuUi.confirmBounds[i];
          if (!b) continue;
          if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h){
            if (i === 0){
              loadContinueFromSave();
              playUiSfx("confirm");
            } else if (i === 1){
              pendingNewQuestConfirm = false;
              playUiSfx("confirm");
              startMenuQuest();
            } else {
              pendingNewQuestConfirm = false;
              playUiSfx("navigate");
            }
            return;
          }
        }
        pendingNewQuestConfirm = false;
        return;
      }

      if (menuUi.panelMode === "credits"){
        if (menuUi.creditsBackBounds){
          const b = menuUi.creditsBackBounds;
          if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h){
            closeCreditsPanel();
            return;
          }
        }
      }

      if (menuUi.creditsBounds){
        const b = menuUi.creditsBounds;
        if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h){
          if (menuUi.panelMode === "credits"){
            closeCreditsPanel();
          } else {
            openCreditsPanel();
          }
          return;
        }
      }

      if (menuUi.panelMode === "credits") return;

      for (let i = 0; i < menuUi.itemBounds.length; i++){
        const b = menuUi.itemBounds[i];
        if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h){
          menuUi.selectedIndex = i;
          activateMenuItem(i);
          break;
        }
      }
      return;
    }

    if (gameState === GameState.SETTINGS){
      const rect = canvas.getBoundingClientRect();
      const sx = r.w / rect.width;
      const sy = r.h / rect.height;
      const mx = (e.clientX - rect.left) * sx;
      const my = (e.clientY - rect.top) * sy;

      for (let i = 0; i < settingsUi.rowBounds.length; i++){
        const b = settingsUi.rowBounds[i];
        if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h){
          settingsUi.selectedIndex = i;
          if (i === 2){
            returnToMenuFromSettings();
            return;
          }
        }
      }

      for (let i = 0; i < settingsUi.sliderBounds.length; i++){
        const b = settingsUi.sliderBounds[i];
        if (!b) continue;
        if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h){
          const pct = clamp01((mx - b.x) / b.w);
          settingsUi.selectedIndex = i;
          if (i === 0) applyMusicVolume(pct);
          if (i === 1) setSfxVolume(pct);
          saveAudioSettings();
          playUiSfx("navigate");
          return;
        }
      }
      return;
    }
    if (paused){
      togglePauseState();
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
      togglePauseState();
    }
  });

  canvas.addEventListener("mousemove", (e) => {
    if (bootActive) return;

    const rect = canvas.getBoundingClientRect();
    const sx = r.w / rect.width;
    const sy = r.h / rect.height;
    const mx = (e.clientX - rect.left) * sx;
    const my = (e.clientY - rect.top) * sy;

    if (gameState === GameState.MENU){
      if (pendingNewQuestConfirm) return;
      if (!menuUi.itemBounds.length) return;

      for (let i = 0; i < menuUi.itemBounds.length; i++){
        const b = menuUi.itemBounds[i];
        if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h){
          menuUi.selectedIndex = i;
          break;
        }
      }
      return;
    }

    if (gameState === GameState.PLAYING){
      const b = hudCanvas._pauseBtn;
      hudCanvas._pauseBtnHover = !!(b && mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h);
      return;
    }

    hudCanvas._pauseBtnHover = false;

    if (gameState !== GameState.SETTINGS) return;

    for (let i = 0; i < settingsUi.rowBounds.length; i++){
      const b = settingsUi.rowBounds[i];
      if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h){
        settingsUi.selectedIndex = i;
        break;
      }
    }

    if ((e.buttons & 1) === 0) return;
    for (let i = 0; i < settingsUi.sliderBounds.length; i++){
      const b = settingsUi.sliderBounds[i];
      if (!b) continue;
      if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h){
        const pct = clamp01((mx - b.x) / b.w);
        settingsUi.selectedIndex = i;
        if (i === 0) applyMusicVolume(pct);
        if (i === 1) setSfxVolume(pct);
        saveAudioSettings();
      }
    }
  });

  // P = pause/resume
  window.addEventListener("keydown", (e) => {
    if (gameState === GameState.MENU){
      unlockMenuMusicFromInteraction();
      const menuItems = getMenuItems();
      if (e.repeat) return;
      if (menuUi.panelMode === "credits"){
        if (e.key === "Escape" || e.key === "Backspace" || e.key === "Enter" || e.key === " "){
          closeCreditsPanel();
          e.preventDefault();
        }
        return;
      }
      if (pendingNewQuestConfirm){
        if (e.key === "Escape"){
          pendingNewQuestConfirm = false;
          playUiSfx("navigate");
          e.preventDefault();
          return;
        }
        if (e.key === "Enter" || e.key === " "){
          playUiSfx("confirm");
          pendingNewQuestConfirm = false;
          loadContinueFromSave();
          e.preventDefault();
        }
        return;
      }
      if (e.key === "ArrowDown"){
        menuUi.selectedIndex = (menuUi.selectedIndex + 1) % menuItems.length;
        playUiSfx("navigate");
        e.preventDefault();
        return;
      }
      if (e.key === "ArrowUp"){
        menuUi.selectedIndex = (menuUi.selectedIndex - 1 + menuItems.length) % menuItems.length;
        playUiSfx("navigate");
        e.preventDefault();
        return;
      }
      if (e.key === "Enter" || e.key === " "){
        activateMenuItem(menuUi.selectedIndex);
        e.preventDefault();
      }
      return;
    }

    if (gameState === GameState.FAN_ART){
      if (e.repeat) return;
      if (e.key === "Escape" || e.key === "Backspace"){
        returnToMenuFromFanArt();
        e.preventDefault();
        return;
      }
      if (!fanArtUi.images.length) return;
      if (e.key === "ArrowLeft"){
        fanArtUi.selectedIndex = (fanArtUi.selectedIndex - 1 + fanArtUi.images.length) % fanArtUi.images.length;
        playUiSfx("navigate");
        e.preventDefault();
        return;
      }
      if (e.key === "ArrowRight"){
        fanArtUi.selectedIndex = (fanArtUi.selectedIndex + 1) % fanArtUi.images.length;
        playUiSfx("navigate");
        e.preventDefault();
      }
      return;
    }

    if (gameState === GameState.SETTINGS){
      if (e.repeat) return;
      if (e.key === "Escape"){
        returnToMenuFromSettings();
        e.preventDefault();
        return;
      }
      if (e.key === "ArrowDown"){
        settingsUi.selectedIndex = (settingsUi.selectedIndex + 1) % settingsItems.length;
        playUiSfx("navigate");
        e.preventDefault();
        return;
      }
      if (e.key === "ArrowUp"){
        settingsUi.selectedIndex = (settingsUi.selectedIndex - 1 + settingsItems.length) % settingsItems.length;
        playUiSfx("navigate");
        e.preventDefault();
        return;
      }
      if (e.key === "ArrowLeft"){
        adjustSelectedSetting(-0.05);
        e.preventDefault();
        return;
      }
      if (e.key === "ArrowRight"){
        adjustSelectedSetting(0.05);
        e.preventDefault();
        return;
      }
      if (e.key === "Enter" || e.key === " "){
        if (settingsUi.selectedIndex === 2){
          returnToMenuFromSettings();
        }
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
    if (paused && (e.key === "s" || e.key === "S")){
      saveAndExitToMenu();
      e.preventDefault();
      return;
    }
    if (e.key === "p" || e.key === "P"){
      togglePauseState();
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
    if (gameState === GameState.SETTINGS){
      return;
    }
    if (gameState === GameState.FAN_ART){
      return;
    }
    if (player.lives <= 0){
      if (typeof player.isDeathAnimating === "function" && player.isDeathAnimating()){
        gameState = GameState.PLAYING;
        return;
      }
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

  function switchMusic(track){
    if (music.current === track) return;

    for (const a of music.tracks){
      if (a !== track){
        a.pause();
        a.currentTime = 0;
      }
    }

    music.current = track || null;
    if (!track) return;
    if (track === music.menu && music.requireMenuUnlock && !menuMusicUnlocked) return;

    const playP = track.play();
    if (playP && typeof playP.catch === "function"){
      playP.catch(() => {});
    }
  }


  function unlockMenuMusicFromInteraction(){
    if (menuMusicUnlocked) return;
    if (!music.requireMenuUnlock) return;
    if (gameState !== GameState.MENU) return;
    if (!music.menu) return;

    const probe = music.menu;
    const playP = probe.play();
    const onUnlocked = () => {
      probe.pause();
      probe.currentTime = 0;
      menuMusicUnlocked = true;
      music.current = null;
      updateMusicByState();
    };

    if (playP && typeof playP.then === "function"){
      playP.then(onUnlocked).catch(() => {});
      return;
    }

    onUnlocked();
  }

  function updateMusicByState(){
    const track = Object.prototype.hasOwnProperty.call(music.byState, gameState) ? music.byState[gameState] : null;
    return switchMusic(track || null);
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

    if (
      (player.invuln || 0) <= 0 &&
      !(player.isRespawning && player.isRespawning()) &&
      !(typeof player.isDeathAnimating === "function" && player.isDeathAnimating())
    ){
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

    if (
      (player.invuln || 0) <= 0 &&
      !(player.isRespawning && player.isRespawning()) &&
      !(typeof player.isDeathAnimating === "function" && player.isDeathAnimating())
    ){
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

    if (
      player.lives <= 0 &&
      !(typeof player.isDeathAnimating === "function" && player.isDeathAnimating())
    ){
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

    if (gameState === GameState.MENU){
      const img = menuBackgroundImage;
      let bgDrawX = 0;
      let bgDrawY = 0;
      let bgDrawW = r.w;
      let bgDrawH = r.h;

      if (img && img.complete && img.naturalWidth > 0){
        const scale = Math.min(r.w / img.naturalWidth, r.h / img.naturalHeight);
        const drawW = img.naturalWidth * scale;
        const drawH = img.naturalHeight * scale;
        const drawX = (r.w - drawW) * 0.5;
        const drawY = (r.h - drawH) * 0.5;
        bgDrawX = drawX;
        bgDrawY = drawY;
        bgDrawW = drawW;
        bgDrawH = drawH;
        ctx.drawImage(img, drawX, drawY, drawW, drawH);
        drawMenuAmbientGlows(ctx, drawX, drawY, drawW, drawH, Lumo.Time.t || 0);
        drawMenuLumoSprite(ctx, drawX, drawY, drawW, drawH, Lumo.Time.t || 0);
      } else {
        ctx.fillStyle = "#03131A";
        ctx.fillRect(0, 0, r.w, r.h);
      }

      ctx.save();

      const menuItems = getMenuItems();
      ensureMenuSelectionValid();

      const panelX = bgDrawX + bgDrawW * 0.255;
      const panelY = (bgDrawY + bgDrawH * 0.475) - 13;
      const textOffsetX = bgDrawW * (-18 / 1920);
      const textOffsetY = bgDrawH * (-14 / 1080);
      const tilt = 0.03;
      const lineH = Math.max(30, bgDrawH * 0.056) * 0.88;

      ctx.translate(panelX, panelY);
      ctx.rotate(tilt);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `${Math.max(21, Math.round(bgDrawH * 0.041))}px "Orbitron","Eurostile","Trebuchet MS",sans-serif`;

      menuUi.itemBounds = [];
      menuUi.beginQuestBounds = null;
      menuUi.confirmBounds = [];
      menuUi.creditsBounds = null;

      if (menuUi.panelMode === "credits"){
        const creditsHeading = "Credits";
        const creditsLines = [
          "Lumo is an atmospheric platform adventure about light, darkness,",
          "and the small spark of hope that exists even in the deepest shadows.",
          "",
          "The game was created by Jonas Nordén,",
          "with the help of ChatGPT and Codex",
          "— without any traditional programming background.",
          "",
          "The project began as a simple idea:",
          "to explore whether an entire game world could be built",
          "with curiosity, persistence, and modern AI as tools.",
          "",
          "Lumo is an experiment, an adventure,",
          "and a small proof of what creativity can achieve",
          "when technology and imagination meet."
        ];

        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        const panelContentW = bgDrawW * 0.78;
        const panelContentH = bgDrawH * 0.56;
        const creditsOffsetX = bgDrawW * (170 / 1920) - 15 + 90;
        const creditsOffsetY = bgDrawH * (42 / 1080);
        const panelLeft = textOffsetX + creditsOffsetX - panelContentW * 0.5;
        const panelTop = textOffsetY + creditsOffsetY - panelContentH * 0.5;
        const contentPadX = Math.max(14, bgDrawW * 0.01);
        const contentPadY = Math.max(14, bgDrawH * 0.014);
        const textX = panelLeft + panelContentW * 0.5;
        const textMaxW = panelContentW - contentPadX * 2;

        const c = Math.cos(tilt);
        const s = Math.sin(tilt);
        const localToScreen = (x, y) => ({
          x: panelX + (x * c - y * s),
          y: panelY + (x * s + y * c)
        });

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.font = `${Math.max(20, Math.round(bgDrawH * 0.034))}px "Orbitron","Trebuchet MS",sans-serif`;
        ctx.fillStyle = "#CBFBFF";
        ctx.shadowColor = "rgba(89,228,245,0.45)";
        ctx.shadowBlur = 10;
        const headingY = panelTop + contentPadY;
        const headingScreen = localToScreen(textX, headingY);
        ctx.fillText(creditsHeading, headingScreen.x, headingScreen.y, textMaxW);

        ctx.font = `${Math.max(11, Math.round(bgDrawH * 0.0165))}px "Trebuchet MS",sans-serif`;
        ctx.fillStyle = "rgba(199,240,248,0.94)";
        ctx.shadowBlur = 0;
        const lineStep = Math.max(16, bgDrawH * 0.023);
        const bodyStartY = headingY + Math.max(34, bgDrawH * 0.048);
        const bodyHeight = creditsLines.length * lineStep;
        const bodyMaxTop = panelTop + panelContentH - contentPadY - bodyHeight - Math.max(32, bgDrawH * 0.036);
        let y = Math.min(bodyStartY, bodyMaxTop);
        for (const line of creditsLines){
          if (line){
            const lineScreen = localToScreen(textX, y);
            ctx.fillText(line, lineScreen.x, lineScreen.y, textMaxW);
          }
          y += lineStep;
        }

        const backLabel = "Back";
        const backY = panelTop + panelContentH - Math.max(34, bgDrawH * 0.042);
        ctx.font = `${Math.max(14, Math.round(bgDrawH * 0.022))}px "Orbitron","Trebuchet MS",sans-serif`;
        ctx.fillStyle = "#A6F4FF";
        const backScreen = localToScreen(textX, backY);
        ctx.fillText(backLabel, backScreen.x, backScreen.y);
        ctx.restore();

        ctx.font = `${Math.max(14, Math.round(bgDrawH * 0.022))}px "Orbitron","Trebuchet MS",sans-serif`;
        const backW = ctx.measureText(backLabel).width;
        const backH = Math.max(24, bgDrawH * 0.03);
        const bx = panelX + (textX * c - backY * s);
        const by = panelY + (textX * s + backY * c);
        menuUi.creditsBackBounds = {
          x: bx - backW * 0.5,
          y: by - backH * 0.5,
          w: backW,
          h: backH
        };
      } else {
        menuUi.creditsBackBounds = null;
        for (let i = 0; i < menuItems.length; i++){
          const isActive = i === menuUi.selectedIndex;
          const y = (i - (menuItems.length - 1) * 0.5) * lineH;
          const textX = textOffsetX;
          const textY = y + textOffsetY;
          const label = menuItems[i];

          ctx.shadowColor = isActive ? "rgba(108,255,255,0.68)" : "rgba(70,220,240,0.32)";
          ctx.shadowBlur = isActive ? 13 : 6;
          ctx.lineWidth = 4;
          ctx.strokeStyle = "rgba(0,32,38,0.62)";
          ctx.strokeText(label, textX, textY);
          ctx.fillStyle = isActive ? "#CFFFFF" : "#87EAF6";
          ctx.fillText(label, textX, textY);

          const metrics = ctx.measureText(label);
          const textW = metrics.width;
          const textH = lineH * 0.74;
          const c = Math.cos(tilt);
          const s = Math.sin(tilt);
          const cx = panelX + (textX * c - textY * s);
          const cy = panelY + (textX * s + textY * c);
          const bounds = {
            x: cx - textW * 0.5,
            y: cy - textH * 0.5,
            w: textW,
            h: textH
          };
          menuUi.itemBounds.push(bounds);

          if (label === "Begin Quest"){
            menuUi.beginQuestBounds = bounds;
          }
        }
      }

      ctx.restore();

      if (menuUi.panelMode === "credits"){
        return;
      }

      const panelInner = {
        x: panelX,
        y: panelY,
        w: bgDrawW,
        h: bgDrawH
      };

      const previewRect = getSavePreviewRect(panelInner);
      const previewX = previewRect.x;
      const previewY = previewRect.y;
      const previewW = previewRect.w;
      const previewH = previewRect.h;
      const previewRotRad = previewRect.rotRad;
      const metadataTop = previewY + previewH + Math.max(8, bgDrawH * 0.01);
      const metadataW = Math.min(previewW + Math.max(68, Math.round(bgDrawW * 0.05)), bgDrawW * 0.255);
      const metadataX = previewX - Math.max(4, Math.round(bgDrawW * 0.003));
      const metadataPadX = Math.max(10, Math.round(bgDrawW * 0.006));
      const metadataPadY = Math.max(7, Math.round(bgDrawH * 0.006));
      const textInsetX = metadataX + metadataPadX;
      const titleY = metadataTop + metadataPadY;
      const infoY = titleY + Math.max(12, bgDrawH * 0.014);

      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.font = `${Math.max(13, Math.round(bgDrawH * 0.018))}px "Orbitron","Trebuchet MS",sans-serif`;
      ctx.fillStyle = "rgba(210,253,255,0.95)";
      ctx.fillText(hasSaveSlot() ? "Last save" : "No save found", textInsetX, titleY);

      const previewImageSelection = resolvePreviewImageForMenu();
      logPreviewImageSource(previewImageSelection.source);

      drawPreviewPanelSurface(ctx, {
        x: previewX,
        y: previewY,
        w: previewW,
        h: previewH,
        rotRad: previewRotRad,
        bgDrawH,
        previewImage: previewImageSelection.image
      });

      if (hasSaveSlot()){
        const infoLineH = Math.max(11, Math.round(bgDrawH * 0.015));
        ctx.font = `${Math.max(10, Math.round(bgDrawH * 0.014))}px "Trebuchet MS",sans-serif`;
        ctx.fillStyle = "rgba(200,242,252,0.95)";
        ctx.fillText(saveSlot.levelName || saveSlot.levelKey || "Unknown level", textInsetX, infoY);
        ctx.fillStyle = "rgba(176,226,238,0.92)";
        ctx.fillText(`Saved: ${formatSavedTimestamp(saveSlot.savedAtMs)}`, textInsetX, infoY + infoLineH);
        ctx.fillText(`Session: ${formatSessionDuration(saveSlot.sessionDurationSec)}`, textInsetX, infoY + infoLineH * 2);
      }

      ctx.save();
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";
      ctx.font = `${Math.max(11, Math.round(bgDrawH * 0.017))}px "Trebuchet MS",sans-serif`;
      ctx.fillStyle = "rgba(185,219,228,0.78)";
      const creditsText = "Lumo – by Jonas Nordén © 2026";
      const creditsX = bgDrawX + bgDrawW * 0.03;
      const creditsY = bgDrawY + bgDrawH * 0.975;
      ctx.fillText(creditsText, creditsX, creditsY);
      const cW = ctx.measureText(creditsText).width;
      ctx.strokeStyle = "rgba(185,219,228,0.58)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(creditsX, creditsY + 2);
      ctx.lineTo(creditsX + cW, creditsY + 2);
      ctx.stroke();
      menuUi.creditsBounds = { x: creditsX, y: creditsY - 18, w: cW, h: 22 };
      ctx.restore();

      if (pendingNewQuestConfirm){
        const boxW = Math.min(bgDrawW * 0.42, 560);
        const boxH = Math.min(bgDrawH * 0.34, 300);
        const boxX = bgDrawX + (bgDrawW - boxW) * 0.5;
        const boxY = bgDrawY + (bgDrawH - boxH) * 0.5;
        ctx.save();
        ctx.fillStyle = "rgba(2,9,14,0.86)";
        ctx.fillRect(boxX, boxY, boxW, boxH);
        ctx.strokeStyle = "rgba(132,234,255,0.58)";
        ctx.lineWidth = 2;
        ctx.strokeRect(boxX, boxY, boxW, boxH);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#D8F8FF";
        ctx.font = `${Math.max(22, Math.round(bgDrawH * 0.038))}px "Orbitron","Trebuchet MS",sans-serif`;
        ctx.fillText("Start a new quest?", boxX + boxW * 0.5, boxY + boxH * 0.22);
        ctx.font = `${Math.max(16, Math.round(bgDrawH * 0.026))}px "Trebuchet MS",sans-serif`;
        ctx.fillStyle = "#AEDFEB";
        ctx.fillText("Your current progress will be overwritten.", boxX + boxW * 0.5, boxY + boxH * 0.38);

        const opts = ["Continue Quest", "Start New", "Cancel"];
        menuUi.confirmBounds = [];
        for (let i = 0; i < opts.length; i++){
          const oy = boxY + boxH * (0.58 + i * 0.14);
          ctx.fillStyle = "rgba(17,45,59,0.88)";
          const bw = boxW * 0.58;
          const bh = 34;
          const bx = boxX + (boxW - bw) * 0.5;
          ctx.fillRect(bx, oy - bh * 0.5, bw, bh);
          ctx.strokeStyle = "rgba(130,230,248,0.52)";
          ctx.strokeRect(bx, oy - bh * 0.5, bw, bh);
          ctx.fillStyle = "#D7FAFF";
          ctx.font = `${Math.max(15, Math.round(bgDrawH * 0.024))}px "Trebuchet MS",sans-serif`;
          ctx.fillText(opts[i], boxX + boxW * 0.5, oy);
          menuUi.confirmBounds.push({ x: bx, y: oy - bh * 0.5, w: bw, h: bh });
        }
        ctx.restore();
      }
      return;
    }

    if (gameState === GameState.SETTINGS){
      const img = menuBackgroundImage;
      if (img && img.complete && img.naturalWidth > 0){
        const scale = Math.min(r.w / img.naturalWidth, r.h / img.naturalHeight);
        const drawW = img.naturalWidth * scale;
        const drawH = img.naturalHeight * scale;
        const drawX = (r.w - drawW) * 0.5;
        const drawY = (r.h - drawH) * 0.5;
        ctx.drawImage(img, drawX, drawY, drawW, drawH);
        drawMenuAmbientGlows(ctx, drawX, drawY, drawW, drawH, Lumo.Time.t || 0);
      } else {
        ctx.fillStyle = "#03131A";
        ctx.fillRect(0, 0, r.w, r.h);
      }

      const panelW = Math.min(r.w * 0.68, 780);
      const panelH = Math.min(r.h * 0.64, 500);
      const panelX = (r.w - panelW) * 0.5;
      const panelY = (r.h - panelH) * 0.5;

      settingsUi.rowBounds = [];
      settingsUi.sliderBounds = [];

      ctx.save();
      ctx.fillStyle = "rgba(4,16,24,0.72)";
      ctx.strokeStyle = "rgba(111,241,255,0.48)";
      ctx.lineWidth = 2;
      ctx.shadowColor = "rgba(93,217,255,0.2)";
      ctx.shadowBlur = 18;
      ctx.fillRect(panelX, panelY, panelW, panelH);
      ctx.strokeRect(panelX, panelY, panelW, panelH);

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `${Math.max(28, Math.round(r.h * 0.055))}px "Orbitron","Trebuchet MS",sans-serif`;
      ctx.fillStyle = "#CFFFFF";
      ctx.fillText("SETTINGS", r.w * 0.5, panelY + panelH * 0.14);

      const labels = ["Music Volume", "SFX Volume"];
      const values = [audioSettings.musicVolume, audioSettings.sfxVolume];

      for (let i = 0; i < labels.length; i++){
        const rowY = panelY + panelH * (0.34 + i * 0.22);
        const isActive = settingsUi.selectedIndex === i;
        const rowRect = { x: panelX + panelW * 0.1, y: rowY - 22, w: panelW * 0.8, h: 44 };
        settingsUi.rowBounds.push(rowRect);

        ctx.textAlign = "left";
        ctx.font = `${Math.max(20, Math.round(r.h * 0.038))}px "Trebuchet MS",sans-serif`;
        ctx.fillStyle = isActive ? "#D6FFFF" : "#8CE8F5";
        ctx.fillText(labels[i], panelX + panelW * 0.1, rowY - 30);

        const sliderX = panelX + panelW * 0.1;
        const sliderY = rowY;
        const sliderW = panelW * 0.8;
        const sliderH = 12;
        settingsUi.sliderBounds[i] = { x: sliderX, y: sliderY - sliderH, w: sliderW, h: sliderH * 2 };

        ctx.fillStyle = "rgba(16,59,74,0.86)";
        ctx.fillRect(sliderX, sliderY - sliderH * 0.5, sliderW, sliderH);

        ctx.fillStyle = isActive ? "#93F6FF" : "#66CFE3";
        ctx.fillRect(sliderX, sliderY - sliderH * 0.5, sliderW * values[i], sliderH);

        const knobX = sliderX + sliderW * values[i];
        ctx.fillStyle = isActive ? "#E4FFFF" : "#B2F4FF";
        ctx.beginPath();
        ctx.arc(knobX, sliderY, 9, 0, Math.PI * 2);
        ctx.fill();

        ctx.textAlign = "right";
        ctx.font = `${Math.max(18, Math.round(r.h * 0.03))}px "Orbitron","Trebuchet MS",sans-serif`;
        ctx.fillStyle = "#D6F7FF";
        ctx.fillText(`${Math.round(values[i] * 100)}%`, panelX + panelW * 0.9, rowY - 30);
      }

      const backY = panelY + panelH * 0.85;
      const backActive = settingsUi.selectedIndex === 2;
      const backText = "Back to Main Menu";
      ctx.textAlign = "center";
      ctx.font = `${Math.max(22, Math.round(r.h * 0.04))}px "Trebuchet MS",sans-serif`;
      ctx.fillStyle = backActive ? "#D6FFFF" : "#8CE8F5";
      ctx.fillText(backText, r.w * 0.5, backY);
      const bw = ctx.measureText(backText).width;
      settingsUi.rowBounds.push({ x: r.w * 0.5 - bw * 0.5, y: backY - 22, w: bw, h: 44 });

      ctx.font = `${Math.max(14, Math.round(r.h * 0.024))}px "Trebuchet MS",sans-serif`;
      ctx.fillStyle = "rgba(191,237,244,0.92)";
      ctx.fillText("↑/↓ välj • ←/→ justera • Enter/Esc tillbaka", r.w * 0.5, panelY + panelH * 0.95);
      ctx.restore();
      return;
    }

    if (gameState === GameState.FAN_ART){
      ctx.fillStyle = "#05080D";
      ctx.fillRect(0, 0, r.w, r.h);

      const hasImage = fanArtUi.images.length > 0;
      const activeImage = hasImage ? fanArtUi.images[fanArtUi.selectedIndex] : null;
      const maxW = r.w * 0.9;
      const maxH = r.h * 0.82;

      if (activeImage && activeImage.naturalWidth > 0 && activeImage.naturalHeight > 0){
        const scale = Math.min(maxW / activeImage.naturalWidth, maxH / activeImage.naturalHeight);
        const drawW = activeImage.naturalWidth * scale;
        const drawH = activeImage.naturalHeight * scale;
        const drawX = (r.w - drawW) * 0.5;
        const drawY = (r.h - drawH) * 0.5;
        ctx.drawImage(activeImage, drawX, drawY, drawW, drawH);

        ctx.fillStyle = "rgba(236,246,255,0.9)";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `${Math.max(14, Math.round(r.h * 0.027))}px "Trebuchet MS",sans-serif`;
        ctx.fillText(`Image ${fanArtUi.selectedIndex + 1} / ${fanArtUi.images.length}`, r.w * 0.5, r.h * 0.06);
      } else {
        ctx.fillStyle = "rgba(236,246,255,0.9)";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `${Math.max(18, Math.round(r.h * 0.04))}px "Trebuchet MS",sans-serif`;
        ctx.fillText(fanArtUi.isLoading ? "Loading fan art..." : "No fan art found", r.w * 0.5, r.h * 0.5);
      }

      ctx.fillStyle = "rgba(190,220,238,0.94)";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `${Math.max(14, Math.round(r.h * 0.024))}px "Trebuchet MS",sans-serif`;
      ctx.fillText("Left / Right - Browse", r.w * 0.5, r.h * 0.93);
      ctx.fillText("Esc - Back to menu", r.w * 0.5, r.h * 0.965);
      return;
    }

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
      r: (typeof player.getRenderLightRadius === "function") ? player.getRenderLightRadius() : player.lightRadius,
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

    // Render elements that must remain visible over darkness.
    if (ents && typeof ents.drawAfterDarkness === "function") ents.drawAfterDarkness(ctx, cam);

    if (gameState === GameState.GAME_OVER){
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
    } else if (paused && !bootActive && !suppressPauseOverlayForSnapshot){
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
    updateMusicByState();

    if (!paused && gameState === GameState.PLAYING){
      const shouldUpdatePlayer =
        player.lives > 0 ||
        (typeof player.isDeathAnimating === "function" && player.isDeathAnimating()) ||
        (typeof player.isRespawning === "function" && player.isRespawning());

      if (shouldUpdatePlayer){
        player.update(dt, world);

        if (player.lives > 0){
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
          paused = false;
          gameState = GameState.MENU;
          unlockMenuMusicFromInteraction();
        }, 250);
      }
    }, stepMs);
  }

  // Boot
  Lumo.Input.init();
  Lumo.Time.start();
  wireImport();
  player.lives = 4;
  player.flares = 1;
  player.refill();
  loadFanArtGallery();
  gameState = GameState.BOOTING;
  bootStart();
  requestAnimationFrame(tick);
})();
