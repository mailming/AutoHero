# Battle Simulation API Documentation

## Overview
The Battle Simulation API allows players to simulate battles between teams without consuming resources or affecting game state. This is used for testing team compositions, strategies, and battle outcomes in various game modes (Arena, Grand Arena, etc.).

## API Endpoints

### 1. `demoBattles_startBattle`

Starts a new battle simulation with specified attacker and defender teams.

### Request

**Endpoint:** `https://heroes-wb.nextersglobal.com/api/`

**Method:** `POST`

**Headers:**
- `Content-Type: application/json; charset=UTF-8`
- `x-auth-application-id: 3`
- `x-auth-network-ident: web`
- `x-auth-player-id: <player_id>`
- `x-auth-user-id: <user_id>`
- `x-auth-token: <auth_token>`
- `x-auth-signature: <signature>`
- `x-auth-session-id: <session_id>`
- `x-env-unique-session-id: <unique_session_id>`
- `x-request-id: <request_id>`
- `x-server-time: 0`
- `Origin: https://www.hero-wars.com`
- `Referer: https://www.hero-wars.com/`

**Request Body:**
```json
{
  "calls": [
    {
      "name": "demoBattles_startBattle",
      "args": {
        "mechanic": "arena",
        "defenceMaxUpgrade": true,
        "defenceTeam": {
          "units": [57, 58, 63, 48, 67],
          "pet": 6008
        },
        "defenceBanner": 5,
        "defenceBannerStones": {},
        "defenceFavor": {
          "48": 6000,
          "58": 6002,
          "63": 6003,
          "67": 6001
        },
        "maxUpgrade": true,
        "team": {
          "units": [31, 58, 13, 40, 56],
          "pet": 6008
        },
        "banner": 3,
        "bannerStones": {},
        "favor": {
          "13": 6002,
          "31": 6006,
          "40": 6004,
          "56": 6001,
          "58": 6005
        },
        "defenceBuffs": {},
        "buffs": {},
        "parentId": 0,
        "entryId": 0
      },
      "context": {
        "actionTs": 405488
      },
      "ident": "body"
    }
  ]
}
```

**Request Parameters:**

#### Top Level
- `name`: `"demoBattles_startBattle"` - The API method name
- `args`: Object - Battle configuration parameters
- `context.actionTs`: Number - Action timestamp
- `ident`: `"body"` - Identifier for the request

#### Args Object (`args`)
- `mechanic`: String - Battle mechanic type (e.g., `"arena"`, `"grandArena"`, etc.)
- `defenceMaxUpgrade`: Boolean - Whether to apply maximum upgrades to defense team
- `defenceTeam`: Object - Defender team configuration
  - `units`: Array<Number> - Array of hero IDs (e.g., `[57, 58, 63, 48, 67]`)
  - `pet`: Number - Pet ID (e.g., `6008`)
- `defenceBanner`: Number - Banner ID for defense team (e.g., `5`)
- `defenceBannerStones`: Object - Banner stones configuration for defense (usually empty `{}`)
- `defenceFavor`: Object - Favor pet assignments for defense heroes
  - Keys are hero IDs as strings (e.g., `"48"`)
  - Values are favor pet IDs (e.g., `6000`)
- `maxUpgrade`: Boolean - Whether to apply maximum upgrades to attack team
- `team`: Object - Attacker team configuration
  - `units`: Array<Number> - Array of hero IDs (e.g., `[31, 58, 13, 40, 56]`)
  - `pet`: Number - Pet ID (e.g., `6008`)
- `banner`: Number - Banner ID for attack team (e.g., `3`)
- `bannerStones`: Object - Banner stones configuration for attack (usually empty `{}`)
- `favor`: Object - Favor pet assignments for attack heroes
  - Keys are hero IDs as strings (e.g., `"13"`)
  - Values are favor pet IDs (e.g., `6002`)
- `defenceBuffs`: Object - Buffs applied to defense team (usually empty `{}`)
- `buffs`: Object - Buffs applied to attack team (usually empty `{}`)
- `parentId`: Number - Parent battle ID
  - Use `0` for the first battle in a simulation session
  - For retry battles, use the `parentId` from the previous battle's `endBattle` response (`result.response.battle.parentId`)
  - The `parentId` links retry battles to the original battle session
