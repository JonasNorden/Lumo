import { getTileIndex } from "../domain/level/levelDocument.js";

const width = 40;
const height = 22;
const tileSize = 24;
const base = new Array(width * height).fill(0);

for (let x = 0; x < width; x += 1) {
  base[getTileIndex(width, x, height - 3)] = 1;
  base[getTileIndex(width, x, height - 2)] = 1;
}

for (let x = 8; x < 18; x += 1) {
  base[getTileIndex(width, x, 12)] = 1;
}

for (let y = 7; y < 13; y += 1) {
  base[getTileIndex(width, 23, y)] = 2;
}

for (let x = 26; x < 33; x += 1) {
  base[getTileIndex(width, x, 9)] = 3;
}

export const mockLevelDocument = {
  meta: {
    id: "v2-demo-01",
    name: "V2 Demo Chamber",
    version: "2.0.0",
  },
  dimensions: {
    width,
    height,
    tileSize,
  },
  tiles: {
    base,
  },
  backgrounds: {
    layers: [
      {
        id: "sky",
        name: "Sky",
        type: "color",
        depth: 0,
        visible: true,
        color: "#19253a",
      },
      {
        id: "mountains",
        name: "Mountains",
        type: "color",
        depth: 0.3,
        visible: true,
        color: "#243047",
      },
      {
        id: "hills",
        name: "Hills",
        type: "color",
        depth: 0.55,
        visible: true,
        color: "#2f3d5d",
      },
    ],
  },
  entities: [
    {
      id: "entity-1",
      name: "Player Spawn",
      type: "player-spawn",
      x: 6,
      y: 14,
      visible: true,
      params: {},
    },
    {
      id: "entity-2",
      name: "Lantern",
      type: "lantern",
      x: 15,
      y: 11,
      visible: true,
      params: {
        lightRadius: 6,
        flicker: true,
      },
    },
    {
      id: "entity-3",
      name: "Trigger",
      type: "trigger",
      x: 19,
      y: 14,
      visible: true,
      params: {
        event: "open-door",
        radius: 2,
      },
    },
    {
      id: "entity-4",
      name: "Checkpoint",
      type: "checkpoint",
      x: 29,
      y: 8,
      visible: true,
      params: {
        respawnId: "cp-1",
      },
    },
    {
      id: "entity-5",
      name: "Generic",
      type: "generic",
      x: 34,
      y: 17,
      visible: true,
      params: {},
    },
  ],
  extra: {
    notes: "Read-only prototype document for V2 rendering pipeline.",
  },
};
