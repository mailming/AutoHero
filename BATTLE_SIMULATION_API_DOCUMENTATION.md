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

---

## Guild War Titan Demo Battles

Guild War titan demo battles allow you to simulate titan battles for Guild War slots without consuming attack attempts. This is useful for testing titan team compositions against enemy defenses before committing to an actual attack.

**Captured source (2026-10-24):** in-game Demo Battles titan tab → `api-monitor-1792850621569.json` (one loss, then two retries of the same matchup). Earlier win capture (2026-10-09) remains in [`titan-demo-api-sample.json`](titan-demo-api-sample.json).

### Key Differences from Hero Battles

- **Mechanic:** Use `"clan_pvp_titan"` for Guild War titan battles or `"clan_global_pvp_titan"` for Clash of Worlds titan battles (instead of `"arena"` or `"grandArena"`)
- **No Pets/Banners:** Titans do not use pets, banners, or favor pets
- **Element Spirits:** Titans use element spirits instead of pets. Each side can send a first and a second spirit (`element` plus `elemental` / `primal` skill IDs). The 2026-10-24 client sent only the attacker's first spirit, and both defender spirits
- **Spirit assignment:** A spirit's skills are copied onto titans of that element. Titans of an unmatched element (captured: distortion Alecto `4051`) come back with `elementSpiritSkills: []`
- **Unit Type:** All units are titans (type `"titan"`), not heroes. Elements include `"distortion"` in addition to `"dark"`, `"water"`, `"earth"`, `"fire"`, and `"light"`
- **Defenders shape:** `battle.defenders` is an **array** of one team object (keyed by titan ID); `battle.attackers` is a flat object keyed by titan ID

### Request Example: Guild War Titan Demo Battle

**Request Body** (2026-10-24; fire attacker at real stats, mixed defense max-upgraded, one attacker spirit and two defender spirits):
```json
{
  "calls": [
    {
      "name": "demoBattles_startBattle",
      "args": {
        "mechanic": "clan_pvp_titan",
        "defenceMaxUpgrade": true,
        "defenceTeam": {
          "units": [4033, 4043, 4051, 4040, 4030]
        },
        "defenceFavor": {},
        "maxUpgrade": false,
        "team": {
          "units": [4012, 4013, 4014, 4011, 4010]
        },
        "favor": {},
        "defenceBuffs": {},
        "buffs": {},
        "firstSpiritElement": "fire",
        "firstSpiritSkills": {
          "elemental": 4509,
          "primal": 4507
        },
        "defenceFirstSpiritElement": "light",
        "defenceFirstSpiritSkills": {
          "elemental": 4500,
          "primal": 4507
        },
        "defenceSecondSpiritElement": "dark",
        "defenceSecondSpiritSkills": {
          "elemental": 4500,
          "primal": 4514
        },
        "parentId": 0,
        "entryId": 0
      },
      "context": {
        "actionTs": 317392
      },
      "ident": "group_1_body"
    }
  ]
}
```

The in-game client batches this first start with a `stashClient` call (`ident: "group_0_body"`, windows `team_gather:demo_defense` / `team_gather:demo_attack`). Retries are a single `demoBattles_startBattle` with `ident: "body"`. Either ident is accepted.

**Request Parameters (Guild War Titan Specific):**

#### Args Object (`args`)
- `mechanic`: `"clan_pvp_titan"` or `"clan_global_pvp_titan"` - **Required** - Battle mechanic type for titan battles
  - `"clan_pvp_titan"` - Guild War titan battles
  - `"clan_global_pvp_titan"` - Clash of Worlds titan battles
- `defenceMaxUpgrade`: Boolean - Whether to apply maximum upgrades to defense team (captured: `true`)
- `defenceTeam`: Object - Defender titan team configuration
  - `units`: Array<Number> - Array of 5 titan IDs (captured: `[4033, 4043, 4051, 4040, 4030]` — Tenebris, Solaris, Alecto, Rigel, Brustar)
  - **Note:** No `pet` field for titans
