// ==UserScript==
// @name         HeroWarsHelper - Auto Daily Extension
// @namespace    http://tampermonkey.net/
// @version      3.0.3
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
    const EXTENSION_VERSION = "3.0.3";
    const EXTENSION_AUTHOR = "You";

    // --- STATE VARIABLES ---
    let executionState = {};
    let hideButtonsState = {};
    let othersSettingsState = {};
    let isProviderActive = false;
    let customOthersButton = null;
    let combinedButton = null;

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
         // Get current quest state from API
         const questData = await Send({ calls: [{ name: "questGetAll", args: {}, ident: "body" }] });
         const quests = questData.results[0].result.response;
         
         // Filter quests that are completed and ready to collect (state == 2)
         // Only process regular daily quests (id < 1000000)
         // According to API docs: state 0 = not started, 1 = in progress, 2 = completed (ready to collect)
         // After collection, quest should be removed or state should change
         const questsToFarm = quests.filter(q => {
             // Only collect if quest exists, is a regular daily quest, and is completed (state == 2)
             return q && typeof q.id !== 'undefined' && q.id < 1000000 && q.state == 2;
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
    // NEWLY ADDED FUNCTION
async function executeGetDailyBonus() {
    const { Send, lib, HWHFuncs, I18N } = window;
    HWHFuncs.setProgress('Executing: Daily Bonus', true);
    try {
        // Chiediamo al server SIA le info sul bonus SIA quelle sull'utente, per essere sicuri
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
            if (+userInfo.vipPoints >= vipInfo[i].vipPoints) { // <-- ORA FUNZIONA
                currentVipLevel = vipInfo[i].level;
            }
        }
        const dailyBonusStat = lib.getData('dailyBonusStatic');
        const vipLevelDouble = dailyBonusStat[`${dailyBonusInfo.currentDay}_0_0`].vipLevelDouble;
        const collectVipBonus = dailyBonusInfo.availableVip && currentVipLevel >= vipLevelDouble;

        await Send({
            calls: [{ name: "dailyBonusFarm", args: { vip: collectVipBonus ? 1 : 0 }, ident: "body" }]
        });
        HWHFuncs.setProgress('Daily Bonus: Done!', true);
    } catch (e) {
        console.error("Error in executeGetDailyBonus", e);
        HWHFuncs.setProgress('Daily Bonus: Error!', true);
    }
}

    // --- DATA STRUCTURES ---
    const doAllTasks = [
        { id: 'getOutland', label: 'Outland', func: executeGetOutland }, { id: 'testTower', label: 'Tower', func: executeTestTower },
        { id: 'checkExpedition', label: 'Expeditions', func: executeCheckExpedition }, { id: 'offerFarmAllReward', label: 'Easter Eggs', func: executeOfferFarmAllReward },
        { id: 'questAllFarm', label: 'Rewards', func: executeQuestAllFarm }, { id: 'mailGetAll', label: 'Mail', func: executeMailGetAll },
        { id: 'rewardsAndMailFarm', label: 'Rewards & Mail', func: executeRewardsAndMailFarm }, { id: 'rollAscension', label: 'Seer', func: executeRollAscension },
         { id: 'getDailyBonus', label: 'Daily Bonus', func: executeGetDailyBonus }
    ];
    const upgradeTasks = [
        { id: '10001', label: 'Upgrade Skills' }, { id: '10018', label: 'Use EXP Potion' },
        { id: '10023', label: 'Gift of Elements (x2)' }, { id: '10024', label: 'Upgrade Artifact' },
        { id: '10028', label: 'Upgrade Titan Artifact' }, { id: '10030', label: 'Upgrade Skin' },
    ];
    const questTasks = [
        { id: '10003', label: 'Heroic Missions' }, { id: '10006', label: 'Exchange Emeralds' },
        { id: '10007', label: 'Soul Atrium' }, { id: '10016', label: 'Send Gifts' },
        { id: '10020', label: 'Outland Chests' }, { id: '10029', label: 'Titan Artifact Orbs' },
        { id: '10044', label: 'Summon Pets' }, { id: '10047', label: 'Guild Activity' }
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
                <button class="sync-button" id="sync-settings-btn" title="Save/Load Settings">💾</button>
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
                const actionHTML = isQuest ? `<div class="auto-daily-status-icon" data-task-id="${task.id}">⏳</div>` : `<button class="auto-daily-fire-btn" data-task-id="${task.id}">🔥</button>`;
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
                // This is a complex way to find the function, we'll simplify it later if needed.
                const allExecutableTasks = [ ...doAllTasks, ...othersTasks.map(ot => {
                    // Create a lookup for our own wrapper functions
                    const funcMap = { GET_ENERGY: executeFarmStamina, ITEM_EXCHANGE: executeFillActive, BUY_SOULS: executeBuyHeroFragments, BUY_FOR_GOLD: executeBuyInStoreForGold, BUY_OUTLAND: executeBossOpenChestPay, CLAN_STAT: executeClanStatistic, EPIC_BRAWL: executeEpicBrawl, ARTIFACTS_UPGRADE: executeUpdateArtifacts, SKINS_UPGRADE: executeUpdateSkins, SEASON_REWARD: executeFarmBattlePass, SELL_HERO_SOULS: executeSellHeroSoulsForGold };
                    return { id: ot.id, label: ot.label, func: funcMap[ot.id] };
                })];
                const taskDefinition = allExecutableTasks.find(t => t.id === task.id);
                if (taskDefinition) await executeSingleTask(taskDefinition);
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
                name: '🔄',
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
        const questManager = new HWHClasses.dailyQuests();
        await questManager.autoInit();
        [...questTasks, ...upgradeTasks].forEach(task => {
            const questData = questManager.questInfo['questGetAll'].find(q => q.id == task.id);
            const questUI = document.querySelector(`.auto-daily-status-icon[data-task-id="${task.id}"]`);
            if (!questUI) return;
            let iconHTML = `<span title="Not available">🌑</span>`;
            if (questData) {
                 if (questData.state >= 2) {
                    iconHTML = `<span title="Already done">✅</span>`;
                } else if (questManager.dataQuests[task.id] && questManager.dataQuests[task.id].isWeCanDo.call(questManager)) {
                    iconHTML = `<button class="auto-daily-fire-btn" data-task-id="${task.id}">🔥</button>`;
                }
            }
            questUI.innerHTML = iconHTML;
        });
    }
    async function executeSingleTask(task) {
        const { HWHFuncs, Send, HWHClasses } = window;
        HWHFuncs.setProgress(`Executing: ${task.label}`, true);
        try {
            if (task.func) {
                await task.func();
            } else {
                 const questManager = new HWHClasses.dailyQuests();
                 await questManager.autoInit();
                 
                 // Check if quest is already completed (state == 2 means completed and ready to collect)
                 const questData = questManager.questInfo['questGetAll'].find(q => q.id == task.id);
                 if (questData && questData.state == 2) {
                     // Quest is already completed - don't execute it again
                     HWHFuncs.setProgress(`${task.label} is already completed!`, true);
                     return;
                 }
                 
                 if (questManager.dataQuests[task.id] && questManager.dataQuests[task.id].isWeCanDo.call(questManager)) {
                     let calls = [];
                     if (task.id === '10023') {
                         const heroId = questManager.getHeroIdTitanGift();
                         calls = [
                             { name: 'heroTitanGiftLevelUp', args: { heroId }, ident: 'up_1' }, { name: 'heroTitanGiftDrop', args: { heroId }, ident: 'drop_1' },
                             { name: 'heroTitanGiftLevelUp', args: { heroId }, ident: 'up_2' }, { name: 'heroTitanGiftDrop', args: { heroId }, ident: 'drop_2' }
                         ];
                     } else {
                         calls = questManager.dataQuests[task.id].doItCall.call(questManager);
                     }
                     if(calls.length > 0) await Send({ calls });
                 } else {
                     HWHFuncs.setProgress(`${task.label} is not available!`, true);
                     return;
                 }
            }
            HWHFuncs.setProgress(`${task.label} finished!`, true);
        } catch (e) {
            console.error(`Error executing task ${task.id}:`, e);
            HWHFuncs.setProgress(`Error with ${task.label}!`, true);
        }
    }
    function scheduleAutoRuns() {
        const doAllChecked = doAllTasks.filter(task => executionState[task.id]);
        const questsAndUpgradeChecked = [...questTasks, ...upgradeTasks].filter(task => executionState[task.id]);
        if (doAllChecked.length === 0 && questsAndUpgradeChecked.length === 0) return;
        let doAllTotalDelay = 0;
        let initialDoAllDelay = 10000;
        doAllChecked.forEach((task, index) => {
            const delay = initialDoAllDelay + (index * 3000);
            setTimeout(() => executeSingleTask(task), delay);
            doAllTotalDelay = delay;
        });
        let initialQuestDelay = (doAllTotalDelay > 0 ? doAllTotalDelay : 7000) + 3000;
        questsAndUpgradeChecked.forEach((task, index) => {
            const delay = initialQuestDelay + (index * 3000);
            setTimeout(() => executeSingleTask(task), delay);
        });
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
        console.log(`${EXTENSION_NAME} v${EXTENSION_VERSION} is loading...`);
        HWHFuncs.addExtentionName(EXTENSION_NAME, EXTENSION_VERSION, EXTENSION_AUTHOR);

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