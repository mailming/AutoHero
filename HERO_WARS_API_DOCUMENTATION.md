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
  userId: number,
  gold: number,
  emerald: number,
  starMoney: number,
  stamina: number,
  arenaAttempts: number,
  arenaPlace: number,
  grandAttempts: number,
  grandPlace: number,
  // ... many more fields
}
```

**Example Usage:**
```javascript
const userInfo = await Send('{"calls":[{"name":"userGetInfo","args":{},"ident":"body"}]}')
  .then(e => e.results[0].result.response);

console.log(`Gold: ${userInfo.gold}`);
console.log(`Arena attempts: ${userInfo.arenaAttempts}`);
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

Attack a slot in guild war.

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

Get all boss information.

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

## Additional Resources

- See `COW_API_DOCUMENTATION.md` for Cross Clan War API details
- See `GUILD_WAR_API_DOCUMENTATION.md` for Guild War API details
- See `CLAN_RAID_API_DOCUMENTATION.md` for Clan Raid API details

