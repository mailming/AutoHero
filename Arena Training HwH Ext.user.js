// ==UserScript==
// @name         Arena Training HwH Ext
// @namespace    HeroWarsHelper.ArenaTraining
// @version      1.30.4
// @description  Arena training + Counter Suggest panel (Arena gather / Clan Domination attack, SimLab, Train)
// @author       AutoHero
// @match        https://www.hero-wars.com/*
// @match        https://apps-1701433570146040.apps.fbsbx.com/*
// @grant        none
// @run-at       document-end
// @downloadURL https://github.com/mailming/AutoHero/raw/refs/heads/develop/Arena%20Training%20HwH%20Ext.user.js
// @updateURL https://github.com/mailming/AutoHero/raw/refs/heads/develop/Arena%20Training%20HwH%20Ext.user.js
// ==/UserScript==

(function() {
    'use strict';

    const EXTENSION_NAME = 'Arena Training Extension';
    const EXTENSION_VERSION = '1.30.4';
    const BRIDGE_URL = 'http://127.0.0.1:9876';
    const EXTENSION_AUTHOR = 'AutoHero';
    const AUTO_START_CHECKBOX = 'autoArenaTraining';
    /** Minimum settle time after load before auto-start may begin waiting on Auto Daily. */
    const AUTO_START_DELAY_MS = 5 * 60_000;
    /** How often to re-check Auto Daily / dungeon / AutoBattle busy flags. */
    const AUTO_START_POLL_MS = 60_000;
    let autoStartTimer = null;
    let autoStartWaitToken = 0;

    function registerI18n() {
        if (!window.HWHData?.i18nLangData) {
            return false;
        }
        Object.assign(window.HWHData.i18nLangData.en, {
            AUTO_ARENA_TRAINING: 'Auto Arena Training',
            AUTO_ARENA_TRAINING_TITLE: 'Auto-start arena training after Auto Daily finishes (including dungeon); lowest priority',
        });
        Object.assign(window.HWHData.i18nLangData.ru, {
            AUTO_ARENA_TRAINING: 'Авто-тренировка арены',
            AUTO_ARENA_TRAINING_TITLE: 'Автозапуск тренировки арены после Auto Daily (включая данж); самый низкий приоритет',
        });
        return true;
    }

    function createAutoStartCheckboxDefinition() {
        return {
            get label() {
                return window.HWHFuncs?.I18N?.('AUTO_ARENA_TRAINING') || 'Auto Arena Training';
            },
            cbox: null,
            get title() {
                return window.HWHFuncs?.I18N?.('AUTO_ARENA_TRAINING_TITLE')
                    || 'Auto-start arena training after Auto Daily finishes (including dungeon); lowest priority';
            },
            default: false,
        };
    }

    /** True while Auto Daily / AutoBattle / dungeon should outrank arena training. */
    function isHigherPriorityBusy() {
        return !!(
            window.HWH_AUTO_DAILY_RUNNING
            || window.HWH_AUTOBATTLE_RUNNING
            || window.HWH_DUNGEON_RUNNING
            || window.HWH_DUNGEON_BATTLE_OPEN
        );
    }

    function describeHigherPriorityBusy() {
        const parts = [];
        if (window.HWH_AUTO_DAILY_RUNNING) parts.push('Auto Daily');
        if (window.HWH_AUTOBATTLE_RUNNING) parts.push('AutoBattle');
        if (window.HWH_DUNGEON_RUNNING || window.HWH_DUNGEON_BATTLE_OPEN) parts.push('Dungeon');
        return parts.join(' + ') || 'higher-priority work';
    }

    function registerSettingsCheckbox() {
        if (!window.HWHData?.checkboxes) {
            return false;
        }
        registerI18n();
        const { checkboxes } = window.HWHData;
        if (checkboxes[AUTO_START_CHECKBOX]) {
            return true;
        }

        const entry = createAutoStartCheckboxDefinition();
        const reordered = {};
        for (const name in checkboxes) {
            reordered[name] = checkboxes[name];
            if (name === 'sendExpedition') {
                reordered[AUTO_START_CHECKBOX] = entry;
            }
        }
        if (!reordered[AUTO_START_CHECKBOX]) {
            reordered[AUTO_START_CHECKBOX] = entry;
        }
        for (const name of Object.keys(checkboxes)) {
            delete checkboxes[name];
        }
        Object.assign(checkboxes, reordered);
        return true;
    }

    let registerSettingsInterval = null;
    if (typeof window !== 'undefined') {
        registerSettingsInterval = setInterval(() => {
            if (registerSettingsCheckbox()) {
                clearInterval(registerSettingsInterval);
            }
        }, 50);
    }

    function ensureSettingsCheckboxUI(HWHFuncs) {
        registerSettingsCheckbox();
        const checkboxDef = window.HWHData?.checkboxes?.[AUTO_START_CHECKBOX];
        if (!checkboxDef || checkboxDef.cbox) {
            return checkboxDef?.cbox || null;
        }

        const scriptMenu = window.HWHClasses?.ScriptMenu?.getInst?.();
        const settingsDetails = document.querySelector('details.scriptMenu_Details[data-name="settings"]');
        if (!scriptMenu || !settingsDetails) {
            return null;
        }

        checkboxDef.cbox = scriptMenu.addCheckbox(checkboxDef.label, checkboxDef.title, settingsDetails);

        const expeditionCheckbox = window.HWHData.checkboxes.sendExpedition?.cbox;
        if (expeditionCheckbox && checkboxDef.cbox) {
            const expeditionRow = expeditionCheckbox.closest('.scriptMenu_divInput');
            const autoRow = checkboxDef.cbox.closest('.scriptMenu_divInput');
            if (expeditionRow && autoRow && expeditionRow.nextSibling !== autoRow) {
                expeditionRow.parentNode.insertBefore(autoRow, expeditionRow.nextSibling);
            }
        }

        const savedValue = HWHFuncs.getSaveVal?.(AUTO_START_CHECKBOX, checkboxDef.default);
        checkboxDef.cbox.checked = !!savedValue;
        checkboxDef.cbox.dataset.name = AUTO_START_CHECKBOX;
        checkboxDef.cbox.addEventListener('change', function onAutoStartToggle() {
            HWHFuncs.setSaveVal?.(AUTO_START_CHECKBOX, this.checked);
        });

        return checkboxDef.cbox;
    }

    function clearAutoStartTimer() {
        autoStartWaitToken += 1;
        if (autoStartTimer != null) {
            clearTimeout(autoStartTimer);
            autoStartTimer = null;
        }
    }

    function isAutoStartEnabled(HWHFuncs) {
        const checkboxDef = window.HWHData?.checkboxes?.[AUTO_START_CHECKBOX];
        if (checkboxDef?.cbox) {
            return checkboxDef.cbox.checked;
        }
        return !!HWHFuncs?.getSaveVal?.(AUTO_START_CHECKBOX, false);
    }

    async function waitForHigherPriorityIdle(HWHFuncs, waitToken) {
        let loggedBusy = false;
        while (isHigherPriorityBusy()) {
            if (waitToken !== autoStartWaitToken || !isAutoStartEnabled(HWHFuncs)) {
                return false;
            }
            const busyLabel = describeHigherPriorityBusy();
            if (!loggedBusy) {
                console.log(`[Arena Training] Waiting for ${busyLabel} to finish before auto-start`);
                loggedBusy = true;
            }
            HWHFuncs.setProgress?.(`Arena Training: waiting for ${busyLabel}...`, true);
            await new Promise((resolve) => {
                autoStartTimer = setTimeout(resolve, AUTO_START_POLL_MS);
            });
            autoStartTimer = null;
        }
        return waitToken === autoStartWaitToken && isAutoStartEnabled(HWHFuncs);
    }

    function scheduleAutoStart(training, HWHFuncs) {
        clearAutoStartTimer();
        if (!isAutoStartEnabled(HWHFuncs)) {
            return;
        }

        const waitToken = autoStartWaitToken;
        console.log(
            `[Arena Training] Auto-start scheduled in ${Math.round(AUTO_START_DELAY_MS / 1000)}s `
            + '(then waits for Auto Daily / dungeon to finish)'
        );
        autoStartTimer = setTimeout(async () => {
            autoStartTimer = null;
            if (waitToken !== autoStartWaitToken || !isAutoStartEnabled(HWHFuncs)) {
                return;
            }

            // Keep yielding to Auto Daily / dungeon / AutoBattle until they stay idle.
            while (true) {
                const canStart = await waitForHigherPriorityIdle(HWHFuncs, waitToken);
                if (!canStart) {
                    console.log('[Arena Training] Auto-start cancelled while waiting for higher-priority work');
                    return;
                }

                const status = training.getStatus?.() || {};
                const loopStatus = training.getLoopStatus?.() || {};
                if (status.running || loopStatus.loopRunning) {
                    console.log('[Arena Training] Auto-start skipped — training already running');
                    return;
                }
                if (isHigherPriorityBusy()) {
                    console.log('[Arena Training] Higher-priority work restarted; waiting again');
                    continue;
                }

                console.log('[Arena Training] Auto-starting training loop (Auto Daily idle)');
                HWHFuncs.setProgress('Arena Training: auto-starting loop...', true);
                training.startLoop({ label: 'auto-loop', opponentSource: 'topGet' });
                return;
            }
        }, AUTO_START_DELAY_MS);
    }

    function bindAutoStartCheckbox(training, HWHFuncs) {
        const checkbox = ensureSettingsCheckboxUI(HWHFuncs);
        if (!checkbox || checkbox.dataset.arenaTrainingBound === '1') {
            return;
        }
        checkbox.dataset.arenaTrainingBound = '1';
        checkbox.addEventListener('change', () => {
            scheduleAutoStart(training, HWHFuncs);
        });
    }

    const CONSTANTS = {
        BATTLE_VERSION: 296,
        DEFAULT_PET_ID: 6005,
        PET_NAMES: {
            6000: 'Fenris', 6001: 'Oliver', 6002: 'Merlin', 6003: 'Mara', 6004: 'Cain',
            6005: 'Albus', 6006: 'Axel', 6007: 'Biscuit', 6008: 'Khorus', 6009: 'Vex',
            6011: 'Robin',
        },
        HERO_NAMES: {
            71: 'Fluffy', 72: 'Byrna', 73: 'Adam', 74: 'Somna', 75: 'Eva',
        },
        DEFAULT_SIMULATIONS: 10,
        DEFAULT_MAX_COMBOS: 40,
        /** Cap C(heroPool,5)×pets when searchUntilTarget would otherwise be unbounded. */
        DEFAULT_MAX_GENERATED_COMBOS: 400,
        DEFAULT_POOL_SIZE: 12,
        DEFAULT_TARGET_WIN_RATE: 90,
        DEFAULT_USER_TEAM_TARGET_WIN_RATE: 70,
        DEFAULT_SKIP_CACHE_MIN_WIN_RATE: 90,
        DEFAULT_SKIP_CACHE_MAX_AGE_DAYS: 30,
        DEFAULT_META_TEAMS_LIMIT: 0,
        /** Keep only this many compact round summaries in loopSession (bridge already has full saves). */
        MAX_LOOP_ROUNDS_IN_MEMORY: 40,
    };

    function buildComboKey(heroIds, pet, banner = 0) {
        const heroes = (Array.isArray(heroIds) ? heroIds : [])
            .map(Number)
            .filter((id) => id > 0 && id < 6000)
            .slice(0, 5);
        return `${heroes.join(',')}|${Number(pet) || 0}|${Number(banner) || 0}`;
    }

    function pickFavor(heroIds, arenaFavor = {}) {
        const favor = {};
        for (const heroId of heroIds) {
            const key = String(heroId);
            if (arenaFavor[key] != null) favor[key] = Number(arenaFavor[key]);
            else if (arenaFavor[heroId] != null) favor[key] = Number(arenaFavor[heroId]);
        }
        return favor;
    }

    function resolveHeroName(heroId, cheats, lib) {
        const id = Number(heroId);
        if (!Number.isFinite(id)) return String(heroId);
        try {
            const key = id >= 6000 && id < 7000
                ? `LIB_PET_NAME_${id}`
                : `LIB_HERO_NAME_${id}`;
            const translated = cheats?.translate?.(key);
            if (translated && translated !== key) return translated;
            const data = lib?.getData?.('hero');
            const hero = data?.[id] || data?.[String(id)];
            if (hero?.name || hero?.caption) return hero.name || hero.caption;
        } catch {
            // fall through
        }
        if (id >= 6000 && id < 7000) return CONSTANTS.PET_NAMES[id] || `Pet ${id}`;
        return CONSTANTS.HERO_NAMES[id] || `Hero ${id}`;
    }


    /** BattleCalc returns huge battleLogs + battleData; never retain those past a single sample. */
    function slimEndDemoPayload(calcResult) {
        if (!calcResult) return null;
        return {
            result: {
                win: !!calcResult.result?.win,
                stars: Number(calcResult.result?.stars) || 0,
            },
            progress: calcResult.progress || null,
        };
    }

    function slimSimulationSample(sample) {
        if (!sample) return { win: false, battleTime: 0 };
        return {
            win: !!sample.win,
            battleTime: Number(sample.battleTime) || 0,
            ...(sample.error ? { error: String(sample.error) } : {}),
        };
    }

    function slimRankingEntry(entry) {
        if (!entry || typeof entry !== 'object') return entry;
        const sims = Array.isArray(entry.simulations)
            ? entry.simulations.map(slimSimulationSample)
            : undefined;
        const bannerStones = entry.bannerStones && typeof entry.bannerStones === 'object'
            ? entry.bannerStones
            : undefined;
        return {
            rank: entry.rank,
            heroes: entry.heroes,
            heroNames: entry.heroNames,
            pet: entry.pet,
            banner: entry.banner,
            ...(bannerStones ? { bannerStones } : {}),
            favor: entry.favor,
            source: entry.source,
            wins: entry.wins,
            losses: entry.losses,
            winRate: entry.winRate,
            averageBattleTime: entry.averageBattleTime,
            ...(sims ? { simulations: sims } : {}),
        };
    }

    /** Drop heavy fields before JSON.stringify / long-lived retention. */
    function slimTrainingResult(result) {
        if (!result || typeof result !== 'object') return result;
        const slim = { ...result };
        if (Array.isArray(slim.rankings)) {
            slim.rankings = slim.rankings.map(slimRankingEntry);
        }
        if (slim.best && typeof slim.best === 'object') {
            const { simulations, ...bestRest } = slim.best;
            slim.best = {
                ...bestRest,
                ...(Array.isArray(simulations)
                    ? { simulations: simulations.map(slimSimulationSample) }
                    : {}),
            };
        }
        if (Array.isArray(slim.pairAttempts)) {
            slim.pairAttempts = slim.pairAttempts.map((attempt) => ({
                attempt: attempt.attempt,
                type: attempt.type,
                winRate: attempt.result?.best?.winRate
                    ?? attempt.result?.rankings?.[0]?.winRate
                    ?? attempt.result?.cachedWinRate
                    ?? null,
                skipped: !!attempt.result?.skipped,
                skipReason: attempt.result?.skipReason,
                counterKey: attempt.counterLineup
                    ? `${(attempt.counterLineup.heroes || []).join(',')}:${attempt.counterLineup.pet}`
                    : undefined,
            }));
        }
        return slim;
    }

    /** Tiny in-memory loop history after bridge save (avoids multi-GB round growth). */
    function summarizeRoundForMemory(result) {
        if (!result || typeof result !== 'object') return result;
        const top = result.rankings?.[0] || result.best || null;
        return {
            sessionId: result.sessionId || null,
            round: result.round ?? null,
            label: result.label || null,
            skipped: !!result.skipped,
            skipReason: result.skipReason || null,
            targetMet: !!result.targetMet,
            stoppedBecause: result.stoppedBecause || null,
            completedAt: result.completedAt || null,
            error: result.error || null,
            opponent: result.opponent
                ? {
                    userId: result.opponent.userId,
                    name: result.opponent.name,
                    place: result.opponent.place,
                    source: result.opponent.source,
                }
                : undefined,
            topWinRate: top?.winRate ?? result.cachedBestWinRate ?? result.cachedWinRate ?? null,
            testedCombos: Array.isArray(result.rankings) ? result.rankings.length : null,
        };
    }

    function pushLoopRound(loopSession, result, { keepFull = false } = {}) {
        if (!loopSession) return;
        const entry = keepFull ? slimTrainingResult(result) : summarizeRoundForMemory(result);
        loopSession.rounds.push(entry);
        const maxRounds = CONSTANTS.MAX_LOOP_ROUNDS_IN_MEMORY;
        if (loopSession.rounds.length > maxRounds) {
            loopSession.rounds.splice(0, loopSession.rounds.length - maxRounds);
        }
    }

    function getTestFightCount(readInput, fallback) {
        const raw = parseInt(typeof readInput === 'function' ? readInput('countTestBattle') : readInput, 10);
        if (Number.isFinite(raw) && raw >= 1) {
            return raw;
        }
        const fallbackCount = parseInt(fallback, 10);
        if (Number.isFinite(fallbackCount) && fallbackCount >= 1) {
            return fallbackCount;
        }
        return CONSTANTS.DEFAULT_SIMULATIONS;
    }

    function randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1) + min);
    }

    /**
     * Yield so clicks/paint/network outrank training BattleCalc.
     * Prefers scheduler.yield / background postTask; falls back to idle / setTimeout(0).
     * Optional extra pause: `window.HWH_ARENA_TRAINING_YIELD_MS = 16` (or higher).
     */
    async function yieldForUi() {
        try {
            if (typeof scheduler?.yield === 'function') {
                await scheduler.yield();
            } else if (typeof scheduler?.postTask === 'function') {
                await scheduler.postTask(() => {}, { priority: 'background' });
            } else if (typeof requestIdleCallback === 'function') {
                await new Promise((resolve) => {
                    let done = false;
                    const finish = () => {
                        if (done) return;
                        done = true;
                        resolve();
                    };
                    requestIdleCallback(finish, { timeout: 32 });
                    setTimeout(finish, 48);
                });
            } else {
                await new Promise((resolve) => setTimeout(resolve, 0));
            }
        } catch (_) {
            await new Promise((resolve) => setTimeout(resolve, 0));
        }
        const extraMs = Number(typeof window !== 'undefined' ? window.HWH_ARENA_TRAINING_YIELD_MS : 0);
        if (Number.isFinite(extraMs) && extraMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, extraMs));
        }
    }

    /** Run a sync block as a low-priority task so queued UI work can run first. */
    function runAsBackgroundTask(fn) {
        return new Promise((resolve, reject) => {
            const run = () => {
                try {
                    fn(resolve, reject);
                } catch (error) {
                    reject(error);
                }
            };
            if (typeof scheduler?.postTask === 'function') {
                scheduler.postTask(run, { priority: 'background' }).catch(() => setTimeout(run, 0));
            } else {
                setTimeout(run, 0);
            }
        });
    }

    async function calcBattleCopy(battleData, seed, battleCalc, resolveBattleType, isValidBattleResult) {
        // Let the browser flush input/paint before the CPU-heavy BattleCalc.
        await yieldForUi();
        return runAsBackgroundTask((resolve, reject) => {
            const battle = structuredClone(battleData);
            if (seed != null) {
                battle.seed = seed;
            }
            const battleType = battle?.effects?.battleConfig ?? battle?.type ?? 'arena';
            try {
                battleCalc(battle, resolveBattleType(battleType), (calcResult) => {
                    if (!isValidBattleResult(calcResult)) {
                        resolve({ win: false, battleTime: 0, error: 'Invalid calculation result' });
                        return;
                    }
                    // Intentionally drop battleLogs / battleData — those alone can be tens of MB each.
                    resolve({
                        win: !!calcResult.result?.win,
                        battleTime: calcResult.battleTime || 0,
                        endDemo: slimEndDemoPayload(calcResult),
                    });
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    // One demoBattles_startBattle, then `count` local BattleCalc samples on copies of that battle.
    async function runLocalSeededDemo(options) {
        const {
            send,
            battleCalc,
            getBattleType,
            isValidBattleResult,
            endDemo,
            myTeam,
            opponentTeam,
            battleOptions = {},
            count,
            log = () => {},
            setProgress = () => {},
            isStopped = () => false,
            nextRandom = randomInt,
            getActionTs = () => Date.now(),
            throwIfSendError = () => {},
            defaultPetId = CONSTANTS.DEFAULT_PET_ID,
        } = options;

        const total = Math.max(1, count);
        const maxUpgrade = battleOptions.maxUpgrade !== false;
        const args = {
            mechanic: 'arena',
            defenceMaxUpgrade: true,
            maxUpgrade,
            defenceBuffs: {},
            buffs: {},
            parentId: 0,
            entryId: 0,
            defenceTeam: {
                units: opponentTeam.heroes,
                pet: opponentTeam.pet || defaultPetId,
            },
            defenceBanner: opponentTeam.banner || 1,
            defenceBannerStones: opponentTeam.bannerStones
                || opponentTeam.defenceBannerStones
                || {},
            defenceFavor: opponentTeam.favor || {},
            team: {
                units: myTeam.heroes,
                pet: myTeam.pet || defaultPetId,
            },
            banner: myTeam.banners?.[0] || 1,
            bannerStones: myTeam.bannerStones || {},
            favor: myTeam.favor || {},
        };

        log('[Arena Training] demoBattles_startBattle API #1 (server builds this matchup once)');
        const startResponse = await send({
            calls: [{
                name: 'demoBattles_startBattle',
                args,
                context: { actionTs: getActionTs() },
                ident: 'body',
            }],
        });

        if (startResponse?.error) {
            throw new Error(`${startResponse.error.name}: ${startResponse.error.description}`);
        }
        throwIfSendError(startResponse, 'demoBattles_startBattle');

        const responseData = startResponse.results?.[0]?.result?.response;
        const battleData = responseData?.battle || responseData;
        if (!battleData) {
            throw new Error('No battle data in demoBattles_startBattle response');
        }

        const serverSeed = battleData.seed;
        const simulations = [];
        let endDemoPayload = null;
        let demoEnded = false;
        log(`[Arena Training] BattleCalc local x${total} starting (server seed ${serverSeed}). No further demoBattles_startBattle for this matchup.`);
        try {
            for (let i = 0; i < total; i++) {
                if (isStopped()) break;
                const seed = i === 0 ? null : Math.floor(Date.now() / 1000) + nextRandom(0, 1e3) + i;
                const usedSeed = seed == null ? serverSeed : seed;
                setProgress(`Arena Training: BattleCalc local ${i + 1}/${total}`);
                try {
                    const sample = await calcBattleCopy(battleData, seed, battleCalc, getBattleType, isValidBattleResult);
                    if (!endDemoPayload && sample.endDemo) {
                        endDemoPayload = sample.endDemo;
                    }
                    simulations.push(slimSimulationSample(sample));
                    log(`[Arena Training] BattleCalc local ${i + 1}/${total} seed=${usedSeed} ${sample.win ? 'WIN' : 'LOSS'}${sample.error ? ' ' + sample.error : ''}`);
                } catch (error) {
                    console.error(`[Arena Training] BattleCalc local ${i + 1}/${total} failed:`, error);
                    simulations.push({ win: false, battleTime: 0, error: error.message });
                }
                // Yield again after each calc so the tab stays interactive between sims.
                await yieldForUi();
            }

            if (endDemo && endDemoPayload) {
                await endDemo(endDemoPayload, battleData);
                demoEnded = true;
            }
        } finally {
            // Always close the server demo — an open demo blocks real arenaAttack (NotAvailable).
            if (endDemo && !demoEnded) {
                try {
                    await endDemo(
                        endDemoPayload || { result: { win: false, stars: 0 }, progress: null },
                        battleData
                    );
                    demoEnded = true;
                } catch (cleanupError) {
                    console.warn('[Arena Training] demoBattles_endBattle cleanup failed:', cleanupError);
                }
            }
            endDemoPayload = null;
        }

        const wins = simulations.filter((sample) => sample.win).length;
        const losses = simulations.length - wins;
        const battleTimes = simulations.map((sample) => sample.battleTime).filter((time) => time > 0);
        const averageBattleTime = battleTimes.length
            ? battleTimes.reduce((sum, time) => sum + time, 0) / battleTimes.length
            : 0;
        const winRate = simulations.length ? (wins / simulations.length) * 100 : 0;
        const summary = `Arena Training: BattleCalc local ${wins}W/${losses}L (${winRate.toFixed(0)}% of ${simulations.length})`;
        log(`[Arena Training] ${summary}. Server demo calls this matchup: 1.`);
        setProgress(summary);

        return {
            total: simulations.length,
            wins,
            losses,
            winRate,
            averageBattleTime,
            simulations,
            serverSeed,
        };
    }

    let waitForHWH = null;
    if (typeof window !== 'undefined') {
        waitForHWH = setInterval(() => {
            if (window.HWHClasses?.ScriptMenu && window.Send && window.cheats?.BattleCalc && window.HWHFuncs) {
                const scriptMenu = window.HWHClasses.ScriptMenu.getInst();
                if (scriptMenu?.mainMenu) {
                    clearInterval(waitForHWH);
                    initializeExtension();
                }
            }
        }, 200);
    }

    function initializeExtension() {
        const { HWHClasses, HWHFuncs, Send, cheats, lib } = window;
        HWHFuncs.addExtentionName(EXTENSION_NAME, EXTENSION_VERSION, EXTENSION_AUTHOR);

        const training = createArenaTraining({ Send, cheats, lib, HWHFuncs });
        // Keep method `this` intact if callers extract simulateMatchup / runSingle.
        if (typeof training.simulateMatchup === 'function') {
            training.simulateMatchup = training.simulateMatchup.bind(training);
        }
        if (typeof training.runSingle === 'function') {
            training.runSingle = training.runSingle.bind(training);
        }
        window.ArenaTraining = training;

        if (window.LLMHWH) {
            window.LLMHWH.arenaTrainingRun = (options) => training.run(options);
            window.LLMHWH.arenaTrainingStartLoop = (options) => training.startLoop(options);
            window.LLMHWH.arenaTrainingStopLoop = () => training.stopLoop();
            window.LLMHWH.arenaTrainingGetLoopHistory = () => training.getLoopHistory();
            window.LLMHWH.arenaTrainingGetOpponents = (forceRefresh, options) => training.getOpponents(forceRefresh, options);
            window.LLMHWH.arenaTrainingGetResults = () => training.getResults();
            window.LLMHWH.arenaTrainingExportResults = () => training.exportResults();
            window.LLMHWH.arenaTrainingGetStatus = () => training.getStatus();
            window.LLMHWH.arenaTrainingStop = () => training.stop();
            window.LLMHWH.arenaTrainingSimulateMatchup = (options) => training.simulateMatchup(options);
        }

        bindAutoStartCheckbox(training, HWHFuncs);
        scheduleAutoStart(training, HWHFuncs);

        const counterPanel = initializeCounterSuggestPanel({ HWHClasses, HWHFuncs, Send, cheats, lib, training });
        HWHClasses.ScriptMenu.getInst().addCombinedButton([
            {
                name: 'Arena Train',
                title: 'Loop arena top-list training — auto-saves results (demo battles, no attempts)',
                onClick: () => training.startLoop({ label: 'menu-loop', opponentSource: 'topGet' }),
                color: 'purple',
            },
            {
                name: 'Counters',
                title: 'Counter Suggest — Arena gather or Clan Domination attack target',
                onClick: () => counterPanel?.openCounters?.(),
                color: 'purple',
            },
        ]);

        console.log(`${EXTENSION_NAME} v${EXTENSION_VERSION} ready (includes Counter Suggest panel)`);
    }

    function createArenaTraining({ Send, cheats, lib, HWHFuncs }) {
        const BattleCalc = cheats.BattleCalc;
        let running = false;
        let loopRunning = false;
        let stopRequested = false;
        let status = { running: false, loopRunning: false };
        let lastResults = null;
        let loopSession = null;
        let opponentsCache = null;
        let opponentsMeta = { myPlace: null, serverId: null };

        function sleep(ms) {
            return new Promise((resolve) => setTimeout(resolve, ms));
        }

        const FATAL_ERROR_PATTERNS = [
            /InvalidSession/i,
            /Invalid session/i,
        ];

        function isFatalTrainingError(error) {
            const message = String(error?.message || error || '');
            return FATAL_ERROR_PATTERNS.some((pattern) => pattern.test(message));
        }

        function throwIfSendError(response, label = 'API call') {
            if (response?.error) {
                throw new Error(`${response.error.name}: ${response.error.description}`);
            }
            for (const item of response?.results || []) {
                if (item?.error) {
                    throw new Error(`${item.error.name}: ${item.error.description}`);
                }
            }
        }

        function stopTrainingOnFatalError(error, context = '') {
            if (!isFatalTrainingError(error)) {
                return false;
            }
            stopRequested = true;
            loopRunning = false;
            const prefix = context ? `${context}: ` : '';
            status.message = `${prefix}${error.message}`;
            if (loopSession) {
                loopSession.fatalError = error.message;
                loopSession.stoppedAt = new Date().toISOString();
            }
            HWHFuncs.setProgress(`Arena Training stopped — ${error.message}`, true);
            console.error(`[Arena Training] Fatal error, stopping loop${context ? ` (${context})` : ''}:`, error);
            return true;
        }

        async function fetchMetaTeamCandidates(options = {}) {
            const params = new URLSearchParams();
            if (options.metaTeamsSnapshotId) {
                params.set('snapshotId', String(options.metaTeamsSnapshotId));
            }
            const limit = Number(options.metaTeamsLimit ?? CONSTANTS.DEFAULT_META_TEAMS_LIMIT);
            if (limit > 0) {
                params.set('limit', String(limit));
            }

            try {
                const res = await fetch(`${BRIDGE_URL}/training/meta-candidates?${params}`);
                if (!res.ok) {
                    console.warn('[Arena Training] Bridge meta-candidates failed:', res.status);
                    return { snapshotId: null, candidates: [] };
                }
                const data = await res.json();
                return data.ok
                    ? { snapshotId: data.snapshotId, candidates: data.candidates || [] }
                    : { snapshotId: null, candidates: [] };
            } catch (e) {
                console.warn('[Arena Training] Bridge meta-candidates error:', e.message);
                return { snapshotId: null, candidates: [] };
            }
        }

        function buildMetaTeamCandidates(metaTeams, data, options, defaultBanner) {
            if (!metaTeams?.length) return [];

            const arenaFavor = data.favor?.arena || {};
            const ownedHeroIds = new Set(
                (data.heroes || [])
                    .filter((h) => h?.id && h.id < 6000)
                    .map((h) => Number(h.id))
            );
            const ownedPetIds = new Set(
                (data.heroes || [])
                    .filter((h) => h?.id >= 6000 && h.id < 7000)
                    .map((h) => Number(h.id))
            );
            const arenaPet = data.teams?.arena?.[5];
            const fallbackPet = arenaPet && ownedPetIds.has(Number(arenaPet))
                ? Number(arenaPet)
                : CONSTANTS.DEFAULT_PET_ID;

            const candidates = [];
            for (const team of metaTeams) {
                const heroes = (team.heroIds || team.hero_ids || []).map(Number).filter((id) => id > 0 && id < 6000);
                if (heroes.length !== 5) continue;
                if (!heroes.every((id) => ownedHeroIds.has(id))) continue;

                let pet = team.pet != null ? Number(team.pet) : null;
                if (pet && !ownedPetIds.has(pet)) {
                    pet = fallbackPet;
                }
                if (!pet) {
                    pet = fallbackPet;
                }

                const banner = team.banner != null ? Number(team.banner) : (defaultBanner || 1);
                candidates.push({
                    heroes,
                    pet,
                    banner,
                    favor: pickFavor(heroes, arenaFavor),
                    source: 'meta-team',
                    metaPopularity: team.popularityCount ?? team.popularity_count ?? null,
                    metaRank: team.rowRank ?? team.row_rank ?? null,
                    metaComboKey: team.comboKey ?? team.combo_key ?? buildComboKey(heroes, pet, banner),
                });
            }

            return candidates;
        }

        function buildMetaTeamOpponents(metaTeams) {
            if (!metaTeams?.length) return [];

            const opponents = [];
            for (let index = 0; index < metaTeams.length; index++) {
                const team = metaTeams[index];
                const heroes = (team.heroIds || team.hero_ids || [])
                    .map(Number)
                    .filter((id) => id > 0 && id < 6000);
                if (heroes.length !== 5) continue;

                const pet = team.pet != null ? Number(team.pet) : CONSTANTS.DEFAULT_PET_ID;
                const banner = team.banner != null ? Number(team.banner) : 1;
                const comboKey = team.comboKey ?? team.combo_key ?? buildComboKey(heroes, pet, banner);
                const heroNames = (team.heroNames || team.hero_names || heroes.map(heroName));
                const popularity = team.popularityCount ?? team.popularity_count ?? null;
                const rank = team.rowRank ?? team.row_rank ?? (index + 1);
                const label = heroNames.length
                    ? `Meta: ${heroNames.join(', ')}`
                    : `Meta team #${rank}`;

                const raw = {
                    userId: `meta_${comboKey.replace(/\|/g, '_')}`,
                    place: String(rank),
                    power: popularity,
                    heroes: [...heroes.map((id) => ({ id })), { id: pet, type: 'pet' }],
                    banners: [{ id: banner }],
                    user: { name: label },
                    source: 'meta-opponent',
                    metaComboKey: comboKey,
                    metaPopularity: popularity,
                    metaRank: rank,
                };

                opponents.push({
                    index: opponents.length,
                    userId: raw.userId,
                    name: label,
                    place: raw.place,
                    power: raw.power,
                    heroes,
                    heroNames,
                    pet,
                    banner,
                    source: raw.source,
                    metaComboKey: comboKey,
                    metaPopularity: popularity,
                    metaRank: rank,
                    raw,
                });
            }

            return opponents;
        }

        async function fetchMetaTeamOpponents(options = {}) {
            const meta = await fetchMetaTeamCandidates(options);
            const opponents = buildMetaTeamOpponents(meta.candidates);
            return {
                snapshotId: meta.snapshotId,
                opponents,
            };
        }

        async function saveRoundToBridge(result) {
            try {
                // Slim before stringify — full BattleCalc payloads used to spike memory into multi-GB.
                const payload = slimTrainingResult(result);
                const res = await fetch(`${BRIDGE_URL}/training/save`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                if (!res.ok) {
                    console.warn('[Arena Training] Bridge save failed:', res.status);
                    return false;
                }
                return true;
            } catch (e) {
                console.warn('[Arena Training] Bridge save error:', e.message);
                return false;
            }
        }

        function resolveOpponentComboContext(opponentRaw, opponentMeta = {}) {
            const team = extractOpponentConfig(opponentRaw || opponentMeta.raw || opponentMeta);
            const heroes = team.hasValidTeam
                ? team.heroes
                : (Array.isArray(opponentMeta.heroes) ? opponentMeta.heroes : []).slice(0, 5);
            const pet = team.pet ?? opponentMeta.pet;
            const banner = team.banner ?? opponentMeta.banner;
            const comboKey = heroes.length === 5
                ? buildComboKey(heroes, pet, banner)
                : null;
            return {
                heroes,
                pet,
                banner,
                comboKey,
                hasValidTeam: team.hasValidTeam || heroes.length === 5,
            };
        }

        async function fetchUserCounterSkipCheck(comboKey, counterLineup, testerUserId, options = {}) {
            const maxAgeDays = Number(options.skipCacheMaxAgeDays ?? CONSTANTS.DEFAULT_SKIP_CACHE_MAX_AGE_DAYS);
            const params = new URLSearchParams({
                comboKey,
                mode: 'user',
                testerUserId: String(testerUserId),
                myPet: String(counterLineup?.pet ?? ''),
                maxAgeDays: String(maxAgeDays),
            });
            for (const heroId of counterLineup?.heroes || []) {
                params.append('myHero', String(heroId));
            }

            try {
                const res = await fetch(`${BRIDGE_URL}/training/skip-check?${params}`);
                if (!res.ok) {
                    console.warn('[Arena Training] Bridge user skip-check failed:', res.status);
                    return { shouldSkip: false, reason: 'bridge_error' };
                }
                const data = await res.json();
                return data.ok ? data : { shouldSkip: false, reason: 'invalid_response' };
            } catch (e) {
                console.warn('[Arena Training] Bridge user skip-check error:', e.message);
                return { shouldSkip: false, reason: 'bridge_unreachable' };
            }
        }

        async function resolveCurrentTesterUserId() {
            try {
                const response = await Send({
                    calls: [{ name: 'userGetInfo', args: {}, ident: 'userGetInfo' }],
                });
                const userInfo = response.results?.find((r) => r.ident === 'userGetInfo')?.result?.response || {};
                const userId = userInfo?.userId ?? userInfo?.id ?? null;
                return userId != null ? String(userId) : null;
            } catch (e) {
                console.warn('[Arena Training] Could not resolve tester user id:', e.message);
                return null;
            }
        }

        async function fetchOpponentSkipCheck(comboKey, options = {}) {
            const minWinRate = Number(options.skipCacheMinWinRate ?? CONSTANTS.DEFAULT_SKIP_CACHE_MIN_WIN_RATE);
            const maxAgeDays = Number(options.skipCacheMaxAgeDays ?? CONSTANTS.DEFAULT_SKIP_CACHE_MAX_AGE_DAYS);
            const params = new URLSearchParams({
                comboKey,
                minWinRate: String(minWinRate),
                maxAgeDays: String(maxAgeDays),
            });
            const opponentHeroIds = options.opponentHeroIds || options.opponentHeroes;
            if (Array.isArray(opponentHeroIds)) {
                for (const heroId of opponentHeroIds) {
                    params.append('opponentHero', String(heroId));
                }
            }

            try {
                const res = await fetch(`${BRIDGE_URL}/training/skip-check?${params}`);
                if (!res.ok) {
                    console.warn('[Arena Training] Bridge skip-check failed:', res.status);
                    return { shouldSkip: false, reason: 'bridge_error' };
                }
                const data = await res.json();
                return data.ok ? data : { shouldSkip: false, reason: 'invalid_response' };
            } catch (e) {
                console.warn('[Arena Training] Bridge skip-check error:', e.message);
                return { shouldSkip: false, reason: 'bridge_unreachable' };
            }
        }

        function getActionTs() {
            return Date.now();
        }

        function getBattleType(strBattleType) {
            if (!strBattleType) return 'get_pvp';
            if (strBattleType === 'arena' || strBattleType === 'pvp' || strBattleType === 'grand') {
                return 'get_pvp';
            }
            return 'get_pvp';
        }

        function isValidBattleResult(result) {
            return result && result.result && typeof result.result.win === 'boolean';
        }

        function parseHeroes(raw) {
            if (!raw) return [];
            return Array.isArray(raw) ? raw : Object.values(raw);
        }

        function heroPower(hero) {
            return Number(hero?.power || hero?.sumPower || 0);
        }

        function heroName(heroId) {
            return resolveHeroName(heroId, cheats, lib);
        }

        function combinations(items, size, maxCount = Infinity) {
            if (!Array.isArray(items) || items.length < size) return [];
            const limit = maxCount == null || !Number.isFinite(maxCount) ? Infinity : maxCount;
            const result = [];
            const combo = [];
            function backtrack(start) {
                if (result.length >= limit) return;
                if (combo.length === size) {
                    result.push([...combo]);
                    return;
                }
                for (let i = start; i < items.length; i++) {
                    combo.push(items[i]);
                    backtrack(i + 1);
                    combo.pop();
                }
            }
            backtrack(0);
            return result;
        }

        function resolveTesterInfo(userInfo, maxUpgrade = true) {
            if (maxUpgrade !== false) {
                return { userId: '0', name: 'maxHeros', maxUpgrade: true };
            }
            const userId = userInfo?.userId ?? userInfo?.id ?? null;
            const name = userInfo?.name ?? userInfo?.nickname ?? null;
            return {
                userId: userId != null ? String(userId) : null,
                name: name != null ? String(name) : null,
                maxUpgrade: false,
            };
        }

        function counterLineupFromBest(best, arenaFavor = {}) {
            const heroes = (best?.heroes || []).map(Number);
            return {
                heroes,
                pet: Number(best?.pet) || CONSTANTS.DEFAULT_PET_ID,
                banner: best?.banner,
                favor: best?.favor || pickFavor(heroes, arenaFavor),
                source: best?.source || 'max-counter',
                heroNames: best?.heroNames,
            };
        }

        function counterLineupFromCache(cachedMatch, arenaFavor = {}, defaultBanner = 1) {
            const heroes = (cachedMatch?.myHeroIds || []).map(Number).filter((id) => id > 0 && id < 6000);
            const pet = Number(cachedMatch?.myPet) || CONSTANTS.DEFAULT_PET_ID;
            return {
                heroes,
                pet,
                banner: defaultBanner,
                favor: pickFavor(heroes, arenaFavor),
                source: 'cached-counter',
                heroNames: cachedMatch?.myHeroNames,
                cachedWinRate: cachedMatch?.winRate != null ? Number(cachedMatch.winRate) : null,
            };
        }

        function normalizeExcludeKeys(keys = []) {
            return new Set(
                keys.map((entry) => (typeof entry === 'string' ? entry : candidateKey(entry)))
            );
        }

        function buildRatingStashEvents(meta = {}) {
            const actionTs = meta.actionTs || getActionTs();
            const timestamp = meta.timestamp || Math.floor(Date.now() / 1000);
            const sessionNumber = meta.sessionNumber || 1;
            const windowCounter = meta.windowCounter || 12;
            const baseParams = {
                sessionNumber,
                assetsReloadNum: 0,
                assetsType: 'web',
                assetsLoadingPercent: 0,
                assetsLoadingTime: 0,
            };
            return [
                {
                    type: '.client.window.close',
                    params: {
                        ...baseParams,
                        actionTs,
                        windowName: 'rating',
                        prevWindowName: 'global',
                        timestamp,
                        windowCounter,
                    },
                },
                {
                    type: '.client.button.click',
                    params: {
                        ...baseParams,
                        actionTs: actionTs + 100,
                        windowName: 'rating',
                        buttonName: 'rating_tab:0',
                        timestamp,
                        windowCounter: 0,
                        assetsType: 'cache',
                        assetsLoadingTime: 0,
                    },
                },
                {
                    type: '.client.window.open',
                    params: {
                        ...baseParams,
                        actionTs: actionTs + 103,
                        windowName: 'rating',
                        prevWindowName: 'global',
                        timestamp,
                        windowCounter: windowCounter + 1,
                        assetsLoadingTime: 17,
                    },
                },
            ];
        }

        function parseTopGetArenaEntry(entry, users = {}, index = 0) {
            if (!entry || typeof entry !== 'object') return null;

            const userId = entry.userId ?? entry.id ?? entry.uid ?? entry.user_id;
            const user = entry.user || users[String(userId)] || users[userId] || {};
            const heroesRaw = entry.heroes
                || entry.heroIds
                || entry.team?.units
                || entry.team?.heroes
                || entry.defenceTeam?.units
                || entry.defence?.units
                || [];

            const heroes = [];
            const heroItems = Array.isArray(heroesRaw) ? heroesRaw : Object.values(heroesRaw || {});
            for (const item of heroItems) {
                if (typeof item === 'number') {
                    heroes.push({ id: item });
                } else if (item?.id != null) {
                    heroes.push(item);
                }
            }

            const petId = entry.pet ?? entry.team?.pet ?? entry.defenceTeam?.pet;
            if (petId != null && !heroes.some((hero) => (hero?.id || hero) >= 6000)) {
                heroes.push({ id: Number(petId), type: 'pet' });
            }

            if (!heroes.length && !userId) return null;

            const banners = entry.banners
                || (entry.banner != null ? [{ id: entry.banner }] : [])
                || (entry.defenceBanner != null ? [{ id: entry.defenceBanner }] : []);

            return {
                userId: userId != null ? String(userId) : `top_${index}`,
                place: entry.place ?? entry.rank ?? entry.position ?? String(index + 1),
                power: entry.power ?? entry.teamPower ?? entry.score ?? entry.value,
                heroes,
                banners,
                user: { name: user.name || entry.name || entry.nickname || `Top ${index + 1}` },
                source: 'topGet',
            };
        }

        function normalizeArenaTopResponse(response, users = {}) {
            if (!response) return [];

            const userMap = users && typeof users === 'object' ? users : {};
            let entries = [];

            if (Array.isArray(response.top)) {
                entries = response.top;
            } else if (Array.isArray(response)) {
                entries = response;
            } else if (Array.isArray(response.list)) {
                entries = response.list;
            } else if (Array.isArray(response.rating)) {
                entries = response.rating;
            } else if (Array.isArray(response.data)) {
                entries = response.data;
            } else if (Array.isArray(response.entries)) {
                entries = response.entries;
            } else if (typeof response === 'object') {
                entries = Object.entries(response)
                    .filter(([key]) => key !== 'users' && key !== 'place')
                    .map(([, value]) => value)
                    .filter((value) => (
                        value
                        && typeof value === 'object'
                        && !Array.isArray(value)
                        && (value.heroes || value.heroIds || value.team || value.userId || value.id)
                    ));
            }

            return entries
                .map((entry, index) => parseTopGetArenaEntry(entry, userMap, index))
                .filter((entry) => entry && extractOpponentConfig(entry).hasValidTeam);
        }

        function extractTopGetResult(response) {
            return response?.results?.find((r) => (
                r.ident === 'group_1_body' || r.ident === 'topGet'
            ))?.result?.response;
        }

        async function resolveServerId(options = {}) {
            if (options.serverId != null) return Number(options.serverId);
            const response = await Send({
                calls: [{ name: 'userGetInfo', args: {}, ident: 'userGetInfo' }],
            });
            const userInfo = response.results?.find((r) => r.ident === 'userGetInfo')?.result?.response || {};
            return Number(userInfo.serverId || userInfo.server || 0) || null;
        }

        async function fetchArenaTopOpponents(options = {}) {
            const actionTs = getActionTs();
            const serverId = await resolveServerId(options);
            if (!serverId) {
                throw new Error('Could not resolve serverId for topGet arena');
            }

            const calls = [];
            if (options.skipStashClient !== true) {
                calls.push({
                    name: 'stashClient',
                    args: { data: buildRatingStashEvents({ ...options.stashMeta, actionTs }) },
                    context: { actionTs },
                    ident: 'group_0_body',
                });
            }

            calls.push({
                name: 'topGet',
                args: {
                    type: 'arena',
                    extraId: options.extraId ?? 0,
                    serverId,
                },
                context: { actionTs: actionTs + 1500 },
                ident: 'group_1_body',
            });

            const response = await Send({ calls });
            if (response?.error) {
                throw new Error(`${response.error.name}: ${response.error.description}`);
            }

            const topGetResult = extractTopGetResult(response);
            const users = topGetResult?.users || {};
            let opponents = normalizeArenaTopResponse(topGetResult, users);
            if (options.opponentLimit > 0) {
                opponents = opponents.slice(0, options.opponentLimit);
            }
            if (!opponents.length) {
                throw new Error('topGet arena returned no opponent teams');
            }

            opponentsMeta = {
                myPlace: topGetResult?.place || null,
                serverId,
                count: opponents.length,
            };

            return opponents;
        }

        async function fetchArenaFindEnemies() {
            const response = await Send({
                calls: [{ name: 'arenaFindEnemies', args: {}, ident: 'arenaFindEnemies' }],
            });
            return response.results?.find((r) => r.ident === 'arenaFindEnemies')?.result?.response || [];
        }

        async function fetchOpponents(options = {}) {
            const source = options.opponentSource || 'topGet';
            if (source === 'arenaFindEnemies') {
                return fetchArenaFindEnemies();
            }
            return fetchArenaTopOpponents(options);
        }

        async function loadTrainingBaseData() {
            const response = await Send({
                calls: [
                    { name: 'teamGetAll', args: {}, ident: 'teamGetAll' },
                    { name: 'teamGetFavor', args: {}, ident: 'teamGetFavor' },
                    { name: 'heroGetAll', args: {}, ident: 'heroGetAll' },
                    { name: 'userGetInfo', args: {}, ident: 'userGetInfo' },
                ],
            });

            const get = (ident) => response.results?.find((r) => r.ident === ident)?.result?.response;
            return {
                teams: get('teamGetAll') || {},
                favor: get('teamGetFavor') || {},
                heroes: parseHeroes(get('heroGetAll')),
                userInfo: get('userGetInfo') || {},
            };
        }

        async function loadGameData(options = {}) {
            if (options.opponentOverride) {
                const base = await loadTrainingBaseData();
                return { ...base, opponents: [options.opponentOverride] };
            }

            const [base, opponents] = await Promise.all([
                loadTrainingBaseData(),
                fetchOpponents(options),
            ]);
            return { ...base, opponents };
        }

        function extractOpponentConfig(opponent) {
            const heroes = [];
            let pet = CONSTANTS.DEFAULT_PET_ID;
            let banner = 1;

            for (const item of opponent?.heroes || []) {
                const id = typeof item === 'number' ? item : item?.id;
                if (!id) continue;
                if (id >= 6000 && id < 7000) {
                    pet = id;
                } else if (id < 6000 && heroes.length < 5) {
                    heroes.push(id);
                }
            }

            if (opponent?.pet != null && opponent.pet >= 6000) {
                pet = Number(opponent.pet);
            }

            if (opponent?.banner != null) {
                banner = Number(opponent.banner);
            } else if (opponent?.banners?.[0]) {
                const b = opponent.banners[0];
                banner = typeof b === 'number' ? b : (b?.id || 1);
            }

            const favor = {};
            const sourceFavor = opponent?.favor && typeof opponent.favor === 'object'
                ? opponent.favor
                : null;
            if (sourceFavor) {
                for (const [key, value] of Object.entries(sourceFavor)) {
                    const heroId = Number(key);
                    const petId = Number(
                        value && typeof value === 'object'
                            ? (value.favorPetId ?? value.petId ?? value.id ?? value.pet)
                            : value
                    );
                    if (heroId > 0 && heroId < 6000 && petId >= 6000 && petId < 7000) {
                        favor[String(heroId)] = petId;
                    }
                }
            }
            // When heroes arrive as full unit objects, patronage often lives on favorPetId.
            if (!Object.keys(favor).length) {
                for (const item of opponent?.heroes || []) {
                    if (!item || typeof item !== 'object') continue;
                    const heroId = Number(item.id ?? item.heroId);
                    const petId = Number(item.favorPetId ?? item.patronPetId ?? item.favorPet);
                    if (heroId > 0 && heroId < 6000 && petId >= 6000 && petId < 7000) {
                        favor[String(heroId)] = petId;
                    }
                }
            }
            const bannerStones = opponent?.bannerStones
                || opponent?.defenceBannerStones
                || {};

            return {
                hasValidTeam: heroes.length === 5,
                heroes,
                pet,
                banner,
                favor,
                bannerStones: bannerStones && typeof bannerStones === 'object' ? bannerStones : {},
            };
        }

        function describeOpponentTeam(opponent) {
            const team = extractOpponentConfig(opponent || {});
            return {
                userId: opponent?.userId ?? null,
                name: opponent?.user?.name || opponent?.name || null,
                place: opponent?.place ?? null,
                source: opponent?.source ?? null,
                heroCount: team.heroes.length,
                heroes: team.heroes,
                pet: team.pet,
                banner: team.banner,
            };
        }

        function recordInvalidOpponentRound(loopSession, roundNum, opponentMeta, opponentRaw) {
            const teamInfo = describeOpponentTeam(opponentRaw || opponentMeta);
            console.warn(
                `[Arena Training] Round ${roundNum} skipped — incomplete opponent team (${teamInfo.heroCount}/5 heroes)`,
                teamInfo
            );
            pushLoopRound(loopSession, {
                round: roundNum,
                skipped: true,
                skipReason: 'invalid_opponent_team',
                opponent: {
                    index: opponentMeta?.index,
                    userId: teamInfo.userId,
                    name: teamInfo.name,
                    place: teamInfo.place,
                    source: teamInfo.source,
                    metaComboKey: opponentMeta?.metaComboKey,
                },
                heroCount: teamInfo.heroCount,
                heroes: teamInfo.heroes,
                completedAt: new Date().toISOString(),
            });
        }

        function buildMyTeamConfig(heroIds, pet, banner, arenaFavor, bannerStones = {}) {
            return {
                heroes: heroIds,
                pet,
                banners: [banner],
                favor: pickFavor(heroIds, arenaFavor),
                bannerStones: bannerStones && typeof bannerStones === 'object' ? bannerStones : {},
            };
        }

        async function endDemoBattle(calcResult, battleData) {
            const progress = calcResult.progress?.length
                ? calcResult.progress
                : [{
                    v: CONSTANTS.BATTLE_VERSION,
                    b: 0,
                    seed: battleData?.seed || Math.floor(Math.random() * 1e9),
                    attackers: { input: [], heroes: {} },
                    defenders: { input: [], heroes: {} },
                }];

            const response = await Send({
                calls: [{
                    name: 'demoBattles_endBattle',
                    args: {
                        result: {
                            win: !!calcResult.result?.win,
                            stars: calcResult.result?.stars || 0,
                        },
                        progress,
                    },
                    context: { actionTs: getActionTs() },
                    ident: 'body',
                }],
            });

            throwIfSendError(response, 'demoBattles_endBattle');

            const battle = response?.results?.[0]?.result?.response?.battle;
            return {
                parentId: battle?.parentId,
                battleId: battle?.id,
            };
        }

        function resolveTestFightCount(explicitFallback) {
            return getTestFightCount(
                (name) => HWHFuncs.getInput?.(name),
                explicitFallback || CONSTANTS.DEFAULT_SIMULATIONS
            );
        }

        async function simulateTeam(myTeam, opponentTeam, simulationCount, battleOptions = {}) {
            const count = resolveTestFightCount(simulationCount);
            return runLocalSeededDemo({
                send: Send,
                battleCalc: BattleCalc,
                getBattleType,
                isValidBattleResult,
                endDemo: endDemoBattle,
                myTeam,
                opponentTeam,
                battleOptions,
                count,
                log: (message) => console.log(message),
                setProgress: (message) => HWHFuncs.setProgress(message),
                isStopped: () => stopRequested,
                getActionTs,
                throwIfSendError,
            });
        }

        function resolveBanner(userInfo, teams) {
            if (userInfo?.banner) {
                return Array.isArray(userInfo.banner) ? userInfo.banner[0] : userInfo.banner;
            }
            return 1;
        }

        function resolveGrandBanners(userInfo, fallbackBanner = 1) {
            const banners = [];
            if (Array.isArray(userInfo?.banners) && userInfo.banners.length) {
                for (let i = 0; i < 3; i++) {
                    banners.push(Number(userInfo.banners[i] ?? userInfo.banners[0]));
                }
                return banners;
            }
            if (userInfo?.banner != null) {
                const banner = Array.isArray(userInfo.banner) ? userInfo.banner[0] : userInfo.banner;
                return [banner, banner, banner];
            }
            return [fallbackBanner, fallbackBanner + 1, fallbackBanner + 2].map((b) => b || 1);
        }

        function candidateKey(candidate) {
            return `${candidate.heroes.join(',')}:${candidate.pet}`;
        }

        function dedupeCandidates(candidates, seen = new Set()) {
            const unique = [];
            for (const candidate of candidates) {
                const key = candidateKey(candidate);
                if (seen.has(key)) continue;
                seen.add(key);
                unique.push(candidate);
            }
            return unique;
        }

        function resolveHeroPoolSize(options = {}) {
            if (options.topLimit > 0) return Number(options.topLimit);
            if (options.heroPoolSize > 0) return Number(options.heroPoolSize);
            return CONSTANTS.DEFAULT_POOL_SIZE;
        }

        function applyTrainingOptions(options = {}) {
            const heroPoolSize = resolveHeroPoolSize(options);
            return { ...options, heroPoolSize, topLimit: heroPoolSize };
        }

        function resolvePetPool(ownedPets, arenaTeam, options = {}) {
            if (options.petPool?.length) {
                return options.petPool.map(Number);
            }

            const exhaustive = options.searchUntilTarget !== false;
            if (exhaustive) {
                const pets = [...new Set([
                    arenaTeam[5],
                    ...ownedPets,
                    CONSTANTS.DEFAULT_PET_ID,
                ].filter(Boolean))];
                return pets.length ? pets : [CONSTANTS.DEFAULT_PET_ID];
            }

            return [...new Set([
                arenaTeam[5],
                ...ownedPets.slice(0, 3),
                CONSTANTS.DEFAULT_PET_ID,
            ].filter(Boolean))];
        }

        function buildTrainingPools(data, options) {
            const arenaTeam = data.teams?.arena || [];
            const arenaFavor = data.favor?.arena || {};
            const grandFavor = data.favor?.grand || arenaFavor;
            const ownedHeroes = data.heroes
                .filter((h) => h?.id && h.id < 6000)
                .sort((a, b) => heroPower(b) - heroPower(a));

            const ownedPets = data.heroes
                .filter((h) => h?.id >= 6000 && h.id < 7000)
                .sort((a, b) => heroPower(b) - heroPower(a))
                .map((h) => h.id);

            const poolSize = resolveHeroPoolSize(options);
            const heroPool = (options.heroPool?.length
                ? options.heroPool.map(Number)
                : ownedHeroes.slice(0, poolSize).map((h) => h.id));

            const petPool = resolvePetPool(ownedPets, arenaTeam, options);
            const banner = options.banner ?? resolveBanner(data.userInfo, data.teams);
            const grandBanners = resolveGrandBanners(data.userInfo, banner);

            const priorityCandidates = [
                ...buildArenaCandidates(arenaTeam, arenaFavor, banner, options),
                ...buildGrandArenaCandidates(data.teams?.grand || [], grandFavor, grandBanners, banner, options),
            ];

            return {
                arenaTeam,
                arenaFavor,
                heroPool,
                petPool,
                banner,
                priorityCandidates,
            };
        }

        function buildArenaCandidates(arenaTeam, arenaFavor, banner, options = {}) {
            if (options.includeCurrentTeam === false || arenaTeam.length < 6) {
                return [];
            }

            const heroes = arenaTeam.slice(0, 5).map(Number);
            return [{
                heroes,
                pet: Number(arenaTeam[5]),
                banner,
                favor: pickFavor(heroes, arenaFavor),
                source: 'arena-team',
            }];
        }

        function buildGrandArenaCandidates(grandTeams, grandFavor, grandBanners, banner, options = {}) {
            if (options.includeGrandArenaTeams === false || !Array.isArray(grandTeams)) {
                return [];
            }

            const candidates = [];
            grandTeams.forEach((team, index) => {
                if (!Array.isArray(team) || team.length < 6) return;
                const heroes = team.slice(0, 5).map(Number);
                if (heroes.some((id) => !id)) return;
                candidates.push({
                    heroes,
                    pet: Number(team[5]),
                    banner: grandBanners[index] ?? banner,
                    favor: pickFavor(heroes, grandFavor),
                    source: `grand-arena-team-${index + 1}`,
                });
            });
            return candidates;
        }

        function buildGeneratedCandidates(pools, { maxHeroCombos = Infinity, excludeKeys = new Set() } = {}) {
            const { heroPool, petPool, banner, arenaFavor } = pools;
            const heroCombos = combinations(heroPool, 5, maxHeroCombos);
            const generated = [];

            for (const heroIds of heroCombos) {
                for (const pet of petPool) {
                    const candidate = {
                        heroes: heroIds,
                        pet,
                        banner,
                        favor: pickFavor(heroIds, arenaFavor),
                        source: 'generated',
                    };
                    if (excludeKeys.has(candidateKey(candidate))) continue;
                    generated.push(candidate);
                }
            }

            return generated;
        }

        function buildPhasedCandidatePlan(data, options) {
            const pools = buildTrainingPools(data, options);
            const arenaCandidates = buildArenaCandidates(
                pools.arenaTeam,
                pools.arenaFavor,
                pools.banner,
                options
            );
            const grandArenaCandidates = buildGrandArenaCandidates(
                data.teams?.grand || [],
                data.favor?.grand || pools.arenaFavor,
                resolveGrandBanners(data.userInfo, pools.banner),
                pools.banner,
                options
            );
            const priorityCandidates = dedupeCandidates([
                ...arenaCandidates,
                ...grandArenaCandidates,
            ]);

            return {
                ...pools,
                arenaCandidates,
                grandArenaCandidates,
                priorityCandidates,
            };
        }

        function pickOpponent(opponents, options) {
            const validOpponents = (opponents || []).filter((opponent) => extractOpponentConfig(opponent).hasValidTeam);
            if (!validOpponents.length) {
                throw new Error('No arena opponents with complete 5-hero teams available');
            }
            if (options.opponentUserId != null) {
                const found = validOpponents.find((o) => String(o.userId) === String(options.opponentUserId));
                if (!found) {
                    throw new Error(`Opponent ${options.opponentUserId} not found or has incomplete team data`);
                }
                return found;
            }
            const index = Math.max(0, Math.min(validOpponents.length - 1, Number(options.opponentIndex) || 0));
            return validOpponents[index];
        }

        function resolveOpponentRaw(opponents, options) {
            if (options.opponentOverride) {
                return options.opponentOverride;
            }
            if (options.opponentUserId != null) {
                const found = (opponents || []).find((o) => String(o.userId) === String(options.opponentUserId));
                if (found) {
                    return found;
                }
            }
            return pickOpponent(opponents, options);
        }

        return {
            async getOpponents(forceRefresh = false, options = {}) {
                const source = options.opponentSource || 'topGet';
                if (!forceRefresh && opponentsCache?.source === source && opponentsCache?.list) {
                    return opponentsCache.list;
                }

                const opponents = await fetchOpponents({ ...options, opponentSource: source });
                opponentsCache = {
                    source,
                    myPlace: opponentsMeta.myPlace,
                    serverId: opponentsMeta.serverId,
                    list: opponents.map((opp, index) => {
                        const team = extractOpponentConfig(opp);
                        return {
                            index,
                            userId: opp.userId,
                            name: opp.user?.name || `Opponent ${opp.userId}`,
                            place: opp.place,
                            power: opp.power,
                            heroes: team.heroes,
                            heroNames: team.heroes.map(heroName),
                            pet: team.pet,
                            banner: team.banner,
                            source,
                            raw: opp,
                        };
                    }),
                };
                return opponentsCache.list;
            },

            getStatus() {
                return {
                    ...status,
                    ...this.getLoopStatus(),
                    lastResultsId: lastResults?.sessionId || null,
                };
            },

            getResults() {
                return lastResults;
            },

            exportResults() {
                return lastResults ? { exportedAt: new Date().toISOString(), ...lastResults } : null;
            },

            stop() {
                stopRequested = true;
                loopRunning = false;
                return this.getStatus();
            },

            stopLoop() {
                return this.stop();
            },

            getLoopHistory() {
                return loopSession;
            },

            getLoopStatus() {
                return {
                    loopRunning,
                    loopId: loopSession?.loopId || null,
                    roundCount: loopSession?.rounds?.length || 0,
                    startedAt: loopSession?.startedAt || null,
                    lastSavedAt: loopSession?.lastSavedAt || null,
                };
            },

            async runCounterPairWorkflow(opponentMeta, runOptions = {}, trainOptions = {}, roundNum = 1) {
                const opponentRaw = runOptions.opponentOverride ?? opponentMeta.raw ?? null;
                const maxTargetWinRate = Number(trainOptions.targetWinRate ?? CONSTANTS.DEFAULT_TARGET_WIN_RATE);
                const userTargetWinRate = Number(
                    trainOptions.userTeamTargetWinRate ?? CONSTANTS.DEFAULT_USER_TEAM_TARGET_WIN_RATE
                );
                const excludeKeys = normalizeExcludeKeys(trainOptions.excludeCandidateKeys);
                const pairAttempts = [];
                let attempt = 0;
                let finalMaxResult = null;
                let finalUserResult = null;
                let userTargetMet = false;

                const opponentCombo = resolveOpponentComboContext(opponentRaw, opponentMeta);
                const comboKey = opponentCombo.comboKey;
                let workflowTesterUserId;
                const cachedMaxQueue = [];
                let cachedMaxLoaded = false;

                const pushCachedMaxAttempt = (lineup, attemptNum, skipInfo = null) => {
                    const skippedResult = {
                        skipped: true,
                        skipReason: 'cached_counter',
                        attempt: attemptNum,
                        opponentComboKey: comboKey,
                        cachedBestWinRate: lineup.cachedWinRate
                            ?? skipInfo?.bestWinRate
                            ?? skipInfo?.cachedBestWinRate,
                        cachedBestMatch: {
                            myHeroIds: lineup.heroes,
                            myHeroNames: lineup.heroNames,
                            myPet: lineup.pet,
                            winRate: lineup.cachedWinRate,
                        },
                        cachedLastTestedAt: skipInfo?.lastTestedAt ?? skipInfo?.cachedLastTestedAt,
                        counterLineup: lineup,
                        opponent: {
                            index: opponentMeta.index,
                            userId: opponentMeta.userId,
                            name: opponentMeta.name,
                            place: opponentMeta.place,
                            power: opponentMeta.power,
                            source: opponentMeta.source,
                            metaComboKey: opponentMeta.metaComboKey,
                            metaPopularity: opponentMeta.metaPopularity,
                            metaRank: opponentMeta.metaRank,
                        },
                        completedAt: new Date().toISOString(),
                    };
                    pairAttempts.push({
                        attempt: attemptNum,
                        type: 'max-cache',
                        result: slimTrainingResult(skippedResult),
                    });
                    pushLoopRound(loopSession, skippedResult);
                    console.log(
                        `[Arena Training] Round ${roundNum} attempt ${attemptNum} — using cached ${lineup.cachedWinRate?.toFixed?.(1) ?? lineup.cachedWinRate ?? '?'}% counter (${cachedMaxQueue.length} remaining in cache queue)`
                    );
                    return lineup;
                };

                const enqueueCachedMaxMatches = (skipInfo) => {
                    const matches = Array.isArray(skipInfo?.bestMatches) && skipInfo.bestMatches.length
                        ? skipInfo.bestMatches
                        : (skipInfo?.bestMatch || skipInfo?.cachedBestMatch
                            ? [skipInfo.bestMatch || skipInfo.cachedBestMatch]
                            : []);
                    let queued = 0;
                    for (const match of matches) {
                        if (!Array.isArray(match?.myHeroIds) || match.myHeroIds.length !== 5) continue;
                        const lineup = counterLineupFromCache(match);
                        const key = candidateKey(lineup);
                        if (excludeKeys.has(key)) continue;
                        if (cachedMaxQueue.some((entry) => candidateKey(entry) === key)) continue;
                        cachedMaxQueue.push(lineup);
                        queued++;
                    }
                    return queued;
                };

                const tryApplyCachedMaxSkip = (skipInfo, attemptNum) => {
                    const shouldSkip = skipInfo?.shouldSkip || skipInfo?.skipped;
                    if (!shouldSkip) {
                        if (comboKey) {
                            console.log(
                                `[Arena Training] Round ${roundNum} skip-check — no cached ${trainOptions.skipCacheMinWinRate ?? CONSTANTS.DEFAULT_SKIP_CACHE_MIN_WIN_RATE}%+ max counter for ${comboKey}`
                            );
                        }
                        return null;
                    }

                    const queued = enqueueCachedMaxMatches(skipInfo);
                    if (!cachedMaxQueue.length) {
                        console.warn(
                            `[Arena Training] Round ${roundNum} skip-check returned shouldSkip without a usable 5-hero counter`,
                            skipInfo
                        );
                        return null;
                    }
                    if (queued > 0) {
                        console.log(
                            `[Arena Training] Round ${roundNum} — queued ${cachedMaxQueue.length} cached ${trainOptions.skipCacheMinWinRate ?? CONSTANTS.DEFAULT_SKIP_CACHE_MIN_WIN_RATE}%+ max counter(s) to try with user team first`
                        );
                    }
                    return pushCachedMaxAttempt(cachedMaxQueue.shift(), attemptNum, skipInfo);
                };

                while (!stopRequested && (!loopSession || loopRunning)) {
                    attempt++;
                    let counterLineup = null;
                    let maxResult = null;
                    let usedCache = false;

                    if (
                        !cachedMaxLoaded
                        && trainOptions.skipCachedOpponents !== false
                        && comboKey
                    ) {
                        cachedMaxLoaded = true;
                        const skipInfo = await fetchOpponentSkipCheck(comboKey, {
                            ...trainOptions,
                            opponentHeroIds: opponentCombo.heroes,
                        });
                        counterLineup = tryApplyCachedMaxSkip(skipInfo, attempt);
                        usedCache = !!counterLineup;
                    } else if (cachedMaxQueue.length) {
                        counterLineup = pushCachedMaxAttempt(cachedMaxQueue.shift(), attempt);
                        usedCache = true;
                    }

                    if (!counterLineup) {
                        status.message = `Round ${roundNum} attempt ${attempt} — max search (${excludeKeys.size} excluded)`;
                        maxResult = await this.runSingle({
                            ...trainOptions,
                            maxUpgrade: true,
                            skipCachedOpponents: false,
                            opponentHeroIds: opponentCombo.heroes,
                            excludeCandidateKeys: [...excludeKeys],
                            searchUntilTarget: true,
                            opponentUserId: opponentMeta.userId,
                            opponentIndex: runOptions.opponentIndex ?? opponentMeta.index ?? 0,
                            opponentOverride: opponentRaw,
                            label: `${trainOptions.label}-r${roundNum}-max-a${attempt}`,
                        });
                        finalMaxResult = slimTrainingResult(maxResult);
                        pairAttempts.push({ attempt, type: 'max-search', result: finalMaxResult });
                        pushLoopRound(loopSession, finalMaxResult);

                        if (maxResult?.skipped && maxResult.cachedBestMatch?.myHeroIds?.length === 5) {
                            counterLineup = tryApplyCachedMaxSkip(maxResult, attempt);
                            usedCache = !!counterLineup;
                        }

                        if (!counterLineup) {
                            if (trainOptions.saveToBridge !== false) {
                                const saved = await saveRoundToBridge(finalMaxResult);
                                if (saved && loopSession) {
                                    loopSession.lastSavedAt = new Date().toISOString();
                                }
                            }

                            if (!maxResult.best || maxResult.best.winRate < maxTargetWinRate) {
                                console.log(
                                    `[Arena Training] Round ${roundNum} — no further ${maxTargetWinRate}%+ max counter found after ${attempt} attempt(s)`
                                );
                                break;
                            }

                            counterLineup = counterLineupFromBest(maxResult.best);
                            console.log(
                                `[Arena Training] Round ${roundNum} attempt ${attempt} max — ${maxResult.best.winRate.toFixed(1)}%:`,
                                maxResult.best.heroNames.join(', ')
                            );
                        }
                    } else if (usedCache) {
                        console.log(
                            `[Arena Training] Round ${roundNum} attempt ${attempt} max — cached ${counterLineup.cachedWinRate?.toFixed?.(1) ?? '?'}%:`,
                            (counterLineup.heroNames || counterLineup.heroes.map(heroName)).join(', ')
                        );
                    }

                    let userWinRate = null;
                    let userResult = null;

                    if (
                        trainOptions.skipCachedOpponents !== false
                        && comboKey
                        && counterLineup
                    ) {
                        if (workflowTesterUserId === undefined) {
                            workflowTesterUserId = await resolveCurrentTesterUserId();
                        }
                        if (workflowTesterUserId) {
                            const userSkip = await fetchUserCounterSkipCheck(
                                comboKey,
                                counterLineup,
                                workflowTesterUserId,
                                trainOptions
                            );
                            if (userSkip.shouldSkip) {
                                userWinRate = userSkip.cachedWinRate ?? 0;
                                userResult = {
                                    skipped: true,
                                    skipReason: 'cached_user_counter',
                                    attempt,
                                    opponentComboKey: comboKey,
                                    cachedWinRate: userSkip.cachedWinRate,
                                    cachedMatch: userSkip.cachedMatch,
                                    cachedLastTestedAt: userSkip.lastTestedAt,
                                    tester: {
                                        userId: workflowTesterUserId,
                                        name: userSkip.testerName,
                                        maxUpgrade: false,
                                    },
                                    counterLineup,
                                    best: {
                                        heroes: counterLineup.heroes,
                                        heroNames: counterLineup.heroNames
                                            || counterLineup.heroes.map(heroName),
                                        pet: counterLineup.pet,
                                        winRate: userWinRate,
                                        wins: userSkip.cachedWins,
                                        losses: userSkip.cachedLosses,
                                    },
                                    completedAt: new Date().toISOString(),
                                };
                                pairAttempts.push({
                                    attempt,
                                    type: 'user-cache',
                                    result: slimTrainingResult(userResult),
                                    counterLineup,
                                });
                                pushLoopRound(loopSession, userResult);
                                console.log(
                                    `[Arena Training] Round ${roundNum} attempt ${attempt} user skipped — cached ${userWinRate.toFixed(1)}% within ${trainOptions.skipCacheMaxAgeDays ?? CONSTANTS.DEFAULT_SKIP_CACHE_MAX_AGE_DAYS} days`
                                );
                            }
                        }
                    }

                    if (!userResult) {
                        status.message = `Round ${roundNum} attempt ${attempt} — user test same lineup`;
                        userResult = await this.runSingle({
                            ...trainOptions,
                            maxUpgrade: false,
                            counterLineup,
                            counterLineupOnly: true,
                            skipCachedOpponents: false,
                            opponentUserId: opponentMeta.userId,
                            opponentIndex: runOptions.opponentIndex ?? opponentMeta.index ?? 0,
                            opponentOverride: opponentRaw,
                            label: `${trainOptions.label}-r${roundNum}-user-a${attempt}`,
                        });
                        userResult = slimTrainingResult(userResult);
                        pairAttempts.push({ attempt, type: 'user-counter', result: userResult, counterLineup });
                        pushLoopRound(loopSession, userResult);

                        if (trainOptions.saveToBridge !== false) {
                            const userSaved = await saveRoundToBridge(userResult);
                            if (userSaved && loopSession) {
                                loopSession.lastSavedAt = new Date().toISOString();
                            }
                        }

                        userWinRate = userResult.best?.winRate ?? 0;
                    }

                    finalUserResult = slimTrainingResult(userResult);
                    lastResults = finalUserResult;

                    const userHeroNames = userResult.best?.heroNames?.join(', ')
                        || counterLineup.heroNames?.join(', ')
                        || counterLineup.heroes.map(heroName).join(', ');
                    if (!userResult.skipped) {
                        console.log(
                            `[Arena Training] Round ${roundNum} attempt ${attempt} user — ${userWinRate.toFixed(1)}%:`,
                            userHeroNames
                        );
                    }

                    if (userWinRate >= userTargetWinRate) {
                        userTargetMet = true;
                        console.log(
                            `[Arena Training] Round ${roundNum} — user team reached ${userTargetWinRate}%+ with counter lineup`
                        );
                        break;
                    }

                    excludeKeys.add(candidateKey(counterLineup));
                    const nextFromCache = cachedMaxQueue.length > 0;
                    console.log(
                        nextFromCache
                            ? `[Arena Training] Round ${roundNum} — user ${userWinRate.toFixed(1)}% < ${userTargetWinRate}%, trying next cached max counter (${cachedMaxQueue.length} left)`
                            : `[Arena Training] Round ${roundNum} — user ${userWinRate.toFixed(1)}% < ${userTargetWinRate}%, searching another ${maxTargetWinRate}%+ max counter`
                    );

                    const maxAttempts = Number(trainOptions.maxCounterAttempts);
                    if (Number.isFinite(maxAttempts) && maxAttempts > 0 && attempt >= maxAttempts) {
                        console.warn(`[Arena Training] Round ${roundNum} — stopped after ${maxAttempts} counter attempts`);
                        break;
                    }
                }

                const summary = slimTrainingResult({
                    round: roundNum,
                    attempts: attempt,
                    userTargetWinRate,
                    maxTargetWinRate,
                    userTargetMet,
                    excludeCount: excludeKeys.size,
                    pairAttempts,
                    maxResult: finalMaxResult,
                    userResult: finalUserResult,
                    completedAt: new Date().toISOString(),
                });
                lastResults = summary;
                return summary;
            },

            startLoop(options = {}) {
                if (loopRunning) {
                    return { started: false, ...this.getLoopStatus(), message: 'Loop already running' };
                }

                const trainDefaults = {
                    label: 'loop',
                    opponentSource: 'topGet',
                    topLimit: 12,
                    heroPoolSize: 12,
                    maxCombinations: 20,
                    simulationsPerCombo: 10,
                    targetWinRate: CONSTANTS.DEFAULT_TARGET_WIN_RATE,
                    userTeamTargetWinRate: CONSTANTS.DEFAULT_USER_TEAM_TARGET_WIN_RATE,
                    searchUntilTarget: true,
                    skipCachedOpponents: true,
                    skipCacheMinWinRate: CONSTANTS.DEFAULT_SKIP_CACHE_MIN_WIN_RATE,
                    skipCacheMaxAgeDays: CONSTANTS.DEFAULT_SKIP_CACHE_MAX_AGE_DAYS,
                    includeCurrentTeam: true,
                    includeGrandArenaTeams: true,
                    useMetaTeams: true,
                    useMetaTeamsAsOpponents: true,
                    metaTeamsLimit: CONSTANTS.DEFAULT_META_TEAMS_LIMIT,
                    includeUserTeamTest: true,
                    saveToBridge: true,
                    delayBetweenRoundsMs: 2000,
                    repeatCycle: true,
                    maxRounds: 0,
                };
                const trainOptions = applyTrainingOptions({ ...trainDefaults, ...options });

                loopRunning = true;
                stopRequested = false;
                loopSession = {
                    loopId: `loop_${Date.now()}`,
                    label: trainOptions.label,
                    startedAt: new Date().toISOString(),
                    config: trainOptions,
                    rounds: [],
                    lastSavedAt: null,
                };

                status.loopRunning = true;
                status.message = 'Loop training started';

                (async () => {
                    let roundNum = 0;

                    const runOpponentRound = async (opponentMeta, runOptions = {}) => {
                        if (!loopRunning || stopRequested) return false;
                        if (trainOptions.maxRounds > 0 && roundNum >= trainOptions.maxRounds) {
                            loopRunning = false;
                            return false;
                        }

                        roundNum++;
                        status.loopRound = roundNum;
                        const phaseLabel = runOptions.phaseLabel || 'Loop';
                        status.message = `${phaseLabel} round ${roundNum} — ${opponentMeta?.name || opponentMeta?.userId || 'opponent'}`;

                        try {
                            const opponentRaw = runOptions.opponentOverride ?? opponentMeta.raw ?? null;
                            if (opponentRaw && !extractOpponentConfig(opponentRaw).hasValidTeam) {
                                recordInvalidOpponentRound(loopSession, roundNum, opponentMeta, opponentRaw);
                                return true;
                            }

                            if (trainOptions.includeUserTeamTest === false) {
                                const result = slimTrainingResult(await this.runSingle({
                                    ...trainOptions,
                                    maxUpgrade: true,
                                    skipCachedOpponents: false,
                                    opponentUserId: opponentMeta.userId,
                                    opponentIndex: runOptions.opponentIndex ?? opponentMeta.index ?? 0,
                                    opponentOverride: opponentRaw,
                                    label: `${trainOptions.label}-r${roundNum}-max`,
                                }));
                                lastResults = result;
                                if (trainOptions.saveToBridge !== false) {
                                    const saved = await saveRoundToBridge(result);
                                    if (saved) loopSession.lastSavedAt = new Date().toISOString();
                                }
                                pushLoopRound(loopSession, result);
                            } else {
                                await this.runCounterPairWorkflow(
                                    opponentMeta,
                                    runOptions,
                                    trainOptions,
                                    roundNum
                                );
                            }
                        } catch (err) {
                            console.error(`[Arena Training] Round ${roundNum} failed:`, err);
                            pushLoopRound(loopSession, {
                                round: roundNum,
                                opponentIndex: opponentMeta?.index,
                                opponentSource: opponentMeta?.source,
                                error: err.message,
                                fatal: isFatalTrainingError(err),
                                completedAt: new Date().toISOString(),
                            });
                            if (stopTrainingOnFatalError(err, `round ${roundNum}`)) {
                                return false;
                            }
                        }

                        if (trainOptions.delayBetweenRoundsMs > 0) {
                            await sleep(trainOptions.delayBetweenRoundsMs);
                        }
                        return true;
                    };

                    try {
                        while (loopRunning && !stopRequested) {
                            const opponents = await this.getOpponents(true, trainOptions);
                            const indexes = Array.isArray(trainOptions.opponentIndexes) && trainOptions.opponentIndexes.length
                                ? trainOptions.opponentIndexes
                                : opponents.map((o) => o.index);

                            for (const idx of indexes) {
                                if (!loopRunning || stopRequested) break;
                                const opponentList = await this.getOpponents(false, trainOptions);
                                const opponentMeta = opponentList.find((o) => o.index === idx);
                                if (!opponentMeta) continue;
                                const shouldContinue = await runOpponentRound.call(this, opponentMeta, {
                                    phaseLabel: 'Arena',
                                    opponentIndex: idx,
                                    opponentOverride: opponentMeta.raw,
                                });
                                if (!shouldContinue) break;
                            }

                            if (
                                loopRunning
                                && !stopRequested
                                && trainOptions.useMetaTeamsAsOpponents !== false
                            ) {
                                const meta = await fetchMetaTeamOpponents(trainOptions);
                                if (meta.opponents.length) {
                                    loopSession.metaOpponentsSnapshotId = meta.snapshotId;
                                    console.log(
                                        `[Arena Training] Meta opponent phase: ${meta.opponents.length} teams from snapshot ${meta.snapshotId}`
                                    );
                                    for (const opponentMeta of meta.opponents) {
                                        if (!loopRunning || stopRequested) break;
                                        const shouldContinue = await runOpponentRound.call(this, opponentMeta, {
                                            phaseLabel: 'Meta opponent',
                                            opponentOverride: opponentMeta.raw,
                                            opponentIndex: 0,
                                        });
                                        if (!shouldContinue) break;
                                    }
                                } else {
                                    console.warn('[Arena Training] No meta team opponents available from bridge');
                                }
                            }

                            if (trainOptions.maxRounds > 0 && roundNum >= trainOptions.maxRounds) break;
                            if (!trainOptions.repeatCycle) break;
                        }
                    } finally {
                        loopRunning = false;
                        status.loopRunning = false;
                        status.message = loopSession?.fatalError
                            ? `Loop stopped — ${loopSession.fatalError}`
                            : stopRequested
                                ? `Loop stopped after ${roundNum} rounds`
                                : `Loop finished after ${roundNum} rounds`;
                        loopSession.completedAt = new Date().toISOString();
                        loopSession.totalRounds = roundNum;
                        HWHFuncs.setProgress(status.message, true);
                    }
                })();

                HWHFuncs.setProgress('Arena loop training started — results auto-save to bridge', true);
                return { started: true, ...this.getLoopStatus(), message: 'Loop training started' };
            },

            async run(options = {}) {
                options = applyTrainingOptions(options);

                if (options.includeUserTeamTest === false) {
                    return this.runSingle({
                        ...options,
                        maxUpgrade: true,
                        label: `${options.label || 'arena-training'}-max`,
                    });
                }

                const opponents = await this.getOpponents(false, options);
                const opponentRaw = resolveOpponentRaw(opponents, options);
                const opponentMeta = opponents.find((o) => o.raw === opponentRaw)
                    || opponents[options.opponentIndex ?? 0]
                    || (() => {
                        const team = extractOpponentConfig(opponentRaw);
                        return {
                            index: options.opponentIndex ?? 0,
                            userId: opponentRaw?.userId,
                            name: opponentRaw?.user?.name,
                            place: opponentRaw?.place,
                            power: opponentRaw?.power,
                            heroes: team.heroes,
                            pet: team.pet,
                            banner: team.banner,
                            source: opponentRaw?.source || options.opponentSource,
                            raw: opponentRaw,
                        };
                    })();

                return this.runCounterPairWorkflow(
                    opponentMeta,
                    {
                        opponentOverride: opponentRaw,
                        opponentIndex: options.opponentIndex ?? opponentMeta.index ?? 0,
                    },
                    options,
                    1
                );
            },

            async runSingle(options = {}) {
                if (running) {
                    throw new Error('Arena training already running');
                }

                options = applyTrainingOptions(options);
                running = true;
                stopRequested = false;
                const maxUpgrade = options.maxUpgrade !== false;
                const userTeamOnly = options.userTeamOnly === true;
                const counterLineupOnly = options.counterLineupOnly === true && !!options.counterLineup;
                const externalExcludeKeys = normalizeExcludeKeys(options.excludeCandidateKeys);
                const sessionSuffix = maxUpgrade ? 'max' : 'user';
                const sessionId = `arena_train_${Date.now()}_${sessionSuffix}`;
                const startedAt = new Date().toISOString();
                const simulationsPerCombo = resolveTestFightCount(options.simulationsPerCombo);
                const targetWinRate = Number(options.targetWinRate ?? CONSTANTS.DEFAULT_TARGET_WIN_RATE);
                const searchUntilTarget = options.searchUntilTarget !== false;

                status = {
                    running: true,
                    sessionId,
                    currentCombo: 0,
                    totalCombos: 0,
                    targetWinRate,
                    searchUntilTarget,
                    label: options.label || 'arena-training',
                    message: 'Loading arena data...',
                };

                try {
                    HWHFuncs.setProgress('Arena Training: loading opponents and heroes...', true);
                    const data = await loadGameData(options);
                    const tester = resolveTesterInfo(data.userInfo, maxUpgrade);
                    const opponentRaw = resolveOpponentRaw(data.opponents, options);
                    const opponentTeam = extractOpponentConfig(opponentRaw);
                    if (!opponentTeam.hasValidTeam) {
                        const teamInfo = describeOpponentTeam(opponentRaw);
                        throw new Error(
                            `Selected opponent has invalid team data (${teamInfo.heroCount}/5 heroes, user ${teamInfo.userId || teamInfo.name || 'unknown'})`
                        );
                    }

                    const opponentComboKey = buildComboKey(
                        opponentTeam.heroes,
                        opponentTeam.pet,
                        opponentTeam.banner
                    );

                    if (options.skipCachedOpponents !== false && maxUpgrade) {
                        const skipInfo = await fetchOpponentSkipCheck(opponentComboKey, {
                            ...options,
                            opponentHeroIds: opponentTeam.heroes,
                        });
                        if (skipInfo.shouldSkip) {
                            const skippedResult = {
                                sessionId,
                                label: options.label || 'arena-training',
                                startedAt,
                                completedAt: new Date().toISOString(),
                                skipped: true,
                                skipReason: 'cached_counter',
                                opponentComboKey,
                                cachedBestWinRate: skipInfo.bestWinRate,
                                cachedBestMatch: skipInfo.bestMatch,
                                cachedLastTestedAt: skipInfo.lastTestedAt,
                                opponent: {
                                    index: data.opponents.indexOf(opponentRaw),
                                    userId: opponentRaw.userId,
                                    name: opponentRaw.user?.name,
                                    place: opponentRaw.place,
                                    power: opponentRaw.power,
                                    banner: opponentTeam.banner,
                                    source: opponentRaw.source || options.opponentSource || 'topGet',
                                    team: opponentTeam,
                                },
                                config: {
                                    skipCachedOpponents: true,
                                    skipCacheMinWinRate: Number(options.skipCacheMinWinRate ?? CONSTANTS.DEFAULT_SKIP_CACHE_MIN_WIN_RATE),
                                    skipCacheMaxAgeDays: Number(options.skipCacheMaxAgeDays ?? CONSTANTS.DEFAULT_SKIP_CACHE_MAX_AGE_DAYS),
                                },
                            };
                            lastResults = slimTrainingResult(skippedResult);
                            HWHFuncs.setProgress(
                                `Arena Training skipped — cached ${skipInfo.bestWinRate?.toFixed?.(1) ?? skipInfo.bestWinRate}% counter (${opponentComboKey})`,
                                true
                            );
                            return lastResults;
                        }
                    }

                    const plan = buildPhasedCandidatePlan(data, options);
                    const {
                        arenaCandidates,
                        grandArenaCandidates,
                        heroPool,
                        petPool,
                        banner,
                    } = plan;

                    let metaTeamCandidates = [];
                    let metaTeamsSnapshotId = null;
                    if (!userTeamOnly && options.useMetaTeams !== false) {
                        const meta = await fetchMetaTeamCandidates(options);
                        metaTeamsSnapshotId = meta.snapshotId;
                        metaTeamCandidates = buildMetaTeamCandidates(meta.candidates, data, options, banner);
                        if (metaTeamCandidates.length) {
                            console.log(
                                `[Arena Training] Loaded ${metaTeamCandidates.length} meta team candidates from snapshot ${metaTeamsSnapshotId}`
                            );
                        }
                    }

                    const testedKeys = new Set();
                    const rankings = [];
                    let stoppedBecause = 'exhausted';
                    let targetMet = false;
                    let plannedGenerated = 0;
                    let plannedMeta = metaTeamCandidates.length;

                    const battleOptions = { maxUpgrade };
                    const testCandidateBatch = async (candidates, phaseLabel) => {
                        for (let i = 0; i < candidates.length; i++) {
                            if (stopRequested) {
                                stoppedBecause = 'user_stop';
                                return true;
                            }

                            const candidate = candidates[i];
                            const key = candidateKey(candidate);
                            if (externalExcludeKeys.has(key) || testedKeys.has(key)) continue;
                            testedKeys.add(key);

                            status.currentCombo = rankings.length + 1;
                            status.message = `${phaseLabel} ${i + 1}/${candidates.length}`;

                            const heroLabels = candidate.heroes.map(heroName);
                            HWHFuncs.setProgress(
                                `Arena Training [${phaseLabel}] ${heroLabels.join(', ')}`,
                                true
                            );

                            const myTeam = buildMyTeamConfig(
                                candidate.heroes,
                                candidate.pet,
                                candidate.banner ?? banner,
                                candidate.favor,
                                candidate.bannerStones
                            );

                            await yieldForUi();
                            const simulation = await simulateTeam(
                                myTeam,
                                opponentTeam,
                                simulationsPerCombo,
                                battleOptions
                            );
                                            rankings.push(slimRankingEntry({
                                rank: 0,
                                heroes: candidate.heroes,
                                heroNames: heroLabels,
                                pet: candidate.pet,
                                banner: myTeam.banners[0],
                                bannerStones: myTeam.bannerStones || {},
                                favor: myTeam.favor,
                                source: candidate.source,
                                wins: simulation.wins,
                                losses: simulation.losses,
                                winRate: simulation.winRate,
                                averageBattleTime: simulation.averageBattleTime,
                                simulations: simulation.simulations,
                            }));

                            if (searchUntilTarget && simulation.winRate >= targetWinRate) {
                                stoppedBecause = 'target_met';
                                targetMet = true;
                                status.message = `Found ${simulation.winRate.toFixed(1)}% in ${phaseLabel}`;
                                return true;
                            }
                        }
                        return false;
                    };

                    status.totalCombos = arenaCandidates.length + grandArenaCandidates.length + plannedMeta;

                    if (counterLineupOnly) {
                        const arenaFavor = data.favor?.arena || {};
                        const candidate = {
                            ...options.counterLineup,
                            banner: options.counterLineup.banner ?? banner,
                            favor: options.counterLineup.favor || pickFavor(options.counterLineup.heroes, arenaFavor),
                            bannerStones: options.counterLineup.bannerStones || {},
                        };
                        if (!candidate.heroNames?.length) {
                            candidate.heroNames = candidate.heroes.map(heroName);
                        }
                        status.totalCombos = 1;
                        status.message = `${maxUpgrade ? 'Max' : 'User'} counter lineup vs ${opponentRaw.user?.name || opponentRaw.userId}`;
                        await testCandidateBatch([candidate], maxUpgrade ? 'counter max' : 'counter user');
                    } else if (userTeamOnly) {
                        status.totalCombos = arenaCandidates.length + grandArenaCandidates.length;
                        status.message = `User team test vs ${opponentRaw.user?.name || opponentRaw.userId}`;
                        if (!(await testCandidateBatch(arenaCandidates, 'user arena'))) {
                            await testCandidateBatch(grandArenaCandidates, 'user grand arena');
                        }
                    } else {
                        status.message = `Phase 1: arena team vs ${opponentRaw.user?.name || opponentRaw.userId}`;

                        if (await testCandidateBatch(arenaCandidates, 'arena')) {
                            // target met or user stopped
                        } else {
                            status.message = `Phase 2: grand arena teams vs ${opponentRaw.user?.name || opponentRaw.userId}`;
                            status.totalCombos += grandArenaCandidates.length;
                            if (!(await testCandidateBatch(grandArenaCandidates, 'grand arena'))) {
                                const runGeneratedPhase = async (phaseNumber) => {
                                    const maxCombinations = options.maxCombinations || CONSTANTS.DEFAULT_MAX_COMBOS;
                                    const generatedCap = searchUntilTarget
                                        ? (options.maxGeneratedCombos || CONSTANTS.DEFAULT_MAX_GENERATED_COMBOS)
                                        : maxCombinations;
                                    const generatedCandidates = buildGeneratedCandidates(plan, {
                                        maxHeroCombos: generatedCap,
                                        excludeKeys: testedKeys,
                                    }).slice(0, generatedCap);

                                    if (generatedCandidates.length > 0) {
                                        plannedGenerated = generatedCandidates.length;
                                        status.totalCombos += plannedGenerated;
                                        status.message = `Phase ${phaseNumber}: testing ${plannedGenerated} generated combos`;
                                        await testCandidateBatch(generatedCandidates, 'generated');
                                    } else if (!searchUntilTarget) {
                                        stoppedBecause = 'max_combos';
                                    }
                                };

                                if (metaTeamCandidates.length > 0) {
                                    status.message = `Phase 3: ${metaTeamCandidates.length} meta teams vs ${opponentRaw.user?.name || opponentRaw.userId}`;
                                    if (!(await testCandidateBatch(metaTeamCandidates, 'meta'))) {
                                        await runGeneratedPhase(4);
                                    }
                                } else {
                                    await runGeneratedPhase(3);
                                }
                            }
                        }
                    }

                    if (stopRequested && stoppedBecause !== 'target_met') {
                        stoppedBecause = 'user_stop';
                    }

                    rankings.sort((a, b) => {
                        if (b.winRate !== a.winRate) return b.winRate - a.winRate;
                        if (b.wins !== a.wins) return b.wins - a.wins;
                        return a.averageBattleTime - b.averageBattleTime;
                    });
                    rankings.forEach((entry, index) => {
                        entry.rank = index + 1;
                    });

                    const bestRanking = rankings[0] || null;
                    if (bestRanking && counterLineupOnly && options.counterLineup) {
                        if (bestRanking.banner == null && options.counterLineup.banner != null) {
                            bestRanking.banner = Number(options.counterLineup.banner);
                        }
                        if ((!bestRanking.bannerStones || !Object.keys(bestRanking.bannerStones).length)
                            && options.counterLineup.bannerStones
                            && typeof options.counterLineup.bannerStones === 'object') {
                            bestRanking.bannerStones = options.counterLineup.bannerStones;
                        }
                        if ((!bestRanking.favor || !Object.keys(bestRanking.favor).length)
                            && options.counterLineup.favor
                            && typeof options.counterLineup.favor === 'object') {
                            bestRanking.favor = options.counterLineup.favor;
                        }
                    }

                    lastResults = slimTrainingResult({
                        sessionId,
                        label: options.label || 'arena-training',
                        startedAt,
                        completedAt: new Date().toISOString(),
                        stoppedEarly: stopRequested,
                        stoppedBecause,
                        targetWinRate,
                        targetMet,
                        tester,
                        searchPhases: {
                            arena: arenaCandidates.length,
                            grandArena: grandArenaCandidates.length,
                            meta: plannedMeta,
                            metaSnapshotId: metaTeamsSnapshotId,
                            generated: plannedGenerated,
                        },
                        opponent: {
                            index: options.opponentOverride ? (options.opponentIndex ?? 0) : data.opponents.indexOf(opponentRaw),
                            userId: opponentRaw.userId,
                            name: opponentRaw.user?.name,
                            place: opponentRaw.place,
                            power: opponentRaw.power,
                            banner: opponentTeam.banner,
                            source: opponentRaw.source || options.opponentSource || 'topGet',
                            metaComboKey: opponentRaw.metaComboKey || null,
                            metaPopularity: opponentRaw.metaPopularity ?? null,
                            metaRank: opponentRaw.metaRank ?? null,
                            team: opponentTeam,
                        },
                        counterLineup: counterLineupOnly && options.counterLineup
                            ? {
                                heroes: options.counterLineup.heroes,
                                pet: options.counterLineup.pet,
                                banner: options.counterLineup.banner,
                                bannerStones: options.counterLineup.bannerStones || {},
                                favor: options.counterLineup.favor || {},
                            }
                            : undefined,
                        config: {
                            heroPool,
                            petPool,
                            simulationsPerCombo,
                            targetWinRate,
                            searchUntilTarget,
                            maxUpgrade: tester.maxUpgrade,
                            userTeamOnly,
                            counterLineupOnly,
                            banner: counterLineupOnly
                                ? (options.counterLineup?.banner ?? bestRanking?.banner ?? null)
                                : undefined,
                            bannerStones: counterLineupOnly
                                ? (options.counterLineup?.bannerStones || bestRanking?.bannerStones || {})
                                : undefined,
                            userTeamTargetWinRate: Number(
                                options.userTeamTargetWinRate ?? CONSTANTS.DEFAULT_USER_TEAM_TARGET_WIN_RATE
                            ),
                            excludeCandidateCount: externalExcludeKeys.size,
                            maxCombinations: options.maxCombinations || CONSTANTS.DEFAULT_MAX_COMBOS,
                            includeCurrentTeam: options.includeCurrentTeam !== false,
                            includeGrandArenaTeams: options.includeGrandArenaTeams !== false,
                            useMetaTeams: options.useMetaTeams !== false,
                            useMetaTeamsAsOpponents: options.useMetaTeamsAsOpponents !== false,
                            metaTeamsLimit: Number(options.metaTeamsLimit ?? CONSTANTS.DEFAULT_META_TEAMS_LIMIT),
                            metaTeamsSnapshotId: options.metaTeamsSnapshotId || metaTeamsSnapshotId || null,
                            opponentSource: options.opponentSource || 'topGet',
                            topLimit: options.topLimit,
                            heroPoolSize: options.heroPoolSize,
                            opponentLimit: options.opponentLimit || 0,
                            myArenaPlace: opponentsMeta.myPlace,
                        },
                        plannedCombos: arenaCandidates.length + grandArenaCandidates.length + plannedMeta + plannedGenerated,
                        testedCombos: rankings.length,
                        rankings,
                        best: bestRanking,
                    });

                    const best = lastResults.best || rankings[0];
                    const summary = best
                        ? `Best: ${(best.heroNames || []).join(', ')} + pet ${best.pet} (${Number(best.winRate || 0).toFixed(1)}% WR)`
                        : 'No combinations tested';
                    const stopNote = stoppedBecause === 'target_met'
                        ? ` Target ${targetWinRate}%+ reached.`
                        : (searchUntilTarget ? ` Exhausted ${rankings.length} combos (no ${targetWinRate}%+).` : '');
                    HWHFuncs.setProgress(`Arena Training done. ${summary}${stopNote}`, true);
                    console.log('[Arena Training] Results:', {
                        testedCombos: lastResults.testedCombos,
                        bestWinRate: best?.winRate,
                        stoppedBecause: lastResults.stoppedBecause,
                    });
                    return lastResults;
                } finally {
                    running = false;
                    status = {
                        running: false,
                        sessionId,
                        currentCombo: status.currentCombo,
                        totalCombos: status.totalCombos,
                        message: stopRequested ? 'Stopped by user' : 'Completed',
                    };
                }
            },

            /**
             * SimLab: one current-power (or max) counter lineup vs an explicit enemy team.
             * Reuses counterLineupOnly + opponentOverride; saves to bridge by default.
             */
            async simulateMatchup(options = {}) {
                const myTeam = options.myTeam || {};
                const opponentTeam = options.opponentTeam || {};
                const heroes = (Array.isArray(myTeam.heroes) ? myTeam.heroes : [])
                    .map(Number)
                    .filter((id) => id > 0 && id < 6000);
                const defenceHeroes = (Array.isArray(opponentTeam.heroes) ? opponentTeam.heroes : [])
                    .map(Number)
                    .filter((id) => id > 0 && id < 6000);

                if (heroes.length !== 5) {
                    throw new Error('simulateMatchup requires myTeam.heroes with 5 hero ids');
                }
                if (defenceHeroes.length !== 5) {
                    throw new Error('simulateMatchup requires opponentTeam.heroes with 5 hero ids');
                }

                const pet = Number(myTeam.pet);
                if (!Number.isFinite(pet) || pet < 6000) {
                    throw new Error('simulateMatchup requires myTeam.pet');
                }

                const label = options.label || 'simlab-counter';
                const maxUpgrade = options.maxUpgrade === true;
                const simulationsPerCombo = Number(options.simulationsPerCombo) > 0
                    ? Number(options.simulationsPerCombo)
                    : CONSTANTS.DEFAULT_SIMULATIONS;

                const counterLineup = {
                    heroes,
                    pet,
                    banner: myTeam.banner ?? myTeam.banners?.[0],
                    favor: myTeam.favor && typeof myTeam.favor === 'object' ? myTeam.favor : {},
                    bannerStones: myTeam.bannerStones && typeof myTeam.bannerStones === 'object'
                        ? myTeam.bannerStones
                        : {},
                    heroNames: myTeam.heroNames,
                };

                const opponentOverride = {
                    userId: opponentTeam.userId != null ? String(opponentTeam.userId) : 'simlab-enemy',
                    user: {
                        name: opponentTeam.name
                            || opponentTeam.user?.name
                            || String(opponentTeam.userId || 'SimLab enemy'),
                    },
                    heroes: defenceHeroes,
                    pet: Number(opponentTeam.pet) || CONSTANTS.DEFAULT_PET_ID,
                    banner: Number(opponentTeam.banner) || 1,
                    favor: opponentTeam.favor && typeof opponentTeam.favor === 'object'
                        ? opponentTeam.favor
                        : {},
                    bannerStones: opponentTeam.bannerStones
                        || opponentTeam.defenceBannerStones
                        || {},
                    place: opponentTeam.place,
                    power: opponentTeam.power,
                    source: opponentTeam.source || 'simlab',
                };

                const result = await this.runSingle({
                    label,
                    maxUpgrade,
                    counterLineupOnly: true,
                    counterLineup,
                    opponentOverride,
                    opponentUserId: opponentOverride.userId,
                    simulationsPerCombo,
                    skipCachedOpponents: false,
                    searchUntilTarget: false,
                    useMetaTeams: false,
                    includeCurrentTeam: false,
                    includeGrandArenaTeams: false,
                });

                // Keep SimLab support + grouping metadata on the saved round.
                result.counterLineup = {
                    ...(result.counterLineup || {}),
                    ...counterLineup,
                };
                // Re-assert defense patronage so Target Defense Favor on the detail page is populated.
                if (result.opponent && typeof result.opponent === 'object') {
                    const existingTeam = result.opponent.team && typeof result.opponent.team === 'object'
                        ? result.opponent.team
                        : {};
                    const favor = opponentOverride.favor && typeof opponentOverride.favor === 'object'
                        ? opponentOverride.favor
                        : {};
                    result.opponent = {
                        ...result.opponent,
                        team: {
                            ...existingTeam,
                            heroes: existingTeam.heroes || defenceHeroes,
                            pet: existingTeam.pet ?? opponentOverride.pet,
                            banner: existingTeam.banner ?? opponentOverride.banner,
                            bannerStones: existingTeam.bannerStones || opponentOverride.bannerStones || {},
                            favor: (existingTeam.favor && Object.keys(existingTeam.favor).length)
                                ? existingTeam.favor
                                : favor,
                        },
                    };
                }
                if (options.simLabGroupId) result.simLabGroupId = String(options.simLabGroupId);
                if (options.simLabPhase) result.simLabPhase = String(options.simLabPhase);

                if (options.saveToBridge !== false) {
                    await saveRoundToBridge(result);
                }

                const best = result?.best || result?.rankings?.[0] || null;
                return {
                    wins: Number(best?.wins) || 0,
                    losses: Number(best?.losses) || 0,
                    winRate: Number(best?.winRate) || 0,
                    averageBattleTime: Number(best?.averageBattleTime) || 0,
                    sessionId: result?.sessionId || null,
                    result: slimTrainingResult(result),
                };
            },
        };
    }


    // --- Counter Suggest panel (merged from Arena Counter Suggest HwH Ext) ---
    const COUNTER_SUGGEST_VERSION = '1.30.4';
    function initializeCounterSuggestPanel({ HWHClasses, HWHFuncs, Send, cheats, lib, training }) {
        const EXTENSION_NAME = 'Arena Counter Suggest';
        const EXTENSION_VERSION = COUNTER_SUGGEST_VERSION;
        const COUNTER_LIST_LIMIT = 3;
        const PLAYER_CLASS = 'game.model.user.Player';
        const PLAYER_BANNER_DATA_CLASS = 'game.model.user.banner.PlayerBannerData';
        const PLAYER_BANNER_ENTRY_CLASS = 'game.model.user.banner.PlayerBannerEntry';
        const INT_MAP_CLASS = 'haxe.ds.IntMap';
        const BANNER_STONE_DESC_CLASS = 'game.data.storage.resource.BannerStoneDescription';
        const SIMLAB_SIMULATIONS = 10;
        const SIMLAB_TARGET_WIN_RATE = 90;
        /** Team-pet candidates SimLab tries. 0 = every owned pet (no cap). */
        const SIMLAB_MAX_PETS = 0;
        const HOST_ID = 'ah-arena-counter-suggest-host';
        const POLL_ACTIVE_MS = 600;
        const POLL_IDLE_MS = 2500;
        const POPUP_CLASS = 'game.view.popup.team.ArenaAttackTeamGatherPopupWithEnemyTeam';
        const MEDIATOR_CLASS = 'game.mediator.gui.popup.arena.ArenaAttackTeamGatherPopupMediator';
        const CD_ATTACK_POPUP_CLASS = 'game.mechanics.clanDomination.popup.ClanDominationSelectAttackTargetPopup';
        const CD_ATTACK_MEDIATOR_CLASS = 'game.mechanics.clanDomination.mediator.ClanDominationSelectAttackTargetPopupMediator';
        const CD_MAP_POPUP_CLASS = 'game.mechanics.clanDomination.popup.ClanDominationMapPopup';
        const CD_CASTLE_POPUP_CLASS = 'game.mechanics.clanDomination.popup.ClanDominationCastlePopup';
        const POPUP_MANAGER_CLASS = 'game.mediator.gui.popup.GamePopupManager';
        const MIN_WIN_RATE = 50;
        const MAX_AGE_DAYS = 30;
        const CD_CACHE_TTL_MS = 60_000;
        const CD_OBSERVE_TTL_MS = 120_000;

        // Re-inject / Tampermonkey upgrade: tear down previous instance.
        try {
            if (typeof window.__ahCounterSuggestTeardown === 'function') {
                window.__ahCounterSuggestTeardown();
            }
        } catch (error) {
            console.warn(`[${EXTENSION_NAME}] teardown failed:`, error);
        }
        document.getElementById(HOST_ID)?.remove();

        console.log(`${EXTENSION_NAME}: HWH UI is ready, initializing v${EXTENSION_VERSION}...`);

        const classCache = new Map();
        let popupManagerCache = null;
        let popupManagerCacheAt = 0;
        let lastComboKey = null;
        let lastRenderSignature = '';
        let pollDelayMs = POLL_IDLE_MS;
        let lastFetchAt = 0;
        let fetchInFlight = null;
        let panelState = {
            visible: false,
            status: 'idle',
            message: '',
            mode: 'arena',
            enemy: null,
            counters: null,
            selected: null, // { match, source, key }
            simHistory: null, // prior SimLab best for this defense (current power)
            simBest: null, // best SimLab config for selected lineup
            attacking: false,
            simming: false,
            training: false,
        };
        const clanDominationEnemyCache = new Map();
        let clanDominationFetchInFlight = new Map();
        let lastObservedCdEnemy = null; // { levelId, enemy, at }
        let trainStatusTimer = null;

        function isBusy() {
            return panelState.attacking || panelState.simming || panelState.training;
        }

        function needsTrainingData() {
            if (panelState.training) return true;
            if (panelState.status === 'bridge_error' || panelState.status === 'loading') return false;
            if (panelState.status === 'attacking' || panelState.status === 'simming') return false;
            const counters = panelState.counters;
            if (!counters) return false;
            if (counters.reason === 'opponent_not_found') return true;
            const atPower = Array.isArray(counters.atPower) ? counters.atPower : [];
            const maxBeat = normalizeCounterList(counters.maxBeat);
            return panelState.status === 'ready' && atPower.length === 0 && maxBeat.length === 0;
        }

        function normalizeCounterList(value) {
            if (Array.isArray(value)) return value.filter(Boolean);
            if (value && typeof value === 'object') return [value];
            return [];
        }

        function selectionKey(match, source) {
            const heroes = (match?.myHeroIds || match?.heroes || []).map(Number).join(',');
            const pet = Number(match?.myPet ?? match?.pet) || 0;
            return `${source || 'power'}:${heroes}|${pet}`;
        }

        function sameHeroSet(a, b) {
            const left = (Array.isArray(a) ? a : []).map(Number).filter((id) => id > 0 && id < 6000).sort((x, y) => x - y);
            const right = (Array.isArray(b) ? b : []).map(Number).filter((id) => id > 0 && id < 6000).sort((x, y) => x - y);
            if (left.length !== 5 || right.length !== 5) return false;
            return left.every((id, i) => id === right[i]);
        }

        function petLabel(petId) {
            const id = Number(petId) || 0;
            if (!id) return 'No pet';
            return CONSTANTS.PET_NAMES[id] || heroName(id) || `Pet ${id}`;
        }

        function escapePanelText(value) {
            return String(value ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
        }

        function favorCount(favor) {
            if (!favor || typeof favor !== 'object') return 0;
            return Object.keys(favor).filter((key) => {
                const petId = Number(favor[key]);
                return Number.isFinite(petId) && petId >= 6000 && petId < 7000;
            }).length;
        }

        function formatRecordText(wins, losses) {
            const w = Number(wins);
            const l = Number(losses);
            if (!Number.isFinite(w) && !Number.isFinite(l)) return '';
            return `${Number.isFinite(w) ? w : 0}W/${Number.isFinite(l) ? l : 0}L`;
        }

        /** Compact support chips: Flag · Favor · record — mirrors SimLab detail Best attack. */
        function formatSupportMetaHtml({ pet, banner, favor, winRate, wins, losses, badge }) {
            const chips = [];
            if (pet) {
                chips.push(`<span class="chip"><span class="chip-k">Pet</span> ${escapePanelText(petLabel(pet))}</span>`);
            }
            if (Number(banner) > 0) {
                chips.push(`<span class="chip"><span class="chip-k">Flag</span> ${escapePanelText(String(banner))}</span>`);
            }
            const favors = favorCount(favor);
            chips.push(
                `<span class="chip${favors ? '' : ' warn'}"><span class="chip-k">Favor</span> ${favors ? `${favors}/5` : '—'}</span>`
            );
            if (winRate != null && Number.isFinite(Number(winRate))) {
                chips.push(
                    `<span class="chip rate"><span class="chip-k">Win</span> ${Math.round(Number(winRate))}%</span>`
                );
            }
            const record = formatRecordText(wins, losses);
            if (record) {
                chips.push(`<span class="chip"><span class="chip-k">Rec</span> ${escapePanelText(record)}</span>`);
            }
            if (badge) {
                chips.push(`<span class="chip badge">${escapePanelText(badge)}</span>`);
            }
            return chips.join('');
        }

        function simHistoryMatchesMatch(match) {
            const hist = panelState.simHistory;
            if (!hist?.heroes?.length || !match) return null;
            const matchHeroes = match.myHeroIds || match.heroes || [];
            return sameHeroSet(hist.heroes, matchHeroes) ? hist : null;
        }

        function bindSimBestFromHistory(key, match, source = null) {
            const src = source || panelState.selected?.source || '';
            const hist = simHistoryMatchesMatch(match)
                || (panelState.simHistory && src === 'simlab' ? panelState.simHistory : null);
            // Prefer current-power SimLab history when heroes match this selection.
            if (hist) {
                panelState.simBest = {
                    key,
                    heroes: hist.heroes,
                    pet: hist.pet,
                    banner: hist.banner,
                    bannerStones: hist.bannerStones,
                    favor: hist.favor,
                    winRate: hist.winRate,
                    wins: hist.wins,
                    losses: hist.losses,
                    heroNames: hist.heroNames,
                    fromHistory: true,
                };
                return panelState.simBest;
            }
            if (panelState.simBest?.key !== key) {
                panelState.simBest = null;
            }
            return panelState.simBest;
        }

        function selectMatch(match, source) {
            if (!match) return;
            const resolvedSource = source || 'power';
            const key = selectionKey(match, resolvedSource);
            panelState.selected = {
                match,
                source: resolvedSource,
                key,
            };
            bindSimBestFromHistory(key, match, resolvedSource);
            panelController?.render();
        }

        function clearSelection() {
            panelState.selected = null;
            panelState.simBest = null;
        }

        function clearSimHistory() {
            panelState.simHistory = null;
            if (panelState.simBest?.fromHistory) {
                panelState.simBest = null;
            }
        }

        let panelController = null;
        let pollTimer = null;

        function getHaxeRoot() {
            const root = window.$haxe;
            return root && typeof root === 'object' ? root : null;
        }

        function findClass(fullName) {
            if (classCache.has(fullName)) return classCache.get(fullName);
            const root = getHaxeRoot();
            if (!root) return null;
            const matches = Object.values(root).filter(
                (value) => typeof value === 'function' && value.j === fullName
            );
            if (matches.length !== 1) return null;
            classCache.set(fullName, matches[0]);
            return matches[0];
        }

        function findSemanticKey(properties, semanticName) {
            if (!properties) return null;
            for (const key in properties) {
                if (properties[key] === semanticName) return key;
            }
            return null;
        }

        function callSemantic(obj, semanticName) {
            if (!obj?.__class__) return undefined;
            const method = findSemanticKey(obj.__class__.prototype?.__properties__, semanticName)
                || findSemanticKey(obj.__class__.__properties__, semanticName);
            if (!method || typeof obj[method] !== 'function') return undefined;
            try {
                return obj[method]();
            } catch {
                return undefined;
            }
        }

        function classNameOf(value) {
            return value?.__class__?.j || null;
        }

        function hasBannerStones(slots) {
            return !!(slots && typeof slots === 'object' && Object.keys(slots).length > 0);
        }

        function getIntMapBacking(map) {
            if (!map || classNameOf(map) !== INT_MAP_CLASS) return null;
            if (map.D && typeof map.D === 'object' && !Array.isArray(map.D) && !map.D.__class__) {
                return map.D;
            }
            const candidates = Object.values(map).filter((value) => {
                if (!value || typeof value !== 'object' || Array.isArray(value) || value.__class__) return false;
                const proto = Object.getPrototypeOf(value);
                return proto === Object.prototype || proto === null;
            });
            if (candidates.length === 1) return candidates[0];
            const likely = candidates.filter((value) => {
                const values = Object.values(value);
                return values.length === 0
                    || values.every((item) => (
                        classNameOf(item) === BANNER_STONE_DESC_CLASS
                        || classNameOf(item) === PLAYER_BANNER_ENTRY_CLASS
                        || typeof item === 'number'
                    ));
            });
            return likely[0] || candidates[0] || null;
        }

        function stoneIdFromValue(value) {
            if (value == null) return null;
            if (typeof value === 'number' || typeof value === 'string') {
                const id = Number(value);
                return Number.isFinite(id) && id > 0 ? id : null;
            }
            if (typeof value === 'object') {
                const semanticId = Number(callSemantic(value, 'get_id'));
                if (Number.isFinite(semanticId) && semanticId > 0) return semanticId;
                const rawId = Number(value._id ?? value.id);
                if (Number.isFinite(rawId) && rawId > 0) return rawId;
            }
            return null;
        }

        function normalizeBannerStones(slots) {
            if (!slots) return {};
            if (classNameOf(slots) === INT_MAP_CLASS) {
                return normalizeBannerStones(getIntMapBacking(slots) || {});
            }
            if (Array.isArray(slots)) {
                const out = {};
                slots.forEach((value, index) => {
                    const id = stoneIdFromValue(value);
                    if (id != null) out[String(index)] = id;
                });
                return out;
            }
            if (typeof slots === 'object') {
                const out = {};
                for (const [key, value] of Object.entries(slots)) {
                    const id = stoneIdFromValue(value);
                    if (id != null) out[String(key)] = id;
                }
                return out;
            }
            return {};
        }

        function slotsFromPlayerBannerEntry(entry) {
            if (!entry || classNameOf(entry) !== PLAYER_BANNER_ENTRY_CLASS) return {};
            const map = Object.values(entry).find((value) => classNameOf(value) === INT_MAP_CLASS);
            return normalizeBannerStones(map);
        }

        function findPlayerInstance() {
            const manager = getPopupManager();
            if (!manager) return null;
            const roots = uniqueRefs(
                Object.values(manager)
                    .filter(Array.isArray)
                    .flat()
                    .filter((value) => value?.__class__)
            );
            const seen = new Set();
            let player = null;
            const walk = (value, depth) => {
                if (!value || typeof value !== 'object' || depth > 6 || seen.has(value) || player) return;
                seen.add(value);
                if (classNameOf(value) === PLAYER_CLASS) {
                    player = value;
                    return;
                }
                try {
                    Object.values(value).forEach((child) => walk(child, depth + 1));
                } catch {
                    // ignore
                }
            };
            roots.forEach((root) => walk(root, 0));
            return player;
        }

        function findPlayerBannerData(player = findPlayerInstance()) {
            if (!player) return null;
            return Object.values(player).find((value) => classNameOf(value) === PLAYER_BANNER_DATA_CLASS) || null;
        }

        function resolveAttackBannerStonesFromClient(bannerId) {
            const targetId = Number(bannerId);
            if (!Number.isFinite(targetId) || targetId <= 0) return {};
            const data = findPlayerBannerData();
            if (!data) return {};
            const map = Object.values(data).find((value) => classNameOf(value) === INT_MAP_CLASS);
            const backing = getIntMapBacking(map);
            if (!backing) return {};
            const entry = backing[String(targetId)] || backing[targetId];
            return slotsFromPlayerBannerEntry(entry);
        }

        function extractBannerStonesFromBattleTeam(team) {
            if (!team) return {};
            try {
                const stones = callSemantic(team, 'get_bannerStones');
                const normalized = normalizeBannerStones(stones);
                if (hasBannerStones(normalized)) return normalized;
            } catch {
                // continue
            }
            try {
                const bannerVo = callSemantic(team, 'get_bannerVO');
                if (bannerVo && typeof bannerVo === 'object') {
                    const entry = classNameOf(bannerVo) === PLAYER_BANNER_ENTRY_CLASS
                        ? bannerVo
                        : Object.values(bannerVo).find((value) => classNameOf(value) === PLAYER_BANNER_ENTRY_CLASS);
                    const fromEntry = slotsFromPlayerBannerEntry(entry);
                    if (hasBannerStones(fromEntry)) return fromEntry;
                }
            } catch {
                // continue
            }
            return {};
        }

        function getPopupManager() {
            const Manager = findClass(POPUP_MANAGER_CLASS);
            if (!Manager) return popupManagerCache;
            const getInstance = findSemanticKey(Manager.__properties__, 'get_instance');
            let manager = null;
            try {
                manager = getInstance ? Manager[getInstance]?.() : null;
            } catch {
                manager = null;
            }
            if (manager) {
                popupManagerCache = manager;
                popupManagerCacheAt = Date.now();
                return manager;
            }
            if (popupManagerCache && Date.now() - popupManagerCacheAt <= 2000) {
                return popupManagerCache;
            }
            return null;
        }

        function uniqueRefs(items) {
            return [...new Set(items.filter(Boolean))];
        }

        function getOpenPopupsByClass(fullName) {
            const manager = getPopupManager();
            if (!manager) return [];
            return uniqueRefs(
                Object.values(manager)
                    .filter(Array.isArray)
                    .flat()
                    .filter((value) => value?.__class__?.j === fullName)
            );
        }

        function getMediatorFromPopup(popup, preferredClass = MEDIATOR_CLASS, classPattern = /ArenaAttackTeamGatherPopupMediator/i) {
            if (preferredClass) {
                const exact = uniqueRefs(
                    Object.values(popup ?? {}).filter((value) => value?.__class__?.j === preferredClass)
                );
                if (exact[0]) return exact[0];
            }

            const matches = uniqueRefs(
                Object.values(popup ?? {}).filter((value) => {
                    const className = value?.__class__?.j || '';
                    return classPattern.test(className);
                })
            );
            return matches[0] || null;
        }

        function getClanDominationMediatorFromPopup(popup) {
            return getMediatorFromPopup(
                popup,
                CD_ATTACK_MEDIATOR_CLASS,
                /ClanDominationSelectAttackTargetPopupMediator/i
            );
        }

        function isClanDominationMapOpen() {
            return getOpenPopupsByClass(CD_MAP_POPUP_CLASS).length > 0
                || getOpenPopupsByClass(CD_CASTLE_POPUP_CLASS).length > 0
                || getOpenPopupsByClass(CD_ATTACK_POPUP_CLASS).length > 0;
        }

        function rememberClanDominationEnemy(levelId, enemy, raw = null, opts = {}) {
            if (!enemy || levelId == null) return;
            const key = String(levelId);
            clanDominationEnemyCache.set(key, { at: Date.now(), enemy, raw });
            // Bulk AOC scans must not become the "selected" attack target.
            if (!opts?.skipObserved) {
                lastObservedCdEnemy = { levelId: Number(levelId), enemy, at: Date.now() };
            }
        }

        function isBulkClanDominationScanIdent(ident) {
            if (ident == null) return false;
            const id = String(ident);
            return id === 'aocEnemyTownScan'
                || id.startsWith('aocEnemyTown')
                || id.startsWith('aoc_');
        }

        function getObservedClanDominationEnemy() {
            if (!lastObservedCdEnemy) return null;
            if (Date.now() - lastObservedCdEnemy.at > CD_OBSERVE_TTL_MS) {
                lastObservedCdEnemy = null;
                return null;
            }
            return lastObservedCdEnemy;
        }

        function decodeRpcBody(body) {
            if (typeof body === 'string') return body;
            try {
                if (body instanceof ArrayBuffer) return new TextDecoder().decode(body);
                if (ArrayBuffer.isView(body)) {
                    return new TextDecoder().decode(new Uint8Array(body.buffer, body.byteOffset, body.byteLength));
                }
            } catch {
                // ignore
            }
            return '';
        }

        function parseRpcCalls(body) {
            const text = decodeRpcBody(body);
            if (!text) return [];
            try {
                const envelope = JSON.parse(text);
                const calls = Array.isArray(envelope?.calls) ? envelope.calls : [];
                return calls.map((call, index) => ({
                    name: String(call?.name || ''),
                    args: call?.args && typeof call.args === 'object' ? call.args : {},
                    ident: String(call?.ident ?? index),
                })).filter((call) => call.name.length > 0);
            } catch {
                return [];
            }
        }

        function readXhrJson(request) {
            try {
                if (request.responseType === 'json') return request.response;
                if (request.responseType === '' || request.responseType === 'text') {
                    return JSON.parse(request.responseText);
                }
            } catch {
                // ignore
            }
            return request.response;
        }

        function ingestClanDominationEnemyTeams(levelId, responsePayload, ident = null) {
            const numericLevelId = Number(levelId);
            if (!Number.isFinite(numericLevelId) || numericLevelId <= 0) return null;
            let list = null;
            if (responsePayload && typeof responsePayload === 'object' && Array.isArray(responsePayload.results)) {
                const row = (ident != null
                    ? responsePayload.results.find((r) => r?.ident === ident)
                    : null)
                    || responsePayload.results[0]
                    || null;
                list = row?.result?.response ?? row?.result ?? null;
            } else {
                list = responsePayload;
            }
            const entries = Array.isArray(list) ? list : (list ? [list] : []);
            const entry = entries[0] || null;
            const enemy = parseClanDominationEnemyEntry(entry, numericLevelId);
            if (!enemy) {
                console.warn(`[${EXTENSION_NAME}] observed getEnemyTeams but could not parse team`, {
                    levelId: numericLevelId,
                    entryKeys: entry && typeof entry === 'object' ? Object.keys(entry) : null,
                });
                return null;
            }
            const bulkScan = !!window.__ahSuppressCounterSuggestCdIngest
                || isBulkClanDominationScanIdent(ident);
            rememberClanDominationEnemy(numericLevelId, enemy, entry, { skipObserved: bulkScan });
            console.log(`[${EXTENSION_NAME}] observed Clan Domination enemy`, {
                levelId: numericLevelId,
                userId: enemy.userId,
                power: enemy.power,
                comboKey: enemy.comboKey,
                bulkScan,
            });

            // Always cache. Only open/update the panel for a real attack-target popup.
            // Ignore bulk fetches (AOC Visible Enemy Towns refresh / background scan).
            if (bulkScan) {
                return enemy;
            }
            if (isBusy() || !isClanDominationMapOpen()) {
                return enemy;
            }
            // Require the attack-target popup — map-open alone must not open Counters.
            if (getOpenPopupsByClass(CD_ATTACK_POPUP_CLASS).length === 0) {
                return enemy;
            }
            const selected = readClanDominationTarget();
            const selectedLevel = selected?.levelId != null ? Number(selected.levelId) : null;
            if (selectedLevel != null && selectedLevel === numericLevelId) {
                showEnemyPanel(enemy, 'clanDomination');
            }
            return enemy;
        }

        function installClanDominationEnemyObserver() {
            if (window.__ahCounterSuggestCdObserver === EXTENSION_VERSION) return;

            // Catch game-initiated RPCs (map player click), not only extension Send().
            const originalXhrSend = XMLHttpRequest.prototype.send;
            XMLHttpRequest.prototype.send = function ahCounterSuggestCdXhrSend(body) {
                let tracked = [];
                try {
                    tracked = parseRpcCalls(body).filter((call) => call.name === 'clanDomination_getEnemyTeams');
                } catch {
                    tracked = [];
                }
                if (tracked.length) {
                    this.addEventListener('loadend', () => {
                        try {
                            if (this.status !== 200) return;
                            const response = readXhrJson(this);
                            tracked.forEach((call) => {
                                ingestClanDominationEnemyTeams(call.args?.levelId, response, call.ident);
                            });
                        } catch (error) {
                            console.warn(`[${EXTENSION_NAME}] CD XHR observer failed:`, error);
                        }
                    }, { once: true });
                }
                return originalXhrSend.apply(this, arguments);
            };

            const currentSend = typeof window.Send === 'function' ? window.Send : Send;
            const wrappedSend = typeof currentSend === 'function'
                ? async function ahCounterSuggestCdSend(payload) {
                    const result = await currentSend.apply(this, arguments);
                    try {
                        const calls = Array.isArray(payload?.calls) ? payload.calls : [];
                        calls.forEach((call) => {
                            if (!call || call.name !== 'clanDomination_getEnemyTeams') return;
                            ingestClanDominationEnemyTeams(call.args?.levelId, result, call.ident);
                        });
                    } catch (error) {
                        console.warn(`[${EXTENSION_NAME}] CD Send observer failed:`, error);
                    }
                    return result;
                }
                : null;
            if (wrappedSend) {
                window.Send = wrappedSend;
            }

            window.__ahCounterSuggestCdObserver = EXTENSION_VERSION;
            window.__ahCounterSuggestCdRestore = () => {
                if (XMLHttpRequest.prototype.send === ahCounterSuggestCdXhrSend
                    || XMLHttpRequest.prototype.send?.name === 'ahCounterSuggestCdXhrSend') {
                    XMLHttpRequest.prototype.send = originalXhrSend;
                }
                if (wrappedSend && window.Send === wrappedSend) {
                    window.Send = currentSend;
                }
                delete window.__ahCounterSuggestCdObserver;
                delete window.__ahCounterSuggestCdRestore;
            };
            console.log(`[${EXTENSION_NAME}] Clan Domination getEnemyTeams observer installed`);
        }

        function callUnitId(unit) {
            if (unit == null) return null;
            if (typeof unit === 'number' || typeof unit === 'string') {
                const id = Number(unit);
                return Number.isFinite(id) && id > 0 ? id : null;
            }
            try {
                if (typeof unit.G === 'function') {
                    const id = Number(unit.G());
                    if (Number.isFinite(id) && id > 0) return id;
                }
            } catch {
                // continue
            }
            try {
                const desc = typeof unit.Ge === 'function' ? unit.Ge() : null;
                if (desc && typeof desc.G === 'function') {
                    const id = Number(desc.G());
                    if (Number.isFinite(id) && id > 0) return id;
                }
            } catch {
                // continue
            }
            const id = Number(unit.id ?? unit.heroId);
            return Number.isFinite(id) && id > 0 ? id : null;
        }

        function extractPetId(pet) {
            if (pet == null) return 0;
            if (typeof pet === 'number' || typeof pet === 'string') {
                const id = Number(pet);
                return id >= 6000 && id < 7000 ? id : 0;
            }
            try {
                if (typeof pet.G === 'function') {
                    const id = Number(pet.G());
                    if (id >= 6000 && id < 7000) return id;
                }
            } catch {
                // continue
            }
            try {
                const desc = typeof pet.Jb === 'function' ? pet.Jb()
                    : (typeof pet.Ge === 'function' ? pet.Ge() : null);
                if (desc && typeof desc.G === 'function') {
                    const id = Number(desc.G());
                    if (id >= 6000 && id < 7000) return id;
                }
                if (desc && desc.id != null) {
                    const id = Number(desc.id);
                    if (id >= 6000 && id < 7000) return id;
                }
            } catch {
                // continue
            }
            const id = Number(pet.id ?? pet.petId ?? pet.pet);
            return id >= 6000 && id < 7000 ? id : 0;
        }

        function extractBannerId(team) {
            if (!team) return 0;
            try {
                const banner = typeof team.Wy === 'function' ? team.Wy()
                    : callSemantic(team, 'get_banner');
                if (banner != null && (typeof banner === 'number' || typeof banner === 'string')) {
                    return Number(banner) || 0;
                }
                if (banner && typeof banner === 'object') {
                    const id = Number(banner.id ?? banner.bannerId);
                    if (Number.isFinite(id) && id > 0) return id;
                }
            } catch {
                // continue
            }
            const raw = Number(team.pE);
            return Number.isFinite(raw) && raw > 0 ? raw : 0;
        }

        function extractHeroesFromBattleTeam(team) {
            if (!team) return [];
            try {
                if (typeof team.O2b === 'function') {
                    return (team.O2b() || []).map(Number).filter((id) => id > 0 && id < 6000);
                }
            } catch {
                // continue
            }
            try {
                const units = typeof team.Wi === 'function' ? team.Wi()
                    : (callSemantic(team, 'get_units') || team.nC || []);
                if (Array.isArray(units)) {
                    return units.map(callUnitId).filter((id) => id > 0 && id < 6000);
                }
            } catch {
                // continue
            }
            return [];
        }

        function normalizeFavorMap(raw) {
            const favor = {};
            if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return favor;
            for (const [key, value] of Object.entries(raw)) {
                const heroId = Number(key);
                const petId = Number(
                    value && typeof value === 'object'
                        ? (value.favorPetId ?? value.petId ?? value.id ?? value.pet)
                        : value
                );
                if (heroId > 0 && heroId < 6000 && petId >= 6000 && petId < 7000) {
                    favor[String(heroId)] = petId;
                }
            }
            return favor;
        }

        function extractFavorPetFromUnit(unit) {
            if (unit == null) return 0;
            if (typeof unit === 'number' || typeof unit === 'string') return 0;
            const direct = Number(
                unit.favorPetId ?? unit.favor_pet_id ?? unit.patronPetId ?? unit.favorPet
            );
            if (Number.isFinite(direct) && direct >= 6000 && direct < 7000) return direct;
            try {
                const via = callSemantic(unit, 'get_favorPetId')
                    ?? callSemantic(unit, 'get_favorPet')
                    ?? callSemantic(unit, 'get_patronPetId')
                    ?? callSemantic(unit, 'get_patron')
                    ?? callSemantic(unit, 'get_favor');
                const fromSemantic = extractPetId(via);
                if (fromSemantic) return fromSemantic;
            } catch {
                // continue
            }
            // HeroWars unit wrappers often stash stats on Ge()/get_hero descriptions.
            try {
                const desc = typeof unit.Ge === 'function'
                    ? unit.Ge()
                    : (callSemantic(unit, 'get_hero')
                        || callSemantic(unit, 'get_unit')
                        || callSemantic(unit, 'get_data')
                        || null);
                if (desc && typeof desc === 'object') {
                    const nested = Number(
                        desc.favorPetId ?? desc.favor_pet_id ?? desc.patronPetId ?? desc.favorPet
                    );
                    if (Number.isFinite(nested) && nested >= 6000 && nested < 7000) return nested;
                    const viaDesc = callSemantic(desc, 'get_favorPetId')
                        || callSemantic(desc, 'get_favorPet')
                        || callSemantic(desc, 'get_patronPetId');
                    const fromDesc = extractPetId(viaDesc);
                    if (fromDesc) return fromDesc;
                }
            } catch {
                // continue
            }
            // Last resort: any own property whose name looks like favor/patron.
            try {
                for (const key of Object.keys(unit)) {
                    if (!/favor|patron/i.test(key)) continue;
                    const petId = extractPetId(unit[key]);
                    if (petId) return petId;
                }
            } catch {
                // continue
            }
            return 0;
        }

        function extractFavorFromUnitList(units) {
            const favor = {};
            const list = Array.isArray(units)
                ? units
                : (units && typeof units === 'object' ? Object.values(units) : []);
            for (const unit of list) {
                if (unit == null) continue;
                if (typeof unit === 'number' || typeof unit === 'string') continue;
                const heroId = Number(unit.id ?? unit.heroId ?? callUnitId(unit));
                if (!Number.isFinite(heroId) || heroId <= 0 || heroId >= 6000) continue;
                const petId = extractFavorPetFromUnit(unit);
                if (petId) favor[String(heroId)] = petId;
            }
            return favor;
        }

        /**
         * Arena gather client objects rarely expose a plain `favor` field.
         * Walk the enemy/team graph for heroId→petId maps and unit.favorPetId records.
         */
        function deepCollectFavorMap(root, heroIds = [], maxDepth = 8) {
            const favor = {};
            const heroSet = new Set((heroIds || []).map(Number).filter((id) => id > 0 && id < 6000));
            if (!root || typeof root !== 'object' || !heroSet.size) return favor;
            const seen = new Set();
            const walk = (value, depth) => {
                if (!value || typeof value !== 'object' || depth > maxDepth) return;
                if (seen.has(value) || seen.size > 2500) return;
                seen.add(value);

                // Plain unit-like record.
                try {
                    const unitId = Number(value.id ?? value.heroId ?? callUnitId(value));
                    if (heroSet.has(unitId)) {
                        const petId = extractFavorPetFromUnit(value);
                        if (petId) favor[String(unitId)] = petId;
                    }
                } catch {
                    // continue
                }

                // Favor map shape: { "12": 6004, ... } or IntMap backing.
                let mapCandidate = value;
                if (classNameOf(value) === INT_MAP_CLASS) {
                    mapCandidate = getIntMapBacking(value) || value;
                }
                if (mapCandidate && typeof mapCandidate === 'object' && !Array.isArray(mapCandidate)) {
                    let hits = 0;
                    const candidate = {};
                    try {
                        for (const [key, raw] of Object.entries(mapCandidate)) {
                            const heroId = Number(key);
                            if (!heroSet.has(heroId)) continue;
                            const petId = Number(
                                raw && typeof raw === 'object'
                                    ? (raw.favorPetId ?? raw.petId ?? raw.id ?? raw.pet)
                                    : raw
                            );
                            if (Number.isFinite(petId) && petId >= 6000 && petId < 7000) {
                                candidate[String(heroId)] = petId;
                                hits += 1;
                            }
                        }
                    } catch {
                        hits = 0;
                    }
                    if (hits > 0) Object.assign(favor, candidate);
                }

                try {
                    for (const child of Object.values(value)) {
                        if (child && typeof child === 'object') walk(child, depth + 1);
                    }
                } catch {
                    // ignore non-enumerable graphs
                }
            };
            walk(root, 0);
            return favor;
        }

        function extractFavorFromBattleTeam(team, heroIds = []) {
            const favor = {};
            if (!team) return favor;
            try {
                const map = callSemantic(team, 'get_favor')
                    || callSemantic(team, 'get_favors')
                    || callSemantic(team, 'get_heroFavor')
                    || callSemantic(team, 'get_patronage')
                    || team.favor
                    || team.favors;
                Object.assign(favor, normalizeFavorMap(map));
            } catch {
                // continue
            }
            try {
                const units = typeof team.Wi === 'function' ? team.Wi()
                    : (callSemantic(team, 'get_units') || team.nC || []);
                Object.assign(favor, extractFavorFromUnitList(units));
            } catch {
                // continue
            }
            if (Object.keys(favor).length < Math.min(2, (heroIds || []).length || 2)) {
                Object.assign(favor, deepCollectFavorMap(team, heroIds.length ? heroIds : Object.keys(favor).map(Number)));
            }
            return favor;
        }

        function heroSetKey(heroIds = []) {
            return (Array.isArray(heroIds) ? heroIds : [])
                .map(Number)
                .filter((id) => id > 0 && id < 6000)
                .slice()
                .sort((a, b) => a - b)
                .join(',');
        }

        function parseArenaFindEnemyEntry(entry) {
            if (!entry || typeof entry !== 'object') return null;
            const heroes = [];
            let pet = 0;
            for (const item of entry.heroes || []) {
                const id = Number(item?.id ?? item);
                if (!Number.isFinite(id)) continue;
                if (id >= 6000 && id < 7000) pet = id;
                else if (id > 0 && id < 6000) heroes.push(id);
            }
            const userId = entry.userId ?? entry.user?.id ?? entry.id;
            if (userId == null || heroes.length !== 5) return null;
            return {
                userId,
                heroes,
                pet: pet || 0,
                name: entry.user?.name || entry.name || null,
                place: entry.place ?? null,
                power: entry.power ?? null,
                entry,
            };
        }

        /**
         * Fresh arenaFindEnemies + arenaCheckTargetRange right before attack.
         * Prefer matching by userId; fall back to defense hero+pet lineup when gather _id is wrong.
         */
        async function refreshArenaAttackTarget(enemy) {
            const empty = {
                userId: enemy?.userId != null ? Number(enemy.userId) : null,
                onList: false,
                inRange: null,
                matchedBy: null,
                listCount: 0,
            };
            if (!enemy?.userId && !enemy?.heroes?.length) return empty;

            const response = await Send({
                calls: [{
                    name: 'arenaFindEnemies',
                    args: {},
                    context: { actionTs: Date.now() },
                    ident: 'arenaFindEnemies',
                }],
            });
            const list = response.results?.find((r) => r.ident === 'arenaFindEnemies')?.result?.response
                || response.results?.[0]?.result?.response
                || [];
            const rows = (Array.isArray(list) ? list : [])
                .map(parseArenaFindEnemyEntry)
                .filter(Boolean);

            const wantId = enemy.userId != null ? String(enemy.userId) : '';
            const wantHeroes = heroSetKey(enemy.heroes);
            const wantPet = Number(enemy.pet) || 0;

            const byId = wantId
                ? rows.find((row) => String(row.userId) === wantId)
                : null;
            const byLineup = wantHeroes
                ? rows.find((row) => (
                    heroSetKey(row.heroes) === wantHeroes
                    && (!wantPet || !row.pet || row.pet === wantPet)
                ))
                : null;
            const matched = byId || byLineup || null;
            if (!matched) {
                return { ...empty, listCount: rows.length };
            }

            let inRange = null;
            try {
                const checkResponse = await Send({
                    calls: [{
                        name: 'arenaCheckTargetRange',
                        args: { ids: [String(matched.userId)] },
                        context: { actionTs: Date.now() },
                        ident: 'arenaCheckTargetRange',
                    }],
                });
                const check = checkResponse.results?.find((r) => r.ident === 'arenaCheckTargetRange')
                    ?.result?.response
                    || checkResponse.results?.[0]?.result?.response
                    || {};
                if (Object.prototype.hasOwnProperty.call(check, String(matched.userId))) {
                    inRange = !!check[String(matched.userId)];
                }
            } catch (error) {
                console.warn(`[${EXTENSION_NAME}] arenaCheckTargetRange failed:`, error);
            }

            return {
                userId: Number(matched.userId),
                onList: true,
                inRange,
                matchedBy: byId ? 'userId' : 'lineup',
                listCount: rows.length,
                name: matched.name,
                place: matched.place,
                power: matched.power,
            };
        }

        /** Arena list entries often omit top-level favor — build it from hero favorPetId. */
        function extractFavorFromEnemyEntry(entry) {
            if (!entry || typeof entry !== 'object') return {};
            const fromMap = normalizeFavorMap(
                entry.favor
                || entry.favors
                || entry.defenceFavor
                || entry.defenseFavor
                || entry.team?.favor
                || entry.defence?.favor
                || entry.defense?.favor
            );
            if (Object.keys(fromMap).length) return fromMap;
            const units = entry.heroes
                || entry.heroIds
                || entry.team?.units
                || entry.team?.heroes
                || entry.defenceTeam?.units
                || entry.defence?.units
                || entry.defense?.units
                || entry.units;
            const fromUnits = extractFavorFromUnitList(units);
            if (Object.keys(fromUnits).length) return fromUnits;
            const heroIds = (Array.isArray(units) ? units : Object.values(units || {}))
                .map((unit) => Number(unit?.id ?? unit?.heroId ?? unit))
                .filter((id) => id > 0 && id < 6000);
            return deepCollectFavorMap(entry, heroIds);
        }

        function extractFromPlayerArenaEnemy(enemy) {
            if (!enemy || typeof enemy !== 'object') return null;

            // Prefer UserInfo.get_id — _id / name-prefix parsing often disagrees with arenaFindEnemies.
            let userId = Number(
                callSemantic(enemy, 'get_id')
                ?? enemy._id
                ?? enemy.userId
                ?? enemy.id
            );
            if (!Number.isFinite(userId) || userId <= 0) {
                const named = callSemantic(enemy, 'get_name');
                if (typeof named === 'string') {
                    const fromName = Number(String(named).split(/\s+/)[0]);
                    if (Number.isFinite(fromName) && fromName > 0) userId = fromName;
                }
            }
            if (!Number.isFinite(userId) || userId <= 0) return null;

            const teams = Array.isArray(enemy.ex) ? enemy.ex : [];
            const team = teams[0] || null;
            const heroes = extractHeroesFromBattleTeam(team);
            if (heroes.length !== 5) return null;

            let pet = 0;
            try {
                const petObj = team && typeof team.Jb === 'function'
                    ? team.Jb()
                    : (callSemantic(team, 'get_pet') || team?.fl);
                pet = extractPetId(petObj);
            } catch {
                pet = 0;
            }

            const banner = extractBannerId(team);
            const bannerStones = extractBannerStonesFromBattleTeam(team);
            let favor = extractFavorFromBattleTeam(team, heroes);
            if (Object.keys(favor).length < 2) {
                // PlayerArenaEnemy may keep patronage on sibling fields, not the BattleTeam.
                Object.assign(favor, deepCollectFavorMap(enemy, heroes));
            }
            return {
                userId,
                heroes,
                pet: pet || 0,
                banner: banner || 0,
                bannerStones,
                favor,
            };
        }

        function extractEnemyFromMediator(mediator) {
            if (!mediator) return null;
            let enemy = null;
            try {
                enemy = callSemantic(mediator, 'get_enemy');
            } catch {
                enemy = null;
            }
            if (!enemy) enemy = mediator.fj || null;
            let fromEnemy = extractFromPlayerArenaEnemy(enemy);

            // Fallback: some builds keep enemy user separately
            if (!fromEnemy) {
                try {
                    const enemyUser = callSemantic(mediator, 'get_enemyUser');
                    const userId = Number(
                        callSemantic(enemyUser, 'get_id')
                        ?? enemyUser?._id
                        ?? enemyUser?.id
                        ?? enemyUser?.userId
                    );
                    if (Number.isFinite(userId) && userId > 0 && enemy) {
                        fromEnemy = extractFromPlayerArenaEnemy({ ...enemy, _id: userId });
                    }
                } catch {
                    // ignore
                }
            }

            if (fromEnemy && Object.keys(fromEnemy.favor || {}).length < 2) {
                const mediatorFavor = normalizeFavorMap(
                    callSemantic(mediator, 'get_favor')
                    || callSemantic(mediator, 'get_favors')
                    || callSemantic(mediator, 'get_enemyFavor')
                    || callSemantic(mediator, 'get_defenceFavor')
                    || callSemantic(mediator, 'get_defenseFavor')
                );
                const deepFavor = deepCollectFavorMap(mediator, fromEnemy.heroes);
                fromEnemy = {
                    ...fromEnemy,
                    favor: {
                        ...normalizeFavorMap(fromEnemy.favor),
                        ...mediatorFavor,
                        ...deepFavor,
                    },
                };
            }

            return fromEnemy;
        }

        function readEnemyFromGather() {
            const popups = getOpenPopupsByClass(POPUP_CLASS);
            if (!popups.length) return null;
            const popup = popups[0];
            const mediator = getMediatorFromPopup(popup);
            const extracted = extractEnemyFromMediator(mediator);

            if (!extracted) return { popup, mediator, enemy: null };

            return {
                popup,
                mediator,
                enemy: {
                    ...extracted,
                    comboKey: buildComboKey(extracted.heroes, extracted.pet, extracted.banner),
                },
            };
        }

        function closeGather(mediator) {
            if (!mediator) return;
            try {
                if (typeof mediator.close === 'function') {
                    mediator.close();
                    return;
                }
                const closeKey = findSemanticKey(mediator.__class__?.prototype?.__properties__, 'close')
                    || findSemanticKey(mediator.__class__?.__properties__, 'close');
                if (closeKey && typeof mediator[closeKey] === 'function') {
                    mediator[closeKey]();
                }
            } catch (error) {
                console.warn(`[${EXTENSION_NAME}] close gather failed:`, error);
            }
        }

        function parseClanDominationEnemyEntry(entry, levelId) {
            if (!entry || typeof entry !== 'object') return null;
            const defense = entry.defense || entry.defence || {};
            const unitsMap = defense.units && typeof defense.units === 'object' ? defense.units : {};
            const heroes = [];
            let pet = 0;
            const favor = {};
            for (const unit of Object.values(unitsMap)) {
                const id = Number(unit?.id ?? unit);
                if (!Number.isFinite(id)) continue;
                if (id >= 6000 && id < 7000) {
                    pet = id;
                    continue;
                }
                if (id > 0 && id < 6000) {
                    heroes.push(id);
                    const favorPetId = Number(unit?.favorPetId);
                    if (Number.isFinite(favorPetId) && favorPetId > 0) {
                        favor[String(id)] = favorPetId;
                    }
                }
            }
            if (heroes.length !== 5) return null;

            const bannerObj = defense.banner || {};
            const banner = Number(bannerObj.id ?? defense.bannerId ?? entry.banner) || 0;
            const bannerStones = normalizeBannerStones(bannerObj.slots || defense.bannerStones);
            const userId = entry.userId ?? entry.user?.id ?? null;
            if (userId == null) return null;

            return {
                mode: 'clanDomination',
                userId,
                levelId: levelId != null ? Number(levelId) : null,
                heroes,
                pet: pet || 0,
                banner: banner || 0,
                favor,
                bannerStones,
                power: defense.powerSum != null ? Number(defense.powerSum) : null,
                defenseState: entry.defenseState || entry.defenceState || null,
                comboKey: buildComboKey(heroes, pet, banner),
            };
        }

        function readClanDominationTarget() {
            const popups = getOpenPopupsByClass(CD_ATTACK_POPUP_CLASS);
            // Map/castle alone is not a selected attack target. Without the attack popup,
            // do not promote the last observed getEnemyTeams (e.g. AOC scan) into a target.
            if (!popups.length) {
                return null;
            }
            const popup = popups[0];
            const mediator = getClanDominationMediatorFromPopup(popup);
            if (!mediator) {
                const observed = getObservedClanDominationEnemy();
                if (observed) {
                    return {
                        popup,
                        mediator: null,
                        levelId: observed.levelId,
                        enemy: observed.enemy,
                        source: 'observed',
                    };
                }
                return { popup, mediator: null, levelId: null };
            }

            let levelId = Number(mediator.mlj);
            if (!Number.isFinite(levelId) || levelId <= 0) {
                levelId = Number(callSemantic(mediator, 'get_levelId'));
            }
            if (!Number.isFinite(levelId) || levelId <= 0) {
                for (const value of Object.values(mediator)) {
                    if (typeof value === 'number' && value > 0 && value < 100000 && Number.isInteger(value)) {
                        // Prefer map-cell-looking ids; first integer fallback only if mlj missing
                        levelId = value;
                        break;
                    }
                }
            }
            if (!Number.isFinite(levelId) || levelId <= 0) {
                const observed = getObservedClanDominationEnemy();
                if (observed) {
                    return {
                        popup,
                        mediator,
                        levelId: observed.levelId,
                        enemy: observed.enemy,
                        source: 'observed',
                    };
                }
                return { popup, mediator, levelId: null };
            }
            const cached = getCachedClanDominationEnemy(levelId);
            return {
                popup,
                mediator,
                levelId,
                enemy: cached || null,
                source: 'popup',
            };
        }

        function getCachedClanDominationEnemy(levelId) {
            const key = String(levelId);
            const cached = clanDominationEnemyCache.get(key);
            if (!cached) return null;
            if (Date.now() - cached.at > CD_CACHE_TTL_MS) {
                clanDominationEnemyCache.delete(key);
                return null;
            }
            return cached.enemy;
        }

        async function fetchClanDominationEnemy(levelId) {
            const key = String(levelId);
            if (clanDominationFetchInFlight.has(key)) {
                return clanDominationFetchInFlight.get(key);
            }

            const pending = (async () => {
                const response = await Send({
                    calls: [{
                        name: 'clanDomination_getEnemyTeams',
                        args: { levelId: Number(levelId) },
                        context: { actionTs: Date.now() },
                        ident: 'clanDomination_getEnemyTeams',
                    }],
                });
                if (response?.error) {
                    throw new Error(`${response.error.name || 'Error'}: ${response.error.description || ''}`);
                }
                const list = response.results?.find((r) => r.ident === 'clanDomination_getEnemyTeams')?.result?.response
                    || response.results?.[0]?.result?.response
                    || [];
                const entry = Array.isArray(list) ? list[0] : null;
                const enemy = parseClanDominationEnemyEntry(entry, levelId);
                if (!enemy) {
                    throw new Error('Clan Domination enemy team incomplete');
                }
                rememberClanDominationEnemy(levelId, enemy, entry);
                return enemy;
            })();

            clanDominationFetchInFlight.set(key, pending);
            try {
                return await pending;
            } finally {
                clanDominationFetchInFlight.delete(key);
            }
        }

        function heroName(heroId) {
            return resolveHeroName(heroId, cheats, lib);
        }

        function formatLineupLabel(match) {
            const names = Array.isArray(match?.myHeroNames) && match.myHeroNames.length === 5
                ? match.myHeroNames
                : (match?.myHeroIds || []).map(heroName);
            const petId = Number(match?.myPet) || 0;
            const petLabel = petId ? (CONSTANTS.PET_NAMES[petId] || heroName(petId) || `Pet ${petId}`) : 'No pet';
            const winRate = match?.winRate != null ? `${Math.round(Number(match.winRate))}%` : '?%';
            return { names: names.join(' · '), petLabel, winRate };
        }

        function getLargestCanvasRect() {
            const canvases = [...document.querySelectorAll('canvas')];
            let best = null;
            for (const canvas of canvases) {
                const rect = canvas.getBoundingClientRect();
                const area = rect.width * rect.height;
                if (!best || area > best.area) {
                    best = { area, rect };
                }
            }
            return best?.rect || {
                left: 0,
                top: 0,
                width: window.innerWidth,
                height: window.innerHeight,
                right: window.innerWidth,
                bottom: window.innerHeight,
            };
        }

        function createPanel() {
            document.getElementById(HOST_ID)?.remove();
            const host = document.createElement('div');
            host.id = HOST_ID;
            host.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483646;pointer-events:auto;user-select:none;display:none;';
            const shadow = host.attachShadow({ mode: 'open' });
            shadow.innerHTML = `
                <style>
                    :host { all: initial; }
                    * { box-sizing: border-box; }
                    button {
                        font: inherit;
                        color: inherit;
                        appearance: none;
                        -webkit-appearance: none;
                    }
                    .panel {
                        --gold: #dfbe68;
                        --gold-soft: rgba(223,190,104,.45);
                        --ink: #f6efd8;
                        --muted: rgba(246,239,216,.68);
                        --panel-pad: 12px;
                        --gap: 8px;
                        width: min(360px, 36vw);
                        max-height: min(460px, 72vh);
                        overflow: auto;
                        padding: var(--panel-pad);
                        border: 1px solid rgba(223,190,104,.78);
                        border-radius: 10px;
                        color: var(--ink);
                        font-family: "Segoe UI", Tahoma, sans-serif;
                        background:
                            linear-gradient(180deg, rgba(42,32,20,.98), rgba(18,14,10,.99));
                        box-shadow: 0 10px 28px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,235,174,.12);
                        display: flex;
                        flex-direction: column;
                        gap: 0;
                    }
                    .header {
                        text-align: center;
                        padding-bottom: 10px;
                        margin-bottom: 2px;
                        border-bottom: 1px solid rgba(223,190,104,.28);
                    }
                    .title {
                        margin: 0;
                        font-size: 14px;
                        font-weight: 700;
                        letter-spacing: .06em;
                        text-transform: uppercase;
                        color: #ffe7a8;
                    }
                    .subtitle {
                        margin: 6px 0 0;
                        font-size: 11px;
                        line-height: 1.35;
                        color: var(--muted);
                        word-break: break-word;
                    }
                    .status {
                        margin: 8px 0 0;
                        padding: 6px 8px;
                        border-radius: 6px;
                        background: rgba(255,255,255,.05);
                        font-size: 11px;
                        line-height: 1.35;
                        color: #ffe7a8;
                        text-align: center;
                    }
                    .status:empty { display: none; }
                    .section {
                        margin-top: 10px;
                    }
                    .section-title {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        gap: 8px;
                        margin: 0 0 6px;
                        font-size: 10px;
                        font-weight: 700;
                        color: var(--gold);
                        text-transform: uppercase;
                        letter-spacing: .08em;
                    }
                    .section-title .count {
                        font-weight: 600;
                        letter-spacing: .02em;
                        color: var(--muted);
                        text-transform: none;
                    }
                    .list {
                        display: flex;
                        flex-direction: column;
                        gap: 6px;
                    }
                    .row-wrap {
                        display: grid;
                        grid-template-columns: 1fr 48px;
                        align-items: stretch;
                        border: 1px solid var(--gold-soft);
                        border-radius: 8px;
                        background: rgba(255,255,255,.035);
                        overflow: hidden;
                    }
                    .row-wrap:hover {
                        border-color: rgba(255,230,150,.7);
                        background: rgba(223,190,104,.1);
                    }
                    .row-wrap.selected {
                        border-color: rgba(255,230,150,.95);
                        background: rgba(223,190,104,.22);
                        box-shadow: inset 3px 0 0 #ffe7a8;
                    }
                    .row-wrap.sim-saved {
                        border-color: rgba(120,170,230,.7);
                        background: rgba(55,90,140,.18);
                    }
                    .row-wrap.sim-saved.selected {
                        border-color: rgba(160,200,255,.95);
                        background: rgba(55,90,140,.32);
                        box-shadow: inset 3px 0 0 #9ec5ff;
                    }
                    .row {
                        display: flex;
                        flex-direction: column;
                        justify-content: center;
                        gap: 6px;
                        width: 100%;
                        margin: 0;
                        padding: 8px 10px;
                        border: 0;
                        background: transparent;
                        color: inherit;
                        text-align: left;
                        cursor: pointer;
                        min-width: 0;
                    }
                    .row:disabled {
                        opacity: .55;
                        cursor: default;
                    }
                    .row-main {
                        font-size: 12px;
                        font-weight: 600;
                        line-height: 1.3;
                        color: var(--ink);
                        overflow: hidden;
                        display: -webkit-box;
                        -webkit-line-clamp: 2;
                        -webkit-box-orient: vertical;
                    }
                    .row-chips {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 4px;
                    }
                    .chip {
                        display: inline-flex;
                        align-items: center;
                        gap: 3px;
                        padding: 2px 6px;
                        border: 1px solid rgba(223,190,104,.28);
                        border-radius: 999px;
                        background: rgba(0,0,0,.22);
                        font-size: 10px;
                        line-height: 1.2;
                        color: var(--muted);
                        white-space: nowrap;
                    }
                    .chip-k {
                        color: rgba(255,231,168,.72);
                        font-weight: 700;
                        letter-spacing: .03em;
                        text-transform: uppercase;
                        font-size: 8px;
                    }
                    .chip.rate {
                        border-color: rgba(140,210,130,.45);
                        color: #c8f0c0;
                    }
                    .chip.badge {
                        border-color: rgba(120,170,230,.55);
                        background: rgba(55,90,140,.35);
                        color: #d6e8ff;
                        font-weight: 700;
                        letter-spacing: .04em;
                        text-transform: uppercase;
                    }
                    .chip.warn {
                        border-color: rgba(210,150,80,.45);
                        color: #f0d2a0;
                    }
                    .simlab-btn {
                        margin: 0;
                        padding: 0 6px;
                        border: 0;
                        border-left: 1px solid rgba(223,190,104,.28);
                        border-radius: 0;
                        background: rgba(55,90,140,.28);
                        color: #d6e8ff;
                        font-size: 10px;
                        font-weight: 700;
                        letter-spacing: .04em;
                        cursor: pointer;
                    }
                    .simlab-btn:hover:not(:disabled) {
                        background: rgba(80,130,200,.48);
                        color: #fff;
                    }
                    .simlab-btn:disabled {
                        opacity: .5;
                        cursor: default;
                    }
                    .empty {
                        margin: 0;
                        padding: 10px;
                        border: 1px dashed rgba(223,190,104,.28);
                        border-radius: 8px;
                        font-size: 11px;
                        color: var(--muted);
                        text-align: center;
                    }
                    .footer {
                        margin-top: 12px;
                        padding-top: 10px;
                        border-top: 1px solid rgba(223,190,104,.28);
                        display: flex;
                        flex-direction: column;
                        gap: 8px;
                    }
                    .selected-card {
                        margin: 0;
                        padding: 8px 10px;
                        border: 1px solid rgba(223,190,104,.35);
                        border-radius: 8px;
                        background: rgba(255,255,255,.04);
                        display: flex;
                        flex-direction: column;
                        gap: 6px;
                    }
                    .selected-card.empty-sel {
                        border-style: dashed;
                        color: var(--muted);
                        font-size: 11px;
                        text-align: center;
                    }
                    .selected-label {
                        font-size: 9px;
                        font-weight: 700;
                        letter-spacing: .08em;
                        text-transform: uppercase;
                        color: var(--gold);
                    }
                    .selected-main {
                        font-size: 11px;
                        font-weight: 600;
                        line-height: 1.3;
                        color: var(--ink);
                    }
                    .footer-actions {
                        display: grid;
                        grid-template-columns: 1fr 72px;
                        gap: 8px;
                        align-items: stretch;
                    }
                    .attack-btn {
                        margin: 0;
                        padding: 10px 12px;
                        border: 1px solid rgba(210,80,80,.8);
                        border-radius: 8px;
                        background: linear-gradient(180deg, #b84848, #7a2424);
                        color: #ffe8e8;
                        font-size: 12px;
                        font-weight: 800;
                        letter-spacing: .08em;
                        text-transform: uppercase;
                        cursor: pointer;
                    }
                    .attack-btn:hover:not(:disabled) {
                        border-color: rgba(255,150,150,.95);
                        background: linear-gradient(180deg, #d05555, #8f2e2e);
                    }
                    .attack-btn:disabled {
                        opacity: .45;
                        cursor: default;
                    }
                    .train-btn {
                        margin: 0;
                        padding: 10px 8px;
                        border: 1px solid rgba(223,190,104,.55);
                        border-radius: 8px;
                        background: rgba(120,80,25,.42);
                        color: #ffe7a8;
                        font-size: 11px;
                        font-weight: 700;
                        letter-spacing: .04em;
                        cursor: pointer;
                    }
                    .train-btn:hover:not(:disabled) {
                        border-color: rgba(255,230,150,.9);
                        background: rgba(150,100,35,.58);
                    }
                    .train-btn:disabled {
                        opacity: .5;
                        cursor: default;
                    }
                    .train-hint {
                        margin: 0;
                        font-size: 10px;
                        line-height: 1.3;
                        color: var(--muted);
                        text-align: center;
                    }
                    .train-hint:empty { display: none; }
                    .note {
                        margin: 0;
                        font-size: 9px;
                        letter-spacing: .02em;
                        color: rgba(246,239,216,.5);
                        text-align: center;
                    }
                </style>
                <div class="panel">
                    <div class="header">
                        <div class="title" id="panelTitle">Counter Suggest</div>
                        <div class="subtitle" id="enemyLabel">Waiting for Arena / Clan Domination attack…</div>
                        <div class="status" id="status"></div>
                    </div>
                    <div class="section" id="simSection" hidden>
                        <div class="section-title">SimLab <span class="count" id="simSectionCount">saved · current power</span></div>
                        <div class="list" id="simLabList"></div>
                    </div>
                    <div class="section">
                        <div class="section-title">My power <span class="count" id="atPowerCount"></span></div>
                        <div class="list" id="atPower"></div>
                    </div>
                    <div class="section">
                        <div class="section-title">Max power <span class="count" id="maxBeatCount"></span></div>
                        <div class="list" id="maxBeat"></div>
                    </div>
                    <div class="footer" id="attackBar">
                        <div class="selected-card empty-sel" id="selectedCard">Select a lineup</div>
                        <div class="footer-actions" id="trainBox">
                            <button type="button" class="attack-btn" id="attackBtn" disabled>Attack</button>
                            <button type="button" class="train-btn" id="trainBtn" title="Run Arena Training on this defense (demo battles)">Train</button>
                        </div>
                        <p class="train-hint" id="trainHint"></p>
                        <div class="note" id="panelNote">Select · Attack · Sim / Train</div>
                    </div>
                </div>
            `;
            document.documentElement.appendChild(host);

            const panelTitle = shadow.getElementById('panelTitle');
            const enemyLabel = shadow.getElementById('enemyLabel');
            const statusEl = shadow.getElementById('status');
            const simSection = shadow.getElementById('simSection');
            const simSectionCount = shadow.getElementById('simSectionCount');
            const simLabListEl = shadow.getElementById('simLabList');
            const atPowerEl = shadow.getElementById('atPower');
            const atPowerCount = shadow.getElementById('atPowerCount');
            const maxBeatEl = shadow.getElementById('maxBeat');
            const maxBeatCount = shadow.getElementById('maxBeatCount');
            const selectedCard = shadow.getElementById('selectedCard');
            const attackBtn = shadow.getElementById('attackBtn');
            const trainHint = shadow.getElementById('trainHint');
            const trainBtn = shadow.getElementById('trainBtn');
            const panelNote = shadow.getElementById('panelNote');

            attackBtn.addEventListener('click', () => {
                const selected = panelState.selected;
                if (!selected?.match) return;
                onSuggestClick(selected.match, selected.source).catch((error) => {
                    console.error(`[${EXTENSION_NAME}] attack failed:`, error);
                    panelState.status = 'error';
                    panelState.message = error?.message || String(error);
                    panelState.attacking = false;
                    panelState.simming = false;
                    render();
                });
            });

            trainBtn.addEventListener('click', () => {
                onTrainClick().catch((error) => {
                    console.error(`[${EXTENSION_NAME}] Train failed:`, error);
                    panelState.status = 'error';
                    panelState.message = error?.message || String(error);
                    panelState.training = false;
                    stopTrainStatusPolling();
                    render();
                });
            });

            function place() {
                const rect = getLargestCanvasRect();
                const width = Math.min(340, Math.max(240, rect.width * 0.28));
                const left = Math.min(
                    window.innerWidth - width - 12,
                    Math.max(8, rect.right - width - 16)
                );
                const top = Math.max(8, rect.top + rect.height * 0.18);
                host.style.left = `${left}px`;
                host.style.top = `${top}px`;
                const panel = shadow.querySelector('.panel');
                if (panel) panel.style.width = `${width}px`;
            }

            function lineupNamesHtml(match, simOverlay = null) {
                const names = Array.isArray(simOverlay?.heroNames) && simOverlay.heroNames.length === 5
                    ? simOverlay.heroNames
                    : (Array.isArray(match?.myHeroNames) && match.myHeroNames.length === 5
                        ? match.myHeroNames
                        : (match?.myHeroIds || match?.heroes || []).map(heroName));
                return escapePanelText(names.join(' · '));
            }

            function renderRow(match, source, options = {}) {
                const wrap = document.createElement('div');
                const key = selectionKey(match, source);
                const isSelected = panelState.selected?.key === key;
                const simOverlay = options.simOverlay
                    || (source !== 'max' ? simHistoryMatchesMatch(match) : null)
                    || (panelState.simBest?.key === key ? panelState.simBest : null);
                const isSimSaved = !!(simOverlay && (options.forceSimStyle || simOverlay.fromHistory || source === 'simlab'));
                wrap.className = [
                    'row-wrap',
                    isSelected ? 'selected' : '',
                    isSimSaved ? 'sim-saved' : '',
                ].filter(Boolean).join(' ');

                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'row';
                button.disabled = isBusy();
                button.title = isSimSaved
                    ? 'Saved SimLab loadout at current power — click to select'
                    : 'Click to select this lineup';

                const pet = Number(simOverlay?.pet ?? match?.myPet ?? match?.pet) || 0;
                const banner = Number(simOverlay?.banner ?? match?.myBanner ?? match?.banner) || 0;
                const favor = simOverlay?.favor || match?.myFavor || match?.favor || {};
                const winRate = simOverlay?.winRate ?? match?.winRate;
                const wins = simOverlay?.wins ?? match?.wins;
                const losses = simOverlay?.losses ?? match?.losses;
                const badge = isSimSaved
                    ? 'SimLab'
                    : (source === 'max' ? 'Max' : '');

                button.innerHTML = `
                    <div class="row-main">${lineupNamesHtml(match, simOverlay)}</div>
                    <div class="row-chips">${formatSupportMetaHtml({
                        pet,
                        banner,
                        favor,
                        winRate,
                        wins,
                        losses,
                        badge,
                    })}</div>
                `;
                button.addEventListener('click', () => {
                    if (isBusy()) return;
                    selectMatch(match, source);
                });

                const simBtn = document.createElement('button');
                simBtn.type = 'button';
                simBtn.className = 'simlab-btn';
                simBtn.textContent = 'Sim';
                simBtn.title = 'Simulate this lineup at your current power (demo battles)';
                simBtn.disabled = isBusy();
                simBtn.addEventListener('click', (event) => {
                    event.stopPropagation();
                    selectMatch(match, source);
                    onSimLabClick(match, source).catch((error) => {
                        console.error(`[${EXTENSION_NAME}] SimLab failed:`, error);
                        panelState.status = 'error';
                        panelState.message = error?.message || String(error);
                        panelState.simming = false;
                        render();
                    });
                });

                wrap.appendChild(button);
                wrap.appendChild(simBtn);
                return wrap;
            }

            function simHistoryAsMatch(hist) {
                if (!hist?.heroes?.length) return null;
                return {
                    myHeroIds: hist.heroes,
                    myHeroNames: hist.heroNames,
                    myPet: hist.pet,
                    myBanner: hist.banner,
                    myFavor: hist.favor,
                    winRate: hist.winRate,
                    wins: hist.wins,
                    losses: hist.losses,
                };
            }

            function render(force = false) {
                place();
                host.style.display = panelState.visible ? 'block' : 'none';
                if (!panelState.visible) {
                    lastRenderSignature = 'hidden';
                    return;
                }

                const enemy = panelState.enemy;
                const isCd = panelState.mode === 'clanDomination' || enemy?.mode === 'clanDomination';
                const atPower = normalizeCounterList(panelState.counters?.atPower);
                const maxBeat = normalizeCounterList(panelState.counters?.maxBeat);
                const simHist = panelState.simHistory;
                const simMatch = simHistoryAsMatch(simHist);
                const simCoveredByAtPower = !!(simMatch && atPower.some((m) => sameHeroSet(m.myHeroIds, simMatch.myHeroIds)));

                // Resolve selection before painting rows so highlight is correct.
                const listed = [
                    ...(simMatch && !simCoveredByAtPower ? [selectionKey(simMatch, 'simlab')] : []),
                    ...atPower.slice(0, COUNTER_LIST_LIMIT).map((m) => selectionKey(m, 'power')),
                    ...maxBeat.slice(0, COUNTER_LIST_LIMIT).map((m) => selectionKey(m, 'max')),
                ];
                if (panelState.selected && !listed.includes(panelState.selected.key)) {
                    clearSelection();
                }
                if (!panelState.selected) {
                    let autoMatch = null;
                    let autoSource = null;
                    if (simMatch) {
                        const covered = atPower.find((m) => sameHeroSet(m.myHeroIds, simMatch.myHeroIds));
                        autoMatch = covered || simMatch;
                        autoSource = covered ? 'power' : 'simlab';
                    } else if (atPower[0]) {
                        autoMatch = atPower[0];
                        autoSource = 'power';
                    } else if (maxBeat[0]) {
                        autoMatch = maxBeat[0];
                        autoSource = 'max';
                    }
                    if (autoMatch && autoSource) {
                        panelState.selected = {
                            match: autoMatch,
                            source: autoSource,
                            key: selectionKey(autoMatch, autoSource),
                        };
                        bindSimBestFromHistory(panelState.selected.key, autoMatch);
                    }
                } else if (panelState.selected) {
                    bindSimBestFromHistory(panelState.selected.key, panelState.selected.match);
                }

                const signature = [
                    panelState.mode,
                    panelState.status,
                    panelState.message || '',
                    enemy?.comboKey || '',
                    enemy?.userId || '',
                    enemy?.levelId ?? '',
                    panelState.selected?.key || '',
                    panelState.simBest?.key || '',
                    panelState.simBest?.winRate ?? '',
                    panelState.simHistory?.winRate ?? '',
                    panelState.simHistory?.pet ?? '',
                    panelState.simHistory?.banner ?? '',
                    favorCount(panelState.simHistory?.favor),
                    panelState.attacking ? 1 : 0,
                    panelState.simming ? 1 : 0,
                    panelState.training ? 1 : 0,
                    atPower.map((m) => selectionKey(m, 'power')).join(';'),
                    maxBeat.map((m) => selectionKey(m, 'max')).join(';'),
                ].join('|');
                if (!force && signature === lastRenderSignature) return;
                lastRenderSignature = signature;

                panelTitle.textContent = isCd ? 'Counter · Domination' : 'Counter Suggest';
                panelNote.textContent = 'Select · Attack · Sim / Train';
                enemyLabel.textContent = enemy
                    ? `vs ${enemy.userId}${enemy.levelId != null ? ` @${enemy.levelId}` : ''} · ${enemy.heroes.map(heroName).join(', ')}`
                    : (isCd ? 'Loading Clan Domination enemy…' : 'Enemy lineup not readable yet');

                statusEl.textContent = panelState.message || (
                    panelState.status === 'loading' ? 'Checking database…'
                        : panelState.status === 'attacking' ? 'Attacking…'
                            : panelState.status === 'simming' ? 'SimLab running…'
                                : panelState.status === 'training' ? 'Training this defense…'
                                    : panelState.status === 'bridge_error' ? 'Bridge/DB unavailable'
                                        : ''
                );

                // Prior SimLab at current power: dedicated section only when it is not already a My-power row.
                simLabListEl.innerHTML = '';
                if (simMatch && !simCoveredByAtPower) {
                    simSection.hidden = false;
                    simSectionCount.textContent = `${Math.round(Number(simHist.winRate) || 0)}% · current power`;
                    simLabListEl.appendChild(renderRow(simMatch, 'simlab', {
                        simOverlay: simHist,
                        forceSimStyle: true,
                    }));
                } else {
                    simSection.hidden = true;
                }

                atPowerEl.innerHTML = '';
                atPowerCount.textContent = atPower.length ? `${Math.min(atPower.length, COUNTER_LIST_LIMIT)}` : '';
                maxBeatEl.innerHTML = '';
                maxBeatCount.textContent = maxBeat.length ? `${Math.min(maxBeat.length, COUNTER_LIST_LIMIT)}` : '';
                if (!atPower.length) {
                    const empty = document.createElement('div');
                    empty.className = 'empty';
                    empty.textContent = panelState.status === 'bridge_error'
                        ? 'Bridge/DB unavailable'
                        : (simMatch ? 'No other at-power DB counters' : 'No at-power wins found');
                    atPowerEl.appendChild(empty);
                } else {
                    for (const match of atPower.slice(0, COUNTER_LIST_LIMIT)) {
                        const overlay = simHistoryMatchesMatch(match);
                        atPowerEl.appendChild(renderRow(match, 'power', {
                            simOverlay: overlay,
                            forceSimStyle: !!overlay,
                        }));
                    }
                }
                if (!maxBeat.length) {
                    const empty = document.createElement('div');
                    empty.className = 'empty';
                    empty.textContent = panelState.status === 'bridge_error'
                        ? 'Bridge/DB unavailable'
                        : 'No max-upgrade counter found';
                    maxBeatEl.appendChild(empty);
                } else {
                    for (const match of maxBeat.slice(0, COUNTER_LIST_LIMIT)) {
                        maxBeatEl.appendChild(renderRow(match, 'max'));
                    }
                }

                const selected = panelState.selected;
                const canAttack = !!(selected?.match && enemy?.userId && !isBusy());
                if (selected?.match) {
                    const simBest = panelState.simBest?.key === selected.key ? panelState.simBest : null;
                    const sourceLabel = selected.source === 'max'
                        ? 'Max power'
                        : (selected.source === 'simlab' || simBest?.fromHistory ? 'SimLab · current power' : 'My power');
                    selectedCard.className = 'selected-card';
                    selectedCard.innerHTML = `
                        <div class="selected-label">${escapePanelText(sourceLabel)}</div>
                        <div class="selected-main">${lineupNamesHtml(selected.match, simBest)}</div>
                        <div class="row-chips">${formatSupportMetaHtml({
                            pet: Number(simBest?.pet ?? selected.match.myPet) || 0,
                            banner: Number(simBest?.banner ?? selected.match.myBanner) || 0,
                            favor: simBest?.favor || selected.match.myFavor || {},
                            winRate: simBest?.winRate ?? selected.match.winRate,
                            wins: simBest?.wins ?? selected.match.wins,
                            losses: simBest?.losses ?? selected.match.losses,
                            badge: simBest ? 'SimLab' : (selected.source === 'max' ? 'Max' : ''),
                        })}</div>
                    `;
                    attackBtn.textContent = panelState.attacking ? 'Attacking…' : 'Attack';
                } else {
                    selectedCard.className = 'selected-card empty-sel';
                    selectedCard.textContent = 'Select a lineup';
                    attackBtn.textContent = 'Attack';
                }
                attackBtn.disabled = !canAttack;

                const canTrain = !!(enemy?.userId && Array.isArray(enemy.heroes) && enemy.heroes.length === 5);
                if (panelState.training) {
                    trainHint.textContent = 'Training…';
                } else if (!canTrain) {
                    trainHint.textContent = '';
                } else if (needsTrainingData()) {
                    trainHint.textContent = panelState.counters?.reason === 'opponent_not_found'
                        ? 'No DB data — Train to gather'
                        : 'No stored beat — Train recommended';
                } else {
                    trainHint.textContent = '';
                }
                trainBtn.textContent = panelState.training ? '…' : 'Train';
                trainBtn.disabled = !canTrain || panelState.training || (isBusy() && !panelState.training);
            }

            return { render, place, destroy() { host.remove(); } };
        }

        async function resolveCurrentTesterUserId() {
            try {
                const response = await Send({
                    calls: [{ name: 'userGetInfo', args: {}, ident: 'userGetInfo' }],
                });
                const userInfo = response.results?.find((r) => r.ident === 'userGetInfo')?.result?.response || {};
                const userId = userInfo?.userId ?? userInfo?.id ?? null;
                return {
                    userId: userId != null ? String(userId) : null,
                    userInfo,
                };
            } catch (error) {
                console.warn(`[${EXTENSION_NAME}] userGetInfo failed:`, error);
                return { userId: null, userInfo: {} };
            }
        }

        async function fetchTeamSupport() {
            const response = await Send({
                calls: [
                    { name: 'teamGetAll', args: {}, ident: 'teamGetAll' },
                    { name: 'teamGetFavor', args: {}, ident: 'teamGetFavor' },
                    { name: 'team_getBanners', args: {}, ident: 'team_getBanners' },
                    { name: 'heroGetAll', args: {}, ident: 'heroGetAll' },
                    { name: 'userGetInfo', args: {}, ident: 'userGetInfo' },
                ],
            });
            const get = (ident) => response.results?.find((r) => r.ident === ident)?.result?.response || {};
            const rawHeroes = get('heroGetAll');
            const heroes = Array.isArray(rawHeroes) ? rawHeroes : Object.values(rawHeroes || {});
            return {
                teams: get('teamGetAll'),
                favor: get('teamGetFavor'),
                teamBanners: get('team_getBanners'),
                heroes,
                userInfo: get('userGetInfo'),
            };
        }

        function petPowerFromHeroes(heroes, petId) {
            const id = Number(petId);
            const row = (Array.isArray(heroes) ? heroes : []).find((hero) => Number(hero?.id) === id);
            return Number(row?.power || row?.sumPower || 0);
        }

        function listOwnedPetRecords(heroes = []) {
            return (Array.isArray(heroes) ? heroes : [])
                .filter((hero) => {
                    const id = Number(hero?.id);
                    return Number.isFinite(id) && id >= 6000 && id < 7000;
                })
                .sort((a, b) => Number(b?.power || b?.sumPower || 0) - Number(a?.power || a?.sumPower || 0));
        }

        function listOwnedPets(heroes = [], preferredPet = null, favorMaps = {}, limit = SIMLAB_MAX_PETS) {
            const owned = listOwnedPetRecords(heroes).map((hero) => Number(hero.id));
            const ordered = [];
            const seen = new Set();
            const push = (id) => {
                const pet = Number(id);
                if (!Number.isFinite(pet) || pet < 6000 || pet >= 7000 || seen.has(pet)) return;
                seen.add(pet);
                ordered.push(pet);
            };
            push(preferredPet);
            // Favor map values are also owned pets even if heroGetAll shape is odd.
            for (const map of Object.values(favorMaps || {})) {
                if (!map || typeof map !== 'object') continue;
                for (const petId of Object.values(map)) push(petId);
            }
            for (const id of owned) push(id);
            if (!ordered.length) push(CONSTANTS.DEFAULT_PET_ID);

            if (!(limit > 0) || ordered.length <= limit) return ordered;

            const preferred = Number(preferredPet);
            const rest = ordered
                .filter((id) => id !== preferred)
                .sort((a, b) => petPowerFromHeroes(heroes, b) - petPowerFromHeroes(heroes, a));
            const capped = [];
            if (Number.isFinite(preferred) && preferred >= 6000) capped.push(preferred);
            for (const id of rest) {
                if (capped.length >= limit) break;
                capped.push(id);
            }
            return capped;
        }

        function favorHeroIdsForPet(petLibEntry) {
            if (!petLibEntry) return [];
            const raw = petLibEntry.favorHeroes;
            if (Array.isArray(raw)) {
                return raw.map(Number).filter((id) => id > 0 && id < 6000);
            }
            if (raw && typeof raw === 'object') {
                return Object.values(raw).map(Number).filter((id) => id > 0 && id < 6000);
            }
            return [];
        }

        function canPetFavorHero(petId, heroId, petLib = {}) {
            const entry = petLib[petId] || petLib[String(petId)];
            const heroes = favorHeroIdsForPet(entry);
            // Missing lib entry: allow (game may still accept); empty favorHeroes means universal.
            if (!entry) return true;
            if (!heroes.length) return true;
            return heroes.includes(Number(heroId));
        }

        /**
         * Build hero→favor-pet map from owned pets that can favor each hero.
         * Prefers current arena/CD favor when still owned + compatible; otherwise strongest unused pet.
         */
        function buildSimLabFavor(heroIds, ownedPetIds, {
            heroes = [],
            existingFavor = {},
            petLib = null,
        } = {}) {
            const libPets = petLib || (typeof lib?.getData === 'function' ? (lib.getData('pet') || {}) : {});
            const favor = {};
            const used = new Set();

            const petsRanked = [...new Set((ownedPetIds || []).map(Number).filter((id) => id >= 6000 && id < 7000))]
                .sort((a, b) => petPowerFromHeroes(heroes, b) - petPowerFromHeroes(heroes, a));

            for (const heroId of heroIds) {
                const key = String(heroId);
                const existing = Number(existingFavor[key] ?? existingFavor[heroId]);
                if (Number.isFinite(existing) && existing >= 6000
                    && petsRanked.includes(existing)
                    && !used.has(existing)
                    && canPetFavorHero(existing, heroId, libPets)) {
                    favor[key] = existing;
                    used.add(existing);
                    continue;
                }
                const match = petsRanked.find((petId) => (
                    !used.has(petId) && canPetFavorHero(petId, heroId, libPets)
                ));
                if (match) {
                    favor[key] = match;
                    used.add(match);
                }
            }
            return favor;
        }

        function listOwnedBannerLoadouts(userInfo, preferredBanner = null) {
            const loadouts = [];
            const seen = new Set();
            const push = (bannerId, stones) => {
                const banner = Number(bannerId);
                if (!Number.isFinite(banner) || banner <= 0 || seen.has(banner)) return;
                seen.add(banner);
                let bannerStones = normalizeBannerStones(stones);
                if (!hasBannerStones(bannerStones)) {
                    bannerStones = resolveAttackBannerStonesFromClient(banner);
                }
                if (!hasBannerStones(bannerStones) && userInfo) {
                    bannerStones = resolveAttackBannerStones(userInfo, banner);
                }
                loadouts.push({ banner, bannerStones });
            };

            push(preferredBanner, null);

            const banners = Array.isArray(userInfo?.banners) ? userInfo.banners : [];
            for (const entry of banners) {
                if (entry == null) continue;
                if (typeof entry === 'number' || typeof entry === 'string') {
                    push(entry, null);
                    continue;
                }
                if (typeof entry === 'object') {
                    push(entry.id ?? entry.bannerId ?? entry.banner, entry.slots || entry.bannerStones);
                }
            }

            if (userInfo?.banner != null) {
                if (typeof userInfo.banner === 'object') {
                    push(userInfo.banner.id ?? userInfo.banner.bannerId, userInfo.banner.slots);
                } else if (Array.isArray(userInfo.banner)) {
                    userInfo.banner.forEach((id) => push(id, null));
                } else {
                    push(userInfo.banner, null);
                }
            }

            try {
                const data = findPlayerBannerData();
                const map = data
                    ? Object.values(data).find((value) => classNameOf(value) === INT_MAP_CLASS)
                    : null;
                const backing = getIntMapBacking(map);
                if (backing) {
                    for (const [key, entry] of Object.entries(backing)) {
                        push(key, slotsFromPlayerBannerEntry(entry));
                    }
                }
            } catch (error) {
                console.warn(`[${EXTENSION_NAME}] listOwnedBannerLoadouts client scan failed:`, error);
            }

            return loadouts;
        }

        function resolveBannerIdFromTeamBanners(teamBanners, mode = 'arena') {
            if (!teamBanners || typeof teamBanners !== 'object') return null;
            const keys = mode === 'clanDomination'
                ? ['clan_pvp_hero', 'arena', 'clan_domination_def', 'clan_global_pvp']
                : ['arena', 'clan_pvp_hero'];
            for (const key of keys) {
                const value = teamBanners[key];
                if (value == null) continue;
                if (typeof value === 'number' || typeof value === 'string') {
                    const id = Number(value);
                    if (Number.isFinite(id) && id > 0) return id;
                }
                if (Array.isArray(value)) {
                    const id = Number(value[0]);
                    if (Number.isFinite(id) && id > 0) return id;
                }
            }
            return null;
        }

        function resolveBanner(userInfo, teamBanners = null, mode = 'arena') {
            const fromTeams = resolveBannerIdFromTeamBanners(teamBanners, mode);
            if (fromTeams != null) return fromTeams;
            if (userInfo?.banner != null) {
                return Array.isArray(userInfo.banner) ? Number(userInfo.banner[0]) || 1 : Number(userInfo.banner) || 1;
            }
            return 1;
        }

        function resolveAttackBannerStones(userInfo, bannerId) {
            if (userInfo && typeof userInfo === 'object') {
                if (hasBannerStones(userInfo.bannerStones)) {
                    return normalizeBannerStones(userInfo.bannerStones);
                }
                const banners = Array.isArray(userInfo.banners) ? userInfo.banners : null;
                if (banners?.[0]?.slots) {
                    const fromList = normalizeBannerStones(banners[0].slots);
                    if (hasBannerStones(fromList)) return fromList;
                }
                if (userInfo.banner && typeof userInfo.banner === 'object' && userInfo.banner.slots) {
                    const fromBanner = normalizeBannerStones(userInfo.banner.slots);
                    if (hasBannerStones(fromBanner)) return fromBanner;
                }
            }
            return resolveAttackBannerStonesFromClient(bannerId);
        }

        /**
         * Walk a battle replay side (defenders/attackers) for heroId → favorPetId.
         * arenaFindEnemies / gather BattleTeam omit patronage; real fights store it here.
         */
        function extractFavorFromBattleReplaySide(side) {
            const favor = {};
            const heroes = [];
            if (!side || typeof side !== 'object') return { favor, heroes };

            const seen = new Set();
            const walk = (value, depth) => {
                if (!value || typeof value !== 'object' || depth > 12) return;
                if (seen.has(value) || seen.size > 2000) return;
                seen.add(value);

                const type = value.type != null ? String(value.type) : '';
                const id = Number(value.id ?? value.heroId);
                if (
                    (type === 'hero' || (type === '' && id > 0 && id < 6000 && value.favorPetId !== undefined))
                    && Number.isFinite(id)
                    && id > 0
                    && id < 6000
                ) {
                    heroes.push(id);
                    const petId = Number(value.favorPetId);
                    if (Number.isFinite(petId) && petId >= 6000 && petId < 7000) {
                        favor[String(id)] = petId;
                    }
                }

                const children = Array.isArray(value) ? value : Object.values(value);
                for (const child of children) walk(child, depth + 1);
            };
            walk(side, 0);
            return { favor, heroes: [...new Set(heroes)] };
        }

        function scoreHeroOverlap(candidateHeroIds, targetHeroIds) {
            const target = new Set((targetHeroIds || []).map(Number).filter((id) => id > 0 && id < 6000));
            if (!target.size) return 0;
            let hits = 0;
            for (const id of candidateHeroIds || []) {
                if (target.has(Number(id))) hits += 1;
            }
            return hits;
        }

        /**
         * Arena list/gather never include enemy favorPetId. Recover patronage from our
         * recent arena (then grand) battle replays where we attacked this opponent.
         */
        async function fetchEnemyFavorFromBattleLog(enemyUserId, heroIds = [], myUserId = null) {
            if (enemyUserId == null) return {};
            const target = String(enemyUserId);
            const me = myUserId != null ? String(myUserId) : null;
            const wantedHeroes = (heroIds || []).map(Number).filter((id) => id > 0 && id < 6000);

            const collectFromType = async (battleType) => {
                try {
                    const response = await Send({
                        calls: [{
                            name: 'battleGetByType',
                            args: { type: battleType, limit: 50, offset: 0 },
                            context: { actionTs: Date.now() },
                            ident: 'battleGetByType',
                        }],
                    });
                    if (response?.error) return [];
                    const body = response.results?.find((r) => r.ident === 'battleGetByType')?.result?.response
                        || response.results?.[0]?.result?.response
                        || {};
                    const replays = Array.isArray(body?.replays)
                        ? body.replays
                        : Object.values(body?.replays || {});
                    const candidates = [];
                    for (const replay of replays) {
                        if (!replay || typeof replay !== 'object') continue;
                        const userId = replay.userId != null ? String(replay.userId) : '';
                        const typeId = replay.typeId != null ? String(replay.typeId) : '';
                        // Our attack on them: userId=us, typeId=enemy → defenders are their arena defense.
                        const weAttacked = (me && userId === me && typeId === target)
                            || (!me && typeId === target && userId !== target);
                        if (!weAttacked) continue;

                        const extracted = extractFavorFromBattleReplaySide(replay.defenders);
                        if (!Object.keys(extracted.favor).length) continue;
                        const overlap = scoreHeroOverlap(extracted.heroes, wantedHeroes);
                        candidates.push({
                            favor: extracted.favor,
                            overlap,
                            favorCount: Object.keys(extracted.favor).length,
                            startTime: Number(replay.startTime) || 0,
                        });
                    }
                    return candidates;
                } catch (error) {
                    console.warn(`[${EXTENSION_NAME}] battleGetByType(${battleType}) favor lookup failed:`, error);
                    return [];
                }
            };

            const candidates = [
                ...(await collectFromType('arena')),
                ...(await collectFromType('grand')),
            ];
            if (!candidates.length) return {};

            candidates.sort((a, b) => {
                if (b.overlap !== a.overlap) return b.overlap - a.overlap;
                if (b.favorCount !== a.favorCount) return b.favorCount - a.favorCount;
                return b.startTime - a.startTime;
            });

            const best = candidates[0];
            if (wantedHeroes.length && best.overlap < Math.min(3, wantedHeroes.length)) {
                console.warn(
                    `[${EXTENSION_NAME}] battle-log favor for ${target} weak lineup match`
                    + ` (${best.overlap}/${wantedHeroes.length}) — using newest attack anyway`
                );
            }
            console.log(`[${EXTENSION_NAME}] battle-log defence favor for ${target}:`, best.favor, {
                overlap: best.overlap,
                favorCount: best.favorCount,
            });
            return best.favor;
        }

        async function fetchEnemyDefenceExtras(enemyUserId, options = {}) {
            const empty = { favor: {}, bannerStones: {}, banner: null, name: null, place: null, power: null };
            if (enemyUserId == null) return empty;
            const heroIds = Array.isArray(options.heroIds) ? options.heroIds : [];
            const myUserId = options.myUserId != null ? String(options.myUserId) : null;
            let extras = { ...empty };
            try {
                const response = await Send({
                    calls: [{
                        name: 'arenaFindEnemies',
                        args: {},
                        context: { actionTs: Date.now() },
                        ident: 'arenaFindEnemies',
                    }],
                });
                const list = response.results?.find((r) => r.ident === 'arenaFindEnemies')?.result?.response
                    || response.results?.[0]?.result?.response
                    || [];
                const target = String(enemyUserId);
                const entry = (Array.isArray(list) ? list : []).find((row) => {
                    const id = row?.userId ?? row?.user?.id ?? row?.id;
                    return id != null && String(id) === target;
                });
                if (entry) {
                    const bannerEntry = Array.isArray(entry.banners) ? entry.banners[0] : null;
                    const banner = bannerEntry?.id != null
                        ? Number(bannerEntry.id)
                        : (entry.banner != null ? Number(entry.banner) : null);
                    extras = {
                        favor: extractFavorFromEnemyEntry(entry),
                        bannerStones: normalizeBannerStones(bannerEntry?.slots || entry.bannerStones),
                        banner: Number.isFinite(banner) && banner > 0 ? banner : null,
                        name: entry.user?.name || entry.name || null,
                        place: entry.place ?? null,
                        power: entry.power ?? null,
                    };
                }
            } catch (error) {
                console.warn(`[${EXTENSION_NAME}] arenaFindEnemies for SimLab failed:`, error);
            }

            // arenaFindEnemies heroes are id/level/color/star only — recover favor from fight logs.
            if (!Object.keys(extras.favor || {}).length) {
                extras.favor = await fetchEnemyFavorFromBattleLog(enemyUserId, heroIds, myUserId);
            }
            return extras;
        }

        async function fetchCounters(comboKey, testerUserId) {
            const params = new URLSearchParams({
                comboKey,
                minWinRate: String(MIN_WIN_RATE),
                maxAgeDays: String(MAX_AGE_DAYS),
            });
            if (testerUserId) params.set('testerUserId', String(testerUserId));

            const res = await fetch(`${BRIDGE_URL}/training/counters?${params}`);
            if (!res.ok) {
                throw new Error(`Bridge HTTP ${res.status}`);
            }
            const data = await res.json();
            if (!data?.ok && data?.reason === 'missing_combo_key') {
                throw new Error('Missing combo key');
            }
            return data;
        }

        /** Best prior SimLab loadout for this enemy defense combo (heroes+pet). */
        async function fetchSimLabBestForCombo(comboKey, testerUserId) {
            if (!comboKey) return null;
            const params = new URLSearchParams({
                comboKey,
                maxAgeDays: String(MAX_AGE_DAYS),
            });
            if (testerUserId) params.set('testerUserId', String(testerUserId));
            try {
                const res = await fetch(`${BRIDGE_URL}/training/simlab?${params}`);
                if (!res.ok) return null;
                const data = await res.json();
                if (!data?.ok || !data?.best) return null;
                return data.best;
            } catch (error) {
                console.warn(`[${EXTENSION_NAME}] SimLab history lookup failed:`, error);
                return null;
            }
        }

        /**
         * Real arenaAttack battles carry defender favorPetId (list/gather do not).
         * Pull patronage + optional pet/banner from the first battle in the response.
         */
        function extractDefenceFromArenaAttackResponse(responseBody) {
            const battles = Array.isArray(responseBody?.battles)
                ? responseBody.battles
                : (responseBody?.battle ? [responseBody.battle] : []);
            const battle = battles[0] || null;
            if (!battle) {
                return { favor: {}, heroes: [], pet: 0, banner: 0, bannerStones: {} };
            }

            const fromDefenders = extractFavorFromBattleReplaySide(battle.defenders);
            let pet = 0;
            const seen = new Set();
            const walkPet = (value, depth) => {
                if (!value || typeof value !== 'object' || depth > 10 || pet) return;
                if (seen.has(value) || seen.size > 1500) return;
                seen.add(value);
                const id = Number(value.id);
                if (value.type === 'pet' && id >= 6000 && id < 7000) {
                    pet = id;
                    return;
                }
                const children = Array.isArray(value) ? value : Object.values(value);
                for (const child of children) walkPet(child, depth + 1);
            };
            walkPet(battle.defenders, 0);

            const bannerObj = battle.effects?.defendersBanner
                || battle.defendersBanner
                || battle.effects?.defenderBanner
                || null;
            const banner = Number(bannerObj?.id) || 0;
            const bannerStones = normalizeBannerStones(bannerObj?.slots || {});

            return {
                favor: fromDefenders.favor || {},
                heroes: fromDefenders.heroes || [],
                pet: pet || 0,
                banner,
                bannerStones,
            };
        }

        async function loadCountersForEnemy(enemy) {
            if (!enemy?.comboKey) return;
            const requestKey = enemy.comboKey;
            if (fetchInFlight && lastComboKey === requestKey) return fetchInFlight;

            lastComboKey = requestKey;
            lastFetchAt = Date.now();
            panelState.status = 'loading';
            panelState.message = 'Checking database…';
            clearSimHistory();
            clearSelection();
            panelController?.render();

            fetchInFlight = (async () => {
                try {
                    const { userId } = await resolveCurrentTesterUserId();
                    const [counters, simBestRaw] = await Promise.all([
                        fetchCounters(enemy.comboKey, userId),
                        fetchSimLabBestForCombo(enemy.comboKey, userId),
                    ]);
                    if (lastComboKey !== requestKey) return;
                    panelState.counters = counters;
                    panelState.simHistory = simLabBestToLoadout(simBestRaw);
                    panelState.status = 'ready';
                    const simBits = panelState.simHistory
                        ? ` · SimLab ${Math.round(Number(panelState.simHistory.winRate) || 0)}%`
                        : '';
                    panelState.message = counters.opponentName
                        ? `DB: ${counters.opponentName}${simBits}`
                        : (counters.reason === 'opponent_not_found'
                            ? (panelState.simHistory
                                ? `SimLab history${simBits}`
                                : 'No training data for this defense')
                            : (simBits ? simBits.replace(/^ · /, '') : ''));
                    console.log(`[${EXTENSION_NAME}] counters + SimLab history`, {
                        comboKey: enemy.comboKey,
                        atPower: normalizeCounterList(counters?.atPower).length,
                        maxBeat: normalizeCounterList(counters?.maxBeat).length,
                        simHistory: panelState.simHistory,
                    });
                } catch (error) {
                    if (lastComboKey !== requestKey) return;
                    console.warn(`[${EXTENSION_NAME}] counters fetch failed:`, error);
                    panelState.counters = { atPower: [], maxBeat: [] };
                    panelState.simHistory = null;
                    panelState.status = 'bridge_error';
                    panelState.message = 'Bridge/DB unavailable';
                } finally {
                    fetchInFlight = null;
                    panelController?.render();
                }
            })();

            return fetchInFlight;
        }

        function stopTrainStatusPolling() {
            if (trainStatusTimer) {
                clearInterval(trainStatusTimer);
                trainStatusTimer = null;
            }
        }

        function startTrainStatusPolling() {
            stopTrainStatusPolling();
            trainStatusTimer = setInterval(() => {
                if (!panelState.training) {
                    stopTrainStatusPolling();
                    return;
                }
                try {
                    const status = training?.getStatus?.();
                    if (status?.message) {
                        panelState.message = `Train: ${status.message}`;
                        panelController?.render();
                    }
                } catch {
                    // ignore status poll errors
                }
            }, 800);
        }

        async function buildOpponentOverrideForTraining(enemy) {
            let favor = normalizeFavorMap(enemy.favor);
            let banner = Number(enemy.banner) || 1;
            let bannerStones = hasBannerStones(enemy.bannerStones)
                ? normalizeBannerStones(enemy.bannerStones)
                : {};
            let name = enemy.name || null;
            let place = enemy.place ?? null;
            let power = enemy.power ?? null;
            const isCd = enemy.mode === 'clanDomination' || panelState.mode === 'clanDomination';

            if (!isCd) {
                const { userId: myUserId } = await resolveCurrentTesterUserId();
                const extras = await fetchEnemyDefenceExtras(enemy.userId, {
                    heroIds: enemy.heroes || [],
                    myUserId,
                });
                favor = {
                    ...favor,
                    ...normalizeFavorMap(extras.favor),
                };
                if (extras.banner) banner = extras.banner;
                if (hasBannerStones(extras.bannerStones)) {
                    bannerStones = normalizeBannerStones(extras.bannerStones);
                }
                name = extras.name || name;
                place = extras.place ?? place;
                power = extras.power ?? power;
            }

            return {
                userId: enemy.userId,
                user: { name: name || String(enemy.userId) },
                heroes: (enemy.heroes || []).map(Number).filter((id) => id > 0 && id < 6000),
                pet: Number(enemy.pet) || 0,
                banner,
                favor,
                bannerStones,
                place,
                power,
                source: isCd ? 'counter-suggest-clanDomination' : 'counter-suggest-gather',
            };
        }

        async function onTrainClick() {
            if (panelState.training) return;
            if (isBusy()) return;
            const enemy = panelState.enemy;
            if (!enemy?.userId) throw new Error('Enemy userId missing');
            if (!Array.isArray(enemy.heroes) || enemy.heroes.length !== 5) {
                throw new Error('Enemy lineup incomplete');
            }

            if (typeof training?.run !== 'function') {
                throw new Error('Arena Training API missing — cannot train');
            }

            panelState.training = true;
            panelState.status = 'training';
            panelState.message = 'Train: starting Arena Training…';
            panelController?.render();
            HWHFuncs.setProgress?.(`${EXTENSION_NAME}: training defense…`, true);
            startTrainStatusPolling();

            try {
                const opponentOverride = await buildOpponentOverrideForTraining(enemy);
                if (opponentOverride.heroes.length !== 5) {
                    throw new Error('Enemy needs 5 heroes to train');
                }

                console.log(`[${EXTENSION_NAME}] Train start`, {
                    userId: opponentOverride.userId,
                    heroes: opponentOverride.heroes,
                    pet: opponentOverride.pet,
                    banner: opponentOverride.banner,
                    source: opponentOverride.source,
                });

                const summary = await training.run({
                    label: opponentOverride.source,
                    opponentOverride,
                    opponentUserId: opponentOverride.userId,
                    saveToBridge: true,
                    skipCachedOpponents: false,
                    searchUntilTarget: true,
                    includeUserTeamTest: true,
                });

                console.log(`[${EXTENSION_NAME}] Train finished:`, summary);
                panelState.message = 'Train finished — refreshing counters…';
                panelController?.render();
                await loadCountersForEnemy(enemy);
                if (needsTrainingData()) {
                    panelState.message = 'Train finished — still no beatable counter stored';
                } else if (!panelState.message) {
                    panelState.message = 'Train finished';
                }
                panelState.status = 'ready';
                HWHFuncs.setProgress?.(
                    `${EXTENSION_NAME}: training finished`,
                    false
                );
            } finally {
                panelState.training = false;
                stopTrainStatusPolling();
                panelController?.render();
            }
        }

        async function onSimLabClick(match, source, options = {}) {
            if (isBusy() && !options.forceWhileBusy) return;
            const enemy = panelState.enemy;
            if (!enemy?.userId) throw new Error('Enemy userId missing');

            if (typeof training?.simulateMatchup !== 'function') {
                throw new Error('Arena Training API missing — cannot SimLab');
            }

            const heroes = (match?.myHeroIds || []).map(Number).filter((id) => id > 0 && id < 6000);
            const basePet = Number(match?.myPet);
            if (heroes.length !== 5) throw new Error('Suggested lineup needs 5 heroes');
            if (!Number.isFinite(basePet) || basePet < 6000) throw new Error('Suggested lineup needs a pet');

            const sweepBanners = source !== 'max';
            const simLabGroupId = `simlab_group_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            const defenceOverride = options.defenceOverride && typeof options.defenceOverride === 'object'
                ? options.defenceOverride
                : null;
            panelState.simming = true;
            panelState.attacking = false;
            panelState.status = 'simming';
            panelState.visible = true;
            panelState.message = options.reason
                ? `SimLab (${options.reason}): pet sweep…`
                : 'SimLab: pet sweep…';
            panelController?.render();
            HWHFuncs.setProgress?.(`${EXTENSION_NAME}: SimLab…`, true);

            try {
                const support = await fetchTeamSupport();
                const isCd = enemy.mode === 'clanDomination' || panelState.mode === 'clanDomination';
                const favorMaps = support.favor && typeof support.favor === 'object' ? support.favor : {};
                const existingFavor = favorMaps.arena || favorMaps.clan_pvp_hero || {};
                const pets = listOwnedPets(support.heroes, basePet, favorMaps, SIMLAB_MAX_PETS);
                const petLib = typeof lib?.getData === 'function' ? (lib.getData('pet') || {}) : {};
                const baseBanner = resolveBanner(
                    support.userInfo,
                    support.teamBanners,
                    isCd ? 'clanDomination' : 'arena'
                );
                const baseBannerStones = resolveAttackBannerStones(support.userInfo, baseBanner);

                let defenceFavor = normalizeFavorMap(enemy.favor);
                let defenceBanner = enemy.banner || 1;
                let defenceBannerStones = hasBannerStones(enemy.bannerStones)
                    ? normalizeBannerStones(enemy.bannerStones)
                    : {};
                let defenceName = null;
                let defencePlace = null;
                let defencePower = enemy.power ?? null;

                // Attack-response override wins — real defender favorPetId from arenaAttack.
                if (defenceOverride) {
                    defenceFavor = {
                        ...defenceFavor,
                        ...normalizeFavorMap(defenceOverride.favor),
                    };
                    if (defenceOverride.banner) defenceBanner = Number(defenceOverride.banner) || defenceBanner;
                    if (hasBannerStones(defenceOverride.bannerStones)) {
                        defenceBannerStones = normalizeBannerStones(defenceOverride.bannerStones);
                    }
                    if (defenceOverride.pet) {
                        // keep enemy.pet unless override provides one
                    }
                    defenceName = defenceOverride.name || defenceName;
                    defencePlace = defenceOverride.place ?? defencePlace;
                    defencePower = defenceOverride.power ?? defencePower;
                } else if (!isCd) {
                    const myUserId = support.userInfo?.userId ?? support.userInfo?.id ?? null;
                    const defenceExtras = await fetchEnemyDefenceExtras(enemy.userId, {
                        heroIds: enemy.heroes || [],
                        myUserId,
                    });
                    // Prefer arenaFindEnemies / battle-log favors; keep gather favors as fallback.
                    defenceFavor = {
                        ...defenceFavor,
                        ...normalizeFavorMap(defenceExtras.favor),
                    };
                    if (defenceExtras.banner) defenceBanner = defenceExtras.banner;
                    if (hasBannerStones(defenceExtras.bannerStones)) {
                        defenceBannerStones = normalizeBannerStones(defenceExtras.bannerStones);
                    }
                    defenceName = defenceExtras.name;
                    defencePlace = defenceExtras.place;
                    defencePower = defenceExtras.power ?? defencePower;
                }

                const defencePet = Number(defenceOverride?.pet) > 0
                    ? Number(defenceOverride.pet)
                    : (Number(enemy.pet) || 0);

                if (Object.keys(defenceFavor).length && panelState.enemy) {
                    panelState.enemy = {
                        ...panelState.enemy,
                        favor: defenceFavor,
                        banner: defenceBanner,
                        bannerStones: defenceBannerStones,
                        pet: defencePet || panelState.enemy.pet,
                    };
                }
                if (!Object.keys(defenceFavor).length) {
                    console.warn(
                        `[${EXTENSION_NAME}] SimLab defence favor empty for enemy ${enemy.userId}`
                        + (defenceOverride
                            ? ' — attack response had no favorPetId on defenders'
                            : ' — arenaFindEnemies omits favorPetId and no matching arena/grand attack'
                              + ' replay was found; demos run without enemy patronage')
                    );
                } else {
                    console.log(`[${EXTENSION_NAME}] SimLab defence favor:`, defenceFavor, {
                        fromAttack: !!defenceOverride,
                    });
                }

                if (!hasBannerStones(baseBannerStones)) {
                    console.warn(`[${EXTENSION_NAME}] SimLab attack bannerStones empty for banner ${baseBanner}`);
                }
                if (!hasBannerStones(defenceBannerStones)) {
                    console.warn(`[${EXTENSION_NAME}] SimLab defence bannerStones empty for enemy ${enemy.userId}`);
                }

                const opponentTeam = {
                    userId: enemy.userId,
                    name: defenceName,
                    heroes: enemy.heroes,
                    pet: defencePet || enemy.pet,
                    banner: defenceBanner,
                    favor: defenceFavor,
                    bannerStones: defenceBannerStones,
                    place: defencePlace,
                    power: defencePower,
                    source: isCd
                        ? 'simlab-clanDomination'
                        : (defenceOverride ? 'simlab-after-attack' : 'simlab-gather'),
                };

                const runOne = async (pet, banner, bannerStones, favorMap, phaseLabel) => {
                    const petName = petLabel(pet);
                    const favorCount = favorMap && typeof favorMap === 'object'
                        ? Object.keys(favorMap).length
                        : 0;
                    panelState.message = `SimLab ${phaseLabel}: ${petName} · B${banner} · favor ${favorCount}`;
                    panelController?.render();
                    HWHFuncs.setProgress?.(
                        `${EXTENSION_NAME}: SimLab ${phaseLabel} · ${petName}`,
                        true
                    );
                    const summary = await training.simulateMatchup({
                        label: isCd ? 'simlab-counter-cd' : 'simlab-counter',
                        maxUpgrade: false,
                        simulationsPerCombo: SIMLAB_SIMULATIONS,
                        saveToBridge: true,
                        simLabGroupId,
                        simLabPhase: phaseLabel,
                        myTeam: {
                            heroes,
                            pet,
                            banner,
                            favor: favorMap || {},
                            bannerStones: bannerStones || {},
                            heroNames: match?.myHeroNames,
                        },
                        opponentTeam,
                    });
                    const winRate = Number(summary?.winRate) || 0;
                    return {
                        pet,
                        banner,
                        bannerStones: bannerStones || {},
                        favor: favorMap || {},
                        wins: Number(summary?.wins) || 0,
                        losses: Number(summary?.losses) || 0,
                        winRate,
                        summary,
                        phaseLabel,
                    };
                };

                let best = null;
                const consider = (result) => {
                    if (!result) return;
                    if (!best || result.winRate > best.winRate) best = result;
                };

                // 1) Always sweep team pets (no favor) → pick highest win-rate pet
                console.log(`[${EXTENSION_NAME}] SimLab pet sweep`, {
                    pets,
                    basePet,
                    ownedPetRows: listOwnedPetRecords(support.heroes).length,
                });
                let bestPet = basePet;
                let bestPetWinRate = -1;
                for (let i = 0; i < pets.length; i++) {
                    const pet = pets[i];
                    const result = await runOne(
                        pet,
                        baseBanner,
                        baseBannerStones,
                        {},
                        `pet ${i + 1}/${pets.length}`
                    );
                    if (result.winRate > bestPetWinRate) {
                        bestPetWinRate = result.winRate;
                        bestPet = pet;
                    }
                }

                // 2) Assign available favors for the lineup, then sim best pet + favors
                const favor = buildSimLabFavor(heroes, pets, {
                    heroes: support.heroes,
                    existingFavor,
                    petLib,
                });
                console.log(`[${EXTENSION_NAME}] SimLab favor assignment`, {
                    favor,
                    bestPet,
                    bestPetWinRate,
                });
                panelState.message = `SimLab favor: ${Object.keys(favor).length}/5 heroes…`;
                panelController?.render();

                if (!Object.keys(favor).length) {
                    console.warn(`[${EXTENSION_NAME}] SimLab favor empty — no compatible owned pets for lineup`);
                }

                best = await runOne(
                    bestPet,
                    baseBanner,
                    baseBannerStones,
                    favor,
                    'favor'
                );

                // 3) Banner / flag sweep with locked best pet + favors
                if (sweepBanners) {
                    const banners = listOwnedBannerLoadouts(support.userInfo, baseBanner);
                    console.log(`[${EXTENSION_NAME}] SimLab banner sweep`, {
                        count: banners.length,
                        pet: bestPet,
                        favor,
                    });
                    for (let i = 0; i < banners.length; i++) {
                        const loadout = banners[i];
                        // Favor phase already covered base banner + bestPet + favors.
                        if (Number(loadout.banner) === Number(baseBanner)) continue;
                        const result = await runOne(
                            bestPet,
                            loadout.banner,
                            loadout.bannerStones,
                            favor,
                            `banner ${i + 1}/${banners.length}`
                        );
                        consider(result);
                        if (best.winRate >= SIMLAB_TARGET_WIN_RATE) break;
                    }
                }

                if (!best) throw new Error('SimLab produced no results');

                const simKey = selectionKey(match, source);
                const names = Array.isArray(match?.myHeroNames) && match.myHeroNames.length === 5
                    ? match.myHeroNames
                    : heroes.map(heroName);
                panelState.simBest = {
                    key: simKey,
                    heroes,
                    pet: best.pet,
                    banner: best.banner,
                    bannerStones: best.bannerStones,
                    favor: best.favor,
                    winRate: best.winRate,
                    wins: best.wins,
                    losses: best.losses,
                    heroNames: names,
                    fromHistory: false,
                };
                // Keep panel SimLab card in sync with the run we just finished.
                panelState.simHistory = {
                    heroes,
                    pet: best.pet,
                    banner: best.banner,
                    bannerStones: best.bannerStones,
                    favor: best.favor,
                    winRate: best.winRate,
                    wins: best.wins,
                    losses: best.losses,
                    heroNames: names,
                    maxUpgrade: false,
                    fromHistory: true,
                };

                const assignedFavors = Object.keys(best.favor || {}).length;
                const hitTarget = best.winRate >= SIMLAB_TARGET_WIN_RATE;
                const msg = hitTarget
                    ? `SimLab OK ${best.wins}W/${best.losses}L (${best.winRate.toFixed(0)}%) · ${petLabel(best.pet)} · B${best.banner} · favor ${assignedFavors}`
                    : `SimLab best ${best.wins}W/${best.losses}L (${best.winRate.toFixed(0)}%) · ${petLabel(best.pet)} · B${best.banner} · favor ${assignedFavors} (<${SIMLAB_TARGET_WIN_RATE}%)`;
                panelState.message = msg;
                panelState.status = 'ready';
                HWHFuncs.setProgress?.(`${EXTENSION_NAME}: ${msg}`, false);
                console.log(`[${EXTENSION_NAME}] SimLab finished:`, {
                    source,
                    simLabGroupId,
                    sweepBanners,
                    petsTried: pets,
                    favorAssigned: favor,
                    target: SIMLAB_TARGET_WIN_RATE,
                    best,
                });
            } finally {
                panelState.simming = false;
                panelController?.render();
            }
        }

        function simLabBestToLoadout(best, fallbackMatch = null) {
            if (!best || typeof best !== 'object') return null;
            // Counter Suggest SimLab always runs at account power — ignore max-upgrade leftovers.
            if (best.maxUpgrade === true) return null;
            const heroes = (best.myHeroIds || best.heroes || fallbackMatch?.myHeroIds || [])
                .map(Number)
                .filter((id) => id > 0 && id < 6000);
            const pet = Number(best.myPet ?? best.pet ?? fallbackMatch?.myPet);
            if (heroes.length !== 5 || !Number.isFinite(pet) || pet < 6000) return null;
            return {
                heroes,
                pet,
                banner: Number(best.myBanner ?? best.banner) || 0,
                bannerStones: best.myBannerStones || best.bannerStones || {},
                favor: best.myFavor || best.favor || {},
                winRate: Number(best.winRate) || 0,
                wins: Number(best.wins) || 0,
                losses: Number(best.losses) || 0,
                heroNames: best.myHeroNames || best.heroNames || fallbackMatch?.myHeroNames,
                maxUpgrade: false,
                fromHistory: true,
            };
        }

        async function onSuggestClick(match, source) {
            if (isBusy()) return;
            const enemy = panelState.enemy;
            if (!enemy?.userId) throw new Error('Enemy userId missing');

            const selKey = selectionKey(match, source);
            const sessionSimBest = panelState.simBest?.key === selKey ? panelState.simBest : null;
            let heroes = (match?.myHeroIds || []).map(Number).filter((id) => id > 0 && id < 6000);
            let pet = Number(sessionSimBest?.pet ?? match?.myPet);
            if (heroes.length !== 5) throw new Error('Suggested lineup needs 5 heroes');
            if (!Number.isFinite(pet) || pet < 6000) throw new Error('Suggested lineup needs a pet');

            const isCd = enemy.mode === 'clanDomination' || panelState.mode === 'clanDomination';
            panelState.attacking = true;
            panelState.status = 'attacking';
            panelState.message = isCd
                ? (source === 'max' ? 'Clan Domination: setting max-power team…' : 'Clan Domination: setting my-power team…')
                : 'Attack: checking SimLab history…';
            panelController?.render();
            HWHFuncs.setProgress?.(`${EXTENSION_NAME}: attacking…`, true);

            try {
                const support = await fetchTeamSupport();
                const favorMaps = support.favor && typeof support.favor === 'object' ? support.favor : {};
                const arenaFavor = favorMaps.arena || {};
                const myUserId = support.userInfo?.userId ?? support.userInfo?.id ?? null;

                // Arena Attack: reuse SimLab history when this defense was already simmed;
                // otherwise attack first (to capture real favour), then SimLab.
                let priorSimLab = null;
                let usedPriorSimLab = false;
                if (!isCd && enemy.comboKey) {
                    priorSimLab = sessionSimBest
                        ? simLabBestToLoadout(sessionSimBest, match)
                        : simLabBestToLoadout(
                            await fetchSimLabBestForCombo(enemy.comboKey, myUserId),
                            match
                        );
                    if (priorSimLab) {
                        usedPriorSimLab = true;
                        heroes = priorSimLab.heroes;
                        pet = priorSimLab.pet;
                        panelState.simBest = {
                            key: selKey,
                            heroes,
                            pet,
                            banner: priorSimLab.banner,
                            bannerStones: priorSimLab.bannerStones,
                            favor: priorSimLab.favor,
                            winRate: priorSimLab.winRate,
                            wins: priorSimLab.wins,
                            losses: priorSimLab.losses,
                        };
                        panelState.message = `Attack: using SimLab ${priorSimLab.winRate.toFixed(0)}% loadout…`;
                        panelController?.render();
                        console.log(`[${EXTENSION_NAME}] Attack using prior SimLab loadout`, priorSimLab);
                    } else {
                        panelState.message = 'Attack: no SimLab history — attacking to capture defense favor…';
                        panelController?.render();
                        console.log(`[${EXTENSION_NAME}] No SimLab history for ${enemy.comboKey} — attack-first`);
                    }
                }

                const simBest = panelState.simBest?.key === selKey ? panelState.simBest : null;
                const ownedPets = listOwnedPets(support.heroes, pet, favorMaps, SIMLAB_MAX_PETS);
                const favor = (simBest?.favor && typeof simBest.favor === 'object' && Object.keys(simBest.favor).length)
                    ? simBest.favor
                    : buildSimLabFavor(heroes, ownedPets, {
                        heroes: support.heroes,
                        existingFavor: arenaFavor,
                        petLib: typeof lib?.getData === 'function' ? (lib.getData('pet') || {}) : {},
                    });
                const banner = Number(simBest?.banner) > 0
                    ? Number(simBest.banner)
                    : resolveBanner(
                        support.userInfo,
                        support.teamBanners,
                        isCd ? 'clanDomination' : 'arena'
                    );

                if (isCd) {
                    const setArgs = {
                        units: heroes,
                        pet,
                        favor,
                        banner,
                    };
                    console.log(`[${EXTENSION_NAME}] clanDomination_setDefence`, setArgs, { source });
                    const setResponse = await Send({
                        calls: [{
                            name: 'clanDomination_setDefence',
                            args: setArgs,
                            context: { actionTs: Date.now() },
                            ident: 'clanDomination_setDefence',
                        }],
                    });
                    if (setResponse?.error) {
                        throw new Error(
                            `setDefence failed: ${setResponse.error.name || 'Unknown'}`
                            + (setResponse.error.description ? ` - ${setResponse.error.description}` : '')
                        );
                    }

                    const startArgs = { targetId: String(enemy.userId) };
                    console.log(`[${EXTENSION_NAME}] clanDomination_startBattle`, startArgs, {
                        levelId: enemy.levelId,
                        source,
                    });
                    const startResponse = await Send({
                        calls: [{
                            name: 'clanDomination_startBattle',
                            args: startArgs,
                            context: { actionTs: Date.now() },
                            ident: 'clanDomination_startBattle',
                        }],
                    });
                    if (startResponse?.error) {
                        throw new Error(
                            `startBattle failed: ${startResponse.error.name || 'Unknown'}`
                            + (startResponse.error.description ? ` - ${startResponse.error.description}` : '')
                        );
                    }

                    const cdTarget = readClanDominationTarget();
                    closeGather(cdTarget?.mediator);

                    panelState.message = 'Clan Domination battle started';
                    panelState.status = 'done';
                    panelState.attacking = false;
                    panelState.visible = false;
                    panelController?.render();
                    HWHFuncs.setProgress?.(`${EXTENSION_NAME}: Clan Domination battle started`, false);
                    console.log(`[${EXTENSION_NAME}] clanDomination_startBattle response:`, startResponse);
                    return;
                }

                // Keep gather open until arenaAttack succeeds — closing first cancels the
                // pending challenge and often yields NotAvailable after a long SimLab.
                const normalizeFavor = (map) => {
                    const out = {};
                    if (!map || typeof map !== 'object') return out;
                    for (const [key, value] of Object.entries(map)) {
                        const heroId = Number(key);
                        const petId = Number(value);
                        if (heroId > 0 && heroId < 6000 && petId >= 6000 && petId < 7000) {
                            out[String(heroId)] = petId;
                        }
                    }
                    return out;
                };

                const extractSendError = (response) => {
                    if (response?.error) return response.error;
                    for (const item of response?.results || []) {
                        if (item?.error) return item.error;
                        if (item?.result?.error) return item.result.error;
                    }
                    return null;
                };

                const isNotAvailable = (err) => {
                    const text = `${err?.name || ''} ${err?.description || ''}`.toLowerCase();
                    return text.includes('notavailable') || text.includes('not available');
                };

                // Only end a demo if one may still be open — blind endBattle can itself upset attack state.
                const forceCloseOpenDemoBattle = async () => {
                    try {
                        const response = await Send({
                            calls: [{
                                name: 'demoBattles_endBattle',
                                args: {
                                    result: { win: false, stars: 0 },
                                    progress: null,
                                },
                                context: { actionTs: Date.now() },
                                ident: 'demoBattles_endBattle',
                            }],
                        });
                        const err = extractSendError(response);
                        if (err) {
                            console.log(
                                `[${EXTENSION_NAME}] demoBattles_endBattle before retry:`,
                                err.name || err
                            );
                        } else {
                            console.log(`[${EXTENSION_NAME}] closed dangling demo before arenaAttack retry`);
                        }
                    } catch (error) {
                        console.log(`[${EXTENSION_NAME}] demo close before retry skipped:`, error?.message || error);
                    }
                };

                let gather = readEnemyFromGather();
                if (!gather?.enemy?.userId) {
                    throw new Error('Keep the Arena gather popup open on this enemy, then click Attack.');
                }

                // Refresh the live Arena list + range check immediately before arenaAttack.
                // Gather _id can disagree with arenaFindEnemies userId — prefer the fresh list id.
                panelState.message = 'Attack: refreshing Arena target…';
                panelController?.render();
                let refreshed;
                try {
                    refreshed = await refreshArenaAttackTarget({
                        userId: gather.enemy.userId,
                        heroes: gather.enemy.heroes || enemy.heroes,
                        pet: gather.enemy.pet || enemy.pet,
                    });
                } catch (refreshError) {
                    console.warn(`[${EXTENSION_NAME}] refreshArenaAttackTarget failed:`, refreshError);
                    refreshed = {
                        userId: Number(gather.enemy.userId || enemy.userId),
                        onList: null,
                        inRange: null,
                        matchedBy: null,
                        listCount: 0,
                    };
                }

                console.log(`[${EXTENSION_NAME}] Attack target refresh`, {
                    gatherUserId: gather.enemy.userId,
                    panelUserId: enemy.userId,
                    refreshed,
                });

                if (refreshed.onList === false) {
                    throw new Error(
                        `Enemy ${enemy.userId} not in the current arenaFindEnemies list`
                        + ` (${refreshed.listCount} foes). Tap Arena refresh, open gather again, then Attack.`
                    );
                }
                if (refreshed.inRange === false) {
                    throw new Error(
                        `Enemy ${refreshed.userId} failed arenaCheckTargetRange`
                        + ' — refresh the Arena list, open gather again, then Attack.'
                    );
                }

                const attackUserId = Number(refreshed.userId || gather.enemy.userId || enemy.userId);
                if (!Number.isFinite(attackUserId) || attackUserId <= 0) {
                    throw new Error('Could not resolve a valid Arena attack userId');
                }
                if (String(attackUserId) !== String(enemy.userId) && panelState.enemy) {
                    console.warn(
                        `[${EXTENSION_NAME}] correcting panel userId ${enemy.userId} → ${attackUserId}`
                        + ` (matched by ${refreshed.matchedBy})`
                    );
                    panelState.enemy = { ...panelState.enemy, userId: attackUserId };
                }

                // Re-read gather after the refresh RPCs — must still be the same challenge.
                gather = readEnemyFromGather();
                if (!gather?.enemy?.userId) {
                    throw new Error('Gather closed during target refresh — reopen gather, then Attack.');
                }

                const sendArenaAttack = async (args, label) => {
                    gather = readEnemyFromGather();
                    if (!gather?.enemy?.userId) {
                        return {
                            response: null,
                            error: {
                                name: 'NotAvailable',
                                description: 'Gather challenge closed before arenaAttack',
                            },
                        };
                    }
                    console.log(`[${EXTENSION_NAME}] arenaAttack`, args, {
                        source,
                        label,
                        gatherUserId: gather.enemy.userId,
                        refreshedUserId: attackUserId,
                        matchedBy: refreshed.matchedBy,
                        inRange: refreshed.inRange,
                    });
                    const response = await Send({
                        calls: [{
                            name: 'arenaAttack',
                            args,
                            context: { actionTs: Date.now() },
                            ident: 'body',
                        }],
                    });
                    return { response, error: extractSendError(response) };
                };

                let args = {
                    userId: attackUserId,
                    heroes,
                    pet,
                    favor: normalizeFavor(favor),
                    banners: [banner],
                };

                console.log(
                    `[${EXTENSION_NAME}] v${EXTENSION_VERSION} arenaAttack starting`,
                    { attackUserId, heroes, pet, banner, favorKeys: Object.keys(args.favor || {}) }
                );

                let { response, error: attackError } = await sendArenaAttack(args, 'primary');

                // NotAvailable: close leftover demo, retry equipped banner/favor while gather stays open.
                if (attackError && isNotAvailable(attackError)) {
                    await forceCloseOpenDemoBattle();
                    const safeBanner = resolveBanner(
                        support.userInfo,
                        support.teamBanners,
                        'arena'
                    );
                    const safeFavor = normalizeFavor(pickFavor(heroes, arenaFavor));
                    const retryArgs = {
                        userId: attackUserId,
                        heroes,
                        pet,
                        favor: Object.keys(safeFavor).length ? safeFavor : args.favor,
                        banners: [safeBanner || banner || 1],
                    };
                    console.warn(
                        `[${EXTENSION_NAME}] arenaAttack NotAvailable — retry with safe loadout`,
                        { primary: args, retry: retryArgs, refreshed }
                    );
                    args = retryArgs;
                    ({ response, error: attackError } = await sendArenaAttack(args, 'safe-loadout-retry'));
                }

                // Still NotAvailable: close gather and attack from the fresh list (Auto Daily style).
                if (attackError && isNotAvailable(attackError) && refreshed.onList) {
                    console.warn(
                        `[${EXTENSION_NAME}] arenaAttack still NotAvailable — closing gather and retrying list attack`,
                        { attackUserId, refreshed }
                    );
                    closeGather(gather?.mediator);
                    gather = null;
                    await new Promise((resolve) => setTimeout(resolve, 250));
                    const response2 = await Send({
                        calls: [{
                            name: 'arenaAttack',
                            args,
                            context: { actionTs: Date.now() },
                            ident: 'body',
                        }],
                    });
                    response = response2;
                    attackError = extractSendError(response2);
                    console.log(`[${EXTENSION_NAME}] list-attack retry result:`, attackError || 'ok');
                }

                if (attackError) {
                    const name = attackError.name || 'Unknown';
                    const desc = attackError.description || '';
                    if (isNotAvailable(attackError)) {
                        const gatherStillOpen = !!readEnemyFromGather()?.enemy?.userId;
                        let hint;
                        if (refreshed.inRange === false) {
                            hint = 'Enemy failed arenaCheckTargetRange — refresh Arena list and reopen gather.';
                        } else if (refreshed.onList === false) {
                            hint = 'Enemy missing from fresh arenaFindEnemies — refresh Arena list and reopen gather.';
                        } else if (gatherStillOpen) {
                            hint = 'Gather still open after failed retries — try closing gather and Attack again,'
                                + ' or check peace time / attempts / demo battles.';
                        } else {
                            hint = 'May be peace time, no attempts left, arena locked, or a demo still open.';
                        }
                        throw new Error(
                            `arenaAttack failed: ${name}${desc ? ` - ${desc}` : ''} (${hint})`
                            + ` [v${EXTENSION_VERSION}]`
                        );
                    }
                    throw new Error(
                        `arenaAttack failed: ${name}${desc ? ` - ${desc}` : ''} [v${EXTENSION_VERSION}]`
                    );
                }

                if (gather?.mediator) closeGather(gather.mediator);

                const responseBody = response.results?.[0]?.result?.response
                    || response.results?.[0]?.response
                    || response.results?.[0]?.result
                    || null;
                const win = responseBody?.win;
                const defenceFromFight = extractDefenceFromArenaAttackResponse(responseBody);
                console.log(`[${EXTENSION_NAME}] arenaAttack response:`, responseBody || response);
                console.log(`[${EXTENSION_NAME}] defence from fight:`, defenceFromFight);

                if (Object.keys(defenceFromFight.favor || {}).length && panelState.enemy) {
                    panelState.enemy = {
                        ...panelState.enemy,
                        favor: {
                            ...(panelState.enemy.favor || {}),
                            ...defenceFromFight.favor,
                        },
                        banner: defenceFromFight.banner || panelState.enemy.banner,
                        bannerStones: hasBannerStones(defenceFromFight.bannerStones)
                            ? defenceFromFight.bannerStones
                            : panelState.enemy.bannerStones,
                        pet: defenceFromFight.pet || panelState.enemy.pet,
                    };
                }

                const shouldSimAfterAttack = !usedPriorSimLab || win === false;
                if (shouldSimAfterAttack) {
                    const reason = !usedPriorSimLab
                        ? 'after first attack'
                        : 'after loss';
                    const resultLabel = win === true ? 'Victory' : win === false ? 'Defeat' : 'Attack sent';
                    panelState.attacking = false;
                    panelState.message = `${resultLabel} — starting SimLab ${reason}…`;
                    panelState.status = 'simming';
                    panelState.visible = true;
                    panelController?.render();
                    HWHFuncs.setProgress?.(
                        `${EXTENSION_NAME}: ${resultLabel}, running SimLab…`,
                        true
                    );

                    const simMatch = {
                        myHeroIds: heroes,
                        myPet: pet,
                        myHeroNames: match?.myHeroNames || priorSimLab?.heroNames,
                    };
                    await onSimLabClick(simMatch, source, {
                        forceWhileBusy: true,
                        reason,
                        defenceOverride: {
                            favor: defenceFromFight.favor,
                            banner: defenceFromFight.banner || enemy.banner || 1,
                            bannerStones: defenceFromFight.bannerStones,
                            pet: defenceFromFight.pet || enemy.pet,
                            name: enemy.name,
                            place: enemy.place,
                            power: enemy.power,
                        },
                    });
                    return;
                }

                const msg = win === true ? 'Victory' : win === false ? 'Defeat' : 'Attack sent';
                panelState.message = usedPriorSimLab
                    ? `${msg} (SimLab loadout)`
                    : msg;
                panelState.status = 'done';
                panelState.attacking = false;
                panelState.visible = false;
                panelController?.render();
                HWHFuncs.setProgress?.(`${EXTENSION_NAME}: ${msg}`, false);
            } catch (error) {
                panelState.attacking = false;
                panelState.simming = false;
                throw error;
            }
        }

        function hidePanel() {
            if (!panelState.visible && !panelState.enemy) return;
            panelState.visible = false;
            panelState.enemy = null;
            panelState.counters = null;
            clearSelection();
            panelState.message = '';
            panelState.status = 'idle';
            panelState.mode = 'arena';
            lastComboKey = null;
            lastRenderSignature = '';
            panelController?.render();
        }

        function showEnemyPanel(enemy, mode) {
            panelState.visible = true;
            panelState.mode = mode;
            if (enemy?.comboKey !== panelState.enemy?.comboKey) {
                clearSelection();
            }
            panelState.enemy = enemy;
            const needsFetch = enemy.comboKey !== lastComboKey
                || (!panelState.counters && panelState.status !== 'loading');
            panelController?.render();
            if (needsFetch && Date.now() - lastFetchAt > 250) {
                loadCountersForEnemy(enemy);
            }
        }

        function setPollDelay(nextMs) {
            pollDelayMs = nextMs;
        }

        function schedulePoll(delay = pollDelayMs) {
            if (pollTimer) clearTimeout(pollTimer);
            pollTimer = setTimeout(() => {
                try {
                    tick();
                } finally {
                    schedulePoll(pollDelayMs);
                }
            }, delay);
        }

        function openCounters() {
            const gather = readEnemyFromGather();
            if (gather?.enemy) {
                showEnemyPanel({ ...gather.enemy, mode: 'arena' }, 'arena');
                setPollDelay(POLL_ACTIVE_MS);
                return;
            }
            const cdTarget = readClanDominationTarget();
            if (cdTarget?.levelId) {
                panelState.mode = 'clanDomination';
                panelState.visible = true;
                panelState.message = `Loading Domination enemy @${cdTarget.levelId}…`;
                panelController?.render(true);
                setPollDelay(POLL_ACTIVE_MS);
                fetchClanDominationEnemy(cdTarget.levelId)
                    .then((enemy) => showEnemyPanel(enemy, 'clanDomination'))
                    .catch((error) => {
                        HWHFuncs.setProgress?.(
                            `${EXTENSION_NAME}: ${error?.message || 'Domination enemy failed'}`,
                            false
                        );
                    });
                return;
            }
            HWHFuncs.setProgress?.(
                `${EXTENSION_NAME}: open Arena gather or Clan Domination attack target first`,
                false
            );
        }

        function tick() {
            if (isBusy()) {
                setPollDelay(POLL_ACTIVE_MS);
                return;
            }

            const gather = readEnemyFromGather();
            if (gather) {
                setPollDelay(POLL_ACTIVE_MS);
                panelState.mode = 'arena';
                panelState.visible = true;
                if (!gather.enemy) {
                    panelState.enemy = null;
                    panelState.counters = null;
                    panelState.status = 'error';
                    panelState.message = 'Could not read enemy lineup from gather popup';
                    panelController?.render();
                    return;
                }
                showEnemyPanel({ ...gather.enemy, mode: 'arena' }, 'arena');
                return;
            }

            if (!isClanDominationMapOpen()) {
                setPollDelay(POLL_IDLE_MS);
                hidePanel();
                return;
            }

            setPollDelay(POLL_ACTIVE_MS);

            // Only show Counters when the attack-target popup is open.
            const cdTarget = readClanDominationTarget();
            if (cdTarget?.enemy) {
                showEnemyPanel(cdTarget.enemy, 'clanDomination');
                return;
            }
            if (cdTarget?.levelId) {
                panelState.mode = 'clanDomination';
                panelState.visible = true;
                const cached = getCachedClanDominationEnemy(cdTarget.levelId);
                if (cached) {
                    showEnemyPanel(cached, 'clanDomination');
                    return;
                }

                panelState.message = `Loading Domination enemy @${cdTarget.levelId}…`;
                panelState.status = 'loading';
                panelController?.render();
                fetchClanDominationEnemy(cdTarget.levelId)
                    .then((enemy) => {
                        if (isBusy()) return;
                        if (!isClanDominationMapOpen()) return;
                        const still = readClanDominationTarget();
                        if (still?.levelId != null && Number(still.levelId) !== Number(cdTarget.levelId)) return;
                        showEnemyPanel(enemy, 'clanDomination');
                    })
                    .catch((error) => {
                        console.warn(`[${EXTENSION_NAME}] Clan Domination enemy fetch failed:`, error);
                        if (isBusy()) return;
                        panelState.enemy = null;
                        panelState.counters = null;
                        panelState.status = 'error';
                        panelState.message = error?.message || 'Failed to load Domination enemy';
                        panelController?.render();
                    });
                return;
            }

            // Map/castle open but no attack target selected — keep panel hidden.
            hidePanel();
        }

        installClanDominationEnemyObserver();
        panelController = createPanel();
        schedulePoll(POLL_IDLE_MS);
        const onResize = () => panelController?.place();
        window.addEventListener('resize', onResize);

        window.__ahCounterSuggestTeardown = () => {
            try {
                if (pollTimer) clearTimeout(pollTimer);
                pollTimer = null;
                stopTrainStatusPolling();
                window.removeEventListener('resize', onResize);
                document.getElementById(HOST_ID)?.remove();
                if (typeof window.__ahCounterSuggestCdRestore === 'function') {
                    window.__ahCounterSuggestCdRestore();
                }
            } catch (error) {
                console.warn(`[${EXTENSION_NAME}] instance teardown error:`, error);
            }
            delete window.__ahCounterSuggestTeardown;
        };

        console.log(`${EXTENSION_NAME}: polling for ${POPUP_CLASS}, ${CD_ATTACK_POPUP_CLASS}, and ${CD_MAP_POPUP_CLASS} (observe getEnemyTeams)`);
        return { openCounters };
    }

    const reseedApi = {
        getTestFightCount,
        calcBattleCopy,
        runLocalSeededDemo,
    };
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = reseedApi;
    }
    if (typeof process !== 'undefined' && process.release?.name === 'node') {
        globalThis.__arenaTrainingReseedTest = reseedApi;
    }
})();
