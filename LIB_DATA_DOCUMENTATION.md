# lib.data Documentation

## Overview

`lib.data` is a comprehensive game data library loaded from the Hero Wars game server. It contains static configuration data, metadata, and definitions for all game entities, mechanics, and systems. The Library class loads this data from a JSON file and provides access through `lib.data` and `lib.getData(id)` methods.

## Access Methods

### Direct Access
```javascript
// Access data directly
const heroData = lib.data.hero;
const missionData = lib.data.mission;
```

### Using getData Method
```javascript
// Access data using getData method (recommended)
const heroData = lib.getData('hero');
const missionData = lib.getData('mission');
```

## Data Structure

The `lib.data` object contains the following main categories:

### Game Entities

#### `hero`
Hero definitions and metadata.
- **Structure**: Object with hero IDs as keys
- **Usage in code**: `lib.data.hero`, `lib.getData('hero')`
- **Example**: `lib.data.hero[1]` - Hero with ID 1
- **Properties**: Contains hero stats, artifacts, skills, etc.
- **Code references**:
  - Line 10452: `Object.values(lib.data.hero)` - Get all heroes
  - Line 10481: `lib.data.hero[id].artifacts` - Get hero artifacts
  - Line 12421: `lib.getData('hero')` - Get hero library

#### `titan`
Titan definitions and metadata.
- **Structure**: Object with titan IDs as keys (4000+ range)
- **Usage in code**: `lib.getData('titan')`
- **Example**: `lib.data.titan[4000]` - Titan with ID 4000
- **Code references**:
  - Line 12517: `lib.getData('titan')` - Get titan library

#### `pet`
Pet definitions and metadata.
- **Structure**: Object with pet IDs as keys (6000+ range)
- **Usage in code**: `lib.getData('pet')`
- **Example**: `lib.data.pet[6000]` - Pet with ID 6000
- **Code references**:
  - Line 10196: `lib.getData('pet')` - Get pet library

#### `skill`
Skill definitions and metadata.
- **Structure**: Object with skill IDs as keys
- **Usage in code**: `lib.getData('skill')`
- **Code references**:
  - Line 12386: `lib.getData('skill')` - Get skill library

#### `artifact`
Artifact definitions and metadata.
- **Structure**: Object with artifact data
- **Usage in code**: `lib.getData('artifact')`
- **Properties**: `id`, `type`, `battleEffect`
- **Code references**:
  - Line 12422: `lib.getData('artifact')` - Get artifact library

#### `titanArtifact`
Titan artifact definitions and metadata.
- **Structure**: Object with titan artifact data
- **Usage in code**: `lib.getData('titanArtifact')`
- **Properties**: `id`, `type`, `battleEffect`
- **Code references**:
  - Line 12518: `lib.getData('titanArtifact')` - Get titan artifact library

#### `skin`
Hero skin definitions and metadata.
- **Structure**: Object with skin IDs as keys
- **Usage in code**: `lib.getData('skin')`
- **Code references**:
  - Line 12472: `lib.getData('skin')` - Get skin library

### Game Modes & Activities

#### `mission`
Mission/campaign definitions and metadata.
- **Structure**: Object with mission IDs as keys
- **Usage in code**: `lib.data.mission`
- **Properties**: Contains `normalMode`, `isHeroic`, `teamExp`, etc.
- **Code references**:
  - Line 12739: `Object.values(lib.data.mission).filter((mission) => mission.isHeroic)` - Filter heroic missions
  - Line 12759: `lib.data.mission[selectedMissionId].normalMode.teamExp` - Get mission energy cost

#### `adventure`
Adventure mode definitions.
- **Structure**: Object with `buff` and `id` properties
- **Usage in code**: `lib.data.adventure`

#### `adventureSolo`
Solo adventure mode definitions.
- **Structure**: Object with `id` property
- **Usage in code**: `lib.data.adventureSolo`

#### `seasonAdventure`
Seasonal adventure definitions.
- **Structure**: Object with `level` and `list` properties
- **Usage in code**: `lib.data.seasonAdventure`
- **Code references**:
  - Line 1735: `Object.values(lib.data.seasonAdventure.list)` - Get adventure maps

