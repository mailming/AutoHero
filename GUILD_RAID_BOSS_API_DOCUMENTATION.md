# Hero Wars Guild Raid Boss API Documentation

## Overview

This document provides comprehensive documentation for the Hero Wars Guild Raid Boss API endpoints, including actual request and response examples captured from network traffic in `Boss2.har`.

**Base URL:** `https://heroes-wb.nextersglobal.com/api/`

**Protocol:** HTTPS

**Method:** POST

**Content-Type:** `application/json; charset=UTF-8`

---

## Authentication Headers

All API requests require the same authentication headers as other Hero Wars APIs:

| Header | Description | Example Value |
|--------|-------------|---------------|
| `X-Auth-User-Id` | User's unique identifier | `73660848` |
| `X-Auth-Token` | Authentication token | `ps-nXSputHQNgzhVMJxIFscmwqTPliGdAfCrjaKUkDbOZy/ov-1761358347-104.28.233.73-6454e221c47a6073792c019a80f5338e` |
| `X-Auth-Player-Id` | Player's unique identifier | `35979991` |
| `X-Auth-Session-Id` | Session identifier | `0t4o0ss08xlrca` |
| `X-Auth-Session-Key` | Session key (can be empty) | `` |
| `X-Auth-Signature` | Request signature for validation | `d6f7ec2a94a371bc178860784c84bf09` |
| `X-Auth-Application-Id` | Application identifier | `3` |
| `X-Auth-Network-Ident` | Network identifier | `web` |
| `X-Request-Id` | Unique request identifier | `20` |
| `X-Server-Time` | Server time offset | `0` |
| `X-Env-Unique-Session-Id` | Unique session identifier | `7387672360677220301` |
| `X-Env-Library-Version` | Library version | `1` |
| `X-Full-Referer` | Full referrer URL | `https://www.hero-wars.com/` |

---

## API Request Structure

All API requests follow the same JSON structure:

```json
{
  "calls": [
    {
      "name": "methodName",
      "args": { /* method-specific arguments */ },
      "context": {
        "actionTs": 106827  // Action timestamp in milliseconds
      },
      "ident": "body"
    }
  ]
}
```

---

## Guild Raid Boss Endpoints

### 1. clanRaid_getInfo

**Description:** Retrieves comprehensive information about the current Guild Raid (Minions Attack) status, including Asgard boss information, minion node status, shop items, buffs, and user statistics. This endpoint provides the current state of both boss battles and minion nodes.

**Note:** This API returns information for **Asgard bosses**:
- **Boss 1** = OSH
- **Boss 2** = Mastro

**Request:**

```json
{
  "calls": [
    {
      "name": "clanRaid_getInfo",
      "args": {},
      "context": {
        "actionTs": 1762577778086
      },
      "ident": "clanRaid_getInfo"
    }
  ]
}
```

**Request Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| (none) | - | This endpoint takes no arguments |

**Response Structure:**

The response contains multiple sections:

```json
{
  "boss": {
    "timestamps": {
      "start": 1762480800,
      "end": 1762736400
    },
    "teams": [
      {
        "statLevel": 485,
        "team": 21,
        "unitLevel": 130,
        "states": [
          {
            "1": {
              "id": 2025,
              "level": 130,
              "hp": 447630109.82,
              "state": {
                "hp": 104142623,
                "maxHp": 447979143,
                "isDead": false
              }
              // ... boss stats ...
            },
            "2": {
              "id": 2025,
              "level": 130,
              "hp": 859409061.01,
              "state": {
                "hp": 860079174,
                "maxHp": 860079174,
                "isDead": false
              }
              // ... boss stats ...
            }
          }
        ]
      }
    ],
    "level": 150
  },
  "nodes": {
    "1": {
      "reward": {
        "consumable": {
          "159": 15540,
          "169": 37,
          "170": 27
        }
      },
      "victoryPoints": [80],
      "timestamps": {
        "start": 1762135200,
        "end": 1762480800
      },
      "teams": [
        {
          "statLevel": 310,
          "team": 19,
          "unitLevel": 130,
          "victoryPoints": 80,
          "states": [
            {
              "1": {
                "id": 2030,
                "state": {
                  "isDead": true,
                  "hp": 0
                }
                // ... minion stats ...
              }
            }
          ],
          "points": 80
        }
      ]
    }
    // ... nodes 2-9 ...
  },
  "shop": {
    "1": {
      "buffId": 113,
      "buffValue": 5,
      "buyLimit": 5,
      "cost": {
        "gold": 1000000
      },
      "boughtCount": 0
    }
    // ... more shop items ...
  },
  "buffs": {
    "114": {
      "id": 114,
      "value": 5
    }
    // ... active buffs ...
  },
  "stats": {
    "currentBoss": "2",
    "points": "24119",
    "bossKilled": [],
    "clanBuff": [
      {
        "id": 30,
        "value": 24.119
      }
    ],
    "weekStart": "1762135200"
  },
  "userStats": {
    "damage": "21079289",
    "points": "1000",
    "usedHeroes": [46, 52, 48, 40, 37],
    "bossReward": [],
    "damageReward": {
      "15000": {
        "ascensionGear": {
          "1": "1",
          "2": "1",
          "3": "1"
        }
      }
      // ... more damage rewards ...
    }
  },
  "attempts": 0,
  "bossAttempts": 0,
  "lastBossId": "1",
  "coins": 0
}
```

