// ==UserScript==
// @name         Arena Counter Suggest HwH Ext
// @namespace    HeroWarsHelper.ArenaCounterSuggest
// @version      1.3.9
// @description  DB counter panel for Arena gather and Clan Domination attack target; arenaAttack / setDefence+startBattle / SimLab / Train
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
    const EXTENSION_VERSION = '1.3.9';
    const COUNTER_LIST_LIMIT = 3;
    const PLAYER_CLASS = 'game.model.user.Player';
    const PLAYER_BANNER_DATA_CLASS = 'game.model.user.banner.PlayerBannerData';
    const PLAYER_BANNER_ENTRY_CLASS = 'game.model.user.banner.PlayerBannerEntry';
    const INT_MAP_CLASS = 'haxe.ds.IntMap';
    const BANNER_STONE_DESC_CLASS = 'game.data.storage.resource.BannerStoneDescription';
    const SIMLAB_SIMULATIONS = 10;
    const BRIDGE_URL = 'http://127.0.0.1:9876';
    const HOST_ID = 'ah-arena-counter-suggest-host';
    const POLL_MS = 600;
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
        // Re-inject / Tampermonkey upgrade: tear down previous instance.
        try {
            if (typeof window.__ahCounterSuggestTeardown === 'function') {
                window.__ahCounterSuggestTeardown();
            }
        } catch (error) {
            console.warn(`[${EXTENSION_NAME}] teardown failed:`, error);
        }
        document.getElementById('ah-arena-counter-suggest-host')?.remove();

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
            mode: 'arena',
            enemy: null,
            counters: null,
            selected: null, // { match, source, key }
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
            const heroes = (match?.myHeroIds || []).map(Number).join(',');
            const pet = Number(match?.myPet) || 0;
            return `${source || 'power'}:${heroes}|${pet}`;
        }

        function selectMatch(match, source) {
            if (!match) return;
            panelState.selected = {
                match,
                source: source || 'power',
                key: selectionKey(match, source),
            };
            panelController?.render();
        }

        function clearSelection() {
            panelState.selected = null;
        }
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

        function rememberClanDominationEnemy(levelId, enemy, raw = null) {
            if (!enemy || levelId == null) return;
            const key = String(levelId);
            clanDominationEnemyCache.set(key, { at: Date.now(), enemy, raw });
            lastObservedCdEnemy = { levelId: Number(levelId), enemy, at: Date.now() };
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
            rememberClanDominationEnemy(numericLevelId, enemy, entry);
            console.log(`[${EXTENSION_NAME}] observed Clan Domination enemy`, {
                levelId: numericLevelId,
                userId: enemy.userId,
                power: enemy.power,
                comboKey: enemy.comboKey,
            });
            if (!isBusy() && isClanDominationMapOpen()) {
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
            const bannerStones = extractBannerStonesFromBattleTeam(team);
            return {
                userId,
                heroes,
                pet: pet || 0,
                banner: banner || 0,
                bannerStones,
                favor: {},
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
            if (!popups.length) {
                const observed = getObservedClanDominationEnemy();
                if (observed && isClanDominationMapOpen()) {
                    return {
                        popup: null,
                        mediator: null,
                        levelId: observed.levelId,
                        enemy: observed.enemy,
                        source: 'observed',
                    };
                }
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
                    .list {
                        display: flex;
                        flex-direction: column;
                        gap: 6px;
                    }
                    .row-wrap {
                        display: grid;
                        grid-template-columns: 1fr 52px;
                        align-items: stretch;
                        min-height: 56px;
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
                    .row {
                        display: flex;
                        flex-direction: column;
                        justify-content: center;
                        gap: 4px;
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
                    .row-meta {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        gap: 8px;
                        font-size: 11px;
                        color: var(--muted);
                    }
                    .row-rate {
                        flex: 0 0 auto;
                        font-weight: 700;
                        color: #c8f0c0;
                        letter-spacing: .02em;
                    }
                    .row-wrap.selected .row-rate { color: #e8ffd8; }
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
                        writing-mode: horizontal-tb;
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
                    .attack-hint {
                        margin: 0;
                        min-height: 14px;
                        font-size: 10px;
                        line-height: 1.35;
                        color: var(--muted);
                        text-align: center;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                    }
                    .attack-hint:empty { display: none; }
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
                    <div class="section">
                        <div class="section-title">Win at my power</div>
                        <div class="list" id="atPower"></div>
                    </div>
                    <div class="section">
                        <div class="section-title">Max beat</div>
                        <div class="list" id="maxBeat"></div>
                    </div>
                    <div class="footer" id="attackBar">
                        <p class="attack-hint" id="attackHint">Select a lineup, then Attack</p>
                        <div class="footer-actions" id="trainBox">
                            <button type="button" class="attack-btn" id="attackBtn" disabled>Attack</button>
                            <button type="button" class="train-btn" id="trainBtn" title="Run Arena Training on this defense (demo battles)">Train</button>
                        </div>
                        <p class="train-hint" id="trainHint"></p>
                        <div class="note" id="panelNote">Select · Attack · SimLab / Train</div>
                    </div>
                </div>
            `;
            document.documentElement.appendChild(host);

            const panelTitle = shadow.getElementById('panelTitle');
            const enemyLabel = shadow.getElementById('enemyLabel');
            const statusEl = shadow.getElementById('status');
            const atPowerEl = shadow.getElementById('atPower');
            const maxBeatEl = shadow.getElementById('maxBeat');
            const attackBar = shadow.getElementById('attackBar');
            const attackHint = shadow.getElementById('attackHint');
            const attackBtn = shadow.getElementById('attackBtn');
            const trainBox = shadow.getElementById('trainBox');
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

            function renderRow(match, source) {
                const wrap = document.createElement('div');
                const key = selectionKey(match, source);
                const isSelected = panelState.selected?.key === key;
                wrap.className = isSelected ? 'row-wrap selected' : 'row-wrap';

                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'row';
                button.disabled = isBusy();
                button.title = 'Click to select this lineup';
                const label = formatLineupLabel(match);
                const rateSuffix = source === 'max' ? ' max' : '';
                button.innerHTML = `
                    <div class="row-main">${label.names}</div>
                    <div class="row-meta">
                        <span>${label.petLabel}</span>
                        <span class="row-rate">${label.winRate}${rateSuffix}</span>
                    </div>
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

            function render() {
                place();
                host.style.display = panelState.visible ? 'block' : 'none';
                if (!panelState.visible) return;

                const enemy = panelState.enemy;
                const isCd = panelState.mode === 'clanDomination' || enemy?.mode === 'clanDomination';
                panelTitle.textContent = isCd ? 'Counter · Domination' : 'Counter Suggest';
                panelNote.textContent = isCd
                    ? 'Select · Attack · Sim / Train'
                    : 'Select · Attack · Sim / Train';
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

                const atPower = normalizeCounterList(panelState.counters?.atPower);
                const maxBeat = normalizeCounterList(panelState.counters?.maxBeat);

                // Resolve selection before painting rows so highlight is correct.
                const listed = [
                    ...atPower.slice(0, COUNTER_LIST_LIMIT).map((m) => selectionKey(m, 'power')),
                    ...maxBeat.slice(0, COUNTER_LIST_LIMIT).map((m) => selectionKey(m, 'max')),
                ];
                if (panelState.selected && !listed.includes(panelState.selected.key)) {
                    clearSelection();
                }
                if (!panelState.selected) {
                    const autoMatch = atPower[0] || maxBeat[0] || null;
                    const autoSource = atPower[0] ? 'power' : (maxBeat[0] ? 'max' : null);
                    if (autoMatch && autoSource) {
                        panelState.selected = {
                            match: autoMatch,
                            source: autoSource,
                            key: selectionKey(autoMatch, autoSource),
                        };
                    }
                }

                atPowerEl.innerHTML = '';
                maxBeatEl.innerHTML = '';
                if (!atPower.length) {
                    const empty = document.createElement('div');
                    empty.className = 'empty';
                    empty.textContent = panelState.status === 'bridge_error'
                        ? 'Bridge/DB unavailable'
                        : 'No at-power wins found';
                    atPowerEl.appendChild(empty);
                } else {
                    for (const match of atPower.slice(0, COUNTER_LIST_LIMIT)) {
                        atPowerEl.appendChild(renderRow(match, 'power'));
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
                    const label = formatLineupLabel(selected.match);
                    const shortNames = String(label.names || '').split(' · ').slice(0, 3).join(' · ');
                    const more = String(label.names || '').split(' · ').length > 3 ? '…' : '';
                    attackHint.textContent = `${selected.source === 'max' ? 'Max' : 'Power'} · ${shortNames}${more} · ${label.petLabel}`;
                    attackBtn.textContent = panelState.attacking ? 'Attacking…' : 'Attack';
                } else {
                    attackHint.textContent = 'Select a lineup, then Attack';
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
                    { name: 'userGetInfo', args: {}, ident: 'userGetInfo' },
                ],
            });
            const get = (ident) => response.results?.find((r) => r.ident === ident)?.result?.response || {};
            return {
                teams: get('teamGetAll'),
                favor: get('teamGetFavor'),
                teamBanners: get('team_getBanners'),
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

        async function fetchEnemyDefenceExtras(enemyUserId) {
            const empty = { favor: {}, bannerStones: {}, banner: null, name: null, place: null, power: null };
            if (enemyUserId == null) return empty;
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
                if (!entry) return empty;

                const bannerEntry = Array.isArray(entry.banners) ? entry.banners[0] : null;
                const banner = bannerEntry?.id != null
                    ? Number(bannerEntry.id)
                    : (entry.banner != null ? Number(entry.banner) : null);
                return {
                    favor: entry.favor && typeof entry.favor === 'object' ? entry.favor : {},
                    bannerStones: normalizeBannerStones(bannerEntry?.slots || entry.bannerStones),
                    banner: Number.isFinite(banner) && banner > 0 ? banner : null,
                    name: entry.user?.name || entry.name || null,
                    place: entry.place ?? null,
                    power: entry.power ?? null,
                };
            } catch (error) {
                console.warn(`[${EXTENSION_NAME}] arenaFindEnemies for SimLab failed:`, error);
                return empty;
            }
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
                    panelState.counters = { atPower: [], maxBeat: [] };
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
                    const status = window.ArenaTraining?.getStatus?.();
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
            let favor = enemy.favor && typeof enemy.favor === 'object' ? { ...enemy.favor } : {};
            let banner = Number(enemy.banner) || 1;
            let bannerStones = hasBannerStones(enemy.bannerStones)
                ? normalizeBannerStones(enemy.bannerStones)
                : {};
            let name = enemy.name || null;
            let place = enemy.place ?? null;
            let power = enemy.power ?? null;
            const isCd = enemy.mode === 'clanDomination' || panelState.mode === 'clanDomination';

            if (!isCd) {
                const extras = await fetchEnemyDefenceExtras(enemy.userId);
                if (extras.favor && Object.keys(extras.favor).length) favor = extras.favor;
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

            const training = window.ArenaTraining;
            if (typeof training?.run !== 'function') {
                throw new Error('Arena Training not loaded — enable Arena Training HwH Ext to train');
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

        async function onSimLabClick(match, source) {
            if (isBusy()) return;
            const enemy = panelState.enemy;
            if (!enemy?.userId) throw new Error('Enemy userId missing');

            const training = window.ArenaTraining;
            if (typeof training?.simulateMatchup !== 'function') {
                throw new Error('Arena Training not loaded — enable Arena Training HwH Ext for SimLab');
            }

            const heroes = (match?.myHeroIds || []).map(Number).filter((id) => id > 0 && id < 6000);
            const pet = Number(match?.myPet);
            if (heroes.length !== 5) throw new Error('Suggested lineup needs 5 heroes');
            if (!Number.isFinite(pet) || pet < 6000) throw new Error('Suggested lineup needs a pet');

            panelState.simming = true;
            panelState.status = 'simming';
            panelState.message = source === 'max'
                ? 'SimLab: max-beat lineup at your power…'
                : 'SimLab: at-power lineup…';
            panelController?.render();
            HWHFuncs.setProgress?.(`${EXTENSION_NAME}: SimLab…`, true);

            try {
                const support = await fetchTeamSupport();
                const isCd = enemy.mode === 'clanDomination' || panelState.mode === 'clanDomination';
                const arenaFavor = support.favor?.arena || {};
                const favor = pickFavor(heroes, arenaFavor);
                const banner = resolveBanner(
                    support.userInfo,
                    support.teamBanners,
                    isCd ? 'clanDomination' : 'arena'
                );
                const bannerStones = resolveAttackBannerStones(support.userInfo, banner);

                let defenceFavor = enemy.favor && typeof enemy.favor === 'object' ? enemy.favor : {};
                let defenceBanner = enemy.banner || 1;
                let defenceBannerStones = hasBannerStones(enemy.bannerStones)
                    ? normalizeBannerStones(enemy.bannerStones)
                    : {};
                let defenceName = null;
                let defencePlace = null;
                let defencePower = enemy.power ?? null;
                if (!isCd) {
                    const defenceExtras = await fetchEnemyDefenceExtras(enemy.userId);
                    if (defenceExtras.favor && typeof defenceExtras.favor === 'object'
                        && Object.keys(defenceExtras.favor).length > 0) {
                        defenceFavor = defenceExtras.favor;
                    }
                    if (defenceExtras.banner) defenceBanner = defenceExtras.banner;
                    if (hasBannerStones(defenceExtras.bannerStones)) {
                        defenceBannerStones = normalizeBannerStones(defenceExtras.bannerStones);
                    }
                    defenceName = defenceExtras.name;
                    defencePlace = defenceExtras.place;
                    defencePower = defenceExtras.power ?? defencePower;
                }

                if (!hasBannerStones(bannerStones)) {
                    console.warn(`[${EXTENSION_NAME}] SimLab attack bannerStones empty for banner ${banner}`);
                }
                if (!hasBannerStones(defenceBannerStones)) {
                    console.warn(`[${EXTENSION_NAME}] SimLab defence bannerStones empty for enemy ${enemy.userId}`);
                }

                const summary = await training.simulateMatchup({
                    label: isCd ? 'simlab-counter-cd' : 'simlab-counter',
                    maxUpgrade: false,
                    simulationsPerCombo: SIMLAB_SIMULATIONS,
                    saveToBridge: true,
                    myTeam: {
                        heroes,
                        pet,
                        banner,
                        favor,
                        bannerStones,
                        heroNames: match?.myHeroNames,
                    },
                    opponentTeam: {
                        userId: enemy.userId,
                        name: defenceName,
                        heroes: enemy.heroes,
                        pet: enemy.pet,
                        banner: defenceBanner,
                        favor: defenceFavor,
                        bannerStones: defenceBannerStones,
                        place: defencePlace,
                        power: defencePower,
                        source: isCd ? 'simlab-clanDomination' : 'simlab-gather',
                    },
                });

                const wr = Number(summary?.winRate) || 0;
                const msg = `SimLab ${summary.wins}W/${summary.losses}L (${wr.toFixed(0)}%)`;
                panelState.message = msg;
                panelState.status = 'ready';
                HWHFuncs.setProgress?.(`${EXTENSION_NAME}: ${msg}`, false);
                console.log(`[${EXTENSION_NAME}] SimLab result:`, summary);
            } finally {
                panelState.simming = false;
                panelController?.render();
            }
        }

        async function onSuggestClick(match, source) {
            if (isBusy()) return;
            const enemy = panelState.enemy;
            if (!enemy?.userId) throw new Error('Enemy userId missing');

            const heroes = (match?.myHeroIds || []).map(Number).filter((id) => id > 0 && id < 6000);
            const pet = Number(match?.myPet);
            if (heroes.length !== 5) throw new Error('Suggested lineup needs 5 heroes');
            if (!Number.isFinite(pet) || pet < 6000) throw new Error('Suggested lineup needs a pet');

            const isCd = enemy.mode === 'clanDomination' || panelState.mode === 'clanDomination';
            panelState.attacking = true;
            panelState.status = 'attacking';
            panelState.message = isCd
                ? (source === 'max' ? 'Clan Domination: setting max-beat team…' : 'Clan Domination: setting at-power team…')
                : (source === 'max' ? 'Attacking with max-beat lineup at your power…' : 'Attacking with at-power lineup…');
            panelController?.render();
            HWHFuncs.setProgress?.(`${EXTENSION_NAME}: attacking…`, true);

            try {
                const support = await fetchTeamSupport();
                const arenaFavor = support.favor?.arena || {};
                const favor = pickFavor(heroes, arenaFavor);
                const banner = resolveBanner(
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

                const gather = readEnemyFromGather();
                closeGather(gather?.mediator);

                const args = {
                    userId: Number(enemy.userId),
                    heroes,
                    pet,
                    favor,
                    banners: [banner],
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
            } catch (error) {
                panelState.attacking = false;
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

        function tick() {
            if (isBusy()) return;

            const gather = readEnemyFromGather();
            if (gather) {
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
                hidePanel();
                return;
            }

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

            // Map is open but no attack target selected yet — keep panel hidden.
            if (panelState.mode === 'clanDomination') {
                hidePanel();
            } else {
                hidePanel();
            }
        }

        installClanDominationEnemyObserver();
        panelController = createPanel();
        pollTimer = setInterval(tick, POLL_MS);
        const onResize = () => panelController?.place();
        window.addEventListener('resize', onResize);

        window.__ahCounterSuggestTeardown = () => {
            try {
                if (pollTimer) clearInterval(pollTimer);
                pollTimer = null;
                stopTrainStatusPolling();
                window.removeEventListener('resize', onResize);
                document.getElementById('ah-arena-counter-suggest-host')?.remove();
                if (typeof window.__ahCounterSuggestCdRestore === 'function') {
                    window.__ahCounterSuggestCdRestore();
                }
            } catch (error) {
                console.warn(`[${EXTENSION_NAME}] instance teardown error:`, error);
            }
            delete window.__ahCounterSuggestTeardown;
        };

        const { ScriptMenu } = HWHClasses;
        const scriptMenu = ScriptMenu.getInst();
        scriptMenu.addCombinedButton([
            {
                name: 'Counters',
                title: 'Counter Suggest — Arena gather or Clan Domination attack target',
                onClick: () => {
                    const gather = readEnemyFromGather();
                    if (gather?.enemy) {
                        showEnemyPanel({ ...gather.enemy, mode: 'arena' }, 'arena');
                        return;
                    }
                    const cdTarget = readClanDominationTarget();
                    if (cdTarget?.levelId) {
                        panelState.mode = 'clanDomination';
                        panelState.visible = true;
                        panelState.message = `Loading Domination enemy @${cdTarget.levelId}…`;
                        panelController?.render();
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
                },
                color: 'purple',
            },
        ]);

        console.log(`${EXTENSION_NAME}: polling for ${POPUP_CLASS}, ${CD_ATTACK_POPUP_CLASS}, and ${CD_MAP_POPUP_CLASS} (observe getEnemyTeams)`);
    }
})();
