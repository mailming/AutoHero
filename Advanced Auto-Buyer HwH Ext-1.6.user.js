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
        const SHOPS = [ { id: 1, name: 'Town Shop' }, { id: 4, name: 'Arena Shop' }, { id: 5, name: 'Grand Arena Shop' }, { id: 6, name: 'Tower Shop' }, { id: 8, name: 'Soul Shop' }, { id: 9, name: 'Friendship Shop' }, { id: 10, name: 'Outland Shop' }, { id: 13, name: 'Titan Artifact Shop' } ];
        const ITEMS_DATABASE = window.AUTO_BUYER_ITEM_DATABASE || {};

        // --- NEW: Import/Export Functions ---
        function exportSettings() {
            const settingsToExport = {};
            SHOPS.forEach(shop => {
                const key = STORAGE_PREFIX + shop.id;
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
        function openSettingsPopup() {
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

            const loadShopContent = (shopId) => {
                contentContainer.innerHTML = ''; // Clear previous content
                const items = ITEMS_DATABASE[shopId] || [];
                const savedItems = JSON.parse(localStorage.getItem(STORAGE_PREFIX + shopId) || '{}');

                if (items.length === 0) {
                    contentContainer.innerHTML = '<p>No items configured for this shop yet.</p>';
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
                    checkbox.id = `item-${shopId}-${item.name.replace(/\s/g, '')}`;
                    checkbox.checked = savedItems[item.name] || false;
                    checkbox.onchange = () => {
                        savedItems[item.name] = checkbox.checked;
                        localStorage.setItem(STORAGE_PREFIX + shopId, JSON.stringify(savedItems));
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

            HWHFuncs.popup.confirm('', [{ msg: 'Close', result: true, isClose: true }]);
            const popupBody = document.querySelector('.PopUp_Container');
            if (popupBody) {
                popupBody.innerHTML = '';
                popupBody.appendChild(popupContent);
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
                const callsToMake = [];
                const itemsToLog = [];
                for (const shop of SHOPS) {
                    const shopId = shop.id;
                    const shoppingList = JSON.parse(localStorage.getItem(STORAGE_PREFIX + shopId) || '{}');
                    const currentShopData = shopsData[shopId];
                    if (!currentShopData || !currentShopData.slots || Object.keys(shoppingList).length === 0) continue;
                    const wantedNames = new Set();
                    for(const name in shoppingList) { if(shoppingList[name] === true) { wantedNames.add(name); } }
                    if (wantedNames.size === 0) continue;
                    for (const slot of Object.values(currentShopData.slots)) {
                        if (!slot.reward || slot.bought || !slot.cost) continue;
                        const rewardType = Object.keys(slot.reward)[0];
                        const rewardId = Object.keys(slot.reward[rewardType])[0];
                        let libTypeForTranslate = rewardType.replace('fragment', '').toUpperCase();
                        const translationKey = `LIB_${libTypeForTranslate}_NAME_${rewardId}`;
                        const itemName = cheats.translate(translationKey);
                        if (wantedNames.has(itemName)) {
                            const currencyType = Object.keys(slot.cost)[0];
                            if (currencyType === 'gold' || currencyType === 'coin') {
                                // Titan Artifact Shop (shopId 13) supports bulk purchases via amount parameter
                                const shopBuyArgs = { shopId: shopId, slot: slot.id, cost: slot.cost, reward: slot.reward };
                                if (shopId === 13 && slot.staticShopMultiplePurchase === 1) {
                                    // For Titan Artifact Shop, we can specify amount for bulk purchase
                                    // Default to 1 if not specified, but can be increased for bulk purchases
                                    // Note: amount is optional and defaults to 1 if not provided
                                }
                                callsToMake.push({ name: 'shopBuy', args: shopBuyArgs });
                                itemsToLog.push(`- ${itemName} from ${shop.name}`);
                            }
                        }
                    }
                }
                if (callsToMake.length > 0) {
                    HWHFuncs.setProgress(`Auto-Buyer: Attempting to buy ${callsToMake.length} item(s)...`);
                    await new Caller(callsToMake).send();
                    console.log('%c--- Items Bought Successfully ---', 'color: lightgreen; font-weight: bold;');
                    console.log(itemsToLog.join('\n'));
                    HWHFuncs.setProgress(`Bought ${itemsToLog.length} items! Check console for details.`, true);
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
    }
})();