**Response Fields:**

#### Boss Information (`boss`)

| Field | Type | Description |
|-------|------|-------------|
| `boss.timestamps.start` | Number | Boss event start timestamp |
| `boss.timestamps.end` | Number | Boss event end timestamp |
| `boss.teams` | Array | Boss team configurations with current states |
| `boss.teams[].states[].1` | Object | **Boss 1 (OSH)** - First phase stats and state |
| `boss.teams[].states[].2` | Object | **Boss 2 (Mastro)** - Second phase stats and state (if applicable) |
| `boss.level` | Number | Current boss level (e.g., 150) |

**Boss Identification:**
- **Boss 1** = **OSH** (id: 2025, first phase)
- **Boss 2** = **Mastro** (id: 2025, second phase, or separate boss)

#### Minion Nodes Information (`nodes`)

| Field | Type | Description |
|-------|------|-------------|
| `nodes[1-9]` | Object | Minion node status (nodes 1 through 9) |
| `nodes[].reward` | Object | Rewards available for this node |
| `nodes[].reward.consumable` | Object | Consumable items (fragments, etc.) |
| `nodes[].victoryPoints` | Array | Victory points available (e.g., [80]) |
| `nodes[].timestamps.start` | Number | Node start timestamp |
| `nodes[].timestamps.end` | Number | Node end timestamp |
| `nodes[].teams` | Array | Minion team configurations |
| `nodes[].teams[].states[].1` | Object | Minion hero state (isDead, hp, etc.) |
| `nodes[].teams[].points` | Number | Points earned from this team |

#### Current Status (`stats`)

| Field | Type | Description |
|-------|------|-------------|
| `stats.currentBoss` | String | Currently active boss ID ("1" = OSH, "2" = Mastro) |
| `stats.points` | String | Total clan points |
| `stats.bossKilled` | Array | Array of killed boss IDs |
| `stats.clanBuff` | Array | Active clan buffs |
| `stats.weekStart` | String | Week start timestamp |

#### User Statistics (`userStats`)

| Field | Type | Description |
|-------|------|-------------|
| `userStats.damage` | String | Total damage dealt by user |
| `userStats.points` | String | User's contribution points |
| `userStats.usedHeroes` | Array | Hero IDs that have been used in battles |
| `userStats.bossReward` | Array | Boss rewards claimed |
| `userStats.damageReward` | Object | Damage milestone rewards (keyed by damage threshold) |

#### Attempts and Resources

| Field | Type | Description |
|-------|------|-------------|
| `attempts` | Number | Remaining minion node attempts |
| `bossAttempts` | Number | Remaining boss battle attempts |
| `lastBossId` | String | Last boss ID fought ("1" = OSH, "2" = Mastro) |
| `coins` | Number | Raid coins available |

#### Shop and Buffs

