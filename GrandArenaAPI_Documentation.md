# Hero Wars Grand Arena API Documentation

This document provides comprehensive documentation for the Hero Wars Grand Arena API endpoints, based on real examples from the `GrandArenaAPI.har` file.

## Overview

The Grand Arena API provides functionality for:
- Finding opponents in Grand Arena
- Checking target availability 
- Initiating Grand Arena battles
- Managing Grand Arena team configurations

## Base URL and Authentication

**Base URL:** `https://heroes-wb.nextersglobal.com/api/`

**Required Headers:**
- `Content-Type: application/json; charset=UTF-8`
- `X-Auth-Application-Id: 3`
- `X-Auth-Network-Ident: web`
- `X-Auth-Player-Id: [player_id]`
- `X-Auth-Session-Id: [session_id]`
- `X-Auth-Signature: [signature]`
- `X-Auth-Token: [auth_token]`
- `X-Auth-User-Id: [user_id]`
- `X-Env-Library-Version: 1`
- `X-Env-Unique-Session-Id: [unique_session_id]`
- `X-Request-Id: [request_id]`
- `X-Requested-With: XMLHttpRequest`
- `X-Server-Time: 0`

## API Endpoints

### 1. grandFindEnemies

**Purpose:** Finds available opponents in Grand Arena

**Request:**
```json
{
  "calls": [
    {
      "name": "grandFindEnemies",
      "args": {},
      "context": {
        "actionTs": 28125
      },
      "ident": "body"
    }
  ]
}
```

