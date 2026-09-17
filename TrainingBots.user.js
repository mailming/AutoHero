// ==UserScript==
// @name         Training Bots HwH Ext
// @namespace    HeroWarsHelper.TrainingBots
// @version      1.0
// @description  Fetch all battle simulation data and export to JSON files grouped by battle type
// @author       AutoHero
// @match        https://www.hero-wars.com/*
// @match        https://apps-1701433570146040.apps.fbsbx.com/*
// @grant        none
// @run-at       document-end
// @downloadURL https://github.com/mailming/AutoHero/raw/refs/heads/develop/TrainingBots.user.js
// @updateURL https://github.com/mailming/AutoHero/raw/refs/heads/develop/TrainingBots.user.js
// ==/UserScript==

(function() {
    'use strict';

    // --- CONFIGURATION ---
    const EXTENSION_NAME = "Training Bots Extension";
    const EXTENSION_VERSION = "1.0";
    const EXTENSION_AUTHOR = "AutoHero";

    // --- INITIALIZATION ---
    function waitForHWH(callback) {
        const interval = setInterval(() => {
            if (window.HWHClasses && window.HWHClasses.ScriptMenu && window.HWHFuncs && window.Send) {
                const scriptMenu = window.HWHClasses.ScriptMenu.getInst();
                if (scriptMenu && scriptMenu.mainMenu) {
                    clearInterval(interval);
                    callback();
                }
            }
        }, 200);
    }

    function initializeExtension() {
        console.log(`${EXTENSION_NAME} v${EXTENSION_VERSION} is loading...`);
        
        const { HWHFuncs, HWHClasses } = window;
        HWHFuncs.addExtentionName(EXTENSION_NAME, EXTENSION_VERSION, EXTENSION_AUTHOR);

        // Add menu button
        const scriptMenu = HWHClasses.ScriptMenu.getInst();
        scriptMenu.addCombinedButton([
            {
                name: 'Training Bots',
                title: 'Fetch all battles and export to JSON files',
                onClick: fetchAndExportBattles,
                color: 'purple'
            }
        ]);

        console.log(`${EXTENSION_NAME} initialized successfully.`);
    }

    // --- BATTLE FETCHING ---
    function extractItemsFromResponse(response) {
        if (!response || !response.results || !Array.isArray(response.results)) return null;
        for (let i = 0; i < response.results.length; i++) {
            const result = response.results[i];
            if (result && result.result && result.result.response) {
                if (Array.isArray(result.result.response)) {
                    return result.result.response;
                }
                if (result.result.response.items && Array.isArray(result.result.response.items)) {
                    return result.result.response.items;
                }
            }
        }
        return null;
    }

    async function fetchAllBattles() {
        const { Send, HWHFuncs } = window;
        const allBattles = [];

        try {
            // Step 1: Get initial battles with empty args
            HWHFuncs.setProgress('Training Bots: Fetching initial battles...', true);
            const firstResponse = await Send({
                calls: [{
                    name: "demoBattles_getAll",
                    args: {},
                    context: { actionTs: Math.floor(performance.now()) },
                    ident: "body"
                }]
            });

            const firstBattles = extractItemsFromResponse(firstResponse) || [];
            console.log(`Training Bots: Found ${firstBattles.length} initial battles`);
            allBattles.push(...firstBattles);

            // Step 2: Extract battle IDs and fetch retry battles
            const battleIds = firstBattles.map(b => b.id).filter(id => id);
            console.log(`Training Bots: Fetching retry battles for ${battleIds.length} battle IDs...`);

            // Batch API calls (10 at a time to avoid overwhelming the server)
            const batchSize = 10;
            for (let i = 0; i < battleIds.length; i += batchSize) {
                const batch = battleIds.slice(i, i + batchSize);
                const calls = batch.map((battleId, idx) => ({
                    name: "demoBattles_getAll",
                    args: { parentId: battleId },
                    context: { actionTs: Math.floor(performance.now()) + idx },
                    ident: `retry_${i + idx}_body`
                }));

                try {
                    HWHFuncs.setProgress(`Training Bots: Fetching retry battles ${i + 1}-${Math.min(i + batchSize, battleIds.length)}/${battleIds.length}...`, true);
                    const retryResponse = await Send({ calls });
                    
                    // Extract items from all results in the batch
                    if (retryResponse && retryResponse.results) {
                        retryResponse.results.forEach((result) => {
                            const items = extractItemsFromResponse({ results: [result] }) || [];
                            if (items.length > 0) {
                                allBattles.push(...items);
                            }
                        });
                    }
                } catch (e) {
                    console.error(`Training Bots: Error fetching retry battles for batch ${i}-${i + batchSize}:`, e);
                }

                // Small delay between batches to avoid rate limiting
                if (i + batchSize < battleIds.length) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }

            console.log(`Training Bots: Total battles fetched: ${allBattles.length}`);
            return allBattles;
        } catch (e) {
            console.error('Training Bots: Error fetching battles:', e);
            throw e;
        }
    }

    // --- SIMPLIFY BATTLE DATA ---
    function simplifyBattle(battle) {
        const simplified = {
            id: battle.id,
            parentId: battle.parentId || 0,
            mechanic: battle.mechanic || 'unknown',
            win: battle.data?.win || false,
            attackMax: battle.data?.attackMax || false,
            defenceMax: battle.data?.defenceMax || false
        };

        // Extract attack units (titans or heroes, exclude pets)
        const attackUnits = [];
        if (battle.data?.attack?.units) {
            for (const unitId in battle.data.attack.units) {
                const unit = battle.data.attack.units[unitId];
                const unitIdNum = parseInt(unitId);
                // Exclude pets: either has type='pet' or ID is 6000+ (pet IDs are typically 6000+)
                if (unit && unit.type !== 'pet' && unitIdNum < 6000) {
                    attackUnits.push(unitIdNum);
                }
            }
        }
        simplified.attack = attackUnits;

        // Extract defense units (titans or heroes, exclude pets)
        const defenseUnits = [];
        if (battle.data?.defence?.units) {
            for (const unitId in battle.data.defence.units) {
                const unit = battle.data.defence.units[unitId];
                const unitIdNum = parseInt(unitId);
                // Exclude pets: either has type='pet' or ID is 6000+ (pet IDs are typically 6000+)
                if (unit && unit.type !== 'pet' && unitIdNum < 6000) {
                    defenseUnits.push(unitIdNum);
                }
            }
        }
        simplified.defense = defenseUnits;

        return simplified;
    }

    function simplifyBattles(battles) {
        return battles.map(battle => simplifyBattle(battle));
    }

    // --- GROUP PARENT AND CHILD BATTLES ---
    function groupParentChildBattles(simplifiedBattles) {
        // Separate parents (parentId = 0) and children (parentId != 0)
        const parents = [];
        const childrenByParent = {}; // Map parentId -> array of child battles
        
        for (const battle of simplifiedBattles) {
            if (battle.parentId === 0 || battle.parentId === '0') {
                // This is a parent battle
                parents.push(battle);
            } else {
                // This is a child battle
                const parentId = String(battle.parentId);
                if (!childrenByParent[parentId]) {
                    childrenByParent[parentId] = [];
                }
                childrenByParent[parentId].push(battle);
            }
        }
        
        // Group children with their parents
        const grouped = [];
        for (const parent of parents) {
            const parentId = String(parent.id);
            const children = childrenByParent[parentId] || [];
            
            // Count wins and losses (including parent)
            let wins = 0;
            let losses = 0;
            const childBattleIds = [];
            
            // Count parent
            if (parent.win) {
                wins++;
            } else {
                losses++;
            }
            
            // Count children
            for (const child of children) {
                childBattleIds.push(child.id);
                if (child.win) {
                    wins++;
                } else {
                    losses++;
                }
            }
            
            // Calculate win rate
            const total = wins + losses;
            const winRate = total > 0 ? ((wins / total) * 100).toFixed(2) : '0.00';
            const winRateNum = parseFloat(winRate);
            
            // Determine valid field based on conditions
            let valid = 0;
            // First check: if attackMax = false AND defenceMax = false, valid = 0
            if (!parent.attackMax && !parent.defenceMax) {
                valid = 0;
            }
            // Condition 1: attackMax = false AND defenceMax = true AND winRate > 70
            else if (!parent.attackMax && parent.defenceMax && winRateNum > 70) {
                valid = 1;
            }
            // Condition 2: attackMax = true AND defenceMax = true
            else if (parent.attackMax && parent.defenceMax) {
                valid = 1;
            }
            // Condition 3: attackMax = true AND defenceMax = false AND winRate < 30
            else if (parent.attackMax && !parent.defenceMax && winRateNum < 30) {
                valid = 1;
            }
            // All other cases: valid = 0 (already set)
            
            // Create grouped battle record
            const groupedBattle = {
                id: parent.id,
                parentId: parent.parentId,
                mechanic: parent.mechanic,
                win: parent.win,
                attackMax: parent.attackMax,
                defenceMax: parent.defenceMax,
                attack: parent.attack,
                defense: parent.defense,
                childBattles: childBattleIds,
                wins: wins,
                losses: losses,
                winRate: winRateNum,
                valid: valid
            };
            
            // Only add to output if valid = 1
            if (valid === 1) {
                grouped.push(groupedBattle);
            }
        }
        
        // Handle orphaned children (children whose parent is not in the list)
        // This shouldn't happen in normal cases, but handle it just in case
        for (const parentId in childrenByParent) {
            const parentExists = parents.some(p => String(p.id) === parentId);
            if (!parentExists) {
                console.warn(`Training Bots: Found orphaned children for parentId ${parentId}`);
            }
        }
        
        return grouped;
    }

    // --- GROUP BY BATTLE TYPE ---
    function isTitanBattle(mechanic) {
        if (!mechanic) return false;
        return mechanic.includes('titan') || 
               mechanic === 'clan_pvp_titan' || 
               mechanic === 'clan_global_pvp_titan';
    }

    function groupBattlesByType(battles) {
        const titanBattles = [];
        const nonTitanBattles = [];
        
        for (const battle of battles) {
            const mechanic = battle.mechanic || 'unknown';
            if (isTitanBattle(mechanic)) {
                titanBattles.push(battle);
            } else {
                nonTitanBattles.push(battle);
            }
        }

        return {
            titan: titanBattles,
            nonTitan: nonTitanBattles
        };
    }

    // --- EXPORT TO JSON FILES ---
    function downloadJSON(data, filename) {
        const dataStr = JSON.stringify(data, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    async function exportBattlesByType(groupedBattles) {
        const { HWHFuncs } = window;
        
        HWHFuncs.setProgress('Training Bots: Simplifying and grouping battles...', true);

        // Simplify and group parent-child battles
        let groupedTitan = [];
        let groupedNonTitan = [];
        
        if (groupedBattles.titan.length > 0) {
            const simplifiedTitan = simplifyBattles(groupedBattles.titan);
            groupedTitan = groupParentChildBattles(simplifiedTitan);
        }

        if (groupedBattles.nonTitan.length > 0) {
            const simplifiedNonTitan = simplifyBattles(groupedBattles.nonTitan);
            groupedNonTitan = groupParentChildBattles(simplifiedNonTitan);
        }

        HWHFuncs.setProgress('Training Bots: Exporting battles...', true);

        // Export grouped titan battles
        if (groupedTitan.length > 0) {
            downloadJSON(groupedTitan, 'training_bots_titan.json');
            console.log(`Training Bots: Exported ${groupedTitan.length} grouped titan battles to training_bots_titan.json`);
        }

        // Export grouped non-titan battles
        if (groupedNonTitan.length > 0) {
            downloadJSON(groupedNonTitan, 'training_bots_non_titan.json');
            console.log(`Training Bots: Exported ${groupedNonTitan.length} grouped non-titan battles to training_bots_non_titan.json`);
        }

        return (groupedTitan.length > 0 ? 1 : 0) + (groupedNonTitan.length > 0 ? 1 : 0);
    }

    // --- MAIN FUNCTION ---
    async function fetchAndExportBattles() {
        const { HWHFuncs } = window;
        
        try {
            HWHFuncs.setProgress('Training Bots: Starting battle fetch...', true);
            
            // Fetch all battles
            const allBattles = await fetchAllBattles();
            
            if (allBattles.length === 0) {
                HWHFuncs.setProgress('Training Bots: No battles found', true);
                return;
            }

            // Group by battle type
            HWHFuncs.setProgress('Training Bots: Grouping battles by type...', true);
            const groupedBattles = groupBattlesByType(allBattles);

            // Export to JSON files
            const fileCount = await exportBattlesByType(groupedBattles);

            // Summary
            const summary = `Titan: ${groupedBattles.titan.length}, Non-Titan: ${groupedBattles.nonTitan.length}`;
            
            HWHFuncs.setProgress(`Training Bots: Complete! Exported ${fileCount} file(s). ${summary}`, true);
            console.log(`Training Bots: Export complete. Summary: ${summary}`);
        } catch (e) {
            const errorMsg = `Training Bots: Error - ${e.message || String(e)}`;
            HWHFuncs.setProgress(errorMsg, true);
            console.error('Training Bots: Error in fetchAndExportBattles:', e);
        }
    }

    // Start initialization
    waitForHWH(initializeExtension);

})();

