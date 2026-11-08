# Quest Farm API Documentation

## Overview

The Quest Farm API allows you to collect rewards from completed quests in Hero Wars. This documentation is based on actual API calls captured from the game.

## Base URL

```
https://heroes-wb.nextersglobal.com/api/
```

## Authentication Headers

All requests require the following authentication headers:

- `x-auth-application-id`: Application ID (typically `3`)
- `x-auth-network-ident`: Network identifier (typically `web`)
- `x-auth-player-id`: Player ID
- `x-auth-session-id`: Session ID
- `x-auth-session-key`: Session key (may be empty)
- `x-auth-signature`: Request signature
- `x-auth-token`: Authentication token
- `x-auth-user-id`: User ID
- `x-env-library-version`: Library version (typically `1`)
- `x-env-unique-session-id`: Unique session ID
- `x-env-unique-session-uuid`: Unique session UUID
- `x-full-referer`: Full referer URL
- `x-request-id`: Request ID
- `x-requested-with`: `XMLHttpRequest`
- `x-server-time`: Server time (typically `0`)

## API Endpoints

### questFarm

Collects rewards from a single completed quest.

**Request:**

```javascript
{
  "calls": [
    {
      "name": "questFarm",
      "args": {
        "questId": 1795404150
      },
      "context": {
        "actionTs": 257707
      },
      "ident": "body"
    }
  ]
}
```

**Request Parameters:**

- `name` (string, required): Must be `"questFarm"`
- `args` (object, required):
  - `questId` (number, required): The ID of the quest to collect rewards from
- `context` (object, optional):
  - `actionTs` (number, optional): Timestamp of the action
- `ident` (string, required): Identifier for the request (typically `"body"`)

**Response Structure:**

```javascript
{
  "date": 1765906403.3287449,
  "results": [
    {
      "ident": "body",
      "result": {
        "response": {
          "consumable": {
            "20": 1500  // Item ID: Quantity
          },
          "powerTournamentCoins": 250
        },
        "quests": [
          {
            "id": "1795404200",
            "state": 2,  // 2 = completed, ready to collect
            "progress": 5,
            "reward": {
              "powerTournamentCoins": 100
            },
            "createTime": 1765768575,
            "farmCount": 0
          },
          {
            "id": "1795404201",
            "state": 1,  // 1 = in progress
            "progress": 5,
            "reward": {
              "powerTournamentCoins": 150
            },
            "createTime": 1765768575,
            "farmCount": 0
          }
          // ... more quests
        ]
      }
    }
  ]
}
```

**Response Fields:**

- `date` (number): Server timestamp
- `results` (array): Array of result objects
  - `ident` (string): Matches the request `ident`
  - `result.response` (object): The actual response data
    - `consumable` (object, optional): Consumable items received (item ID as key, quantity as value)
    - `powerTournamentCoins` (number, optional): Power tournament coins received
    - `coin` (object, optional): Coins received (coin type ID as key, quantity as value)
    - `quests` (array, optional): List of quests that were updated/unlocked as a result of collecting this reward
      - `id` (string): Quest ID
      - `state` (number): Quest state
        - `0` = Not started
        - `1` = In progress
        - `2` = Completed (ready to collect)
      - `progress` (number): Current progress value
      - `reward` (object): Reward structure for this quest
      - `createTime` (number): Timestamp when quest was created
      - `farmCount` (number): Number of times this quest has been farmed

**Example Usage:**

```javascript
// Single quest farm
const response = await Send(JSON.stringify({
  calls: [{
    name: "questFarm",
    args: {
      questId: 1795404150
    },
    context: {
      actionTs: Date.now()
    },
    ident: "body"
  }]
}));

const rewards = response.results[0].result.response;
console.log("Received rewards:", rewards);
console.log("New/updated quests:", rewards.quests);
```

---

### quest_questsFarm

Collects rewards from multiple quests in a single batch request. This is more efficient than calling `questFarm` multiple times.

**Request:**

```javascript
{
  "calls": [
    {
      "name": "quest_questsFarm",
      "args": {
        "questIds": [1795404200, 1795404201, 1795404202]
      },
      "context": {
        "actionTs": Date.now()
      },
      "ident": "body"
    }
  ]
}
```

