// ==UserScript==
// @name         HeroWarsHelper - Auto Daily Extension
// @namespace    http://tampermonkey.net/
// @version      3.1.1
// @description  Adds an advanced auto-run panel for daily tasks and quests to HeroWarsHelper.
// @author       Your Name & Coding Partner
// @match        https://www.hero-wars.com/*
// @match        https://apps-1701433570146040.apps.fbsbx.com/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // --- CONFIGURATION ---
    const EXTENSION_NAME = "Auto Daily Extension";
    const EXTENSION_VERSION = "3.1.1";
    const EXTENSION_AUTHOR = "You";

    // --- STATE VARIABLES ---
    let executionState = {};
    let hideButtonsState = {};
    let othersSettingsState = {};
    let isProviderActive = false;
    let customOthersButton = null;
    let combinedButton = null;
    let cachedQuestData = null; // Cache for questGetAll results
    let autoRunInProgress = false;

    // --- DUNGEON TITAN HEALTH SETTINGS ---
    const defaultTitanHealthSettings = {
        minOverallHP: 0.30,
        titan4020HP: 0.40,
        titan4020EnergyHP: 0.20,
        titan4010Combined: 0.67,
        titan4000HP: 0.63,
        titan4000Energy400HP: 0.45,
        titan4000Energy670HP: 0.34,
        autoRefreshPage: false
    };

    let titanHealthSettings = {};
    let stopDung = false; // External stop mechanism for dungeon

    // External stop function for dungeon
    window.stopHWDDungeon = () => {
        if (typeof stopDung !== 'undefined') {
            stopDung = true;
            console.log('HWD Dungeon stop requested externally.');
        } else {
            console.log('stopDung variable not found or not in scope.');
        }
    };

    function loadTitanHealthSettings() {
        const { HWHFuncs } = window;
        if (HWHFuncs && HWHFuncs.getSaveVal) {
            titanHealthSettings = HWHFuncs.getSaveVal('titanHealthSettings', defaultTitanHealthSettings);
        } else {
            titanHealthSettings = Object.assign({}, defaultTitanHealthSettings);
        }
    }

    function saveTitanHealthSettings() {
        const { HWHFuncs } = window;
        if (HWHFuncs && HWHFuncs.setSaveVal) {
            HWHFuncs.setSaveVal('titanHealthSettings', titanHealthSettings);
        }
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function waitFor(predicate, { timeoutMs = 30000, intervalMs = 200 } = {}) {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            try {
                if (predicate()) return true;
            } catch (e) {
                // ignore predicate errors while waiting
            }
            await sleep(intervalMs);
        }
        return false;
    }

    async function withTimeout(promise, timeoutMs, timeoutMessage = 'Timed out') {
        let t;
        const timeoutPromise = new Promise((_, reject) => {
            t = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
        });
        try {
            return await Promise.race([promise, timeoutPromise]);
        } finally {
            clearTimeout(t);
        }
    }

    // --- QUEST DATA CACHE ---
    async function getQuestData(forceRefresh = false) {
        if (cachedQuestData && !forceRefresh) {
            return cachedQuestData;
        }
        const { Send } = window;
        const questResponse = await Send({ calls: [{ name: "questGetAll", args: {}, ident: "questGetAll" }] });
        cachedQuestData = questResponse.results[0].result.response;
        return cachedQuestData;
    }
    
    function invalidateQuestCache() {
        cachedQuestData = null;
    }

    // --- REIMPLEMENTED CORE FUNCTIONS (WRAPPERS) ---
    async function executeGetOutland() {
        const { Send, HWHFuncs } = window;
        HWHFuncs.setProgress('Executing: Outland', true);
        try {
            const data = await Send({ calls: [{ name: "bossGetAll", args: {}, ident: "bossGetAll" }] });
            const bosses = data.results[0].result.response;
            const calls = [];
            for (const boss of bosses) {
                if (boss.mayRaid) calls.push({ name: "bossRaid", args: { bossId: boss.id }, ident: "bossRaid_" + boss.id });
                if (boss.chestId === 1 || boss.mayRaid) calls.push({ name: "bossOpenChest", args: { bossId: boss.id, amount: 1, starmoney: 0 }, ident: "bossOpenChest_" + boss.id });
            }
            if (calls.length > 0) await Send({ calls });
            HWHFuncs.setProgress('Outland: Done!', true);
        } catch (e) { console.error("Error in executeGetOutland", e); HWHFuncs.setProgress('Outland: Error!', true); }
    }
    async function executeTestTower() {
        const { HWHClasses, HWHFuncs } = window;
        HWHFuncs.setProgress('Executing: Tower', true);
        return new Promise((resolve) => { new HWHClasses.executeTower(resolve, resolve).start(); });
    }
    async function executeCheckExpedition() {
        const { HWHClasses, HWHFuncs } = window;
        HWHFuncs.setProgress('Executing: Expeditions', true);
        return new Promise((resolve) => { new HWHClasses.Expedition(resolve, resolve).start(); });
    }
    // Advanced Dungeon Algorithm - Merged from HWD Extension RED-1.0.7
    function executeDungeon(resolve, reject) {
        const { HWHFuncs, Send, BattleCalc, cheats } = window;
        const { getInput, setProgress, hideProgress, I18N, send, getTimer, countdownTimer } = HWHFuncs;
        
        let countPredictionCard = 0;
        let dungeonActivity = 0;
        let startDungeonActivity = 0;
        let maxDungeonActivity = 150;
        let end = false;
        // stopDung is declared at module level for external access

        // Note: countTeam is declared but never populated - stats will show empty team usage
        let countTeam = [];
        let timeDungeon = {
            all: new Date().getTime(),
            findAttack: 0,
            attackNeutral: 0,
            attackEarthOrFire: 0,
        };

        let titansStates = {};
        let bestBattle = {};

        let teams = {
            neutral: [],
            water: [],
            earth: [],
            fire: [],
            hero: [],
        };

        let talentMsg = '';
        let talentMsgReward = '';

        let callsExecuteDungeon = {
            calls: [
                { name: 'dungeonGetInfo', args: {}, ident: 'dungeonGetInfo' },
                { name: 'teamGetAll', args: {}, ident: 'teamGetAll' },
                { name: 'teamGetFavor', args: {}, ident: 'teamGetFavor' },
                { name: 'clanGetInfo', args: {}, ident: 'clanGetInfo' },
                { name: 'inventoryGet', args: {}, ident: 'inventoryGet' },
            ],
        };

        this.start = async function (titanit) {
            maxDungeonActivity = titanit || getInput('countTitanit');
            send(JSON.stringify(callsExecuteDungeon), startDungeon);
        };

        function startDungeon(e) {
            stopDung = false;
            let res = e.results;
            let dungeonGetInfo = res[0].result.response;
            if (!dungeonGetInfo) {
                endDungeon('noDungeon', res);
                return;
            }
            console.log('Starting full dungeon run: ', new Date());
            let teamGetAll = res[1].result.response;
            let teamGetFavor = res[2].result.response;
            dungeonActivity = res[3].result.response.stat.todayDungeonActivity;
            startDungeonActivity = res[3].result.response.stat.todayDungeonActivity;
            countPredictionCard = res[4].result.response.consumable[81];
            titansStates = dungeonGetInfo.states.titans;

            teams.hero = {
                favor: teamGetFavor.dungeon_hero,
                heroes: teamGetAll.dungeon_hero.filter((id) => id < 6000),
                teamNum: 0,
            };
            let heroPet = teamGetAll.dungeon_hero.filter((id) => id >= 6000).pop();
            if (heroPet) {
                teams.hero.pet = heroPet;
            }
            teams.neutral = getTitanTeam('neutral');
            teams.water = { favor: {}, heroes: getTitanTeam('water'), teamNum: 0 };
            teams.earth = { favor: {}, heroes: getTitanTeam('earth'), teamNum: 0 };
            teams.fire = { favor: {}, heroes: getTitanTeam('fire'), teamNum: 0 };

            checkFloor(dungeonGetInfo);
        }

        function getTitanTeam(type) {
            switch (type) {
                case 'neutral':
                    // Complete list for Neutral (includes 4014 Solaris)
                    return [4023, 4022, 4012, 4021, 4011, 4010, 4020, 4024, 4014];
                case 'water':
                    // Filter only owned titans (!!titansStates[e]) and not dead
                    return [4000, 4001, 4002, 4003,4004].filter((e) => !!titansStates[e] && !titansStates[e].isDead);
                case 'earth':
                    // Filter only owned titans and not dead (includes 4024)
                    return [4020, 4022, 4021, 4023, 4024].filter((e) => !!titansStates[e] && !titansStates[e].isDead);
                case 'fire':
                    // Filter only owned titans and not dead (includes 4014 Solaris)
                    return [4010, 4011, 4012, 4013, 4014].filter((e) => !!titansStates[e] && !titansStates[e].isDead);
            }
        }

        function clone(a) {
            return JSON.parse(JSON.stringify(a));
        }

        function findElement(floor, element) {
            for (let i in floor) {
                if (floor[i].attackerType === element) {
                    return i;
                }
            }
            return undefined;
        }

        async function checkFloor(dungeonInfo) {
            if (!('floor' in dungeonInfo) || dungeonInfo.floor?.state == 2) {
                saveProgress();
                return;
            }
            checkTalent(dungeonInfo);
            maxDungeonActivity = getInput('countTitanit');
            setProgress(`${I18N('DUNGEON')}: ${I18N('TITANIT')} ${dungeonActivity}/${maxDungeonActivity} ${talentMsg}`);
            if (dungeonActivity >= maxDungeonActivity) {
                endDungeon('Dungeon stopped,', 'titanite collected: ' + dungeonActivity + '/' + maxDungeonActivity);
                return;
            }
            titansStates = dungeonInfo.states.titans;
            if (stopDung) {
                endDungeon('Dungeon stopped,', 'titanite collected: ' + dungeonActivity + '/' + maxDungeonActivity);
                return;
            }
            bestBattle = {};
            let floorChoices = dungeonInfo.floor.userData;
            if (floorChoices.length > 1) {
                for (let element in teams) {
                    let teamNum = findElement(floorChoices, element);
                    if (!!teamNum) {
                        if (element == 'earth' || element == 'fire') {
                            teamNum = await chooseEarthOrFire(floorChoices);
                            if (teamNum < 0) {
                                endDungeon('Cannot win without losing a Titan!', dungeonInfo);
                                return;
                            }
                        }
                        chooseElement(floorChoices[teamNum].attackerType, teamNum);
                        return;
                    }
                }
            } else {
                chooseElement(floorChoices[0].attackerType, 0);
            }
        }

        async function checkTalent(dungeonInfo) {
            const talent = dungeonInfo.talent;
            if (!talent) return;
            const dungeonFloor = +dungeonInfo.floorNumber;
            const talentFloor = +talent.floorRandValue;
            let doorsAmount = 3 - talent.conditions.doorsAmount;

            if (dungeonFloor === talentFloor && (!doorsAmount || !talent.conditions?.farmedDoors[dungeonFloor])) {
                const reward = await Send({
                    calls: [
                        { name: 'heroTalent_getReward', args: { talentType: 'tmntDungeonTalent', reroll: false }, ident: 'group_0_body' },
                        { name: 'heroTalent_farmReward', args: { talentType: 'tmntDungeonTalent' }, ident: 'group_1_body' },
                    ],
                }).then((e) => e.results[0].result.response);
                const type = Object.keys(reward).pop();
                const itemId = Object.keys(reward[type]).pop();
                const count = reward[type][itemId];
                const itemName = cheats.translate(`LIB_${type.toUpperCase()}_NAME_${itemId}`);
                talentMsgReward += `<br> ${count} ${itemName}`;
                doorsAmount++;
            }
            talentMsg = `<br>TMNT Talent: ${doorsAmount}/3 ${talentMsgReward}<br>`;
        }

        async function chooseEarthOrFire(floorChoices) {
            bestBattle.recovery = -11;
            let selectedTeamNum = -1;
            for (let attempt = 0; selectedTeamNum < 0 && attempt < 4; attempt++) {
                for (let teamNum in floorChoices) {
                    let attackerType = floorChoices[teamNum].attackerType;
                    selectedTeamNum = await attemptAttackEarthOrFire(teamNum, attackerType, attempt);
                }
            }
            console.log('Choosing fire or earth team: ', selectedTeamNum < 0 ? 'not made' : floorChoices[selectedTeamNum].attackerType);
            return selectedTeamNum;
        }

        async function attemptAttackEarthOrFire(teamNum, attackerType, attempt) {
            let start = new Date();
            let team = clone(teams[attackerType]);
            
            // Modifica Pyro: Supporto a 5 titani per Terra e Fuoco
            let maxTeamSize = (attackerType === 'earth' || attackerType === 'fire') ? 5 : 4;
            
            let startIndex = team.heroes.length + attempt - maxTeamSize;
            
            if (startIndex >= 0) {
                team.heroes = team.heroes.slice(startIndex);
                let recovery = await getBestRecovery(teamNum, attackerType, team, 25);
                if (recovery > bestBattle.recovery) {
                    bestBattle.recovery = recovery;
                    bestBattle.selectedTeamNum = teamNum;
                    bestBattle.team = team;
                }
            }
            let workTime = new Date().getTime() - start.getTime();
            timeDungeon.attackEarthOrFire += workTime;
            if (bestBattle.recovery < -10) {
                return -1;
            }
            return bestBattle.selectedTeamNum;
        }

        async function chooseElement(attackerType, teamNum) {
            let result;
            switch (attackerType) {
                case 'hero':
                case 'water':
                    result = await startBattle(teamNum, attackerType, teams[attackerType]);
                    break;
                case 'earth':
                case 'fire':
                    result = await attackEarthOrFire(teamNum, attackerType);
                    break;
                case 'neutral':
                    result = await attackNeutral(teamNum, attackerType);
            }
            if (!!result && attackerType != 'hero') {
                let recovery = (!!!bestBattle.recovery ? 10 * getRecovery(result) : bestBattle.recovery) * 100;
                let titans = result.progress[0].attackers.heroes;
                console.log('Battle completed: ' + attackerType + ', recovery = ' + (recovery > 0 ? '+' : '') + Math.round(recovery) + '% \r\n', titans);
            }
            endBattle(result);
        }

        async function attackEarthOrFire(teamNum, attackerType) {
            if (!!!bestBattle.recovery) {
                bestBattle.recovery = -11;
                let selectedTeamNum = -1;
                for (let attempt = 0; selectedTeamNum < 0 && attempt < 4; attempt++) {
                    selectedTeamNum = await attemptAttackEarthOrFire(teamNum, attackerType, attempt);
                }
                if (selectedTeamNum < 0) {
                    endDungeon('Cannot win without losing a Titan!', attackerType);
                    return;
                }
            }
            return findAttack(teamNum, attackerType, bestBattle.team);
        }

        async function findAttack(teamNum, attackerType, team) {
            let start = new Date();
            let recovery = -1000;
            let result;
            let correction = 0.01;
            for (let needRecovery = bestBattle.recovery; recovery < needRecovery; needRecovery -= correction) {
                result = await startBattle(teamNum, attackerType, team);
                recovery = getRecovery(result);
            }
            bestBattle.recovery = recovery;
            let workTime = new Date().getTime() - start.getTime();
            timeDungeon.findAttack += workTime;
            return result;
        }

        async function attackNeutral(teamNum, attackerType) {
            let start = new Date();
            let factors = calcFactor();
            bestBattle.recovery = -0.2;
            await findBestBattleNeutral(teamNum, attackerType, factors, true);
            if (bestBattle.recovery < 0 || (bestBattle.recovery < 0.2 && factors[0].value < 0.5)) {
                let recovery = 100 * bestBattle.recovery;
                console.log('Failed to find a good battle in fast mode: ' + attackerType + ', recovery = ' + (recovery > 0 ? '+' : '') + Math.round(recovery) + '% \r\n', bestBattle.attackers);
                await findBestBattleNeutral(teamNum, attackerType, factors, false);
            }
            let workTime = new Date().getTime() - start.getTime();
            timeDungeon.attackNeutral += workTime;
            if (!!bestBattle.attackers) {
                let team = getTeam(bestBattle.attackers);
                return findAttack(teamNum, attackerType, team);
            }
            endDungeon('Failed to find a good battle!', attackerType);
            return undefined;
        }

        async function findBestBattleNeutral(teamNum, attackerType, factors, mode) {
            // Healing titans priority: best -> worst [4000, 4003, 4004, 4001, 4002]
            const healingTitans = [4000, 4003, 4004, 4001, 4002].filter((e) => !!titansStates[e] && !titansStates[e].isDead);
            // Create priority map for healer comparison (lower number = higher priority)
            const healerPriority = {};
            healingTitans.forEach((healerId, index) => {
                healerPriority[healerId] = index;
            });
            
            // Debug: Log available healing titans
            console.log(`[Dungeon] Available healing titans (priority order): [${healingTitans.join(', ')}]`);
            if (!healingTitans.includes(4004)) {
                console.warn(`[Dungeon] WARNING: 4004 (Tidus and Gelo) is not available! Status:`, titansStates[4004]);
            }
            
            let countFactors = factors.length < 4 ? factors.length : 4;
            let aradgi = !titansStates['4013']?.isDead;
            let edem = !titansStates['4023']?.isDead;
            let dark = [4032, 4033].filter((e) => !titansStates[e]?.isDead);
            let light = [4042].filter((e) => !titansStates[e]?.isDead);
            let actions = [];
            if (mode) {
                for (let i = 0; i < countFactors; i++) {
                    actions.push(startBattle(teamNum, attackerType, getNeutralTeam(factors[i].id)));
                }
                if (countFactors > 1) {
                    let firstId = factors[0].id;
                    let secondId = factors[1].id;
                    // Use healing titans in priority order (best first)
                    for (let healerId of healingTitans) {
                        actions.push(startBattle(teamNum, attackerType, getNeutralTeam(firstId, healerId, secondId)));
                    }
                }
                if (aradgi) {
                    actions.push(startBattle(teamNum, attackerType, getNeutralTeam(4013)));
                    if (countFactors > 0) {
                        let firstId = factors[0].id;
                        // Use healing titans in priority order (best first)
                        for (let healerId of healingTitans) {
                            actions.push(startBattle(teamNum, attackerType, getNeutralTeam(firstId, healerId, 4013)));
                        }
                    }
                    if (edem) {
                        // Use best healers first: 4000, then 4004
                        if (healingTitans.includes(4000)) {
                            actions.push(startBattle(teamNum, attackerType, getNeutralTeam(4023, 4000, 4013)));
                        }
                        if (healingTitans.includes(4004)) {
                            actions.push(startBattle(teamNum, attackerType, getNeutralTeam(4023, 4004, 4013)));
                        }
                    }
                }
            } else {
                countFactors = factors.length < 2 ? factors.length : 2;
                for (let i = 0; i < countFactors; i++) {
                    let mainId = factors[i].id;
                    if (aradgi && i > 0) {
                        // Use healing titans in priority order (best first)
                        for (let healerId of healingTitans) {
                            actions.push(startBattle(teamNum, attackerType, getNeutralTeam(mainId, healerId, 4013)));
                        }
                    }
                    for (let j = 0; j < dark.length; j++) {
                        let darkId = dark[j];
                        // Use healing titans in priority order (best first)
                        for (let healerId of healingTitans) {
                            actions.push(startBattle(teamNum, attackerType, getNeutralTeam(mainId, healerId, darkId)));
                        }
                    }
                    for (let j = 0; j < light.length; j++) {
                        let lightId = light[j];
                        // Use healing titans in priority order (best first)
                        for (let healerId of healingTitans) {
                            actions.push(startBattle(teamNum, attackerType, getNeutralTeam(mainId, healerId, lightId)));
                        }
                    }
                    let isFull = i > 0;
                    for (let j = isFull ? i + 1 : 2; j < factors.length; j++) {
                        let extraId = factors[j].id;
                        // Use healing titans in priority order (best first)
                        for (let healerId of healingTitans) {
                            actions.push(startBattle(teamNum, attackerType, getNeutralTeam(mainId, healerId, extraId)));
                        }
                    }
                }
                if (aradgi) {
                    for (let i = 0; i < dark.length; i++) {
                        let darkId = dark[i];
                        // Use healing titans in priority order (best first)
                        for (let healerId of healingTitans) {
                            actions.push(startBattle(teamNum, attackerType, getNeutralTeam(darkId, healerId, 4013)));
                        }
                    }
                    for (let i = 0; i < light.length; i++) {
                        let lightId = light[i];
                        // Use healing titans in priority order (best first)
                        for (let healerId of healingTitans) {
                            actions.push(startBattle(teamNum, attackerType, getNeutralTeam(lightId, healerId, 4013)));
                        }
                    }
                }
                for (let i = 0; i < dark.length; i++) {
                    let firstId = dark[i];
                    actions.push(startBattle(teamNum, attackerType, getNeutralTeam(firstId)));
                    for (let j = i + 1; j < dark.length; j++) {
                        let secondId = dark[j];
                        // Use healing titans in priority order (best first)
                        for (let healerId of healingTitans) {
                            actions.push(startBattle(teamNum, attackerType, getNeutralTeam(firstId, healerId, secondId)));
                        }
                    }
                }
                for (let i = 0; i < light.length; i++) {
                    let firstId = light[i];
                    actions.push(startBattle(teamNum, attackerType, getNeutralTeam(firstId)));
                    for (let j = i + 1; j < light.length; j++) {
                        let secondId = light[j];
                        // Use healing titans in priority order (best first)
                        for (let healerId of healingTitans) {
                            actions.push(startBattle(teamNum, attackerType, getNeutralTeam(firstId, healerId, secondId)));
                        }
                    }
                }
            }
            const results = await Promise.all(actions);
            for (let i = 0; i < results.length; i++) {
                let result = results[i];
                let recovery = getRecovery(result);
                let titans = result.progress[0].attackers.heroes;
                
                // Get original titan IDs from battleData.attackers (keys are titan IDs)
                const originalTitanIds = result.battleData && result.battleData.attackers ? 
                    Object.keys(result.battleData.attackers).map(id => parseInt(id)) : [];
                
                // Extract healer IDs from the team
                const currentHealerIds = originalTitanIds.filter(id => healingTitans.includes(id));
                
                // Check if this result is better, considering healer priority
                // Use a larger threshold to prefer higher priority healers even when recovery is slightly better
                const recoveryThreshold = 0.05; // Consider recovery similar if within 0.05 (5% difference)
                const isMuchBetterRecovery = recovery > bestBattle.recovery + recoveryThreshold;
                const isSimilarOrBetterRecovery = recovery >= bestBattle.recovery - recoveryThreshold;
                
                if (!bestBattle.attackers || !bestBattle.originalTitanIds) {
                    // First result, just store it
                    bestBattle.recovery = recovery;
                    bestBattle.attackers = titans;
                    bestBattle.originalTitanIds = originalTitanIds;
                    console.log(`[Dungeon] Initial best battle - Recovery: ${recovery.toFixed(3)}, Healers: [${currentHealerIds.join(', ')}]`);
                } else if (isMuchBetterRecovery) {
                    // Much better recovery, always choose it
                    bestBattle.recovery = recovery;
                    bestBattle.attackers = titans;
                    bestBattle.originalTitanIds = originalTitanIds;
                    console.log(`[Dungeon] Better recovery found - Recovery: ${recovery.toFixed(3)}, Healers: [${currentHealerIds.join(', ')}]`);
                } else if (isSimilarOrBetterRecovery) {
                    // Recovery is similar or slightly better, prefer higher priority healers
                    const bestHealerIds = bestBattle.originalTitanIds.filter(id => healingTitans.includes(id));
                    
                    if (currentHealerIds.length > 0 && bestHealerIds.length > 0) {
                        const currentBestHealer = currentHealerIds.reduce((best, id) => 
                            (healerPriority[id] !== undefined && (healerPriority[best] === undefined || healerPriority[id] < healerPriority[best])) ? id : best
                        );
                        const bestBestHealer = bestHealerIds.reduce((best, id) => 
                            (healerPriority[id] !== undefined && (healerPriority[best] === undefined || healerPriority[id] < healerPriority[best])) ? id : best
                        );
                        
                        // Prefer the battle with higher priority healer (lower priority number = higher priority)
                        // Also prefer if recovery is better, even if healer priority is same
                        const hasBetterHealer = healerPriority[currentBestHealer] !== undefined && 
                            healerPriority[bestBestHealer] !== undefined &&
                            healerPriority[currentBestHealer] < healerPriority[bestBestHealer];
                        const hasBetterRecovery = recovery > bestBattle.recovery;
                        
                        if (hasBetterHealer || (recovery >= bestBattle.recovery && healerPriority[currentBestHealer] <= healerPriority[bestBestHealer])) {
                            if (hasBetterHealer) {
                                console.log(`[Dungeon] Preferring healer ${currentBestHealer} (priority ${healerPriority[currentBestHealer]}) over ${bestBestHealer} (priority ${healerPriority[bestBestHealer]}) - Recovery: ${recovery.toFixed(3)} vs ${bestBattle.recovery.toFixed(3)}`);
                            }
                            bestBattle.recovery = recovery;
                            bestBattle.attackers = titans;
                            bestBattle.originalTitanIds = originalTitanIds;
                        }
                    } else if (recovery > bestBattle.recovery) {
                        // Better recovery and no healers to compare, choose it
                        bestBattle.recovery = recovery;
                        bestBattle.attackers = titans;
                        bestBattle.originalTitanIds = originalTitanIds;
                    }
                }
            }
        }

        function getNeutralTeam(id, swapId, addId) {
            let neutralTeam = clone(teams.water);
            let neutral = neutralTeam.heroes;
            if (neutral.length == 4) {
                if (!!swapId) {
                    for (let i in neutral) {
                        if (neutral[i] == swapId) {
                            neutral[i] = addId;
                        }
                    }
                }
            } else if (!!addId) {
                neutral.push(addId);
            }
            neutral.push(id);
            return neutralTeam;
        }

        function getTeam(titans) {
            return {
                favor: {},
                heroes: Object.keys(titans).map((id) => parseInt(id)),
                teamNum: 0,
            };
        }

        function calcFactor() {
            let neutral = teams.neutral;
            let factors = [];
            for (let i in neutral) {
                let titanId = neutral[i];
                if (!titansStates[titanId]) {
                    continue;
                }
                let titan = titansStates[titanId];
                let factor = !!titan ? titan.hp / titan.maxHp + titan.energy / 10000.0 : 1;
                if (factor > 0) {
                    factors.push({ id: titanId, value: factor });
                }
            }
            factors.sort(function (a, b) {
                return a.value - b.value;
            });
            return factors;
        }

        async function getBestRecovery(teamNum, attackerType, team, countBattle) {
            let bestRecovery = -1000;
            let actions = [];
            for (let i = 0; i < countBattle; i++) {
                actions.push(startBattle(teamNum, attackerType, team));
            }
            for (let result of await Promise.all(actions)) {
                let recovery = getRecovery(result);
                if (recovery > bestRecovery) {
                    bestRecovery = recovery;
                }
            }
            return bestRecovery;
        }

        function getRecovery(result) {
            if (result.result.stars < 3) {
                return -100;
            }
            let beforeSumFactor = 0;
            let afterSumFactor = 0;
            let beforeTitans = result.battleData.attackers;
            let afterTitans = result.progress[0].attackers.heroes;
            for (let i in afterTitans) {
                let titan = afterTitans[i];
                let percentHP = titan.hp / beforeTitans[i].hp;
                let energy = titan.energy;
                let factor = checkTitan(i, energy, percentHP) ? getFactor(i, energy, percentHP) : -100;
                afterSumFactor += factor;
            }
            for (let i in beforeTitans) {
                let titan = beforeTitans[i];
                let state = titan.state;
                beforeSumFactor += !!state ? getFactor(i, state.energy, state.hp / titan.hp) : 1;
            }
            return afterSumFactor - beforeSumFactor;
        }

        function getFactor(id, energy, percentHP) {
            if (percentHP < 0.05) {
                return -100;
            }
            const currentSettings = titanHealthSettings;

            switch (id) {
                case '4020':
                    return percentHP * 0.7 + (energy / 1000) * 0.3;
                case '4010':
                    return percentHP * 0.5 + (energy / 1000) * 0.5;
                case '4000':
                    return percentHP * 0.8 + (energy / 1000) * 0.2;
                default:
                    return percentHP;
            }
        }

        function checkTitan(id, energy, percentHP) {
            const minOverallHP = titanHealthSettings.minOverallHP;

            if (percentHP < minOverallHP) {
                return false;
            }

            switch (id) {
                case '4020':
                    return percentHP > titanHealthSettings.titan4020HP || (energy == 1000 && percentHP > titanHealthSettings.titan4020EnergyHP);
                case '4010':
                    return percentHP + energy / 2000.0 > titanHealthSettings.titan4010Combined;
                case '4000':
                    return percentHP > titanHealthSettings.titan4000HP || (energy < 1000 && ((percentHP > titanHealthSettings.titan4000Energy400HP && energy >= 400) || (percentHP > titanHealthSettings.titan4000Energy670HP && energy >= 670)));
                case '4024':
                case '4014':
                    return true;
            }
            return true;
        }

        function startBattle(teamNum, attackerType, args) {
            return new Promise(function (resolve, reject) {
                args.teamNum = teamNum;
                // Log which titans are being sent to battle
                // args is a team object with heroes array
                const titanIds = (args && args.heroes) ? args.heroes : [];
                if (titanIds.length > 0) {
                    console.log(`[Dungeon Battle] ${attackerType} - Team ${teamNum} - Titans: [${titanIds.join(', ')}]`);
                } else {
                    console.warn(`[Dungeon Battle] ${attackerType} - Team ${teamNum} - No titans found. Args:`, JSON.stringify(args));
                }
                
                let startBattleCall = {
                    calls: [{ name: 'dungeonStartBattle', args, ident: 'body' }],
                };
                send(JSON.stringify(startBattleCall), resultBattle, {
                    resolve,
                    teamNum,
                    attackerType,
                });
            });
        }

        function resultBattle(resultBattles, args) {
            if (!resultBattles || !resultBattles.results || resultBattles.results.length === 0 || !resultBattles.results[0].result || resultBattles.results[0].result.error) {
                console.error('Battle failed, results missing or contained error:', resultBattles);
                const failedResult = {
                    result: { stars: 0, win: false },
                    progress: [{ attackers: { heroes: {} } }],
                    battleData: { attackers: {} },
                    teamNum: args.teamNum,
                    attackerType: args.attackerType
                };
                args.resolve(failedResult);
                return;
            }

            let battleData = resultBattles.results[0].result.response;
            let battleType = 'get_tower';
            if (battleData.type == 'dungeon_titan') {
                battleType = 'get_titan';
            }
            battleData.progress = [{ attackers: { input: ['auto', 0, 0, 'auto', 0, 0] } }];
            BattleCalc(battleData, battleType, function (result) {
                result.result = result.result || { stars: 3 };
                if (result.result.stars < 3) {
                    console.warn("BattleCalc returned less than 3 stars. Treating as fail.");
                }
                
                result.teamNum = args.teamNum;
                result.attackerType = args.attackerType;
                args.resolve(result);
            });
        }

        async function endBattle(battleInfo) {
            if (!battleInfo || battleInfo.result.stars < 3) {
                endDungeon('Hero or Titan may have died in battle / Error during attack!', battleInfo);
                return;
            }

            if (!!battleInfo) {
                const args = {
                    result: battleInfo.result,
                    progress: battleInfo.progress,
                };
                
                if (countPredictionCard > 0) {
                    args.isRaid = true;
                    countPredictionCard--;
                } else {
                    const timer = getTimer(battleInfo.battleTime);
                    console.log(timer);
                    await countdownTimer(timer, `${I18N('DUNGEON')}: ${I18N('TITANIT')} ${dungeonActivity}/${maxDungeonActivity} ${talentMsg}`);
                }
                const calls = [{ name: 'dungeonEndBattle', args, ident: 'body' }];
                send(JSON.stringify({ calls }), resultEndBattle);
            } else {
                endDungeon('dungeonEndBattle win: false\n', battleInfo);
            }
        }

        function resultEndBattle(e) {
            // Check for top-level errors first
            if (e && e.error) {
                let errorName = '';
                let errorDescription = '';
                
                if (typeof e.error === 'string') {
                    errorDescription = e.error;
                    if (e.error.includes('NotFound') || e.error.includes('not found')) {
                        errorName = 'NotFound';
                    }
                } else {
                    errorName = e.error.name || '';
                    errorDescription = e.error.description || '';
                }
                
                if (errorName === 'NotFound' || errorDescription.includes('NotFound') || errorDescription.includes('not found')) {
                    console.warn('Battle not found at top level (may have been completed/expired), refreshing dungeon info and continuing...', e.error);
                    let refreshCall = {
                        calls: [{ name: 'dungeonGetInfo', args: {}, ident: 'dungeonGetInfo' }],
                    };
                    send(JSON.stringify(refreshCall), function(refreshResult) {
                        if (refreshResult && refreshResult.results && refreshResult.results[0] && refreshResult.results[0].result && refreshResult.results[0].result.response) {
                            let dungeonGetInfo = refreshResult.results[0].result.response;
                            titansStates = dungeonGetInfo.states?.titans || titansStates;
                            checkFloor(dungeonGetInfo);
                        } else {
                            endDungeon('Failed to refresh dungeon after NotFound error', refreshResult);
                        }
                    });
                    return;
                }
                
                endDungeon('errorRequest', e.error);
                return;
            }
            
            if (!!e && !!e.results) {
                let result = e.results[0].result;
                
                // Check for errors in the result structure
                if (result.error) {
                    let errorName = '';
                    let errorDescription = '';
                    
                    // Handle both object and string error formats
                    if (typeof result.error === 'string') {
                        errorDescription = result.error;
                        if (result.error.includes('NotFound') || result.error.includes('not found')) {
                            errorName = 'NotFound';
                        }
                    } else {
                        errorName = result.error.name || '';
                        errorDescription = result.error.description || '';
                    }
                    
                    // Handle NotFound errors gracefully - battle may have been completed/expired
                    if (errorName === 'NotFound' || errorDescription.includes('NotFound') || errorDescription.includes('not found')) {
                        console.warn('Battle not found (may have been completed/expired), refreshing dungeon info and continuing...', result.error);
                        // Refresh dungeon info and continue
                        let refreshCall = {
                            calls: [{ name: 'dungeonGetInfo', args: {}, ident: 'dungeonGetInfo' }],
                        };
                        send(JSON.stringify(refreshCall), function(refreshResult) {
                            if (refreshResult && refreshResult.results && refreshResult.results[0] && refreshResult.results[0].result && refreshResult.results[0].result.response) {
                                let dungeonGetInfo = refreshResult.results[0].result.response;
                                titansStates = dungeonGetInfo.states?.titans || titansStates;
                                checkFloor(dungeonGetInfo);
                            } else {
                                // If refresh fails, try to continue anyway
                                console.warn('Failed to refresh dungeon info, continuing with current state...');
                                // Get fresh dungeon info using the same pattern as startDungeon
                                let callsExecuteDungeon = {
                                    calls: [
                                        { name: 'dungeonGetInfo', args: {}, ident: 'dungeonGetInfo' },
                                    ],
                                };
                                send(JSON.stringify(callsExecuteDungeon), function(refreshResult2) {
                                    if (refreshResult2 && refreshResult2.results && refreshResult2.results[0] && refreshResult2.results[0].result && refreshResult2.results[0].result.response) {
                                        let dungeonGetInfo = refreshResult2.results[0].result.response;
                                        titansStates = dungeonGetInfo.states?.titans || titansStates;
                                        checkFloor(dungeonGetInfo);
                                    } else {
                                        endDungeon('Failed to refresh dungeon after NotFound error', refreshResult2);
                                    }
                                });
                            }
                        });
                        return;
                    }
                    
                    // For other errors, stop the dungeon
                    endDungeon('errorBattleResult', result.error);
                    return;
                }
                
                let battleResult = result.response;
                if (!battleResult) {
                    // If no response, try to refresh dungeon info
                    console.warn('No battle result in response, refreshing dungeon info and continuing...');
                    let refreshCall = {
                        calls: [{ name: 'dungeonGetInfo', args: {}, ident: 'dungeonGetInfo' }],
                    };
                    send(JSON.stringify(refreshCall), function(refreshResult) {
                        if (refreshResult && refreshResult.results && refreshResult.results[0] && refreshResult.results[0].result && refreshResult.results[0].result.response) {
                            let dungeonGetInfo = refreshResult.results[0].result.response;
                            titansStates = dungeonGetInfo.states?.titans || titansStates;
                            checkFloor(dungeonGetInfo);
                        } else {
                            endDungeon('Failed to refresh dungeon after missing response', refreshResult);
                        }
                    });
                    return;
                }
                
                if ('error' in battleResult) {
                    let errorName = '';
                    let errorDescription = '';
                    
                    // Handle both object and string error formats
                    if (typeof battleResult.error === 'string') {
                        errorDescription = battleResult.error;
                        if (battleResult.error.includes('NotFound') || battleResult.error.includes('not found')) {
                            errorName = 'NotFound';
                        }
                    } else {
                        errorName = battleResult.error?.name || '';
                        errorDescription = battleResult.error?.description || '';
                    }
                    
                    // Handle NotFound errors in response as well
                    if (errorName === 'NotFound' || errorDescription.includes('NotFound') || errorDescription.includes('not found')) {
                        console.warn('Battle not found in response (may have been completed/expired), refreshing dungeon info and continuing...', battleResult.error);
                        // Refresh dungeon info and continue
                        let refreshCall = {
                            calls: [{ name: 'dungeonGetInfo', args: {}, ident: 'dungeonGetInfo' }],
                        };
                        send(JSON.stringify(refreshCall), function(refreshResult) {
                            if (refreshResult && refreshResult.results && refreshResult.results[0] && refreshResult.results[0].result && refreshResult.results[0].result.response) {
                                let dungeonGetInfo = refreshResult.results[0].result.response;
                                titansStates = dungeonGetInfo.states?.titans || titansStates;
                                checkFloor(dungeonGetInfo);
                            } else {
                                endDungeon('Failed to refresh dungeon after NotFound error', refreshResult);
                            }
                        });
                        return;
                    }
                    
                    endDungeon('errorBattleResult', battleResult);
                    return;
                }
                
                let dungeonGetInfo = battleResult.dungeon ?? battleResult;
                dungeonActivity += battleResult.reward?.dungeonActivity ?? 0;
                checkFloor(dungeonGetInfo);
            } else {
                endDungeon('Lost connection to game server!', 'break');
            }
        }

        function saveProgress() {
            let saveProgressCall = {
                calls: [{ name: 'dungeonSaveProgress', args: {}, ident: 'body' }],
            };
            send(JSON.stringify(saveProgressCall), resultEndBattle);
        }

        function showStats() {
            let activity = dungeonActivity - startDungeonActivity;
            let workTime = clone(timeDungeon);
            workTime.all = new Date().getTime() - workTime.all;
            for (let i in workTime) {
                workTime[i] = Math.round(workTime[i] / 1000);
            }
            if (countTeam.length > 0) {
                countTeam.sort(function (a, b) {
                    return b.count - a.count;
                });
                console.log('Team usage frequency: ');
                for (let i in countTeam) {
                    let teams = countTeam[i];
                    console.log(teams.team + ': ', teams.count);
                }
            }
            console.log(titansStates);
            console.log('Titanite collected: ', activity);
            console.log('Collection speed: ' + Math.round((3600 * activity) / workTime.all) + ' titanite/hour');
            console.log('Dungeon time: ');
            for (let i in workTime) {
                let timeNow = workTime[i];
                console.log(i + ': ', Math.round(timeNow / 3600) + ' h. ' + Math.round((timeNow % 3600) / 60) + ' min. ' + (timeNow % 60) + ' sec.');
            }
        }

        function endDungeon(reason, info) {
            if (!end) {
                end = true;
                console.log(reason, info);
                showStats();
                if (info == 'break') {
                    setProgress(
                        'Dungeon stopped: Titanite ' + dungeonActivity + '/' + maxDungeonActivity + '\r\nLost connection to game server!',
                        false,
                        hideProgress
                    );
                } else {
                    setProgress('Dungeon completed: Titanite ' + dungeonActivity + '/' + maxDungeonActivity, false, hideProgress);
                }

                if (titanHealthSettings.autoRefreshPage) {
                    setTimeout(() => {
                        location.reload();
                    }, 1000);
                } else {
                    setTimeout(cheats.refreshGame, 1000);
                }

                resolve();
            }
        }
    }

    async function executeTestDungeon() {
        const { HWHClasses, HWHFuncs } = window;

        // Prefer the native implementation from HeroWarsHelper (it returns a Promise and has the "perfect" flow).
        const hasNativeDungeon = await waitFor(() => typeof window.testDungeon === 'function', { timeoutMs: 15000, intervalMs: 200 });
        if (hasNativeDungeon) {
            HWHFuncs.setProgress('Executing: Dungeon (native)', true);
            // Dungeon can take a while; prevent the entire Auto Daily run from hanging forever if something goes wrong.
            return await withTimeout(window.testDungeon(), 20 * 60 * 1000, 'Dungeon timed out');
        }

        // Ensure merged executeDungeon is available in HWHClasses if not already present
        if (window.HWHClasses && !window.HWHClasses.executeDungeon && typeof executeDungeon === 'function') {
            window.HWHClasses.executeDungeon = executeDungeon;
        }

        // Fallback: older approach (directly instantiate executeDungeon) if native function isn't available.
        const hasExecuteDungeon = await waitFor(() => (HWHClasses && typeof HWHClasses.executeDungeon === 'function') || typeof executeDungeon === 'function', { timeoutMs: 15000, intervalMs: 200 });
        if (!hasExecuteDungeon) {
            throw new Error('Dungeon API not ready (missing testDungeon/executeDungeon)');
        }

        HWHFuncs.setProgress('Executing: Dungeon (fallback)', true);
        return await withTimeout(
            new Promise((resolve, reject) => {
                try {
                    // Use HWHClasses.executeDungeon if available, otherwise use merged executeDungeon
                    const DungeonClass = (HWHClasses && HWHClasses.executeDungeon) ? HWHClasses.executeDungeon : executeDungeon;
                    const dung = new DungeonClass(resolve, reject);
                    dung.start();
                } catch (e) {
                    reject(e);
                }
            }),
            20 * 60 * 1000,
            'Dungeon timed out (fallback)'
        );
    }

    // --- DUNGEON SETTINGS GUI ---
    function createDungeonSettingsGUI() {
        if (document.getElementById('titanSettingsGUI')) return; // Already created

        const style = document.createElement('style');
        style.textContent = `
            #titanSettingsGUI {
                position: fixed;
                top: 50px;
                right: 10px;
                width: 280px;
                background-color: rgba(0, 0, 0, 0.85);
                border: 1px solid #444;
                border-radius: 10px;
                padding: 15px 20px;
                color: #E0E0E0;
                font-family: 'Segoe UI', Arial, sans-serif;
                font-size: 14px;
                z-index: 10000;
                box-shadow: 0 6px 12px rgba(0, 0, 0, 0.4);
                display: flex;
                flex-direction: column;
                gap: 12px;
                transition: all 0.3s ease-in-out;
                max-height: calc(100vh - 70px);
                overflow-y: auto;
            }
            #titanSettingsGUI h3 {
                margin-top: 0;
                color: #FFD700;
                text-align: center;
                font-size: 18px;
                border-bottom: 1px solid #555;
                padding-bottom: 8px;
                margin-bottom: 15px;
            }
            #titanSettingsGUI h4 {
                margin-top: 5px;
                margin-bottom: 8px;
                color: #87CEEB;
                font-size: 15px;
                text-align: center;
            }
            #titanSettingsGUI label {
                display: block;
                margin-bottom: 4px;
                color: #ADD8E6;
                font-weight: bold;
            }
            #titanSettingsGUI input[type="number"] {
                width: calc(100% - 22px);
                padding: 9px 10px;
                margin-bottom: 10px;
                border: 1px solid #666;
                border-radius: 5px;
                background-color: #2a2a2a;
                color: white;
                box-sizing: border-box;
                font-size: 14px;
                -moz-appearance: textfield;
            }
            #titanSettingsGUI input[type="number"]::-webkit-outer-spin-button,
            #titanSettingsGUI input[type="number"]::-webkit-inner-spin-button {
                -webkit-appearance: none;
                margin: 0;
            }
            #titanSettingsGUI button {
                background-color: #32CD32;
                color: white;
                padding: 10px 15px;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 16px;
                font-weight: bold;
                transition: background-color 0.3s ease, transform 0.1s ease;
                margin-top: 10px;
            }
            #titanSettingsGUI button:hover {
                background-color: #228B22;
                transform: translateY(-1px);
            }
            #resetTitanSettings {
                background-color: #FF6347;
                width: fit-content;
                margin: 10px auto;
                display: block;
                padding: 8px 12px;
                font-size: 14px;
                border-radius: 5px;
            }
        `;
        document.head.appendChild(style);

        const resetButton = document.createElement('button');
        resetButton.id = 'resetTitanSettings';
        resetButton.textContent = 'Reset to Defaults';
        document.body.appendChild(resetButton);

        const gui = document.createElement('div');
        gui.id = 'titanSettingsGUI';
        gui.innerHTML = `
            <h3>Dungeon Cutoff Settings 1.0.7</h3>
            <div>
                <input type="checkbox" id="autoRefreshPage">
                <label for="autoRefreshPage">Refresh(F5) after dungeon</label>
            </div>
            <div>
                <label for="minOverallHP">General Thresholds (%) (>=30):</label>
                <input type="number" id="minOverallHP" min="0" max="100" step="1">
            </div>
            <h4>Titan 4020 - Agnus</h4>
            <div>
                <label for="titan4020HP">Minimum HP (%) (>=25):</label>
                <input type="number" id="titan4020HP" min="0" max="100" step="1">
            </div>
            <div>
                <label for="titan4020EnergyHP">Minimum HP with Max Energy (%) (>=5):</label>
                <input type="number" id="titan4020EnergyHP" min="0" max="100" step="1">
            </div>
            <h4>Titan 4010 - Moloch</h4>
            <div>
                <label for="titan4010Combined">HP + Energy combined (%) (>=63):</label>
                <input type="number" id="titan4010Combined" min="0" max="200" step="1">
            </div>
            <h4>Titan 4000 - Sigurd</h4>
            <div>
                <label for="titan4000HP">Minimum HP (%) (>=62):</label>
                <input type="number" id="titan4000HP" min="0" max="100" step="1">
            </div>
            <div>
                <label for="titan4000Energy400HP">Minimum HP With Energy >= 400 (%) (>=45):</label>
                <input type="number" id="titan4000Energy400HP" min="0" max="100" step="1">
            </div>
            <div>
                <label for="titan4000Energy670HP">Minimum HP With Energy >= 670 (%) (>=30):</label>
                <input type="number" id="titan4000Energy670HP" min="0" max="100" step="1">
            </div>
            <button id="saveTitanSettings">Save & Apply</button>
        `;
        document.body.appendChild(gui);

        gui.style.display = 'none';
        resetButton.style.display = 'none';

        function updateGUIFields() {
            document.getElementById('minOverallHP').value = titanHealthSettings.minOverallHP * 100;
            document.getElementById('titan4020HP').value = titanHealthSettings.titan4020HP * 100;
            document.getElementById('titan4020EnergyHP').value = titanHealthSettings.titan4020EnergyHP * 100;
            document.getElementById('titan4010Combined').value = titanHealthSettings.titan4010Combined * 100;
            document.getElementById('titan4000HP').value = titanHealthSettings.titan4000HP * 100;
            document.getElementById('titan4000Energy400HP').value = titanHealthSettings.titan4000Energy400HP * 100;
            document.getElementById('titan4000Energy670HP').value = titanHealthSettings.titan4000Energy670HP * 100;
            document.getElementById('autoRefreshPage').checked = titanHealthSettings.autoRefreshPage;
        }

        updateGUIFields();

        document.getElementById('saveTitanSettings').addEventListener('click', () => {
            titanHealthSettings.minOverallHP = parseFloat(document.getElementById('minOverallHP').value) / 100;
            titanHealthSettings.titan4020HP = parseFloat(document.getElementById('titan4020HP').value) / 100;
            titanHealthSettings.titan4020EnergyHP = parseFloat(document.getElementById('titan4020EnergyHP').value) / 100;
            titanHealthSettings.titan4010Combined = parseFloat(document.getElementById('titan4010Combined').value) / 100;
            titanHealthSettings.titan4000HP = parseFloat(document.getElementById('titan4000HP').value) / 100;
            titanHealthSettings.titan4000Energy400HP = parseFloat(document.getElementById('titan4000Energy400HP').value) / 100;
            titanHealthSettings.titan4000Energy670HP = parseFloat(document.getElementById('titan4000Energy670HP').value) / 100;
            titanHealthSettings.autoRefreshPage = document.getElementById('autoRefreshPage').checked;
            saveTitanHealthSettings();
            const { HWHFuncs } = window;
            if (HWHFuncs) HWHFuncs.setProgress('Dungeon settings saved!', true);
        });

        resetButton.addEventListener('click', () => {
            if (confirm('Are you sure you want to reset to default values?')) {
                titanHealthSettings = Object.assign({}, defaultTitanHealthSettings);
                saveTitanHealthSettings();
                updateGUIFields();
                const { HWHFuncs } = window;
                if (HWHFuncs) HWHFuncs.setProgress('Settings reset to defaults!', true);
            }
        });

        const inputs = gui.querySelectorAll('input[type="number"], input[type="checkbox"]');
        inputs.forEach(input => {
            input.addEventListener('change', () => {
                const id = input.id;
                if (titanHealthSettings.hasOwnProperty(id)) {
                    if (input.type === 'checkbox') {
                        titanHealthSettings[id] = input.checked;
                    } else {
                        titanHealthSettings[id] = parseFloat(input.value) / 100;
                    }
                }
                saveTitanHealthSettings();
            });
        });

        // Toggle GUI visibility (can be triggered from dungeon indicator if needed)
        window.toggleDungeonSettingsGUI = () => {
            if (gui.style.display === 'none') {
                gui.style.display = 'flex';
                resetButton.style.display = 'block';
            } else {
                gui.style.display = 'none';
                resetButton.style.display = 'none';
            }
        };
    }

    async function executeOfferFarmAllReward() {
        const { Send, HWHFuncs } = window;
        HWHFuncs.setProgress('Executing: Easter Eggs', true);
        try {
            const data = await Send({ calls: [{ name: "offerGetAll", args: {}, ident: "offerGetAll" }] });
            const offers = data.results[0].result.response.filter(e => e.type == "reward" && !e.freeRewardObtained && e.reward);
            if (offers.length === 0) return;
            const calls = offers.map(reward => ({ name: "offerFarmReward", args: { offerId: reward.id }, ident: `offerFarmReward_${reward.id}` }));
            await Send({ calls });
            HWHFuncs.setProgress('Easter Eggs: Done!', true);
        } catch (e) { console.error("Error in executeOfferFarmAllReward", e); HWHFuncs.setProgress('Easter Eggs: Error!', true); }
    }
    async function executeQuestAllFarm() {
         const { Send } = window;
         // Get current quest state from cache - following API documentation pattern
         const quests = await getQuestData();
         
         // Filter quests that are completed and ready to collect (state === 2)
         // Only process regular daily quests (id < 1000000)
         // According to API docs: state 0 = not started, 1 = in progress, 2 = completed (ready to collect)
         // After collection, quest should be removed or state should change
         const questsToFarm = quests.filter(q => {
             // Only collect if quest exists, is a regular daily quest, and is completed (state === 2)
             return q && typeof q.id !== 'undefined' && q.id < 1000000 && q.state === 2;
         });
         
         if (questsToFarm.length === 0) {
             // No quests ready to collect - all done
             return;
         }
         
         // Collect the quest rewards
         const questCalls = questsToFarm.map(q => ({ 
             name: "questFarm", 
             args: { questId: q.id }, 
             ident: `questFarm_${q.id}` 
         }));
         
         await Send({ calls: questCalls });
         // Invalidate cache after collecting quest rewards to get fresh data
         invalidateQuestCache();
    }
    async function executeMailGetAll() {
         const { Send, HWHClasses } = window;
         const mailData = await Send({ calls: [{ name: "mailGetAll", args: {}, ident: "body" }] });
         const letters = mailData.results[0].result.response.letters;
         const letterIds = HWHClasses.Letters.filter(letters);
         if (letterIds.length > 0) await Send({ calls: [{ name: "mailFarm", args: { letterIds }, ident: "body" }] });
    }
    async function executeRewardsAndMailFarm() {
        const { HWHFuncs } = window;
        HWHFuncs.setProgress('Executing: Rewards & Mail', true);
        try {
            await executeQuestAllFarm();
            await executeMailGetAll();
            HWHFuncs.setProgress('Rewards & Mail: Done!', true);
        } catch (e) { console.error("Error in executeRewardsAndMailFarm", e); HWHFuncs.setProgress('Rewards & Mail: Error!', true); }
    }
    async function executeRollAscension() {
        const { Send, HWHFuncs } = window;
        HWHFuncs.setProgress('Executing: Seer', true);
        try {
            const data = await Send({ calls: [{ name: "userGetInfo", args: {}, ident: "userGetInfo" }] });
            const refillable = data.results[0].result.response.refillable;
            const seerCharges = refillable.find(i => i.id == 47);
            if (seerCharges && seerCharges.amount > 0) await Send({ calls: [{ name: "ascensionChest_open", args: { paid: false, amount: 1 }, ident: "body" }] });
            HWHFuncs.setProgress('Seer: Done!', true);
        } catch (e) { console.error("Error in executeRollAscension", e); HWHFuncs.setProgress('Seer: Error!', true); }
    }
    // NEWLY ADDED FUNCTION - Reuses doYourBest functions from HeroWarsHelper