#### `dungeon`
Dungeon floor definitions.
- **Structure**: Object with `floor` property
- **Usage in code**: `lib.data.dungeon`

#### `tower`
Tower of Elements definitions.
- **Structure**: Object with `buff`, `floor`, `reward`, `rewardGroup` properties
- **Usage in code**: `lib.data.tower`

#### `expedition`
Expedition definitions.
- **Structure**: Object with `rarityChance`, `rewardGeneration`, `slot`, `story` properties
- **Usage in code**: `lib.data.expedition`

#### `brawl`
Brawl mode definitions.
- **Structure**: Object with `list` and `promoHero` properties
- **Usage in code**: `lib.data.brawl`
- **Code references**:
  - Line 14018: `lib.data.brawl.promoHero[this.info.id].promoHero` - Get promo hero

#### `epicBrawl`
Epic Brawl definitions.
- **Structure**: Object with `division`, `league`, `list`, `topReward` properties
- **Usage in code**: `lib.data.epicBrawl`

### Arena & PvP

#### `arena`
Arena definitions.
- **Structure**: Object with `heroExp`, `matchmaking`, `reward`, `type` properties
- **Usage in code**: `lib.data.arena`

#### `titanArena`
Titan Arena definitions.
- **Structure**: Object with `dailyReward`, `matchmakingDayPowerBonus`, `matchmakingPower`, `matchmakingSlot`, `matchmakingStaticTeam` properties
- **Usage in code**: `lib.data.titanArena`

#### `leagueArena`
League Arena definitions.
- **Structure**: Object with `list`, `season`, `template` properties
- **Usage in code**: `lib.data.leagueArena`

#### `powerTournament`
Power Tournament definitions.
- **Structure**: Object with tournament IDs and `matchmakingSections` property
- **Usage in code**: `lib.data.powerTournament`

### Guild & Clan

#### `clan`
Clan definitions.
- **Structure**: Object with `activityReward`, `bot`, `dungeonActivityReward`, `icon`, `iconFrame` properties
- **Usage in code**: `lib.data.clan`

#### `clanWar`
Guild War definitions.
- **Structure**: Object with `fortification`, `fortificationSlot`, `league` properties
- **Usage in code**: `lib.data.clanWar`

#### `clanRaid`
Clan Raid definitions.
- **Structure**: Object with `buffShop`, `damageReward`, `enemyStats`, `enemyTeam`, `id` properties
- **Usage in code**: `lib.data.clanRaid`

#### `clanRaidRating`
Clan Raid Rating definitions.
- **Structure**: Object with `clanReward`, `playerReward` properties
- **Usage in code**: `lib.data.clanRaidRating`

#### `clanCastle`
Clan Castle definitions.
- **Structure**: Object with `list`, `ratingReward` properties
- **Usage in code**: `lib.data.clanCastle`

#### `clanDomination`
Clan Domination definitions.
- **Structure**: Object with `list`, `town` properties
- **Usage in code**: `lib.data.clanDomination`

#### `clanPrestige`
Clan Prestige definitions.
- **Structure**: Object with `level`, `list`, `season` properties
- **Usage in code**: `lib.data.clanPrestige`

#### `crossClanWar`
Cross Clan War definitions.
- **Structure**: Object with `division`, `fortification`, `fortificationSlot`, `league`, `rule` properties
- **Usage in code**: `lib.data.crossClanWar`

### Battle & Combat

#### `battleConfig`
Battle configuration settings.
- **Structure**: Object with battle type keys (e.g., `boss`, `boss_event`, `clan_pvp`, `core`, `epic_start`)
- **Usage in code**: `lib.data.battleConfig`
- **Properties**: Contains `config` object with `battleDuration` and other settings
- **Code references**:
  - Line 3123: `lib.data.battleConfig[typeBattle.split('_')[1]].config.battleDuration` - Get battle duration

#### `battlePrototype`
Battle prototype definitions.
- **Structure**: Object with prototype IDs as keys (1-24)
- **Usage in code**: `lib.data.battlePrototype`

