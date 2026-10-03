# Hero Data Documentation

This document describes the structure and properties of Hero objects used in Hero Wars Helper extensions.

## Overview

Heroes are the main playable characters in Hero Wars. Each hero has unique stats, abilities, artifacts, and belongs to different roles and character types. Heroes can be upgraded through stars (1-6), colors (1-18), and have various battle statistics.

## Data Structure

### Root Object
The hero data is stored as a JSON object where each key is the hero's ID (as a string), and the value is a Hero object.

```json
{
    "1": { /* Hero object */ },
    "2": { /* Hero object */ },
    ...
}
```

## Hero Object Properties

### Core Properties

| Property | Type | Description |
|----------|------|-------------|
| `id` | `number` | Unique identifier for the hero (typically 1-100+) |
| `type` | `string` | Hero type: `"hero"` (playable) or `"creep"` (enemy/monster) |
| `mainStat` | `string` | Primary stat: `"strength"`, `"agility"`, or `"intelligence"` |
| `battleOrder` | `number` | Battle position order (0-100+) |
| `scale` | `number` or `null` | Scale factor for display (e.g., 1.5) |
| `role` | `string` or `null` | Battle position: `"front"`, `"middle"`, or `"back"` |
| `roleExtended` | `string[]` or `null` | Extended role classifications (e.g., `["melee_tank"]`, `["ranged_dps"]`) |
| `characterType` | `string` or `null` | Character classification: `"warrior"`, `"demon"`, `"snob"`, `"healer"`, `"cutie"` |
| `asset` | `string` | Asset identifier for the hero model (e.g., `"hero01_aurora"`, `"demon"`) |
| `iconAssetAtlas` | `number` | Icon atlas ID for UI display |
| `iconAssetTexture` | `string` | Icon texture identifier (e.g., `"0001"`, `"0004"`) |
| `obtainType` | `string` or `null` | How to obtain the hero (JSON string or null) |
| `silhouette` | `string` or `null` | Silhouette type (e.g., `"flying"`) |
| `perk` | `number[]` or `null` | Array of perk IDs that define special abilities |
| `artifacts` | `number[]` or `null` | Array of artifact IDs that can be equipped |
| `runes` | `number[]` or `null` | Array of rune IDs |
| `skill` | `object` or `null` | Object mapping skill slots to skill IDs (e.g., `{"0": 1, "1": 2, "2": 3, "3": 4, "4": 5}`) |
| `fragmentBuyCost` | `object` or `null` | Cost to buy hero fragments (e.g., `{"starmoney": 40}`) |
| `fragmentSellCost` | `object` or `null` | Gold received when selling fragments (e.g., `{"gold": 4000}`) |
| `fragmentSpecialCost` | `number` | Special currency cost for fragments (typically 100) |
| `lockedUntil` | `number` or `null` | Timestamp or level requirement to unlock |
| `ultCinematic` | `object` or `null` | Ultimate ability cinematic data (e.g., `{"ident": "hero01_battle_animation"}`) |
| `epicArtAsset` | `object` or `null` | Epic art asset configuration |
| `spineEpicArtAsset` | `object` or `null` | Spine epic art asset (e.g., `{"name": "Aurora"}`) |
| `sfxAsset` | `string` or `null` | Sound effects asset identifier (e.g., `"hero01_sfx"`) |
| `musicAsset` | `object` or `null` | Music asset configuration |
| `assetsIdent` | `string` or `null` | Additional asset identifier |

### Base Stats Object

Each hero has a `baseStats` object containing initial stat values:

```json
"baseStats": {
    "agility": 10,
    "hp": 500,
    "intelligence": 15,
    "physicalAttack": 55,
    "strength": 20
}
```

**Base Stats Properties:**
- `agility`: Agility stat value
- `hp`: Health points
- `intelligence`: Intelligence stat value
- `physicalAttack`: Physical attack damage
- `strength`: Strength stat value

