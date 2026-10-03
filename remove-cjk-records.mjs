#!/usr/bin/env node
/**
 * Remove training DB rows that contain CJK (Chinese) characters in text fields.
 */
import pg from 'pg';

const { Pool } = pg;
const CJK_PATTERN = '[\\u4e00-\\u9fff]';
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/autohero',
});

async function main() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const opponentComboIds = await client.query(
            `SELECT id FROM opponent_combos WHERE opponent_name ~ $1`,
            [CJK_PATTERN]
        );
        const opponentIds = opponentComboIds.rows.map((r) => r.id);
        console.log(`opponent_combos with CJK in opponent_name: ${opponentIds.length}`);

        const matchupFromNames = await client.query(
            `SELECT DISTINCT opponent_combo_id AS id
             FROM matchup_tests
             WHERE my_hero_names::text ~ $1`,
            [CJK_PATTERN]
        );
        const matchupIds = matchupFromNames.rows.map((r) => r.id);
        console.log(`opponent_combos linked via matchup_tests.my_hero_names: ${matchupIds.length}`);

        const roundOpponentIds = await client.query(
            `SELECT DISTINCT opponent_combo_key FROM training_rounds WHERE opponent_name ~ $1`,
            [CJK_PATTERN]
        );
        console.log(`training_rounds with CJK opponent_name: ${roundOpponentIds.rows.length}`);

        const roundBestNames = await client.query(
            `SELECT session_id FROM training_rounds WHERE best_hero_names::text ~ $1`,
            [CJK_PATTERN]
        );
        console.log(`training_rounds with CJK best_hero_names: ${roundBestNames.rows.length}`);

        const allOpponentComboIds = [...new Set([...opponentIds, ...matchupIds])];
        console.log(`Total unique opponent_combos to remove: ${allOpponentComboIds.length}`);

        if (allOpponentComboIds.length === 0 && roundBestNames.rows.length === 0) {
            console.log('No CJK records found.');
            await client.query('ROLLBACK');
            return;
        }

        let deletedMatchups = 0;
        let deletedRounds = 0;
        let deletedOpponents = 0;

        if (allOpponentComboIds.length > 0) {
            const matchupResult = await client.query(
                `DELETE FROM matchup_tests WHERE opponent_combo_id = ANY($1::int[])`,
                [allOpponentComboIds]
            );
            deletedMatchups = matchupResult.rowCount ?? 0;

            const roundResult = await client.query(
                `DELETE FROM training_rounds WHERE opponent_combo_key IN (
                    SELECT combo_key FROM opponent_combos WHERE id = ANY($1::int[])
                 )`,
                [allOpponentComboIds]
            );
            deletedRounds += roundResult.rowCount ?? 0;

            const opponentResult = await client.query(
                `DELETE FROM opponent_combos WHERE id = ANY($1::int[])`,
                [allOpponentComboIds]
            );
            deletedOpponents = opponentResult.rowCount ?? 0;
        }

        if (roundBestNames.rows.length > 0) {
            const sessionIds = roundBestNames.rows.map((r) => r.session_id);
            const extraRoundResult = await client.query(
                `DELETE FROM training_rounds WHERE session_id = ANY($1::text[])`,
                [sessionIds]
            );
            deletedRounds += extraRoundResult.rowCount ?? 0;
        }

        await client.query('COMMIT');

        console.log('Deleted:');
        console.log(`  matchup_tests: ${deletedMatchups}`);
        console.log(`  training_rounds: ${deletedRounds}`);
        console.log(`  opponent_combos: ${deletedOpponents}`);

        const remaining = await pool.query(
            `SELECT
                (SELECT COUNT(*)::int FROM opponent_combos WHERE opponent_name ~ $1) AS opponents,
                (SELECT COUNT(*)::int FROM matchup_tests WHERE my_hero_names::text ~ $1) AS matchups,
                (SELECT COUNT(*)::int FROM training_rounds WHERE opponent_name ~ $1 OR best_hero_names::text ~ $1) AS rounds`,
            [CJK_PATTERN]
        );
        console.log('Remaining CJK rows:', remaining.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