**Request Parameters:**

- `name` (string, required): Must be `"quest_questsFarm"`
- `args` (object, required):
  - `questIds` (array of numbers, required): Array of quest IDs to collect rewards from
- `context` (object, optional):
  - `actionTs` (number, optional): Timestamp of the action
- `ident` (string, required): Identifier for the request

**Response Structure:**

Similar to `questFarm`, but may contain rewards from multiple quests and multiple quest updates.

**Example Usage:**

```javascript
// Batch quest farm
const questIds = [1795404200, 1795404201, 1795404202];
const response = await Send(JSON.stringify({
  calls: [{
    name: "quest_questsFarm",
    args: {
      questIds: questIds
    },
    context: {
      actionTs: Date.now()
    },
    ident: "body"
  }]
}));
```

---

## Quest States

- `0`: Not started - Quest has not been started yet
- `1`: In progress - Quest is active and being worked on
- `2`: Completed - Quest is complete and ready to collect rewards

**Important:** Only quests with `state === 2` can have their rewards collected.

---

## How the Script Farms Quest Rewards

The HeroWarsHelper script uses several strategies to efficiently farm quest rewards:

### 1. Simple Quest Farm (`questAllFarm`)

```javascript
function questAllFarm() {
  // Get all quests
  const quests = await Send({
    calls: [{ name: "questGetAll", args: {}, ident: "body" }]
  });
  
  // Filter completed quests (state === 2) and regular quests (id < 1e6)
  const completedQuests = quests.results[0].result.response.filter(
    q => q.id < 1e6 && q.state === 2
  );
  
  // Collect all rewards
  const calls = completedQuests.map((quest, index) => ({
    name: "questFarm",
    args: { questId: quest.id },
    ident: `group_${index}_body`
  }));
  
  await Send({ calls });
}
```

### 2. Advanced Quest Farm (`rewardsAndMailFarm`)

The more sophisticated `rewardsAndMailFarm` function:

1. **Fetches multiple data sources:**
   - `questGetAll` - All quests
   - `mailGetAll` - Mail letters
   - `specialOffer_getAll` - Special offers
   - `battlePass_getInfo` - Battle pass info
   - `battlePass_getSpecial` - Special battle passes

2. **Filters quests by type:**
   - Regular daily quests: `id < 1e6` and `state === 2`
   - Battle pass quests: Checks battle pass requirements (ticket, level, date)
   - Special quests: `id >= 2e7 && id < 14e8` (uses batch farming)
   - Excludes certain quest ranges: `id >= 2001e4 && id < 14e8`

3. **Uses batch farming for special quests:**
   ```javascript
   if (questId >= 2e7 && questId < 14e8) {
     questIds.push(questId);  // Collect for batch
     continue;
   }
   
   // Later, batch farm them
   if (questIds.length) {
     farmCaller.add({
       name: 'quest_questsFarm',
       args: { questIds },
     });
   }
   ```

4. **Recursive collection:**
   - After collecting rewards, checks for newly unlocked quests
   - Continues collecting until no more quests are available
   - Prevents infinite loops by tracking already-farmed quest IDs

5. **Quest filtering logic:**
   ```javascript
   // Skip certain quest ranges
   if (questId >= 2001e4 && questId < 14e8) {
     continue;
   }
   
   // Handle battle pass quests with special requirements
   if (quest.reward?.battlePassExp && !specialQuests[questId]) {
     // Check battle pass ticket, level, and date requirements
     if (chain.requirement?.battlePassTicket && !battlePass.ticket) {
       continue;  // Skip if ticket required but not owned
     }
     if (chain.requirement?.battlePassLevel && battlePass.level < chain.requirement.battlePassLevel) {
       continue;  // Skip if level requirement not met
     }
     // Check date range
     if (startTime > currentTime || endTime < currentTime) {
       continue;  // Skip if outside date range
     }
   }
   ```

### 3. Quest ID Ranges

The script categorizes quests by ID ranges:

- **Regular daily quests:** `id < 1e6` (1,000,000)
  - Collected individually using `questFarm`
  