| Field | Type | Description |
|-------|------|-------------|
| `shop` | Object | Available shop items (keyed by item ID) |
| `shop[].buffId` | Number | Buff ID this item provides |
| `shop[].buffValue` | Number | Buff value/amount |
| `shop[].buyLimit` | Number | Purchase limit for this item |
| `shop[].cost` | Object | Cost (gold or coins) |
| `shop[].boughtCount` | Number | Number of times already purchased |
| `buffs` | Object | Currently active buffs (keyed by buff ID) |
| `buffs[].id` | Number | Buff ID |
| `buffs[].value` | Number | Buff value |

**Usage Notes:**

- This endpoint provides the complete current state of Guild Raid (Minions Attack)
- **Boss Status**: The `boss` object contains current Asgard boss information (OSH and Mastro)
- **Minion Status**: The `nodes` object contains status of all 9 minion nodes
- Use `stats.currentBoss` to determine which boss is currently active
- Use `bossAttempts` and `attempts` to check remaining battle attempts
- `userStats.usedHeroes` tracks which heroes have been used (heroes can only be used once per day)
- Shop items provide buffs that enhance battle performance
- Active buffs are listed in the `buffs` object

**Example Usage:**

```javascript
// Get current Guild Raid status
const response = await Send(JSON.stringify({
  calls: [{
    name: "clanRaid_getInfo",
    args: {},
    context: { actionTs: Date.now() },
    ident: "clanRaid_getInfo"
  }]
}));

const raidInfo = response.results[0].result.response;

// Check current boss
const currentBoss = raidInfo.stats.currentBoss; // "1" = OSH, "2" = Mastro
console.log(`Current boss: ${currentBoss === "1" ? "OSH" : "Mastro"}`);

// Check boss attempts
console.log(`Boss attempts remaining: ${raidInfo.bossAttempts}`);

// Check minion node status
const node1 = raidInfo.nodes["1"];
console.log(`Node 1 status: ${node1.teams[0].states[0]["1"].state.isDead ? "Defeated" : "Active"}`);

// Check minion attempts
console.log(`Minion attempts remaining: ${raidInfo.attempts}`);
```

---

### 2. clanRaid_usersInBossBattle

**Description:** Retrieves information about other clan members currently fighting the same boss. Returns an empty array if no one is currently in battle.

**Request:**

```json
{
  "calls": [
    {
      "name": "clanRaid_usersInBossBattle",
      "args": {},
      "context": {
        "actionTs": 106827
      },
      "ident": "body"
    }
  ]
}
```

**Request Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| (none) | - | This endpoint takes no arguments |

**Response:**

When no users are in battle:

```json
{
  "date": 1762543730.265765,
  "results": [
    {
      "ident": "body",
      "result": {
        "response": []
      }
    }
  ]
}
```

When users are in battle, the response contains an array of user objects with their battle status.

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `date` | Number | Server timestamp of the response |
| `results[].ident` | String | Request identifier ("body") |
| `results[].result.response` | Array | Array of users currently in boss battle (empty if none) |

**Usage Notes:**

- This endpoint is typically called periodically to check if other clan members are fighting the boss
- An empty array indicates the boss is available for battle
- Used to coordinate multiple clan members attacking the same boss

---

### 3. clanRaid_startBossBattle

**Description:** Initiates a battle against a guild raid boss. Returns detailed battle configuration including hero stats, boss stats, and battle effects.

**Request:**

All 5 attacks from the HAR file are documented below. Each attack uses a different hero combination:

#### Attack 1

```json
{
  "calls": [
    {
      "name": "clanRaid_startBossBattle",
      "args": {
        "heroes": [46, 52, 48, 40, 37],
        "pet": 6005,
        "favor": {
          "37": 6000,
          "40": 6004,
          "46": 6001,
          "48": 6005,
          "52": 6006
        }
      },
      "context": {
        "actionTs": 172882
      },
      "ident": "body"
    }
  ]
}
```

#### Attack 2

```json
{
  "calls": [
    {
      "name": "clanRaid_startBossBattle",
      "args": {
        "heroes": [58, 50, 42, 9, 51],
        "pet": 6005,
        "favor": {
          "9": 6004,
          "42": 6006,
          "50": 6001,
          "58": 6005
        }
      },
      "context": {
        "actionTs": 284456
      },
      "ident": "body"
    }
  ]
}
```

