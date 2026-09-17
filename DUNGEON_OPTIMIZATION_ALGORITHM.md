# Dungeon Optimization Algorithm Documentation

## Overview

The Dungeon Optimization Algorithm is an advanced automated system for maximizing titanite collection in Hero Wars Dungeon mode while ensuring titan survival. The algorithm uses sophisticated recovery-based team selection, parallel battle simulation, and iterative refinement to achieve optimal results.

**Primary Goals:**
1. **Maximize Titanite Collection** - Collect as much titanite as possible within the target limit
2. **Prevent Titan Deaths** - Ensure all battles result in 3-star victories (no titan deaths)
3. **Optimize Recovery** - Maximize titan health and energy recovery after each battle
4. **Efficient Resource Usage** - Minimize time and prediction card usage

## Algorithm Architecture

### Core Components

```
┌─────────────────────────────────────────────────────────┐
│                    executeDungeon                       │
│  (Main Controller - Initializes and coordinates)        │
└─────────────────┬───────────────────────────────────────┘
                  │
        ┌─────────┴─────────┐
        │                   │
┌───────▼────────┐  ┌───────▼────────┐
│  checkFloor    │  │  startDungeon  │
│  (Floor Logic) │  │  (Init Teams)  │
└───────┬────────┘  └───────────────┘
        │
        │
┌───────▼──────────────────────────────────────┐
│           chooseElement                      │
│  (Routes to element-specific strategies)     │
└───────┬──────────────────────────────────────┘
        │
    ┌───┴───┬────────┬────────┬────────┐
    │       │        │        │        │
┌───▼───┐ ┌──▼──┐  ┌──▼──┐ ┌──▼──┐ ┌──▼──┐
│ Hero  │ │Water│  │Earth│ │Fire │ │Neutral│
│Direct │ │Direct│ │Opt  │ │Opt  │ │Complex│
└───────┘ └────┘   └─────┘ └─────┘ └──────┘
```

## Core Concepts

### 1. Recovery System

**Recovery** is the primary metric used to evaluate battle outcomes. It represents the net change in titan combat effectiveness after a battle.

**Recovery Formula:**
```
Recovery = AfterSumFactor - BeforeSumFactor
```

Where:
- **AfterSumFactor**: Sum of all titan factors after battle
- **BeforeSumFactor**: Sum of all titan factors before battle

**Titan Factor Calculation:**
```javascript
factor = percentHP + energyBonus
```

For Earth/Fire titans: `factor = percentHP + energyBonus`
For other titans: `factor = (percentHP + energyBonus) / 10`

**Energy Bonus:**
- Hyperion (4020) at full energy (1000): `+0.1`
- Other titans: `energy / 20000.0`

### 2. Team Selection Priority

The algorithm prioritizes element types in this order:
1. **Hero** - Direct attack, no optimization needed
2. **Water** - Direct attack, no optimization needed
3. **Earth** - Optimized selection (tests multiple team combinations)
4. **Fire** - Optimized selection (tests multiple team combinations)
5. **Neutral** - Most complex optimization (tests hundreds of combinations)

### 3. Battle Safety Checks

Before accepting a battle result, the algorithm verifies:

1. **3-Star Victory** - `result.stars >= 3` (no titan deaths)
2. **Titan Health Thresholds** - Each titan must meet minimum health requirements:
   - **Hyperion (4020)**: HP > 25% OR (energy == 1000 AND HP > 5%)
   - **Moloch (4010)**: HP% + energy/2000 > 0.63
   - **Angus (4000)**: HP > 62% OR specific HP/energy combinations
   - **Others**: No special requirements

## Attack Strategies by Element

### Strategy 1: Hero/Water (Direct Attack)

**Complexity:** Low  
**Optimization:** None

```javascript
case 'hero':
case 'water':
    result = await startBattle(teamNum, attackerType, teams[attackerType]);
```

- Uses predefined team composition
- No battle simulation or optimization
- Fastest execution path

**Team Composition:**
- **Hero**: Heroes (< 6000) + Pet (>= 6000)
- **Water**: [4000, 4001, 4002, 4003] (filtered by alive status)