- `defenceFavor`: Object - Empty object `{}` (titans don't use favor pets)
- `maxUpgrade`: Boolean - Whether to max-upgrade the attacker team (captured client uses `false` for own real stats)
- `team`: Object - Attacker titan team configuration
  - `units`: Array<Number> - Array of 5 titan IDs (captured: `[4012, 4013, 4014, 4011, 4010]` — Ignis, Araji, Asherona and Pyro, Vulcan, Moloch)
  - **Note:** No `pet` field for titans
- `favor`: Object - Empty object `{}` (titans don't use favor pets)
- `defenceBuffs`: Object - Empty object `{}` (no buffs for defense)
- `buffs`: Object - Empty object `{}` (no buffs for attackers)
- `firstSpiritElement`: String - First element spirit for the attacker (`"dark"`, `"water"`, `"earth"`, `"fire"`, `"light"`, `"distortion"`). Captured: `"fire"`
- `firstSpiritSkills`: Object - Spirit skill picks for the attacker's first spirit
  - `elemental`: Number - Elemental spirit skill ID (captured fire: `4509`)
  - `primal`: Number - Primal spirit skill ID (captured fire: `4507`)
  - **Note:** Skill IDs are not a single constant. The 2026-10-09 capture used elemental `4510`. Send the IDs the client selected
- `secondSpiritElement`: String - Optional second attacker spirit. Omitted in the 2026-10-24 capture (mono-fire team). The 2026-10-09 capture sent `"water"`
- `secondSpiritSkills`: Object - Same shape as `firstSpiritSkills`. Omit it when `secondSpiritElement` is omitted
- `defenceFirstSpiritElement`: String - Defender first spirit element (captured: `"light"`)
- `defenceFirstSpiritSkills`: Object - Defender first spirit skills. Captured with `defenceMaxUpgrade: true` as `{ "elemental": 4500, "primal": 4507 }`, not an empty object
- `defenceSecondSpiritElement`: String - Defender second spirit element (captured: `"dark"`). New relative to the 2026-10-09 capture, which only sent the first defender spirit
- `defenceSecondSpiritSkills`: Object - Same shape as `defenceFirstSpiritSkills` (captured: `{ "elemental": 4500, "primal": 4514 }`)
- `parentId`: Number - Parent battle ID for retries
  - **First Battle**: Use `0` to start a new battle session
  - **Subsequent Battles**: Use the `battle.id` from the **first battle's** `endBattle` response (not `battle.parentId`, and not the latest retry's `battle.id`)
  - **Important**: All retry battles use that same `parentId`
  - **Extraction**: `response.results[].result.response.battle.id` on the first `endBattle`. When the first end is batched, that result's `ident` is `"group_2_body"` rather than `"body"`
  - **Captured:** first `endBattle` → `battle.id = 105724447`, `parentId = 0`. Both retries sent `parentId: 105724447` and received their own ids `105724451` and `105724455`, each with `parentId: 105724447`
- `entryId`: Number - Entry ID (usually `0`)

**Note:** The following fields are **NOT used** for titan battles:
- `defenceBanner` - Titans don't use banners
- `defenceBannerStones` - Titans don't use banners
- `banner` - Titans don't use banners
- `bannerStones` - Titans don't use banners

### Response Example: Guild War Titan Demo Battle

**Response Structure** (trimmed to one attacker and two defenders; `seed` is a number):
```json
{
  "results": [
    {
      "ident": "group_1_body",
      "result": {
        "response": {
          "battle": {
            "typeId": "62211320",
            "attackers": {
              "4010": {
                "id": 4010,
                "level": 130,
                "star": 6,
                "power": 216417,
                "type": "titan",
                "element": "fire",
                "elementSpiritLevel": 106,
                "elementSpiritStar": 6,
                "elementSpiritSkills": [
                  { "skillId": 4509, "level": 3, "tierScale": 0.5 },
                  { "skillId": 4507, "level": 3, "tierScale": 40 }
                ]
              }
            },
            "defenders": [
              {
                "4040": {
                  "id": 4040,
                  "level": 130,
                  "star": 6,
                  "power": 276166,
                  "type": "titan",
                  "element": "light",
                  "elementSpiritLevel": 130,
                  "elementSpiritStar": 6,
                  "elementSpiritSkills": [
                    { "skillId": 4500, "level": 6, "tierScale": 20 },
                    { "skillId": 4507, "level": 6, "tierScale": 70 }
                  ],
                  "state": { "hp": 14093434, "energy": 0, "isDead": false, "maxHp": 14093434 }
                },
                "4051": {
                  "id": 4051,
                  "level": 130,
                  "star": 6,
                  "power": 249933,
                  "type": "titan",
                  "element": "distortion",
                  "elementSpiritLevel": 130,
                  "elementSpiritStar": 6,
                  "elementSpiritSkills": [],
                  "state": { "hp": 10236956, "energy": 0, "isDead": false, "maxHp": 10236956 }
                }
              }
            ],
            "effects": [],
            "reward": [],
            "startTime": 1792850598,
            "seed": 3051432983,
            "type": "clan_pvp_titan"
          }
        }
      }
    }
  ]
}
```

Captured seeds for the three starts: `3051432983`, `3979857098`, `2405645572`. Every fire attacker received the fire spirit skills at the attacker's real spirit level (`106`). Light defenders received the light spirit at max level `6`; dark defenders received the dark spirit the same way. Alecto (`4051`, distortion) received neither spirit, so `elementSpiritSkills` is `[]`. In this start response, attackers have base `hp` and no `state` object; each defender includes `state`.

### Titan Object Structure (Response)

Titan objects in the response have the following structure:

- `id`: Number - Titan ID (e.g., `4010` Moloch, `4033` Tenebris, `4051` Alecto). Full list in [`TITAN_DATA_DOCUMENTATION.md`](TITAN_DATA_DOCUMENTATION.md)
- `xp`: Number - Experience points
- `level`: Number - Titan level (e.g., `130`)
- `star`: Number - Star level (e.g., `6`)
- `skills`: Object - Skill levels
  - Keys are skill IDs as strings (e.g., `"4034"`, `"4035"`)
  - Values are skill levels (e.g., `130`)
- `power`: Number - Total power
- `skins`: Object - Available skins
  - Keys are skin IDs as strings (e.g., `"10019"`, `"10038"`)
  - Values are skin levels (e.g., `60`)
- `currentSkin`: Number - Currently equipped skin ID (or `0` if no skin)
- `artifacts`: Array - Artifact configurations
  - `level`: Number - Artifact level
  - `star`: Number - Artifact star level
- `scale`: Number - Scale factor (typically `0.8` for titans)
- `type`: String - Always `"titan"` for titan battles
- `perks`: Array<Number> - Perk IDs (e.g., `[6, 5]`)
- `anticrit`: Number - Anti-crit value (typically `1`)
- `antidodge`: Number - Anti-dodge value (typically `1`)
- `hp`: Number - Base HP
- `physicalAttack`: Number - Physical attack stat
- `elementArmor`: Number - Element armor stat
- `elementAttack`: Number - Element attack stat
- `elementSpiritPower`: Number - Element spirit power
- `element`: String - Element type (`"dark"`, `"water"`, `"earth"`, `"fire"`, `"light"`, `"distortion"`)
- `elementSpiritLevel`: Number - Element spirit level (captured attackers `106` at real stats; max-upgraded defenders `130`)
- `elementSpiritStar`: Number - Element spirit star level
- `elementSpiritSkills`: Array - Skills from the spirit whose element matches this titan. Each entry is `{ skillId, level, tierScale }`. Empty `[]` when no sent spirit matches the titan (captured on distortion `4051`)
- `elementAffinityPower`: Number - Element affinity power
- `skin`: Number - Currently equipped skin ID (or `0`)
- `state`: Object - Current battle state
  - `hp`: Number - Current HP
  - `energy`: Number - Current energy
  - `isDead`: Boolean - Whether titan is dead
  - `maxHp`: Number - Maximum HP

### Ending a Guild War Titan Demo Battle

**Request Body** (2026-10-24 loss; progress `seed` is the client simulator seed, not `battle.seed` from `startBattle`):
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
            "v": 298,
            "b": 0,
            "seed": -1243534313,
            "attackers": {
              "input": ["auto", 0, 0, "auto", 0, 0],
              "heroes": {}
            },
            "defenders": {
              "input": [],
              "heroes": {
                "4033": { "hp": 1692315, "energy": 200, "isDead": false },
                "4051": { "hp": 4798288, "energy": 455, "isDead": false }
              }
            }
          }
        ]
      },
      "context": {
        "actionTs": 323615
      },
      "ident": "group_2_body"
    }
  ]
}
```

**Progress notes from this capture:**

- `v` is `298` (the 2026-10-09 win used `296`). The replay echoes it as `result.serverVersion`
- Two different seeds: `startBattle` returns `battle.seed` as a number (`3051432983`). `endBattle` progress uses a separate signed seed (`-1243534313`, then `-315110198` and `-1889321724` on the retries). The replay stores the start seed as a string and keeps the progress seed inside `replay.progress`
- `heroes` still means titans. An empty `heroes` object means that whole side is dead. On a loss, `defenders.heroes` lists only survivors (`4033` Tenebris and `4051` Alecto here)
- The first end sent `attackers.input` of `["auto", 0, 0, "auto", 0, 0]`. Both retry ends sent `attackers.input: []` with the same survivor snapshot
- A 2026-10-09 win left surviving attackers in `attackers.heroes` and `defenders.heroes` as `{}`. Summoner titans may include `extra.titanSummonerStartEnergy`

**Response Body** (first end; use `battle.id` as `parentId` for retries):
```json
{
  "results": [
    {
      "ident": "group_2_body",
      "result": {
        "response": {
          "replay": {
            "typeId": "62211320",
            "seed": "3051432983",
            "type": "clan_pvp_titan",
            "id": "1792850598293054943",
            "result": { "win": false, "stars": 0, "serverVersion": 298 }
          },
          "battle": {
            "id": 105724447,
            "parentId": 0,
            "replayId": "1792850598293054943",
            "mechanic": "clan_pvp_titan",
            "data": {
              "entryId": 0,
              "attackMax": false,
              "defenceMax": true,
              "attackBuffs": [],
              "defenceBuffs": [],
              "attackFavor": [],
              "win": false,
              "attack": { "powerSum": 1025624, "banner": null },
              "defence": { "powerSum": 1447632, "banner": null }
            },
            "ctime": 1792850604
          }
        }
      }
    }
  ]
}
```

Retry ends kept `parentId: 105724447` and new ids `105724451` / `105724455`. Their `data.defenceMax` was `false` even though each retry `startBattle` still sent `defenceMaxUpgrade: true`. `data.attackMax` stayed `false`, matching `maxUpgrade: false`. `attack.banner` and `defence.banner` are `null`.

### Example Usage: Guild War Titan Demo Battle

```javascript
// Start a Guild War titan demo battle (shape matches in-game client capture)
const startBattleRequest = {
  calls: [{
    name: "demoBattles_startBattle",
    args: {
      mechanic: "clan_pvp_titan",  // Use "clan_global_pvp_titan" for Clash of Worlds battles
      defenceMaxUpgrade: true,
      defenceTeam: {
        units: [4033, 4043, 4051, 4040, 4030]  // Tenebris, Solaris, Alecto, Rigel, Brustar
      },
      defenceFavor: {},
      maxUpgrade: false,  // client uses real attacker stats
      team: {
        units: [4012, 4013, 4014, 4011, 4010]  // Ignis, Araji, Asherona and Pyro, Vulcan, Moloch
      },
      favor: {},
      defenceBuffs: {},
      buffs: {},
      firstSpiritElement: "fire",
      firstSpiritSkills: { elemental: 4509, primal: 4507 },
      defenceFirstSpiritElement: "light",
      defenceFirstSpiritSkills: { elemental: 4500, primal: 4507 },
      defenceSecondSpiritElement: "dark",
      defenceSecondSpiritSkills: { elemental: 4500, primal: 4514 },
      parentId: 0,
      entryId: 0
    },
    context: {
      actionTs: Date.now()
    },
    ident: "body"
  }]
};

