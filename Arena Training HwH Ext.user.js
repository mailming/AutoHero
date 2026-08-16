// ==UserScript==
// @name         Arena Training HwH Ext
// @namespace    HeroWarsHelper.ArenaTraining
// @version      1.0
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
    const EXTENSION_VERSION = '1.0';
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
            window.LLMHWH.arenaTrainingGetOpponents = () => training.getOpponents();
            window.LLMHWH.arenaTrainingGetResults = () => training.getResults();
            window.LLMHWH.arenaTrainingExportResults = () => training.exportResults();
            window.LLMHWH.arenaTrainingGetStatus = () => training.getStatus();
            window.LLMHWH.arenaTrainingStop = () => training.stop();
        }

        HWHClasses.ScriptMenu.getInst().addButton({
            name: 'Arena Train',
            title: 'Test arena hero combinations with demo battles (no attempts used)',
            onClick: () => openTrainingPopup(training, HWHFuncs),
            color: 'purple',
        });

        console.log(`${EXTENSION_NAME} v${EXTENSION_VERSION} ready`);
    }

    function createArenaTraining({ Send, cheats, lib, HWHFuncs }) {
        const BattleCalc = cheats.BattleCalc;
        let running = false;
        let stopRequested = false;
        let status = { running: false };
        let lastResults = null;
        let opponentsCache = null;

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

        async function loadGameData() {
            const response = await Send({
                calls: [
                    { name: 'arenaFindEnemies', args: {}, ident: 'arenaFindEnemies' },
                    { name: 'teamGetAll', args: {}, ident: 'teamGetAll' },
                    { name: 'teamGetFavor', args: {}, ident: 'teamGetFavor' },
                    { name: 'heroGetAll', args: {}, ident: 'heroGetAll' },
                    { name: 'userGetInfo', args: {}, ident: 'userGetInfo' },
                ],
            });

            const get = (ident) => response.results?.find((r) => r.ident === ident)?.result?.response;
            return {
                opponents: get('arenaFindEnemies') || [],
                teams: get('teamGetAll') || {},
                favor: get('teamGetFavor') || {},
                heroes: parseHeroes(get('heroGetAll')),
                userInfo: get('userGetInfo') || {},
            };
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

            const poolSize = options.heroPoolSize || CONSTANTS.DEFAULT_POOL_SIZE;
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
            async getOpponents(forceRefresh = false) {
                if (!forceRefresh && opponentsCache) return opponentsCache;
                const data = await loadGameData();
                opponentsCache = (data.opponents || []).map((opp, index) => ({
                    index,
                    userId: opp.userId,
                    name: opp.user?.name || `Opponent ${opp.userId}`,
                    place: opp.place,
                    power: opp.power,
                    heroes: (opp.heroes || []).filter((h) => (h?.id || h) < 6000).map((h) => h?.id || h),
                    pet: (opp.heroes || []).find((h) => (h?.id || h) >= 6000)?.id,
                }));
                return opponentsCache;
            },

            getStatus() {
                return { ...status, lastResultsId: lastResults?.sessionId || null };
            },

            getResults() {
                return lastResults;
            },

            exportResults() {
                return lastResults ? { exportedAt: new Date().toISOString(), ...lastResults } : null;
            },

            stop() {
                stopRequested = true;
                return this.getStatus();
            },

            async run(options = {}) {
                if (running) {
                    throw new Error('Arena training already running');
                }

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
                    const data = await loadGameData();
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
                            team: opponentTeam,
                        },
                        config: {
                            heroPool,
                            petPool,
                            simulationsPerCombo,
                            maxCombinations: options.maxCombinations || CONSTANTS.DEFAULT_MAX_COMBOS,
                            includeCurrentTeam: options.includeCurrentTeam !== false,
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
            const opponents = await training.getOpponents();
            const lines = opponents.slice(0, 6).map((o, i) => `${i}: ${o.name} (#${o.place}, power ${o.power})`).join('<br>');
            const content = document.createElement('div');
            content.style.cssText = 'padding: 16px; color: #fce1ac; max-width: 640px; line-height: 1.5;';
            content.innerHTML = `
                <h3 style="margin-top:0;color:#ffd700;">Arena Training</h3>
                <p>Runs demo battles only — <b>no arena attempts consumed</b>.</p>
                <p><b>Opponents</b><br>${lines || 'No opponents loaded'}</p>
                <p>Default test: top 12 heroes, up to 40 combos, 10 sims each, opponent index 0.</p>
            `;

            const popupPromise = HWHFuncs.popup.confirm('', [
                { msg: 'Run training', result: 'run', color: 'green' },
                { msg: 'Close', result: false, isClose: true },
            ]);
            await new Promise((resolve) => setTimeout(resolve, 0));
            const popupBody = document.querySelector('.PopUp_Container');
            if (popupBody) {
                popupBody.innerHTML = '';
                popupBody.appendChild(content);
            }
            const choice = await popupPromise;
            if (choice === 'run') {
                training.run({ label: 'manual-ui', opponentIndex: 0 }).catch((err) => {
                    HWHFuncs.setProgress(`Arena Training failed: ${err.message}`, true);
                });
            }
        } catch (error) {
            HWHFuncs.setProgress(`Arena Training error: ${error.message}`, true);
        }
    }
})();
