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

**Accessing Refillable Data:**

To get descriptions and metadata for all refillable resources, access `lib.data.refillable`:
```javascript
// Get all refillable resource descriptions
const refillableData = lib.data.refillable;
// This object contains metadata for all refillable types including:
// - id: Resource ID
// - ident: Identifier string (e.g., 'stamina', 'arena_battle')
// - refillSeconds: Time in seconds until refill
// - maxValue: Maximum value array
// - maxRefillCount: Maximum refill count array
// - refillByReset: Whether refill resets on daily reset
// - refillCountResetLocalTime: Local time reset array
// - serverTimeRefill: Whether server time is used for refill
```

To get the actual current values of refillable resources, use:
```javascript
// Using Caller class (recommended)
const refillableValues = (await Caller.send('userGetInfo')).refillable;
// Returns array of objects with:
// - id: Resource type ID
// - amount: Current amount/value
// - lastRefill: Timestamp of last refill
// - boughtToday: Number purchased today

// Using Send function
const userInfo = await Send('{"calls":[{"name":"userGetInfo","args":{},"ident":"body"}]}')
  .then(e => e.results[0].result.response);
const refillableValues = userInfo.refillable;
```

**Note:** Arena attempts are stored in the `refillable` array with `id: 6`. Grand Arena attempts are stored with `id: 21`. The `amount` field indicates how many battle attempts are currently available for each respective arena type.

