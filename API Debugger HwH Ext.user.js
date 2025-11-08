// ==UserScript==
// @name         API Debugger HwH Ext
// @namespace    HeroWarsHelper.APIDebugger
// @version      1.0
// @description  Debugging tool to test all Hero Wars API calls and capture results
// @author       AutoHero
// @match        https://www.hero-wars.com/*
// @match        https://apps-1701433570146040.apps.fbsbx.com/*
// @grant        none
// @run-at       document-end
// @downloadURL https://github.com/mailming/AutoHero/raw/refs/heads/develop/API%20Debugger%20HwH%20Ext.user.js
// @updateURL https://github.com/mailming/AutoHero/raw/refs/heads/develop/API%20Debugger%20HwH%20Ext.user.js
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
        console.log('API Debugger: HWH UI is ready, initializing extension...');
        
        const { HWHClasses, HWHFuncs, Send, cheats, Caller, lib } = window;
        
        // API definitions organized by category
        const apiDefinitions = {
            'Core User & Inventory': [
                { name: 'userGetInfo', args: {}, description: 'Get user information (stats, resources, arena status)' },
                { name: 'inventoryGet', args: {}, description: 'Get all inventory items (consumables, gear, fragments)' },
                { name: 'getTime', args: {}, description: 'Get server time' }
            ],
            'Heroes, Titans & Teams': [
                { name: 'heroGetAll', args: {}, description: 'Get all hero information' },
                { name: 'titanGetAll', args: {}, description: 'Get all titan information' },
                { name: 'teamGetAll', args: {}, description: 'Get all team configurations' },
                { name: 'teamGetFavor', args: {}, description: 'Get favor information for teams' },
                { name: 'teamGetMaxUpgrade', args: {}, description: 'Get maximum upgrade information for teams' }
            ],
            'Shops & Purchases': [
                { name: 'shopGetAll', args: {}, description: 'Get all shop information' },
                { name: 'shopGet', args: { shopId: 13 }, description: 'Get specific shop information (Titan Artifact Shop)' }
            ],
            'Quests & Missions': [
                { name: 'questGetAll', args: {}, description: 'Get all quest information' },
                { name: 'missionGetAll', args: {}, description: 'Get all mission information' }
            ],
            'Arena & PvP': [
                { name: 'arenaFindEnemies', args: {}, description: 'Find available opponents in regular arena' },
                { name: 'arenaCheckTargetRange', args: { ids: [] }, description: 'Check if target opponents are still in valid attack range' },
                { name: 'grandFindEnemies', args: {}, description: 'Find available opponents in Grand Arena' },
                { name: 'grandCheckTargetRange', args: { ids: [] }, description: 'Check if Grand Arena opponents are still available' },
                { name: 'titanArenaGetStatus', args: {}, description: 'Get titan arena status' }
            ],
            'Guild War & Clan': [
                { name: 'clanWarGetInfo', args: {}, description: 'Get Guild War information (slots, teams)' },
                { name: 'clanWarGetDefence', args: {}, description: 'Get Guild War defense information' },
                { name: 'clanGetInfo', args: {}, description: 'Get clan information' },
                { name: 'clanRaid_getInfo', args: {}, description: 'Get complete clan raid information' },
                { name: 'clanRaid_usersInBossBattle', args: {}, description: 'Get information about other clan members currently fighting the same boss' },
                { name: 'crossClanWar_getInfo', args: {}, description: 'Get Cross Clan War information' }
            ],
            'Dungeon & Tower': [
                { name: 'dungeonGetInfo', args: {}, description: 'Get dungeon information' },
                { name: 'towerGetInfo', args: {}, description: 'Get tower information' }
            ],
            'Adventure & Brawls': [
                { name: 'adventure_getInfo', args: {}, description: 'Get adventure information' },
                { name: 'adventureSolo_getInfo', args: {}, description: 'Get solo adventure information' },
                { name: 'brawl_questGetInfo', args: {}, description: 'Get brawl quest information' },
                { name: 'brawl_findEnemies', args: {}, description: 'Find enemies in brawls' },
                { name: 'brawl_getInfo', args: {}, description: 'Get brawl information' },
                { name: 'epicBrawl_getWinStreak', args: {}, description: 'Get epic brawl win streak information' }
            ],
            'Boss & Rankings': [
                { name: 'bossGetAll', args: {}, description: 'Get all Outland boss information' },
                { name: 'topGet', args: { type: 'bossRatingTop', extraId: 0 }, description: 'Get top rankings' }
            ],
            'Mail & Rewards': [
                { name: 'mailGetAll', args: {}, description: 'Get all mail/letters' }
            ],
            'Special Events & Offers': [
                { name: 'specialOffer_getAll', args: {}, description: 'Get all special offers' },
                { name: 'battlePass_getInfo', args: {}, description: 'Get battle pass information' },
                { name: 'battlePass_getSpecial', args: {}, description: 'Get special battle pass information' },
                { name: 'newYearGiftGet', args: { type: 0 }, description: 'Get new year gift information' },
                { name: 'expeditionGet', args: {}, description: 'Get expedition information' },
                { name: 'heroTalent_getReward', args: { talentType: 'tmntDungeonTalent', reroll: false }, description: 'Get hero talent reward information' }
            ]
        };

        // Storage for API results
        let apiResults = [];
        let resultCounter = 0;

        // Format timestamp
        function formatTimestamp() {
            const now = new Date();
            return now.toISOString().replace('T', ' ').substring(0, 19);
        }

        // Log API call and result
        async function logAPICall(apiName, args, response, error = null) {
            const timestamp = formatTimestamp();
            const resultId = ++resultCounter;
            
            const logEntry = {
                id: resultId,
                timestamp: timestamp,
                apiName: apiName,
                args: args,
                success: !error,
                error: error ? {
                    name: error.name,
                    message: error.message,
                    stack: error.stack
                } : null,
                response: response,
                responseSize: response ? JSON.stringify(response).length : 0
            };

            apiResults.push(logEntry);

            // Console logging with detailed formatting
            console.group(`%c[API Debugger] ${apiName} (ID: ${resultId})`, 'color: #4CAF50; font-weight: bold;');
            console.log('%cTimestamp:', 'color: #2196F3; font-weight: bold;', timestamp);
            console.log('%cArguments:', 'color: #FF9800; font-weight: bold;', args);
            
            if (error) {
                console.error('%cError:', 'color: #F44336; font-weight: bold;', error);
            } else {
                console.log('%cResponse:', 'color: #9C27B0; font-weight: bold;', response);
                console.log('%cResponse Size:', 'color: #607D8B;', `${logEntry.responseSize} bytes`);
            }
            
            console.groupEnd();

            return logEntry;
        }

        // Download results as JSON file
        function downloadResults() {
            if (apiResults.length === 0) {
                HWHFuncs.setProgress('API Debugger: No results to download', true);
                return;
            }

            const dataStr = JSON.stringify(apiResults, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `api_debug_results_${Date.now()}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            HWHFuncs.setProgress(`API Debugger: Downloaded ${apiResults.length} API results`, true);
            console.log(`API Debugger: Downloaded ${apiResults.length} API results`);
        }

        // Clear all results
        function clearResults() {
            apiResults = [];
            resultCounter = 0;
            HWHFuncs.setProgress('API Debugger: Results cleared', true);
            console.log('API Debugger: Results cleared');
        }

        // Execute API call
        async function executeAPICall(apiDef) {
            try {
                HWHFuncs.setProgress(`API Debugger: Calling ${apiDef.name}...`);
                
                const calls = [{
                    name: apiDef.name,
                    args: apiDef.args,
                    context: { actionTs: Date.now() },
                    ident: 'body'
                }];

                const startTime = performance.now();
                const response = await Send(JSON.stringify({ calls }));
                const endTime = performance.now();
                const duration = endTime - startTime;

                if (response.error) {
                    const error = new Error(`API error: ${response.error.name} - ${response.error.description}`);
                    await logAPICall(apiDef.name, apiDef.args, null, error);
                    HWHFuncs.setProgress(`API Debugger: ${apiDef.name} failed - ${error.message}`, true);
                    return;
                }

                const result = response.results && response.results[0] ? response.results[0].result.response : null;
                const logEntry = await logAPICall(apiDef.name, apiDef.args, result);
                logEntry.duration = `${duration.toFixed(2)}ms`;

                HWHFuncs.setProgress(`API Debugger: ${apiDef.name} completed (${duration.toFixed(0)}ms)`, true);
                console.log(`API Debugger: ${apiDef.name} completed in ${duration.toFixed(2)}ms`);

            } catch (error) {
                await logAPICall(apiDef.name, apiDef.args, null, error);
                HWHFuncs.setProgress(`API Debugger: ${apiDef.name} error - ${error.message}`, true);
                console.error(`API Debugger: ${apiDef.name} error:`, error);
            }
        }

        // Open API debugger popup
        async function openAPIDebugger() {
            const popupContent = document.createElement('div');
            popupContent.style.cssText = 'display: flex; flex-direction: column; height: 80vh; color: #fce1ac;';

            const header = document.createElement('div');
            header.style.cssText = 'padding: 15px; border-bottom: 2px solid #8b6914; background: rgba(0,0,0,0.3);';
            header.innerHTML = `
                <h2 style="margin: 0 0 10px 0; color: #ffd700;">API Debugger</h2>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <span style="color: #4CAF50;">Results: ${apiResults.length}</span>
                    <button id="downloadResults" style="padding: 5px 15px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">Download Results</button>
                    <button id="clearResults" style="padding: 5px 15px; background: #F44336; color: white; border: none; border-radius: 4px; cursor: pointer;">Clear Results</button>
                </div>
            `;
            popupContent.appendChild(header);

            const contentContainer = document.createElement('div');
            contentContainer.style.cssText = 'flex-grow: 1; overflow-y: auto; padding: 15px;';
            
            // Create category sections
            for (const [category, apis] of Object.entries(apiDefinitions)) {
                const categoryDiv = document.createElement('div');
                categoryDiv.style.cssText = 'margin-bottom: 25px;';
                
                const categoryHeader = document.createElement('h3');
                categoryHeader.style.cssText = 'color: #ffd700; margin: 0 0 10px 0; padding-bottom: 5px; border-bottom: 1px solid #8b6914;';
                categoryHeader.textContent = category;
                categoryDiv.appendChild(categoryHeader);

                const apiGrid = document.createElement('div');
                apiGrid.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 10px;';

                for (const api of apis) {
                    const apiButton = document.createElement('button');
                    apiButton.style.cssText = `
                        padding: 12px;
                        background: linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%);
                        border: 1px solid #8b6914;
                        border-radius: 6px;
                        color: #fce1ac;
                        cursor: pointer;
                        text-align: left;
                        transition: all 0.3s;
                    `;
                    apiButton.innerHTML = `
                        <div style="font-weight: bold; color: #4CAF50; margin-bottom: 5px;">${api.name}</div>
                        <div style="font-size: 0.85em; color: #aaa;">${api.description}</div>
                    `;
                    apiButton.addEventListener('mouseenter', () => {
                        apiButton.style.background = 'linear-gradient(135deg, #3a3a3a 0%, #2a2a2a 100%)';
                        apiButton.style.borderColor = '#ffd700';
                    });
                    apiButton.addEventListener('mouseleave', () => {
                        apiButton.style.background = 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)';
                        apiButton.style.borderColor = '#8b6914';
                    });
                    apiButton.addEventListener('click', () => {
                        executeAPICall(api);
                    });
                    apiGrid.appendChild(apiButton);
                }

                categoryDiv.appendChild(apiGrid);
                contentContainer.appendChild(categoryDiv);
            }

            popupContent.appendChild(contentContainer);

            // Use confirm with proper async handling
            const popupPromise = HWHFuncs.popup.confirm('', [{ msg: 'Close', result: true, isClose: true }]);
            
            // Wait a tick for popup to initialize
            await new Promise(resolve => setTimeout(resolve, 0));
            
            const popupBody = document.querySelector('.PopUp_Container');
            if (popupBody) {
                popupBody.innerHTML = '';
                popupBody.appendChild(popupContent);
                
                // Attach event listeners
                document.getElementById('downloadResults').addEventListener('click', downloadResults);
                document.getElementById('clearResults').addEventListener('click', () => {
                    clearResults();
                    header.querySelector('span').textContent = `Results: ${apiResults.length}`;
                });
            }
            
            // Wait for popup to close before returning
            await popupPromise;
        }

        // Add menu button
        const { ScriptMenu } = HWHClasses;
        const scriptMenu = ScriptMenu.getInst();
        scriptMenu.addCombinedButton([
            { name: '🔍 API Debugger', title: 'Open API Debugger - Test all API calls and capture results', onClick: openAPIDebugger, color: 'purple' }
        ]);

        console.log('API Debugger: Extension initialized successfully');
    }
})();

