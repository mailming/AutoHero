# AOC (Alliance of Clans) API Documentation

## clanDomination_updateFarm

Updates the farm for Clan Domination and returns farm rewards, town information, and quest data.

### Request

**Endpoint:** `https://heroes-wb.nextersglobal.com/api/`  
**Method:** `POST`  
**Content-Type:** `application/json; charset=UTF-8`

**Request Body:**
```json
{
  "calls": [
    {
      "name": "clanDomination_updateFarm",
      "args": {},
      "context": {
        "actionTs": 1585219
      },
      "ident": "body"
    }
  ]
}
```

**Request Parameters:**
- `name`: `"clanDomination_updateFarm"` - The API method name
- `args`: `{}` - Empty object (no additional arguments required)
- `context`: Object containing:
  - `actionTs`: `1585219` - Action timestamp
- `ident`: `"body"` - Identifier for the response

### Response

**Status:** `200 OK`  
**Content-Type:** `application/javascript; charset=utf-8`

**Response Body:**
```json
{
  "date": 1765514196.5485351,
  "results": [
    {
      "ident": "body",
      "result": {
        "response": {
          "reward": {
            "coin": {
              "46": 32
            }
          },
          "town": {
            "position": 1,
            "status": 1,
            "userId": 35979991,
            "townId": 5,
            "farmStart": 1765514196
          }
        },
        "quests": [
          {
            "id": 404125,
            "state": 3,
            "progress": 260,
            "reward": {
              "coin": {
                "17": "200",
                "46": "50"
              }
            },
            "createTime": 1765332550,
            "farmCount": 0
          },
          {
            "id": 404126,
            "state": 3,
            "progress": 260,
            "reward": {
              "coin": {
                "17": "200",
                "46": "100"
              }
            },
            "createTime": 1765332550,
            "farmCount": 0
          },
          {
            "id": 404127,
            "state": 3,
            "progress": 260,
            "reward": {
              "coin": {
                "17": "200",
                "46": "150"
              }
            },
            "createTime": 1765332550,
            "farmCount": 0
          },
          {
            "id": 404128,
            "state": 3,
            "progress": 260,
            "reward": {
              "coin": {
                "17": "200",
                "46": "200"
              }
            },
            "createTime": 1765332550,
            "farmCount": 0
          },
          {
            "id": 404129,
            "state": 3,
            "progress": 260,
            "reward": {
              "coin": {
                "17": "200",
                "46": "250"
              }
            },
            "createTime": 1765332550,
            "farmCount": 0
          },
          {
            "id": 404130,
            "state": 3,
            "progress": 260,
            "reward": {
              "coin": {
                "17": "200",
                "46": "300"
              }
            },
            "createTime": 1765332550,
            "farmCount": 0
          },
          {
            "id": 404131,
            "state": 3,
            "progress": 260,
            "reward": {
              "coin": {
                "17": "200",
                "46": "400"
              }
            },
            "createTime": 1765332550,
            "farmCount": 0
          },
          {
            "id": 404132,
            "state": 3,
            "progress": 260,
            "reward": {
              "coin": {
                "17": "400",
                "46": "500"
              }
            },
            "createTime": 1765332550,
            "farmCount": 0
          },
          {
            "id": 404133,
            "state": 2,
            "progress": 260,
            "reward": {
              "coin": {
                "17": "600",
                "46": "600"
              }
            },
            "createTime": 1765332550,
            "farmCount": 0
          },
          {
            "id": 404134,
            "state": 1,
            "progress": 260,
            "reward": {
              "coin": {
                "46": "800"
              },
              "consumable": {
                "470": "1"
              }
            },
            "createTime": 1765332550,
            "farmCount": 0
          }
        ]
      }
    }
  ]
}
```

### Response Fields

**Top Level:**
- `date`: Server timestamp (float)
- `results`: Array of result objects

**Result Object:**
- `ident`: Identifier matching the request (`"body"`)
- `result`: Contains the actual response data

**Response Object (`result.result.response`):**
- `reward`: Object containing farm reward
  - `coin`: Object with coin type IDs as keys and amounts as values
    - Example: `{"46": 32}` means 32 coins of type 46
- `town`: Object containing town information
  - `position`: Town position (integer)
  - `status`: Town status (integer)
  - `userId`: User ID (integer)
  - `townId`: Town ID (integer)
  - `farmStart`: Farm start timestamp (integer)

**Quests Array (`result.result.quests`):**
Each quest object contains:
- `id`: Quest ID (integer)
- `state`: Quest state (integer)
  - `1`: Active/available
  - `2`: In progress
  - `3`: Completed
- `progress`: Progress value (integer)
- `reward`: Reward object
  - `coin`: Object with coin type IDs as keys and amounts as string values
  - `consumable`: (Optional) Object with consumable item IDs as keys and quantities as string values
- `createTime`: Quest creation timestamp (integer)
- `farmCount`: Farm count (integer)

### Notes

- The API requires standard authentication headers (x-auth-token, x-auth-player-id, etc.)
- The `actionTs` in the request context should be a valid timestamp
- Coin types appear to be numeric IDs (e.g., 17, 46)
- Quest states: 1 = active, 2 = in progress, 3 = completed
- Farm rewards are returned immediately upon calling this API
- The response includes all available quests with their current states and rewards