async function executeGetDailyBonus() {
    const { HWHClasses, HWHFuncs } = window;
    HWHFuncs.setProgress('Executing: Daily Bonus', true);
    try {
        // Reuse getDailyBonus from doYourBest class if available
        if (HWHClasses && HWHClasses.doYourBest) {
            const doYourBestInstance = new HWHClasses.doYourBest(() => {}, () => {});
            if (doYourBestInstance.functions && doYourBestInstance.functions.getDailyBonus) {
                await doYourBestInstance.functions.getDailyBonus();
                
                // Also collect subscription and zeppelin gifts using collectAllStuff pattern
                if (doYourBestInstance.functions.collectAllStuff) {
                    // collectAllStuff includes: offerFarmAllReward, subscriptionFarm, zeppelinGiftFarm, grandFarmCoins, gacha_refill
                    // But we only want subscriptionFarm and zeppelinGiftFarm here
                    const { Send } = window;
                    await Send({
                        calls: [
                            { name: "subscriptionFarm", args: {}, context: { actionTs: Math.floor(performance.now()) }, ident: "body" },
                            { name: "zeppelinGiftFarm", args: {}, context: { actionTs: Math.floor(performance.now()) }, ident: "zeppelinGiftFarm" }
                        ]
                    });
                }
                
                HWHFuncs.setProgress('Daily Bonus: Done!', true);
                return;
            }
        }
        
        // Fallback: implement our own if doYourBest is not available
        const { Send, lib } = window;
        const response = await Send({
            calls: [
                { name: "dailyBonusGetInfo", args: {}, ident: "dailyBonus" },
                { name: "userGetInfo", args: {}, ident: "userInfo" }
            ]
        });

        const dailyBonusInfo = response.results.find(r => r.ident === 'dailyBonus').result.response;
        const userInfo = response.results.find(r => r.ident === 'userInfo').result.response;

        if (!dailyBonusInfo.availableToday) {
            HWHFuncs.setProgress('Daily Bonus already collected', true);
            return;
        }

        const vipInfo = lib.getData('level').vip;
        let currentVipLevel = 0;
        for (let i in vipInfo) {
            if (+userInfo.vipPoints >= vipInfo[i].vipPoints) {
                currentVipLevel = vipInfo[i].level;
            }
        }
        const dailyBonusStat = lib.getData('dailyBonusStatic');
        const vipLevelDouble = dailyBonusStat[`${dailyBonusInfo.currentDay}_0_0`].vipLevelDouble;
        const collectVipBonus = dailyBonusInfo.availableVip && currentVipLevel >= vipLevelDouble;

        await Send({
            calls: [
                { name: "dailyBonusFarm", args: { vip: collectVipBonus ? 1 : 0 }, context: { actionTs: Math.floor(performance.now()) }, ident: "body" },
                { name: "subscriptionFarm", args: {}, context: { actionTs: Math.floor(performance.now()) }, ident: "body" },
                { name: "zeppelinGiftFarm", args: {}, context: { actionTs: Math.floor(performance.now()) }, ident: "zeppelinGiftFarm" }
            ]
        });
        
        HWHFuncs.setProgress('Daily Bonus: Done!', true);
    } catch (e) {
        console.error("Error in executeGetDailyBonus", e);
        HWHFuncs.setProgress('Daily Bonus: Error!', true);
    }
}
    async function executeGachaRefill() {
        const { Send, HWHFuncs } = window;
        HWHFuncs.setProgress('Executing: Gacha Refill', true);
        try {
            await Send({
                calls: [{
                    name: "gacha_refill",
                    args: {
                        ident: "heroGacha"
                    },
                    ident: "body"
                }]
            });
            HWHFuncs.setProgress('Gacha Refill: Done!', true);
        } catch (e) {
            console.error("Error in executeGachaRefill", e);
            HWHFuncs.setProgress('Gacha Refill: Error!', true);
        }
    }

    // --- DATA STRUCTURES ---
    const doAllTasks = [
        { id: 'getOutland', label: 'Outland', func: executeGetOutland }, { id: 'testTower', label: 'Tower', func: executeTestTower },
        { id: 'testDungeon', label: 'Dungeon', func: executeTestDungeon }, { id: 'checkExpedition', label: 'Expeditions', func: executeCheckExpedition },
        { id: 'offerFarmAllReward', label: 'Easter Eggs', func: executeOfferFarmAllReward },
        { id: 'questAllFarm', label: 'Rewards', func: executeQuestAllFarm }, { id: 'mailGetAll', label: 'Mail', func: executeMailGetAll },
        { id: 'rewardsAndMailFarm', label: 'Rewards & Mail', func: executeRewardsAndMailFarm }, { id: 'rollAscension', label: 'Seer', func: executeRollAscension },
        { id: 'getDailyBonus', label: 'Daily Bonus', func: executeGetDailyBonus },
        { id: 'gachaRefill', label: 'Gacha Refill', func: executeGachaRefill }
    ];
    const upgradeTasks = [
        { id: '10001', label: 'Upgrade Skills' }, { id: '10018', label: 'Use EXP Potion' },
        { id: '10023', label: 'Gift of Elements (x2)' }, { id: '10024', label: 'Upgrade Artifact' },
        { id: '10028', label: 'Upgrade Titan Artifact' }, { id: '10030', label: 'Upgrade Skin' },
    ];
    const questTasks = [
        { id: '10003', label: 'Heroic Missions' }, { id: '10006', label: 'Exchange Emeralds' },
        { id: '10007', label: 'Soul Atrium' }, { id: '10016', label: 'Send Gifts' },
        { id: '10020', label: 'Outland Chests' }, { id: '10022', label: 'Guild Dungeon' },
        { id: '10029', label: 'Titan Artifact Orbs' }, { id: '10044', label: 'Summon Pets' },
        { id: '10047', label: 'Guild Activity' }
    ];
    const othersTasks = [
        { id: 'GET_ENERGY', label: 'Get Energy' }, { id: 'ITEM_EXCHANGE', label: 'Item Exchange' },
        { id: 'BUY_SOULS', label: 'Buy Souls' }, { id: 'BUY_FOR_GOLD', label: 'Buy for Gold' },
        { id: 'BUY_OUTLAND', label: 'Buy Outland' }, { id: 'CLAN_STAT', label: 'Clan Statistics' },
        { id: 'EPIC_BRAWL', label: 'Cosmic Battle' }, { id: 'ARTIFACTS_UPGRADE', label: 'Artifacts Upgrade' },
        { id: 'SKINS_UPGRADE', label: 'Skins Upgrade' }, { id: 'SEASON_REWARD', label: 'Season Rewards' },
        { id: 'SELL_HERO_SOULS', label: 'Sell Souls' }
    ];

    // --- STATE MANAGEMENT ---
    function loadAllSettings() {
        const { HWHFuncs } = window;
        if (typeof window.getAutoDailySettings === 'function') {
            console.log(`${EXTENSION_NAME}: Settings Provider found. Loading settings from Provider.`);
            isProviderActive = true;
            const providerSettings = window.getAutoDailySettings();
            executionState = providerSettings.executionState || {};
            hideButtonsState = providerSettings.hideButtonsState || {};
            othersSettingsState = providerSettings.othersSettingsState || {};
        } else {
            console.log(`${EXTENSION_NAME}: Settings Provider not found. Loading account-specific settings.`);
            isProviderActive = false;
            executionState = HWHFuncs.getSaveVal('autoDaily_executionState', {});
            hideButtonsState = HWHFuncs.getSaveVal('autoDaily_hideButtonsState', { doAll: false, quests: false, actions: false, newSync: false });
            othersSettingsState = HWHFuncs.getSaveVal('autoDaily_othersSettingsState', othersTasks.reduce((acc, task) => { acc[task.id] = true; return acc; }, {}));
        }
    }

    function saveAllSettings() {
        const { HWHFuncs } = window;
        // We only save if the provider is NOT active. The provider is the source of truth when present.
        if (!isProviderActive) {
            HWHFuncs.setSaveVal('autoDaily_executionState', executionState);
            HWHFuncs.setSaveVal('autoDaily_hideButtonsState', hideButtonsState);
            HWHFuncs.setSaveVal('autoDaily_othersSettingsState', othersSettingsState);
        }
    }

    // --- UI & CORE LOGIC ---
    function waitForHWH(callback) {
        const interval = setInterval(() => {
            if (window.HWHData && window.HWHClasses && window.HWHFuncs && window.HWHData.buttons.doActions && window.HWHData.buttons.doActions.button) {
                clearInterval(interval);
                callback();
            }
        }, 500);
    }

    function createPopup() {
        if (document.getElementById('auto-daily-popup-container')) return;
        const styles = `
            .auto-daily-popup-backdrop { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 10001; }
            .auto-daily-popup-main { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: #190e08e6; border: 3px #ce9767 solid; border-radius: 10px; z-index: 10002; color: #fce1ac; padding: 20px; min-width: 900px; max-height: 80vh; overflow-y: auto; display: flex; flex-direction: column; gap: 20px; }
            .auto-daily-columns-container { display: flex; gap: 20px; flex-grow: 1; }
            .auto-daily-popup-main h2 { text-align: center; margin-top: 0; border-bottom: 1px solid #ce9767; padding-bottom: 10px; }
            .auto-daily-popup-column { flex: 1; }
            .auto-daily-task-list { list-style: none; padding: 0; margin: 0; }
            .auto-daily-task-item { display: flex; align-items: center; justify-content: space-between; padding: 8px 5px; border-bottom: 1px solid #4a3422; }
            .auto-daily-task-item:last-child { border-bottom: none; }
            .auto-daily-task-item label { display: flex; align-items: center; gap: 10px; cursor: pointer; flex-grow: 1; color: #fce1ac; }
            .auto-daily-fire-btn { cursor: pointer; font-size: 20px; background: none; border: none; padding: 0 5px; transition: transform 0.2s; color: #fce1ac;}
            .auto-daily-fire-btn:hover { transform: scale(1.2); }
            .auto-daily-status-icon { font-size: 20px; min-width: 28px; text-align: center; }
            .auto-daily-close-btn { position: absolute; top: 5px; right: 10px; font-size: 24px; color: #ce9767; cursor: pointer; border: none; background: none;}
            .auto-daily-footer { border-top: 1px solid #ce9767; margin-top: 15px; padding-top: 15px; display: flex; flex-wrap: wrap; gap: 15px 20px; font-size: 14px; align-items: center; }
            .auto-daily-footer a, .auto-daily-footer .sync-button { color: #fce1ac; text-decoration: none; cursor: pointer; background: none; border: none; font-size: 20px; padding: 0; margin-right: 10px; }
            .auto-daily-footer a:hover { text-decoration: underline; }
            .sync-settings-popup-main, .others-settings-popup-main { min-width: 400px !important; }
            .sync-settings-footer, .others-settings-footer { display: flex; justify-content: space-around; margin-top: 15px; }
        `;
        const styleSheet = document.createElement("style");
        styleSheet.innerText = styles;
        document.head.appendChild(styleSheet);
        const backdrop = document.createElement('div');
        backdrop.className = 'auto-daily-popup-backdrop';
        backdrop.id = 'auto-daily-popup-container';
        const popup = document.createElement('div');
        popup.className = 'auto-daily-popup-main';
        popup.innerHTML = `
            <button class="auto-daily-close-btn">&times;</button>
            <div class="auto-daily-columns-container">
                <div class="auto-daily-popup-column"><h2>DO ALL</h2><ul class="auto-daily-task-list" id="auto-daily-doall-list"></ul></div>
                <div class="auto-daily-popup-column"><h2>QUESTS</h2><ul class="auto-daily-task-list" id="auto-daily-quests-list"></ul></div>
                <div class="auto-daily-popup-column"><h2>UPGRADE</h2><ul class="auto-daily-task-list" id="auto-daily-upgrade-list"></ul></div>
            </div>
            <div class="auto-daily-footer">
                <button class="sync-button" id="sync-settings-btn" title="Save/Load Settings">💾</button>
                <label><input type="checkbox" id="hide-doall-btn" ${hideButtonsState.doAll ? 'checked' : ''}> Hide 'Do All'</label>
                <label><input type="checkbox" id="hide-quests-btn" ${hideButtonsState.quests ? 'checked' : ''}> Hide 'Quests'</label>
                <label><input type="checkbox" id="hide-actions-btn" ${hideButtonsState.actions ? 'checked' : ''}> Hide 'Actions'</label>
                <a id="other-settings-link">Other Settings</a>
                <label><input type="checkbox" id="new-sync-btn" ${hideButtonsState.newSync ? 'checked' : ''}> New Sync</label>
            </div>
        `;
        backdrop.appendChild(popup);
        document.body.appendChild(backdrop);
        populateList('auto-daily-doall-list', doAllTasks, false);
        populateList('auto-daily-quests-list', questTasks, true);
        populateList('auto-daily-upgrade-list', upgradeTasks, true);
        function populateList(listId, tasks, isQuest) {
             const list = document.getElementById(listId);
             tasks.forEach(task => {
                const li = document.createElement('li');
                li.className = 'auto-daily-task-item';
                li.dataset.taskId = task.id;
                const checkboxHTML = `<label><input type="checkbox" data-task-id="${task.id}" ${executionState[task.id] ? 'checked' : ''}><span>${task.label}</span></label>`;
                const actionHTML = isQuest ? `<div class="auto-daily-status-icon" data-task-id="${task.id}">⏳</div>` : `<button class="auto-daily-fire-btn" data-task-id="${task.id}">🔥</button>`;
                li.innerHTML = checkboxHTML + actionHTML;
                list.appendChild(li);
            });
        }
        backdrop.addEventListener('click', (e) => { if (e.target === backdrop || e.target.classList.contains('auto-daily-close-btn')) backdrop.remove(); });
        popup.addEventListener('change', (e) => {
            if (e.target.type === 'checkbox') {
                const taskId = e.target.dataset.taskId;
                if (taskId) {
                    executionState[taskId] = e.target.checked;
                    saveAllSettings();
                }
            }
        });
        popup.addEventListener('click', (e) => {
            const button = e.target.closest('.auto-daily-fire-btn');
            if (button) {
                const taskId = button.dataset.taskId;
                const task = [...doAllTasks, ...questTasks, ...upgradeTasks].find(t => t.id === taskId);
                if (task) executeSingleTask(task);
            }
        });
        document.getElementById('hide-doall-btn').addEventListener('change', (e) => { hideButtonsState.doAll = e.target.checked; saveAllSettings(); applyButtonVisibility(); });
        document.getElementById('hide-quests-btn').addEventListener('change', (e) => { hideButtonsState.quests = e.target.checked; saveAllSettings(); applyButtonVisibility(); });
        document.getElementById('hide-actions-btn').addEventListener('change', (e) => { hideButtonsState.actions = e.target.checked; saveAllSettings(); applyButtonVisibility(); });
        document.getElementById('new-sync-btn').addEventListener('change', (e) => { hideButtonsState.newSync = e.target.checked; saveAllSettings(); applySyncButtonState(); });
        document.getElementById('other-settings-link').addEventListener('click', createOthersPopup);
        document.getElementById('sync-settings-btn').addEventListener('click', createSyncPopup);
        updateQuestStatus();
    }
    function createOthersPopup() {
        if (document.getElementById('others-settings-popup-container')) return;
        const backdrop = document.createElement('div');
        backdrop.className = 'auto-daily-popup-backdrop';
        backdrop.id = 'others-settings-popup-container';
        const popup = document.createElement('div');
        popup.className = 'auto-daily-popup-main others-settings-popup-main';
        let listHTML = othersTasks.map(task => `
            <li class="auto-daily-task-item">
                <label><input type="checkbox" data-task-id="${task.id}" ${othersSettingsState[task.id] !== false ? 'checked' : ''}><span>${task.label}</span></label>
            </li>`).join('');
        popup.innerHTML = `
            <button class="auto-daily-close-btn">&times;</button>
            <div class="auto-daily-popup-column">
                <h2>Other Settings</h2><ul class="auto-daily-task-list">${listHTML}</ul>
                <div class="others-settings-footer">
                   <button id="others-select-all" class="auto-daily-fire-btn" style="font-size: 16px;">Select All</button>
                   <button id="others-select-none" class="auto-daily-fire-btn" style="font-size: 16px;">Select None</button>
                </div>
            </div>`;
        backdrop.appendChild(popup);
        document.body.appendChild(backdrop);
        backdrop.addEventListener('click', (e) => { if (e.target === backdrop || e.target.classList.contains('auto-daily-close-btn')) backdrop.remove(); });
        popup.addEventListener('change', (e) => {
            if (e.target.type === 'checkbox') {
                othersSettingsState[e.target.dataset.taskId] = e.target.checked;
                saveAllSettings();
                applyOthersVisibility();
            }
        });
        document.getElementById('others-select-all').addEventListener('click', () => {
            popup.querySelectorAll('input[type="checkbox"]').forEach(cb => { cb.checked = true; othersSettingsState[cb.dataset.taskId] = true; });
            saveAllSettings();
            applyOthersVisibility();
        });
        document.getElementById('others-select-none').addEventListener('click', () => {
            popup.querySelectorAll('input[type="checkbox"]').forEach(cb => { cb.checked = false; othersSettingsState[cb.dataset.taskId] = false; });
            saveAllSettings();
            applyOthersVisibility();
        });
    }
    function createSyncPopup() {
        if (document.getElementById('sync-settings-popup-container')) return;
        const backdrop = document.createElement('div');
        backdrop.className = 'auto-daily-popup-backdrop';
        backdrop.id = 'sync-settings-popup-container';
        const popup = document.createElement('div');
        popup.className = 'auto-daily-popup-main sync-settings-popup-main';
        popup.innerHTML = `
            <button class="auto-daily-close-btn">&times;</button>
            <div class="auto-daily-popup-column">
                <h2>Import / Export Settings</h2>
                <div class="sync-settings-footer">
                   <button id="export-settings-btn" class="auto-daily-fire-btn" style="font-size: 16px;">Export to File</button>
                   <button id="import-settings-btn" class="auto-daily-fire-btn" style="font-size: 16px;">Import from File</button>
                </div>
                ${isProviderActive ? `
                <div class="sync-settings-footer" style="border-top: 1px solid #4a3422; margin-top: 20px; padding-top: 20px;">
                   <button id="set-as-default-btn" class="auto-daily-fire-btn" style="font-size: 16px;">Set Current as Default</button>
                </div>` : ''}
            </div>`;
        backdrop.appendChild(popup);
        document.body.appendChild(backdrop);
        backdrop.addEventListener('click', (e) => { if (e.target === backdrop || e.target.classList.contains('auto-daily-close-btn')) backdrop.remove(); });
        document.getElementById('export-settings-btn').addEventListener('click', handleExport);
        document.getElementById('import-settings-btn').addEventListener('click', handleImport);
        if (isProviderActive) {
            document.getElementById('set-as-default-btn').addEventListener('click', handleSetAsDefault);
        }
    }
    function handleExport() {
        const { HWHFuncs } = window;
        const settingsToExport = { executionState, hideButtonsState, othersSettingsState };
        const settingsJSON = JSON.stringify(settingsToExport, null, 2);
        const blob = new Blob([settingsJSON], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `daily_quests.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        HWHFuncs.setProgress('Settings exported!', true);
    }
    function handleImport() {
        const { HWHFuncs } = window;
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = e => {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = readerEvent => {
                try {
                    const importedSettings = JSON.parse(readerEvent.target.result);
                    if (importedSettings.executionState && importedSettings.hideButtonsState && importedSettings.othersSettingsState) {
                        executionState = importedSettings.executionState;
                        hideButtonsState = importedSettings.hideButtonsState;
                        othersSettingsState = importedSettings.othersSettingsState;
                        saveAllSettings();
                        applyButtonVisibility();
                        applyOthersVisibility();
                        applySyncButtonState();
                        const mainPopup = document.getElementById('auto-daily-popup-container');
                        if (mainPopup) mainPopup.remove();
                        createPopup();
                        HWHFuncs.setProgress('Settings imported successfully!', true);
                    } else { throw new Error("Invalid file structure."); }
                } catch (err) { alert('Error importing file: ' + err.message); }
            };
            reader.readAsText(file, 'UTF-8');
        };
        input.click();
    }
    function handleSetAsDefault() {
        const { HWHFuncs } = window;
        if (typeof window.setAutoDailySettings === 'function') {
            const allSettings = { executionState, hideButtonsState, othersSettingsState };
            window.setAutoDailySettings(allSettings);
            HWHFuncs.setProgress('Current settings saved as default for the Provider!', true);
        } else {
            alert('Settings Provider script is not active or is missing the set function.');
        }
    }
    function applyButtonVisibility() {
        const { getOutland, dailyQuests, doActions } = window.HWHData.buttons;
        if(getOutland && getOutland.button) getOutland.button.style.display = hideButtonsState.doAll ? 'none' : 'flex';
        if(dailyQuests && dailyQuests.button) dailyQuests.button.style.display = hideButtonsState.quests ? 'none' : 'flex';
        if(doActions && doActions.button) doActions.button.style.display = hideButtonsState.actions ? 'none' : 'flex';
    }
    function applyOthersVisibility() {
        const isAnyChecked = Object.values(othersSettingsState).some(value => value === true);
        if (customOthersButton) customOthersButton.style.display = isAnyChecked ? 'flex' : 'none';
    }
    async function onCustomOthersClick() {
        const { HWHFuncs, I18N, HWHClasses } = window;
        const visibleTasks = othersTasks.filter(task => othersSettingsState[task.id]);
        if (visibleTasks.length === 0) return;
        const popupButtons = visibleTasks.map(task => ({
            msg: I18N(task.id),
            title: I18N(task.id + '_TITLE'),
            result: async () => {
                if (HWHClasses.executeBrawls && HWHClasses.executeBrawls.isBrawlsAutoStart) return;
                // Use HWHData.buttons.doOthers functionality if available, otherwise show error
                const { HWHData, HWHFuncs } = window;
                if (HWHData && HWHData.buttons && HWHData.buttons.doOthers && HWHData.buttons.doOthers.button) {
                    // Trigger the original doOthers button click handler
                    HWHData.buttons.doOthers.button.click();
                } else {
                    HWHFuncs.setProgress(`${task.label}: Function not available. Use main menu "Others" button.`, true);
                    console.warn(`[Auto Daily] Others task ${task.id} (${task.label}) - handler not available`);
                }
            }
        }));
        popupButtons.push({ result: false, isClose: true });
        const answer = await HWHFuncs.popup.confirm(I18N('CHOOSE_ACTION'), popupButtons);
        if (typeof answer === 'function') answer();
    }
    function applySyncButtonState() {
        const { HWHClasses, HWHData, HWHFuncs } = window;
        const { newDay } = HWHData.buttons;
        const autoDailyButton = document.querySelector('[data-extension-button="auto-daily"]');
        if (!autoDailyButton) return;
        const scriptMenuContainer = HWHData.buttons.doActions.button?.parentElement;
        if (!scriptMenuContainer) return;
        if (combinedButton) { combinedButton.remove(); combinedButton = null; }
        autoDailyButton.style.display = 'flex';
        if(newDay && newDay.button) newDay.button.style.display = 'flex';
        if (hideButtonsState.newSync) {
            if(newDay && newDay.button) newDay.button.style.display = 'none';
            autoDailyButton.style.display = 'none';
            const buttonList = [{
                name: 'Auto Daily', onClick: createPopup, title: 'Open the Auto Daily control panel',
            }, {
                name: '🔄',
                onClick: () => { HWHFuncs.setProgress('Syncing...', true); window.cheats.refreshGame(); },
                title: 'Run Sync', color: 'green',
            }];
            combinedButton = HWHClasses.ScriptMenu.getInst().addCombinedButton(buttonList, scriptMenuContainer);
            if (!combinedButton) return;
            const autoDailyCombined = combinedButton.children[0];
            const syncCombined = combinedButton.children[1];
            if (autoDailyCombined) {
                autoDailyCombined.style.flexGrow = '1';
                const buttonText = autoDailyCombined.querySelector('.scriptMenu_buttonText');
                if (buttonText) buttonText.style.whiteSpace = 'nowrap';
            }
            if (syncCombined) {
                syncCombined.style.flexGrow = '0';
                syncCombined.style.width = '45px';
            }
            if (HWHData.buttons.doActions.button && scriptMenuContainer.contains(HWHData.buttons.doActions.button)) {
                scriptMenuContainer.insertBefore(combinedButton, HWHData.buttons.doActions.button);
            } else {
                scriptMenuContainer.appendChild(combinedButton);
            }
        }
    }
    async function updateQuestStatus() {
        const { HWHClasses } = window;
        // Check quest completion status using cached data - following API documentation pattern
        // API docs: state 0 = not started, 1 = in progress, 2 = completed
        const allQuests = await getQuestData();
        
        const questManager = new HWHClasses.dailyQuests();
        await questManager.autoInit();
        [...questTasks, ...upgradeTasks].forEach(task => {
            // Convert task.id to number for comparison (API returns numeric IDs)
            const questId = parseInt(task.id, 10);
            // Use direct API call result with proper ID comparison
            const questData = allQuests.find(q => q.id === questId);
            const questUI = document.querySelector(`.auto-daily-status-icon[data-task-id="${task.id}"]`);
            if (!questUI) return;
            let iconHTML = `<span title="Not available">🌑</span>`;
            if (questData) {
                 // Check if quest is completed (state === 2) - following API documentation
                 if (questData.state === 2) {
                    iconHTML = `<span title="Already done">✅</span>`;
                } else {
                    // Try numeric key first (as that's what the API uses), then string key
                    const questHandler = questManager.dataQuests[questId] || questManager.dataQuests[task.id];
                    if (questHandler) {
                        // Handle quests with doItFunc (like dungeon quest 10022)
                        // These quests can be executed even if isWeCanDo returns false
                        if (questHandler.doItFunc && questData.state === 1) {
                            iconHTML = `<button class="auto-daily-fire-btn" data-task-id="${task.id}">🔥</button>`;
                        } else if (questHandler.isWeCanDo && typeof questHandler.isWeCanDo === 'function') {
                            try {
                                if (questHandler.isWeCanDo.call(questManager)) {
                                    iconHTML = `<button class="auto-daily-fire-btn" data-task-id="${task.id}">🔥</button>`;
                                }
                            } catch (e) {
                                // If isWeCanDo check fails, just show as not available
                                console.warn(`[updateQuestStatus] Quest ${task.id} isWeCanDo check failed:`, e);
                            }
                        }
                    }
                }
            }
            questUI.innerHTML = iconHTML;
        });
    }
    async function executeSingleTask(task) {
        const { HWHFuncs, Send, HWHClasses } = window;
        try {
            if (task.func) {
                HWHFuncs.setProgress(`Executing: ${task.label}`, true);
                await task.func();
            } else {
                 // Check quest completion status using cached data - following API documentation pattern
                 // API docs: state 0 = not started, 1 = in progress, 2 = completed
                 const allQuests = await getQuestData();
                 
                 // Convert task.id to number for comparison (API returns numeric IDs)
                 const questId = parseInt(task.id, 10);
                 const questData = allQuests.find(q => q.id === questId);
                 
                 if (!questData) {
                     // Quest not found - this is normal if quest is not available or not unlocked
                     HWHFuncs.setProgress(`${task.label}: No Quest`, true);
                     return;
                 }
                 
                 // Check quest state and show appropriate message
                 // Following API documentation pattern: state 0 = not started, 1 = in progress, 2 = completed
                 if (questData.state === 2) {
                     // Quest is already completed
                     HWHFuncs.setProgress(`${task.label}: Already completed`, true);
                     return;
                 }
                 
                 if (questData.state === 0) {
                     // Quest not started yet
                     HWHFuncs.setProgress(`${task.label}: Not started yet`, true);
                     return;
                 }
                 
                 // Quest is in progress (state === 1) - proceed with execution
                 HWHFuncs.setProgress(`Executing: ${task.label}`, true);
                 
                 // Initialize quest manager for execution
                 const questManager = new HWHClasses.dailyQuests();
                 await questManager.autoInit();
                 
                 // Use either string or numeric key to get the quest handler
                 // Try numeric key first (as that's what the API uses)
                 const questHandler = questManager.dataQuests[questId] || questManager.dataQuests[task.id];
                 
                 if (!questHandler) {
                     console.warn(`[executeSingleTask] Quest ${task.id} (${task.label}) not found in dataQuests!`);
                     HWHFuncs.setProgress(`${task.label}: Handler not found`, true);
                     return;
                 }
                 
                 // Handle quests with doItFunc (like dungeon quest 10022)
                 if (questHandler.doItFunc) {
                     // Quest uses a function instead of API calls
                     if (task.id === '10022') {
                         // Special handling for dungeon quest - ensure it executes last
                         // Wait a bit to ensure all other operations are complete
                         await new Promise(resolve => setTimeout(resolve, 2000));
                         await executeTestDungeon();
                         invalidateQuestCache();
                         return;
                     } else {
                         // For other doItFunc quests, call the function directly
                         await questHandler.doItFunc();
                         invalidateQuestCache();
                         return;
                     }
                 }
                 
                 // Check if quest can be done (only for doItCall quests)
                 const isWeCanDo = questHandler.isWeCanDo;
                 if (!isWeCanDo || typeof isWeCanDo !== 'function') {
                     console.warn(`[executeSingleTask] Quest ${task.id} (${task.label}) has no isWeCanDo function!`);
                     HWHFuncs.setProgress(`${task.label}: Invalid handler`, true);
                     return;
                 }
                 
                 let canDo = false;
                 try {
                     canDo = isWeCanDo.call(questManager);
                 } catch (e) {
                     console.error(`[executeSingleTask] Quest ${task.id} isWeCanDo check failed:`, e);
                     HWHFuncs.setProgress(`${task.label}: Check failed - ${e.message}`, true);
                     return;
                 }
                 
                 if (!canDo) {
                     HWHFuncs.setProgress(`${task.label}: Cannot execute now (requirements not met)`, true);
                     return;
                 }
                 
                 let calls = [];
                 if (task.id === '10023') {
                     const heroId = questManager.getHeroIdTitanGift();
                     calls = [
                         { name: 'heroTitanGiftLevelUp', args: { heroId }, ident: 'up_1' }, { name: 'heroTitanGiftDrop', args: { heroId }, ident: 'drop_1' },
                         { name: 'heroTitanGiftLevelUp', args: { heroId }, ident: 'up_2' }, { name: 'heroTitanGiftDrop', args: { heroId }, ident: 'drop_2' }
                     ];
                 } else if (questHandler.doItCall) {
                     calls = questHandler.doItCall.call(questManager);
                 } else {
                     HWHFuncs.setProgress(`${task.label}: No execution method available`, true);
                     return;
                 }
                 
                if(calls.length > 0) {
                    await Send({ calls });
                    // Invalidate cache after executing quest to get fresh data
                    invalidateQuestCache();
                } else {
                    HWHFuncs.setProgress(`${task.label}: No actions available`, true);
                    return;
                }
            }
            HWHFuncs.setProgress(`${task.label} finished!`, true);
        } catch (e) {
            console.error(`[executeSingleTask] ERROR executing task ${task.id} (${task.label}):`, e);
            HWHFuncs.setProgress(`Error with ${task.label}!`, true);
        }
    }
    function scheduleAutoRuns() {
        const doAllChecked = doAllTasks.filter(task => executionState[task.id]);
        const questsAndUpgradeChecked = [...questTasks, ...upgradeTasks].filter(task => executionState[task.id]);
        if (doAllChecked.length === 0 && questsAndUpgradeChecked.length === 0) return;

        // Dungeon and dungeon-quest should run last to avoid interference with other API/UI flows.
        const doAllNonDungeon = doAllChecked.filter(t => t.id !== 'testDungeon');
        const doAllDungeon = doAllChecked.filter(t => t.id === 'testDungeon');

        // Quest 10022 is "Guild Dungeon" in the quest list; it also triggers dungeon logic.
        const questsNonDungeon = questsAndUpgradeChecked.filter(t => t.id !== '10022');
        const questsDungeon = questsAndUpgradeChecked.filter(t => t.id === '10022');

        const ordered = [
            ...doAllNonDungeon,
            ...questsNonDungeon,
            ...doAllDungeon,
            ...questsDungeon,
        ];

        // Run sequentially (await each). The previous setTimeout-based scheduler could overlap long tasks and stall mid-run.
        setTimeout(async () => {
            const { HWHFuncs } = window;
            if (autoRunInProgress) return;
            autoRunInProgress = true;
            try {
                for (const task of ordered) {
                    await executeSingleTask(task);
                    // Small gap to keep UI responsive and avoid bursting calls.
                    await sleep(500);
                }
                HWHFuncs.setProgress('Auto Daily: All selected tasks finished!', true);
            } catch (e) {
                console.error('[Auto Daily] Auto-run failed:', e);
                HWHFuncs.setProgress(`Auto Daily: Stopped (${e.message || 'error'})`, true);
            } finally {
                autoRunInProgress = false;
            }
        }, 7000);
    }
    function createCustomOthersButton() {
        const { HWHClasses, HWHData, I18N } = window;
        const origOthersButton = HWHData.buttons.doOthers.button;
        if (!origOthersButton) return;
        const scriptMenuContainer = origOthersButton.parentElement;
        if (!scriptMenuContainer) return;
        origOthersButton.style.display = 'none';
        customOthersButton = HWHClasses.ScriptMenu.getInst().addButton({
            name: I18N('OTHERS'),
            title: I18N('OTHERS_TITLE'),
            onClick: onCustomOthersClick
        }, scriptMenuContainer);
        const referenceButton = HWHData.buttons.testTitanArena.button || HWHData.buttons.testDungeon.button;
        if (referenceButton && scriptMenuContainer.contains(referenceButton)) {
             scriptMenuContainer.insertBefore(customOthersButton, referenceButton);
        } else {
             scriptMenuContainer.appendChild(customOthersButton);
        }
    }

    function maindaily() {
        const { HWHFuncs, HWHData, HWHClasses } = window;

        loadAllSettings();
        loadTitanHealthSettings(); // Load dungeon titan health settings
        console.log(`${EXTENSION_NAME} v${EXTENSION_VERSION} is loading...`);
        HWHFuncs.addExtentionName(EXTENSION_NAME, EXTENSION_VERSION, EXTENSION_AUTHOR);
        
        // Create dungeon settings GUI
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', createDungeonSettingsGUI);
        } else {
            createDungeonSettingsGUI();
        }

        const scriptMenuContainer = HWHData.buttons.doActions.button.parentElement;
        const actionsButton = HWHData.buttons.doActions.button;

        const autoDailyButton = HWHClasses.ScriptMenu.getInst().addButton({
            name: 'Auto Daily',
            onClick: createPopup,
            title: 'Open the Auto Daily control panel',
        }, scriptMenuContainer);
        autoDailyButton.dataset.extensionButton = "auto-daily";

        scriptMenuContainer.insertBefore(autoDailyButton, actionsButton);
        createCustomOthersButton();

        applyButtonVisibility();
        applyOthersVisibility();
        applySyncButtonState();

        setTimeout(updateQuestStatus, 9000);
        scheduleAutoRuns();

        console.log(`${EXTENSION_NAME} initialized successfully.`);
    }

    waitForHWH(maindaily);

})();