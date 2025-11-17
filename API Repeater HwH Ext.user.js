// ==UserScript==
// @name         API Repeater HwH Ext
// @namespace    HeroWarsHelper.APIRepeater
// @version      1.0
// @description  Record and replay API calls with customizable metadata and auto-execution
// @author       AutoHero
// @match        https://www.hero-wars.com/*
// @match        https://apps-1701433570146040.apps.fbsbx.com/*
// @grant        none
// @run-at       document-start
// @downloadURL https://github.com/mailming/AutoHero/raw/refs/heads/develop/API%20Repeater%20HwH%20Ext.user.js
// @updateURL https://github.com/mailming/AutoHero/raw/refs/heads/develop/API%20Repeater%20HwH%20Ext.user.js
// ==/UserScript==

(function() {
    'use strict';

    // --- CONFIGURATION ---
    const EXTENSION_NAME = "API Repeater Extension";
    const EXTENSION_VERSION = "1.0";
    const EXTENSION_AUTHOR = "AutoHero";

    // --- STATE VARIABLES ---
    let recordings = [];
    let isRecording = false;
    let recordingBuffer = [];
    let originalSend = null;

    // --- STORAGE KEYS ---
    const STORAGE_RECORDINGS = 'apiRepeater_recordings';
    const STORAGE_SETTINGS = 'apiRepeater_settings';

    // --- API CALLS TO SKIP DURING RECORDING ---
    // These API calls will be ignored when recording
    const SKIP_API_CALLS = new Set([
        'specialOffer_check',
        'stashClient'
    ]);

    // --- EARLY API INTERCEPTION (before HWH loads) ---
    // Intercept XMLHttpRequest immediately to catch all API calls
    // This runs at document-start, before HeroWarsHelper wraps XMLHttpRequest
    (function() {
        // Store original functions before any other script modifies them
        const originalXHRSend = XMLHttpRequest.prototype.send;
        const originalXHROpen = XMLHttpRequest.prototype.open;
        
        // Intercept open to capture URL
        XMLHttpRequest.prototype.open = function(method, url, ...args) {
            this._apiRepeaterUrl = url;
            this._apiRepeaterMethod = method;
            return originalXHROpen.apply(this, [method, url, ...args]);
        };
        
        // Intercept send to capture API calls
        // Make it async to match HeroWarsHelper's wrapper
        XMLHttpRequest.prototype.send = async function(sourceData) {
            // Check if recording is active and this is an API call
            if (isRecording && this._apiRepeaterUrl && typeof this._apiRepeaterUrl === 'string') {
                const isApiCall = this._apiRepeaterUrl.includes('/api/') || 
                                 this._apiRepeaterUrl.includes('heroes-wb.nextersglobal.com') ||
                                 this._apiRepeaterUrl.includes('nextersglobal.com');
                
                if (isApiCall) {
                    try {
                        let callData = null;
                        let tempData = null;
                        
                        // Handle data the same way HeroWarsHelper does (line 2119-2123)
                        if (sourceData && typeof sourceData === 'string') {
                            tempData = sourceData;
                        } else if (sourceData instanceof ArrayBuffer) {
                            // Handle ArrayBuffer (HeroWarsHelper uses this)
                            const decoder = new TextDecoder('utf-8');
                            tempData = decoder.decode(sourceData);
                        } else {
                            tempData = sourceData;
                        }
                        
                        if (tempData && typeof tempData === 'string') {
                            callData = JSON.parse(tempData);
                            
                            if (callData) {
                                if (callData.calls && Array.isArray(callData.calls)) {
                                    // Store each call in the buffer (skip filtered APIs)
                                    callData.calls.forEach(call => {
                                        // Skip API calls in the skip list
                                        if (SKIP_API_CALLS.has(call.name)) {
                                            console.log(`API Repeater: ⊘ Skipped API call - ${call.name} (in skip list)`);
                                            return;
                                        }
                                        
                                        const capturedCall = {
                                            name: call.name,
                                            args: call.args || {},
                                            context: call.context || { actionTs: Date.now() },
                                            ident: call.ident || 'body'
                                        };
                                        recordingBuffer.push(capturedCall);
                                        console.log(`API Repeater: ✓ Captured API call - ${call.name}`, capturedCall);
                                    });
                                    console.log(`API Repeater: Buffer now has ${recordingBuffer.length} calls`);
                                } else if (callData.name && callData.args) {
                                    // Skip API calls in the skip list
                                    if (SKIP_API_CALLS.has(callData.name)) {
                                        console.log(`API Repeater: ⊘ Skipped API call - ${callData.name} (in skip list)`);
                                    } else {
                                        // Handle single call object (not wrapped in calls array)
                                        const capturedCall = {
                                            name: callData.name,
                                            args: callData.args || {},
                                            context: callData.context || { actionTs: Date.now() },
                                            ident: callData.ident || 'body'
                                        };
                                        recordingBuffer.push(capturedCall);
                                        console.log(`API Repeater: ✓ Captured single API call - ${callData.name}`, capturedCall);
                                        console.log(`API Repeater: Buffer now has ${recordingBuffer.length} calls`);
                                    }
                                }
                            }
                        }
                    } catch (e) {
                        console.error('API Repeater: Error capturing API call:', e, sourceData);
                    }
                }
            }
            
            // Call original send (this will be the wrapped version if HWH has already wrapped it)
            return await originalXHRSend.apply(this, arguments);
        };
        
        console.log('API Repeater: Early XHR interception setup complete (document-start)');
    })();

    // --- INITIALIZATION ---
    function waitForHWH(callback) {
        const interval = setInterval(() => {
            if (window.HWHClasses && window.HWHClasses.ScriptMenu && window.HWHFuncs && window.Send) {
                const scriptMenu = window.HWHClasses.ScriptMenu.getInst();
                if (scriptMenu && scriptMenu.mainMenu) {
                    clearInterval(interval);
                    callback();
                }
            }
        }, 200);
    }

    function initializeExtension() {
        console.log(`${EXTENSION_NAME} v${EXTENSION_VERSION} is loading...`);
        
        const { HWHFuncs, HWHClasses } = window;
        HWHFuncs.addExtentionName(EXTENSION_NAME, EXTENSION_VERSION, EXTENSION_AUTHOR);

        // Load recordings from storage
        loadRecordings();

        // Setup API interception
        setupAPIInterseption();
        
        // Verify interception worked
        if (originalSend) {
            console.log('API Repeater: API interception setup complete');
        } else {
            console.warn('API Repeater: API interception may not be working - originalSend is null');
        }

        // Add menu button
        const scriptMenu = HWHClasses.ScriptMenu.getInst();
        scriptMenu.addCombinedButton([
            { name: 'API Repeater', title: 'Record and replay API calls', onClick: openMainPopup, color: 'purple' }
        ]);

        // Auto-execute enabled recordings
        scheduleAutoRuns();

        console.log(`${EXTENSION_NAME} initialized successfully.`);
    }

    // --- API INTERCEPTION ---
    function setupAPIInterseption() {
        // XMLHttpRequest is already intercepted early, just wrap Send function here
        // Store original Send if available (for replay)
        if (window.Send && !originalSend) {
            originalSend = window.Send;
            window.Send = async function(data) {
                // Capture API call if recording is active (before calling original)
                if (isRecording) {
                    try {
                        let callData = data;
                        if (typeof data === 'string') {
                            callData = JSON.parse(data);
                        } else if (data && typeof data === 'object') {
                            callData = data;
                        }
                        
                        if (callData && callData.calls && Array.isArray(callData.calls)) {
                            // Store each call in the buffer (skip filtered APIs)
                            callData.calls.forEach(call => {
                                // Skip API calls in the skip list
                                if (SKIP_API_CALLS.has(call.name)) {
                                    console.log(`API Repeater: ⊘ Skipped API call via Send - ${call.name} (in skip list)`);
                                    return;
                                }
                                
                                const capturedCall = {
                                    name: call.name,
                                    args: call.args || {},
                                    context: call.context || { actionTs: Date.now() },
                                    ident: call.ident || 'body'
                                };
                                recordingBuffer.push(capturedCall);
                                console.log(`API Repeater: ✓ Captured API call via Send - ${call.name}`, capturedCall);
                            });
                            console.log(`API Repeater: Buffer now has ${recordingBuffer.length} calls`);
                        }
                    } catch (e) {
                        console.error('API Repeater: Error capturing API call from Send:', e, data);
                    }
                }
                
                // Call original Send function (preserve async behavior)
                return await originalSend.apply(this, arguments);
            };
            console.log('API Repeater: Send function wrapped');
        }
        
        console.log('API Repeater: API interception setup complete (XHR already intercepted early)');
    }

    // --- STORAGE SYSTEM ---
    function loadRecordings() {
        const { HWHFuncs } = window;
        recordings = HWHFuncs.getSaveVal(STORAGE_RECORDINGS, []);
        
        // Validate and clean up recordings
        recordings = recordings.filter(rec => rec && rec.id && rec.apiCalls && Array.isArray(rec.apiCalls));
        
        // Check expiration and disable auto-run for expired recordings
        const now = Date.now();
        let hasChanges = false;
        recordings.forEach(rec => {
            if (rec.expirationDays > 0 && rec.expiresAt && now > rec.expiresAt) {
                if (rec.autoRun) {
                    rec.autoRun = false;
                    hasChanges = true;
                }
            }
        });
        
        if (hasChanges) {
            saveRecordings();
        }
    }

    function saveRecordings() {
        const { HWHFuncs } = window;
        HWHFuncs.setSaveVal(STORAGE_RECORDINGS, recordings);
    }

    // --- RECORDING MANAGEMENT ---
    function startRecording() {
        isRecording = true;
        recordingBuffer = [];
        const { HWHFuncs } = window;
        console.log('API Repeater: Recording started. Buffer cleared.');
        console.log('API Repeater: Send function type:', typeof window.Send);
        console.log('API Repeater: originalSend type:', typeof originalSend);
        console.log('API Repeater: isRecording =', isRecording);
        HWHFuncs.setProgress('API Repeater: Recording started', true);
    }

    function stopRecording() {
        isRecording = false;
        const { HWHFuncs } = window;
        console.log(`API Repeater: Recording stopped. Captured ${recordingBuffer.length} API call(s)`);
        HWHFuncs.setProgress(`API Repeater: Recording stopped - ${recordingBuffer.length} calls captured`, true);
    }

    function createRecording(name, description, expirationDays, autoRun) {
        const recording = {
            id: Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9),
            name: name || 'Unnamed Recording',
            description: description || '',
            createdAt: Date.now(),
            expirationDays: expirationDays || 0,
            expiresAt: expirationDays > 0 ? Date.now() + (expirationDays * 24 * 60 * 60 * 1000) : null,
            autoRun: autoRun || false,
            apiCalls: [...recordingBuffer]
        };
        
        recordings.push(recording);
        saveRecordings();
        recordingBuffer = [];
        return recording;
    }

    function updateRecording(id, updates) {
        const recording = recordings.find(r => r.id === id);
        if (!recording) return false;
        
        Object.assign(recording, updates);
        
        // Recalculate expiration if expirationDays changed
        if (updates.expirationDays !== undefined) {
            if (updates.expirationDays > 0) {
                recording.expiresAt = recording.createdAt + (updates.expirationDays * 24 * 60 * 60 * 1000);
            } else {
                recording.expiresAt = null;
            }
        }
        
        saveRecordings();
        return true;
    }

    function deleteRecording(id) {
        const index = recordings.findIndex(r => r.id === id);
        if (index === -1) return false;
        
        recordings.splice(index, 1);
        saveRecordings();
        return true;
    }

    // --- EXECUTION SYSTEM ---
    async function executeRecording(recording) {
        const { Send, HWHFuncs } = window;
        
        if (!recording || !recording.apiCalls || recording.apiCalls.length === 0) {
            HWHFuncs.setProgress(`API Repeater: ${recording.name} - No API calls to execute`, true);
            return;
        }

        HWHFuncs.setProgress(`API Repeater: Executing ${recording.name}...`, true);
        
        let successCount = 0;
        let failureCount = 0;
        const errors = [];
        
        // Execute API calls one by one to avoid duplicate ident errors
        for (let i = 0; i < recording.apiCalls.length; i++) {
            const call = recording.apiCalls[i];
            
            try {
                // Prepare call with updated timestamp and unique ident
                const callToExecute = {
                    name: call.name,
                    args: call.args,
                    context: { actionTs: Math.floor(performance.now()) },
                    ident: 'body' // Use 'body' for single calls (API requirement)
                };

                // Execute single API call
                const response = await Send({ calls: [callToExecute] });
                
                // Check for API errors in response
                if (response && response.error) {
                    const errorMsg = `API Error: ${response.error.name || 'Unknown'} - ${response.error.description || 'No description'}`;
                    errors.push({
                        callIndex: i + 1,
                        callName: call.name,
                        error: errorMsg,
                        fullError: response.error
                    });
                    failureCount++;
                    console.error(`API Repeater: Call ${i + 1}/${recording.apiCalls.length} (${call.name}) failed:`, errorMsg);
                    HWHFuncs.setProgress(`API Repeater: ${recording.name} - Call ${i + 1}/${recording.apiCalls.length} (${call.name}) failed: ${errorMsg}`, true);
                } else {
                    successCount++;
                    console.log(`API Repeater: Call ${i + 1}/${recording.apiCalls.length} (${call.name}) succeeded`);
                }
                
            } catch (e) {
                // Handle execution errors (network, timeout, etc.)
                const errorMsg = e.message || String(e);
                errors.push({
                    callIndex: i + 1,
                    callName: call.name,
                    error: errorMsg,
                    fullError: e
                });
                failureCount++;
                console.error(`API Repeater: Call ${i + 1}/${recording.apiCalls.length} (${call.name}) threw error:`, e);
                HWHFuncs.setProgress(`API Repeater: ${recording.name} - Call ${i + 1}/${recording.apiCalls.length} (${call.name}) error: ${errorMsg}`, true);
            }
            
            // Add delay between calls (similar to Auto Daily Extension)
            if (i < recording.apiCalls.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
            }
        }
        
        // Final summary
        const summary = `API Repeater: ${recording.name} - Completed: ${successCount} succeeded, ${failureCount} failed out of ${recording.apiCalls.length} total`;
        console.log(summary);
        
        if (errors.length > 0) {
            console.error(`API Repeater: ${recording.name} - Errors:`, errors);
            const errorDetails = errors.map(e => `Call ${e.callIndex} (${e.callName}): ${e.error}`).join('; ');
            HWHFuncs.setProgress(`${summary}. Errors: ${errorDetails}`, true);
        } else {
            HWHFuncs.setProgress(`${summary}`, true);
        }
    }

    function scheduleAutoRuns() {
        const now = Date.now();
        const enabledRecordings = recordings.filter(rec => {
            if (!rec.autoRun) return false;
            if (rec.expirationDays > 0 && rec.expiresAt && now > rec.expiresAt) return false;
            return true;
        });

        if (enabledRecordings.length === 0) return;

        // Execute recordings with delays (similar to Auto Daily Extension)
        const initialDelay = 10000;
        enabledRecordings.forEach((recording, index) => {
            const delay = initialDelay + (index * 3000);
            setTimeout(() => executeRecording(recording), delay);
        });
    }

    // --- EXPORT/IMPORT ---
    function exportRecordings() {
        const { HWHFuncs } = window;
        const dataToExport = {
            recordings: recordings,
            exportDate: new Date().toISOString(),
            version: EXTENSION_VERSION
        };
        
        const dataStr = JSON.stringify(dataToExport, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `api_repeater_recordings_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        HWHFuncs.setProgress('API Repeater: Recordings exported!', true);
    }

    function importRecordings() {
        const { HWHFuncs } = window;
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = e => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = readerEvent => {
                try {
                    const importedData = JSON.parse(readerEvent.target.result);
                    
                    if (!importedData.recordings || !Array.isArray(importedData.recordings)) {
                        throw new Error('Invalid file structure');
                    }
                    
                    // Validate recordings structure
                    const validRecordings = importedData.recordings.filter(rec => 
                        rec && rec.id && rec.apiCalls && Array.isArray(rec.apiCalls)
                    );
                    
                    if (validRecordings.length === 0) {
                        throw new Error('No valid recordings found in file');
                    }
                    
                    // Replace existing recordings
                    recordings = validRecordings;
                    saveRecordings();
                    
                    HWHFuncs.setProgress(`API Repeater: Imported ${validRecordings.length} recording(s)!`, true);
                    
                    // Refresh popup if open
                    const popup = document.getElementById('api-repeater-popup-container');
                    if (popup) {
                        popup.remove();
                        openMainPopup();
                    }
                } catch (err) {
                    alert('Error importing file: ' + err.message);
                    console.error('API Repeater: Import error:', err);
                }
            };
            reader.readAsText(file, 'UTF-8');
        };
        input.click();
    }

    // --- UI COMPONENTS ---
    function formatDate(timestamp) {
        if (!timestamp) return 'Never';
        const date = new Date(timestamp);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    }

    function isExpired(recording) {
        if (recording.expirationDays === 0) return false;
        if (!recording.expiresAt) return false;
        return Date.now() > recording.expiresAt;
    }

    async function openMainPopup() {
        const { HWHFuncs } = window;
        
        if (document.getElementById('api-repeater-popup-container')) return;

        const styles = `
            .api-repeater-popup-backdrop { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 10001; }
            .api-repeater-popup-main { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: #190e08e6; border: 3px #ce9767 solid; border-radius: 10px; z-index: 10002; color: #fce1ac; padding: 20px; min-width: 900px; max-width: 1200px; max-height: 80vh; overflow-y: auto; display: flex; flex-direction: column; gap: 20px; }
            .api-repeater-popup-main h2 { text-align: center; margin-top: 0; border-bottom: 1px solid #ce9767; padding-bottom: 10px; }
            .api-repeater-controls { display: flex; gap: 10px; align-items: center; padding: 10px; background: rgba(0,0,0,0.3); border-radius: 5px; }
            .api-repeater-recording-list { list-style: none; padding: 0; margin: 0; }
            .api-repeater-recording-item { display: flex; align-items: center; justify-content: space-between; padding: 12px; border-bottom: 1px solid #4a3422; background: rgba(0,0,0,0.2); }
            .api-repeater-recording-item:last-child { border-bottom: none; }
            .api-repeater-recording-info { flex-grow: 1; margin-right: 15px; }
            .api-repeater-recording-name { font-weight: bold; color: #ffd700; margin-bottom: 5px; }
            .api-repeater-recording-description { font-size: 0.9em; color: #ccc; margin-bottom: 5px; }
            .api-repeater-recording-meta { font-size: 0.8em; color: #aaa; }
            .api-repeater-recording-actions { display: flex; gap: 8px; align-items: center; }
            .api-repeater-btn { cursor: pointer; font-size: 18px; background: none; border: none; padding: 5px 8px; transition: transform 0.2s; color: #fce1ac; }
            .api-repeater-btn:hover { transform: scale(1.2); }
            .api-repeater-btn-danger { color: #ff6b6b; }
            .api-repeater-btn-success { color: #4CAF50; }
            .api-repeater-close-btn { position: absolute; top: 5px; right: 10px; font-size: 24px; color: #ce9767; cursor: pointer; border: none; background: none; }
            .api-repeater-footer { border-top: 1px solid #ce9767; margin-top: 15px; padding-top: 15px; display: flex; justify-content: space-around; flex-wrap: wrap; gap: 10px; }
            .api-repeater-status-badge { display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 0.75em; margin-left: 8px; }
            .api-repeater-status-expired { background: #ff6b6b; color: white; }
            .api-repeater-status-active { background: #4CAF50; color: white; }
            .api-repeater-status-recording { background: #ff4444; color: white; animation: pulse 1s infinite; }
            @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
            .api-repeater-edit-popup-main { min-width: 500px !important; }
        `;
        
        const styleSheet = document.createElement("style");
        styleSheet.innerText = styles;
        document.head.appendChild(styleSheet);

        const backdrop = document.createElement('div');
        backdrop.className = 'api-repeater-popup-backdrop';
        backdrop.id = 'api-repeater-popup-container';
        
        const popup = document.createElement('div');
        popup.className = 'api-repeater-popup-main';
        
        // Recording controls
        const recordingStatus = isRecording ? '🔴 Recording' : '⚪ Stopped';
        const recordingStatusClass = isRecording ? 'api-repeater-status-recording' : '';
        
        popup.innerHTML = `
            <button class="api-repeater-close-btn">&times;</button>
            <h2>API Repeater</h2>
            <div class="api-repeater-controls">
                <button id="start-recording-btn" class="api-repeater-btn" style="font-size: 16px; padding: 8px 15px; background: ${isRecording ? '#ff4444' : '#4CAF50'}; border-radius: 5px;">
                    ${isRecording ? '⏹ Stop Recording' : '⏺ Start Recording'}
                </button>
                <span class="api-repeater-status-badge ${recordingStatusClass}">${recordingStatus}</span>
                <span style="margin-left: auto; color: #aaa;">Captured: ${recordingBuffer.length} calls</span>
            </div>
            <div>
                <h3 style="margin-top: 0; border-bottom: 1px solid #4a3422; padding-bottom: 5px;">Saved Recordings (${recordings.length})</h3>
                <ul class="api-repeater-recording-list" id="recordings-list"></ul>
            </div>
            <div class="api-repeater-footer">
                <button id="export-btn" class="api-repeater-btn" style="font-size: 16px; padding: 8px 15px; background: #4CAF50; border-radius: 5px;">💾 Export</button>
                <button id="import-btn" class="api-repeater-btn" style="font-size: 16px; padding: 8px 15px; background: #2196F3; border-radius: 5px;">📥 Import</button>
            </div>
        `;
        
        backdrop.appendChild(popup);
        document.body.appendChild(backdrop);
        
        // Populate recordings list
        populateRecordingsList();
        
        // Event listeners
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop || e.target.classList.contains('api-repeater-close-btn')) {
                backdrop.remove();
            }
        });
        
        document.getElementById('start-recording-btn').addEventListener('click', () => {
            if (isRecording) {
                stopRecording();
                backdrop.remove();
                // If we have captured calls, open the save dialog
                if (recordingBuffer.length > 0) {
                    openCreateRecordingPopup();
                } else {
                    // No calls captured, just refresh the main popup
                    const { HWHFuncs } = window;
                    HWHFuncs.setProgress('API Repeater: No API calls captured', true);
                    openMainPopup();
                }
            } else {
                startRecording();
                backdrop.remove();
                openMainPopup();
            }
        });
        
        document.getElementById('export-btn').addEventListener('click', exportRecordings);
        document.getElementById('import-btn').addEventListener('click', importRecordings);
    }

    function populateRecordingsList() {
        const list = document.getElementById('recordings-list');
        if (!list) return;
        
        list.innerHTML = '';
        
        if (recordings.length === 0) {
            list.innerHTML = '<li style="padding: 20px; text-align: center; color: #aaa;">No recordings saved yet</li>';
            return;
        }
        
        recordings.forEach(recording => {
            const li = document.createElement('li');
            li.className = 'api-repeater-recording-item';
            
            const expired = isExpired(recording);
            const expiredBadge = expired ? '<span class="api-repeater-status-badge api-repeater-status-expired">Expired</span>' : '';
            const activeBadge = recording.autoRun ? '<span class="api-repeater-status-badge api-repeater-status-active">Auto-Run</span>' : '';
            
            li.innerHTML = `
                <div class="api-repeater-recording-info">
                    <div class="api-repeater-recording-name">
                        ${recording.name} ${expiredBadge} ${activeBadge}
                    </div>
                    <div class="api-repeater-recording-description">${recording.description || 'No description'}</div>
                    <div class="api-repeater-recording-meta">
                        Calls: ${recording.apiCalls.length} | 
                        Created: ${formatDate(recording.createdAt)} | 
                        Expires: ${recording.expirationDays === 0 ? 'Never' : formatDate(recording.expiresAt)}
                    </div>
                </div>
                <div class="api-repeater-recording-actions">
                    <button class="api-repeater-btn api-repeater-btn-success" title="Run" data-action="run" data-id="${recording.id}">🔥</button>
                    <label style="cursor: pointer;">
                        <input type="checkbox" ${recording.autoRun ? 'checked' : ''} data-action="toggle-autorun" data-id="${recording.id}" style="margin-right: 5px;">
                        <span style="font-size: 0.9em;">Auto</span>
                    </label>
                    <button class="api-repeater-btn" title="Edit" data-action="edit" data-id="${recording.id}">✏️</button>
                    <button class="api-repeater-btn api-repeater-btn-danger" title="Delete" data-action="delete" data-id="${recording.id}">🗑️</button>
                </div>
            `;
            
            list.appendChild(li);
        });
        
        // Add event listeners for actions
        list.addEventListener('click', (e) => {
            const action = e.target.closest('[data-action]');
            if (!action) return;
            
            const actionType = action.dataset.action;
            const recordingId = action.dataset.id;
            const recording = recordings.find(r => r.id === recordingId);
            
            if (!recording) return;
            
            if (actionType === 'run') {
                executeRecording(recording);
            } else if (actionType === 'delete') {
                if (confirm(`Delete recording "${recording.name}"?`)) {
                    deleteRecording(recordingId);
                    populateRecordingsList();
                }
            } else if (actionType === 'edit') {
                openEditRecordingPopup(recording);
            }
        });
        
        list.addEventListener('change', (e) => {
            if (e.target.dataset.action === 'toggle-autorun') {
                const recordingId = e.target.dataset.id;
                updateRecording(recordingId, { autoRun: e.target.checked });
                populateRecordingsList();
            }
        });
    }

    async function openCreateRecordingPopup() {
        const { HWHFuncs } = window;
        
        if (recordingBuffer.length === 0) {
            HWHFuncs.setProgress('API Repeater: No API calls captured', true);
            return;
        }
        
        const backdrop = document.createElement('div');
        backdrop.className = 'api-repeater-popup-backdrop';
        backdrop.id = 'api-repeater-create-popup-container';
        
        const popup = document.createElement('div');
        popup.className = 'api-repeater-popup-main api-repeater-edit-popup-main';
        
        popup.innerHTML = `
            <button class="api-repeater-close-btn">&times;</button>
            <h2>Save Recording</h2>
            <div style="display: flex; flex-direction: column; gap: 15px;">
                <div>
                    <label style="display: block; margin-bottom: 5px;">Name:</label>
                    <input type="text" id="recording-name" style="width: 100%; padding: 8px; background: rgba(0,0,0,0.5); border: 1px solid #ce9767; border-radius: 5px; color: #fce1ac;" value="Recording ${new Date().toLocaleString()}">
                </div>
                <div>
                    <label style="display: block; margin-bottom: 5px;">Description:</label>
                    <textarea id="recording-description" style="width: 100%; padding: 8px; background: rgba(0,0,0,0.5); border: 1px solid #ce9767; border-radius: 5px; color: #fce1ac; min-height: 80px;"></textarea>
                </div>
                <div>
                    <label style="display: block; margin-bottom: 5px;">Expiration (days, 0 = never):</label>
                    <input type="number" id="recording-expiration" min="0" value="0" style="width: 100%; padding: 8px; background: rgba(0,0,0,0.5); border: 1px solid #ce9767; border-radius: 5px; color: #fce1ac;">
                </div>
                <div>
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                        <input type="checkbox" id="recording-autorun">
                        <span>Auto-run on game load</span>
                    </label>
                </div>
                <div style="color: #aaa; font-size: 0.9em;">
                    Captured ${recordingBuffer.length} API call(s)
                </div>
                <div style="display: flex; justify-content: space-around; margin-top: 15px;">
                    <button id="save-recording-btn" style="padding: 10px 20px; background: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer;">Save</button>
                    <button id="cancel-recording-btn" style="padding: 10px 20px; background: #666; color: white; border: none; border-radius: 5px; cursor: pointer;">Cancel</button>
                </div>
            </div>
        `;
        
        backdrop.appendChild(popup);
        document.body.appendChild(backdrop);
        
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop || e.target.classList.contains('api-repeater-close-btn') || e.target.id === 'cancel-recording-btn') {
                backdrop.remove();
                // Clear the buffer if user cancels
                if (e.target.id === 'cancel-recording-btn' || e.target.classList.contains('api-repeater-close-btn')) {
                    recordingBuffer = [];
                }
                // Refresh main popup
                openMainPopup();
            }
        });
        
        document.getElementById('save-recording-btn').addEventListener('click', () => {
            const name = document.getElementById('recording-name').value.trim();
            const description = document.getElementById('recording-description').value.trim();
            const expirationDays = parseInt(document.getElementById('recording-expiration').value) || 0;
            const autoRun = document.getElementById('recording-autorun').checked;
            
            if (!name) {
                alert('Please enter a name for the recording');
                return;
            }
            
            createRecording(name, description, expirationDays, autoRun);
            backdrop.remove();
            
            const mainPopup = document.getElementById('api-repeater-popup-container');
            if (mainPopup) {
                mainPopup.remove();
            }
            openMainPopup();
        });
    }

    async function openEditRecordingPopup(recording) {
        const backdrop = document.createElement('div');
        backdrop.className = 'api-repeater-popup-backdrop';
        backdrop.id = 'api-repeater-edit-popup-container';
        
        const popup = document.createElement('div');
        popup.className = 'api-repeater-popup-main api-repeater-edit-popup-main';
        
        popup.innerHTML = `
            <button class="api-repeater-close-btn">&times;</button>
            <h2>Edit Recording</h2>
            <div style="display: flex; flex-direction: column; gap: 15px;">
                <div>
                    <label style="display: block; margin-bottom: 5px;">Name:</label>
                    <input type="text" id="edit-recording-name" style="width: 100%; padding: 8px; background: rgba(0,0,0,0.5); border: 1px solid #ce9767; border-radius: 5px; color: #fce1ac;" value="${recording.name}">
                </div>
                <div>
                    <label style="display: block; margin-bottom: 5px;">Description:</label>
                    <textarea id="edit-recording-description" style="width: 100%; padding: 8px; background: rgba(0,0,0,0.5); border: 1px solid #ce9767; border-radius: 5px; color: #fce1ac; min-height: 80px;">${recording.description || ''}</textarea>
                </div>
                <div>
                    <label style="display: block; margin-bottom: 5px;">Expiration (days, 0 = never):</label>
                    <input type="number" id="edit-recording-expiration" min="0" value="${recording.expirationDays || 0}" style="width: 100%; padding: 8px; background: rgba(0,0,0,0.5); border: 1px solid #ce9767; border-radius: 5px; color: #fce1ac;">
                </div>
                <div>
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                        <input type="checkbox" id="edit-recording-autorun" ${recording.autoRun ? 'checked' : ''}>
                        <span>Auto-run on game load</span>
                    </label>
                </div>
                <div style="color: #aaa; font-size: 0.9em;">
                    Contains ${recording.apiCalls.length} API call(s)
                </div>
                <div style="display: flex; justify-content: space-around; margin-top: 15px;">
                    <button id="update-recording-btn" style="padding: 10px 20px; background: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer;">Update</button>
                    <button id="cancel-edit-btn" style="padding: 10px 20px; background: #666; color: white; border: none; border-radius: 5px; cursor: pointer;">Cancel</button>
                </div>
            </div>
        `;
        
        backdrop.appendChild(popup);
        document.body.appendChild(backdrop);
        
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop || e.target.classList.contains('api-repeater-close-btn') || e.target.id === 'cancel-edit-btn') {
                backdrop.remove();
            }
        });
        
        document.getElementById('update-recording-btn').addEventListener('click', () => {
            const name = document.getElementById('edit-recording-name').value.trim();
            const description = document.getElementById('edit-recording-description').value.trim();
            const expirationDays = parseInt(document.getElementById('edit-recording-expiration').value) || 0;
            const autoRun = document.getElementById('edit-recording-autorun').checked;
            
            if (!name) {
                alert('Please enter a name for the recording');
                return;
            }
            
            updateRecording(recording.id, {
                name,
                description,
                expirationDays,
                autoRun
            });
            
            backdrop.remove();
            
            const mainPopup = document.getElementById('api-repeater-popup-container');
            if (mainPopup) {
                populateRecordingsList();
            } else {
                openMainPopup();
            }
        });
    }

    // Start initialization
    waitForHWH(initializeExtension);

})();

