window.LUMO_CATALOG_ENTITIES = [
  {
    "id": "music_zone",
    "name": "MusicZone",
    "group": "Sound",
    "category": "sound",
    "img": "data/assets/sprites/sound/music.png",
    "anchor": "BL",
    "behaviorProfileId": "entity.sound.music_zone.v1",
    "visualProfileId": "visual.entity.bl",
    "themeTags": ["tech"],
    "defaults": {
      "soundFile": "data/assets/audio/music/space_loop_short.wav",
      "xStart": 0,
      "xEnd": 240,
      "volume": 0.7,
      "loop": true,
      "fadeTiles": 4
    },
    "shownParams": [
      "soundFile",
      "xStart",
      "xEnd",
      "volume",
      "loop",
      "fadeTiles"
    ]
  },
  {
    "id": "spot_sound",
    "name": "SpotSound",
    "group": "Sound",
    "category": "sound",
    "img": "data/assets/sprites/sound/spot.png",
    "anchor": "BL",
    "defaults": {
      "soundFile": "data/assets/audio/spot/machinery/door_close.wav",
      "radius": 120,
      "volume": 0.8,
      "loop": true,
      "fadeTiles": 2
    },
    "shownParams": [
      "soundFile",
      "radius",
      "volume",
      "loop",
      "fadeTiles"
    ]
  },
  {
    "id": "trigger_sound",
    "name": "TriggerSound",
    "group": "Sound",
    "category": "sound",
    "img": "data/assets/sprites/sound/trigger.png",
    "anchor": "BL",
    "defaults": {
      "soundFile": "data/assets/audio/events/creatures/void_creature.ogg",
      "triggerX": 0,
      "once": true,
      "volume": 1
    },
    "shownParams": [
      "soundFile",
      "triggerX",
      "once",
      "volume"
    ]
  },
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
    "behaviorProfileId": "entity.creature.dark_creature.v1",
    "visualProfileId": "visual.entity.bl",
    "themeTags": ["void", "dark"],
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
    "id": "hover_void_01",
    "name": "Hover Void",
    "group": "Creatures",
    "category": "decor",
    "img": "data/assets/sprites/creatures/void_m_04.png",
    "anchor": "BL",
    "behaviorProfileId": "entity.creature.hover_void.v1",
    "visualProfileId": "visual.entity.bl",
    "themeTags": ["void", "dark"],
    "defaults": {
      "aggroTiles": 7,
      "followTiles": 7,
      "maxHp": 3,
      "colorVariant": 0,
      "loseSightTiles": 11,
      "attackCooldownMin": 1,
      "attackCooldownMax": 3,
      "attackDamage": 12,
      "attackPushback": 180,
      "braveGroupSize": 3,
      "swarmGroupSize": 6
    },
    "shownParams": [
      "aggroTiles",
      "followTiles",
      "maxHp",
      "colorVariant",
      "loseSightTiles",
      "attackCooldownMin",
      "attackCooldownMax",
      "attackDamage",
      "attackPushback",
      "braveGroupSize",
      "swarmGroupSize"
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
    "category": "volume",
    "anchor": "TL",
    "paramMode": "json",
    "defaults": {
      "area": {
        "x0": 0,
        "x1": 288,
        "y0": 24,
        "falloff": 0
      },
      "look": {
        "density": 0.14,
        "lift": 8,
        "thickness": 44,
        "layers": 28,
        "noise": 0,
        "drift": 0,
        "color": "#E1EEFF",
        "exposure": 1
      },
      "smoothing": {
        "diffuse": 0.24,
        "relax": 0.24,
        "visc": 0.94
      },
      "interaction": {
        "radius": 92,
        "push": 2.4,
        "bulge": 2.2,
        "gate": 70
      },
      "organic": {
        "strength": 0,
        "scale": 1,
        "speed": 1
      },
      "render": {
        "blend": "screen",
        "lumoBehindFog": true
      }
    }
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

