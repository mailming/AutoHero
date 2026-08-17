#!/usr/bin/env node
/**
 * Local bridge server for Cursor -> Hero Wars (LLMHWH).
 *
 * Usage:
 *   npm install
 *   node llm-bridge-server.mjs
 *
 * Environment:
 *   DATABASE_URL=postgresql://user:pass@localhost:5432/autohero
 *
 * Cursor / shell:
 *   curl http://127.0.0.1:9876/health
 *   curl -X POST http://127.0.0.1:9876/run -H "Content-Type: application/json" -d "{\"method\":\"getUserInfo\",\"args\":[]}"
 */

import http from 'http';
import {
    initDatabase,
    saveTrainingRound,
    getTrainingSummary,
    getMatchups,
    getTrainingResults,
    getTrainingResultCount,
    getOpponentSkipCheck,
    getMetaTeamSnapshots,
    getMetaTeamSnapshotById,
    getMetaTeamCountForSnapshot,
    getMetaTeamsForSnapshot,
    getDatabaseStatus,
    closeDatabase,
} from './training-db.mjs';
import { formatTrainingResultRow, renderTrainingResultsPage, renderMetaTeamsPage } from './training-view.mjs';

const PORT = 9876;
const HOST = '127.0.0.1';
const DEFAULT_TIMEOUT_MS = 120000;

