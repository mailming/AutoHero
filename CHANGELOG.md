# Changelog

All notable changes to the HeroWarsHelper project will be documented in this file.

## [Unreleased] - Arena Auto-Attack Feature

### Added
- **Arena Auto-Attack System**: Intelligent automated battle functionality for Arena and Grand Arena
- **Smart Team Selection**: Automatically selects best counter teams with win rate calculation
- **Opponent Difficulty Ranking**: Sorts opponents by power ratio and rank for optimal targeting
- **Battle Simulation**: Pre-calculates win probabilities before attacking to maximize victories
- **Dual Arena Support**: Separate handling for Arena and Grand Arena with appropriate API calls
- **Auto-Run Integration**: Added to "Do All" function for automatic execution on page load
- **Multilingual Support**: English and Russian translations for all arena features

### Technical Implementation
- **Helper Functions**:
  - `calcArenaBattleWinRate()` - Battle win probability calculation
  - `selectBestTeamForOpponent()` - Smart team selection logic
  - `evaluateOpponentDifficulty()` - Opponent difficulty ranking

- **Main Classes**:
  - `executeArena` - Handles both Arena and Grand Arena battles
  - Supports both `arena` and `grand` arena types
  - Full API integration with game's battle system

- **API Integration**:
  - `arenaGetInfo` / `grandGetInfo` - Get arena status and opponents
  - `arenaStartBattle` / `grandStartBattle` - Start battles
  - `arenaEndBattle` / `grandEndBattle` - Complete battles
  - `teamGetAll`, `teamGetFavor`, `heroGetAll` - Team data

### User Interface
- **New Buttons**:
  - Arena - Individual arena battles
  - Grand Arena - Individual grand arena battles
  - Auto Arena & Grand Arena - Combined function

- **Auto-Run Integration**:
  - Added to "Do All" function list
  - Runs automatically on page load when enabled
  - Excluded from auto mode to prevent infinite loops

### Battle Strategy
1. **Get arena status** → Extract opponents and attempts
2. **Load team data** → Get available heroes and teams
3. **Sort opponents** → Easiest targets first
4. **For each attempt**:
   - Select easiest unbeaten opponent
   - Try current team in simulation
   - If losing, try alternative teams
   - Start battle with best team
   - Calculate and complete battle
5. **Report results** → Total victories achieved

### Configuration
- **Team Selection**: Try current team first, fallback to top 5 heroes by power
- **Win Rate Threshold**: Minimum 30% win probability to attack
- **Opponent Selection**: Sort by difficulty (power ratio + rank factor)
- **Skip Strategy**: Avoid opponents with no winning team

### Files Modified
- `HeroWarsHelper.user.js` - Main implementation file (~372 lines added)

### Dependencies
- Existing `BattleCalc` / `Calc` functions for battle simulation
- Existing `Send` function for API calls
- Existing `teamGetAll`, `teamGetFavor` data structures
- Existing `setProgress` for status updates

## [2.376] - Previous Release

### Fixed
- **Daily Quests Auto Mode**: Fixed popup appearing despite auto mode being enabled
- **Do All Function**: Restored auto mode functionality to skip popup and auto-check tasks
- **Test Daily Quests**: Modified to use auto mode initialization
- **Force Auto Mode**: Daily quests now always run in auto mode by default

### Changed
- **Auto Mode Logic**: Daily quests skip popup and auto-check all tasks when in auto mode
- **Do All Integration**: Added automatic execution of Do All function on page load
- **Reload Game Exclusion**: Excluded reload game from auto mode to prevent infinite loops

### Technical Details
- Modified `dailyQuests` class `start()` method to handle auto mode
- Updated `testDailyQuests()` function to call `autoInit(true)`
- Added auto mode flag to `doYourBest` class
- Integrated arena auto-attack into Do All function list
