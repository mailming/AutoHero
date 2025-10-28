# Guild War API Documentation

This document provides comprehensive documentation for the Guild War (Clan War) APIs in Hero Wars, based on network traffic analysis.

## Overview

Guild War is a clan-based PvP system where clans compete against each other by attacking defensive slots. The system involves multiple API calls for getting war information, defense data, and executing attacks.

## API Endpoints

### Base URL
All Guild War APIs use the standard Hero Wars API endpoint:
```
https://api.hero-wars.com/
```

## API Calls

### 1. clanWarGetInfo

**Description:** Retrieves current Guild War information including available slots and team data.

**Request:**
```json
{
  "calls": [
    {
      "name": "clanWarGetInfo",
      "args": {},
      "context": {
        "actionTs": 122604
      },
      "ident": "clanWarGetInfo"
    }
  ]
}
```

**Response:**
```json
{
  "date": 1761659616.247844,
  "results": [
    {
      "ident": "clanWarGetInfo",
      "result": {
        "response": {
          "slots": {
            "1": 54814373,
            "2": 57654342,
            "3": 54949643,
            "4": 55215540,
            "5": 54772226,
            "6": 57470962,
            "7": 57354546,
            "8": 54814373,
            "9": 57470962,
            "10": 54772226,
            "11": 57654342,
            "12": 54971604,
            "13": 54793169,
            "14": 55098660,
            "15": 57373161,
            "16": 54793169,
            "17": 55278076,
            "18": 55195158,
            "19": 54866493,
            "20": 55188328,
            "21": 55491979,
            "22": 55293294,
            "23": 54917238,
            "24": 55215540,
            "25": 57354546,
            "26": 54971604,
            "27": 55188328,
            "28": 55006538,
            "29": 55293294,
            "30": 55167289,
            "31": 55195158,
            "32": 55278076,
            "33": 54917238,
            "34": 54949643,
            "35": 55098660,
            "36": 54866493,
            "37": 55006538,
            "38": 57373161,
            "39": 55167289,
            "40": 55491979
          },
          "teams": {
            "54749260": {
              "clanDefence_titans": {
                "units": {
                  "4001": {
                    "id": 4001,
                    "level": 53,
                    "star": 4,
                    "element": "water",
                    "elementSpiritLevel": 1,
                    "elementSpiritStar": 0,
                    "elementSpiritSkills": [],
                    "elementAffinityPower": 0,
                    "power": 17160
                  }
                }
              }
            }
          }
        }
      }
    }
  ]
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `slots` | Object | Map of slot IDs to defending player IDs |
| `slots[slotId]` | Number | Player ID defending this slot |
| `teams` | Object | Team configurations for different players |
| `teams[playerId]` | Object | Player's team data |
| `teams[playerId].clanDefence_titans` | Object | Titan defense team |
| `teams[playerId].clanDefence_titans.units` | Object | Titan units in defense |

---

### 2. clanWarGetDefence

**Description:** Retrieves defense information for Guild War slots.

**Request:**
```json
{
  "calls": [
    {
      "name": "clanWarGetDefence",
      "args": {},
      "context": {
        "actionTs": 122604
      },
      "ident": "body"
    }
  ]
}
```

**Response:** Similar structure to `clanWarGetInfo` but focused on defense data.

---

### 3. clanWarAttack

**Description:** Executes an attack against a specific Guild War slot.

**Request:**
```json
{
  "calls": [
    {
      "name": "clanWarAttack",
      "args": {
        "slotId": 1,
        "heroes": [46, 9, 40, 16, 65],
        "pet": 6004,
        "favor": {
          "9": 6006,
          "16": 6004
        },
        "banner": 1
      },
      "context": {
        "actionTs": 153972
      },
      "ident": "body"
    }
  ]
}
```

**Request Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `slotId` | Number | Target slot ID to attack (1-40) |
| `heroes` | Array[Number] | Array of 5 hero IDs for the attack team |
| `pet` | Number | Pet ID to use in battle |
| `favor` | Object | Favor pet assignments (hero ID → pet ID mapping) |
| `banner` | Number | Banner ID to use in battle |

**Response:**
```json
{
  "date": 1761659647.0272999,
  "results": [
    {
      "ident": "body",
      "result": {
        "response": {
          "battle": {
            "userId": "57373161",
            "typeId": "54999117",
            "attackers": {
              "46": {
                "id": 46,
                "xp": 3625195,
                "level": 130,
                "color": 11,
                "slots": {"2": 0, "0": 0, "3": 0},
                "skills": {"230": 130, "231": 130, "232": 130, "233": 130},
                "power": 33806,
                "star": 5,
                "runes": [1620, 1650, 0, 0, 0],
                "skins": {"101": 30, "159": 20},
                "currentSkin": 159,
                "titanGiftLevel": 0,
                "titanCoinsSpent": null,
                "artifacts": [
                  {"level": 26, "star": 4},
                  {"level": 6, "star": 1},
                  {"level": 6, "star": 1}
                ],
                "scale": 1,
                "petId": 0,
                "type": "hero",
                "perks": [9, 5, 1, 22],
                "ascensions": {"1": [0, 1, 4, 2, 3]},
                "agility": 918,
                "hp": 42483,
                "intelligence": 2959,
                "physicalAttack": 50,
                "strength": 2442,
                "armor": 1702,
                "magicPower": 4154,
                "magicResist": 1025,
                "skin": 159,
                "favorPetId": 0,
                "favorPower": 0
              }
            },
            "defenders": [
              {
                "1": {
                  "id": 46,
                  "xp": 3625195,
                  "level": 130,
                  "color": 11,
                  "slots": {"4": 0, "0": 0, "1": 0, "2": 0},
                  "skills": {"230": 130, "231": 130, "232": 130, "233": 130, "6032": 70},
                  "power": 51349,
                  "star": 5,
                  "runes": [1410, 6360, 400, 600, 1800],
                  "skins": {"101": 45, "178": 29, "315": 24, "262": 22},
                  "currentSkin": 101,
                  "titanGiftLevel": 30,
                  "titanCoinsSpent": {"consumable": {"24": 65150}},
                  "artifacts": [
                    {"level": 61, "star": 4},
                    {"level": 74, "star": 3},
                    {"level": 74, "star": 3}
                  ],
                  "scale": 1,
                  "petId": 6006,
                  "type": "hero",
                  "perks": [9, 5, 1, 22],
                  "ascensions": {"1": [0, 1]},
                  "agility": 1278,
                  "hp": 117008.2,
                  "intelligence": 5059.6,
                  "physicalAttack": 50,
                  "strength": 2832,
                  "armor": 2723.3,
                  "magicPower": 9950.5,
                  "magicResist": 695,
                  "skin": 101,
                  "favorPetId": 6006,
                  "favorPower": 2407,
                  "state": {
                    "hp": 230288,
                    "energy": 0,
                    "isDead": false,
                    "maxHp": 230288
                  }
                }
              }
            ],
            "effects": {
              "defenders": {
                "percentBuffAll_healing": 10,
                "percentBuffAll_magicPower": 2.5,
                "percentBuffAll_magicResist": 4,
                "percentBuffAll_physicalAttack": 5
              },
              "defendersBanner": {
                "id": 4,
                "slots": [5, 16, 29]
              },
              "attackers": {
                "percentBuffByPerk_energyIncrease_4": 10,
                "percentBuffAll_magicPower": 2.5,
                "percentBuffAll_armor": 3
              },
              "attackersBanner": {
                "id": 1,
                "slots": [5, 38]
              }
            },
            "reward": [],
            "startTime": 1761659646,
            "seed": 2889773322,
            "type": "clan_pvp"
          },
          "endTime": 1761659826
        }
      }
    }
  ]
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `battle` | Object | Complete battle data |
| `battle.userId` | String | Attacking player ID |
| `battle.typeId` | String | Battle type identifier |
| `battle.attackers` | Object | Attacking team data |
| `battle.defenders` | Array | Defending team data |
| `battle.effects` | Object | Battle effects and buffs |
| `battle.reward` | Array | Battle rewards |
| `battle.startTime` | Number | Battle start timestamp |
| `battle.seed` | Number | Random seed for battle |
| `battle.type` | String | Battle type ("clan_pvp") |
| `endTime` | Number | Battle end timestamp |

## Hero Data Structure

Each hero in the battle data contains:

| Field | Type | Description |
|-------|------|-------------|
| `id` | Number | Hero ID |
| `xp` | Number | Experience points |
| `level` | Number | Hero level |
| `color` | Number | Hero color/tier |
| `slots` | Object | Equipment slots |
| `skills` | Object | Skill levels |
| `power` | Number | Total power |
| `star` | Number | Star rating |
| `runes` | Array | Rune IDs |
| `skins` | Object | Available skins |
| `currentSkin` | Number | Currently equipped skin |
| `titanGiftLevel` | Number | Titan gift level |
| `titanCoinsSpent` | Object | Titan coins spent |
| `artifacts` | Array | Artifact data |
| `scale` | Number | Scale factor |
| `petId` | Number | Pet ID |
| `type` | String | Entity type ("hero" or "pet") |
| `perks` | Array | Perk IDs |
| `ascensions` | Object | Ascension data |
| `agility` | Number | Agility stat |
| `hp` | Number | Health points |
| `intelligence` | Number | Intelligence stat |
| `physicalAttack` | Number | Physical attack |
| `strength` | Number | Strength stat |
| `armor` | Number | Armor value |
| `magicPower` | Number | Magic power |
| `magicResist` | Number | Magic resistance |
| `skin` | Number | Current skin ID |
| `favorPetId` | Number | Favor pet ID |
| `favorPower` | Number | Favor power |

## Pet Data Structure

Pets have a similar structure but with pet-specific fields:

| Field | Type | Description |
|-------|------|-------------|
| `id` | Number | Pet ID (6000+ range) |
| `color` | Number | Pet color |
| `star` | Number | Pet star rating |
| `xp` | Number | Pet experience |
| `level` | Number | Pet level |
| `slots` | Object | Pet equipment slots |
| `skills` | Object | Pet skills |
| `power` | Number | Pet power |
| `type` | String | "pet" |
| `perks` | Array | Pet perks |
| `name` | String | Pet name (usually null) |
| `armorPenetration` | Number | Armor penetration |
| `intelligence` | Number | Intelligence |
| `strength` | Number | Strength |

## Battle Effects

Battle effects include various buffs and debuffs:

| Field | Type | Description |
|-------|------|-------------|
| `percentBuffAll_healing` | Number | Healing bonus percentage |
| `percentBuffAll_magicPower` | Number | Magic power bonus |
| `percentBuffAll_magicResist` | Number | Magic resistance bonus |
| `percentBuffAll_physicalAttack` | Number | Physical attack bonus |
| `percentBuffAll_armor` | Number | Armor bonus |
| `percentBuffByPerk_energyIncrease_4` | Number | Energy increase from perk |

## Banner System

Banners provide additional effects:

| Field | Type | Description |
|-------|------|-------------|
| `id` | Number | Banner ID |
| `slots` | Array | Banner slot configurations |

## Error Handling

Common error responses:

```json
{
  "error": {
    "name": "NotAvailable",
    "description": "Guild War not available",
    "call": {
      "name": "clanWarAttack",
      "args": {...}
    }
  }
}
```

**Common Error Types:**
- `NotAvailable`: Guild War is not active
- `InvalidRequest`: Invalid attack parameters
- `ArgumentError`: Missing required arguments
- `NotFound`: Target slot not found

## Implementation Notes

### Team Selection
- Use `teamGetAll.clanDefence_heroes` for hero teams
- Use `teamGetAll.clanDefence_titans` for titan teams
- Use `teamGetFavor.clanDefence_heroes` for favor assignments

### Attack Strategy
1. Get available slots with `clanWarGetInfo`
2. Analyze defending teams
3. Select appropriate attack team
4. Execute attack with `clanWarAttack`
5. Process battle results

### Rate Limiting
- Guild War attacks may have cooldown periods
- Check battle timestamps to avoid rapid-fire attacks
- Respect server response times

## Related APIs

- `teamGetAll` - Get team configurations
- `teamGetFavor` - Get favor pet assignments
- `heroGetAll` - Get hero data
- `pet_getAll` - Get pet data
- `stashClient` - Client analytics

## Version History

- **v1.0**: Initial Guild War system
- **v2.0**: Added banner system
- **v3.0**: Enhanced battle effects
- **v4.0**: Improved team data structure

---

*This documentation is based on network traffic analysis from Guild War gameplay sessions.*
