// ==UserScript==
// @name         Battle Simulation Recorder HwH Ext
// @namespace    HeroWarsHelper.BattleSimulationRecorder
// @version      1.0
// @description  Records demo battle simulation results (heroes and titans) to JSON files with incremental updates
// @author       YourName
// @match        https://www.hero-wars.com/*
// @match        https://apps-1701433570146040.apps.fbsbx.com/*
// @grant        GM_download
// @run-at       document-end
// @downloadURL https://github.com/mailming/AutoHero/raw/refs/heads/develop/Battle%20Simulation%20Recorder%20HwH%20Ext.user.js
// @updateURL https://github.com/mailming/AutoHero/raw/refs/heads/develop/Battle%20Simulation%20Recorder%20HwH%20Ext.user.js
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
        console.log('Battle Simulation Recorder: HWH UI is ready, initializing extension...');

        const { HWHClasses, HWHFuncs, Send, cheats } = window;

        // Configuration
        const CONFIG = {
            githubBaseUrl: 'https://github.com/mailming/AutoHero/raw/develop/',
            heroResultsFile: 'hero_battle_results.json',
            titanResultsFile: 'titan_battle_results.json',
            autoExecuteDelay: 15000, // 15 seconds delay to ensure other extensions complete
            localStoragePrefix: 'battleSimRecorder_'
        };

        // Storage for battle data
        let heroData = {
            lastUpdated: 0,
            lastLoadTimestamp: 0,
            records: {}
        };

        let titanData = {
            lastUpdated: 0,
            lastLoadTimestamp: 0,
            records: {}
        };

        /**
         * Generate team key from sorted hero/titan IDs
         * @param {Array<number>} team - Array of hero/titan IDs
         * @returns {string} Sorted comma-separated key
         */
        function generateTeamKey(team) {
            if (!Array.isArray(team) || team.length === 0) {
                return '';
            }
            return [...team].sort((a, b) => a - b).join(',');
        }

        /**
         * Determine if battle is titan type based on mechanic
         * @param {string} mechanic - Battle mechanic type
         * @returns {boolean} True if titan battle
         */
        function isTitanBattle(mechanic) {
            if (!mechanic) return false;
            const titanMechanics = [
                'clan_pvp_titan',
                'titan_pvp',
                'titan_pvp_manual',
                'titan_clan_pvp',
                'clan_global_pvp_titan',
                'brawl_titan',
                'challenge_titan',
                'titan_mission',
                'titan_arena',
                'dungeon_titan',
                'titan_tower'
            ];
            return titanMechanics.includes(mechanic) || mechanic.includes('titan');
        }

        /**
         * Extract teams from battle record
         * @param {Object} battleRecord - Battle record from demoBattles_getAll
         * @returns {Object|null} {attackerTeam, defenderTeam, won, timestamp, isTitan} or null if invalid
         */
        function extractTeamsFromBattle(battleRecord) {
            try {
                if (!battleRecord) return null;

                // Get battle type/mechanic
                const mechanic = battleRecord.mechanic || battleRecord.type || '';
                const isTitan = isTitanBattle(mechanic);

                // Extract attacker team
                let attackerTeam = null;
                if (battleRecord.data && battleRecord.data.attack && battleRecord.data.attack.units) {
                    // From battle.data.attack.units
                    attackerTeam = battleRecord.data.attack.units;
                } else if (battleRecord.team && battleRecord.team.units) {
                    // From battle.team.units
                    attackerTeam = battleRecord.team.units;
                }

                // Extract defender team
                let defenderTeam = null;
                if (battleRecord.data && battleRecord.data.defence && battleRecord.data.defence.units) {
                    // From battle.data.defence.units
                    defenderTeam = battleRecord.data.defence.units;
                } else if (battleRecord.defenceTeam && battleRecord.defenceTeam.units) {
                    // From battle.defenceTeam.units
                    defenderTeam = battleRecord.defenceTeam.units;
                }

                // Validate teams
                if (!attackerTeam || !Array.isArray(attackerTeam) || attackerTeam.length !== 5) {
                    return null;
                }
                if (!defenderTeam || !Array.isArray(defenderTeam) || defenderTeam.length !== 5) {
                    return null;
                }

                // Get battle result
                const won = battleRecord.data ? (battleRecord.data.win === true) : false;
                
                // Get timestamp
                const timestamp = battleRecord.ctime || battleRecord.startTime || Date.now();

                return {
                    attackerTeam,
                    defenderTeam,
                    won,
                    timestamp,
                    isTitan
                };
            } catch (error) {
                console.error('Battle Simulation Recorder: Error extracting teams:', error);
                return null;
            }
        }

        /**
         * Record a single battle result
         * @param {Array<number>} attackerTeam - Attacker team (5 heroes/titans)
         * @param {Array<number>} defenderTeam - Defender team (5 heroes/titans)
         * @param {boolean} won - Whether attacker won
         * @param {boolean} isTitan - Whether this is a titan battle
         * @param {number} timestamp - Battle timestamp
         */
        function recordBattle(attackerTeam, defenderTeam, won, isTitan, timestamp) {
            const data = isTitan ? titanData : heroData;
            const defenderKey = generateTeamKey(defenderTeam);
            const attackerKey = generateTeamKey(attackerTeam);

            // Initialize defender record if needed
            if (!data.records[defenderKey]) {
                data.records[defenderKey] = {
                    defenderTeam: [...defenderTeam].sort((a, b) => a - b),
                    attackingTeams: []
                };
            }

            // Find or create attacker team entry
            let attackerEntry = data.records[defenderKey].attackingTeams.find(
                entry => generateTeamKey(entry.attackerTeam) === attackerKey
            );

            if (!attackerEntry) {
                attackerEntry = {
                    attackerTeam: [...attackerTeam].sort((a, b) => a - b),
                    wins: 0,
                    losses: 0,
                    winRate: 0,
                    lastUpdated: timestamp
                };
                data.records[defenderKey].attackingTeams.push(attackerEntry);
            }

            // Update stats
            if (won) {
                attackerEntry.wins += 1;
            } else {
                attackerEntry.losses += 1;
            }

            const totalBattles = attackerEntry.wins + attackerEntry.losses;
            attackerEntry.winRate = totalBattles > 0 ? attackerEntry.wins / totalBattles : 0;
            attackerEntry.lastUpdated = Math.max(attackerEntry.lastUpdated || 0, timestamp);

            // Update data timestamp
            data.lastUpdated = Math.max(data.lastUpdated || 0, timestamp);
        }

        /**
         * Aggregate battles by defender/attacker teams
         * @param {Array<Object>} battles - Array of extracted battle data
         * @returns {Object} {heroBattles: [], titanBattles: []}
         */
        function aggregateBattles(battles) {
            const heroBattles = [];
            const titanBattles = [];

            for (const battle of battles) {
                if (battle.isTitan) {
                    titanBattles.push(battle);
                } else {
                    heroBattles.push(battle);
                }
            }

            return { heroBattles, titanBattles };
        }

        /**
         * Process battle history array
         * @param {Array<Object>} battles - Array of battle records
         * @param {number} lastLoadTimestamp - Only process battles after this timestamp
         * @returns {Object} Processing statistics
         */
        function processBattleHistory(battles, lastLoadTimestamp) {
            if (!Array.isArray(battles)) {
                console.warn('Battle Simulation Recorder: Invalid battles array');
                return { processed: 0, skipped: 0, errors: 0 };
            }

            let processed = 0;
            let skipped = 0;
            let errors = 0;

            // Extract and filter battles
            const extractedBattles = [];
            for (const battle of battles) {
                try {
                    const extracted = extractTeamsFromBattle(battle);
                    if (!extracted) {
                        skipped++;
                        continue;
                    }

                    // Filter by timestamp
                    if (extracted.timestamp <= lastLoadTimestamp) {
                        skipped++;
                        continue;
                    }

                    extractedBattles.push(extracted);
                } catch (error) {
                    console.error('Battle Simulation Recorder: Error processing battle:', error);
                    errors++;
                }
            }

            // Aggregate by type
            const { heroBattles, titanBattles } = aggregateBattles(extractedBattles);

            // Record hero battles
            for (const battle of heroBattles) {
                recordBattle(
                    battle.attackerTeam,
                    battle.defenderTeam,
                    battle.won,
                    false,
                    battle.timestamp
                );
                processed++;
            }

            // Record titan battles
            for (const battle of titanBattles) {
                recordBattle(
                    battle.attackerTeam,
                    battle.defenderTeam,
                    battle.won,
                    true,
                    battle.timestamp
                );
                processed++;
            }

            return { processed, skipped, errors };
        }

        /**
         * Load existing files from GitHub
         * @returns {Promise<Object>} {heroData, titanData}
         */
        async function loadExistingFiles() {
            const defaultData = {
                lastUpdated: 0,
                lastLoadTimestamp: 0,
                records: {}
            };

            let loadedHeroData = { ...defaultData };
            let loadedTitanData = { ...defaultData };

            try {
                // Try to load hero results
                try {
                    const heroUrl = CONFIG.githubBaseUrl + CONFIG.heroResultsFile;
                    const heroResponse = await fetch(heroUrl);
                    if (heroResponse.ok) {
                        const heroJson = await heroResponse.json();
                        if (heroJson && typeof heroJson === 'object') {
                            loadedHeroData = {
                                lastUpdated: heroJson.lastUpdated || 0,
                                lastLoadTimestamp: heroJson.lastLoadTimestamp || 0,
                                records: heroJson.records || {}
                            };
                            console.log('Battle Simulation Recorder: Loaded hero data from GitHub');
                        }
                    }
                } catch (error) {
                    console.warn('Battle Simulation Recorder: Could not load hero data from GitHub:', error.message);
                }

                // Try to load titan results
                try {
                    const titanUrl = CONFIG.githubBaseUrl + CONFIG.titanResultsFile;
                    const titanResponse = await fetch(titanUrl);
                    if (titanResponse.ok) {
                        const titanJson = await titanResponse.json();
                        if (titanJson && typeof titanJson === 'object') {
                            loadedTitanData = {
                                lastUpdated: titanJson.lastUpdated || 0,
                                lastLoadTimestamp: titanJson.lastLoadTimestamp || 0,
                                records: titanJson.records || {}
                            };
                            console.log('Battle Simulation Recorder: Loaded titan data from GitHub');
                        }
                    }
                } catch (error) {
                    console.warn('Battle Simulation Recorder: Could not load titan data from GitHub:', error.message);
                }

                // Try to load from localStorage as backup
                try {
                    const storedHero = localStorage.getItem(CONFIG.localStoragePrefix + 'heroData');
                    const storedTitan = localStorage.getItem(CONFIG.localStoragePrefix + 'titanData');
                    
                    if (storedHero) {
                        const parsedHero = JSON.parse(storedHero);
                        if (parsedHero.lastLoadTimestamp > loadedHeroData.lastLoadTimestamp) {
                            loadedHeroData = parsedHero;
                            console.log('Battle Simulation Recorder: Loaded hero data from localStorage');
                        }
                    }
                    
                    if (storedTitan) {
                        const parsedTitan = JSON.parse(storedTitan);
                        if (parsedTitan.lastLoadTimestamp > loadedTitanData.lastLoadTimestamp) {
                            loadedTitanData = parsedTitan;
                            console.log('Battle Simulation Recorder: Loaded titan data from localStorage');
                        }
                    }
                } catch (error) {
                    console.warn('Battle Simulation Recorder: Could not load from localStorage:', error.message);
                }

            } catch (error) {
                console.error('Battle Simulation Recorder: Error loading existing files:', error);
            }

            return { heroData: loadedHeroData, titanData: loadedTitanData };
        }

        /**
         * Merge new battle data with existing data
         * @param {Object} existingData - Existing data structure
         * @param {Object} newData - New data to merge
         */
        function mergeBattleData(existingData, newData) {
            // Merge records
            for (const defenderKey in newData.records) {
                if (!existingData.records[defenderKey]) {
                    existingData.records[defenderKey] = { ...newData.records[defenderKey] };
                } else {
                    // Merge attacking teams
                    for (const newAttacker of newData.records[defenderKey].attackingTeams) {
                        const attackerKey = generateTeamKey(newAttacker.attackerTeam);
                        const existingAttacker = existingData.records[defenderKey].attackingTeams.find(
                            entry => generateTeamKey(entry.attackerTeam) === attackerKey
                        );

                        if (existingAttacker) {
                            // Merge wins/losses
                            existingAttacker.wins += newAttacker.wins;
                            existingAttacker.losses += newAttacker.losses;
                            const total = existingAttacker.wins + existingAttacker.losses;
                            existingAttacker.winRate = total > 0 ? existingAttacker.wins / total : 0;
                            existingAttacker.lastUpdated = Math.max(
                                existingAttacker.lastUpdated || 0,
                                newAttacker.lastUpdated || 0
                            );
                        } else {
                            existingData.records[defenderKey].attackingTeams.push({ ...newAttacker });
                        }
                    }
                }
            }

            // Update timestamps
            existingData.lastUpdated = Math.max(existingData.lastUpdated || 0, newData.lastUpdated || 0);
        }

        /**
         * Fetch all demo battles using demoBattles_getAll API
         * @returns {Promise<Array>} Array of battle records
         */
        async function fetchAllDemoBattles() {
            try {
                HWHFuncs.setProgress('Battle Simulation Recorder: Fetching demo battle history...');
                
                const request = {
                    calls: [{
                        name: 'demoBattles_getAll',
                        args: {},
                        context: { actionTs: Date.now() },
                        ident: 'body'
                    }]
                };

                const response = await Send(JSON.stringify(request));
                
                if (response.error) {
                    throw new Error(`API error: ${response.error.name || 'Unknown'} - ${response.error.description || 'No description'}`);
                }

                if (!response.results || !Array.isArray(response.results) || response.results.length === 0) {
                    console.warn('Battle Simulation Recorder: No results in API response');
                    return [];
                }

                const result = response.results[0];
                if (!result || !result.result || !result.result.response) {
                    console.warn('Battle Simulation Recorder: Invalid response structure');
                    return [];
                }

                const battles = result.result.response;
                
                // Handle both array and object formats
                if (Array.isArray(battles)) {
                    return battles;
                } else if (typeof battles === 'object' && battles.battles) {
                    return Array.isArray(battles.battles) ? battles.battles : [];
                } else if (typeof battles === 'object') {
                    // If it's an object with battle IDs as keys
                    return Object.values(battles);
                }

                return [];
            } catch (error) {
                console.error('Battle Simulation Recorder: Error fetching demo battles:', error);
                throw error;
            }
        }

        /**
         * Save files using GM_download
         */
        async function saveFiles() {
            try {
                const currentTimestamp = Date.now();

                // Update lastLoadTimestamp
                heroData.lastLoadTimestamp = currentTimestamp;
                titanData.lastLoadTimestamp = currentTimestamp;

                // Save to localStorage as backup
                try {
                    localStorage.setItem(CONFIG.localStoragePrefix + 'heroData', JSON.stringify(heroData));
                    localStorage.setItem(CONFIG.localStoragePrefix + 'titanData', JSON.stringify(titanData));
                } catch (error) {
                    console.warn('Battle Simulation Recorder: Could not save to localStorage:', error);
                }

                // Download hero results
                const heroJson = JSON.stringify(heroData, null, 2);
                await new Promise((resolve, reject) => {
                    GM_download({
                        url: 'data:application/json;charset=utf-8,' + encodeURIComponent(heroJson),
                        name: CONFIG.heroResultsFile,
                        saveAs: false
                    }, (error) => {
                        if (error) {
                            console.error('Battle Simulation Recorder: Error downloading hero file:', error);
                            reject(error);
                        } else {
                            console.log('Battle Simulation Recorder: Hero results saved');
                            resolve();
                        }
                    });
                });

                // Download titan results
                const titanJson = JSON.stringify(titanData, null, 2);
                await new Promise((resolve, reject) => {
                    GM_download({
                        url: 'data:application/json;charset=utf-8,' + encodeURIComponent(titanJson),
                        name: CONFIG.titanResultsFile,
                        saveAs: false
                    }, (error) => {
                        if (error) {
                            console.error('Battle Simulation Recorder: Error downloading titan file:', error);
                            reject(error);
                        } else {
                            console.log('Battle Simulation Recorder: Titan results saved');
                            resolve();
                        }
                    });
                });

                HWHFuncs.setProgress('Battle Simulation Recorder: Files saved successfully!', true);
            } catch (error) {
                console.error('Battle Simulation Recorder: Error saving files:', error);
                HWHFuncs.setProgress(`Battle Simulation Recorder: Error saving files - ${error.message}`, true);
                throw error;
            }
        }

        /**
         * Main recording function
         */
        async function startRecording() {
            try {
                console.log('Battle Simulation Recorder: Starting recording...');
                HWHFuncs.setProgress('Battle Simulation Recorder: Starting...');

                // Load existing files
                HWHFuncs.setProgress('Battle Simulation Recorder: Loading existing data...');
                const { heroData: loadedHero, titanData: loadedTitan } = await loadExistingFiles();
                
                // Merge with existing data
                heroData = loadedHero;
                titanData = loadedTitan;

                const lastLoadTimestamp = Math.max(
                    heroData.lastLoadTimestamp || 0,
                    titanData.lastLoadTimestamp || 0
                );

                console.log(`Battle Simulation Recorder: Last load timestamp: ${lastLoadTimestamp}`);

                // Fetch all demo battles
                const battles = await fetchAllDemoBattles();
                console.log(`Battle Simulation Recorder: Fetched ${battles.length} battles`);

                if (battles.length === 0) {
                    HWHFuncs.setProgress('Battle Simulation Recorder: No battles found', true);
                    return;
                }

                // Process battles
                HWHFuncs.setProgress('Battle Simulation Recorder: Processing battles...');
                const stats = processBattleHistory(battles, lastLoadTimestamp);
                
                console.log(`Battle Simulation Recorder: Processed ${stats.processed} battles, skipped ${stats.skipped}, errors ${stats.errors}`);

                if (stats.processed === 0) {
                    HWHFuncs.setProgress('Battle Simulation Recorder: No new battles to process', true);
                    return;
                }

                // Save files
                HWHFuncs.setProgress('Battle Simulation Recorder: Saving files...');
                await saveFiles();

                const heroCount = Object.keys(heroData.records).length;
                const titanCount = Object.keys(titanData.records).length;
                HWHFuncs.setProgress(
                    `Battle Simulation Recorder: Complete! Processed ${stats.processed} battles. ` +
                    `Hero matchups: ${heroCount}, Titan matchups: ${titanCount}`,
                    true
                );

            } catch (error) {
                console.error('Battle Simulation Recorder: Error in recording:', error);
                HWHFuncs.setProgress(`Battle Simulation Recorder: Error - ${error.message}`, true);
            }
        }

        // Auto-execute after delay
        setTimeout(() => {
            startRecording().catch(error => {
                console.error('Battle Simulation Recorder: Auto-execution failed:', error);
            });
        }, CONFIG.autoExecuteDelay);

        // Menu integration
        const { ScriptMenu } = HWHClasses;
        const scriptMenu = ScriptMenu.getInst();
        
        scriptMenu.addCombinedButton([
            { 
                name: '📊 Record Battles', 
                title: 'Record demo battle simulation results to JSON files', 
                onClick: startRecording, 
                color: 'purple' 
            }
        ]);

        console.log('Battle Simulation Recorder: UI initialized and attached to HWH menu.');
    }
})();