### Strategy 2: Earth/Fire (Optimized Selection)

**Complexity:** Medium  
**Optimization:** Team composition testing

**Process:**
1. **Initial Selection** (`chooseEarthOrFire`):
   - Tests up to 4 different team compositions
   - Each composition tests 25 battle simulations
   - Selects team with best recovery

2. **Team Composition Testing** (`attemptAttackEarthOrFire`):
   ```javascript
   startIndex = team.heroes.length + attempt - 4
   team.heroes = team.heroes.slice(startIndex)
   ```
   - Attempt 0: Uses last 4 titans
   - Attempt 1: Uses last 3 titans
   - Attempt 2: Uses last 2 titans
   - Attempt 3: Uses last 1 titan

3. **Recovery Refinement** (`findAttack`):
   - Iteratively runs battles until target recovery is met
   - Adjusts target recovery by 0.01 per iteration
   - Continues until actual recovery >= target recovery

**Team Composition:**
- **Earth**: [4020, 4022, 4021, 4023, 4024] (filtered by alive status)
- **Fire**: [4010, 4011, 4012, 4013, 4014] (filtered by alive status)

### Strategy 3: Neutral (Complex Optimization)

**Complexity:** High  
**Optimization:** Extensive team combination testing

**Two-Phase Approach:**

#### Phase 1: Fast Mode (`mode = true`)
- Tests top 4 readiness factors
- Tests common combinations:
  - Single factor titans
  - Factor pairs with water titans (4001, 4002, 4003)
  - Aragi (4013) combinations
  - Eden (4023) + Aragi combinations

#### Phase 2: Full Mode (`mode = false`)
- Only executed if fast mode fails or recovery < 0.2
- Tests all possible combinations:
  - All factor titans
  - Factor + Aragi combinations
  - Factor + Dark titans (4032, 4033)
  - Factor + Light titans (4042)
  - Factor + Factor combinations
  - Dark titan combinations
  - Light titan combinations

**Readiness Factor Calculation:**
```javascript
factor = (titan.hp / titan.maxHp) + (titan.energy / 10000.0)
```

Factors are sorted ascending (weakest titans first).

**Neutral Team Building:**
- Base: Water team (4 titans)
- Add: Neutral titan(s) based on combinations
- Swap: Replace water titans with other elements if needed

**Team Composition:**
- **Neutral**: [4023, 4022, 4012, 4021, 4011, 4010, 4020, 4024, 4014]

## Recovery Calculation System

### Function: `getRecovery(result)`

**Purpose:** Calculate the net recovery value for a battle result.

**Process:**
1. **Safety Check**: Returns -100 if battle didn't achieve 3 stars
2. **Calculate After Factor**: Sum of all titan factors after battle
3. **Calculate Before Factor**: Sum of all titan factors before battle
4. **Return Difference**: `afterSumFactor - beforeSumFactor`

**Titan Factor Calculation** (`getFactor`):
```javascript
function getFactor(id, energy, percentHP) {
    let elemantId = id.slice(2, 3);
    let isEarthOrFire = elemantId == '1' || elemantId == '2';
    let energyBonus = id == '4020' && energy == 1000 ? 0.1 : energy / 20000.0;
    let factor = percentHP + energyBonus;
    return isEarthOrFire ? factor : factor / 10;
}
```

**Key Points:**
- Earth/Fire titans (IDs ending in 1 or 2) have 10x weight
- Hyperion (4020) gets special bonus at full energy
- Other titans have reduced weight (1/10)

### Function: `checkTitan(id, energy, percentHP)`

**Purpose:** Verify if a titan meets minimum safety requirements.

**Safety Thresholds:**

| Titan ID | Name | Requirement |
|----------|------|-------------|
| 4020 | Hyperion | HP > 25% OR (energy == 1000 AND HP > 5%) |
| 4010 | Moloch | HP% + energy/2000 > 0.63 |
| 4000 | Angus | HP > 62% OR (energy < 1000 AND specific HP/energy thresholds) |
| Others | - | No special requirements (always true) |

## Battle Optimization Process

### 1. Battle Simulation

**Function:** `startBattle(teamNum, attackerType, args)`

