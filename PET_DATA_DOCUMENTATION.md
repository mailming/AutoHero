# Pet Data Documentation

This document describes pet definitions from `lib.getData('pet')` / `lib.data.pet`, used by Hero Wars Helper for favor assignment, arena training, and Auto Daily.

## Overview

Pets occupy ID range **6000–6999**. Each pet entry in `lib.data.pet` describes which heroes receive that pet’s favor bonus, and how favor stats/skills scale.

Display names live in:

- In-game: `cheats.translate('LIB_PET_NAME_{id}')`
- Offline / training UI: `hero-names.mjs` → `PET_NAMES`
- Meta scrape: `scrape_meta_teams_to_db.py` → `PET_NAMES`

## Data Structure

### Root Object

```json
{
    "6000": { /* Pet object */ },
    "6001": { /* Pet object */ },
    ...
}
```

### Pet Object Properties

| Property | Type | Description |
|----------|------|-------------|
| `id` | `number` | Pet ID (6000+) |
| `favorHeroes` | `number[]` | Hero IDs that receive this pet’s favor bonus |
| `favorStats` | `object[]` | Stat bonuses applied when favoring a matching hero |
| `favorSkill` | `object` | Favor skill scaling (`baseStat`, `tier`) |
| `isPlayable` | `number` | `1` = usable in battles, `0` = not |
| `gachaDate` | `string` | Scheduled gacha / release timestamp (`YYYY-MM-DD HH:mm:ss`) |

### `favorStats` Entry

```json
{
    "baseStat": "intelligence",
    "multiplier": 9,
    "stat": "hp"
}
```

| Field | Description |
|-------|-------------|
| `baseStat` | Hero base stat used for scaling (`intelligence`, `strength`, `agility`) |
| `multiplier` | Multiplier applied to the base stat |
| `stat` | Battle stat that receives the bonus (e.g. `hp`, `magicResist`) |

### `favorSkill` Entry

```json
{
    "baseStat": "intelligence",
    "tier": 4
}
```

## Known Pets

| ID | Name | Notes |
|----|------|-------|
| 6000 | Fenris | |
| 6001 | Oliver | |
| 6002 | Merlin | |
| 6003 | Mara | |
| 6004 | Cain | |
| 6005 | Albus | Common default pet in Auto Daily / Arena Training |
| 6006 | Axel | |
| 6007 | Biscuit | |
| 6008 | Khorus | |
| 6009 | Vex | |
| 6011 | Robin | New; gacha `2027-02-01 02:00:00` (no 6010 entry) |

## Robin (6011)

```json
{
    "id": 6011,
    "favorHeroes": [
        4, 6, 7, 8, 10, 14, 15, 17, 18, 19, 21, 22, 23, 26,
        31, 29, 30, 36, 40, 45, 46, 47, 51, 53, 56, 57, 66, 68, 72, 74
    ],
    "favorStats": [
        {
            "baseStat": "intelligence",
            "multiplier": 9,
            "stat": "hp"
        },
        {
            "baseStat": "intelligence",
            "multiplier": 0.9,
            "stat": "magicResist"
        }
    ],
    "favorSkill": {
        "baseStat": "intelligence",
        "tier": 4
    },
    "isPlayable": 1,
    "gachaDate": "2027-02-01 02:00:00"
}
```

### Favor Heroes (by name)

| ID | Hero | ID | Hero |
|----|------|----|------|
| 4 | Astaroth | 31 | Jet |
| 6 | Phobos | 29 | Dorian |
| 7 | Thea | 30 | Cornelius |
| 8 | Daredevil | 36 | Maya |
| 10 | Faceless | 40 | Nebula |
| 14 | Fox | 45 | Satori |
| 15 | Ginger | 46 | Martha |
| 17 | Mojo | 47 | Andvari |
| 18 | Judge | 51 | Morrigan |
| 19 | Dark Star | 53 | Alvanor |
| 21 | Markus | 56 | Amira |
| 22 | Peppy | 57 | Fafnir |
| 23 | Lian | 66 | Folio |
| 26 | Lilith | 68 | Guus |
| | | 72 | Byrna |
| | | 74 | Somna |

### Favor Summary

- Scales off **intelligence**
- Grants **HP** (×9) and **magic resist** (×0.9)
- Favor skill tier **4**
- Playable (`isPlayable: 1`)

## Code Usage

### Favor lookup (HeroWarsHelper)

```javascript
const petLib = lib.getData('pet');
for (const petId of availablePets) {
    if (petLib[petId].favorHeroes.includes(heroId)) {
        // assign favor: { [heroId]: petId }
    }
}
```

### Arena Training / Auto Daily

- Pet IDs in `6000–6999` are treated as pets (not heroes)
- Owned pets (including Robin `6011`) are included in training / battle pet pools automatically
- Name fallbacks: `CONSTANTS.PET_NAMES` / `hero-names.mjs`

### Icon filenames (hw-recruit)

Pet icons use `6--{suffix}.png` where `suffix = petId - 6000`:

- `6008` → `6--8.png`
- `6011` → `6--11.png`

## Related Files

| File | Purpose |
|------|---------|
| `hero-names.mjs` | Offline pet/hero name map |
| `hero-icons.mjs` | Icon URL helpers for training UI |
| `scrape_meta_teams_to_db.py` | Meta team scrape pet name/id parsing |
| `Arena Training HwH Ext.user.js` | Training pet pool + name fallback |
| `HeroWarsHelper - Auto Daily Extension.user.js` | Arena/Grand Arena pet handling |
| `LIB_DATA_DOCUMENTATION.md` | `lib.data.pet` overview |
| `heroData.txt` | Full pet combat stats (stars/colors; separate from favor lib) |