const startBattleResponse = await fetch(apiEndpoint, {
  method: 'POST',
  body: JSON.stringify(startBattleRequest),
  headers: headers
});
const startBattleData = await startBattleResponse.json();

// Extract battle seed and titan data
const battle = startBattleData.results[0].result.response.battle;
const seed = battle.seed;  // server seed (number). endBattle progress uses a different signed seed
const attackerTitans = battle.attackers;       // object keyed by titanId
const defenderTitans = battle.defenders[0];    // first (only) defender team object

// Simulate battle and get final state
// ... (battle simulation logic) ...
const progressSeed = -1243534313; // signed seed from the local simulator, not battle.seed

// End the battle
const endBattleRequest = {
  calls: [{
    name: "demoBattles_endBattle",
    args: {
      result: {
        win: false,
        stars: 0
      },
      progress: [{
        v: 298,
        b: 0,
        seed: progressSeed,  // signed client seed, not battle.seed
        attackers: {
          input: ["auto", 0, 0, "auto", 0, 0],
          heroes: {}  // empty when the attack team is dead
        },
        defenders: {
          input: [],
          heroes: {
            // surviving titans only (field name remains "heroes")
          }
        }
      }]
    },
    context: {
      actionTs: Date.now()
    },
    ident: "body"
  }]
};