### Stars Object

Each hero has a `stars` object containing battle statistics for each star level (1-6). Regular heroes have stars 1-6, while some special heroes may start at higher star levels.

```json
"stars": {
    "1": {
        "battleStatData": {
            "agility": 3,
            "armor": 0,
            "armorPenetration": 0,
            "dodge": 0,
            "hp": 0,
            "intelligence": 3,
            "lifesteal": 0,
            "magicPenetration": 0,
            "magicPower": 0,
            "magicResist": 0,
            "physicalAttack": 0,
            "physicalCritChance": 0,
            "strength": 4
        }
    },
    "2": { /* ... */ },
    ...
}
```

**Star Level Properties:**
- `battleStatData.agility`: Agility bonus
- `battleStatData.armor`: Physical armor
- `battleStatData.armorPenetration`: Physical armor penetration
- `battleStatData.dodge`: Dodge chance
- `battleStatData.hp`: Health points bonus
- `battleStatData.intelligence`: Intelligence bonus
- `battleStatData.lifesteal`: Lifesteal percentage
- `battleStatData.magicPenetration`: Magic penetration
- `battleStatData.magicPower`: Magic power
- `battleStatData.magicResist`: Magic resistance
- `battleStatData.physicalAttack`: Physical attack bonus
- `battleStatData.physicalCritChance`: Physical critical hit chance
- `battleStatData.strength`: Strength bonus

### Color Object

Each hero has a `color` object containing upgrade progression data for each color level (1-18). Color 1 typically only has `items`, while colors 2-18 include both `battleStatData` and `items`.

```json
"color": {
    "1": {
        "items": [1, 7, 6, 2, 13, 4]
    },
    "2": {
        "battleStatData": {
            "agility": 7,
            "hp": 585,
            "intelligence": 12,
            "magicPower": 25,
            "physicalAttack": 12,
            "strength": 7
        },
        "items": [6, 7, 10, 18, 25, 27]
    },
    ...
}
```

**Color Level Properties:**
- `items`: Array of item IDs required for this color upgrade
- `battleStatData`: Battle stat bonuses for this color level (colors 2-18)

## Hero Types

### Playable Heroes (`type: "hero"`)
Main playable characters that can be collected, upgraded, and used in battles. These heroes have:
- Full star progression (1-6 stars)
- Color progression (1-18 colors)
- Artifacts and skills
- Role and character type classifications

### Creeps (`type: "creep"`)
Enemy/monster units used in battles. These typically have:
- Limited or no star progression
- Simplified stat structures
- May have `scale` property for display
- Often have `null` values for many properties

## Main Stats

Heroes have three primary stat types that determine their scaling:

### Strength (`mainStat: "strength"`)
- Typically used by tanks and melee fighters
- Increases HP and physical attack
- Examples: Aurora (ID 1), Astaroth (ID 4)

### Agility (`mainStat: "agility"`)
- Typically used by physical damage dealers
- Increases physical attack and dodge
- Examples: Galahad (ID 2), Keira (ID 5)

### Intelligence (`mainStat: "intelligence"`)
- Typically used by mages and healers
- Increases magic power and magic resistance
- Examples: Thea (ID 3), Celeste (ID 6)

## Battle Roles

### Front (`role: "front"`)
Front-line heroes that tank damage and protect the team. Examples: Aurora (ID 1), Astaroth (ID 4)

### Middle (`role: "middle"`)
Mid-line heroes that deal damage or provide support. Examples: Galahad (ID 2), Keira (ID 5)

### Back (`role: "back"`)
Back-line heroes that provide healing, support, or ranged damage. Examples: Thea (ID 3), Celeste (ID 6)

## Role Extended Classifications

Extended roles provide more specific classifications:

- `"melee_tank"` - Front-line tank heroes
- `"ranged_dps"` - Ranged damage dealers
- `"support"` - Support/healing heroes
- `"mage"` - Magic-based heroes
- `"healer"` - Healing-focused heroes
- `"dps"` - Damage per second heroes

