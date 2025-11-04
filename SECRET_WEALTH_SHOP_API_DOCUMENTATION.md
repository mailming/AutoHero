# Secret Wealth Shop API Documentation

This document provides comprehensive documentation for the Secret Wealth Shop (Merchant Shop) API in Hero Wars, based on network traffic analysis.

## Overview

The Secret Wealth Shop is a merchant shop where players can purchase items using consumables (such as pet potions) or GEMs (starmoney). The shop uses a `shopBuy` API call to execute purchases and track client events through `stashClient` calls.

## API Endpoints

### Base URL
All Secret Wealth Shop APIs use the standard Hero Wars API endpoint:
```
https://heroes-wb.nextersglobal.com/api/
```

**Method:** POST

**Content-Type:** `application/json; charset=UTF-8`

---

## Authentication Headers

All API requests require the following authentication headers:

| Header | Description | Example Value |
|--------|-------------|---------------|
| `X-Auth-User-Id` | User's unique identifier | `73660848` |
| `X-Auth-Token` | Authentication token | `ps-iokPCtcQpWIgy/ujhRZqaKBJUMrNATvELeYz+fdFbwxOnm-1762224480-104.28.233.73-3a39d5bd540134706613de1793e1cf1a` |
| `X-Auth-Player-Id` | Player's unique identifier | `35979991` |
| `X-Auth-Session-Id` | Session identifier | `0t56l430r5q3if` |
| `X-Auth-Session-Key` | Session key (can be empty) | `` |
| `X-Auth-Signature` | Request signature for validation | `ab1f252f9f88d142a778902e9d5332df` |
| `X-Auth-Application-Id` | Application identifier | `3` |
| `X-Auth-Network-Ident` | Network identifier | `web` |
| `X-Request-Id` | Unique request identifier | `8` |
| `X-Server-Time` | Server time offset | `0` |
| `X-Env-Unique-Session-Id` | Unique session identifier | `7391305188488978381` |
| `X-Env-Library-Version` | Library version | `1` |
| `X-Full-Referer` | Full referrer URL | `https://www.hero-wars.com/` |
| `X-Requested-With` | Request type | `XMLHttpRequest` |

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
        "actionTs": 89632  // Action timestamp in milliseconds
      },
      "ident": "body"
    }
  ]
}
```

---

## API Calls

### 1. shopBuy

**Description:** Purchases an item from the Secret Wealth Shop (Merchant Shop). This API call executes the purchase transaction and deducts the cost from the player's inventory.

#### Example 1: Purchase with Consumables

**Request:**
```json
{
  "calls": [
    {
      "name": "shopBuy",
      "args": {
        "shopId": 1576000026, //Secret Wealth Shop
        "slot": 6,
        "cost": {
          "consumable": {
            "85": 40000 //85: pet potion 
          }
        },
        "reward": {
          "consumable": {
            "55": 80 //55: titan artifact sphere 
          }
        }
      },
      "context": {
        "actionTs": 89632
      },
      "ident": "body"
    }
  ]
}
```

**Request Parameters:**

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `shopId` | Number | Unique identifier for the shop instance | `1576000026` |
| `slot` | Number | The slot number of the item being purchased (typically 1-6) | `6` |
| `cost` | Object | The cost of the item being purchased | See below |
| `cost.consumable` | Object | Map of consumable IDs to amounts (when paying with consumables) | `{"85": 40000}` |
| `cost.starmoney` | Number | GEM amount (when paying with GEMs) | `890` |
| `reward` | Object | The reward being received (for validation) | See below |
| `reward.consumable` | Object | Map of consumable IDs to amounts | `{"55": 80}` or `{"201": 100}` |

**Cost Types:**
- **Consumable Payment**: Use `cost.consumable` with consumable ID and amount
- **GEM Payment**: Use `cost.starmoney` with the GEM amount

**Consumable ID Reference:**
- `85`: Pet potion
- `55`: Titan artifact sphere
- `201`: Crystal 

**Response:**
```json
{
  "date": 1762224570.5192871,
  "results": [
    {
      "ident": "body",
      "result": {
        "response": {
          "consumable": {
            "55": 80
          }
        },
        "quests": [
          {
            "id": 1774007441,
            "state": 2,
            "progress": 3170,
            "reward": {
              "battlePassExp": {
                "1773000089": 1050
              }
            },
            "createTime": 1761962457
          },
          {
            "id": 1775007597,
            "state": 2,
            "progress": 3170,
            "reward": {
              "battlePassExp": {
                "1774000090": 1050
              }
            },
            "createTime": 1761962457
          },
          {
            "id": 20000000,
            "state": 3,
            "progress": 643,
            "reward": {
              "clanQuestsPoints": 4,
              "prestige": 20
            },
            "createTime": 1762142787
          },
          {
            "id": 20000001,
            "state": 2,
            "progress": 643,
            "reward": {
              "clanQuestsPoints": 6,
              "prestige": 30
            },
            "createTime": 1762142787
          },
          {
            "id": 20000002,
            "state": 2,
            "progress": 643,
            "reward": {
              "clanQuestsPoints": 8,
              "prestige": 40
            },
            "createTime": 1762142787
          },
          {
            "id": 20000003,
            "state": 2,
            "progress": 643,
            "reward": {
              "clanQuestsPoints": 14,
              "prestige": 70
            },
            "createTime": 1762142787
          },
          {
            "id": 20000004,
            "state": 2,
            "progress": 643,
            "reward": {
              "clanQuestsPoints": 16,
              "prestige": 80
            },
            "createTime": 1762142787
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
| `date` | Number | Server timestamp of the response |
| `results[].ident` | String | Request identifier (`"body"`) |
| `results[].result.response` | Object | Purchase confirmation with rewarded items |
| `results[].result.response.consumable` | Object | Map of consumable IDs to amounts received |
| `results[].result.quests` | Array | Updated quest progress information |
| `quests[].id` | Number | Quest identifier |
| `quests[].state` | Number | Quest state (2 = in progress, 3 = completed) |
| `quests[].progress` | Number | Current quest progress value |
| `quests[].reward` | Object | Quest rewards (if applicable) |
| `quests[].createTime` | Number | Quest creation timestamp |

**Response Status Codes:**
- `200 OK`: Purchase successful
- Other status codes indicate errors (typically validation failures)

#### Example 2: Purchase with GEMs (starmoney)

**Request:**
```json
{
  "calls": [
    {
      "name": "shopBuy",
      "args": {
        "shopId": 1576000026, //Secret Wealth Shop
        "slot": 3,
        "cost": {
          "starmoney": 890 // GEM payment
        },
        "reward": {
          "consumable": {
            "201": 100 //201: Crystal
          }
        }
      },
      "context": {
        "actionTs": 241370
      },
      "ident": "body"
    }
  ]
}
```

**Response:**
```json
{
  "date": 1762226670.8397801,
  "results": [
    {
      "ident": "body",
      "result": {
        "response": {
          "consumable": {
            "201": 100
          }
        },
        "quests": [
          // ... quest updates ...
        ]
      }
    }
  ]
}
```

**Note:** When using GEMs (`starmoney`), the cost is specified as a direct number value, not as a consumable object.

---

### 2. stashClient (Client Event Tracking)

**Description:** Tracks client-side events such as button clicks and window interactions. This is typically called before the `shopBuy` request to log user interactions.

**Request:**
```json
{
  "calls": [
    {
      "name": "stashClient",
      "args": {
        "data": [
          {
            "type": ".client.button.click",
            "params": {
              "actionTs": 89631,
              "windowName": "store:merchant",
              "buttonName": "shop_item_buy",
              "timestamp": 1762224570,
              "sessionNumber": 259,
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
        "actionTs": 92921
      },
      "ident": "body"
    }
  ]
}
```

**Event Types:**

| Event Type | Description |
|------------|-------------|
| `.client.button.click` | Button click event |
| `.client.window.open` | Window opened event |
| `.client.window.close` | Window closed event |

**Response:**
```json
{
  "date": 1762224578.6182461,
  "results": [
    {
      "ident": "body",
      "result": {
        "response": [true]
      }
    }
  ]
}
```

**Note:** The `stashClient` call is primarily for analytics and tracking. The response is typically a simple success confirmation.

---

## Usage Flow

The typical flow for purchasing from the Secret Wealth Shop is:

1. **Open Shop Window** - Client tracks window open event via `stashClient`
2. **Click Purchase Button** - Client tracks button click via `stashClient`
3. **Execute Purchase** - Send `shopBuy` request with item details
4. **Receive Rewards** - Response confirms purchase and provides quest updates

**Example Flow Sequence:**

```
1. stashClient (.client.window.open) - Store window opened
2. stashClient (.client.button.click) - Purchase button clicked  
3. shopBuy - Purchase transaction executed
4. stashClient (.client.window.close) - Store window closed (optional)
```

---

## Error Handling

If a purchase fails, the API will return an error response. Common failure scenarios:

- **Insufficient funds**: Player doesn't have enough of the required consumable
- **Invalid slot**: The slot number doesn't exist or item is already sold
- **Shop expired**: The shop instance (`shopId`) is no longer valid
- **Mismatched cost/reward**: The provided cost or reward doesn't match server expectations

**Error Response Format:**
```json
{
  "date": 1762224570.5192871,
  "results": [
    {
      "ident": "body",
      "result": {
        "error": "Error message description"
      }
    }
  ]
}
```

---

## Notes

- The `shopId` is a unique identifier for each shop instance. It may change when the shop refreshes.
- The `slot` parameter typically ranges from 1-6, representing the 6 available shop slots.
- Quest updates are automatically included in the response if the purchase advances any active quests.
- The `actionTs` (action timestamp) should be generated client-side and represents the time of the user action in milliseconds.
- The `cost` parameter supports two payment methods:
  - **Consumable payment**: Use `cost.consumable` with consumable ID mapping
  - **GEM payment**: Use `cost.starmoney` with a numeric GEM amount
- All consumable IDs are numeric identifiers. Common ones include:
  - `85`: Pet potion
  - `55`: Titan artifact sphere
  - `201`: Crystal
  - Other IDs represent various in-game currencies and items

---

## Related API Calls

The Secret Wealth Shop may be accessed through other shop-related APIs:

- Shop inventory/items are typically fetched through game state APIs
- Shop refresh timers are managed server-side
- Shop availability is determined by game state and player progress

---

**Last Updated:** Based on network traffic from November 4, 2025

