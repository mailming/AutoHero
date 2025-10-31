# Hero Wars Arena API Documentation

## Overview

This document provides comprehensive documentation for the Hero Wars Arena API endpoints, including actual request and response examples captured from network traffic.

**Base URL:** `https://heroes-wb.nextersglobal.com/api/`

**Protocol:** HTTPS

**Method:** POST

**Content-Type:** `application/json; charset=UTF-8`

---

## Authentication Headers

All API requests require the following authentication headers:

| Header | Description | Example Value |
|--------|-------------|---------------|
| `X-Auth-User-Id` | User's unique identifier | `73660848` |
| `X-Auth-Token` | Authentication token | `ps-vHlFm+QJouPAzVqYtwNEpZhIesdRKBkCMn/TbGajfgUxrO-1761328862-104.28.233.73-fe23091471251b85c3aa8429732f0715` |
| `X-Auth-Player-Id` | Player's unique identifier | `35979991` |
| `X-Auth-Session-Id` | Session identifier | `0t4ne1s030pae7` |
| `X-Auth-Session-Key` | Session key (can be empty) | `` |
| `X-Auth-Signature` | Request signature for validation | `5af87cb6ac38ab8b3e444d165ae197a4` |
| `X-Auth-Application-Id` | Application identifier | `3` |
| `X-Auth-Network-Ident` | Network identifier | `web` |
| `X-Request-Id` | Unique request identifier | `12` |
| `X-Server-Time` | Server time offset | `0` |
| `X-Env-Unique-Session-Id` | Unique session identifier | `7387548690923331533` |
| `X-Env-Library-Version` | Library version | `1` |
| `X-Full-Referer` | Full referrer URL | `https://www.hero-wars.com/` |

### Additional Headers