## Character Types

- `"warrior"` - Warrior-class heroes
- `"demon"` - Demon-class heroes
- `"snob"` - Snob-class heroes
- `"healer"` - Healer-class heroes
- `"cutie"` - Cutie-class heroes

## Usage in Code

### Accessing Hero Data

```javascript
// Assuming heroData is the loaded JSON object
const aurora = heroData["1"];
console.log(aurora.role); // "front"
console.log(aurora.mainStat); // "strength"
console.log(aurora.stars["1"].battleStatData.hp); // 0
```

### Filtering by Type

```javascript
// Get all playable heroes
const playableHeroes = Object.values(heroData).filter(h => h.type === "hero");

// Get all creeps
const creeps = Object.values(heroData).filter(h => h.type === "creep");
```

### Filtering by Main Stat

```javascript
// Get all strength-based heroes
const strengthHeroes = Object.values(heroData).filter(h => h.mainStat === "strength");

// Get all agility-based heroes
const agilityHeroes = Object.values(heroData).filter(h => h.mainStat === "agility");

// Get all intelligence-based heroes
const intelligenceHeroes = Object.values(heroData).filter(h => h.mainStat === "intelligence");
```

### Filtering by Role

```javascript
// Get all front-line heroes
const frontHeroes = Object.values(heroData).filter(h => h.role === "front");

// Get all back-line heroes
const backHeroes = Object.values(heroData).filter(h => h.role === "back");
```

### Getting Star Level Stats

```javascript
function getHeroStats(heroId, starLevel) {
    const hero = heroData[heroId.toString()];
    if (!hero || !hero.stars[starLevel]) {
        return null;
    }
    return hero.stars[starLevel].battleStatData;
}

// Example: Get Aurora's stats at 3 stars
const auroraStats = getHeroStats(1, "3");
// Returns battle stat data for star level 3
```

### Getting Color Level Stats

```javascript
function getHeroColorStats(heroId, colorLevel) {
    const hero = heroData[heroId.toString()];
    if (!hero || !hero.color[colorLevel]) {
        return null;
    }
    return hero.color[colorLevel].battleStatData || {};
}

// Example: Get Aurora's color 5 stats
const auroraColor5 = getHeroColorStats(1, "5");
// Returns battle stat data for color level 5
```

### Getting Hero Artifacts

```javascript
function getHeroArtifacts(heroId) {
    const hero = heroData[heroId.toString()];
    return hero?.artifacts || [];
}

// Example: Get Aurora's artifacts
const auroraArtifacts = getHeroArtifacts(1);
// Returns: [1001, 2002, 3002]
```

### Getting Hero Skills

```javascript
function getHeroSkills(heroId) {
    const hero = heroData[heroId.toString()];
    if (!hero || !hero.skill) {
        return null;
    }
    return Object.values(hero.skill);
}

// Example: Get Aurora's skill IDs
const auroraSkills = getHeroSkills(1);
// Returns array of skill IDs
```

## Notes

1. **HP and Attack Values**: Battle stat values can be numbers or strings. Always parse when doing calculations.

2. **Star Levels**: Regular heroes have stars 1-6. Some special heroes may start at higher star levels.

3. **Color Levels**: Heroes have color progression from 1-18. Color 1 only has items, while colors 2-18 include stat bonuses.

4. **Artifacts**: Heroes can have up to 3 artifacts. The `artifacts` array contains artifact IDs that correspond to artifact data.

5. **Skills**: Heroes have multiple skills mapped by slot number (0-4 typically, with some having slot 7-8 for special skills).

6. **Fragment Costs**: Heroes can be obtained through fragments. `fragmentBuyCost` shows the cost to buy fragments, while `fragmentSellCost` shows the gold received when selling fragments.