const endBattleResponse = await fetch(apiEndpoint, {
  method: 'POST',
  body: JSON.stringify(endBattleRequest),
  headers: headers
});
const endBattleData = await endBattleResponse.json();

// Extract battle ID from first battle's endBattle response
// IMPORTANT: Use battle.id (not battle.parentId) from the first battle as parentId for subsequent battles
const firstBattleId = endBattleData.results[0].result.response.battle?.id;

// For subsequent battles, use this firstBattleId as parentId
console.log(`First battle ID: ${firstBattleId}`);
console.log(`All subsequent battles will use parentId: ${firstBattleId}`);
```

### Retrying Guild War Titan Demo Battles

For retry battles, use the `battle.id` from the **first battle's** `endBattle` response as the `parentId` for all subsequent battles:

```javascript
// After completing the first battle and extracting firstBattleId (see above)
// Captured example: firstBattleId === 105724447
// Retry end ids were 105724451 and 105724455; both still used parentId 105724447

const retryBattleRequest1 = {
  calls: [{
    name: "demoBattles_startBattle",
    args: {
      mechanic: "clan_pvp_titan",
      defenceMaxUpgrade: true,
      defenceTeam: {
        units: [4033, 4043, 4051, 4040, 4030]
      },
      defenceFavor: {},
      maxUpgrade: false,
      team: {
        units: [4012, 4013, 4014, 4011, 4010]
      },
      favor: {},
      defenceBuffs: {},
      buffs: {},
      firstSpiritElement: "fire",
      firstSpiritSkills: { elemental: 4509, primal: 4507 },
      defenceFirstSpiritElement: "light",
      defenceFirstSpiritSkills: { elemental: 4500, primal: 4507 },
      defenceSecondSpiritElement: "dark",
      defenceSecondSpiritSkills: { elemental: 4500, primal: 4514 },
      parentId: firstBattleId,  // Use battle.id from first battle's endBattle response
      entryId: 0
    },
    context: {
      actionTs: Date.now()
    },
    ident: "body"
  }]
};
```

**Key Points:**
- **First Battle**: Use `parentId: 0` to start a new battle session
- **Extract Battle ID**: After the first battle's `endBattle` call, extract `battle.id` (not `battle.parentId`)
- **Subsequent Battles**: Use the first battle's `id` as `parentId` for all retry battles
- **Same ParentId**: All retry battles use the same `parentId` (the first battle's ID), linking them together
- **Response Path**: Read `battle.id` from the `endBattle` result. On a standalone call that is `results[0]` with `ident: "body"`. On the batched first end it is the result with `ident: "group_2_body"`

### Titans in the 2026-10-24 capture

Names match [`TITAN_DATA_DOCUMENTATION.md`](TITAN_DATA_DOCUMENTATION.md).

**Attack (fire):** `4012` Ignis, `4013` Araji, `4014` Asherona and Pyro, `4011` Vulcan, `4010` Moloch

**Defense:** `4033` Tenebris (dark), `4043` Solaris (light), `4051` Alecto (distortion), `4040` Rigel (light), `4030` Brustar (dark)

### Notes

- **No Resource Consumption:** Demo battles do not consume Guild War attack attempts
- **Testing Only:** Results are for testing purposes only and do not affect actual Guild War standings
- **Element Spirits:** Send the spirits the team actually uses. This capture sent `firstSpirit*` for fire and both `defenceFirstSpirit*` / `defenceSecondSpirit*` for light and dark. A second attacker spirit is optional
- **Matching element:** Spirit skills are applied only to titans of that element. Distortion `4051` stayed at `elementSpiritSkills: []` because neither defender spirit was distortion
- **No Banners:** Titans do not use banners or banner stones (`banner: null` on the end payload)
- **No Favor Pets:** Titans do not use favor pets (always use empty `{}` for `favor` and `defenceFavor`)
- **Scale Factor:** Titans in this capture use a scale factor of `0.8`
- **Battle Type:** Response `type` / `mechanic` is `"clan_pvp_titan"` for Guild War titan battles, or `"clan_global_pvp_titan"` for Clash of Worlds titan battles
- **Earlier sample:** [`titan-demo-api-sample.json`](titan-demo-api-sample.json) is the 2026-10-09 win (two attacker spirits, one defender spirit, progress `v` `296`)

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

---

### 3. `demoBattles_getAll`

Retrieves all battle simulation history for the current user. This API allows you to view past simulation battles and their results.

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
      "name": "demoBattles_getAll",
      "args": {},
      "context": {
        "actionTs": 183153
      },
      "ident": "group_2_body"
    }
  ]
}
```