#### `battlePass`
Battle Pass definitions.
- **Structure**: Object with `level`, `list`, `questChain` properties
- **Usage in code**: `lib.data.battlePass`
- **Code references**:
  - Line 9808: `Object.values(lib.data.battlePass.level).filter((x) => x.battlePass == passId)` - Filter battle pass levels
  - Line 10537: `Object.values(lib.data.battlePass.level).filter(x => x.battlePass == pass.id)` - Filter levels by pass

#### `buff`
Buff effect definitions.
- **Structure**: Object with `effect` and `id` properties
- **Usage in code**: `lib.data.buff`

### Shops & Economy

#### `shop`
Shop definitions.
- **Structure**: Object with shop IDs as keys
- **Usage in code**: `lib.data.shop`

#### `bundle`
Bundle/pack definitions.
- **Structure**: Object with bundle IDs as keys
- **Usage in code**: `lib.data.bundle`

#### `bundleHeroReward`
Bundle hero reward definitions.
- **Structure**: Object with reward IDs as keys
- **Usage in code**: `lib.data.bundleHeroReward`

#### `coopBundle`
Cooperative bundle definitions.
- **Structure**: Object with bundle IDs as keys (6, 12, 18, 24, etc.)
- **Usage in code**: `lib.data.coopBundle`

#### `personalMerchant`
Personal Merchant definitions.
- **Structure**: Object with gear IDs as keys (e.g., `gear_100`, `gear_101`)
- **Usage in code**: `lib.data.personalMerchant`

#### `billing`
Billing and pricing definitions.
- **Structure**: Object with `byCurrency`, `groupPrices` properties
- **Usage in code**: `lib.data.billing`

### Inventory & Items

#### `inventoryItem`
Inventory item definitions.
- **Structure**: Object with item category properties (`ascensionGear`, `bannerStone`, `coin`, `consumable`, `gear`, etc.)
- **Usage in code**: `lib.data.inventoryItem`, `lib.getData('inventoryItem')`
- **Code references**:
  - Line 2827: `lib.data.inventoryItem.consumable[call.args.libId]` - Get consumable item info
  - Line 9411: `lib.getData('inventoryItem')` - Get inventory items

#### `lootBox`
Loot box definitions.
- **Structure**: Object with loot box IDs as keys (various naming patterns)
- **Usage in code**: `lib.data.lootBox`

#### `refillable`
Refillable resource definitions.
- **Structure**: Object with refillable resource IDs as keys
- **Usage in code**: `lib.data.refillable`
- **Properties**: Contains `id`, `ident`, `refillSeconds`, `maxValue`, `maxRefillCount`, etc.
- **Note**: See HERO_WARS_API_DOCUMENTATION.md for detailed usage

### Quests & Events

#### `quest`
Quest definitions.
- **Structure**: Object with quest category properties (`battlePass`, `chain`, `clan`, `daily`, `eventFunc`, `special`)
- **Usage in code**: `lib.getData('quest')`
- **Code references**:
  - Line 9812: `lib.getData('quest').special` - Get special quests
  - Line 9813: `lib.getData('quest').battlePass` - Get battle pass quests

#### `specialQuestEvent`
Special quest event definitions.
- **Structure**: Object with `chain`, `type` properties
- **Usage in code**: `lib.data.specialQuestEvent`

#### `appEvent`
Application event definitions.
- **Structure**: Array (may be empty)
- **Usage in code**: `lib.data.appEvent`

#### `eventBox`
Event box definitions.
- **Structure**: Object with box IDs as keys (1-6)
- **Usage in code**: `lib.data.eventBox`

#### `eventPicker`
Event picker definitions.
- **Structure**: Object with `events`, `round`, `roundResumePrice`, `roundReward` properties
- **Usage in code**: `lib.data.eventPicker`

### Bosses & Raids

#### `boss`
Boss definitions.
- **Structure**: Object with `chest`, `list`, `map` properties
- **Usage in code**: `lib.data.boss`

#### `invasion`
Invasion event definitions.
- **Structure**: Object with `boss`, `chapter`, `list`, `phase`, `unitUpgrades` properties
- **Usage in code**: `lib.data.invasion`
- **Code references**:
  - Line 1882: `lib.data.invasion` - Get invasion data
  - Line 1883-1884: Used to find current invasion phase by date

### Progression & Levels

