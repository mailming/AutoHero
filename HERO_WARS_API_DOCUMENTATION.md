# Hero Wars API Documentation

## Overview

This document provides comprehensive documentation for all API calls used in the HeroWarsHelper script. The API uses a unified request/response structure where multiple API calls can be batched in a single request.

**Base URL:** `https://heroes-wb.nextersglobal.com/api/`

**Protocol:** HTTPS

**Method:** POST

**Content-Type:** `application/json; charset=UTF-8`

---

## Send Function

The `Send` function is the primary method for making API calls. It accepts either a JSON string or a JavaScript object.

### Function Signature

```javascript
async function Send(json, pr)
```

### Parameters

- `json`: Either a JSON string or JavaScript object containing the API call structure
- `pr`: Optional parameter (unused in current implementation)

### Return Value

Returns a Promise that resolves to the API response object.

---

## Request Structure

All API requests follow this structure:

```json
{
  "calls": [
    {
      "name": "apiMethodName",
      "args": {
        // Method-specific arguments
      },
      "context": {
        "actionTs": 1234567890  // Timestamp in milliseconds (auto-added if missing)
      },
      "ident": "body"  // Identifier for response mapping
    }
  ]
}
```

### Request Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `calls` | Array | Yes | Array of API call objects |
| `name` | String | Yes | API method name (e.g., "userGetInfo", "shopGetAll") |
| `args` | Object | Yes | Method-specific arguments (can be empty `{}`) |
| `context` | Object | No | Context information (auto-added if missing) |
| `context.actionTs` | Number | No | Action timestamp in milliseconds |
| `ident` | String | Yes | Identifier used to map responses. Use "body" for single calls, or unique identifiers for multiple calls |

### Request Examples

**Single API Call (String Format):**
```javascript
const response = await Send('{"calls":[{"name":"userGetInfo","args":{},"ident":"body"}]}');
```

**Single API Call (Object Format):**
```javascript
const response = await Send({ calls: [{ name: 'userGetInfo', args: {}, ident: 'body' }] });
```

**Multiple API Calls:**
```javascript
const response = await Send({
  calls: [
    { name: 'userGetInfo', args: {}, ident: 'userGetInfo' },
    { name: 'inventoryGet', args: {}, ident: 'inventoryGet' },
    { name: 'shopGetAll', args: {}, ident: 'shopGetAll' }
  ]
});
```

**API Call with Arguments:**
```javascript
const response = await Send({
  calls: [{
    name: 'consumableUseLootBox',
    args: {
      libId: 148,
      amount: 1
    },
    ident: 'body'
  }]
});
```

**API Call with Context:**
```javascript
const response = await Send(JSON.stringify({
  calls: [{
    name: 'userGetInfo',
    args: {},
    context: {
      actionTs: Date.now()
    },
    ident: 'body'
  }]
}));
```

---

## Response Structure

All API responses follow this structure:

```json
{
  "results": [
    {
      "ident": "body",
      "result": {
        "response": {
          // Method-specific response data
        },
        // Additional fields may be present (e.g., "error", "sideEffects", etc.)
      }
    }
  ],
  "error": null  // Present if there was an error
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `results` | Array | Array of result objects, one per API call |
| `results[].ident` | String | Matches the `ident` from the request |
| `results[].result` | Object | Contains the actual result data |
| `results[].result.response` | Any | The actual response data (structure varies by API method) |
| `error` | Object/null | Error object if request failed |

### Response Examples

**Single Call Response:**
```javascript
const response = await Send('{"calls":[{"name":"userGetInfo","args":{},"ident":"body"}]}');
const userInfo = response.results[0].result.response;
```

**Multiple Calls Response:**
```javascript
const response = await Send({
  calls: [
    { name: 'userGetInfo', args: {}, ident: 'userGetInfo' },
    { name: 'inventoryGet', args: {}, ident: 'inventoryGet' }
  ]
});

const userInfo = response.results[0].result.response;  // First call result
const inventory = response.results[1].result.response; // Second call result
```

**Using .map() for Multiple Results:**
```javascript
const result = await Send('{"calls":[{"name":"inventoryGet","args":{},"ident":"inventoryGet"},{"name":"shopGetAll","args":{},"ident":"shopGetAll"}]}')
  .then(e => e.results.map(n => n.result.response));

const inv = result[0];
const shops = result[1];
```

**Error Handling:**
```javascript
const response = await Send({ calls: [...] });

if (response.error) {
  console.error('API Error:', response.error);
  throw new Error(`API error: ${response.error.name} - ${response.error.description}`);
}
```

---

## API Methods

### User Information

#### userGetInfo

Get comprehensive user information including stats, resources, arena status, etc.

**Request:**
```javascript
Send('{"calls":[{"name":"userGetInfo","args":{},"ident":"body"}]}')
```

**Response Structure:**
```javascript
{
  userId: string,
  name: string,
  level: string,
  gold: number,
  starMoney: number,
  refillable: [
    {
      id: number,        // Resource type ID
      amount: number,    // Current amount
      lastRefill: number,
      boughtToday: number
    }
  ],
  arenaPlace: number,   // Current arena rank
  grandPlace: number,   // Current grand arena rank
  // ... many more fields
}
```

**Refillable Resource IDs:**
- `id: 1` - Stamina/Energy
- `id: 6` - **Arena attempts available** (number of remaining arena battle attempts)
- `id: 21` - **Grand Arena attempts available** (number of remaining grand arena battle attempts)
- Other IDs represent various game resources

**Note:** Arena attempts are stored in the `refillable` array with `id: 6`. Grand Arena attempts are stored with `id: 21`. The `amount` field indicates how many battle attempts are currently available for each respective arena type.

**Example Usage:**
```javascript
const userInfo = await Send('{"calls":[{"name":"userGetInfo","args":{},"ident":"body"}]}')
  .then(e => e.results[0].result.response);

console.log(`Gold: ${userInfo.gold}`);
console.log(`Arena rank: ${userInfo.arenaPlace}`);
console.log(`Grand Arena rank: ${userInfo.grandPlace}`);

// Get arena attempts
const arenaAttempts = userInfo.refillable.find(r => r.id === 6);
if (arenaAttempts) {
  console.log(`Arena attempts available: ${arenaAttempts.amount}`);
}

// Get Grand Arena attempts
const grandArenaAttempts = userInfo.refillable.find(r => r.id === 21);
if (grandArenaAttempts) {
  console.log(`Grand Arena attempts available: ${grandArenaAttempts.amount}`);
}
```

---

### Inventory

#### inventoryGet

Get all inventory items including consumables, gear, fragments, etc.

**Request:**
```javascript
Send('{"calls":[{"name":"inventoryGet","args":{},"ident":"inventoryGet"}]}')
```

**Response Structure:**
```javascript
{
  consumable: {
    [libId]: amount,  // e.g., { "148": 5 } = 5 platinum loot boxes
  },
  gear: {
    [itemId]: amount,
  },
  scroll: {
    [itemId]: amount,
  },
  fragmentGear: {
    [itemId]: amount,
  },
  fragmentScroll: {
    [itemId]: amount,
  },
  // ... other item types
}
```

**Example Usage:**
```javascript
const inventory = await Send('{"calls":[{"name":"inventoryGet","args":{},"ident":"inventoryGet"}]}')
  .then(e => e.results[0].result.response);