**Request Parameters:**

#### Top Level
- `name`: `"demoBattles_getAll"` - The API method name
- `args`: Object - Empty object `{}` (no parameters required)
- `context.actionTs`: Number - Action timestamp
- `ident`: String - Identifier for the request (e.g., `"group_2_body"`)

### Response

**Status Code:** `200 OK`

**Response Body Structure:**
```json
{
  "date": 1764619585.5742991,
  "results": [
    {
      "ident": "group_2_body",
      "result": {
        "response": {
          "items": [
            {
              "id": "71419928",
              "parentId": 0,
              "userId": "35979991",
              "replayId": "1764052363181330914",
              "mechanic": "arena",
              "hash": "ZWY2ZTIzZDlmM2NiMWY0Yzk5ODQ1MjY1MGE4NmQwMTE4YWZiY2M0MA==",
              "data": {
                "entryId": 0,
                "attackMax": false,
                "defenceMax": false,
                "attackBuffs": [],
                "defenceBuffs": [],
                "attackFavor": {
                  "40": 6004,
                  "55": 6001,
                  "56": 6006,
                  "58": 6005,
                  "64": 6008
                },
                "win": true,
                "attack": {
                  "powerSum": 1089662,
                  "units": {
                    "40": {
                      "id": 40,
                      "level": 130,
                      "star": 6,
                      "power": 192138,
                      "color": 18,
                      "favorPetId": 6004,
                      "favorPower": 10154
                    },
                    "64": {
                      "id": 64,
                      "level": 130,
                      "star": 6,
                      "power": 168453,
                      "color": 18,
                      "favorPetId": 6008,
                      "favorPower": 11064
                    },
                    "6008": {
                      "id": 6008,
                      "level": 130,
                      "star": 6,
                      "power": 181943,
                      "color": 10,
                      "favorPetId": null,
                      "favorPower": null,
                      "type": "pet"
                    }
                  },
                  "banner": {
                    "id": 1,
                    "slots": {
                      "0": 15,
                      "1": 43,
                      "2": 19
                    }
                  }
                },
                "defence": {
                  "powerSum": 835567,
                  "units": {
                    "16": {
                      "id": 16,
                      "level": 130,
                      "star": 6,
                      "power": 179182,
                      "color": 18,
                      "favorPetId": 0,
                      "favorPower": 0
                    },
                    "6006": {
                      "id": 6006,
                      "level": 130,
                      "star": 5,
                      "power": 171933,
                      "color": 10,
                      "favorPetId": null,
                      "favorPower": null,
                      "type": "pet"
                    }
                  },
                  "banner": {
                    "id": 2,
                    "slots": {
                      "0": 70,
                      "1": 35,
                      "2": 13
                    }
                  }
                }
              },
              "ctime": "1764052367"
            }
          ]
        }
      }
    }
  ]
}
```

