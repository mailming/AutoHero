// ==UserScript==
// @name         HeroWarsHelper - Auto Daily Extension
// @namespace    http://tampermonkey.net/
// @version      3.5.11
// @description  Auto Daily panel plus merged AutoBattle options (Arena, Grand Arena, ToE, Guild War, Guild Raid, Clash of the World).
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
    const EXTENSION_VERSION = "3.5.11";
    const EXTENSION_AUTHOR = "You";
    const AUTO_DAILY_STYLE_ID = 'auto-daily-popup-styles';

    /** Verbose dungeon logs: `window.HWH_DEBUG_DUNGEON = true` before run. */
    /** Per-end-battle prediction card count: `window.HWH_LOG_PREDICTION_CARDS = true` (HeroWarsHelper). */
    /** Battle pre-calc count (0-25): `window.HWH_DUNGEON_NUM_TRIES` (default 10). */
    /** Step delay between floors ms: `window.HWH_DUNGEON_STEP_DELAY_MS` (default 100). */
    /** Brute-force budget ms per battle sim: `window.HWH_DUNGEON_BRUTEFORCE_MS` (default 60000, Stealther default). */
    /** Optional override for door comparison only: `window.HWH_DUNGEON_EVAL_BRUTEFORCE_MS`. */
    /** Optional override when restarting a non-last door: `window.HWH_DUNGEON_EXECUTE_BRUTEFORCE_MS`. */
    /** Max timer slots per battle sim: `window.HWH_DUNGEON_MAX_TIMER_TRIES` (0 = unlimited, Stealther default). */

    // ASCII-safe UI icons (avoids UTF-8 encoding issues in userscript managers)
    const UI_ICON = {
        fire: '\uD83D\uDD25',
        pending: '\u23F3',
        save: '\uD83D\uDCBE',
        sync: '\uD83D\uDD04',
        unavailable: '\uD83C\uDF11',
        done: '\u2705',
    };

    // --- STATE VARIABLES ---
    let executionState = {};
    let hideButtonsState = {};
    let othersSettingsState = {};
    let isProviderActive = false;
    let customOthersButton = null;
    let combinedButton = null;
    let cachedQuestData = null; // Cache for questGetAll results
    let autoRunInProgress = false;
    let dungeonRunning = false;

    function setDungeonBattleOpen(isOpen) {
        window.HWH_DUNGEON_BATTLE_OPEN = !!isOpen;
    }

    async function waitForAutoBattleIdle(maxWaitMs = 45 * 60 * 1000) {
        const start = Date.now();
        while (window.HWH_AUTOBATTLE_RUNNING && Date.now() - start < maxWaitMs) {
            if (window.HWHFuncs?.setProgress) {
                window.HWHFuncs.setProgress('Dungeon: waiting for AutoBattle to finish...', true);
            }
            await sleep(1000);
        }
        return !window.HWH_AUTOBATTLE_RUNNING;
    }

    // --- DUNGEON TITAN HEALTH SETTINGS ---
    const defaultTitanHealthSettings = {
        minOverallHP: 0.30,
        titan4020HP: 0.40,
        titan4020EnergyHP: 0.20,
        titan4010Combined: 0.67,
        titan4000HP: 0.63,
        titan4000Energy400HP: 0.45,
        titan4000Energy670HP: 0.34,
        autoRefreshPage: false,
        // Optional: skip glass-cannon titans on elemental doors (Tidus/Asherona/Verdoc).
        // Off by default — they're strong; enable if long farms keep dying.
        excludeFragileElemental: false,
        // Try smaller earth/fire teams (5→2) when a full team fails survival checks.
        shrinkEarthFireTeams: true,
        // Reject sims that leave tanks below the HP/energy cutoffs above.
        enforceTankSurvival: true,
    };

    /** Fragile high-DPS titans that can brick long auto runs on elemental doors. */
    const FRAGILE_ELEMENTAL_TITANS = {
        water: 4004, // Tidus
        fire: 4014,  // Asherona
        earth: 4024, // Verdoc
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
            const saved = HWHFuncs.getSaveVal('titanHealthSettings', {}) || {};
            titanHealthSettings = Object.assign({}, defaultTitanHealthSettings, saved);
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
    // Dungeon Algorithm - ported from Hero Wars Stealther 1.006 (Mike Rohsoft)
    function executeDungeon(resolve, reject) {
        const { HWHFuncs, Send, BattleCalc, cheats } = window;
        const { getInput, setProgress, hideProgress, I18N, getTimer, countdownTimer } = HWHFuncs;

        const DUNGEON_VERBOSE = typeof window !== 'undefined' && window.HWH_DEBUG_DUNGEON === true;
        const NUM_TRIES = Math.max(0, Math.min(25, Number(window.HWH_DUNGEON_NUM_TRIES) || 10));
        const BRUTEFORCE_MS = Math.max(5000, Math.min(120000, Number(window.HWH_DUNGEON_BRUTEFORCE_MS) || 60000));
        const EVAL_BRUTEFORCE_MS = Math.max(5000, Math.min(120000, Number(window.HWH_DUNGEON_EVAL_BRUTEFORCE_MS) || BRUTEFORCE_MS));
        const RESTART_BRUTEFORCE_MS = Math.max(5000, Math.min(120000, Number(window.HWH_DUNGEON_EXECUTE_BRUTEFORCE_MS) || BRUTEFORCE_MS));
        const STEP_DELAY_MS = Math.max(0, Math.min(1000, Number(window.HWH_DUNGEON_STEP_DELAY_MS) || 100));
        const NO_WIN_RETRIES = Math.max(1, Math.min(8, Number(window.HWH_DUNGEON_NO_WIN_RETRIES) || 3));
        const MAX_TIMER_TRIES = window.HWH_DUNGEON_MAX_TIMER_TRIES != null
            ? Math.max(0, Math.min(200, Number(window.HWH_DUNGEON_MAX_TIMER_TRIES) || 0))
            : 0;
        const SIM_YIELD_EVERY = 3;

        function syncPredictionCardsFromInventory(invRes) {
            const raw = invRes?.result?.response?.consumable?.[81];
            const n = Math.max(0, Math.floor(Number(raw)) || 0);
            if (window.HWHData) {
                window.HWHData.countPredictionCard = n;
            }
            return n;
        }

        let dungeonActivity = 0;
        let startDungeonActivity = 0;
        let maxDungeonActivity = 150;
        let end = false;
        let talentMsg = '';
        let talentMsgReward = '';
        let titansList = [];
        let teamGetAll = null;
        let teamGetFavor = null;
        let isAbleToHeal = false;
        let isRestart = false;
        let lastError = null;
        let lastDebugString = '';
        let lastBattleHandler = null;
        let lastStartedTeamNum = -1;
        let battleStartTime = 0;
        let stepCount = 0;
        let consecutiveNoWin = 0;
        let timeDungeon = { all: Date.now(), steps: 0 };

        function getApiResult(result) {
            if (!result) return null;
            if (result.status >= 400 || result.errors) {
                return { error: result, validation: result.errors };
            }
            if (result.error && !result.results) {
                return { error: result.error };
            }
            return result?.results?.[0]?.result;
        }

        function getResponse(result) {
            return getApiResult(result)?.response;
        }

        function buildHeroFavor(heroIds, favorMap) {
            const favor = {};
            if (!favorMap || !heroIds?.length) return favor;
            for (const id of heroIds) {
                const petId = favorMap[id] ?? favorMap[String(id)];
                if (petId) {
                    favor[id] = petId;
                }
            }
            return favor;
        }

        function getHeroTeamForBattle(heroStates) {
            const heroTeam = teamGetAll?.dungeon_hero;
            if (!Array.isArray(heroTeam)) {
                return null;
            }
            const pet = heroTeam.find((v) => v > 6000) || null;
            const heroes = heroTeam.filter((v) => {
                if (!v || v <= 0 || v >= 6000) return false;
                const state = heroStates?.[v] ?? heroStates?.[String(v)];
                return !state?.isDead;
            });
            if (heroes.length === 0) {
                return null;
            }
            return {
                heroes,
                pet,
                favor: buildHeroFavor(heroes, teamGetFavor?.dungeon_hero),
            };
        }

        function simulateBattle(battleData, battleType) {
            return new Promise((resolveSim, rejectSim) => {
                const data = structuredClone(battleData);
                if (!data.progress) {
                    data.progress = [{ attackers: { input: ['auto', 0, 0, 'auto', 0, 0] } }];
                }
                try {
                    BattleCalc(data, battleType, (result) => {
                        if (result) resolveSim(result);
                        else rejectSim(new Error('BattleCalc returned empty result'));
                    });
                } catch (e) {
                    rejectSim(e);
                }
            });
        }

        // Stealther uses battlePresets.get_timeLimit(); 180s covers standard dungeon/tower battles.
        const BATTLE_TIME_LIMIT = 180;

        function extractTimers(battleResult, maxTimerTries = MAX_TIMER_TRIES) {
            const logs = battleResult.battleLogs?.[0] || [];
            if (logs.length === 0) {
                return [0];
            }
            const timers = [...new Set(logs.map((e) => (e.time > 0 && e.time < BATTLE_TIME_LIMIT && e.time !== 168.8 ? e.time : 0)))];
            timers.sort(() => Math.random() - 0.5);
            if (maxTimerTries > 0 && timers.length > maxTimerTries) {
                return timers.slice(0, maxTimerTries);
            }
            return timers.length > 0 ? timers : [0];
        }

        class PvPBattleHandler {
            constructor(battle = undefined, type = 'get_clanPvp') {
                this._type = type;
                this.setBattle(battle);
            }

            setBattle(battle) {
                this._battle = battle ? structuredClone(battle) : undefined;
                this._counter = 0;
                this._timers = undefined;
                this._initialBattle = undefined;
                this._lastBattle = undefined;
                this._bestBattle = undefined;
                this._maxBattles = 0;
                this._errors = 0;
            }

            async init(maxTimerTries = MAX_TIMER_TRIES) {
                this._initialBattle = await this.reCalculate(0);
                this._timers = extractTimers(this._initialBattle, maxTimerTries);
                if (this._timers.length === 0) {
                    this._timers = [0];
                }
                this._timers.sort(() => Math.random() - 0.5);
                this._maxBattles = this._timers.length;
                return this._initialBattle;
            }

            randomTime() {
                return this._timers[this._counter % this._timers.length];
            }

            async reCalculate(timer = this.randomTime()) {
                const battle = structuredClone(this._battle);
                battle.progress = [{ attackers: { input: ['auto', 0, 0, 'auto', this._counter, timer] } }];
                const prev = this._lastBattle;
                try {
                    this._lastBattle = await simulateBattle(battle, this._type);
                    this._lastBattle.timer = this._lastBattle.battleTime ?? 0;
                } catch (e) {
                    this._errors++;
                    this._lastBattle = prev;
                }
                this._counter++;
                return this._lastBattle;
            }

            count() {
                return this._counter;
            }

            max() {
                return this._maxBattles;
            }

            isWin() {
                return !!this._initialBattle?.result?.win;
            }

            success(bestBattle) {
                return !!bestBattle?.result?.win;
            }

            bestBattle() {
                return this._bestBattle || this._lastBattle || this._initialBattle;
            }

            initialBattle() {
                return this._initialBattle;
            }

            getFactor(before, after) {
                let beforeSumFactor = 0;
                for (const hero of Object.values(before || {})) {
                    const state = hero.state;
                    let factor = 1;
                    if (state) {
                        const hp = state.hp / hero.hp;
                        const energy = state.energy * 0.001;
                        factor = hp + energy * 0.05;
                    }
                    beforeSumFactor += factor;
                }
                let afterSumFactor = 0;
                for (const [heroId, hero] of Object.entries(after || {})) {
                    const hp = hero.hp / (before?.[heroId]?.hp || hero.hp);
                    const energy = hero.energy * 0.001;
                    afterSumFactor += hp + energy * 0.05;
                }
                return afterSumFactor - beforeSumFactor;
            }

            isBetter(bestBattle, thisBattle) {
                if (!bestBattle || !thisBattle) {
                    return !!thisBattle;
                }
                if (!thisBattle.result?.win) {
                    return false;
                }
                const bestState = this.getState(bestBattle);
                const thisState = this.getState(thisBattle);
                if (!isFinite(thisState)) {
                    return false;
                }
                if (!isFinite(bestState)) {
                    return true;
                }
                return thisState > bestState;
            }

            async *bruteforce(endTime = Date.now() + BRUTEFORCE_MS) {
                if (endTime < Date.now()) {
                    endTime = Date.now() + BRUTEFORCE_MS;
                }
                if (!this._initialBattle) {
                    this._initialBattle = await this.init();
                }
                while (Date.now() < endTime && this._counter < this._maxBattles) {
                    if (stopDung || end) {
                        break;
                    }
                    if (!(this._lastBattle = await this.reCalculate())) {
                        continue;
                    }
                    if (this._counter % SIM_YIELD_EVERY === 0) {
                        await sleep(0);
                    }
                    yield this._counter;
                    if (!this._bestBattle) {
                        this._bestBattle = this._lastBattle;
                        continue;
                    }
                    if (!this.isBetter(this._bestBattle, this._lastBattle)) {
                        continue;
                    }
                    this._bestBattle = this._lastBattle;
                    if (!this.success(this._bestBattle)) {
                        continue;
                    }
                    break;
                }
                return this._bestBattle;
            }

            async *calculateWinChance(times = 10) {
                let wins = 0;
                if (isNaN(times) || times <= 0) {
                    return;
                }
                const originalSeed = this._battle?.seed;
                for (let i = 0; i < times; i++) {
                    if (stopDung || end) {
                        break;
                    }
                    if (this._battle) {
                        this._battle.seed = Math.floor(Date.now() / 1000) + Math.random() * 1000;
                    }
                    const battleBuffer = await simulateBattle(structuredClone(this._battle), this._type);
                    if (battleBuffer?.result?.win) {
                        wins++;
                    }
                    if ((i + 1) % SIM_YIELD_EVERY === 0) {
                        await sleep(0);
                    }
                    yield wins;
                }
                if (this._battle && originalSeed !== undefined) {
                    this._battle.seed = originalSeed;
                }
            }
        }

        class DungeonBattleHandler extends PvPBattleHandler {
            getState(result) {
                if (!result.result?.win) {
                    return -1000;
                }
                const beforeTitans = result.battleData?.attackers || {};
                const afterTitans = result.progress?.[0]?.attackers?.heroes || {};
                return this.getFactor(beforeTitans, afterTitans);
            }

            isBetter(bestBattle, thisBattle) {
                if (!bestBattle || !thisBattle) {
                    return !!thisBattle;
                }
                const bestState = this.getState(bestBattle);
                const thisState = this.getState(thisBattle);
                if (!thisBattle.result?.win) {
                    return false;
                }
                if (!isFinite(thisState)) {
                    return false;
                }
                if (!isFinite(bestState)) {
                    return true;
                }
                return thisState > bestState;
            }

            success() {
                return false;
            }
        }

        async function runBattleHandler(battleHandler, forceFix = false, skipPreCalc = false, simOpts = {}) {
            const bruteMs = simOpts.bruteforceMs ?? BRUTEFORCE_MS;
            const maxTimerTries = simOpts.maxTimerTries ?? MAX_TIMER_TRIES;
            const initBattle = await battleHandler.init(maxTimerTries);
            if (!initBattle) {
                return { initBattle: null, bestBattle: null, isWin: false, timer: 0 };
            }
            const isWin = battleHandler.isWin();
            let wins = 0;

            if (NUM_TRIES > 0 && !skipPreCalc) {
                let count = 1;
                for await (const liveWins of battleHandler.calculateWinChance(NUM_TRIES)) {
                    wins = liveWins;
                    if (DUNGEON_VERBOSE) {
                        setProgress(`${I18N('DUNGEON')}: sim ${liveWins}/${count} ${talentMsg}`, true);
                    }
                    count++;
                }
            }

            if (!forceFix && isWin) {
                return { initBattle, bestBattle: null, isWin, timer: initBattle.battleTime ?? 0 };
            }

            if (bruteMs <= 0) {
                const resolved = battleHandler.bestBattle() ?? initBattle;
                return {
                    initBattle,
                    bestBattle: null,
                    isWin: !!resolved?.result?.win,
                    timer: resolved?.battleTime ?? 0,
                };
            }

            for await (const _count of battleHandler.bruteforce(Date.now() + bruteMs)) {
                if (stopDung || end) {
                    break;
                }
            }

            const bestBattle = battleHandler.bestBattle();
            const resolved = bestBattle ?? initBattle;
            return {
                initBattle,
                bestBattle: bestBattle !== initBattle ? bestBattle : null,
                isWin: !!resolved?.result?.win,
                timer: resolved?.battleTime ?? 0,
            };
        }

        function getTitans(titans, states = {}) {
            const all = titans
                .filter((x) => !states[x.id]?.isDead && !states[String(x.id)]?.isDead)
                .sort((x, y) => (y.power || 0) - (x.power || 0));
            const water = [];
            const fire = [];
            const earth = [];
            const dark = [];
            const light = [];
            const unknown = [];
            for (const titan of all) {
                const id = titan.id;
                if (id < 4010) water.push(titan);
                else if (id < 4020) fire.push(titan);
                else if (id < 4030) earth.push(titan);
                else if (id < 4040) dark.push(titan);
                else if (id < 4050) light.push(titan);
                else unknown.push(titan);
            }
            const byPower = (a, b) => (b.power || 0) - (a.power || 0);
            return {
                all,
                water: water.sort(byPower),
                earth: earth.sort(byPower),
                fire: fire.sort(byPower),
                dark: dark.sort(byPower),
                light: light.sort(byPower),
                elemental: [...dark, ...light, ...unknown].sort(byPower),
            };
        }

        function getTitansForPotentialHealingTeam(aliveTitans, states = {}, index = 0) {
            const normalize = (id) => Number(id);
            if (aliveTitans.water.length < 3) {
                return null;
            }
            const result = [];
            const used = new Set();
            const push = (id) => {
                const n = normalize(id);
                if (!used.has(n) && result.length < 5) {
                    used.add(n);
                    result.push(n);
                }
            };
            const allStates = [];
            for (const [titanId, state] of Object.entries(states)) {
                const id = normalize(titanId);
                if (id < 4010 || id >= 4030 || state.isDead) continue;
                const diff = state.hp / state.maxHp;
                if (diff === 1) continue;
                allStates.push({ diff, id });
            }
            for (const titan of aliveTitans.water.slice(0, 4)) {
                push(titan.id);
            }
            if (allStates.length === 0) {
                return null;
            }
            const candidates = allStates.sort((a, b) => a.diff - b.diff);
            if (candidates[index]) {
                push(candidates[index].id);
            } else {
                return null;
            }
            if (result.length < 5) {
                for (const titan of aliveTitans.elemental ?? []) {
                    if (result.length >= 5) break;
                    push(titan.id);
                }
                if (result.length < 5) {
                    const alive = [...aliveTitans.earth, ...aliveTitans.fire].sort((a, b) => (b.power || 0) - (a.power || 0));
                    for (const titan of alive) {
                        if (result.length >= 5) break;
                        push(titan.id);
                    }
                }
            }
            return result.length === 5 ? result : null;
        }

        function getNeutralTitans(aliveTitans, strongest = false) {
            const normalize = (id) => Number(id);
            if (strongest) {
                return aliveTitans.all.slice(0, 5).map((t) => normalize(t.id));
            }
            const result = [];
            const used = new Set();
            const waterPower = aliveTitans.water.reduce((sum, hero) => hero.power + sum, 0);
            if (waterPower > 500000 && aliveTitans.water.length >= 4) {
                for (const waterTitan of aliveTitans.water) {
                    if (result.length === 4) break;
                    result.push(waterTitan.id);
                    used.add(waterTitan.id);
                }
            }
            const push = (id) => {
                const n = normalize(id);
                if (!used.has(n) && result.length < 5) {
                    used.add(n);
                    result.push(n);
                }
            };
            const elementMap = {
                water: { max: 4010, special: 4004 },
                earth: { max: 4030, special: 4034 },
                fire: { max: 4020, special: 4024 },
                dark: { max: 4040 },
                light: { max: 4050 },
            };
            for (const titan of aliveTitans.all) {
                if (result.length >= 4) break;
                const id = normalize(titan.id);
                if (used.has(id)) continue;
                if (id < elementMap.water.max) {
                    const group = aliveTitans.water.map((t) => normalize(t.id));
                    if (group.includes(elementMap.water.special)) {
                        push(elementMap.water.special);
                        const partner = group.find((x) => x !== elementMap.water.special);
                        if (partner) push(partner);
                    } else {
                        push(id);
                        for (const other of group.filter((x) => x !== id).slice(0, 2)) {
                            if (result.length < 5) push(other);
                        }
                    }
                } else if (id < elementMap.earth.max) {
                    const group = aliveTitans.earth.map((t) => normalize(t.id));
                    if (group.includes(elementMap.earth.special)) {
                        push(elementMap.earth.special);
                        const partner = group.find((x) => x !== elementMap.earth.special);
                        if (partner) push(partner);
                    } else {
                        push(id);
                        for (const other of group.filter((x) => x !== id).slice(0, 2)) {
                            if (result.length < 5) push(other);
                        }
                    }
                } else if (id < elementMap.fire.max) {
                    const group = aliveTitans.fire.map((t) => normalize(t.id));
                    if (group.includes(elementMap.fire.special)) {
                        push(elementMap.fire.special);
                        const partner = group.find((x) => x !== elementMap.fire.special);
                        if (partner) push(partner);
                    } else {
                        push(id);
                        for (const other of group.filter((x) => x !== id).slice(0, 2)) {
                            if (result.length < 5) push(other);
                        }
                    }
                } else if (id < elementMap.dark.max) {
                    push(id);
                    const partner = aliveTitans.dark.map((t) => normalize(t.id)).find((x) => x !== id);
                    if (partner) push(partner);
                } else if (id < elementMap.light.max) {
                    push(id);
                    const partner = aliveTitans.light.map((t) => normalize(t.id)).find((x) => x !== id);
                    if (partner) push(partner);
                }
            }
            if (result.length < 5) {
                for (const titan of aliveTitans.all) {
                    if (result.length >= 5) break;
                    push(titan.id);
                }
            }
            return result;
        }

        function getDeads(option) {
            const after = option.progress?.[0]?.attackers?.heroes || {};
            return option.heroes.length + Number(!!option.pet) - Object.keys(after).length;
        }

        function checkTitanSurvival(titanId, energy, percentHP) {
            const s = titanHealthSettings || defaultTitanHealthSettings;
            const id = String(titanId);
            switch (id) {
                case '4020': // Angus
                    return percentHP > (s.titan4020HP ?? 0.4)
                        || (energy >= 1000 && percentHP > (s.titan4020EnergyHP ?? 0.2));
                case '4010': // Moloch
                    return percentHP + energy / 2000.0 > (s.titan4010Combined ?? 0.67);
                case '4000': // Sigurd
                    return percentHP > (s.titan4000HP ?? 0.63)
                        || (energy < 1000 && (
                            (percentHP > (s.titan4000Energy400HP ?? 0.45) && energy >= 400)
                            || (percentHP > (s.titan4000Energy670HP ?? 0.34) && energy >= 670)
                        ));
                default:
                    return true;
            }
        }

        function passesDungeonSurvival(option) {
            if (!option?.result?.win) {
                return false;
            }
            if (option.result.stars != null && option.result.stars < 3) {
                return false;
            }
            if (getDeads(option) > 0) {
                return false;
            }
            if (titanHealthSettings.enforceTankSurvival === false) {
                return true;
            }
            const beforeTitans = option.battleData?.attackers || {};
            const afterTitans = option.progress?.[0]?.attackers?.heroes || {};
            for (const [id, titan] of Object.entries(afterTitans)) {
                const before = beforeTitans[id] || beforeTitans[Number(id)];
                const maxHp = before?.hp || titan.hp || 1;
                const percentHP = titan.hp / maxHp;
                const energy = titan.energy ?? 0;
                if (!checkTitanSurvival(id, energy, percentHP)) {
                    return false;
                }
            }
            return true;
        }

        function getElementalPool(aliveTitans, attackerType) {
            let pool = [...(aliveTitans[attackerType] || aliveTitans.all || [])];
            if (titanHealthSettings.excludeFragileElemental) {
                const fragileId = FRAGILE_ELEMENTAL_TITANS[attackerType];
                if (fragileId) {
                    pool = pool.filter((t) => Number(t.id) !== fragileId);
                }
            }
            return pool;
        }

        async function evaluateElementalDoor(teamNum, attackerType, aliveTitans) {
            const pool = getElementalPool(aliveTitans, attackerType);
            if (!pool.length) {
                return null;
            }

            const maxSize = Math.min(5, pool.length);
            const shouldShrink = titanHealthSettings.shrinkEarthFireTeams !== false
                && (attackerType === 'earth' || attackerType === 'fire');
            const minSize = shouldShrink ? Math.min(2, maxSize) : maxSize;

            let bestSafe = null;
            let bestWin = null;
            for (let size = maxSize; size >= minSize; size--) {
                if (stopDung || end) {
                    break;
                }
                const heroes = pool.slice(0, size).map((t) => Number(t.id));
                const option = await startAndSimulate(teamNum, heroes, null, attackerType);
                if (!option?.win) {
                    if (DUNGEON_VERBOSE) {
                        console.log(`[Dungeon] ${attackerType} size ${size}: no win`);
                    }
                    continue;
                }
                option.passesSurvival = passesDungeonSurvival(option);
                if (option.passesSurvival) {
                    if (!bestSafe || isOptionBetter(bestSafe, option)) {
                        bestSafe = option;
                        if (DUNGEON_VERBOSE) {
                            console.log(`[Dungeon] ${attackerType} size ${size}: accepted candidate`);
                        }
                    }
                    // Full team that passes survival is preferred; stop shrinking early.
                    if (size === maxSize) {
                        break;
                    }
                } else {
                    if (DUNGEON_VERBOSE) {
                        console.log(`[Dungeon] ${attackerType} size ${size}: win but failed survival checks`);
                    }
                    if (!bestWin || isOptionBetter(bestWin, option)) {
                        bestWin = option;
                    }
                }
            }
            return bestSafe || bestWin;
        }

        function debugString(option, attackerType) {
            if (!option) return 'INVALID';
            let s = `[${option.teamNum}]${attackerType}`;
            s += option.result?.win ? ' OK' : ' FAIL';
            const damage = option.heroes.length ? (option.state / option.heroes.length) * 100 : 0;
            s += ` dmg:${damage.toFixed(0)}% dead:${getDeads(option)}`;
            return s;
        }

        function isOptionBetter(bestOption, thisOption) {
            if (!thisOption) return false;
            if (!bestOption) return true;
            const bestTeam = bestOption.heroes || [];
            const thisTeam = thisOption.heroes || [];
            if (thisTeam.length !== bestTeam.length) {
                return thisTeam.length > bestTeam.length;
            }
            const bestState = bestOption.state ?? 0;
            const thisState = thisOption.state ?? 0;
            const bestNorm = bestTeam.length ? bestState * bestTeam.length : 0;
            const thisNorm = thisTeam.length ? thisState * thisTeam.length : 0;
            return thisNorm > bestNorm;
        }

        function isHealingSuccessful(healingTeam, progress, states) {
            const afterHeroes = progress?.[0]?.attackers?.heroes;
            if (!afterHeroes) return false;
            return healingTeam.filter((id) => id >= 4010).every((id) => {
                const after = afterHeroes[id];
                return after && after.hp > (states[id]?.hp || states[String(id)]?.hp || 0);
            });
        }

        function createBattleArgs(teamNum, heroes, pet, favor = {}) {
            return {
                name: 'dungeonStartBattle',
                args: {
                    heroes,
                    favor: favor || {},
                    teamNum: Number(teamNum),
                    ...(pet ? { pet } : {}),
                },
                ident: 'body',
            };
        }

        async function startAndSimulateOnce(teamNum, heroes, pet, attackerType, favor = {}, bruteforceMs = EVAL_BRUTEFORCE_MS) {
            const raw = await Send({ calls: [createBattleArgs(teamNum, heroes, pet, favor)] });
            const apiResult = getApiResult(raw);
            if (apiResult?.error || apiResult?.validation) {
                const errMsg = apiResult.validation
                    ? JSON.stringify(apiResult.validation)
                    : (typeof apiResult.error === 'string'
                        ? apiResult.error
                        : `${apiResult.error?.name || apiResult.error?.title || 'Error'}: ${apiResult.error?.description || apiResult.error?.title || ''}`);
                console.warn(`[Dungeon] dungeonStartBattle failed (${attackerType}, team ${teamNum}):`, errMsg, raw);
                setBattleOpen(false);
                return null;
            }
            const battleData = apiResult?.response;
            if (!battleData) {
                console.warn(`[Dungeon] dungeonStartBattle empty response (${attackerType}, team ${teamNum})`, raw);
                setBattleOpen(false);
                return null;
            }

            lastStartedTeamNum = teamNum;
            battleStartTime = Date.now();
            setBattleOpen(true);

            try {
                const option = await simulateOnBattleData(
                    battleData,
                    teamNum,
                    heroes,
                    pet,
                    attackerType,
                    favor,
                    {
                        bruteforceMs,
                        maxTimerTries: MAX_TIMER_TRIES,
                    }
                );
                if (option?.win) {
                    option.passesSurvival = passesDungeonSurvival(option);
                }
                return option;
            } catch (err) {
                console.warn(`[Dungeon] BattleCalc failed (${attackerType}, team ${teamNum}):`, err);
                setBattleOpen(false);
                return null;
            }
        }

        async function startAndSimulate(teamNum, heroes, pet, attackerType, favor = {}, bruteforceMs = EVAL_BRUTEFORCE_MS) {
            const first = await startAndSimulateOnce(teamNum, heroes, pet, attackerType, favor, bruteforceMs);
            if (first) {
                return first;
            }
            await sleep(500);
            return startAndSimulateOnce(teamNum, heroes, pet, attackerType, favor, bruteforceMs);
        }

        function isNotFoundError(err) {
            if (!err) {
                return false;
            }
            if (typeof err === 'string') {
                return /not\s*found|NotFound/i.test(err);
            }
            const name = String(err.name || err.title || '');
            const desc = String(err.description || err.message || '');
            return /not\s*found|NotFound/i.test(name) || /not\s*found|NotFound/i.test(desc);
        }

        function setBattleOpen(isOpen) {
            setDungeonBattleOpen(isOpen);
        }

        function wrapBattleOption(teamNum, heroes, pet, favor, battle, battleData, handler, handlerResult) {
            const wrapped = {
                ...battle,
                battleData: battle.battleData ?? battleData,
            };
            return {
                teamNum,
                heroes,
                pet,
                favor,
                result: wrapped.result,
                progress: wrapped.progress,
                timer: getTimer(wrapped.battleTime ?? handlerResult.timer ?? 0),
                battleTime: wrapped.battleTime,
                simTimer: battle.timer ?? battle.battleTime ?? handlerResult.timer ?? 0,
                win: wrapped.result?.win,
                state: handler.getState(wrapped),
            };
        }

        async function simulateOnBattleData(battleData, teamNum, heroes, pet, attackerType, favor, simOpts = {}) {
            const isBruteForceBattle = attackerType !== 'hero';
            const battleType = battleData.type === 'dungeon_titan' ? 'get_titan' : 'get_tower';
            const handler = new DungeonBattleHandler(battleData, battleType);
            lastBattleHandler = handler;
            const maxTimerTries = simOpts.maxTimerTries ?? MAX_TIMER_TRIES;

            const handlerResult = await runBattleHandler(
                handler,
                isBruteForceBattle,
                isBruteForceBattle,
                {
                    bruteforceMs: simOpts.bruteforceMs ?? BRUTEFORCE_MS,
                    maxTimerTries,
                }
            );
            const battle = handlerResult.bestBattle ?? handlerResult.initBattle;
            if (!battle?.result) {
                setBattleOpen(false);
                return null;
            }
            return wrapBattleOption(teamNum, heroes, pet, favor, battle, battleData, handler, handlerResult);
        }

        async function waitForBattleFullTimer(option, debug = '') {
            const predictionCards = Math.max(0, Math.floor(Number(window.HWHData?.countPredictionCard)) || 0);
            if (predictionCards > 0) {
                return;
            }
            const totalTimer = Math.ceil(option.timer ?? getTimer(option.battleTime ?? 0));
            if (totalTimer <= 0) {
                return;
            }
            if (DUNGEON_VERBOSE) {
                console.log('[Dungeon] battle wait:', totalTimer, 's', debug || '');
            }
            const msg = `${I18N('DUNGEON')}: ${I18N('TITANIT')} ${dungeonActivity}/${maxDungeonActivity}${debug ? ' | ' + debug : ''} ${talentMsg}`;
            await countdownTimer(totalTimer, msg);
        }

        async function executeChosenOption(option, attackerType, doorCount, debug = '', skipRestart = false) {
            if (stopDung || end) {
                return false;
            }
            let finalOption = option;
            if (!skipRestart && option.teamNum !== doorCount - 1) {
                const restarted = await startAndSimulate(
                    option.teamNum,
                    option.heroes,
                    option.pet,
                    attackerType,
                    option.favor || {},
                    RESTART_BRUTEFORCE_MS
                );
                if (!restarted?.win) {
                    lastError = 'Restart failed';
                    endDungeon(lastError);
                    return false;
                }
                finalOption = restarted;
                lastDebugString += debugString(restarted, attackerType) + ' [restart]';
                if (DUNGEON_VERBOSE) console.log('[Dungeon]', lastDebugString);
            }
            await waitForBattleFullTimer(finalOption, debug);
            if (stopDung || end) {
                return false;
            }
            return endBattleOption(finalOption, attackerType);
        }

        async function endBattleOption(option, attackerType, isRetry = false) {
            if (!option?.result?.win) {
                endDungeon('Hero or Titan may have died in battle!', option);
                return false;
            }
            const args = {
                result: option.result,
                progress: option.progress,
            };
            const predictionCards = Math.max(0, Math.floor(Number(window.HWHData?.countPredictionCard)) || 0);
            if (predictionCards > 0) {
                args.isRaid = true;
            }

            let e;
            try {
                e = await Send({ calls: [{ name: 'dungeonEndBattle', args, ident: 'body' }] });
            } catch (err) {
                setBattleOpen(false);
                if (!isRetry && isNotFoundError(err)) {
                    return retryEndBattleAfterNotFound(option, attackerType);
                }
                endDungeon('errorRequest', err);
                return false;
            }

            if (e?.error) {
                if (isNotFoundError(e.error)) {
                    setBattleOpen(false);
                    if (!isRetry) {
                        return retryEndBattleAfterNotFound(option, attackerType);
                    }
                    console.warn('[Dungeon] Battle not found after retry, refreshing floor state...', e.error);
                    return true;
                }
                setBattleOpen(false);
                endDungeon('errorRequest', e.error);
                return false;
            }

            if (!e?.results) {
                setBattleOpen(false);
                endDungeon('Lost connection to game server!', 'break');
                return false;
            }

            const result = e.results[0]?.result;
            if (!result) {
                setBattleOpen(false);
                if (!isRetry && isNotFoundError(e)) {
                    return retryEndBattleAfterNotFound(option, attackerType);
                }
                endDungeon('errorRequest', 'empty dungeonEndBattle result');
                return false;
            }
            if (result.error) {
                if (isNotFoundError(result.error)) {
                    setBattleOpen(false);
                    if (!isRetry) {
                        return retryEndBattleAfterNotFound(option, attackerType);
                    }
                    console.warn('[Dungeon] Battle not found in result after retry, refreshing floor state...', result.error);
                    return true;
                }
                setBattleOpen(false);
                endDungeon('errorBattleResult', result.error);
                return false;
            }

            const battleResult = result.response;
            if (!battleResult) {
                setBattleOpen(false);
                console.warn('[Dungeon] No battle result, continuing...');
                return true;
            }

            if (battleResult.error) {
                setBattleOpen(false);
                if (isNotFoundError(battleResult.error)) {
                    if (!isRetry) {
                        return retryEndBattleAfterNotFound(option, attackerType);
                    }
                    return true;
                }
                endDungeon('errorBattleResult', battleResult);
                return false;
            }

            setBattleOpen(false);

            if (!battleResult.dungeon && !battleResult.floor) {
                try {
                    await Send({ calls: [{ name: 'dungeonSaveProgress', args: {}, ident: 'body' }] });
                } catch (_) { /* ignore */ }
            }

            dungeonActivity += battleResult.reward?.dungeonActivity ?? 0;
            return true;
        }

        async function retryEndBattleAfterNotFound(option, attackerType) {
            console.warn('[Dungeon] NotFound on end battle — restarting battle on server and retrying once');
            const refreshed = await startAndSimulate(
                option.teamNum,
                option.heroes,
                option.pet,
                attackerType,
                option.favor || {},
                RESTART_BRUTEFORCE_MS
            );
            if (!refreshed?.win) {
                lastError = 'NotFound recovery failed (could not restart battle)';
                return false;
            }
            await waitForBattleFullTimer(refreshed);
            return endBattleOption(refreshed, attackerType, true);
        }

        async function checkTalent(dungeonInfo) {
            const talent = dungeonInfo.talent;
            if (!talent) return;
            const dungeonFloor = +dungeonInfo.floorNumber;
            const talentFloor = +talent.floorRandValue;
            let doorsAmount = 3 - talent.conditions.doorsAmount;
            if (dungeonFloor === talentFloor && (!doorsAmount || !talent.conditions?.farmedDoors[dungeonFloor])) {
                const rewardRes = await Send({
                    calls: [
                        { name: 'heroTalent_getReward', args: { talentType: 'tmntDungeonTalent', reroll: false }, ident: 'group_0_body' },
                        { name: 'heroTalent_farmReward', args: { talentType: 'tmntDungeonTalent' }, ident: 'group_1_body' },
                    ],
                });
                const reward = rewardRes.results[0].result.response;
                const type = Object.keys(reward).pop();
                const itemId = Object.keys(reward[type]).pop();
                const count = reward[type][itemId];
                const itemName = cheats.translate(`LIB_${type.toUpperCase()}_NAME_${itemId}`);
                talentMsgReward += `<br> ${count} ${itemName}`;
                doorsAmount++;
            }
            talentMsg = `<br>TMNT Talent: ${doorsAmount}/3 ${talentMsgReward}<br>`;
        }

        async function fetchDungeonData(retries = 3) {
            for (let attempt = 1; attempt <= retries; attempt++) {
                const result = await Send({ calls: [{ name: 'dungeonGetInfo', args: {}, ident: 'dungeonGetInfo' }] });
                if (Array.isArray(result.results)) {
                    const dungeonGetInfo = getResponse(result);
                    if (dungeonGetInfo) {
                        lastError = null;
                        return { dungeonGetInfo };
                    }
                    lastError = 'No dungeon data';
                } else {
                    lastError = 'Error fetching dungeonGetInfo';
                }
                if (attempt < retries) {
                    console.warn(`[Dungeon] fetchDungeonData attempt ${attempt}/${retries} failed, retrying...`);
                    await sleep(500);
                }
            }
            return null;
        }

        async function handleRestart(dungeonGetInfo) {
            if (!dungeonGetInfo.floor && !isRestart) {
                isRestart = true;
                await Send({ calls: [{ name: 'dungeonSaveProgress', args: {}, ident: 'body' }] });
                return true;
            }
            if (isRestart) {
                lastError = 'Error in dungeonGetInfo: missing floor';
                return false;
            }
            isRestart = false;
            return false;
        }

        async function runStep() {
            const stepStart = Date.now();
            if (STEP_DELAY_MS > 0) {
                await sleep(STEP_DELAY_MS);
            }
            if (!isRestart) {
                lastDebugString = '';
            }

            maxDungeonActivity = getInput('countTitanit') || maxDungeonActivity;
            setProgress(`${I18N('DUNGEON')}: ${I18N('TITANIT')} ${dungeonActivity}/${maxDungeonActivity} ${talentMsg}`, true);

            if (dungeonActivity >= maxDungeonActivity) {
                endDungeon('Dungeon stopped,', 'titanite collected: ' + dungeonActivity + '/' + maxDungeonActivity);
                return false;
            }
            if (stopDung) {
                endDungeon('Dungeon stopped,', 'titanite collected: ' + dungeonActivity + '/' + maxDungeonActivity);
                return false;
            }

            const data = await fetchDungeonData();
            if (!data) {
                return false;
            }
            if (titansList.length === 0) {
                lastError = lastError || 'No titans loaded';
                return false;
            }

            const { dungeonGetInfo } = data;

            if (!('floor' in dungeonGetInfo) || dungeonGetInfo.floor?.state === 2) {
                await Send({ calls: [{ name: 'dungeonSaveProgress', args: {}, ident: 'body' }] });
                endDungeon('Dungeon completed,', 'floor saved');
                return false;
            }

            const didRestart = await handleRestart(dungeonGetInfo);
            if (didRestart) {
                return true;
            }
            if (lastError) {
                return false;
            }

            await checkTalent(dungeonGetInfo);

            if (!dungeonGetInfo.elements) {
                lastError = 'Error in dungeonGetInfo: missing primeElement';
                endDungeon(lastError);
                return false;
            }
            if (!dungeonGetInfo.states) {
                lastError = 'Error in dungeonGetInfo: missing states';
                endDungeon(lastError);
                return false;
            }

            const userData = dungeonGetInfo.floor?.userData;
            if (!userData) {
                consecutiveNoWin++;
                console.warn(`[Dungeon] Missing floor userData, retrying (${consecutiveNoWin}/${NO_WIN_RETRIES})`);
                if (consecutiveNoWin <= NO_WIN_RETRIES) {
                    await sleep(1000);
                    return true;
                }
                lastError = 'No dungeon data';
                return false;
            }

            const states = dungeonGetInfo.states.titans;
            const aliveTitans = getTitans(titansList, states);
            const heroBattleIndex = userData.findIndex((ud) => ud.attackerType === 'hero');
            if (heroBattleIndex !== -1) {
                const heroBattle = getHeroTeamForBattle(dungeonGetInfo.states?.heroes);
                if (!heroBattle) {
                    lastError = 'No alive heroes for hero battle';
                    endDungeon(lastError);
                    return false;
                }
                const option = await startAndSimulate(
                    heroBattleIndex,
                    heroBattle.heroes,
                    heroBattle.pet,
                    'hero',
                    heroBattle.favor
                );
                if (!option) {
                    consecutiveNoWin++;
                    console.warn(`[Dungeon] Hero battle start/sim failed, retrying (${consecutiveNoWin}/${NO_WIN_RETRIES})`);
                    if (consecutiveNoWin <= NO_WIN_RETRIES) {
                        await sleep(1200);
                        return true;
                    }
                    lastError = 'Failed to start hero battle (check console for API/BattleCalc details)';
                    endDungeon(lastError);
                    return false;
                }
                if (!option.result?.win) {
                    lastError = 'Hero battle would lose';
                    endDungeon(lastError, option);
                    return false;
                }
                lastDebugString += debugString(option, 'hero');
                if (DUNGEON_VERBOSE) console.log('[Dungeon]', lastDebugString);
                await waitForBattleFullTimer(option, lastDebugString);
                if (stopDung || end) {
                    return false;
                }
                const ok = await endBattleOption(option, 'hero');
                timeDungeon.steps += Date.now() - stepStart;
                return ok !== false;
            }

            const options = [];
            for (let teamNum = 0; teamNum < userData.length; teamNum++) {
                if (stopDung) break;
                const { attackerType } = userData[teamNum];
                let team = null;
                let useHealingIndex = 0;

                if (attackerType === 'neutral') {
                    if (isAbleToHeal) {
                        let healingTeam = null;
                        let healingOption = null;
                        while (true) {
                            healingTeam = getTitansForPotentialHealingTeam(aliveTitans, states, useHealingIndex);
                            if (!healingTeam) break;
                            healingOption = await startAndSimulate(teamNum, healingTeam, null, attackerType);
                            if (!healingOption?.win) {
                                useHealingIndex++;
                                continue;
                            }
                            if (isHealingSuccessful(healingTeam, healingOption.progress, states) && getDeads(healingOption) === 0) {
                                team = { heroes: healingTeam, pet: null, isHealing: true, option: healingOption };
                                break;
                            }
                            useHealingIndex++;
                        }
                    }
                    if (!team) {
                        const neutralTeam = getNeutralTitans(aliveTitans, !isAbleToHeal);
                        team = neutralTeam.length > 0 ? { heroes: neutralTeam, pet: null } : null;
                    }
                } else {
                    const elementalOption = await evaluateElementalDoor(teamNum, attackerType, aliveTitans);
                    if (elementalOption?.win) {
                        options.push({
                            option: elementalOption,
                            attackerType,
                            passesSurvival: elementalOption.passesSurvival !== false,
                        });
                    } else {
                        options.push(null);
                    }
                    continue;
                }

                if (!team) {
                    options.push(null);
                    continue;
                }

                const option = team.option || (await startAndSimulate(teamNum, team.heroes, team.pet, attackerType, team.favor || {}));
                if (!option?.win) {
                    options.push(null);
                    continue;
                }

                if (team.isHealing && option.win) {
                    lastDebugString += debugString(option, attackerType) + ' [heal]';
                    if (DUNGEON_VERBOSE) console.log('[Dungeon]', lastDebugString);
                    const ok = await executeChosenOption(option, attackerType, userData.length, lastDebugString, true);
                    timeDungeon.steps += Date.now() - stepStart;
                    return ok !== false;
                }
                if (team.isHealing) {
                    const fallback = getNeutralTitans(aliveTitans);
                    if (fallback.length > 0) {
                        const fallbackOption = await startAndSimulate(teamNum, fallback, null, attackerType);
                        options.push(fallbackOption?.win
                            ? {
                                option: fallbackOption,
                                attackerType,
                                passesSurvival: fallbackOption.passesSurvival !== false && passesDungeonSurvival(fallbackOption),
                            }
                            : null);
                    } else {
                        options.push(null);
                    }
                    continue;
                }
                if (option.passesSurvival == null) {
                    option.passesSurvival = passesDungeonSurvival(option);
                }
                if (!option.passesSurvival) {
                    console.warn(`[Dungeon] ${attackerType} door ${teamNum}: win but failed survival checks`);
                }
                options.push({ option, attackerType, passesSurvival: option.passesSurvival });
            }

            const winning = options.filter((v) => v?.option?.win);
            const valid = winning.filter((v) => v.passesSurvival !== false);
            if (valid.length === 0) {
                consecutiveNoWin++;
                const doorSummary = userData.map((ud, i) => {
                    const picked = options[i];
                    if (!picked?.option) return `${ud.attackerType}:none`;
                    return `${ud.attackerType}:${picked.option.win ? 'win' : 'lose'}${picked.passesSurvival ? '' : '/unsafe'}`;
                }).join(', ');
                console.warn(`[Dungeon] No survival-safe door (${consecutiveNoWin}/${NO_WIN_RETRIES}): ${doorSummary}`);
                if (consecutiveNoWin <= NO_WIN_RETRIES) {
                    HWHFuncs.setProgress(
                        `${I18N('DUNGEON')}: retrying floor (${consecutiveNoWin}/${NO_WIN_RETRIES}) ${dungeonActivity}/${maxDungeonActivity}`,
                        true
                    );
                    await sleep(1200);
                    return true;
                }
                if (winning.length > 0) {
                    console.warn('[Dungeon] Survival checks blocked all doors — using best winning fight instead of stopping');
                    winning.forEach((v) => { v.passesSurvival = true; });
                    valid.push(...winning);
                } else {
                    lastError = 'No winnable battles available';
                    endDungeon(lastError);
                    return false;
                }
            }
            consecutiveNoWin = 0;

            if (valid.length > 1) {
                lastDebugString += valid.map((v) => debugString(v.option, v.attackerType)).join(' | ');
            } else {
                lastDebugString += debugString(valid[0].option, valid[0].attackerType);
            }

            const best = valid.length === 1
                ? valid[0]
                : valid.reduce((b, cur) => (isOptionBetter(b?.option, cur?.option) ? cur : b));

            if (!best?.option) {
                lastError = 'No best battle found';
                endDungeon(lastError);
                return false;
            }

            lastDebugString += ` -> ${best.option.teamNum} `;

            if (DUNGEON_VERBOSE) console.log('[Dungeon]', lastDebugString);
            const ok = await executeChosenOption(best.option, best.attackerType, userData.length, lastDebugString);
            stepCount++;
            timeDungeon.steps += Date.now() - stepStart;
            return ok !== false;
        }

        function showStats() {
            if (!DUNGEON_VERBOSE) return;
            const activity = dungeonActivity - startDungeonActivity;
            const totalSec = Math.round((Date.now() - timeDungeon.all) / 1000);
            console.log('[Dungeon] Titanite collected:', activity);
            console.log('[Dungeon] Steps:', stepCount);
            if (totalSec > 0) {
                console.log('[Dungeon] Speed:', Math.round((3600 * activity) / totalSec), 'titanite/hour');
            }
            console.log('[Dungeon] Sim time (ms):', timeDungeon.steps);
        }

        function endDungeon(reason, info) {
            if (end) return;
            end = true;
            dungeonRunning = false;
            window.HWH_DUNGEON_RUNNING = false;
            setBattleOpen(false);
            console.log('[Dungeon]', reason, info != null && info !== '' ? info : '');
            showStats();
            if (info === 'break') {
                setProgress(
                    'Dungeon stopped: Titanite ' + dungeonActivity + '/' + maxDungeonActivity + '\r\nLost connection to game server!',
                    false,
                    hideProgress
                );
            } else {
                setProgress('Dungeon completed: Titanite ' + dungeonActivity + '/' + maxDungeonActivity, false, hideProgress);
            }
            const reasonText = String(reason || '');
            const shouldRefresh = reasonText.includes('titanite collected')
                || reasonText.includes('floor saved')
                || reasonText.includes('Dungeon completed');
            if (shouldRefresh) {
                if (titanHealthSettings.autoRefreshPage) {
                    setTimeout(() => location.reload(), 1000);
                } else {
                    setTimeout(cheats.refreshGame, 1000);
                }
            }
            resolve();
        }

        async function initialize() {
            const res = await Send({
                calls: [
                    { name: 'dungeonGetInfo', args: {}, ident: 'dungeonGetInfo' },
                    { name: 'teamGetAll', args: {}, ident: 'teamGetAll' },
                    { name: 'teamGetFavor', args: {}, ident: 'teamGetFavor' },
                    { name: 'clanGetInfo', args: {}, ident: 'clanGetInfo' },
                    { name: 'titanGetAll', args: {}, ident: 'titanGetAll' },
                    { name: 'inventoryGet', args: {}, ident: 'inventoryGet' },
                ],
            });

            const dungeonGetInfo = res.results[0]?.result?.response;
            if (!dungeonGetInfo) {
                lastError = 'noDungeon';
                return false;
            }

            teamGetAll = res.results[1]?.result?.response;
            teamGetFavor = res.results[2]?.result?.response;
            const clanStat = res.results[3]?.result?.response?.stat;
            const dungeonStat = dungeonGetInfo?.stat;
            const todayAct = clanStat?.todayDungeonActivity ?? dungeonStat?.todayDungeonActivity ?? 0;
            dungeonActivity = todayAct;
            startDungeonActivity = todayAct;
            syncPredictionCardsFromInventory(res.results[5]);

            const titanRaw = res.results[4]?.result?.response;
            titansList = Array.isArray(titanRaw)
                ? titanRaw
                : Object.values(titanRaw || {}).filter((t) => t && t.id != null);

            const layout = getTitans(titansList);
            const waterPower = layout.water.reduce((a, b) => a + (b.power || 0), 0);
            const earthPower = layout.earth.reduce((a, b) => a + (b.power || 0), 0);
            const firePower = layout.fire.reduce((a, b) => a + (b.power || 0), 0);
            const waterStrongest = waterPower >= earthPower && waterPower >= firePower;
            const waterWithin25Percent = earthPower <= waterPower * 1.25 && firePower <= waterPower * 1.25;
            isAbleToHeal = waterStrongest || waterWithin25Percent;

            if (DUNGEON_VERBOSE) {
                console.log('[Dungeon] Water', waterPower, '| Earth', earthPower, '| Fire', firePower, '| canHeal:', isAbleToHeal);
                console.log('[Dungeon] Starting full dungeon run:', new Date());
                console.log('[Dungeon] Settings:', {
                    excludeFragileElemental: !!titanHealthSettings.excludeFragileElemental,
                    shrinkEarthFireTeams: titanHealthSettings.shrinkEarthFireTeams !== false,
                    enforceTankSurvival: titanHealthSettings.enforceTankSurvival !== false,
                });
            }
            return true;
        }

        this.start = async function (titanit) {
            await waitForAutoBattleIdle();
            if (window.HWH_AUTOBATTLE_RUNNING) {
                lastError = 'AutoBattle still running — dungeon aborted to avoid API conflict';
                endDungeon(lastError);
                return;
            }

            maxDungeonActivity = titanit || getInput('countTitanit');
            stopDung = false;
            end = false;
            isRestart = false;
            lastError = null;
            lastStartedTeamNum = -1;
            battleStartTime = 0;
            stepCount = 0;
            consecutiveNoWin = 0;
            dungeonRunning = true;
            window.HWH_DUNGEON_RUNNING = true;
            timeDungeon = { all: Date.now(), steps: 0 };

            try {
                const ok = await initialize();
                if (!ok) {
                    endDungeon('Failed to initialize dungeon', lastError);
                    return;
                }
                while (!end && !stopDung) {
                    const success = await runStep();
                    if (!success) {
                        if (lastError && !end) {
                            endDungeon(lastError);
                        }
                        break;
                    }
                }
                if (!end && stopDung) {
                    endDungeon('Dungeon stopped,', 'titanite collected: ' + dungeonActivity + '/' + maxDungeonActivity);
                } else if (!end && !lastError) {
                    console.warn('[Dungeon] Run loop ended without error (possible silent stop)');
                }
            } catch (err) {
                console.error('[Dungeon] Fatal error:', err);
                endDungeon('Fatal dungeon error', err);
                reject(err);
            } finally {
                if (dungeonRunning) {
                    dungeonRunning = false;
                    window.HWH_DUNGEON_RUNNING = false;
                }
            }
        };
    }

    async function executeTestDungeon() {
        const { HWHClasses, HWHFuncs } = window;

        await waitForAutoBattleIdle();
        if (window.HWH_AUTOBATTLE_RUNNING) {
            console.warn('[Dungeon] AutoBattle still running — aborting dungeon start');
            HWHFuncs.setProgress('Dungeon: AutoBattle still running', true);
            return;
        }

        if (dungeonRunning || window.HWH_DUNGEON_RUNNING || window.HWH_DUNGEON_BATTLE_OPEN) {
            console.warn('[Dungeon] Already running — ignoring duplicate start');
            HWHFuncs.setProgress('Dungeon: already running', true);
            return;
        }
        dungeonRunning = true;
        window.HWH_DUNGEON_RUNNING = true;

        if (window.HWHClasses && typeof executeDungeon === 'function') {
            window.HWHClasses.executeDungeon = executeDungeon;
        }

        const dungeonRunTimeoutMs = Math.max(
            20 * 60 * 1000,
            Number(window.HWH_DUNGEON_RUN_TIMEOUT_MS) || 10 * 60 * 60 * 1000
        );

        try {
            const hasStealtherDungeon = await waitFor(() => typeof executeDungeon === 'function', { timeoutMs: 15000, intervalMs: 200 });
            if (hasStealtherDungeon) {
                HWHFuncs.setProgress('Executing: Dungeon (Stealther)', true);
                return await withTimeout(
                    new Promise((resolve, reject) => {
                        try {
                            const dung = new executeDungeon(resolve, reject);
                            Promise.resolve(dung.start()).catch(reject);
                        } catch (e) {
                            reject(e);
                        }
                    }),
                    dungeonRunTimeoutMs,
                    'Dungeon timed out'
                );
            }

            const hasNativeDungeon = await waitFor(() => typeof window.testDungeon === 'function', { timeoutMs: 5000, intervalMs: 200 });
            if (hasNativeDungeon) {
                HWHFuncs.setProgress('Executing: Dungeon (native fallback)', true);
                return await withTimeout(window.testDungeon(), dungeonRunTimeoutMs, 'Dungeon timed out');
            }

            throw new Error('Dungeon API not ready (missing executeDungeon/testDungeon)');
        } catch (err) {
            stopDung = true;
            dungeonRunning = false;
            window.HWH_DUNGEON_RUNNING = false;
            setDungeonBattleOpen(false);
            throw err;
        }
    }

    // --- DUNGEON SETTINGS GUI ---
    function createDungeonSettingsGUI() {
        if (document.getElementById('titanSettingsGUI')) {
            ensureDungeonSettingsToggle();
            return; // Already created
        }

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
            #titanSettingsGUI #resetTitanSettings {
                background-color: #FF6347;
                width: fit-content;
                margin: 10px auto 0;
                display: block;
                padding: 8px 12px;
                font-size: 14px;
                border-radius: 5px;
            }
            #titanSettingsGUI #resetTitanSettings:hover {
                background-color: #e5533d;
            }
            #titanSettingsGUI .setting-check {
                display: flex;
                align-items: flex-start;
                gap: 8px;
                margin-bottom: 8px;
            }
            #titanSettingsGUI .setting-check input[type="checkbox"] {
                margin-top: 3px;
                flex-shrink: 0;
            }
            #titanSettingsGUI .setting-check label {
                display: inline;
                font-weight: normal;
                color: #E0E0E0;
                margin-bottom: 0;
            }
            #titanSettingsGUI .setting-hint {
                display: block;
                font-size: 11px;
                color: #9fb3d1;
                margin-top: 2px;
                font-weight: normal;
            }
        `;
        document.head.appendChild(style);

        const gui = document.createElement('div');
        gui.id = 'titanSettingsGUI';
        gui.innerHTML = `
            <h3>Dungeon Cutoff Settings 1.1.0</h3>
            <div class="setting-check">
                <input type="checkbox" id="autoRefreshPage">
                <label for="autoRefreshPage">Refresh(F5) after dungeon</label>
            </div>
            <h4>Team building</h4>
            <div class="setting-check">
                <input type="checkbox" id="excludeFragileElemental">
                <label for="excludeFragileElemental">
                    Exclude fragile titans on elemental doors
                    <span class="setting-hint">Tidus / Asherona / Verdoc — off by default (they're strong). Turn on if long farms keep dying.</span>
                </label>
            </div>
            <div class="setting-check">
                <input type="checkbox" id="shrinkEarthFireTeams">
                <label for="shrinkEarthFireTeams">
                    Shrink earth/fire teams when unsafe
                    <span class="setting-hint">Try 5→4→3→2 titans if full team fails survival checks.</span>
                </label>
            </div>
            <div class="setting-check">
                <input type="checkbox" id="enforceTankSurvival">
                <label for="enforceTankSurvival">
                    Enforce tank HP/energy cutoffs
                    <span class="setting-hint">Reject sims that leave Angus / Moloch / Sigurd too low.</span>
                </label>
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
            <button id="resetTitanSettings" type="button">Reset to Defaults</button>
        `;
        document.body.appendChild(gui);

        const resetButton = document.getElementById('resetTitanSettings');
        gui.style.display = 'none';

        function updateGUIFields() {
            document.getElementById('minOverallHP').value = titanHealthSettings.minOverallHP * 100;
            document.getElementById('titan4020HP').value = titanHealthSettings.titan4020HP * 100;
            document.getElementById('titan4020EnergyHP').value = titanHealthSettings.titan4020EnergyHP * 100;
            document.getElementById('titan4010Combined').value = titanHealthSettings.titan4010Combined * 100;
            document.getElementById('titan4000HP').value = titanHealthSettings.titan4000HP * 100;
            document.getElementById('titan4000Energy400HP').value = titanHealthSettings.titan4000Energy400HP * 100;
            document.getElementById('titan4000Energy670HP').value = titanHealthSettings.titan4000Energy670HP * 100;
            document.getElementById('autoRefreshPage').checked = !!titanHealthSettings.autoRefreshPage;
            document.getElementById('excludeFragileElemental').checked = !!titanHealthSettings.excludeFragileElemental;
            document.getElementById('shrinkEarthFireTeams').checked = titanHealthSettings.shrinkEarthFireTeams !== false;
            document.getElementById('enforceTankSurvival').checked = titanHealthSettings.enforceTankSurvival !== false;
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
            titanHealthSettings.excludeFragileElemental = document.getElementById('excludeFragileElemental').checked;
            titanHealthSettings.shrinkEarthFireTeams = document.getElementById('shrinkEarthFireTeams').checked;
            titanHealthSettings.enforceTankSurvival = document.getElementById('enforceTankSurvival').checked;
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
                if (Object.prototype.hasOwnProperty.call(defaultTitanHealthSettings, id)) {
                    if (input.type === 'checkbox') {
                        titanHealthSettings[id] = input.checked;
                    } else {
                        titanHealthSettings[id] = parseFloat(input.value) / 100;
                    }
                    saveTitanHealthSettings();
                }
            });
        });

        // Toggle GUI visibility from menu / Auto Daily popup
        ensureDungeonSettingsToggle();
    }

    function ensureDungeonSettingsToggle() {
        window.toggleDungeonSettingsGUI = () => {
            createDungeonSettingsGUI();
            const panel = document.getElementById('titanSettingsGUI');
            if (!panel) return;
            const hidden = panel.style.display === 'none' || !panel.style.display;
            panel.style.display = hidden ? 'flex' : 'none';
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


    // =========================================================================
    // --- AUTOBATTLE MODULE (merged from AutoBattle HwH Ext.user.js) ---
    // =========================================================================
    let autoBattleInitialized = false;

    function initializeAutoBattle() {
    if (autoBattleInitialized) {
        return;
    }
    autoBattleInitialized = true;
    console.log('AutoBattle: initializing merged module inside Auto Daily...');

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
        this.myUserId = null;
        this.myClanId = null;
        this.allyUserIds = new Set();

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
                await this.loadAllyUserIds();

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

                    this.myUserId = userInfo.userId != null ? String(userInfo.userId) : null;
                    this.myClanId = userInfo.clanId != null ? String(userInfo.clanId) : null;

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
                        this.attemptsRemaining = grandAttempts;

                        if (grandAttempts <= 0) {
                            setProgress(`Grand Arena: No attempts remaining (${grandAttempts})`);
                            return;
                        }

                        setProgress(`Grand Arena: ${grandAttempts} attempts available`);
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
                        this.attemptsRemaining = arenaAttempts;

                        if (arenaAttempts <= 0) {
                            setProgress(`Arena: No attempts remaining (${arenaAttempts})`);
                            return;
                        }

                        setProgress(`Arena: ${arenaAttempts} attempts available`);
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
            setProgress(`${arenaName}: Initializing...`);
            return;
        }

        this.refreshOpponents = async function() {
            const detailedOpponents = await this.getArenaOpponents();
            if (detailedOpponents && (detailedOpponents.array || detailedOpponents.map)) {
                this.opponentsData = detailedOpponents;
            } else if (detailedOpponents && typeof detailedOpponents === 'object' && Object.keys(detailedOpponents).length > 0) {
                this.opponents = detailedOpponents;
            }
            this.findEasiestOpponents();
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
                            id: opponentData.userId ?? opponentData.id,
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

                this.opponents = availableOpponents.sort((a, b) => a.rank - b.rank);
                console.log(`[OPPONENTS] Highest ranking first (place 1 = top). Order:`, this.opponents.map(o => ({
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
                this.opponents = availableOpponents.sort((a, b) => a.rank - b.rank);
                console.log(`[OPPONENTS] Highest ranking first (fallback). Order:`, this.opponents.map(o => ({
                    id: o.opponent.id,
                    place: o.rank,
                    power: o.difficulty
                })));
            } else {
                console.log('[OPPONENTS] No opponents data to process');
                this.opponents = [];
            }
        }

        this.loadAllyUserIds = async function() {
            this.allyUserIds = new Set();

            if (!this.myUserId) {
                try {
                    const userInfo = getUserInfo();
                    if (userInfo?.userId != null) {
                        this.myUserId = String(userInfo.userId);
                    }
                    if (userInfo?.clanId != null) {
                        this.myClanId = String(userInfo.clanId);
                    }
                } catch (e) {
                    console.warn('[ALLIES] Could not read user info from getUserInfo():', e);
                }
            }

            if (this.myUserId) {
                this.allyUserIds.add(String(this.myUserId));
            }

            if (this.myClanId && this.myClanId !== '0') {
                try {
                    const response = await Send(JSON.stringify({
                        calls: [{
                            name: 'clanGetInfo',
                            args: {},
                            context: { actionTs: Utils.getActionTs() },
                            ident: 'clanGetInfo'
                        }]
                    }));
                    const members = response?.results?.[0]?.result?.response?.clan?.members;
                    if (members && typeof members === 'object') {
                        for (const memberId of Object.keys(members)) {
                            this.allyUserIds.add(String(memberId));
                        }
                        console.log(`[ALLIES] Loaded ${Object.keys(members).length} guild members`);
                    }
                } catch (error) {
                    console.warn('[ALLIES] Could not load guild members from clanGetInfo:', error);
                }
            }

            try {
                const response = await Send(JSON.stringify({
                    calls: [{
                        name: 'crossClanWar_getAttackMap',
                        args: {},
                        context: { actionTs: Utils.getActionTs() },
                        ident: 'body'
                    }]
                }));
                const clanTries = response?.results?.[0]?.result?.response?.clanTries;
                if (clanTries && typeof clanTries === 'object') {
                    const teamCountBefore = this.allyUserIds.size;
                    for (const userId of Object.keys(clanTries)) {
                        this.allyUserIds.add(String(userId));
                    }
                    console.log(`[ALLIES] Loaded ${this.allyUserIds.size - teamCountBefore} cross-clan team members`);
                }
            } catch (error) {
                console.warn('[ALLIES] Could not load cross-clan team members:', error);
            }

            console.log(`[ALLIES] Total ally user IDs to skip: ${this.allyUserIds.size}`);
        }

        this.getAllySkipReason = function(opponent) {
            const opponentId = String(opponent?.opponent?.id || '');
            if (!opponentId) {
                return null;
            }

            if (this.myUserId && opponentId === String(this.myUserId)) {
                return 'self';
            }

            if (this.allyUserIds.has(opponentId)) {
                return 'guild or team member';
            }

            const opponentClanId = opponent?.opponent?.user?.clanId;
            if (this.myClanId && opponentClanId &&
                String(this.myClanId) !== '0' && String(opponentClanId) !== '0' &&
                String(this.myClanId) === String(opponentClanId)) {
                return 'same guild';
            }

            return null;
        }

        this.executeBattles = async function() {
            let battlesSkipped = 0;
            const arenaName = this.arenaType === 'grand' ? 'Grand Arena' : 'Arena';

            // One real arenaAttack per trigger: try highest rank first, skip unsuitable, stop if none.
            while (this.opponents.length > 0) {
                const opponent = this.opponents.shift();
                const opponentId = opponent.opponent.id;
                const place = opponent.rank;

                console.log(`[EXECUTE] Evaluating place ${place} opponent ${opponentId} (${this.opponents.length} remaining)`);
                setProgress(`${arenaName}: Checking rank ${place} (${opponentId})`);

                try {
                    const allySkipReason = this.getAllySkipReason(opponent);
                    if (allySkipReason) {
                        console.log(`[EXECUTE] Skipping opponent ${opponentId} (${allySkipReason})`);
                        battlesSkipped++;
                        continue;
                    }

                    if (this.arenaType === 'grand') {
                        const canAttack = await this.checkTargetRange(opponentId);
                        if (!canAttack) {
                            console.log(`[EXECUTE] Target ${opponentId} is not in range, skipping`);
                            battlesSkipped++;
                            continue;
                        }
                    }

                    const result = await this.executeBattle(opponent);

                    if (result.skipped) {
                        console.log(`[EXECUTE] Opponent ${opponentId} not suitable (${result.reason || `win rate ${result.winRate?.toFixed(2)}%`})`);
                        battlesSkipped++;
                        continue;
                    }

                    if (result.win) {
                        this.victories++;
                        console.log(`[EXECUTE] ✓ Victory against rank ${place} opponent ${opponentId}`);
                    } else {
                        console.log(`[EXECUTE] ✗ Defeat against rank ${place} opponent ${opponentId}`);
                    }

                    this.end(`Attacked rank ${place}${result.win ? ' (win)' : ' (loss)'}${battlesSkipped > 0 ? `, skipped ${battlesSkipped}` : ''}`);
                    return;
                } catch (error) {
                    console.error(`[EXECUTE] Battle error for opponent ${opponentId}:`, error);
                    battlesSkipped++;
                }
            }

            this.end(`No suitable opponent${battlesSkipped > 0 ? ` (${battlesSkipped} skipped)` : ''}`);
        }

        this.executeBattle = async function(opponent) {
            try {
                if (!opponent || !opponent.opponent || !opponent.opponent.id) {
                    console.error('[DEMO] Invalid opponent data:', opponent);
                    return { win: false, skipped: true, reason: 'invalid opponent data' };
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
                    console.warn('[DEMO] Cannot get opponent team data, skipping as unsuitable');
                    return { win: false, skipped: true, reason: 'no opponent team data' };
                }

                let attackTeam = myTeamConfig;
                let simulationResult;

                if (this.arenaType === 'grand') {
                    const arrangement = await this.pickGrandTeamArrangement(myTeamConfig, opponentTeamConfig);
                    if (!arrangement) {
                        return {
                            win: false,
                            skipped: true,
                            reason: 'no winning arrangement vs visible teams'
                        };
                    }
                    attackTeam = arrangement.team;
                    simulationResult = {
                        total: arrangement.testedSlots,
                        wins: arrangement.slotRates.filter((s) => s.rate > CONSTANTS.WIN_RATE_THRESHOLD).length,
                        losses: arrangement.slotRates.filter((s) => s.rate <= CONSTANTS.WIN_RATE_THRESHOLD).length,
                        winRate: arrangement.winRate,
                        averageBattleTime: 0
                    };
                    console.log('[DEMO] Grand arrangement:', arrangement.perm, arrangement.slotRates);
                } else {
                    Utils.log('log', '[DEMO] Running demo battle simulations (no attempts consumed)...');
                    simulationResult = await this.simulateWithDemoBattles(myTeamConfig, opponentTeamConfig, CONSTANTS.SIMULATION_COUNT);
                }
                
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
                    return { win: false, skipped: true, winRate: simulationResult.winRate, reason: 'win rate below threshold' };
                }

                // Step 4: Proceed with actual battle
                console.log(`[DEMO] ✓ Win rate ${simulationResult.winRate.toFixed(2)}% is above threshold, proceeding with actual attack`);
                console.log('[DEMO] Step 4: Executing actual battle...');
                
                const battleResult = await this.startArenaBattle(opponentId, attackTeam);
                
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
                return { win: false, skipped: true, reason: error.message || 'executeBattle error' };
            }
        }

        this.checkTargetRange = async function(targetId) {
            if (this.arenaType !== 'grand') {
                return true;
            }

            const targetIdStr = String(targetId);

            try {
                const calls = [{
                    name: "grandCheckTargetRange",
                    args: {
                        ids: [targetIdStr]
                    },
                    context: {
                        actionTs: Utils.getActionTs()
                    },
                    ident: "body"
                }];

                const response = await Send(JSON.stringify({calls}));
                console.log('Target range check response:', response);

                if (response && response.results && response.results[0] && response.results[0].result) {
                    const result = response.results[0].result.response;
                    return result[targetIdStr] === true || result[targetId] === true;
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
                while (banners.length < 3) {
                    banners.push(banners[banners.length - 1] || 1);
                }

                return {
                    heroes: heroes,
                    pets: pets,
                    favor: grandFavor,
                    banners: banners.slice(0, 3)
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

        this.parseLineup = function(team) {
            if (!team) {
                return null;
            }
            const list = Array.isArray(team) ? team : (typeof team === 'object' ? Object.values(team) : []);
            if (!list.length || Array.isArray(list[0])) {
                return null;
            }
            const toId = (item) => {
                if (typeof item === 'number' && Number.isFinite(item) && item > 0) {
                    return item;
                }
                if (typeof item === 'string' && /^\d+$/.test(item.trim())) {
                    return parseInt(item.trim(), 10);
                }
                if (item && typeof item === 'object') {
                    const raw = item.id ?? item.heroId ?? item.unitId ?? item.petId;
                    const n = Number(raw);
                    return Number.isFinite(n) && n > 0 ? n : null;
                }
                return null;
            };
            const isPet = (item, id) => {
                if (item && typeof item === 'object' && String(item.type || '').toLowerCase() === 'pet') {
                    return true;
                }
                return id >= CONSTANTS.PET_ID_RANGE_MIN && id < CONSTANTS.PET_ID_RANGE_MAX;
            };
            const heroIds = [];
            let petId = CONSTANTS.DEFAULT_PET_ID;
            for (const item of list) {
                const id = toId(item);
                if (!id) {
                    continue;
                }
                if (isPet(item, id)) {
                    petId = id;
                } else if (heroIds.length < 5) {
                    heroIds.push(id);
                }
            }
            if (heroIds.length !== 5) {
                return null;
            }
            return { heroes: heroIds, pet: petId };
        }

        this.parseGrandLineup = function(team) {
            return this.parseLineup(team);
        }

        this.permute = function(items) {
            if (items.length <= 1) {
                return [items.slice()];
            }
            const result = [];
            for (let i = 0; i < items.length; i++) {
                const rest = items.slice(0, i).concat(items.slice(i + 1));
                for (const perm of this.permute(rest)) {
                    result.push([items[i], ...perm]);
                }
            }
            return result;
        }

        this.simulateTeamMatchup = async function(attack, defence, simulationCount = CONSTANTS.SIMULATION_COUNT) {
            const mechanic = 'arena';
            const simulations = [];
            let parentId = 0;
            let firstBattleId = null;
            const matchup = {
                team: { units: attack.units, pet: attack.pet },
                banner: attack.banner || 1,
                favor: attack.favor || {},
                defenceTeam: { units: defence.units, pet: defence.pet },
                defenceBanner: defence.banner || 1,
                defenceFavor: defence.favor || {}
            };
            for (let i = 0; i < simulationCount; i++) {
                try {
                    const result = await this.runSingleDemoBattle(null, null, mechanic, i, parentId, matchup);
                    simulations.push(result);
                    if (i === 0 && result.battleId) {
                        firstBattleId = result.battleId;
                        parentId = firstBattleId;
                    } else if (firstBattleId) {
                        parentId = firstBattleId;
                    } else if (result.parentId) {
                        parentId = result.parentId;
                    }
                } catch (error) {
                    console.error('[DEMO] Grand matchup sim failed:', error);
                    simulations.push({ win: false, battleTime: 0, error: error.message, parentId });
                }
            }
            const wins = simulations.filter((s) => s.win).length;
            const winRate = simulations.length ? (wins / simulations.length) * 100 : 0;
            return { winRate, wins, total: simulations.length };
        }

        this.pickGrandTeamArrangement = async function(myTeam, oppTeam) {
            const visibleSlots = oppTeam.visibleSlots || [];
            if (!visibleSlots.length) {
                console.log('[DEMO] Opponent has no visible Grand Arena teams');
                return null;
            }
            if (!myTeam?.heroes || myTeam.heroes.length < 3 || !myTeam.pets || myTeam.pets.length < 3) {
                console.warn('[DEMO] Need 3 of our Grand Arena teams to rearrange');
                return null;
            }

            const cache = {};
            const rateFor = async (myIdx, slot) => {
                const key = `${myIdx}:${slot}`;
                if (cache[key] != null) {
                    return cache[key];
                }
                const sim = await this.simulateTeamMatchup({
                    units: myTeam.heroes[myIdx],
                    pet: myTeam.pets[myIdx],
                    banner: myTeam.banners?.[myIdx] || 1,
                    favor: myTeam.favor || {}
                }, {
                    units: oppTeam.heroes[slot],
                    pet: oppTeam.pets[slot],
                    banner: oppTeam.banners?.[slot] || 1,
                    favor: oppTeam.favor || {}
                });
                cache[key] = sim.winRate;
                Utils.log('log', `[DEMO] Our team ${myIdx} vs visible slot ${slot}: ${sim.winRate.toFixed(1)}%`);
                return sim.winRate;
            };

            let best = null;
            for (const perm of this.permute([0, 1, 2])) {
                const slotRates = [];
                let ok = true;
                for (const slot of visibleSlots) {
                    const myIdx = perm[slot];
                    const rate = await rateFor(myIdx, slot);
                    slotRates.push({ slot, myIdx, rate });
                    if (!(rate > CONSTANTS.WIN_RATE_THRESHOLD)) {
                        ok = false;
                    }
                }
                const avg = slotRates.reduce((sum, row) => sum + row.rate, 0) / slotRates.length;
                if (ok && (!best || avg > best.avg)) {
                    best = { perm, avg, slotRates };
                }
            }

            if (!best) {
                console.log('[DEMO] No permutation beat the win-rate threshold on all visible teams');
                return null;
            }

            return {
                perm: best.perm,
                winRate: best.avg,
                slotRates: best.slotRates,
                testedSlots: visibleSlots.length,
                team: {
                    heroes: best.perm.map((i) => myTeam.heroes[i]),
                    pets: best.perm.map((i) => myTeam.pets[i]),
                    banners: best.perm.map((i) => myTeam.banners?.[i] || 1),
                    favor: myTeam.favor || {}
                }
            };
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

            const extractBannerId = (banner) => {
                if (typeof banner === 'number' && banner > 0) {
                    return banner;
                }
                if (banner && typeof banner === 'object' && banner.id != null) {
                    const n = Number(banner.id);
                    return Number.isFinite(n) && n > 0 ? n : 1;
                }
                return 1;
            };

            const rawHeroes = Array.isArray(opp.heroes)
                ? opp.heroes
                : (opp.heroes && typeof opp.heroes === 'object' ? Object.values(opp.heroes) : []);
            const looksNested = rawHeroes.some((entry) => Array.isArray(entry));

            if (this.arenaType === 'grand' || looksNested) {
                const teams = [];
                const pets = [];
                const banners = [];
                const visibleSlots = [];

                if (!looksNested) {
                    const parsed = this.parseLineup(rawHeroes);
                    if (parsed) {
                        teams[0] = parsed.heroes;
                        pets[0] = parsed.pet;
                        banners[0] = extractBannerId(opp.banners?.[0] ?? opp.banner);
                        visibleSlots.push(0);
                        hasValidTeam = true;
                    }
                } else {
                    for (let i = 0; i < 3; i++) {
                        const parsed = this.parseLineup(rawHeroes[i]);
                        const banner = extractBannerId(opp.banners?.[i]);
                        if (parsed) {
                            teams[i] = parsed.heroes;
                            pets[i] = parsed.pet;
                            banners[i] = banner;
                            visibleSlots.push(i);
                            hasValidTeam = true;
                        } else {
                            teams[i] = null;
                            pets[i] = null;
                            banners[i] = banner || 1;
                        }
                    }
                }

                if (hasValidTeam && this.arenaType === 'grand') {
                    config = {
                        hasValidTeam: true,
                        heroes: teams,
                        pets: pets,
                        banners: banners,
                        favor: {},
                        visibleSlots
                    };
                    console.log('[DEMO] Grand Arena visible defenses:', visibleSlots.length, 'slots', visibleSlots);
                } else if (hasValidTeam) {
                    config = {
                        hasValidTeam: true,
                        heroes: teams[visibleSlots[0]],
                        pet: pets[visibleSlots[0]],
                        banner: banners[visibleSlots[0]] || 1,
                        favor: {}
                    };
                }
            } else {
                const parsed = this.parseLineup(rawHeroes);
                const bannerId = extractBannerId(opp.banners?.[0] ?? opp.banner);
                if (parsed) {
                    hasValidTeam = true;
                    config = {
                        hasValidTeam: true,
                        heroes: parsed.heroes,
                        pet: parsed.pet,
                        banner: bannerId,
                        favor: {}
                    };
                    console.log('[DEMO] Regular Arena config extracted:', {
                        heroes: parsed.heroes,
                        pet: parsed.pet,
                        banner: bannerId
                    });
                } else {
                    console.warn('[DEMO] Regular Arena lineup incomplete:', {
                        rawLength: rawHeroes.length,
                        first: rawHeroes[0]
                    });
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
            const teamCount = this.arenaType === 'grand' ? 3 : 1;
            const totalSimulations = simulationCount * teamCount;
            Utils.log('log', `[DEMO] Starting ${totalSimulations} demo battle simulations (${teamCount} team(s) x ${simulationCount})...`);
            
            // Note: demoBattles API only supports "arena" mechanic, even for Grand Arena
            const mechanic = 'arena';

            const simulations = [];
            let parentId = 0; // Start with 0 for first battle
            let firstBattleId = null; // Store first battle's ID to use as parentId for subsequent battles
            
            for (let i = 0; i < totalSimulations; i++) {
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
                    console.error(`[DEMO] Simulation ${i + 1}/${totalSimulations} failed:`, error);
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

        this.runSingleDemoBattle = async function(myTeam, opponentTeam, mechanic, seedOffset = 0, parentId = 0, matchup = null) {
            return new Promise((resolve, reject) => {
                try {
                    let args = {
                        mechanic: mechanic,
                        defenceMaxUpgrade: true,
                        maxUpgrade: true,
                        defenceBuffs: {},
                        buffs: {},
                        parentId: parentId,
                        entryId: 0
                    };

                    if (matchup) {
                        args.defenceTeam = matchup.defenceTeam;
                        args.defenceBanner = matchup.defenceBanner || 1;
                        args.defenceBannerStones = {};
                        args.defenceFavor = matchup.defenceFavor || {};
                        args.team = matchup.team;
                        args.banner = matchup.banner || 1;
                        args.bannerStones = {};
                        args.favor = matchup.favor || {};
                    } else if (this.arenaType === 'grand') {
                        const visibleSlots = opponentTeam.visibleSlots?.length
                            ? opponentTeam.visibleSlots
                            : [0, 1, 2].filter((i) => Array.isArray(opponentTeam.heroes?.[i]) && opponentTeam.heroes[i].length);
                        const teamIndex = visibleSlots.length
                            ? visibleSlots[seedOffset % visibleSlots.length]
                            : (seedOffset % 3);
                        args.defenceTeam = {
                            units: opponentTeam.heroes[teamIndex] || [],
                            pet: opponentTeam.pets[teamIndex] || CONSTANTS.DEFAULT_PET_ID
                        };
                        args.defenceBanner = opponentTeam.banners[teamIndex] || 1;
                        args.defenceBannerStones = {};
                        args.defenceFavor = opponentTeam.favor || {};
                        args.team = {
                            units: myTeam.heroes[teamIndex] || myTeam.heroes[0] || [],
                            pet: myTeam.pets[teamIndex] || myTeam.pets[0] || CONSTANTS.DEFAULT_PET_ID
                        };
                        args.banner = myTeam.banners[teamIndex] || myTeam.banners[0] || 1;
                        args.bannerStones = {};
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
                        let wins = 0;
                        let battleTimer = 0;
                        let battleTime = 0;
                        let lastProgress = [];
                        let lastResult = { win: false };
                        for (const battleData of result.battles) {
                            const calcResult = await new Promise((resolveCalc) => {
                                BattleCalc(battleData, getBattleType(this.arenaType), (calc) => resolveCalc(calc));
                            });
                            if (!calcResult || !calcResult.result) {
                                console.error('BattleCalc returned invalid result:', calcResult);
                                continue;
                            }
                            if (calcResult.result.win) {
                                wins++;
                            }
                            battleTimer += Number(calcResult.battleTimer) || 0;
                            battleTime += Number(calcResult.battleTime) || 0;
                            lastProgress = calcResult.progress || lastProgress;
                            lastResult = calcResult.result;
                        }
                        return {
                            win: wins >= Math.ceil(result.battles.length / 2),
                            progress: lastProgress,
                            result: lastResult,
                            battleTimer,
                            battleTime
                        };
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
                                    result: { win: false },
                                    battleTimer: 0,
                                    battleTime: 0
                                });
                                return;
                            }
                            resolve({
                                win: result.result.win,
                                progress: result.progress,
                                result: result.result,
                                battleTimer: result.battleTimer || 0,
                                battleTime: result.battleTime || 0
                            });
                        });
                    });
                }
            }

            console.log('No battle data found, assuming success');
            return {
                win: true,
                progress: [],
                result: { win: true },
                battleTimer: 0,
                battleTime: 0
            };
        }

        this.waitForArenaBattle = async function(battleResult) {
            const countdownTimer = HWHFuncs.countdownTimer;
            const getTimer = HWHFuncs.getTimer;
            let waitSec = Math.ceil(Number(battleResult?.battleTimer) || 0);
            if (waitSec <= 0) {
                const rawTime = Number(battleResult?.battleTime) || 0;
                if (rawTime > 0 && typeof getTimer === 'function') {
                    waitSec = Math.ceil(getTimer(rawTime));
                }
            }
            const predictionCards = Math.max(0, Math.floor(Number(window.HWHData?.countPredictionCard)) || 0);
            if (predictionCards > 0) {
                waitSec = 0;
            }
            if (waitSec > 0) {
                const arenaName = this.arenaType === 'grand' ? 'Grand Arena' : 'Arena';
                console.log(`[ARENA] Waiting ${waitSec}s for battle to finish before next attack`);
                if (typeof countdownTimer === 'function') {
                    await countdownTimer(waitSec, `${arenaName}: waiting for battle (${waitSec}s)`);
                } else {
                    await new Promise(resolve => setTimeout(resolve, waitSec * 1000));
                }
            }
            await new Promise(resolve => setTimeout(resolve, CONSTANTS.DELAY_BETWEEN_BATTLES));
        }

        this.endArenaBattle = async function(battleResult) {
            // Skip stashClient — battles auto-close; stashClient can 404 if type doesn't match.
            console.log('Battle completed, waiting before next arena attack');
            await this.waitForArenaBattle(battleResult);
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

    // Individual battle functions for manual triggers / Do All
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

    async function runGuildRaid() {
        await runRaidNodes();
        await runRaidBoss();
    }

    // Expose for Auto Daily DO ALL tasks / external callers
    window.__HWH_runArena = runArena;
    window.__HWH_runGrandArena = runGrandArena;
    window.__HWH_runGuildWar = runGuildWar;
    window.__HWH_runGuildRaid = runGuildRaid;
    window.__HWH_runTitanArena = runTitanArena;
    window.__HWH_runCrossClanWar = runCrossClanWar;

    console.log('AutoBattle: runners ready for Do All.');

    }

    const AUTO_BATTLE_TASK_IDS = ['abArena', 'abGrandArena', 'abToE', 'abGuildWar', 'abGuildRaid', 'abClashOfWorld'];

    function ensureAutoBattleReady() {
        if (typeof window.__HWH_runArena === 'function') return;
        initializeAutoBattle();
        if (typeof window.__HWH_runArena !== 'function') {
            throw new Error('AutoBattle module failed to initialize');
        }
    }

    async function withAutoBattleFlag(runner) {
        ensureAutoBattleReady();
        window.HWH_AUTOBATTLE_RUNNING = true;
        try {
            await runner();
        } finally {
            window.HWH_AUTOBATTLE_RUNNING = false;
        }
    }

    async function executeAbArena() {
        await withAutoBattleFlag(() => window.__HWH_runArena());
    }
    async function executeAbGrandArena() {
        await withAutoBattleFlag(() => window.__HWH_runGrandArena());
    }
    async function executeAbToE() {
        await withAutoBattleFlag(() => window.__HWH_runTitanArena());
    }
    async function executeAbGuildWar() {
        await withAutoBattleFlag(() => window.__HWH_runGuildWar());
    }
    async function executeAbGuildRaid() {
        await withAutoBattleFlag(() => window.__HWH_runGuildRaid());
    }
    async function executeAbClashOfWorld() {
        await withAutoBattleFlag(() => window.__HWH_runCrossClanWar());
    }

    /** Migrate legacy single "autoBattle" checkbox into the split battle options. */
    function migrateAutoBattleExecutionState(state) {
        if (!state || !state.autoBattle) return state;
        AUTO_BATTLE_TASK_IDS.forEach((id) => { state[id] = true; });
        delete state.autoBattle;
        return state;
    }

    // --- DATA STRUCTURES ---
    const doAllTasks = [
        { id: 'abArena', label: 'Arena', func: executeAbArena },
        { id: 'abGrandArena', label: 'Grand Arena', func: executeAbGrandArena },
        { id: 'abToE', label: 'ToE', func: executeAbToE },
        { id: 'abGuildWar', label: 'Guild War', func: executeAbGuildWar },
        { id: 'abGuildRaid', label: 'Guild Raid', func: executeAbGuildRaid },
        { id: 'abClashOfWorld', label: 'Clash of the World', func: executeAbClashOfWorld },
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
    function getDefaultOthersSettingsState() {
        return othersTasks.reduce((acc, task) => {
            acc[task.id] = true;
            return acc;
        }, {});
    }

    function normalizeOthersSettingsState(state = {}) {
        const normalized = getDefaultOthersSettingsState();
        for (const task of othersTasks) {
            if (Object.prototype.hasOwnProperty.call(state, task.id)) {
                normalized[task.id] = state[task.id] !== false;
            }
        }
        return normalized;
    }

    function isOthersTaskEnabled(taskId) {
        return othersSettingsState[taskId] !== false;
    }

    function loadAllSettings() {
        const { HWHFuncs } = window;
        if (typeof window.getAutoDailySettings === 'function') {
            console.log(`${EXTENSION_NAME}: Settings Provider found. Loading settings from Provider.`);
            isProviderActive = true;
            const providerSettings = window.getAutoDailySettings();
            executionState = migrateAutoBattleExecutionState(providerSettings.executionState || {});
            hideButtonsState = providerSettings.hideButtonsState || {};
            othersSettingsState = normalizeOthersSettingsState(providerSettings.othersSettingsState || {});
        } else {
            console.log(`${EXTENSION_NAME}: Settings Provider not found. Loading account-specific settings.`);
            isProviderActive = false;
            executionState = migrateAutoBattleExecutionState(HWHFuncs.getSaveVal('autoDaily_executionState', {}));
            hideButtonsState = HWHFuncs.getSaveVal('autoDaily_hideButtonsState', { doAll: false, quests: false, actions: false, newSync: false });
            othersSettingsState = normalizeOthersSettingsState(
                HWHFuncs.getSaveVal('autoDaily_othersSettingsState', getDefaultOthersSettingsState())
            );
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
            const buttons = window.HWHData?.buttons;
            if (
                window.HWHData
                && window.HWHClasses
                && window.HWHFuncs
                && buttons?.doActions?.button
                && buttons?.doOthers?.button
            ) {
                clearInterval(interval);
                callback();
            }
        }, 500);
    }

    function ensurePopupStyles() {
        if (document.getElementById(AUTO_DAILY_STYLE_ID)) return;
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
        styleSheet.id = AUTO_DAILY_STYLE_ID;
        styleSheet.innerText = styles;
        document.head.appendChild(styleSheet);
    }

    function createPopup() {
        if (document.getElementById('auto-daily-popup-container')) return;
        ensurePopupStyles();
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
                <button class="sync-button" id="sync-settings-btn" title="Save/Load Settings">${UI_ICON.save}</button>
                <label><input type="checkbox" id="hide-doall-btn" ${hideButtonsState.doAll ? 'checked' : ''}> Hide 'Do All'</label>
                <label><input type="checkbox" id="hide-quests-btn" ${hideButtonsState.quests ? 'checked' : ''}> Hide 'Quests'</label>
                <label><input type="checkbox" id="hide-actions-btn" ${hideButtonsState.actions ? 'checked' : ''}> Hide 'Actions'</label>
                <a id="other-settings-link">Other Settings</a>
                <a id="dungeon-settings-link" title="Open dungeon team / tank survival settings">Dungeon Settings</a>
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
                const actionHTML = isQuest
                    ? `<div class="auto-daily-status-icon" data-task-id="${task.id}">${UI_ICON.pending}</div>`
                    : `<button class="auto-daily-fire-btn" data-task-id="${task.id}">${UI_ICON.fire}</button>`;
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
        document.getElementById('dungeon-settings-link').addEventListener('click', () => {
            if (typeof window.toggleDungeonSettingsGUI === 'function') {
                window.toggleDungeonSettingsGUI();
            }
        });
        document.getElementById('sync-settings-btn').addEventListener('click', createSyncPopup);
        updateQuestStatus();
    }
    function createOthersPopup() {
        if (document.getElementById('others-settings-popup-container')) return;
        ensurePopupStyles();
        const backdrop = document.createElement('div');
        backdrop.className = 'auto-daily-popup-backdrop';
        backdrop.id = 'others-settings-popup-container';
        const popup = document.createElement('div');
        popup.className = 'auto-daily-popup-main others-settings-popup-main';
        let listHTML = othersTasks.map(task => `
            <li class="auto-daily-task-item">
                <label><input type="checkbox" data-task-id="${task.id}" ${isOthersTaskEnabled(task.id) ? 'checked' : ''}><span>${task.label}</span></label>
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
        ensurePopupStyles();
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
                        executionState = migrateAutoBattleExecutionState(importedSettings.executionState);
                        hideButtonsState = importedSettings.hideButtonsState;
                        othersSettingsState = normalizeOthersSettingsState(importedSettings.othersSettingsState);
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
        const isAnyChecked = othersTasks.some(task => isOthersTaskEnabled(task.id));
        if (customOthersButton) {
            const row = getMenuButtonRow(customOthersButton);
            (row || customOthersButton).style.display = isAnyChecked ? '' : 'none';
        }
    }

    /**
     * HWH ScriptMenu: button.parentElement is a scriptMenu_btnRow.
     * Passing that row into addButton/insertBefore merges into existing groups
     * (e.g. Action Replay). Always create standalone rows and move the row.
     */
    function getMenuButtonRow(el) {
        if (!el) return null;
        if (el.classList?.contains('scriptMenu_btnRow')) return el;
        return el.closest?.('.scriptMenu_btnRow') || el.parentElement;
    }

    function placeMenuRowBefore(rowEl, beforeEl) {
        if (!rowEl) return;
        const beforeRow = getMenuButtonRow(beforeEl);
        const socket = beforeRow?.parentElement
            || window.HWHClasses?.ScriptMenu?.getInst()?.btnSocket;
        if (!socket) return;
        if (beforeRow && beforeRow.parentElement === socket) {
            socket.insertBefore(rowEl, beforeRow);
        } else {
            socket.appendChild(rowEl);
        }
    }

    function removeMenuButtonRow(buttonOrRow) {
        const row = getMenuButtonRow(buttonOrRow);
        if (row) row.remove();
    }

    function applySyncButtonState() {
        const { HWHClasses, HWHData, HWHFuncs } = window;
        const { newDay } = HWHData.buttons;
        const autoDailyButton = document.querySelector('[data-extension-button="auto-daily"]');
        if (!autoDailyButton) return;
        const actionsButton = HWHData.buttons.doActions?.button;
        if (!actionsButton) return;

        if (combinedButton) {
            removeMenuButtonRow(combinedButton);
            combinedButton = null;
        }

        const autoDailyRow = getMenuButtonRow(autoDailyButton);
        if (autoDailyRow) autoDailyRow.style.display = '';
        autoDailyButton.style.display = 'flex';
        if (newDay && newDay.button) newDay.button.style.display = 'flex';

        if (hideButtonsState.newSync) {
            if (newDay && newDay.button) newDay.button.style.display = 'none';
            if (autoDailyRow) autoDailyRow.style.display = 'none';
            autoDailyButton.style.display = 'none';

            const buttonList = [{
                name: 'Auto Daily', onClick: createPopup, title: 'Open the Auto Daily control panel',
            }, {
                name: UI_ICON.sync,
                onClick: () => { HWHFuncs.setProgress('Syncing...', true); window.cheats.refreshGame(); },
                title: 'Run Sync', color: 'green',
            }];
            // Do NOT pass an existing btnRow — that merges into other extensions' groups.
            combinedButton = HWHClasses.ScriptMenu.getInst().addCombinedButton(buttonList);
            if (!combinedButton) return;
            const autoDailyCombined = combinedButton.children[0];
            const syncCombined = combinedButton.children[1];
            if (autoDailyCombined) {
                autoDailyCombined.style.flexGrow = '1';
                const buttonText = autoDailyCombined.querySelector('.scriptMenu_buttonText, .scriptMenu_btnPlate');
                if (buttonText) buttonText.style.whiteSpace = 'nowrap';
            }
            if (syncCombined) {
                syncCombined.style.flexGrow = '0';
                syncCombined.style.width = '45px';
            }
            placeMenuRowBefore(combinedButton, actionsButton);
        }
    }

    function getOthersButtonMsg(button) {
        try {
            return button?.msg;
        } catch (e) {
            return '';
        }
    }

    function isKnownOthersTaskButton(button) {
        const { I18N } = window;
        const msg = getOthersButtonMsg(button);
        if (!msg) return false;
        return othersTasks.some(task => msg === I18N(task.id) || msg === task.label);
    }

    function findOthersPopupButton(task) {
        const { HWHData, I18N } = window;
        const buttons = HWHData?.othersPopupButtons || [];
        const translated = I18N(task.id);
        return buttons.find(button => {
            if (button?.isClose) return false;
            const msg = getOthersButtonMsg(button);
            return msg === translated || msg === task.label;
        });
    }

    function buildFilteredOthersPopupButtons() {
        const { HWHData } = window;
        const sourceButtons = HWHData?.othersPopupButtons || [];
        const popupButtons = [];
        const used = new Set();

        for (const task of othersTasks) {
            if (!isOthersTaskEnabled(task.id)) continue;
            const match = findOthersPopupButton(task);
            if (!match) {
                console.warn(`[Auto Daily] No Others handler found for ${task.id} (${task.label})`);
                continue;
            }
            popupButtons.push(match);
            used.add(match);
        }

        // Keep extension-added Others actions (e.g. Gift of the Elements) always visible.
        for (const button of sourceButtons) {
            if (!button || button.isClose || used.has(button)) continue;
            if (isKnownOthersTaskButton(button)) continue;
            popupButtons.push(button);
        }

        popupButtons.push({ result: false, isClose: true });
        return popupButtons;
    }

    async function onCustomOthersClick() {
        const { HWHFuncs, I18N, HWHClasses } = window;
        if (HWHClasses?.executeBrawls?.isBrawlsAutoStart) return;

        const popupButtons = buildFilteredOthersPopupButtons();
        // Only the trailing close button means nothing is available.
        if (popupButtons.length <= 1) {
            HWHFuncs.setProgress('Others: no enabled actions available.', true);
            return;
        }

        const answer = await HWHFuncs.popup.confirm(`${I18N('CHOOSE_ACTION')}:`, popupButtons);
        if (typeof answer === 'function') {
            await answer();
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
            let iconHTML = `<span title="Not available">${UI_ICON.unavailable}</span>`;
            if (questData) {
                 // Check if quest is completed (state === 2) - following API documentation
                 if (questData.state === 2) {
                    iconHTML = `<span title="Already done">${UI_ICON.done}</span>`;
                } else {
                    // Try numeric key first (as that's what the API uses), then string key
                    const questHandler = questManager.dataQuests[questId] || questManager.dataQuests[task.id];
                    if (questHandler) {
                        // Handle quests with doItFunc (like dungeon quest 10022)
                        // These quests can be executed even if isWeCanDo returns false
                        if (questHandler.doItFunc && questData.state === 1) {
                            iconHTML = `<button class="auto-daily-fire-btn" data-task-id="${task.id}">${UI_ICON.fire}</button>`;
                        } else if (questHandler.isWeCanDo && typeof questHandler.isWeCanDo === 'function') {
                            try {
                                if (questHandler.isWeCanDo.call(questManager)) {
                                    iconHTML = `<button class="auto-daily-fire-btn" data-task-id="${task.id}">${UI_ICON.fire}</button>`;
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
        const isDungeonTask = task.id === 'testDungeon' || task.id === '10022';
        if (!isDungeonTask && (dungeonRunning || window.HWH_DUNGEON_RUNNING || window.HWH_DUNGEON_BATTLE_OPEN)) {
            HWHFuncs.setProgress(`${task.label}: skipped (dungeon running)`, true);
            return;
        }
        if (isDungeonTask && window.HWH_AUTOBATTLE_RUNNING) {
            await waitForAutoBattleIdle();
            if (window.HWH_AUTOBATTLE_RUNNING) {
                HWHFuncs.setProgress(`${task.label}: skipped (AutoBattle still running)`, true);
                return;
            }
        }
        try {
            if (task.func) {
                if (task.id === 'testDungeon') {
                    await sleep(2000);
                }
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
                         await sleep(2000);
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

        // Battle tasks first (in doAllTasks order), then other dailies; dungeon last to avoid API/UI conflicts.
        const autoBattleIdSet = new Set(AUTO_BATTLE_TASK_IDS);
        const doAllAutoBattle = doAllChecked.filter(t => autoBattleIdSet.has(t.id));
        const doAllNonDungeon = doAllChecked.filter(t => t.id !== 'testDungeon' && !autoBattleIdSet.has(t.id));
        const doAllDungeon = doAllChecked.filter(t => t.id === 'testDungeon');

        // Quest 10022 is "Guild Dungeon" in the quest list; it also triggers dungeon logic.
        const questsNonDungeon = questsAndUpgradeChecked.filter(t => t.id !== '10022');
        const questsDungeon = questsAndUpgradeChecked.filter(t => t.id === '10022');

        const ordered = [
            ...doAllAutoBattle,
            ...doAllNonDungeon,
            ...questsNonDungeon,
            ...doAllDungeon,
            ...questsDungeon,
        ];

        // Run sequentially (await each). The previous setTimeout-based scheduler could overlap long tasks and stall mid-run.
        setTimeout(async () => {
            const { HWHFuncs } = window;
            if (autoRunInProgress || dungeonRunning || window.HWH_DUNGEON_RUNNING || window.HWH_DUNGEON_BATTLE_OPEN) {
                console.log('[Auto Daily] Skipping auto-run — dungeon already in progress');
                return;
            }
            autoRunInProgress = true;
            try {
                for (const task of ordered) {
                    if (dungeonRunning || window.HWH_DUNGEON_RUNNING || window.HWH_DUNGEON_BATTLE_OPEN) {
                        console.log('[Auto Daily] Stopping auto-run — dungeon started');
                        break;
                    }
                    const isDungeonTask = task.id === 'testDungeon' || task.id === '10022';
                    if (isDungeonTask && window.HWH_AUTOBATTLE_RUNNING) {
                        await waitForAutoBattleIdle();
                    }
                    await executeSingleTask(task);
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
        const origOthersButton = HWHData.buttons?.doOthers?.button;
        if (!origOthersButton) {
            console.warn('[Auto Daily] Original Others button not found; skipping custom Others button.');
            return;
        }
        if (customOthersButton) {
            removeMenuButtonRow(customOthersButton);
            customOthersButton = null;
        }

        const origRow = getMenuButtonRow(origOthersButton);
        if (origRow) origRow.style.display = 'none';
        else origOthersButton.style.display = 'none';

        // Standalone row — do not pass origOthersButton.parentElement (a btnRow).
        customOthersButton = HWHClasses.ScriptMenu.getInst().addButton({
            name: I18N('OTHERS'),
            title: I18N('OTHERS_TITLE'),
            onClick: onCustomOthersClick
        });
        const referenceButton = HWHData.buttons.testTitanArena?.button
            || HWHData.buttons.testDungeon?.button
            || origOthersButton;
        placeMenuRowBefore(getMenuButtonRow(customOthersButton), referenceButton);
    }

    function maindaily() {
        const { HWHFuncs, HWHData, HWHClasses } = window;

        loadAllSettings();
        loadTitanHealthSettings(); // Load dungeon titan health settings
        console.log(`${EXTENSION_NAME} v${EXTENSION_VERSION} is loading...`);
        HWHFuncs.addExtentionName(EXTENSION_NAME, EXTENSION_VERSION, EXTENSION_AUTHOR);

        if (window.HWHClasses) {
            window.HWHClasses.executeDungeon = executeDungeon;
        }
        
        // Create dungeon settings GUI
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', createDungeonSettingsGUI);
        } else {
            createDungeonSettingsGUI();
        }

        const scriptMenu = HWHClasses.ScriptMenu.getInst();
        const actionsButton = HWHData.buttons.doActions.button;

        // Each addButton without a btnRow parent creates its own row in btnSocket.
        // Moving the whole row keeps us from merging into Action Replay / other groups.
        const autoDailyButton = scriptMenu.addButton({
            name: 'Auto Daily',
            onClick: createPopup,
            title: 'Open the Auto Daily control panel',
        });
        autoDailyButton.dataset.extensionButton = 'auto-daily';
        placeMenuRowBefore(getMenuButtonRow(autoDailyButton), actionsButton);

        createCustomOthersButton();

        // Merged AutoBattle module (menu buttons + HWHClasses.execute* exports)
        initializeAutoBattle();

        applyButtonVisibility();
        applyOthersVisibility();
        applySyncButtonState();

        setTimeout(updateQuestStatus, 9000);
        scheduleAutoRuns();

        console.log(`${EXTENSION_NAME} initialized successfully.`);
    }

    waitForHWH(maindaily);

})();
