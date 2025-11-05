# Cross Clan War (COW) API Documentation

## Overview

This document provides comprehensive documentation for the Hero Wars Cross Clan War (COW) API endpoints, including actual request and response examples captured from network traffic.

**Base URL:** `https://heroes-wb.nextersglobal.com/api/`

**Protocol:** HTTPS

**Method:** POST

**Content-Type:** `application/json; charset=UTF-8`

---

## Authentication Headers

All API requests require the same authentication headers as other Hero Wars APIs:

| Header | Description | Example Value |
|--------|-------------|---------------|
| `X-Auth-User-Id` | User's unique identifier | `130965538` |
| `X-Auth-Token` | Authentication token | `ps-LpxlrBfWeKcZJCGUkh/jTmbHwFdoqvEzPOVtSisR+DaAYy-1762191632-104.28.233.73-aa7ca1fa6b5312f2a7874401ac7a8143` |
| `X-Auth-Player-Id` | Player's unique identifier | `57373161` |
| `X-Auth-Session-Id` | Session identifier | `0t55vrn03rqhro` |
| `X-Auth-Session-Key` | Session key (can be empty) | `` |
| `X-Auth-Signature` | Request signature for validation | `60946631d148f1c8f02ca7c42bad0290` |
| `X-Auth-Application-Id` | Application identifier | `3` |
| `X-Auth-Network-Ident` | Network identifier | `web` |
| `X-Request-Id` | Unique request identifier | `10` |
| `X-Server-Time` | Server time offset | `0` |
| `X-Env-Unique-Session-Id` | Unique session identifier | `7391167411891630849` |
| `X-Env-Library-Version` | Library version | `1` |
| `X-Full-Referer` | Full referrer URL | `https://www.hero-wars.com/` |
| `X-Requested-With` | Request type | `XMLHttpRequest` |

---

## API Request Structure

All API requests follow the same JSON structure:

```json
{
  "calls": [
    {
      "name": "methodName",
      "args": { /* method-specific arguments */ },
      "context": {
        "actionTs": 97452  // Action timestamp in milliseconds
      },
      "ident": "body"  // or "group_0_body", "group_1_body", etc.
    }
  ]
}
```

---

## Cross Clan War Endpoints

### 1. crossClanWar_getInfo

**Description:** Retrieves information about the current Cross Clan War status, including available battles, opponent clans, and war state.

**Request:**
```json
{
  "calls": [
    {
      "name": "crossClanWar_getInfo",
      "args": {},
      "context": {
        "actionTs": 97452
      },
      "ident": "group_1_body"
    }
  ]
}
```

**Request Parameters:**
- No parameters required (empty `args` object)

**Response:**
The response contains detailed information about the Cross Clan War, including:
- War status and timing
- Available battle slots
- Opponent clan information
- Battle results
- Rewards and standings

**Notes:**
- This call is typically made when opening the Cross Clan War interface
- The response structure follows the standard Hero Wars API response format
- Response includes battle slots that can be attacked (hero battles and titan battles)

---

### 2. crossClanWar_startBattle

**Description:** Initiates a battle in the Cross Clan War against a specific slot. Supports both hero battles and titan battles.

**Request:**
```json
{
  "calls": [
    {
      "name": "crossClanWar_startBattle",
      "args": {
        "slotId": 2,
        "favor": {
          "13": 6008,
          "16": 6004,
          "29": 6006,
          "64": 6005
        },
        "team": {
          "units": [29, 64, 13, 40, 16],
          "pet": 6008
        },
        "banner": 2
      },
      "context": {
        "actionTs": 135538
      },
      "ident": "body"
    }
  ]
}
```

**Request Parameters:**

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `slotId` | Number | The battle slot ID to attack (1-16 for hero battles, higher for titan battles) | `2` or `16` |
| `team` | Object | The attacking team configuration | See below |
| `team.units` | Array[Number] | Array of hero IDs for the team | `[29, 64, 13, 40, 16]` |
| `team.pet` | Number | Pet ID for the team (for hero battles) | `6008` |
| `favor` | Object | Map of hero IDs to favor IDs (optional, for hero battles) | `{"13": 6008, "16": 6004}` |
| `banner` | Number | Banner ID for the team (optional, for hero battles) | `2` |