**Process:**
1. Creates API call to `dungeonStartBattle`
2. Sends battle request
3. Receives battle data
4. Simulates battle using `BattleCalc`
5. Returns battle result promise

**Battle Simulation Settings:**
```javascript
battleData.progress = [{ attackers: { input: ['auto', 0, 0, 'auto', 0, 0] } }];
```
- Auto skill usage enabled
- Manual skill timing disabled

### 2. Parallel Battle Testing

**Function:** `getBestRecovery(teamNum, attackerType, team, countBattle)`

**Purpose:** Test multiple battle outcomes in parallel to find best recovery.

**Process:**
1. Creates array of battle promises (typically 25 battles)
2. Executes all battles in parallel using `Promise.all()`
3. Calculates recovery for each result
4. Returns best recovery value

**Advantages:**
- Fast execution (parallel processing)
- Statistical sampling (25 battles gives good average)
- Finds optimal RNG outcomes

### 3. Iterative Refinement

**Function:** `findAttack(teamNum, attackerType, team)`

**Purpose:** Iteratively refine battle result until target recovery is met.

**Process:**
```javascript
for (let needRecovery = bestBattle.recovery; 
     recovery < needRecovery; 
     needRecovery -= correction) {
    result = await startBattle(teamNum, attackerType, team);
    recovery = getRecovery(result);
}
```

**Parameters:**
- `correction = 0.01` - Adjustment per iteration
- Continues until `recovery >= needRecovery`

**Purpose:**
- Accounts for RNG variance in battle outcomes
- Ensures consistent recovery levels
- Prevents accepting suboptimal results

## Floor Processing Flow

### Function: `checkFloor(dungeonInfo)`

**Main Loop Logic:**

```
1. Check Completion
   ├─ Floor state == 2 → Save progress → Return
   └─ Continue

2. Check Talent Rewards
   └─ checkTalent(dungeonInfo)

3. Check Activity Limit
   ├─ dungeonActivity >= maxDungeonActivity → End dungeon
   └─ Continue

4. Check Stop Flag
   ├─ stopDung == true → End dungeon
   └─ Continue

5. Select Element
   ├─ Multiple floor choices → Priority selection
   │   ├─ Hero → Direct attack
   │   ├─ Water → Direct attack
   │   ├─ Earth → Optimized selection
   │   ├─ Fire → Optimized selection
   │   └─ Neutral → Complex optimization
   └─ Single floor choice → Direct attack

6. Execute Battle
   └─ chooseElement(attackerType, teamNum)
```

### Element Selection Priority

When multiple floor choices are available:

```javascript
for (let element in teams) {
    let teamNum = findElement(floorChoices, element);
    if (!!teamNum) {
        // Found matching element, use it
        chooseElement(floorChoices[teamNum].attackerType, teamNum);
        return;
    }
}
```

**Priority Order:**
1. Hero
2. Water
3. Earth (with special optimization)
4. Fire
5. Neutral

## Special Features

### 1. Talent Reward Collection

**Function:** `checkTalent(dungeonInfo)`

**Purpose:** Automatically collect TMNT (Teenage Mutant Ninja Turtles) talent rewards.

**Process:**
1. Checks if current floor matches talent floor
2. Verifies doors amount (must be < 3)
3. Checks if reward already collected
4. Collects reward via API calls:
   - `heroTalent_getReward`
   - `heroTalent_farmReward`
5. Updates UI message with reward info

**Display:**
```
TMNT Talent: 2/3
 50 Gold
 10 Energy
```

### 2. Prediction Card Usage

**Purpose:** Skip battle timers using prediction cards.

**Process:**
```javascript
if (countPredictionCard > 0) {
    args.isRaid = true;
    countPredictionCard--;
} else {
    await countdownTimer(timer, message);
}
```

**Benefits:**
- Faster dungeon completion
- Automatic resource management
- Only uses cards when available

### 3. Statistics Tracking

**Function:** `showStats()`

**Tracks:**
- Total titanite collected
- Collection speed (titanite/hour)
- Time spent in different phases:
  - `all` - Total time
  - `findAttack` - Time finding optimal attacks
  - `attackNeutral` - Time optimizing neutral attacks
  - `attackEarthOrFire` - Time optimizing earth/fire attacks
