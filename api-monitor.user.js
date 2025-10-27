// ==UserScript==
// @name         Hero Wars API Monitor
// @namespace    http://tampermonkey.net/
// @version      2.3
// @description  Comprehensive API monitoring for Hero Wars and other web applications with file logging
// @author       AutoHero Project
// @match        *://heroes-wb.nextersglobal.com/*
// @match        *://*.nextersglobal.com/*
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM_download
// @grant        unsafeWindow
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';
    
    // Configuration
    const CONFIG = {
        maxRequests: 1000,
        maxResponseSize: 1024 * 1024, // 1MB
        enableUI: true, // Enable UI for testing and debugging
        enableExport: true,
        enableFiltering: true,
        logLevel: 'all', // 'all', 'errors', 'requests', 'responses'
        enableFileLogging: true, // Enable file logging by default
        logToFileInterval: 3000, // Log to file every 3 seconds (more frequent)
        maxLogFileSize: 10 * 1024 * 1024, // 10MB max log file size
        logFormat: 'json' // 'json', 'text', 'csv'
    };
    
    // Initialize API Monitor - Make it globally accessible
    const apiMonitor = {
        requests: [],
        responses: [],
        errors: [],
        pendingLogs: [], // New logs waiting to be written to file
        stats: {
            totalRequests: 0,
            totalResponses: 0,
            totalErrors: 0,
            startTime: Date.now(),
            logsWritten: 0,
            lastLogTime: Date.now()
        },
        
        // Add request to monitor
        addRequest: function(req) {
            if (apiMonitor.requests.length >= CONFIG.maxRequests) {
                apiMonitor.requests.shift(); // Remove oldest
            }
            
            apiMonitor.requests.push(req);
            apiMonitor.stats.totalRequests++;
            
            if (CONFIG.logLevel === 'all' || CONFIG.logLevel === 'requests') {
                console.log('🔵 API_REQUEST:', JSON.stringify(req, null, 2));
            }
            
            // Add to pending logs for file writing
            if (CONFIG.enableFileLogging) {
                apiMonitor.pendingLogs.push({
                    type: 'request',
                    data: req,
                    timestamp: new Date().toISOString()
                });
                console.log('🔍 DEBUG: Added request to pendingLogs, count =', apiMonitor.pendingLogs.length);
            }
            
            apiMonitor.updateUI();
        },
        
        // Add response to monitor
        addResponse: function(resp) {
            if (apiMonitor.responses.length >= CONFIG.maxRequests) {
                apiMonitor.responses.shift(); // Remove oldest
            }
            
            apiMonitor.responses.push(resp);
            apiMonitor.stats.totalResponses++;
            
            if (CONFIG.logLevel === 'all' || CONFIG.logLevel === 'responses') {
                console.log('🟢 API_RESPONSE:', JSON.stringify(resp, null, 2));
            }
            
            // Add to pending logs for file writing
            if (CONFIG.enableFileLogging) {
                apiMonitor.pendingLogs.push({
                    type: 'response',
                    data: resp,
                    timestamp: new Date().toISOString()
                });
            }
            
            apiMonitor.updateUI();
        },
        
        // Add error to monitor
        addError: function(err) {
            if (apiMonitor.errors.length >= CONFIG.maxRequests) {
                apiMonitor.errors.shift(); // Remove oldest
            }
            
            apiMonitor.errors.push(err);
            apiMonitor.stats.totalErrors++;
            
            if (CONFIG.logLevel === 'all' || CONFIG.logLevel === 'errors') {
                console.log('🔴 API_ERROR:', JSON.stringify(err, null, 2));
            }
            
            // Add to pending logs for file writing
            if (CONFIG.enableFileLogging) {
                apiMonitor.pendingLogs.push({
                    type: 'error',
                    data: err,
                    timestamp: new Date().toISOString()
                });
            }
            
            apiMonitor.updateUI();
        },
        
        // Get all data
        getAllData: function() {
            return {
                requests: apiMonitor.requests,
                responses: apiMonitor.responses,
                errors: apiMonitor.errors,
                stats: apiMonitor.stats,
                timestamp: new Date().toISOString(),
                url: window.location.href
            };
        },
        
        // Clear all data
        clearData: function() {
            apiMonitor.requests = [];
            apiMonitor.responses = [];
            apiMonitor.errors = [];
            apiMonitor.pendingLogs = [];
            apiMonitor.stats = {
                totalRequests: 0,
                totalResponses: 0,
                totalErrors: 0,
                startTime: Date.now(),
                logsWritten: 0,
                lastLogTime: Date.now()
            };
            apiMonitor.updateUI();
            console.log('🧹 API Monitor data cleared');
        },
        
        // Write logs to file
        writeLogsToFile: function() {
            console.log('🔍 DEBUG: writeLogsToFile called');
            console.log('🔍 DEBUG: enableFileLogging =', CONFIG.enableFileLogging);
            console.log('🔍 DEBUG: pendingLogs.length =', apiMonitor.pendingLogs.length);
            
            if (!CONFIG.enableFileLogging || apiMonitor.pendingLogs.length === 0) {
                console.log('🔍 DEBUG: Skipping file write - logging disabled or no pending logs');
                return;
            }
            
            try {
                console.log('🔍 DEBUG: Starting file write process');
                let logContent = '';
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                console.log('🔍 DEBUG: Generated timestamp =', timestamp);
                
                if (CONFIG.logFormat === 'json') {
                    logContent = JSON.stringify({
                        session: {
                            url: window.location.href,
                            timestamp: new Date().toISOString(),
                            logsCount: apiMonitor.pendingLogs.length
                        },
                        logs: apiMonitor.pendingLogs
                    }, null, 2);
                } else if (CONFIG.logFormat === 'text') {
                    logContent = apiMonitor.pendingLogs.map(log => {
                        return `[${log.timestamp}] ${log.type.toUpperCase()}: ${JSON.stringify(log.data, null, 2)}`;
                    }).join('\n\n');
                } else if (CONFIG.logFormat === 'csv') {
                    const headers = 'timestamp,type,url,method,status,error\n';
                    const rows = apiMonitor.pendingLogs.map(log => {
                        const data = log.data;
                        const url = data.url || '';
                        const method = data.method || '';
                        const status = data.status || '';
                        const error = data.error || '';
                        return `${log.timestamp},${log.type},"${url}","${method}","${status}","${error}"`;
                    }).join('\n');
                    logContent = headers + rows;
                }
                
                // Create filename with timestamp
                const filename = `api-logs-${timestamp}.${CONFIG.logFormat === 'json' ? 'json' : CONFIG.logFormat === 'csv' ? 'csv' : 'txt'}`;
                console.log('🔍 DEBUG: Generated filename =', filename);
                console.log('🔍 DEBUG: Log content length =', logContent.length);
                
                // Use GM_download to save file
                console.log('🔍 DEBUG: Calling GM_download...');
                GM_download(logContent, filename, 'text/plain');
                console.log('🔍 DEBUG: GM_download called successfully');
                
                // Update stats
                apiMonitor.stats.logsWritten += apiMonitor.pendingLogs.length;
                apiMonitor.stats.lastLogTime = Date.now();
                
                console.log(`📁 Logged ${apiMonitor.pendingLogs.length} entries to file: ${filename}`);
                
                // Clear pending logs
                apiMonitor.pendingLogs = [];
                
            } catch (error) {
                console.error('❌ Error writing logs to file:', error);
                console.error('🔍 DEBUG: Error details:', error.message, error.stack);
            }
        },
        
        // Force write logs to file immediately
        forceWriteLogs: function() {
            apiMonitor.writeLogsToFile();
        },
        
        // Get log statistics
        getLogStats: function() {
            return {
                totalLogsWritten: apiMonitor.stats.logsWritten,
                pendingLogs: apiMonitor.pendingLogs.length,
                lastLogTime: apiMonitor.stats.lastLogTime,
                logFormat: CONFIG.logFormat,
                fileLoggingEnabled: CONFIG.enableFileLogging
            };
        },
        
        // Export data
        exportData: function(format = 'json') {
            const data = apiMonitor.getAllData();
            
            if (format === 'json') {
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `api-monitor-${Date.now()}.json`;
                a.click();
                URL.revokeObjectURL(url);
            } else if (format === 'har') {
                // Convert to HAR format
                const har = this.convertToHAR(data);
                const blob = new Blob([JSON.stringify(har, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `api-monitor-${Date.now()}.har`;
                a.click();
                URL.revokeObjectURL(url);
            }
        },
        
        // Convert to HAR format
        convertToHAR: function(data) {
            const har = {
                log: {
                    version: "1.2",
                    creator: {
                        name: "Hero Wars API Monitor",
                        version: "2.0"
                    },
                    entries: []
                }
            };
            
            data.requests.forEach((req, index) => {
                const response = data.responses.find(r => r.requestId === req.id);
                const error = data.errors.find(e => e.requestId === req.id);
                
                const entry = {
                    startedDateTime: req.timestamp,
                    time: response ? new Date(response.timestamp) - new Date(req.timestamp) : 0,
                    request: {
                        method: req.method,
                        url: req.url,
                        httpVersion: "HTTP/1.1",
                        headers: Object.entries(req.headers).map(([name, value]) => ({ name, value })),
                        queryString: [],
                        cookies: [],
                        headersSize: JSON.stringify(req.headers).length,
                        bodySize: req.body ? JSON.stringify(req.body).length : 0,
                        postData: req.body ? {
                            mimeType: "application/json",
                            text: JSON.stringify(req.body)
                        } : undefined
                    },
                    response: response ? {
                        status: response.status,
                        statusText: response.statusText,
                        httpVersion: "HTTP/1.1",
                        headers: Object.entries(response.headers).map(([name, value]) => ({ name, value })),
                        cookies: [],
                        content: {
                            size: JSON.stringify(response.body).length,
                            mimeType: response.headers['content-type'] || 'application/json',
                            text: typeof response.body === 'string' ? response.body : JSON.stringify(response.body)
                        },
                        redirectURL: "",
                        headersSize: JSON.stringify(response.headers).length,
                        bodySize: JSON.stringify(response.body).length
                    } : undefined,
                    cache: {},
                    timings: {
                        blocked: 0,
                        dns: 0,
                        connect: 0,
                        send: 0,
                        wait: 0,
                        receive: 0
                    }
                };
                
                if (error) {
                    entry.response = {
                        status: 0,
                        statusText: "Error",
                        httpVersion: "HTTP/1.1",
                        headers: [],
                        cookies: [],
                        content: {
                            size: error.error.length,
                            mimeType: "text/plain",
                            text: error.error
                        },
                        redirectURL: "",
                        headersSize: 0,
                        bodySize: error.error.length
                    };
                }
                
                har.log.entries.push(entry);
            });
            
            return har;
        },
        
        // Update UI
        updateUI: function() {
            if (!CONFIG.enableUI) return;
            
            const statsElement = document.getElementById('api-monitor-stats');
            if (statsElement) {
                const runtime = Math.round((Date.now() - apiMonitor.stats.startTime) / 1000);
                const logsWritten = apiMonitor.stats.logsWritten;
                const pendingLogs = apiMonitor.pendingLogs.length;
                
                // Clear and rebuild stats element safely
                statsElement.textContent = '';
                const statsDiv = document.createElement('div');
                statsDiv.style.cssText = 'background: #f0f0f0; padding: 10px; border-radius: 5px; margin: 10px 0; font-family: monospace;';
                
                const title = document.createElement('strong');
                title.textContent = 'API Monitor Stats:';
                statsDiv.appendChild(title);
                
                const br1 = document.createElement('br');
                statsDiv.appendChild(br1);
                
                const statsText = document.createElement('span');
                statsText.textContent = `Requests: ${apiMonitor.stats.totalRequests} | Responses: ${apiMonitor.stats.totalResponses} | Errors: ${apiMonitor.stats.totalErrors} | Runtime: ${runtime}s`;
                statsDiv.appendChild(statsText);
                
                const br2 = document.createElement('br');
                statsDiv.appendChild(br2);
                
                const logStatus = document.createElement('span');
                logStatus.style.color = CONFIG.enableFileLogging ? 'green' : 'red';
                logStatus.textContent = `📁 File Logging: ${CONFIG.enableFileLogging ? 'ON' : 'OFF'} | Written: ${logsWritten} | Pending: ${pendingLogs}`;
                statsDiv.appendChild(logStatus);
                
                statsElement.appendChild(statsDiv);
            }
        },
        
        // Show data in popup
        showData: function() {
            const data = apiMonitor.getAllData();
            const popup = window.open('', 'API Monitor Data', 'width=1200,height=800,scrollbars=yes');
            
            popup.document.write(`
                <html>
                <head>
                    <title>API Monitor Results</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 20px; }
                        .section { margin: 20px 0; }
                        .request, .response, .error { 
                            border: 1px solid #ddd; 
                            margin: 10px 0; 
                            padding: 10px; 
                            border-radius: 5px; 
                        }
                        .request { background: #e3f2fd; }
                        .response { background: #e8f5e8; }
                        .error { background: #ffebee; }
                        pre { white-space: pre-wrap; word-wrap: break-word; }
                        .stats { background: #f5f5f5; padding: 15px; border-radius: 5px; }
                        button { margin: 5px; padding: 10px; cursor: pointer; }
                    </style>
                </head>
                <body>
                    <h1>API Monitor Results</h1>
                    
                    <div class="stats">
                        <h3>Statistics</h3>
                        <p><strong>URL:</strong> ${data.url}</p>
                        <p><strong>Timestamp:</strong> ${data.timestamp}</p>
                        <p><strong>Total Requests:</strong> ${data.stats.totalRequests}</p>
                        <p><strong>Total Responses:</strong> ${data.stats.totalResponses}</p>
                        <p><strong>Total Errors:</strong> ${data.stats.totalErrors}</p>
                        <p><strong>Runtime:</strong> ${Math.round((Date.now() - data.stats.startTime) / 1000)} seconds</p>
                    </div>
                    
                    <div class="section">
                        <h3>Requests (${data.requests.length})</h3>
                        ${data.requests.map(req => `
                            <div class="request">
                                <strong>${req.method} ${req.url}</strong><br>
                                <small>Time: ${req.timestamp}</small><br>
                                <pre>${JSON.stringify(req, null, 2)}</pre>
                            </div>
                        `).join('')}
                    </div>
                    
                    <div class="section">
                        <h3>Responses (${data.responses.length})</h3>
                        ${data.responses.map(resp => `
                            <div class="response">
                                <strong>${resp.status} ${resp.statusText}</strong><br>
                                <small>Time: ${resp.timestamp}</small><br>
                                <pre>${JSON.stringify(resp, null, 2)}</pre>
                            </div>
                        `).join('')}
                    </div>
                    
                    <div class="section">
                        <h3>Errors (${data.errors.length})</h3>
                        ${data.errors.map(err => `
                            <div class="error">
                                <strong>Error</strong><br>
                                <small>Time: ${err.timestamp}</small><br>
                                <pre>${JSON.stringify(err, null, 2)}</pre>
                            </div>
                        `).join('')}
                    </div>
                    
                    <div style="margin-top: 20px;">
                        <button onclick="window.close()">Close</button>
                        <button onclick="exportData('json')">Export JSON</button>
                        <button onclick="exportData('har')">Export HAR</button>
                    </div>
                    
                    <script>
                        function exportData(format) {
                            const data = ${JSON.stringify(data)};
                            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = 'api-monitor-' + Date.now() + '.' + format;
                            a.click();
                            URL.revokeObjectURL(url);
                        }
                    </script>
                </body>
                </html>
            `);
        }
    };
    
    // Make apiMonitor globally accessible
    window.apiMonitor = apiMonitor;
    
    // Intercept fetch requests
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        const requestId = Date.now() + Math.random();
        const request = {
            id: requestId,
            type: 'fetch',
            url: args[0],
            method: args[1]?.method || 'GET',
            headers: args[1]?.headers || {},
            body: args[1]?.body,
            timestamp: new Date().toISOString()
        };
        
        apiMonitor.addRequest(request);
        
        try {
            const response = await originalFetch.apply(this, args);
            
            // Clone response to read body without consuming it
            const responseClone = response.clone();
            let responseBody;
            
            try {
                const contentType = response.headers.get('content-type') || '';
                
                if (contentType.includes('application/json')) {
                    responseBody = await responseClone.json();
                } else if (contentType.includes('text/')) {
                    responseBody = await responseClone.text();
                } else if (contentType.includes('image/')) {
                    responseBody = '[Binary Image Data]';
                } else if (contentType.includes('video/')) {
                    responseBody = '[Binary Video Data]';
                } else if (contentType.includes('audio/')) {
                    responseBody = '[Binary Audio Data]';
                } else {
                    // Try to read as text, fallback to array buffer info
                    try {
                        responseBody = await responseClone.text();
                    } catch (e) {
                        const arrayBuffer = await responseClone.arrayBuffer();
                        responseBody = `[Binary Data: ${arrayBuffer.byteLength} bytes]`;
                    }
                }
                
                // Limit response size
                if (typeof responseBody === 'string' && responseBody.length > CONFIG.maxResponseSize) {
                    responseBody = responseBody.substring(0, CONFIG.maxResponseSize) + '...[truncated]';
                }
                
            } catch (e) {
                responseBody = `Unable to read response body: ${e.message}`;
            }
            
            const responseData = {
                requestId: requestId,
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers),
                body: responseBody,
                timestamp: new Date().toISOString()
            };
            
            apiMonitor.addResponse(responseData);
            return response;
            
        } catch (error) {
            const errorData = {
                requestId: requestId,
                error: error.message,
                stack: error.stack,
                timestamp: new Date().toISOString()
            };
            
            apiMonitor.addError(errorData);
            throw error;
        }
    };
    
    // Intercept XMLHttpRequest
    const originalXHR = window.XMLHttpRequest;
    window.XMLHttpRequest = function() {
        const xhr = new originalXHR();
        const originalOpen = xhr.open;
        const originalSend = xhr.send;
        
        xhr.open = function(method, url, ...args) {
            const requestId = Date.now() + Math.random();
            const request = {
                id: requestId,
                type: 'xhr',
                method: method,
                url: url,
                timestamp: new Date().toISOString()
            };
            
            apiMonitor.addRequest(request);
            xhr._requestId = requestId;
            
            return originalOpen.apply(this, [method, url, ...args]);
        };
        
        xhr.send = function(data) {
            if (data) {
                console.log('XHR_DATA:', data);
            }
            
            xhr.addEventListener('load', function() {
                const responseData = {
                    requestId: xhr._requestId,
                    status: xhr.status,
                    statusText: xhr.statusText,
                    response: xhr.responseText,
                    headers: {},
                    timestamp: new Date().toISOString()
                };
                
                // Try to parse response headers
                try {
                    const responseHeaders = xhr.getAllResponseHeaders();
                    if (responseHeaders) {
                        responseHeaders.split('\r\n').forEach(line => {
                            const parts = line.split(': ');
                            if (parts.length === 2) {
                                responseData.headers[parts[0]] = parts[1];
                            }
                        });
                    }
                } catch (e) {
                    console.log('Could not parse XHR headers:', e);
                }
                
                apiMonitor.addResponse(responseData);
            });
            
            xhr.addEventListener('error', function() {
                const errorData = {
                    requestId: xhr._requestId,
                    error: 'XHR Error',
                    timestamp: new Date().toISOString()
                };
                
                apiMonitor.addError(errorData);
            });
            
            xhr.addEventListener('timeout', function() {
                const errorData = {
                    requestId: xhr._requestId,
                    error: 'XHR Timeout',
                    timestamp: new Date().toISOString()
                };
                
                apiMonitor.addError(errorData);
            });
            
            return originalSend.apply(this, [data]);
        };
        
        return xhr;
    };
    
    // Add UI elements when page loads
    function addUI() {
        if (!CONFIG.enableUI) return;
        
        // Add stats display
        const statsDiv = document.createElement('div');
        statsDiv.id = 'api-monitor-stats';
        statsDiv.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 10000;
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 10px;
            border-radius: 5px;
            font-family: monospace;
            font-size: 12px;
            max-width: 300px;
        `;
        
        document.body.appendChild(statsDiv);
        
        // Add control buttons
        const controlsDiv = document.createElement('div');
        controlsDiv.style.cssText = `
            position: fixed;
            top: 10px;
            left: 10px;
            z-index: 10000;
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 10px;
            border-radius: 5px;
            font-family: Arial, sans-serif;
        `;
        
        // Create controls safely without innerHTML
        controlsDiv.textContent = '';
        
        // Create button container
        const buttonContainer1 = document.createElement('div');
        buttonContainer1.style.marginBottom = '10px';
        
        // View Data button
        const viewDataBtn = document.createElement('button');
        viewDataBtn.textContent = 'View Data';
        viewDataBtn.style.cssText = 'margin: 2px; padding: 5px;';
        viewDataBtn.addEventListener('click', () => apiMonitor.showData());
        buttonContainer1.appendChild(viewDataBtn);
        
        // Clear button
        const clearBtn = document.createElement('button');
        clearBtn.textContent = 'Clear';
        clearBtn.style.cssText = 'margin: 2px; padding: 5px;';
        clearBtn.addEventListener('click', () => apiMonitor.clearData());
        buttonContainer1.appendChild(clearBtn);
        
        // Export JSON button
        const exportJsonBtn = document.createElement('button');
        exportJsonBtn.textContent = 'Export JSON';
        exportJsonBtn.style.cssText = 'margin: 2px; padding: 5px;';
        exportJsonBtn.addEventListener('click', () => apiMonitor.exportData('json'));
        buttonContainer1.appendChild(exportJsonBtn);
        
        // Export HAR button
        const exportHarBtn = document.createElement('button');
        exportHarBtn.textContent = 'Export HAR';
        exportHarBtn.style.cssText = 'margin: 2px; padding: 5px;';
        exportHarBtn.addEventListener('click', () => apiMonitor.exportData('har'));
        buttonContainer1.appendChild(exportHarBtn);
        
        controlsDiv.appendChild(buttonContainer1);
        
        // Create second button container
        const buttonContainer2 = document.createElement('div');
        buttonContainer2.style.marginBottom = '10px';
        
        // Write Logs button
        const writeLogsBtn = document.createElement('button');
        writeLogsBtn.textContent = '📁 Write Logs';
        writeLogsBtn.style.cssText = 'margin: 2px; padding: 5px; background: #4CAF50; color: white;';
        writeLogsBtn.addEventListener('click', () => apiMonitor.forceWriteLogs());
        buttonContainer2.appendChild(writeLogsBtn);
        
        // Log Stats button
        const logStatsBtn = document.createElement('button');
        logStatsBtn.textContent = 'Log Stats';
        logStatsBtn.style.cssText = 'margin: 2px; padding: 5px;';
        logStatsBtn.addEventListener('click', () => console.log(apiMonitor.getLogStats()));
        buttonContainer2.appendChild(logStatsBtn);
        
        controlsDiv.appendChild(buttonContainer2);
        
        document.body.appendChild(controlsDiv);
        
        // Update stats
        apiMonitor.updateUI();
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', addUI);
    } else {
        addUI();
    }
    
    // Console commands
    console.log('🚀 Hero Wars API Monitor v2.3 loaded!');
    console.log('🔍 DEBUG: Script loaded successfully on:', window.location.href);
    console.log('📊 Available commands:');
    console.log('  - window.apiMonitor.showData() - View all captured data');
    console.log('  - window.apiMonitor.clearData() - Clear all data');
    console.log('  - window.apiMonitor.exportData("json") - Export as JSON');
    console.log('  - window.apiMonitor.exportData("har") - Export as HAR');
    console.log('  - window.apiMonitor.getAllData() - Get raw data');
    console.log('📁 File Logging commands:');
    console.log('  - window.apiMonitor.forceWriteLogs() - Write logs to file immediately');
    console.log('  - window.apiMonitor.getLogStats() - Get logging statistics');
    console.log(`  - File logging: ${CONFIG.enableFileLogging ? 'ENABLED' : 'DISABLED'}`);
    console.log(`  - Log format: ${CONFIG.logFormat}`);
    console.log(`  - Auto-save interval: ${CONFIG.logToFileInterval}ms`);
    
    // Auto-save data periodically
    setInterval(() => {
        const data = apiMonitor.getAllData();
        if (data.requests.length > 0 || data.responses.length > 0) {
            GM_setValue('apiMonitorData', data);
        }
    }, 30000); // Save every 30 seconds
    
    // Auto-write logs to file periodically
    if (CONFIG.enableFileLogging) {
        setInterval(() => {
            if (apiMonitor.pendingLogs.length > 0) {
                apiMonitor.writeLogsToFile();
            }
        }, CONFIG.logToFileInterval);
        
        console.log(`📁 Auto file logging enabled - writing every ${CONFIG.logToFileInterval}ms`);
    
    // Test GM_download function immediately
    setTimeout(() => {
        console.log('🔍 DEBUG: Testing GM_download function...');
        try {
            const testContent = JSON.stringify({
                test: true,
                timestamp: new Date().toISOString(),
                message: 'API Monitor Test File'
            }, null, 2);
            const testFilename = `api-monitor-test-${Date.now()}.json`;
            GM_download(testContent, testFilename, 'text/plain');
            console.log('🔍 DEBUG: GM_download test completed - check Downloads folder for:', testFilename);
        } catch (error) {
            console.error('🔍 DEBUG: GM_download test failed:', error);
        }
    }, 2000);
    
    // Test API interception with some sample requests
    setTimeout(() => {
        console.log('🔍 DEBUG: Testing API interception...');
        
        // Test fetch request
        fetch('https://httpbin.org/get?test=api-monitor')
            .then(response => response.json())
            .then(data => console.log('🔍 DEBUG: Fetch test completed:', data))
            .catch(error => console.error('🔍 DEBUG: Fetch test failed:', error));
            
        // Test XHR request
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'https://httpbin.org/get?test=xhr-monitor');
        xhr.onload = () => console.log('🔍 DEBUG: XHR test completed:', xhr.responseText);
        xhr.onerror = () => console.error('🔍 DEBUG: XHR test failed');
        xhr.send();
        
    }, 3000);
    }
    
    // Load saved data on startup
    const savedData = GM_getValue('apiMonitorData', null);
    if (savedData && savedData.requests) {
        apiMonitor.requests = savedData.requests || [];
        apiMonitor.responses = savedData.responses || [];
        apiMonitor.errors = savedData.errors || [];
        console.log('📁 Loaded saved API monitor data');
    }
    
})();