**Response:**
```json
{
  "date": 1761403235.7004831,
  "results": [
    {
      "ident": "body",
      "result": {
        "response": [
          {
            "userId": "48705148",
            "place": "5",
            "heroes": [
              [
                {
                  "id": 34,
                  "level": 130,
                  "color": 18,
                  "star": 6
                },
                {
                  "id": 43,
                  "level": 130,
                  "color": 18,
                  "star": 6
                },
                {
                  "id": 69,
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
                  "id": 64,
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
              ]
            ],
            "power": "3022787",
            "banners": [
              {
                "id": 2,
                "slots": [13, 21, 91]
              }
            ],
            "user": {
              "id": "48705148",
              "name": "foczka",
              "lastLoginTime": "1761385059",
              "serverId": "218",
              "level": "130",
              "clanId": "328621",
              "clanRole": "4",
              "commander": false,
              "avatarId": "1485",
              "isChatModerator": false,
              "frameId": 202,
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
- `userId`: Unique identifier for the opponent
- `place`: Current rank/position in Grand Arena
- `heroes`: Array of hero teams (Grand Arena has multiple teams)
- `power`: Total power of the opponent
- `banners`: Banner configuration
- `user`: User information including name, clan details, etc.

### 2. grandCheckTargetRange

**Purpose:** Checks if specific opponents are still available for attack

**Request:**
```json
{
  "calls": [
    {
      "name": "grandCheckTargetRange",
      "args": {
        "ids": ["48705148", "35986432", "47308606"]
      },
      "context": {
        "actionTs": 36558
      },
      "ident": "body"
    }
  ]
}
```

**Response:**
```json
{
  "date": 1761403243.9189429,
  "results": [
    {
      "ident": "body",
      "result": {
        "response": {
          "48705148": true,
          "35986432": true,
          "47308606": true
        }
      }
    }
  ]
}
```

**Response Fields:**
- Object with user IDs as keys and boolean values indicating availability

### 3. grandAttack

**Purpose:** Initiates a Grand Arena battle against an opponent

**Request:**
```json
{
  "calls": [
    {
      "name": "grandAttack",
      "args": {
        "userId": 47308606,
        "heroes": [
          [58, 1, 64, 13, 55],
          [42, 56, 9, 62, 43],
          [16, 31, 57, 40, 48]
        ],
        "pets": [6006, 6005, 6004],
        "favor": {
          "1": 6002,
          "9": 6005,
          "16": 6004,
          "42": 6007,
          "48": 6000,
          "55": 6001,
          "56": 6006,
          "62": 6003,
          "64": 6008
        },
        "banners": [1, 6, 2]
      },
      "context": {
        "actionTs": 37377
      },
      "ident": "body"
    }
  ]
}
```

**Request Parameters:**
- `userId`: Target opponent's user ID
- `heroes`: Array of hero teams (3 teams for Grand Arena)
- `pets`: Array of pet IDs for each team
- `favor`: Object mapping hero IDs to pet IDs for favor assignments
- `banners`: Array of banner IDs for each team

**Response:**
```json
{
  "date": 1761403245.3925569,
  "results": [
    {
      "ident": "body",
      "result": {
        "response": {
          "battles": [
            {
              "userId": "35979991",
              "typeId": "47308606",
              "attackers": {
                "58": {
                  "id": 58,
                  "xp": 3625195,
                  "level": 130,
                  "color": 18,
                  "slots": {
                    "0": 0,
                    "2": 0,
                    "3": 0,
                    "1": 0,
                    "5": 0,
                    "4": 0
                  },
                  "skills": {
                    "396": 130,
                    "397": 130,
                    "398": 130,
                    "399": 130
                  },
                  "power": 161450,
                  "star": 6,
                  "runes": [43750, 43750, 8300, 8260, 18530],
                  "skins": {
                    "283": 60,
                    "330": 60,
                    "312": 60,
                    "347": 60
                  },
                  "currentSkin": 347,
                  "titanGiftLevel": 30,
                  "titanCoinsSpent": {
                    "consumable": {
                      "24": 65150
                    }
                  },
                  "artifacts": [
                    {
                      "level": 130,
                      "star": 6
                    },
                    {
                      "level": 130,
                      "star": 6
                    },
                    {
                      "level": 104,
                      "star": 6
                    }
                  ],
                  "scale": 1,
                  "petId": 0,
                  "type": "hero",
                  "perks": [9, 7, 2, 18, 21],
                  "ascensions": {
                    "1": [0, 1, 2, 3, 5, 6, 4, 8, 9, 7],
                    "2": [0, 1, 2, 3, 5, 4, 6, 7, 8, 10],
                    "3": [0, 1, 2, 5, 6, 7, 3, 4, 8, 9],
                    "4": [0, 2, 3, 4, 8, 1, 5, 6, 7, 9],
                    "5": [0, 1, 2, 3, 5]
                  },
                  "agility": 2319,
                  "hp": 426308,
                  "intelligence": 15241,
                  "physicalAttack": 50,
                  "strength": 2985,
                  "armor": 13319,
                  "magicPenetration": 11870,
                  "magicPower": 76679,
                  "magicResist": 19434,
                  "skin": 347,
                  "favorPetId": 0,
                  "favorPower": 0
                }
              },
              "defenders": [
                {
                  "1": {
                    "id": 2,
                    "xp": 3625195,
                    "level": 130,
                    "color": 18,
                    "slots": {
                      "0": 0,
                      "2": 0,
                      "3": 0,
                      "5": 0,
                      "4": 0,
                      "1": 0
                    },
                    "skills": {
                      "426": 130,
                      "427": 130,
                      "428": 130,
                      "429": 130,
                      "6035": 130,
                      "8265": 1,
                      "8264": 1
                    },
                    "power": 183410,
                    "star": 6,
                    "runes": [43750, 43750, 40320, 40310, 43750],
                    "skins": {
                      "2": 60,
                      "324": 60,
                      "32": 60,
                      "134": 60,
                      "270": 27,
                      "69": 60
                    },
                    "currentSkin": 2,
                    "titanGiftLevel": 30,
                    "titanCoinsSpent": {
                      "consumable": {
                        "24": 65150
                      }
                    },
                    "artifacts": [
                      {
                        "level": 130,
                        "star": 6
                      },
                      {
                        "level": 130,
                        "star": 6
                      },
                      {
                        "level": 90,
                        "star": 6
                      }
                    ],
                    "scale": 1,
                    "petId": 6007,
                    "type": "hero",
                    "perks": [4, 10, 2, 16],
                    "ascensions": {
                      "1": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
                      "2": [0, 1, 2, 3, 4, 5, 9, 6, 7, 10, 8],
                      "3": [0, 1, 2, 4, 3, 5, 6, 7, 9, 8],
                      "4": [0, 1, 2, 3, 5, 4, 6, 7, 8, 9],
                      "5": [0, 1, 3, 5, 6, 7, 8, 10, 9, 4, 2]
                    },
                    "agility": 3301,
                    "hp": 391144,
                    "intelligence": 2776,
                    "physicalAttack": 42334,
                    "strength": 14665,
                    "armor": 55864.599999999999,
                    "lifesteal": 45,
                    "magicPower": 6477.6000000000004,
                    "magicResist": 35304,
                    "modifiedSkillTier": 3,
                    "skin": 2,
                    "favorPetId": 6007,
                    "favorPower": 6484
                  }
                }
              ],
              "effects": {
                "defenders": {
                  "percentBuffPet_strength": 10,
                  "percentBuffAll_armor": 9.5,
                  "percentBuffAll_magicResist": 9.25,
                  "percentBuffAllEnemy_dodge": -15,
                  "redPatternScaling": 1
                },
                "defendersBanner": {
                  "id": 2,
                  "slots": {
                    "2": 41,
                    "0": 18,
                    "1": 54
                  }
                },
                "attackers": {
                  "percentBuffByPerk_energyIncrease_4": 10,
                  "percentBuffAll_magicResist": 12.75,
                  "percentBuffAll_magicPower": 16,
                  "redPatternScaling": 2,
                  "percentBuffAll_armor": 13
                },
                "attackersBanner": {
                  "id": 1,
                  "slots": {
                    "2": 19,
                    "0": 15,
                    "1": 43
                  }
                }
              },
              "reward": [],
              "startTime": 1761403244,
              "seed": 3614443189,
              "type": "grand",
              "id": "1761403245008845085",
              "progress": [],
              "endTime": 1761403244,
              "result": {
                "win": false,
                "stars": 0,
                "battleOrder": 0,
                "serverVersion": 272
              }
            }
          ],
          "win": false,
          "state": {
            "userId": "35979991",
            "arenaPlace": "29",
            "arenaHeroes": [
              {
                "id": 29,
                "level": 130,
                "color": 17,
                "star": 6
              },
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
                "id": 43,
                "level": 130,
                "color": 18,
                "star": 6
              },
              {
                "id": 6008,
                "level": 130,
                "color": 10,
                "star": 6,
                "type": "pet"
              }
            ],
            "grandPlace": "9",
            "grandHeroes": [
              [
                {
                  "id": 42,
                  "level": 130,
                  "color": 18,
                  "star": 6
                },
                {
                  "id": 43,
                  "level": 130,
                  "color": 18,
                  "star": 6
                },
                {
                  "id": 56,
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
                  "id": 62,
                  "level": 130,
                  "color": 18,
                  "star": 6
                },
                {
                  "id": 6008,
                  "level": 130,
                  "color": 10,
                  "star": 6,
                  "type": "pet"
                }
              ],
              [
                {
                  "id": 1,
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
                  "id": 13,
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
                  "id": 58,
                  "level": 130,
                  "color": 18,
                  "star": 6
                },
                {
                  "id": 6006,
                  "level": 130,
                  "color": 10,
                  "star": 5,
                  "type": "pet"
                }
              ],
              [
                {
                  "id": 16,
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
                  "id": 63,
                  "level": 130,
                  "color": 18,
                  "star": 6
                },
                {
                  "id": 55,
                  "level": 130,
                  "color": 18,
                  "star": 6
                },
                {
                  "id": 31,
                  "level": 130,
                  "color": 18,
                  "star": 6
                },
                {
                  "id": 6004,
                  "level": 130,
                  "color": 10,
                  "star": 5,
                  "type": "pet"
                }
              ]
            ],
            "grandCoin": 825.88566666666668,
            "grandCoinTime": 1761403244,
            "arenaPower": "906924",
            "grandPower": "3033044",
            "rewardFlag": 1,
            "battles": 3178,
            "wins": 1929,
            "rewardTime": 1761418800
          },
          "enemies": [
            {
              "userId": "35891708",
              "place": "4",
              "heroes": [
                [
                  {
                    "id": 50,
                    "level": 130,
                    "color": 18,
                    "star": 6
                  },
                  {
                    "id": 51,
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
                    "id": 55,
                    "level": 130,
                    "color": 18,
                    "star": 6
                  },
                  {
                    "id": 6,
                    "level": 130,
                    "color": 18,
                    "star": 6
                  },
                  {
                    "id": 6001,
                    "level": 130,
                    "color": 10,
                    "star": 6,
                    "type": "pet"
                  }
                ]
              ],
              "power": "3457536",
              "banners": [
                {
                  "id": 7,
                  "slots": [43, 25, 91]
                }
              ],
              "user": {
                "id": "35891708",
                "name": "SaKaE48",
                "lastLoginTime": "1761401882",
                "serverId": "218",
                "level": "130",
                "clanId": "328621",
                "clanRole": "255",
                "commander": true,
                "avatarId": "29",
                "isChatModerator": false,
                "frameId": 114,
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
          ],
          "reward": null,
          "quests": [
            {
              "id": 20000120,
              "state": 2,
              "progress": 5331675,
              "reward": {
                "clanQuestsPoints": 6,
                "prestige": 30
              },
              "createTime": 1761366603
            }
          ]
        }
      }
    }
  ]
}
```

**Response Fields:**
- `battles`: Array of battle data for each team
- `win`: Overall battle result
- `state`: Current player state including rankings and team configurations
- `enemies`: Updated enemy list
- `reward`: Battle rewards
- `quests`: Quest progress updates

## Key Differences from Regular Arena

1. **Multiple Teams**: Grand Arena uses 3 teams instead of 1
2. **Team Structure**: Heroes are organized in arrays of arrays (3 teams)
3. **Pet Assignment**: Each team has its own pet configuration
4. **Banner Configuration**: Each team can have different banners
5. **Favor System**: More complex favor assignments across multiple teams

## Error Handling

The API returns standard HTTP status codes:
- `200`: Success
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `500`: Internal Server Error

Error responses include:
```json
{
  "error": {
    "name": "ErrorName",
    "description": "Error description"
  }
}
```

## Rate Limiting

- Grand Arena has daily attempt limits
- Cooldown periods between attacks
- Server-side validation of team configurations

## Notes

- All timestamps are in Unix format
- Hero IDs, pet IDs, and other identifiers are consistent across the API
- The API supports both regular Arena and Grand Arena with different endpoints
- Battle results are calculated server-side and returned immediately
- Team configurations must be valid before initiating attacks