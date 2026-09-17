#!/usr/bin/env node
/**
 * Download hw-recruit hero/pet PNG icons into assets/hw-recruit-icons/.
 * Run: npm run icons:cache
 */
import fs from 'fs';
import path from 'path';
import { HERO_NAMES, PET_NAMES } from './hero-names.mjs';
import {
    ICONS_DIR,
    HW_RECRUIT_REMOTE_BASE,
    hwRecruitIconFilename,
    listCachedIconFilenames,
} from './hero-icons.mjs';

async function main() {
    const force = process.argv.includes('--force');
    fs.mkdirSync(ICONS_DIR, { recursive: true });

    const unitIds = [
        ...Object.keys(HERO_NAMES).map(Number),
        ...Object.keys(PET_NAMES).map(Number),
    ];
    const filenames = [...new Set(unitIds.map(hwRecruitIconFilename).filter(Boolean))].sort();

    console.log(`[icons] Target directory: ${ICONS_DIR}`);
    console.log(`[icons] Downloading ${filenames.length} icons from hw-recruit.com…`);

    const results = { saved: 0, skipped: 0, failed: 0 };
    for (const filename of filenames) {
        const remoteUrl = `${HW_RECRUIT_REMOTE_BASE}/${filename}`;
        const dest = path.join(ICONS_DIR, filename);
        if (!force && fs.existsSync(dest)) {
            results.skipped++;
            continue;
        }

        try {
            const response = await fetch(remoteUrl, {
                headers: { 'User-Agent': 'AutoHero/1.0 (local icon cache)' },
            });
            if (!response.ok) {
                console.warn(`[icons] FAIL ${filename} (${response.status}) ${remoteUrl}`);
                results.failed++;
                continue;
            }
            const buffer = Buffer.from(await response.arrayBuffer());
            fs.writeFileSync(dest, buffer);
            results.saved++;
            console.log(`[icons] saved ${filename} (${buffer.length} bytes)`);
        } catch (error) {
            console.warn(`[icons] FAIL ${filename}: ${error.message}`);
            results.failed++;
        }
    }

    const manifest = {
        source: 'https://hw-recruit.com/arena',
        cachedAt: new Date().toISOString(),
        count: listCachedIconFilenames().length,
        filenames: listCachedIconFilenames(),
    };
    fs.writeFileSync(
        path.join(ICONS_DIR, 'manifest.json'),
        `${JSON.stringify(manifest, null, 2)}\n`
    );

    console.log(`[icons] Done — saved ${results.saved}, skipped ${results.skipped}, failed ${results.failed}`);
    if (results.failed > 0) {
        process.exitCode = 1;
    }
}

main().catch((error) => {
    console.error('[icons] Fatal:', error);
    process.exit(1);
});