#### `level`
Level definitions for various game systems.
- **Structure**: Object with level category properties (`alchemy`, `clan`, `hero`, `pet`, `skillLevelCost`, `vip`)
- **Usage in code**: `lib.data.level`, `lib.getData('level')`
- **Code references**:
  - Line 9267: `lib.getData('level').vip` - Get VIP level info
  - Line 12022: `lib.data.level.vip.filter(l => l.vipPoints <= +this.questInfo.userGetInfo.vipPoints)` - Filter VIP levels

#### `mechanic`
Mechanic definitions.
- **Structure**: Object with `level`, `limit` properties
- **Usage in code**: `lib.data.mechanic`

### Rewards & Gifts

#### `gift`
Gift definitions.
- **Structure**: Object with gift IDs as keys (2-100+)
- **Usage in code**: `lib.data.gift`

#### `titanGift`
Titan gift definitions.
- **Structure**: Object with gift IDs as keys (1-30)
- **Usage in code**: `lib.getData('titanGift')`
- **Code references**:
  - Line 12697: `lib.getData('titanGift')` - Get titan gift library

#### `nyReward`
New Year reward definitions.
- **Structure**: Object with reward IDs as keys (1-10, 21, 31, 41, 51, 101, 251, 501, 1001)
- **Usage in code**: `lib.data.nyReward`

#### `rewardModifier`
Reward modifier definitions.
- **Structure**: Object with modifier IDs as keys
- **Usage in code**: `lib.data.rewardModifier`

### Daily & Static Data

#### `dailyBonusStatic`
Daily bonus static definitions.
- **Structure**: Object with version keys (e.g., `10_0_0`, `10_6_2019`, `11_0_0`)
- **Usage in code**: `lib.getData('dailyBonusStatic')`
- **Code references**:
  - Line 9266: `lib.getData('dailyBonusStatic')` - Get daily bonus static data

### Character Customization

#### `playerAvatar`
Player avatar definitions.
- **Structure**: Object with avatar IDs as keys (1-100+)
- **Usage in code**: `lib.data.playerAvatar`

#### `playerAvatarFrame`
Player avatar frame definitions.
- **Structure**: Object with frame IDs as keys (0-100+)
- **Usage in code**: `lib.data.playerAvatarFrame`

#### `nickname`
Nickname definitions.
- **Structure**: Object with nickname IDs as keys (1-100+)
- **Usage in code**: `lib.data.nickname`

#### `banner`
Banner definitions.
- **Structure**: Object with banner IDs as keys (1-8)
- **Usage in code**: `lib.data.banner`

#### `sticker`
Sticker definitions.
- **Structure**: Object with sticker IDs as keys (1-57)
- **Usage in code**: `lib.data.sticker`

### Special Systems

#### `heroAscension`
Hero ascension definitions.
- **Structure**: Object with `id`, `node` properties
- **Usage in code**: `lib.data.heroAscension`

#### `heroCounterPick`
Hero counter pick definitions.
- **Structure**: Object with counter pick IDs as keys (1-68)
- **Usage in code**: `lib.data.heroCounterPick`

#### `heroTalent`
Hero talent definitions.
- **Structure**: Object with talent IDs as keys (1)
- **Usage in code**: `lib.data.heroTalent`

#### `heroTalentType`
Hero talent type definitions.
- **Structure**: Object with type IDs as keys (1-2)
- **Usage in code**: `lib.data.heroTalentType`

#### `roleAscension`
Role ascension definitions.
- **Structure**: Object with role IDs as keys (1-7)
- **Usage in code**: `lib.data.roleAscension`

#### `titanSpirit`
Titan spirit definitions.
- **Structure**: Object with `skills` property
- **Usage in code**: `lib.data.titanSpirit`

#### `titanSpiritSkillWeights`
Titan spirit skill weight definitions.
- **Structure**: Object with skill IDs as keys (1-19)
- **Usage in code**: `lib.data.titanSpiritSkillWeights`

### Runes & Enchantments

#### `rune`
Rune definitions.
- **Structure**: Object with `level` (array of 51), `tier` (array of 5), `type` properties
- **Usage in code**: `lib.getData('rune')`
- **Code references**:
  - Line 12581: `lib.getData('rune')` - Get rune library

