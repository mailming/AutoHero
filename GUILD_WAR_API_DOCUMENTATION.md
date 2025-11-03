# Guild War API Documentation

This document provides comprehensive documentation for the Guild War (Clan War) APIs in Hero Wars, based on network traffic analysis.

## Overview

Guild War is a clan-based PvP system where clans compete against each other by attacking defensive slots. The system involves multiple API calls for getting war information, defense data, and executing attacks.

## API Endpoints

### Base URL
All Guild War APIs use the standard Hero Wars API endpoint:
```
https://heroes-wb.nextersglobal.com/api/
```

## API Calls



### 1. clanWarGetInfo

**Description:** Retrieves current Guild War information including available slots and team data.

**Request:**
```json
{
  "calls": [
    {
      "name": "clanWarGetDefence",
      "args": {},
      "context": {
        "actionTs": 63665
      },
      "ident": "body"
    },
    {
      "name": "clanWarGetInfo",
      "args": {},
      "context": {
        "actionTs": 63665
      },
      "ident": "clanWarGetInfo"
    }
  ]
}
```

**Response:**
```json
{
  "date": 1762191003.695759,
  "results": [
    {
      "ident": "body",
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
                  },
                  "4010": {
                    "id": 4010,
                    "level": 62,
                    "star": 6,
                    "element": "fire",
                    "elementSpiritLevel": 1,
                    "elementSpiritStar": 0,
                    "elementSpiritSkills": [],
                    "elementAffinityPower": 0,
                    "power": 41637
                  }
                }
              },
              "clanDefence_heroes": {
                "units": {
                  "7": {
                    "id": 7,
                    "level": 119,
                    "color": 11,
                    "star": 4,
                    "power": 43469
                  },
                  "20": {
                    "id": 20,
                    "level": 118,
                    "color": 8,
                    "star": 4,
                    "power": 29554
                  },
                  "2": {
                    "id": 2,
                    "level": 119,
                    "color": 12,
                    "star": 5,
                    "power": 55080
                  },
                  "4": {
                    "id": 4,
                    "level": 118,
                    "color": 7,
                    "star": 4,
                    "power": 27676
                  },
                  "61": {
                    "id": 61,
                    "level": 119,
                    "color": 10,
                    "star": 5,
                    "power": 46858
                  }
                },
                "banner": null
              },
              "userId": 54749260
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
| `slots` | Object | Map of slot IDs (1-40) to defending player IDs |
| `slots[slotId]` | Number | Player ID defending this slot |
| `teams` | Object | Team configurations for different players |
| `teams[playerId]` | Object | Player's team data |
| `teams[playerId].userId` | Number | Player ID |
| `teams[playerId].clanDefence_titans` | Object | Titan defense team (for slots 21-40) |
| `teams[playerId].clanDefence_titans.units` | Object | Titan units in defense (titan ID → titan data) |
| `teams[playerId].clanDefence_heroes` | Object | Hero defense team (for slots 1-20) |
| `teams[playerId].clanDefence_heroes.units` | Object | Hero units in defense (hero ID → hero data) |
| `teams[playerId].clanDefence_heroes.banner` | Number\|Null | Banner ID or null |

**Note:** The actual API call combines both `clanWarGetDefence` and `clanWarGetInfo` in a single request. The response contains defense data and general war information under the "body" identifier. Both calls return the same data structure (slots and teams).

---

### 4. clanWarEndBattle

**Description:** Submits the battle result after completing a Guild War battle. This must be called after the battle is completed to finalize the results and update war points.

**Request:**
```json
{
  "calls": [
    {
      "name": "clanWarEndBattle",
      "args": {
        "result": {
          "win": false,
          "stars": 0
        },
        "progress": [
          {
            "v": 272,
            "b": 0,
            "seed": 1906504079,
            "attackers": {
              "input": ["auto", 0, 0, "auto", 0, 0],
              "heroes": {}
            },
            "defenders": {
              "input": [],
              "heroes": {
                "1": {
                  "hp": 5782520,
                  "energy": 800,
                  "isDead": false
                },
                "2": {
                  "hp": 2929050,
                  "energy": 908,
                  "isDead": false
                },
                "3": {
                  "hp": 4572236,
                  "energy": 1000,
                  "isDead": false
                }
              }
            }
          }
        ]
      },
      "context": {
        "actionTs": 97529
      },
      "ident": "body"
    }
  ]
}
```

**Request Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `result.win` | Boolean | Whether the battle was won |
| `result.stars` | Number | Stars earned (0-3) |
| `progress` | Array | Array of battle progress snapshots |
| `progress[].v` | Number | Server version |
| `progress[].b` | Number | Battle index |
| `progress[].seed` | Number | Battle seed (must match `clanWarAttack` response seed) |
| `progress[].attackers.input` | Array | Player input actions during battle |
| `progress[].attackers.heroes` | Object | Final state of attacker units (HP, energy, alive) |
| `progress[].defenders.input` | Array | Defender input actions (usually empty) |
| `progress[].defenders.heroes` | Object | Final state of defender units (position → state) |

**Response:**
```json
{
  "date": 1762191037.153217,
  "results": [
    {
      "ident": "body",
      "result": {
        "response": {
          "slotVictoryPoints": 0,
          "fortificationVictoryPoints": 0,
          "ourClanPoints": 74,
          "slot": {
            "team": [
              {
                "1": {
                  "state": {
                    "hp": 5782520,
                    "energy": 800,
                    "isDead": false,
                    "maxHp": 7271482
                  },
                  "id": 4033,
                  "star": 6,
                  "level": 130,
                  "power": 187026,
                  "type": "titan",
                  "element": "dark",
                  "elementSpiritStar": 3,
                  "elementSpiritLevel": 75,
                  "elementSpiritSkills": [
                    {
                      "skillId": 4500,
                      "level": 1,
                      "tierScale": 5
                    },
                    {
                      "skillId": 4507,
                      "level": 1,
                      "tierScale": 20
                    }
                  ]
                }
              }
            ],
            "attackerId": 0,
            "status": "ready",
            "user": {
              "id": "55206291",
              "name": "Gambi",
              "lastLoginTime": "1762151481",
              "serverId": "377",
              "level": "130",
              "clanId": "323222",
              "clanRole": "2",
              "commander": false,
              "avatarId": "1169",
              "isChatModerator": false,
              "frameId": 206,
              "leagueId": 3,
              "allowPm": "all",
              "clanTitle": "Chevaliers",
              "clanIcon": {
                "flagColor1": 8,
                "flagColor2": 10,
                "flagShape": 0,
                "iconColor": 1,
                "iconShape": 1
              }
            },
            "banner": null,
            "pointsFarmed": 13,
            "slotId": "8",
            "totalPoints": 20
          },
          "enemyClanPoints": 440
        }
      }
    }
  ]
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `slotVictoryPoints` | Number | Victory points earned for this slot (if won) |
| `fortificationVictoryPoints` | Number | Fortification victory points earned |
| `ourClanPoints` | Number | Total points for your clan |
| `enemyClanPoints` | Number | Total points for enemy clan |
| `slot` | Object | Updated slot information |
| `slot.team` | Array | Defending team array (position → unit data) |
| `slot.attackerId` | Number | ID of last attacker (0 if slot is ready) |
| `slot.status` | String | Slot status ("ready" if available for attack) |
| `slot.user` | Object | Defender player information |
| `slot.user.id` | String | Player ID |
| `slot.user.name` | String | Player name |
| `slot.user.clanId` | String | Clan ID |
| `slot.user.clanTitle` | String | Clan name |
| `slot.banner` | Number\|Null | Banner ID or null |
| `slot.pointsFarmed` | Number | Points farmed from this slot |
| `slot.slotId` | String | Slot ID |
| `slot.totalPoints` | Number | Total points available from this slot |

---

### 2. clanWarGetDefence

**Description:** Retrieves defense information for Guild War slots. In practice, this is combined with `clanWarGetInfo` in a single API call.

**Request:** See `clanWarGetInfo` section above - both calls are made together.

**Response:** The defense data is returned as part of the combined response under the "body" identifier, containing the same structure as `clanWarGetInfo` but focused on defense team configurations.

---

### 3. clanWarAttack

**Description:** Executes an attack against a specific Guild War slot. Can be used for both hero battles (slots 1-20) and titan battles (slots 21-40).

**Request (Hero Battle):**
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

**Request (Titan Battle):**
```json
{
  "calls": [
    {
      "name": "clanWarAttack",
      "args": {
        "slotId": 8,
        "heroes": [4033, 4003, 4001, 4032, 4000],
        "favor": {}
      },
      "context": {
        "actionTs": 89933
      },
      "ident": "body"
    }
  ]
}
```

**Request Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `slotId` | Number | Target slot ID to attack (1-40, 1-20 for heroes, 21-40 for titans) |
| `heroes` | Array[Number] | Array of 5 unit IDs (hero IDs for slots 1-20, titan IDs for slots 21-40) |
| `pet` | Number | (Optional) Pet ID to use in battle (hero battles only) |
| `favor` | Object | (Optional) Favor pet assignments (hero ID → pet ID mapping, empty for titan battles) |
| `banner` | Number | (Optional) Banner ID to use in battle (hero battles only) |

**Response (Titan Battle Example):**
```json
{
  "date": 1762191029.429076,
  "results": [
    {
      "ident": "body",
      "result": {
        "response": {
          "battle": {
            "userId": "57373161",
            "typeId": "55206291",
            "attackers": {
              "4033": {
                "id": 4033,
                "xp": 223220,
                "level": 94,
                "star": 5,
                "skills": {
                  "4034": 94,
                  "4035": 94
                },
                "power": 94013,
                "skins": {
                  "10019": 50,
                  "10038": 45
                },
                "currentSkin": 10038,
                "artifacts": [
                  {"level": 50, "star": 2},
                  {"level": 96, "star": 3},
                  {"level": 50, "star": 2}
                ],
                "scale": 0.8,
                "type": "titan",
                "perks": [6, 5],
                "anticrit": 1,
                "antidodge": 1,
                "hp": 3357674.56,
                "physicalAttack": 346735.78,
                "elementArmor": 157984.5,
                "elementAttack": 42856.8,
                "elementSpiritPower": 279758,
                "element": "dark",
                "elementSpiritLevel": 72,
                "elementSpiritStar": 1,
                "elementSpiritSkills": [],
                "elementAffinityPower": 72,
                "skin": 10038
              }
            },
            "defenders": [
              {
                "1": {
                  "id": 4033,
                  "xp": 1009660,
                  "level": 130,
                  "star": 6,
                  "skills": {
                    "4034": 130,
                    "4035": 130
                  },
                  "power": 187026,
                  "skins": {
                    "10019": 50,
                    "10038": 50
                  },
                  "currentSkin": 10038,
                  "artifacts": [
                    {"level": 102, "star": 4},
                    {"level": 102, "star": 5},
                    {"level": 110, "star": 5}
                  ],
                  "scale": 0.8,
                  "type": "titan",
                  "perks": [6, 5],
                  "anticrit": 1,
                  "antidodge": 1,
                  "hp": 7271482.18,
                  "physicalAttack": 790077.87,
                  "elementArmor": 238032.5,
                  "elementAttack": 218184,
                  "elementSpiritPower": 447369,
                  "element": "dark",
                  "elementSpiritLevel": 75,
                  "elementSpiritStar": 3,
                  "elementSpiritSkills": [
                    {"skillId": 4500, "level": 1, "tierScale": 5},
                    {"skillId": 4507, "level": 1, "tierScale": 20}
                  ],
                  "elementAffinityPower": 112.5,
                  "skin": 10038,
                  "state": {
                    "hp": 4865074,
                    "energy": 562,
                    "isDead": false,
                    "maxHp": 7271482
                  }
                }
              }
            ],
            "effects": [],
            "reward": [],
            "startTime": 1762191029,
            "seed": 1906504079,
            "type": "clan_pvp_titan"
          },
          "endTime": 1762191209
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
| `battle.typeId` | String | Defending player ID (as string) |
| `battle.attackers` | Object | Attacking team data (unit ID → unit data) |
| `battle.defenders` | Array | Defending team data (array of objects with position → unit data) |
| `battle.effects` | Object\|Array | Battle effects and buffs (empty array for titan battles, object for hero battles) |
| `battle.reward` | Array | Battle rewards |
| `battle.startTime` | Number | Battle start timestamp |
| `battle.seed` | Number | Random seed for battle replay |
| `battle.type` | String | Battle type ("clan_pvp" for heroes, "clan_pvp_titan" for titans) |
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

## Titan Data Structure

Titans in battle data contain:

| Field | Type | Description |
|-------|------|-------------|
| `id` | Number | Titan ID (4000+ range) |
| `xp` | Number | Experience points |
| `level` | Number | Titan level |
| `star` | Number | Star rating |
| `skills` | Object | Skill levels (skill ID → level) |
| `power` | Number | Total power |
| `skins` | Object | Available skins (skin ID → level) |
| `currentSkin` | Number | Currently equipped skin ID |
| `artifacts` | Array | Artifact data (level, star) |
| `scale` | Number | Scale factor (typically 0.8) |
| `type` | String | Entity type ("titan") |
| `perks` | Array | Perk IDs |
| `anticrit` | Number | Anti-crit stat |
| `antidodge` | Number | Anti-dodge stat |
| `hp` | Number | Health points |
| `physicalAttack` | Number | Physical attack |
| `elementArmor` | Number | Element armor |
| `elementAttack` | Number | Element attack |
| `elementSpiritPower` | Number | Element spirit power |
| `element` | String | Element type ("dark", "light", "fire", "water", "earth") |
| `elementSpiritLevel` | Number | Element spirit level |
| `elementSpiritStar` | Number | Element spirit star |
| `elementSpiritSkills` | Array | Element spirit skills (skillId, level, tierScale) |
| `elementAffinityPower` | Number | Element affinity power |
| `skin` | Number | Current skin ID |
| `state` | Object | Current battle state (hp, energy, isDead, maxHp) |

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

### API Call Pattern
- The actual implementation combines `clanWarGetDefence` and `clanWarGetInfo` in a single request
- Both calls use the same `actionTs` timestamp
- The response contains both defense data (under "body" ident) and general war info (under "clanWarGetInfo" ident)

### Team Selection
- Use `teamGetAll.clanDefence_heroes` for hero teams
- Use `teamGetAll.clanDefence_titans` for titan teams
- Use `teamGetFavor.clanDefence_heroes` for favor assignments

### Slot Availability
- When no slots are available, the `slots` object will be empty or contain fewer than 40 entries
- The number of available slots directly corresponds to the number of attack attempts
- Slots 1-20 are typically hero battles, slots 21-40 are typically titan battles

### Attack Strategy
1. Get available slots and defense data with combined `clanWarGetDefence` and `clanWarGetInfo` call
2. Analyze defending teams from the response
3. Select appropriate attack team based on slot type (hero/titan)
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
- **v5.0**: Updated with real API data from network traffic analysis
- **v5.1**: Corrected API call patterns and response structure based on actual HAR file data
- **v6.0**: Complete rewrite with actual API data from GW.har:
  - Updated base URL to `heroes-wb.nextersglobal.com/api/`
  - Added complete `clanWarEndBattle` API documentation
  - Updated `clanWarAttack` to show both hero and titan battle examples
  - Added titan data structure documentation
  - Updated all request/response examples with actual data from HAR file
  - Clarified differences between hero battles (slots 1-20) and titan battles (slots 21-40)

---

*This documentation is based on network traffic analysis from Guild War gameplay sessions.*