- `entryId`: Number - Entry ID (use `0` for new battles)

### Response

**Status Code:** `200 OK`

**Response Body Structure:**
```json
{
  "date": 1764567438.155992,
  "results": [
    {
      "ident": "body",
      "result": {
        "response": {
          "battle": {
            "userId": "35979991",
            "typeId": "35979991",
            "attackers": {
              "<hero_id>": {
                "id": 31,
                "xp": 3625195,
                "level": 130,
                "color": 18,
                "slots": [0, 0, 0, 0, 0, 0],
                "skills": {
                  "<skill_id>": 130
                },
                "power": 202858,
                "star": 6,
                "runes": [43750, 43750, 43750, 43750, 43750],
                "skins": {
                  "<skin_id>": 60
                },
                "currentSkin": 44,
                "titanGiftLevel": 30,
                "titanCoinsSpent": null,
                "artifacts": [
                  {
                    "level": 130,
                    "star": 6
                  }
                ],
                "scale": 1,
                "petId": 6006,
                "type": "hero",
                "perks": [9, 5, 2, 20],
                "ascensions": {
                  "1": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
                  "2": [0, 1, 2, 3, 4, 5, 6, 7, 8, 10]
                },
                "agility": 2781,
                "dodge": 12620,
                "hp": 453104,
                "intelligence": 18945,
                "physicalAttack": 78,
                "strength": 2916,
                "armor": 32339.6,
                "magicPower": 76036.6,
                "magicResist": 19856,
                "skin": 44,
                "favorPetId": 6006,
                "favorPower": 11064,
                "state": {
                  "hp": 569744,
                  "energy": 0,
                  "isDead": false,
                  "maxHp": 569744
                }
              }
            },
            "defenders": [
              {
                "<hero_id>": {
                  "id": 57,
                  "xp": 3625195,
                  "level": 130,
                  "color": 18,
                  "slots": [0, 0, 0, 0, 0, 0],
                  "skills": {
                    "<skill_id>": 130
                  },
                  "power": 195299,
                  "star": 6,
                  "runes": [43750, 43750, 43750, 43750, 43750],
                  "skins": {
                    "<skin_id>": 60
                  },
                  "currentSkin": 269,
                  "titanGiftLevel": 30,
                  "titanCoinsSpent": null,
                  "artifacts": [
                    {
                      "level": 130,
                      "star": 6
                    }
                  ],
                  "scale": 1,
                  "petId": 0,
                  "type": "hero",
                  "perks": [5, 8, 2, 22],
                  "ascensions": {
                    "1": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
                  },
                  "agility": 3249,
                  "hp": 346518,
                  "intelligence": 2854,
                  "physicalAttack": 52117,
                  "strength": 18671,
                  "armor": 47498,
                  "magicPower": 3024,
                  "magicResist": 45098,
                  "skin": 269,
                  "favorPetId": 0,
                  "favorPower": 0,
                  "state": {
                    "hp": 1093358,
                    "energy": 0,
                    "isDead": false,
                    "maxHp": 1093358
                  }
                }
              }
            ],
            "effects": {
              "defenders": {
                "percentBuffByPerk_castSpeed_10": 5
              },
              "defendersBanner": {
                "id": 5,
                "slots": []
              },
              "attackers": {
                "percentBuffAllEnemy_healing": -10
              },
              "attackersBanner": {
                "id": 3,
                "slots": []
              }
            },
            "reward": [],
            "startTime": 1764567438,
            "seed": 774012097,
            "type": "arena"
          }
        }
      }
    }
  ]
}
```

**Response Fields:**

#### Top Level
- `date`: Number - Server timestamp (e.g., `1764567438.155992`)
- `results`: Array - Array of result objects
  - `ident`: String - Identifier matching the request (`"body"`)
  - `result.response`: Object - The actual response data

#### Battle Object (`result.response.battle`)
- `userId`: String - User ID (e.g., `"35979991"`)
- `typeId`: String - Type ID (usually same as userId)
- `attackers`: Object - Attacker heroes and pets
  - Keys are hero/pet IDs as strings (e.g., `"31"`, `"6008"`)
  - Values are hero/pet objects with detailed stats
