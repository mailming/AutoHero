// ==UserScript==
// @name         Advanced Auto-Buyer HwH Ext
// @namespace    HeroWarsHelper.AdvancedAutoBuyer
// @version      1.10
// @description  Slot-ID auto-buyer for standard shops plus Clan Raid shopBuy (Mon–Wed, when available).
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

        // Helper function to find Secret Wealth Shop by pattern (ends with 0026)
        function findSecretWealthShop(shopsData) {
            for (const shopId in shopsData) {
                const shopIdNum = typeof shopId === 'string' ? parseInt(shopId) : shopId;
                if (!isNaN(shopIdNum) && shopIdNum.toString().endsWith('0026')) {
                    const shop = shopsData[shopId];
                    // Verify it's actually a Secret Wealth Shop by checking for consumable/starmoney costs
                    if (shop && shop.slots) {
                        for (const slotId in shop.slots) {
                            const slot = shop.slots[slotId];
                            if (slot.cost && (slot.cost.consumable || slot.cost.starmoney)) {
                                return { id: shopIdNum, shop: shop };
                            }
                        }
                    }
                }
            }
            return null;
        }

        // Helper function to get storage key for Secret Wealth Shop (consistent regardless of actual ID)
        function getSecretWealthStorageKey() {
            return STORAGE_PREFIX + 'SECRET_WEALTH';
        }

        function getShopStorageKey(shopId) {
            return shopId === 'SECRET_WEALTH' ? getSecretWealthStorageKey() : STORAGE_PREFIX + shopId;
        }

        function parseSlotIds(value) {
            return value.split(',')
                .map(s => s.trim())
                .filter(s => s && !isNaN(parseInt(s)))
                .map(s => parseInt(s));
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

        // --- UI LOGIC: one list of all shops, each with a slot-ID textbox ---
        // IMPORTANT: never wipe .PopUp_Container — that destroys HWH's shared popup
        // (msgText / buttons / .PopUp_custom) and breaks every later menu popup.
        // Inject into popup.custom only, then clearCustomBlock() after close.
        async function openSettingsPopup() {
            try {
                const popupContent = document.createElement('div');
                popupContent.style.cssText = 'display: flex; flex-direction: column; max-height: 70vh; color: #fce1ac; text-shadow: 0 0 2px black; min-width: 420px;';

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
                hint.textContent = 'Slot IDs per shop (e.g. 6, 3). Clan Raid buys Mon–Wed only, and only slots still available.';
                hint.style.cssText = 'color: #fce1ac; font-size: 12px; margin: 0 0 10px 0; opacity: 0.9;';

                const listContainer = document.createElement('div');
                listContainer.style.cssText = 'flex-grow: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;';

                const inputStyle = 'flex: 1; min-width: 160px; padding: 6px 8px; border: 1px solid #ce9767; background: #3a2e24; color: #fce1ac;';
                const labelStyle = 'width: 160px; flex-shrink: 0; color: #ffcc66;';

                SHOPS.forEach(shop => {
                    const storageKey = getShopStorageKey(shop.id);
                    const savedSlotIds = JSON.parse(localStorage.getItem(storageKey + '_slots') || '[]');

                    const row = document.createElement('div');
                    row.style.cssText = 'display: flex; align-items: center; gap: 10px;';

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
                        const savedAmount = parseInt(localStorage.getItem(storageKey + '_amount') || '9999');
                        const amountInput = document.createElement('input');
                        amountInput.type = 'number';
                        amountInput.min = '1';
                        amountInput.title = 'Bulk purchase amount';
                        amountInput.placeholder = 'qty';
                        amountInput.value = savedAmount;
                        amountInput.style.cssText = 'width: 72px; padding: 6px 8px; border: 1px solid #ce9767; background: #3a2e24; color: #fce1ac;';
                        amountInput.onchange = () => {
                            const amount = Math.max(1, parseInt(amountInput.value) || 9999);
                            amountInput.value = amount;
                            localStorage.setItem(storageKey + '_amount', String(amount));
                        };
                        amountInput.onblur = amountInput.onchange;
                        row.appendChild(amountInput);
                    }

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

        async function runAutoBuy() {
            console.log("--- Advanced Auto-Buyer RUNNING (v1.10 Clan Raid Mon–Wed) ---");
            HWHFuncs.setProgress("Auto-Buyer: Fetching data...");
            try {
                const caller = new Caller(['shopGetAll']);
                await caller.send();
                const shopsData = caller.result('shopGetAll');

                // Find Secret Wealth Shop dynamically by pattern
                const secretWealthShop = findSecretWealthShop(shopsData);
                if (secretWealthShop) {
                    console.log(`Secret Wealth Shop detected with ID: ${secretWealthShop.id}`);
                } else {
                    console.log("Secret Wealth Shop not found (no shop ID ending in 0026)");
                }

                const callsToMake = [];
                for (const shop of SHOPS) {
                    // Clan Raid uses clanRaid_shopBuy / clanRaid_getInfo, not shopGetAll
                    if (shop.id === 'CLAN_RAID') continue;

                    let shopId = shop.id;
                    let currentShopData = null;

                    // Handle Secret Wealth Shop dynamically
                    if (shopId === 'SECRET_WEALTH') {
                        if (!secretWealthShop) {
                            console.log(`Shop ${shop.name}: Not available (no shop ID ending in 0026 found)`);
                            continue;
                        }
                        shopId = secretWealthShop.id;
                        currentShopData = secretWealthShop.shop;
                    } else {
                        // Try both string and number format for shopId (API may return string IDs)
                        currentShopData = shopsData[shopId] || shopsData[String(shopId)] || shopsData[Number(shopId)];
                    }

                    if (!currentShopData || !currentShopData.slots) {
                        console.log(`Shop ${shop.name} (ID: ${shopId}): No shop data or slots found`);
                        continue;
                    }

                    const storageKey = getShopStorageKey(shop.id);
                    const fixedSlotIds = JSON.parse(localStorage.getItem(storageKey + '_slots') || '[]');

                    console.log(`Shop ${shop.name} (ID: ${shopId}): Found ${Object.keys(currentShopData.slots).length} slots, ${fixedSlotIds.length} fixed slots`);

                    if (fixedSlotIds.length === 0) {
                        continue;
                    }

                    for (const slot of Object.values(currentShopData.slots)) {
                        if (!slot) continue;

                        if (!fixedSlotIds.includes(Number(slot.id)) && !fixedSlotIds.includes(slot.id)) continue;

                        let itemDisplayName = `Slot ${slot.id}`;
                        try {
                            const rewardType = Object.keys(slot.reward)[0];
                            const rewardId = Object.keys(slot.reward[rewardType])[0];
                            const libTypeForTranslate = rewardType.replace('fragment', '').toUpperCase();
                            const translationKey = `LIB_${libTypeForTranslate}_NAME_${rewardId}`;
                            itemDisplayName = cheats.translate(translationKey) || itemDisplayName;
                        } catch (e) {
                            // Keep default slot ID if translation fails
                        }

                        // Use slot.cost if available, otherwise use empty object (API will handle validation)
                        const slotCost = slot.cost || {};
                        const currencyType = slotCost ? Object.keys(slotCost)[0] : null;

                        // Support gold/coin (standard shops), consumable/starmoney (Secret Wealth)
                        if (!slotCost || currencyType === 'gold' || currencyType === 'coin' || currencyType === 'consumable' || currencyType === 'starmoney') {
                            const normalizedCost = {};
                            if (slotCost) {
                                for (const costType in slotCost) {
                                    if (typeof slotCost[costType] === 'object' && slotCost[costType] !== null) {
                                        normalizedCost[costType] = {};
                                        for (const costKey in slotCost[costType]) {
                                            const costValue = slotCost[costType][costKey];
                                            normalizedCost[costType][costKey] = typeof costValue === 'string' && !isNaN(Number(costValue)) ? Number(costValue) : costValue;
                                        }
                                    } else {
                                        const costValue = slotCost[costType];
                                        normalizedCost[costType] = typeof costValue === 'string' && !isNaN(Number(costValue)) ? Number(costValue) : costValue;
                                    }
                                }
                            }

                            const shopBuyArgs = {
                                shopId: shopId,
                                slot: slot.id,
                                cost: normalizedCost,
                                reward: slot.reward || {}
                            };

                            // Titan Artifact Shop supports bulk amount
                            if (shopId === 13 && slot.staticShopMultiplePurchase === 1) {
                                const savedAmount = parseInt(localStorage.getItem(storageKey + '_amount') || '0');
                                shopBuyArgs.amount = savedAmount > 0 ? savedAmount : (slot.maxAmount || slot.maxPurchaseAmount || 9999);
                            }

                            callsToMake.push({
                                name: 'shopBuy',
                                args: shopBuyArgs,
                                itemInfo: `- ${itemDisplayName} (Slot ${slot.id}) from ${shop.name}`
                            });
                        }
                    }
                }

                // Clan Raid shop: only when clanRaid_getInfo returns an active shop
                await collectClanRaidBuys(callsToMake);

                // Process purchases one by one (1 API call per item)
                // This way, if one purchase fails, others can still succeed
                if (callsToMake.length > 0) {
                    HWHFuncs.setProgress(`Auto-Buyer: Attempting to buy ${callsToMake.length} item(s) (one at a time)...`);
                    const errors = [];
                    const successes = [];
                    
                    for (let i = 0; i < callsToMake.length; i++) {
                        const purchaseCall = callsToMake[i];
                        const itemInfo = purchaseCall.itemInfo || `Item ${i + 1}`;
                        
                        try {
                            HWHFuncs.setProgress(`Auto-Buyer: Purchasing item ${i + 1}/${callsToMake.length}...`);
                            
                            // Send individual API call for this purchase
                            const caller = new Caller([{ name: purchaseCall.name, args: purchaseCall.args }]);
                            await caller.send();
                            
                            // Check for errors first
                            const sideResults = caller.sideResults[purchaseCall.name] || [];
                            
                            // Check if there's an error in side results
                            if (sideResults && sideResults.length > 0 && sideResults[0] && sideResults[0].error) {
                                const error = sideResults[0].error;
                                const errorMsg = typeof error === 'string' ? error : (error.name || error.description || JSON.stringify(error));
                                errors.push(`${itemInfo}: ${errorMsg}`);
                                console.error(`%cPurchase Failed: ${itemInfo}`, 'color: red; font-weight: bold;', error);
                                continue;
                            }
                            
                            // Get result - caller.result() returns an array of response objects
                            // For shopBuy, the response is: [{"fragmentTitanArtifact":{"2005":5}}] or similar
                            const callResult = caller.result(purchaseCall.name);
                            
                            // Debug logging
                            console.log(`%cPurchase result for ${itemInfo}:`, 'color: blue;', {
                                callResult,
                                callResultType: typeof callResult,
                                callResultIsArray: Array.isArray(callResult),
                                callResultLength: callResult ? callResult.length : 0,
                                firstElement: callResult && callResult.length > 0 ? callResult[0] : null,
                                sideResults
                            });
                            
                            // Check if we have a valid result
                            // If callResult is an array with at least one element, and no error in sideResults, it's a success
                            // The response object can be empty {} or contain data - both mean success if no error
                            if (callResult && Array.isArray(callResult) && callResult.length > 0) {
                                // We got a response - check the first element
                                const responseObj = callResult[0];
                                // If responseObj is an object (even empty), it's a success
                                // If responseObj is null/undefined, might still be success if no error
                                if (responseObj !== null && responseObj !== undefined) {
                                    // Success - we got a response
                                    successes.push(itemInfo);
                                    console.log(`%cPurchase Success: ${itemInfo}`, 'color: lightgreen; font-weight: bold;', responseObj);
                                } else if (sideResults.length === 0 || !sideResults[0] || !sideResults[0].error) {
                                    // Response is null/undefined but no error - might still be success (API returned successfully)
                                    successes.push(itemInfo);
                                    console.log(`%cPurchase Success: ${itemInfo} (no response data but no error)`, 'color: lightgreen; font-weight: bold;');
                                } else {
                                    // Response is null/undefined and there's an error
                                    errors.push(`${itemInfo}: No response data`);
                                    console.error(`%cPurchase Failed: ${itemInfo}`, 'color: red; font-weight: bold;', 'No response data');
                                }
                            } else {
                                // No result array or empty array - check if there's an error
                                // If no error in sideResults, might still be success (unlikely but possible)
                                if (sideResults.length === 0 || !sideResults[0] || !sideResults[0].error) {
                                    // No error but no result - might be success
                                    successes.push(itemInfo);
                                    console.log(`%cPurchase Success: ${itemInfo} (no result array but no error)`, 'color: lightgreen; font-weight: bold;');
                                } else {
                                    // No result and there's an error
                                    console.warn(`%cPurchase result check failed for ${itemInfo}`, 'color: orange;', {
                                        callResult,
                                        callResultType: typeof callResult,
                                        callResultIsArray: Array.isArray(callResult),
                                        callResultLength: callResult ? callResult.length : 0,
                                        sideResults
                                    });
                                    errors.push(`${itemInfo}: No response received`);
                                    console.error(`%cPurchase Failed: ${itemInfo}`, 'color: red; font-weight: bold;', 'No response received');
                                }
                            }
                        } catch (callError) {
                            errors.push(`${itemInfo}: ${callError.message || 'Unknown error'}`);
                            console.error(`%cPurchase Failed: ${itemInfo}`, 'color: red; font-weight: bold;', callError);
                        }
                        
                        // Small delay between purchases to avoid rate limiting
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
                } else {
                    HWHFuncs.setProgress("Auto-Buyer: No items to buy.", true);
                }
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
            { name: 'Auto-Buy', title: 'Run the automatic buyer based on your settings', onClick: runAutoBuy, color: 'green' },
            { name: '⚙️', title: 'Open Auto-Buyer Settings', onClick: openSettingsPopup, color: 'green' }
        ]);
        console.log('Advanced Auto-Buyer: UI initialized and attached to HWH menu.');

        // --- AUTO-EXECUTE ON SCRIPT LOAD ---
        // Automatically run auto-buy when script loads (after menu is set up)
        // Use setTimeout to ensure menu initialization completes first
        setTimeout(() => {
            runAutoBuy().catch(error => {
                console.error('Advanced Auto-Buyer: Failed to auto-execute on load:', error);
            });
        }, 100);
    }
})();