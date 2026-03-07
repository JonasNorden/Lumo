(() => {
  window.Lumo = window.Lumo || {};
  // A small, hand-crafted test level for Lumo.
  // Tile ids: 0 empty, 1 solid, 2 oneWay, 3 hazard (spikes), 4 ice, 5 brake
  const w = 120;   // ✅ extended (was 40)
  const h = 18;
  const ts = 24;

  // create empty grid
  const data = new Array(w * h).fill(0);

  // helper to set tile
  function set(tx, ty, id){
    if (tx < 0 || tx >= w || ty < 0 || ty >= h) return;
    data[ty * w + tx] = id;
  }

  // ground: solid across bottom row
  for (let x = 0; x < w; x++){
    set(x, h - 1, 1);
  }

  // ----------------------------
  // ✅ ORIGINAL CONTENT (UNCHANGED)
  // ----------------------------

  // some step platforms (one-way) in the mid area
  set(6, 13, 2);
  set(7, 13, 2);
  set(8, 13, 2);

  set(12, 10, 2);
  set(13, 10, 2);
  set(14, 10, 2);

  set(20, 8, 2);
  set(21, 8, 2);
  set(22, 8, 2);

  // spikes hazard row (a short trap)
  set(26, h - 2, 3);
  set(27, h - 2, 3);
  set(28, h - 2, 3);

  // a small high platform
  set(31, 11, 1);
  set(32, 11, 1);
  set(33, 11, 1);

  // brake tile area
  set(16, h - 2, 5);
  set(17, h - 2, 5);
  set(18, h - 2, 5);

  // ice (speed) region near left approach
  set(2, h - 2, 4);
  set(3, h - 2, 4);
  set(4, h - 2, 4);

  // some walls for vertical challenge
  for (let y = h - 6; y < h - 1; y++){
    set(10, y, 1);
  }

  // visual ledge / platform variety
  set(24, 14, 2);
  set(25, 14, 2);
  set(26, 14, 2);

  // ----------------------------
  // ✅ EXTENSION FOR TESTING (NEW, ADDITIVE ONLY)
  // ----------------------------

  // A) Long ICE runway (tile 4) at ground-top layer (h-2)
  //    Start after your existing content so it doesn't interfere.
  const iceStart = 40;
  const iceLen   = 26; // long enough to feel glide
  for (let x = iceStart; x < iceStart + iceLen; x++){
    set(x, h - 2, 4);
  }

  // Small normal buffer
  for (let x = iceStart + iceLen; x < iceStart + iceLen + 6; x++){
    set(x, h - 2, 1);
  }

  // B) Long BRAKE runway (tile 5) at ground-top layer (h-2)
  const brakeStart = iceStart + iceLen + 6;
  const brakeLen   = 26; // long enough to feel heavy braking
  for (let x = brakeStart; x < brakeStart + brakeLen; x++){
    set(x, h - 2, 5);
  }

  // Buffer again
  for (let x = brakeStart + brakeLen; x < brakeStart + brakeLen + 6; x++){
    set(x, h - 2, 1);
  }

  // C) Mixed zone: alternating blocks so you feel the switch clearly
  let mix = brakeStart + brakeLen + 6;
  for (let i = 0; i < 8; i++){
    const id = (i % 2 === 0) ? 4 : 5; // ice, brake, ice, brake...
    const segLen = 6;
    for (let x = mix; x < mix + segLen; x++){
      set(x, h - 2, id);
    }
    mix += segLen;
  }

  // Optional: a couple of one-way steps above the runways (doesn't affect ground test)
  for (let x = 52; x <= 56; x++) set(x, 12, 2);
  for (let x = 78; x <= 82; x++) set(x, 10, 2);

  // ----------------------------
  // Level meta & entities (ORIGINAL, unchanged)
  // ----------------------------

  window.Lumo.Levels = window.Lumo.Levels || {};
  window.Lumo.Levels.level01 = {
    meta: {
      name: "level01_test_play",
      w, h,
      tileSize: ts,
      // recommended spawn in tile coords (player.setSpawn expects px later)
      spawn: { x: 4, y: h - 3 } // tile coords: near left side, a little above ground
    },
    layers: {
      main: data
    },
    entities: [
      // lanterns (chargers) that charge Lumo's energy when near
      { type: "lantern", x: 6, y: 12, radius: 160, strength: 0.9 },
      { type: "lantern", x: 21, y: 7, radius: 160, strength: 0.9 },
      { type: "lantern", x: 32, y: 10, radius: 140, strength: 0.85 },

      // pickups
      { type: "powerCell", x: 8, y: 12 },
      { type: "flarePickup", x: 14, y: 9, amount: 2 },

      // patrol enemy (basic)
      { type: "patrolEnemy", x: 28, y: h - 3, left: 26, right: 30 },

      // moving platform: 3 tiles wide, moves horizontally between two points
      // path given in tile coordinates -> engine converts to pixel coords
      {
        type: "movingPlatform",
        x: 14, y: 12,
        w: 3, h: 1,
        path: [
          { x: 14, y: 12 },
          { x: 28, y: 12 }
        ],
        speed: 90,
        loop: "pingpong",
        oneWay: true,
        carryVelocityToPlayer: true,
        pushoutSafety: 6
      },

      // a small platform up high (static entity platform)
      {
        type: "movingPlatform",
        x: 31, y: 9,
        w: 3, h: 1,
        path: [
          { x: 31, y: 9 },
          { x: 31, y: 13 }
        ],
        speed: 46,
        loop: "pingpong",
        oneWay: true,
        carryVelocityToPlayer: true
      },

      // a checkpoint near the start (used if app.js reads checkpoint)
      { type: "checkpoint", x: 4, y: h - 3 },

      // small decor / visual pickups to make the level feel alive
      { type: "flarePickup", x: 3, y: h - 3, amount: 1 }
    ]
  };
})();
