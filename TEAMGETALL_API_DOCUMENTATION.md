# TeamGetAll API Documentation

## Overview

The `teamGetAll` API provides comprehensive team configurations for all game modes in Hero Wars. It returns pre-configured teams that players have set up through the game's UI, including heroes, pets, and other team-related data.

## API Call

```javascript
{
  "calls": [
    {
      "name": "teamGetAll",
      "args": {},
      "ident": "teamGetAll"
    }
  ]
}
```

## Response Structure

The `teamGetAll` response contains team configurations for various game modes, each stored as arrays of entity IDs (heroes and pets).

### Data Format

Each team configuration is an array where:
- **First 5 elements**: Hero IDs (heroes with ID < 6000)
- **6th element**: Pet ID (pets with ID >= 6000)

### Field Structure

```typescript
interface TeamGetAllResponse {
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
  titan_mission: number[];           // Titan team for missions
  
  // Clan/Team Modes
  clanDefence_heroes: number[];       // Heroes for clan defense
  clanDefence_titans: number[];       // Titans for clan defense
  clanRaid_nodes: number[][];         // [[team1], [team2], [team3]] - 3 teams for clan raid nodes
  clan_global_pvp: number[];          // Heroes for global clan PvP
  clan_global_pvp_titan: number[];    // Titans for global clan PvP
  clan_pvp_hero: number[];           // Heroes for clan PvP
  clan_pvp_titan: number[];          // Titans for clan PvP
  
  // Cross-Clan Defense
  crossClanDefence_heroes: number[][]; // [[team1], [team2], [team3]] - 3 teams
  crossClanDefence_titans: number[][]; // [[team1], [team2]] - 2 titan teams
  
  // Mission Mode
  mission: number[];                  // [hero1, hero2, hero3, hero4, hero5, pet]
  
  // Boss Battles
  boss_10: number[];                  // Team for boss level 10
  boss_11: number[];                 // Team for boss level 11
  boss_12: number[];                 // Team for boss level 12
  
  // Invasion Bosses (182-225, 394-417)
  invasion_boss_182: number[];       // Team for invasion boss 182
  invasion_boss_183: number[];       // Team for invasion boss 183
  // ... (continues for all invasion boss levels)
  invasion_boss_225: number[];       // Team for invasion boss 225
  
  // Invasion Titan Bosses (394-417)
  invasion_boss_394: number[];       // Titan team for invasion boss 394
  invasion_boss_395: number[];       // Titan team for invasion boss 395
  // ... (continues for all invasion titan boss levels)
  invasion_boss_417: number[];        // Titan team for invasion boss 417
  
  // Other Modes
  brawl: number[];                    // Team for brawls
  challenge: number[];                // Team for challenges
}
```

## Sample Response

```json
{
  "date": 1761616960.879777,
  "results": [
    {
      "result": {
        "response": {
          "adventure_hero": [46, 9, 40, 16, 65, 6008],
          "arena": [46, 57, 40, 16, 65, 6008],
          "grand": [
            [43, 12, 7, 42, 66, 6006],
            [48, 16, 46, 65, 40, 6008],
            [9, 29, 1, 64, 13, 6004]
          ],
          "dungeon_hero": [46, 9, 40, 16, 65, 6004],
          "dungeon_earth": [4020, 4023],
          "dungeon_fire": [4010, 4013, 4012, 4011],
          "dungeon_water": [4003],
          "dungeon_neutral": [4033, 4030, 4032, 4043, 4020],
          "tower": [65, 16, 9, 13, 42, 6004],
          "titan_arena": [4033, 4003, 4043, 4032, 4030],
          "titan_arena_def": [4033, 4003, 4043, 4032, 4030],
          "titan_mission": [4033, 4003, 4043, 4032, 4030],
          "clanDefence_heroes": [9, 40, 43, 16, 65, 6004],
          "clanDefence_titans": [4033, 4003, 4043, 4032, 4030],
          "clanRaid_nodes": [
            [46, 9, 40, 16, 65, 6004],
            [57, 7, 13, 40, 1, 6008],
            [43, 12, 7, 42, 66, 6006]
          ],
          "clan_global_pvp": [7, 29, 65, 59, 2, 6008],
          "clan_global_pvp_titan": [4021, 4023, 4031, 4022, 4020],
          "clan_pvp_hero": [46, 9, 40, 16, 65, 6004],
          "clan_pvp_titan": [4033, 4003, 4043, 4032, 4030],
          "crossClanDefence_heroes": [
            [46, 9, 40, 16, 65, 6004],
            [57, 7, 13, 40, 1, 6008],
            [43, 12, 7, 42, 66, 6006]
          ],
          "crossClanDefence_titans": [
            [4033, 4003, 4043, 4032, 4030],
            [4021, 4023, 4031, 4022, 4020]
          ],
          "mission": [46, 13, 40, 16, 65, 6004],
          "boss_10": [64, 13, 9, 43, 1, 6006],
          "boss_11": [46, 57, 48, 52, 16, 6004],
          "boss_12": [55, 40, 65, 59, 42, 6004],
          "brawl": [57, 7, 13, 40, 1, 6008],
          "challenge": [13, 9, 40, 16, 65, 6004],
          "invasion_boss_182": [58, 48, 16, 65, 59, 6004],
          "invasion_boss_183": [58, 48, 16, 65, 59, 6004],
          "invasion_boss_394": [4021, 4024, 4022, 4041, 4040],
          "invasion_boss_395": [4021, 4023, 4024, 4041, 4040]
        }
      }
    }
  ]
}
```

