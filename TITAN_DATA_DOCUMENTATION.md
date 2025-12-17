# Titan Data Documentation

This document describes the structure and properties of Titan objects used in Hero Wars Helper extensions.

## Overview

Titans are powerful creatures that players can use in battles. Each titan has unique stats, abilities, and belongs to one of five elements: Water, Fire, Earth, Dark, or Light.

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
| `id` | `number` | Unique identifier for the titan (4000-4043) |
| `isPlayable` | `number` | Whether the titan can be used in battles (1 = yes, 0 = no) |
| `type` | `string` | Titan combat type: `"melee"`, `"range"`, `"support"`, `"ultra"`, or `"summoner"` |
| `element` | `string` | Elemental affinity: `"water"`, `"fire"`, `"earth"`, `"dark"`, or `"light"` |
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

### Water Element (4000-4003)
- **4000** - Sigurd (Melee Tank, Front)
- **4001** - Nova (Range DPS, Middle)
- **4002** - Keros (Support, Back)
- **4003** - Hyperion (Ultra, Back) - Starts at 3 stars

### Fire Element (4010-4014)
- **4010** - Moloch (Melee Tank, Front)
- **4011** - Ignis (Range DPS, Middle)
- **4012** - Vulcan (Support, Back)
- **4013** - Aradgi (Ultra, Back) - Starts at 3 stars
- **4014** - Solaris (Summoner, Middle) - Special shop titan

### Earth Element (4020-4024)
- **4020** - Angus (Melee Tank, Front)
- **4021** - Sylva (Range DPS, Back)
- **4022** - Eden (Support, Middle)
- **4023** - Iyari (Ultra, Back) - Starts at 3 stars
- **4024** - Keros (Summoner, Middle) - Special shop titan

### Dark Element (4030-4033)
- **4030** - Dark Titan (Melee, Front)
- **4031** - Dark Titan (Range, Middle)
- **4032** - Dark Titan (Support, Middle)
- **4033** - Dark Titan (Ultra, Back) - Starts at 3 stars

### Light Element (4040-4043)
- **4040** - Light Titan (Melee, Front)
- **4041** - Light Titan (Range, Middle)
- **4042** - Light Titan (Support, Back)
- **4043** - Light Titan (Ultra, Back) - Starts at 3 stars

## Titan Types

### Melee
Front-line fighters with high HP and moderate attack. Examples: Sigurd (4000), Moloch (4010), Angus (4020)

### Range
Mid-to-back line damage dealers. Examples: Nova (4001), Ignis (4011), Sylva (4021)

### Support
Back-line titans that provide buffs/healing. Examples: Keros (4002), Vulcan (4012), Eden (4022)

### Ultra
Powerful titans that start at 3 stars. Examples: Hyperion (4003), Aradgi (4013), Iyari (4023)

### Summoner
Special titans that can summon units. Examples: Solaris (4014), Keros (4024)

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
// Assuming titanData is the loaded JSON object
const sigurd = titanData["4000"];
console.log(sigurd.element); // "water"
console.log(sigurd.type); // "melee"
console.log(sigurd.stars["1"].battleStatData.hp); // "1100"
```

### Filtering by Element

```javascript
// Get all water titans
const waterTitans = Object.values(titanData).filter(t => t.element === "water");

// Get all fire titans
const fireTitans = Object.values(titanData).filter(t => t.element === "fire");
```

### Filtering by Type

```javascript
// Get all melee titans
const meleeTitans = Object.values(titanData).filter(t => t.type === "melee");

// Get all ultra titans
const ultraTitans = Object.values(titanData).filter(t => t.type === "ultra");
```

### Getting Star Level Stats

```javascript
function getTitanStats(titanId, starLevel) {
    const titan = titanData[titanId.toString()];
    if (!titan || !titan.stars[starLevel]) {
        return null;
    }
    return titan.stars[starLevel].battleStatData;
}

// Example: Get Sigurd's stats at 3 stars
const sigurdStats = getTitanStats(4000, "3");
// Returns: { hp: "2200", physicalAttack: "135" }
```

## Special Titans

### Summoner Titans
- **4014 (Solaris)** - Fire element summoner, available from special shop
- **4024 (Keros)** - Earth element summoner, available from special shop

These titans have the `"summoner"` type and special perks (24, 23).

### Ultra Titans
Ultra titans are more powerful and start at 3 stars minimum:
- Water: Hyperion (4003)
- Fire: Aradgi (4013)
- Earth: Iyari (4023)
- Dark: Dark Ultra (4033)
- Light: Light Ultra (4043)

## Notes

1. **HP and Attack Values**: Some titans have HP/attack as strings, others as numbers. Always parse when doing calculations.

2. **Star Levels**: Regular titans have stars 1-6, Ultra titans have stars 3-6.

3. **Elemental Affinity**: Titans are strong/weak against other elements in a rock-paper-scissors system:
   - Water > Fire
   - Fire > Earth
   - Earth > Water
   - Dark/Light are neutral

4. **Spirit Artifacts**: Each element has a corresponding spirit artifact:
   - Water: 4001
   - Fire: 4002
   - Earth: 4003
   - Dark: 4004
   - Light: 4005

5. **Role Positioning**: 
   - `"front"` - Front line (tanks)
   - `"middle"` - Mid line (DPS/support)
   - `"back"` - Back line (support/DPS)

## Related Files

- `HWD extention RED-1.0.7.test.js` - Uses titan IDs for team composition
- `HeroWarsHelper - Auto Daily Extension.user.js` - Uses titan data for dungeon optimization