- `defenders`: Array - Array of defender team objects
  - Each element is an object with hero/pet IDs as keys
  - Values are hero/pet objects with detailed stats
- `effects`: Object - Battle effects and buffs
  - `defenders`: Object - Effects applied to defenders
  - `defendersBanner`: Object - Banner configuration for defenders
  - `attackers`: Object - Effects applied to attackers
  - `attackersBanner`: Object - Banner configuration for attackers
- `reward`: Array - Rewards (empty for simulations)
- `startTime`: Number - Battle start timestamp
- `seed`: Number - Random seed for battle simulation
- `type`: String - Battle type (e.g., `"arena"`)

#### Hero/Pet Object Structure
- `id`: Number - Hero/Pet ID
- `xp`: Number - Experience points
- `level`: Number - Level (e.g., `130`)
- `color`: Number - Color/rarity (e.g., `18`)
- `slots`: Array<Number> - Equipment slots (usually `[0, 0, 0, 0, 0, 0]`)
- `skills`: Object - Skill levels
  - Keys are skill IDs as strings
  - Values are skill levels (e.g., `130`)
- `power`: Number - Total power
- `star`: Number - Star level (e.g., `6`)
- `runes`: Array<Number> - Rune values
- `skins`: Object - Available skins
  - Keys are skin IDs as strings
  - Values are skin levels (e.g., `60`)
- `currentSkin`: Number - Currently equipped skin ID
- `titanGiftLevel`: Number - Titan gift level
- `titanCoinsSpent`: Number | null - Titan coins spent
- `artifacts`: Array - Artifact configurations
  - `level`: Number - Artifact level
  - `star`: Number - Artifact star level
- `scale`: Number - Scale factor (usually `1`)
- `petId`: Number - Pet ID (for heroes) or `0` if no pet
- `type`: String - Type (`"hero"` or `"pet"`)
- `perks`: Array<Number> - Perk IDs
- `ascensions`: Object - Ascension data
  - Keys are ascension paths as strings (e.g., `"1"`, `"2"`)
  - Values are arrays of ascension node IDs
- `agility`: Number - Agility stat
- `dodge`: Number - Dodge stat
- `hp`: Number - Base HP
- `intelligence`: Number - Intelligence stat
- `physicalAttack`: Number - Physical attack stat
- `strength`: Number - Strength stat
- `armor`: Number - Armor stat
- `magicPower`: Number - Magic power stat
- `magicResist`: Number - Magic resistance stat
- `magicPenetration`: Number - Magic penetration (optional)
- `armorPenetration`: Number - Armor penetration (optional)
- `physicalCritChance`: Number - Physical crit chance (optional)
- `skin`: Number - Currently equipped skin ID
- `favorPetId`: Number - Favor pet ID
- `favorPower`: Number - Favor pet power
- `modifiedSkillTier`: Number - Modified skill tier (optional)
- `state`: Object - Current battle state
  - `hp`: Number - Current HP (can be `-1` for pets)
  - `energy`: Number - Current energy
  - `isDead`: Boolean - Whether unit is dead
  - `maxHp`: Number - Maximum HP (can be `-1` for pets)

---

### 2. `demoBattles_endBattle`

Ends a battle simulation and returns the battle result and replay data.

### Request

**Endpoint:** `https://heroes-wb.nextersglobal.com/api/`

**Method:** `POST`

**Headers:**
- `Content-Type: application/json; charset=UTF-8`
- `x-auth-application-id: 3`
- `x-auth-network-ident: web`
- `x-auth-player-id: <player_id>`
- `x-auth-user-id: <user_id>`
- `x-auth-token: <auth_token>`
- `x-auth-signature: <signature>`
- `x-auth-session-id: <session_id>`
- `x-env-unique-session-id: <unique_session_id>`
- `x-request-id: <request_id>`
- `x-server-time: 0`
- `Origin: https://www.hero-wars.com`
- `Referer: https://www.hero-wars.com/`