**Important:** Guild War attempts are **NOT** stored in the `refillable` array. Instead, Guild War attempts are tracked separately in the `clanWarGetInfo` API response as `myTries`. See the [Guild War API](#guild-war-api) section for details.

**Console Usage:**
These commands can be executed directly in the browser console when using the HeroWarsHelper script:
```javascript
// Get refillable descriptions/metadata
lib.data.refillable

// Get current refillable values
(await Caller.send('userGetInfo')).refillable
```

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

**Description:** Claims/farms rewards from a special offer. This API is typically used for stage-based reward offers where players can claim rewards after completing certain stages. The API returns the claimed rewards and updates the special offers list.

**Request:**
```javascript
Send({
  calls: [{
    name: 'specialOffer_farmReward',
    args: {
      offerId: 1778001657
    },
    context: {
      actionTs: Date.now()
    },
    ident: 'body'
  }]
})
```

**Request Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `offerId` | Number | Yes | The unique identifier of the special offer to claim rewards from |

**Response Structure:**
```javascript
{
  "date": 1763273826.1036711,
  "results": [{
    "ident": "body",
    "result": {
      "response": {
        "starmoney": 100,
        "coin": {
          "1778001091": 1
        }
      },
      "specialOffers": [
        // Updated list of all active special offers
      ],
      "endSpecialOffers": [8]  // Array of offer IDs that have ended
    }
  }]
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `results[].result.response` | Object | The claimed rewards |
| `results[].result.response.starmoney` | Number | Amount of starmoney claimed |
| `results[].result.response.coin` | Object | Object mapping coin IDs to amounts claimed |
| `results[].result.specialOffers` | Array | Updated list of special offers |
| `results[].result.endSpecialOffers` | Array | Array of special offer IDs that have ended |

**Response Notes:**

- The `response` object contains the actual rewards claimed (starmoney and coins)
- The `specialOffers` array contains updated information about all active special offers
- The `endSpecialOffers` array contains IDs of offers that have ended
- Coin IDs in the `coin` object are strings representing different currency types

**Example Usage:**
```javascript
const response = await Send({
  calls: [{
    name: 'specialOffer_farmReward',
    args: {
      offerId: 1778001657
    },
    context: {
      actionTs: Date.now()
    },
    ident: 'body'
  }]
});

// Access the claimed rewards
const rewards = response.results[0].result.response;
console.log('Starmoney:', rewards.starmoney);
console.log('Coins:', rewards.coin);
```

#### specialOffer_check

**Description:** Checks if a special offer is available. This API is used to verify the availability status of one or more special offers before attempting to claim rewards. Multiple offers can be checked in a single request.

**Request:**
```javascript
Send({
  calls: [
    {
      name: 'specialOffer_check',
      args: { offerId: 1778001725 },
      context: { actionTs: Date.now() },
      ident: 'offer1'
    },
    {
      name: 'specialOffer_check',
      args: { offerId: 1778001678 },
      context: { actionTs: Date.now() },
      ident: 'offer2'
    }
  ]
})
```

**Request Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `offerId` | Number | Yes | The unique identifier of the special offer to check |

**Response Structure:**
```javascript
{
  "date": 1763273827.9898541,
  "results": [
    {
      "ident": "offer1",
      "result": {
        "response": {
          "available": true,
          "failedChecks": null
        }
      }
    },
    {
      "ident": "offer2",
      "result": {
        "response": {
          "available": false,
          "failedChecks": {
            "offerUnavailable": true
          }
        }
      }
    }
  ]
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `results[].result.response.available` | Boolean | Whether the offer is available |
| `results[].result.response.failedChecks` | Object/null | Object containing failed check reasons, or null if available |

**Failed Checks:**

When `available` is `false`, the `failedChecks` object may contain:

| Field | Type | Description |
|-------|------|-------------|
| `offerUnavailable` | Boolean | Set to `true` if the offer is not available (expired, not started, or already claimed) |

**Example Usage:**
```javascript
// Check a single offer
const response = await Send({
  calls: [{
    name: 'specialOffer_check',
    args: {
      offerId: 1778001725
    },
    context: {
      actionTs: Date.now()
    },
    ident: 'body'
  }]
});

const isAvailable = response.results[0].result.response.available;
if (isAvailable) {
  console.log('Offer is available');
} else {
  console.log('Offer is not available:', response.results[0].result.response.failedChecks);
}

// Check multiple offers at once
const multiCheckResponse = await Send({
  calls: [
    {
      name: 'specialOffer_check',
      args: { offerId: 1778001725 },
      context: { actionTs: Date.now() },
      ident: 'offer1'
    },
    {
      name: 'specialOffer_check',
      args: { offerId: 1778001678 },
      context: { actionTs: Date.now() },
      ident: 'offer2'
    }
  ]
});

// Process each result
multiCheckResponse.results.forEach(result => {
  const offerId = result.ident;
  const available = result.result.response.available;
  console.log(`Offer ${offerId}: ${available ? 'Available' : 'Unavailable'}`);
});
```

**Common Usage Patterns:**

**Pattern 1: Check Before Claiming**
```javascript
async function claimRewardIfAvailable(offerId) {
  // First check if the offer is available
  const checkResponse = await Send({
    calls: [{
      name: 'specialOffer_check',
      args: { offerId: offerId },
      context: { actionTs: Date.now() },
      ident: 'check'
    }]
  });

  const isAvailable = checkResponse.results[0].result.response.available;
  
  if (!isAvailable) {
    console.log('Offer is not available');
    return null;
  }

  // Claim the reward
  const claimResponse = await Send({
    calls: [{
      name: 'specialOffer_farmReward',
      args: { offerId: offerId },
      context: { actionTs: Date.now() },
      ident: 'claim'
    }]
  });

  return claimResponse.results[0].result.response;
}
```

**Pattern 2: Batch Check Multiple Offers**
```javascript
async function checkMultipleOffers(offerIds) {
  const calls = offerIds.map((offerId, index) => ({
    name: 'specialOffer_check',
    args: { offerId: offerId },
    context: { actionTs: Date.now() },
    ident: `offer_${index}`
  }));

  const response = await Send({ calls });
  
  return response.results.map((result, index) => ({
    offerId: offerIds[index],
    available: result.result.response.available,
    failedChecks: result.result.response.failedChecks
  }));
}
```

**Pattern 3: Claim All Available Rewards**
```javascript
async function claimAllAvailableRewards(offerIds) {
  // First check all offers
  const checkCalls = offerIds.map((offerId, index) => ({
    name: 'specialOffer_check',
    args: { offerId: offerId },
    context: { actionTs: Date.now() },
    ident: `check_${index}`
  }));

  const checkResponse = await Send({ calls: checkCalls });
  
  // Filter available offers
  const availableOffers = checkResponse.results
    .map((result, index) => ({
      offerId: offerIds[index],
      available: result.result.response.available
    }))
    .filter(offer => offer.available);

  if (availableOffers.length === 0) {
    console.log('No available offers');
    return [];
  }

  // Claim all available rewards
  const claimCalls = availableOffers.map((offer, index) => ({
    name: 'specialOffer_farmReward',
    args: { offerId: offer.offerId },
    context: { actionTs: Date.now() },
    ident: `claim_${index}`
  }));

  const claimResponse = await Send({ calls: claimCalls });
  
  return claimResponse.results.map(result => result.result.response);
}
```

**Error Handling:**

Both APIs follow the standard Hero Wars API error response format. If an error occurs, the response will contain an error object instead of the expected result.

**Common Error Scenarios:**

1. **Invalid offerId**: The offer ID does not exist or is invalid
2. **Offer already claimed**: Attempting to claim rewards from an offer that has already been claimed
3. **Offer expired**: The offer has ended and is no longer available
4. **Authentication failure**: Invalid or expired authentication headers

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

Refill gacha (hero summoning system). This API call refreshes the gacha system and provides rewards.

**Request:**
```javascript
Send({
  calls: [{
    name: "gacha_refill",
    args: {
      ident: "heroGacha"  // Identifier for the gacha type
    },
    context: {
      actionTs: Date.now()
    },
    ident: "body"
  }]
})
```

**Response Structure:**
```javascript
{
  "date": 1763321343.088197,
  "results": [
    {
      "ident": "body",
      "result": {
        "response": {
          "coin": {
            "38": 1  // Coin ID and amount received
          }
        }
      }
    }
  ]
}
```

**Response Fields:**
- `coin`: Object containing coin rewards received
  - Key: Coin ID (number)
  - Value: Amount received (number)
  - Example: `{"38": 1}` means 1 unit of coin ID 38 was received

**Example Usage:**
```javascript
const response = await Send({
  calls: [{
    name: "gacha_refill",
    args: { ident: "heroGacha" },
    ident: "body"
  }]
});

const coins = response.results[0].result.response.coin;
console.log('Received coins:', coins);
```

---

### Hero GotCha

**Note:** The `heroGotCha` API was not found in the provided HAR file. This section will be updated when API calls for this feature are captured.

If you have HAR file data containing `heroGotCha` API calls, please provide it for documentation.

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
- `myTries`: **Number of remaining Guild War attack attempts** (not stored in refillable system)
- `arePointsMax`: Boolean indicating if maximum points have been reached

**Note:** Unlike Arena and Grand Arena which track attempts in the `refillable` array, Guild War attempts are tracked directly in the `clanWarGetInfo` response as `myTries`.

**Example Usage:**
```javascript
const response = await Send({
  calls: [
    { name: "clanWarGetInfo", args: {}, ident: "clanWarGetInfo" }
  ]
});

const guildWarInfo = response.results[0].result.response;
const attemptsRemaining = guildWarInfo.myTries ?? 0;
console.log(`Guild War attempts remaining: ${attemptsRemaining}`);
```

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

## Area of Conquest (Clan Domination) API

Area of Conquest (also known as Clan Domination) is a clan-based PvP mode where clans compete to control territories on a map.

### clanDomination_getBattleJournal

Get the battle journal/log for Area of Conquest battles.

**Request:**
```javascript
Send({
  calls: [{
    name: "clanDomination_getBattleJournal",
    args: {
      type: "clan_domination",
      limit: 40,
      offset: 0
    },
    context: { actionTs: 1143874 },
    ident: "body"
  }]
})
```

**Request Parameters:**
- `type` (string): Battle type, should be `"clan_domination"`
- `limit` (number): Maximum number of events to return (default: 40)
- `offset` (number): Number of events to skip (default: 0)

**Example Response:**
```json
{
  "date": 1762932596.002743,
  "results": [{
    "ident": "body",
    "result": {
      "response": {
        "users": {
          "8009806": {
            "id": "8009806",
            "name": "Hershey",
            "lastLoginTime": "1762915250",
            "serverId": "46",
            "level": "130",
            "clanId": "71205",
            "clanRole": "4",
            "commander": true,
            "avatarId": "1514",
            "isChatModerator": false,
            "frameId": 154,
            "leagueId": 3,
            "allowPm": "all",
            "clanTitle": "Fairy Tail",
            "clanIcon": {
              "flagColor1": 19,
              "flagColor2": 19,
              "flagShape": 14,
              "iconColor": 0,
              "iconShape": 17,
              "frame": 2
            }
          },
          "35979991": {
            "id": "35979991",
            "name": "One Peace",
            "lastLoginTime": "1762931456",
            "serverId": "218",
            "level": "130",
            "clanId": "328621",
            "clanRole": "4",
            "commander": false,
            "avatarId": "690",
            "isChatModerator": false,
            "frameId": 136,
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
        "events": [
          {
            "replayId": "1762932389588391261",
            "userId": 47417806,
            "targetId": 35961156,
            "result": "lose",
            "reward": [],
            "ctime": 1762932389,
            "endTime": 1762932389
          },
          {
            "replayId": "1762932203341325664",
            "userId": 8009806,
            "targetId": 35891708,
            "result": "defence",
            "reward": {
              "coin": {
                "46": 100
              }
            },
            "ctime": 1762932203,
            "endTime": 1762932203
          },
          {
            "replayId": "1762929762844980034",
            "userId": 35979991,
            "targetId": 47429573,
            "result": "win",
            "reward": {
              "coin": {
                "46": 100
              }
            },
            "ctime": 1762929762,
            "endTime": 1762929762
          },
          {
            "replayId": "1762924106898277273",
            "userId": 35449277,
            "targetId": 28415350,
            "result": "conquer",
            "reward": {
              "coin": {
                "46": 124
              }
            },
            "ctime": 1762924106,
            "endTime": 1762924106
          }
        ]
      }
    }
  }]
}
```

**Response Fields:**
- `users`: Object mapping user IDs to user information
- `events`: Array of battle events with results and rewards
  - `result`: Battle outcome
    - `"win"`: Attacker won
    - `"lose"`: Attacker lost
    - `"defence"`: Successfully defended
    - `"conquer"`: Successfully conquered territory

---

### clanDomination_stats

Get statistics for all clans participating in Area of Conquest.

**Request:**
```javascript
Send({
  calls: [{
    name: "clanDomination_stats",
    args: {},
    context: { actionTs: 1144748 },
    ident: "body"
  }]
})
```

**Example Response:**
```json
{
  "date": 1762932596.871387,
  "results": [{
    "ident": "body",
    "result": {
      "response": {
        "71205": {
          "power": 196793770,
          "coins": 131683,
          "towns": 6,
          "castle": 32
        },
        "368696": {
          "power": 159466657,
          "coins": 113165,
          "towns": 10,
          "castle": 39
        },
        "312133": {
          "power": 127974259,
          "coins": 125445,
          "towns": 9,
          "castle": 40
        },
        "328621": {
          "power": 137851121,
          "coins": 156356,
          "towns": 6,
          "castle": 40
        }
      }
    }
  }]
}
```

**Response Fields:**
- `power`: Total clan power
- `coins`: Total coins collected
- `towns`: Number of towns controlled
- `castle`: Castle level/position

---

### clanDomination_move

Move your character to a specific level/position on the map.

**Request:**
```javascript
Send({
  calls: [{
    name: "clanDomination_move",
    args: {
      levelId: 7
    },
    context: { actionTs: 1203030 },
    ident: "body"
  }]
})
```

**Request Parameters:**
- `levelId` (number): The level/position ID to move to

**Example Response:**
```json
{
  "date": 1762932655.203018,
  "results": [{
    "ident": "body",
    "result": {
      "response": {
        "userId": 35979991,
        "move": {
          "2": 7
        },
        "visibleLevels": [696, 606, 612, 690, 702, 786, 792, 522, 528, 600, 534, 618, 684, 780, 708, 798, 882, 888, 894, 444, 450, 516, 456, 462, 540, 624, 372, 378, 438, 384, 390, 396, 468, 546, 630, 306, 312, 366, 318, 432, 324, 330, 277, 337, 403, 475, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 72, 77, 78, 83, 84, 89, 90, 95, 101, 102, 107, 108, 114, 120, 128, 131, 133, 137, 138, 143, 144, 149, 150, 156, 162, 163, 169, 170, 173, 175, 179, 180, 181, 185, 186, 191, 192, 197, 198, 204, 205, 210, 211, 216, 217, 218, 222, 223, 227, 228, 229, 233, 234, 235, 239, 240, 245, 246, 252, 253, 258, 259, 264, 265, 270, 271, 276, 282, 283, 287, 288, 289, 293, 294, 299, 300, 313, 319, 325, 329, 331, 336, 342, 343, 348, 349, 354, 355, 360, 379, 385, 389, 391, 395, 402, 408, 409, 414, 415, 420, 421, 426, 461, 467, 474, 480, 481, 486, 487, 493, 539, 545],
        "changedLevels": null,
        "castlePositions": null,
        "userPositions": {
          "7659541": 33,
          "23385341": 51,
          "24417949": 6,
          "28103487": 101,
          "28569253": 29,
          "28572153": 426,
          "59720486": 107,
          "47570368": 26,
          "35448204": 696,
          "35449277": 336,
          "35461323": 252,
          "35473076": 696,
          "35538758": 36,
          "35538770": 696,
          "35581685": 696,
          "35621043": 696,
          "35659090": 696,
          "35695193": 198,
          "35698714": 696,
          "35718205": 294,
          "35769428": 696,
          "35776732": 696,
          "35818082": 696,
          "35891708": 1,
          "35900525": 696,
          "35902122": 696,
          "35911013": 265,
          "35961156": 185,
          "35979991": 7,
          "35986432": 150,
          "36005478": 696,
          "36039664": 223,
          "36040671": 696,
          "48705148": 696,
          "59891179": 378,
          "59895273": 468,
          "60608426": 343
        },
        "townPositions": {
          "1": {
            "position": 1,
            "status": 1,
            "userId": 35891708,
            "townId": 5,
            "farmStart": 1762931386
          },
          "26": {
            "position": 26,
            "status": 1,
            "userId": 47570368,
            "townId": 3,
            "farmStart": 1762920223
          },
          "29": {
            "position": 29,
            "status": 1,
            "userId": 28569253,
            "townId": 3,
            "farmStart": 1762932617
          },
          "33": {
            "position": 33,
            "status": 1,
            "userId": 7659541,
            "townId": 3,
            "farmStart": 1762932579
          },
          "36": {
            "position": 36,
            "status": 1,
            "userId": 35538758,
            "townId": 3,
            "farmStart": 1762915383
          },
          "101": {
            "position": 101,
            "status": 1,
            "userId": 28103487,
            "townId": 4,
            "farmStart": 1762932620
          },
          "336": {
            "position": 336,
            "status": 1,
            "userId": 35449277,
            "townId": 3,
            "farmStart": 1762925012
          },
          "343": {
            "position": 343,
            "status": 1,
            "userId": 60608426,
            "townId": 2,
            "farmStart": 1762928106
          },
          "378": {
            "position": 378,
            "status": 1,
            "userId": 59891179,
            "townId": 1,
            "farmStart": 1762912781
          },
          "426": {
            "position": 426,
            "status": 1,
            "userId": 28572153,
            "townId": 2,
            "farmStart": 1762931984
          },
          "468": {
            "position": 468,
            "status": 1,
            "userId": 59895273,
            "townId": 1,
            "farmStart": 1762923004
          }
        },
        "chestPositions": {
          "264": {
            "position": 264,
            "farmed": true
          },
          "186": {
            "position": 186,
            "farmed": true
          },
          "235": {
            "position": 235,
            "farmed": true
          },
          "233": {
            "position": 233,
            "farmed": true
          },
          "319": {
            "position": 319,
            "farmed": true
          }
        },
        "portalPositions": null,
        "altarPositions": null,
        "farmedChest": null,
        "user": {
          "id": "35979991",
          "name": "One Peace",
          "lastLoginTime": "1762931456",
          "serverId": "218",
          "level": "130",
          "clanId": "328621",
          "clanRole": "4",
          "commander": false,
          "avatarId": "690",
          "isChatModerator": false,
          "frameId": 136,
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
        },
        "autoMove": false,
        "refillable": {
          "id": 55,
          "amount": 11,
          "lastRefill": 1762932312,
          "boughtToday": 0,
          "refillTime": 720
        },
        "mapVersion": 17100
      }
    }
  }]
}
```

**Response Fields:**
- `move`: Object showing the new position for the user
- `visibleLevels`: Array of level IDs that are visible/accessible
- `userPositions`: Map of all user positions on the map
- `townPositions`: Map of town positions with ownership and farming status
- `chestPositions`: Map of chest positions and whether they've been farmed
- `refillable`: Information about movement energy/charges
  - `id`: Refillable item ID (55 for movement energy)
  - `amount`: Current amount of energy
  - `lastRefill`: Timestamp of last refill
  - `refillTime`: Time in seconds until next refill

---

### clanDomination_getEnemyTeams

Get enemy team information for a specific level/position.

**Request:**
```javascript
Send({
  calls: [{
    name: "clanDomination_getEnemyTeams",
    args: {
      levelId: 6
    },
    context: { actionTs: 1204346 },
    ident: "body"
  }]
})
```

**Request Parameters:**
- `levelId` (number): The level/position ID to get enemy teams for

**Example Response:**
```json
{
  "date": 1762932656.4668911,
  "results": [{
    "ident": "body",
    "result": {
      "response": [{
        "userId": 24417949,
        "defense": {
          "powerSum": 1048206,
          "units": {
            "9": {
              "id": 9,
              "level": 130,
              "star": 6,
              "power": 169909,
              "color": 18,
              "favorPetId": 6006,
              "favorPower": 11064
            },
            "48": {
              "id": 48,
              "level": 130,
              "star": 6,
              "power": 195511,
              "color": 18,
              "favorPetId": 6005,
              "favorPower": 11064
            },
            "40": {
              "id": 40,
              "level": 130,
              "star": 6,
              "power": 139207,
              "color": 18,
              "favorPetId": 0,
              "favorPower": 0
            },
            "43": {
              "id": 43,
              "level": 130,
              "star": 6,
              "power": 157387,
              "color": 18,
              "favorPetId": 6008,
              "favorPower": 7301
            },
            "16": {
              "id": 16,
              "level": 130,
              "star": 6,
              "power": 204249,
              "color": 18,
              "favorPetId": 6004,
              "favorPower": 10154
            },
            "6006": {
              "id": 6006,
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
              "1": 29,
              "2": 41,
              "0": 65
            }
          }
        },
        "defenseState": {
          "9": {
            "hp": 348525,
            "energy": 0,
            "isDead": false,
            "maxHp": 348525
          },
          "48": {
            "hp": 566017,
            "energy": 0,
            "isDead": false,
            "maxHp": 566017
          },
          "40": {
            "hp": 386912,
            "energy": 0,
            "isDead": false,
            "maxHp": 386912
          },
          "43": {
            "hp": 343417,
            "energy": 0,
            "isDead": false,
            "maxHp": 343417
          },
          "16": {
            "hp": 449732,
            "energy": 0,
            "isDead": false,
            "maxHp": 449732
          },
          "6006": {
            "hp": -1,
            "energy": 0,
            "isDead": false,
            "maxHp": -1
          }
        },
        "healed": null
      }]
    }
  }]
}
```

**Response Fields:**
- Array of enemy teams at the specified level
- `defense`: Defense team composition with heroes, pets, and banner
- `defenseState`: Current state of defense team (HP, energy, etc.)

---

### clanDomination_startBattle

Start a battle against a target player in Area of Conquest.

**Request:**
```javascript
Send({
  calls: [{
    name: "clanDomination_startBattle",
    args: {
      targetId: "24417949"
    },
    context: { actionTs: 1205429 },
    ident: "body"
  }]
})
```

**Request Parameters:**
- `targetId` (string | number): The user ID of the target to attack

**Example Response (truncated for readability):**
```json
{
  "date": 1762932658.0034771,
  "results": [{
    "ident": "body",
    "result": {
      "response": {
        "battle": {
          "userId": "35979991",
          "typeId": 24417949,
          "attackers": {
            "1": {
              "id": 62,
              "level": 130,
              "star": 6,
              "power": 163592,
              "color": 18,
              "petId": 6008,
              "type": "hero",
              "state": {
                "hp": 426584,
                "energy": 0,
                "isDead": false,
                "maxHp": 426584
              }
            },
            "2": {
              "id": 29,
              "level": 130,
              "star": 6,
              "power": 96656,
              "color": 18,
              "petId": 6002,
              "type": "hero",
              "state": {
                "hp": 341941,
                "energy": 0,
                "isDead": false,
                "maxHp": 341941
              }
            },
            "6": {
              "id": 6008,
              "level": 130,
              "star": 6,
              "power": 181943,
              "type": "pet",
              "state": {
                "hp": -1,
                "energy": 0,
                "isDead": false,
                "maxHp": -1
              }
            }
          },
          "defenders": [{
            "1": {
              "id": 9,
              "level": 130,
              "star": 6,
              "power": 169909,
              "color": 18,
              "petId": 6006,
              "type": "hero",
              "state": {
                "hp": 348525,
                "energy": 0,
                "isDead": false,
                "maxHp": 348525
              }
            },
            "2": {
              "id": 48,
              "level": 130,
              "star": 6,
              "power": 195511,
              "color": 18,
              "petId": 6005,
              "type": "hero",
              "state": {
                "hp": 566017,
                "energy": 0,
                "isDead": false,
                "maxHp": 566017
              }
            }
          }],
          "effects": {
            "defenders": {
              "percentBuffByPerk_energyIncrease_4": 10,
              "percentBuffAll_physicalAttack": 5,
              "percentBuffAll_armor": 9.5,
              "percentBuffAll_armorPenetration": 6
            },
            "defendersBanner": {
              "id": 1,
              "slots": {
                "1": 29,
                "2": 41,
                "0": 65
              }
            },
            "attackers": {
              "levelDecreaseAuraOnEnemy_8_18_400": 2,
              "percentBuffAll_magicPower": 16,
              "redPatternScaling": 3,
              "percentBuffAll_armor": 14,
              "percentDebuffAllEnemy_physicalCritChance": 16.5
            },
            "attackersBanner": {
              "id": 6,
              "slots": [15, 45, 79]
            }
          },
          "reward": [],
          "startTime": 1762932657,
          "seed": 3167111373,
          "type": "clan_domination",
          "id": "1762932657569315883",
          "progress": [{
            "v": 273,
            "b": 0,
            "seed": 3167111373,
            "attackers": {
              "input": [],
              "heroes": {
                "6": {
                  "hp": -1,
                  "energy": 506,
                  "isDead": false
                },
                "1": {
                  "hp": 374710,
                  "energy": 0,
                  "isDead": false
                }
              }
            },
            "defenders": {
              "input": [],
              "heroes": {
                "6": {
                  "hp": -1,
                  "energy": 439,
                  "isDead": false
                }
              }
            }
          }],
          "endTime": 1762932657,
          "result": {
            "win": true,
            "stars": 3,
            "serverVersion": 273
          }
        },
        "reward": {
          "coin": {
            "46": 100
          }
        },
        "attackersState": {
          "62": {
            "hp": 374710,
            "energy": 0,
            "isDead": false,
            "maxHp": 426584
          },
          "29": {
            "hp": 67773,
            "energy": 603,
            "isDead": false,
            "maxHp": 341941
          },
          "58": {
            "hp": 554696,
            "energy": 1000,
            "isDead": false,
            "maxHp": 561958
          },
          "40": {
            "hp": 410924,
            "energy": 1000,
            "isDead": false,
            "maxHp": 470771
          },
          "56": {
            "hp": 392296,
            "energy": 552,
            "isDead": false,
            "maxHp": 397431
          },
          "6008": {
            "hp": -1,
            "energy": 506,
            "isDead": false,
            "maxHp": -1
          }
        },
        "defendersState": {
          "9": {
            "isDead": true,
            "hp": 0,
            "energy": 0,
            "maxHp": 348525
          },
          "48": {
            "isDead": true,
            "hp": 0,
            "energy": 0,
            "maxHp": 566017
          },
          "40": {
            "isDead": true,
            "hp": 0,
            "energy": 0,
            "maxHp": 386912
          },
          "43": {
            "isDead": true,
            "hp": 0,
            "energy": 0,
            "maxHp": 343417
          },
          "16": {
            "isDead": true,
            "hp": 0,
            "energy": 0,
            "maxHp": 449732
          },
          "6006": {
            "hp": -1,
            "energy": 439,
            "isDead": false,
            "maxHp": -1
          }
        },
        "refillable": {
          "id": 55,
          "amount": 10,
          "lastRefill": 1762932312,
          "boughtToday": 0,
          "refillTime": 720
        },
        "quests": [
          {
            "id": "1779403298",
            "state": 3,
            "progress": 11,
            "reward": {
              "coin": {
                "46": "200"
              }
            },
            "createTime": 1762740095
          },
          {
            "id": "1779403303",
            "state": 1,
            "progress": 11,
            "reward": {
              "coin": {
                "46": "1000"
              },
              "consumable": {
                "470": "1"
              }
            },
            "createTime": 1762740095
          }
        ]
      }
    }
  }]
}
```

**Response Fields:**
- `battle`: Complete battle data including:
  - `attackers`: Your team composition
  - `defenders`: Enemy team composition
  - `result`: Battle outcome with `win`, `stars`, and `serverVersion`
- `reward`: Rewards earned from the battle
- `attackersState`: Final state of your team after battle
- `defendersState`: Final state of enemy team after battle
- `refillable`: Updated movement energy/charges
- `quests`: Updated quest progress

**Notes:**
- The battle result is calculated server-side and returned immediately
- Battle consumes movement energy (refillable id: 55)
- Winning battles can reward coins and contribute to quest progress
- Battle type is `"clan_domination"`

---

### clanDomination_heal

Heal your team in Area of Conquest. This API is used to restore HP to heroes after battles.

**Request:**
```javascript
Send({
  calls: [{
    name: "clanDomination_heal",
    args: {},
    context: { actionTs: 1758453 },
    ident: "body"
  }]
})
```

**Request Parameters:**
- No parameters required (empty `args` object)

**Example Response:**
```json
{
  "date": 1762933210.8294661,
  "results": [{
    "ident": "body",
    "result": {
      "response": null
    }
  }]
}
```

**Response Fields:**
- `response`: Returns `null` on success

**Notes:**
- This API heals your team's heroes after battles
- The response is `null` when the heal action is successful
- Healing may have cooldown or resource requirements (check game mechanics)
- Typically used after battles to restore HP before the next engagement

---

## Reference Tables

### Hero ID Reference

The following table provides a reference for Hero IDs used throughout the Hero Wars API. These IDs may be referenced in reward responses or other API calls.

| ID | Hero Name |
|----|-----------|
| 1 | Aurora |
| 2 | Galahad |
| 3 | Keira |
| 4 | Astaroth |
| 5 | Kai |
| 6 | Phobos |
| 7 | Thea |
| 8 | Daredevil |
| 9 | Heidi |
| 10 | Faceless |
| 11 | Chabba |
| 12 | Arachne |
| 13 | Orion |
| 14 | Fox |
| 15 | Ginger |
| 16 | Dante |
| 17 | Mojo |
| 18 | Judge |
| 19 | Dark Star |
| 20 | Artemis |
| 21 | Markus |
| 22 | Peppy |
| 23 | Lian |
| 24 | Cleaver |
| 25 | Ishmael |
| 26 | Lilith |
| 27 | Luther |
| 28 | Qing Mao |
| 29 | Dorian |
| 30 | Cornelius |
| 31 | Jet |
| 32 | Helios |
| 33 | Lars |
| 34 | Krista |
| 35 | Jorgen |
| 36 | Maya |
| 37 | Jhu |
| 38 | Elmir |
| 39 | Ziri |
| 40 | Nebula |
| 41 | K'arkh |
| 42 | Rufus |
| 43 | Celeste |
| 44 | Astrid and Lucas |
| 45 | Satori |
| 46 | Martha |
| 47 | Andvari |
| 48 | Sebastian |
| 49 | Yasmine |
| 50 | Corvus |
| 51 | Morrigan |
| 52 | Isaac |
| 53 | Alvanor |
| 54 | Tristan |
| 55 | Iris |
| 56 | Amira |
| 57 | Fafnir |
| 58 | Aidan |
| 59 | Kayla |
| 60 | Mushy and Shroom |
| 61 | Julius |
| 62 | Polaris |
| 63 | Lara Croft |
| 64 | Augustus |
| 65 | Ninja Turtles |
| 66 | Folio |
| 67 | Lyria |
| 68 | Guus |
| 69 | Cascade |
| 70 | Electra von Grave |

---

### Timer/Cooldown ID Reference

The following table provides a reference for Timer/Cooldown IDs used throughout the Hero Wars API. These IDs are used to track various game timers, cooldowns, and reset mechanisms.

| ID | Identifier | Description |
|----|------------|-------------|
| 1 | stamina | Stamina refill timer |
| 2 | skill_point | Skill point refill timer |
| 3 | bronzeFreeChest | Bronze free chest timer |
| 4 | goldFreeChest | Gold free chest timer |
| 5 | arena_cooldown | Arena cooldown timer |
| 6 | arena_battle | Arena battle attempts |
| 7 | nicknameChangeCooldown | Nickname change cooldown |
| 8 | timezoneChangeCooldown | Timezone change cooldown |
| 9 | eliteMission | Elite mission attempts |
| 10 | shopReset_merchant | Merchant shop reset |
| 11 | shopReset_goblin | Goblin shop reset |
| 12 | shopReset_godfather | Godfather shop reset |
| 13 | shopReset_arena | Arena shop reset |
| 14 | shopReset_grandArena | Grand Arena shop reset |
| 15 | shopReset_crusade | Crusade shop reset |
| 16 | shopReset_guild | Guild shop reset |
| 17 | shopReset_soulShop | Soul shop reset |
| 19 | alchemy | Alchemy attempts |
| 20 | grand_arena_cooldown | Grand Arena cooldown timer |
| 21 | grand_arena_battle | Grand Arena battle attempts |
| 22 | shopReset_socialShop | Social shop reset |
| 23 | trial_chrono_gold | Chrono Gold trial attempts |
| 24 | trial_chrono_gold_cooldown | Chrono Gold trial cooldown |
| 25 | trial_chrono_exp | Chrono EXP trial attempts |
| 26 | trial_chrono_exp_cooldown | Chrono EXP trial cooldown |
| 27 | trial_phys | Physical trial attempts |
| 28 | trial_phys_cooldown | Physical trial cooldown |
| 29 | trial_mag | Magic trial attempts |
| 30 | trial_mag_cooldown | Magic trial cooldown |
| 31 | trial_perk | Perk trial attempts |
| 32 | trial_perk_cooldown | Perk trial cooldown |
| 33 | clanReenter_cooldown | Clan re-enter cooldown |
| 34 | clanAdmire | Clan admire attempts |
| 35 | diamondFreeChest | Diamond free chest timer |
| 36 | boss_battle | Boss battle attempts |
| 37 | chest_town | Town chest reset |
| 38 | shopReset_boss | Boss shop reset |
| 39 | boss_cooldown | Boss cooldown timer |
| 40 | lootBox_egg_blue | Blue egg loot box timer |
| 41 | lootBox_egg_purple | Purple egg loot box timer |
| 42 | lootBox_egg_orange | Orange egg loot box timer |
| 43 | shopReset_gvg | Guild War shop reset |
| 44 | shopReset_titanArtifact | Titan Artifact shop reset |
| 45 | adventure | Adventure attempts |
| 46 | shopReset_petSoulShop | Pet Soul shop reset |
| 47 | ascensionChest_free | Free ascension chest timer |
| 48 | brawl_battle | Brawl battle attempts |
| 49 | newGacha_key | New gacha key timer |
| 50 | shopReset_merchantPromo | Merchant promo shop reset |
| 51 | shopReset_merchantPromoV2 | Merchant promo V2 shop reset |
| 52 | epic_brawl_battle | Epic brawl battle attempts |
| 53 | epic_brawl_battle_reroll | Epic brawl battle reroll |
| 54 | rewardedVideo_cooldown | Rewarded video cooldown |
| 55 | clan_domination | Clan domination timer |
| 56 | leagueArena_battle | League Arena battle attempts |
| 57 | leagueArena_enemyRefresh | League Arena enemy refresh timer |
| 58 | leagueArena_wheelTicket | League Arena wheel ticket timer |
| 59 | leagueArena_battle_altRefresh | League Arena battle alternate refresh |
| 60 | tmntRerollCost | TMNT reroll cost |
| 61 | LavkaRefill | Lavka refill timer |

**Note:** Timer/Cooldown objects typically contain the following properties:
- `id`: The timer ID
- `ident`: The identifier string
- `refillSeconds`: Time in seconds until refill (if applicable)
- `maxValue`: Maximum value array
- `maxRefillCount`: Maximum refill count array
- `refillByReset`: Whether refill resets on daily reset (0 = no, 1 = yes)
- `refillCountResetLocalTime`: Array indicating local time reset
- `serverTimeRefill`: Whether server time is used for refill (if applicable)

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
- `REWARDS_API_DOCUMENTATION.md` - Consolidated into Special Offers section and Reference Tables section

For the most up-to-date API documentation, refer to this consolidated document.

