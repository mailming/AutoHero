#!/usr/bin/env node
import { initDatabase, backfillAllMatchups, getTrainingSummary, closeDatabase } from './training-db.mjs';

async function main() {
    await initDatabase();
    const result = await backfillAllMatchups();
    const summary = await getTrainingSummary();
    console.log('Backfill complete:', result);
    console.log('Summary:', {
        opponentCombos: summary.opponentComboCount,
        matchupTests: summary.matchupTestCount,
        rounds: summary.roundCount,
    });
    await closeDatabase();
}

main().catch(async (error) => {
    console.error('Backfill failed:', error.message);
    await closeDatabase();
    process.exit(1);
});
