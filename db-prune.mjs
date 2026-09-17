#!/usr/bin/env node
/**
 * Prune arena training data older than retention window (default 30 days).
 *
 * Usage:
 *   node db-prune.mjs
 *   node db-prune.mjs --days 30
 *   node db-prune.mjs --dry-run
 */

import pg from 'pg';

const { Pool } = pg;

const DEFAULT_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/autohero';
const DEFAULT_RETENTION_DAYS = 30;

function getDatabaseUrl() {
    return process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
}

function parseArgs(argv) {
    const dryRun = argv.includes('--dry-run');
    const daysIdx = argv.indexOf('--days');
    const retentionDays = daysIdx >= 0 && argv[daysIdx + 1]
        ? Math.max(1, Number(argv[daysIdx + 1]) || DEFAULT_RETENTION_DAYS)
        : DEFAULT_RETENTION_DAYS;
    return { dryRun, retentionDays };
}

async function countOld(client, table, dateColumn, retentionDays) {
    const result = await client.query(
        `SELECT COUNT(*)::int AS count
         FROM ${table}
         WHERE ${dateColumn} < NOW() - ($1::text || ' days')::interval`,
        [String(retentionDays)]
    );
    return result.rows[0]?.count || 0;
}

async function main() {
    const { dryRun, retentionDays } = parseArgs(process.argv.slice(2));
    const pool = new Pool({ connectionString: getDatabaseUrl() });
    const client = await pool.connect();

    try {
        const [oldMatchups, oldRounds] = await Promise.all([
            countOld(client, 'matchup_tests', 'tested_at', retentionDays),
            countOld(client, 'training_rounds', 'completed_at', retentionDays),
        ]);

        const [totalMatchups, totalRounds] = await Promise.all([
            client.query('SELECT COUNT(*)::int AS count FROM matchup_tests'),
            client.query('SELECT COUNT(*)::int AS count FROM training_rounds'),
        ]);

        console.log(`Retention: ${retentionDays} days${dryRun ? ' (dry run)' : ''}`);
        console.log(`matchup_tests: ${totalMatchups.rows[0].count} total, ${oldMatchups} older than ${retentionDays}d`);
        console.log(`training_rounds: ${totalRounds.rows[0].count} total, ${oldRounds} older than ${retentionDays}d`);

        if (oldMatchups === 0 && oldRounds === 0) {
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
             WHERE completed_at < NOW() - ($1::text || ' days')::interval`,
            [String(retentionDays)]
        );
        await client.query('COMMIT');

        console.log(`Deleted ${matchupResult.rowCount ?? 0} matchup_tests row(s).`);
        console.log(`Deleted ${roundResult.rowCount ?? 0} training_rounds row(s).`);

        await client.query('VACUUM ANALYZE matchup_tests');
        await client.query('VACUUM ANALYZE training_rounds');
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