**Request Body:**
```json
{
  "calls": [
    {
      "name": "demoBattles_endBattle",
      "args": {
        "result": {
          "win": false,
          "stars": 0
        },
        "progress": [
          {
            "v": 273,
            "b": 0,
            "seed": -1566019136,
            "attackers": {
              "input": [],
              "heroes": {
                "6008": {
                  "hp": -1,
                  "energy": 491,
                  "isDead": false
                }
              }
            },
            "defenders": {
              "input": [],
              "heroes": {
                "48": {
                  "hp": 434998,
                  "energy": 400,
                  "isDead": false,
                  "extra": {
                    "hero48StartEnergy": 1
                  }
                },
                "57": {
                  "hp": 610200,
                  "energy": 100,
                  "isDead": false
                },
                "58": {
                  "hp": 185406,
                  "energy": 669,
                  "isDead": false
                },
                "63": {
                  "hp": 621150,
                  "energy": 100,
                  "isDead": false
                },
                "67": {
                  "hp": 326219,
                  "energy": 669,
                  "isDead": false
                },
                "6008": {
                  "hp": -1,
                  "energy": 425,
                  "isDead": false
                }
              }
            }
          }
        ]
      },
      "context": {
        "actionTs": 416478
      },
      "ident": "body"
    }
  ]
}
```

**Request Parameters:**

#### Top Level
- `name`: `"demoBattles_endBattle"` - The API method name
- `args`: Object - Battle end parameters
- `context.actionTs`: Number - Action timestamp
- `ident`: `"body"` - Identifier for the request

#### Args Object (`args`)
- `result`: Object - Battle result
  - `win`: Boolean - Whether the attacker won (`true`) or lost (`false`)
  - `stars`: Number - Stars earned (0-3, usually `0` for simulations)
- `progress`: Array - Battle progress snapshots
  - `v`: Number - Version number (e.g., `273`)
  - `b`: Number - Battle phase (e.g., `0`)
  - `seed`: Number - Random seed for this progress snapshot
  - `attackers`: Object - Attacker state at this snapshot
    - `input`: Array - Input data (usually empty `[]`)
    - `heroes`: Object - Hero/pet states
      - Keys are hero/pet IDs as strings
      - Values are state objects with `hp`, `energy`, `isDead`, and optional `extra`
  - `defenders`: Object - Defender state at this snapshot
    - `input`: Array - Input data (usually empty `[]`)
    - `heroes`: Object - Hero/pet states
      - Keys are hero/pet IDs as strings
      - Values are state objects with `hp`, `energy`, `isDead`, and optional `extra`

### Response

**Status Code:** `200 OK`

**Response Body Structure:**
```json
{
  "date": 1764567449.1103261,
  "results": [
    {
      "ident": "body",
      "result": {
        "response": {
          "replay": {
            "userId": "35979991",
            "typeId": "35979991",
            "attackers": {
              "<hero_id>": {
                // Same hero structure as startBattle response
              }
            },
            "defenders": [
              {
                "<hero_id>": {
                  // Same hero structure as startBattle response
                }
              }
            ],
            "effects": {
              // Same effects structure as startBattle response
            },
            "reward": [],
            "startTime": "1764567448",
            "seed": "2728948160",
            "type": "arena",
            "id": "1764567448572398347",
            "progress": [
              {
                "v": 273,
                "b": 0,
                "seed": -1566019136,
                "attackers": {
                  "input": [],
                  "heroes": {
                    "<hero_id>": {
                      "hp": -1,
                      "energy": 491,
                      "isDead": false
                    }
                  }
                },
                "defenders": {
                  "input": [],
                  "heroes": {
                    "<hero_id>": {
                      "hp": 434998,
                      "energy": 400,
                      "isDead": false,
                      "extra": {
                        "hero48StartEnergy": 1
                      }
                    }
                  }
                }
              }
            ],
            "endTime": "1764567448",
            "result": {
              "win": false,
              "stars": 0,
              "serverVersion": 273
            }
          },
          "battle": {
            "id": 71897117,
            "parentId": 71897112,
            "userId": 35979991,
            "replayId": "1764567448572398347",
            "mechanic": "arena",
            "hash": "NDgyMTM1OGU3ZDQ1ZmIyNTcxMmY0ZmVlOWJmMGQyNTM3OGVmZTQyNg==",
            "data": {
              "entryId": 0,
              "attackMax": true,
              "defenceMax": false,
              "attackBuffs": [],
              "defenceBuffs": [],
              "attackFavor": {
                "13": 6002,
                "31": 6006,
                "40": 6004,
                "56": 6001,
                "58": 6005
              },
              "win": false,
              "attack": {
                "powerSum": 1197491,
                "units": {
                  "<hero_id>": {
                    "id": 31,
                    "level": 130,
                    "star": 6,
                    "power": 202858,
                    "color": 18,
                    "favorPetId": 6006,
                    "favorPower": 11064
                  }
                },
                "banner": {
                  "id": 3,
                  "slots": []
                }
              },
              "defence": {
                "powerSum": 1190075,
                "units": {
                  "<hero_id>": {
                    "id": 57,
                    "level": 130,
                    "star": 6,
                    "power": 195299,
                    "color": 18,
                    "favorPetId": 0,
                    "favorPower": 0
                  }
                },
                "banner": {
                  "id": 5,
                  "slots": []
                }
              }
            },
            "ctime": 1764567449
          }
        }
      }
    }
  ]
}
```