## Entity ID Ranges

### Heroes
- **Range**: 1-999
- **Examples**: 46 (Aurora), 57 (K'arkh), 40 (Jorgen), 16 (Maya), 65 (Lars)

### Pets
- **Range**: 6000-6999
- **Examples**: 6008 (Axel), 6004 (Oliver), 6006 (Cain), 6001 (Fenris)

### Titans
- **Range**: 4000-4999
- **Examples**: 4033 (Hyperion), 4003 (Eden), 4043 (Sigurd), 4032 (Angus), 4030 (Araji)

## Usage Patterns

### Single Team Modes
Most game modes use a single team configuration:
```javascript
const arenaTeam = teamGetAll.arena; // [46, 57, 40, 16, 65, 6008]
const heroes = arenaTeam.slice(0, 5); // [46, 57, 40, 16, 65]
const pet = arenaTeam[5]; // 6008
```

### Multi-Team Modes
Some modes require multiple teams:
```javascript
const grandArenaTeams = teamGetAll.grand; // [[team1], [team2], [team3]]
const clanRaidTeams = teamGetAll.clanRaid_nodes; // [[team1], [team2], [team3]]
```

### Titan-Only Modes
Titan modes only contain titan IDs (no pets):
```javascript
const titanArenaTeam = teamGetAll.titan_arena; // [4033, 4003, 4043, 4032, 4030]
```

## Integration with Other APIs

### TeamGetFavor
The `teamGetFavor` API provides favor pet assignments for each team:
```javascript
const teamFavor = teamGetFavor.arena; // {46: 6004, 57: 6006, 40: 6001, 16: 6003, 65: 6008}
```

### HeroGetAll
The `heroGetAll` API provides detailed hero information:
```javascript
const heroDetails = heroGetAll[46]; // Detailed Aurora hero data
```

## Best Practices

### Team Validation
Always validate team data before use:
```javascript
function validateTeam(team) {
  if (!team || team.length < 6) {
    throw new Error('Invalid team configuration');
  }
  
  const heroes = team.slice(0, 5);
  const pet = team[5];
  
  // Validate heroes are in correct range
  if (!heroes.every(id => id >= 1 && id < 6000)) {
    throw new Error('Invalid hero IDs');
  }
  
  // Validate pet is in correct range
  if (pet < 6000 || pet >= 7000) {
    throw new Error('Invalid pet ID');
  }
  
  return { heroes, pet };
}
```

### Team Processing
Process teams consistently across all game modes:
```javascript
function processTeam(teamData) {
  if (Array.isArray(teamData[0])) {
    // Multi-team mode (grand arena, clan raid)
    return teamData.map(team => ({
      heroes: team.slice(0, 5),
      pet: team[5]
    }));
  } else {
    // Single team mode
    return {
      heroes: teamData.slice(0, 5),
      pet: teamData[5]
    };
  }
}
```

## Error Handling

### Common Issues
1. **Empty Teams**: Some fields may be empty arrays if not configured
2. **Invalid IDs**: Team may contain invalid hero/pet IDs
3. **Missing Fields**: Some game modes may not have team configurations

### Error Response Format
```json
{
  "date": 1761616960.879777,
  "error": {
    "name": "NotFound",
    "description": "Heroes for battle",
    "call": {
      "name": "grandAttack",
      "args": {
        "userId": "55172629",
        "heroes": [],
        "pets": [],
        "favor": [],
        "banners": []
      }
    }
  }
}
```

## Related APIs

- **teamGetFavor**: Provides favor pet assignments
- **heroGetAll**: Provides detailed hero information
- **pet_getAll**: Provides detailed pet information
- **titanGetAll**: Provides detailed titan information

## Version History

- **v1.0**: Initial team configuration system
- **v2.0**: Added multi-team support for grand arena
- **v3.0**: Added clan raid and cross-clan defense teams
- **v4.0**: Added invasion boss team configurations

---

*This documentation is based on the actual `teamGetAll` API response structure observed in Hero Wars Helper v2.376+*