7. **Role Positioning**: 
   - `"front"` - Front line (tanks)
   - `"middle"` - Mid line (DPS/support)
   - `"back"` - Back line (support/DPS/healers)

8. **Hero IDs**: Playable heroes typically have IDs in the range 1-100+. Creeps and special units may have higher IDs.

9. **Null Values**: Many properties can be `null` for certain hero types (especially creeps). Always check for null before accessing nested properties.

10. **Type Filtering**: Always filter by `type === "hero"` when working with playable heroes, as the data file may contain creeps and other non-playable units.

## Hero ID Reference

The following table provides a complete reference for all playable Hero IDs (type: "hero") found in the hero data file. Hero names are extracted from the `spineEpicArtAsset.name` field in the hero data. These names can also be accessed via translation keys `LIB_HERO_NAME_{id}` in the game.

| ID | Hero Name | Asset Name | Role | Main Stat | Character Type |
|----|-----------|------------|------|----------|----------------|
| 1 | Aurora | hero01_aurora | front | strength | warrior |
| 2 | 02_galahad | hero02_galahad | front | strength | warrior |
| 3 | 03_keira | hero3_keira | middle | agility | warrior |
| 4 | Astaroth | demon | front | strength | demon |
| 5 | 05_Kai | mage | middle | intelligence | snob |
| 6 | thing | thing | back | intelligence | demon |
| 7 | sunsupport | sunsupport | back | intelligence | healer |
| 8 | 08_daredevil | daredevil | back | agility | cutie |
| 9 | 09_heidi | hero09_heidi | middle | intelligence | warrior |
| 10 | 10_Faceless | spell_stealer | back | intelligence | demon |
| 11 | glutton | glutton | front | strength | snob |
| 12 | 12_arachne | arachne | middle | agility | snob |
| 13 | 13_Orion | elemental | back | intelligence | snob |
| 14 | hero14_fox | hero14_fox | back | agility | cutie |
| 15 | 15_Ginger | pirate | back | agility | snob |
| 16 | 16_Dante | hero16_dante | middle | agility | snob |
| 17 | 17_Mojo | shaman | middle | intelligence | snob |
| 18 | hero18_judge | hero18_judge | middle | intelligence | - |
| 19 | 19_DarkStar | archer | back | agility | warrior |
| 20 | Artemis | arbalester | back | agility | warrior |
| 21 | paladin | paladin | front | intelligence | healer |
| 22 | jester | jester | back | intelligence | cutie |
| 23 | 23_Lian | tailed | back | intelligence | cutie |
| 24 | 24_cleaver | butcher | front | strength | warrior |
| 25 | 25_Ishmael | hero25 | front | agility | demon |
| 26 | hero26_lilith | hero26_lilith | back | intelligence | demon |
| 27 | hero27_paladin_warrior | hero27_paladin_warrior | front | strength | snob |
| 28 | QuingMao | hero28_asian_girl | front | agility | warrior |
| 29 | hero29_vampire | hero29_vampire | back | intelligence | demon |
| 30 | hero30_antimage | hero30_antimage | back | intelligence | snob |
| 31 | 31_jet | hero31_alchemist | back | intelligence | cutie |
| 32 | helios | hero32_sun | back | intelligence | snob |
| 33 | 33_lars | hero33_deerboy | back | intelligence | snob |
| 34 | 34_Krista | hero34_deergirl | middle | intelligence | cutie |
| 35 | hero35_catooldan | hero35_catooldan | middle | strength | demon |
| 36 | 36_Maya | hero36_flowey | middle | intelligence | healer |
| 37 | 37_jhu | hero37_boomerang | middle | strength | warrior |
| 38 | hero38_sandphantom | hero38_sandphantom | front | agility | warrior |
| 39 | 39_Ziri | hero39_scorpio | front | strength | cutie |
| 40 | 40_Nebula | hero40_space_balls | middle | agility | cutie |
| 41 | hero41_tentacle | hero41_tentacle | front | agility | warrior |
| 42 | hero42_fatty | hero42_fatty | front | strength | cutie |
| 43 | hero43_daynight | hero43_daynight | middle | intelligence | - |
| 44 | 44_Astrid_lukas | hero44_petmaster | back | agility | - |
| 45 | 45_Satori | hero45_blackfox | front | intelligence | - |
| 46 | hero46_grandma | hero46_grandma | back | intelligence | - |
| 47 | 47_Andvari | hero47_andvari | front | strength | - |
| 48 | 48_Sebastian | hero48_sebastian | middle | agility | - |
| 49 | Yasmin | hero49_naga | front | agility | - |
| 50 | 50_corvus | hero50_corvus | front | strength | - |
| 51 | 51_Morrigan | hero51_morrigan | middle | intelligence | - |
| 52 | hero52_isaac | hero52_isaac | middle | agility | - |
| 53 | hero53_alvanor | hero53_alvanor | front | intelligence | snob |
| 54 | hero54_tristan | hero54_tristan | front | strength | - |
| 55 | 55_iris | hero55_iris | back | intelligence | - |
| 56 | 56_amira | hero56_amira | middle | intelligence | - |
| 57 | 57_fafnir | hero57_fafnir | back | strength | - |
| 58 | 58_aidan | hero58_aidan | back | intelligence | - |
| 59 | 59_kayla | hero59_keila | front | agility | - |
| 60 | 60_mushroom | hero60_mushroom | front | strength | - |
| 61 | 61_julius | hero61_julius | front | strength | - |
| 62 | 62_polaris | hero62_polaris | back | intelligence | - |
| 63 | 63_laracroft_epic | hero63_laracroft | back | agility | cutie |
| 64 | 64_augustus | hero64_augustus | back | intelligence | snob |
| 65 | 65_tmnt | hero65_tmnt | front | agility | warrior |
| 66 | 66_folio | hero66_folio | back | intelligence | - |
| 67 | 67_lyria | hero67_lyria | front | strength | warrior |
| 68 | 68_gus | hero_68_gus | middle | strength | healer |
| 69 | 69_cascade | hero_69_cascade | middle | intelligence | - |
| 70 | 70_Necro | hero_70_electra | front | strength | - |
| 71 | Fluffy | — | — | — | — |
| 72 | Byrna | — | — | — | — |
| 73 | Adam | — | — | — | — |
| 74 | Somna | — | — | — | — |

