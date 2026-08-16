// ==UserScript==
// @name         Arena Training HwH Ext
// @namespace    HeroWarsHelper.ArenaTraining
// @version      1.4
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
    const EXTENSION_VERSION = '1.4';
    const BRIDGE_URL = 'http://127.0.0.1:9876';
    const EXTENSION_AUTHOR = 'AutoHero';

    const CONSTANTS = {
        BATTLE_VERSION: 273,
        DEFAULT_PET_ID: 6005,
        DEFAULT_SIMULATIONS: 10,
        DEFAULT_MAX_COMBOS: 40,
        DEFAULT_POOL_SIZE: 12,
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
            try {
                const data = lib?.getData?.('hero');
                const hero = data?.[heroId] || data?.[String(heroId)];
                return hero?.name || hero?.caption || `Hero ${heroId}`;
            } catch {
                return `Hero ${heroId}`;
            }
        }

        function combinations(items, size, maxCount) {
            const result = [];
            const combo = [];
            function backtrack(start) {
                if (result.length >= maxCount) return;
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
                .filter((entry) => entry && entry.heroes.length > 0);
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

            for (const item of opponent.heroes || []) {
                const id = typeof item === 'number' ? item : item?.id;
                if (!id) continue;
                if (id >= 6000 && id < 7000) {
                    pet = id;
                } else if (heroes.length < 5) {
                    heroes.push(id);
                }
            }

            if (opponent.banners?.[0]) {
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

            const battle = response?.results?.[0]?.result?.response?.battle;
            return {
                parentId: battle?.parentId,
                battleId: battle?.id,
            };
        }

        async function runSingleDemoBattle(myTeam, opponentTeam, parentId = 0) {
            const args = {
                mechanic: 'arena',
                defenceMaxUpgrade: true,
                maxUpgrade: true,
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

        async function simulateTeam(myTeam, opponentTeam, simulationCount) {
            const simulations = [];
            let parentId = 0;
            let firstBattleId = null;

            for (let i = 0; i < simulationCount; i++) {
                if (stopRequested) break;
                const result = await runSingleDemoBattle(myTeam, opponentTeam, i === 0 ? 0 : (firstBattleId || parentId));
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

        function resolveHeroPoolSize(options = {}) {
            if (options.topLimit > 0) return Number(options.topLimit);
            if (options.heroPoolSize > 0) return Number(options.heroPoolSize);
            return CONSTANTS.DEFAULT_POOL_SIZE;
        }

        function applyTrainingOptions(options = {}) {
            const heroPoolSize = resolveHeroPoolSize(options);
            return { ...options, heroPoolSize, topLimit: heroPoolSize };
        }

        function buildCandidateTeams(data, options) {
            const arenaTeam = data.teams?.arena || [];
            const arenaFavor = data.favor?.arena || {};
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

            const petPool = (options.petPool?.length
                ? options.petPool.map(Number)
                : [...new Set([
                    arenaTeam[5],
                    ...ownedPets.slice(0, 3),
                    CONSTANTS.DEFAULT_PET_ID,
                ].filter(Boolean))]);

            const maxCombinations = options.maxCombinations || CONSTANTS.DEFAULT_MAX_COMBOS;
            const heroCombos = combinations(heroPool, 5, maxCombinations);
            const banner = options.banner ?? resolveBanner(data.userInfo, data.teams);

            const candidates = [];
            if (options.includeCurrentTeam !== false && arenaTeam.length >= 6) {
                for (const pet of petPool.slice(0, 2)) {
                    candidates.push({
                        heroes: arenaTeam.slice(0, 5).map(Number),
                        pet: Number(pet),
                        banner,
                        favor: pickFavor(arenaTeam.slice(0, 5), arenaFavor),
                        source: 'current-team-variant',
                    });
                }
            }

            for (const heroIds of heroCombos) {
                for (const pet of petPool) {
                    candidates.push({
                        heroes: heroIds,
                        pet,
                        banner,
                        favor: pickFavor(heroIds, arenaFavor),
                        source: 'generated',
                    });
                }
            }

            const unique = [];
            const seen = new Set();
            for (const candidate of candidates) {
                const key = `${candidate.heroes.join(',')}:${candidate.pet}`;
                if (seen.has(key)) continue;
                seen.add(key);
                unique.push(candidate);
                if (unique.length >= maxCombinations) break;
            }
            return { candidates: unique, arenaFavor, banner, heroPool, petPool };
        }

        function pickOpponent(opponents, options) {
            if (!opponents?.length) {
                throw new Error('No arena opponents available');
            }
            if (options.opponentUserId != null) {
                const found = opponents.find((o) => String(o.userId) === String(options.opponentUserId));
                if (!found) throw new Error(`Opponent ${options.opponentUserId} not found`);
                return found;
            }
            const index = Math.max(0, Math.min(opponents.length - 1, Number(options.opponentIndex) || 0));
            return opponents[index];
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
                        pet: (opp.heroes || []).map((h) => h?.id || h).find((id) => id >= 6000),
                        banner: opp.banners?.[0]?.id ?? opp.banners?.[0] ?? null,
                        source,
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
                    simulationsPerCombo: 5,
                    includeCurrentTeam: true,
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
                    try {
                        while (loopRunning && !stopRequested) {
                            const opponents = await this.getOpponents(true, trainOptions);
                            const indexes = Array.isArray(trainOptions.opponentIndexes) && trainOptions.opponentIndexes.length
                                ? trainOptions.opponentIndexes
                                : opponents.map((o) => o.index);

                            for (const idx of indexes) {
                                if (!loopRunning || stopRequested) break;
                                if (trainOptions.maxRounds > 0 && roundNum >= trainOptions.maxRounds) {
                                    loopRunning = false;
                                    break;
                                }

                                roundNum++;
                                status.loopRound = roundNum;
                                status.message = `Loop round ${roundNum} — opponent ${idx}`;

                                try {
                                    const result = await this.runSingle({
                                        ...trainOptions,
                                        opponentIndex: idx,
                                        label: `${trainOptions.label}-r${roundNum}`,
                                    });
                                    loopSession.rounds.push(result);
                                    lastResults = result;

                                    if (trainOptions.saveToBridge !== false) {
                                        const saved = await saveRoundToBridge(result);
                                        if (saved) {
                                            loopSession.lastSavedAt = new Date().toISOString();
                                        }
                                    }

                                    const best = result.best;
                                    if (best) {
                                        console.log(
                                            `[Arena Training] Round ${roundNum} saved — best ${best.winRate.toFixed(1)}%:`,
                                            best.heroNames.join(', ')
                                        );
                                    }
                                } catch (err) {
                                    console.error(`[Arena Training] Round ${roundNum} failed:`, err);
                                    loopSession.rounds.push({
                                        round: roundNum,
                                        opponentIndex: idx,
                                        error: err.message,
                                        completedAt: new Date().toISOString(),
                                    });
                                }

                                if (trainOptions.delayBetweenRoundsMs > 0) {
                                    await sleep(trainOptions.delayBetweenRoundsMs);
                                }
                            }

                            if (trainOptions.maxRounds > 0 && roundNum >= trainOptions.maxRounds) break;
                            if (!trainOptions.repeatCycle) break;
                        }
                    } finally {
                        loopRunning = false;
                        status.loopRunning = false;
                        status.message = stopRequested
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
                return this.runSingle(options);
            },

            async runSingle(options = {}) {
                if (running) {
                    throw new Error('Arena training already running');
                }

                options = applyTrainingOptions(options);
                running = true;
                stopRequested = false;
                const sessionId = `arena_train_${Date.now()}`;
                const startedAt = new Date().toISOString();
                const simulationsPerCombo = options.simulationsPerCombo || CONSTANTS.DEFAULT_SIMULATIONS;

                status = {
                    running: true,
                    sessionId,
                    currentCombo: 0,
                    totalCombos: 0,
                    label: options.label || 'arena-training',
                    message: 'Loading arena data...',
                };

                try {
                    HWHFuncs.setProgress('Arena Training: loading opponents and heroes...', true);
                    const data = await loadGameData(options);
                    const opponentRaw = pickOpponent(data.opponents, options);
                    const opponentTeam = extractOpponentConfig(opponentRaw);
                    if (!opponentTeam.hasValidTeam) {
                        throw new Error('Selected opponent has invalid team data');
                    }

                    const { candidates, heroPool, petPool, banner } = buildCandidateTeams(data, options);
                    status.totalCombos = candidates.length;
                    status.message = `Testing ${candidates.length} teams vs ${opponentRaw.user?.name || opponentRaw.userId}`;

                    const rankings = [];
                    for (let i = 0; i < candidates.length; i++) {
                        if (stopRequested) break;
                        const candidate = candidates[i];
                        status.currentCombo = i + 1;
                        status.message = `Simulating ${i + 1}/${candidates.length}`;

                        const heroLabels = candidate.heroes.map(heroName);
                        HWHFuncs.setProgress(
                            `Arena Training ${i + 1}/${candidates.length}: ${heroLabels.join(', ')}`,
                            true
                        );

                        const myTeam = buildMyTeamConfig(
                            candidate.heroes,
                            candidate.pet,
                            candidate.banner ?? banner,
                            candidate.favor
                        );

                        const simulation = await simulateTeam(myTeam, opponentTeam, simulationsPerCombo);
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
                            heroPool,
                            petPool,
                            simulationsPerCombo,
                            maxCombinations: options.maxCombinations || CONSTANTS.DEFAULT_MAX_COMBOS,
                            includeCurrentTeam: options.includeCurrentTeam !== false,
                            opponentSource: options.opponentSource || 'topGet',
                            topLimit: options.topLimit,
                            heroPoolSize: options.heroPoolSize,
                            opponentLimit: options.opponentLimit || 0,
                            myArenaPlace: opponentsMeta.myPlace,
                        },
                        testedCombos: rankings.length,
                        rankings,
                        best: rankings[0] || null,
                    };

                    const best = rankings[0];
                    const summary = best
                        ? `Best: ${best.heroNames.join(', ')} + pet ${best.pet} (${best.winRate.toFixed(1)}% WR)`
                        : 'No combinations tested';
                    HWHFuncs.setProgress(`Arena Training done. ${summary}`, true);
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
                <p><b>Loop mode</b> loads the arena top 50 via <code>topGet</code> and tests your combos vs each defense team.</p>
                <p>Demo battles only — <b>no arena attempts used</b>.</p>
                <p>Defaults: top <b>12</b> heroes (<code>topLimit</code>), 20 combos, 5 sims each, all arena top teams.</p>
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