let commandQueue = [];
let lastBrowserPollAt = 0;
const waiters = new Map();
let databaseReady = false;

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
                database: getDatabaseStatus(),
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

        if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/training/view')) {
            if (!databaseReady) {
                res.writeHead(503, { 'Content-Type': 'text/plain' });
                return res.end('Database not ready');
            }
            const comboKey = url.searchParams.get('comboKey') || undefined;
            const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);
            const limitParam = url.searchParams.get('limit');
            const pageSize = limitParam == null ? 500 : Math.max(0, Number(limitParam) || 0);
            const [rows, summary, total] = await Promise.all([
                getTrainingResults({
                    comboKey,
                    offset,
                    limit: pageSize > 0 ? pageSize : undefined,
                }),
                getTrainingSummary(),
                getTrainingResultCount({ comboKey }),
            ]);
            const results = rows.map(formatTrainingResultRow);
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            return res.end(renderTrainingResultsPage(results, summary, {
                total,
                offset,
                pageSize: pageSize > 0 ? pageSize : total,
                comboKey,
            }));
        }

        if (req.method === 'GET' && url.pathname === '/training/results') {
            if (!databaseReady) {
                return sendJson(res, 503, {
                    ok: false,
                    error: 'Database not ready. Check DATABASE_URL and PostgreSQL.',
                    database: getDatabaseStatus(),
                });
            }
            const comboKey = url.searchParams.get('comboKey') || undefined;
            const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);
            const limitParam = url.searchParams.get('limit');
            const limit = limitParam == null ? 100 : Math.max(0, Number(limitParam) || 0);
            const [rows, total] = await Promise.all([
                getTrainingResults({
                    comboKey,
                    offset,
                    limit: limit > 0 ? limit : undefined,
                }),
                getTrainingResultCount({ comboKey }),
            ]);
            const results = rows.map(formatTrainingResultRow);
            return sendJson(res, 200, {
                ok: true,
                count: results.length,
                total,
                offset,
                limit: limit > 0 ? limit : total,
                results,
            });
        }

        if (req.method === 'GET' && url.pathname === '/training/skip-check') {
            if (!databaseReady) {
                return sendJson(res, 503, {
                    ok: false,
                    error: 'Database not ready. Check DATABASE_URL and PostgreSQL.',
                    database: getDatabaseStatus(),
                });
            }
            const comboKey = url.searchParams.get('comboKey');
            if (!comboKey) {
                return sendJson(res, 400, { ok: false, error: 'comboKey query param is required' });
            }
            const minWinRate = Number(url.searchParams.get('minWinRate')) || 80;
            const maxAgeDays = Number(url.searchParams.get('maxAgeDays')) || 30;
            const skip = await getOpponentSkipCheck({ comboKey, minWinRate, maxAgeDays });
            return sendJson(res, 200, { ok: true, ...skip });
        }

        if (req.method === 'GET' && url.pathname === '/training/meta-view') {
            if (!databaseReady) {
                res.writeHead(503, { 'Content-Type': 'text/plain' });
                return res.end('Database not ready');
            }

            const snapshots = await getMetaTeamSnapshots({ limit: 50 });
            if (!snapshots.length) {
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                return res.end(renderMetaTeamsPage([], null, [], { total: 0 }));
            }

            const requestedId = Number(url.searchParams.get('snapshotId'));
            const snapshot = requestedId
                ? await getMetaTeamSnapshotById(requestedId)
                : snapshots[0];
            if (!snapshot) {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                return res.end('Snapshot not found');
            }

            const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);
            const limitParam = url.searchParams.get('limit');
            const pageSize = limitParam == null ? 500 : Math.max(0, Number(limitParam) || 0);
            const [teams, total] = await Promise.all([
                getMetaTeamsForSnapshot(snapshot.id, {
                    offset,
                    limit: pageSize > 0 ? pageSize : undefined,
                }),
                getMetaTeamCountForSnapshot(snapshot.id),
            ]);

            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            return res.end(renderMetaTeamsPage(teams, snapshot, snapshots, {
                total,
                offset,
                pageSize: pageSize > 0 ? pageSize : total,
            }));
        }

        if (req.method === 'GET' && url.pathname === '/training/meta-snapshots') {
            if (!databaseReady) {
                return sendJson(res, 503, {
                    ok: false,
                    error: 'Database not ready. Check DATABASE_URL and PostgreSQL.',
                    database: getDatabaseStatus(),
                });
            }
            const limit = Number(url.searchParams.get('limit')) || 20;
            const snapshots = await getMetaTeamSnapshots({ limit });
            return sendJson(res, 200, { ok: true, count: snapshots.length, snapshots });
        }

        if (req.method === 'GET' && url.pathname === '/training/meta-teams') {
            if (!databaseReady) {
                return sendJson(res, 503, {
                    ok: false,
                    error: 'Database not ready. Check DATABASE_URL and PostgreSQL.',
                    database: getDatabaseStatus(),
                });
            }
            const snapshotId = Number(url.searchParams.get('snapshotId'));
            if (!snapshotId) {
                return sendJson(res, 400, { ok: false, error: 'snapshotId query param is required' });
            }
            const limit = Number(url.searchParams.get('limit')) || 500;
            const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);
            const teams = await getMetaTeamsForSnapshot(snapshotId, { limit, offset });
            return sendJson(res, 200, { ok: true, snapshotId, count: teams.length, teams });
        }

        if (req.method === 'GET' && url.pathname === '/training/matchups') {
            if (!databaseReady) {
                return sendJson(res, 503, {
                    ok: false,
                    error: 'Database not ready. Check DATABASE_URL and PostgreSQL.',
                    database: getDatabaseStatus(),
                });
            }
            const comboKey = url.searchParams.get('comboKey') || undefined;
            const limit = Number(url.searchParams.get('limit')) || 50;
            const matchups = await getMatchups({ comboKey, limit });
            return sendJson(res, 200, { ok: true, matchups });
        }

        if (req.method === 'GET' && url.pathname === '/training/summary') {
            if (!databaseReady) {
                return sendJson(res, 503, {
                    ok: false,
                    error: 'Database not ready. Check DATABASE_URL and PostgreSQL.',
                    database: getDatabaseStatus(),
                });
            }
            const summary = await getTrainingSummary();
            return sendJson(res, 200, { ok: true, ...summary });
        }

        if (req.method === 'POST' && url.pathname === '/training/save') {
            if (!databaseReady) {
                return sendJson(res, 503, {
                    ok: false,
                    error: 'Database not ready. Check DATABASE_URL and PostgreSQL.',
                    database: getDatabaseStatus(),
                });
            }
            const body = await readBody(req);
            const saved = await saveTrainingRound(body);
            return sendJson(res, 200, { ok: true, ...saved });
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

async function startServer() {
    try {
        await initDatabase();
        databaseReady = true;
        console.log('PostgreSQL connected:', getDatabaseStatus().url);
    } catch (error) {
        databaseReady = false;
        console.error('PostgreSQL init failed:', error.message);
        console.error('Set DATABASE_URL or start PostgreSQL, then restart the bridge.');
    }

    server.on('error', (error) => {
        console.error('Bridge server error:', error.message);
        process.exit(1);
    });

    server.listen(PORT, HOST, () => {
        console.log(`LLM bridge listening on http://${HOST}:${PORT}`);
        console.log('Arena training: GET /training/view, /training/meta-view (HTML), /training/results (JSON)');
        console.log('Waiting for Hero Wars tab (LLM Controller) to poll /poll ...');
    });
}

startServer();

process.on('SIGINT', async () => {
    await closeDatabase();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    await closeDatabase();
    process.exit(0);
});