**Response Fields:**

#### Top Level
- `date`: Number - Server timestamp (e.g., `1764567449.1103261`)
- `results`: Array - Array of result objects
  - `ident`: String - Identifier matching the request (`"body"`)
  - `result.response`: Object - The actual response data

#### Response Object (`result.response`)
- `replay`: Object - Battle replay data
  - Contains the same structure as the battle object from `startBattle`, plus:
  - `id`: String - Replay ID (e.g., `"1764567448572398347"`)
  - `progress`: Array - Battle progress snapshots (same structure as request)
  - `endTime`: String - Battle end timestamp
  - `result`: Object - Final battle result
    - `win`: Boolean - Whether attacker won
    - `stars`: Number - Stars earned
    - `serverVersion`: Number - Server version number
- `battle`: Object - Battle record data
  - **Location**: `response.results[0].result.response.battle`
  - `id`: Number - Current battle ID (e.g., `71898586`)
    - **Critical**: Extract `battle.id` from the first battle's `endBattle` response
    - **Extraction Path**: `response.results[0].result.response.battle.id`
    - **Usage**: Use this `id` value as the `parentId` parameter for all subsequent `demoBattles_startBattle` calls
    - **First Battle**: For the first battle, use `parentId: 0` in the request, then extract `battle.id` from response
    - **Retry Battles**: Use the first battle's `id` as `parentId` for all subsequent battles
    - **Linking**: All retry battles use the same `parentId` (first battle's ID), linking them together
    - **Example Flow**:
      - Battle 1: Request `parentId: 0` → Response `battle.id: 71898586` → Use `71898586` for next battle
      - Battle 2: Request `parentId: 71898586` → Response `battle.id: 71898587` → Continue using `71898586`
      - Battle 3: Request `parentId: 71898586` → Response `battle.id: 71898588` → Continue using `71898586`
  - `parentId`: Number - Parent battle ID (e.g., `71897112`)
    - This field can be ignored for retry logic - use `battle.id` instead
  - `userId`: Number - User ID (e.g., `35979991`)
  - `replayId`: String - Replay ID (e.g., `"1764567448572398347"`)
  - `mechanic`: String - Battle mechanic (e.g., `"arena"`)
  - `hash`: String - Battle hash (base64 encoded)
  - `data`: Object - Battle configuration data
    - `entryId`: Number - Entry ID
    - `attackMax`: Boolean - Whether attack team had max upgrades
    - `defenceMax`: Boolean - Whether defense team had max upgrades
    - `attackBuffs`: Array - Attack team buffs
    - `defenceBuffs`: Array - Defense team buffs
    - `attackFavor`: Object - Attack team favor pet assignments
    - `win`: Boolean - Battle result
    - `attack`: Object - Attack team summary
      - `powerSum`: Number - Total power
      - `units`: Object - Unit summaries
      - `banner`: Object - Banner configuration
    - `defence`: Object - Defense team summary
      - `powerSum`: Number - Total power
      - `units`: Object - Unit summaries
      - `banner`: Object - Banner configuration
  - `ctime`: Number - Creation timestamp

---

## ParentId Mechanism

### Overview

The `parentId` mechanism is used to link multiple battle simulations together, allowing you to retry battles with the same team configuration. This is essential for running multiple simulations of the same battle scenario to calculate win rates or test different strategies.

### How ParentId Works

**Important**: Use the **first battle's ID** (not `parentId`) as the `parentId` for all subsequent battles.

1. **First Battle (Initial Simulation)**:
   - Use `parentId: 0` in `demoBattles_startBattle` to start a new battle session
   - After the battle completes, call `demoBattles_endBattle`
   - The `endBattle` response contains a `battle` object with:
     - `id`: The current battle ID (e.g., `71898586`) - **Use this for subsequent battles**
     - `parentId`: The parent battle ID (can be ignored for retry logic)
   - **Extract the `battle.id` from the first battle's `endBattle` response**
   - **Use this `id` value as the `parentId` for all subsequent retry battles**

2. **Retry Battles (Subsequent Simulations)**:
   - Use the first battle's `id` (extracted from first battle's `endBattle` response) as `parentId`
   - All retry battles should use the same `parentId` (the first battle's ID)
   - Example: First battle returns `id: 71898586`, all subsequent battles use `parentId: 71898586`
   - This links all retry battles to the original battle session

### Response Structure

The battle `id` (used as `parentId` for retries) is located in the `demoBattles_endBattle` response at:

```
response.results[0].result.response.battle.id
```

**Note**: Extract `battle.id` (not `battle.parentId`) from the first battle's `endBattle` response to use as `parentId` for subsequent battles.

**Full Response Structure:**
```json
{
  "date": 1764567449.1103261,
  "results": [
    {
      "ident": "body",
      "result": {
        "response": {
          "replay": {
            // ... replay data ...
          },
          "battle": {
            "id": 71897117,              // Current battle ID
            "parentId": 71897112,        // ← Extract this for retries
            "userId": 35979991,
            "replayId": "1764567448572398347",
            "mechanic": "arena",
            "hash": "NDgyMTM1OGU3ZDQ1ZmIyNTcxMmY0ZmVlOWJmMGQyNTM3OGVmZTQyNg==",
            "data": {
              // ... battle configuration data ...
            },
            "ctime": 1764567449
          }
        }
      }
    }
  ]
}
```

### Extracting ParentId

**JavaScript Example:**
```javascript
// After calling demoBattles_endBattle
const endBattleResponse = await Send(JSON.stringify({
  calls: [{
    name: "demoBattles_endBattle",
    args: {
      result: { win: false, stars: 0 },
      progress: [/* ... progress data ... */]
    },
    context: { actionTs: Date.now() },
    ident: "body"
  }]
}));

// Extract battle ID from first battle's endBattle response
const firstBattleId = endBattleResponse.results[0].result.response.battle.id;

// Use this battle ID as parentId for all subsequent battles
console.log(`All subsequent battles will use parentId: ${firstBattleId}`);
```

**Error Handling:**
```javascript
function extractBattleId(endBattleResponse) {
  // Check if response structure is valid
  if (!endBattleResponse?.results?.[0]?.result?.response) {
    console.error('Invalid endBattle response structure');
    return null;
  }
  
  const battle = endBattleResponse.results[0].result.response.battle;
  
  if (!battle) {
    console.error('Battle object not found in response');
    return null;
  }
  
  // Extract battle.id (not parentId) for use as parentId in subsequent battles
  if (battle.id === undefined || battle.id === null) {
    console.warn('Battle ID not found in battle object');
    return null;
  }
  
  return battle.id;
}
```

### Complete Retry Flow Example

```javascript
// Step 1: First battle with parentId = 0
let parentId = 0;
let firstBattleId = null;

for (let i = 0; i < 10; i++) {
  console.log(`Simulation ${i + 1}: Using parentId=${parentId}`);
  
  // Start battle with current parentId
  const startResponse = await Send(JSON.stringify({
    calls: [{
      name: "demoBattles_startBattle",
      args: {
        mechanic: "arena",
        parentId: parentId,  // Use 0 for first battle, then first battle's ID for retries
        // ... other battle configuration ...
      },
      context: { actionTs: Date.now() },
      ident: "body"
    }]
  }));
  
  const battleData = startResponse.results[0].result.response.battle;
  
  // Simulate battle (client-side calculation)
  const battleResult = await simulateBattle(battleData);
  
  // End battle
  const endResponse = await Send(JSON.stringify({
    calls: [{
      name: "demoBattles_endBattle",
      args: {
        result: {
          win: battleResult.win,
          stars: battleResult.stars
        },
        progress: battleResult.progress
      },
      context: { actionTs: Date.now() },
      ident: "body"
    }]
  }));
  
  // Extract battle ID from endBattle response
  const battleId = endResponse.results[0].result.response.battle.id;
  
  // For first battle: store its ID to use as parentId for subsequent battles
  if (i === 0 && battleId) {
    firstBattleId = battleId;
    parentId = firstBattleId;
    console.log(`First battle completed - using battleId ${battleId} as parentId for subsequent battles`);
  }
  // For subsequent battles: continue using first battle's ID
  else if (i > 0 && firstBattleId) {
    parentId = firstBattleId;
  }
  
  // Process battle result
  console.log(`Simulation ${i + 1} result: ${battleResult.win ? 'WIN' : 'LOSS'}`);
}
```

### Important Notes

1. **First Battle**: Always use `parentId: 0` for the first battle in a simulation sequence
2. **Extract Battle ID**: After the first battle's `endBattle` call, extract `battle.id` (not `battle.parentId`)
3. **Retry Battles**: Use the first battle's `id` as `parentId` for all subsequent battles
4. **Same ParentId**: All retry battles use the same `parentId` (the first battle's ID)
5. **Battle Linking**: Using the same `parentId` links all retry battles to the original battle session
6. **Error Handling**: If battle ID extraction fails, you can continue using the stored first battle ID or restart with `parentId: 0`
7. **Response Structure**: The `battle` object is nested under `response.results[0].result.response.battle`
8. **Type**: Both `id` and `parentId` are numbers (e.g., `71898586`)
9. **Key Difference**: Use `battle.id` from first battle, not `battle.parentId`

### Common Issues

**Issue: parentId is null or undefined**
- **Cause**: Response structure may differ or battle object is missing
- **Solution**: Check response structure with logging, verify `endBattle` call succeeded

**Issue: All battles use parentId = 0**
- **Cause**: Not extracting parentId from `endBattle` response
- **Solution**: Ensure you're reading `response.results[0].result.response.battle.parentId`

**Issue: parentId changes between retries**
- **Cause**: This is normal - each battle gets a new `id`, but `parentId` should remain constant for retries
- **Solution**: Use `parentId` (not `id`) for linking battles

---

## Usage Notes

1. **Battle Flow**: 
   - Call `demoBattles_startBattle` with `parentId: 0` to initialize a new battle simulation
   - Execute the battle simulation (client-side)
   - Call `demoBattles_endBattle` with the battle result and progress data
   - The `endBattle` response contains `result.response.battle.parentId` which can be used for retries

2. **Retry Battle Flow**:
   - After ending a battle, extract `parentId` from `result.response.battle.parentId` in the `endBattle` response
   - Call `demoBattles_startBattle` again with the same team configuration but use the extracted `parentId` instead of `0`
   - Execute the battle simulation (client-side)
   - Call `demoBattles_endBattle` with the new battle result
   - Repeat as needed - all retries use the same `parentId` from the original battle

3. **Mechanic Types**: Common values include:
   - `"arena"` - Arena battles
   - `"grandArena"` - Grand Arena battles
   - Other game mode identifiers

4. **Team Configuration**:
   - Teams consist of up to 5 heroes (specified in `units` array)
   - Each team can have one pet (specified in `pet` field)
   - Favor pets are assigned per hero in the `favor` object

5. **Banners**: Banner IDs represent different banner types that provide team-wide bonuses

6. **Progress Snapshots**: The `progress` array in `endBattle` contains snapshots of unit states at different points during the battle, used for replay functionality

7. **Battle Seeds**: Both `startTime`/`seed` in startBattle and `seed` values in progress snapshots are used to ensure deterministic battle simulations

8. **Pet HP**: Pet HP values are typically `-1` indicating they don't have traditional HP mechanics

8. **Retry Battles**: There is no separate "retry battle" API. To retry a battle:
   - After calling `demoBattles_endBattle`, extract the `parentId` from the response (`result.response.battle.parentId`)
   - Call `demoBattles_startBattle` again with the same team configuration, but use the `parentId` from the previous battle instead of `0`
   - This creates a retry battle linked to the original battle session
   - Example: First battle uses `parentId: 0`, retry battles use `parentId: 71897112` (from previous battle's endBattle response)

---

## Example Usage

### Starting a Battle Simulation

```javascript
const startBattleRequest = {
  calls: [{
    name: "demoBattles_startBattle",
    args: {
      mechanic: "arena",
      defenceMaxUpgrade: true,
      defenceTeam: {
        units: [57, 58, 63, 48, 67],
        pet: 6008
      },
      defenceBanner: 5,
      defenceBannerStones: {},
      defenceFavor: {
        "48": 6000,
        "58": 6002,
        "63": 6003,
        "67": 6001
      },
      maxUpgrade: true,
      team: {
        units: [31, 58, 13, 40, 56],
        pet: 6008
      },
      banner: 3,
      bannerStones: {},
      favor: {
        "13": 6002,
        "31": 6006,
        "40": 6004,
        "56": 6001,
        "58": 6005
      },
      defenceBuffs: {},
      buffs: {},
      parentId: 0,
      entryId: 0
    },
    context: {
      actionTs: Date.now()
    },
    ident: "body"
  }]
};
```

### Ending a Battle Simulation

```javascript
const endBattleRequest = {
  calls: [{
    name: "demoBattles_endBattle",
    args: {
      result: {
        win: false,
        stars: 0
      },
      progress: [
        {
          v: 273,
          b: 0,
          seed: -1566019136,
          attackers: {
            input: [],
            heroes: {
              "6008": {
                hp: -1,
                energy: 491,
                isDead: false
              }
            }
          },
          defenders: {
            input: [],
            heroes: {
              "48": {
                hp: 434998,
                energy: 400,
                isDead: false,
                extra: {
                  hero48StartEnergy: 1
                }
              },
              "57": {
                hp: 610200,
                energy: 100,
                isDead: false
              },
              "58": {
                hp: 185406,
                energy: 669,
                isDead: false
              },
              "63": {
                hp: 621150,
                energy: 100,
                isDead: false
              },
              "67": {
                hp: 326219,
                energy: 669,
                isDead: false
              },
              "6008": {
                hp: -1,
                energy: 425,
                isDead: false
              }
            }
          }
        }
      ]
    },
    context: {
      actionTs: Date.now()
    },
    ident: "body"
  }]
};

// After calling endBattle, extract parentId for retries
const endBattleResponse = await fetch(apiEndpoint, {
  method: 'POST',
  body: JSON.stringify(endBattleRequest),
  headers: headers
});
const endBattleData = await endBattleResponse.json();
const parentId = endBattleData.results[0].result.response.battle.parentId;
// Use this parentId for retry battles
```

### Retrying a Battle Simulation

```javascript
// Use the parentId from the previous battle's endBattle response
const retryBattleRequest = {
  calls: [{
    name: "demoBattles_startBattle",
    args: {
      mechanic: "arena",
      defenceMaxUpgrade: true,
      defenceTeam: {
        units: [57, 58, 63, 48, 67],
        pet: 6008
      },
      defenceBanner: 5,
      defenceBannerStones: {},
      defenceFavor: {
        "48": 6000,
        "58": 6002,
        "63": 6003,
        "67": 6001
      },
      maxUpgrade: true,
      team: {
        units: [31, 58, 13, 40, 56],
        pet: 6008
      },
      banner: 3,
      bannerStones: {},
      favor: {
        "13": 6002,
        "31": 6006,
        "40": 6004,
        "56": 6001,
        "58": 6005
      },
      defenceBuffs: {},
      buffs: {},
      parentId: 71897112, // Use parentId from previous battle's endBattle response
      entryId: 0
    },
    context: {
      actionTs: Date.now()
    },
    ident: "body"
  }]
};
```