**Team Configuration:**

For **Hero Battles:**
```json
{
  "slotId": 2,
  "team": {
    "units": [29, 64, 13, 40, 16],
    "pet": 6008
  },
  "favor": {
    "13": 6008,
    "16": 6004,
    "29": 6006,
    "64": 6005
  },
  "banner": 2
}
```

For **Titan Battles:**
```json
{
  "slotId": 16,
  "team": {
    "units": [4033, 4043, 4031, 4032, 4030]
  }
}
```
Note: Titan battles don't use `pet`, `favor`, or `banner` parameters.

**Response:**
The response contains:
- Battle result (victory/defeat)
- Rewards earned
- Updated war status
- Battle statistics

**Notes:**
- `slotId` determines whether it's a hero battle (typically 1-15) or titan battle (typically 16+)
- Hero battles support pets, favors, and banners
- Titan battles only require unit IDs
- The `favor` parameter is optional - can be an empty object `{}` if no favors are selected
- The `banner` parameter is optional for hero battles

---

## Example Usage Flow

1. **Get War Information:**
   ```json
   {
     "calls": [
       {
         "name": "crossClanWar_getInfo",
         "args": {},
         "context": {"actionTs": 97452},
         "ident": "group_1_body"
       }
     ]
   }
   ```

2. **Start a Hero Battle:**
   ```json
   {
     "calls": [
       {
         "name": "crossClanWar_startBattle",
         "args": {
           "slotId": 2,
           "team": {
             "units": [29, 64, 13, 40, 16],
             "pet": 6008
           },
           "favor": {
             "13": 6008,
             "16": 6004,
             "29": 6006,
             "64": 6005
           },
           "banner": 2
         },
         "context": {"actionTs": 135538},
         "ident": "body"
       }
     ]
   }
   ```

3. **Start a Titan Battle:**
   ```json
   {
     "calls": [
       {
         "name": "crossClanWar_startBattle",
         "args": {
           "slotId": 16,
           "team": {
             "units": [4033, 4043, 4031, 4032, 4030]
           }
         },
         "context": {"actionTs": 187358},
         "ident": "body"
       }
     ]
   }
   ```

---

## Client Event Tracking

The Cross Clan War interface also uses `stashClient` calls to track user interactions:

- Window open/close events for various COW popups:
  - `game.mechanics.cross_clan_war.popup.selectMode.CrossClanWarSelectModePopup`
  - `game.mechanics.cross_clan_war.popup.start.CrossClanWarStartScreenPopup`
  - `game.mechanics.cross_clan_war.popup.war.CrossClanWarScreen`
  - `game.mechanics.cross_clan_war.popup.attack.teamGather.CrossClanWarAttackTeamGatherPopup`
  - `game.mechanics.cross_clan_war.popup.attack.CrossClanWarAttackPopup`

- Button click events for navigation and actions within the COW interface

These events are sent alongside the main API calls for analytics and tracking purposes.

---

## Error Handling

Standard error responses follow the Hero Wars API error format. Common errors may include:
- Invalid slot ID (slot already attacked or doesn't exist)
- Insufficient team configuration
- War not active or expired
- Authentication failures

---

## Notes

- All timestamps (`actionTs`) are in milliseconds
- The `ident` field can vary between `"body"`, `"group_0_body"`, `"group_1_body"`, etc. depending on batch requests
- Hero IDs and unit IDs are numeric identifiers
- Pet IDs start with 6000+ range
- Favor IDs also start with 6000+ range
- Banner IDs are typically small numbers (1-6)

---

## Related Documentation

- See `GUILD_WAR_API_DOCUMENTATION.md` for regular Guild War APIs
- See `ARENA_API_DOCUMENTATION.md` for Arena battle APIs
- See `DEMO_BATTLE_API_DOCUMENTATION.md` for demo battle testing