const lootBoxes = inventory.consumable[148] || 0;
console.log(`Platinum loot boxes: ${lootBoxes}`);
```

#### consumableUseLootBox

Open a loot box consumable item.

**Request:**
```javascript
Send('{"calls":[{"name":"consumableUseLootBox","args":{"libId":148,"amount":1},"ident":"body"}]}')
```

**Arguments:**
- `libId` (number): The library ID of the loot box (e.g., 144 = copper, 145 = bronze, 148 = platinum)
- `amount` (number): Number of loot boxes to open

**Response Structure:**
```javascript
{
  [rewardType]: {
    [itemId]: amount
  }
  // e.g., { "stamina": 100 } or { "coin": { "39": 500 } }
}
```

**Example Usage:**
```javascript
const response = await Send('{"calls":[{"name":"consumableUseLootBox","args":{"libId":148,"amount":1},"ident":"body"}]}')
  .then(e => e.results[0].result.response);

const result = Object.values(response).pop();
if ('stamina' in result) {
  console.log(`Received ${result.stamina} stamina`);
}
```

---

### Heroes and Titans

#### heroGetAll

Get all hero information.

**Request:**
```javascript
Send('{"calls":[{"name":"heroGetAll","args":{},"ident":"body"}]}')
```

**Response Structure:**
```javascript
{
  [heroId]: {
    id: number,
    level: number,
    stars: number,
    power: number,
    // ... hero stats
  }
}
```

**Example Usage:**
```javascript
const heroes = await Send('{"calls":[{"name":"heroGetAll","args":{},"ident":"body"}]}')
  .then(e => e.results[0].result.response);

const heroList = Object.values(heroes);
console.log(`Total heroes: ${heroList.length}`);
```

#### titanGetAll

Get all titan information.

**Request:**
```javascript
Send('{"calls":[{"name":"titanGetAll","args":{},"ident":"body"}]}')
```

**Response Structure:**
```javascript
{
  [titanId]: {
    id: number,
    level: number,
    stars: number,
    power: number,
    // ... titan stats
  }
}
```

---

### Teams

#### teamGetAll

Get all team configurations.

**Request:**
```javascript
Send('{"calls":[{"name":"teamGetAll","args":{},"ident":"teamGetAll"}]}')
```

**Response Structure:**
```javascript
{
  [teamId]: {
    id: number,
    heroes: [heroId1, heroId2, ...],
    pets: [petId1, ...],  // For grand arena
    pet: petId,           // For regular arena
    favor: favorId,
    banners: [bannerId1, ...]
  }
}
```

**Example Usage:**
```javascript
const teams = await Send('{"calls":[{"name":"teamGetAll","args":{},"ident":"teamGetAll"}]}')
  .then(e => e.results[0].result.response);

const team1 = teams[1];
console.log(`Team 1 heroes: ${team1.heroes.join(', ')}`);
```

#### teamGetFavor

Get favor information for teams.

**Request:**
```javascript
Send('{"calls":[{"name":"teamGetFavor","args":{},"ident":"teamGetFavor"}]}')
```

#### teamGetMaxUpgrade

Get maximum upgrade information for teams.

**Request:**
```javascript
Send('{"calls":[{"name":"teamGetMaxUpgrade","args":{},"ident":"teamGetMaxUpgrade"}]}')
```

---

### Shops

#### shopGetAll

Get all shop information including available items and prices.

**Request:**
```javascript
Send('{"calls":[{"name":"shopGetAll","args":{},"ident":"shopGetAll"}]}')
```

**Response Structure:**
```javascript
{
  [shopId]: {
    id: number,
    slots: {
      [slotId]: {
        id: number,
        cost: {
          [currencyType]: {
            [currencyId]: amount
          }
        },
        reward: {
          [rewardType]: {
            [itemId]: amount
          }
        },
        bought: boolean
      }
    }
  }
}
```

**Example Usage:**
```javascript
const shops = await Send('{"calls":[{"name":"shopGetAll","args":{},"ident":"shopGetAll"}]}')
  .then(e => e.results[0].result.response);

const shop17 = shops[17];
const slots = Object.values(shop17.slots);
const availableSlots = slots.filter(slot => !slot.bought);
```

#### shopBuy

Purchase an item from a shop.

**Request:**
```javascript
Send(JSON.stringify({
  calls: [{
    name: "shopBuy",
    args: {
      shopId: 17,
      slot: 1,
      cost: {
        gold: 10000
      },
      reward: {
        fragmentHero: {
          "123": 5
        }
      }
    },
    ident: "body"
  }]
}))
```

**Arguments:**
- `shopId` (number): Shop identifier
- `slot` (number): Slot identifier within the shop
- `cost` (object): Cost structure matching the shop slot's cost
- `reward` (object): Reward structure matching the shop slot's reward

**Example Usage:**
```javascript
const calls = [];
for (const slot of availableSlots) {
  calls.push({
    name: "shopBuy",
    args: {
      shopId: shop.id,
      slot: slot.id,
      cost: slot.cost,
      reward: slot.reward
    },
    ident: `shopBuy_${shop.id}_${slot.id}`
  });
}

const result = await Send(JSON.stringify({ calls }))
  .then(e => e.results.map(n => n.result.response));
```

---

### Quests

#### questGetAll

Get all quest information.

**Request:**
```javascript
Send('{"calls":[{"name":"questGetAll","args":{},"ident":"questGetAll"}]}')
```

**Response Structure:**
```javascript
[
  {
    id: number,
    progress: number,
    state: number,  // 0 = not started, 1 = in progress, 2 = completed
    // ... quest details
  }
]
```

**Example Usage:**
```javascript
const quests = await Send('{"calls":[{"name":"questGetAll","args":{},"ident":"questGetAll"}]}')
  .then(e => e.results[0].result.response);