- Team usage frequency

## Key Functions Reference

### Core Functions

| Function | Purpose | Complexity |
|----------|---------|-----------|
| `executeDungeon` | Main controller | High |
| `startDungeon` | Initialize teams and data | Medium |
| `checkFloor` | Process current floor | High |
| `chooseElement` | Route to element strategy | Medium |
| `getRecovery` | Calculate recovery value | Medium |
| `getFactor` | Calculate titan factor | Low |
| `checkTitan` | Verify titan safety | Low |

### Element-Specific Functions

| Function | Element | Purpose |
|----------|--------|---------|
| `attackNeutral` | Neutral | Complex optimization |
| `findBestBattleNeutral` | Neutral | Test team combinations |
| `attackEarthOrFire` | Earth/Fire | Optimized selection |
| `chooseEarthOrFire` | Earth | Select best option |
| `attemptAttackEarthOrFire` | Earth/Fire | Test team composition |

### Battle Functions

| Function | Purpose |
|----------|---------|
| `startBattle` | Initiate battle simulation |
| `resultBattle` | Process battle result |
| `endBattle` | Complete battle and wait timer |
| `getBestRecovery` | Test multiple battles in parallel |
| `findAttack` | Iteratively refine battle result |

### Utility Functions

| Function | Purpose |
|----------|---------|
| `getTitanTeam` | Get team for element type |
| `calcFactor` | Calculate titan readiness factors |
| `getNeutralTeam` | Build neutral team composition |
| `clone` | Deep copy object |
| `findElement` | Find element in floor choices |

## Algorithm Flow Examples

### Example 1: Simple Water Attack

```
1. checkFloor() → Finds water element
2. chooseElement('water', 0)
3. startBattle(0, 'water', teams.water)
4. resultBattle() → Simulates battle
5. endBattle() → Checks 3 stars, waits timer
6. resultEndBattle() → Updates activity, continues
```

**Time:** ~5-10 seconds per battle

### Example 2: Optimized Earth Attack

```
1. checkFloor() → Finds earth element
2. chooseElement('earth', 0)
3. attackEarthOrFire(0, 'earth')
4. attemptAttackEarthOrFire() × 4 attempts
   ├─ Each: getBestRecovery() × 25 battles
   └─ Select best recovery
5. findAttack() → Iterate until recovery met
6. endBattle() → Complete battle
7. resultEndBattle() → Continue
```

**Time:** ~30-60 seconds per battle (optimization overhead)

### Example 3: Complex Neutral Attack

```
1. checkFloor() → Finds neutral element
2. chooseElement('neutral', 0)
3. attackNeutral(0, 'neutral')
4. calcFactor() → Calculate readiness
5. findBestBattleNeutral(mode=true) → Fast mode
   ├─ Test top 4 factors
   ├─ Test common combinations
   └─ ~20-30 battle simulations
6. If recovery insufficient:
   └─ findBestBattleNeutral(mode=false) → Full mode
       ├─ Test all factors
       ├─ Test all combinations
       └─ ~100-200 battle simulations
7. findAttack() → Iterate until recovery met
8. endBattle() → Complete battle
9. resultEndBattle() → Continue
```

**Time:** ~60-120 seconds per battle (extensive optimization)

## Performance Characteristics

### Time Complexity

| Element | Optimization | Average Time | Battle Simulations |
|---------|-------------|--------------|-------------------|
| Hero | None | 5-10s | 1 |
| Water | None | 5-10s | 1 |
| Earth | Medium | 30-60s | 25-100 |
| Fire | Medium | 30-60s | 25-100 |
| Neutral | High | 60-120s | 100-200+ |

### Space Complexity

- **Team Storage**: O(1) - Fixed number of teams
- **Battle Results**: O(n) - Where n = number of parallel battles
- **Factor Array**: O(m) - Where m = number of neutral titans

### Optimization Trade-offs

**Fast Mode (Neutral):**
- ✅ Faster execution (~20-30 battles)
- ✅ Good for most situations
- ❌ May miss optimal combinations

