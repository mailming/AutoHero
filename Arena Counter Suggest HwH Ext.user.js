// ==UserScript==
// @name         Arena Counter Suggest HwH Ext
// @namespace    HeroWarsHelper.ArenaCounterSuggest
// @version      1.1
// @description  Show DB-backed counter lineups beside Arena attack team gather; click to arenaAttack at account power
// @author       AutoHero
// @match        https://www.hero-wars.com/*
// @match        https://apps-1701433570146040.apps.fbsbx.com/*
// @grant        none
// @run-at       document-end
// @downloadURL https://github.com/mailming/AutoHero/raw/refs/heads/develop/Arena%20Counter%20Suggest%20HwH%20Ext.user.js
// @updateURL https://github.com/mailming/AutoHero/raw/refs/heads/develop/Arena%20Counter%20Suggest%20HwH%20Ext.user.js
// ==/UserScript==

(function() {
    'use strict';

    const EXTENSION_NAME = 'Arena Counter Suggest';
    const EXTENSION_VERSION = '1.1';
    const BRIDGE_URL = 'http://127.0.0.1:9876';
    const HOST_ID = 'ah-arena-counter-suggest-host';
    const POLL_MS = 600;
    const POPUP_CLASS = 'game.view.popup.team.ArenaAttackTeamGatherPopupWithEnemyTeam';
    const MEDIATOR_CLASS = 'game.mediator.gui.popup.arena.ArenaAttackTeamGatherPopupMediator';
    const POPUP_MANAGER_CLASS = 'game.mediator.gui.popup.GamePopupManager';
    const MIN_WIN_RATE = 50;
    const MAX_AGE_DAYS = 30;
    const PET_NAMES = {
        6000: 'Fenris', 6001: 'Oliver', 6002: 'Merlin', 6003: 'Mara', 6004: 'Cain',
        6005: 'Albus', 6006: 'Axel', 6007: 'Biscuit', 6008: 'Khorus', 6009: 'Vex',
        6011: 'Robin',
    };

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
        console.log(`${EXTENSION_NAME}: HWH UI is ready, initializing v${EXTENSION_VERSION}...`);

        const { HWHClasses, HWHFuncs, Send, cheats, lib } = window;
        const classCache = new Map();
        let popupManagerCache = null;
        let popupManagerCacheAt = 0;
        let dumpedMediatorOnce = false;
        let lastComboKey = null;
        let lastFetchAt = 0;
        let fetchInFlight = null;
        let panelState = {
            visible: false,
            status: 'idle',
            message: '',
            enemy: null,
            counters: null,
            attacking: false,
        };
        let panelController = null;
        let pollTimer = null;

        function buildComboKey(heroIds, pet, banner = 0) {
            const heroes = (Array.isArray(heroIds) ? heroIds : [])
                .map(Number)
                .filter((id) => id > 0 && id < 6000);
            return `${heroes.join(',')}|${Number(pet) || 0}|${Number(banner) || 0}`;
        }

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

        function getMediatorFromPopup(popup) {
            const exact = uniqueRefs(
                Object.values(popup ?? {}).filter((value) => value?.__class__?.j === MEDIATOR_CLASS)
            );
            if (exact[0]) return exact[0];

            const matches = uniqueRefs(
                Object.values(popup ?? {}).filter((value) => {
                    const className = value?.__class__?.j || '';
                    return /ArenaAttackTeamGatherPopupMediator/i.test(className);
                })
            );
            return matches[0] || null;
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

        function extractFromPlayerArenaEnemy(enemy) {
            if (!enemy || typeof enemy !== 'object') return null;

            let userId = Number(enemy._id);
            if (!Number.isFinite(userId) || userId <= 0) {
                const named = callSemantic(enemy, 'get_name');
                if (typeof named === 'string') {
                    userId = Number(String(named).split(/\s+/)[0]);
                }
            }
            if (!Number.isFinite(userId) || userId <= 0) {
                userId = Number(enemy.userId ?? enemy.id);
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
            return {
                userId,
                heroes,
                pet: pet || 0,
                banner: banner || 0,
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
            const fromEnemy = extractFromPlayerArenaEnemy(enemy);
            if (fromEnemy) return fromEnemy;

            // Fallback: some builds keep enemy user separately
            try {
                const enemyUser = callSemantic(mediator, 'get_enemyUser');
                const userId = Number(enemyUser?._id ?? enemyUser?.id ?? enemyUser?.userId);
                if (Number.isFinite(userId) && userId > 0 && enemy) {
                    const partial = extractFromPlayerArenaEnemy({ ...enemy, _id: userId });
                    if (partial) return partial;
                }
            } catch {
                // ignore
            }
            return null;
        }

        function dumpMediatorOnce(popup, mediator, extracted) {
            if (dumpedMediatorOnce) return;
            dumpedMediatorOnce = true;
            try {
                const enemy = callSemantic(mediator, 'get_enemy') || mediator?.fj || null;
                console.log(`[${EXTENSION_NAME}] Arena gather dump`, {
                    popupClass: popup?.__class__?.j,
                    mediatorClass: mediator?.__class__?.j,
                    extracted,
                    enemyClass: enemy?.__class__?.j || null,
                    enemyId: enemy?._id ?? null,
                    teamCount: Array.isArray(enemy?.ex) ? enemy.ex.length : null,
                    firstTeamHeroes: enemy?.ex?.[0] && typeof enemy.ex[0].O2b === 'function'
                        ? enemy.ex[0].O2b()
                        : null,
                });
            } catch (error) {
                console.warn(`[${EXTENSION_NAME}] dump failed:`, error);
            }
        }

        function readEnemyFromGather() {
            const popups = getOpenPopupsByClass(POPUP_CLASS);
            if (!popups.length) return null;
            const popup = popups[0];
            const mediator = getMediatorFromPopup(popup);
            const extracted = extractEnemyFromMediator(mediator);
            dumpMediatorOnce(popup, mediator || popup, extracted);

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
                // fall through
            }
            if (id >= 6000 && id < 7000) return PET_NAMES[id] || `Pet ${id}`;
            return `Hero ${id}`;
        }

        function formatLineupLabel(match) {
            const names = Array.isArray(match?.myHeroNames) && match.myHeroNames.length === 5
                ? match.myHeroNames
                : (match?.myHeroIds || []).map(heroName);
            const petId = Number(match?.myPet) || 0;
            const petLabel = petId ? (PET_NAMES[petId] || heroName(petId) || `Pet ${petId}`) : 'No pet';
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
                    .panel {
                        width: min(340px, 34vw);
                        max-height: min(420px, 70vh);
                        overflow: auto;
                        padding: 12px 12px 10px;
                        border: 2px solid rgba(223,190,104,.82);
                        border-radius: 8px;
                        color: #f6efd8;
                        font-family: Georgia, "Times New Roman", serif;
                        background:
                            radial-gradient(ellipse at 50% 0%, rgba(90,70,30,.35), transparent 55%),
                            linear-gradient(180deg, rgba(36,28,18,.98), rgba(16,12,8,.99));
                        box-shadow: 0 8px 24px rgba(0,0,0,.55), inset 0 0 0 1px rgba(255,235,174,.16);
                    }
                    .title {
                        margin: 0 0 8px;
                        font-size: 15px;
                        font-weight: 900;
                        letter-spacing: .04em;
                        text-align: center;
                        color: #ffe7a8;
                    }
                    .subtitle {
                        margin: 0 0 10px;
                        font-size: 11px;
                        opacity: .78;
                        text-align: center;
                    }
                    .section-title {
                        margin: 10px 0 6px;
                        font-size: 12px;
                        font-weight: 800;
                        color: #dfbe68;
                        text-transform: uppercase;
                        letter-spacing: .06em;
                    }
                    .status {
                        margin: 4px 0 8px;
                        font-size: 12px;
                        opacity: .9;
                        text-align: center;
                    }
                    .row {
                        display: block;
                        width: 100%;
                        margin: 0 0 8px;
                        padding: 8px 10px;
                        border: 1px solid rgba(223,190,104,.45);
                        border-radius: 6px;
                        background: rgba(255,255,255,.04);
                        color: inherit;
                        text-align: left;
                        cursor: pointer;
                        font: inherit;
                    }
                    .row:hover:not(:disabled) {
                        background: rgba(223,190,104,.16);
                        border-color: rgba(255,230,150,.85);
                    }
                    .row:disabled {
                        opacity: .55;
                        cursor: default;
                    }
                    .row-main {
                        font-size: 12px;
                        line-height: 1.35;
                        margin-bottom: 4px;
                    }
                    .row-meta {
                        display: flex;
                        justify-content: space-between;
                        gap: 8px;
                        font-size: 11px;
                        opacity: .85;
                    }
                    .empty {
                        font-size: 12px;
                        opacity: .7;
                        margin: 0 0 8px;
                    }
                    .note {
                        margin-top: 8px;
                        font-size: 10px;
                        opacity: .65;
                        text-align: center;
                    }
                </style>
                <div class="panel">
                    <div class="title">Counter Suggest</div>
                    <div class="subtitle" id="enemyLabel">Waiting for Arena attack…</div>
                    <div class="status" id="status"></div>
                    <div class="section-title">Win at my power</div>
                    <div id="atPower"></div>
                    <div class="section-title">Max beat</div>
                    <div id="maxBeat"></div>
                    <div class="note">Click a lineup to arenaAttack at your account power.</div>
                </div>
            `;
            document.documentElement.appendChild(host);

            const enemyLabel = shadow.getElementById('enemyLabel');
            const statusEl = shadow.getElementById('status');
            const atPowerEl = shadow.getElementById('atPower');
            const maxBeatEl = shadow.getElementById('maxBeat');

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

            function renderRow(match, source) {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'row';
                button.disabled = panelState.attacking;
                const label = formatLineupLabel(match);
                button.innerHTML = `
                    <div class="row-main">${label.names}</div>
                    <div class="row-meta">
                        <span>${label.petLabel}</span>
                        <span>${label.winRate}${source === 'max' ? ' (max)' : ''}</span>
                    </div>
                `;
                button.addEventListener('click', () => {
                    onSuggestClick(match, source).catch((error) => {
                        console.error(`[${EXTENSION_NAME}] attack failed:`, error);
                        panelState.status = 'error';
                        panelState.message = error?.message || String(error);
                        panelState.attacking = false;
                        render();
                    });
                });
                return button;
            }

            function render() {
                place();
                host.style.display = panelState.visible ? 'block' : 'none';
                if (!panelState.visible) return;

                const enemy = panelState.enemy;
                enemyLabel.textContent = enemy
                    ? `vs ${enemy.userId} · ${enemy.heroes.map(heroName).join(', ')}`
                    : 'Enemy lineup not readable yet';

                statusEl.textContent = panelState.message || (
                    panelState.status === 'loading' ? 'Checking database…'
                        : panelState.status === 'attacking' ? 'Attacking…'
                            : ''
                );

                atPowerEl.innerHTML = '';
                maxBeatEl.innerHTML = '';

                const atPower = panelState.counters?.atPower || [];
                if (!atPower.length) {
                    const empty = document.createElement('div');
                    empty.className = 'empty';
                    empty.textContent = panelState.status === 'bridge_error'
                        ? 'Bridge/DB unavailable'
                        : 'No at-power wins found';
                    atPowerEl.appendChild(empty);
                } else {
                    for (const match of atPower.slice(0, 2)) {
                        atPowerEl.appendChild(renderRow(match, 'power'));
                    }
                }

                const maxBeat = panelState.counters?.maxBeat || null;
                if (!maxBeat) {
                    const empty = document.createElement('div');
                    empty.className = 'empty';
                    empty.textContent = panelState.status === 'bridge_error'
                        ? 'Bridge/DB unavailable'
                        : 'No max-upgrade counter found';
                    maxBeatEl.appendChild(empty);
                } else {
                    maxBeatEl.appendChild(renderRow(maxBeat, 'max'));
                }
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
                    { name: 'userGetInfo', args: {}, ident: 'userGetInfo' },
                ],
            });
            const get = (ident) => response.results?.find((r) => r.ident === ident)?.result?.response || {};
            return {
                teams: get('teamGetAll'),
                favor: get('teamGetFavor'),
                userInfo: get('userGetInfo'),
            };
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

        function resolveBanner(userInfo) {
            if (userInfo?.banner != null) {
                return Array.isArray(userInfo.banner) ? Number(userInfo.banner[0]) || 1 : Number(userInfo.banner) || 1;
            }
            return 1;
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

        async function loadCountersForEnemy(enemy) {
            if (!enemy?.comboKey) return;
            const requestKey = enemy.comboKey;
            if (fetchInFlight && lastComboKey === requestKey) return fetchInFlight;

            lastComboKey = requestKey;
            lastFetchAt = Date.now();
            panelState.status = 'loading';
            panelState.message = 'Checking database…';
            panelController?.render();

            fetchInFlight = (async () => {
                try {
                    const { userId } = await resolveCurrentTesterUserId();
                    const counters = await fetchCounters(enemy.comboKey, userId);
                    if (lastComboKey !== requestKey) return;
                    panelState.counters = counters;
                    panelState.status = 'ready';
                    panelState.message = counters.opponentName
                        ? `DB: ${counters.opponentName}`
                        : (counters.reason === 'opponent_not_found' ? 'No training data for this defense' : '');
                } catch (error) {
                    if (lastComboKey !== requestKey) return;
                    console.warn(`[${EXTENSION_NAME}] counters fetch failed:`, error);
                    panelState.counters = { atPower: [], maxBeat: null };
                    panelState.status = 'bridge_error';
                    panelState.message = 'Bridge/DB unavailable';
                } finally {
                    fetchInFlight = null;
                    panelController?.render();
                }
            })();

            return fetchInFlight;
        }

        async function onSuggestClick(match, source) {
            if (panelState.attacking) return;
            const enemy = panelState.enemy;
            if (!enemy?.userId) throw new Error('Enemy userId missing');

            const heroes = (match?.myHeroIds || []).map(Number).filter((id) => id > 0 && id < 6000);
            const pet = Number(match?.myPet);
            if (heroes.length !== 5) throw new Error('Suggested lineup needs 5 heroes');
            if (!Number.isFinite(pet) || pet < 6000) throw new Error('Suggested lineup needs a pet');

            panelState.attacking = true;
            panelState.status = 'attacking';
            panelState.message = source === 'max'
                ? 'Attacking with max-beat lineup at your power…'
                : 'Attacking with at-power lineup…';
            panelController?.render();
            HWHFuncs.setProgress?.(`${EXTENSION_NAME}: attacking…`, true);

            const gather = readEnemyFromGather();
            closeGather(gather?.mediator);

            const support = await fetchTeamSupport();
            const arenaFavor = support.favor?.arena || {};
            const favor = pickFavor(heroes, arenaFavor);
            const banners = [resolveBanner(support.userInfo)];

            const args = {
                userId: Number(enemy.userId),
                heroes,
                pet,
                favor,
                banners,
            };

            console.log(`[${EXTENSION_NAME}] arenaAttack`, args, { source });
            const response = await Send({
                calls: [{
                    name: 'arenaAttack',
                    args,
                    context: { actionTs: Date.now() },
                    ident: 'body',
                }],
            });

            if (response?.error) {
                const name = response.error.name || 'Unknown';
                const desc = response.error.description || '';
                throw new Error(`arenaAttack failed: ${name}${desc ? ` - ${desc}` : ''}`);
            }

            const responseBody = response.results?.[0]?.result?.response
                || response.results?.[0]?.response
                || response.results?.[0]?.result
                || null;
            const win = responseBody?.win;
            const msg = win === true ? 'Victory' : win === false ? 'Defeat' : 'Attack sent';
            panelState.message = msg;
            panelState.status = 'done';
            panelState.attacking = false;
            panelState.visible = false;
            panelController?.render();
            HWHFuncs.setProgress?.(`${EXTENSION_NAME}: ${msg}`, false);
            console.log(`[${EXTENSION_NAME}] arenaAttack response:`, responseBody || response);
        }

        function tick() {
            if (panelState.attacking) return;
            const gather = readEnemyFromGather();
            if (!gather) {
                if (panelState.visible) {
                    panelState.visible = false;
                    panelState.enemy = null;
                    panelState.counters = null;
                    panelState.message = '';
                    panelState.status = 'idle';
                    lastComboKey = null;
                    panelController?.render();
                }
                return;
            }

            panelState.visible = true;
            if (!gather.enemy) {
                panelState.enemy = null;
                panelState.counters = null;
                panelState.status = 'error';
                panelState.message = 'Could not read enemy lineup from gather popup';
                panelController?.render();
                return;
            }

            panelState.enemy = gather.enemy;
            const needsFetch = gather.enemy.comboKey !== lastComboKey
                || (!panelState.counters && panelState.status !== 'loading');
            panelController?.render();
            if (needsFetch && Date.now() - lastFetchAt > 250) {
                loadCountersForEnemy(gather.enemy);
            }
        }

        panelController = createPanel();
        pollTimer = setInterval(tick, POLL_MS);
        window.addEventListener('resize', () => panelController?.place());

        const { ScriptMenu } = HWHClasses;
        const scriptMenu = ScriptMenu.getInst();
        scriptMenu.addCombinedButton([
            {
                name: 'Counters',
                title: 'Arena Counter Suggest — shows DB counters on Arena attack gather',
                onClick: () => {
                    const gather = readEnemyFromGather();
                    if (!gather?.enemy) {
                        HWHFuncs.setProgress?.(`${EXTENSION_NAME}: open Arena attack team gather first`, false);
                        return;
                    }
                    panelState.visible = true;
                    panelState.enemy = gather.enemy;
                    loadCountersForEnemy(gather.enemy);
                    panelController?.render();
                },
                color: 'purple',
            },
        ]);

        console.log(`${EXTENSION_NAME}: polling for ${POPUP_CLASS}`);
    }
})();
