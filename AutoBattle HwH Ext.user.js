// ==UserScript==
// @name         AutoBattle HwH Ext
// @namespace    HeroWarsHelper.AutoBattle
// @version      1.0
// @description  Auto-execute Arena, Grand Arena, Guild War attacks, and Raid Nodes on script load
// @author       YourName
// @match        https://www.hero-wars.com/*
// @match        https://apps-1701433570146040.apps.fbsbx.com/*
// @grant        none
// @run-at       document-end
// @downloadURL https://github.com/mailming/AutoHero/raw/refs/heads/develop/AutoBattle%20HwH%20Ext.user.js
// @updateURL https://github.com/mailming/AutoHero/raw/refs/heads/develop/AutoBattle%20HwH%20Ext.user.js
// ==/UserScript==

(function() {
    'use strict';

    const waitForHWH = setInterval(() => {
        if (window.HWHClasses && window.HWHClasses.ScriptMenu && window.lib && window.cheats) {
            const scriptMenu = window.HWHClasses.ScriptMenu.getInst();
            if (scriptMenu && scriptMenu.mainMenu) {
                clearInterval(waitForHWH);
                initializeExtension();
            }
        }
    }, 200);

    function initializeExtension() {
        console.log('AutoBattle: HWH UI is ready, initializing extension...');

        const { HWHClasses, HWHFuncs, Send, cheats, Caller, lib } = window;

        // Helper function to get battle type
        function getBattleType(strBattleType) {
            if (!strBattleType) {
                return null;
            }
            switch (strBattleType) {
                case 'titan_pvp':
                    return 'get_titanPvp';
                case 'titan_pvp_manual':
                case 'titan_clan_pvp':
                case 'clan_pvp_titan':
                case 'clan_global_pvp_titan':
                case 'brawl_titan':
                case 'challenge_titan':
                case 'titan_mission':
                    return 'get_titanPvpManual';
                case 'clan_raid':
                case 'adventure':
                case 'clan_global_pvp':
                case 'epic_brawl':
                case 'clan_pvp':
                    return 'get_clanPvp';
                case 'dungeon_titan':
                case 'titan_tower':
                    return 'get_titan';
                case 'tower':
                case 'clan_dungeon':
                    return 'get_tower';
                case 'pve':
                case 'mission':
                    return 'get_pve';
                case 'mission_boss':
                    return 'get_missionBoss';
                case 'challenge':
                case 'pvp_manual':
                    return 'get_pvpManual';
                case 'grand':
                case 'arena':
                case 'pvp':
                case 'clan_domination':
                    return 'get_pvp';
                case 'core':
                    return 'get_core';
                default: {
                    if (strBattleType.includes('invasion')) {
                        return 'get_invasion';
                    }
                    if (strBattleType.includes('boss')) {
                        return 'get_boss';
                    }
                    if (strBattleType.includes('titan_arena')) {
                        return 'get_titanPvpManual';
                    }
                    return 'get_clanPvp';
                }
            }
        }

        // Helper function to access I18N (translation)
        function I18N(constant, replace) {
            if (window.I18N && typeof window.I18N === 'function') {
                return window.I18N(constant, replace);
            }
            // Fallback to cheats.translate if I18N not available
            if (replace) {
                let result = constant;
                for (const key in replace) {
                    result = result.replace(`{${key}}`, replace[key]);
                }
                return result;
            }
            return constant;
        }

        // Helper function to access getUserInfo
        function getUserInfo() {
            if (window.getUserInfo && typeof window.getUserInfo === 'function') {
                return window.getUserInfo();
            }
            return {};
        }

        // Helper function for setIsCancalBattle
        function setIsCancalBattle(value) {
            if (window.setIsCancalBattle && typeof window.setIsCancalBattle === 'function') {
                window.setIsCancalBattle(value);
            }
        }

        // Helper function for setProgress
        function setProgress(text, hide) {
            HWHFuncs.setProgress(text, hide);
        }

        // Helper function for random
        function random(min, max) {
            return Math.floor(Math.random() * (max - min + 1) + min);
        }

        // Helper function for Send (used in raid nodes)
        function SendRequest(json, callback) {
            if (typeof Send === 'function') {
                Send(json).then(result => {
                    if (callback) callback(result);
                }).catch(error => {
                    if (callback) callback({ error: error });
                });
            } else {
                console.error('Send function not available');
                if (callback) callback({ error: 'Send function not available' });
            }
        }

        // BattleCalc from cheats
        const BattleCalc = cheats.BattleCalc;

        // ========== EXECUTE ARENA CLASS ==========
        function executeArena(resolve, reject) {
            this.resolve = resolve;
            this.reject = reject;
            this.arenaType = 'arena';
            this.attemptsRemaining = 0;
            this.victories = 0;
            this.arenaInfo = null;
            this.teamInfo = null;
            this.opponents = [];

            this.start = async function(arenaType = 'arena') {
                this.arenaType = arenaType;
                setProgress(`${this.arenaType === 'grand' ? I18N('GRAND_ARENA') : I18N('ARENA')}: ${I18N('INITIALIZING')}...`);

                try {
                    // Get arena status and team data
                    await this.getArenaStatus();

                    if (this.attemptsRemaining <= 0) {
                        if (this.arenaInfo && this.arenaInfo.status === 'peace_time') {
                            this.end('Arena is in peace time - no battles available');
                        } else if (this.arenaInfo && this.arenaInfo.status === 'disabled') {
                            this.end('Arena is disabled - no battles available');
                        } else if (this.arenaInfo && this.arenaInfo.status === 'error') {
                            const errorMsg = this.arenaInfo.errorMessage || 'Arena API error - no battles available';
                            this.end(errorMsg);
                        } else {
                            this.end('No attempts remaining');
                        }
                        return;
                    }

                    await this.getAvailableTeams();

                    // Get detailed opponent information
                    const detailedOpponents = await this.getArenaOpponents();
                    if (detailedOpponents && Object.keys(detailedOpponents).length > 0) {
                        this.opponents = detailedOpponents;
                    }

                    // Find and sort opponents by difficulty
                    this.findEasiestOpponents();

                    // Execute battles
                    await this.executeBattles();

                } catch (error) {
                    console.error('Arena execution error:', error);
                    this.end('Error: ' + error.message);
                }
            }

            this.getArenaStatus = async function() {
                try {
                    const calls = [{
                        name: "userGetInfo",
                        args: {},
                        context: { actionTs: Date.now() },
                        ident: "body"
                    }];

                    const response = await Send(JSON.stringify({calls}));
                    console.log('User info response:', response);

                    if (response && response.results && response.results[0] && response.results[0].result) {
                        const userInfo = response.results[0].result.response;
                        console.log('User info:', userInfo);

                        if (this.arenaType === 'grand') {
                            // Grand Arena attempts are stored in refillable array with id: 21
                            const grandAttemptsItem = userInfo.refillable ? userInfo.refillable.find(r => r.id === 21) : null;
                            const grandAttempts = grandAttemptsItem ? grandAttemptsItem.amount : 0;

                            this.arenaInfo = {
                                attempts: grandAttempts,
                                rank: userInfo.grandPlace || 1000,
                                status: grandAttempts > 0 ? 'active' : 'no_attempts',
                                rivals: [],
                                canUpdateDefenders: false,
                                battleStartTs: 0
                            };
                            this.attemptsRemaining = grandAttempts > 0 ? 1 : 0; // Only do one battle per execution

                            if (grandAttempts <= 0) {
                                setProgress(`${I18N('GRAND_ARENA')}: No attempts remaining (${grandAttempts})`);
                                return;
                            }

                            setProgress(`${I18N('GRAND_ARENA')}: ${grandAttempts} attempts available - executing single battle`);
                            return;
                        } else {
                            // Arena attempts are stored in refillable array with id: 6
                            const arenaAttemptsItem = userInfo.refillable ? userInfo.refillable.find(r => r.id === 6) : null;
                            const arenaAttempts = arenaAttemptsItem ? arenaAttemptsItem.amount : 0;

                            this.arenaInfo = {
                                attempts: arenaAttempts,
                                rank: userInfo.arenaPlace || 1000,
                                status: arenaAttempts > 0 ? 'active' : 'no_attempts',
                                rivals: [],
                                canUpdateDefenders: false,
                                battleStartTs: 0
                            };
                            this.attemptsRemaining = arenaAttempts > 0 ? 1 : 0; // Only do one battle per execution

                            if (arenaAttempts <= 0) {
                                setProgress(`${I18N('ARENA')}: No attempts remaining (${arenaAttempts})`);
                                return;
                            }

                            setProgress(`${I18N('ARENA')}: ${arenaAttempts} attempts available - executing single battle`);
                            return;
                        }
                    }
                } catch (error) {
                    console.log('Could not get user info, using fallback:', error);
                }

                // Fallback to placeholder data
                console.log(`${this.arenaType === 'grand' ? 'Grand Arena' : 'Arena'} GetInfo API not available, using alternative approach`);
                this.arenaInfo = {
                    attempts: 1,
                    rank: 1000,
                    status: 'active',
                    rivals: [],
                    canUpdateDefenders: false,
                    battleStartTs: 0
                };
                this.attemptsRemaining = 1;
                this.opponents = [];
                setProgress(`${this.arenaType === 'grand' ? I18N('GRAND_ARENA') : I18N('ARENA')}: ${I18N('INITIALIZING')} - executing single battle...`);
                return;
            }

            this.getAvailableTeams = async function() {
                const calls = [{
                    name: "teamGetAll",
                    args: {},
                    ident: "teamGetAll"
                }, {
                    name: "teamGetFavor",
                    args: {},
                    ident: "teamGetFavor"
                }, {
                    name: "heroGetAll",
                    args: {},
                    ident: "heroGetAll"
                }];

                const response = await Send(JSON.stringify({calls}));
                console.log('Team API response:', response);

                if (!response || !response.results || response.results.length < 3) {
                    throw new Error('Invalid team API response structure');
                }

                if (!response.results[0] || !response.results[0].result || !response.results[0].result.response) {
                    throw new Error('Invalid teamGetAll response');
                }
                if (!response.results[1] || !response.results[1].result || !response.results[1].result.response) {
                    throw new Error('Invalid teamGetFavor response');
                }
                if (!response.results[2] || !response.results[2].result || !response.results[2].result.response) {
                    throw new Error('Invalid heroGetAll response');
                }

                this.teamInfo = {
                    teams: response.results[0].result.response,
                    favor: response.results[1].result.response,
                    heroes: Object.values(response.results[2].result.response)
                };

                console.log('Team info:', this.teamInfo);
            }

            this.getArenaOpponents = async function() {
                console.log('Getting arena opponents...');

                const apiName = this.arenaType === 'grand' ? 'grandFindEnemies' : 'arenaFindEnemies';
                const calls = [{
                    name: apiName,
                    args: {},
                    context: {
                        actionTs: Date.now()
                    },
                    ident: "body"
                }];

                try {
                    const response = await Send(JSON.stringify({calls}));
                    console.log('Arena opponents API response:', response);

                    if (!response || !response.results || !response.results[0] || !response.results[0].result) {
                        throw new Error(`Invalid API response structure for ${apiName}`);
                    }

                    const opponents = response.results[0].result.response;
                    console.log('Detailed opponents info:', opponents);

                    const opponentsMap = {};
                    if (Array.isArray(opponents)) {
                        opponents.forEach(opponent => {
                            opponentsMap[opponent.userId] = opponent;
                        });
                    }

                    return opponentsMap;
                } catch (error) {
                    console.error('Error getting arena opponents:', error);
                    return {};
                }
            }

            this.findEasiestOpponents = function() {
                if (this.opponents && typeof this.opponents === 'object') {
                    const availableOpponents = [];

                    for (const [opponentId, opponentData] of Object.entries(this.opponents)) {
                        availableOpponents.push({
                            opponent: {
                                id: opponentId,
                                power: parseInt(opponentData.power) || 0,
                                place: parseInt(opponentData.place) || 1000,
                                heroes: opponentData.heroes || [],
                                banners: opponentData.banners || [],
                                user: opponentData.user || {}
                            },
                            rank: parseInt(opponentData.place) || 1000,
                            difficulty: parseInt(opponentData.power) || 0
                        });
                    }

                    this.opponents = availableOpponents.sort((a, b) => a.difficulty - b.difficulty);
                    console.log('Available opponents:', this.opponents);
                } else {
                    console.log('No opponents data to process');
                    this.opponents = [];
                }
            }

            this.executeBattles = async function() {
                for (let i = 0; i < this.attemptsRemaining && this.opponents.length > 0; i++) {
                    const opponent = this.opponents.shift();
                    setProgress(`${this.arenaType === 'grand' ? I18N('GRAND_ARENA') : I18N('ARENA')}: ${I18N('BATTLE')} ${i + 1}/${this.attemptsRemaining} - Opponent ${opponent.opponent.id}`);

                    try {
                        if (this.arenaType === 'grand') {
                            const canAttack = await this.checkTargetRange(opponent.opponent.id);
                            if (!canAttack) {
                                console.log(`Target ${opponent.opponent.id} is not in range, skipping`);
                                continue;
                            }
                        }

                        const result = await this.executeBattle(opponent);
                        if (result.win) {
                            this.victories++;
                        }
                    } catch (error) {
                        console.error('Battle error:', error);
                    }
                }

                this.end(`Completed ${this.victories}/${this.attemptsRemaining} victories`);
            }

            this.executeBattle = async function(opponent) {
                try {
                    if (!opponent || !opponent.opponent || !opponent.opponent.id) {
                        console.error('Invalid opponent data:', opponent);
                        return { win: false };
                    }

                    console.log('Executing battle against opponent:', opponent.opponent.id);

                    const teamConfig = this.getTeamConfiguration();
                    console.log('Using team configuration for battle:', teamConfig);

                    const battleResult = await this.startArenaBattle(opponent.opponent.id, teamConfig);

                    await this.endArenaBattle(battleResult);

                    return battleResult;
                } catch (error) {
                    console.error('Error in executeBattle:', error);
                    return { win: false };
                }
            }

            this.checkTargetRange = async function(targetId) {
                if (this.arenaType !== 'grand') {
                    return true;
                }

                try {
                    const calls = [{
                        name: "grandCheckTargetRange",
                        args: {
                            ids: [targetId]
                        },
                        context: {
                            actionTs: Date.now()
                        },
                        ident: "body"
                    }];

                    const response = await Send(JSON.stringify({calls}));
                    console.log('Target range check response:', response);

                    if (response && response.results && response.results[0] && response.results[0].result) {
                        const result = response.results[0].result.response;
                        return result[targetId] === true;
                    }

                    return false;
                } catch (error) {
                    console.error('Error checking target range:', error);
                    return false;
                }
            }

            this.getTeamConfiguration = function() {
                if (!this.teamInfo || !this.teamInfo.teams) {
                    console.error('Team info not available, using fallback configuration');
                    return this.getFallbackTeamConfiguration();
                }

                const teamData = this.teamInfo.teams;
                const favorData = this.teamInfo.favor;

                if (this.arenaType === 'grand') {
                    const grandTeams = teamData.grand || [];
                    const grandFavor = favorData.grand || {};

                    console.log('Grand Arena teams from system:', grandTeams);
                    console.log('Grand Arena favor from system:', grandFavor);

                    const heroes = [];
                    const pets = [];

                    for (let i = 0; i < grandTeams.length; i++) {
                        const team = grandTeams[i];
                        if (team && team.length >= 6) {
                            heroes.push(team.slice(0, 5));
                            pets.push(team[5]);
                        }
                    }

                    let banners = [1, 2, 3];
                    try {
                        const userInfo = getUserInfo();
                        if (userInfo && userInfo.banners) {
                            if (Array.isArray(userInfo.banners)) {
                                banners = userInfo.banners.length >= 3 ? userInfo.banners.slice(0, 3) : 
                                         userInfo.banners.length === 1 ? [userInfo.banners[0], userInfo.banners[0], userInfo.banners[0]] : [1, 2, 3];
                            } else if (typeof userInfo.banners === 'number') {
                                banners = [userInfo.banners, userInfo.banners, userInfo.banners];
                            }
                        }
                    } catch (e) {
                        console.log('Could not get banners from userInfo, using defaults');
                    }

                    return {
                        heroes: heroes,
                        pets: pets,
                        favor: grandFavor,
                        banners: banners
                    };
                } else {
                    const arenaTeam = teamData.arena || [];
                    const arenaFavor = favorData.arena || {};

                    console.log('Regular Arena team from system:', arenaTeam);
                    console.log('Regular Arena favor from system:', arenaFavor);

                    let heroes = [];
                    let pet = null;

                    if (arenaTeam && arenaTeam.length >= 6) {
                        heroes = arenaTeam.slice(0, 5);
                        pet = arenaTeam[5];
                    }

                    let banners = [1];
                    try {
                        const userInfo = getUserInfo();
                        if (userInfo && userInfo.banner) {
                            banners = typeof userInfo.banner === 'number' ? [userInfo.banner] : 
                                     Array.isArray(userInfo.banner) ? userInfo.banner : [1];
                        }
                    } catch (e) {
                        console.log('Could not get banner from userInfo, using default');
                    }

                    return {
                        heroes: heroes,
                        pet: pet,
                        favor: arenaFavor,
                        banners: banners
                    };
                }
            }

            this.getFallbackTeamConfiguration = function() {
                if (this.arenaType === 'grand') {
                    return {
                        heroes: [
                            [58, 1, 64, 13, 55],
                            [42, 56, 9, 62, 43],
                            [16, 31, 57, 40, 48]
                        ],
                        pets: [6006, 6005, 6004],
                        favor: {},
                        banners: [1, 2, 3]
                    };
                } else {
                    return {
                        heroes: [57, 31, 55, 40, 16],
                        pet: 6008,
                        favor: {},
                        banners: [1]
                    };
                }
            }

            this.startArenaBattle = async function(rivalId, team) {
                const apiName = this.arenaType === 'grand' ? 'grandAttack' : 'arenaAttack';

                let args;
                if (this.arenaType === 'grand') {
                    args = {
                        userId: rivalId,
                        heroes: team.heroes,
                        pets: team.pets,
                        favor: team.favor,
                        banners: team.banners
                    };
                } else {
                    args = {
                        userId: rivalId,
                        heroes: team.heroes,
                        pet: team.pet,
                        favor: team.favor,
                        banners: team.banners
                    };
                }

                const calls = [{
                    name: apiName,
                    args: args,
                    context: {
                        actionTs: Date.now()
                    },
                    ident: "body"
                }];

                const response = await Send(JSON.stringify({calls}));
                console.log('Battle API response:', response);

                if (response.error) {
                    const errorName = response.error.name || 'Unknown';
                    const errorDesc = response.error.description || '';

                    let errorMessage = `API error: ${errorName}`;
                    if (errorDesc) {
                        errorMessage += ` - ${errorDesc}`;
                    }

                    if (errorName === 'NotAvailable') {
                        errorMessage = 'Arena not available - may be in peace time, no attempts left, or arena locked';
                    } else if (errorName === 'InvalidRequest') {
                        errorMessage = 'Invalid request - check opponent IDs and team configuration';
                    } else if (errorName === 'ArgumentError') {
                        errorMessage = 'Missing required arguments - check team data';
                    }

                    throw new Error(errorMessage);
                }

                if (this.arenaType === 'grand') {
                    if (response.results && response.results[0] && response.results[0].result) {
                        const result = response.results[0].result.response;
                        if (result.battles && result.battles.length > 0) {
                            const battleData = result.battles[0];
                            return new Promise((resolve) => {
                                BattleCalc(battleData, getBattleType(this.arenaType), (calcResult) => {
                                    if (!calcResult || !calcResult.result) {
                                        console.error('BattleCalc returned invalid result:', calcResult);
                                        resolve({
                                            win: false,
                                            progress: [],
                                            result: { win: false }
                                        });
                                        return;
                                    }
                                    resolve({
                                        win: calcResult.result.win,
                                        progress: calcResult.progress,
                                        result: calcResult.result
                                    });
                                });
                            });
                        }
                    }
                } else {
                    let battleData = null;
                    if (response.results && response.results[0]) {
                        const result = response.results[0].result || response.results[0];
                        if (result.response && result.response.battle) {
                            battleData = result.response.battle;
                        } else if (result.battle) {
                            battleData = result.battle;
                        } else if (result.response) {
                            battleData = result.response;
                        }
                    }

                    if (battleData) {
                        return new Promise((resolve) => {
                            BattleCalc(battleData, getBattleType(this.arenaType), (result) => {
                                if (!result || !result.result) {
                                    console.error('BattleCalc returned invalid result:', result);
                                    resolve({
                                        win: false,
                                        progress: [],
                                        result: { win: false }
                                    });
                                    return;
                                }
                                resolve({
                                    win: result.result.win,
                                    progress: result.progress,
                                    result: result.result
                                });
                            });
                        });
                    }
                }

                console.log('No battle data found, assuming success');
                return {
                    win: true,
                    progress: [],
                    result: { win: true }
                };
            }

            this.endArenaBattle = async function(battleResult) {
                const calls = [{
                    name: "stashClient",
                    args: {
                        data: [{
                            type: ".client.window.close",
                            params: {
                                actionTs: Date.now(),
                                windowName: "game.view.popup.battle.BattlePausePopup",
                                timestamp: Math.floor(Date.now() / 1000),
                                sessionNumber: 83,
                                windowCounter: 21,
                                assetsReloadNum: 0,
                                assetsType: "web",
                                assetsLoadingPercent: 0,
                                assetsLoadingTime: 0
                            }
                        }]
                    },
                    context: { actionTs: Date.now() },
                    ident: "group_1_body"
                }];

                try {
                    const response = await Send(JSON.stringify({calls}));
                    console.log('End battle API response:', response);
                } catch (error) {
                    console.error('Error ending battle:', error);
                }
            }

            this.end = function(message) {
                console.log('Arena execution ended:', message);
                setProgress(`${I18N('ARENA')}: ${message}`, true);
                this.resolve();
            }
        }

        // ========== EXECUTE GUILD WAR CLASS ==========
        function executeGuildWar(resolve, reject) {
            this.resolve = resolve;
            this.reject = reject;
            this.attemptsRemaining = 0;
            this.victories = 0;
            this.guildWarInfo = null;
            this.teamInfo = null;
            this.slots = [];
            this.currentSlot = 1;
            this.myTries = null;

            this.start = async function() {
                setProgress(`${I18N('GUILD_WAR')}: ${I18N('INITIALIZING')}...`);

                try {
                    await this.getGuildWarInfo();
                    await this.getTeamData();
                    await this.attackDirectSlots();
                } catch (error) {
                    console.error('Guild War error:', error);
                    this.end(`Error: ${error.message}`);
                }
            }

            this.getGuildWarInfo = async function() {
                console.log('Getting Guild War info...');
                
                const calls = [{
                    name: "clanWarGetInfo",
                    args: {},
                    context: { actionTs: Date.now() },
                    ident: "clanWarGetInfo"
                }];

                const response = await Send(JSON.stringify({calls}));
                
                if (response.error) {
                    throw new Error(`Guild War info API error: ${response.error.name} - ${response.error.description}`);
                }
                
                if (!response.results || !response.results[0] || !response.results[0].result || !response.results[0].result.response) {
                    throw new Error('Invalid clanWarGetInfo response');
                }

                this.guildWarInfo = response.results[0].result.response;
                
                // Check if myTries exists (only exists when war is active)
                if ('myTries' in this.guildWarInfo) {
                    this.myTries = this.guildWarInfo.myTries;
                    console.log(`Guild War attempts remaining: ${this.myTries}`);
                    
                    if (this.myTries <= 0) {
                        throw new Error('No Guild War attempts remaining');
                    }
                } else {
                    throw new Error('Guild War is not currently active - myTries field not available');
                }

                console.log('Guild War info loaded');
            }

            this.getTeamData = async function() {
                console.log('Getting team data...');
                
                const calls = [
                    {
                        name: "teamGetAll",
                        args: {},
                        context: { actionTs: Date.now() },
                        ident: "teamGetAll"
                    },
                    {
                        name: "teamGetFavor",
                        args: {},
                        context: { actionTs: Date.now() },
                        ident: "teamGetFavor"
                    },
                    {
                        name: "heroGetAll",
                        args: {},
                        context: { actionTs: Date.now() },
                        ident: "heroGetAll"
                    }
                ];

                const response = await Send(JSON.stringify({calls}));
                
                if (response.error) {
                    throw new Error(`Team data API error: ${response.error.name} - ${response.error.description}`);
                }
                
                if (!response.results[0] || !response.results[0].result || !response.results[0].result.response) {
                    throw new Error('Invalid teamGetAll response - team data not available');
                }
                if (!response.results[1] || !response.results[1].result || !response.results[1].result.response) {
                    throw new Error('Invalid teamGetFavor response - favor data not available');
                }
                if (!response.results[2] || !response.results[2].result || !response.results[2].result.response) {
                    throw new Error('Invalid heroGetAll response - hero data not available');
                }

                this.teamInfo = {
                    teams: response.results[0].result.response,
                    favor: response.results[1].result.response,
                    heroes: Object.values(response.results[2].result.response)
                };

                console.log('Team data loaded');
            }

            this.attackDirectSlots = async function() {
                console.log('Starting direct Guild War attacks on slots 8, 9, 1, and 2...');
                
                // Attack slot 8 (Titan battle)
                try {
                    console.log('Attacking slot 8...');
                    setProgress(`${I18N('GUILD_WAR')}: Attacking slot 8 (Titans)`);
                    await this.attackSlot(8);
                    this.victories++;
                    console.log('Slot 8 attack completed successfully');
                } catch (error) {
                    console.error('Error attacking slot 8:', error);
                    this.end(`Slot 8 attack failed: ${error.message}`);
                    return;
                }

                await new Promise(resolve => setTimeout(resolve, 1000));

                // Attack slot 9 (Titan battle)
                try {
                    console.log('Attacking slot 9...');
                    setProgress(`${I18N('GUILD_WAR')}: Attacking slot 9 (Titans)`);
                    await this.attackSlot(9);
                    this.victories++;
                    console.log('Slot 9 attack completed successfully');
                } catch (error) {
                    console.error('Error attacking slot 9:', error);
                    this.end(`Slot 9 attack failed: ${error.message}`);
                    return;
                }

                await new Promise(resolve => setTimeout(resolve, 1000));

                // Attack slot 1 (Hero battle)
                try {
                    console.log('Attacking slot 1...');
                    setProgress(`${I18N('GUILD_WAR')}: Attacking slot 1`);
                    await this.attackSlot(1);
                    this.victories++;
                    console.log('Slot 1 attack completed successfully');
                } catch (error) {
                    console.error('Error attacking slot 1:', error);
                    this.end(`Slot 1 attack failed: ${error.message}`);
                    return;
                }

                await new Promise(resolve => setTimeout(resolve, 1000));

                // Attack slot 2 (Hero battle)
                try {
                    console.log('Attacking slot 2...');
                    setProgress(`${I18N('GUILD_WAR')}: Attacking slot 2`);
                    await this.attackSlot(2);
                    this.victories++;
                    console.log('Slot 2 attack completed successfully');
                } catch (error) {
                    console.error('Error attacking slot 2:', error);
                    this.end(`Slot 2 attack failed: ${error.message}`);
                    return;
                }

                this.end(`Completed ${this.victories} Guild War attacks`);
            }

            this.attackSlot = async function(slotId) {
                console.log(`Attacking slot ${slotId}...`);
                
                // Check if myTries exists and is greater than 0 before attacking
                if (this.myTries === null || this.myTries === undefined) {
                    throw new Error('Guild War attempts not available - war may not be active');
                }
                
                if (this.myTries <= 0) {
                    throw new Error(`No Guild War attempts remaining (myTries: ${this.myTries})`);
                }
                
                const isTitanBattle = (slotId === 8 || slotId === 9);
                
                let teamConfig;
                if (isTitanBattle) {
                    teamConfig = this.getTitanTeamConfiguration();
                    
                    if (!teamConfig.titans || teamConfig.titans.length < 5) {
                        throw new Error('Titan team not properly configured - need at least 5 titans');
                    }
                } else {
                    teamConfig = this.getArenaTeamConfiguration();
                    
                    if (!teamConfig.heroes || teamConfig.heroes.length < 5) {
                        throw new Error('Arena team not properly configured - need at least 5 heroes');
                    }
                }

                let attackArgs = {
                    slotId: slotId,
                    heroes: isTitanBattle ? teamConfig.titans.slice(0, 5) : teamConfig.heroes.slice(0, 5)
                };

                if (isTitanBattle) {
                    attackArgs.favor = {};
                } else {
                    attackArgs.pet = teamConfig.pet;
                    attackArgs.favor = teamConfig.favor;
                    attackArgs.banner = teamConfig.banners && teamConfig.banners.length > 0 ? teamConfig.banners[0] : 1;
                }

                const calls = [
                    {
                        name: "clanWarAttack",
                        args: attackArgs,
                        context: {
                            actionTs: Date.now()
                        },
                        ident: "body"
                    }
                ];

                const response = await Send(JSON.stringify({calls}));
                
                if (response.error) {
                    if (response.error.name === 'NotAvailable') {
                        throw new Error('Guild War is not currently available');
                    } else if (response.error.name === 'InvalidRequest') {
                        throw new Error('Invalid attack request - check team configuration');
                    } else if (response.error.name === 'ArgumentError') {
                        throw new Error('Missing required attack arguments');
                    } else if (response.error.name === 'NotFound') {
                        throw new Error(`Target slot ${slotId} not found`);
                    } else {
                        throw new Error(`Attack failed: ${response.error.name} - ${response.error.description}`);
                    }
                }

                if (!response.results || !response.results[0]) {
                    throw new Error('Invalid attack response - no results received');
                }

                const result = response.results[0].result;
                if (!result) {
                    throw new Error('Invalid attack response - no result data');
                }

                console.log(`Slot ${slotId} attack completed successfully`);
                
                // Decrement myTries after successful attack
                if (this.myTries !== null && this.myTries !== undefined) {
                    this.myTries--;
                    console.log(`Guild War attempts remaining: ${this.myTries}`);
                }
                
                return result;
            }

            this.getArenaTeamConfiguration = function() {
                if (!this.teamInfo || !this.teamInfo.teams) {
                    console.error('Team info not available, using fallback configuration');
                    return this.getFallbackTeamConfiguration();
                }

                const teamData = this.teamInfo.teams;
                const favorData = this.teamInfo.favor;

                const arenaTeam = teamData.arena || [];
                const arenaFavor = favorData.arena || {};

                console.log('Arena team from system:', arenaTeam);
                console.log('Arena favor from system:', arenaFavor);

                let heroes = [];
                let pet = null;

                if (arenaTeam && arenaTeam.length >= 6) {
                    heroes = arenaTeam.slice(0, 5);
                    pet = arenaTeam[5];
                }

                let banners = [1];
                try {
                    const userInfo = getUserInfo();
                    if (userInfo && userInfo.banner) {
                        banners = typeof userInfo.banner === 'number' ? [userInfo.banner] : 
                                 Array.isArray(userInfo.banner) ? userInfo.banner : [1];
                    }
                } catch (e) {
                    console.log('Could not get banner from userInfo, using default');
                }

                return {
                    heroes: heroes,
                    pet: pet,
                    favor: arenaFavor,
                    banners: banners
                };
            }

            this.getTitanTeamConfiguration = function() {
                if (!this.teamInfo || !this.teamInfo.teams) {
                    console.error('Team info not available, using fallback titan configuration');
                    return this.getFallbackTitanTeamConfiguration();
                }

                const teamData = this.teamInfo.teams;

                const titanTeam = teamData.clan_pvp_titan || teamData.titan_arena || [];

                console.log('Titan team from system:', titanTeam);

                if (!titanTeam || titanTeam.length < 5) {
                    console.warn('Titan team not properly configured, using fallback');
                    return this.getFallbackTitanTeamConfiguration();
                }

                return {
                    titans: titanTeam.slice(0, 5)
                };
            }

            this.getFallbackTeamConfiguration = function() {
                console.log('Using fallback team configuration');
                return {
                    heroes: [46, 57, 40, 16, 65],
                    pet: 6004,
                    favor: {},
                    banners: [1]
                };
            }

            this.getFallbackTitanTeamConfiguration = function() {
                console.log('Using fallback titan team configuration');
                return {
                    titans: [4033, 4003, 4001, 4032, 4000]
                };
            }

            this.end = function(reason) {
                setProgress(`${I18N('GUILD_WAR')}: ${reason}`, true);
                console.log('Guild War completed:', reason);
                this.resolve();
            }
        }

        // ========== EXECUTE RAID NODES CLASS ==========
        function executeRaidNodes(resolve, reject) {
            let raidData = {
                teams: [],
                favor: {},
                nodes: [],
                attempts: 0,
                countExecuteBattles: 0,
                cancelBattle: 0,
            }

            const callsExecuteRaidNodes = {
                calls: [{
                    name: "clanRaid_getInfo",
                    args: {},
                    ident: "clanRaid_getInfo"
                }, {
                    name: "teamGetAll",
                    args: {},
                    ident: "teamGetAll"
                }, {
                    name: "teamGetFavor",
                    args: {},
                    ident: "teamGetFavor"
                }]
            }

            this.start = function () {
                SendRequest(JSON.stringify(callsExecuteRaidNodes), startRaidNodes);
            }

            async function startRaidNodes(data) {
                const res = data.results;
                const clanRaidInfo = res[0].result.response;
                const teamGetAll = res[1].result.response;
                const teamGetFavor = res[2].result.response;

                // Check attempts from clanRaid_getInfo - if 0, skip minion attack
                const attempts = clanRaidInfo.attempts || 0;
                if (attempts === 0) {
                    console.log('AutoBattle: Minion attempts is 0, skipping minion attack');
                    setProgress(`${I18N('MINION_RAID')}: No attempts remaining (attempts: 0)`, true);
                    endRaidNodes('NoAttempts');
                    return;
                }

                let index = 0;
                let isNotFullPack = false;
                for (let team of teamGetAll.clanRaid_nodes) {
                    if (team.length < 6) {
                        isNotFullPack = true;
                    }
                    raidData.teams.push({
                        data: {},
                        heroes: team.filter(id => id < 6000),
                        pet: team.filter(id => id >= 6000).pop(),
                        battleIndex: index++
                    });
                }
                raidData.favor = teamGetFavor.clanRaid_nodes;

                if (isNotFullPack) {
                    // Skip the popup confirmation for auto-execution
                    // Just continue with the raid
                }

                raidData.nodes = clanRaidInfo.nodes;
                raidData.attempts = attempts;
                setIsCancalBattle(false);

                checkNodes();
            }

            function getAttackNode() {
                for (let nodeId in raidData.nodes) {
                    let node = raidData.nodes[nodeId];
                    let points = 0
                    for (let team of node.teams) {
                        points += team.points;
                    }
                    let now = Date.now() / 1000;
                    if (!points && now > node.timestamps.start && now < node.timestamps.end) {
                        let countTeam = node.teams.length;
                        delete raidData.nodes[nodeId];
                        return {
                            nodeId,
                            countTeam
                        };
                    }
                }
                return null;
            }

            function checkNodes() {
                setProgress(`${I18N('REMAINING_ATTEMPTS')}: ${raidData.attempts}`);
                let nodeInfo = getAttackNode();
                if (nodeInfo && raidData.attempts) {
                    startNodeBattles(nodeInfo);
                    return;
                }

                endRaidNodes('EndRaidNodes');
            }

            function startNodeBattles(nodeInfo) {
                let {nodeId, countTeam} = nodeInfo;
                let teams = raidData.teams.slice(0, countTeam);
                let heroes = raidData.teams.map(e => e.heroes).flat();
                let favor = {...raidData.favor};
                for (let heroId in favor) {
                    if (!heroes.includes(+heroId)) {
                        delete favor[heroId];
                    }
                }

                let calls = [{
                    name: "clanRaid_startNodeBattles",
                    args: {
                        nodeId,
                        teams,
                        favor
                    },
                    ident: "body"
                }];

                SendRequest(JSON.stringify({calls}), resultNodeBattles);
            }

            function resultNodeBattles(e) {
                if (e['error']) {
                    endRaidNodes('nodeBattlesError', e['error']);
                    return;
                }

                console.log(e);
                let battles = e.results[0].result.response.battles;
                let promises = [];
                let battleIndex = 0;
                for (let battle of battles) {
                    battle.battleIndex = battleIndex++;
                    promises.push(calcBattleResult(battle));
                }

                Promise.all(promises)
                    .then(results => {
                        const endResults = {};
                        let isAllWin = true;
                        for (let r of results) {
                            isAllWin &&= r.result.win;
                        }
                        if (!isAllWin) {
                            cancelEndNodeBattle(results[0]);
                            return;
                        }
                        raidData.countExecuteBattles = results.length;
                        let timeout = 500;
                        for (let r of results) {
                            setTimeout(endNodeBattle, timeout, r);
                            timeout += 500;
                        }
                    });
            }

            function calcBattleResult(battleData) {
                return new Promise(function (resolve, reject) {
                    BattleCalc(battleData, "get_clanPvp", resolve);
                });
            }

            function cancelEndNodeBattle(r) {
                const fixBattle = function (heroes) {
                    for (const ids in heroes) {
                        let hero = heroes[ids];
                        hero.energy = random(1, 999);
                        if (hero.hp > 0) {
                            hero.hp = random(1, hero.hp);
                        }
                    }
                }
                fixBattle(r.progress[0].attackers.heroes);
                fixBattle(r.progress[0].defenders.heroes);
                endNodeBattle(r);
            }

            function endNodeBattle(r) {
                let nodeId = r.battleData.result.nodeId;
                let battleIndex = r.battleData.battleIndex;
                let calls = [{
                    name: "clanRaid_endNodeBattle",
                    args: {
                        nodeId,
                        battleIndex,
                        result: r.result,
                        progress: r.progress
                    },
                    ident: "body"
                }]

                SendRequest(JSON.stringify({calls}), battleResult);
            }

            function battleResult(e) {
                if (e['error']) {
                    endRaidNodes('missionEndError', e['error']);
                    return;
                }
                let r = e.results[0].result.response;
                if (r['error']) {
                    if (r.reason == "invalidBattle") {
                        raidData.cancelBattle++;
                        checkNodes();
                    } else {
                        endRaidNodes('missionEndError', e['error']);
                    }
                    return;
                }

                if (!(--raidData.countExecuteBattles)) {
                    raidData.attempts--;
                    checkNodes();
                }
            }

            function endRaidNodes(reason, info) {
                setIsCancalBattle(true);
                let textCancel = raidData.cancelBattle ? ` ${I18N('BATTLES_CANCELED')}: ${raidData.cancelBattle}` : '';
                setProgress(`${I18N('MINION_RAID')} ${I18N('COMPLETED')}! ${textCancel}`, true);
                console.log(reason, info);
                resolve();
            }
        }

        // ========== EXECUTE RAID BOSS CLASS ==========
        function executeRaidBoss(resolve, reject) {
            this.resolve = resolve;
            this.reject = reject;
            this.bossAttempts = 0;
            this.attacksCompleted = 0;
            this.heroTeams = [
                [46, 52, 48, 40, 37],
                [58, 50, 42, 9, 51],
                [64, 13, 29, 1, 43],
                [16, 65, 57, 31, 61],
                [56, 62, 55, 63, 28]
            ];
            this.pets = [6005, 6005, 6005, 6005, 6006];
            this.favorTeams = [
                { "37": 6000, "40": 6004, "46": 6001, "48": 6005, "52": 6006 },
                { "9": 6004, "42": 6006, "50": 6001, "58": 6005 },
                { "1": 6004, "13": 6008, "29": 6006, "43": 6002, "64": 6005 },
                { "16": 6004, "31": 6006, "57": 6003, "61": 6001, "65": 6000 },
                { "28": 6004, "55": 6005, "56": 6006, "62": 6008, "63": 6003 }
            ];

            this.start = async function() {
                setProgress('Raid Boss: Initializing...');
                try {
                    await this.getRaidInfo();
                    
                    if (this.bossAttempts <= 0) {
                        this.end('No boss attempts remaining');
                        return;
                    }

                    await this.attackBoss();
                } catch (error) {
                    console.error('Raid Boss error:', error);
                    this.end(`Error: ${error.message}`);
                }
            }

            this.getRaidInfo = async function() {
                const calls = [{
                    name: "clanRaid_getInfo",
                    args: {},
                    context: { actionTs: Date.now() },
                    ident: "clanRaid_getInfo"
                }];

                const response = await Send(JSON.stringify({calls}));
                
                if (response.error) {
                    throw new Error(`Raid info API error: ${response.error.name} - ${response.error.description}`);
                }
                
                if (!response.results || !response.results[0] || !response.results[0].result || !response.results[0].result.response) {
                    throw new Error('Invalid clanRaid_getInfo response');
                }

                this.raidInfo = response.results[0].result.response;
                this.bossAttempts = this.raidInfo.bossAttempts || 0;
                
                const currentBoss = this.raidInfo.stats?.currentBoss || "1";
                const bossName = currentBoss === "1" ? "OSH" : "Mastro";
                
                console.log(`Raid Boss: ${bossName}, Attempts: ${this.bossAttempts}`);
                setProgress(`Raid Boss: ${bossName} - ${this.bossAttempts} attempts available`);
            }


            this.attackBoss = async function() {
                const maxAttacks = Math.min(5, this.bossAttempts);
                
                for (let i = 0; i < maxAttacks; i++) {
                    if (this.bossAttempts <= 0) {
                        break;
                    }

                    setProgress(`Raid Boss: Attack ${i + 1}/${maxAttacks}`);
                    
                    try {
                        const teamIndex = i % this.heroTeams.length;
                        const heroes = this.heroTeams[teamIndex];
                        const pet = this.pets[teamIndex];
                        const favor = this.favorTeams[teamIndex];
                        
                        const battleData = await this.startBossBattle(heroes, pet, favor);
                        const battleResult = await this.calculateBattleResult(battleData);
                        await this.endBossBattle(battleResult);
                        
                        this.attacksCompleted++;
                        this.bossAttempts--;
                        
                        if (i < maxAttacks - 1) {
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        }
                    } catch (error) {
                        console.error(`Error in attack ${i + 1}:`, error);
                        break; // Stop on error to avoid wasting attempts
                    }
                }
                
                this.end(`Completed ${this.attacksCompleted} boss attacks`);
            }


            this.startBossBattle = async function(heroes, pet, favor) {
                const calls = [{
                    name: "clanRaid_startBossBattle",
                    args: {
                        heroes: heroes,
                        pet: pet,
                        favor: favor
                    },
                    context: { actionTs: Date.now() },
                    ident: "body"
                }];

                const response = await Send(JSON.stringify({calls}));
                
                if (response.error) {
                    throw new Error(`Start boss battle failed: ${response.error.name} - ${response.error.description}`);
                }
                
                if (!response.results || !response.results[0] || !response.results[0].result) {
                    throw new Error('Invalid start boss battle response');
                }

                const battleData = response.results[0].result.response;
                if (!battleData || !battleData.battle) {
                    throw new Error('No battle data in response');
                }

                return battleData.battle;
            }

            this.calculateBattleResult = async function(battleData) {
                return new Promise((resolve, reject) => {
                    BattleCalc(battleData, getBattleType('clan_raid'), (result) => {
                        if (!result || !result.result) {
                            console.error('BattleCalc returned invalid result:', result);
                            reject(new Error('Invalid battle calculation result'));
                            return;
                        }
                        resolve({
                            win: result.result.win,
                            progress: result.progress,
                            result: result.result,
                            battleData: battleData
                        });
                    });
                });
            }

            this.endBossBattle = async function(battleResult) {
                const calls = [{
                    name: "clanRaid_endBossBattle",
                    args: {
                        result: {
                            win: battleResult.win,
                            stars: battleResult.result.stars || 0
                        },
                        progress: battleResult.progress
                    },
                    context: { actionTs: Date.now() },
                    ident: "group_1_body"
                }];

                const response = await Send(JSON.stringify({calls}));
                
                if (response.error) {
                    throw new Error(`End boss battle failed: ${response.error.name} - ${response.error.description}`);
                }
            }

            this.end = function(reason) {
                setProgress(`Raid Boss: ${reason}`, true);
                console.log('Raid Boss completed:', reason);
                this.resolve();
            }
        }

        // Store classes in HWHClasses for consistency
        HWHClasses.executeArena = executeArena;
        HWHClasses.executeGuildWar = executeGuildWar;
        HWHClasses.executeRaidNodes = executeRaidNodes;
        HWHClasses.executeRaidBoss = executeRaidBoss;

        // Auto-execute all battles on script load
        async function autoBattle() {
            try {
                console.log('AutoBattle: Starting auto-battle sequence...');
                HWHFuncs.setProgress('AutoBattle: Starting auto-battles...');

                const results = {
                    arena: false,
                    grandArena: false,
                    guildWar: false,
                    raidNodes: false,
                    raidBoss: false,
                    titanArena: false
                };

                // 1. Auto Arena
                try {
                    console.log('AutoBattle: Starting Arena...');
                    HWHFuncs.setProgress('AutoBattle: Arena battles...');
                    await new Promise((resolve, reject) => {
                        const arena = new executeArena(resolve, reject);
                        arena.start('arena');
                    });
                    results.arena = true;
                    console.log('%cAutoBattle: Arena completed', 'color: lightgreen; font-weight: bold;');
                } catch (error) {
                    console.error('AutoBattle: Arena error:', error);
                }

                // 2. Auto Grand Arena
                try {
                    console.log('AutoBattle: Starting Grand Arena...');
                    HWHFuncs.setProgress('AutoBattle: Grand Arena battles...');
                    await new Promise((resolve, reject) => {
                        const grandArena = new executeArena(resolve, reject);
                        grandArena.start('grand');
                    });
                    results.grandArena = true;
                    console.log('%cAutoBattle: Grand Arena completed', 'color: lightgreen; font-weight: bold;');
                } catch (error) {
                    console.error('AutoBattle: Grand Arena error:', error);
                }

                // 3. Auto Guild War
                try {
                    console.log('AutoBattle: Starting Guild War...');
                    HWHFuncs.setProgress('AutoBattle: Guild War attacks...');
                    await new Promise((resolve, reject) => {
                        const guildWar = new executeGuildWar(resolve, reject);
                        guildWar.start();
                    });
                    results.guildWar = true;
                    console.log('%cAutoBattle: Guild War completed', 'color: lightgreen; font-weight: bold;');
                } catch (error) {
                    console.error('AutoBattle: Guild War error:', error);
                }

                // 4. Auto Raid Nodes
                try {
                    console.log('AutoBattle: Starting Raid Nodes...');
                    HWHFuncs.setProgress('AutoBattle: Raid Nodes...');
                    await new Promise((resolve, reject) => {
                        const raidNodes = new executeRaidNodes(resolve, reject);
                        raidNodes.start();
                    });
                    results.raidNodes = true;
                    console.log('%cAutoBattle: Raid Nodes completed', 'color: lightgreen; font-weight: bold;');
                } catch (error) {
                    console.error('AutoBattle: Raid Nodes error:', error);
                }

                // 5. Auto Titan Arena (Monday - Saturday only, not Sunday)
                try {
                    const today = new Date();
                    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
                    
                    if (dayOfWeek >= 1 && dayOfWeek <= 6) {
                        console.log('AutoBattle: Starting Titan Arena (ToE)...');
                        HWHFuncs.setProgress('AutoBattle: Titan Arena (ToE)...');
                        
                        // Use HWHClasses.executeTitanArena if available, otherwise use local implementation
                        if (window.HWHClasses && window.HWHClasses.executeTitanArena) {
                            await new Promise((resolve, reject) => {
                                const titanArena = new window.HWHClasses.executeTitanArena(resolve, reject);
                                titanArena.start();
                            });
                        } else {
                            // Fallback: use testTitanArena function if available
                            if (window.testTitanArena && typeof window.testTitanArena === 'function') {
                                await window.testTitanArena();
                            } else {
                                throw new Error('Titan Arena execution class not available');
                            }
                        }
                        results.titanArena = true;
                        console.log('%cAutoBattle: Titan Arena (ToE) completed', 'color: lightgreen; font-weight: bold;');
                    } else {
                        console.log(`AutoBattle: Skipping Titan Arena (not Monday-Saturday, current day: ${dayOfWeek})`);
                        results.titanArena = false;
                    }
                } catch (error) {
                    console.error('AutoBattle: Titan Arena error:', error);
                }

                // 6. Auto Raid Boss (Saturday or Sunday only)
                try {
                    const today = new Date();
                    const dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday
                    
                    if (dayOfWeek === 0 || dayOfWeek === 6) {
                        console.log('AutoBattle: Starting Raid Boss...');
                        HWHFuncs.setProgress('AutoBattle: Raid Boss attacks...');
                        await new Promise((resolve, reject) => {
                            const raidBoss = new executeRaidBoss(resolve, reject);
                            raidBoss.start();
                        });
                        results.raidBoss = true;
                        console.log('%cAutoBattle: Raid Boss completed', 'color: lightgreen; font-weight: bold;');
                    } else {
                        console.log(`AutoBattle: Skipping Raid Boss (not Saturday/Sunday, current day: ${dayOfWeek})`);
                        results.raidBoss = false;
                    }
                } catch (error) {
                    console.error('AutoBattle: Raid Boss error:', error);
                }

                // Summary
                const completed = Object.values(results).filter(v => v === true).length;
                const total = Object.keys(results).length;
                const summary = [
                    `Arena: ${results.arena ? '✓' : '✗'}`,
                    `Grand Arena: ${results.grandArena ? '✓' : '✗'}`,
                    `Guild War: ${results.guildWar ? '✓' : '✗'}`,
                    `Raid Nodes: ${results.raidNodes ? '✓' : '✗'}`,
                    `Titan Arena: ${results.titanArena ? '✓' : '✗'}`,
                    `Raid Boss: ${results.raidBoss ? '✓' : '✗'}`
                ].join(' | ');

                console.log(`%cAutoBattle: Completed ${completed}/${total} battle types`, 'color: cyan; font-weight: bold;');
                console.log(summary);
                HWHFuncs.setProgress(`AutoBattle: Complete! ${completed}/${total} battle types executed.`, true);

            } catch (error) {
                console.error('AutoBattle: Fatal error:', error);
                HWHFuncs.setProgress(`AutoBattle: Error - ${error.message}`, true);
            }
        }

        // Individual battle functions for manual triggers
        async function runArena() {
            try {
                HWHFuncs.setProgress('AutoBattle: Running Arena...');
                await new Promise((resolve, reject) => {
                    const arena = new executeArena(resolve, reject);
                    arena.start('arena');
                });
                HWHFuncs.setProgress('AutoBattle: Arena complete!', true);
            } catch (error) {
                console.error('Arena error:', error);
                HWHFuncs.setProgress(`Arena error: ${error.message}`, true);
            }
        }

        async function runGrandArena() {
            try {
                HWHFuncs.setProgress('AutoBattle: Running Grand Arena...');
                await new Promise((resolve, reject) => {
                    const grandArena = new executeArena(resolve, reject);
                    grandArena.start('grand');
                });
                HWHFuncs.setProgress('AutoBattle: Grand Arena complete!', true);
            } catch (error) {
                console.error('Grand Arena error:', error);
                HWHFuncs.setProgress(`Grand Arena error: ${error.message}`, true);
            }
        }

        async function runGuildWar() {
            try {
                HWHFuncs.setProgress('AutoBattle: Running Guild War...');
                await new Promise((resolve, reject) => {
                    const guildWar = new executeGuildWar(resolve, reject);
                    guildWar.start();
                });
                HWHFuncs.setProgress('AutoBattle: Guild War complete!', true);
            } catch (error) {
                console.error('Guild War error:', error);
                HWHFuncs.setProgress(`Guild War error: ${error.message}`, true);
            }
        }

        async function runRaidNodes() {
            try {
                HWHFuncs.setProgress('AutoBattle: Running Raid Nodes...');
                await new Promise((resolve, reject) => {
                    const raidNodes = new executeRaidNodes(resolve, reject);
                    raidNodes.start();
                });
                HWHFuncs.setProgress('AutoBattle: Raid Nodes complete!', true);
            } catch (error) {
                console.error('Raid Nodes error:', error);
                HWHFuncs.setProgress(`Raid Nodes error: ${error.message}`, true);
            }
        }

        async function runTitanArena() {
            try {
                const today = new Date();
                const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
                
                if (dayOfWeek >= 1 && dayOfWeek <= 6) {
                    HWHFuncs.setProgress('AutoBattle: Running Titan Arena (ToE)...');
                    
                    // Use HWHClasses.executeTitanArena if available, otherwise use local implementation
                    if (window.HWHClasses && window.HWHClasses.executeTitanArena) {
                        await new Promise((resolve, reject) => {
                            const titanArena = new window.HWHClasses.executeTitanArena(resolve, reject);
                            titanArena.start();
                        });
                    } else {
                        // Fallback: use testTitanArena function if available
                        if (window.testTitanArena && typeof window.testTitanArena === 'function') {
                            await window.testTitanArena();
                        } else {
                            throw new Error('Titan Arena execution class not available');
                        }
                    }
                    HWHFuncs.setProgress('AutoBattle: Titan Arena (ToE) complete!', true);
                } else {
                    const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek];
                    HWHFuncs.setProgress(`Titan Arena: Only available Monday-Saturday (today is ${dayName})`, true);
                    console.log(`Titan Arena: Skipped - today is ${dayName}, only runs Monday-Saturday`);
                }
            } catch (error) {
                console.error('Titan Arena error:', error);
                HWHFuncs.setProgress(`Titan Arena error: ${error.message}`, true);
            }
        }

        async function runRaidBoss() {
            try {
                const today = new Date();
                const dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday
                
                if (dayOfWeek === 0 || dayOfWeek === 6) {
                    HWHFuncs.setProgress('AutoBattle: Running Raid Boss...');
                    await new Promise((resolve, reject) => {
                        const raidBoss = new executeRaidBoss(resolve, reject);
                        raidBoss.start();
                    });
                    HWHFuncs.setProgress('AutoBattle: Raid Boss complete!', true);
                } else {
                    const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek];
                    HWHFuncs.setProgress(`Raid Boss: Only available on Saturday or Sunday (today is ${dayName})`, true);
                    console.log(`Raid Boss: Skipped - today is ${dayName}, only runs on Saturday/Sunday`);
                }
            } catch (error) {
                console.error('Raid Boss error:', error);
                HWHFuncs.setProgress(`Raid Boss error: ${error.message}`, true);
            }
        }

        // Auto-execute on script load
        autoBattle().catch(error => {
            console.error('AutoBattle: Failed to auto-execute:', error);
        });

        // Menu integration
        const { ScriptMenu } = HWHClasses;
        const scriptMenu = ScriptMenu.getInst();
        
        // Helper function to get I18N translation
        function getI18N(key) {
            if (window.I18N && typeof window.I18N === 'function') {
                return window.I18N(key);
            }
            // Fallback translations
            const fallbacks = {
                'TITAN_ARENA': 'ToE',
                'TITAN_ARENA_TITLE': 'Tournament of Elements'
            };
            return fallbacks[key] || key;
        }
        
        scriptMenu.addCombinedButton([
            { name: '⚔️ Auto Battle', title: 'Run all auto-battles (Arena, Grand Arena, Guild War, Raids, ToE, Boss)', onClick: autoBattle, color: 'green' },
            { name: 'Arena', title: 'Run Arena battles only', onClick: runArena, color: 'blue' },
            { name: 'Grand Arena', title: 'Run Grand Arena battles only', onClick: runGrandArena, color: 'blue' },
            { name: 'Guild War', title: 'Run Guild War attacks only', onClick: runGuildWar, color: 'purple' },
            { name: 'Raid Nodes', title: 'Run Raid Nodes only', onClick: runRaidNodes, color: 'orange' },
            { name: getI18N('TITAN_ARENA'), title: `Run ${getI18N('TITAN_ARENA')} only (Monday-Saturday)`, onClick: runTitanArena, color: 'cyan' },
            { name: 'Raid Boss', title: 'Run Raid Boss attacks only (5 attacks)', onClick: runRaidBoss, color: 'red' }
        ]);

        console.log('AutoBattle: UI initialized and attached to HWH menu.');
    }
})();
