# Demo Battle API Documentation

## Overview
The Demo Battle API allows testing battle scenarios in Hero Wars without consuming actual battle attempts. This API simulates battles between attack and defense teams and returns detailed battle results.

## API Endpoint
```
POST /api/demoBattles_startBattle
```

## Request Format

### Headers
```json
{
  "Content-Type": "application/json"
}
```

### Request Body Structure
```json
{
  "calls": [
    {
      "name": "demoBattles_startBattle",
      "args": {
        "mechanic": "arena",
        "defenceMaxUpgrade": false,
        "defenceTeam": {
          "units": [9, 40, 56, 16, 1],
          "pet": 6005
        },
        "defenceBanner": 6,
        "defenceFavor": {
          "1": 6004,
          "9": 6005,
          "16": 6000,
          "56": 6006
        },
        "maxUpgrade": false,
        "team": {
          "units": [62, 9, 40, 56, 42],
          "pet": 6008
        },
        "banner": 6,
        "favor": {
          "9": 6007,
          "40": 6004,
          "42": 6006,
          "56": 6001,
          "62": 6003
        },
        "defenceBuffs": {},
        "buffs": {},
        "parentId": 0,
        "entryId": 0
      },
      "context": {
        "actionTs": 225250
      },
      "ident": "body"
    }
  ]
}
```

### Request Parameters

#### Core Parameters
- **mechanic**: Battle type (e.g., "arena", "grand_arena", "titan_war")
- **defenceMaxUpgrade**: Boolean - whether defense team uses max upgrades
- **maxUpgrade**: Boolean - whether attack team uses max upgrades

#### Team Configuration
- **team**: Attack team configuration
  - **units**: Array of hero IDs [62, 9, 40, 56, 42]
  - **pet**: Pet ID (6008)
- **defenceTeam**: Defense team configuration
  - **units**: Array of hero IDs [9, 40, 56, 16, 1]
  - **pet**: Pet ID (6005)

#### Banner Configuration
- **banner**: Attack team banner ID (6)
- **defenceBanner**: Defense team banner ID (6)

#### Favor Configuration
- **favor**: Attack team favor pets mapping
  - Format: `{"heroId": "petId"}`
- **defenceFavor**: Defense team favor pets mapping
  - Format: `{"heroId": "petId"}`

#### Buff Configuration
- **buffs**: Attack team buffs (empty object `{}`)
- **defenceBuffs**: Defense team buffs (empty object `{}`)

#### Context Parameters
- **parentId**: Parent battle ID (0 for standalone battles)
- **entryId**: Entry ID (0 for standalone battles)
- **actionTs**: Action timestamp (225250)

## Response Format

### Response Structure
```json
{
  "date": 1761608683.2305729,
  "results": [
    {
      "ident": "body",
      "result": {
        "response": {
          "battle": {
            "userId": "35979991",
            "typeId": "35979991",
            "attackers": { /* Hero data */ },
            "defenders": [ /* Battle state data */ ],
            "effects": { /* Battle effects */ },
            "reward": [],
            "startTime": 1761608683,
            "seed": 1001493182,
            "type": "arena"
          }
        }
      }
    }
  ]
}
```

### Response Components

#### Battle Metadata
- **userId**: User ID (35979991)
- **typeId**: Battle type ID (35979991)
- **startTime**: Battle start timestamp (1761608683)
- **seed**: Random seed for battle simulation (1001493182)
- **type**: Battle type ("arena")

#### Attackers Data
Contains detailed hero statistics for the attacking team:

```json
{
  "62": {
    "id": 62,
    "xp": 3625195,
    "level": 130,
    "color": 18,
    "slots": [0,0,0,0,0,0],
    "skills": {
      "437": 130,
      "438": 130,
      "439": 130,
      "440": 130,
      "6017": 130
    },
    "power": 157395,
    "star": 6,
    "runes": [43750,43750,16600,26410,43750],
    "skins": {
      "320": 60,
      "343": 60,
      "356": 25
    },
    "currentSkin": 343,
    "titanGiftLevel": 30,
    "titanCoinsSpent": {
      "consumable": {
        "24": 65150
      }
    },
    "artifacts": [
      {"level": 130, "star": 6},
      {"level": 116, "star": 6},
      {"level": 100, "star": 6}
    ],
    "scale": 1,
    "petId": 6003,
    "type": "hero",
    "perks": [8,7,2,22],
    "ascensions": {
      "1": [0,1,3,2,4,5,7,8,6,9],
      "2": [0,1,2,3,5,4,6,7,8,10],
      "3": [0,1,3,4,2,5,6,7,8,9],
      "4": [0,2,3,4,5,1,6,8,7]
    },
    "agility": 2530,
    "hp": 271286,
    "intelligence": 16041,
    "physicalAttack": 461,
    "strength": 3543,
    "armor": 9802,
    "magicPenetration": 18768,
    "magicPower": 73112.1,
    "magicResist": 12567.1,
    "skin": 343,
    "favorPetId": 6003,
    "favorPower": 7279
  }
}
```

