// ==UserScript==
// @name         Arena Counter Suggest HwH Ext
// @namespace    HeroWarsHelper.ArenaCounterSuggest
// @version      1.4.0
// @description  MERGED into Arena Training HwH Ext — uninstall this script; panel lives there now
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
    // Counter Suggest was merged into Arena Training HwH Ext (v1.29+).
    // This stub avoids a second panel if both scripts stay installed.
    try {
        if (typeof window.__ahCounterSuggestTeardown === 'function') {
            // Leave existing panel from Arena Training alone.
        }
    } catch (_) { /* ignore */ }
    console.info(
        '[Arena Counter Suggest] Merged into Arena Training HwH Ext — disable/uninstall this userscript.'
    );
})();
