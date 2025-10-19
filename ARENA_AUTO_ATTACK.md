# Arena and Grand Arena Auto-Attack Feature

## Overview

This feature adds intelligent automated battle functionality for Arena and Grand Arena in Hero Wars. The system automatically selects the best counter teams, targets the easiest opponents, and maximizes daily arena victories.

## Features

### 🎯 Smart Team Selection
- **Current Team First**: Tries your default arena/grand arena team initially
- **Alternative Teams**: If win rate < 50%, tests top 5 heroes by power
- **Skip Unwinnable**: Only attacks opponents with >30% win probability
- **Battle Simulation**: Pre-calculates win rates before attacking

### 🎮 Intelligent Opponent Selection
- **Easiest Targets First**: Sorts opponents by power ratio and rank
- **Daily Attempts**: Uses all available daily attempts efficiently
- **Victory Focus**: Prioritizes opponents with highest win probability
- **Progress Tracking**: Shows current battle status and victories

### 🔧 Battle Flow
1. **Get Arena Status** → Extract opponents and attempts remaining
2. **Load Team Data** → Get available heroes and teams
3. **Sort Opponents** → Easiest targets first
4. **For Each Attempt**:
   - Select easiest unbeaten opponent
   - Try current team in simulation
   - If losing, try alternative teams
   - Start battle with best team
   - Calculate and complete battle
5. **Report Results** → Total victories achieved

## Usage

### Manual Execution
- **Arena Button**: Individual arena battles
- **Grand Arena Button**: Individual grand arena battles
- **Auto Arena & Grand Arena**: Combined function for both

### Auto-Run Integration
- Added to "Do All" function list
- Runs automatically on page load when enabled
- Excluded from auto mode to prevent infinite loops

## Technical Implementation

### Helper Functions
```javascript
// Calculate win rate for arena battle
async function calcArenaBattleWinRate(attackers, defenders, battleType = 'arena')

// Select best team for opponent
async function selectBestTeamForOpponent(availableTeams, opponentTeam, battleType = 'arena')

// Evaluate opponent difficulty
function evaluateOpponentDifficulty(opponent)
```

### Main Class: executeArena
```javascript
class executeArena {
  constructor(resolve, reject)
  async start(arenaType = 'arena')
  async getArenaStatus()
  async getAvailableTeams()
  findEasiestOpponents()
  async executeBattles()
  async executeBattle(opponent)
  getAvailableTeamsForBattle()
  async startArenaBattle(rivalId, team)
  async endArenaBattle(battleResult)
}
```

### API Integration
- `arenaGetInfo` / `grandGetInfo` - Get arena status and opponents
- `arenaStartBattle` / `grandStartBattle` - Start battles
- `arenaEndBattle` / `grandEndBattle` - Complete battles
- `teamGetAll`, `teamGetFavor`, `heroGetAll` - Team data

## Configuration

### Team Selection Strategy
1. **Current Team**: Uses `teamGetAll.arena` or `teamGetAll.grand`
2. **Alternative Teams**: Top 5 heroes by power if current team fails
3. **Win Rate Threshold**: Minimum 30% win probability to attack
4. **Skip Strategy**: Avoid opponents with no winning team

### Opponent Selection Strategy
1. **Power Ratio**: Calculate `opponent.power / your.power`
2. **Rank Priority**: Lower rank = easier opponent
3. **Difficulty Score**: `powerRatio + (rank / 1000000)`
4. **Sort Order**: Easiest opponents first

## Internationalization

### English
- `ARENA: 'Arena'`
- `GRAND_ARENA: 'Grand Arena'`
- `AUTO_ARENAS: 'Auto Arena & Grand Arena'`
- `ARENA_TITLE: 'Automatically battle in Arena'`
- `GRAND_ARENA_TITLE: 'Automatically battle in Grand Arena'`

### Russian
- `ARENA: 'Арена'`
- `GRAND_ARENA: 'Великая Арена'`
- `AUTO_ARENAS: 'Авто Арена и Великая Арена'`
- `ARENA_TITLE: 'Автоматические бои в Арене'`
- `GRAND_ARENA_TITLE: 'Автоматические бои в Великой Арене'`

## Files Modified

- `HeroWarsHelper.user.js` - Main implementation file (~372 lines added)

## Dependencies

- Existing `BattleCalc` / `Calc` functions for battle simulation
- Existing `Send` function for API calls
- Existing `teamGetAll`, `teamGetFavor` data structures
- Existing `setProgress` for status updates

## Usage Examples

### Manual Arena Battle
```javascript
// Individual arena battle
testArena();

// Individual grand arena battle
testGrandArena();

// Both arenas
testBothArenas();
```

### Auto-Run Integration
```javascript
// Added to doYourBest funcList
{
  name: 'testBothArenas',
  label: I18N('AUTO_ARENAS'),
  checked: false
}

// Added to doYourBest functions
functions = {
  // ... other functions
  testBothArenas,
  // ... other functions
}
```

## Battle Strategy Details

### Team Selection Logic
1. **Try Current Team**: Uses your default arena team
2. **Calculate Win Rate**: Simulates battle with current team
3. **If Win Rate < 50%**: Try alternative teams
4. **Alternative Teams**: Top 5 heroes by power
5. **Skip if No Winner**: Only attack if win rate > 30%

### Opponent Selection Logic
1. **Get All Opponents**: From arena status API
2. **Calculate Difficulty**: Power ratio + rank factor
3. **Sort by Difficulty**: Easiest opponents first
4. **Attack in Order**: Until attempts exhausted

### Battle Execution
1. **Pre-Battle Simulation**: Calculate win probability
2. **Start Battle**: API call with selected team
3. **Battle Calculation**: Use existing BattleCalc system
4. **End Battle**: Complete with results
5. **Track Progress**: Update victory count

## Error Handling

- **API Failures**: Graceful error handling with console logging
- **No Attempts**: Skip execution if no attempts remaining
- **Battle Errors**: Continue with next opponent on failure
- **Team Selection**: Skip opponent if no winning team found

## Performance Considerations

- **Battle Simulation**: Pre-calculates win rates to avoid losses
- **Team Caching**: Reuses team data across battles
- **Progress Updates**: Real-time status updates for user feedback
- **Memory Management**: Proper cleanup of battle data

## Future Enhancements

- **Counter Team Database**: Pre-defined counter strategies
- **Hero Synergy Analysis**: Team composition optimization
- **Battle History**: Track win/loss patterns
- **Advanced Targeting**: More sophisticated opponent selection