- **Special quests (batch):** `id >= 2e7 && id < 2001e4` (20,000,000 to 20,010,000)
  - Collected using `quest_questsFarm` batch API
  
- **Excluded quests:** `id >= 2001e4 && id < 14e8` (20,010,000 to 140,000,000)
  - Skipped entirely
  
- **Other special quests:** `id >= 2e7 && id < 14e8` (20,000,000 to 140,000,000)
  - May be collected individually or in batches depending on context

### 4. Recursive Collection Pattern

```javascript
// Initial collection
const farmResults = await farmCaller.send();

// Extract newly unlocked quests from side results
const sideResult = farmResults.sideResult('questFarm', true);
sideResult.push(...farmResults.sideResult('quest_questsFarm', true));

let questsIds = [];
for (let side of sideResult) {
  const quests = [...(side.newQuests ?? []), ...(side.quests ?? [])];
  for (let quest of quests) {
    if ((quest.id < 1e6 || (quest.id >= 2e7 && quest.id < 2001e4)) && quest.state == 2) {
      questsIds.push(quest.id);
    }
  }
}

// Recursively collect newly unlocked quests
while (questsIds.length) {
  const recursiveCaller = new Caller();
  // ... collect new quests ...
  await recursiveCaller.send();
  // ... check for more new quests ...
}
```

---

## Best Practices

1. **Always check quest state:** Only collect rewards from quests with `state === 2`

2. **Use batch farming for multiple quests:** Use `quest_questsFarm` when collecting multiple quests to reduce API calls

3. **Handle recursive unlocks:** After collecting rewards, check for newly unlocked quests in the response

4. **Filter by quest ID ranges:** Different quest types have different ID ranges and may require different handling

5. **Respect battle pass requirements:** For battle pass quests, verify ticket ownership, level requirements, and date ranges before collecting

6. **Track farmed quests:** Keep a list of already-farmed quest IDs to prevent duplicate collections

---

## Error Handling

The API may return errors in the following cases:

- Quest not found
- Quest not completed (state !== 2)
- Quest already collected
- Invalid quest ID
- Authentication failure

Always check the response for error conditions before processing rewards.

---

## Response Processing in HeroWarsHelper

The script processes quest farm responses to track special items:

### Prediction Cards Tracking

When `questFarm` returns consumable item ID `81` (prediction cards), the script tracks the count:

```javascript
if (call.ident == callsIdent['questFarm']) {
  const consumable = call.result.response?.consumable;
  if (consumable && consumable[81]) {
    HWHData.countPredictionCard += consumable[81];
    console.log(`Cards: ${HWHData.countPredictionCard}`);
  }
}
```

### Batch Quest Farm Processing

For `quest_questsFarm`, the script processes multiple rewards:

```javascript
if (call.ident == callsIdent['quest_questsFarm']) {
  const rewards = call.result.response;
  for (const reward of rewards) {
    if (reward.consumable?.[81]) {
      HWHData.countPredictionCard += reward.consumable[81];
    }
    if (reward.refillable?.[45]) {
      setPortals(+reward.refillable[45], true);  // Portal spheres
    }
  }
}
```

### Side Results and New Quests

The script uses the `Caller` class's `sideResult()` method to extract newly unlocked quests:

```javascript
const sideResult = farmResults.sideResult('questFarm', true);
sideResult.push(...farmResults.sideResult('quest_questsFarm', true));

for (let side of sideResult) {
  const quests = [...(side.newQuests ?? []), ...(side.quests ?? [])];
  // Process newly unlocked quests
}
```

The `sideResult()` method extracts data from the `side` field of API responses, which contains additional information like newly created quests.

---

## Notes

- The `actionTs` in context is optional but recommended for proper timestamp tracking
- The `ident` field can be any string and is used to match requests with responses
- Quest rewards may unlock new quests, so always check the `quests` array in the response
- Some quests may have dependencies that prevent collection until prerequisites are met
- The script uses the `Caller` class for efficient batch API calls with error handling
- The response may include a `side` field with additional data like `newQuests` and `quests` arrays
- Special items like prediction cards (ID 81) and portal spheres (ID 45) are tracked automatically

