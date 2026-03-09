window.LUMO_CATALOG_ENTITIES = [
  {
    "id": "start_01",
    "name": "Start",
    "group": "Core",
    "category": "decor",
    "img": "data/assets/sprites/core/start_01.png",
    "anchor": "BL"
  },
  {
    "id": "checkpoint_01",
    "name": "Checkpoint",
    "group": "Core",
    "category": "decor",
    "img": "data/assets/sprites/lights/lantern_2.png",
    "anchor": "BL"
  },
  {
    "id": "exit_01",
    "name": "Exit",
    "group": "Core",
    "category": "decor",
    "img": "data/assets/sprites/core/exit_01.png",
    "anchor": "BL"
  },
  {
    "id": "lantern_01",
    "name": "Lantern",
    "group": "Lights",
    "category": "decor",
    "img": "data/assets/sprites/lights/lantern_01.png",
    "anchor": "BL",
    "defaults": {
      "radius": 170,
      "strength": 0.85
    },
    "shownParams": [
      "radius",
      "strength"
    ]
  },
  {
    "id": "powercell_01",
    "name": "Power-cell",
    "group": "Energy",
    "category": "decor",
    "img": "data/assets/sprites/energy/powercell_01.png",
    "anchor": "BL"
  },
  {
    "id": "dark_creature_01",
    "name": "Dark Creature",
    "group": "Creatures",
    "category": "decor",
    "img": "data/assets/sprites/creatures/dc_idle_3.png",
    "anchor": "BL",
    "defaults": {
      "hp": 3,
      "hitCooldown": 0.6,
      "safeDelay": 0.6,
      "patrolTiles": 0,
      "aggroTiles": 0,
      "castCooldown": 5.5,
      "energyLoss": 40,
      "knockbackX": 260,
      "knockbackY": -220,
      "reactsToFlares": true
    },
    "shownParams": [
      "hp",
      "hitCooldown",
      "safeDelay",
      "patrolTiles",
      "aggroTiles",
      "castCooldown",
      "energyLoss",
      "knockbackX",
      "knockbackY",
      "reactsToFlares"
    ]
  },
  {
    "id": "decor_flower_01",
    "name": "Flower",
    "group": "Decor",
    "category": "decor",
    "img": "data/assets/sprites/decor/flower_01.png",
    "w": 24,
    "h": 40,
    "anchor": "BL",
    "perchOffsetY": 15
  },
  {
    "id": "firefly_01",
    "name": "Firefly",
    "group": "Lights",
    "category": "decor",
    "img": "data/assets/sprites/lights/firefly_01.png",
    "anchor": "BL"
  ,
    "defaults": {
        "lightDiameter": 240,
        "lightStrength": 0.8,
        "aggroTiles": 6,
        "flyRadius": 5,
        "flyRangeX": 5,
        "flyRangeYUp": 5,
        "flySpeed": 45,
        "smooth": 7.0,
        "flyTime": 2.5,
        "cooldown": 2.0,
        "fadeIn": 0.35,
        "fadeOut": 0.45,
        "perchSearchRadius": 6
    },
    "shownParams": [
        "lightDiameter",
        "lightStrength",
        "flyRangeX",
        "flyRangeYUp",
        "flySpeed",
        "smooth",
        "flyTime",
        "aggroTiles",
        "perchSearchRadius",
        "cooldown",
        "fadeIn",
        "fadeOut"
    ]
  },
  {
    "id": "fog_volume",
    "name": "Fog Volume",
    "group": "Volumes",
    "category": "decor",
    "anchor": "TL"
  },
  {
    "id": "donkey",
    "name": "Donkey",
    "group": "Decor",
    "category": "decor",
    "img": "data/assets/sprites/decor/donkey.png",
    "w": 60,
    "h": 60,
    "anchor": "BL"
  },
  {
    "id": "ice_cream",
    "name": "IceCream",
    "group": "Decor",
    "category": "decor",
    "img": "data/assets/sprites/decor/icecream.png",
    "w": 60,
    "h": 48,
    "anchor": "BL"
  },
  {
    "id": "raspberry",
    "name": "Raspberry",
    "group": "Decor",
    "category": "decor",
    "img": "data/assets/sprites/decor/raspberry.png",
    "w": 32,
    "h": 32,
    "anchor": "BL"
  },
  {
    "id": "poop",
    "name": "Poop",
    "group": "Decor",
    "category": "decor",
    "img": "data/assets/sprites/decor/poop.png",
    "w": 36,
    "h": 32,
    "anchor": "BL"
  },
  {
    "id": "flare_pickup_01",
    "name": "Flare Pickup",
    "group": "Pickups",
    "category": "decor",
    "img": "data/assets/sprites/pickups/flare_pickup_01.png",
    "anchor": "BL"
  },
  {
    "id": "apple",
    "name": "Apple",
    "group": "Decor",
    "category": "decor",
    "img": "data/assets/sprites/decor/apple.png",
    "w": 24,
    "h": 48,
    "anchor": "TL"
  },
  {
    "id": "boar",
    "name": "Boar",
    "group": "Decor",
    "category": "decor",
    "img": "data/assets/sprites/decor/boar_01.png",
    "w": 72,
    "h": 96,
    "anchor": "TL"
  },
  {
    "id": "painting_01",
    "name": "Painting 1",
    "group": "Decor",
    "category": "decor",
    "img": "data/assets/sprites/decor/painting_01.png",
    "w": 96,
    "h": 120,
    "anchor": "TL"
  },
  {
    "id": "painting_02",
    "name": "Painting 2",
    "group": "Decor",
    "category": "decor",
    "img": "data/assets/sprites/decor/painting_02.png",
    "w": 72,
    "h": 96,
    "anchor": "TL"
  },
  {
    "id": "painting_03",
    "name": "Painting 3",
    "group": "Decor",
    "category": "decor",
    "img": "data/assets/sprites/decor/painting_03.png",
    "w": 72,
    "h": 120,
    "anchor": "TL"
  },
  {
    "id": "painting_04",
    "name": "Painting 4",
    "group": "Decor",
    "category": "decor",
    "img": "data/assets/sprites/decor/painting_04.png",
    "w": 148,
    "h": 120,
    "anchor": "TL"
  },
  {
    "id": "painting_05",
    "name": "Painting 5",
    "group": "Decor",
    "category": "decor",
    "img": "data/assets/sprites/decor/painting_06.png",
    "w": 72,
    "h": 96,
    "anchor": "TL"
  },
  {
    "id": "painting_06",
    "name": "Painting 6",
    "group": "Decor",
    "category": "decor",
    "img": "data/assets/sprites/decor/painting_07.png",
    "w": 72,
    "h": 120,
    "anchor": "TL"
  },
  {
    "id": "banner",
    "name": "Banner",
    "group": "Decor",
    "category": "decor",
    "img": "data/assets/sprites/decor/banner_01.png",
    "w": 120,
    "h": 288,
    "anchor": "TL"
  }
]