#### Attack 3

```json
{
  "calls": [
    {
      "name": "clanRaid_startBossBattle",
      "args": {
        "heroes": [64, 13, 29, 1, 43],
        "pet": 6005,
        "favor": {
          "1": 6004,
          "13": 6008,
          "29": 6006,
          "43": 6002,
          "64": 6005
        }
      },
      "context": {
        "actionTs": 376716
      },
      "ident": "body"
    }
  ]
}
```

#### Attack 4

```json
{
  "calls": [
    {
      "name": "clanRaid_startBossBattle",
      "args": {
        "heroes": [16, 65, 57, 31, 61],
        "pet": 6005,
        "favor": {
          "16": 6004,
          "31": 6006,
          "57": 6003,
          "61": 6001,
          "65": 6000
        }
      },
      "context": {
        "actionTs": 429316
      },
      "ident": "body"
    }
  ]
}
```

#### Attack 5

```json
{
  "calls": [
    {
      "name": "clanRaid_startBossBattle",
      "args": {
        "heroes": [56, 62, 55, 63, 28],
        "pet": 6006,
        "favor": {
          "28": 6004,
          "55": 6005,
          "56": 6006,
          "62": 6008,
          "63": 6003
        }
      },
      "context": {
        "actionTs": 466406
      },
      "ident": "body"
    }
  ]
}
```

**Request Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `heroes` | Array[Number] | Array of 5 hero IDs to use in battle |
| `pet` | Number | Pet ID to use in battle (e.g., 6005 or 6006) |
| `favor` | Object | Favor pet assignments - mapping of hero ID (string) to pet ID (number). Note: Not all heroes may have favor assignments |

**Summary of All 5 Attacks:**

| Attack | Heroes | Pet | Favor Assignments | actionTs |
|--------|--------|-----|-------------------|----------|
| 1 | [46, 52, 48, 40, 37] | 6005 | 37→6000, 40→6004, 46→6001, 48→6005, 52→6006 | 172882 |
| 2 | [58, 50, 42, 9, 51] | 6005 | 9→6004, 42→6006, 50→6001, 58→6005 | 284456 |
| 3 | [64, 13, 29, 1, 43] | 6005 | 1→6004, 13→6008, 29→6006, 43→6002, 64→6005 | 376716 |
| 4 | [16, 65, 57, 31, 61] | 6005 | 16→6004, 31→6006, 57→6003, 61→6001, 65→6000 | 429316 |
| 5 | [56, 62, 55, 63, 28] | 6006 | 28→6004, 55→6005, 56→6006, 62→6008, 63→6003 | 466406 |

**Response:**

The response includes comprehensive battle data:

```json
{
  "date": 1762543796.3174701,
  "results": [
    {
      "ident": "body",
      "result": {
        "response": {
          "battle": {
            "userId": "35979991",
            "typeId": 11002,
            "attackers": {
              "46": {
                "id": 46,
                "xp": 3625195,
                "level": 130,
                "color": 18,
                "slots": [0, 0, 0, 0, 0, 0],
                "skills": {
                  "230": 130,
                  "231": 130,
                  "232": 130,
                  "233": 130,
                  "6007": 130
                },
                "power": 109893,
                "star": 6,
                "runes": [43750, 9850, 3740, 8260, 9830],
                "skins": {
                  "101": 35,
                  "315": 16,
                  "159": 10,
                  "262": 53
                },
                "currentSkin": 262,
                "titanGiftLevel": 30,
                "artifacts": [
                  {"level": 100, "star": 6},
                  {"level": 78, "star": 5},
                  {"level": 50, "star": 5}
                ],
                "scale": 1,
                "petId": 6001,
                "type": "hero",
                "perks": [9, 5, 1, 22],
                "ascensions": {
                  "1": [0, 1, 3, 5, 2, 4, 6, 7, 8, 9],
                  "2": [0]
                },
                "agility": 2122,
                "hp": 334910,
                "intelligence": 7077,
                "physicalAttack": 50,
                "strength": 5151,
                "armor": 10554.3,
                "magicPower": 45696,
                "magicResist": 9025,
                "skin": 262,
                "favorPetId": 6001,
                "favorPower": 5417
              }
              // ... additional heroes (52, 48, 40, 37) ...
            },
            "defenders": [
              {
                "1": {
                  "id": 2025,
                  "xp": 0,
                  "level": 130,
                  "color": 18,
                  "slots": [],
                  "skills": {
                    "3052": 130,
                    "3053": 130,
                    "3054": 130,
                    "3055": 130,
                    "3056": 130
                  },
                  "power": 22955853,
                  "star": 6,
                  "runes": [0, 0, 0, 0, 0],
                  "skins": [],
                  "currentSkin": 0,
                  "scale": "1.5",
                  "petId": 0,
                  "type": "hero",
                  "perks": null,
                  "ascensions": [],
                  "agility": 8725.85,
                  "armor": 79212.11,
                  "armorPenetration": 42748.41,
                  "hp": 447630109.82,
                  "intelligence": 39434.28,
                  "magicPenetration": 41724.51,
                  "magicPower": 218797.01,
                  "magicResist": 8689.38,
                  "physicalAttack": 296434.05,
                  "strength": 8725.85,
                  "skin": 0,
                  "favorPetId": 0,
                  "favorPower": 0,
                  "mainStat": "intelligence",
                  "stats": {
                    "additionalPower": 0,
                    "agility": 8725.8505347018272,
                    "anticrit": 0,
                    "antidodge": 0,
                    "armor": 79212.106718626412,
                    "armorPenetration": 42748.409808695746,
                    "dodge": 0,
                    "hp": 447630109.8180936,
                    "intelligence": 39434.278718236761,
                    "lifesteal": 0,
                    "magicPenetration": 41724.510717210644,
                    "magicPower": 218797.01134175769,
                    "magicResist": 8689.3840861536009,
                    "physicalAttack": 296434.0513363143,
                    "physicalCritChance": 0,
                    "strength": 8725.8505347018272
                  },
                  "state": {
                    "hp": 168618240,
                    "energy": 0,
                    "isDead": false,
                    "maxHp": 447979143
                  }
                },
                "2": {
                  "id": 2025,
                  "xp": 0,
                  "level": 130,
                  "color": 18,
                  "slots": [],
                  "skills": {
                    "3052": 130,
                    "3053": 130,
                    "3054": 130,
                    "3055": 130,
                    "3056": 130,
                    "2030": 1
                  },
                  "power": 44073148,
                  "star": 6,
                  "runes": [0, 0, 0, 0, 0],
                  "skins": [],
                  "currentSkin": 0,
                  "scale": "1.5",
                  "petId": 0,
                  "type": "hero",
                  "perks": null,
                  "ascensions": [],
                  "agility": 16752.84,
                  "armor": 152080.03,
                  "armorPenetration": 82073.06,
                  "hp": 859409061.01,
                  "intelligence": 75710.23,
                  "magicPenetration": 80107.26,
                  "magicPower": 420070.34,
                  "magicResist": 16682.83,
                  "physicalAttack": 569126.39,
                  "strength": 16752.84,
                  "skin": 0,
                  "favorPetId": 0,
                  "favorPower": 0,
                  "mainStat": "intelligence",
                  "stats": {
                    "additionalPower": 0,
                    "agility": 16752.838672133334,
                    "anticrit": 0,
                    "antidodge": 0,
                    "armor": 152080.03385566853,
                    "armorPenetration": 82073.055247421085,
                    "dodge": 0,
                    "hp": 859409061.01345468,
                    "intelligence": 75710.225254406789,
                    "lifesteal": 0,
                    "magicPenetration": 80107.262202035185,
                    "magicPower": 420070.34367322532,
                    "magicResist": 16682.826410630052,
                    "physicalAttack": 569126.39280428167,
                    "physicalCritChance": 0,
                    "strength": 16752.838672133334
                  },
                  "state": {
                    "hp": 860079174,
                    "energy": 0,
                    "isDead": false,
                    "maxHp": 860079174
                  }
                }
              }
            ],
            "effects": {
              "attackers": {
                "percentDamageBuff_any": 24.119,
                "bossAstralHealOnAttack": 200,
                "bossAstralSwitcherCDReduce": 5,
                "bossAstralFatigueStacksReduction": 3,
                "bossAstralParalyseHealReduction": 20,
                "bossAstralMaterialAuraDuration": 3,
                "bossAstralMaterialAuraReduction": 5,
                "bossAstralAntihealAuraReduction": 5,
                "bossAstralBonusEnergyOnSwitch": 10,
                "bossAstralDamageReductionOnSwitch_5": 20
              },
              "battleConfig": "clan_pvp"
            },
            "reward": [],
            "startTime": 1762543796,
            "seed": 2976712129,
            "type": "clan_raid",
            "result": {
              "raidId": "2",
              "level": "150"
            }
          },
          "endTime": 1762543976
        }
      }
    }
  ]
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `battle.userId` | String | User ID of the player |
| `battle.typeId` | Number | Battle type ID (11002 for clan raid) |
| `battle.attackers` | Object | Player heroes and pet data (keyed by hero/pet ID) |
| `battle.defenders` | Array | Boss phases (array with boss objects keyed by phase number "1", "2", etc.) |
| `battle.defenders[].1` | Object | First boss phase stats |
| `battle.defenders[].2` | Object | Second boss phase stats (if applicable) |
| `battle.effects.attackers` | Object | Active buffs and effects for attackers |
| `battle.effects.battleConfig` | String | Battle configuration type ("clan_pvp") |
| `battle.startTime` | Number | Battle start timestamp |
| `battle.seed` | Number | Random seed for battle simulation |
| `battle.type` | String | Battle type ("clan_raid") |
| `battle.result.raidId` | String | Raid ID |
| `battle.result.level` | String | Boss level |

**Boss Phase Structure:**

Each boss phase contains:
- **Stats**: Base stats (hp, armor, magicPower, etc.)
- **State**: Current battle state (hp, energy, isDead, maxHp)
- **Skills**: Boss skill levels
- **Scale**: Boss size multiplier ("1.5")

**Battle Effects:**

The `effects.attackers` object contains various buffs:
- `percentDamageBuff_any`: Overall damage increase percentage
- `bossAstralHealOnAttack`: Heal amount on attack
- `bossAstralSwitcherCDReduce`: Cooldown reduction percentage
- `bossAstralFatigueStacksReduction`: Fatigue stack reduction
- `bossAstralParalyseHealReduction`: Heal reduction when paralyzed
- `bossAstralMaterialAuraDuration`: Material aura duration
- `bossAstralMaterialAuraReduction`: Material aura reduction
- `bossAstralAntihealAuraReduction`: Anti-heal aura reduction
- `bossAstralBonusEnergyOnSwitch`: Bonus energy on switch
- `bossAstralDamageReductionOnSwitch_5`: Damage reduction on switch

---

### 4. clanRaid_endBossBattle

**Description:** Submits the battle result and progress to the server. Returns damage dealt, quest progress, and rewards.

**Request:**

```json
{
  "calls": [
    {
      "name": "clanRaid_endBossBattle",
      "args": {
        "result": {
          "win": false,
          "stars": 0
        },
        "progress": [
          {
            "v": 273,
            "b": 0,
            "seed": -1416505026,
            "attackers": {
              "input": ["auto", 0, 0, "auto", 0, 0],
              "heroes": {
                "6005": {
                  "hp": -1,
                  "energy": 233,
                  "isDead": false
                }
              }
            },
            "defenders": {
              "input": [],
              "heroes": {
                "1": {
                  "hp": 155333473,
                  "energy": 1000,
                  "isDead": false,
                  "extra": {
                    "damageTaken": 6693500,
                    "damageTakenNextLevel": 0
                  }
                },
                "2": {
                  "hp": 860079174,
                  "energy": 0,
                  "isDead": false
                }
              }
            }
          }
        ]
      },
      "context": {
        "actionTs": 383180
      },
      "ident": "group_1_body"
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
| `progress[].seed` | Number | Battle seed (must match start battle seed) |
| `progress[].attackers.input` | Array | Player input actions during battle |
| `progress[].attackers.heroes` | Object | Final state of player heroes/pet (keyed by ID) |
| `progress[].defenders.heroes` | Object | Final state of boss phases (keyed by phase number) |
| `progress[].defenders.heroes[].extra.damageTaken` | Number | Total damage dealt to this boss phase |
| `progress[].defenders.heroes[].extra.damageTakenNextLevel` | Number | Damage carried to next phase (if applicable) |

**Response:**

```json
{
  "date": 1762544008.237371,
  "results": [
    {
      "ident": "group_1_body",
      "result": {
        "response": {
          "damage": {
            "1": 6693500,
            "2": 0
          },
          "states": {
            "id": 2025,
            "xp": 0,
            "level": 130,
            "color": 18,
            "slots": [],
            "skills": {
              "3052": 130,
              "3053": 130,
              "3054": 130,
              "3055": 130,
              "3056": 130
            },
            "power": 22955853,
            "star": 6,
            "runes": [0, 0, 0, 0, 0],
            "skins": [],
            "currentSkin": 0,
            "titanGiftLevel": 0,
            "titanCoinsSpent": null,
            "artifacts": null,
            "scale": "1.5",
            "petId": 0,
            "type": "hero",
            "perks": null,
            "ascensions": [],
            "agility": 8725.85,
            "armor": 79212.11,
            "armorPenetration": 42748.41,
            "hp": 447630109.82,
            "intelligence": 39434.28,
            "magicPenetration": 41724.51,
            "magicPower": 218797.01,
            "magicResist": 8689.38,
            "physicalAttack": 296434.05,
            "strength": 8725.85,
            "skin": 0,
            "favorPetId": 0,
            "favorPower": 0,
            "mainStat": "intelligence",
            "stats": {
              "additionalPower": 0,
              "agility": 8725.8505347018272,
              "anticrit": 0,
              "antidodge": 0,
              "armor": 79212.106718626412,
              "armorPenetration": 42748.409808695746,
              "dodge": 0,
              "hp": 447630109.8180936,
              "intelligence": 39434.278718236761,
              "lifesteal": 0,
              "magicPenetration": 41724.510717210644,
              "magicPower": 218797.01134175769,
              "magicResist": 8689.3840861536009,
              "physicalAttack": 296434.0513363143,
              "physicalCritChance": 0,
              "strength": 8725.8505347018272
            },
            "state": {
              "hp": 155333473,
              "energy": 0,
              "isDead": false,
              "maxHp": 447979143
            }
          },
          "result": {
            "win": false,
            "stars": 0,
            "serverVersion": 273,
            "damage": {
              "1": 6693500,
              "2": 0
            },
            "raidId": "2",
            "level": "150"
          },
          "replay": "1762544000125308606",
          "quests": [
            {
              "id": 20000120,
              "state": 2,
              "progress": 56539621,
              "reward": {
                "clanQuestsPoints": 6,
                "prestige": 30
              },
              "createTime": 1762489829
            }
            // ... additional quests ...
          ]
        }
      }
    }
  ]
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `damage` | Object | Damage dealt per boss phase (keyed by phase number "1", "2", etc.) |
| `states` | Object | Updated boss state after battle |
| `result.win` | Boolean | Whether battle was won |
| `result.stars` | Number | Stars earned |
| `result.serverVersion` | Number | Server version that processed the battle |
| `result.damage` | Object | Confirmed damage per phase |
| `result.raidId` | String | Raid ID |
| `result.level` | String | Boss level |
| `replay` | String | Replay identifier for battle replay |
| `quests` | Array | Updated quest progress with rewards |

**Quest Progress Structure:**

Each quest in the `quests` array contains:
- `id`: Quest ID
- `state`: Quest state (1 = in progress, 2 = completed)
- `progress`: Current progress value
- `reward`: Reward object with `clanQuestsPoints` and `prestige`
- `createTime`: Quest creation timestamp

---

## Example Usage Flow

### 1. Check Who's Fighting

```javascript
// Check if other clan members are fighting
POST https://heroes-wb.nextersglobal.com/api/
{
  "calls": [{
    "name": "clanRaid_usersInBossBattle",
    "args": {},
    "context": {"actionTs": Date.now()},
    "ident": "body"
  }]
}
```

### 2. Start Boss Battle

```javascript
// Initiate raid boss battle
POST https://heroes-wb.nextersglobal.com/api/
{
  "calls": [{
    "name": "clanRaid_startBossBattle",
    "args": {
      "heroes": [46, 52, 48, 40, 37],
      "pet": 6005,
      "favor": {
        "37": 6000,
        "40": 6004,
        "46": 6001,
        "48": 6005,
        "52": 6006
      }
    },
    "context": {"actionTs": Date.now()},
    "ident": "body"
  }]
}
```

### 3. Submit Battle Result

```javascript
// Submit battle outcome and progress
POST https://heroes-wb.nextersglobal.com/api/
{
  "calls": [{
    "name": "clanRaid_endBossBattle",
    "args": {
      "result": {"win": false, "stars": 0},
      "progress": [{
        "v": 273,
        "b": 0,
        "seed": -1416505026,
        "attackers": {
          "input": ["auto", 0, 0, "auto", 0, 0],
          "heroes": {
            "6005": {"hp": -1, "energy": 233, "isDead": false}
          }
        },
        "defenders": {
          "input": [],
          "heroes": {
            "1": {
              "hp": 155333473,
              "energy": 1000,
              "isDead": false,
              "extra": {
                "damageTaken": 6693500,
                "damageTakenNextLevel": 0
              }
            },
            "2": {
              "hp": 860079174,
              "energy": 0,
              "isDead": false
            }
          }
        }
      }]
    },
    "context": {"actionTs": Date.now()},
    "ident": "group_1_body"
  }]
}
```

---

## Important Notes

### Boss Phases

- Bosses can have multiple phases (indicated by keys "1", "2", etc. in `defenders`)
- Each phase has separate HP pools and stats
- Damage is tracked per phase in the `damage` object
- The `extra.damageTaken` field in progress indicates damage dealt to that specific phase

### Battle Seed

- The `seed` value from `clanRaid_startBossBattle` must be used in `clanRaid_endBossBattle` progress
- The seed ensures battle simulation consistency between client and server

### Damage Calculation

- Damage is calculated per boss phase
- Total damage is the sum of all phase damages
- The `damage` object in the response confirms the damage accepted by the server

### Quest Progress

- Quests are automatically updated based on damage dealt
- Quest rewards include `clanQuestsPoints` and `prestige`
- Multiple quests can be completed in a single battle

### Battle Effects

- Various buffs from clan raid shop purchases are applied automatically
- Effects are listed in `battle.effects.attackers`
- These effects modify hero performance during battle

### Error Handling

- If battle seed doesn't match, server will reject the result
- Invalid hero/pet combinations will cause the request to fail
- Boss must be available (not being fought by another player) to start battle

---

## Data Models

### Boss Hero Object

```typescript
{
  id: number;              // Boss ID (e.g., 2025)
  level: number;          // Boss level (e.g., 130)
  hp: number;             // Current/max HP (very large numbers)
  state: {
    hp: number;           // Current HP
    energy: number;       // Current energy
    isDead: boolean;      // Whether boss is dead
    maxHp: number;        // Maximum HP
  };
  stats: {
    agility: number;
    armor: number;
    armorPenetration: number;
    hp: number;
    intelligence: number;
    magicPenetration: number;
    magicPower: number;
    magicResist: number;
    physicalAttack: number;
    strength: number;
    // ... other stats
  };
  skills: {
    [skillId: string]: number;  // Skill ID -> level
  };
  scale: string;          // Boss size multiplier (e.g., "1.5")
}
```

### Battle Progress Snapshot

```typescript
{
  v: number;              // Server version
  b: number;              // Battle index
  seed: number;           // Battle seed (must match start battle)
  attackers: {
    input: Array;         // Player input actions
    heroes: {
      [heroId: string]: {
        hp: number;
        energy: number;
        isDead: boolean;
      };
    };
  };
  defenders: {
    input: Array;         // Boss input actions (usually empty)
    heroes: {
      [phaseNumber: string]: {
        hp: number;
        energy: number;
        isDead: boolean;
        extra?: {
          damageTaken: number;
          damageTakenNextLevel: number;
        };
      };
    };
  };
}
```

---

## Source

This documentation is based on actual network traffic captured in `Boss2.har` on November 7, 2025, during guild raid boss battles.