#### Defenders Data
Contains battle state information for defending heroes:

```json
{
  "1": {
    "id": 9,
    "xp": 3625195,
    "level": 130,
    "color": 18,
    "slots": [0,0,0,0,0,0],
    "skills": {
      "335": 130,
      "336": 130,
      "337": 130,
      "338": 130,
      "6027": 130,
      "8271": 1,
      "8270": 1
    },
    "power": 203670,
    "star": 6,
    "runes": [43750,43750,43750,43750,43750],
    "skins": {
      "9": 60,
      "41": 60,
      "163": 60,
      "189": 60,
      "311": 60,
      "338": 60
    },
    "currentSkin": 338,
    "titanGiftLevel": 30,
    "titanCoinsSpent": {
      "consumable": {
        "24": 65150
      }
    },
    "artifacts": [
      {"level": 130, "star": 6},
      {"level": 130, "star": 6},
      {"level": 130, "star": 6}
    ],
    "scale": 1,
    "petId": 6005,
    "type": "hero",
    "perks": [7,2,20],
    "ascensions": {
      "1": [0,1,2,3,5,4,6,7,8,9],
      "2": [0,2,5,7,9,1,4,6,8,3,10],
      "3": [0,1,2,4,5,3,6,7,8,9],
      "4": [0,1,2,5,3,4,7,6,8,9],
      "5": [0,1,2,7,10,9,4,5,6,3,8]
    },
    "agility": 3068,
    "hp": 255154,
    "intelligence": 19003,
    "physicalAttack": 7020.32,
    "strength": 3068,
    "armor": 22123,
    "dodge": 14644,
    "magicPenetration": 2826,
    "magicPower": 69808.6,
    "magicResist": 34381,
    "modifiedSkillTier": 5,
    "skin": 338,
    "favorPetId": 6005,
    "favorPower": 11064,
    "state": {
      "hp": 377874,
      "energy": 0,
      "isDead": false,
      "maxHp": 377874
    }
  }
}
```

#### Battle Effects
```json
{
  "defenders": {
    "levelDecreaseAuraOnEnemy_8_18_400": 2,
    "percentBuffAll_magicPower": 16,
    "redPatternScaling": 2,
    "percentBuffAll_armor": 14,
    "percentDebuffAllEnemy_physicalCritChance": 8
  },
  "defendersBanner": {
    "id": 6,
    "slots": [15, 45, 76]
  },
  "attackers": {
    "levelDecreaseAuraOnEnemy_8_18_400": 2,
    "percentBuffAll_magicPower": 16,
    "redPatternScaling": 2,
    "percentBuffAll_armor": 14,
    "percentDebuffAllEnemy_physicalCritChance": 8
  },
  "attackersBanner": {
    "id": 6,
    "slots": [15, 45, 76]
  }
}
```

## Testing Examples

### Example 1: Basic Arena Battle
```bash
curl -X POST "https://api.herowars.com/api/demoBattles_startBattle" \
  -H "Content-Type: application/json" \
  -d '{
    "calls": [
      {
        "name": "demoBattles_startBattle",
        "args": {
          "mechanic": "arena",
          "defenceMaxUpgrade": false,
          "defenceTeam": {
            "units": [9, 40, 56, 16, 1],
            "pet": 6005
          },
          "defenceBanner": 6,
          "defenceFavor": {
            "1": 6004,
            "9": 6005,
            "16": 6000,
            "56": 6006
          },
          "maxUpgrade": false,
          "team": {
            "units": [62, 9, 40, 56, 42],
            "pet": 6008
          },
          "banner": 6,
          "favor": {
            "9": 6007,
            "40": 6004,
            "42": 6006,
            "56": 6001,
            "62": 6003
          },
          "defenceBuffs": {},
          "buffs": {},
          "parentId": 0,
          "entryId": 0
        },
        "context": {
          "actionTs": 225250
        },
        "ident": "body"
      }
    ]
  }'
```

### Example 2: Testing Different Battle Mechanics
```json
{
  "calls": [
    {
      "name": "demoBattles_startBattle",
      "args": {
        "mechanic": "grand_arena",
        "defenceMaxUpgrade": true,
        "defenceTeam": {
          "units": [1, 2, 3, 4, 5],
          "pet": 6001
        },
        "defenceBanner": 1,
        "defenceFavor": {
          "1": 6001,
          "2": 6002,
          "3": 6003,
          "4": 6004,
          "5": 6005
        },
        "maxUpgrade": true,
        "team": {
          "units": [6, 7, 8, 9, 10],
          "pet": 6006
        },
        "banner": 1,
        "favor": {
          "6": 6006,
          "7": 6007,
          "8": 6008,
          "9": 6009,
          "10": 6010
        },
        "defenceBuffs": {},
        "buffs": {},
        "parentId": 0,
        "entryId": 0
      },
      "context": {
        "actionTs": 225250
      },
      "ident": "body"
    }
  ]
}
```

