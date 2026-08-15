#!/usr/bin/env node
/**
 * Local bridge server for Cursor -> Hero Wars (LLMHWH).
 *
 * Usage:
 *   node llm-bridge-server.mjs
 *
 * Cursor / shell:
 *   curl http://127.0.0.1:9876/health
 *   curl -X POST http://127.0.0.1:9876/run -H "Content-Type: application/json" -d "{\"method\":\"getUserInfo\",\"args\":[]}"
 */

import http from 'http';

const PORT = 9876;
const HOST = '127.0.0.1';
const DEFAULT_TIMEOUT_MS = 120000;

let commandQueue = [];
let lastBrowserPollAt = 0;
const waiters = new Map();

function sendJson(res, status, body) {
    res.writeHead(status, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end(JSON.stringify(body));
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let data = '';
        req.on('data', chunk => { data += chunk; });
        req.on('end', () => {
            if (!data) return resolve({});
            try {
                resolve(JSON.parse(data));
            } catch (e) {
                reject(new Error('Invalid JSON body'));
            }
        });
        req.on('error', reject);
    });
}

function isBrowserConnected() {
    return Date.now() - lastBrowserPollAt < 5000;
}

const server = http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        });
        return res.end();
    }

    try {
        const url = new URL(req.url, `http://${HOST}`);

        if (req.method === 'GET' && url.pathname === '/health') {
            return sendJson(res, 200, {
                ok: true,
                browserConnected: isBrowserConnected(),
                lastBrowserPollAt,
                queuedCommands: commandQueue.length,
                port: PORT,
            });
        }

        if (req.method === 'GET' && url.pathname === '/poll') {
            lastBrowserPollAt = Date.now();
            if (commandQueue.length > 0) {
                const command = commandQueue.shift();
                return sendJson(res, 200, command);
            }
            res.writeHead(204, {
                'Access-Control-Allow-Origin': '*',
            });
            return res.end();
        }

        if (req.method === 'POST' && url.pathname === '/result') {
            const body = await readBody(req);
            const waiter = waiters.get(body.id);
            if (waiter) {
                clearTimeout(waiter.timer);
                waiters.delete(body.id);
                waiter.resolve(body);
            }
            return sendJson(res, 200, { ok: true });
        }

        if (req.method === 'POST' && url.pathname === '/run') {
            const body = await readBody(req);
            const method = body.method;
            const args = Array.isArray(body.args) ? body.args : [];
            const timeoutMs = Number(body.timeoutMs) > 0 ? Number(body.timeoutMs) : DEFAULT_TIMEOUT_MS;

            if (!method || typeof method !== 'string') {
                return sendJson(res, 400, { ok: false, error: 'method is required' });
            }

            if (!isBrowserConnected()) {
                return sendJson(res, 503, {
                    ok: false,
                    error: 'Browser bridge not connected. Open Hero Wars with LLM Controller loaded.',
                });
            }

            const id = `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            const command = { id, method, args };

            const resultPromise = new Promise((resolve, reject) => {
                const timer = setTimeout(() => {
                    waiters.delete(id);
                    commandQueue = commandQueue.filter(c => c.id !== id);
                    reject(new Error(`Command timed out after ${timeoutMs}ms`));
                }, timeoutMs);
                waiters.set(id, { resolve, reject, timer });
            });

            commandQueue.push(command);

            try {
                const result = await resultPromise;
                if (!result.ok) {
                    return sendJson(res, 500, { ok: false, error: result.error || 'Command failed', id });
                }
                return sendJson(res, 200, { ok: true, id, result: result.result });
            } catch (e) {
                return sendJson(res, 504, { ok: false, error: e.message, id });
            }
        }

        sendJson(res, 404, { ok: false, error: 'Not found' });
    } catch (e) {
        sendJson(res, 500, { ok: false, error: e.message });
    }
});

server.listen(PORT, HOST, () => {
    console.log(`LLM bridge listening on http://${HOST}:${PORT}`);
    console.log('Waiting for Hero Wars tab (LLM Controller) to poll /poll ...');
});
