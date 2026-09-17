// ==UserScript==
// @name         LLM Controller HwH Ext
// @namespace    HeroWarsHelper.LLMController
// @version      1.5
// @description  Provides an LLM-accessible API interface and localhost bridge for Cursor control
// @author       YourName
// @match        https://www.hero-wars.com/*
// @match        https://apps-1701433570146040.apps.fbsbx.com/*
// @grant        none
// @run-at       document-end
// @downloadURL https://github.com/mailming/AutoHero/raw/refs/heads/develop/LLM%20Controller%20HwH%20Ext.user.js
// @updateURL https://github.com/mailming/AutoHero/raw/refs/heads/develop/LLM%20Controller%20HwH%20Ext.user.js
// ==/UserScript==

(function() {
    'use strict';

    const EXTENSION_NAME = "LLM Controller Extension";
    const EXTENSION_VERSION = "1.5";
    const BRIDGE_URL = 'http://127.0.0.1:9876';
    const BRIDGE_POLL_MS = 500;
    const EXTENSION_AUTHOR = "YourName";

    // Wait for HWH to be ready
    const waitForHWH = setInterval(() => {
        if (window.HWHClasses && window.HWHClasses.ScriptMenu && window.lib && window.cheats && window.Send && window.HWHFuncs) {
            const scriptMenu = window.HWHClasses.ScriptMenu.getInst();
            if (scriptMenu && scriptMenu.mainMenu) {
                clearInterval(waitForHWH);
                initializeExtension();
            }
        }
    }, 200);

    function initializeExtension() {
        console.log(`${EXTENSION_NAME} v${EXTENSION_VERSION} is loading...`);
        
        const { HWHClasses, HWHFuncs, Send, cheats, Caller, lib } = window;
        HWHFuncs.addExtentionName(EXTENSION_NAME, EXTENSION_VERSION, EXTENSION_AUTHOR);

        // Create LLM API interface
        const apiRecorder = createApiRecorder({ Send: window.Send, HWHFuncs });
        const api = createLLMAPI({ HWHClasses, HWHFuncs, Send, cheats, Caller, lib, apiRecorder });
        window.LLMHWH = api;

        // Localhost bridge for Cursor (polls llm-bridge-server.mjs)
        startBridgeClient(api, HWHFuncs);

        // Add menu button for testing
        const scriptMenu = HWHClasses.ScriptMenu.getInst();
        scriptMenu.addCombinedButton([
            {
                name: 'LLM API',
                title: 'Open LLM API documentation and test interface',
                onClick: openLLMInterface
            },
            {
                name: 'Bridge',
                title: 'LLM bridge status (Cursor localhost server)',
                onClick: () => {
                    const status = api.getBridgeStatus();
                    HWHFuncs.setProgress(
                        `Bridge: ${status.connected ? 'connected' : 'waiting'} | server: ${status.serverReachable ? 'up' : 'down'}`,
                        true
                    );
                },
                color: 'gray'
            },
            {
                name: 'Record',
                title: 'Toggle API recording for manual UI playthroughs',
                onClick: () => {
                    const status = api.getApiRecordingStatus();
                    if (status.recording) {
                        const result = api.stopApiRecording();
                        HWHFuncs.setProgress(`API recording stopped (${result.entryCount} calls)`, true);
                    } else {
                        const result = api.startApiRecording({ label: 'manual-ui' });
                        HWHFuncs.setProgress(`API recording started (${result.sessionId})`, true);
                    }
                },
                color: 'purple'
            }
        ]);

        console.log(`${EXTENSION_NAME} initialized. LLM API available at window.LLMHWH`);
    }

    function startBridgeClient(api, HWHFuncs) {
        let running = false;
        let connected = false;
        let serverReachable = false;

        api.getBridgeStatus = () => ({ connected, serverReachable, url: BRIDGE_URL });

        async function pollOnce() {
            if (running) return;
            running = true;
            try {
                const health = await fetch(`${BRIDGE_URL}/health`).then(r => r.json()).catch(() => null);
                serverReachable = !!health?.ok;

                const res = await fetch(`${BRIDGE_URL}/poll`);
                if (res.status === 204) {
                    connected = serverReachable;
                    return;
                }
                if (!res.ok) return;

                const command = await res.json();
                connected = true;

                let result;
                let ok = true;
                let error = null;
                try {
                    result = await api.runCommand(command.method, command.args || []);
                } catch (e) {
                    ok = false;
                    error = e.message || String(e);
                }

                await fetch(`${BRIDGE_URL}/result`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: command.id, ok, result, error }),
                });
            } catch (e) {
                connected = false;
            } finally {
                running = false;
            }
        }

        setInterval(pollOnce, BRIDGE_POLL_MS);
        pollOnce();
        console.log(`${EXTENSION_NAME}: bridge client polling ${BRIDGE_URL}`);
    }

    function createApiRecorder({ Send, HWHFuncs }) {
        let recording = false;
        let sessionId = null;
        let label = '';
        let startedAt = null;
        let entries = [];
        let entryCounter = 0;
        let pollTimer = null;
        let originalSend = null;
        const seenHistoryIds = new Set();
        const seenSendKeys = new Set();

        function parseJson(value) {
            if (value == null) return null;
            if (typeof value === 'object') return value;
            try {
                return JSON.parse(value);
            } catch {
                return null;
            }
        }

        function normalizeCalls(request) {
            const parsed = parseJson(request);
            if (!parsed) return [];
            if (Array.isArray(parsed.calls)) return parsed.calls;
            if (parsed.name) return [parsed];
            return [];
        }

        function matchResults(calls, response) {
            const parsed = parseJson(response);
            if (!parsed?.results || !Array.isArray(parsed.results)) {
                return calls.map((call) => ({ call, result: parsed }));
            }
            const byIdent = new Map(parsed.results.map((item) => [item.ident, item]));
            return calls.map((call, index) => ({
                call,
                result: byIdent.get(call.ident) ?? parsed.results[index] ?? null,
            }));
        }

        function addEntry({ source, apiName, args, ident, request, response, error, meta = {} }) {
            const entry = {
                id: ++entryCounter,
                timestamp: new Date().toISOString(),
                source,
                apiName,
                args: args ?? {},
                ident: ident ?? null,
                request: request ?? null,
                response: response ?? null,
                error: error ?? null,
                meta,
            };
            entries.push(entry);
            console.log(`[LLM API Recorder] ${apiName}`, entry);
            return entry;
        }

        function captureSendPayload(request, response, error, durationMs) {
            const calls = normalizeCalls(request);
            if (!calls.length) return;

            const pairs = matchResults(calls, response);
            for (const { call, result } of pairs) {
                const dedupeKey = `send:${call.name}:${JSON.stringify(call.args)}:${JSON.stringify(result)}`;
                if (seenSendKeys.has(dedupeKey)) continue;
                seenSendKeys.add(dedupeKey);

                addEntry({
                    source: 'send',
                    apiName: call.name,
                    args: call.args,
                    ident: call.ident,
                    request: call,
                    response: result,
                    error,
                    meta: { durationMs },
                });
            }
        }

        function captureRequestHistory() {
            const history = typeof window.getRequestHistory === 'function'
                ? window.getRequestHistory()
                : null;
            if (!history) return;

            for (const [historyId, item] of Object.entries(history)) {
                if (!item?.response || seenHistoryIds.has(historyId)) continue;
                seenHistoryIds.add(historyId);

                const calls = normalizeCalls(item.request);
                const pairs = matchResults(calls, item.response);
                for (const { call, result } of pairs) {
                    addEntry({
                        source: 'xhr',
                        apiName: call.name,
                        args: call.args,
                        ident: call.ident,
                        request: call,
                        response: result,
                        meta: { historyId },
                    });
                }
            }
        }

        function installSendHook() {
            if (originalSend || typeof window.Send !== 'function') return;
            originalSend = window.Send;
            window.Send = function hookedSend(json, pr) {
                const started = Date.now();
                return originalSend.call(this, json, pr)
                    .then((response) => {
                        if (recording) {
                            captureSendPayload(json, response, null, Date.now() - started);
                        }
                        return response;
                    })
                    .catch((error) => {
                        if (recording) {
                            captureSendPayload(json, null, {
                                name: error?.name,
                                message: error?.message || String(error),
                            }, Date.now() - started);
                        }
                        throw error;
                    });
            };
        }

        function uninstallSendHook() {
            if (originalSend) {
                window.Send = originalSend;
                originalSend = null;
            }
        }

        return {
            startApiRecording(options = {}) {
                if (recording) {
                    return this.getApiRecordingStatus();
                }
                installSendHook();
                recording = true;
                sessionId = `rec_${Date.now()}`;
                label = options.label || 'manual-ui';
                startedAt = new Date().toISOString();
                entries = [];
                entryCounter = 0;
                seenHistoryIds.clear();
                seenSendKeys.clear();
                captureRequestHistory();
                pollTimer = setInterval(captureRequestHistory, 1000);
                HWHFuncs?.setProgress?.(`API recording started (${sessionId})`, true);
                return this.getApiRecordingStatus();
            },

            stopApiRecording() {
                if (!recording) {
                    return this.getApiRecordingStatus();
                }
                recording = false;
                if (pollTimer) {
                    clearInterval(pollTimer);
                    pollTimer = null;
                }
                captureRequestHistory();
                uninstallSendHook();
                const status = this.getApiRecordingStatus();
                HWHFuncs?.setProgress?.(`API recording stopped (${status.entryCount} calls)`, true);
                return status;
            },

            clearApiRecording() {
                entries = [];
                entryCounter = 0;
                seenHistoryIds.clear();
                seenSendKeys.clear();
                return this.getApiRecordingStatus();
            },

            getApiRecordingStatus() {
                return {
                    recording,
                    sessionId,
                    label,
                    startedAt,
                    entryCount: entries.length,
                };
            },

            getApiRecording(options = {}) {
                const sinceId = Number(options.sinceId) || 0;
                const slice = sinceId > 0
                    ? entries.filter((entry) => entry.id > sinceId)
                    : entries;
                return {
                    ...this.getApiRecordingStatus(),
                    entries: slice,
                    lastEntryId: entries.length ? entries[entries.length - 1].id : 0,
                };
            },

            exportApiRecording() {
                return {
                    exportedAt: new Date().toISOString(),
                    ...this.getApiRecording(),
                };
            },
        };
    }

    function createLLMAPI({ HWHClasses, HWHFuncs, Send, cheats, Caller, lib, apiRecorder }) {
        /**
         * LLM API Interface for HeroWarsHelper
         * 
         * This API allows LLMs to directly control HeroWarsHelper functions.
         * All functions return Promises and can be awaited.
         */
        return {
            // ========== CORE API FUNCTIONS ==========
            ...apiRecorder,
            
            /**
             * Send API request directly
             * @param {Object|string} request - API call object or JSON string
             * @returns {Promise} API response
             */
            async sendAPI(request) {
                try {
                    if (typeof request === 'string') {
                        request = JSON.parse(request);
                    }
                    return await Send(request);
                } catch (error) {
                    throw new Error(`API call failed: ${error.message}`);
                }
            },

            /**
             * Get user information
             * @returns {Promise<Object>} User info
             */
            async getUserInfo() {
                return await Send({ calls: [{ name: "userGetInfo", args: {}, ident: "userInfo" }] });
            },

            /**
             * Get all heroes
             * @returns {Promise<Object>} Hero data
             */
            async getHeroes() {
                return await Send({ calls: [{ name: "heroGetAll", args: {}, ident: "heroes" }] });
            },

            /**
             * Get all titans
             * @returns {Promise<Object>} Titan data
             */
            async getTitans() {
                return await Send({ calls: [{ name: "titanGetAll", args: {}, ident: "titans" }] });
            },

            /**
             * Get inventory
             * @returns {Promise<Object>} Inventory data
             */
            async getInventory() {
                return await Send({ calls: [{ name: "inventoryGet", args: {}, ident: "inventory" }] });
            },

            /**
             * Get all quests
             * @returns {Promise<Object>} Quest data
             */
            async getQuests() {
                return await Send({ calls: [{ name: "questGetAll", args: {}, ident: "quests" }] });
            },

            // ========== GAME OPERATIONS ==========

            /**
             * Execute Outland (boss raids and chests)
             * @returns {Promise<string>} Status message
             */
            async executeOutland() {
                return new Promise((resolve, reject) => {
                    try {
                        HWHFuncs.setProgress('Executing: Outland', true);
                        const getOutland = window.getOutland || window.HWHData?.buttons?.getOutland?.button?.onclick;
                        if (getOutland) {
                            getOutland();
                            setTimeout(() => resolve('Outland executed'), 2000);
                        } else {
                            // Fallback: direct API call
                            Send({ calls: [{ name: "bossGetAll", args: {}, ident: "bossGetAll" }] })
                                .then(data => {
                                    const bosses = data.results[0].result.response;
                                    const calls = [];
                                    for (const boss of bosses) {
                                        if (boss.mayRaid) calls.push({ name: "bossRaid", args: { bossId: boss.id }, ident: "bossRaid_" + boss.id });
                                        if (boss.chestId === 1 || boss.mayRaid) calls.push({ name: "bossOpenChest", args: { bossId: boss.id, amount: 1, starmoney: 0 }, ident: "bossOpenChest_" + boss.id });
                                    }
                                    if (calls.length > 0) {
                                        return Send({ calls });
                                    }
                                })
                                .then(() => {
                                    HWHFuncs.setProgress('Outland: Done!', true);
                                    resolve('Outland executed successfully');
                                })
                                .catch(reject);
                        }
                    } catch (error) {
                        reject(new Error(`Outland execution failed: ${error.message}`));
                    }
                });
            },

            /**
             * Execute Tower
             * @returns {Promise<string>} Status message
             */
            async executeTower() {
                return new Promise((resolve, reject) => {
                    try {
                        HWHFuncs.setProgress('Executing: Tower', true);
                        const executeTower = new HWHClasses.executeTower(resolve, reject);
                        executeTower.start();
                    } catch (error) {
                        reject(new Error(`Tower execution failed: ${error.message}`));
                    }
                });
            },

            /**
             * Execute Dungeon
             * @param {number} maxTitanite - Maximum titanite to collect (optional)
             * @returns {Promise<string>} Status message
             */
            async executeDungeon(maxTitanite = null) {
                if (!HWHClasses.executeDungeon) {
                    throw new Error('Dungeon function not available (install Auto Daily ext for Stealther dungeon)');
                }
                if (window.HWH_DUNGEON_RUNNING || window.HWH_DUNGEON_BATTLE_OPEN) {
                    throw new Error('Dungeon already running');
                }
                return new Promise((resolve, reject) => {
                    try {
                        HWHFuncs.setProgress('Executing: Dungeon', true);
                        const dungeon = new HWHClasses.executeDungeon(resolve, reject);
                        if (maxTitanite != null) {
                            dungeon.start(maxTitanite);
                        } else {
                            dungeon.start();
                        }
                    } catch (error) {
                        reject(new Error(`Dungeon execution failed: ${error.message}`));
                    }
                });
            },

            /**
             * Execute Arena (all attempts) via AutoBattle if available
             * @param {string} arenaType - 'arena' or 'grand'
             * @returns {Promise<string>} Status message
             */
            async executeArena(arenaType = 'arena') {
                if (!HWHClasses.executeArena) {
                    throw new Error('executeArena not available (install AutoBattle HwH Ext)');
                }
                return new Promise((resolve, reject) => {
                    try {
                        HWHFuncs.setProgress(`Executing: ${arenaType === 'grand' ? 'Grand Arena' : 'Arena'}`, true);
                        const arena = new HWHClasses.executeArena(resolve, reject);
                        arena.start(arenaType);
                    } catch (error) {
                        reject(new Error(`Arena execution failed: ${error.message}`));
                    }
                });
            },

            /**
             * Execute Expeditions
             * @returns {Promise<string>} Status message
             */
            async executeExpeditions() {
                return new Promise((resolve, reject) => {
                    try {
                        HWHFuncs.setProgress('Executing: Expeditions', true);
                        const expedition = new HWHClasses.Expedition(resolve, reject);
                        expedition.start();
                    } catch (error) {
                        reject(new Error(`Expeditions execution failed: ${error.message}`));
                    }
                });
            },

            /**
             * Collect all quest rewards
             * @returns {Promise<string>} Status message
             */
            async collectQuestRewards() {
                try {
                    HWHFuncs.setProgress('Collecting quest rewards', true);
                    const questData = await Send({ calls: [{ name: "questGetAll", args: {}, ident: "quests" }] });
                    const quests = questData.results[0].result.response;
                    const questsToFarm = quests.filter(q => q && q.id < 1000000 && q.state === 2);
                    
                    if (questsToFarm.length === 0) {
                        HWHFuncs.setProgress('No quests ready to collect', true);
                        return 'No quests ready to collect';
                    }
                    
                    const questCalls = questsToFarm.map(q => ({ 
                        name: "questFarm", 
                        args: { questId: q.id }, 
                        ident: `questFarm_${q.id}` 
                    }));
                    
                    await Send({ calls: questCalls });
                    HWHFuncs.setProgress(`Collected ${questsToFarm.length} quest rewards`, true);
                    return `Collected ${questsToFarm.length} quest rewards`;
                } catch (error) {
                    throw new Error(`Quest collection failed: ${error.message}`);
                }
            },

            /**
             * Collect mail
             * @returns {Promise<string>} Status message
             */
            async collectMail() {
                try {
                    HWHFuncs.setProgress('Collecting mail', true);
                    const mailData = await Send({ calls: [{ name: "mailGetAll", args: {}, ident: "mail" }] });
                    const letters = mailData.results[0].result.response.letters;
                    const letterIds = HWHClasses.Letters.filter(letters);
                    
                    if (letterIds.length > 0) {
                        await Send({ calls: [{ name: "mailFarm", args: { letterIds }, ident: "mailFarm" }] });
                        HWHFuncs.setProgress(`Collected ${letterIds.length} mail items`, true);
                        return `Collected ${letterIds.length} mail items`;
                    } else {
                        HWHFuncs.setProgress('No mail to collect', true);
                        return 'No mail to collect';
                    }
                } catch (error) {
                    throw new Error(`Mail collection failed: ${error.message}`);
                }
            },

            /**
             * Get daily bonus
             * @returns {Promise<string>} Status message
             */
            async getDailyBonus() {
                try {
                    HWHFuncs.setProgress('Getting daily bonus', true);
                    const doYourBest = new HWHClasses.doYourBest(() => {}, () => {});
                    if (doYourBest.functions && doYourBest.functions.getDailyBonus) {
                        await doYourBest.functions.getDailyBonus();
                        HWHFuncs.setProgress('Daily bonus collected', true);
                        return 'Daily bonus collected';
                    } else {
                        throw new Error('Daily bonus function not available');
                    }
                } catch (error) {
                    throw new Error(`Daily bonus failed: ${error.message}`);
                }
            },

            /**
             * Execute Seer (Ascension Chest)
             * @returns {Promise<string>} Status message
             */
            async executeSeer() {
                try {
                    HWHFuncs.setProgress('Executing: Seer', true);
                    const data = await Send({ calls: [{ name: "userGetInfo", args: {}, ident: "userInfo" }] });
                    const refillable = data.results[0].result.response.refillable;
                    const seerCharges = refillable.find(i => i.id == 47);
                    
                    if (seerCharges && seerCharges.amount > 0) {
                        await Send({ calls: [{ name: "ascensionChest_open", args: { paid: false, amount: 1 }, ident: "seer" }] });
                        HWHFuncs.setProgress('Seer: Done!', true);
                        return 'Seer executed successfully';
                    } else {
                        HWHFuncs.setProgress('Seer: No charges available', true);
                        return 'No seer charges available';
                    }
                } catch (error) {
                    throw new Error(`Seer execution failed: ${error.message}`);
                }
            },

            // ========== BATTLE OPERATIONS ==========

            /**
             * Execute Arena battle
             * @param {Object} team - Team configuration
             * @returns {Promise<Object>} Battle result
             */
            async executeArenaBattle(team) {
                try {
                    const battleCall = {
                        calls: [{
                            name: "arenaStartBattle",
                            args: team,
                            ident: "arenaBattle"
                        }]
                    };
                    return await Send(battleCall);
                } catch (error) {
                    throw new Error(`Arena battle failed: ${error.message}`);
                }
            },

            /**
             * Execute Grand Arena battle
             * @param {Object} teams - Team configurations (3 teams)
             * @returns {Promise<Object>} Battle result
             */
            async executeGrandArenaBattle(teams) {
                try {
                    const battleCall = {
                        calls: [{
                            name: "grandArenaStartBattle",
                            args: teams,
                            ident: "grandArenaBattle"
                        }]
                    };
                    return await Send(battleCall);
                } catch (error) {
                    throw new Error(`Grand Arena battle failed: ${error.message}`);
                }
            },

            // ========== ARENA TRAINING ==========

            /**
             * Run arena combo training via Arena Training extension (demo battles, no attempts used)
             * @param {Object} options
             * @returns {Promise<Object>}
             */
            async arenaTrainingRun(options = {}) {
                if (!window.ArenaTraining) {
                    throw new Error('Arena Training not available (install Arena Training HwH Ext)');
                }
                return await window.ArenaTraining.run(options);
            },

            async arenaTrainingGetOpponents(forceRefresh = false, options = {}) {
                if (!window.ArenaTraining) {
                    throw new Error('Arena Training not available (install Arena Training HwH Ext)');
                }
                return await window.ArenaTraining.getOpponents(forceRefresh, options);
            },

            arenaTrainingGetResults() {
                if (!window.ArenaTraining) {
                    throw new Error('Arena Training not available (install Arena Training HwH Ext)');
                }
                return window.ArenaTraining.getResults();
            },

            arenaTrainingExportResults() {
                if (!window.ArenaTraining) {
                    throw new Error('Arena Training not available (install Arena Training HwH Ext)');
                }
                return window.ArenaTraining.exportResults();
            },

            arenaTrainingGetStatus() {
                if (!window.ArenaTraining) {
                    return { available: false, running: false };
                }
                return { available: true, ...window.ArenaTraining.getStatus() };
            },

            arenaTrainingStop() {
                if (!window.ArenaTraining) {
                    throw new Error('Arena Training not available (install Arena Training HwH Ext)');
                }
                return window.ArenaTraining.stop();
            },

            arenaTrainingStartLoop(options = {}) {
                if (!window.ArenaTraining) {
                    throw new Error('Arena Training not available (install Arena Training HwH Ext)');
                }
                return window.ArenaTraining.startLoop(options);
            },

            arenaTrainingStopLoop() {
                if (!window.ArenaTraining) {
                    throw new Error('Arena Training not available (install Arena Training HwH Ext)');
                }
                return window.ArenaTraining.stopLoop();
            },

            arenaTrainingGetLoopHistory() {
                if (!window.ArenaTraining) {
                    throw new Error('Arena Training not available (install Arena Training HwH Ext)');
                }
                return window.ArenaTraining.getLoopHistory();
            },

            // ========== UTILITY FUNCTIONS ==========

            /**
             * Translate a key
             * @param {string} key - Translation key
             * @returns {string} Translated text
             */
            translate(key) {
                return cheats.translate(key);
            },

            /**
             * Get library data
             * @param {string} id - Library data ID (e.g., 'hero', 'titan', 'mission')
             * @returns {Object} Library data
             */
            getLibraryData(id) {
                return lib.getData(id);
            },

            /**
             * Set progress message
             * @param {string} message - Progress message
             * @param {boolean} autoHide - Auto-hide after timeout
             */
            setProgress(message, autoHide = true) {
                HWHFuncs.setProgress(message, autoHide);
            },

            /**
             * Show popup confirmation
             * @param {string} message - Popup message
             * @param {Array} buttons - Button configurations
             * @returns {Promise} User selection
             */
            async showPopup(message, buttons) {
                return await HWHFuncs.popup.confirm(message, buttons);
            },

            // ========== BATCH OPERATIONS ==========

            /**
             * Execute multiple operations in sequence
             * @param {Array<string>} operations - Array of operation names
             * @returns {Promise<Array>} Results array
             */
            async executeBatch(operations) {
                const results = [];
                for (const op of operations) {
                    try {
                        const result = await this.executeOperation(op);
                        results.push({ operation: op, success: true, result });
                    } catch (error) {
                        results.push({ operation: op, success: false, error: error.message });
                    }
                }
                return results;
            },

            /**
             * Execute a single operation by name
             * @param {string} operationName - Name of operation
             * @param {Object} params - Optional parameters
             * @returns {Promise} Operation result
             */
            async executeOperation(operationName, params = {}) {
                const operations = {
                    'outland': () => this.executeOutland(),
                    'tower': () => this.executeTower(),
                    'dungeon': () => this.executeDungeon(params.maxTitanite),
                    'arena': () => this.executeArena('arena'),
                    'grandarena': () => this.executeArena('grand'),
                    'expeditions': () => this.executeExpeditions(),
                    'quests': () => this.collectQuestRewards(),
                    'mail': () => this.collectMail(),
                    'dailybonus': () => this.getDailyBonus(),
                    'seer': () => this.executeSeer(),
                };

                if (operations[operationName.toLowerCase()]) {
                    return await operations[operationName.toLowerCase()]();
                } else {
                    throw new Error(`Unknown operation: ${operationName}`);
                }
            },

            // ========== INFORMATION ==========

            /**
             * Get available operations list
             * @returns {Array<string>} List of available operations
             */
            getAvailableOperations() {
                return [
                    'outland',
                    'tower',
                    'dungeon',
                    'arena',
                    'grandArena',
                    'expeditions',
                    'quests',
                    'mail',
                    'dailyBonus',
                    'seer',
                    'arenaBattle',
                    'grandArenaBattle'
                ];
            },

            /**
             * Run any public LLMHWH method by name (used by localhost bridge)
             * @param {string} method
             * @param {Array} args
             * @returns {Promise<*>}
             */
            async runCommand(method, args = []) {
                if (method === 'getBridgeStatus') {
                    return this.getBridgeStatus ? this.getBridgeStatus() : { connected: false };
                }
                if (typeof this[method] !== 'function') {
                    throw new Error(`Unknown method: ${method}`);
                }
                return await this[method](...args);
            },

            /**
             * Get API documentation
             * @returns {Object} API documentation
             */
            getDocumentation() {
                return {
                    version: EXTENSION_VERSION,
                    description: 'LLM API Interface for HeroWarsHelper',
                    operations: {
                        sendAPI: 'Send any API request directly',
                        getUserInfo: 'Get current user information',
                        getHeroes: 'Get all hero data',
                        getTitans: 'Get all titan data',
                        getInventory: 'Get inventory data',
                        getQuests: 'Get all quests',
                        executeOutland: 'Execute Outland (boss raids)',
                        executeTower: 'Execute Tower of Elements',
                        executeDungeon: 'Execute Dungeon (with optional maxTitanite param)',
                        executeArena: 'Execute Arena (requires AutoBattle ext)',
                        executeExpeditions: 'Execute Expeditions',
                        collectQuestRewards: 'Collect all completed quest rewards',
                        collectMail: 'Collect all mail',
                        getDailyBonus: 'Get daily bonus',
                        executeSeer: 'Execute Seer (Ascension Chest)',
                        executeArenaBattle: 'Execute Arena battle (requires team param)',
                        executeGrandArenaBattle: 'Execute Grand Arena battle (requires teams param)',
                        executeBatch: 'Execute multiple operations in sequence',
                        executeOperation: 'Execute operation by name',
                        runCommand: 'Run any API method by name (bridge)',
                        getBridgeStatus: 'Localhost bridge connection status',
                        startApiRecording: 'Start recording game API calls (UI + scripts)',
                        stopApiRecording: 'Stop API recording',
                        getApiRecording: 'Get recorded API calls (optional sinceId)',
                        clearApiRecording: 'Clear recorded API calls',
                        exportApiRecording: 'Export full recording snapshot',
                        getApiRecordingStatus: 'API recording status',
                        arenaTrainingRun: 'Test hero combos vs arena opponent (demo battles)',
                        arenaTrainingGetOpponents: 'List arena opponents (topGet arena list by default)',
                        arenaTrainingGetResults: 'Get latest arena training results',
                        arenaTrainingExportResults: 'Export latest arena training results',
                        arenaTrainingGetStatus: 'Arena training run status',
                        arenaTrainingStop: 'Stop arena training run',
                        arenaTrainingStartLoop: 'Start loop training (auto-saves each round)',
                        arenaTrainingStopLoop: 'Stop loop training',
                        arenaTrainingGetLoopHistory: 'Get in-browser loop session history',
                        translate: 'Translate a key to text',
                        getLibraryData: 'Get library data by ID',
                        setProgress: 'Set progress message',
                        showPopup: 'Show popup confirmation',
                        getAvailableOperations: 'Get list of available operations'
                    }
                };
            }
        };
    }

    function openLLMInterface() {
        const { HWHFuncs } = window;
        const api = window.LLMHWH;
        
        if (!api) {
            HWHFuncs.setProgress('LLM API not initialized', true);
            return;
        }

        const doc = api.getDocumentation();
        const operations = api.getAvailableOperations();
        
        const content = document.createElement('div');
        content.style.cssText = 'padding: 20px; color: #fce1ac; font-family: monospace; max-width: 800px;';
        content.innerHTML = `
            <h2 style="color: #ce9767; border-bottom: 2px solid #ce9767; padding-bottom: 10px;">
                LLM API Interface
            </h2>
            <div style="margin: 20px 0;">
                <h3 style="color: #87CEEB;">Available Operations:</h3>
                <ul style="list-style: none; padding: 0;">
                    ${operations.map(op => `<li style="padding: 5px 0;">• <code style="color: #FFD700;">${op}</code></li>`).join('')}
                </ul>
            </div>
            <div style="margin: 20px 0;">
                <h3 style="color: #87CEEB;">Usage Examples:</h3>
                <pre style="background: rgba(0,0,0,0.5); padding: 15px; border-radius: 5px; overflow-x: auto;">
// In browser console:
await LLMHWH.executeOutland();
await LLMHWH.collectQuestRewards();
await LLMHWH.executeBatch(['outland', 'quests', 'mail']);

// Get data:
const userInfo = await LLMHWH.getUserInfo();
const heroes = await LLMHWH.getHeroes();

// Custom API call:
await LLMHWH.sendAPI({
    calls: [{
        name: "userGetInfo",
        args: {},
        ident: "body"
    }]
});

// Cursor bridge (run llm-bridge-server.mjs first):
// curl -X POST http://127.0.0.1:9876/run -H "Content-Type: application/json" -d "{\"method\":\"getUserInfo\",\"args\":[]}"
                </pre>
            </div>
            <div style="margin: 20px 0;">
                <p><strong>API is available globally as:</strong> <code style="color: #FFD700;">window.LLMHWH</code></p>
                <p>All functions return Promises and can be used with async/await.</p>
            </div>
        `;

        HWHFuncs.popup.confirm('LLM API Documentation', [
            { msg: 'Close', result: true, isClose: true }
        ]).then(() => {
            const popupBody = document.querySelector('.PopUp_Container');
            if (popupBody) {
                popupBody.innerHTML = '';
                popupBody.appendChild(content);
            }
        });
    }

})();

