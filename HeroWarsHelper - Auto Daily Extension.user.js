// ==UserScript==
// @name         HeroWarsHelper - Auto Daily Extension
// @namespace    http://tampermonkey.net/
// @version      3.2.0
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
    const EXTENSION_VERSION = "3.2.0";
    const EXTENSION_AUTHOR = "You";

    /** Verbose dungeon logs: `window.HWH_DEBUG_DUNGEON = true` before run. */
    /** Per-end-battle prediction card count: `window.HWH_LOG_PREDICTION_CARDS = true` (HeroWarsHelper). */
    /** Battle pre-calc count (0-25): `window.HWH_DUNGEON_NUM_TRIES = 10` (Stealther dungeon). */

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
    // Dungeon Algorithm - ported from Hero Wars Stealther 1.006 (Mike Rohsoft)
    function executeDungeon(resolve, reject) {
        const { HWHFuncs, Send, BattleCalc, cheats } = window;
        const { getInput, setProgress, hideProgress, I18N, getTimer, countdownTimer } = HWHFuncs;

        const DUNGEON_VERBOSE = typeof window !== 'undefined' && window.HWH_DEBUG_DUNGEON === true;
        /** Battle pre-calculation count (0-25). Set window.HWH_DUNGEON_NUM_TRIES (default 10). */
        const NUM_TRIES = Math.max(0, Math.min(25, Number(window.HWH_DUNGEON_NUM_TRIES) || 10));

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
        let stepCount = 0;
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

        function extractTimers(battleResult) {
            const logs = battleResult.battleLogs?.[0] || [];
            const timeLimit = Math.max(...logs.map((e) => e.time), 168.8);
            return [...new Set(logs.map((e) => (e.time < timeLimit && e.time !== 168.8 ? e.time : 0)))].filter((t) => t > 0);
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

            async init() {
                this._initialBattle = await this.reCalculate(0);
                this._timers = extractTimers(this._initialBattle);
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

            async *bruteforce(endTime = Date.now() + 60000) {
                if (endTime < Date.now()) {
                    endTime = Date.now() + 60000;
                }
                if (!this._initialBattle) {
                    this._initialBattle = await this.init();
                }
                while (Date.now() < endTime && this._counter < this._maxBattles) {
                    if (!(this._lastBattle = await this.reCalculate())) {
                        continue;
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
                    if (!this._bestBattle.result?.win) {
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
                    if (this._battle) {
                        this._battle.seed = Math.floor(Date.now() / 1000) + Math.random() * 1000;
                    }
                    const battleBuffer = await simulateBattle(structuredClone(this._battle), this._type);
                    if (battleBuffer?.result?.win) {
                        wins++;
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
        }

        async function runBattleHandler(battleHandler, forceFix = false, skipPreCalc = false) {
            const initBattle = await battleHandler.init();
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

            for await (const _count of battleHandler.bruteforce()) {
                if (stopDung) break;
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

        async function startAndSimulate(teamNum, heroes, pet, attackerType, favor = {}) {
            const raw = await Send({ calls: [createBattleArgs(teamNum, heroes, pet, favor)] });
            const apiResult = getApiResult(raw);
            if (apiResult?.error || apiResult?.validation) {
                const errMsg = apiResult.validation
                    ? JSON.stringify(apiResult.validation)
                    : (typeof apiResult.error === 'string'
                        ? apiResult.error
                        : `${apiResult.error?.name || apiResult.error?.title || 'Error'}: ${apiResult.error?.description || apiResult.error?.title || ''}`);
                console.warn(`[Dungeon] dungeonStartBattle failed (${attackerType}, team ${teamNum}):`, errMsg, raw);
                return null;
            }
            const battleData = apiResult?.response;
            if (!battleData) {
                console.warn(`[Dungeon] dungeonStartBattle empty response (${attackerType}, team ${teamNum})`, raw);
                return null;
            }
            const isBruteForceBattle = attackerType !== 'hero';
            const battleType = battleData.type === 'dungeon_titan' ? 'get_titan' : 'get_tower';
            const handler = new DungeonBattleHandler(battleData, battleType);
            lastBattleHandler = handler;
            let handlerResult;
            try {
                handlerResult = await runBattleHandler(handler, isBruteForceBattle, isBruteForceBattle);
            } catch (err) {
                console.warn(`[Dungeon] BattleCalc failed (${attackerType}, team ${teamNum}):`, err);
                return null;
            }
            const battle = handlerResult.bestBattle ?? handlerResult.initBattle;
            if (!battle?.result) {
                console.warn(`[Dungeon] No simulated battle result (${attackerType}, team ${teamNum})`);
                return null;
            }
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
                win: wrapped.result?.win,
                state: handler.getState(wrapped),
            };
        }

        async function waitForBattle(option, attackerType, debug = '') {
            const rounds = Math.ceil(option.timer || 0);
            for (let r = rounds; r > 0; r--) {
                if (stopDung || end) return;
                const msg = `${I18N('DUNGEON')}: ${I18N('TITANIT')} ${dungeonActivity}/${maxDungeonActivity}${debug ? ' | ' + debug : ''} ${r}s`;
                setProgress(msg, true);
                await sleep(1000);
            }
        }

        async function executeOption(option, attackerType, debug = '') {
            await waitForBattle(option, attackerType, debug);
            if (stopDung || end) return false;
            return endBattleOption(option);
        }

        async function endBattleOption(option) {
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
            } else {
                const timer = option.timer ?? getTimer(option.battleTime ?? 0);
                if (DUNGEON_VERBOSE) console.log('[Dungeon] wait timer:', timer);
                await countdownTimer(timer, `${I18N('DUNGEON')}: ${I18N('TITANIT')} ${dungeonActivity}/${maxDungeonActivity} ${talentMsg}`);
            }

            let e;
            try {
                e = await Send({ calls: [{ name: 'dungeonEndBattle', args, ident: 'body' }] });
            } catch (err) {
                endDungeon('errorRequest', err);
                return false;
            }

            if (e?.error) {
                const desc = typeof e.error === 'string' ? e.error : (e.error.description || '');
                if (desc.includes('NotFound') || desc.includes('not found')) {
                    console.warn('[Dungeon] Battle not found, continuing...', e.error);
                    return true;
                }
                endDungeon('errorRequest', e.error);
                return false;
            }

            if (!e?.results) {
                endDungeon('Lost connection to game server!', 'break');
                return false;
            }

            const result = e.results[0].result;
            if (result.error) {
                const desc = typeof result.error === 'string' ? result.error : (result.error.description || '');
                if (desc.includes('NotFound') || desc.includes('not found')) {
                    console.warn('[Dungeon] Battle not found in result, continuing...', result.error);
                    return true;
                }
                endDungeon('errorBattleResult', result.error);
                return false;
            }

            const battleResult = result.response;
            if (!battleResult) {
                console.warn('[Dungeon] No battle result, continuing...');
                return true;
            }

            if (battleResult.error) {
                const desc = typeof battleResult.error === 'string' ? battleResult.error : (battleResult.error.description || '');
                if (desc.includes('NotFound') || desc.includes('not found')) {
                    return true;
                }
                endDungeon('errorBattleResult', battleResult);
                return false;
            }

            if (!battleResult.dungeon && !battleResult.floor) {
                try {
                    await Send({ calls: [{ name: 'dungeonSaveProgress', args: {}, ident: 'body' }] });
                } catch (_) { /* ignore */ }
            }

            dungeonActivity += battleResult.reward?.dungeonActivity ?? 0;
            return true;
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

        async function fetchDungeonData() {
            const result = await Send({ calls: [{ name: 'dungeonGetInfo', args: {}, ident: 'dungeonGetInfo' }] });
            if (!Array.isArray(result.results)) {
                lastError = 'Error fetching dungeonGetInfo';
                return null;
            }
            const dungeonGetInfo = getResponse(result);
            if (!dungeonGetInfo?.floor?.userData) {
                lastError = 'No dungeon data';
                return null;
            }
            return { dungeonGetInfo };
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
            await sleep(100);
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
            if (!data || titansList.length === 0) {
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

            const states = dungeonGetInfo.states.titans;
            const aliveTitans = getTitans(titansList, states);
            const userData = dungeonGetInfo.floor.userData;

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
                const ok = await executeOption(option, 'hero', lastDebugString);
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
                    const pool = aliveTitans[attackerType] ? aliveTitans[attackerType] : aliveTitans.all;
                    const heroes = pool.slice(0, 5).map((t) => t.id);
                    team = heroes.length > 0 ? { heroes, pet: null } : null;
                }

                if (!team) {
                    options.push(null);
                    continue;
                }

                const option = team.option || (await startAndSimulate(teamNum, team.heroes, team.pet, attackerType));
                if (!option?.win) {
                    options.push(null);
                    continue;
                }

                if (team.isHealing && option.win) {
                    lastDebugString += debugString(option, attackerType) + ' [heal]';
                    if (DUNGEON_VERBOSE) console.log('[Dungeon]', lastDebugString);
                    const ok = await executeOption(option, attackerType, lastDebugString);
                    timeDungeon.steps += Date.now() - stepStart;
                    return ok !== false;
                }
                if (team.isHealing) {
                    const fallback = getNeutralTitans(aliveTitans);
                    if (fallback.length > 0) {
                        const fallbackOption = await startAndSimulate(teamNum, fallback, null, attackerType);
                        options.push(fallbackOption?.win ? { option: fallbackOption, attackerType } : null);
                    } else {
                        options.push(null);
                    }
                    continue;
                }
                options.push({ option, attackerType });
            }

            const valid = options.filter(Boolean);
            if (valid.length === 0) {
                lastError = 'No winnable battles available';
                endDungeon(lastError);
                return false;
            }

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

            let finalOption = best.option;
            if (best.option.teamNum !== userData.length - 1) {
                const restarted = await startAndSimulate(
                    best.option.teamNum,
                    best.option.heroes,
                    best.option.pet,
                    best.attackerType,
                    best.option.favor
                );
                if (!restarted?.win) {
                    lastError = 'Restart failed';
                    endDungeon(lastError);
                    return false;
                }
                lastDebugString += debugString(restarted, best.attackerType) + ' [retry]';
                finalOption = restarted;
            }

            if (DUNGEON_VERBOSE) console.log('[Dungeon]', lastDebugString);
            const ok = await executeOption(finalOption, best.attackerType, lastDebugString);
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
            if (titanHealthSettings.autoRefreshPage) {
                setTimeout(() => location.reload(), 1000);
            } else {
                setTimeout(cheats.refreshGame, 1000);
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
            }
            return true;
        }

        this.start = async function (titanit) {
            maxDungeonActivity = titanit || getInput('countTitanit');
            stopDung = false;
            end = false;
            isRestart = false;
            lastError = null;
            stepCount = 0;
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
                    await sleep(100);
                }
            } catch (err) {
                console.error('[Dungeon] Fatal error:', err);
                endDungeon('Fatal dungeon error', err);
                reject(err);
            }
        };
    }

    async function executeTestDungeon() {
        const { HWHClasses, HWHFuncs } = window;

        if (window.HWHClasses && typeof executeDungeon === 'function') {
            window.HWHClasses.executeDungeon = executeDungeon;
        }

        const hasStealtherDungeon = await waitFor(() => typeof executeDungeon === 'function', { timeoutMs: 15000, intervalMs: 200 });
        if (hasStealtherDungeon) {
            HWHFuncs.setProgress('Executing: Dungeon (Stealther)', true);
            return await withTimeout(
                new Promise((resolve, reject) => {
                    try {
                        const dung = new executeDungeon(resolve, reject);
                        dung.start();
                    } catch (e) {
                        reject(e);
                    }
                }),
                20 * 60 * 1000,
                'Dungeon timed out'
            );
        }

        const hasNativeDungeon = await waitFor(() => typeof window.testDungeon === 'function', { timeoutMs: 5000, intervalMs: 200 });
        if (hasNativeDungeon) {
            HWHFuncs.setProgress('Executing: Dungeon (native fallback)', true);
            return await withTimeout(window.testDungeon(), 20 * 60 * 1000, 'Dungeon timed out');
        }

        throw new Error('Dungeon API not ready (missing executeDungeon/testDungeon)');
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
                <button class="sync-button" id="sync-settings-btn" title="Save/Load Settings">${UI_ICON.save}</button>
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
                name: UI_ICON.sync,
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
