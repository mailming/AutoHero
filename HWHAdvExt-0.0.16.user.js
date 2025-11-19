// ==UserScript==
// @name            HWHAdvExt
// @namespace       HWHAdvExt
// @version         0.0.16
// @license         Copyright ZingerY & orb
// @description     Extension for Hero Wars Helper. Modifies the adventure button to use predefined paths directly within the script, allowing modification before starting. HeroWarsHelper
// @author          ZingerY & CR3 Cappu Red + Pizza Clan (Modified by AI)
// @match           https://www.hero-wars.com/*
// @match           https://apps-1701433570146040.apps.fbsbx.com/*
// @run-at          document-end
// @grant           none
// @downloadURL https://github.com/mailming/AutoHero/raw/refs/heads/develop/HWHAdvExt-0.0.16.user.js
// @updateURL https://github.com/mailming/AutoHero/raw/refs/heads/develop/HWHAdvExt-0.0.16.user.js
// ==/UserScript==

(function () {
    'use strict';

    const waitForHWH = setInterval(() => {
        if (window.HWHClasses && window.HWHClasses.ScriptMenu && window.HWHFuncs && window.lib && window.cheats) {
            const scriptMenu = window.HWHClasses.ScriptMenu.getInst();
            if (scriptMenu && scriptMenu.mainMenu) {
                clearInterval(waitForHWH);
                initializeExtension();
            }
        }
    }, 200);

    function initializeExtension() {
        console.log('%cHWH Adventure & Storm Extension (v0.0.16) loaded', 'color: green');

        // --- NUOVA FUNZIONE PER LO STILE ---
        function injectCustomStyles() {
            const style = document.createElement('style');
            style.type = 'text/css';
            style.innerHTML = `
                .PopUp_buttonText {
                    white-space: normal !important; /* Allows the text to wrap to the next line */
                    word-break: break-all !important; /* Forces long strings like paths to break */
                    text-align: left !important; /* Aligns the wrapped text to the left for readability */
                    line-height: 1.2 !important; /* Adds some space between wrapped lines */
                }
                .PopUp_button {
                    max-width: 450px; /* Prevents buttons from becoming excessively wide */
                    width: 100%;
                    height: auto; /* Allows the button's height to adjust to the content */
                    box-sizing: border-box;
                }
            `;
            document.head.appendChild(style);
            console.log('%cCustom popup styles injected for text wrapping.', 'color: cyan');
        }
        // --- FINE NUOVA FUNZIONE ---

        injectCustomStyles();

        const { addExtentionName, getSaveVal, I18N, popup, setSaveVal, setProgress } = window.HWHFuncs;
        const { Send } = window;
        addExtentionName(GM_info.script.name, GM_info.script.version, GM_info.script.author);

        // This object now contains separate keys for 'adventure' and 'storm' paths.
        const defaultWays = {
            adventure: {
                //Галахад, 1-я
                "adv_strongford_2pl_easy": {
                    default: { path: '1,2,4,7,6', label: 'Default (Orange)' },
                    blue: { path: '1,2,3,5,6', label: 'Solfors Blue' },
                    orange: { path: '1,2,4,7,6', label: 'Solfors Orange' },
                    green: { path: '1,2,3,5,6', label: 'Solfors Green' },
                    yellow: { path: '', label: 'Goodwin A' },
                    purple: { path: '', label: 'Goodwin B' },
                    red: { path: '', label: 'Goodwin C' },
                    white: { path: '', label: 'NoWait 1' },
                    black: { path: '', label: 'NoWait 2' },
                    brown: { path: '', label: 'NoWait 3' }
                },
                //Джинджер, 2-я
                "adv_valley_3pl_easy": {
                    default: { path: '1,3,6,9,11', label: 'Default (Orange)' },
                    blue: { path: '1,2,5,8,9,11', label: 'Solfors Blue' },
                    orange: { path: '1,3,6,9,11', label: 'Solfors Orange' },
                    green: { path: '1,4,7,10,9,11', label: 'Solfors Green' },
                    yellow: { path: '', label: 'Goodwin A' },
                    purple: { path: '', label: 'Goodwin B' },
                    red: { path: '', label: 'Goodwin C' },
                    white: { path: '', label: 'NoWait 1' },
                    black: { path: '', label: 'NoWait 2' },
                    brown: { path: '', label: 'NoWait 3' }
                },
                //Орион, 3-я
                "adv_ghirwil_3pl_easy": {
                    default: { path: '1,4,12,13,11', label: 'Default (Orange)' },
                    blue: { path: '1,5,6,9,11', label: 'Solfors Blue' },
                    orange: { path: '1,4,12,13,11', label: 'Solfors Orange' },
                    green: { path: '1,2,3,7,10,11', label: 'Solfors Green' },
                    yellow: { path: '', label: 'Goodwin A' },
                    purple: { path: '', label: 'Goodwin B' },
                    red: { path: '', label: 'Goodwin C' },
                    white: { path: '', label: 'NoWait 1' },
                    black: { path: '', label: 'NoWait 2' },
                    brown: { path: '', label: 'NoWait 3' }
                },
                //Тесак, 4-я
                "adv_angels_3pl_easy_fire": {
                    default: { path: '1,3,6,11,17,10,16,21,22,23', label: 'Default (Orange)' },
                    blue: { path: '1,2,4,7,18,8,12,19,22,23', label: 'Solfors Blue' },
                    orange: { path: '1,3,6,11,17,10,16,21,22,23', label: 'Solfors Orange' },
                    green: { path: '1,5,24,25,9,14,15,20,22,23', label: 'Solfors Green' },
                    yellow: { path: '', label: 'Goodwin A' },
                    purple: { path: '', label: 'Goodwin B' },
                    red: { path: '', label: 'Goodwin C' },
                    white: { path: '', label: 'NoWait 1' },
                    black: { path: '', label: 'NoWait 2' },
                    brown: { path: '', label: 'NoWait 3' }
                },
                //Галахад, 5-я
                "adv_strongford_3pl_normal_2": {
                    default: { path: '1,4,6,10,11,15,22,15,19,18,24', label: 'Default (Orange)' },
                    blue: { path: '1,2,7,8,12,16,23,26,25,21,24', label: 'Solfors Blue' },
                    orange: { path: '1,4,6,10,11,15,22,15,19,18,24', label: 'Solfors Orange' },
                    green: { path: '1,5,9,10,14,17,20,27,25,21,24', label: 'Solfors Green' },
                    yellow: { path: '', label: 'Goodwin A' },
                    purple: { path: '', label: 'Goodwin B' },
                    red: { path: '', label: 'Goodwin C' },
                    white: { path: '', label: 'NoWait 1' },
                    black: { path: '', label: 'NoWait 2' },
                    brown: { path: '', label: 'NoWait 3' }
                },
                //Джинджер, 6-я
                "adv_valley_3pl_normal": {
                    default: { path: '05,07,08,11,14,17,20,23,25', label: 'Default (Orange)' },
                    blue: { path: '02,04,07,10,13,16,19,24,22,25', label: 'Solfors Blue' },
                    orange: { path: '05,07,08,11,14,17,20,23,25', label: 'Solfors Orange' },
                    green: { path: '03,06,09,12,15,18,21,26,25', label: 'Solfors Green' },
                    yellow: { path: '1,2,4,7,10,13,16,19,24,22,25', label: 'Goodwin A' },
                    purple: { path: '1,3,6,9,12,15,18,21,26,23,25', label: 'Goodwin B' },
                    red: { path: '1,5,7,8,11,14,17,20,22,25', label: 'Goodwin C' },
                    white: { path: '', label: 'NoWait 1' },
                    black: { path: '', label: 'NoWait 2' },
                    brown: { path: '', label: 'NoWait 3' }
                },
                //Орион, 7-я
                "adv_ghirwil_3pl_normal_2": {
                    default: { path: '11,10,14,17,13,19,20,24,27', label: 'Default (Orange)' },
                    blue: { path: '08,01,11,12,15,12,11,21,25,27', label: 'Solfors Blue' },
                    orange: { path: '11,10,14,17,13,19,20,24,27', label: 'Solfors Orange' },
                    green: { path: '07,03,04,05,09,16,23,22,26,27', label: 'Solfors Green' },
                    yellow: { path: '1,11,10,11,12,15,12,11,21,25,27', label: 'Goodwin A' },
                    purple: { path: '1,7,3,4,3,6,13,19,20,24,27', label: 'Goodwin B' },
                    red: { path: '1,7,3,4,3,6,13,19,20,24,27', label: 'Goodwin C' },
                    white: { path: '', label: 'NoWait 1' },
                    black: { path: '', label: 'NoWait 2' },
                    brown: { path: '', label: 'NoWait 3' }
                },
                //Тесак, 8-я
                "adv_angels_3pl_normal": {
                    default: { path: '03,05,07,09,11,14,18,20,22,24,27,30,26,29,25', label: 'Default (Orange)' },
                    blue: { path: '03,02,06,07,09,10,13,17,16,20,22,21,28,32', label: 'Solfors Blue' },
                    orange: { path: '03,05,07,09,11,14,18,20,22,24,27,30,26,29,25', label: 'Solfors Orange' },
                    green: { path: '03,04,08,07,09,11,15,19,20,22,23,31,32', label: 'Solfors Green' },
                    yellow: { path: '1,3,4,8,7,9,10,13,17,16,20,22,23,31,32', label: 'Goodwin A' },
                    purple: { path: '1,3,5,7,8,11,14,18,20,22,24,27,30,26,32', label: 'Goodwin B' },
                    red: { path: '1,3,2,6,7,9,11,15,19,20,22,21,28,29,25', label: 'Goodwin C' },
                    white: { path: '', label: 'NoWait 1' },
                    black: { path: '', label: 'NoWait 2' },
                    brown: { path: '', label: 'NoWait 3' }
                },
                //Галахад, 9-я
                "adv_strongford_3pl_hard_2": {
                    default: { path: '03,08,12,11,07,16,21,26,30,31,32,35,37,40,45', label: 'Default (Orange)' },
                    blue: { path: '02,06,10,15,20,14,24,29,25,36,39,42,44,45', label: 'Solfors Blue' },
                    orange: { path: '03,08,12,11,07,16,21,26,30,31,32,35,37,40,45', label: 'Solfors Orange' },
                    green: { path: '03,04,13,19,18,23,17,22,38,41,43,46,45', label: 'Solfors Green' },
                    yellow: { path: '1,2,6,10,15,7,16,17,23,22,27,32,35,37,40,45', label: 'Goodwin A' },
                    purple: { path: '1,3,8,12,11,18,19,28,34,33,38,41,43,46,45', label: 'Goodwin B' },
                    red: { path: '1,2,5,9,14,20,26,21,30,36,39,42,44,45', label: 'Goodwin C' },
                    white: { path: '', label: 'NoWait 1' },
                    black: { path: '', label: 'NoWait 2' },
                    brown: { path: '', label: 'NoWait 3' }
                },
                //Джинджер, 10-я
                "adv_valley_3pl_hard": {
                    default: { path: '1,4,8,13,18,22,26,31,36,40,45,44,43,38,33,28', label: 'Default (Orange)' },
                    blue: { path: '1,3,2,6,11,17,25,30,35,34,29,24,21,17,12,7', label: 'Solfors Blue' },
                    orange: { path: '1,4,8,13,18,22,26,31,36,40,45,44,43,38,33,28', label: 'Solfors Orange' },
                    green: { path: '1,5,9,14,19,23,27,32,37,42,48,51,50,49,46,52', label: 'Solfors Green' },
                    yellow: { path: '', label: 'Goodwin A' },
                    purple: { path: '', label: 'Goodwin B' },
                    red: { path: '', label: 'Goodwin C' },
                    white: { path: '', label: 'NoWait 1' },
                    black: { path: '', label: 'NoWait 2' },
                    brown: { path: '', label: 'NoWait 3' }
                },
                //Орион, 11-я
                "adv_ghirwil_3pl_hard": {
                    default: { path: '1,2,4,6,9,13,18,17,16,22,28,29,30,31,25,19', label: 'Default (Orange)' },
                    blue: { path: '1,2,3,6,8,12,11,15,21,27,36,34,33,35,37', label: 'Solfors Blue' },
                    orange: { path: '1,2,4,6,9,13,18,17,16,22,28,29,30,31,25,19', label: 'Solfors Orange' },
                    green: { path: '1,2,5,6,10,13,14,20,26,32,38,41,40,39,37', label: 'Solfors Green' },
                    yellow: { path: '', label: 'Goodwin A' },
                    purple: { path: '', label: 'Goodwin B' },
                    red: { path: '', label: 'Goodwin C' },
                    white: { path: '', label: 'NoWait 1' },
                    black: { path: '', label: 'NoWait 2' },
                    brown: { path: '', label: 'NoWait 3' }
                },
                //Тесак, 12-я
                "adv_angels_3pl_hard": {
                    default: { path: '08,02,04,07,16,23,32,23,24,17,11,08,01,09,13', label: 'No Wait' },
                    blue: { path: '9,3,6,10,22,31,36,35,29,34,29,30,21,13', label: 'Solfors Blue' },
                    orange: { path: '1,5,12,15,28,20,12,14,26,18,19,20,27', label: 'Solfors Orange' },
                    green: { path: '8,2,4,7,16,23,32,33,25,24,17,11', label: 'Solfors Green' },
                    yellow: { path: '1,2,8,11,7,4,7,16,23,32,33,25,34,29,35,36', label: 'Goodwin A' },
                    purple: { path: '1,3,9,13,10,6,10,22,31,30,21,30,15,28,20,27', label: 'Goodwin B' },
                    red: { path: '1,5,12,14,24,17,24,25,26,18,19,20,27', label: 'Goodwin C' },
                    white: { path: '8,2,4,7,16,23,32,23,24,14,26,25,24,17,11', label: '1 NoWait 1' },
                    black: { path: '9,1,5,12,15,28,29,34,25,26,18,19,20,27', label: '2 NoWait 2' },
                    brown: { path: '3,6,10,22,31,36,31,30,21,13', label: '3 NoWait 3 -easy' }
                },
                //Тесак, 13-я map12 (probabilmente hard o superiore)
                "adv_angels_3pl_hell": {
                    default: { path: '07,02,04,06,16,23,33,23,24,17,11,07,01,09,13', label: 'Default (Orange)' },
                    blue: { path: ' 09,03,05,10,22,31,36,35,29,32,29,30,21,13 ', label: 'Solfors Blue' },
                    orange: { path: ' 08,12,15,28,20,12,14,26,18,19,20,27 ', label: 'Solfors Orange' },
                    green: { path: ' 07,02,04,06,16,23,33,34,25,24,17,11 ', label: 'Solfors Green' },
                    yellow: { path: '1,2,4,6,16,23,33,34,25,32,29,28,20,27', label: '2 - Goodwin A' },
                    purple: { path: '1,7,11,17,24,14,26,18,19,20,27,20,12,8', label: '1 - Goodwin B' },
                    red: { path: '1,9,3,5,10,22,31,36,31,30,15,28,29,30,21,13', label: '3 - Goodwin C' },
                    white: { path: ' 07,02,04,06,16,23,33,23,24,14,26,25,24,17,11 ', label: '1 NoWait 1' },
                    black: { path: ' 09,01,08,12,15,28,29,32,25,26,18,19,20,27 ', label: '2 NoWait 2' },
                    brown: { path: ' 09,03,05,10,22,31,36,35,29,32,29,30,21,13 ', label: '3 NoWait 3' }
                },
                //Galhad, 13-a map9 (probabilmente hard o superiore)
                "adv_strongford_3pl_hell": {
                    default: { path: '1,2,6,12,15,7,16,17,23,22,27,42,34,36,39,44', label: '1 NoWait | Goodwin B' },
                    blue: { path: ' 2,06,12,15,20,14,24,29,25,35,38,41,43 ', label: 'Solfors Blue' },
                    orange: { path: ' 03,08,09,13,07,16,21,26,30,31,42,34,36,39 ', label: 'Solfors Orange' },
                    green: { path: ' 03,04,10,19,18,23,17,22,37,40,32,45 ', label: 'Solfors Green' },
                    yellow: { path: '1,2,5,11,14,20,26,21,30,35,38,41,43,44', label: '2/3 NoWait | Goodwin A' },
                    purple: { path: '1,2,6,12,15,7,16,17,23,22,27,42,34,36,39,44', label: '1 NoWait | Goodwin B' },
                    red: { path: '1,3,8,9,13,18,19,28,0,33,37,40,32,45,44', label: '3/2 NoWait | Goodwin C' },
                    white: { path: '', label: 'NoWait 1' },
                    black: { path: '', label: 'NoWait 2' },
                    brown: { path: '', label: 'NoWait 3' }
                },
                //Orion, 13-a mp11 (probabilmente hard o superiore)
                "adv_ghirwil_3pl_hell": {
                    default: { path: ' 2,4,6,8,12,17,18,19,25,31,30,29,28,22,16 ', label: 'Default (Orange)' },
                    blue: { path: ' 2,3,6,7,12,11,15,21,27,36,39,40,41 ', label: '2/3 Solfors Blue' },
                    orange: { path: ' 2,4,6,8,12,17,18,19,25,31,30,29,28,22,16 ', label: '1 Solfors Orange' },
                    green: { path: ' 2,5,6,9,13,14,20,26,32,38,35,33,34 ', label: '3/2 Solfors Green' },
                    yellow: { path: '1,2,3,6,8,12,11,15,21,27,36,34,33,35,37', label: '2/3 Goodwin A' },
                    purple: { path: '1,2,4,6,9,13,18,17,16,22,28,29,30,31,25,19', label: '1 Goodwin B' },
                    red: { path: '1,2,5,6,10,13,14,20,26,32,38,41,40,39,37', label: '3/2 Goodwin C' },
                    white: { path: '', label: 'NoWait 1' },
                    black: { path: '', label: 'NoWait 2' },
                    brown: { path: '', label: 'NoWait 3' }
                },
                //Ginger, 13-a map10 (probabilmente hard o superiore)
                "adv_valley_3pl_hell": {
                    default: { path: '01,03,02,06,11,17,25,30,35,34,29,24,21,17,12,7', label: '3 Solfors Blue' },
                    blue: { path: '1,3,2,6,11,17,25,30,35,34,29,24,21,17,12,7', label: '3 Solfors Blue' },
                    orange: { path: '1,4,8,13,18,22,26,31,36,40,45,44,43,38,33,28', label: '1 Solfors Orange' },
                    green: { path: '1,5,9,14,19,23,27,32,37,42,48,51,50,49,46,52', label: '2 Solfors Green' },
                    yellow: { path: '', label: 'Goodwin A' },
                    purple: { path: '', label: 'Goodwin B' },
                    red: { path: '', label: 'Goodwin C' },
                    white: { path: '', label: 'NoWait 1' },
                    black: { path: '', label: 'NoWait 2' },
                    brown: { path: '', label: 'NoWait 3' }
                }
            },
            storm: {
                "tempest_3_3": {
                    blue: { path: '1,2,3,4,5,56,55,53,50,49,48,45,46,43,41,39,38,40,36,35,33,31,29,28,27,25,26,22,21,20,17,18,15,13,10,9,11,7,8', label: 'Path 1' },
                    orange: { path: '1,2,5,4,3,7,9,10,13,11,15,17,20,21,18,22,25,27,28,26,29,31,33,35,36,38,39,41,40,43,45,48,49,46,50,53,55,56,54,52,6,8', label: 'Path 2' },
                    green: { path: '1,2,5,4,3,7,9,10,13,11,15,17,20,21,18,22,25,27,28,26,29,31,33,35,36,38,39,41,40,43,45,48,49,46,50,53,55,56,54,51,47,44,42,37,32,30,24,23,19,16,14,12,8,6,52,57', label: 'Path 3' },
                    black: { path: '8,12,14,16,19,23,24,30,32,37,42,44,47,51,52,6', label: 'Inner 1' },
                    white: { path: '8,6,52,51,47,44,42,37,32,30,24,23,19,16,14,12', label: 'Inner 2' },
                }
            }
        };

        const originalExecuteAdventure = window.HWHClasses.executeAdventure;

        // Function to start adventure with level input
        async function startAdventureWithLevel() {
            try {
                // Check if user is already on an adventure
                const hasActive = await hasActiveAdventure();
                if (hasActive) {
                    await popup.confirm('You are already on an adventure. Please complete it first.', [
                        { msg: 'OK', result: true, color: 'green' }
                    ]);
                    return;
                }

                // Check portal charges
                const portalCharge = await getPortalCharge();
                if (portalCharge === 0) {
                    await popup.confirm('No portal charges available.', [
                        { msg: 'OK', result: true, color: 'green' }
                    ]);
                    return;
                }

                // Create popup message with info
                const savedLevel = getSaveVal('adventureId', 13);
                const popupMessage = `
                    <div style="padding: 10px; color: #fce1ac;">
                        <div style="margin-bottom: 10px;"><strong>Portal Charges:</strong> ${portalCharge}</div>
                        <div style="margin-bottom: 10px;"><strong>Note:</strong> Level will be saved and adventure will start with default path automatically.</div>
                        <div><strong>Enter Adventure Level (1-13):</strong></div>
                    </div>
                `;

                // Use popup's built-in input functionality
                const answer = await popup.confirm(popupMessage, [
                    { 
                        msg: 'Start Adventure', 
                        isInput: true,
                        placeholder: 'Enter level (1-13)',
                        default: savedLevel.toString(),
                        color: 'green' 
                    },
                    { msg: I18N('BTN_CANCEL'), result: false, isCancel: true, color: 'red' }
                ]);

                if (!answer) {
                    return; // User cancelled
                }

                // Validate and save adventure level
                const newAdventureId = parseInt(answer) || 13;
                if (newAdventureId < 1 || newAdventureId > 13) {
                    await popup.confirm('Invalid adventure level. Must be between 1 and 13.', [
                        { msg: 'OK', result: true, color: 'green' }
                    ]);
                    return;
                }

                // Save adventure level
                setSaveVal('adventureId', newAdventureId);
                console.log(`Adventure level saved: ${newAdventureId}`);

                // Check again if user started an adventure while popup was open
                const hasActiveNow = await hasActiveAdventure();
                if (hasActiveNow) {
                    await popup.confirm('An adventure was already started. Please complete it first.', [
                        { msg: 'OK', result: true, color: 'green' }
                    ]);
                    return;
                }

                // Start adventure and run default path
                setProgress(`Starting adventure ${newAdventureId}...`, false);
                await startNewAdventure(newAdventureId);
                
                // Wait a bit for adventure to initialize
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Run adventure with default path
                setProgress('Running adventure with default path...', false);
                await runAdventureWithDefaultPath();
                setProgress('Adventure started and running', true);
            } catch (error) {
                console.error('Error starting adventure:', error);
                setProgress(`Error: ${error.message}`, true);
            }
        }

        class ExtCombinedAdventureStorm extends originalExecuteAdventure {
            async getPath() {
                console.log(`Current adventure type: ${this.type}, Map Identifier: ${this.mapIdent}`);

                const adventureTypeKey = this.type === 'solo' ? 'storm' : 'adventure';
                const currentAdventureWays = defaultWays[adventureTypeKey] ? defaultWays[adventureTypeKey][this.mapIdent] : undefined;
                
                const oldVal = getSaveVal('adventurePath', '');
                const keyPath = `adventurePath:${this.mapIdent}`;

                const popupButtons = [];
                const colorEmojis = {
                    blue: '🔵', orange: '🟠', green: '🟢', yellow: '🟡',
                    purple: '🟣', red: '🔴', white: '⚪', black: '⚫', brown: '🟤'
                };

                if (currentAdventureWays) {
                    // Add default path first if available
                    if (currentAdventureWays.default && currentAdventureWays.default.path) {
                        const defaultPath = currentAdventureWays.default.path.trim();
                        if (defaultPath) {
                            popupButtons.push({
                                msg: `⭐ ${currentAdventureWays.default.label} | ${defaultPath}`,
                                result: defaultPath
                            });
                        }
                    }
                    
                    // Add other color paths
                    const orderedColors = ['blue', 'orange', 'green', 'yellow', 'purple', 'red', 'white', 'black', 'brown'];
                    orderedColors.forEach((color) => {
                        const pathData = currentAdventureWays[color];
                        if (pathData && pathData.path && pathData.path.trim()) {
                            let buttonLabel = `${colorEmojis[color] || '⚪'} ${pathData.label} | ${pathData.path}`;
                            popupButtons.push({
                                msg: buttonLabel,
                                result: pathData.path
                            });
                        }
                    });
                } else {
                    console.log(`%cNo predefined paths for ${adventureTypeKey} map: ${this.mapIdent}`, 'color: yellow');
                }

                // Add input button at the end
                popupButtons.push({
                    msg: I18N('START_ADVENTURE'),
                    placeholder: 'Click a path above or enter your own',
                    isInput: true,
                    default: getSaveVal(keyPath, oldVal),
                    color: 'green'
                });

                // Add cancel button
                popupButtons.push({
                    msg: I18N('BTN_CANCEL'),
                    result: false,
                    isCancel: true,
                    color: 'red'
                });

                let answer = await popup.confirm('SELECT A PREDEFINED PATH OR ENTER A CUSTOM ONE', popupButtons);
                
                if (!answer) {
                    this.terminatеReason = I18N('BTN_CANCELED');
                    return false;
                }

                // If answer is a path string (from button click), show confirmation popup
                if (typeof answer === 'string' && answer.length > 0) {
                    // Check if it's a predefined path (contains comma and matches pattern)
                    const isPredefinedPath = answer.includes(',') && /^[\d,\s]+$/.test(answer.replace(/\s/g, ''));
                    
                    if (isPredefinedPath) {
                        // Show confirmation popup with the selected path
                        const confirmButtons = [
                            {
                                msg: I18N('START_ADVENTURE'),
                                placeholder: 'Review path or modify',
                                isInput: true,
                                default: answer,
                                color: 'green'
                            },
                            {
                                msg: I18N('BTN_CANCEL'),
                                result: false,
                                isCancel: true,
                                color: 'red'
                            }
                        ];
                        const confirmedAnswer = await popup.confirm('REVIEW AND CONFIRM PATH', confirmButtons);
                        if (!confirmedAnswer) {
                            this.terminatеReason = I18N('BTN_CANCELED');
                            return false;
                        }
                        answer = confirmedAnswer;
                    }
                    // If it's from input field, use it directly (already processed)
                }


                let path = answer.split(',');
                if (path.length < 2) path = answer.split('-');
                if (path.length < 2) {
                    this.terminatеReason = I18N('MUST_TWO_POINTS');
                    return false;
                }

                for (let p in path) {
                    path[p] = +path[p].trim();
                    if (Number.isNaN(path[p])) {
                        this.terminatеReason = I18N('MUST_ONLY_NUMBERS');
                        return false;
                    }
                }

                if (!this.checkPath(path)) {
                    return false;
                }
                
                setSaveVal(keyPath, answer);
                return path;
            }
        }

        window.HWHClasses.executeAdventure = ExtCombinedAdventureStorm;

        // Auto-execute adventure raid or start logic
        async function autoAdventureRaidOrStart() {
            try {
                setProgress('Checking adventure raid availability...', false);
                
                // Check if can raid adventure
                const canRaid = await canRaidAdventure();
                if (canRaid.canRaid) {
                    console.log(`%cCan raid adventure ${canRaid.adventureId}`, 'color: green');
                    setProgress(`Raid available for adventure ${canRaid.adventureId}. Raiding...`, false);
                    await raidAdventure(canRaid.adventureId, canRaid.maxCount);
                    setProgress(`Raid completed ${canRaid.maxCount} times`, true);
                    return;
                }

                // Check if portal charge available and no active adventure
                setProgress('Checking portal charges and adventure status...', false);
                const portalCharge = await getPortalCharge();
                const hasActive = await hasActiveAdventure();

                if (portalCharge > 0 && !hasActive) {
                    console.log(`%cPortal charges available (${portalCharge}) and no active adventure. Starting new adventure...`, 'color: green');
                    const adventureId = getSaveVal('adventureId', 13);
                    setProgress(`Starting adventure ${adventureId}...`, false);
                    await startNewAdventure(adventureId);
                    
                    // Wait a bit for adventure to initialize
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    // Run adventure with default path
                    setProgress('Running adventure with default path...', false);
                    await runAdventureWithDefaultPath();
                    setProgress('Adventure started and running', true);
                } else {
                    if (portalCharge === 0) {
                        console.log('%cNo portal charges available', 'color: yellow');
                        setProgress('No portal charges available', true);
                    } else if (hasActive) {
                        console.log('%cAdventure already active', 'color: yellow');
                        setProgress('Adventure already active', true);
                    }
                }
            } catch (error) {
                console.error('Auto adventure raid/start error:', error);
                setProgress(`Error: ${error.message}`, true);
            }
        }

        // Check if adventure can be raided
        async function canRaidAdventure() {
            try {
                const calls = [
                    {
                        name: "userGetInfo",
                        args: {},
                        ident: "userGetInfo"
                    },
                    {
                        name: "adventure_raidGetInfo",
                        args: {},
                        ident: "adventure_raidGetInfo"
                    }
                ];
                const result = await Send(JSON.stringify({ calls }))
                    .then(e => e.results.map(n => n.result.response));

                const portalSphere = result[0].refillable.find(n => n.id == 45);
                const adventureRaid = Object.entries(result[1].raid).filter(e => e[1]).pop();
                const adventureId = adventureRaid ? adventureRaid[0] : 0;

                if (!portalSphere || !portalSphere.amount || !adventureId) {
                    return { canRaid: false, adventureId: 0, maxCount: 0 };
                }

                return {
                    canRaid: true,
                    adventureId: parseInt(adventureId),
                    maxCount: portalSphere.amount
                };
            } catch (error) {
                console.error('Error checking raid availability:', error);
                return { canRaid: false, adventureId: 0, maxCount: 0 };
            }
        }

        // Perform adventure raid
        async function raidAdventure(adventureId, maxCount) {
            try {
                const countRaid = maxCount; // Use max available
                
                const resultRaid = await Send(JSON.stringify({
                    calls: [...Array(countRaid)].map((e, i) => ({
                        name: "adventure_raid",
                        args: {
                            adventureId
                        },
                        ident: `body_${i}`
                    }))
                })).then(e => e.results.map(n => n.result.response));

                if (!resultRaid.length) {
                    console.error('Raid failed:', resultRaid);
                    throw new Error('Raid failed - no results');
                }

                console.log(`Raid completed: ${resultRaid.length} times for adventure ${adventureId}`);
                return resultRaid;
            } catch (error) {
                console.error('Error performing raid:', error);
                throw error;
            }
        }

        // Get portal charge amount
        async function getPortalCharge() {
            try {
                const response = await Send(JSON.stringify({
                    calls: [{
                        name: "userGetInfo",
                        args: {},
                        ident: "userGetInfo"
                    }]
                }));
                const userInfo = response.results[0].result.response;
                const portalSphere = userInfo.refillable.find(n => n.id == 45);
                return portalSphere ? portalSphere.amount : 0;
            } catch (error) {
                console.error('Error getting portal charge:', error);
                return 0;
            }
        }

        // Check if adventure is active
        async function hasActiveAdventure() {
            try {
                const response = await Send(JSON.stringify({
                    calls: [{
                        name: "adventure_getInfo",
                        args: {},
                        context: {
                            actionTs: Date.now()
                        },
                        ident: "group_1_body"
                    }]
                }));

                // Check if response is null or error
                if (!response || !response.results || !response.results[0]) {
                    return false;
                }

                const result = response.results[0].result;
                if (!result || !result.response) {
                    return false;
                }

                const adventureInfo = result.response;
                // Check if adventure has valid data (id, users, etc.)
                if (!adventureInfo.id || !adventureInfo.users) {
                    return false;
                }

                return true;
            } catch (error) {
                // If error, assume no active adventure
                console.log('adventure_getInfo returned error (no active adventure):', error);
                return false;
            }
        }

        // Start new adventure
        async function startNewAdventure(adventureId) {
            try {
                const response = await Send(JSON.stringify({
                    calls: [{
                        name: "adventure_start",
                        args: {
                            adventureId: parseInt(adventureId),
                            private: false,
                            isClan: true
                        },
                        context: {
                            actionTs: Date.now()
                        },
                        ident: "body"
                    }]
                }));

                if (response.error) {
                    throw new Error(`Failed to start adventure: ${response.error.description || response.error.name}`);
                }

                console.log(`Adventure ${adventureId} started successfully`);
                return response;
            } catch (error) {
                console.error('Error starting adventure:', error);
                throw error;
            }
        }

        // Run adventure with default path
        async function runAdventureWithDefaultPath() {
            try {
                // Get adventure info to get mapIdent
                const response = await Send(JSON.stringify({
                    calls: [{
                        name: "adventure_getInfo",
                        args: {},
                        context: {
                            actionTs: Date.now()
                        },
                        ident: "group_1_body"
                    }]
                }));

                const adventureInfo = response.results[0].result.response;
                const mapIdent = adventureInfo.mapIdent;

                if (!mapIdent) {
                    throw new Error('Could not get map identifier');
                }

                // Get default path for this map
                const currentAdventureWays = defaultWays.adventure[mapIdent];
                if (!currentAdventureWays || !currentAdventureWays.default || !currentAdventureWays.default.path) {
                    throw new Error(`No default path found for map: ${mapIdent}`);
                }

                const defaultPathStr = currentAdventureWays.default.path.trim();
                if (!defaultPathStr) {
                    throw new Error(`Default path is empty for map: ${mapIdent}`);
                }

                // Parse path string to array (handle spaces and empty values)
                let path = defaultPathStr.split(',')
                    .map(p => p.trim())
                    .filter(p => p.length > 0)
                    .map(p => parseInt(p))
                    .filter(p => !isNaN(p));
                
                if (path.length < 2) {
                    throw new Error(`Invalid default path: ${defaultPathStr}`);
                }

                console.log(`Using default path for ${mapIdent}:`, path);

                // Create a custom executeAdventure instance that uses default path
                class AutoDefaultAdventure extends ExtCombinedAdventureStorm {
                    async getPath() {
                        // Return default path directly without popup
                        return path;
                    }
                }

                // Run adventure
                return new Promise((resolve, reject) => {
                    const adventure = new AutoDefaultAdventure(resolve, reject);
                    adventure.start('default').catch(reject);
                });
            } catch (error) {
                console.error('Error running adventure with default path:', error);
                throw error;
            }
        }

        // Add menu button for starting adventure
        const { ScriptMenu } = window.HWHClasses;
        const scriptMenu = ScriptMenu.getInst();
        scriptMenu.addCombinedButton([
            { 
                name: '🚀 Start Adventure', 
                title: 'Start adventure with level input (when not on adventure)', 
                onClick: startAdventureWithLevel, 
                color: 'green'
            }
        ]);

        // Auto-execute on initialization
        autoAdventureRaidOrStart().catch(error => {
            console.error('Auto adventure raid/start failed:', error);
        });
    }
})();