## Response Validation

### Key Fields to Validate
1. **Battle ID**: Ensure `userId` and `typeId` are returned
2. **Team Composition**: Verify attackers and defenders match request
3. **Hero Stats**: Check that hero statistics are properly calculated
4. **Battle State**: Validate `state` objects for defenders contain current HP/energy
5. **Effects**: Confirm battle effects are applied correctly
6. **Timestamps**: Verify `startTime` and `date` are reasonable

### Expected Response Times
- Normal response: 200-500ms
- Complex battles: 500-1000ms
- Timeout threshold: 5000ms

## Error Handling

### Common Error Responses
```json
{
  "error": {
    "code": "INVALID_TEAM",
    "message": "Invalid team composition",
    "details": "Team must contain exactly 5 heroes"
  }
}
```

### Error Codes
- `INVALID_TEAM`: Invalid team composition
- `INVALID_HERO`: Hero ID not found
- `INVALID_PET`: Pet ID not found
- `INVALID_BANNER`: Banner ID not found
- `BATTLE_TIMEOUT`: Battle simulation timeout
- `INSUFFICIENT_PERMISSIONS`: User lacks battle permissions

## Testing Checklist

### Pre-Test Setup
- [ ] Verify API endpoint is accessible
- [ ] Confirm authentication tokens are valid
- [ ] Check hero IDs exist in game database
- [ ] Validate pet IDs are correct
- [ ] Ensure banner IDs are valid

### Test Cases
- [ ] Basic arena battle with standard teams
- [ ] Battle with different hero combinations
- [ ] Battle with various pet configurations
- [ ] Battle with different banner setups
- [ ] Battle with buffs/debuffs applied
- [ ] Battle with max upgrades enabled/disabled
- [ ] Battle timeout scenarios
- [ ] Invalid team composition handling
- [ ] Invalid hero ID handling
- [ ] Invalid pet ID handling

### Post-Test Validation
- [ ] Response contains valid battle data
- [ ] Hero statistics are correctly calculated
- [ ] Battle effects are properly applied
- [ ] Timestamps are reasonable
- [ ] No data corruption in response
- [ ] Performance meets expectations

## Performance Considerations

### Optimization Tips
1. **Batch Requests**: Group multiple battle tests in single API call
2. **Caching**: Cache hero/pet data to reduce lookup time
3. **Parallel Testing**: Run multiple battle simulations concurrently
4. **Data Validation**: Pre-validate team compositions before API calls

### Monitoring
- Track response times for performance regression
- Monitor error rates and types
- Log battle simulation failures
- Alert on unusual response patterns

## Security Considerations

### Authentication
- Use secure API keys for authentication
- Implement rate limiting to prevent abuse
- Log all battle simulation requests
- Monitor for suspicious activity patterns

### Data Privacy
- Ensure battle data doesn't contain sensitive user information
- Implement proper data retention policies
- Use HTTPS for all API communications
- Validate all input parameters

## Integration Examples

### JavaScript/Node.js
```javascript
const axios = require('axios');

async function testBattle(attackTeam, defenseTeam) {
  try {
    const response = await axios.post('https://api.herowars.com/api/demoBattles_startBattle', {
      calls: [{
        name: 'demoBattles_startBattle',
        args: {
          mechanic: 'arena',
          defenceMaxUpgrade: false,
          defenceTeam: defenseTeam,
          defenceBanner: 6,
          defenceFavor: {},
          maxUpgrade: false,
          team: attackTeam,
          banner: 6,
          favor: {},
          defenceBuffs: {},
          buffs: {},
          parentId: 0,
          entryId: 0
        },
        context: {
          actionTs: Date.now()
        },
        ident: 'body'
      }]
    });
    
    return response.data.results[0].result.response.battle;
  } catch (error) {
    console.error('Battle test failed:', error.message);
    throw error;
  }
}
```

### Python
```python
import requests
import json

def test_battle(attack_team, defense_team):
    url = "https://api.herowars.com/api/demoBattles_startBattle"
    
    payload = {
        "calls": [{
            "name": "demoBattles_startBattle",
            "args": {
                "mechanic": "arena",
                "defenceMaxUpgrade": False,
                "defenceTeam": defense_team,
                "defenceBanner": 6,
                "defenceFavor": {},
                "maxUpgrade": False,
                "team": attack_team,
                "banner": 6,
                "favor": {},
                "defenceBuffs": {},
                "buffs": {},
                "parentId": 0,
                "entryId": 0
            },
            "context": {
                "actionTs": int(time.time())
            },
            "ident": "body"
        }]
    }
    
    response = requests.post(url, json=payload)
    response.raise_for_status()
    
    return response.json()['results'][0]['result']['response']['battle']
```

This documentation provides comprehensive coverage of the Demo Battle API, including request/response formats, testing examples, validation criteria, and integration patterns for effective battle simulation testing.
