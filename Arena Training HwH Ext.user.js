// ==UserScript==
// @name         Arena Training HwH Ext
// @namespace    HeroWarsHelper.ArenaTraining
// @version      1.19
// @description  Simulate arena hero combos with demo battles and record win rates (no attempts used)
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
    const EXTENSION_VERSION = '1.19';
    const BRIDGE_URL = 'http://127.0.0.1:9876';
    const EXTENSION_AUTHOR = 'AutoHero';
    const AUTO_START_CHECKBOX = 'autoArenaTraining';
    const AUTO_START_DELAY_MS = 60_000;
    const LEGACY_SETTINGS_STORAGE_KEY = 'arenaTrainingSettings';

    let autoStartTimer = null;

    function registerI18n() {
        if (!window.HWHData?.i18nLangData) {
            return false;
        }
        Object.assign(window.HWHData.i18nLangData.en, {
            AUTO_ARENA_TRAINING: 'Auto Arena Training',
            AUTO_ARENA_TRAINING_TITLE: 'Auto-start arena training loop 1 minute after game load (demo battles, no attempts)',
        });
        Object.assign(window.HWHData.i18nLangData.ru, {
            AUTO_ARENA_TRAINING: 'Авто-тренировка арены',
            AUTO_ARENA_TRAINING_TITLE: 'Автозапуск цикла тренировки арены через 1 минуту после загрузки (демо-бои, без попыток)',
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
                    || 'Auto-start arena training loop 1 minute after game load (demo battles, no attempts)';
            },
            default: false,
        };
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

    const registerSettingsInterval = setInterval(() => {
        if (registerSettingsCheckbox()) {
            clearInterval(registerSettingsInterval);
        }
    }, 50);

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

    function scheduleAutoStart(training, HWHFuncs) {
        clearAutoStartTimer();
        if (!isAutoStartEnabled(HWHFuncs)) {
            return;
        }

        console.log(`[Arena Training] Auto-start scheduled in ${Math.round(AUTO_START_DELAY_MS / 1000)}s`);
        autoStartTimer = setTimeout(() => {
            autoStartTimer = null;
            if (!isAutoStartEnabled(HWHFuncs)) {
                return;
            }
            const status = training.getStatus?.() || {};
            const loopStatus = training.getLoopStatus?.() || {};
            if (status.running || loopStatus.loopRunning) {
                console.log('[Arena Training] Auto-start skipped — training already running');
                return;
            }
            console.log('[Arena Training] Auto-starting training loop');
            HWHFuncs.setProgress('Arena Training: auto-starting loop...', true);
            training.startLoop({ label: 'auto-loop', opponentSource: 'topGet' });
        }, AUTO_START_DELAY_MS);
    }

    function migrateLegacyAutoStartSetting(HWHFuncs) {
        try {
            const legacy = JSON.parse(localStorage.getItem(LEGACY_SETTINGS_STORAGE_KEY) || '{}');
            if (!legacy.autoStartOnLoad || isAutoStartEnabled(HWHFuncs)) {
                return;
            }
            HWHFuncs.setSaveVal?.(AUTO_START_CHECKBOX, true);
            const checkbox = ensureSettingsCheckboxUI(HWHFuncs);
            if (checkbox) {
                checkbox.checked = true;
            }
            localStorage.removeItem(LEGACY_SETTINGS_STORAGE_KEY);
            console.log('[Arena Training] Migrated legacy auto-start setting to HWH settings');
        } catch (error) {
            console.warn('[Arena Training] Legacy settings migration failed:', error);
        }
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
        BATTLE_VERSION: 273,
        DEFAULT_PET_ID: 6005,
        DEFAULT_SIMULATIONS: 10,
        DEFAULT_MAX_COMBOS: 40,
        DEFAULT_POOL_SIZE: 12,
        DEFAULT_TARGET_WIN_RATE: 90,
        DEFAULT_USER_TEAM_TARGET_WIN_RATE: 70,
        DEFAULT_SKIP_CACHE_MIN_WIN_RATE: 90,
        DEFAULT_SKIP_CACHE_MAX_AGE_DAYS: 30,
        DEFAULT_META_TEAMS_LIMIT: 0,
    };

    const waitForHWH = setInterval(() => {
        if (window.HWHClasses?.ScriptMenu && window.Send && window.cheats?.BattleCalc && window.HWHFuncs) {
            const scriptMenu = window.HWHClasses.ScriptMenu.getInst();
            if (scriptMenu?.mainMenu) {
                clearInterval(waitForHWH);
                initializeExtension();
            }
        }
    }, 200);

    function initializeExtension() {
        const { HWHClasses, HWHFuncs, Send, cheats, lib } = window;
        HWHFuncs.addExtentionName(EXTENSION_NAME, EXTENSION_VERSION, EXTENSION_AUTHOR);

        const training = createArenaTraining({ Send, cheats, lib, HWHFuncs });
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
        }

        HWHClasses.ScriptMenu.getInst().addButton({
            name: 'Arena Train',
            title: 'Loop arena top-list training — auto-saves results (demo battles, no attempts)',
            onClick: () => training.startLoop({ label: 'menu-loop', opponentSource: 'topGet' }),
            color: 'purple',
        });

        migrateLegacyAutoStartSetting(HWHFuncs);
        bindAutoStartCheckbox(training, HWHFuncs);
        scheduleAutoStart(training, HWHFuncs);

        console.log(`${EXTENSION_NAME} v${EXTENSION_VERSION} ready`);
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
                const res = await fetch(`${BRIDGE_URL}/training/save`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(result),
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

        function buildComboKey(heroIds, pet, banner = 0) {
            const heroes = (Array.isArray(heroIds) ? heroIds : [])
                .map(Number)
                .filter((id) => id > 0 && id < 6000);
            return `${heroes.join(',')}|${Number(pet) || 0}|${Number(banner) || 0}`;
        }

        async function fetchOpponentSkipCheck(comboKey, options = {}) {
            const minWinRate = Number(options.skipCacheMinWinRate ?? CONSTANTS.DEFAULT_SKIP_CACHE_MIN_WIN_RATE);
            const maxAgeDays = Number(options.skipCacheMaxAgeDays ?? CONSTANTS.DEFAULT_SKIP_CACHE_MAX_AGE_DAYS);
            const params = new URLSearchParams({
                comboKey,
                minWinRate: String(minWinRate),
                maxAgeDays: String(maxAgeDays),
            });

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
                // fall through to numeric fallback
            }

            return id >= 6000 && id < 7000 ? `Pet ${id}` : `Hero ${id}`;
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

        function pickFavor(heroIds, arenaFavor = {}) {
            const favor = {};
            for (const heroId of heroIds) {
                const key = String(heroId);
                if (arenaFavor[key] != null) {
                    favor[key] = arenaFavor[key];
                } else if (arenaFavor[heroId] != null) {
                    favor[key] = arenaFavor[heroId];
                }
            }
            return favor;
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

            return {
                hasValidTeam: heroes.length === 5,
                heroes,
                pet,
                banner,
                favor: {},
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
            loopSession.rounds.push({
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

        function buildMyTeamConfig(heroIds, pet, banner, arenaFavor) {
            return {
                heroes: heroIds,
                pet,
                banners: [banner],
                favor: pickFavor(heroIds, arenaFavor),
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

        async function runSingleDemoBattle(myTeam, opponentTeam, parentId = 0, battleOptions = {}) {
            const maxUpgrade = battleOptions.maxUpgrade !== false;
            const args = {
                mechanic: 'arena',
                defenceMaxUpgrade: true,
                maxUpgrade,
                defenceBuffs: {},
                buffs: {},
                parentId,
                entryId: 0,
                defenceTeam: {
                    units: opponentTeam.heroes,
                    pet: opponentTeam.pet || CONSTANTS.DEFAULT_PET_ID,
                },
                defenceBanner: opponentTeam.banner || 1,
                defenceBannerStones: {},
                defenceFavor: opponentTeam.favor || {},
                team: {
                    units: myTeam.heroes,
                    pet: myTeam.pet || CONSTANTS.DEFAULT_PET_ID,
                },
                banner: myTeam.banners?.[0] || 1,
                bannerStones: {},
                favor: myTeam.favor || {},
            };

            const startResponse = await Send({
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

            const calcResult = await new Promise((resolve) => {
                const battleType = battleData?.effects?.battleConfig ?? battleData?.type ?? 'arena';
                BattleCalc(battleData, getBattleType(battleType), (result) => resolve(result));
            });

            if (!isValidBattleResult(calcResult)) {
                return { win: false, battleTime: 0, parentId };
            }

            const endInfo = await endDemoBattle(calcResult, battleData);
            const nextParentId = parentId === 0
                ? (endInfo.battleId || endInfo.parentId || 0)
                : parentId;

            return {
                win: !!calcResult.result.win,
                battleTime: calcResult.battleTime || 0,
                parentId: nextParentId,
            };
        }

        async function simulateTeam(myTeam, opponentTeam, simulationCount, battleOptions = {}) {
            const simulations = [];
            let parentId = 0;
            let firstBattleId = null;

            for (let i = 0; i < simulationCount; i++) {
                if (stopRequested) break;
                const result = await runSingleDemoBattle(
                    myTeam,
                    opponentTeam,
                    i === 0 ? 0 : (firstBattleId || parentId),
                    battleOptions
                );
                simulations.push(result);
                if (i === 0 && result.parentId) {
                    firstBattleId = result.parentId;
                    parentId = result.parentId;
                }
            }

            const wins = simulations.filter((s) => s.win).length;
            const losses = simulations.length - wins;
            const battleTimes = simulations.map((s) => s.battleTime).filter((t) => t > 0);
            const averageBattleTime = battleTimes.length
                ? battleTimes.reduce((a, b) => a + b, 0) / battleTimes.length
                : 0;

            return {
                total: simulations.length,
                wins,
                losses,
                winRate: simulations.length ? (wins / simulations.length) * 100 : 0,
                averageBattleTime,
                simulations,
            };
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

        function buildCandidateTeams(data, options) {
            const plan = buildPhasedCandidatePlan(data, options);
            const maxCombinations = options.maxCombinations || CONSTANTS.DEFAULT_MAX_COMBOS;
            const testedKeys = new Set(plan.priorityCandidates.map(candidateKey));
            const generatedCandidates = buildGeneratedCandidates(plan, {
                maxHeroCombos: maxCombinations,
                excludeKeys: testedKeys,
            });

            const unique = [...plan.priorityCandidates];
            for (const candidate of generatedCandidates) {
                if (unique.length >= plan.priorityCandidates.length + maxCombinations) break;
                const key = candidateKey(candidate);
                if (testedKeys.has(key)) continue;
                testedKeys.add(key);
                unique.push(candidate);
            }

            return { candidates: unique, ...plan };
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
                    list: opponents.map((opp, index) => ({
                        index,
                        userId: opp.userId,
                        name: opp.user?.name || `Opponent ${opp.userId}`,
                        place: opp.place,
                        power: opp.power,
                        heroes: (opp.heroes || [])
                            .filter((h) => (h?.id || h) < 6000)
                            .map((h) => h?.id || h),
                        heroNames: (opp.heroes || [])
                            .filter((h) => (h?.id || h) < 6000)
                            .map((h) => heroName(h?.id || h)),
                        pet: (opp.heroes || []).map((h) => h?.id || h).find((id) => id >= 6000) ?? opp.pet,
                        banner: opp.banners?.[0]?.id ?? opp.banners?.[0] ?? opp.banner ?? null,
                        source,
                        raw: opp,
                    })),
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

                const comboKey = opponentMeta?.heroes?.length === 5
                    ? buildComboKey(opponentMeta.heroes, opponentMeta.pet, opponentMeta.banner)
                    : null;

                while (!stopRequested && (!loopSession || loopRunning)) {
                    attempt++;
                    let counterLineup = null;
                    let maxResult = null;
                    let usedCache = false;

                    if (
                        attempt === 1
                        && trainOptions.skipCachedOpponents !== false
                        && comboKey
                    ) {
                        const skipInfo = await fetchOpponentSkipCheck(comboKey, trainOptions);
                        if (skipInfo.shouldSkip && skipInfo.bestMatch?.myHeroIds?.length === 5) {
                            const cachedLineup = counterLineupFromCache(skipInfo.bestMatch);
                            const cachedKey = candidateKey(cachedLineup);
                            if (!excludeKeys.has(cachedKey)) {
                                counterLineup = cachedLineup;
                                usedCache = true;
                                const skippedResult = {
                                    skipped: true,
                                    skipReason: 'cached_counter',
                                    attempt,
                                    opponentComboKey: comboKey,
                                    cachedBestWinRate: skipInfo.bestWinRate,
                                    cachedBestMatch: skipInfo.bestMatch,
                                    cachedLastTestedAt: skipInfo.lastTestedAt,
                                    counterLineup,
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
                                pairAttempts.push({ attempt, type: 'max-cache', result: skippedResult });
                                if (loopSession) loopSession.rounds.push(skippedResult);
                                console.log(
                                    `[Arena Training] Round ${roundNum} attempt ${attempt} — using cached ${skipInfo.bestWinRate?.toFixed?.(1) ?? skipInfo.bestWinRate}% counter`
                                );
                            }
                        }
                    }

                    if (!counterLineup) {
                        status.message = `Round ${roundNum} attempt ${attempt} — max search (${excludeKeys.size} excluded)`;
                        maxResult = await this.runSingle({
                            ...trainOptions,
                            maxUpgrade: true,
                            skipCachedOpponents: false,
                            excludeCandidateKeys: [...excludeKeys],
                            searchUntilTarget: true,
                            opponentUserId: opponentMeta.userId,
                            opponentIndex: runOptions.opponentIndex ?? opponentMeta.index ?? 0,
                            opponentOverride: opponentRaw,
                            label: `${trainOptions.label}-r${roundNum}-max-a${attempt}`,
                        });
                        finalMaxResult = maxResult;
                        pairAttempts.push({ attempt, type: 'max-search', result: maxResult });
                        if (loopSession) loopSession.rounds.push(maxResult);

                        if (trainOptions.saveToBridge !== false) {
                            const saved = await saveRoundToBridge(maxResult);
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
                    } else if (usedCache) {
                        console.log(
                            `[Arena Training] Round ${roundNum} attempt ${attempt} max — cached ${counterLineup.cachedWinRate?.toFixed?.(1) ?? '?'}%:`,
                            (counterLineup.heroNames || counterLineup.heroes.map(heroName)).join(', ')
                        );
                    }

                    status.message = `Round ${roundNum} attempt ${attempt} — user test same lineup`;
                    const userResult = await this.runSingle({
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
                    finalUserResult = userResult;
                    pairAttempts.push({ attempt, type: 'user-counter', result: userResult, counterLineup });
                    if (loopSession) loopSession.rounds.push(userResult);
                    lastResults = userResult;

                    if (trainOptions.saveToBridge !== false) {
                        const userSaved = await saveRoundToBridge(userResult);
                        if (userSaved && loopSession) {
                            loopSession.lastSavedAt = new Date().toISOString();
                        }
                    }

                    const userWinRate = userResult.best?.winRate ?? 0;
                    const userHeroNames = userResult.best?.heroNames?.join(', ')
                        || counterLineup.heroNames?.join(', ')
                        || counterLineup.heroes.map(heroName).join(', ');
                    console.log(
                        `[Arena Training] Round ${roundNum} attempt ${attempt} user — ${userWinRate.toFixed(1)}%:`,
                        userHeroNames
                    );

                    if (userWinRate >= userTargetWinRate) {
                        userTargetMet = true;
                        console.log(
                            `[Arena Training] Round ${roundNum} — user team reached ${userTargetWinRate}%+ with counter lineup`
                        );
                        break;
                    }

                    excludeKeys.add(candidateKey(counterLineup));
                    console.log(
                        `[Arena Training] Round ${roundNum} — user ${userWinRate.toFixed(1)}% < ${userTargetWinRate}%, searching another ${maxTargetWinRate}%+ max counter`
                    );

                    const maxAttempts = Number(trainOptions.maxCounterAttempts);
                    if (Number.isFinite(maxAttempts) && maxAttempts > 0 && attempt >= maxAttempts) {
                        console.warn(`[Arena Training] Round ${roundNum} — stopped after ${maxAttempts} counter attempts`);
                        break;
                    }
                }

                const summary = {
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
                };
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
                                const result = await this.runSingle({
                                    ...trainOptions,
                                    maxUpgrade: true,
                                    skipCachedOpponents: false,
                                    opponentUserId: opponentMeta.userId,
                                    opponentIndex: runOptions.opponentIndex ?? opponentMeta.index ?? 0,
                                    opponentOverride: opponentRaw,
                                    label: `${trainOptions.label}-r${roundNum}-max`,
                                });
                                loopSession.rounds.push(result);
                                lastResults = result;
                                if (trainOptions.saveToBridge !== false) {
                                    const saved = await saveRoundToBridge(result);
                                    if (saved) loopSession.lastSavedAt = new Date().toISOString();
                                }
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
                            loopSession.rounds.push({
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
                    || {
                        index: options.opponentIndex ?? 0,
                        userId: opponentRaw?.userId,
                        name: opponentRaw?.user?.name,
                        place: opponentRaw?.place,
                        power: opponentRaw?.power,
                        heroes: extractOpponentConfig(opponentRaw).heroes,
                        pet: extractOpponentConfig(opponentRaw).pet,
                        banner: extractOpponentConfig(opponentRaw).banner,
                        source: opponentRaw?.source || options.opponentSource,
                        raw: opponentRaw,
                    };

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
                const simulationsPerCombo = options.simulationsPerCombo || CONSTANTS.DEFAULT_SIMULATIONS;
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
                        const skipInfo = await fetchOpponentSkipCheck(opponentComboKey, options);
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
                            lastResults = skippedResult;
                            HWHFuncs.setProgress(
                                `Arena Training skipped — cached ${skipInfo.bestWinRate?.toFixed?.(1) ?? skipInfo.bestWinRate}% counter (${opponentComboKey})`,
                                true
                            );
                            return skippedResult;
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
                                candidate.favor
                            );

                            const simulation = await simulateTeam(
                                myTeam,
                                opponentTeam,
                                simulationsPerCombo,
                                battleOptions
                            );
                            rankings.push({
                                rank: 0,
                                heroes: candidate.heroes,
                                heroNames: heroLabels,
                                pet: candidate.pet,
                                banner: myTeam.banners[0],
                                favor: myTeam.favor,
                                source: candidate.source,
                                wins: simulation.wins,
                                losses: simulation.losses,
                                winRate: simulation.winRate,
                                averageBattleTime: simulation.averageBattleTime,
                                simulations: simulation.simulations,
                            });

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
                                    const generatedCandidates = searchUntilTarget
                                        ? buildGeneratedCandidates(plan, { excludeKeys: testedKeys })
                                        : buildGeneratedCandidates(plan, {
                                            maxHeroCombos: maxCombinations,
                                            excludeKeys: testedKeys,
                                        }).slice(0, maxCombinations);

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

                    lastResults = {
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
                        config: {
                            heroPool,
                            petPool,
                            simulationsPerCombo,
                            targetWinRate,
                            searchUntilTarget,
                            maxUpgrade: tester.maxUpgrade,
                            userTeamOnly,
                            counterLineupOnly,
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
                        best: rankings[0] || null,
                    };

                    const best = rankings[0];
                    const summary = best
                        ? `Best: ${best.heroNames.join(', ')} + pet ${best.pet} (${best.winRate.toFixed(1)}% WR)`
                        : 'No combinations tested';
                    const stopNote = stoppedBecause === 'target_met'
                        ? ` Target ${targetWinRate}%+ reached.`
                        : (searchUntilTarget ? ` Exhausted ${rankings.length} combos (no ${targetWinRate}%+).` : '');
                    HWHFuncs.setProgress(`Arena Training done. ${summary}${stopNote}`, true);
                    console.log('[Arena Training] Results:', lastResults);
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
        };
    }

    async function openTrainingPopup(training, HWHFuncs) {
        try {
            const content = document.createElement('div');
            content.style.cssText = 'padding: 16px; color: #fce1ac; max-width: 640px; line-height: 1.5;';
            content.innerHTML = `
                <h3 style="margin-top:0;color:#ffd700;">Arena Training</h3>
                <p><b>Loop mode</b> loads the arena top 50 via <code>topGet</code>, then tests vs <b>meta team</b> opponents from the bridge DB.</p>
                <p>Demo battles only — <b>no arena attempts used</b>.</p>
                <p>Skips opponents already solved in PostgreSQL: <b>${CONSTANTS.DEFAULT_SKIP_CACHE_MIN_WIN_RATE}%+</b> counter found within <b>${CONSTANTS.DEFAULT_SKIP_CACHE_MAX_AGE_DAYS} days</b> (via bridge).</p>
                <p>Per opponent: find a <b>${CONSTANTS.DEFAULT_TARGET_WIN_RATE}%+</b> max counter (or use cache), test the <b>same lineup</b> with your real heroes, and re-search if user win rate is below <b>${CONSTANTS.DEFAULT_USER_TEAM_TARGET_WIN_RATE}%</b>.</p>
                <p>Max search phases: <b>arena</b> → <b>grand arena</b> → <b>meta teams</b> → generated.</p>
                <p>Run <code>node llm-bridge-server.mjs</code> with PostgreSQL (<code>DATABASE_URL</code>) so results save to the bridge database.</p>
            `;

            const popupPromise = HWHFuncs.popup.confirm('', [
                { msg: 'Start loop', result: 'loop', color: 'green' },
                { msg: 'One round only', result: 'run', color: 'blue' },
                { msg: 'Stop loop', result: 'stop', color: 'red' },
                { msg: 'Close', result: false, isClose: true },
            ]);
            await new Promise((resolve) => setTimeout(resolve, 0));
            const popupBody = document.querySelector('.PopUp_Container');
            if (popupBody) {
                popupBody.innerHTML = '';
                popupBody.appendChild(content);
            }
            const choice = await popupPromise;
            if (choice === 'loop') {
                training.startLoop({ label: 'popup-loop' });
            } else if (choice === 'run') {
                training.run({ label: 'popup-single', opponentIndex: 0, opponentSource: 'topGet' }).catch((err) => {
                    HWHFuncs.setProgress(`Arena Training failed: ${err.message}`, true);
                });
            } else if (choice === 'stop') {
                training.stopLoop();
                HWHFuncs.setProgress('Arena loop stopped', true);
            }
        } catch (error) {
            HWHFuncs.setProgress(`Arena Training error: ${error.message}`, true);
        }
    }
})();
