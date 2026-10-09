# Titan Data Documentation

This document describes the structure and properties of Titan objects used in Hero Wars Helper extensions (`lib.getData('titan')` / `lib.data.titan`).

## Overview

Titans are powerful creatures used in dungeon, Guild War, and Tournament of the Elements. Each titan has unique stats, abilities, and belongs to one of six elements: Water, Fire, Earth, Dark, Light, or Distortion.

## Data Structure

### Root Object
The titan data is stored as a JSON object where each key is the titan's ID (as a string), and the value is a Titan object.

```json
{
    "4000": { /* Titan object */ },
    "4001": { /* Titan object */ },
    ...
}
```

## Titan Object Properties

### Core Properties

| Property | Type | Description |
|----------|------|-------------|
| `id` | `number` | Unique identifier for the titan (4000–4054+) |
| `isPlayable` | `number` | Whether the titan can be used in battles (1 = yes, 0 = no) |
| `type` | `string` | Titan combat type: `"melee"`, `"range"`, `"support"`, `"ultra"`, or `"summoner"` |
| `element` | `string` | Elemental affinity: `"water"`, `"fire"`, `"earth"`, `"dark"`, `"light"`, or `"distortion"` |
| `perk` | `number[]` | Array of perk IDs that define special abilities |
| `squareIcon` | `string` | Icon identifier for UI display (format: `"titan_160_{id}"`) |
| `artifacts` | `number[]` | Array of artifact IDs that can be equipped |
| `roleExtended` | `string[]` or `null` | Extended role classifications (e.g., `["melee_tank"]`, `["ranged_dps"]`) |
| `spiritArtifact` | `number` | ID of the spirit artifact associated with this element |
| `stars` | `object` | Star level data (see Stars Object below) |
| `obtainTypes` | `string` | JSON string array describing how to obtain the titan |
| `role` | `string` | Battle position: `"front"`, `"middle"`, or `"back"` |

### Stars Object

Each titan has a `stars` object containing battle statistics for each star level. Regular titans have stars 1-6, while Ultra titans start at star 3.

```json
"stars": {
    "1": {
        "battleStatData": {
            "hp": "1100",
            "physicalAttack": "68"
        }
    },
    "2": { /* ... */ },
    ...
}
```

**Star Level Properties:**
- `battleStatData.hp`: Health points (as string or number)
- `battleStatData.physicalAttack`: Physical attack damage (as string or number)

## Titan Elements and IDs

ID ranges by element (used by Auto Daily dungeon bucketing):

| Element | ID range |
|---------|----------|
| Water | 4000–4009 |
| Fire | 4010–4019 |
| Earth | 4020–4029 |
| Dark | 4030–4039 |
| Light | 4040–4049 |
| Distortion | 4050–4059 |

### Water Element (4000-4004)
- **4000** - Sigurd (Melee Tank, Front)
- **4001** - Nova (Range DPS, Middle)
- **4002** - Mairi (Support, Back)
- **4003** - Hyperion (Ultra, Back) - Starts at 3 stars
- **4004** - Tidus and Gelo (Summoner, Middle)

### Fire Element (4010-4014)
- **4010** - Moloch (Melee Tank, Front)
- **4011** - Vulcan (Range DPS, Middle)
- **4012** - Ignis (Support, Back)
- **4013** - Araji (Ultra, Back) - Starts at 3 stars
- **4014** - Asherona and Pyro (Summoner, Middle)

### Earth Element (4020-4024)
- **4020** - Angus (Melee Tank, Front)
- **4021** - Sylva (Range DPS, Back)
- **4022** - Avalon (Support, Middle)
- **4023** - Eden (Ultra, Back) - Starts at 3 stars
- **4024** - Verdoc and Phyto (Summoner, Middle)

### Dark Element (4030-4034)
- **4030** - Brustar (Melee, Front)
- **4031** - Keros (Range, Middle)
- **4032** - Mort (Support, Middle)
- **4033** - Tenebris (Ultra, Back) - Starts at 3 stars
- **4034** - Umbra and Caligo (Summoner) - Dark summoner pair

### Light Element (4040-4044)
- **4040** - Rigel (Melee, Front)
- **4041** - Amon (Range, Middle)
- **4042** - Iyari (Support, Back)
- **4043** - Solaris (Ultra, Back) - Starts at 3 stars
- **4044** - Lumira and Apollo (Summoner) - Light summoner pair

### Distortion Element (4051, 4054)
- **4051** - Alecto (Range / Marksman)
- **4054** - Valdur and Echo (Summoner)

> Note: Distortion IDs are sparse (no 4050/4052/4053 playable entries in current lib data).

## Playable Titan Snapshot (`lib.data.titan`)

All currently playable titans (`isPlayable: 1`):

| ID | Type | Element |
|----|------|---------|
| 4000 | melee | water |
| 4001 | range | water |
| 4002 | support | water |
| 4003 | ultra | water |
| 4004 | summoner | water |
| 4010 | melee | fire |
| 4011 | range | fire |
| 4012 | support | fire |
| 4013 | ultra | fire |
| 4014 | summoner | fire |
| 4020 | melee | earth |
| 4021 | range | earth |
| 4022 | support | earth |
| 4023 | ultra | earth |
| 4024 | summoner | earth |
| 4030 | melee | dark |
| 4031 | range | dark |
| 4032 | support | dark |
| 4033 | ultra | dark |
| 4034 | summoner | dark |
| 4040 | melee | light |
| 4041 | range | light |
| 4042 | support | light |
| 4043 | ultra | light |
| 4044 | summoner | light |
| 4051 | range | distortion |
| 4054 | summoner | distortion |

