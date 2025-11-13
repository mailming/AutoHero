// ==UserScript==
// @name         Advanced Auto-Buyer HwH Ext
// @namespace    HeroWarsHelper.AdvancedAutoBuyer
// @version      1.6
// @description  Multi-column UI with Import/Export. Buys items based on names.
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

        const { HWHClasses, HWHFuncs, Send, cheats, Caller, lib } = window;
        const STORAGE_PREFIX = 'advAutoBuyer_';

        // --- DATA STRUCTURES & HELPERS ---
        const SHOPS = [ { id: 1, name: 'Town Shop' }, { id: 4, name: 'Arena Shop' }, { id: 5, name: 'Grand Arena Shop' }, { id: 6, name: 'Tower Shop' }, { id: 8, name: 'Soul Shop' }, { id: 9, name: 'Friendship Shop' }, { id: 10, name: 'Outland Shop' }, { id: 13, name: 'Titan Artifact Shop' }, { id: 'SECRET_WEALTH', name: 'Secret Wealth Shop' } ];
        const ITEMS_DATABASE = window.AUTO_BUYER_ITEM_DATABASE || {};
        
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

        // --- NEW: Import/Export Functions ---
        function exportSettings() {
            const settingsToExport = {};
            SHOPS.forEach(shop => {
                const key = shop.id === 'SECRET_WEALTH' ? getSecretWealthStorageKey() : STORAGE_PREFIX + shop.id;
                const data = localStorage.getItem(key);
                if (data) {
                    settingsToExport[key] = JSON.parse(data);
                }
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
                                localStorage.setItem(key, JSON.stringify(importedSettings[key]));
                                settingsApplied++;
                            }
                        });

                        if (settingsApplied > 0) {
                            alert(`Import successful! ${settingsApplied} shop lists were loaded.\nPlease reopen the settings to see the changes.`);
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

        // --- UI LOGIC (Heavily modified for multi-column) ---
        async function openSettingsPopup() {
            try {
                const popupContent = document.createElement('div');
                popupContent.style.cssText = 'display: flex; flex-direction: column; height: 60vh; color: #fce1ac; text-shadow: 0 0 2px black;';

                const headerContainer = document.createElement('div');
                headerContainer.style.cssText = 'display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #ce9767; margin-bottom: 10px;';

                const tabContainer = document.createElement('div');
                tabContainer.style.cssText = 'display: flex; flex-wrap: wrap;';

                // --- NEW: Import/Export Button Container ---
                const buttonContainer = document.createElement('div');
                const exportBtn = document.createElement('button');
                exportBtn.textContent = 'Export';
                exportBtn.style.cssText = 'padding: 4px 8px; border: 1px solid #ce9767; background: #3a2e24; color: #fce1ac; cursor: pointer; margin-left: 5px;';
                exportBtn.onclick = exportSettings;

                const importBtn = document.createElement('button');
                importBtn.textContent = 'Import';
                importBtn.style.cssText = 'padding: 4px 8px; border: 1px solid #ce9767; background: #3a2e24; color: #fce1ac; cursor: pointer; margin-left: 5px;';
                importBtn.onclick = importSettings;

                buttonContainer.appendChild(importBtn);
                buttonContainer.appendChild(exportBtn);
                headerContainer.appendChild(tabContainer);
                headerContainer.appendChild(buttonContainer);

                // --- MODIFIED: Main content area is now a flex container for columns ---
                const contentContainer = document.createElement('div');
                contentContainer.style.cssText = 'flex-grow: 1; overflow-y: auto; padding: 5px; display: flex; flex-direction: row; align-items: flex-start;';

                popupContent.appendChild(headerContainer);
                popupContent.appendChild(contentContainer);

                const loadShopContent = async (shopId) => {
                    contentContainer.innerHTML = ''; // Clear previous content
                    
                    // Handle Secret Wealth Shop - need to fetch actual shop ID
                    let actualShopId = shopId;
                    if (shopId === 'SECRET_WEALTH') {
                        try {
                            const caller = new Caller(['shopGetAll']);
                            await caller.send();
                            const shopsData = caller.result('shopGetAll');
                            const secretShop = findSecretWealthShop(shopsData);
                            if (secretShop) {
                                actualShopId = secretShop.id;
                            } else {
                                contentContainer.innerHTML = '<p style="color: #ff6666;">Secret Wealth Shop not found. It may not be available at this time.</p>';
                                return;
                            }
                        } catch (error) {
                            contentContainer.innerHTML = `<p style="color: #ff6666;">Error loading Secret Wealth Shop: ${error.message}</p>`;
                            return;
                        }
                    }
                    
                    const items = ITEMS_DATABASE[actualShopId] || ITEMS_DATABASE[shopId] || [];
                    const storageKey = shopId === 'SECRET_WEALTH' ? getSecretWealthStorageKey() : STORAGE_PREFIX + shopId;
                    const savedItems = JSON.parse(localStorage.getItem(storageKey) || '{}');
                    const savedSlotIds = JSON.parse(localStorage.getItem(storageKey + '_slots') || '[]');
                    const savedAmount = parseInt(localStorage.getItem(storageKey + '_amount') || '9999');

                    // --- NEW: Fixed Slot ID Section ---
                    const slotSection = document.createElement('div');
                    slotSection.style.cssText = 'margin-bottom: 20px; padding: 10px; border: 1px solid #ce9767; border-radius: 5px;';
                    
                    const slotTitle = document.createElement('h3');
                    slotTitle.textContent = 'Fixed Slot IDs';
                    slotTitle.style.cssText = 'color: #ffcc66; margin: 0 0 10px 0; border-bottom: 1px solid #ce9767; padding-bottom: 5px;';
                    slotSection.appendChild(slotTitle);

                    const slotDescription = document.createElement('p');
                    slotDescription.textContent = 'Enter slot IDs (comma-separated) to purchase specific slots, e.g., "6, 3"';
                    slotDescription.style.cssText = 'color: #fce1ac; font-size: 12px; margin: 5px 0;';
                    slotSection.appendChild(slotDescription);

                    const slotInputContainer = document.createElement('div');
                    slotInputContainer.style.cssText = 'display: flex; align-items: center; gap: 10px;';
                    
                    const slotInput = document.createElement('input');
                    slotInput.type = 'text';
                    slotInput.placeholder = 'e.g., 6, 3, 24';
                    slotInput.value = savedSlotIds.join(', ');
                    slotInput.style.cssText = 'flex: 1; padding: 5px; border: 1px solid #ce9767; background: #3a2e24; color: #fce1ac;';
                    
                    const saveSlotBtn = document.createElement('button');
                    saveSlotBtn.textContent = 'Save Slots';
                    saveSlotBtn.style.cssText = 'padding: 5px 10px; border: 1px solid #ce9767; background: #5c4b3a; color: #fce1ac; cursor: pointer;';
                    saveSlotBtn.onclick = () => {
                        const slotIds = slotInput.value.split(',').map(s => s.trim()).filter(s => s && !isNaN(parseInt(s))).map(s => parseInt(s));
                        const storageKey = shopId === 'SECRET_WEALTH' ? getSecretWealthStorageKey() : STORAGE_PREFIX + shopId;
                        localStorage.setItem(storageKey + '_slots', JSON.stringify(slotIds));
                        alert(`Saved ${slotIds.length} slot ID(s): ${slotIds.join(', ')}`);
                    };
                    
                    slotInputContainer.appendChild(slotInput);
                    slotInputContainer.appendChild(saveSlotBtn);
                    slotSection.appendChild(slotInputContainer);
                    contentContainer.appendChild(slotSection);

                    // --- NEW: Bulk Purchase Amount Section (only for Titan Artifact Shop) ---
                    if (actualShopId === 13) {
                        const amountSection = document.createElement('div');
                        amountSection.style.cssText = 'margin-bottom: 20px; padding: 10px; border: 1px solid #ce9767; border-radius: 5px;';
                        
                        const amountTitle = document.createElement('h3');
                        amountTitle.textContent = 'Bulk Purchase Amount';
                        amountTitle.style.cssText = 'color: #ffcc66; margin: 0 0 10px 0; border-bottom: 1px solid #ce9767; padding-bottom: 5px;';
                        amountSection.appendChild(amountTitle);

                        const amountDescription = document.createElement('p');
                        amountDescription.textContent = 'Enter the number of items to purchase in bulk (e.g., 300). The API will enforce the maximum available.';
                        amountDescription.style.cssText = 'color: #fce1ac; font-size: 12px; margin: 5px 0;';
                        amountSection.appendChild(amountDescription);

                        const amountInputContainer = document.createElement('div');
                        amountInputContainer.style.cssText = 'display: flex; align-items: center; gap: 10px;';
                        
                        const amountInput = document.createElement('input');
                        amountInput.type = 'number';
                        amountInput.min = '1';
                        amountInput.placeholder = 'e.g., 300';
                        amountInput.value = savedAmount;
                        amountInput.style.cssText = 'flex: 1; padding: 5px; border: 1px solid #ce9767; background: #3a2e24; color: #fce1ac;';
                        
                        const saveAmountBtn = document.createElement('button');
                        saveAmountBtn.textContent = 'Save Amount';
                        saveAmountBtn.style.cssText = 'padding: 5px 10px; border: 1px solid #ce9767; background: #5c4b3a; color: #fce1ac; cursor: pointer;';
                        saveAmountBtn.onclick = () => {
                            const amount = parseInt(amountInput.value) || 9999;
                            if (amount < 1) {
                                alert('Amount must be at least 1');
                                return;
                            }
                            const storageKey = shopId === 'SECRET_WEALTH' ? getSecretWealthStorageKey() : STORAGE_PREFIX + shopId;
                            localStorage.setItem(storageKey + '_amount', amount.toString());
                            alert(`Saved bulk purchase amount: ${amount}`);
                        };
                        
                        amountInputContainer.appendChild(amountInput);
                        amountInputContainer.appendChild(saveAmountBtn);
                        amountSection.appendChild(amountInputContainer);
                        contentContainer.appendChild(amountSection);
                    }

                    if (items.length === 0) {
                        const noItemsMsg = document.createElement('p');
                        noItemsMsg.textContent = 'No items configured for this shop yet.';
                        noItemsMsg.style.cssText = 'color: #fce1ac; margin-top: 10px;';
                        contentContainer.appendChild(noItemsMsg);
                        return;
                    }

                    // --- NEW: Column and Title generation logic ---
                    let currentColumn = document.createElement('div');
                    currentColumn.style.cssText = 'display: flex; flex-direction: column; margin-right: 20px;';
                    contentContainer.appendChild(currentColumn);

                    items.forEach(item => {
                        // Handle special types: title and newColumn
                        if (item.type === 'title' || item.type === 'newColumn') {
                            if (item.type === 'newColumn') {
                                currentColumn = document.createElement('div');
                                currentColumn.style.cssText = 'display: flex; flex-direction: column; margin-right: 20px;';
                                contentContainer.appendChild(currentColumn);
                            }
                            const title = document.createElement('h3');
                            title.textContent = item.name;
                            title.style.cssText = 'color: #ffcc66; margin: 10px 0 5px 0; border-bottom: 1px solid #ce9767; padding-bottom: 3px;';
                            currentColumn.appendChild(title);
                            return; // Continue to next item
                        }

                        // Handle regular items
                        const itemDiv = document.createElement('div');
                        itemDiv.style.cssText = 'display: flex; align-items: center; margin-bottom: 8px;';
                        const checkbox = document.createElement('input');
                        checkbox.type = 'checkbox';
                        checkbox.id = `item-${actualShopId}-${item.name.replace(/\s/g, '')}`;
                        checkbox.checked = savedItems[item.name] || false;
                        checkbox.onchange = () => {
                            savedItems[item.name] = checkbox.checked;
                            const storageKey = shopId === 'SECRET_WEALTH' ? getSecretWealthStorageKey() : STORAGE_PREFIX + shopId;
                            localStorage.setItem(storageKey, JSON.stringify(savedItems));
                        };
                        const label = document.createElement('label');
                        label.setAttribute('for', checkbox.id);
                        label.textContent = item.name;
                        label.style.marginLeft = '10px';
                        itemDiv.appendChild(checkbox);
                        itemDiv.appendChild(label);
                        currentColumn.appendChild(itemDiv);
                    });
                };

                SHOPS.forEach((shop, index) => {
                    const tab = document.createElement('button');
                    tab.textContent = shop.name;
                    tab.style.cssText = 'padding: 8px 12px; border: 1px solid #ce9767; background: #3a2e24; color: #fce1ac; cursor: pointer; margin: 2px;';
                    tab.onclick = () => {
                        Array.from(tabContainer.children).forEach(t => t.style.background = '#3a2e24');
                        tab.style.background = '#5c4b3a';
                        loadShopContent(shop.id);
                    };
                    tabContainer.appendChild(tab);
                    if (index === 0) {
                        setTimeout(() => tab.click(), 0);
                    }
                });

                // Use confirm with proper async handling
                const popupPromise = HWHFuncs.popup.confirm('', [{ msg: 'Close', result: true, isClose: true }]);
                
                // Wait a tick for popup to initialize, then replace content
                await new Promise(resolve => setTimeout(resolve, 0));
                
                const popupBody = document.querySelector('.PopUp_Container');
                if (popupBody) {
                    // Clear and replace content (preserve the original close button in PopUp_buttons)
                    popupBody.innerHTML = '';
                    popupBody.appendChild(popupContent);
                }
                
                // Wait for popup to close before returning
                // The original close button from popup.confirm should still be accessible
                await popupPromise;
            } catch (error) {
                console.error('Advanced Auto-Buyer: Popup error:', error);
                HWHFuncs.setProgress(`Settings popup error: ${error.message}`, true);
            }
        }

        // --- ACTION LOGIC (Unchanged from v1.5) ---
        async function runAutoBuy() {
            console.log("--- Advanced Auto-Buyer RUNNING (v1.6 Name Logic) ---");
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
                const itemsToLog = [];
                for (const shop of SHOPS) {
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
                    
                    // Get storage key - use consistent key for Secret Wealth Shop
                    const storageKey = shop.id === 'SECRET_WEALTH' ? getSecretWealthStorageKey() : STORAGE_PREFIX + shop.id;
                    const shoppingList = JSON.parse(localStorage.getItem(storageKey) || '{}');
                    const fixedSlotIds = JSON.parse(localStorage.getItem(storageKey + '_slots') || '[]');
                    
                    const wantedNames = new Set();
                    for(const name in shoppingList) { if(shoppingList[name] === true) { wantedNames.add(name); } }
                    
                    console.log(`Shop ${shop.name} (ID: ${shopId}): Found ${Object.keys(currentShopData.slots).length} slots, ${wantedNames.size} wanted items, ${fixedSlotIds.length} fixed slots`);
                    
                    // Check if we have anything to buy (names or fixed slots)
                    if (wantedNames.size === 0 && fixedSlotIds.length === 0) {
                        console.log(`Shop ${shop.name} (ID: ${shopId}): No items to buy (no checkboxes selected and no fixed slot IDs)`);
                        continue;
                    }
                    
                    for (const slot of Object.values(currentShopData.slots)) {
                        // Don't check if item is available - submit API call even if not available
                        // Skip only if slot data is completely missing
                        if (!slot) continue;
                        
                        let shouldBuy = false;
                        let itemDisplayName = `Slot ${slot.id}`;
                        
                        // Check if this slot is in the fixed slot IDs list
                        if (fixedSlotIds.includes(slot.id)) {
                            shouldBuy = true;
                            // Try to get item name for logging
                            try {
                                const rewardType = Object.keys(slot.reward)[0];
                                const rewardId = Object.keys(slot.reward[rewardType])[0];
                                let libTypeForTranslate = rewardType.replace('fragment', '').toUpperCase();
                                const translationKey = `LIB_${libTypeForTranslate}_NAME_${rewardId}`;
                                itemDisplayName = cheats.translate(translationKey) || `Slot ${slot.id}`;
                            } catch (e) {
                                // Keep default slot ID if translation fails
                            }
                        }
                        
                        // Also check by name if not already matched
                        if (!shouldBuy && wantedNames.size > 0) {
                            const rewardType = Object.keys(slot.reward)[0];
                            const rewardId = Object.keys(slot.reward[rewardType])[0];
                            let libTypeForTranslate = rewardType.replace('fragment', '').toUpperCase();
                            const translationKey = `LIB_${libTypeForTranslate}_NAME_${rewardId}`;
                            const itemName = cheats.translate(translationKey);
                            if (wantedNames.has(itemName)) {
                                shouldBuy = true;
                                itemDisplayName = itemName;
                            }
                        }
                        
                        if (shouldBuy) {
                            // Use slot.cost if available, otherwise use empty object (API will handle validation)
                            const slotCost = slot.cost || {};
                            const currencyType = slotCost ? Object.keys(slotCost)[0] : null;
                            
                            // Support multiple payment types: gold, coin (standard shops), consumable, starmoney (Secret Wealth Shop)
                            // If no cost, still submit the call (API will return error if needed)
                            if (!slotCost || currencyType === 'gold' || currencyType === 'coin' || currencyType === 'consumable' || currencyType === 'starmoney') {
                                // Convert cost values from strings to numbers if needed
                                // The API sometimes returns string values but expects numbers in shopBuy
                                const normalizedCost = {};
                                if (slotCost) {
                                    for (const costType in slotCost) {
                                        if (typeof slotCost[costType] === 'object' && slotCost[costType] !== null) {
                                            // For nested objects like coin: { "18": "12" }
                                            normalizedCost[costType] = {};
                                            for (const costKey in slotCost[costType]) {
                                                const costValue = slotCost[costType][costKey];
                                                // Convert string numbers to actual numbers
                                                normalizedCost[costType][costKey] = typeof costValue === 'string' && !isNaN(Number(costValue)) ? Number(costValue) : costValue;
                                            }
                                        } else {
                                            // For direct values like gold: "1000"
                                            const costValue = slotCost[costType];
                                            normalizedCost[costType] = typeof costValue === 'string' && !isNaN(Number(costValue)) ? Number(costValue) : costValue;
                                        }
                                    }
                                }
                                
                                // Build shopBuy arguments - use slot data or defaults
                                const shopBuyArgs = { 
                                    shopId: shopId, 
                                    slot: slot.id, 
                                    cost: normalizedCost, 
                                    reward: slot.reward || {}
                                };
                                
                                // Secret Wealth Shop (dynamic ID ending in 0026) - fixed purchases only (no amount parameter)
                                // Titan Artifact Shop (shopId 13) - supports bulk purchases via amount parameter
                                if (shopId === 13 && slot.staticShopMultiplePurchase === 1) {
                                    // For Titan Artifact Shop, we can specify amount for bulk purchase
                                    // Get the saved amount from localStorage, or use slot's maxAmount, or default to 9999
                                    const savedAmount = parseInt(localStorage.getItem(storageKey + '_amount') || '0');
                                    const maxAmount = savedAmount > 0 ? savedAmount : (slot.maxAmount || slot.maxPurchaseAmount || 9999);
                                    shopBuyArgs.amount = maxAmount;
                                }
                                // For Secret Wealth Shop and other shops, don't include amount (fixed purchase)
                                // Note: Secret Wealth Shop is identified by pattern matching (ends with 0026)
                                
                                // Store purchase info with item details for individual API calls
                                callsToMake.push({ 
                                    name: 'shopBuy', 
                                    args: shopBuyArgs,
                                    itemInfo: `- ${itemDisplayName} (Slot ${slot.id}) from ${shop.name}`
                                });
                            }
                        }
                    }
                }
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
            { name: '⚙️', title: 'Open Auto-Buyer Settings', onClick: openSettingsPopup }
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