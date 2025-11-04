// ==UserScript==
// @name         Secret Wealth Shop HwH Ext
// @namespace    HeroWarsHelper.SecretWealthShop
// @version      1.2
// @description  Manual purchase interface for Secret Wealth Shop with consumable and GEM payment options
// @author       YourName
// @match        https://www.hero-wars.com/*
// @match        https://apps-1701433570146040.apps.fbsbx.com/*
// @grant        none
// @run-at       document-end
// @downloadURL https://github.com/mailming/AutoHero/raw/refs/heads/develop/Secret%20Wealth%20Shop%20HwH%20Ext.user.js
// @updateURL https://github.com/mailming/AutoHero/raw/refs/heads/develop/Secret%20Wealth%20Shop%20HwH%20Ext.user.js
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
        console.log('Secret Wealth Shop: HWH UI is ready, initializing extension...');

        const { HWHClasses, HWHFuncs, Send, cheats, Caller, lib } = window;
        const SECRET_WEALTH_SHOP_ID = 1576000026; // Base shop ID (may change per instance)

        // Helper function to translate consumable/reward names
        function getItemName(reward) {
            if (!reward) return 'Unknown';
            
            const rewardType = Object.keys(reward)[0];
            const rewardData = reward[rewardType];
            
            if (rewardType === 'consumable') {
                const consumableId = Object.keys(rewardData)[0];
                const translationKey = `LIB_CONSUMABLE_NAME_${consumableId}`;
                const translatedName = cheats.translate(translationKey);
                const amount = rewardData[consumableId];
                return translatedName ? `${translatedName} x${amount}` : `Consumable ${consumableId} x${amount}`;
            } else if (rewardType === 'fragment') {
                const fragmentType = Object.keys(rewardData)[0];
                const fragmentId = Object.keys(rewardData[fragmentType])[0];
                const libTypeForTranslate = fragmentType.toUpperCase();
                const translationKey = `LIB_${libTypeForTranslate}_NAME_${fragmentId}`;
                const translatedName = cheats.translate(translationKey);
                const amount = rewardData[fragmentType][fragmentId];
                return translatedName ? `${translatedName} x${amount}` : `${fragmentType} ${fragmentId} x${amount}`;
            }
            
            return JSON.stringify(reward);
        }

        // Helper function to get cost description
        function getCostDescription(cost) {
            if (!cost) return 'Unknown';
            
            if (cost.starmoney) {
                return `${cost.starmoney} GEMs`;
            } else if (cost.consumable) {
                const consumableId = Object.keys(cost.consumable)[0];
                const amount = cost.consumable[consumableId];
                const translationKey = `LIB_CONSUMABLE_NAME_${consumableId}`;
                const translatedName = cheats.translate(translationKey);
                const name = translatedName || `Consumable ${consumableId}`;
                return `${amount} ${name}`;
            } else if (cost.gold) {
                return `${cost.gold} Gold`;
            } else if (cost.coin) {
                return `${cost.coin} Coins`;
            }
            
            return JSON.stringify(cost);
        }

        // Auto-purchase function for slot 6 - uses actual shop data, always attempts purchase
        async function autoPurchaseSlot6() {
            try {
                console.log('Secret Wealth Shop: Auto-purchasing slot 6 on script load...');
                HWHFuncs.setProgress('Auto-purchasing slot 6...');
                
                // Fetch shop data to get actual slot 6 information
                const caller = new Caller(['shopGetAll']);
                await caller.send();
                const shopsData = caller.result('shopGetAll');

                // Find Secret Wealth Shop
                let secretWealthShop = null;
                let actualShopId = null;

                // First try the known ID
                if (shopsData[SECRET_WEALTH_SHOP_ID]) {
                    secretWealthShop = shopsData[SECRET_WEALTH_SHOP_ID];
                    actualShopId = SECRET_WEALTH_SHOP_ID;
                } else {
                    // Search for shop with slots that have consumable or starmoney costs
                    for (const shopId in shopsData) {
                        const shop = shopsData[shopId];
                        if (shop && shop.slots) {
                            const slots = shop.slots;
                            for (const slotId in slots) {
                                const slot = slots[slotId];
                                if (slot.cost && (slot.cost.consumable || slot.cost.starmoney)) {
                                    secretWealthShop = shop;
                                    actualShopId = parseInt(shopId);
                                    break;
                                }
                            }
                            if (secretWealthShop) break;
                        }
                    }
                }

                if (!secretWealthShop || !secretWealthShop.slots || !secretWealthShop.slots[6]) {
                    const errorMsg = 'Secret Wealth Shop: Slot 6 not found in shop data.';
                    console.error(errorMsg);
                    HWHFuncs.setProgress(`Auto-purchase error: ${errorMsg}`, true);
                    return false;
                }

                const slot6 = secretWealthShop.slots[6];

                // Determine payment type based on available cost
                let paymentType = 'Unknown';
                if (slot6.cost && slot6.cost.consumable) {
                    paymentType = 'Consumable';
                } else if (slot6.cost && slot6.cost.starmoney) {
                    paymentType = 'GEMs';
                }

                const itemName = getItemName(slot6.reward);
                console.log(`Secret Wealth Shop: Attempting to purchase slot 6 - ${itemName}`);
                
                // Always attempt purchase (no check for already bought)
                const success = await purchaseItem(actualShopId, 6, slot6.cost, slot6.reward, paymentType);
                
                if (success) {
                    console.log('%cSecret Wealth Shop: Auto-purchase successful!', 'color: lightgreen; font-weight: bold;');
                    HWHFuncs.setProgress('Auto-purchase complete: Slot 6 purchased!', true);
                } else {
                    // Error is already shown by purchaseItem function
                    console.log('Secret Wealth Shop: Auto-purchase failed - check error message above.');
                }
                
                return success;
            } catch (error) {
                const errorMsg = `Auto-purchase error: ${error.message || error}`;
                console.error('Secret Wealth Shop: Auto-purchase error:', error);
                HWHFuncs.setProgress(errorMsg, true);
                return false;
            }
        }

        // Function to purchase an item
        async function purchaseItem(shopId, slot, cost, reward, paymentType) {
            try {
                HWHFuncs.setProgress(`Purchasing slot ${slot} with ${paymentType}...`);
                
                // Generate action timestamp
                const actionTs = Date.now() % 1000000; // Use milliseconds modulo for actionTs
                
                const call = {
                    name: 'shopBuy',
                    args: {
                        shopId: shopId,
                        slot: slot,
                        cost: cost,
                        reward: reward
                    }
                };

                const caller = new Caller([call]);
                await caller.send();
                
                const result = caller.result('shopBuy');
                if (result && result.response) {
                    const itemName = getItemName(reward);
                    const costDesc = getCostDescription(cost);
                    console.log(`%c✓ Successfully purchased: ${itemName} for ${costDesc}`, 'color: lightgreen; font-weight: bold;');
                    HWHFuncs.setProgress(`Purchase successful: ${itemName}`, true);
                    return true;
                } else {
                    const error = result?.error || 'Unknown error';
                    console.error(`Purchase failed:`, error);
                    HWHFuncs.setProgress(`Purchase failed: ${error}`, true);
                    return false;
                }
            } catch (error) {
                console.error("Purchase Error:", error);
                HWHFuncs.setProgress(`Purchase Error: ${error.message}`, true);
                return false;
            }
        }

        // Function to fetch and display shop data
        async function openShopInterface() {
            const popupContent = document.createElement('div');
            popupContent.style.cssText = 'display: flex; flex-direction: column; height: 70vh; color: #fce1ac; text-shadow: 0 0 2px black;';

            const headerContainer = document.createElement('div');
            headerContainer.style.cssText = 'display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #ce9767; margin-bottom: 10px; padding-bottom: 5px;';

            const title = document.createElement('h2');
            title.textContent = 'Secret Wealth Shop';
            title.style.cssText = 'margin: 0; color: #ffcc66;';
            headerContainer.appendChild(title);

            const refreshBtn = document.createElement('button');
            refreshBtn.textContent = '🔄 Refresh';
            refreshBtn.style.cssText = 'padding: 6px 12px; border: 1px solid #ce9767; background: #3a2e24; color: #fce1ac; cursor: pointer;';
            refreshBtn.onclick = () => {
                popupContent.innerHTML = '';
                popupContent.appendChild(headerContainer);
                openShopInterface();
            };
            headerContainer.appendChild(refreshBtn);

            popupContent.appendChild(headerContainer);

            const contentContainer = document.createElement('div');
            contentContainer.style.cssText = 'flex-grow: 1; overflow-y: auto; padding: 10px;';
            popupContent.appendChild(contentContainer);

            // Show loading message
            contentContainer.innerHTML = '<p>Loading shop data...</p>';

            try {
                HWHFuncs.setProgress('Fetching Secret Wealth Shop data...');
                
                // Fetch shop data
                const caller = new Caller(['shopGetAll']);
                await caller.send();
                const shopsData = caller.result('shopGetAll');

                // Find Secret Wealth Shop - it might have a dynamic ID
                let secretWealthShop = null;
                let actualShopId = null;

                // First try the known ID
                if (shopsData[SECRET_WEALTH_SHOP_ID]) {
                    secretWealthShop = shopsData[SECRET_WEALTH_SHOP_ID];
                    actualShopId = SECRET_WEALTH_SHOP_ID;
                } else {
                    // Search for shop with slots that have consumable or starmoney costs
                    for (const shopId in shopsData) {
                        const shop = shopsData[shopId];
                        if (shop && shop.slots) {
                            const slots = shop.slots;
                            // Check if any slot has consumable or starmoney cost (typical of Secret Wealth Shop)
                            for (const slotId in slots) {
                                const slot = slots[slotId];
                                if (slot.cost && (slot.cost.consumable || slot.cost.starmoney)) {
                                    secretWealthShop = shop;
                                    actualShopId = parseInt(shopId);
                                    break;
                                }
                            }
                            if (secretWealthShop) break;
                        }
                    }
                }

                if (!secretWealthShop || !secretWealthShop.slots) {
                    contentContainer.innerHTML = '<p style="color: #ff6666;">Secret Wealth Shop not found or not available.</p>';
                    HWHFuncs.setProgress('Secret Wealth Shop not available.', true);
                    return;
                }

                // Clear loading message
                contentContainer.innerHTML = '';

                // Display shop info
                const shopInfo = document.createElement('div');
                shopInfo.style.cssText = 'margin-bottom: 15px; padding: 8px; background: #3a2e24; border-radius: 4px;';
                shopInfo.innerHTML = `<strong>Shop ID:</strong> ${actualShopId}<br><strong>Available Slots:</strong> ${Object.keys(secretWealthShop.slots).length}`;
                contentContainer.appendChild(shopInfo);

                // Auto-purchase info (always enabled)
                const autoPurchaseInfo = document.createElement('div');
                autoPurchaseInfo.style.cssText = 'margin-bottom: 15px; padding: 10px; background: #2a1f18; border: 1px solid #4a7c3e; border-radius: 4px;';
                autoPurchaseInfo.innerHTML = '<strong style="color: #aaffaa;">✓ Auto-purchase enabled:</strong> <span style="color: #fce1ac;">Slot 6 will be purchased automatically on script load</span>';
                contentContainer.appendChild(autoPurchaseInfo);

                // Display each slot
                const slots = secretWealthShop.slots;
                const slotNumbers = Object.keys(slots).map(Number).sort((a, b) => a - b);

                if (slotNumbers.length === 0) {
                    contentContainer.innerHTML += '<p>No items available in shop.</p>';
                    HWHFuncs.setProgress('Shop is empty.', true);
                    return;
                }

                slotNumbers.forEach(slotNum => {
                    const slot = slots[slotNum];
                    if (!slot || !slot.reward || slot.bought) return;

                    const slotDiv = document.createElement('div');
                    slotDiv.style.cssText = 'margin-bottom: 20px; padding: 12px; background: #2a1f18; border: 1px solid #ce9767; border-radius: 4px;';

                    const slotHeader = document.createElement('div');
                    slotHeader.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;';
                    
                    const slotTitle = document.createElement('h3');
                    slotTitle.textContent = `Slot ${slotNum}`;
                    slotTitle.style.cssText = 'margin: 0; color: #ffcc66;';
                    slotHeader.appendChild(slotTitle);
                    slotDiv.appendChild(slotHeader);

                    // Reward info
                    const rewardInfo = document.createElement('div');
                    rewardInfo.style.cssText = 'margin-bottom: 10px;';
                    const rewardName = getItemName(slot.reward);
                    rewardInfo.innerHTML = `<strong>Reward:</strong> ${rewardName}`;
                    slotDiv.appendChild(rewardInfo);

                    // Cost info
                    const costInfo = document.createElement('div');
                    costInfo.style.cssText = 'margin-bottom: 15px;';
                    const costDesc = getCostDescription(slot.cost);
                    costInfo.innerHTML = `<strong>Cost:</strong> ${costDesc}`;
                    slotDiv.appendChild(costInfo);

                    // Purchase buttons container
                    const buttonContainer = document.createElement('div');
                    buttonContainer.style.cssText = 'display: flex; gap: 10px; flex-wrap: wrap;';

                    // Check if cost has consumable payment option
                    if (slot.cost && slot.cost.consumable) {
                        const buyConsumableBtn = document.createElement('button');
                        buyConsumableBtn.textContent = '💰 Buy with Consumable';
                        buyConsumableBtn.style.cssText = 'padding: 8px 16px; border: 1px solid #4a7c3e; background: #3a5a2e; color: #aaffaa; cursor: pointer; border-radius: 4px; font-weight: bold;';
                        buyConsumableBtn.onclick = async () => {
                            buyConsumableBtn.disabled = true;
                            buyConsumableBtn.textContent = 'Processing...';
                            const success = await purchaseItem(actualShopId, slotNum, slot.cost, slot.reward, 'Consumable');
                            if (success) {
                                // Refresh the interface
                                setTimeout(() => {
                                    popupContent.innerHTML = '';
                                    popupContent.appendChild(headerContainer);
                                    openShopInterface();
                                }, 1000);
                            } else {
                                buyConsumableBtn.disabled = false;
                                buyConsumableBtn.textContent = '💰 Buy with Consumable';
                            }
                        };
                        buttonContainer.appendChild(buyConsumableBtn);
                    }

                    // Check if cost has GEM (starmoney) payment option
                    if (slot.cost && slot.cost.starmoney) {
                        const buyGemBtn = document.createElement('button');
                        buyGemBtn.textContent = '💎 Buy with GEMs';
                        buyGemBtn.style.cssText = 'padding: 8px 16px; border: 1px solid #4a5a7c; background: #3a4a6a; color: #aaaaff; cursor: pointer; border-radius: 4px; font-weight: bold;';
                        buyGemBtn.onclick = async () => {
                            buyGemBtn.disabled = true;
                            buyGemBtn.textContent = 'Processing...';
                            const success = await purchaseItem(actualShopId, slotNum, slot.cost, slot.reward, 'GEMs');
                            if (success) {
                                // Refresh the interface
                                setTimeout(() => {
                                    popupContent.innerHTML = '';
                                    popupContent.appendChild(headerContainer);
                                    openShopInterface();
                                }, 1000);
                            } else {
                                buyGemBtn.disabled = false;
                                buyGemBtn.textContent = '💎 Buy with GEMs';
                            }
                        };
                        buttonContainer.appendChild(buyGemBtn);
                    }

                    // If no payment options match, show unavailable message
                    if (buttonContainer.children.length === 0) {
                        const unavailableMsg = document.createElement('div');
                        unavailableMsg.textContent = 'No supported payment method available';
                        unavailableMsg.style.cssText = 'color: #ff6666; font-style: italic;';
                        buttonContainer.appendChild(unavailableMsg);
                    }

                    slotDiv.appendChild(buttonContainer);
                    contentContainer.appendChild(slotDiv);
                });

                HWHFuncs.setProgress('Shop data loaded successfully.', true);

            } catch (error) {
                console.error("Shop Interface Error:", error);
                contentContainer.innerHTML = `<p style="color: #ff6666;">Error loading shop data: ${error.message}</p>`;
                HWHFuncs.setProgress(`Error: ${error.message}`, true);
            }

            HWHFuncs.popup.confirm('', [{ msg: 'Close', result: true, isClose: true }]);
            const popupBody = document.querySelector('.PopUp_Container');
            if (popupBody) {
                popupBody.innerHTML = '';
                popupBody.appendChild(popupContent);
            }
        }

        // --- AUTO-PURCHASE ON SCRIPT LOAD ---
        // Always attempt to purchase slot 6 when script loads
        autoPurchaseSlot6().catch(error => {
            console.error('Secret Wealth Shop: Failed to auto-purchase on load:', error);
        });

        // --- MENU INTEGRATION ---
        const { ScriptMenu } = HWHClasses;
        const scriptMenu = ScriptMenu.getInst();
        scriptMenu.addCombinedButton([
            { name: 'Secret Wealth Shop', title: 'Open Secret Wealth Shop interface', onClick: openShopInterface, color: 'purple' }
        ]);
        console.log('Secret Wealth Shop: UI initialized and attached to HWH menu.');
    }
})();
