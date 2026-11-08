# Arena Auto-Attack Feature

## Quick Start

The Arena Auto-Attack feature automatically battles in Arena and Grand Arena with intelligent team selection and opponent targeting.

### How to Use

1. **Manual Execution**:
   - Click "Arena" button for individual arena battles
   - Click "Grand Arena" button for individual grand arena battles
   - Click "Auto Arena & Grand Arena" for both arenas

2. **Auto-Run Integration**:
   - Enable "Auto Arena & Grand Arena" in the "Do All" function
   - The script will automatically run arena battles when the page loads

## Features

### 🎯 Smart Team Selection
- Tries your current arena team first
- If win rate < 50%, tests alternative teams (top 5 heroes by power)
- Only attacks opponents with >30% win probability
- Pre-calculates win rates before attacking

### 🎮 Intelligent Opponent Selection
- Sorts opponents by difficulty (power ratio + rank)
- Targets easiest opponents first
- Uses all daily attempts efficiently
- Focuses on highest win probability matches

### 🔧 Battle Flow
1. Get arena status and available attempts
2. Load your team data and heroes
3. Sort opponents by difficulty (easiest first)
4. For each attempt:
   - Select easiest unbeaten opponent
   - Try current team in simulation
   - If losing, try alternative teams
   - Start battle with best team
   - Calculate and complete battle
5. Report total victories achieved

## Configuration

### Team Selection Strategy
- **Current Team First**: Uses your default arena/grand arena team
- **Alternative Teams**: Top 5 heroes by power if current team fails
- **Win Rate Threshold**: Minimum 30% win probability to attack
- **Skip Unwinnable**: Avoid opponents with no winning team

### Opponent Selection Strategy
- **Power Ratio**: Calculate `opponent.power / your.power`
- **Rank Priority**: Lower rank = easier opponent
- **Difficulty Score**: `powerRatio + (rank / 1000000)`
- **Sort Order**: Easiest opponents first

## API Integration

The feature integrates with Hero Wars' battle system using these API calls:

- `arenaGetInfo` / `grandGetInfo` - Get arena status and opponents
- `arenaStartBattle` / `grandStartBattle` - Start battles
- `arenaEndBattle` / `grandEndBattle` - Complete battles
- `teamGetAll`, `teamGetFavor`, `heroGetAll` - Team data

## Error Handling

- **API Failures**: Graceful error handling with console logging
- **No Attempts**: Skip execution if no attempts remaining
- **Battle Errors**: Continue with next opponent on failure
- **Team Selection**: Skip opponent if no winning team found

## Performance

- **Battle Simulation**: Pre-calculates win rates to avoid losses
- **Team Caching**: Reuses team data across battles
- **Progress Updates**: Real-time status updates for user feedback
- **Memory Management**: Proper cleanup of battle data

## Troubleshooting

### Common Issues

1. **No Battles Executed**:
   - Check if you have arena attempts remaining
   - Verify your team is properly configured
   - Check console for error messages

2. **Low Win Rate**:
   - The system only attacks opponents with >30% win probability
   - Try upgrading your heroes or team composition
   - Check if opponents are too strong for your current level

3. **Script Not Running**:
   - Ensure the feature is enabled in "Do All" function
   - Check if auto-run is enabled
   - Verify the script is properly loaded

### Debug Information

The script provides detailed console logging:
- Opponent difficulty calculations
- Team selection decisions
- Battle win rate predictions
- Victory/defeat results

## Advanced Usage

### Manual Team Selection
The system automatically selects teams, but you can influence the selection by:
- Configuring your default arena team
- Upgrading your top 5 heroes by power
- Ensuring your team has good synergy

### Opponent Targeting
The system targets easiest opponents first, but you can influence this by:
- Checking opponent power levels
- Understanding rank vs. power relationships
- Monitoring your own team's power progression

## Future Enhancements

- **Counter Team Database**: Pre-defined counter strategies
- **Hero Synergy Analysis**: Team composition optimization
- **Battle History**: Track win/loss patterns
- **Advanced Targeting**: More sophisticated opponent selection

## Support

For issues or questions about the Arena Auto-Attack feature:
1. Check the console for error messages
2. Verify your team configuration
3. Ensure you have arena attempts remaining
4. Check if the feature is properly enabled

The feature is designed to maximize your daily arena victories while minimizing manual effort.
