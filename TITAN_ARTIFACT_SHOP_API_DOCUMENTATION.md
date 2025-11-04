# Titan Artifact Shop API Documentation

This document provides comprehensive documentation for the Titan Artifact Shop API in Hero Wars, based on network traffic analysis from `shopBuyLight.har`.

## Overview

The Titan Artifact Shop (shopId: 13) is a shop where players can purchase Titan Artifact fragments using coins. The shop supports bulk purchases and uses a `shopBuy` API call to execute purchases, along with `shopGet` to retrieve shop inventory and `stashClient` calls to track client events.

## API Endpoints

### Base URL
All Titan Artifact Shop APIs use the standard Hero Wars API endpoint:
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
| `X-Auth-Token` | Authentication token | `ps-bPQUpD+uOVGqrBKA/MWdJoiTsvceCxLnIhjgfSHXwEaYyZ-1762274271-104.28.233.73-bdc81d346a10c67bdd1d181ddea69a49` |
| `X-Auth-Player-Id` | Player's unique identifier | `35979991` |
| `X-Auth-Session-Id` | Session identifier | `0t57nj60fawfen` |
| `X-Auth-Session-Key` | Session key (can be empty) | `` |
| `X-Auth-Signature` | Request signature for validation | `4ad4d7d3b438920c27f2ee2ed64a587f` |
| `X-Auth-Application-Id` | Application identifier | `3` |
| `X-Auth-Network-Ident` | Network identifier | `web` |
| `X-Request-Id` | Unique request identifier | `105` |
| `X-Server-Time` | Server time offset | `0` |
| `X-Env-Unique-Session-Id` | Unique session identifier | `7391514027704393677` |
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
        "actionTs": 1157278  // Action timestamp in milliseconds
      },
      "ident": "body"  // or "group_0_body", "group_0_shopGet", etc.
    }
  ]
}
```

---

## API Calls

### 1. shopBuy

**Description:** Purchases Titan Artifact fragments from the shop. This API call executes the purchase transaction and deducts the cost from the player's coin inventory. Supports bulk purchases via the `amount` parameter.

**Request:**
```json
{
  "calls": [
    {
      "name": "shopBuy",
      "args": {
        "shopId": 13,
        "slot": 24,
        "cost": {
          "coin": {
            "18": 12
          }
        },
        "reward": {
          "fragmentTitanArtifact": {
            "2005": 1
          }
        },
        "amount": 300
      },
      "context": {
        "actionTs": 1157278
      },
      "ident": "group_0_body"
    }
  ]
}
```

**Request Parameters:**

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `shopId` | Number | Unique identifier for the Titan Artifact Shop | `13` |
| `slot` | Number | The slot number of the item being purchased (typically 1-25) | `24` |
| `cost` | Object | The cost of the item being purchased | See below |
| `cost.coin` | Object | Map of coin type IDs to amounts | `{"18": 12}` |
| `reward` | Object | The reward being received (for validation) | See below |
| `reward.fragmentTitanArtifact` | Object | Map of fragment IDs to amounts | `{"2005": 1}` |
| `amount` | Number | Number of items to purchase in bulk (optional, defaults to 1) | `300` |

**Cost Types:**
- **Coin Payment**: Use `cost.coin` with coin type ID and amount
- Coin type `18` appears to be the standard currency for this shop

**Titan Artifact Fragment IDs:**
- `1001-1016`: Standard Titan Artifact fragments
- `1017-1020`: Additional Titan Artifact fragments
- `2001-2005`: Advanced Titan Artifact fragments

**Response:**
```json
{
  "date": 1762275434.3295,
  "results": [
    {
      "ident": "group_0_body",
      "result": {
        "response": {
          "fragmentTitanArtifact": {
            "2005": 300
          }
        },
        "quests": [
          {
            "id": 20000160,
            "state": 2,
            "progress": 3600,
            "reward": {
              "clanQuestsPoints": 10,
              "prestige": 50
            },
            "createTime": 1762228947
          }
          // ... more quest updates ...
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
| `results[].ident` | String | Request identifier (`"group_0_body"` or `"body"`) |
| `results[].result.response` | Object | Purchase confirmation with rewarded items |
| `results[].result.response.fragmentTitanArtifact` | Object | Map of fragment IDs to amounts received |
| `results[].result.quests` | Array | Updated quest progress information |
| `quests[].id` | Number | Quest identifier |
| `quests[].state` | Number | Quest state (2 = in progress, 3 = completed) |
| `quests[].progress` | Number | Current quest progress value |
| `quests[].reward` | Object | Quest rewards (if applicable) |
| `quests[].createTime` | Number | Quest creation timestamp |

**Response Status Codes:**
- `200 OK`: Purchase successful
- Other status codes indicate errors (typically validation failures)

---

### 2. shopGet

**Description:** Retrieves the current inventory and configuration of the Titan Artifact Shop. This is typically called together with `shopBuy` to refresh the shop state after a purchase.

**Request:**
```json
{
  "calls": [
    {
      "name": "shopGet",
      "args": {
        "shopId": 13
      },
      "context": {
        "actionTs": 1157279
      },
      "ident": "group_0_shopGet"
    }
  ]
}
```

**Request Parameters:**

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `shopId` | Number | Unique identifier for the Titan Artifact Shop | `13` |

**Response:**
```json
{
  "date": 1762275434.3295,
  "results": [
    {
      "ident": "group_0_shopGet",
      "result": {
        "response": {
          "id": 13,
          "slots": {
            "1": {
              "id": 1,
              "pinned": false,
              "reward": {
                "fragmentTitanArtifact": {
                  "1001": 1
                }
              },
              "bought": 0,
              "cost": {
                "coin": {
                  "18": "12"
                }
              },
              "amountAvailable": null,
              "staticShopMultiplePurchase": 1
            }
            // ... more slots (2-25) ...
          },
          "availableUntil": 0,
          "level": 0,
          "refreshTime": 0
        }
      }
    }
  ]
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | Number | Shop ID (13 for Titan Artifact Shop) |
| `slots` | Object | Map of slot numbers to slot data |
| `slots[].id` | Number | Slot ID |
| `slots[].pinned` | Boolean | Whether the slot is pinned |
| `slots[].reward` | Object | Reward for this slot |
| `slots[].reward.fragmentTitanArtifact` | Object | Map of fragment IDs to amounts |
| `slots[].bought` | Number | Number of times this slot has been purchased |
| `slots[].cost` | Object | Cost object with coin type and amount |
| `slots[].cost.coin` | Object | Map of coin type IDs to amounts (as strings) |
| `slots[].amountAvailable` | Number/null | Available quantity (null = unlimited) |
| `slots[].staticShopMultiplePurchase` | Number | Whether bulk purchase is enabled (1 = enabled) |
| `availableUntil` | Number | Timestamp when shop expires (0 = never expires) |
| `level` | Number | Shop level requirement |
| `refreshTime` | Number | Timestamp when shop refreshes (0 = no refresh) |

---

### 3. stashClient (Client Event Tracking)

**Description:** Tracks client-side events such as button clicks and window interactions. This is typically called before and after the `shopBuy` request to log user interactions.

#### Example 1: Window Open and Close Events

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
              "actionTs": 1157286,
              "windowName": "shopBuyItemReward",
              "timestamp": 1762275428,
              "sessionNumber": 266,
              "windowCounter": 16,
              "assetsReloadNum": 0,
              "assetsType": "cache",
              "assetsLoadingPercent": 0,
              "assetsLoadingTime": 0
            }
          },
          {
            "type": ".client.window.close",
            "params": {
              "actionTs": 1157286,
              "windowName": "game.view.popup.shop.buy.BuyTitanArtifactItemPopup",
              "prevWindowName": "store:titanArtifactShop",
              "prevButtonName": "shop_item_buy",
              "prevActionName": ".client.button.click",
              "timestamp": 1762275428,
              "sessionNumber": 266,
              "windowCounter": 6,
              "assetsReloadNum": 0,
              "assetsType": "cache",
              "assetsLoadingPercent": 0,
              "assetsLoadingTime": 0
            }
          }
        ]
      },
      "context": {
        "actionTs": 1158602
      },
      "ident": "group_1_body"
    }
  ]
}
```

#### Example 2: Close Reward Window

**Request:**
```json
{
  "calls": [
    {
      "name": "stashClient",
      "args": {
        "data": [
          {
            "type": ".client.window.close",
            "params": {
              "actionTs": 1159030,
              "windowName": "shopBuyItemReward",
              "timestamp": 1762275430,
              "sessionNumber": 266,
              "windowCounter": 16,
              "assetsReloadNum": 0,
              "assetsType": "cache",
              "assetsLoadingPercent": 0,
              "assetsLoadingTime": 0
            }
          }
        ]
      },
      "context": {
        "actionTs": 1163596
      },
      "ident": "body"
    }
  ]
}
```

**Event Types:**

| Event Type | Description |
|------------|-------------|
| `.client.window.open` | Window opened event (e.g., reward popup) |
| `.client.window.close` | Window closed event (e.g., purchase popup, reward popup) |
| `.client.button.click` | Button click event |

**Response:**
```json
{
  "date": 1762275440.3711669,
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

The typical flow for purchasing from the Titan Artifact Shop is:

1. **Open Shop Window** - Client tracks window open event via `stashClient`
2. **Click Purchase Button** - Client tracks button click via `stashClient`
3. **Execute Purchase** - Send combined `shopBuy` and `shopGet` request with `stashClient` events
4. **Receive Rewards** - Response confirms purchase and provides quest updates
5. **Close Reward Window** - Client tracks reward window close via `stashClient`

**Example Flow Sequence:**

```
1. stashClient (.client.window.open) - Shop window opened
2. stashClient (.client.button.click) - Purchase button clicked
3. Combined API call:
   - shopBuy - Purchase transaction executed
   - shopGet - Shop inventory refreshed
   - stashClient - Window open/close events tracked
4. stashClient (.client.window.close) - Reward window closed
```

**Combined API Call Example:**

```json
{
  "calls": [
    {
      "name": "shopBuy",
      "args": {
        "shopId": 13,
        "slot": 24,
        "cost": {"coin": {"18": 12}},
        "reward": {"fragmentTitanArtifact": {"2005": 1}},
        "amount": 300
      },
      "context": {"actionTs": 1157278},
      "ident": "group_0_body"
    },
    {
      "name": "shopGet",
      "args": {"shopId": 13},
      "context": {"actionTs": 1157279},
      "ident": "group_0_shopGet"
    },
    {
      "name": "stashClient",
      "args": {
        "data": [
          {
            "type": ".client.window.open",
            "params": {
              "actionTs": 1157286,
              "windowName": "shopBuyItemReward",
              "timestamp": 1762275428,
              "sessionNumber": 266,
              "windowCounter": 16,
              "assetsReloadNum": 0,
              "assetsType": "cache",
              "assetsLoadingPercent": 0,
              "assetsLoadingTime": 0
            }
          },
          {
            "type": ".client.window.close",
            "params": {
              "actionTs": 1157286,
              "windowName": "game.view.popup.shop.buy.BuyTitanArtifactItemPopup",
              "prevWindowName": "store:titanArtifactShop",
              "prevButtonName": "shop_item_buy",
              "prevActionName": ".client.button.click",
              "timestamp": 1762275428,
              "sessionNumber": 266,
              "windowCounter": 6,
              "assetsReloadNum": 0,
              "assetsType": "cache",
              "assetsLoadingPercent": 0,
              "assetsLoadingTime": 0
            }
          }
        ]
      },
      "context": {"actionTs": 1158602},
      "ident": "group_1_body"
    }
  ]
}
```

---

## Error Handling

If a purchase fails, the API will return an error response. Common failure scenarios:

- **Insufficient funds**: Player doesn't have enough coins of the required type
- **Invalid slot**: The slot number doesn't exist or is out of range
- **Shop expired**: The shop instance (`shopId`) is no longer valid
- **Mismatched cost/reward**: The provided cost or reward doesn't match server expectations
- **Invalid amount**: The bulk purchase amount exceeds available quantity or limits

**Error Response Format:**
```json
{
  "date": 1762275434.3295,
  "results": [
    {
      "ident": "group_0_body",
      "result": {
        "error": "Error message description"
      }
    }
  ]
}
```

---

## Notes

- The `shopId` is fixed at `13` for the Titan Artifact Shop.
- The `slot` parameter typically ranges from 1-25, representing the 25 available shop slots.
- Quest updates are automatically included in the response if the purchase advances any active quests.
- The `actionTs` (action timestamp) should be generated client-side and represents the time of the user action in milliseconds.
- The `amount` parameter enables bulk purchases. When set, the purchase will buy multiple items at once (e.g., `amount: 300` purchases 300 fragments).
- Coin type `18` is the standard currency for this shop.
- All Titan Artifact fragment IDs are numeric identifiers:
  - `1001-1016`: Standard Titan Artifact fragments
  - `1017-1020`: Additional Titan Artifact fragments
  - `2001-2005`: Advanced Titan Artifact fragments
- The shop supports unlimited purchases (`amountAvailable: null`) and bulk purchases (`staticShopMultiplePurchase: 1`).
- The shop does not expire (`availableUntil: 0`) and does not refresh (`refreshTime: 0`).

---

## Related API Calls

The Titan Artifact Shop may be accessed through other shop-related APIs:

- Shop inventory/items are fetched through `shopGet`
- Shop refresh timers are managed server-side (currently set to 0 for this shop)
- Shop availability is determined by game state and player progress

---

**Last Updated:** Based on network traffic from November 4, 2025