## Titan Types

### Melee
Front-line fighters with high HP and moderate attack. Examples: Sigurd (4000), Moloch (4010), Angus (4020), Brustar (4030), Rigel (4040)

### Range
Mid-to-back line damage dealers. Examples: Nova (4001), Vulcan (4011), Sylva (4021), Keros (4031), Amon (4041), Alecto (4051)

### Support
Back-line titans that provide buffs/healing. Examples: Mairi (4002), Ignis (4012), Avalon (4022), Mort (4032), Iyari (4042)

### Ultra
Powerful titans that start at 3 stars. Examples: Hyperion (4003), Araji (4013), Eden (4023), Tenebris (4033), Solaris (4043)

### Summoner
Special dual-unit titans. Examples:
- Water: Tidus and Gelo (4004)
- Fire: Asherona and Pyro (4014)
- Earth: Verdoc and Phyto (4024)
- Dark: Umbra and Caligo (4034)
- Light: Lumira and Apollo (4044)
- Distortion: Valdur and Echo (4054)

## Obtain Types

The `obtainTypes` field is a JSON string array that describes how to obtain the titan:

- `"[\"titan_dungeon\",\"titan_summoning_circle\"]"` - Available from dungeon and summoning
- `"[\"titan_summoning_circle\"]"` - Only from summoning (Ultra titans)
- `"[\"shop:invasion:1080\"]"` - Special shop purchase (Solaris)
- `"[\"shop:invasion:1075\"]"` - Special shop purchase (Keros)

## Role Extended Classifications

Extended roles provide more specific classifications:

- `"melee_tank"` - Front-line tank titans
- `"ranged_dps"` - Ranged damage dealers
- `"support"` - Support/healing titans
- `"mage"` - Magic-based titans
- `"summoner"` - Summoner titans

## Usage in Code

### Accessing Titan Data

```javascript
const titanLib = lib.getData('titan');
const sigurd = titanLib[4000];
console.log(sigurd.element); // "water"
console.log(sigurd.type); // "melee"
```

### Filtering by Element

```javascript
const waterTitans = Object.values(titanLib).filter(t => t.element === "water");
const distortionTitans = Object.values(titanLib).filter(t => t.element === "distortion");
```

### Filtering by Type

```javascript
const meleeTitans = Object.values(titanLib).filter(t => t.type === "melee");
const ultraTitans = Object.values(titanLib).filter(t => t.type === "ultra");
const summoners = Object.values(titanLib).filter(t => t.type === "summoner");
```

### ID Range Bucketing (Auto Daily dungeon)

```javascript
function titanElementFromId(id) {
    if (id < 4010) return 'water';
    if (id < 4020) return 'fire';
    if (id < 4030) return 'earth';
    if (id < 4040) return 'dark';
    if (id < 4050) return 'light';
    if (id < 4060) return 'distortion';
    return 'unknown';
}
```

## Special Titans

### Summoner Titans
| ID | Name | Element |
|----|------|---------|
| 4004 | Tidus and Gelo | water |
| 4014 | Asherona and Pyro | fire |
| 4024 | Verdoc and Phyto | earth |
| 4034 | Umbra and Caligo | dark |
| 4044 | Lumira and Apollo | light |
| 4054 | Valdur and Echo | distortion |

### Ultra Titans
| ID | Name | Element |
|----|------|---------|
| 4003 | Hyperion | water |
| 4013 | Araji | fire |
| 4023 | Eden | earth |
| 4033 | Tenebris | dark |
| 4043 | Solaris | light |

## Notes

1. **HP and Attack Values**: Some titans have HP/attack as strings, others as numbers. Always parse when doing calculations.

2. **Star Levels**: Regular titans have stars 1-6, Ultra titans have stars 3-6.

3. **Elemental Affinity**:
   - Water > Fire > Earth > Water (classic cycle)
   - Dark and Light counter each other
   - Distortion has advantage over Light/Dark and is vulnerable to Water/Fire/Earth

4. **Spirit Artifacts**: Each element has a corresponding spirit artifact:
   - Water: 4001
   - Fire: 4002
   - Earth: 4003
   - Dark: 4004
   - Light: 4005
   - Distortion: (see `lib.data.titanSpirit` / in-game spirit artifacts)

5. **Role Positioning**:
   - `"front"` - Front line (tanks)
   - `"middle"` - Mid line (DPS/support)
   - `"back"` - Back line (support/DPS)

6. **Display names**: Prefer `cheats.translate('LIB_TITAN_NAME_' + id)`; offline map in `hero-names.mjs` → `TITAN_NAMES`.

## Related Files

- `hero-names.mjs` - Offline titan/hero/pet name maps
- `HeroWarsHelper - Auto Daily Extension.user.js` - Dungeon titan bucketing and team selection
- `HERO_WARS_API_DOCUMENTATION.md` - Titan ID reference tables
- `LIB_DATA_DOCUMENTATION.md` - `lib.data.titan` overview