const completedQuests = quests.filter(q => q.state === 2);
```

---

### Arena

#### arenaAttack

Attack a rival in regular arena.

**Request:**
```javascript
Send(JSON.stringify({
  calls: [{
    name: "arenaAttack",
    args: {
      userId: rivalId,
      heroes: [heroId1, heroId2, heroId3, heroId4, heroId5],
      pet: petId,
      favor: favorId,
      banners: [bannerId1, ...]
    },
    context: {
      actionTs: Date.now()
    },
    ident: "body"
  }]
}))
```

**Arguments:**
- `userId` (number): Target user ID
- `heroes` (array): Array of 5 hero IDs
- `pet` (number): Pet ID
- `favor` (number): Favor ID
- `banners` (array): Array of banner IDs

#### grandAttack

Attack a rival in grand arena.

**Request:**
```javascript
Send(JSON.stringify({
  calls: [{
    name: "grandAttack",
    args: {
      userId: rivalId,
      heroes: [heroId1, heroId2, heroId3, heroId4, heroId5],
      pets: [petId1, petId2, petId3],  // Note: plural "pets" for grand arena
      favor: favorId,
      banners: [bannerId1, ...]
    },
    context: {
      actionTs: Date.now()
    },
    ident: "body"
  }]
}))
```

**Arguments:**
- `userId` (number): Target user ID
- `heroes` (array): Array of 5 hero IDs
- `pets` (array): Array of 3 pet IDs (plural for grand arena)
- `favor` (number): Favor ID
- `banners` (array): Array of banner IDs

---

### Guild War

#### guildWar_attackSlot

Attack a slot in Guild War. **Note:** This is an alternative API name. The primary Guild War APIs use the `clanWar` prefix (e.g., `clanWarAttack`).

**Request:**
```javascript
Send(JSON.stringify({
  calls: [{
    name: "guildWar_attackSlot",
    args: {
      slotId: 1,
      team: {
        heroes: [heroId1, heroId2, heroId3, heroId4, heroId5],
        pet: petId,  // For hero battles
        pets: [petId1, petId2, petId3],  // For titan battles
        favor: favorId,
        banners: [bannerId1, ...]
      }
    },
    context: {
      actionTs: Date.now()
    },
    ident: "body"
  }]
}))
```

**Arguments:**
- `slotId` (number): Slot number to attack (1-9)
- `team` (object): Team configuration
  - For hero battles (slots 1-7): Use `pet` (singular)
  - For titan battles (slots 8-9): Use `pets` (plural array)

---

### Dungeon

#### dungeonGetInfo

Get dungeon information.

**Request:**
```javascript
Send(JSON.stringify({
  calls: [{
    name: "dungeonGetInfo",
    args: {},
    ident: "dungeonGetInfo"
  }]
}))
```

#### dungeonStartBattle

Start a dungeon battle.

**Request:**
```javascript
Send(JSON.stringify({
  calls: [{
    name: "dungeonStartBattle",
    args: {
      // Battle-specific arguments
    },
    ident: "body"
  }]
}))
```

#### dungeonEndBattle

End a dungeon battle.

**Request:**
```javascript
Send(JSON.stringify({
  calls: [{
    name: "dungeonEndBattle",
    args: {
      result: {},
      progress: {}
    },
    ident: "body"
  }]
}))
```

#### dungeonSaveProgress

Save dungeon progress.

**Request:**
```javascript
Send(JSON.stringify({
  calls: [{
    name: "dungeonSaveProgress",
    args: {},
    ident: "body"
  }]
}))
```

---

### Tower

#### towerGetInfo

Get tower information.

**Request:**
```javascript
Send(JSON.stringify({
  calls: [{
    name: "towerGetInfo",
    args: {},
    ident: "towerGetInfo"
  }]
}))
```

#### towerStartBattle

Start a tower battle.

**Request:**
```javascript
Send(JSON.stringify({
  calls: [{
    name: "towerStartBattle",
    args: {},
    ident: "body"
  }]
}))
```

#### towerEndBattle

End a tower battle.

**Request:**
```javascript
Send(JSON.stringify({
  calls: [{
    name: "towerEndBattle",
    args: {
      result: {},
      progress: {}
    },
    ident: "body"
  }]
}))
```

#### towerNextFloor

Move to the next floor in the tower.

**Request:**
```javascript
Send(JSON.stringify({
  calls: [{
    name: "towerNextFloor",
    args: {},
    ident: "body"
  }]
}))
```

#### towerOpenChest

Open a chest in the tower.

**Request:**
```javascript
Send(JSON.stringify({
  calls: [{
    name: "towerOpenChest",
    args: {
      floorNumber: 10
    },
    ident: "body"
  }]
}))
```

#### towerSkipFloor

Skip a floor in the tower.

**Request:**
```javascript
Send(JSON.stringify({
  calls: [{
    name: "towerSkipFloor",
    args: {},
    ident: "body"
  }]
}))
```

#### towerBuyBuff

Buy a buff in the tower.

**Request:**
```javascript
Send(JSON.stringify({
  calls: [{
    name: "towerBuyBuff",
    args: {
      buffId: 1
    },
    ident: "body"
  }]
}))
```

#### tower_farmPointRewards

Farm point rewards from tower.

**Request:**
```javascript
Send(JSON.stringify({
  calls: [{
    name: "tower_farmPointRewards",
    args: {},
    ident: "body"
  }]
}))
```

#### tower_farmSkullReward

Farm skull rewards from tower.

**Request:**
```javascript
Send(JSON.stringify({
  calls: [{
    name: "tower_farmSkullReward",
    args: {},
    ident: "body"
  }]
}))
```

---

### Titan Arena

#### titanArenaGetStatus

Get titan arena status.

**Request:**
```javascript
Send(JSON.stringify({
  calls: [{
    name: "titanArenaGetStatus",
    args: {},
    ident: "titanArenaGetStatus"
  }]
}))
```

#### titanArenaCompleteTier

Complete a tier in titan arena.

**Request:**
```javascript
Send(JSON.stringify({
  calls: [{
    name: "titanArenaCompleteTier",
    args: {},
    ident: "body"
  }]
}))
```

#### titanArenaStartBattle

Start a titan arena battle.

**Request:**
```javascript
Send(JSON.stringify({
  calls: [{
    name: "titanArenaStartBattle",
    args: {
      rivalId: userId
    },
    ident: "body"
  }]
}))
```

#### titanArenaEndBattle

End a titan arena battle.

**Request:**
```javascript
Send(JSON.stringify({
  calls: [{
    name: "titanArenaEndBattle",
    args: {
      result: {},
      progress: {}
    },
    ident: "body"
  }]
}))
```

#### titanArenaStartRaid

Start a titan arena raid.

**Request:**
```javascript
Send(JSON.stringify({
  calls: [{
    name: "titanArenaStartRaid",
    args: {},
    ident: "body"
  }]
}))
```

#### titanArenaEndRaid

End a titan arena raid.

**Request:**
```javascript
Send(JSON.stringify({
  calls: [{
    name: "titanArenaEndRaid",
    args: {
      results: []
    },
    ident: "body"
  }]
}))
```

#### titanArenaFarmDailyReward

Farm daily rewards from titan arena.

**Request:**
```javascript
Send(JSON.stringify({
  calls: [{
    name: "titanArenaFarmDailyReward",
    args: {},
    ident: "body"
  }]
}))
```

---

### Adventure

#### adventure_getInfo

Get adventure information.

**Request:**
```javascript
Send(JSON.stringify({
  calls: [{
    name: "adventure_getInfo",
    args: {},
    ident: "adventure_getInfo"
  }]
}))
```

#### adventure_turnStartBattle

Start a battle in adventure.

**Request:**
```javascript
Send(JSON.stringify({
  calls: [{
    name: "adventure_turnStartBattle",
    args: {},
    ident: "body"
  }]
}))
```

#### adventure_endBattle

End a battle in adventure.

**Request:**
```javascript
Send(JSON.stringify({
  calls: [{
    name: "adventure_endBattle",
    args: {
      result: {},
      progress: {}
    },
    ident: "body"
  }]
}))
```

#### adventure_turnCollectBuff

Collect a buff in adventure.

**Request:**
```javascript
Send(JSON.stringify({
  calls: [{
    name: "adventure_turnCollectBuff",
    args: {
      buffId: 1
    },
    ident: "body"
  }]
}))
```

#### adventureSolo_getInfo

Get solo adventure information.

**Request:**
```javascript
Send(JSON.stringify({
  calls: [{
    name: "adventureSolo_getInfo",
    args: {},
    ident: "adventureSolo_getInfo"
  }]
}))
```

#### adventureSolo_turnStartBattle

Start a battle in solo adventure.

**Request:**
```javascript
Send(JSON.stringify({
  calls: [{
    name: "adventureSolo_turnStartBattle",
    args: {},
    ident: "body"
  }]
}))
```

#### adventureSolo_endBattle

End a battle in solo adventure.

**Request:**
```javascript
Send(JSON.stringify({
  calls: [{
    name: "adventureSolo_endBattle",
    args: {
      result: {},
      progress: {}
    },
    ident: "body"
  }]
}))
```

#### adventureSolo_turnCollectBuff

Collect a buff in solo adventure.

**Request:**
```javascript
Send(JSON.stringify({
  calls: [{
    name: "adventureSolo_turnCollectBuff",
    args: {
      buffId: 1
    },
    ident: "body"
  }]
}))
```

---

### Brawls

#### brawl_questGetInfo

Get brawl quest information.

**Request:**
```javascript
Send(JSON.stringify({
  calls: [{
    name: "brawl_questGetInfo",
    args: {},
    ident: "brawl_questGetInfo"
  }]
}))
```

#### brawl_findEnemies

Find enemies in brawls.

**Request:**
```javascript
Send(JSON.stringify({
  calls: [{
    name: "brawl_findEnemies",
    args: {},
    ident: "brawl_findEnemies"
  }]
}))
```

#### brawl_questFarm

Farm brawl quest rewards.

**Request:**
```javascript
Send(JSON.stringify({
  calls: [{
    name: "brawl_questFarm",
    args: {},
    ident: "brawl_questFarm"
  }]
}))
```

#### brawl_getInfo

Get brawl information.

**Request:**
```javascript
Send(JSON.stringify({
  calls: [{
    name: "brawl_getInfo",
    args: {},
    ident: "brawl_getInfo"
  }]
}))
```

---

### Epic Brawl

#### epicBrawl_endBattle

End an epic brawl battle.

**Request:**
```javascript
Send(JSON.stringify({
  calls: [{
    name: "epicBrawl_endBattle",
    args: {
      progress: {},
      result: {}
    },
    ident: "epicBrawl_endBattle"
  }]
}))
```

#### epicBrawl_getWinStreak

Get epic brawl win streak information.

**Request:**
```javascript
Send(JSON.stringify({
  calls: [{
    name: "epicBrawl_getWinStreak",
    args: {},
    ident: "epicBrawl_getWinStreak"
  }]
}))
```

#### epicBrawl_farmWinStreak

Farm epic brawl win streak rewards.

**Request:**
```javascript
Send('{"calls":[{"name":"epicBrawl_farmWinStreak","args":{},"ident":"body"}]}')
```

---

### Boss/Outland

#### bossGetAll

Get all Outland boss information.

**Request:**
```javascript
Send('{"calls":[{"name":"bossGetAll","args":{},"ident":"bossGetAll"}]}')
```

#### topGet

Get top rankings.

**Request:**
```javascript
Send(JSON.stringify({
  calls: [{
    name: "topGet",
    args: {
      type: "bossRatingTop",
      extraId: 0
    },
    ident: "body"
  }]
}))
```

**Arguments:**
- `type` (string): Type of top list (e.g., "bossRatingTop")
- `extraId` (number): Additional identifier

---

### Clan

#### clanGetInfo

Get clan information.

**Request:**
```javascript
Send('{"calls":[{"name":"clanGetInfo","args":{},"ident":"clanGetInfo"}]}')
```

**Response Structure:**
```javascript
{
  stat: {
    todayItemsActivity: number,
    // ... other clan stats
  },
  // ... other clan data
}
```

#### clanItemsForActivity

Exchange items for clan activity.

**Request:**
```javascript
Send(JSON.stringify({
  calls: [{
    name: "clanItemsForActivity",
    args: {
      items: {
        [itemType]: {
          [itemId]: count
        }
      }
    },
    ident: "body"
  }]
}))
```

**Example:**
```javascript
Send(JSON.stringify({
  calls: [{
    name: "clanItemsForActivity",
    args: {
      items: {
        gear: {
          "123": 100
        }
      }
    },
    ident: "body"
  }]
}))
```

---

### Missions

#### missionGetAll

Get all mission information.

**Request:**
```javascript
Send('{"calls":[{"name":"missionGetAll","args":{},"ident":"missionGetAll"}]}')
```

---

### Mail

#### mailGetAll

Get all mail/letters.

**Request:**
```javascript
Send(JSON.stringify({
  calls: [{
    name: "mailGetAll",
    args: {},
    ident: "mailGetAll"
  }]
}))
```

**Response Structure:**
```javascript
{
  letters: {
    [letterId]: {
      id: number,
      reward: {},
      // ... letter data
    }
  }
}
```

#### mailCollect

Collect mail rewards.

**Request:**
```javascript
Send(JSON.stringify({
  calls: [
    {
      name: "mailCollect",
      args: {
        letterIds: [letterId1, letterId2, ...]
      },
      ident: "body"
    }
  ]
}))
```

---

### Special Offers

#### specialOffer_getAll

Get all special offers.

**Request:**
```javascript
Send('{"calls":[{"name":"specialOffer_getAll","args":{},"ident":"specialOffer_getAll"}]}')
```

#### specialOffer_farmReward

Farm a special offer reward.

**Request:**
```javascript
Send(JSON.stringify({
  calls: [{
    name: "specialOffer_farmReward",
    args: {
      offerId: offerId
    },
    ident: "body"
  }]
}))
```

---

### Battle Pass

#### battlePass_getInfo

Get battle pass information.

**Request:**
```javascript
Send(JSON.stringify({
  calls: [{
    name: "battlePass_getInfo",
    args: {},
    ident: "battlePass_getInfo"
  }]
}))
```

#### battlePass_getSpecial

Get special battle pass information.

**Request:**
```javascript
Send(JSON.stringify({
  calls: [{
    name: "battlePass_getSpecial",
    args: {},
    ident: "battlePass_getSpecial"
  }]
}))
```

---

### Artifacts and Skins

#### artifactChestOpen

Open an artifact chest.

**Request:**
```javascript
Send(JSON.stringify({
  calls: [{
    name: "artifactChestOpen",
    args: {
      // Arguments vary
    },
    ident: "body"
  }]
}))
```

#### ascensionChest_open

Open an ascension chest.

**Request:**
```javascript
Send({
  calls: [{
    name: "ascensionChest_open",
    args: {
      paid: false,
      amount: 1
    },
    ident: "body"
  }]
})
```

**Arguments:**
- `paid` (boolean): Whether to use paid currency
- `amount` (number): Number of chests to open

---

### Events and Gifts

#### newYearGiftGet

Get new year gift information.

**Request:**
```javascript
Send({
  calls: [{
    name: "newYearGiftGet",
    args: {
      type: 0
    },
    ident: "body"
  }]
})
```

#### newYearGiftOpen

Open a new year gift.

**Request:**
```javascript
Send({
  calls: [{
    name: "newYearGiftOpen",
    args: {
      giftId: giftId
    },
    ident: "body"
  }]
})
```

---

### Expeditions

#### expeditionGet

Get expedition information.

**Request:**
```javascript
Send(JSON.stringify({
  calls: [{
    name: "expeditionGet",
    args: {},
    ident: "expeditionGet"
  }]
}))
```

#### expeditionFarm

Farm expedition rewards.

**Request:**
```javascript
Send(JSON.stringify({
  calls: [{
    name: "expeditionFarm",
    args: {},
    ident: "body"
  }]
}))
```

#### expeditionSendHeroes

Send heroes on an expedition.

**Request:**
```javascript
Send(JSON.stringify({
  calls: [{
    name: "expeditionSendHeroes",
    args: {
      heroes: [heroId1, heroId2, ...]
    },
    ident: "body"
  }]
}))
```

---

### Time

#### getTime

Get server time.

**Request:**
```javascript
Send('{"calls":[{"name":"getTime","args":{},"ident":"getTime"}]}')
```

---

### Gacha

#### gacha_refill

Refill gacha.

**Request:**
```javascript
Send('{"calls":[{"name":"gacha_refill","args":{"ident":"heroGacha"},"ident":"gacha_refill"}]}')
```

---

### Subscription and Daily Rewards

#### subscriptionFarm

Farm subscription rewards.

**Request:**
```javascript
Send('{"calls":[{"name":"subscriptionFarm","args":{},"ident":"body"}]}')
```

#### zeppelinGiftFarm

Farm zeppelin gift rewards.

**Request:**
```javascript
Send('{"calls":[{"name":"zeppelinGiftFarm","args":{},"ident":"zeppelinGiftFarm"}]}')
```

#### grandFarmCoins

Farm grand coins.

**Request:**
```javascript
Send('{"calls":[{"name":"grandFarmCoins","args":{},"ident":"grandFarmCoins"}]}')
```

---

### Hero Talents

#### heroTalent_getReward

Get hero talent reward.

**Request:**
```javascript
Send(JSON.stringify({
  calls: [{
    name: "heroTalent_getReward",
    args: {
      talentType: "tmntDungeonTalent",
      reroll: false
    },
    ident: "body"
  }]
}))
```

#### heroTalent_farmReward

Farm hero talent reward.

**Request:**
```javascript
Send(JSON.stringify({
  calls: [{
    name: "heroTalent_farmReward",
    args: {
      talentType: "tmntDungeonTalent"
    },
    ident: "body"
  }]
}))
```

---

## Common Patterns

### Batching Multiple Calls

When you need data from multiple APIs, batch them in a single request:

```javascript
const [userInfo, inventory, shops] = await Send({
  calls: [
    { name: 'userGetInfo', args: {}, ident: 'userGetInfo' },
    { name: 'inventoryGet', args: {}, ident: 'inventoryGet' },
    { name: 'shopGetAll', args: {}, ident: 'shopGetAll' }
  ]
}).then(e => e.results.map(r => r.result.response));
```

### Error Handling

Always check for errors:

```javascript
const response = await Send({ calls: [...] });

