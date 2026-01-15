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

        const { HWHClasses, HWHFuncs, Send, cheats } = window;

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
            // Map of constants that might not exist in I18N - use fallbacks directly
            const fallbacks = {
                'ARENA': 'Arena',
                'GRAND_ARENA': 'Grand Arena',
                'GUILD_WAR': 'Guild War',
                'MINION_RAID': 'Minion Raid',
                'INITIALIZING': 'Initializing',
                'BATTLE': 'Battle',
                'COMPLETED': 'Completed',
                'BATTLES_CANCELED': 'Battles Canceled',
                'REMAINING_ATTEMPTS': 'Remaining Attempts',
                'TITAN_ARENA': 'Titan Arena'
            };
            
            // If we have a fallback for this constant, use it directly to avoid I18N warnings
            if (fallbacks.hasOwnProperty(constant)) {
                let result = fallbacks[constant];
                if (replace) {
                    for (const key in replace) {
                        result = result.replace(`{${key}}`, replace[key]);
                    }
                }
                return result;
            }
            
            // For other constants, try to use window.I18N if available
            if (window.I18N && typeof window.I18N === 'function') {
                try {
                    const result = window.I18N(constant, replace);
                    // If I18N returns the constant name unchanged (meaning it wasn't found), use fallback
                    if (result === constant && fallbacks[constant]) {
                        return fallbacks[constant];
                    }
                    return result;
                } catch (error) {
                    // If translation constant not found, fall back to constant name or English defaults
                    return fallbacks[constant] || constant;
                }
            }
            
            // Final fallback
            let result = fallbacks[constant] || constant;
            if (replace) {
                for (const key in replace) {
                    result = result.replace(`{${key}}`, replace[key]);
                }
            }
            return result;
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

        // ========== CONSTANTS ==========
        const CONSTANTS = {
            WIN_RATE_THRESHOLD: 70,
            SIMULATION_COUNT: 10,
            BATTLE_VERSION: 273,
            DELAY_BETWEEN_BATTLES: 1000,
            DELAY_BATTLE_COMPLETE: 100,
            ARENA_ATTEMPTS_REFILLABLE_ID: 6,
            GRAND_ARENA_ATTEMPTS_REFILLABLE_ID: 21,
            DEFAULT_PET_ID: 6005,
            PET_ID_RANGE_MIN: 6000,
            PET_ID_RANGE_MAX: 7000,
            DAYS: {
                SUNDAY: 0,
                MONDAY: 1,
                SATURDAY: 6
            }
        };

        // ========== UTILITY FUNCTIONS ==========
        const Utils = {
            // Cached date for day checks (updated once per execution)
            currentDate: new Date(),
            
            getDayOfWeek: function() {
                return this.currentDate.getDay();
            },
            
            isTitanArenaDay: function() {
                const day = this.getDayOfWeek();
                return day >= CONSTANTS.DAYS.MONDAY && day <= CONSTANTS.DAYS.SATURDAY;
            },
            
            isRaidBossDay: function() {
                const day = this.getDayOfWeek();
                return day === CONSTANTS.DAYS.SUNDAY || day === CONSTANTS.DAYS.SATURDAY;
            },
            
            getDayName: function(dayOfWeek) {
                return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek];
            },
            
            // Optimized logging - can be disabled in production
            log: function(level, ...args) {
                if (window.DEBUG !== false) {
                    console[level](...args);
                }
            },
            
            // Create action timestamp (called per API request for uniqueness)
            getActionTs: function() {
                return Date.now();
            },
            
            // Validate battle result
            isValidBattleResult: function(result) {
                return result && result.result && typeof result.result.win === 'boolean';
            }
        };

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
                const arenaName = this.arenaType === 'grand' ? 'Grand Arena' : 'Arena';
                setProgress(`${arenaName}: Initializing...`);

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
                    if (detailedOpponents && (detailedOpponents.array || detailedOpponents.map)) {
                        // Store both map and array to preserve API order
                        this.opponentsData = detailedOpponents;
                    } else if (detailedOpponents && typeof detailedOpponents === 'object' && Object.keys(detailedOpponents).length > 0) {
                        // Fallback: old format (just map)
                        this.opponents = detailedOpponents;
                    }

                    // Process opponents in API order (one by one, no sorting)
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
                        context: { actionTs: Utils.getActionTs() },
                        ident: "body"
                    }];

                    const response = await Send(JSON.stringify({calls}));
                    console.log('User info response:', response);

                    if (response && response.results && response.results[0] && response.results[0].result) {
                        const userInfo = response.results[0].result.response;
                        console.log('User info:', userInfo);

                        if (this.arenaType === 'grand') {
                            // Grand Arena attempts are stored in refillable array with id: 21
                            const grandAttemptsItem = userInfo.refillable ? userInfo.refillable.find(r => r.id === CONSTANTS.GRAND_ARENA_ATTEMPTS_REFILLABLE_ID) : null;
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
                                setProgress(`Grand Arena: No attempts remaining (${grandAttempts})`);
                                return;
                            }

                            setProgress(`Grand Arena: ${grandAttempts} attempts available - executing single battle`);
                            return;
                        } else {
                            // Arena attempts are stored in refillable array with id: 6
                            const arenaAttemptsItem = userInfo.refillable ? userInfo.refillable.find(r => r.id === CONSTANTS.ARENA_ATTEMPTS_REFILLABLE_ID) : null;
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
                                setProgress(`Arena: No attempts remaining (${arenaAttempts})`);
                                return;
                            }

                            setProgress(`Arena: ${arenaAttempts} attempts available - executing single battle`);
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
                const arenaName = this.arenaType === 'grand' ? 'Grand Arena' : 'Arena';
                setProgress(`${arenaName}: Initializing - executing single battle...`);
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
                            actionTs: Utils.getActionTs()
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

                    // Return both map (for lookup) and array (for order preservation)
                    const opponentsMap = {};
                    const opponentsArray = [];
                    
                    if (Array.isArray(opponents)) {
                        // Preserve the order from API response
                        opponents.forEach(opponent => {
                            opponentsMap[opponent.userId] = opponent;
                            opponentsArray.push(opponent);
                        });
                    }

                    return {
                        map: opponentsMap,
                        array: opponentsArray  // Preserve API order
                    };
                } catch (error) {
                    console.error('Error getting arena opponents:', error);
                    return { map: {}, array: [] };
                }
            }

            this.findEasiestOpponents = function() {
                // Process opponents in the exact order they come from API
                // Arena will try them one by one as returned by the server (no sorting)
                if (this.opponentsData && this.opponentsData.array && Array.isArray(this.opponentsData.array)) {
                    const availableOpponents = [];

                    // Process in API order (preserve original array order)
                    this.opponentsData.array.forEach(opponentData => {
                        availableOpponents.push({
                            opponent: {
                                id: opponentData.userId,
                                power: parseInt(opponentData.power) || 0,
                                place: parseInt(opponentData.place) || 1000,
                                heroes: opponentData.heroes || [],
                                banners: opponentData.banners || [],
                                user: opponentData.user || {}
                            },
                            rank: parseInt(opponentData.place) || 1000,
                            difficulty: parseInt(opponentData.power) || 0
                        });
                    });

                    // Keep original order from API - try opponents one by one as returned
                    // No sorting - will attempt in the order the server provides
                    this.opponents = availableOpponents;
                    console.log(`[OPPONENTS] Processing ${this.opponents.length} opponents in API order (one by one, no sorting)`);
                    console.log('[OPPONENTS] Opponent order:', this.opponents.map(o => ({
                        id: o.opponent.id,
                        place: o.rank,
                        power: o.difficulty
                    })));
                } else if (this.opponents && typeof this.opponents === 'object') {
                    // Fallback: if we have the old format (map), convert to array
                    // Note: Object.entries() may not preserve order, but we'll try
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
                    this.opponents = availableOpponents;
                    console.log(`[OPPONENTS] Processing ${this.opponents.length} opponents (fallback mode)`);
                } else {
                    console.log('[OPPONENTS] No opponents data to process');
                    this.opponents = [];
                }
            }

            this.executeBattles = async function() {
                let battlesAttempted = 0;
                let battlesSkipped = 0;
                
                // Continue trying opponents until we either win a battle, run out of attempts, or run out of opponents
                while (battlesAttempted < this.attemptsRemaining && this.opponents.length > 0) {
                    const opponent = this.opponents.shift();
                    const opponentId = opponent.opponent.id;
                    
                    console.log(`[EXECUTE] ===== Processing opponent ${opponentId} (attempt ${battlesAttempted + 1}/${this.attemptsRemaining}, ${this.opponents.length} remaining) =====`);
                    const arenaName = this.arenaType === 'grand' ? 'Grand Arena' : 'Arena';
                    setProgress(`${arenaName}: Battle ${battlesAttempted + 1}/${this.attemptsRemaining} - Opponent ${opponentId}`);

                    try {
                        if (this.arenaType === 'grand') {
                            const canAttack = await this.checkTargetRange(opponentId);
                            if (!canAttack) {
                                console.log(`[EXECUTE] Target ${opponentId} is not in range, skipping`);
                                battlesSkipped++;
                                // Put opponent back at end of queue to try later
                                this.opponents.push(opponent);
                                continue;
                            }
                        }

                        const result = await this.executeBattle(opponent);
                        
                        if (result.skipped) {
                            console.log(`[EXECUTE] Battle skipped due to low win rate (${result.winRate?.toFixed(2)}%)`);
                            battlesSkipped++;
                            // Continue to next opponent - don't consume an attempt
                            if (this.opponents.length === 0) {
                                console.log(`[EXECUTE] No more opponents available, ending execution`);
                                break;
                            }
                            continue;
                        }
                        
                        // Battle was attempted (not skipped)
                        battlesAttempted++;
                        if (result.win) {
                            this.victories++;
                            console.log(`[EXECUTE] ✓ Victory against opponent ${opponentId}`);
                            // After a victory, we can continue or stop - for now, continue to use all attempts
                        } else {
                            console.log(`[EXECUTE] ✗ Defeat against opponent ${opponentId}`);
                        }
                    } catch (error) {
                        console.error(`[EXECUTE] Battle error for opponent ${opponentId}:`, error);
                        battlesAttempted++;
                    }
                }

                const summary = `Completed ${this.victories}/${battlesAttempted} victories${battlesSkipped > 0 ? `, ${battlesSkipped} skipped` : ''}`;
                console.log(`[EXECUTE] ===== Execution Summary =====`);
                console.log(`[EXECUTE] Victories: ${this.victories}/${battlesAttempted}`);
                console.log(`[EXECUTE] Skipped: ${battlesSkipped}`);
                console.log(`[EXECUTE] =============================`);
                this.end(summary);
            }

            this.executeBattle = async function(opponent) {
                try {
                    if (!opponent || !opponent.opponent || !opponent.opponent.id) {
                        console.error('[DEMO] Invalid opponent data:', opponent);
                        return { win: false };
                    }

                    const opponentId = opponent.opponent.id;
                    console.log(`[DEMO] ===== Starting demo battle simulation for opponent ${opponentId} =====`);

                    // Step 1: Get team configurations
                    console.log('[DEMO] Step 1: Getting team configurations...');
                    const myTeamConfig = this.getTeamConfiguration();
                    const opponentTeamConfig = this.getOpponentTeamConfig(opponent);
                    
                    console.log('[DEMO] My team config:', JSON.stringify(myTeamConfig, null, 2));
                    console.log('[DEMO] Opponent team config:', JSON.stringify(opponentTeamConfig, null, 2));

                    if (!opponentTeamConfig || !opponentTeamConfig.hasValidTeam) {
                        console.warn('[DEMO] ⚠️ Cannot get opponent team data, proceeding with attack anyway');
                        const battleResult = await this.startArenaBattle(opponentId, myTeamConfig);
                        await this.endArenaBattle(battleResult);
                        return battleResult;
                    }

                    // Skip simulation for Grand Arena (demo battles only support single team, not 3-team Grand Arena)
                    if (this.arenaType === 'grand') {
                        console.log('[DEMO] Grand Arena: Skipping simulation (demo battles do not support 3-team battles), proceeding directly to attack');
                        const battleResult = await this.startArenaBattle(opponentId, myTeamConfig);
                        await this.endArenaBattle(battleResult);
                        return battleResult;
                    }

                    // Step 2: Simulate battles using demoBattles_startBattle (Regular Arena only)
                    Utils.log('log', '[DEMO] Step 2: Running demo battle simulations (no attempts consumed)...');
                    const simulationResult = await this.simulateWithDemoBattles(myTeamConfig, opponentTeamConfig, CONSTANTS.SIMULATION_COUNT);
                    
                    console.log('[DEMO] Simulation results:', {
                        totalSimulations: simulationResult.total,
                        wins: simulationResult.wins,
                        losses: simulationResult.losses,
                        winRate: simulationResult.winRate.toFixed(2) + '%',
                        averageBattleTime: simulationResult.averageBattleTime.toFixed(2) + 's'
                    });

                    // Step 3: Check win rate threshold
                    const shouldProceed = simulationResult.winRate > CONSTANTS.WIN_RATE_THRESHOLD;

                    Utils.log('log', `[DEMO] Step 3: Win rate check (threshold: ${CONSTANTS.WIN_RATE_THRESHOLD}%)`);
                    Utils.log('log', `[DEMO] Win rate: ${simulationResult.winRate.toFixed(2)}%`);
                    Utils.log('log', `[DEMO] Decision: ${shouldProceed ? 'PROCEED' : 'SKIP'} (${shouldProceed ? 'Win rate above threshold' : 'Win rate below threshold'})`);

                    if (!shouldProceed) {
                        Utils.log('warn', `[DEMO] ⚠️ Win rate ${simulationResult.winRate.toFixed(2)}% is below ${CONSTANTS.WIN_RATE_THRESHOLD}%, skipping this opponent`);
                        console.log(`[DEMO] ✓ No battle attempt consumed - using demo battles API`);
                        console.log(`[DEMO] Looking for next opponent...`);
                        return { win: false, skipped: true, winRate: simulationResult.winRate };
                    }

                    // Step 4: Proceed with actual battle
                    console.log(`[DEMO] ✓ Win rate ${simulationResult.winRate.toFixed(2)}% is above threshold, proceeding with actual attack`);
                    console.log('[DEMO] Step 4: Executing actual battle...');
                    
                    const battleResult = await this.startArenaBattle(opponentId, myTeamConfig);
                    
                    console.log('[DEMO] Actual battle result:', {
                        win: battleResult.win,
                        note: 'Actual battle may differ from simulation due to seed variance'
                    });

                    await this.endArenaBattle(battleResult);

                    console.log(`[DEMO] ===== Battle completed for opponent ${opponentId} =====`);
                    return battleResult;
                } catch (error) {
                    console.error('[DEMO] Error in executeBattle:', error);
                    console.error('[DEMO] Error stack:', error.stack);
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

            this.getOpponentTeamConfig = function(opponent) {
                console.log('[DEMO] Extracting opponent team configuration...');
                
                if (!opponent || !opponent.opponent) {
                    console.warn('[DEMO] No opponent data available');
                    return { hasValidTeam: false };
                }

                const opp = opponent.opponent;
                let hasValidTeam = false;
                let config = {};

                // Helper function to extract hero/pet ID from object
                const extractId = (item) => {
                    if (typeof item === 'number') {
                        return item; // Already an ID
                    } else if (item && typeof item === 'object' && item.id) {
                        return item.id; // Extract ID from object
                    }
                    return null;
                };

                // Helper function to check if item is a pet
                const isPet = (item) => {
                    if (typeof item === 'number') {
                        return item >= 6000 && item < 7000; // Pet ID range
                    } else if (item && typeof item === 'object') {
                        return item.type === 'pet' || (item.id >= 6000 && item.id < 7000);
                    }
                    return false;
                };

                // Helper function to extract banner ID
                const extractBannerId = (banner) => {
                    if (typeof banner === 'number') {
                        return banner;
                    } else if (banner && typeof banner === 'object' && banner.id) {
                        return banner.id;
                    }
                    return 1; // Default banner
                };

                if (this.arenaType === 'grand') {
                    // Grand Arena: 3 teams
                    // heroes is array of 3 teams, each team is array of 6 objects (5 heroes + 1 pet)
                    if (opp.heroes && Array.isArray(opp.heroes) && opp.heroes.length >= 3) {
                        const teams = [];
                        const pets = [];
                        const favor = {};

                        // Extract teams from heroes array
                        for (let i = 0; i < Math.min(3, opp.heroes.length); i++) {
                            const team = opp.heroes[i];
                            if (team && Array.isArray(team) && team.length >= 6) {
                                // Extract hero IDs (first 5 items)
                                const heroIds = [];
                                let petId = 6005; // Default pet
                                
                                for (let j = 0; j < team.length; j++) {
                                    const item = team[j];
                                    const id = extractId(item);
                                    
                                    if (id && !isPet(item)) {
                                        // It's a hero
                                        if (heroIds.length < 5) {
                                            heroIds.push(id);
                                        }
                                    } else if (id && isPet(item)) {
                                        // It's a pet
                                        petId = id;
                                    }
                                }

                                if (heroIds.length === 5) {
                                    teams.push(heroIds);
                                    pets.push(petId);
                                    hasValidTeam = true;
                                }
                            }
                        }

                        // Extract banners (array of 3 banner objects)
                        const banners = [];
                        if (opp.banners && Array.isArray(opp.banners)) {
                            for (let i = 0; i < Math.min(3, opp.banners.length); i++) {
                                banners.push(extractBannerId(opp.banners[i]));
                            }
                        }
                        // Fill with defaults if needed
                        while (banners.length < 3) {
                            banners.push(1);
                        }

                        if (hasValidTeam) {
                            config = {
                                hasValidTeam: true,
                                heroes: teams,
                                pets: pets,
                                banners: banners.slice(0, 3),
                                favor: favor
                            };
                            console.log('[DEMO] Grand Arena config extracted:', {
                                teams: teams.length,
                                pets: pets.length,
                                banners: banners.length
                            });
                        }
                    }
                } else {
                    // Regular Arena: 1 team
                    // heroes is array of 6 objects (5 heroes + 1 pet)
                    if (opp.heroes && Array.isArray(opp.heroes) && opp.heroes.length >= 6) {
                        const heroIds = [];
                        let petId = 6005; // Default pet

                        // Extract hero IDs and pet ID from objects
                        for (let i = 0; i < opp.heroes.length; i++) {
                            const item = opp.heroes[i];
                            const id = extractId(item);
                            
                            if (id && !isPet(item)) {
                                // It's a hero
                                if (heroIds.length < 5) {
                                    heroIds.push(id);
                                }
                            } else if (id && isPet(item)) {
                                // It's a pet (usually the 6th item)
                                petId = id;
                            }
                        }

                        // Extract banner ID from banner object
                        let bannerId = 1; // Default
                        if (opp.banners && Array.isArray(opp.banners) && opp.banners.length > 0) {
                            bannerId = extractBannerId(opp.banners[0]);
                        } else if (typeof opp.banner === 'number') {
                            bannerId = opp.banner;
                        }

                        if (heroIds.length === 5) {
                            hasValidTeam = true;
                            config = {
                                hasValidTeam: true,
                                heroes: heroIds,
                                pet: petId,
                                banner: bannerId,
                                favor: {} // Favor data not available in arenaFindEnemies response
                            };
                            console.log('[DEMO] Regular Arena config extracted:', {
                                heroes: heroIds,
                                pet: petId,
                                banner: bannerId
                            });
                        }
                    }
                }

                if (!hasValidTeam) {
                    console.warn('[DEMO] Could not extract valid opponent team configuration');
                    console.log('[DEMO] Opponent data structure:', {
                        hasHeroes: !!opp.heroes,
                        heroesType: opp.heroes ? (Array.isArray(opp.heroes) ? 'array' : typeof opp.heroes) : 'none',
                        heroesLength: opp.heroes ? (Array.isArray(opp.heroes) ? opp.heroes.length : 'N/A') : 0,
                        firstHeroType: opp.heroes && Array.isArray(opp.heroes) && opp.heroes.length > 0 
                            ? (typeof opp.heroes[0]) : 'N/A',
                        hasBanners: !!opp.banners
                    });
                    console.log('[DEMO] Full opponent data:', JSON.stringify(opp, null, 2));
                } else {
                    console.log('[DEMO] Successfully extracted opponent team configuration');
                }

                return config;
            }

            this.simulateWithDemoBattles = async function(myTeam, opponentTeam, simulationCount = 10) {
                Utils.log('log', `[DEMO] Starting ${simulationCount} demo battle simulations...`);
                
                // Note: demoBattles API only supports "arena" mechanic, even for Grand Arena
                const mechanic = 'arena';

                const simulations = [];
                let parentId = 0; // Start with 0 for first battle
                let firstBattleId = null; // Store first battle's ID to use as parentId for subsequent battles
                
                for (let i = 0; i < simulationCount; i++) {
                    try {
                        // First battle uses parentId=0, subsequent battles use first battle's ID as parentId
                        const result = await this.runSingleDemoBattle(myTeam, opponentTeam, mechanic, i, parentId);
                        simulations.push(result);
                        
                        // For first battle: store the battle ID to use as parentId for subsequent battles
                        if (i === 0 && result.battleId) {
                            firstBattleId = result.battleId;
                            parentId = firstBattleId;
                        }
                        // For subsequent battles: use the first battle's ID as parentId
                        else if (i > 0 && firstBattleId) {
                            parentId = firstBattleId;
                        }
                        // Fallback: try to extract parentId from endBattle response
                        else if (result.parentId !== undefined && result.parentId !== null && result.parentId !== 0) {
                            parentId = result.parentId;
                        }
                    } catch (error) {
                        console.error(`[DEMO] Simulation ${i + 1} failed:`, error);
                        simulations.push({ win: false, battleTime: 0, error: error.message, parentId: parentId });
                    }
                }

                // Calculate statistics
                const wins = simulations.filter(s => s.win).length;
                const losses = simulations.length - wins;
                const winRate = (wins / simulations.length) * 100;
                const battleTimes = simulations.map(s => s.battleTime).filter(t => t > 0);
                const averageBattleTime = battleTimes.length > 0 
                    ? battleTimes.reduce((a, b) => a + b, 0) / battleTimes.length 
                    : 0;

                Utils.log('log', `[DEMO] Simulation complete: ${wins}W/${losses}L (${winRate.toFixed(1)}% win rate)`);

                return {
                    total: simulations.length,
                    wins: wins,
                    losses: losses,
                    winRate: winRate,
                    averageBattleTime: averageBattleTime,
                    simulations: simulations
                };
            }

            this.runSingleDemoBattle = async function(myTeam, opponentTeam, mechanic, seedOffset = 0, parentId = 0) {
                return new Promise((resolve, reject) => {
                    try {
                        let args = {
                            mechanic: mechanic,
                            defenceMaxUpgrade: true,  // Use max upgrade for opponent to get accurate simulation
                            maxUpgrade: true,          // Use max upgrade for our team to get accurate simulation
                            defenceBuffs: {},
                            buffs: {},
                            parentId: parentId,
                            entryId: 0
                        };

                        // Handle team configuration based on arena type
                        // Note: demoBattles API only supports "arena" mechanic
                        // For Grand Arena, we simulate the first team as a proxy
                        if (this.arenaType === 'grand') {
                            // Grand Arena: 3 teams - simulate first team as proxy
                            // Note: demoBattles_startBattle only simulates one team at a time
                            // We use the first team as a proxy for overall win probability
                            const teamIndex = seedOffset % 3; // Rotate through teams for variety
                            
                            args.defenceTeam = {
                                units: opponentTeam.heroes[teamIndex] || opponentTeam.heroes[0] || [],
                                pet: opponentTeam.pets[teamIndex] || opponentTeam.pets[0] || CONSTANTS.DEFAULT_PET_ID
                            };
                            args.defenceBanner = opponentTeam.banners[teamIndex] || opponentTeam.banners[0] || 1;
                            args.defenceBannerStones = {};  // Required field from HAR file
                            args.defenceFavor = opponentTeam.favor || {};
                            
                            args.team = {
                                units: myTeam.heroes[teamIndex] || myTeam.heroes[0] || [],
                                pet: myTeam.pets[teamIndex] || myTeam.pets[0] || CONSTANTS.DEFAULT_PET_ID
                            };
                            args.banner = myTeam.banners[teamIndex] || myTeam.banners[0] || 1;
                            args.bannerStones = {};  // Required field from HAR file
                            args.favor = myTeam.favor || {};
                        } else {
                            // Regular Arena: 1 team
                            args.defenceTeam = {
                                units: opponentTeam.heroes || [],
                                pet: opponentTeam.pet || CONSTANTS.DEFAULT_PET_ID
                            };
                            args.defenceBanner = opponentTeam.banner || 1;
                            args.defenceBannerStones = {};  // Required field from HAR file
                            args.defenceFavor = opponentTeam.favor || {};
                            
                            args.team = {
                                units: myTeam.heroes || [],
                                pet: myTeam.pet || CONSTANTS.DEFAULT_PET_ID
                            };
                            args.banner = myTeam.banners[0] || 1;
                            args.bannerStones = {};  // Required field from HAR file
                            args.favor = myTeam.favor || {};
                        }

                        // Validate required fields before making API call
                        if (!args.team || !args.team.units || args.team.units.length === 0) {
                            reject(new Error('Invalid team configuration: missing or empty hero units'));
                            return;
                        }
                        if (!args.defenceTeam || !args.defenceTeam.units || args.defenceTeam.units.length === 0) {
                            reject(new Error('Invalid defence team configuration: missing or empty hero units'));
                            return;
                        }
                        if (!args.team.pet || typeof args.team.pet !== 'number') {
                            reject(new Error('Invalid team pet: must be a number'));
                            return;
                        }
                        if (!args.defenceTeam.pet || typeof args.defenceTeam.pet !== 'number') {
                            reject(new Error('Invalid defence team pet: must be a number'));
                            return;
                        }

                        const calls = [{
                            name: "demoBattles_startBattle",
                            args: args,
                            context: {
                                actionTs: Utils.getActionTs()
                            },
                            ident: "body"
                        }];

                        const startTime = Date.now();
                        
                        Send(JSON.stringify({calls}))
                            .then(response => {
                                if (response.error) {
                                    console.error('[DEMO] API error:', response.error);
                                    reject(new Error(`Demo battle API error: ${response.error.name} - ${response.error.description}`));
                                    return;
                                }

                                if (!response.results || !response.results[0] || !response.results[0].result) {
                                    console.error('[DEMO] Invalid API response structure');
                                    reject(new Error('Invalid demo battle API response'));
                                    return;
                                }

                                const responseData = response.results[0].result.response;
                                // Battle data is nested under 'battle' property
                                const battleData = responseData?.battle || responseData;

                                if (!battleData) {
                                    console.error('[DEMO] No battle data found in response');
                                    reject(new Error('No battle data in API response'));
                                    return;
                                }

                                // Calculate battle result using BattleCalc
                                const battleType = battleData?.effects?.battleConfig ?? battleData?.type ?? mechanic;
                                const battleConfigType = getBattleType(battleType);
                                
                                BattleCalc(battleData, battleConfigType, (calcResult) => {
                                    if (!Utils.isValidBattleResult(calcResult)) {
                                        Utils.log('error', '[DEMO] BattleCalc returned invalid result');
                                        resolve({
                                            win: false,
                                            battleTime: 0,
                                            error: 'Invalid calculation result',
                                            parentId: parentId
                                        });
                                        return;
                                    }

                                    const battleTime = calcResult.battleTime || 0;
                                    const win = calcResult.result.win || false;

                                    // Call demoBattles_endBattle to get battleId for parentId chaining
                                    // Strategy: Use first battle's ID as parentId for all subsequent battles
                                    const self = this;
                                    self.endDemoBattle(calcResult, battleData)
                                        .then(endBattleResult => {
                                            const extractedParentId = endBattleResult?.parentId;
                                            const battleId = endBattleResult?.battleId;
                                            
                                            // Strategy: For first battle, use its ID as parentId for subsequent battles
                                            let nextParentId = parentId;
                                            
                                            if (parentId === 0 && battleId) {
                                                // First battle: use its ID as parentId for next battle
                                                nextParentId = battleId;
                                            } else if (parentId !== 0) {
                                                // Subsequent battle: keep using the first battle's ID
                                                nextParentId = parentId;
                                            } else if (extractedParentId && extractedParentId !== 0) {
                                                // Fallback: use parentId from endBattle response
                                                nextParentId = extractedParentId;
                                            }
                                            
                                            resolve({
                                                win: win,
                                                battleTime: battleTime,
                                                result: calcResult,
                                                parentId: nextParentId,
                                                battleId: battleId
                                            });
                                        })
                                        .catch(endError => {
                                            Utils.log('warn', '[DEMO] Failed to call endBattle:', endError);
                                            resolve({
                                                win: win,
                                                battleTime: battleTime,
                                                result: calcResult,
                                                parentId: parentId,
                                                battleId: null
                                            });
                                        });
                                });
                            })
                            .catch(error => {
                                console.error('[DEMO] Error in demo battle:', error);
                                reject(error);
                            });
                    } catch (error) {
                        console.error('[DEMO] Error preparing demo battle:', error);
                        reject(error);
                    }
                });
            }

            this.endDemoBattle = async function(calcResult, battleData) {
                return new Promise((resolve, reject) => {
                    try {
                        // Prepare progress data from battle calculation result
                        const progress = calcResult.progress || [];
                        
                        // Ensure progress array has at least one entry
                        if (progress.length === 0 && calcResult.result) {
                            // Create minimal progress entry from result
                            progress.push({
                                v: CONSTANTS.BATTLE_VERSION,
                                b: 0,
                                seed: battleData?.seed || Math.floor(Math.random() * 1000000000),
                                attackers: {
                                    input: [],
                                    heroes: {}
                                },
                                defenders: {
                                    input: [],
                                    heroes: {}
                                }
                            });
                        }

                        const endBattleArgs = {
                            result: {
                                win: calcResult.result.win || false,
                                stars: calcResult.result.stars || 0
                            },
                            progress: progress
                        };

                        const calls = [{
                            name: "demoBattles_endBattle",
                            args: endBattleArgs,
                            context: {
                                actionTs: Utils.getActionTs()
                            },
                            ident: "body"
                        }];

                        Send(JSON.stringify({calls}))
                            .then(response => {
                                if (response.error) {
                                    Utils.log('warn', '[DEMO] EndBattle API error:', response.error);
                                    resolve(null); // Return null on error, will use original parentId
                                    return;
                                }

                                if (!response.results || !response.results[0] || !response.results[0].result) {
                                    Utils.log('warn', '[DEMO] Invalid endBattle response structure');
                                    resolve(null);
                                    return;
                                }

                                const endBattleResponse = response.results[0].result.response;
                                
                                // Extract both parentId and battleId from battle object in response
                                // Strategy: Use first battle's ID as parentId for subsequent battles
                                const battle = endBattleResponse?.battle;
                                const extractedParentId = battle?.parentId;
                                const battleId = battle?.id;
                                
                                resolve({
                                    parentId: extractedParentId !== undefined && extractedParentId !== null ? extractedParentId : null,
                                    battleId: battleId !== undefined && battleId !== null ? battleId : null
                                });
                            })
                            .catch(error => {
                                Utils.log('warn', '[DEMO] Error calling endBattle:', error);
                                resolve(null); // Return null on error, will use original parentId
                            });
                    } catch (error) {
                        Utils.log('warn', '[DEMO] Error preparing endBattle:', error);
                        resolve(null);
                    }
                });
            }

            this.startArenaBattle = async function(rivalId, team) {
                const apiName = this.arenaType === 'grand' ? 'grandAttack' : 'arenaAttack';

                // Ensure rivalId is a number
                const userId = typeof rivalId === 'string' ? parseInt(rivalId, 10) : rivalId;

                let args;
                if (this.arenaType === 'grand') {
                    // Grand Arena: heroes is array of 3 arrays, pets is array of 3 numbers
                    if (!team.heroes || !Array.isArray(team.heroes) || team.heroes.length !== 3) {
                        throw new Error('Grand Arena requires 3 hero teams');
                    }
                    if (!team.pets || !Array.isArray(team.pets) || team.pets.length !== 3) {
                        throw new Error('Grand Arena requires 3 pets');
                    }
                    if (!team.banners || !Array.isArray(team.banners) || team.banners.length !== 3) {
                        throw new Error('Grand Arena requires 3 banners');
                    }
                    
                    args = {
                        userId: userId,
                        heroes: team.heroes,  // Array of 3 arrays: [[team1], [team2], [team3]]
                        pets: team.pets,      // Array of 3 pet IDs
                        favor: team.favor || {},  // Object mapping hero IDs (strings) to pet IDs
                        banners: team.banners // Array of 3 banner IDs
                    };
                } else {
                    // Regular Arena: heroes is flat array of 5 numbers, pet is single number
                    if (!team.heroes || !Array.isArray(team.heroes) || team.heroes.length !== 5) {
                        throw new Error('Arena requires exactly 5 heroes');
                    }
                    if (!team.pet || typeof team.pet !== 'number') {
                        throw new Error('Arena requires a valid pet ID');
                    }
                    
                    // Ensure banners is an array (even if single banner)
                    const banners = Array.isArray(team.banners) ? team.banners : 
                                   team.banners ? [team.banners] : [1];
                    
                    args = {
                        userId: userId,
                        heroes: team.heroes,  // Flat array of 5 hero IDs
                        pet: team.pet,       // Single pet ID (number)
                        favor: team.favor || {},  // Object mapping hero IDs (strings) to pet IDs
                        banners: banners      // Array of banner IDs (usually single element)
                    };
                }

                const calls = [{
                    name: apiName,
                    args: args,
                    context: {
                        actionTs: Utils.getActionTs()
                    },
                    ident: "body"
                }];

                console.log(`[ARENA] Calling ${apiName} with args:`, JSON.stringify(args, null, 2));
                console.log(`[ARENA] Full API call:`, JSON.stringify({calls}, null, 2));

                const response = await Send(JSON.stringify({calls}));
                console.log('[ARENA] Battle API response:', response);

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
                // Skip stashClient call - battles auto-close and this can cause NotFound errors
                // The battle popup will close automatically after battle completion
                // Calling stashClient can trigger errors if the battle type doesn't match
                console.log('Battle completed, popup will auto-close');
                
                // Optional: Add a small delay to ensure battle processing completes
                await new Promise(resolve => setTimeout(resolve, CONSTANTS.DELAY_BATTLE_COMPLETE));
            }

            this.end = function(message) {
                console.log('Arena execution ended:', message);
                setProgress(`Arena: ${message}`, true);
                this.resolve();
            }
        }

        // ========== EXECUTE GUILD WAR CLASS ==========
        function executeGuildWar(resolve, reject) {
            this.resolve = resolve;
            this.reject = reject;
            this.victories = 0;
            this.guildWarInfo = null;
            this.teamInfo = null;
            this.myTries = null;

            this.start = async function() {
                setProgress(`${I18N('GUILD_WAR')}: ${I18N('INITIALIZING')}...`);

                try {
                    const hasAttempts = await this.getGuildWarInfo();
                    if (!hasAttempts) {
                        // getGuildWarInfo already handled the end message, just return
                        return;
                    }
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
                    context: { actionTs: Utils.getActionTs() },
                    ident: "clanWarGetInfo"
                }];

                const response = await Send(JSON.stringify({calls}));
                
                if (response.error) {
                    console.log(`Guild War info API error: ${response.error.name} - ${response.error.description}`);
                    this.end(`Guild War not available: ${response.error.description || response.error.name}`);
                    return false;
                }
                
                if (!response.results || !response.results[0] || !response.results[0].result || !response.results[0].result.response) {
                    console.log('Invalid clanWarGetInfo response');
                    this.end('Guild War: Invalid response from server');
                    return false;
                }

                this.guildWarInfo = response.results[0].result.response;
                
                // Check if myTries exists (only exists when war is active)
                if ('myTries' in this.guildWarInfo) {
                    this.myTries = this.guildWarInfo.myTries;
                    console.log(`Guild War attempts remaining: ${this.myTries}`);
                    
                    if (this.myTries <= 0) {
                        console.log('No Guild War attempts remaining');
                        this.end('No Guild War attempts remaining');
                        return false;
                    }
                } else {
                    console.log('Guild War is not currently active - myTries field not available');
                    this.end('Guild War is not currently active');
                    return false;
                }

                console.log('Guild War info loaded');
                return true;
            }

            this.refreshGuildWarAttempts = async function() {
                try {
                    const calls = [{
                        name: "clanWarGetInfo",
                        args: {},
                        context: { actionTs: Utils.getActionTs() },
                        ident: "clanWarGetInfo"
                    }];

                    const response = await Send(JSON.stringify({calls}));
                    
                    if (response.error) {
                        console.warn('Failed to refresh Guild War attempts:', response.error);
                        return false;
                    }
                    
                    if (response.results && response.results[0] && response.results[0].result && response.results[0].result.response) {
                        const guildWarInfo = response.results[0].result.response;
                        if ('myTries' in guildWarInfo) {
                            this.myTries = guildWarInfo.myTries;
                            this.guildWarInfo = guildWarInfo;
                            console.log(`Refreshed Guild War attempts: ${this.myTries}`);
                            return true;
                        }
                    }
                    return false;
                } catch (error) {
                    console.warn('Error refreshing Guild War attempts:', error);
                    return false;
                }
            }

            this.getTeamData = async function() {
                console.log('Getting team data...');
                
                const calls = [
                    {
                        name: "teamGetAll",
                        args: {},
                        context: { actionTs: Utils.getActionTs() },
                        ident: "teamGetAll"
                    },
                    {
                        name: "teamGetFavor",
                        args: {},
                        context: { actionTs: Utils.getActionTs() },
                        ident: "teamGetFavor"
                    },
                    {
                        name: "heroGetAll",
                        args: {},
                        context: { actionTs: Utils.getActionTs() },
                        ident: "heroGetAll"
                    },
                    {
                        // Needed for Guild War titan team power comparisons
                        name: "titanGetAll",
                        args: {},
                        context: { actionTs: Utils.getActionTs() },
                        ident: "titanGetAll"
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
                if (!response.results[3] || !response.results[3].result || !response.results[3].result.response) {
                    throw new Error('Invalid titanGetAll response - titan data not available');
                }

                const heroesById = response.results[2].result.response || {};
                const titansById = response.results[3].result.response || {};

                this.teamInfo = {
                    teams: response.results[0].result.response,
                    favor: response.results[1].result.response,
                    heroesById: heroesById,
                    titansById: titansById
                };

                console.log('Team data loaded');
            }

            this.getUnitPower = function(unitId, isTitan) {
                if (!this.teamInfo) return 0;
                const source = isTitan ? this.teamInfo.titansById : this.teamInfo.heroesById;
                if (!source) return 0;
                const unit = source[unitId];
                const p = unit && unit.power !== undefined ? Number(unit.power) : 0;
                return Number.isFinite(p) ? p : 0;
            }

            this.getMyTeamPower = function(teamConfig, isTitanBattle) {
                const ids = isTitanBattle ? (teamConfig?.titans || []) : (teamConfig?.heroes || []);
                return ids.slice(0, 5).reduce((sum, id) => sum + this.getUnitPower(id, isTitanBattle), 0);
            }

            this.getOpponentSlotPower = function(slotId, isTitanBattle) {
                if (!this.guildWarInfo || !this.guildWarInfo.enemySlots) return 0;
                const slotData = this.guildWarInfo.enemySlots[String(slotId)];
                if (!slotData || !Array.isArray(slotData.team)) return 0;

                const expectedType = isTitanBattle ? 'titan' : 'hero';
                let sum = 0;
                for (const memberObj of slotData.team) {
                    if (!memberObj || typeof memberObj !== 'object') continue;
                    const position = Object.keys(memberObj)[0];
                    const unit = memberObj[position];
                    if (!unit || unit.type !== expectedType) continue;
                    const p = unit.power !== undefined ? Number(unit.power) : 0;
                    if (Number.isFinite(p)) sum += p;
                }
                return sum;
            }

            this.attackDirectSlots = async function() {
                console.log('Starting direct Guild War attacks on slots 7, 8, 9, 34, 1, and 2...');
                
                const slots = [7, 8, 9, 34, 1, 2];
                const slotNames = {
                    7: 'slot 7 (Titans - Bridge)',
                    8: 'slot 8 (Titans - Bridge)',
                    9: 'slot 9 (Titans - Bridge)',
                    34: 'slot 34 (Titans - Bridge)',
                    1: 'slot 1',
                    2: 'slot 2'
                };
                
                for (let i = 0; i < slots.length; i++) {
                    const slotId = slots[i];
                    
                    // Refresh attempts from API before each attack to get accurate count
                    await this.refreshGuildWarAttempts();
                    
                    // Check if we have attempts remaining before each attack
                    if (this.myTries === null || this.myTries === undefined || this.myTries <= 0) {
                        console.log(`No attempts remaining (myTries: ${this.myTries}), stopping attacks`);
                        break;
                    }
                    
                    try {
                        console.log(`Attacking ${slotNames[slotId]}... (${this.myTries} attempts remaining)`);
                        setProgress(`${I18N('GUILD_WAR')}: Attacking ${slotNames[slotId]} (${this.myTries} attempts)`);
                        await this.attackSlot(slotId);
                        this.victories++;
                        console.log(`${slotNames[slotId]} attack completed successfully`);
                        
                        // Refresh attempts after successful attack to get updated count
                        await this.refreshGuildWarAttempts();
                    } catch (error) {
                        console.error(`Error attacking ${slotNames[slotId]}:`, error);
                        
                        // Check if this is a skip error (from simulation)
                        if (error.message && error.message.startsWith('Skipped:')) {
                            console.log(`[GUILD_WAR] ${slotNames[slotId]} skipped due to low win rate, continuing to next target`);
                            Utils.log('warn', `Skipped ${slotNames[slotId]}: ${error.message}, continuing to next target`);
                            // Don't increment victories, just continue
                        } else {
                            // Other errors: continue to next slot instead of stopping
                            Utils.log('warn', `Failed to attack ${slotNames[slotId]}: ${error.message}, continuing to next target`);
                        }
                    }
                    
                    // Add delay between attacks (except after the last one)
                    if (i < slots.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, CONSTANTS.DELAY_BETWEEN_BATTLES));
                    }
                }

                // Final refresh to get accurate remaining attempts
                await this.refreshGuildWarAttempts();
                const summary = `Completed ${this.victories} Guild War attacks${this.myTries > 0 ? ` (${this.myTries} attempts remaining)` : ''}`;
                this.end(summary);
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
                
                const isTitanBattle = (slotId === 7 || slotId === 8 || slotId === 9 || slotId === 34);
                
                let teamConfig;
                if (isTitanBattle) {
                    teamConfig = this.getTitanTeamConfiguration();
                    
                    if (!teamConfig.titans || teamConfig.titans.length < 5) {
                        throw new Error('Titan team not properly configured - need at least 5 titans');
                    }

                    // Power check BEFORE running expensive simulations / consuming attempts
                    try {
                        const myPower = this.getMyTeamPower(teamConfig, true);
                        const oppPower = this.getOpponentSlotPower(slotId, true);
                        if (myPower > 0 && oppPower > 0 && myPower < (oppPower * 0.5)) {
                            const msg = `Skipped: Power check failed (my ${myPower} vs enemy ${oppPower})`;
                            console.log(`[GUILD_WAR_TITAN] ⚠️ ${msg}`);
                            setProgress(`${I18N('GUILD_WAR')}: Skipping slot ${slotId} (power too low)`);
                            throw new Error(msg);
                        }
                    } catch (e) {
                        // Re-throw explicit skip errors to continue to next slot
                        if (e?.message && e.message.startsWith('Skipped:')) throw e;
                        // Otherwise ignore power-check issues and proceed
                    }
                    
                    // Run demo battle simulation for titan battles before attacking
                    console.log(`[GUILD_WAR_TITAN] Running demo battle simulation for slot ${slotId}...`);
                    try {
                        const opponentTitanTeam = this.getOpponentTitanTeamFromSlot(slotId);
                        if (opponentTitanTeam && opponentTitanTeam.titans && opponentTitanTeam.titans.length >= 5) {
                            const simulationResult = await this.simulateGuildWarTitanBattle(teamConfig, opponentTitanTeam, CONSTANTS.SIMULATION_COUNT);
                            
                            console.log(`[GUILD_WAR_TITAN] Simulation results: ${simulationResult.wins}W/${simulationResult.losses}L (${simulationResult.winRate.toFixed(2)}% win rate)`);
                            
                            // Check win rate threshold
                            if (simulationResult.winRate <= CONSTANTS.WIN_RATE_THRESHOLD) {
                                console.log(`[GUILD_WAR_TITAN] ⚠️ Win rate ${simulationResult.winRate.toFixed(2)}% is below ${CONSTANTS.WIN_RATE_THRESHOLD}%, skipping slot ${slotId}`);
                                setProgress(`${I18N('GUILD_WAR')}: Skipping slot ${slotId} (win rate ${simulationResult.winRate.toFixed(2)}%)`);
                                throw new Error(`Skipped: Win rate ${simulationResult.winRate.toFixed(2)}% below threshold`);
                            }
                            
                            console.log(`[GUILD_WAR_TITAN] ✓ Win rate ${simulationResult.winRate.toFixed(2)}% is above threshold, proceeding with attack`);
                        } else {
                            console.warn(`[GUILD_WAR_TITAN] ⚠️ Cannot get opponent titan team data for slot ${slotId}, proceeding with attack anyway`);
                        }
                    } catch (error) {
                        if (error.message && error.message.startsWith('Skipped:')) {
                            // Re-throw skip errors to continue to next slot
                            throw error;
                        }
                        console.warn(`[GUILD_WAR_TITAN] Simulation error for slot ${slotId}:`, error);
                        console.log(`[GUILD_WAR_TITAN] Proceeding with attack despite simulation error`);
                    }
                } else {
                    teamConfig = this.getArenaTeamConfiguration();
                    
                    if (!teamConfig.heroes || teamConfig.heroes.length < 5) {
                        throw new Error('Arena team not properly configured - need at least 5 heroes');
                    }

                    // Power check before attacking hero slot
                    try {
                        const myPower = this.getMyTeamPower(teamConfig, false);
                        const oppPower = this.getOpponentSlotPower(slotId, false);
                        if (myPower > 0 && oppPower > 0 && myPower < (oppPower * 0.5)) {
                            const msg = `Skipped: Power check failed (my ${myPower} vs enemy ${oppPower})`;
                            console.log(`[GUILD_WAR] ⚠️ ${msg}`);
                            setProgress(`${I18N('GUILD_WAR')}: Skipping slot ${slotId} (power too low)`);
                            throw new Error(msg);
                        }
                    } catch (e) {
                        if (e?.message && e.message.startsWith('Skipped:')) throw e;
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
                            actionTs: Utils.getActionTs()
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
                
                // Note: myTries will be refreshed from API after attack, don't manually decrement
                // to avoid desync with server-side value
                
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

            this.getOpponentTitanTeamFromSlot = function(slotId) {
                if (!this.guildWarInfo || !this.guildWarInfo.enemySlots) {
                    console.warn('[GUILD_WAR_TITAN] No enemy slots data available');
                    return null;
                }
                
                const slotData = this.guildWarInfo.enemySlots[slotId.toString()];
                if (!slotData || !slotData.team || !Array.isArray(slotData.team)) {
                    console.warn(`[GUILD_WAR_TITAN] No team data found for slot ${slotId}`);
                    return null;
                }
                
                // Extract titan IDs from team array
                // Team structure: [{"1": {id: 4033, ...}}, {"2": {id: 4003, ...}}, ...]
                const titanIds = [];
                for (const memberObj of slotData.team) {
                    if (memberObj && typeof memberObj === 'object') {
                        // Get the first key (position) and extract the titan object
                        const position = Object.keys(memberObj)[0];
                        const titan = memberObj[position];
                        if (titan && titan.id && titan.type === 'titan') {
                            titanIds.push(titan.id);
                        }
                    }
                }
                
                if (titanIds.length < 5) {
                    console.warn(`[GUILD_WAR_TITAN] Only found ${titanIds.length} titans in slot ${slotId}, need 5`);
                    return null;
                }
                
                console.log(`[GUILD_WAR_TITAN] Extracted opponent titan team from slot ${slotId}:`, titanIds);
                
                return {
                    titans: titanIds.slice(0, 5)
                };
            }

            this.simulateGuildWarTitanBattle = async function(myTeam, opponentTeam, simulationCount = 10) {
                Utils.log('log', `[GUILD_WAR_TITAN] Starting ${simulationCount} demo battle simulations...`);
                
                const mechanic = 'clan_pvp_titan';
                
                const simulations = [];
                let parentId = 0; // Start with 0 for first battle
                let firstBattleId = null; // Store first battle's ID to use as parentId for subsequent battles
                
                for (let i = 0; i < simulationCount; i++) {
                    try {
                        // First battle uses parentId=0, subsequent battles use first battle's ID as parentId
                        const result = await this.runSingleGuildWarTitanDemoBattle(myTeam, opponentTeam, mechanic, i, parentId);
                        simulations.push(result);
                        
                        // For first battle: store the battle ID to use as parentId for subsequent battles
                        if (i === 0 && result.battleId) {
                            firstBattleId = result.battleId;
                            parentId = firstBattleId;
                        }
                        // For subsequent battles: use the first battle's ID as parentId
                        else if (i > 0 && firstBattleId) {
                            parentId = firstBattleId;
                        }
                        // Fallback: try to extract parentId from endBattle response
                        else if (result.parentId !== undefined && result.parentId !== null && result.parentId !== 0) {
                            parentId = result.parentId;
                        }
                    } catch (error) {
                        console.error(`[GUILD_WAR_TITAN] Simulation ${i + 1} failed:`, error);
                        simulations.push({ win: false, battleTime: 0, error: error.message, parentId: parentId });
                    }
                }
                
                // Calculate statistics
                const wins = simulations.filter(s => s.win).length;
                const losses = simulations.length - wins;
                const winRate = (wins / simulations.length) * 100;
                const battleTimes = simulations.map(s => s.battleTime).filter(t => t > 0);
                const averageBattleTime = battleTimes.length > 0 
                    ? battleTimes.reduce((a, b) => a + b, 0) / battleTimes.length 
                    : 0;
                
                Utils.log('log', `[GUILD_WAR_TITAN] Simulation complete: ${wins}W/${losses}L (${winRate.toFixed(1)}% win rate)`);
                
                return {
                    total: simulations.length,
                    wins: wins,
                    losses: losses,
                    winRate: winRate,
                    averageBattleTime: averageBattleTime,
                    simulations: simulations
                };
            }

            this.runSingleGuildWarTitanDemoBattle = async function(myTeam, opponentTeam, mechanic, seedOffset = 0, parentId = 0) {
                return new Promise((resolve, reject) => {
                    try {
                        // Get element spirits from user info (default to dark/water if not available)
                        let firstSpiritElement = 'dark';
                        let secondSpiritElement = 'water';
                        let defenceFirstSpiritElement = 'earth';
                        
                        try {
                            const userInfo = getUserInfo();
                            // Try to get element spirits from userInfo if available
                            // For now, use defaults
                        } catch (e) {
                            // Use defaults
                        }
                        
                        let args = {
                            mechanic: mechanic,
                            defenceMaxUpgrade: true,
                            defenceTeam: {
                                units: opponentTeam.titans || []
                            },
                            defenceFavor: {},
                            maxUpgrade: true,
                            team: {
                                units: myTeam.titans || []
                            },
                            favor: {},
                            defenceBuffs: {},
                            buffs: {},
                            firstSpiritElement: firstSpiritElement,
                            firstSpiritSkills: {},
                            secondSpiritElement: secondSpiritElement,
                            secondSpiritSkills: {},
                            defenceFirstSpiritElement: defenceFirstSpiritElement,
                            defenceFirstSpiritSkills: {},
                            parentId: parentId,
                            entryId: 0
                        };
                        
                        // Validate required fields
                        if (!args.team || !args.team.units || args.team.units.length === 0) {
                            reject(new Error('Invalid team configuration: missing or empty titan units'));
                            return;
                        }
                        if (!args.defenceTeam || !args.defenceTeam.units || args.defenceTeam.units.length === 0) {
                            reject(new Error('Invalid defence team configuration: missing or empty titan units'));
                            return;
                        }
                        
                        const calls = [{
                            name: "demoBattles_startBattle",
                            args: args,
                            context: {
                                actionTs: Utils.getActionTs()
                            },
                            ident: "body"
                        }];
                        
                        const startTime = Date.now();
                        
                        Send(JSON.stringify({calls}))
                            .then(response => {
                                if (response.error) {
                                    console.error('[GUILD_WAR_TITAN] API error:', response.error);
                                    reject(new Error(`Demo battle API error: ${response.error.name} - ${response.error.description}`));
                                    return;
                                }
                                
                                if (!response.results || !response.results[0] || !response.results[0].result) {
                                    console.error('[GUILD_WAR_TITAN] Invalid API response structure');
                                    reject(new Error('Invalid demo battle API response'));
                                    return;
                                }
                                
                                const responseData = response.results[0].result.response;
                                const battleData = responseData?.battle || responseData;
                                
                                if (!battleData) {
                                    console.error('[GUILD_WAR_TITAN] No battle data found in response');
                                    reject(new Error('No battle data in API response'));
                                    return;
                                }
                                
                                // Calculate battle result using BattleCalc
                                const battleType = battleData?.type ?? mechanic;
                                const battleConfigType = getBattleType(battleType);
                                
                                BattleCalc(battleData, battleConfigType, (calcResult) => {
                                    if (!Utils.isValidBattleResult(calcResult)) {
                                        Utils.log('error', '[GUILD_WAR_TITAN] BattleCalc returned invalid result');
                                        resolve({
                                            win: false,
                                            battleTime: 0,
                                            error: 'Invalid calculation result',
                                            parentId: parentId
                                        });
                                        return;
                                    }
                                    
                                    const battleTime = calcResult.battleTime || 0;
                                    const win = calcResult.result.win || false;
                                    
                                    // Call demoBattles_endBattle to get battleId for parentId chaining
                                    const self = this;
                                    self.endGuildWarTitanDemoBattle(calcResult, battleData)
                                        .then(endBattleResult => {
                                            const extractedParentId = endBattleResult?.parentId;
                                            const battleId = endBattleResult?.battleId;
                                            
                                            // Strategy: For first battle, use its ID as parentId for subsequent battles
                                            let nextParentId = parentId;
                                            
                                            if (parentId === 0 && battleId) {
                                                // First battle: use its ID as parentId for next battle
                                                nextParentId = battleId;
                                            } else if (parentId !== 0) {
                                                // Subsequent battle: keep using the first battle's ID
                                                nextParentId = parentId;
                                            } else if (extractedParentId && extractedParentId !== 0) {
                                                // Fallback: use parentId from endBattle response
                                                nextParentId = extractedParentId;
                                            }
                                            
                                            resolve({
                                                win: win,
                                                battleTime: battleTime,
                                                result: calcResult,
                                                parentId: nextParentId,
                                                battleId: battleId
                                            });
                                        })
                                        .catch(endError => {
                                            Utils.log('warn', '[GUILD_WAR_TITAN] Failed to call endBattle:', endError);
                                            resolve({
                                                win: win,
                                                battleTime: battleTime,
                                                result: calcResult,
                                                parentId: parentId,
                                                battleId: null
                                            });
                                        });
                                });
                            })
                            .catch(error => {
                                console.error('[GUILD_WAR_TITAN] Error in demo battle:', error);
                                reject(error);
                            });
                    } catch (error) {
                        console.error('[GUILD_WAR_TITAN] Error preparing demo battle:', error);
                        reject(error);
                    }
                });
            }

            this.endGuildWarTitanDemoBattle = async function(calcResult, battleData) {
                return new Promise((resolve, reject) => {
                    try {
                        // Prepare progress data from battle calculation result
                        const progress = calcResult.progress || [];
                        
                        // Ensure progress array has at least one entry
                        if (progress.length === 0 && calcResult.result) {
                            // Create minimal progress entry from result
                            progress.push({
                                v: CONSTANTS.BATTLE_VERSION,
                                b: 0,
                                seed: battleData?.seed || Math.floor(Math.random() * 1000000000),
                                attackers: {
                                    input: [],
                                    heroes: {}
                                },
                                defenders: {
                                    input: [],
                                    heroes: {}
                                }
                            });
                        }
                        
                        const endBattleArgs = {
                            result: {
                                win: calcResult.result.win || false,
                                stars: calcResult.result.stars || 0
                            },
                            progress: progress
                        };
                        
                        const calls = [{
                            name: "demoBattles_endBattle",
                            args: endBattleArgs,
                            context: {
                                actionTs: Utils.getActionTs()
                            },
                            ident: "body"
                        }];
                        
                        Send(JSON.stringify({calls}))
                            .then(response => {
                                if (response.error) {
                                    Utils.log('warn', '[GUILD_WAR_TITAN] EndBattle API error:', response.error);
                                    resolve(null);
                                    return;
                                }
                                
                                if (!response.results || !response.results[0] || !response.results[0].result) {
                                    Utils.log('warn', '[GUILD_WAR_TITAN] Invalid endBattle response structure');
                                    resolve(null);
                                    return;
                                }
                                
                                const endBattleResponse = response.results[0].result.response;
                                
                                // Extract both parentId and battleId from battle object in response
                                // Strategy: Use first battle's ID as parentId for subsequent battles
                                const battle = endBattleResponse?.battle;
                                const extractedParentId = battle?.parentId;
                                const battleId = battle?.id;
                                
                                resolve({
                                    parentId: extractedParentId !== undefined && extractedParentId !== null ? extractedParentId : null,
                                    battleId: battleId !== undefined && battleId !== null ? battleId : null
                                });
                            })
                            .catch(error => {
                                Utils.log('warn', '[GUILD_WAR_TITAN] Error calling endBattle:', error);
                                resolve(null);
                            });
                    } catch (error) {
                        Utils.log('warn', '[GUILD_WAR_TITAN] Error preparing endBattle:', error);
                        resolve(null);
                    }
                });
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
                    context: { actionTs: Utils.getActionTs() },
                    ident: "clanRaid_getInfo"
                }, {
                    name: "teamGetAll",
                    args: {},
                    context: { actionTs: Utils.getActionTs() },
                    ident: "teamGetAll"
                }, {
                    name: "teamGetFavor",
                    args: {},
                    context: { actionTs: Utils.getActionTs() },
                    ident: "teamGetFavor"
                }]
            }

            this.start = function () {
                SendRequest(JSON.stringify(callsExecuteRaidNodes), startRaidNodes);
            }

            async function startRaidNodes(data) {
                // Validate response structure
                if (data.error) {
                    console.error('Raid Nodes: API error:', data.error);
                    endRaidNodes('APIError', data.error);
                    return;
                }
                
                if (!data.results || !Array.isArray(data.results) || data.results.length < 3) {
                    console.error('Raid Nodes: Invalid response structure - missing results');
                    endRaidNodes('InvalidResponse', 'Missing or invalid results array');
                    return;
                }
                
                if (!data.results[0] || !data.results[0].result || !data.results[0].result.response) {
                    console.error('Raid Nodes: Invalid clanRaid_getInfo response');
                    endRaidNodes('InvalidResponse', 'Invalid clanRaid_getInfo response');
                    return;
                }
                
                if (!data.results[1] || !data.results[1].result || !data.results[1].result.response) {
                    console.error('Raid Nodes: Invalid teamGetAll response');
                    endRaidNodes('InvalidResponse', 'Invalid teamGetAll response');
                    return;
                }
                
                if (!data.results[2] || !data.results[2].result || !data.results[2].result.response) {
                    console.error('Raid Nodes: Invalid teamGetFavor response');
                    endRaidNodes('InvalidResponse', 'Invalid teamGetFavor response');
                    return;
                }
                
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
                
                // Validate teamGetAll structure
                if (!teamGetAll || !teamGetAll.clanRaid_nodes || !Array.isArray(teamGetAll.clanRaid_nodes)) {
                    console.error('Raid Nodes: Invalid teamGetAll structure - missing clanRaid_nodes');
                    endRaidNodes('InvalidTeamData', 'Invalid teamGetAll structure');
                    return;
                }
                
                for (let team of teamGetAll.clanRaid_nodes) {
                    if (!Array.isArray(team)) {
                        console.warn('Raid Nodes: Skipping invalid team (not an array):', team);
                        continue;
                    }
                    
                    if (team.length < 6) {
                        isNotFullPack = true;
                    }
                    
                    const heroes = team.filter(id => id < 6000);
                    const pets = team.filter(id => id >= 6000);
                    const pet = pets.length > 0 ? pets.pop() : null;
                    
                    if (heroes.length < 5) {
                        console.warn(`Raid Nodes: Team ${index} has less than 5 heroes (${heroes.length}), skipping`);
                        index++;
                        continue;
                    }
                    
                    if (!pet) {
                        console.warn(`Raid Nodes: Team ${index} has no pet, using default`);
                    }
                    
                    raidData.teams.push({
                        data: {},
                        heroes: heroes,
                        pet: pet || CONSTANTS.DEFAULT_PET_ID,
                        battleIndex: index++
                    });
                }
                
                if (raidData.teams.length === 0) {
                    console.error('Raid Nodes: No valid teams found');
                    endRaidNodes('NoTeams', 'No valid teams found');
                    return;
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
                if (!raidData.nodes || typeof raidData.nodes !== 'object') {
                    return null;
                }
                
                for (let nodeId in raidData.nodes) {
                    let node = raidData.nodes[nodeId];
                    if (!node || typeof node !== 'object') {
                        continue;
                    }
                    
                    // Validate node structure
                    if (!node.teams || !Array.isArray(node.teams)) {
                        continue;
                    }
                    
                    if (!node.timestamps || typeof node.timestamps !== 'object') {
                        continue;
                    }
                    
                    let points = 0;
                    for (let team of node.teams) {
                        if (team && typeof team === 'object' && typeof team.points === 'number') {
                            points += team.points;
                        }
                    }
                    
                    let now = Date.now() / 1000;
                    if (!points && 
                        typeof node.timestamps.start === 'number' && 
                        typeof node.timestamps.end === 'number' &&
                        now > node.timestamps.start && 
                        now < node.timestamps.end) {
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
                    context: { actionTs: Utils.getActionTs() },
                    ident: "body"
                }];

                SendRequest(JSON.stringify({calls}), resultNodeBattles);
            }

            function resultNodeBattles(e) {
                if (e['error']) {
                    endRaidNodes('nodeBattlesError', e['error']);
                    return;
                }

                // Validate response structure
                if (!e.results || !Array.isArray(e.results) || e.results.length === 0) {
                    console.error('Raid Nodes: Invalid resultNodeBattles response - missing results');
                    endRaidNodes('InvalidResponse', 'Missing results in node battles response');
                    return;
                }
                
                if (!e.results[0] || !e.results[0].result || !e.results[0].result.response) {
                    console.error('Raid Nodes: Invalid resultNodeBattles response structure');
                    endRaidNodes('InvalidResponse', 'Invalid node battles response structure');
                    return;
                }
                
                const response = e.results[0].result.response;
                if (!response.battles || !Array.isArray(response.battles) || response.battles.length === 0) {
                    console.error('Raid Nodes: No battles in response');
                    endRaidNodes('NoBattles', 'No battles found in response');
                    return;
                }

                console.log('Raid Nodes: Processing', response.battles.length, 'battles');
                let battles = response.battles;
                let promises = [];
                let battleIndex = 0;
                for (let battle of battles) {
                    battle.battleIndex = battleIndex++;
                    promises.push(calcBattleResult(battle));
                }

                Promise.all(promises)
                    .then(results => {
                        if (!results || results.length === 0) {
                            console.error('Raid Nodes: No battle results calculated');
                            endRaidNodes('NoResults', 'No battle results calculated');
                            return;
                        }
                        
                        const endResults = {};
                        let isAllWin = true;
                        for (let r of results) {
                            if (!r || !r.result) {
                                console.warn('Raid Nodes: Invalid battle result:', r);
                                isAllWin = false;
                                continue;
                            }
                            isAllWin &&= r.result.win;
                        }
                        if (!isAllWin) {
                            if (results[0]) {
                                cancelEndNodeBattle(results[0]);
                            } else {
                                console.error('Raid Nodes: Cannot cancel battle - no results');
                                endRaidNodes('CancelError', 'Cannot cancel battle - no results');
                            }
                            return;
                        }
                        raidData.countExecuteBattles = results.length;
                        let timeout = 500;
                        for (let r of results) {
                            setTimeout(endNodeBattle, timeout, r);
                            timeout += 500;
                        }
                    })
                    .catch(error => {
                        console.error('Raid Nodes: Error calculating battle results:', error);
                        endRaidNodes('CalculationError', error);
                    });
            }

            function calcBattleResult(battleData) {
                return new Promise(function (resolve, reject) {
                    if (!battleData) {
                        reject(new Error('No battle data provided'));
                        return;
                    }
                    
                    try {
                        BattleCalc(battleData, "get_clanPvp", (result) => {
                            if (!result || !result.result) {
                                console.error('Raid Nodes: BattleCalc returned invalid result:', result);
                                reject(new Error('Invalid battle calculation result'));
                                return;
                            }
                            resolve(result);
                        });
                    } catch (error) {
                        console.error('Raid Nodes: Error in BattleCalc:', error);
                        reject(error);
                    }
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
                // Validate battle result structure
                if (!r) {
                    console.error('Raid Nodes: No battle result provided to endNodeBattle');
                    return;
                }
                
                if (!r.battleData || !r.battleData.result) {
                    console.error('Raid Nodes: Invalid battle data structure:', r);
                    return;
                }
                
                if (!r.result) {
                    console.error('Raid Nodes: Missing result in battle data');
                    return;
                }
                
                if (!r.progress || !Array.isArray(r.progress)) {
                    console.error('Raid Nodes: Missing or invalid progress array');
                    return;
                }
                
                let nodeId = r.battleData.result.nodeId;
                let battleIndex = r.battleData.battleIndex;
                
                if (!nodeId) {
                    console.error('Raid Nodes: Missing nodeId in battle result');
                    return;
                }
                
                if (battleIndex === undefined || battleIndex === null) {
                    console.error('Raid Nodes: Missing battleIndex in battle result');
                    return;
                }
                
                let calls = [{
                    name: "clanRaid_endNodeBattle",
                    args: {
                        nodeId,
                        battleIndex,
                        result: r.result,
                        progress: r.progress
                    },
                    context: { actionTs: Utils.getActionTs() },
                    ident: "body"
                }];

                SendRequest(JSON.stringify({calls}), battleResult);
            }

            function battleResult(e) {
                if (e['error']) {
                    endRaidNodes('missionEndError', e['error']);
                    return;
                }
                
                // Validate response structure
                if (!e.results || !Array.isArray(e.results) || e.results.length === 0) {
                    console.error('Raid Nodes: Invalid battleResult response - missing results');
                    endRaidNodes('InvalidResponse', 'Missing results in battle result response');
                    return;
                }
                
                if (!e.results[0] || !e.results[0].result || !e.results[0].result.response) {
                    console.error('Raid Nodes: Invalid battleResult response structure');
                    endRaidNodes('InvalidResponse', 'Invalid battle result response structure');
                    return;
                }
                
                let r = e.results[0].result.response;
                if (r['error']) {
                    if (r.reason == "invalidBattle") {
                        raidData.cancelBattle++;
                        checkNodes();
                    } else {
                        endRaidNodes('missionEndError', r['error'] || e['error']);
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
                    context: { actionTs: Utils.getActionTs() },
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
                            await new Promise(resolve => setTimeout(resolve, CONSTANTS.DELAY_BETWEEN_BATTLES));
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
                    context: { actionTs: Utils.getActionTs() },
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
                    context: { actionTs: Utils.getActionTs() },
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

        // ========== EXECUTE CROSS CLAN WAR CLASS ==========
        function executeCrossClanWar(resolve, reject) {
            this.resolve = resolve;
            this.reject = reject;
            this.currentUserId = null;
            this.attackMapData = null;
            this.teamInfo = null;
            this.victories = 0;
            this.attacksCompleted = 0;

            this.start = async function() {
                setProgress('Cross Clan War: Initializing...');
                try {
                    await this.getCurrentUserId();
                    if (!this.currentUserId) {
                        this.end('Could not get current user ID');
                        return;
                    }

                    await this.getAttackMap();
                    await this.getTeamData();
                    await this.attackAssignedTargets();
                } catch (error) {
                    console.error('Cross Clan War error:', error);
                    this.end(`Error: ${error.message}`);
                }
            }

            this.getCurrentUserId = async function() {
                try {
                    const calls = [{
                        name: "userGetInfo",
                        args: {},
                        context: { actionTs: Utils.getActionTs() },
                        ident: "body"
                    }];

                    const response = await Send(JSON.stringify({calls}));
                    
                    if (response.error) {
                        throw new Error(`User info API error: ${response.error.name} - ${response.error.description}`);
                    }
                    
                    if (!response.results || !response.results[0] || !response.results[0].result || !response.results[0].result.response) {
                        throw new Error('Invalid userGetInfo response');
                    }

                    const userInfo = response.results[0].result.response;
                    this.currentUserId = userInfo.id ? parseInt(userInfo.id, 10) : null;
                    
                    if (!this.currentUserId) {
                        throw new Error('User ID not found in response');
                    }

                    console.log(`Cross Clan War: Current user ID: ${this.currentUserId}`);
                    return this.currentUserId;
                } catch (error) {
                    console.error('Error getting current user ID:', error);
                    throw error;
                }
            }

            this.getAttackMap = async function() {
                console.log('Getting Cross Clan War attack map...');
                
                const calls = [{
                    name: "crossClanWar_getAttackMap",
                    args: {},
                    context: { actionTs: Utils.getActionTs() },
                    ident: "body"
                }];

                const response = await Send(JSON.stringify({calls}));
                
                if (response.error) {
                    throw new Error(`Attack map API error: ${response.error.name} - ${response.error.description}`);
                }
                
                if (!response.results || !response.results[0] || !response.results[0].result || !response.results[0].result.response) {
                    throw new Error('Invalid crossClanWar_getAttackMap response');
                }

                this.attackMapData = response.results[0].result.response;
                console.log('Cross Clan War attack map loaded');
            }

            this.getTeamData = async function() {
                console.log('Getting team data...');
                
                const calls = [
                    {
                        name: "teamGetAll",
                        args: {},
                        context: { actionTs: Utils.getActionTs() },
                        ident: "teamGetAll"
                    },
                    {
                        name: "teamGetFavor",
                        args: {},
                        context: { actionTs: Utils.getActionTs() },
                        ident: "teamGetFavor"
                    }
                ];

                const response = await Send(JSON.stringify({calls}));
                
                if (response.error) {
                    throw new Error(`Team data API error: ${response.error.name} - ${response.error.description}`);
                }
                
                if (!response.results[0] || !response.results[0].result || !response.results[0].result.response) {
                    throw new Error('Invalid teamGetAll response');
                }
                if (!response.results[1] || !response.results[1].result || !response.results[1].result.response) {
                    throw new Error('Invalid teamGetFavor response');
                }

                this.teamInfo = {
                    teams: response.results[0].result.response,
                    favor: response.results[1].result.response
                };

                console.log('Team data loaded');
            }

            this.attackAssignedTargets = async function() {
                if (!this.attackMapData || !this.attackMapData.targets) {
                    this.end('No targets available');
                    return;
                }

                const targets = this.attackMapData.targets;
                const enemySlots = this.attackMapData.enemySlots || {};

                // Filter targets assigned to current user with state === 0
                const myTargets = [];
                Object.entries(targets).forEach(([slotId, target]) => {
                    if (target.userId === this.currentUserId && target.state === 0) {
                        myTargets.push({ slotId, target });
                    }
                });

                if (myTargets.length === 0) {
                    this.end('No targets assigned to you or all targets already completed');
                    return;
                }

                console.log(`Cross Clan War: Found ${myTargets.length} targets assigned to you`);
                setProgress(`Cross Clan War: Attacking ${myTargets.length} targets...`);

                let skippedCount = 0; // Track skipped slots separately

                // Process all targets - ensure loop always continues even on errors
                for (let i = 0; i < myTargets.length; i++) {
                    const { slotId, target } = myTargets[i];
                    const enemySlot = enemySlots[slotId];
                    let attackSuccess = false;
                    let attackError = null;

                    try {
                        console.log(`Cross Clan War: ===== Starting attack ${i + 1}/${myTargets.length} - Slot ${slotId} =====`);
                        setProgress(`Cross Clan War: Slot ${slotId} (${i + 1}/${myTargets.length})`);
                        
                        // Attempt the attack
                        await this.attackSlot(slotId, target, enemySlot);
                        attackSuccess = true;
                        this.attacksCompleted++;
                        this.victories++;
                        console.log(`Cross Clan War: ✓ Successfully completed attack ${i + 1}/${myTargets.length} - Slot ${slotId}`);
                        
                    } catch (error) {
                        attackError = error;
                        attackSuccess = false;
                        
                        // Determine if this is a skip (dead units, not available) vs actual failure
                        const errorMsg = error.message || String(error);
                        const isSkip = errorMsg.includes('dead units') || 
                                      errorMsg.includes('not available') ||
                                      errorMsg.includes('skipping');
                        
                        if (isSkip) {
                            // Don't count skips as attempts - these are intentional skips
                            skippedCount++;
                            console.warn(`Cross Clan War: ⚠ Skipping slot ${slotId} (${i + 1}/${myTargets.length}): ${errorMsg}`);
                        } else {
                            // Count actual failures as attempts
                            this.attacksCompleted++;
                            console.error(`Cross Clan War: ✗ Error attacking slot ${slotId} (${i + 1}/${myTargets.length}):`, error);
                            console.error(`Cross Clan War: Error message: ${errorMsg}`);
                            if (error.stack) {
                                console.error(`Cross Clan War: Error stack:`, error.stack);
                            }
                        }
                    }

                    // Always continue to next target, regardless of success or failure
                    if (i < myTargets.length - 1) {
                        if (attackSuccess) {
                            console.log(`Cross Clan War: Attack ${i + 1} completed, proceeding to next target...`);
                        } else {
                            console.log(`Cross Clan War: Attack ${i + 1} failed, but continuing to next target...`);
                        }
                        // Add delay before next attack
                        await new Promise(resolve => setTimeout(resolve, CONSTANTS.DELAY_BETWEEN_BATTLES));
                    } else {
                        // Last target
                        if (attackSuccess) {
                            console.log(`Cross Clan War: Final attack completed`);
                        } else {
                            console.log(`Cross Clan War: Final attack failed`);
                        }
                    }
                }

                console.log(`Cross Clan War: ===== All attacks completed =====`);
                console.log(`Cross Clan War: Total attempts: ${this.attacksCompleted}, Victories: ${this.victories}, Skipped: ${skippedCount}`);
                let summary = `Completed ${this.victories}/${this.attacksCompleted} attacks`;
                if (skippedCount > 0) {
                    summary += ` (${skippedCount} skipped)`;
                }
                this.end(summary);
            }

            this.attackSlot = async function(slotId, target, enemySlot) {
                let battleData = null;
                let battleResult = null;
                
                try {
                    console.log(`Cross Clan War: [attackSlot] Starting attack on slot ${slotId}`);
                    console.log(`Cross Clan War: [attackSlot] Target data:`, target);
                    
                    // Verify slot is available
                    if (enemySlot) {
                        if (enemySlot.status !== "ready" || enemySlot.attackerId !== null) {
                            throw new Error(`Slot ${slotId} is not available for attack (status: ${enemySlot.status}, attackerId: ${enemySlot.attackerId})`);
                        }

                        // Check if any units are clearly dead (more lenient check)
                        // Only skip if we can definitively see dead units
                        const team = enemySlot.team || {};
                        const teamValues = Object.values(team);
                        
                        if (teamValues.length > 0) {
                            // Check if any unit is explicitly marked as dead
                            const hasDeadUnits = teamValues.some(unit => {
                                // Only consider dead if state exists and explicitly says isDead === true
                                return unit && unit.state && unit.state.isDead === true;
                            });

                            if (hasDeadUnits) {
                                console.warn(`Cross Clan War: [attackSlot] Slot ${slotId} has dead units, skipping...`);
                                throw new Error(`Slot ${slotId} has dead units - skipping`);
                            }
                        }
                    }

                    // Determine battle type
                    let battleType = null;
                    if (enemySlot && enemySlot.team) {
                        const team = enemySlot.team;
                        for (const unit of Object.values(team)) {
                            if (unit.type === "hero") {
                                battleType = "hero";
                                break;
                            } else if (unit.type === "titan") {
                                battleType = "titan";
                                break;
                            }
                        }
                    }

                    // Fallback: use slot ID to guess (lower IDs are usually hero battles)
                    if (!battleType) {
                        const slotNum = parseInt(slotId);
                        battleType = slotNum <= 16 ? "hero" : "titan";
                        console.warn(`Cross Clan War: [attackSlot] Could not determine battle type from enemySlot, using slot ID heuristic: ${battleType}`);
                    }

                    console.log(`Cross Clan War: [attackSlot] Battle type: ${battleType}, teamIndex: ${target.teamIndex}`);

                    // Get team configuration
                    let teamConfig;
                    try {
                        teamConfig = this.getTeamConfiguration(target.teamIndex, battleType);
                        console.log(`Cross Clan War: [attackSlot] Team config obtained:`, {
                            type: teamConfig.type,
                            heroes: teamConfig.heroes || teamConfig.titans,
                            pet: teamConfig.pet,
                            favorKeys: teamConfig.favor ? Object.keys(teamConfig.favor).length : 0
                        });
                    } catch (error) {
                        console.error(`Cross Clan War: [attackSlot] Error getting team configuration:`, error);
                        throw new Error(`Failed to get team configuration: ${error.message}`);
                    }
                    
                    // Start battle
                    try {
                        console.log(`Cross Clan War: [attackSlot] Starting battle...`);
                        battleData = await this.startBattle(parseInt(slotId), teamConfig, battleType);
                        console.log(`Cross Clan War: [attackSlot] Battle started successfully`);
                    } catch (error) {
                        console.error(`Cross Clan War: [attackSlot] Error starting battle:`, error);
                        throw new Error(`Failed to start battle: ${error.message}`);
                    }
                    
                    // Calculate battle result
                    try {
                        console.log(`Cross Clan War: [attackSlot] Calculating battle result...`);
                        battleResult = await this.calculateBattleResult(battleData, battleType);
                        console.log(`Cross Clan War: [attackSlot] Battle result: ${battleResult.win ? 'Victory' : 'Defeat'}`);
                    } catch (error) {
                        console.error(`Cross Clan War: [attackSlot] Error calculating battle result:`, error);
                        // If battle was started but calculation failed, we should still try to end it
                        // But for now, just throw the error and let the caller handle it
                        throw new Error(`Failed to calculate battle result: ${error.message}`);
                    }
                    
                    // End battle
                    try {
                        console.log(`Cross Clan War: [attackSlot] Ending battle...`);
                        await this.endBattle(parseInt(slotId), battleResult);
                        console.log(`Cross Clan War: [attackSlot] Battle ended successfully`);
                    } catch (error) {
                        console.error(`Cross Clan War: [attackSlot] Error ending battle:`, error);
                        // Even if ending fails, the battle was attempted, so we consider it an error but continue
                        throw new Error(`Failed to end battle: ${error.message}`);
                    }

                    console.log(`Cross Clan War: [attackSlot] ✓ Slot ${slotId} attack completed: ${battleResult.win ? 'Victory' : 'Defeat'}`);
                } catch (error) {
                    console.error(`Cross Clan War: [attackSlot] ✗ Error in attackSlot for slot ${slotId}:`, error);
                    if (error.stack) {
                        console.error(`Cross Clan War: [attackSlot] Error stack:`, error.stack);
                    }
                    // Always re-throw to ensure calling function knows about the failure
                    throw error;
                }
            }

            this.getTeamConfiguration = function(teamIndex, battleType) {
                if (!this.teamInfo || !this.teamInfo.teams) {
                    throw new Error('Team info not available');
                }

                const teamData = this.teamInfo.teams;
                const favorData = this.teamInfo.favor;

                if (battleType === "hero") {
                    const crossClanDefenceHeroes = teamData.crossClanDefence_heroes || [];
                    
                    if (teamIndex < 0 || teamIndex >= crossClanDefenceHeroes.length) {
                        throw new Error(`Invalid teamIndex ${teamIndex} for crossClanDefence_heroes`);
                    }

                    const team = crossClanDefenceHeroes[teamIndex];
                    if (!team || team.length < 6) {
                        throw new Error(`Invalid team configuration at index ${teamIndex}`);
                    }

                    const heroes = team.slice(0, 5);
                    const pet = team[5];

                    // Get favor for this team
                    // Favor structure: favorData.crossClanDefence_heroes is a flat object
                    // where keys are hero IDs (as numbers or strings) and values are pet IDs
                    // Example: {1: 6006, 9: 6007, 13: 6002, 16: 6004, ...}
                    const crossClanDefenceFavor = favorData.crossClanDefence_heroes || {};
                    let favor = {};
                    
                    console.log(`Cross Clan War: Getting favor for teamIndex ${teamIndex}`);
                    console.log(`Cross Clan War: crossClanDefenceFavor structure:`, crossClanDefenceFavor);
                    console.log(`Cross Clan War: Team heroes:`, heroes);
                    
                    // Build favor object by looking up each hero in the flat favor structure
                    if (crossClanDefenceFavor && typeof crossClanDefenceFavor === 'object' && !Array.isArray(crossClanDefenceFavor)) {
                        // Check if it's a nested structure (team index -> favor object) or flat (hero ID -> pet ID)
                        // If the first hero ID exists as a key, it's a flat structure
                        const firstHeroId = heroes[0];
                        const isFlatStructure = firstHeroId !== undefined && 
                                               (crossClanDefenceFavor[firstHeroId] !== undefined || 
                                                crossClanDefenceFavor[String(firstHeroId)] !== undefined);
                        
                        if (isFlatStructure) {
                            // Flat structure: hero ID -> pet ID
                            heroes.forEach(heroId => {
                                // Try both number and string key
                                const petId = crossClanDefenceFavor[heroId] || crossClanDefenceFavor[String(heroId)];
                                if (petId !== undefined && typeof petId === 'number') {
                                    // Favor object uses hero IDs as string keys
                                    favor[String(heroId)] = petId;
                                }
                            });
                            console.log(`Cross Clan War: Built favor from flat structure:`, favor);
                        } else {
                            // Nested structure: team index -> favor object
                            // Try numeric index first
                            if (crossClanDefenceFavor[teamIndex] !== undefined) {
                                const favorValue = crossClanDefenceFavor[teamIndex];
                                if (favorValue && typeof favorValue === 'object' && !Array.isArray(favorValue)) {
                                    favor = favorValue;
                                    console.log(`Cross Clan War: Got favor from nested structure at index ${teamIndex}:`, favor);
                                } else {
                                    console.warn(`Cross Clan War: Favor at index ${teamIndex} is not an object (got ${typeof favorValue}: ${favorValue}), building from flat structure`);
                                    // Fallback: try to build from flat structure
                                    heroes.forEach(heroId => {
                                        const petId = crossClanDefenceFavor[heroId] || crossClanDefenceFavor[String(heroId)];
                                        if (petId !== undefined && typeof petId === 'number') {
                                            favor[String(heroId)] = petId;
                                        }
                                    });
                                }
                            } else {
                                // Try string key
                                const stringKey = String(teamIndex);
                                if (crossClanDefenceFavor[stringKey] !== undefined) {
                                    const favorValue = crossClanDefenceFavor[stringKey];
                                    if (favorValue && typeof favorValue === 'object' && !Array.isArray(favorValue)) {
                                        favor = favorValue;
                                        console.log(`Cross Clan War: Got favor from nested structure at string key "${stringKey}":`, favor);
                                    } else {
                                        console.warn(`Cross Clan War: Favor at string key "${stringKey}" is not an object, building from flat structure`);
                                        // Fallback: try to build from flat structure
                                        heroes.forEach(heroId => {
                                            const petId = crossClanDefenceFavor[heroId] || crossClanDefenceFavor[String(heroId)];
                                            if (petId !== undefined && typeof petId === 'number') {
                                                favor[String(heroId)] = petId;
                                            }
                                        });
                                    }
                                } else {
                                    console.log(`Cross Clan War: No favor found at index ${teamIndex}, building from flat structure`);
                                    // Build from flat structure as fallback
                                    heroes.forEach(heroId => {
                                        const petId = crossClanDefenceFavor[heroId] || crossClanDefenceFavor[String(heroId)];
                                        if (petId !== undefined && typeof petId === 'number') {
                                            favor[String(heroId)] = petId;
                                        }
                                    });
                                }
                            }
                        }
                    } else {
                        console.warn(`Cross Clan War: crossClanDefenceFavor is not a valid object, using empty favor`);
                    }
                    
                    // Validate favor is an object (hero IDs as string keys, pet IDs as values)
                    if (typeof favor !== 'object' || Array.isArray(favor)) {
                        console.warn(`Cross Clan War: Invalid favor structure after processing, using empty object. Got:`, favor, `(type: ${typeof favor})`);
                        favor = {};
                    }
                    
                    console.log(`Cross Clan War: Final favor object:`, favor);

                    // Get banner
                    let banner = 1;
                    try {
                        const userInfo = getUserInfo();
                        if (userInfo && userInfo.banner) {
                            banner = typeof userInfo.banner === 'number' ? userInfo.banner : 
                                     Array.isArray(userInfo.banner) ? userInfo.banner[0] : 1;
                        }
                    } catch (e) {
                        console.log('Could not get banner from userInfo, using default');
                    }

                    return {
                        type: 'hero',
                        heroes: heroes,
                        pet: pet,
                        favor: favor,
                        banner: banner
                    };
                } else {
                    const crossClanDefenceTitans = teamData.crossClanDefence_titans || [];
                    
                    if (teamIndex < 0 || teamIndex >= crossClanDefenceTitans.length) {
                        throw new Error(`Invalid teamIndex ${teamIndex} for crossClanDefence_titans`);
                    }

                    const titans = crossClanDefenceTitans[teamIndex];
                    if (!titans || titans.length < 5) {
                        throw new Error(`Invalid titan team configuration at index ${teamIndex}`);
                    }

                    return {
                        type: 'titan',
                        titans: titans.slice(0, 5)
                    };
                }
            }

            this.startBattle = async function(slotId, teamConfig, battleType) {
                let args = {
                    slotId: slotId
                };

                if (battleType === "hero") {
                    args.team = {
                        units: teamConfig.heroes,
                        pet: teamConfig.pet
                    };
                    
                    // Ensure favor is always an object (hero IDs as string keys, pet IDs as values)
                    let favor = teamConfig.favor || {};
                    if (typeof favor !== 'object' || Array.isArray(favor)) {
                        console.warn(`Cross Clan War: Invalid favor type (${typeof favor}), using empty object. Value:`, favor);
                        favor = {};
                    }
                    args.favor = favor;
                    
                    args.banner = teamConfig.banner || 1;
                    
                    // Log the request for debugging
                    console.log(`Cross Clan War: Battle args for slot ${slotId}:`, {
                        slotId: args.slotId,
                        team: args.team,
                        favor: args.favor,
                        banner: args.banner,
                        favorType: typeof args.favor,
                        favorIsArray: Array.isArray(args.favor)
                    });
                } else {
                    // Titan battle
                    args.team = {
                        units: teamConfig.titans
                    };
                    // Include favor even for titan battles (should be empty object)
                    let favor = teamConfig.favor || {};
                    if (typeof favor !== 'object' || Array.isArray(favor)) {
                        console.warn(`Cross Clan War: Invalid favor type for titan battle (${typeof favor}), using empty object. Value:`, favor);
                        favor = {};
                    }
                    args.favor = favor;
                    
                    // Log the request for debugging
                    console.log(`Cross Clan War: Battle args for slot ${slotId} (titan):`, {
                        slotId: args.slotId,
                        team: args.team,
                        favor: args.favor,
                        favorType: typeof args.favor,
                        favorIsArray: Array.isArray(args.favor)
                    });
                }

                const calls = [{
                    name: "crossClanWar_startBattle",
                    args: args,
                    context: { actionTs: Utils.getActionTs() },
                    ident: "body"
                }];

                console.log(`Cross Clan War: Starting battle for slot ${slotId} (${battleType})`);
                const response = await Send(JSON.stringify({calls}));
                
                if (response.error) {
                    throw new Error(`Start battle failed: ${response.error.name} - ${response.error.description}`);
                }
                
                if (!response.results || !response.results[0] || !response.results[0].result) {
                    throw new Error('Invalid start battle response');
                }

                const battleData = response.results[0].result.response;
                if (!battleData || !battleData.battle) {
                    throw new Error('No battle data in response');
                }

                return battleData.battle;
            }

            this.calculateBattleResult = async function(battleData, battleType) {
                return new Promise((resolve, reject) => {
                    const battleTypeStr = battleType === "hero" ? "clan_global_pvp" : "clan_global_pvp_titan";
                    BattleCalc(battleData, getBattleType(battleTypeStr), (result) => {
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

            this.endBattle = async function(slotId, battleResult) {
                const calls = [{
                    name: "crossClanWar_endBattle",
                    args: {
                        slotId: slotId,
                        result: {
                            win: battleResult.win,
                            stars: battleResult.result.stars || 0
                        },
                        progress: battleResult.progress
                    },
                    context: { actionTs: Utils.getActionTs() },
                    ident: "body"
                }];

                const response = await Send(JSON.stringify({calls}));
                
                if (response.error) {
                    throw new Error(`End battle failed: ${response.error.name} - ${response.error.description}`);
                }
            }

            this.end = function(reason) {
                setProgress(`Cross Clan War: ${reason}`, true);
                console.log('Cross Clan War completed:', reason);
                this.resolve();
            }
        }

        // Store classes in HWHClasses for consistency
        HWHClasses.executeArena = executeArena;
        HWHClasses.executeGuildWar = executeGuildWar;
        HWHClasses.executeRaidNodes = executeRaidNodes;
        HWHClasses.executeRaidBoss = executeRaidBoss;
        HWHClasses.executeCrossClanWar = executeCrossClanWar;

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
                    titanArena: false,
                    crossClanWar: false
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
                    if (Utils.isTitanArenaDay()) {
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
                        Utils.log('log', '%cAutoBattle: Titan Arena (ToE) completed', 'color: lightgreen; font-weight: bold;');
                    } else {
                        Utils.log('log', `AutoBattle: Skipping Titan Arena (not Monday-Saturday, current day: ${Utils.getDayOfWeek()})`);
                        results.titanArena = false;
                    }
                } catch (error) {
                    console.error('AutoBattle: Titan Arena error:', error);
                }

                // 6. Auto Raid Boss (Saturday or Sunday only)
                try {
                    if (Utils.isRaidBossDay()) {
                        console.log('AutoBattle: Starting Raid Boss...');
                        HWHFuncs.setProgress('AutoBattle: Raid Boss attacks...');
                        await new Promise((resolve, reject) => {
                            const raidBoss = new executeRaidBoss(resolve, reject);
                            raidBoss.start();
                        });
                        results.raidBoss = true;
                        Utils.log('log', '%cAutoBattle: Raid Boss completed', 'color: lightgreen; font-weight: bold;');
                    } else {
                        Utils.log('log', `AutoBattle: Skipping Raid Boss (not Saturday/Sunday, current day: ${Utils.getDayOfWeek()})`);
                        results.raidBoss = false;
                    }
                } catch (error) {
                    console.error('AutoBattle: Raid Boss error:', error);
                }

                // 7. Auto Cross Clan War
                try {
                    console.log('AutoBattle: Starting Cross Clan War...');
                    HWHFuncs.setProgress('AutoBattle: Cross Clan War attacks...');
                    await new Promise((resolve, reject) => {
                        const crossClanWar = new executeCrossClanWar(resolve, reject);
                        crossClanWar.start();
                    });
                    results.crossClanWar = true;
                    Utils.log('log', '%cAutoBattle: Cross Clan War completed', 'color: lightgreen; font-weight: bold;');
                } catch (error) {
                    console.error('AutoBattle: Cross Clan War error:', error);
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
                    `Raid Boss: ${results.raidBoss ? '✓' : '✗'}`,
                    `Cross Clan War: ${results.crossClanWar ? '✓' : '✗'}`
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
                if (Utils.isTitanArenaDay()) {
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
                    const dayName = Utils.getDayName(Utils.getDayOfWeek());
                    HWHFuncs.setProgress(`Titan Arena: Only available Monday-Saturday (today is ${dayName})`, true);
                    Utils.log('log', `Titan Arena: Skipped - today is ${dayName}, only runs Monday-Saturday`);
                }
            } catch (error) {
                console.error('Titan Arena error:', error);
                HWHFuncs.setProgress(`Titan Arena error: ${error.message}`, true);
            }
        }

        async function runRaidBoss() {
            try {
                if (Utils.isRaidBossDay()) {
                    HWHFuncs.setProgress('AutoBattle: Running Raid Boss...');
                    await new Promise((resolve, reject) => {
                        const raidBoss = new executeRaidBoss(resolve, reject);
                        raidBoss.start();
                    });
                    HWHFuncs.setProgress('AutoBattle: Raid Boss complete!', true);
                } else {
                    const dayName = Utils.getDayName(Utils.getDayOfWeek());
                    HWHFuncs.setProgress(`Raid Boss: Only available on Saturday or Sunday (today is ${dayName})`, true);
                    Utils.log('log', `Raid Boss: Skipped - today is ${dayName}, only runs on Saturday/Sunday`);
                }
            } catch (error) {
                console.error('Raid Boss error:', error);
                HWHFuncs.setProgress(`Raid Boss error: ${error.message}`, true);
            }
        }

        async function runCrossClanWar() {
            try {
                HWHFuncs.setProgress('AutoBattle: Running Cross Clan War...');
                await new Promise((resolve, reject) => {
                    const crossClanWar = new executeCrossClanWar(resolve, reject);
                    crossClanWar.start();
                });
                HWHFuncs.setProgress('AutoBattle: Cross Clan War complete!', true);
            } catch (error) {
                console.error('Cross Clan War error:', error);
                HWHFuncs.setProgress(`Cross Clan War error: ${error.message}`, true);
            }
        }

        // Auto-execute on script load
        autoBattle().catch(error => {
            console.error('AutoBattle: Failed to auto-execute:', error);
        });

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

        // Popup menu for manual triggers
        async function openManualTriggersPopup() {
            const popupContent = document.createElement('div');
            popupContent.style.cssText = 'display: flex; flex-direction: column; height: 70vh; color: #fce1ac;';

            const contentContainer = document.createElement('div');
            contentContainer.style.cssText = 'flex-grow: 1; overflow-y: auto; padding: 10px;';

            const title = document.createElement('h2');
            title.textContent = 'Manual Battle Triggers';
            title.style.cssText = 'text-align: center; color: #fce1ac; margin-bottom: 20px; border-bottom: 2px solid #8b6914; padding-bottom: 10px;';
            contentContainer.appendChild(title);

            const buttonGrid = document.createElement('div');
            buttonGrid.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; padding: 10px;';

            const battleButtons = [
                { name: 'Arena', title: 'Run Arena battles only', onClick: runArena, color: '#4A90E2', icon: '⚔️' },
                { name: 'Grand Arena', title: 'Run Grand Arena battles only', onClick: runGrandArena, color: '#4A90E2', icon: '⚔️' },
                { name: 'Guild War', title: 'Run Guild War attacks only', onClick: runGuildWar, color: '#9B59B6', icon: '🛡️' },
                { name: 'Raid Nodes', title: 'Run Raid Nodes only', onClick: runRaidNodes, color: '#E67E22', icon: '⚡' },
                { name: getI18N('TITAN_ARENA'), title: `Run ${getI18N('TITAN_ARENA')} only (Monday-Saturday)`, onClick: runTitanArena, color: '#1ABC9C', icon: '🏛️' },
                { name: 'Raid Boss', title: 'Run Raid Boss attacks only (5 attacks)', onClick: runRaidBoss, color: '#E74C3C', icon: '👹' },
                { name: 'Cross Clan War', title: 'Run Cross Clan War attacks only', onClick: runCrossClanWar, color: '#F39C12', icon: '⚔️' }
            ];

            battleButtons.forEach(battle => {
                const button = document.createElement('button');
                button.style.cssText = `
                    padding: 15px;
                    background: linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%);
                    border: 2px solid ${battle.color};
                    border-radius: 8px;
                    color: #fce1ac;
                    cursor: pointer;
                    text-align: center;
                    transition: all 0.3s;
                    font-size: 14px;
                    font-weight: bold;
                `;
                button.innerHTML = `
                    <div style="font-size: 24px; margin-bottom: 5px;">${battle.icon}</div>
                    <div>${battle.name}</div>
                `;
                button.title = battle.title;
                
                button.addEventListener('mouseenter', () => {
                    button.style.background = `linear-gradient(135deg, ${battle.color}40 0%, ${battle.color}20 100%)`;
                    button.style.borderColor = battle.color;
                    button.style.transform = 'scale(1.05)';
                });
                button.addEventListener('mouseleave', () => {
                    button.style.background = 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)';
                    button.style.borderColor = battle.color;
                    button.style.transform = 'scale(1)';
                });
                button.addEventListener('click', async () => {
                    // Close popup first
                    const popupBody = document.querySelector('.PopUp_Container');
                    if (popupBody && popupBody.parentElement) {
                        const closeBtn = document.querySelector('.PopUp_buttons button');
                        if (closeBtn) closeBtn.click();
                    }
                    // Then execute battle
                    await battle.onClick();
                });

                buttonGrid.appendChild(button);
            });

            contentContainer.appendChild(buttonGrid);
            popupContent.appendChild(contentContainer);

            // Use confirm with proper async handling
            const popupPromise = HWHFuncs.popup.confirm('', [{ msg: 'Close', result: true, isClose: true }]);
            
            // Wait a tick for popup to initialize
            await new Promise(resolve => setTimeout(resolve, 0));
            
            const popupBody = document.querySelector('.PopUp_Container');
            if (popupBody) {
                popupBody.innerHTML = '';
                popupBody.appendChild(popupContent);
            }
            
            // Wait for popup to close before returning
            await popupPromise;
        }

        // Menu integration
        const { ScriptMenu } = HWHClasses;
        const scriptMenu = ScriptMenu.getInst();
        
        scriptMenu.addCombinedButton([
            { name: '⚔️ Auto Battle', title: 'Run all auto-battles (Arena, Grand Arena, Guild War, Raids, ToE, Boss, Cross Clan War)', onClick: autoBattle, color: 'green' },
            { name: '⚙️ Manual Triggers', title: 'Open manual battle triggers menu', onClick: openManualTriggersPopup, color: 'gray' }
        ]);

        console.log('AutoBattle: UI initialized and attached to HWH menu.');
    }
})();
