(() => {
  window.Lumo = window.Lumo || {};
  Lumo.TILE = 24;

  // Tile ids:
  // 0 empty
  // 1 solid
  // 2 oneWay platform
  // 3 hazard (spikes)
  // 4 ice (speed-way)
  // 5 brake-way
  //
  // Custom build-tiles (solid):
  // 6 grass_bt
  // 7 grass_bl
  // 8 grass_br
  // 9 soil_bc
  // 10 soil_bl
  // 11 soil_br
  // 12 soil_c
  // 13 soil_cl
  // 14 soil_cr
  // 15 stone_ct (48x48, 2x2 footprint)

  // ice/brake are SOLID tiles. Their feel is applied in player.js via multipliers.
  Lumo.Tileset = {
    0: { name: "empty", solid: false, oneWay: false, hazard: false, color: null },

    1: { name: "stone", solid: true, oneWay: false, hazard: false, color: "#2f3b4d" },
    2: { name: "platform", solid: true, oneWay: true, hazard: false, color: "#3a4a63" },

    // Hazard should be non-solid so it doesn't block movement.
    3: { name: "spikes", solid: false, oneWay: false, hazard: true, color: "#6b2d2d" },

    // ICE: harder to brake and harder to change direction (slippery).
    4: {
      name: "ice",
      solid: true,
      oneWay: false,
      hazard: false,
      color: "#36506a",
      speedMul: 1.10,     // behåll fartkänslan
      accelMul: 0.45,     // mindre tvärvändning men inte "trög och död"
      frictionMul: 0.01   // mycket halare => tar 2–3 tiles att stoppa
    },

    // BRAKE: strong resistance, noticeable slow-down.
    5: {
      name: "brake",
      solid: true,
      oneWay: false,
      hazard: false,
      color: "#2b2f36",
      speedMul: 0.40,     // lite lägre toppfart så det känns "segare"
      accelMul: 0.75,     // lite tyngre start/ändring
      frictionMul: 6.40   // exakt dubbelt -> tydlig broms
    },

    // --- Your 9 build-tiles (all SOLID) ---
    6:  { name: "grass_bt", solid: true, oneWay: false, hazard: false, color: "#284a2f" },
    7:  { name: "grass_bl", solid: true, oneWay: false, hazard: false, color: "#284a2f" },
    8:  { name: "grass_br", solid: true, oneWay: false, hazard: false, color: "#284a2f" },

    9:  { name: "soil_bc",  solid: true, oneWay: false, hazard: false, color: "#3a2b1f" },
    10: { name: "soil_bl",  solid: true, oneWay: false, hazard: false, color: "#3a2b1f" },
    11: { name: "soil_br",  solid: true, oneWay: false, hazard: false, color: "#3a2b1f" },
    12: { name: "soil_c",   solid: true, oneWay: false, hazard: false, color: "#3a2b1f" },
    13: { name: "soil_cl",  solid: true, oneWay: false, hazard: false, color: "#3a2b1f" },
    14: { name: "soil_cr",  solid: true, oneWay: false, hazard: false, color: "#3a2b1f" },

    15: { name: "stone_ct", solid: true, oneWay: false, hazard: false, color: "#2f3b4d" }
  };
})();