if (response.error) {
  console.error('API Error:', response.error);
  throw new Error(`API error: ${response.error.name} - ${response.error.description}`);
}

if (!response.results || !response.results[0] || !response.results[0].result) {
  throw new Error('Invalid response format');
}
```

### Using Caller Class

The `Caller` class provides a cleaner interface:

```javascript
const caller = new Caller(['userGetInfo', 'inventoryGet']);
await caller.send();
const userInfo = caller.result('userGetInfo');
const inventory = caller.result('inventoryGet');
```

### Dynamic Call Building

Build calls dynamically based on conditions:

```javascript
const calls = [];
for (const slot of availableSlots) {
  if (!slot.bought && canAfford(slot)) {
    calls.push({
      name: "shopBuy",
      args: {
        shopId: shop.id,
        slot: slot.id,
        cost: slot.cost,
        reward: slot.reward
      },
      ident: `shopBuy_${shop.id}_${slot.id}`
    });
  }
}

if (calls.length > 0) {
  const results = await Send(JSON.stringify({ calls }))
    .then(e => e.results.map(n => n.result.response));
}
```

---

## Notes

1. **Timestamps**: The `context.actionTs` field is automatically added if missing, using `Math.floor(performance.now())`.

2. **Identifiers**: For single calls, use `"body"` as the ident. For multiple calls, use unique identifiers to map responses correctly.

3. **Response Mapping**: Responses are returned in the same order as requests, but use the `ident` field to reliably map responses.

4. **Error Responses**: Always check for `response.error` before accessing `response.results`.

5. **String vs Object**: The `Send` function accepts both JSON strings and JavaScript objects. Objects are automatically stringified.

6. **Authentication**: All requests use authentication headers captured from previous intercepted requests. The `Send` function automatically handles header management including signature calculation.

---

## Specialized API Documentation

The following sections provide detailed documentation for specialized game modes and features.

---

## Arena API

### Overview

The Arena API provides functionality for regular arena battles, including finding opponents, checking target availability, and executing attacks.

### Endpoints

#### arenaFindEnemies

**Description:** Retrieves a list of available opponents in the arena.

**Request:**
```javascript
Send({
  calls: [{
    name: "arenaFindEnemies",
    args: {},
    context: { actionTs: Date.now() },
    ident: "body"
  }]
})
```

**Response Structure:**
```javascript
{
  results: [{
    ident: "body",
    result: {
      response: [
        {
          userId: "60332840",
          place: "11",
          heroes: [/* hero objects */],
          power: "1048578",
          banners: [/* banner configs */],
          user: {/* user info */}
        }
      ]
    }
  }]
}
```

#### arenaAttack

**Description:** Initiates an attack against an opponent in regular arena.

**Request:**
```javascript
Send({
  calls: [{
    name: "arenaAttack",
    args: {
      userId: 60332840,
      heroes: [57, 31, 55, 40, 16],
      pet: 6008,
      favor: {
        "16": 6004,
        "31": 6006,
        "55": 6001,
        "57": 6003
      },
      banners: [6]
    },
    context: { actionTs: Date.now() },
    ident: "body"
  }]
})
```

**Request Parameters:**
- `userId` (number): Target opponent's user ID
- `heroes` (array): Array of 5 hero IDs
- `pet` (number): Pet ID to use in battle
- `favor` (object): Favor pet assignments (hero ID → pet ID mapping)
- `banners` (array): Banner IDs to use in battle

**Response:** Includes detailed battle information, battle results, updated arena state, and available enemies.

#### arenaCheckTargetRange

**Description:** Validates if target opponents are still in valid attack range.

**Request:**
```javascript
Send({
  calls: [{
    name: "arenaCheckTargetRange",
    args: {
      ids: ["47308606", "40990396", "35449277"]
    },
    context: { actionTs: Date.now() },
    ident: "body"
  }]
})
```

**Response:** Returns an object mapping user IDs to boolean values indicating if they're attackable.

---

## Grand Arena API

### Overview

The Grand Arena API provides functionality for Grand Arena battles, which use 3 teams instead of 1.

### Key Differences from Regular Arena

1. **Multiple Teams**: Grand Arena uses 3 teams instead of 1
2. **Team Structure**: Heroes are organized in arrays of arrays (3 teams)
3. **Pet Assignment**: Each team has its own pet configuration
4. **Banner Configuration**: Each team can have different banners

### Endpoints

#### grandFindEnemies

**Description:** Finds available opponents in Grand Arena.

**Request:**
```javascript
Send({
  calls: [{
    name: "grandFindEnemies",
    args: {},
    context: { actionTs: Date.now() },
    ident: "body"
  }]
})
```

**Response:** Returns array of opponents with their 3 teams configured.

#### grandAttack

**Description:** Initiates a Grand Arena battle against an opponent.

**Request:**
```javascript
Send({
  calls: [{
    name: "grandAttack",
    args: {
      userId: 47308606,
      heroes: [
        [58, 1, 64, 13, 55],  // Team 1
        [42, 56, 9, 62, 43],  // Team 2
        [16, 31, 57, 40, 48]  // Team 3
      ],
      pets: [6006, 6005, 6004],  // Pet for each team
      favor: {
        "1": 6002,
        "9": 6005,
        // ... more favor assignments
      },
      banners: [1, 6, 2]  // Banner for each team
    },
    context: { actionTs: Date.now() },
    ident: "body"
  }]
})
```

**Request Parameters:**
- `userId` (number): Target opponent's user ID
- `heroes` (array): Array of 3 hero teams (each team is an array of 5 hero IDs)
- `pets` (array): Array of 3 pet IDs (one for each team)
- `favor` (object): Favor pet assignments across all teams
- `banners` (array): Array of 3 banner IDs (one for each team)

#### grandCheckTargetRange

**Description:** Checks if specific opponents are still available for attack.

**Request:**
```javascript
Send({
  calls: [{
    name: "grandCheckTargetRange",
    args: {
      ids: ["48705148", "35986432", "47308606"]
    },
    context: { actionTs: Date.now() },
    ident: "body"
  }]
})
```

---

## Guild War API

### Overview

Guild War (API uses `clanWar` prefix) is a clan-based PvP system where clans compete against each other by attacking defensive slots. The system involves multiple API calls for getting war information, defense data, and executing attacks.

**Note:** The API endpoints use the `clanWar` prefix (e.g., `clanWarGetInfo`, `clanWarAttack`), but this refers to the **Guild War** game mode.

### Endpoints

#### clanWarGetInfo / clanWarGetDefence

**Description:** Retrieves current Guild War information including available slots and team data. These calls are typically combined in a single request.

**Request:**
```javascript
Send({
  calls: [
    {
      name: "clanWarGetDefence",
      args: {},
      context: { actionTs: Date.now() },
      ident: "body"
    },
    {
      name: "clanWarGetInfo",
      args: {},
      context: { actionTs: Date.now() },
      ident: "clanWarGetInfo"
    }
  ]
})
```

**Response Fields:**
- `slots`: Map of slot IDs (1-40) to defending player IDs
- `teams`: Team configurations for different players
  - `clanDefence_heroes`: Hero defense team for Guild War (for slots 1-20)
  - `clanDefence_titans`: Titan defense team for Guild War (for slots 21-40)

#### clanWarAttack

**Description:** Executes an attack against a specific Guild War slot. Can be used for both hero battles (slots 1-20) and titan battles (slots 21-40).

**Request (Hero Battle):**
```javascript
Send({
  calls: [{
    name: "clanWarAttack",
    args: {
      slotId: 1,
      heroes: [46, 9, 40, 16, 65],
      pet: 6004,
      favor: {
        "9": 6006,
        "16": 6004
      },
      banner: 1
    },
    context: { actionTs: Date.now() },
    ident: "body"
  }]
})
```

**Request (Titan Battle):**
```javascript
Send({
  calls: [{
    name: "clanWarAttack",
    args: {
      slotId: 8,
      heroes: [4033, 4003, 4001, 4032, 4000],  // Titan IDs
      favor: {}
    },
    context: { actionTs: Date.now() },
    ident: "body"
  }]
})
```

**Request Parameters:**
- `slotId` (number): Target slot ID to attack (1-40, 1-20 for heroes, 21-40 for titans)
- `heroes` (array): Array of 5 unit IDs (hero IDs for slots 1-20, titan IDs for slots 21-40)
- `pet` (number, optional): Pet ID to use in battle (hero battles only)
- `favor` (object, optional): Favor pet assignments (empty for titan battles)
- `banner` (number, optional): Banner ID to use in battle (hero battles only)

**Response:** Returns complete battle data including battle seed, attacker/defender stats, and battle type.

#### clanWarEndBattle

**Description:** Submits the battle result after completing a Guild War battle.

**Request:**
```javascript
Send({
  calls: [{
    name: "clanWarEndBattle",
    args: {
      result: {
        win: false,
        stars: 0
      },
      progress: [{
        v: 272,
        b: 0,
        seed: 1906504079,  // Must match clanWarAttack response seed
        attackers: {
          input: ["auto", 0, 0, "auto", 0, 0],
          heroes: {
            "9": { hp: 376777, energy: 594, isDead: false }
            // ... more heroes
          }
        },
        defenders: {
          input: [],
          heroes: {
            "1": { hp: 58106758, energy: 1000, isDead: false }
            // ... more defenders
          }
        }
      }]
    },
    context: { actionTs: Date.now() },
    ident: "body"
  }]
})
```

**Response:** Returns updated slot information, victory points, and clan points.

---

## Clan Raid API (Minions Attack)

### Overview

Clan Raid (also known as **Minions Attack** or **Minion Raid**) is a cooperative PvE mode where clan members work together to defeat raid bosses. Multiple clan members can fight the same boss simultaneously, with damage persisting across all attempts.

### Endpoints

#### clanRaid_getInfo

**Description:** Retrieves complete clan raid information including current boss, all bosses/nodes, shop, buffs, user stats, and rewards.

**Request:**
```javascript
Send({
  calls: [{
    name: "clanRaid_getInfo",
    args: {},
    context: { actionTs: Date.now() },
    ident: "body"
  }]
})
```

**Response Fields:**
- `boss`: Current active boss information with phases and HP
- `nodes`: All raid bosses/nodes (numbered 1-9+)
- `shop`: Raid shop items available for purchase
- `buffs`: Currently active buffs
- `stats`: Clan and user statistics
- `userStats`: Player's damage, points, and rewards
- `attempts`: Remaining free attempts
- `bossAttempts`: Boss-specific attempts remaining

#### clanRaid_startBossBattle

**Description:** Initiates a battle against a clan raid boss.

**Request:**
```javascript
Send({
  calls: [{
    name: "clanRaid_startBossBattle",
    args: {
      heroes: [50, 42, 58, 51, 9],
      pet: 6005,
      favor: {
        "9": 6004,
        "42": 6006,
        "50": 6005,
        "51": 6001,
        "58": 6008
      }
    },
    context: { actionTs: Date.now() },
    ident: "body"
  }]
})
```

**Response:** Returns detailed battle information with boss stats (can have multiple phases), player hero stats, battle seed, and battle type.

#### clanRaid_endBossBattle

**Description:** Submits the battle result after completing/ending a clan raid boss battle.

**Request:**
```javascript
Send({
  calls: [{
    name: "clanRaid_endBossBattle",
    args: {
      result: {
        win: false,
        stars: 0
      },
      progress: [{
        v: 272,
        b: 0,
        seed: -557779724,  // Must match startBossBattle response seed
        attackers: {
          input: ["auto", 0, 0, "auto", 0, 0],
          heroes: {
            "9": { hp: 376777, energy: 594, isDead: false }
            // ... more heroes
          }
        },
        defenders: {
          input: [],
          heroes: {
            "1": {
              hp: 58106758,
              energy: 1000,
              isDead: false,
              extra: {
                damageTaken: 5628015,
                damageTakenNextLevel: 0
              }
            }
            // ... more phases
          }
        }
      }]
    },
    context: { actionTs: Date.now() },
    ident: "body"
  }]
})
```

**Response:** Returns damage dealt, total cumulative damage, raid currency earned, and quest updates.

#### clanRaid_usersInBossBattle

**Description:** Retrieves information about other clan members currently fighting the same boss.

**Request:**
```javascript
Send({
  calls: [{
    name: "clanRaid_usersInBossBattle",
    args: {},
    context: { actionTs: Date.now() },
    ident: "body"
  }]
})
```

**Response:** Returns array of users currently in battle with their user IDs, names, levels, and start times.

### Battle Mechanics

**Raid Boss Structure:**
- Multi-Phase Bosses: Bosses can have multiple phases (typically 2), each with separate HP pools
- Massive HP Pools: Boss HP ranges from ~287M to ~448M per phase
- Persistent Damage: Damage persists across all clan members' attempts
- Time Limit: Battles have an end time (typically 3 minutes)

**Raid Effects:**
- `percentDamageBuff_any`: Overall damage buff percentage
- `bossAstralMaterialAuraReduction`: Reduces boss astral material aura
- `bossAstralAntihealAuraReduction`: Reduces boss anti-heal effects
- `bossAstralHealOnAttack`: Heal amount on attack
- `bossAstralSwitcherCDReduce`: Cooldown reduction for switching
- `bossAstralParalyseHealReduction`: Reduces heal when paralyzed

---

## Cross Clan War (COW) API

### Overview

Cross Clan War is a competitive mode where clans battle against each other across multiple slots. Supports both hero battles and titan battles.

### Endpoints

#### crossClanWar_getInfo

**Description:** Retrieves information about the current Cross Clan War status, including available battles, opponent clans, and war state.

**Request:**
```javascript
Send({
  calls: [{
    name: "crossClanWar_getInfo",
    args: {},
    context: { actionTs: Date.now() },
    ident: "group_1_body"
  }]
})
```

**Response:** Contains detailed information about the Cross Clan War, including:
- War status and timing
- Available battle slots
- Opponent clan information
- Battle results
- Rewards and standings

#### crossClanWar_startBattle

**Description:** Initiates a battle in the Cross Clan War against a specific slot. Supports both hero battles and titan battles.

**Request (Hero Battle):**
```javascript
Send({
  calls: [{
    name: "crossClanWar_startBattle",
    args: {
      slotId: 2,
      favor: {
        "13": 6008,
        "16": 6004,
        "29": 6006,
        "64": 6005
      },
      team: {
        units: [29, 64, 13, 40, 16],
        pet: 6008
      },
      banner: 2
    },
    context: { actionTs: Date.now() },
    ident: "body"
  }]
})
```

**Request (Titan Battle):**
```javascript
Send({
  calls: [{
    name: "crossClanWar_startBattle",
    args: {
      slotId: 16,
      team: {
        units: [4033, 4043, 4031, 4032, 4030]
      }
    },
    context: { actionTs: Date.now() },
    ident: "body"
  }]
})
```

**Request Parameters:**
- `slotId` (number): The battle slot ID to attack (1-16 for hero battles, higher for titan battles)
- `team` (object): The attacking team configuration
  - `team.units` (array): Array of hero IDs for the team (hero battles) or titan IDs (titan battles)
  - `team.pet` (number, optional): Pet ID for the team (hero battles only)
- `favor` (object, optional): Map of hero IDs to favor IDs (hero battles only)
- `banner` (number, optional): Banner ID for the team (hero battles only)

**Notes:**
- Hero battles (typically slots 1-15) support pets, favors, and banners
- Titan battles (typically slots 16+) only require unit IDs
- The `favor` parameter is optional - can be an empty object `{}` if no favors are selected

---

## Secret Wealth Shop API

### Overview

The Secret Wealth Shop (Merchant Shop) is a shop where players can purchase items using consumables (such as pet potions) or GEMs (starmoney).

### Endpoints

#### shopBuy

**Description:** Purchases an item from the Secret Wealth Shop.

**Request (Purchase with Consumables):**
```javascript
Send({
  calls: [{
    name: "shopBuy",
    args: {
      shopId: 1576000026,  // Secret Wealth Shop ID
      slot: 6,
      cost: {
        consumable: {
          "85": 40000  // 85: pet potion
        }
      },
      reward: {
        consumable: {
          "55": 80  // 55: titan artifact sphere
        }
      }
    },
    context: { actionTs: Date.now() },
    ident: "body"
  }]
})
```

**Request (Purchase with GEMs):**
```javascript
Send({
  calls: [{
    name: "shopBuy",
    args: {
      shopId: 1576000026,
      slot: 3,
      cost: {
        starmoney: 890  // GEM payment
      },
      reward: {
        consumable: {
          "201": 100  // 201: Crystal
        }
      }
    },
    context: { actionTs: Date.now() },
    ident: "body"
  }]
})
```

**Request Parameters:**
- `shopId` (number): Unique identifier for the shop instance (1576000026 for Secret Wealth Shop)
- `slot` (number): The slot number of the item being purchased (typically 1-6)
- `cost` (object): The cost of the item
  - `cost.consumable` (object): Map of consumable IDs to amounts (when paying with consumables)
  - `cost.starmoney` (number): GEM amount (when paying with GEMs)
- `reward` (object): The reward being received (for validation)

**Consumable ID Reference:**
- `85`: Pet potion
- `55`: Titan artifact sphere
- `201`: Crystal

**Response:** Returns purchase confirmation with rewarded items and quest updates.

---

## Titan Artifact Shop API

### Overview

The Titan Artifact Shop (shopId: 13) is a shop where players can purchase Titan Artifact fragments using coins. The shop supports bulk purchases.

### Endpoints

#### shopBuy

**Description:** Purchases Titan Artifact fragments from the shop. Supports bulk purchases via the `amount` parameter.

**Request:**
```javascript
Send({
  calls: [{
    name: "shopBuy",
    args: {
      shopId: 13,
      slot: 24,
      cost: {
        coin: {
          "18": 12
        }
      },
      reward: {
        fragmentTitanArtifact: {
          "2005": 1
        }
      },
      amount: 300  // Bulk purchase amount
    },
    context: { actionTs: Date.now() },
    ident: "group_0_body"
  }]
})
```

**Request Parameters:**
- `shopId` (number): Fixed at `13` for the Titan Artifact Shop
- `slot` (number): The slot number of the item being purchased (typically 1-25)
- `cost.coin` (object): Map of coin type IDs to amounts (coin type `18` is standard)
- `reward.fragmentTitanArtifact` (object): Map of fragment IDs to amounts
- `amount` (number, optional): Number of items to purchase in bulk (defaults to 1)

**Titan Artifact Fragment IDs:**
- `1001-1016`: Standard Titan Artifact fragments
- `1017-1020`: Additional Titan Artifact fragments
- `2001-2005`: Advanced Titan Artifact fragments

#### shopGet

**Description:** Retrieves the current inventory and configuration of the Titan Artifact Shop.

**Request:**
```javascript
Send({
  calls: [{
    name: "shopGet",
    args: {
      shopId: 13
    },
    context: { actionTs: Date.now() },
    ident: "group_0_shopGet"
  }]
})
```

**Response:** Returns shop configuration including:
- `slots`: Map of slot numbers to slot data
- `slots[].reward`: Reward for this slot
- `slots[].cost`: Cost object with coin type and amount
- `slots[].bought`: Number of times this slot has been purchased
- `slots[].staticShopMultiplePurchase`: Whether bulk purchase is enabled (1 = enabled)
- `slots[].amountAvailable`: Available quantity (null = unlimited)

---

## TeamGetAll API

### Overview

The `teamGetAll` API provides comprehensive team configurations for all game modes in Hero Wars. It returns pre-configured teams that players have set up through the game's UI, including heroes, pets, and other team-related data.

### Endpoint

#### teamGetAll

**Request:**
```javascript
Send({
  calls: [{
    name: "teamGetAll",
    args: {},
    ident: "teamGetAll"
  }]
})
```

### Response Structure

Each team configuration is an array where:
- **First 5 elements**: Hero IDs (heroes with ID < 6000)
- **6th element**: Pet ID (pets with ID >= 6000)

### Team Configuration Fields

```typescript
{
  // Adventure Mode
  adventure_hero: number[];           // [hero1, hero2, hero3, hero4, hero5, pet]
  
  // Arena Modes
  arena: number[];                     // [hero1, hero2, hero3, hero4, hero5, pet]
  grand: number[][];                  // [[team1], [team2], [team3]] - 3 teams for grand arena
  
  // Dungeon Modes
  dungeon_hero: number[];              // [hero1, hero2, hero3, hero4, hero5, pet]
  dungeon_earth: number[];            // Titan team for earth dungeon
  dungeon_fire: number[];             // Titan team for fire dungeon
  dungeon_water: number[];            // Titan team for water dungeon
  dungeon_neutral: number[];          // Titan team for neutral dungeon
  
  // Tower Mode
  tower: number[];                    // [hero1, hero2, hero3, hero4, hero5, pet]
  
  // Titan Arena
  titan_arena: number[];              // [titan1, titan2, titan3, titan4, titan5]
  titan_arena_def: number[];          // Defense team for titan arena
  titan_mission: number[];            // Titan team for missions
  
  // Clan/Team Modes
  clanDefence_heroes: number[];       // Heroes for Guild War defense
  clanDefence_titans: number[];        // Titans for Guild War defense
  clanRaid_nodes: number[][];         // [[team1], [team2], [team3]] - 3 teams for clan raid nodes (Minions Attack)
  clan_global_pvp: number[];          // Heroes for global clan PvP
  clan_global_pvp_titan: number[];    // Titans for global clan PvP
  clan_pvp_hero: number[];           // Heroes for clan PvP
  clan_pvp_titan: number[];           // Titans for clan PvP
  
  // Cross-Clan Defense
  crossClanDefence_heroes: number[][]; // [[team1], [team2], [team3]] - 3 teams
  crossClanDefence_titans: number[][]; // [[team1], [team2]] - 2 titan teams
  
  // Mission Mode
  mission: number[];                   // [hero1, hero2, hero3, hero4, hero5, pet]
  
  // Boss Battles
  boss_10: number[];                  // Team for boss level 10
  boss_11: number[];                 // Team for boss level 11
  boss_12: number[];                 // Team for boss level 12
  
  // Invasion Bosses (182-225, 394-417)
  invasion_boss_182: number[];        // Team for invasion boss 182
  // ... (continues for all invasion boss levels)
  
  // Other Modes
  brawl: number[];                    // Team for brawls
  challenge: number[];                // Team for challenges
}
```

### Entity ID Ranges

- **Heroes**: 1-999 (e.g., 46 = Aurora, 57 = K'arkh, 40 = Jorgen)
- **Pets**: 6000-6999 (e.g., 6008 = Axel, 6004 = Oliver, 6006 = Cain)
- **Titans**: 4000-4999 (e.g., 4033 = Hyperion, 4003 = Eden, 4043 = Sigurd)

### Usage Patterns

**Single Team Modes:**
```javascript
const arenaTeam = teamGetAll.arena; // [46, 57, 40, 16, 65, 6008]
const heroes = arenaTeam.slice(0, 5); // [46, 57, 40, 16, 65]
const pet = arenaTeam[5]; // 6008
```

**Multi-Team Modes:**
```javascript
const grandArenaTeams = teamGetAll.grand; // [[team1], [team2], [team3]]
const clanRaidTeams = teamGetAll.clanRaid_nodes; // [[team1], [team2], [team3]]
```

**Titan-Only Modes:**
```javascript
const titanArenaTeam = teamGetAll.titan_arena; // [4033, 4003, 4043, 4032, 4030]
```

---

## Demo Battle API

### Overview

The Demo Battle API allows testing battle scenarios in Hero Wars without consuming actual battle attempts. This API simulates battles between attack and defense teams and returns detailed battle results.

### Endpoint

#### demoBattles_startBattle

**Description:** Starts a demo battle simulation for testing purposes.

**Request:**
```javascript
Send({
  calls: [{
    name: "demoBattles_startBattle",
    args: {
      mechanic: "arena",  // Battle type: "arena", "grand_arena", "titan_war", etc.
      defenceMaxUpgrade: false,
      defenceTeam: {
        units: [9, 40, 56, 16, 1],
        pet: 6005
      },
      defenceBanner: 6,
      defenceFavor: {
        "1": 6004,
        "9": 6005,
        "16": 6000,
        "56": 6006
      },
      maxUpgrade: false,
      team: {
        units: [62, 9, 40, 56, 42],
        pet: 6008
      },
      banner: 6,
      favor: {
        "9": 6007,
        "40": 6004,
        "42": 6006,
        "56": 6001,
        "62": 6003
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
})
```

**Request Parameters:**
- `mechanic` (string): Battle type (e.g., "arena", "grand_arena", "titan_war")
- `defenceMaxUpgrade` (boolean): Whether defense team uses max upgrades
- `defenceTeam` (object): Defense team configuration
  - `units` (array): Array of hero IDs
  - `pet` (number): Pet ID
- `defenceBanner` (number): Defense team banner ID
- `defenceFavor` (object): Defense team favor pets mapping
- `maxUpgrade` (boolean): Whether attack team uses max upgrades
- `team` (object): Attack team configuration
  - `units` (array): Array of hero IDs
  - `pet` (number): Pet ID
- `banner` (number): Attack team banner ID
- `favor` (object): Attack team favor pets mapping
- `defenceBuffs` (object): Defense team buffs (empty object `{}`)
- `buffs` (object): Attack team buffs (empty object `{}`)
- `parentId` (number): Parent battle ID (0 for standalone battles)
- `entryId` (number): Entry ID (0 for standalone battles)

**Response:** Returns detailed battle data including:
- Battle metadata (userId, typeId, startTime, seed, type)
- Attackers data (detailed hero statistics)
- Defenders data (battle state information)
- Battle effects (buffs, debuffs, banner effects)

**Notes:**
- Demo battles do not consume actual battle attempts
- Battle results are calculated server-side
- Can be used for testing team compositions and strategies
- Supports various battle mechanics (arena, grand arena, titan war, etc.)

---

## Additional Resources

**Note:** All specialized API documentation has been consolidated into this document. The following separate documentation files are now deprecated:
- `ARENA_API_DOCUMENTATION.md` - Consolidated into Arena API section
- `GrandArenaAPI_Documentation.md` - Consolidated into Grand Arena API section
- `GUILD_WAR_API_DOCUMENTATION.md` - Consolidated into Guild War API section
- `CLAN_RAID_API_DOCUMENTATION.md` - Consolidated into Clan Raid API (Minions Attack) section
- `COW_API_DOCUMENTATION.md` - Consolidated into Cross Clan War API section
- `SECRET_WEALTH_SHOP_API_DOCUMENTATION.md` - Consolidated into Secret Wealth Shop API section
- `TITAN_ARTIFACT_SHOP_API_DOCUMENTATION.md` - Consolidated into Titan Artifact Shop API section
- `TEAMGETALL_API_DOCUMENTATION.md` - Consolidated into TeamGetAll API section
- `DEMO_BATTLE_API_DOCUMENTATION.md` - Consolidated into Demo Battle API section

For the most up-to-date API documentation, refer to this consolidated document.

