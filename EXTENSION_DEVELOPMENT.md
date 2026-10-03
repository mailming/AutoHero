# HeroWarsHelper Extension Development Guide

This guide explains how to create extensions for the HeroWarsHelper (HWH) system that integrate seamlessly with the main script.

## Table of Contents

1. [Extension Structure](#extension-structure)
2. [Initialization Pattern](#initialization-pattern)
3. [Auto-Loading on Script Run](#auto-loading-on-script-run)
4. [Menu Integration](#menu-integration)
5. [Popup Handling](#popup-handling)
6. [API Integration](#api-integration)
7. [Best Practices](#best-practices)
8. [Examples](#examples)

## Extension Structure

### File Naming

Extensions should follow the naming pattern: `[Extension Name] HwH Ext.user.js`

Example: `Secret Wealth Shop HwH Ext.user.js`

### UserScript Header

Every extension must include a proper UserScript header with metadata:

```javascript
// ==UserScript==
// @name         Extension Name HwH Ext
// @namespace    HeroWarsHelper.ExtensionName
// @version      1.0
// @description  Brief description of what the extension does
// @author       YourName
// @match        https://www.hero-wars.com/*
// @match        https://apps-1701433570146040.apps.fbsbx.com/*
// @grant        none
// @run-at       document-end
// @downloadURL https://github.com/mailming/AutoHero/raw/refs/heads/develop/Extension%20Name%20HwH%20Ext.user.js
// @updateURL https://github.com/mailming/AutoHero/raw/refs/heads/develop/Extension%20Name%20HwH%20Ext.user.js
// ==/UserScript==
```

**Important Notes:**
- `@namespace` should be unique and follow the pattern `HeroWarsHelper.ExtensionName`
- `@downloadURL` and `@updateURL` should use URL-encoded filenames (spaces become `%20`)
- Always include both `@match` entries for the Hero Wars domains

## Initialization Pattern

### Waiting for HWH to Load

Extensions must wait for HeroWarsHelper to be fully loaded before initializing:

```javascript
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
        console.log('Extension Name: HWH UI is ready, initializing extension...');
        
        // Destructure HWH APIs
        const { HWHClasses, HWHFuncs, Send, cheats, Caller, lib } = window;
        
        // Your extension code here
    }
})();
```

**Why this pattern?**
- HeroWarsHelper loads asynchronously
- The interval checks every 200ms until HWH is ready
- Only initializes when all required components are available

## Auto-Loading on Script Run

To execute code automatically when the extension loads (without user interaction):

```javascript
function initializeExtension() {
    const { HWHClasses, HWHFuncs, Send, cheats, Caller, lib } = window;
    
    // Define your auto-execute function
    async function autoExecuteFunction() {
        try {
            console.log('Extension: Auto-executing...');
            HWHFuncs.setProgress('Extension: Running auto-task...');
            
            // Your auto-execution code here
            // Example: API calls, data processing, etc.
            
            HWHFuncs.setProgress('Extension: Auto-task complete!', true);
        } catch (error) {
            console.error('Extension: Auto-execute error:', error);
            HWHFuncs.setProgress(`Extension: Error - ${error.message}`, true);
        }
    }
    
    // Execute immediately when extension loads
    autoExecuteFunction().catch(error => {
        console.error('Extension: Failed to auto-execute:', error);
    });
    
    // Add menu button (optional, for manual triggers)
    const { ScriptMenu } = HWHClasses;
    const scriptMenu = ScriptMenu.getInst();
    scriptMenu.addCombinedButton([
        { name: 'Extension Name', title: 'Description', onClick: yourFunction, color: 'purple' }
    ]);
}
```

**Key Points:**
- Auto-execution happens in `initializeExtension()` after HWH is ready
- Use `.catch()` to handle errors gracefully
- Auto-execution doesn't block menu integration
- You can still provide manual triggers via menu buttons

## Menu Integration

### Adding Menu Buttons

```javascript
const { ScriptMenu } = HWHClasses;
const scriptMenu = ScriptMenu.getInst();

// Single button
scriptMenu.addButton({
    name: 'Button Name',
    title: 'Tooltip text',
    onClick: yourFunction,
    color: 'green' // Optional: 'green', 'red', 'purple', etc.
});

// Combined buttons (multiple buttons in one menu item)
scriptMenu.addCombinedButton([
    { name: 'Action 1', title: 'Description 1', onClick: function1, color: 'green' },
    { name: '⚙️', title: 'Settings', onClick: openSettings }
]);
```

### Button Colors

Available colors: `'green'`, `'red'`, `'purple'`, `'blue'`, etc.

## Popup Handling

### Creating Custom Popups

When creating popups, always properly handle the popup promise to prevent menu interference:

```javascript
async function openPopup() {
    const popupContent = document.createElement('div');
    popupContent.style.cssText = 'display: flex; flex-direction: column; height: 70vh; color: #fce1ac;';
    
    // Build your popup content
    const contentContainer = document.createElement('div');
    contentContainer.style.cssText = 'flex-grow: 1; overflow-y: auto; padding: 10px;';
    // ... add content to contentContainer ...
    popupContent.appendChild(contentContainer);
    
    try {
        // Your popup logic here
        // Fetch data, build UI, etc.
    } catch (error) {
        console.error("Popup Error:", error);
        contentContainer.innerHTML = `<p style="color: #ff6666;">Error: ${error.message}</p>`;
    }
    
    // Use confirm with proper async handling
    const popupPromise = HWHFuncs.popup.confirm('', [{ msg: 'Close', result: true, isClose: true }]);
    
    // Wait a tick for popup to initialize
    await new Promise(resolve => setTimeout(resolve, 0));
    
    const popupBody = document.querySelector('.PopUp_Container');
    if (popupBody) {
        popupBody.innerHTML = '';
        popupBody.appendChild(popupContent);
    }
    
    // CRITICAL: Wait for popup to close before returning
    // This prevents menu interference bugs
    await popupPromise;
}
```

**Important:** Always `await` the popup promise. Not doing so can cause other menu items to incorrectly show your popup.

## API Integration

### Using the Caller Class

The `Caller` class provides a clean way to make API calls:

```javascript
// Single API call
const caller = new Caller(['shopGetAll']);
await caller.send();
const shopsData = caller.result('shopGetAll');

// Multiple API calls
const caller = new Caller(['shopGetAll', 'userGetInfo']);
await caller.send();
const shops = caller.result('shopGetAll');
const userInfo = caller.result('userGetInfo');

// API call with arguments
const call = {
    name: 'shopBuy',
    args: {
        shopId: 1576000026,
        slot: 6,
        cost: { consumable: { "85": 40000 } },
        reward: { consumable: { "55": 80 } }
    }
};
const caller = new Caller([call]);
await caller.send();
const result = caller.result('shopBuy');
```

### Using Send Function

For direct API calls:

```javascript
const response = await Send('{"calls":[{"name":"shopGetAll","args":{},"ident":"body"}]}');
```

### Translation System

Use the translation system for item names:

```javascript
// Consumable name
const translationKey = `LIB_CONSUMABLE_NAME_${consumableId}`;
const itemName = cheats.translate(translationKey);

// Fragment/Hero name
const libTypeForTranslate = 'HERO'; // or 'TITAN', etc.
const translationKey = `LIB_${libTypeForTranslate}_NAME_${itemId}`;
const itemName = cheats.translate(translationKey);
```

## Best Practices

### Error Handling

Always use try/catch blocks:

```javascript
try {
    // Your code
} catch (error) {
    console.error("Error:", error);
    HWHFuncs.setProgress(`Error: ${error.message}`, true);
}
```

### Progress Messages

Provide user feedback:

```javascript
HWHFuncs.setProgress('Starting operation...');
// ... do work ...
HWHFuncs.setProgress('Operation complete!', true); // true = auto-hide
```

### Console Logging

Use descriptive console logs:

```javascript
console.log('Extension: Starting process...');
console.log('%cSuccess!', 'color: green; font-weight: bold;');
console.error('Error occurred:', error);
```

### Code Organization

- Keep functions focused and single-purpose
- Use descriptive variable names
- Add comments for complex logic
- Follow existing code patterns from other extensions

## Examples

### Complete Extension Template

```javascript
// ==UserScript==
// @name         Example Extension HwH Ext
// @namespace    HeroWarsHelper.ExampleExtension
// @version      1.0
// @description  Example extension template
// @author       YourName
// @match        https://www.hero-wars.com/*
// @match        https://apps-1701433570146040.apps.fbsbx.com/*
// @grant        none
// @run-at       document-end
// @downloadURL https://github.com/mailming/AutoHero/raw/refs/heads/develop/Example%20Extension%20HwH%20Ext.user.js
// @updateURL https://github.com/mailming/AutoHero/raw/refs/heads/develop/Example%20Extension%20HwH%20Ext.user.js
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
        console.log('Example Extension: HWH UI is ready, initializing extension...');

        const { HWHClasses, HWHFuncs, Send, cheats, Caller, lib } = window;

        // Auto-execute function (runs on script load)
        async function autoExecute() {
            try {
                console.log('Example Extension: Auto-executing...');
                HWHFuncs.setProgress('Example Extension: Running...');
                
                // Your auto-execution code here
                
                HWHFuncs.setProgress('Example Extension: Complete!', true);
            } catch (error) {
                console.error('Example Extension: Error:', error);
                HWHFuncs.setProgress(`Example Extension: Error - ${error.message}`, true);
            }
        }

        // Manual trigger function
        async function manualFunction() {
            try {
                HWHFuncs.setProgress('Example Extension: Manual trigger...');
                
                // Your manual trigger code here
                
                HWHFuncs.setProgress('Example Extension: Done!', true);
            } catch (error) {
                console.error('Example Extension: Error:', error);
                HWHFuncs.setProgress(`Error: ${error.message}`, true);
            }
        }

        // Popup function
        async function openPopup() {
            const popupContent = document.createElement('div');
            popupContent.style.cssText = 'display: flex; flex-direction: column; height: 70vh; color: #fce1ac;';
            
            const contentContainer = document.createElement('div');
            contentContainer.style.cssText = 'flex-grow: 1; overflow-y: auto; padding: 10px;';
            contentContainer.innerHTML = '<p>Example popup content</p>';
            popupContent.appendChild(contentContainer);

            const popupPromise = HWHFuncs.popup.confirm('', [{ msg: 'Close', result: true, isClose: true }]);
            await new Promise(resolve => setTimeout(resolve, 0));
            
            const popupBody = document.querySelector('.PopUp_Container');
            if (popupBody) {
                popupBody.innerHTML = '';
                popupBody.appendChild(popupContent);
            }
            
            await popupPromise;
        }

        // Auto-execute on load
        autoExecute().catch(error => {
            console.error('Example Extension: Failed to auto-execute:', error);
        });

        // Menu integration
        const { ScriptMenu } = HWHClasses;
        const scriptMenu = ScriptMenu.getInst();
        scriptMenu.addCombinedButton([
            { name: 'Example Action', title: 'Run example action', onClick: manualFunction, color: 'green' },
            { name: '⚙️', title: 'Open Settings', onClick: openPopup }
        ]);

        console.log('Example Extension: UI initialized and attached to HWH menu.');
    }
})();
```

## Reference Extensions

Study these existing extensions for patterns:

- **Secret Wealth Shop HwH Ext.user.js** - Auto-purchase on load, popup handling
- **Advanced Auto-Buyer HwH Ext-1.6.user.js** - Complex UI, settings management

## Troubleshooting

### Extension Not Loading

- Check browser console for errors
- Verify HWH is loaded (check `window.HWHClasses`)
- Ensure all required APIs are available before use

### Popup Showing Wrong Content

- Always `await` the popup promise
- Wait a tick before modifying popup content
- Ensure popup is properly closed before opening another

### API Calls Failing

- Check network tab for request/response
- Verify API call format matches documentation
- Use try/catch for error handling

## Additional Resources

- See `SECRET_WEALTH_SHOP_API_DOCUMENTATION.md` for API examples
- Check `GUILD_WAR_API_DOCUMENTATION.md` for complex API patterns
- Review `HeroWarsHelper.user.js` for HWH API implementations

