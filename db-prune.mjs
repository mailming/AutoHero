#!/usr/bin/env node
/**
 * Prune arena training data older than retention window (default 30 days),
 * and optionally clear meta-team snapshots.
 *
 * Usage:
 *   node db-prune.mjs
 *   node db-prune.mjs --days 30
 *   node db-prune.mjs --meta
 *   node db-prune.mjs --days 30 --meta
 *   node db-prune.mjs --dry-run --meta
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Pool } = pg;

const DEFAULT_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/autohero';
const DEFAULT_RETENTION_DAYS = 30;

function loadDotEnv() {
    try {
        const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '.env');
        if (!fs.existsSync(envPath)) return;
        for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const eq = trimmed.indexOf('=');
            if (eq <= 0) continue;
            const key = trimmed.slice(0, eq).trim();
            let value = trimmed.slice(eq + 1).trim();
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            if (!(key in process.env)) process.env[key] = value;
        }
    } catch {
        // ignore missing/unreadable .env
    }
}

function getDatabaseUrl() {
    return process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
}

function parseArgs(argv) {
    const dryRun = argv.includes('--dry-run');
    const clearMeta = argv.includes('--meta');
    const daysIdx = argv.indexOf('--days');
    const retentionDays = daysIdx >= 0 && argv[daysIdx + 1]
        ? Math.max(1, Number(argv[daysIdx + 1]) || DEFAULT_RETENTION_DAYS)
        : DEFAULT_RETENTION_DAYS;
    return { dryRun, clearMeta, retentionDays };
}

async function countOld(client, table, dateColumn, retentionDays) {
    const result = await client.query(
        `SELECT COUNT(*)::int AS count
         FROM ${table}
         WHERE ${dateColumn} IS NOT NULL
           AND ${dateColumn} < NOW() - ($1::text || ' days')::interval`,
        [String(retentionDays)]
    );
    return result.rows[0]?.count || 0;
}

async function main() {
    loadDotEnv();
    const { dryRun, clearMeta, retentionDays } = parseArgs(process.argv.slice(2));
    const pool = new Pool({ connectionString: getDatabaseUrl() });
    const client = await pool.connect();

    try {
        const oldMatchups = await countOld(client, 'matchup_tests', 'tested_at', retentionDays);
        const oldRounds = await countOld(
            client,
            'training_rounds',
            'COALESCE(completed_at, created_at)',
            retentionDays
        );
        const orphanCombos = await client.query(
            `SELECT COUNT(*)::int AS count
             FROM opponent_combos oc
             WHERE NOT EXISTS (
                 SELECT 1 FROM matchup_tests mt WHERE mt.opponent_combo_id = oc.id
             )`
        );

        const totalMatchups = await client.query('SELECT COUNT(*)::int AS count FROM matchup_tests');
        const totalRounds = await client.query('SELECT COUNT(*)::int AS count FROM training_rounds');
        const totalMetaSnapshots = await client.query('SELECT COUNT(*)::int AS count FROM meta_team_snapshots');
        const totalMetaTeams = await client.query('SELECT COUNT(*)::int AS count FROM meta_teams');

        console.log(`Retention: ${retentionDays} days${dryRun ? ' (dry run)' : ''}`);
        console.log(`matchup_tests: ${totalMatchups.rows[0].count} total, ${oldMatchups} older than ${retentionDays}d`);
        console.log(`training_rounds: ${totalRounds.rows[0].count} total, ${oldRounds} older than ${retentionDays}d`);
        console.log(`opponent_combos orphans (no matchups): ${orphanCombos.rows[0].count}`);
        if (clearMeta) {
            console.log(`meta_team_snapshots: ${totalMetaSnapshots.rows[0].count} (will clear all)`);
            console.log(`meta_teams: ${totalMetaTeams.rows[0].count} (cascade with snapshots)`);
        }

        const nothingOld = oldMatchups === 0 && oldRounds === 0 && orphanCombos.rows[0].count === 0;
        const nothingMeta = !clearMeta || (
            totalMetaSnapshots.rows[0].count === 0 && totalMetaTeams.rows[0].count === 0
        );
        if (nothingOld && nothingMeta) {
            console.log('Nothing to prune.');
            return;
        }

        if (dryRun) {
            console.log('Dry run — no rows deleted.');
            return;
        }

        await client.query('BEGIN');
        const matchupResult = await client.query(
            `DELETE FROM matchup_tests
             WHERE tested_at < NOW() - ($1::text || ' days')::interval`,
            [String(retentionDays)]
        );
        const roundResult = await client.query(
            `DELETE FROM training_rounds
             WHERE COALESCE(completed_at, created_at) < NOW() - ($1::text || ' days')::interval`,
            [String(retentionDays)]
        );
        const orphanResult = await client.query(
            `DELETE FROM opponent_combos oc
             WHERE NOT EXISTS (
                 SELECT 1 FROM matchup_tests mt WHERE mt.opponent_combo_id = oc.id
             )`
        );

        let metaSnapshotResult = { rowCount: 0 };
        let metaTeamResult = { rowCount: 0 };
        if (clearMeta) {
            metaTeamResult = await client.query('DELETE FROM meta_teams');
            metaSnapshotResult = await client.query('DELETE FROM meta_team_snapshots');
        }
        await client.query('COMMIT');

        console.log(`Deleted ${matchupResult.rowCount ?? 0} matchup_tests row(s).`);
        console.log(`Deleted ${roundResult.rowCount ?? 0} training_rounds row(s).`);
        console.log(`Deleted ${orphanResult.rowCount ?? 0} orphan opponent_combos row(s).`);
        if (clearMeta) {
            console.log(`Deleted ${metaTeamResult.rowCount ?? 0} meta_teams row(s).`);
            console.log(`Deleted ${metaSnapshotResult.rowCount ?? 0} meta_team_snapshots row(s).`);
        }

        await client.query('VACUUM ANALYZE matchup_tests');
        await client.query('VACUUM ANALYZE training_rounds');
        await client.query('VACUUM ANALYZE opponent_combos');
        if (clearMeta) {
            await client.query('VACUUM ANALYZE meta_teams');
            await client.query('VACUUM ANALYZE meta_team_snapshots');
        }
        console.log('VACUUM ANALYZE completed.');
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Prune failed:', error.message);
        process.exitCode = 1;
    } finally {
        client.release();
        await pool.end();
    }
}

main();
