#!/usr/bin/env node
/**
 * Import existing arena-training-results/*.json files into PostgreSQL.
 *
 * Usage:
 *   npm run db:import-json
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase, saveTrainingRound, getTrainingSummary, closeDatabase } from './training-db.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TRAINING_DIR = path.join(__dirname, 'arena-training-results');

async function main() {
    await initDatabase();

    let files = [];
    try {
        files = (await fs.readdir(TRAINING_DIR)).filter((f) => f.endsWith('.json')).sort();
    } catch {
        console.log('No arena-training-results directory found.');
        return;
    }

    if (!files.length) {
        console.log('No JSON training files to import.');
        return;
    }

    let imported = 0;
    for (const file of files) {
        const raw = await fs.readFile(path.join(TRAINING_DIR, file), 'utf8');
        const body = JSON.parse(raw);
        await saveTrainingRound(body);
        imported++;
        console.log(`Imported ${file}`);
    }

    const summary = await getTrainingSummary();
    console.log(`Done. Imported ${imported} files. Total rounds in DB: ${summary.roundCount}`);
    await closeDatabase();
}

main().catch(async (error) => {
    console.error('Import failed:', error.message);
    await closeDatabase();
    process.exit(1);
});