**Full Mode (Neutral):**
- ✅ Exhaustive search
- ✅ Best possible recovery
- ❌ Slower execution (~100-200 battles)
- ❌ Only used when fast mode fails

## Error Handling

### Safety Mechanisms

1. **Titan Death Prevention:**
   - Always requires 3-star victory
   - Checks titan health thresholds
   - Stops dungeon if death risk detected

2. **Recovery Validation:**
   - Negative recovery = failed battle
   - Recovery < -10 = unacceptable
   - Iterative refinement ensures minimum recovery

3. **Connection Loss:**
   - Detects missing API responses
   - Ends dungeon gracefully
   - Shows error message to user

4. **Impossible Battles:**
   - Detects when no safe battle exists
   - Ends dungeon with error message
   - Prevents infinite loops

## Configuration Parameters

### Tunable Values

| Parameter | Default | Purpose |
|-----------|---------|---------|
| `maxDungeonActivity` | 150 | Target titanite amount |
| `limitDungeonActivity` | 30180 | Maximum possible titanite |
| `countBattle` (Earth/Fire) | 25 | Number of parallel battles |
| `correction` (findAttack) | 0.01 | Recovery refinement step |
| `attempts` (Earth/Fire) | 4 | Maximum team composition attempts |

### Team Compositions

**Neutral Titans:**
```javascript
[4023, 4022, 4012, 4021, 4011, 4010, 4020, 4024, 4014]
```

**Water Titans:**
```javascript
[4000, 4001, 4002, 4003]
```

**Earth Titans:**
```javascript
[4020, 4022, 4021, 4023, 4024]
```

**Fire Titans:**
```javascript
[4010, 4011, 4012, 4013, 4014]
```

## Best Practices

### When to Use

✅ **Optimal Scenarios:**
- Long dungeon runs (1000+ titanite)
- Multiple neutral floors
- Need maximum titanite collection
- Have prediction cards available

⚠️ **Consider Alternatives:**
- Short runs (< 500 titanite)
- Only hero/water floors
- Time-sensitive situations
- Limited prediction cards

### Optimization Tips

1. **Prediction Cards:**
   - Save for neutral floors (longest optimization)
   - Use automatically when available
   - Speeds up completion significantly

2. **Activity Limits:**
   - Set realistic targets
   - Consider time constraints
   - Monitor collection speed

3. **Team Preparation:**
   - Ensure all titans are alive
   - Level up key titans (Hyperion, Moloch, Angus)
   - Upgrade titan artifacts

## Limitations

1. **RNG Dependency:**
   - Battle outcomes have randomness
   - May require multiple iterations
   - Cannot guarantee perfect recovery

2. **Time Consumption:**
   - Neutral optimization is slow
   - Full mode can take 2+ minutes per battle
   - May not be suitable for time-limited runs

3. **Resource Usage:**
   - Uses prediction cards automatically
   - May consume all available cards
   - No manual control over card usage

4. **Complexity:**
   - Hard to debug issues
   - Many interdependent functions
   - Requires understanding of recovery system

## Future Improvements

### Potential Enhancements

1. **Adaptive Optimization:**
   - Adjust battle count based on recovery variance
   - Skip optimization for easy floors
   - Learn from previous battles

2. **Configuration Options:**
   - User-selectable optimization levels
   - Manual prediction card control
   - Custom recovery thresholds

3. **Performance Optimization:**
   - Cache battle results
   - Parallel floor processing
   - Reduce redundant calculations

4. **Enhanced Statistics:**
   - Real-time recovery tracking
   - Success rate monitoring
   - Optimal team recommendations

## Conclusion

The Dungeon Optimization Algorithm represents a sophisticated approach to automated dungeon farming. By prioritizing recovery optimization and titan safety, it achieves high titanite collection rates while preventing titan deaths. The multi-strategy approach ensures efficient execution for different floor types, with the most complex optimization reserved for challenging neutral floors.

The algorithm's strength lies in its ability to:
- **Adapt** to different floor types
- **Optimize** team selection for maximum recovery
- **Protect** titans from death
- **Efficiently** use available resources

While the algorithm is complex, it provides significant value for players seeking to maximize their dungeon farming efficiency.

