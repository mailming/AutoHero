// ==UserScript==
// @name         Advanced Auto-Buyer HwH Ext
// @namespace    HeroWarsHelper.AdvancedAutoBuyer
// @version      1.11
// @description  Slot-ID auto-buyer for standard shops, Secret Wealth (shopBuy …0026), and Clan Raid (Mon–Wed). Per-shop Run for testing.
// @author       YourName & Coding Partner
// @match        https://www.hero-wars.com/*
// @match        https://apps-1701433570146040.apps.fbsbx.com/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

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
        console.log('Advanced Auto-Buyer: HWH UI is ready, initializing extension...');

        const { HWHClasses, HWHFuncs, cheats, Caller, lib } = window;
        const STORAGE_PREFIX = 'advAutoBuyer_';
        const STANDARD_SHOP_IDS = new Set([1, 4, 5, 6, 8, 9, 10, 13, 17]);

        // --- DATA STRUCTURES & HELPERS ---
        const SHOPS = [
            { id: 1, name: 'Town Shop' },
            { id: 4, name: 'Arena Shop' },
            { id: 5, name: 'Grand Arena Shop' },
            { id: 6, name: 'Tower Shop' },
            { id: 8, name: 'Soul Shop' },
            { id: 9, name: 'Friendship Shop' },
            { id: 10, name: 'Outland Shop' },
            { id: 13, name: 'Titan Artifact Shop' },
            { id: 'SECRET_WEALTH', name: 'Secret Wealth Shop' },
            // Captured as clanRaid_shopBuy({ slotId }) from clanRaid_getInfo.shop
            { id: 'CLAN_RAID', name: 'Clan Raid Shop', buyApi: 'clanRaid_shopBuy' }
        ];

        function shopLooksLikeSecretWealth(shop) {
            if (!shop || !shop.slots) return false;
            for (const slot of Object.values(shop.slots)) {
                if (slot && slot.cost && (slot.cost.consumable || slot.cost.starmoney != null)) {
                    return true;
                }
            }
            return false;
        }

        /**
         * Secret Wealth shopId is dynamic (e.g. 2898000026 / 1576000026) — ends with 0026.
         * Matches captured shopBuy: { shopId, slot, cost: { consumable|starmoney }, reward }.
         */
        function findSecretWealthShop(shopsData) {
            if (!shopsData || typeof shopsData !== 'object') return null;

            // Prefer IDs ending in 0026 (real Secret Wealth instances)
            for (const shopId in shopsData) {
                if (!Object.prototype.hasOwnProperty.call(shopsData, shopId)) continue;
                const shopIdNum = typeof shopId === 'string' ? parseInt(shopId, 10) : shopId;
                if (isNaN(shopIdNum) || !String(shopIdNum).endsWith('0026')) continue;
                const shop = shopsData[shopId];
                if (shopLooksLikeSecretWealth(shop)) {
                    return { id: shopIdNum, shop };
                }
            }

            // Fallback: any non-standard shop priced in consumable / starmoney
            for (const shopId in shopsData) {
                if (!Object.prototype.hasOwnProperty.call(shopsData, shopId)) continue;
                const shopIdNum = typeof shopId === 'string' ? parseInt(shopId, 10) : shopId;
                if (STANDARD_SHOP_IDS.has(shopIdNum)) continue;
                const shop = shopsData[shopId];
                if (shopLooksLikeSecretWealth(shop)) {
                    return { id: shopIdNum, shop };
                }
            }
            return null;
        }

        function getSecretWealthStorageKey() {
            return STORAGE_PREFIX + 'SECRET_WEALTH';
        }

        function getShopStorageKey(shopId) {
            return shopId === 'SECRET_WEALTH' ? getSecretWealthStorageKey() : STORAGE_PREFIX + shopId;
        }

        function parseSlotIds(value) {
            return value.split(',')
                .map(s => s.trim())
                .filter(s => s && !isNaN(parseInt(s, 10)))
                .map(s => parseInt(s, 10));
        }

        /** Resolve slot number from object key and/or slot.id (Secret Wealth often keys only). */
        function resolveSlotId(slotKey, slot) {
            if (slot && slot.id != null && slot.id !== '' && !isNaN(Number(slot.id))) {
                return Number(slot.id);
            }
            const fromKey = Number(slotKey);
            return Number.isFinite(fromKey) ? fromKey : null;
        }

        /** Normalize cost/reward so numeric string amounts become numbers (API expects numbers). */
        function normalizeMoneyTree(value) {
            if (value == null || typeof value !== 'object') {
                if (typeof value === 'string' && value !== '' && !isNaN(Number(value))) return Number(value);
                return value;
            }
            const out = Array.isArray(value) ? [] : {};
            for (const key in value) {
                if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
                out[key] = normalizeMoneyTree(value[key]);
            }
            return out;
        }

        /**
         * Build shopBuy cost for Secret Wealth: prefer consumable when both exist
         * (matches capture ShopBuySecretShop — consumable 85 for slot 6).
         */
        function pickSecretWealthCost(slotCost) {
            if (!slotCost || typeof slotCost !== 'object') return {};
            if (slotCost.consumable) {
                return { consumable: normalizeMoneyTree(slotCost.consumable) };
            }
            if (slotCost.starmoney != null) {
                return { starmoney: normalizeMoneyTree(slotCost.starmoney) };
            }
            return normalizeMoneyTree(slotCost);
        }

        function isSupportedShopCost(slotCost) {
            if (!slotCost || typeof slotCost !== 'object') return false;
            const keys = Object.keys(slotCost);
            if (keys.length === 0) return false;
            return keys.some(k => k === 'gold' || k === 'coin' || k === 'consumable' || k === 'starmoney');
        }

        // --- Import/Export Functions ---
        function exportSettings() {
            const settingsToExport = {};
            SHOPS.forEach(shop => {
                const key = getShopStorageKey(shop.id);
                [key, key + '_slots', key + '_amount'].forEach(storageKey => {
                    const data = localStorage.getItem(storageKey);
                    if (data !== null) {
                        try {
                            settingsToExport[storageKey] = JSON.parse(data);
                        } catch (e) {
                            settingsToExport[storageKey] = data;
                        }
                    }
                });
            });

            if (Object.keys(settingsToExport).length === 0) {
                alert("No settings to export!");
                return;
            }

            const jsonString = JSON.stringify(settingsToExport, null, 2);
            const blob = new Blob([jsonString], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `hwh-autobuyer-settings-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

        function importSettings() {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = e => {
                const file = e.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = readerEvent => {
                    try {
                        const content = readerEvent.target.result;
                        const importedSettings = JSON.parse(content);
                        let settingsApplied = 0;

                        Object.keys(importedSettings).forEach(key => {
                            if (key.startsWith(STORAGE_PREFIX)) {
                                const value = importedSettings[key];
                                localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
                                settingsApplied++;
                            }
                        });

                        if (settingsApplied > 0) {
                            alert(`Import successful! ${settingsApplied} setting(s) loaded.\nPlease reopen the settings to see the changes.`);
                        } else {
                            alert("Import failed: The file does not contain valid settings.");
                        }
                    } catch (err) {
                        alert("Error reading or parsing the file. Make sure it's a valid JSON settings file.");
                        console.error("Import error:", err);
                    }
                };
                reader.readAsText(file);
            };
            input.click();
        }

        // --- UI LOGIC: one list of all shops, each with a slot-ID textbox + Run ---
        // IMPORTANT: never wipe .PopUp_Container — that destroys HWH's shared popup
        // (msgText / buttons / .PopUp_custom) and breaks every later menu popup.
        // Inject into popup.custom only, then clearCustomBlock() after close.
        async function openSettingsPopup() {
            try {
                const popupContent = document.createElement('div');
                popupContent.style.cssText = 'display: flex; flex-direction: column; max-height: 70vh; color: #fce1ac; text-shadow: 0 0 2px black; min-width: 480px;';

                const headerContainer = document.createElement('div');
                headerContainer.style.cssText = 'display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #ce9767; margin-bottom: 10px; padding-bottom: 8px;';

                const title = document.createElement('div');
                title.textContent = 'Auto-Buyer Slots';
                title.style.cssText = 'font-weight: bold; color: #ffcc66;';

                const buttonContainer = document.createElement('div');
                const btnStyle = 'padding: 4px 8px; border: 1px solid #ce9767; background: #3a2e24; color: #fce1ac; cursor: pointer; margin-left: 5px;';

                const importBtn = document.createElement('button');
                importBtn.textContent = 'Import';
                importBtn.style.cssText = btnStyle;
                importBtn.onclick = importSettings;

                const exportBtn = document.createElement('button');
                exportBtn.textContent = 'Export';
                exportBtn.style.cssText = btnStyle;
                exportBtn.onclick = exportSettings;

                buttonContainer.appendChild(importBtn);
                buttonContainer.appendChild(exportBtn);
                headerContainer.appendChild(title);
                headerContainer.appendChild(buttonContainer);

                const hint = document.createElement('p');
                hint.textContent = 'Slot IDs per shop (e.g. 6, 3). Use Run to test one shop. Clan Raid: Mon–Wed only, available slots.';
                hint.style.cssText = 'color: #fce1ac; font-size: 12px; margin: 0 0 10px 0; opacity: 0.9;';

                const listContainer = document.createElement('div');
                listContainer.style.cssText = 'flex-grow: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;';

                const inputStyle = 'flex: 1; min-width: 140px; padding: 6px 8px; border: 1px solid #ce9767; background: #3a2e24; color: #fce1ac;';
                const labelStyle = 'width: 150px; flex-shrink: 0; color: #ffcc66;';
                const runBtnStyle = 'flex-shrink: 0; padding: 6px 10px; border: 1px solid #4a7c3e; background: #3a5a2e; color: #aaffaa; cursor: pointer; font-weight: bold;';

                SHOPS.forEach(shop => {
                    const storageKey = getShopStorageKey(shop.id);
                    const savedSlotIds = JSON.parse(localStorage.getItem(storageKey + '_slots') || '[]');

                    const row = document.createElement('div');
                    row.style.cssText = 'display: flex; align-items: center; gap: 8px;';

                    const label = document.createElement('label');
                    label.textContent = shop.name;
                    label.style.cssText = labelStyle;

                    const slotInput = document.createElement('input');
                    slotInput.type = 'text';
                    slotInput.placeholder = 'slot IDs, e.g. 6, 3';
                    slotInput.value = savedSlotIds.join(', ');
                    slotInput.style.cssText = inputStyle;
                    slotInput.onchange = () => {
                        localStorage.setItem(storageKey + '_slots', JSON.stringify(parseSlotIds(slotInput.value)));
                    };
                    slotInput.onblur = slotInput.onchange;

                    row.appendChild(label);
                    row.appendChild(slotInput);

                    // Titan Artifact Shop: bulk amount next to slots
                    if (shop.id === 13) {
                        const savedAmount = parseInt(localStorage.getItem(storageKey + '_amount') || '9999', 10);
                        const amountInput = document.createElement('input');
                        amountInput.type = 'number';
                        amountInput.min = '1';
                        amountInput.title = 'Bulk purchase amount';
                        amountInput.placeholder = 'qty';
                        amountInput.value = savedAmount;
                        amountInput.style.cssText = 'width: 64px; padding: 6px 8px; border: 1px solid #ce9767; background: #3a2e24; color: #fce1ac;';
                        amountInput.onchange = () => {
                            const amount = Math.max(1, parseInt(amountInput.value, 10) || 9999);
                            amountInput.value = amount;
                            localStorage.setItem(storageKey + '_amount', String(amount));
                        };
                        amountInput.onblur = amountInput.onchange;
                        row.appendChild(amountInput);
                    }

                    const runBtn = document.createElement('button');
                    runBtn.textContent = 'Run';
                    runBtn.title = `Buy configured slots for ${shop.name} only`;
                    runBtn.style.cssText = runBtnStyle;
                    runBtn.onclick = async () => {
                        // Persist slots before running
                        localStorage.setItem(storageKey + '_slots', JSON.stringify(parseSlotIds(slotInput.value)));
                        runBtn.disabled = true;
                        const prev = runBtn.textContent;
                        runBtn.textContent = '...';
                        try {
                            await runAutoBuy(shop.id);
                        } finally {
                            runBtn.disabled = false;
                            runBtn.textContent = prev;
                        }
                    };
                    row.appendChild(runBtn);

                    listContainer.appendChild(row);
                });

                popupContent.appendChild(headerContainer);
                popupContent.appendChild(hint);
                popupContent.appendChild(listContainer);

                const popupPromise = HWHFuncs.popup.confirm('', [{ msg: 'Close', result: true, isClose: true }]);
                await new Promise(resolve => setTimeout(resolve, 0));

                const customBlock = HWHFuncs.popup.custom || document.querySelector('.PopUp_custom');
                if (customBlock) {
                    customBlock.innerHTML = '';
                    customBlock.appendChild(popupContent);
                } else {
                    console.error('Advanced Auto-Buyer: PopUp_custom not found; refusing to wipe PopUp_Container');
                    if (HWHFuncs.popup.hide) HWHFuncs.popup.hide();
                    return;
                }

                try {
                    await popupPromise;
                } finally {
                    if (HWHFuncs.popup.clearCustomBlock) {
                        HWHFuncs.popup.clearCustomBlock();
                    } else if (customBlock) {
                        customBlock.innerHTML = '';
                    }
                }
            } catch (error) {
                console.error('Advanced Auto-Buyer: Popup error:', error);
                HWHFuncs.setProgress(`Settings popup error: ${error.message}`, true);
                try {
                    if (HWHFuncs.popup.clearCustomBlock) HWHFuncs.popup.clearCustomBlock();
                    if (HWHFuncs.popup.hide) HWHFuncs.popup.hide();
                } catch (_) { /* ignore cleanup errors */ }
            }
        }

        // --- ACTION LOGIC ---
        /** Clan Raid shop is only open Mon–Wed (local time). getDay(): 0=Sun … 6=Sat. */
        function isClanRaidShopDay(date = new Date()) {
            const day = date.getDay();
            return day >= 1 && day <= 3; // Mon, Tue, Wed
        }

        /** True when a clanRaid_getInfo.shop entry can still be purchased. */
        function isClanRaidSlotAvailable(slot) {
            if (!slot || typeof slot !== 'object') return false;
            const boughtCount = Number(slot.boughtCount) || 0;
            const buyLimit = Number(slot.buyLimit);
            if (Number.isFinite(buyLimit)) {
                return boughtCount < buyLimit;
            }
            // No buyLimit: available only if not yet bought
            return boughtCount <= 0;
        }

        function clanRaidSlotRemaining(slot) {
            if (!isClanRaidSlotAvailable(slot)) return 0;
            const boughtCount = Number(slot.boughtCount) || 0;
            const buyLimit = Number(slot.buyLimit);
            if (Number.isFinite(buyLimit)) {
                return Math.max(0, buyLimit - boughtCount);
            }
            return 1;
        }

        /** Queue clanRaid_shopBuy only on Mon–Wed, and only for slots still available. */
        async function collectClanRaidBuys(callsToMake) {
            const shop = SHOPS.find(s => s.id === 'CLAN_RAID');
            if (!shop) return;

            if (!isClanRaidShopDay()) {
                console.log('Clan Raid Shop: Closed today (only Mon–Wed); skipping');
                return;
            }

            const storageKey = getShopStorageKey('CLAN_RAID');
            const fixedSlotIds = JSON.parse(localStorage.getItem(storageKey + '_slots') || '[]');
            if (fixedSlotIds.length === 0) {
                console.log('Clan Raid Shop: No slot IDs configured, skipping');
                return;
            }

            try {
                const caller = new Caller(['clanRaid_getInfo']);
                await caller.send();
                let info = caller.result('clanRaid_getInfo');
                if (Array.isArray(info)) info = info[0];

                const raidShop = info && info.shop;
                if (!raidShop || typeof raidShop !== 'object' || Object.keys(raidShop).length === 0) {
                    console.log('Clan Raid Shop: Not available (no shop on clanRaid_getInfo)');
                    return;
                }

                console.log(`Clan Raid Shop: Open with ${Object.keys(raidShop).length} slots, ${fixedSlotIds.length} configured`);

                for (const slotId of fixedSlotIds) {
                    const slot = raidShop[slotId] || raidShop[String(slotId)];
                    if (!slot) {
                        console.log(`Clan Raid Shop: Slot ${slotId} not in shop (unavailable)`);
                        continue;
                    }

                    if (!isClanRaidSlotAvailable(slot)) {
                        const boughtCount = Number(slot.boughtCount) || 0;
                        const buyLimit = Number(slot.buyLimit);
                        console.log(`Clan Raid Shop: Slot ${slotId} not available (${boughtCount}/${Number.isFinite(buyLimit) ? buyLimit : '?'})`);
                        continue;
                    }

                    const remaining = clanRaidSlotRemaining(slot);
                    const label = slot.buffId != null
                        ? `Buff ${slot.buffId}+${slot.buffValue ?? '?'}`
                        : `Slot ${slotId}`;

                    for (let n = 0; n < remaining; n++) {
                        callsToMake.push({
                            name: 'clanRaid_shopBuy',
                            args: { slotId: Number(slotId) },
                            itemInfo: `- ${label} (Slot ${slotId}) from ${shop.name}` + (remaining > 1 ? ` [${n + 1}/${remaining}]` : '')
                        });
                    }
                }
            } catch (error) {
                console.log('Clan Raid Shop: Not available or failed to load:', error.message || error);
            }
        }

        function collectStandardShopBuys(shopsData, shop, secretWealthShop, callsToMake) {
            let shopId = shop.id;
            let currentShopData = null;
            const isSecret = shopId === 'SECRET_WEALTH';

            if (isSecret) {
                if (!secretWealthShop) {
                    console.log(`Shop ${shop.name}: Not available (no Secret Wealth shop found)`);
                    return;
                }
                shopId = secretWealthShop.id;
                currentShopData = secretWealthShop.shop;
            } else {
                currentShopData = shopsData[shopId] || shopsData[String(shopId)] || shopsData[Number(shopId)];
            }

            if (!currentShopData || !currentShopData.slots) {
                console.log(`Shop ${shop.name} (ID: ${shopId}): No shop data or slots found`);
                return;
            }

            const storageKey = getShopStorageKey(shop.id);
            const fixedSlotIds = JSON.parse(localStorage.getItem(storageKey + '_slots') || '[]');
            const slotIdSet = new Set(fixedSlotIds.map(Number));

            console.log(`Shop ${shop.name} (ID: ${shopId}): Found ${Object.keys(currentShopData.slots).length} slots, ${fixedSlotIds.length} fixed slots`);

            if (fixedSlotIds.length === 0) {
                return;
            }

            for (const [slotKey, slot] of Object.entries(currentShopData.slots)) {
                if (!slot) continue;

                const slotId = resolveSlotId(slotKey, slot);
                if (slotId == null || !slotIdSet.has(Number(slotId))) continue;

                if (slot.bought === true) {
                    console.log(`Shop ${shop.name}: Slot ${slotId} already bought, skipping`);
                    continue;
                }

                let itemDisplayName = `Slot ${slotId}`;
                try {
                    const rewardType = Object.keys(slot.reward || {})[0];
                    const rewardId = rewardType != null ? Object.keys(slot.reward[rewardType])[0] : null;
                    if (rewardType != null && rewardId != null) {
                        const libTypeForTranslate = rewardType.replace('fragment', '').toUpperCase();
                        const translationKey = `LIB_${libTypeForTranslate}_NAME_${rewardId}`;
                        itemDisplayName = cheats.translate(translationKey) || itemDisplayName;
                    }
                } catch (e) {
                    // Keep default slot ID if translation fails
                }

                const slotCost = slot.cost || {};
                if (!isSupportedShopCost(slotCost)) {
                    console.log(`Shop ${shop.name}: Slot ${slotId} has unsupported cost, skipping`, slotCost);
                    continue;
                }

                const normalizedCost = isSecret
                    ? pickSecretWealthCost(slotCost)
                    : normalizeMoneyTree(slotCost);

                // Captured Secret Wealth shopBuy:
                // { shopId: 2898000026, slot: 6, cost: { consumable: { "85": 40000 } }, reward: { consumable: { "55": 80 } } }
                const shopBuyArgs = {
                    shopId: Number(shopId),
                    slot: Number(slotId),
                    cost: normalizedCost,
                    reward: normalizeMoneyTree(slot.reward || {})
                };

                // Titan Artifact Shop supports bulk amount
                if (Number(shopId) === 13 && slot.staticShopMultiplePurchase === 1) {
                    const savedAmount = parseInt(localStorage.getItem(storageKey + '_amount') || '0', 10);
                    shopBuyArgs.amount = savedAmount > 0 ? savedAmount : (slot.maxAmount || slot.maxPurchaseAmount || 9999);
                }

                console.log(`Queue shopBuy:`, shopBuyArgs);
                callsToMake.push({
                    name: 'shopBuy',
                    args: shopBuyArgs,
                    itemInfo: `- ${itemDisplayName} (Slot ${slotId}) from ${shop.name}`
                });
            }
        }

        async function executePurchases(callsToMake) {
            if (callsToMake.length === 0) {
                HWHFuncs.setProgress("Auto-Buyer: No items to buy.", true);
                return;
            }

            HWHFuncs.setProgress(`Auto-Buyer: Attempting to buy ${callsToMake.length} item(s) (one at a time)...`);
            const errors = [];
            const successes = [];

            for (let i = 0; i < callsToMake.length; i++) {
                const purchaseCall = callsToMake[i];
                const itemInfo = purchaseCall.itemInfo || `Item ${i + 1}`;

                try {
                    HWHFuncs.setProgress(`Auto-Buyer: Purchasing item ${i + 1}/${callsToMake.length}...`);

                    const caller = new Caller([{ name: purchaseCall.name, args: purchaseCall.args }]);
                    await caller.send();

                    const sideResults = caller.sideResults[purchaseCall.name] || [];

                    if (sideResults && sideResults.length > 0 && sideResults[0] && sideResults[0].error) {
                        const error = sideResults[0].error;
                        const errorMsg = typeof error === 'string' ? error : (error.name || error.description || JSON.stringify(error));
                        errors.push(`${itemInfo}: ${errorMsg}`);
                        console.error(`%cPurchase Failed: ${itemInfo}`, 'color: red; font-weight: bold;', error);
                        continue;
                    }

                    const callResult = caller.result(purchaseCall.name);

                    console.log(`%cPurchase result for ${itemInfo}:`, 'color: blue;', {
                        callResult,
                        args: purchaseCall.args,
                        sideResults
                    });

                    if (callResult && Array.isArray(callResult) && callResult.length > 0) {
                        const responseObj = callResult[0];
                        if (responseObj !== null && responseObj !== undefined) {
                            successes.push(itemInfo);
                            console.log(`%cPurchase Success: ${itemInfo}`, 'color: lightgreen; font-weight: bold;', responseObj);
                        } else if (sideResults.length === 0 || !sideResults[0] || !sideResults[0].error) {
                            successes.push(itemInfo);
                            console.log(`%cPurchase Success: ${itemInfo} (no response data but no error)`, 'color: lightgreen; font-weight: bold;');
                        } else {
                            errors.push(`${itemInfo}: No response data`);
                            console.error(`%cPurchase Failed: ${itemInfo}`, 'color: red; font-weight: bold;', 'No response data');
                        }
                    } else if (callResult && !Array.isArray(callResult)) {
                        // Single unwrapped response object
                        successes.push(itemInfo);
                        console.log(`%cPurchase Success: ${itemInfo}`, 'color: lightgreen; font-weight: bold;', callResult);
                    } else if (sideResults.length === 0 || !sideResults[0] || !sideResults[0].error) {
                        successes.push(itemInfo);
                        console.log(`%cPurchase Success: ${itemInfo} (no result array but no error)`, 'color: lightgreen; font-weight: bold;');
                    } else {
                        errors.push(`${itemInfo}: No response received`);
                        console.error(`%cPurchase Failed: ${itemInfo}`, 'color: red; font-weight: bold;', 'No response received');
                    }
                } catch (callError) {
                    errors.push(`${itemInfo}: ${callError.message || 'Unknown error'}`);
                    console.error(`%cPurchase Failed: ${itemInfo}`, 'color: red; font-weight: bold;', callError);
                }

                if (i < callsToMake.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }

            if (errors.length > 0) {
                console.error('%c--- Purchase Errors ---', 'color: red; font-weight: bold;');
                errors.forEach(error => console.error(`%c${error}`, 'color: red;'));
            }

            if (successes.length > 0) {
                console.log('%c--- Items Bought Successfully ---', 'color: lightgreen; font-weight: bold;');
                successes.forEach(success => console.log(`%c${success}`, 'color: lightgreen;'));
            }

            const summary = `Bought ${successes.length}/${callsToMake.length} items. ${errors.length > 0 ? `${errors.length} failed - check console.` : ''}`;
            HWHFuncs.setProgress(summary, true);
        }

        /**
         * @param {string|number|null} shopFilter - If set, only run that shop id (e.g. 'SECRET_WEALTH', 1, 'CLAN_RAID').
         */
        async function runAutoBuy(shopFilter = null) {
            const filterLabel = shopFilter == null ? 'all shops' : String(shopFilter);
            console.log(`--- Advanced Auto-Buyer RUNNING (v1.11, ${filterLabel}) ---`);
            HWHFuncs.setProgress(shopFilter == null
                ? "Auto-Buyer: Fetching data..."
                : `Auto-Buyer: Running ${filterLabel}...`);

            try {
                const shopsToRun = shopFilter == null
                    ? SHOPS
                    : SHOPS.filter(s => s.id === shopFilter || String(s.id) === String(shopFilter));

                if (shopsToRun.length === 0) {
                    HWHFuncs.setProgress(`Auto-Buyer: Unknown shop filter ${shopFilter}`, true);
                    return;
                }

                const needsShopGetAll = shopsToRun.some(s => s.id !== 'CLAN_RAID');
                let shopsData = null;
                let secretWealthShop = null;

                if (needsShopGetAll) {
                    const caller = new Caller(['shopGetAll']);
                    await caller.send();
                    shopsData = caller.result('shopGetAll');
                    if (Array.isArray(shopsData)) shopsData = shopsData[0];

                    secretWealthShop = findSecretWealthShop(shopsData);
                    if (secretWealthShop) {
                        console.log(`Secret Wealth Shop detected with ID: ${secretWealthShop.id}`);
                    } else {
                        console.log("Secret Wealth Shop not found (no …0026 / consumable-starmoney shop)");
                    }
                }

                const callsToMake = [];
                for (const shop of shopsToRun) {
                    if (shop.id === 'CLAN_RAID') {
                        await collectClanRaidBuys(callsToMake);
                        continue;
                    }
                    collectStandardShopBuys(shopsData, shop, secretWealthShop, callsToMake);
                }

                await executePurchases(callsToMake);
            } catch (error) {
                console.error("Auto-Buyer Error:", error);
                HWHFuncs.setProgress("Auto-Buyer Error: Check console.", true);
            }
            console.log("--- Advanced Auto-Buyer FINISHED ---");
        }

        // --- MENU INTEGRATION ---
        const { ScriptMenu } = HWHClasses;
        const scriptMenu = ScriptMenu.getInst();
        scriptMenu.addCombinedButton([
            { name: 'Auto-Buy', title: 'Run the automatic buyer based on your settings', onClick: () => runAutoBuy(null), color: 'green' },
            { name: '⚙️', title: 'Open Auto-Buyer Settings (per-shop Run buttons)', onClick: openSettingsPopup, color: 'green' }
        ]);
        console.log('Advanced Auto-Buyer: UI initialized and attached to HWH menu.');

        // --- AUTO-EXECUTE ON SCRIPT LOAD ---
        setTimeout(() => {
            runAutoBuy(null).catch(error => {
                console.error('Advanced Auto-Buyer: Failed to auto-execute on load:', error);
            });
        }, 100);
    }
})();