### Gacha & Random Systems

#### `gacha`
Gacha system definitions.
- **Structure**: Object with `category`, `id` properties
- **Usage in code**: `lib.data.gacha`

#### `lineGacha`
Line gacha definitions.
- **Structure**: Object with `groups`, `list`, `rewards` properties
- **Usage in code**: `lib.data.lineGacha`

### Story & Content

#### `campaignStory`
Campaign story definitions.
- **Structure**: Object with story IDs as keys (1-28)
- **Usage in code**: `lib.data.campaignStory`

#### `comics`
Comics definitions.
- **Structure**: Object with comic IDs as keys (1-2)
- **Usage in code**: `lib.data.comics`

#### `world`
World definitions.
- **Structure**: Object with world IDs as keys (1-15)
- **Usage in code**: `lib.data.world`

### UI & Assets

#### `asset`
Asset definitions.
- **Structure**: Object with asset category properties (`battleground`, `font`, `gui`, `hero`, `inventory`, etc.)
- **Usage in code**: `lib.data.asset`

#### `mainScreenSkin`
Main screen skin definitions.
- **Structure**: Object with skin IDs as keys (e.g., `Mainscreen_Maincity_Birthday_2025`, `main_screen`)
- **Usage in code**: `lib.data.mainScreenSkin`

### Tutorial & Help

#### `tutorial`
Tutorial definitions.
- **Structure**: Object with `chain`, `group`, `movieSubtitle`, `task` properties
- **Usage in code**: `lib.data.tutorial`

### Testing & Development

#### `playtest`
Playtest definitions.
- **Structure**: Object with `preset`, `presetHeroes` properties
- **Usage in code**: `lib.data.playtest`

#### `demoBattleMode`
Demo battle mode definitions.
- **Structure**: Object with battle mode properties (`arena`, `clan_global_pvp`, `clan_global_pvp_titan`, `clan_pvp`, `clan_pvp_titan`, etc.)
- **Usage in code**: `lib.data.demoBattleMode`

### Other Systems

#### `admiration`
Admiration definitions.
- **Structure**: Object with admiration IDs as keys (1-3)
- **Usage in code**: `lib.data.admiration`

#### `specialOffer`
Special offer definitions.
- **Structure**: Object with offer IDs as keys
- **Usage in code**: `lib.data.specialOffer`

#### `subscription`
Subscription definitions.
- **Structure**: Object with subscription IDs as keys (6)
- **Usage in code**: `lib.data.subscription`

#### `notification`
Notification definitions.
- **Structure**: Object with notification type properties (`adventureInvitation`, `arenaPosition`, `clanChampion`, `clanGift`, `clanOrder`, etc.)
- **Usage in code**: `lib.data.notification`

#### `mail`
Mail system definitions.
- **Structure**: Object with `resourceFilter`, `type` properties
- **Usage in code**: `lib.data.mail`

#### `socialGraph`
Social graph definitions.
- **Structure**: Object with `action`, `object`, `vkMap` properties
- **Usage in code**: `lib.data.socialGraph`

#### `stronghold`
Stronghold definitions.
- **Structure**: Object with `mission`, `region` properties
- **Usage in code**: `lib.data.stronghold`

#### `tiledMap`
Tiled map definitions.
- **Structure**: Object with `level`, `list` properties
- **Usage in code**: `lib.data.tiledMap`

#### `trial`
Trial definitions.
- **Structure**: Object with `battle`, `type` properties
- **Usage in code**: `lib.data.trial`

#### `minigame`
Minigame definitions.
- **Structure**: Object with `game`, `story`, `tower` properties
- **Usage in code**: `lib.data.minigame`

#### `workshop`
Workshop definitions.
- **Structure**: Object with `buff`, `relic` properties
- **Usage in code**: `lib.data.workshop`

#### `idleResource`
Idle resource definitions.
- **Structure**: Object with resource IDs as keys (1)
- **Usage in code**: `lib.data.idleResource`

#### `playable`
Playable character definitions.
- **Structure**: Object with character IDs as keys (3-50)
- **Usage in code**: `lib.data.playable`

### Dictionaries & Enums