**Response Fields:**

#### Top Level
- `date`: Number - Server timestamp (e.g., `1764619585.5742991`)
- `results`: Array - Array of result objects
  - `ident`: String - Identifier matching the request (e.g., `"group_2_body"`)
  - `result.response`: Object - The actual response data

#### Response Object (`result.response`)
- `items`: Array - Array of battle history items

#### Battle History Item Structure
Each item in the `items` array represents a completed battle simulation:

- `id`: String - Battle ID (e.g., `"71401948"`)
- `parentId`: Number - Parent battle ID
  - `0` indicates this is the first battle in a simulation session
  - Non-zero values indicate this is a retry battle linked to the parent battle
- `userId`: String - User ID who ran the simulation (e.g., `"35621043"`)
- `replayId`: String - Replay ID for viewing the battle replay (e.g., `"1764021483414708034"`)
- `mechanic`: String - Battle mechanic type
  - `"arena"` - Arena battles
  - `"grand"` - Grand Arena battles
  - `"clan_pvp_titan"` - Guild War titan battles
  - `"clan_global_pvp_titan"` - Clash of Worlds titan battles
  - Other game mode identifiers
- `hash`: String - Battle hash (base64 encoded, used for verification)
- `data`: Object - Battle configuration and result data
  - `entryId`: Number - Entry ID (usually `0`, but can be non-zero for Guild War/Clash of Worlds battles)
  - `attackMax`: Boolean - Whether attack team had maximum upgrades
  - `defenceMax`: Boolean - Whether defense team had maximum upgrades
  - `attackBuffs`: Array - Attack team buffs (usually empty `[]`)
  - `defenceBuffs`: Array | Object - Defense team buffs
    - Usually empty `[]` for hero battles
    - Can be an object with buff IDs as keys for titan battles (e.g., `{"96": 72}`)
  - `attackFavor`: Object | Array - Attack team favor pet assignments
    - **Hero Battles**: Object with hero IDs as keys (strings) and favor pet IDs as values (e.g., `{"40": 6004, "55": 6001}`)
    - **Titan Battles**: Empty array `[]` (titans don't use favor pets)
  - `win`: Boolean - Whether the attacker won (`true`) or lost (`false`)
  - `attack`: Object - Attack team summary
    - `powerSum`: Number - Total team power
    - `units`: Object - Unit summaries
      - Keys are hero/titan/pet IDs as strings
      - Values are unit objects with:
        - `id`: Number - Hero/Titan/Pet ID
        - `level`: Number - Level
        - `star`: Number - Star level
        - `power`: Number - Power
        - `color`: Number - Color/rarity (for heroes and pets)
        - **Hero Units:**
          - `favorPetId`: Number | null - Favor pet ID (or `0`/`null` if none)
          - `favorPower`: Number | null - Favor pet power
        - **Pet Units:**
          - `type`: String - Always `"pet"` for pet units
          - `favorPetId`: null - Always `null` for pets
          - `favorPower`: null - Always `null` for pets
        - **Titan Units:**
          - `element`: String - Element type (`"dark"`, `"water"`, `"earth"`, `"fire"`, `"light"`)
          - `elementSpiritLevel`: Number - Element spirit level
          - `elementSpiritStar`: Number - Element spirit star level
          - `elementSpiritSkills`: Array - Element spirit skills
            - Each skill object contains:
              - `skillId`: Number - Skill ID
              - `level`: Number - Skill level
              - `tierScale`: Number - Tier scale value
    - `banner`: Object | null - Banner configuration
      - **Hero Battles**: Object with:
        - `id`: Number - Banner ID
        - `slots`: Object | Array - Banner stone slots
          - Can be an object with string keys (e.g., `{"0": 15, "1": 43, "2": 19}`)
          - Can be an empty array `[]` if no stones
      - **Titan Battles**: `null` (titans don't use banners)
  - `defence`: Object - Defense team summary
    - Same structure as `attack` object
- `ctime`: String - Creation timestamp (Unix timestamp as string, e.g., `"1764052367"`)

### Titan Battle Example

For titan battles (`mechanic: "clan_pvp_titan"` or `"clan_global_pvp_titan"`), the structure differs:

```json
{
  "id": "71419928",
  "parentId": 0,
  "userId": "35979991",
  "replayId": "1764052363181330914",
  "mechanic": "clan_global_pvp_titan",
  "hash": "MTU0NGNkYmQ1MThhOGJlMTE2YmFhMDEwNGRmYTRhYjRlOWI0NzMzYg==",
  "data": {
    "entryId": 40,
    "attackMax": false,
    "defenceMax": true,
    "attackBuffs": [],
    "defenceBuffs": {
      "96": 72
    },
    "attackFavor": [],
    "win": true,
    "attack": {
      "powerSum": 1113776,
      "units": {
        "4020": {
          "id": 4020,
          "level": 130,
          "star": 6,
          "power": 231824,
          "element": "earth",
          "elementSpiritLevel": 125,
          "elementSpiritStar": 6,
          "elementSpiritSkills": [
            {
              "skillId": 4511,
              "level": 2,
              "tierScale": 0.325
            },
            {
              "skillId": 4514,
              "level": 3,
              "tierScale": 6
            }
          ]
        }
      },
      "banner": null
    },
    "defence": {
      "powerSum": 1176564,
      "units": {
        "4000": {
          "id": 4000,
          "level": 130,
          "star": 6,
          "power": 221975,
          "element": "water",
          "elementSpiritLevel": 130,
          "elementSpiritStar": 6,
          "elementSpiritSkills": []
        }
      },
      "banner": null
    }
  },
  "ctime": "1764052367"
}
```

**Key Differences for Titan Battles:**
- `attackFavor`: Empty array `[]` (titans don't use favor pets)
- `defenceBuffs`: Can be an object with buff IDs as keys (e.g., `{"96": 72}`)
- Units have `element`, `elementSpiritLevel`, `elementSpiritStar`, and `elementSpiritSkills` fields instead of `favorPetId`/`favorPower`
- `banner`: Always `null` (titans don't use banners)
- No `color` field for titan units
- `entryId` can be non-zero for Guild War/Clash of Worlds battles

### Usage Notes

1. **Retrieving History**: Call `demoBattles_getAll` with empty args to retrieve all battle simulation history for the current user
2. **Battle Linking**: Use `parentId` to identify which battles belong to the same simulation session
   - Battles with `parentId: 0` are the first battle in a session
   - Battles with the same non-zero `parentId` are retry battles from the same session
3. **Replay Viewing**: Use `replayId` to view or replay a specific battle
4. **Filtering**: You can filter results client-side by:
   - `mechanic` - Battle type (arena, grand, clan_pvp_titan, clan_global_pvp_titan, etc.)
   - `win` - Win/loss status
   - `parentId` - Group battles by simulation session
   - `ctime` - Sort by creation time
5. **Team Analysis**: The `data.attack` and `data.defence` objects contain team composition and power information for analysis

### Example Usage

```javascript
// Retrieve all battle simulation history
const getAllHistoryRequest = {
  calls: [{
    name: "demoBattles_getAll",
    args: {},
    context: {
      actionTs: Date.now()
    },
    ident: "body"
  }]
};

const response = await fetch(apiEndpoint, {
  method: 'POST',
  body: JSON.stringify(getAllHistoryRequest),
  headers: headers
});

const data = await response.json();

// Extract battle history items
const historyItems = data.results[0].result.response.items;

// Filter by win status
const wins = historyItems.filter(item => item.data.win === true);
const losses = historyItems.filter(item => item.data.win === false);

// Group by simulation session (parentId)
const sessions = {};
historyItems.forEach(item => {
  const sessionKey = item.parentId === 0 ? item.id : item.parentId;
  if (!sessions[sessionKey]) {
    sessions[sessionKey] = [];
  }
  sessions[sessionKey].push(item);
});

// Get win rate for a specific team composition
const teamPower = 1171245;
const teamBattles = historyItems.filter(item => 
  item.data.attack.powerSum === teamPower
);
const winRate = teamBattles.filter(item => item.data.win).length / teamBattles.length;

console.log(`Win rate for team power ${teamPower}: ${(winRate * 100).toFixed(2)}%`);
```

### Response Path

The battle history items are located at:
```
response.results[0].result.response.items
```

Each item in the array contains the complete battle information including team composition, result, and metadata.

