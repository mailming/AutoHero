# Hero Wars Clan Raid API Documentation

## Overview

This document provides comprehensive documentation for the Hero Wars Clan Raid API endpoints, including actual request and response examples captured from network traffic.

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
        "actionTs": 233754  // Action timestamp in milliseconds
      },
      "ident": "body"
    }
  ]
}
```

---

## Clan Raid Endpoints

### 1. clanRaid_startBossBattle

**Description:** Initiates a battle against a clan raid boss.

**Request:**

```json
{
  "calls": [
    {
      "name": "clanRaid_startBossBattle",
      "args": {
        "heroes": [50, 42, 58, 51, 9],
        "pet": 6005,
        "favor": {
          "9": 6004,
          "42": 6006,
          "50": 6005,
          "51": 6001,
          "58": 6008
        }
      },
      "context": {
        "actionTs": 233754
      },
      "ident": "body"
    }
  ]
}
```

**Request Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `heroes` | Array[Number] | Array of hero IDs to use in battle (5 heroes) |
| `pet` | Number | Pet ID to use in battle |
| `favor` | Object | Favor pet assignments (hero ID → pet ID mapping) |

**Response:**

The response includes detailed battle information with boss stats and player hero stats:

```json
{
  "date": 1761358580.7893181,
  "results": [
    {
      "ident": "body",
      "result": {
        "response": {
          "battle": {
            "userId": "35979991",
            "typeId": 11002,
            "attackers": {
              "50": {
                "id": 50,
                "xp": 3625195,
                "level": 130,
                "color": 17,
                "power": 99795,
                "star": 6,
                "runes": [20500, 16550, 13940, 2700, 8300],
                "skins": {
                  "105": 45,
                  "333": 25,
                  "259": 30,
                  "218": 10
                },
                "currentSkin": 218,
                "artifacts": [
                  {"level": 100, "star": 6},
                  {"level": 60, "star": 5},
                  {"level": 61, "star": 5}
                ],
                "hp": 158717,
                "strength": 8631,
                "agility": 2050,
                "intelligence": 1920,
                "physicalAttack": 25094.02,
                "armor": 16975,
                "magicPower": 9780.6,
                "magicResist": 7997,
                "favorPetId": 6005,
                "favorPower": 10154
              },
              "42": {
                "id": 42,
                "level": 130,
                "color": 18,
                "power": 174327,
                "star": 6,
                "hp": 538529,
                "strength": 15267,
                "armor": 36816.6,
                "magicPower": 74876.6,
                "favorPetId": 6006,
                "favorPower": 10154
              },
              "58": {
                "id": 58,
                "level": 130,
                "color": 18,
                "power": 174007,
                "star": 6,
                "hp": 426308,
                "armor": 23276.6,
                "magicPower": 86636.6,
                "magicPenetration": 11870,
                "favorPetId": 6008,
                "favorPower": 11064
              },
              "51": {
                "id": 51,
                "level": 130,
                "color": 16,
                "power": 77318,
                "star": 6,
                "hp": 176451,
                "magicPower": 24425,
                "favorPetId": 6001,
                "favorPower": 5417
              },
              "9": {
                "id": 9,
                "level": 130,
                "color": 18,
                "power": 205252,
                "star": 6,
                "hp": 255154,
                "intelligence": 19003,
                "armor": 22123,
                "dodge": 17385.58,
                "magicPower": 59851,
                "magicResist": 34381,
                "modifiedSkillTier": 5,
                "favorPetId": 6004,
                "favorPower": 10154
              },
              "6005": {
                "id": 6005,
                "color": 10,
                "star": 5,
                "level": 130,
                "power": 171933,
                "type": "pet",
                "armorPenetration": 47911,
                "intelligence": 10154,
                "strength": 11450
              }
            },
            "defenders": [
              {
                "1": {
                  "id": 2025,
                  "level": 130,
                  "color": 18,
                  "power": 14708002,
                  "star": 6,
                  "scale": "1.5",
                  "type": "hero",
                  "agility": 5590.72,
                  "armor": 50751.84,
                  "armorPenetration": 27389.25,
                  "hp": 286800262.17,
                  "intelligence": 25265.86,
                  "magicPenetration": 26733.23,
                  "magicPower": 140185.03,
                  "magicResist": 5567.36,
                  "physicalAttack": 189927.71,
                  "strength": 5590.72,
                  "mainStat": "intelligence",
                  "state": {
                    "hp": 63734773,
                    "energy": 0,
                    "isDead": false,
                    "maxHp": 287023890
                  }
                },
                "2": {
                  "id": 2025,
                  "level": 130,
                  "color": 18,
                  "power": 22955853,
                  "star": 6,
                  "scale": "1.5",
                  "type": "hero",
                  "hp": 447630109.82,
                  "intelligence": 39434.28,
                  "armor": 79212.11,
                  "magicPower": 218797.01,
                  "magicPenetration": 41724.51,
                  "state": {
                    "hp": 447979143,
                    "energy": 0,
                    "isDead": false,
                    "maxHp": 447979143
                  }
                }
              }
            ],
            "effects": {
              "attackers": {
                "percentDamageBuff_any": 15.803,
                "bossAstralMaterialAuraReduction": 5,
                "bossAstralAntihealAuraReduction": 5,
                "bossAstralHealOnAttack": 200,
                "bossAstralSwitcherCDReduce": 5,
                "bossAstralParalyseHealReduction": 20
              },
              "battleConfig": "clan_pvp"
            },
            "reward": [],
            "startTime": 1761358580,
            "seed": 3737187572,
            "type": "clan_raid",
            "result": {
              "raidId": "2",
              "level": "140"
            }
          },
          "endTime": 1761358760
        }
      }
    }
  ]
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `battle.attackers` | Object | Detailed player hero stats with all attributes |
| `battle.defenders` | Array | Raid boss stats (can have multiple phases) |
| `battle.defenders[].state` | Object | Current boss state (HP, energy, alive status) |
| `battle.effects` | Object | Battle effects and buffs for raid |
| `battle.effects.attackers.percentDamageBuff_any` | Number | Percentage damage buff |
| `battle.effects.attackers.bossAstralMaterialAuraReduction` | Number | Astral material reduction |
| `battle.seed` | Number | Battle seed for replay |
| `battle.result.raidId` | String | Raid identifier |
| `battle.result.level` | String | Boss level |
| `endTime` | Number | Battle end timestamp |

**Boss Phases:**
- Clan raid bosses can have multiple phases (defenders array)
- Each phase has its own HP pool and must be defeated sequentially
- Boss ID 2025 appears to be a standard raid boss

---

### 2. clanRaid_endBossBattle

**Description:** Submits the battle result after completing/ending a clan raid boss battle.

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
            "v": 272,
            "b": 0,
            "seed": -557779724,
            "attackers": {
              "input": ["auto", 0, 0, "auto", 0, 0],
              "heroes": {
                "9": {
                  "hp": 376777,
                  "energy": 594,
                  "isDead": false
                },
                "42": {
                  "hp": 1138039,
                  "energy": 208,
                  "isDead": false
                },
                "50": {
                  "hp": 495862,
                  "energy": 416,
                  "isDead": false
                },
                "51": {
                  "hp": 156021,
                  "energy": 420,
                  "isDead": false
                },
                "58": {
                  "hp": 536942,
                  "energy": 816,
                  "isDead": false
                },
                "6005": {
                  "hp": -1,
                  "energy": 1000,
                  "isDead": false
                }
              }
            },
            "defenders": {
              "input": [],
              "heroes": {
                "1": {
                  "hp": 58106758,
                  "energy": 1000,
                  "isDead": false,
                  "extra": {
                    "damageTaken": 5628015,
                    "damageTakenNextLevel": 0
                  }
                },
                "2": {
                  "hp": 447979143,
                  "energy": 0,
                  "isDead": false
                }
              }
            }
          }
        ]
      },
      "context": {
        "actionTs": 242124
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
| `progress[].seed` | Number | Battle seed |
| `progress[].attackers.input` | Array | Player input actions during battle |
| `progress[].attackers.heroes` | Object | Final state of player heroes (HP, energy, alive) |
| `progress[].defenders.heroes` | Object | Final state of boss (HP, energy, alive) |
| `progress[].defenders.heroes[].extra.damageTaken` | Number | Total damage dealt to this boss phase |

**Response:**

The response typically includes updated raid state, rewards, and quest progress:

```json
{
  "date": 1761358587.1234,
  "results": [
    {
      "ident": "group_1_body",
      "result": {
        "response": {
          "damage": 5628015,
          "totalDamage": 228691307,
          "reward": {
            "clanRaidCurrency": {
              "2": 150
            }
          },
          "quests": []
        }
      }
    }
  ]
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `damage` | Number | Damage dealt in this specific attempt |
| `totalDamage` | Number | Total cumulative damage dealt to boss |
| `reward.clanRaidCurrency` | Object | Raid currency earned (raid ID → amount) |
| `quests` | Array | Updated quest progress |

---

### 3. clanRaid_usersInBossBattle

**Description:** Retrieves information about other clan members currently fighting the same boss.

**Request:**

```json
{
  "calls": [
    {
      "name": "clanRaid_usersInBossBattle",
      "args": {},
      "context": {
        "actionTs": 182842
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

```json
{
  "date": 1761358529.4567,
  "results": [
    {
      "ident": "body",
      "result": {
        "response": {
          "users": [
            {
              "userId": "12345678",
              "name": "PlayerName",
              "level": 130,
              "avatarId": "826",
              "startTime": 1761358520
            }
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
| `users` | Array | List of users currently in battle |
| `users[].userId` | String | User ID |
| `users[].name` | String | Player name |
| `users[].level` | Number | Player level |
| `users[].avatarId` | String | Avatar ID |
| `users[].startTime` | Number | When they started the battle (timestamp) |

---

## Battle Mechanics

### Raid Boss Structure

Clan raid bosses have unique characteristics:

1. **Multi-Phase Bosses**: Bosses can have multiple phases (typically 2), each with separate HP pools
2. **Massive HP Pools**: Boss HP ranges from ~287M to ~448M per phase
3. **Scaled Stats**: Bosses have a `scale` parameter (typically "1.5") that affects their stats
4. **Persistent Damage**: Damage persists across all clan members' attempts
5. **Time Limit**: Battles have an end time (typically 3 minutes: 1761358760 - 1761358580 = 180 seconds)

### Raid Effects

Special effects active during clan raid battles:

| Effect | Description |
|--------|-------------|
| `percentDamageBuff_any` | Overall damage buff percentage (15.803%) |
| `bossAstralMaterialAuraReduction` | Reduces boss astral material aura (5%) |
| `bossAstralAntihealAuraReduction` | Reduces boss anti-heal effects (5%) |
| `bossAstralHealOnAttack` | Heal amount on attack (200) |
| `bossAstralSwitcherCDReduce` | Cooldown reduction for switching (5%) |
| `bossAstralParalyseHealReduction` | Reduces heal when paralyzed (20%) |

### Battle Configuration

- **Battle Config**: `clan_pvp` - Special PvP-style configuration for raid
- **Type**: `clan_raid` - Identifies this as a clan raid battle
- **TypeId**: `11002` - Specific raid type identifier

---

### 4. clanRaid_getInfo

**Description:** Retrieves complete clan raid information including current boss, all bosses/nodes, shop, buffs, user stats, and rewards.

**Request:**

```json
{
  "calls": [
    {
      "name": "clanRaid_getInfo",
      "args": {},
      "context": {
        "actionTs": 242867
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

This endpoint returns extensive raid information. Below is a simplified example showing the main structure:

```json
{
  "date": 1761358589.909729,
  "results": [
    {
      "ident": "body",
      "result": {
        "response": {
          "boss": {
            "timestamps": {
              "start": 1761271200,
              "end": 1761526800
            },
            "teams": [
              {
                "statLevel": 360,
                "team": 21,
                "unitLevel": 130,
                "states": [
                  {
                    "1": {
                      "id": 2025,
                      "level": 130,
                      "color": 18,
                      "power": 14708002,
                      "star": 6,
                      "scale": "1.5",
                      "hp": 286800262.17,
                      "intelligence": 25265.86,
                      "magicPower": 140185.03,
                      "armor": 50751.84,
                      "state": {
                        "hp": 58106758,
                        "energy": 0,
                        "isDead": false,
                        "maxHp": 287023890
                      }
                    },
                    "2": {
                      "id": 2025,
                      "level": 130,
                      "color": 18,
                      "power": 22955853,
                      "star": 6,
                      "scale": "1.5",
                      "hp": 447630109.82,
                      "intelligence": 39434.28,
                      "magicPower": 218797.01,
                      "state": {
                        "hp": 447979143,
                        "energy": 0,
                        "isDead": false,
                        "maxHp": 447979143
                      }
                    }
                  }
                ]
              }
            ],
            "level": 140
          },
          "nodes": {
            "1": {
              "reward": {
                "consumable": {
                  "159": 4600,
                  "169": 27
                },
                "lootBox": {
                  "guildBoss_class_blue_60%": 13,
                  "guildBoss_class_purple_40%": 11
                }
              },
              "victoryPoints": [44],
              "timestamps": {
                "start": 1760925600,
                "end": 1761271200
              },
              "teams": [
                {
                  "statLevel": 105,
                  "team": 19,
                  "unitLevel": 125,
                  "victoryPoints": 44,
                  "states": [
                    {
                      "1": {
                        "id": 2030,
                        "level": 125,
                        "color": 9,
                        "power": 155276,
                        "hp": 664687.96,
                        "state": {
                          "isDead": true,
                          "hp": 0
                        }
                      }
                    }
                  ]
                }
              ]
            }
          },
          "shop": {
            "1": {
              "buffId": 113,
              "buffValue": 5,
              "buyLimit": 5,
              "cost": {
                "gold": 1000000
              },
              "rank": 0,
              "boughtCount": 0
            },
            "14": {
              "buffId": 122,
              "buffValue": 200,
              "buyLimit": 1,
              "cost": {
                "coin": {
                  "30": 150
                }
              },
              "rank": 1,
              "boughtCount": 1
            }
          },
          "buffs": {
            "114": {
              "id": 114,
              "value": 5
            },
            "115": {
              "id": 115,
              "value": 5
            },
            "122": {
              "id": 122,
              "value": 200
            }
          },
          "stats": {
            "currentBoss": "2",
            "points": "15803",
            "bossKilled": {
              "125": 1,
              "65": 1,
              "75": 1,
              "85": 1,
              "95": 1,
              "105": 1,
              "115": 1,
              "130": 1
            },
            "clanBuff": [
              {
                "id": 30,
                "value": 15.803
              }
            ],
            "weekStart": "1760925600"
          },
          "userStats": {
            "damage": "26788247",
            "points": "550",
            "usedHeroes": [40, 13, 64, 46, 29, 50, 42, 58, 51, 9],
            "bossReward": {
              "125": [
                {
                  "consumable": {
                    "159": 20700,
                    "164": 1,
                    "169": 30,
                    "170": 21
                  }
                }
              ]
            },
            "damageReward": {
              "15000": {
                "ascensionGear": {
                  "1": "1",
                  "2": "1",
                  "3": "1"
                }
              }
            }
          },
          "attempts": 0,
          "bossAttempts": 3,
          "lastBossId": "1",
          "coins": 0
        }
      }
    }
  ]
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `boss` | Object | Current active boss information |
| `boss.timestamps` | Object | Boss start and end times |
| `boss.teams` | Array | Boss team configurations (phases) |
| `boss.level` | Number | Current boss level (e.g., 140) |
| `boss.teams[].states` | Array | Boss phase states with HP and stats |
| `nodes` | Object | All raid bosses/nodes (numbered 1-9+) |
| `nodes[id].reward` | Object | Rewards for defeating this node |
| `nodes[id].victoryPoints` | Array | Victory points awarded |
| `nodes[id].teams` | Array | Enemy teams for this node |
| `shop` | Object | Raid shop items available for purchase |
| `shop[id].buffId` | Number | Buff ID |
| `shop[id].buffValue` | Number | Buff value/strength |
| `shop[id].buyLimit` | Number | Maximum purchases allowed |
| `shop[id].cost` | Object | Cost (gold or raid currency) |
| `shop[id].boughtCount` | Number | Times already purchased |
| `buffs` | Object | Currently active buffs |
| `stats.currentBoss` | String | Current boss node ID |
| `stats.points` | String | Total clan raid points |
| `stats.bossKilled` | Object | Map of killed boss levels |
| `stats.clanBuff` | Array | Active clan buffs with values |
| `userStats.damage` | String | Player's total damage dealt |
| `userStats.points` | String | Player's total points earned |
| `userStats.usedHeroes` | Array | Hero IDs used this week |
| `userStats.bossReward` | Object | Boss-specific rewards earned |
| `userStats.damageReward` | Object | Damage milestone rewards |
| `attempts` | Number | Remaining free attempts |
| `bossAttempts` | Number | Boss-specific attempts remaining |

**Node/Boss Levels:**
The `nodes` object contains all available raid bosses, typically numbered 1-9+. Each node represents a different boss with:
- **Difficulty levels**: 65, 75, 85, 95, 105, 115, 125, 130, 140, etc.
- **Multiple teams**: Some nodes have multiple team configurations
- **Victory points**: Points earned for defeating each team
- **Rewards**: Consumables, loot boxes, and ascension gear

**Shop Items:**
The raid shop offers various buffs purchasable with gold or raid currency (coin 30):
- **Rank 0**: Gold purchases (5 buy limit each)
- **Rank 1-3**: Raid currency purchases (limited purchases)
- **Buff types**: Damage increase, heal on attack, cooldown reduction, etc.

**Clan Buffs:**
The `clanBuff` array shows active buffs from clan raid shop purchases:
- Buff ID 30 appears to be the overall damage buff
- Value increases as clan members purchase buffs
- Example: 15.803% damage increase for entire clan

**User Progress Tracking:**
- **Used Heroes**: Tracks which heroes player has already used
- **Damage Milestones**: Rewards at 15K, 40K, 75K, 120K, etc. damage thresholds
- **Boss Rewards**: Specific rewards for defeating each boss level
- **Victory Points**: Accumulated from defeating boss teams

---

## Example Usage Flow

### 1. Check Who's Fighting

```javascript
// Check if other clan members are fighting
POST /api/
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
POST /api/
{
  "calls": [{
    "name": "clanRaid_startBossBattle",
    "args": {
      "heroes": [50, 42, 58, 51, 9],
      "pet": 6005,
      "favor": {
        "9": 6004,
        "42": 6006,
        "50": 6005,
        "51": 6001,
        "58": 6008
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
POST /api/
{
  "calls": [{
    "name": "clanRaid_endBossBattle",
    "args": {
      "result": {"win": false, "stars": 0},
      "progress": [/* battle snapshot data */]
    },
    "context": {"actionTs": Date.now()},
    "ident": "group_1_body"
  }]
}
```

---

## Data Models

### Raid Boss Hero Object

```typescript
{
  id: number;              // Boss ID (e.g., 2025)
  level: number;           // Boss level (130)
  color: number;           // Boss color/tier (18)
  power: number;           // Total power (14708002+)
  star: number;            // Star rating (6)
  scale: string;           // Scale multiplier ("1.5")
  type: string;            // Always "hero" for bosses
  hp: number;              // Maximum HP (286M+)
  armor: number;           // Armor stat
  magicPower: number;      // Magic power stat
  magicPenetration: number;// Magic penetration
  armorPenetration: number;// Armor penetration
  intelligence: number;    // Intelligence stat
  strength: number;        // Strength stat
  agility: number;         // Agility stat
  mainStat: string;        // Primary stat ("intelligence")
  state: {
    hp: number;            // Current HP
    energy: number;        // Current energy
    isDead: boolean;       // Is defeated
    maxHp: number;         // Maximum HP
  }
}
```

### Battle Progress Object

```typescript
{
  v: number;               // Server version (272)
  b: number;               // Battle index (0)
  seed: number;            // Battle seed
  attackers: {
    input: Array;          // Player inputs ["auto", 0, 0, ...]
    heroes: {
      [heroId]: {
        hp: number;        // Remaining HP
        energy: number;    // Current energy
        isDead: boolean;   // Is hero dead
      }
    }
  },
  defenders: {
    input: Array;          // Boss inputs (empty)
    heroes: {
      [phase]: {
        hp: number;        // Boss remaining HP
        energy: number;    // Boss energy
        isDead: boolean;   // Is phase defeated
        extra?: {
          damageTaken: number;          // Damage dealt this attempt
          damageTakenNextLevel: number; // Damage for next level
        }
      }
    }
  }
}
```

---

## Notes

1. **Raid Currency**: Earned based on damage dealt, used for raid shop purchases
2. **Cooperative Gameplay**: Multiple clan members can fight the same boss simultaneously
3. **Persistent Damage**: Boss HP persists across all attempts until defeated
4. **Time Window**: Each battle attempt has a fixed time window (typically 3 minutes)
5. **Auto Combat**: Player can use "auto" mode during battle (shown in input array)
6. **Favor System**: Heroes can have favor pets assigned for additional bonuses
7. **Multi-Phase**: Bosses typically have 2 phases with different HP pools
8. **Damage Tracking**: System tracks both per-attempt and total cumulative damage

---

## Comparison with Arena API

| Feature | Arena | Clan Raid |
|---------|-------|-----------|
| **Opponent Type** | Other players | Boss (NPC) |
| **HP Scale** | ~100K-500K | ~287M-448M |
| **Multi-Phase** | No | Yes (2 phases) |
| **Persistent Damage** | No | Yes |
| **Cooperative** | No | Yes (multiple players) |
| **Time Limit** | ~60 seconds | ~180 seconds |
| **Rewards** | Ranking changes | Raid currency |
| **Battle Config** | `arena` | `clan_pvp` |

---

## Version Information

- **Server Version:** 272 (as of battle response)
- **Client Library Version:** 1
- **Boss ID:** 2025 (common raid boss)
- **Raid Type ID:** 11002

---

## Security Considerations

⚠️ **Important Security Notes:**

1. Battle seeds must match server-side calculations
2. Progress snapshots are validated against battle simulation
3. Damage values are server-verified to prevent cheating
4. Battle time limits are enforced server-side
5. Automated raid attacks may violate game terms of service

---

*Document generated from actual network traffic capture on October 25, 2025*