#### `dict`
Dictionary definitions for various game terms.
- **Structure**: Object with dictionary category properties (`activitySource`, `battleType`, `clanBossRatingType`, `clanBossRewardType`, `clanWarMechanics`, etc.)
- **Usage in code**: `lib.data.dict`

#### `enum`
Enumeration definitions.
- **Structure**: Object with enum category properties (`evolutionStar`, `heroColor`, `heroPerk`, `itemColor`, `language`, etc.)
- **Usage in code**: `lib.data.enum`

#### `topType`
Top type definitions.
- **Structure**: Object with type keys (e.g., `bday2019`, `bday2021`, `bday2022`, `bday2023`, `bday2024`)
- **Usage in code**: `lib.data.topType`

### Rules & Configuration

#### `rule`
Game rules and configuration.
- **Structure**: Object with rule category properties (`CrossNetworkCostToCurrencyPriceMap`, `NY2018_client`, `adventure`, `adventureDisabledHeroes`, `adventureSoloCreepStats`, etc.)
- **Usage in code**: `lib.data.rule`

### Scheduled & System

#### `scheduled`
Scheduled event definitions.
- **Structure**: Object with `preloader` property
- **Usage in code**: `lib.data.scheduled`

#### `unitPhrases`
Unit phrase definitions.
- **Structure**: Object with phrase category properties (`main_screen`, `pve`, `pvp`, `tower`)
- **Usage in code**: `lib.data.unitPhrases`

## Usage Examples

### Getting Hero Information
```javascript
// Get all heroes
const allHeroes = Object.values(lib.data.hero);

// Get specific hero
const hero = lib.data.hero[1];

// Get hero artifacts
const artifacts = lib.data.hero[1].artifacts;
```

### Getting Mission Information
```javascript
// Get all missions
const allMissions = Object.values(lib.data.mission);

// Filter heroic missions
const heroicMissions = Object.values(lib.data.mission).filter(
    mission => mission.isHeroic
);

// Get mission energy cost
const energyCost = lib.data.mission[1].normalMode.teamExp;
```

### Getting Battle Pass Information
```javascript
// Get battle pass levels for a specific pass
const levels = Object.values(lib.data.battlePass.level)
    .filter(x => x.battlePass == passId);

// Get current battle pass level
const currentLevel = Math.max(
    ...levels
        .filter(p => battlePass.exp >= p.experience)
        .map(p => p.level)
);
```

### Getting Battle Configuration
```javascript
// Get battle duration for a specific battle type
const battleType = 'clan_pvp';
const battleDuration = lib.data.battleConfig[battleType].config.battleDuration;
```

### Getting Inventory Items
```javascript
// Get consumable item info
const lootBoxInfo = lib.data.inventoryItem.consumable[lootBoxId];

// Get all inventory items
const items = lib.getData('inventoryItem');
```

### Getting VIP Level Information
```javascript
// Get VIP level based on VIP points
const vipLevel = Math.max(
    ...lib.data.level.vip
        .filter(l => l.vipPoints <= userVipPoints)
        .map(l => l.level)
);
```

### Getting Invasion Phase
```javascript
// Get current invasion phase
const libInvasion = lib.data.invasion;
const now = Date.now() / 1000;
const phase = Object.values(libInvasion.phase).find(
    e => e.startDate < now && e.endDate > now
);
```

## Notes

1. **Data Loading**: The library data is loaded asynchronously from a JSON file. Ensure `lib.data` is available before accessing it.

2. **Data Structure**: Most data is organized as objects with numeric or string IDs as keys, making it easy to look up specific entities.

3. **Nested Properties**: Many categories contain nested objects with additional properties. Explore the structure in the browser console to understand the full data model.

4. **Dynamic Updates**: The library data may be updated by the game server, so the structure and available properties may change over time.

5. **Performance**: For frequently accessed data, consider caching references to avoid repeated lookups.

6. **Type Safety**: The data structure is not strictly typed, so always check for property existence before accessing nested properties.

## Related Documentation

- `HERO_WARS_API_DOCUMENTATION.md` - API documentation including refillable resources
- `EXTENSION_DEVELOPMENT.md` - Extension development guidelines
- `DEVELOPMENT.md` - General development documentation

