// data/catalog_tiles.js
// Source of truth for gameplay Tiles (grid).
// PNGs live under: data/assets/tiles/
// NOTE: Editor uses tileId for placement. Runtime uses tileId for collision.
// Visual rendering of tile PNGs is handled by editor/runtime renderer (se patch).

window.LUMO_CATALOG_TILES = [
  // --- GRASS (draw 24x32, but collision remains 24x24 via tile grid) ---
  {
    id: "grass_bt",
    name: "Grass BT",
    group: "Grass",
    img: "data/assets/tiles/grass_bt.png",
    footprint: { w: 1, h: 1 },
    tileId: 6,
    collisionType: "solid",
    special: null,

    // Optional draw metadata for renderers that support it
    drawW: 24,
    drawH: 32,
    drawAnchor: "BL",   // bottom-left anchored => extends upward by 8px
    drawOffX: 0,
    drawOffY: 0
  },
  {
    id: "grass_bl",
    name: "Grass BL",
    group: "Grass",
    img: "data/assets/tiles/grass_bl.png",
    footprint: { w: 1, h: 1 },
    tileId: 7,
    collisionType: "solid",
    special: null,

    drawW: 24,
    drawH: 32,
    drawAnchor: "BL",
    drawOffX: 0,
    drawOffY: 0
  },
  {
    id: "grass_br",
    name: "Grass BR",
    group: "Grass",
    img: "data/assets/tiles/grass_br.png",
    footprint: { w: 1, h: 1 },
    tileId: 8,
    collisionType: "solid",
    special: null,

    drawW: 24,
    drawH: 32,
    drawAnchor: "BL",
    drawOffX: 0,
    drawOffY: 0
  },

  // --- SOIL (standard 24x24 draw + collision) ---
  {
    id: "soil_bc",
    name: "Soil BC",
    group: "Soil",
    img: "data/assets/tiles/soil_bc.png",
    footprint: { w: 1, h: 1 },
    tileId: 9,
    collisionType: "solid",
    special: null
  },
  {
    id: "soil_bl",
    name: "Soil BL",
    group: "Soil",
    img: "data/assets/tiles/soil_bl.png",
    footprint: { w: 1, h: 1 },
    tileId: 10,
    collisionType: "solid",
    special: null
  },
  {
    id: "soil_br",
    name: "Soil BR",
    group: "Soil",
    img: "data/assets/tiles/soil_br.png",
    footprint: { w: 1, h: 1 },
    tileId: 11,
    collisionType: "solid",
    special: null
  },
  {
    id: "soil_c",
    name: "Soil C",
    group: "Soil",
    img: "data/assets/tiles/soil_c.png",
    footprint: { w: 1, h: 1 },
    tileId: 12,
    collisionType: "solid",
    special: null
  },
  {
    id: "soil_cl",
    name: "Soil CL",
    group: "Soil",
    img: "data/assets/tiles/soil_cl.png",
    footprint: { w: 1, h: 1 },
    tileId: 13,
    collisionType: "solid",
    special: null
  },
  {
    id: "soil_cr",
    name: "Soil CR",
    group: "Soil",
    img: "data/assets/tiles/soil_cr.png",
    footprint: { w: 1, h: 1 },
    tileId: 14,
    collisionType: "solid",
    special: null
  }

  ,
  // --- STONE (2x2, solid, BL-anchored) ---
  {
    id: "stone_ct",
    name: "Stone CT",
    group: "Stone",
    img: "data/assets/tiles/stone_ct.png",
    footprint: { w: 2, h: 2 },
    tileId: 15,
    collisionType: "solid",
    special: null,

    // draw metadata (48x48 PNG, anchored bottom-left)
    drawW: 48,
    drawH: 48,
    drawAnchor: "BL",
    drawOffX: 0,
    drawOffY: 0
  }


  ,
  // --- ICE (24x24 draw + collision) ---
  // ice_00: solid, normal friction (non-slippery)
  {
    id: "ice_00",
    name: "Ice 00",
    group: "Ice",
    img: "data/assets/tiles/ice_00.png",
    footprint: { w: 1, h: 1 },
    tileId: 16,
    collisionType: "solid",
    special: null
  },
  // ice_01: solid + slippery surface (uses Tileset id=4 behaviour)
  {
    id: "ice_01",
    name: "Ice 01 (Slippery)",
    group: "Ice",
    img: "data/assets/tiles/ice_01.png",
    footprint: { w: 1, h: 1 },
    tileId: 4,
    collisionType: "solid",
    special: "ice"
  }

];
