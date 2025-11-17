// ==UserScript==
// @name            HWHAdvExt
// @namespace       HWHAdvExt
// @version         0.0.16
// @license         Copyright ZingerY & orb
// @description     Extension for Hero Wars Helper. Modifies the adventure button to use predefined paths directly within the script, allowing modification before starting. HeroWarsHelper
// @author          ZingerY & CR3 Cappu Red + Pizza Clan (Modified by AI)
// @match           https://www.hero-wars.com/*
// @match           https://apps-1701433570146040.apps.fbsbx.com/*
// @run-at          document-start
// @grant           none
// @downloadURL     https://update.greasyfork.org/scripts/542190/HWHAdvExt.user.js
// @updateURL       https://update.greasyfork.org/scripts/542190/HWHAdvExt.meta.js
// ==/UserScript==

(function () {
    if (!this.HWHClasses) {
        console.log('%cHeroWarsHelper not found', 'color: red');
        return;
    }

    console.log('%cHWH Adventure & Storm Extension (v0.0.14) loaded', 'color: green');
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

    const { addExtentionName, getSaveVal, I18N, popup, setSaveVal } = HWHFuncs;
    addExtentionName(GM_info.script.name, GM_info.script.version, GM_info.script.author);

    // This object now contains separate keys for 'adventure' and 'storm' paths.
    const defaultWays = {
        adventure: {
            //Галахад, 1-я
            "adv_strongford_2pl_easy": {
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
                blue: { path: ' 2,06,12,15,20,14,24,29,25,35,38,41,43 ', label: 'Solfors Blue' },
                orange: { path: ' 03,08,09,13,07,16,21,26,30,31,42,34,36,39 ', label: 'Solfors Orange' },
                green: { path: ' 03,04,10,19,18,23,17,22,37,40,32,45 ', label: 'Solfors Green' },
                yellow: { path: '1,2,5,11,14,20,26,21,30,35,38,41,43,44', label: '2/3 NoWait | Goodwin A' },
                purple: { path: '1,2,6,12,15,7,16,17,23,22,27,42,34,36,39,44', label: ' 1 NoWait | Goodwin B' },
                red: { path: '1,3,8,9,13,18,19,28,0,33,37,40,32,45,44', label: '3/2 NoWait | Goodwin C' },
                white: { path: '', label: 'NoWait 1' },
                black: { path: '', label: 'NoWait 2' },
                brown: { path: '', label: 'NoWait 3' }
            },
            //Orion, 13-a mp11 (probabilmente hard o superiore)
            "adv_ghirwil_3pl_hell": {
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

    const originalExecuteAdventure = HWHClasses.executeAdventure;

    class ExtCombinedAdventureStorm extends originalExecuteAdventure {
        async getPath() {
            console.log(`Current adventure type: ${this.type}, Map Identifier: ${this.mapIdent}`);

            const adventureTypeKey = this.type === 'solo' ? 'storm' : 'adventure';
            const currentAdventureWays = defaultWays[adventureTypeKey] ? defaultWays[adventureTypeKey][this.mapIdent] : undefined;
            
            const oldVal = getSaveVal('adventurePath', '');
            const keyPath = `adventurePath:${this.mapIdent}`;

            // We need a way to reference the input field later.
            let inputFieldRef = {};

            const popupButtons = [
                {
                    msg: I18N('START_ADVENTURE'),
                    placeholder: 'Click a path or enter your own',
                    isInput: true,
                    default: getSaveVal(keyPath, oldVal),
                    result: 'input_value',
                    // This is a custom property to hold a reference to the input element
                    inputRef: inputFieldRef
                },
                {
                    msg: I18N('BTN_CANCEL'),
                    result: false,
                    isCancel: true
                }
            ];
            
            // Note: The popup implementation in HwH needs to assign the input element to `button.inputRef.current`
            // Since we cannot modify HwH's popup, we will retrieve the final input value in a different way.

            const colorEmojis = {
                blue: '🔵', orange: '🟠', green: '🟢', yellow: '🟡',
                purple: '🟣', red: '🔴', white: '⚪', black: '⚫', brown: '🟤'
            };

            if (currentAdventureWays) {
                const orderedColors = ['blue', 'orange', 'green', 'yellow', 'purple', 'red', 'white', 'black', 'brown'];
                orderedColors.forEach((color) => {
                    const pathData = currentAdventureWays[color];
                    if (pathData && pathData.path) {
                        let buttonLabel = `${colorEmojis[color] || '⚪'} ${pathData.label} | ${pathData.path}`;
                        popupButtons.unshift({
                            msg: buttonLabel,
                            result: pathData.path,
                            isPathButton: true
                        });
                    }
                });
            } else {
                console.log(`%cNo predefined paths for ${adventureTypeKey} map: ${this.mapIdent}`, 'color: yellow');
            }

            let answer = await popup.confirm('SELECT A PREDEFINED PATH OR ENTER A CUSTOM ONE', popupButtons);

            if (typeof answer === 'string' && answer.length > 0 && answer !== 'input_value') {
                const newPopupButtons = [
                    {
                        msg: I18N('START_ADVENTURE'),
                        placeholder: 'Click on a path or enter your path',
                        isInput: true,
                        default: answer,
                        result: 'input_value'
                    },
                    {
                        msg: I18N('BTN_CANCEL'),
                        result: false,
                        isCancel: true
                    }
                ];
                answer = await popup.confirm('REVIEW AND CONFIRM PATH', newPopupButtons);
            }
            
            // This is the key change: When the user confirms, the popup implementation in HwH returns the input value.
            // If the user cancels, it returns false.
            if (answer === 'input_value') {
                 // The HwH popup returns the input string, not 'input_value' when confirmed.
                 // This part of the logic from the previous script might be based on a misunderstanding of the popup's return.
                 // Let's assume the popup returns the final string directly.
                 // The check `!answer` will handle the cancel case.
            } else if (!answer) {
                 this.terminatеReason = I18N('BTN_CANCELED');
                 return false;
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

    HWHClasses.executeAdventure = ExtCombinedAdventureStorm;
})();