```
X-Requested-With: XMLHttpRequest
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36
Referer: https://www.hero-wars.com/
```

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
        "actionTs": 84916  // Action timestamp in milliseconds
      },
      "ident": "body"
    }
  ]
}
```

---

## API Response Structure

All API responses follow this structure:

```json
{
  "date": 1761328946.6284921,  // Unix timestamp
  "results": [
    {
      "ident": "body",
      "result": {
        "response": { /* method-specific response data */ }
      }
    }
  ]
}
```

---

## Arena Endpoints

### 1. arenaFindEnemies

**Description:** Retrieves a list of available opponents in the arena.

**Request:**

```json
{
  "calls": [
    {
      "name": "arenaFindEnemies",
      "args": {},
      "context": {
        "actionTs": 84916
      },
      "ident": "body"
    }
  ]
}
```

**Response:**

```json
{
  "date": 1761328946.6284921,
  "results": [
    {
      "ident": "body",
      "result": {
        "response": [
          {
            "userId": "60332840",
            "place": "11",
            "heroes": [
              {
                "id": 58,
                "level": 130,
                "color": 18,
                "star": 6
              },
              {
                "id": 64,
                "level": 130,
                "color": 18,
                "star": 6
              },
              {
                "id": 13,
                "level": 130,
                "color": 18,
                "star": 6
              },
              {
                "id": 40,
                "level": 130,
                "color": 18,
                "star": 6
              },
              {
                "id": 59,
                "level": 130,
                "color": 18,
                "star": 6
              },
              {
                "id": 6008,
                "level": 130,
                "color": 10,
                "star": 5,
                "type": "pet"
              }
            ],
            "power": "1048578",
            "banners": [
              {
                "id": 5,
                "slots": {
                  "1": 19,
                  "0": 71,
                  "2": 53
                }
              }
            ],
            "user": {
              "id": "60332840",
              "name": "The Ginger Cat",
              "lastLoginTime": "1761299085",
              "serverId": "218",
              "level": "130",
              "clanId": "268734",
              "clanRole": "4",
              "commander": true,
              "avatarId": "594",
              "isChatModerator": false,
              "frameId": 39,
              "leagueId": 3,
              "allowPm": "all",
              "clanTitle": "Princess Astrid",
              "clanIcon": {
                "flagColor1": 2,
                "flagColor2": 16,
                "flagShape": 5,
                "iconColor": 3,
                "iconShape": 3
              }
            }
          },
          {
            "userId": "36040671",
            "place": "14",
            "heroes": [
              {
                "id": 58,
                "level": 130,
                "color": 18,
                "star": 6
              },
              {
                "id": 63,
                "level": 130,
                "color": 18,
                "star": 5
              },
              {
                "id": 48,
                "level": 130,
                "color": 18,
                "star": 6
              },
              {
                "id": 40,
                "level": 130,
                "color": 18,
                "star": 6
              },
              {
                "id": 67,
                "level": 130,
                "color": 18,
                "star": 6
              },
              {
                "id": 6006,
                "level": 130,
                "color": 10,
                "star": 6,
                "type": "pet"
              }
            ],
            "power": "1023472",
            "banners": [
              {
                "id": 2,
                "slots": {
                  "2": 66,
                  "1": 31,
                  "0": 54
                }
              }
            ],
            "user": {
              "id": "36040671",
              "name": "Hon_0321",
              "lastLoginTime": "1761310474",
              "serverId": "218",
              "level": "130",
              "clanId": "328621",
              "clanRole": "4",
              "commander": false,
              "avatarId": "1253",
              "isChatModerator": false,
              "frameId": 37,
              "leagueId": 3,
              "allowPm": "all",
              "clanTitle": "Peaks End",
              "clanIcon": {
                "flagColor1": 19,
                "flagColor2": 19,
                "flagShape": 12,
                "iconColor": 7,
                "iconShape": 14
              }
            }
          },
          {
            "userId": "35449277",
            "place": "16",
            "heroes": [
              {
                "id": 46,
                "level": 130,
                "color": 18,
                "star": 6
              },
              {
                "id": 9,
                "level": 130,
                "color": 18,
                "star": 6
              },
              {
                "id": 48,
                "level": 130,
                "color": 18,
                "star": 6
              },
              {
                "id": 42,
                "level": 130,
                "color": 18,
                "star": 6
              },
              {
                "id": 1,
                "level": 130,
                "color": 18,
                "star": 6
              },
              {
                "id": 6006,
                "level": 130,
                "color": 10,
                "star": 6,
                "type": "pet"
              }
            ],
            "power": "1155839",
            "banners": [
              {
                "id": 1,
                "slots": [66, 20, 42]
              }
            ],
            "user": {
              "id": "35449277",
              "name": "SkyLight",
              "lastLoginTime": "1761320494",
              "serverId": "218",
              "level": "130",
              "clanId": "328621",
              "clanRole": "4",
              "commander": false,
              "avatarId": "826",
              "isChatModerator": false,
              "frameId": 50,
              "leagueId": 3,
              "allowPm": "all",
              "clanTitle": "Peaks End",
              "clanIcon": {
                "flagColor1": 19,
                "flagColor2": 19,
                "flagShape": 12,
                "iconColor": 7,
                "iconShape": 14
              }
            }
          }
        ]
      }
    }
  ]
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `userId` | String | Opponent's user ID |
| `place` | String | Current arena rank/position |
| `heroes` | Array | List of heroes in the opponent's team |
| `heroes[].id` | Number | Hero ID |
| `heroes[].level` | Number | Hero level |
| `heroes[].color` | Number | Hero color/tier |
| `heroes[].star` | Number | Hero star rating |
| `heroes[].type` | String | Entity type ("pet" for pets) |
| `power` | String | Total team power |
| `banners` | Array | Banner configurations |
| `user` | Object | Opponent's user information |
| `user.name` | String | Player name |
| `user.serverId` | String | Server ID |
| `user.clanTitle` | String | Clan name |

---

### 2. arenaAttack

**Description:** Initiates an attack against an opponent in the arena.

**Request:**

```json
{
  "calls": [
    {
      "name": "arenaAttack",
      "args": {
        "userId": 60332840,
        "heroes": [57, 31, 55, 40, 16],
        "pet": 6008,
        "favor": {
          "16": 6004,
          "31": 6006,
          "55": 6001,
          "57": 6003
        },
        "banners": [6]
      },
      "context": {
        "actionTs": 90073
      },
      "ident": "body"
    }
  ]
}
```

**Request Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `userId` | Number | Target opponent's user ID |
| `heroes` | Array[Number] | Array of hero IDs to use in battle (5 heroes) |
| `pet` | Number | Pet ID to use in battle |
| `favor` | Object | Favor pet assignments (hero ID → pet ID mapping) |
| `banners` | Array[Number] | Banner IDs to use in battle |

**Response:**

The response includes detailed battle information, including:

```json
{
  "date": 1761328952.035255,
  "results": [
    {
      "ident": "body",
      "result": {
        "response": {
          "battles": [
            {
              "userId": "35979991",
              "typeId": "60332840",
              "attackers": {
                "57": {
                  "id": 57,
                  "xp": 3625195,
                  "level": 130,
                  "color": 18,
                  "power": 129353,
                  "star": 6,
                  "runes": [43750, 2700, 2700, 2700, 16550],
                  "skins": {
                    "269": 60,
                    "288": 60,
                    "342": 60
                  },
                  "currentSkin": 269,
                  "artifacts": [
                    {"level": 100, "star": 6},
                    {"level": 51, "star": 5},
                    {"level": 60, "star": 5}
                  ],
                  "hp": 139763,
                  "strength": 11512,
                  "agility": 3249,
                  "intelligence": 2854,
                  "physicalAttack": 40410,
                  "armor": 17032,
                  "magicPower": 8851.7,
                  "magicResist": 19329.7
                }
              },
              "defenders": [
                {
                  "1": {
                    "id": 58,
                    "level": 130,
                    "color": 18,
                    "power": 173092,
                    "star": 6,
                    "hp": 423649,
                    "armor": 21833.2,
                    "magicPower": 83896.2
                  }
                }
              ],
              "effects": {
                "defenders": {
                  "percentBuffByPerk_castSpeed_10": 5,
                  "percentBuffAll_magicResist": 12.75,
                  "percentBuffAll_armorPenetration": 11.3,
                  "redPatternScaling": 1,
                  "percentBuffAllEnemy_dodge": -11
                },
                "defendersBanner": {
                  "id": 5,
                  "slots": {
                    "1": 19,
                    "0": 71,
                    "2": 53
                  }
                },
                "attackers": {
                  "levelDecreaseAuraOnEnemy_8_18_400": 2,
                  "percentBuffAll_magicPower": 16,
                  "redPatternScaling": 2,
                  "percentBuffAll_armor": 14,
                  "percentDebuffAllEnemy_physicalCritChance": 8
                },
                "attackersBanner": {
                  "id": 6,
                  "slots": [15, 45, 76]
                }
              },
              "reward": [],
              "startTime": 1761328951,
              "seed": 2734251432,
              "type": "arena",
              "id": "1761328951839197088",
              "progress": [],
              "endTime": 1761328951,
              "result": {
                "win": false,
                "stars": 0,
                "serverVersion": 272
              }
            }
          ],
          "win": false,
          "state": {
            "userId": "35979991",
            "arenaPlace": "19",
            "arenaHeroes": [
              {
                "id": 29,
                "level": 130,
                "color": 17,
                "star": 6
              }
            ],
            "grandPlace": "9",
            "arenaPower": "906924",
            "grandPower": "3033044",
            "rewardFlag": 1,
            "battles": 3178,
            "wins": 1929,
            "rewardTime": 1761332400
          },
          "enemies": [
            {
              "userId": "47308606",
              "place": "10",
              "heroes": [
                {
                  "id": 58,
                  "level": 130,
                  "color": 18,
                  "star": 6
                }
              ],
              "power": "1059282",
              "user": {
                "id": "47308606",
                "name": "Yaoya",
                "serverId": "218",
                "level": "130"
              }
            }
          ],
          "quests": [],
          "specialOffers": []
        }
      }
    }
  ]
}
```

**Battle Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `battles[].attackers` | Object | Detailed attacker hero stats |
| `battles[].defenders` | Array | Detailed defender hero stats |
| `battles[].effects` | Object | Battle effects and buffs/debuffs |
| `battles[].result.win` | Boolean | Battle outcome (true if attacker won) |
| `battles[].result.stars` | Number | Stars earned (0-3) |
| `battles[].seed` | Number | Battle seed for replay |
| `battles[].id` | String | Unique battle ID |
| `state.arenaPlace` | String | Current arena rank after battle |
| `state.battles` | Number | Total arena battles |
| `state.wins` | Number | Total arena wins |
| `enemies` | Array | Updated list of available enemies |

---

### 3. arenaCheckTargetRange

**Description:** Validates if target opponents are still in valid attack range.

**Request:**

```json
{
  "calls": [
    {
      "name": "arenaCheckTargetRange",
      "args": {
        "ids": ["47308606", "40990396", "35449277"]
      },
      "context": {
        "actionTs": 98644
      },
      "ident": "body"
    }
  ]
}
```

**Request Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `ids` | Array[String] | Array of user IDs to validate |

**Response:**

```json
{
  "date": 1761328960.3608229,
  "results": [
    {
      "ident": "body",
      "result": {
        "response": {
          "47308606": true,
          "40990396": true,
          "35449277": true
        }
      }
    }
  ]
}
```

**Response Format:**

The response is a key-value map where:
- **Key:** User ID (String)
- **Value:** Boolean indicating if the user is in valid attack range
  - `true`: User can be attacked
  - `false`: User is out of range or unavailable

---

### 4. stashClient

**Description:** Sends client-side analytics and event data to the server.

**Request:**

```json
{
  "calls": [
    {
      "name": "stashClient",
      "args": {
        "data": [
          {
            "type": ".client.window.open",
            "params": {
              "actionTs": 90624,
              "windowName": "game.view.popup.team.ArenaAttackTeamGatherPopupWithEnemyTeam",
              "timestamp": 1761328952,
              "sessionNumber": 170,
              "windowCounter": 18,
              "assetsReloadNum": 0,
              "assetsType": "web",
              "assetsLoadingPercent": 0,
              "assetsLoadingTime": 14
            }
          },
          {
            "type": ".client.button.click",
            "params": {
              "actionTs": 90074,
              "windowName": "game.view.popup.team.ArenaAttackTeamGatherPopupWithEnemyTeam",
              "buttonName": "go",
              "timestamp": 1761328951,
              "sessionNumber": 170,
              "windowCounter": 0,
              "assetsReloadNum": 0,
              "assetsType": "cache",
              "assetsLoadingPercent": 0,
              "assetsLoadingTime": 0
            }
          }
        ]
      },
      "context": {
        "actionTs": 91858
      },
      "ident": "group_0_body"
    }
  ]
}
```

**Request Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `data` | Array | Array of client event objects |
| `data[].type` | String | Event type (e.g., `.client.window.open`, `.client.button.click`) |
| `data[].params` | Object | Event-specific parameters |

**Common Event Types:**
- `.client.window.open` - Window/popup opened
- `.client.window.close` - Window/popup closed
- `.client.button.click` - Button clicked
- `.client.ticks` - Client tick/heartbeat

**Response:**

```json
{
  "date": 1761328968.5765281,
  "results": [
    {
      "ident": "group_0_body",
      "result": {
        "response": {}
      }
    }
  ]
}
```

The response is typically empty for analytics events.

---

## Error Handling

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Authentication failed |
| 403 | Forbidden - Insufficient permissions |
| 500 | Internal Server Error |

### Error Response Format

```json
{
  "date": 1761328946.6284921,
  "error": {
    "code": "ERROR_CODE",
    "message": "Error description"
  }
}
```

---

## Rate Limiting

The API implements rate limiting based on:
- User ID
- IP address
- Session ID

**Recommended Practices:**
- Implement exponential backoff for failed requests
- Cache arena opponent data for 30-60 seconds
- Avoid rapid successive attacks (minimum 5-second delay)

---

## Data Models

### Hero Object

```typescript
{
  id: number;              // Hero ID
  level: number;           // Hero level (1-130)
  color: number;           // Hero color/tier (0-18)
  star: number;            // Star rating (1-6)
  xp?: number;             // Experience points
  power?: number;          // Power rating
  skills?: Object;         // Skill levels
  runes?: number[];        // Rune levels
  skins?: Object;          // Available skins
  currentSkin?: number;    // Active skin ID
  artifacts?: Array;       // Artifact data
  hp?: number;             // Health points
  strength?: number;       // Strength stat
  agility?: number;        // Agility stat
  intelligence?: number;   // Intelligence stat
  physicalAttack?: number; // Physical attack stat
  armor?: number;          // Armor stat
  magicPower?: number;     // Magic power stat
  magicResist?: number;    // Magic resistance stat
}
```

### User Object

```typescript
{
  id: string;              // User ID
  name: string;            // Player name
  lastLoginTime: string;   // Last login timestamp
  serverId: string;        // Server ID
  level: string;           // Player level
  clanId: string;          // Clan ID
  clanRole: string;        // Role in clan
  commander: boolean;      // Is clan commander
  avatarId: string;        // Avatar ID
  isChatModerator: boolean;// Moderator status
  frameId: number;         // Frame ID
  leagueId: number;        // League ID
  allowPm: string;         // PM settings
  clanTitle: string;       // Clan name
  clanIcon: Object;        // Clan icon data
}
```

### Banner Object

```typescript
{
  id: number;              // Banner ID
  slots: Object | Array;   // Banner slot configuration
}
```

---

## Example Usage Flow

### 1. Find Opponents

```javascript
// Request available opponents
POST /api/
{
  "calls": [{
    "name": "arenaFindEnemies",
    "args": {},
    "context": {"actionTs": Date.now()},
    "ident": "body"
  }]
}
```

### 2. Check Target Range

```javascript
// Verify opponents are still attackable
POST /api/
{
  "calls": [{
    "name": "arenaCheckTargetRange",
    "args": {"ids": ["60332840", "36040671"]},
    "context": {"actionTs": Date.now()},
    "ident": "body"
  }]
}
```

### 3. Attack Opponent

```javascript
// Initiate battle
POST /api/
{
  "calls": [{
    "name": "arenaAttack",
    "args": {
      "userId": 60332840,
      "heroes": [57, 31, 55, 40, 16],
      "pet": 6008,
      "favor": {"16": 6004, "31": 6006},
      "banners": [6]
    },
    "context": {"actionTs": Date.now()},
    "ident": "body"
  }]
}
```

---

## Notes

1. **Action Timestamp (`actionTs`)**: This value represents the client-side timestamp in milliseconds and is used for synchronization and anti-cheat purposes.

2. **Authentication Signature**: The `X-Auth-Signature` header must be computed based on the request parameters and authentication token. The exact algorithm is server-side validated.

3. **Battle Seed**: The `seed` value in battle results can be used to replay battles deterministically.

4. **Pet IDs**: Pet IDs start at 6000+ (e.g., 6008, 6006, 6004).

5. **Hero Colors**: Higher color values indicate higher tier/rarity (18 is maximum).

6. **Power Calculation**: Total power is calculated from all hero stats, artifacts, skins, and runes.

---

## Version Information

- **API Version:** Not explicitly versioned in endpoints
- **Server Version:** 272 (as of battle response)
- **Client Library Version:** 1

---

## Security Considerations

⚠️ **Important Security Notes:**

1. Never share authentication tokens publicly
2. The `X-Auth-Signature` must be properly calculated for each request
3. Session IDs expire and must be refreshed
4. Rate limiting is strictly enforced
5. Automated attacks may result in account suspension

---

## Support & Resources

- Official Game Website: https://www.hero-wars.com/
- Server: heroes-wb.nextersglobal.com
- CDN: heroesweb-a-cdn.nextersglobal.com

---

*Document generated from actual network traffic capture on October 24, 2025*

