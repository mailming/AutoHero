// ==UserScript==
// @name         Simple Test Script
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Simple test to verify Tampermonkey is working
// @match        *://*/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';
    
    console.log('🧪 TEST SCRIPT LOADED ON:', window.location.href);
    
    // Add a simple test element to the page
    setTimeout(() => {
        const testDiv = document.createElement('div');
        testDiv.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: red;
            color: white;
            padding: 10px;
            z-index: 9999;
            font-family: Arial;
        `;
        testDiv.textContent = 'TEST SCRIPT WORKING!';
        document.body.appendChild(testDiv);
        console.log('🧪 Test element added to page');
    }, 1000);
    
})();