**Total Playable Heroes:** 70 in `heroData.txt`; IDs **71+** (e.g. Fluffy, Byrna) appear in live game data — use translation keys for current names.

**Note:** Hero names in the game are accessed using translation keys. To get a hero's display name in code:
```javascript
const heroId = 72;
const heroName = window.cheats?.translate(`LIB_HERO_NAME_${heroId}`);
```

For example:
- `cheats.translate("LIB_HERO_NAME_1")` returns "Aurora"
- `cheats.translate("LIB_HERO_NAME_4")` returns "Astaroth"
- `cheats.translate("LIB_HERO_NAME_13")` returns "Orion"
- `cheats.translate("LIB_HERO_NAME_55")` returns "Iris"
- `cheats.translate("LIB_HERO_NAME_72")` returns "Byrna"
- `cheats.translate("LIB_HERO_NAME_73")` returns "Adam"
- `cheats.translate("LIB_HERO_NAME_74")` returns "Somna"

## Related Files

- `heroData.txt` - The source JSON data file containing all hero definitions
- `HeroWarsHelper.user.js` - Uses hero data for quest automation and team management
- `HeroWarsHelper - Auto Daily Extension.user.js` - Uses hero data for daily quest automation
- `LIB_DATA_DOCUMENTATION.md` - Documentation for the lib.data structure used in-game
- `HERO_WARS_API_DOCUMENTATION.md` - Contains additional hero name reference table

