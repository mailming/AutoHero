#!/usr/bin/env node
/**
 * Build a counter-hero heuristic model from Arena Training matchup_tests.
 *
 * Uses empirical lift:
 *   lift(attackHero, defenseHero) =
 *     avg(win_rate | both present) - avg(win_rate | defenseHero present)
 *
 * Positive lift ⇒ attack hero tends to do better than average against that defense hero.
 *
 * Usage:
 *   node build-counter-model.mjs
 *   node build-counter-model.mjs --min-samples 20 --out counter-model.json
 *
 * Requires local Postgres (docker compose up -d) with autohero.matchup_tests populated.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { resolveHeroName } from './hero-names.mjs';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/autohero';

function parseArgs(argv) {
    const args = {
        minSamples: 15,
        minPairSamples: 8,
        out: path.join(__dirname, 'counter-model.json'),
        maxUpgrade: null,
        limit: 0
    };
    for (let i = 2; i < argv.length; i += 1) {
        const a = argv[i];
        if (a === '--min-samples') args.minSamples = Number(argv[++i]);
        else if (a === '--min-pair-samples') args.minPairSamples = Number(argv[++i]);
        else if (a === '--out') args.out = path.resolve(argv[++i]);
        else if (a === '--max-upgrade') args.maxUpgrade = argv[++i] === 'true';
        else if (a === '--limit') args.limit = Number(argv[++i]);
        else if (a === '--help' || a === '-h') {
            console.log(`Usage: node build-counter-model.mjs [--min-samples N] [--min-pair-samples N] [--out file] [--max-upgrade true|false]`);
            process.exit(0);
        }
    }
    return args;
}

function heroName(id) {
    return resolveHeroName(id);
}

function wilsonLower(wins, n, z = 1.96) {
    if (n <= 0) return 0;
    const p = wins / n;
    const z2 = z * z;
    const denom = 1 + z2 / n;
    const centre = p + z2 / (2 * n);
    const margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n);
    return (centre - margin) / denom;
}

async function fetchMatchups(pool, { maxUpgrade, limit }) {
    const params = [];
    const where = [];
    if (typeof maxUpgrade === 'boolean') {
        params.push(maxUpgrade);
        where.push(`mt.max_upgrade = $${params.length}`);
    }
    const limitSql = limit > 0 ? `LIMIT ${Math.floor(limit)}` : '';
    const sql = `
        SELECT
            mt.id,
            mt.my_hero_ids,
            mt.my_pet,
            mt.wins,
            mt.losses,
            mt.win_rate::float8 AS win_rate,
            mt.max_upgrade,
            oc.hero_ids AS defense_hero_ids,
            oc.pet AS defense_pet,
            oc.banner AS defense_banner,
            oc.combo_key
        FROM matchup_tests mt
        JOIN opponent_combos oc ON oc.id = mt.opponent_combo_id
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY mt.tested_at DESC
        ${limitSql}
    `;
    const { rows } = await pool.query(sql, params);
    return rows;
}

/**
 * Aggregate pairwise and per-defense-hero baselines from matchup rows.
 * Each matchup contributes once per (attackHero, defenseHero) pair with weight = fights.
 */
function buildModel(rows, { minSamples, minPairSamples }) {
    /** @type {Map<number, { fights: number, winMass: number }>} */
    const defenseBase = new Map();
    /** @type {Map<string, { fights: number, winMass: number, attackId: number, defenseId: number }>} */
    const pairs = new Map();
    /** @type {Map<string, { fights: number, winMass: number, attack: number[], defenseKey: string }>} */
    const teamCounters = new Map();

    let totalFights = 0;
    let totalWinMass = 0;

    for (const row of rows) {
        const attack = (row.my_hero_ids || []).map(Number).filter((id) => id > 0 && id < 6000);
        const defense = (row.defense_hero_ids || []).map(Number).filter((id) => id > 0 && id < 6000);
        if (attack.length < 3 || defense.length < 3) continue;

        const wins = Number(row.wins) || 0;
        const losses = Number(row.losses) || 0;
        let fights = wins + losses;
        let winRate = Number(row.win_rate);
        if (!Number.isFinite(winRate)) continue;
        // win_rate in DB is often 0–100
        if (winRate > 1.5) winRate = winRate / 100;
        if (fights <= 0) fights = 10; // fallback weight when only rate stored

        const winMass = winRate * fights;
        totalFights += fights;
        totalWinMass += winMass;

        for (const d of defense) {
            const base = defenseBase.get(d) || { fights: 0, winMass: 0 };
            base.fights += fights;
            base.winMass += winMass;
            defenseBase.set(d, base);
        }

        for (const a of attack) {
            for (const d of defense) {
                const key = `${a}|${d}`;
                const cell = pairs.get(key) || { fights: 0, winMass: 0, attackId: a, defenseId: d };
                cell.fights += fights;
                cell.winMass += winMass;
                pairs.set(key, cell);
            }
        }

        const attackKey = [...attack].sort((x, y) => x - y).join(',');
        const defenseKey = row.combo_key || [...defense].sort((x, y) => x - y).join(',');
        const tk = `${defenseKey}=>${attackKey}|${Number(row.my_pet) || 0}`;
        const team = teamCounters.get(tk) || {
            fights: 0,
            winMass: 0,
            attack: [...attack].sort((x, y) => x - y),
            pet: Number(row.my_pet) || 0,
            defenseKey
        };
        team.fights += fights;
        team.winMass += winMass;
        teamCounters.set(tk, team);
    }

    const globalWinRate = totalFights > 0 ? totalWinMass / totalFights : 0.5;

    const defenseBaseline = {};
    for (const [id, stats] of defenseBase) {
        if (stats.fights < minSamples) continue;
        defenseBaseline[String(id)] = {
            id,
            name: heroName(id),
            fights: stats.fights,
            avgWinRateVsThem: stats.winMass / stats.fights
        };
    }

    const counters = [];
    /** defenseId -> sorted attack heroes by lift */
    const byDefense = {};

    for (const cell of pairs.values()) {
        if (cell.fights < minPairSamples) continue;
        const base = defenseBase.get(cell.defenseId);
        if (!base || base.fights < minSamples) continue;
        const pairRate = cell.winMass / cell.fights;
        const baseRate = base.winMass / base.fights;
        const lift = pairRate - baseRate;
        const approxWins = pairRate * cell.fights;
        const confidence = wilsonLower(approxWins, cell.fights);
        const entry = {
            attackId: cell.attackId,
            attackName: heroName(cell.attackId),
            defenseId: cell.defenseId,
            defenseName: heroName(cell.defenseId),
            fights: cell.fights,
            winRate: pairRate,
            baselineWinRate: baseRate,
            lift,
            confidence
        };
        counters.push(entry);
        const list = byDefense[String(cell.defenseId)] || [];
        list.push(entry);
        byDefense[String(cell.defenseId)] = list;
    }

    counters.sort((a, b) => b.lift - a.lift || b.fights - a.fights);
    for (const key of Object.keys(byDefense)) {
        byDefense[key].sort((a, b) => b.lift - a.lift || b.fights - a.fights);
        byDefense[key] = byDefense[key].slice(0, 25);
    }

    const bestTeamsByDefense = {};
    for (const team of teamCounters.values()) {
        if (team.fights < Math.max(5, Math.floor(minPairSamples / 2))) continue;
        const winRate = team.winMass / team.fights;
        const list = bestTeamsByDefense[team.defenseKey] || [];
        list.push({
            attackHeroIds: team.attack,
            attackNames: team.attack.map(heroName),
            pet: team.pet,
            fights: team.fights,
            winRate,
            confidence: wilsonLower(winRate * team.fights, team.fights)
        });
        bestTeamsByDefense[team.defenseKey] = list;
    }
    for (const key of Object.keys(bestTeamsByDefense)) {
        bestTeamsByDefense[key].sort((a, b) => b.confidence - a.confidence || b.winRate - a.winRate);
        bestTeamsByDefense[key] = bestTeamsByDefense[key].slice(0, 10);
    }

    // Compact matrix for runtime scoring: attackId -> defenseId -> lift
    const liftMatrix = {};
    for (const entry of counters) {
        if (entry.lift <= 0) continue;
        const a = String(entry.attackId);
        const d = String(entry.defenseId);
        liftMatrix[a] ??= {};
        liftMatrix[a][d] = {
            lift: Number(entry.lift.toFixed(4)),
            winRate: Number(entry.winRate.toFixed(4)),
            fights: entry.fights
        };
    }

    return {
        version: 1,
        builtAt: new Date().toISOString(),
        method: 'pairwise_winrate_lift_vs_defense_baseline',
        params: { minSamples, minPairSamples },
        stats: {
            matchupRows: rows.length,
            totalFights,
            globalWinRate,
            defenseHeroesModeled: Object.keys(defenseBaseline).length,
            pairCells: counters.length,
            positiveLiftPairs: counters.filter((c) => c.lift > 0).length
        },
        defenseBaseline,
        /** Top global counter edges (attack beats defense hero relative to baseline) */
        topCounters: counters.filter((c) => c.lift > 0).slice(0, 100),
        /** Worst mismatches (attack hero underperforms vs defense hero) */
        topAntiCounters: counters.filter((c) => c.lift < 0).sort((a, b) => a.lift - b.lift).slice(0, 50),
        countersByDefense: byDefense,
        bestTeamsByDefense,
        liftMatrix
    };
}

/**
 * Score an attack lineup vs a defense lineup using the lift matrix.
 * Exported conceptually for Battle Lab / Arena Training to import later.
 */
export function scoreAttackVsDefense(model, attackHeroIds, defenseHeroIds) {
    const matrix = model.liftMatrix || {};
    const defense = defenseHeroIds.map(Number).filter(Boolean);
    let score = 0;
    let edges = 0;
    const details = [];
    for (const a of attackHeroIds.map(Number).filter(Boolean)) {
        const row = matrix[String(a)];
        if (!row) continue;
        for (const d of defense) {
            const cell = row[String(d)];
            if (!cell) continue;
            score += cell.lift;
            edges += 1;
            details.push({
                attackId: a,
                defenseId: d,
                lift: cell.lift,
                fights: cell.fights
            });
        }
    }
    return {
        score,
        avgLift: edges ? score / edges : 0,
        edges,
        details: details.sort((x, y) => y.lift - x.lift).slice(0, 15)
    };
}

async function main() {
    const args = parseArgs(process.argv);
    const databaseUrl = process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
    const pool = new Pool({
        connectionString: databaseUrl,
        connectionTimeoutMillis: 8000
    });

    try {
        const count = await pool.query('SELECT COUNT(*)::int AS n FROM matchup_tests');
        console.log(`matchup_tests rows: ${count.rows[0].n}`);
        if (count.rows[0].n < 50) {
            throw new Error('Not enough matchup_tests rows to build a model (need dozens at least).');
        }

        console.log('Loading matchups…');
        const rows = await fetchMatchups(pool, args);
        console.log(`Loaded ${rows.length} matchup rows`);

        const model = buildModel(rows, args);
        await fs.writeFile(args.out, JSON.stringify(model, null, 2), 'utf8');
        console.log(`Wrote ${args.out}`);
        console.log(JSON.stringify(model.stats, null, 2));
        console.log('\nTop 15 counter edges (lift):');
        for (const c of model.topCounters.slice(0, 15)) {
            console.log(
                `  ${c.attackName} vs ${c.defenseName}: lift=${(c.lift * 100).toFixed(1)}pp ` +
                `WR=${(c.winRate * 100).toFixed(0)}% base=${(c.baselineWinRate * 100).toFixed(0)}% n=${c.fights}`
            );
        }
    } finally {
        await pool.end();
    }
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
    main().catch((error) => {
        const detail = error?.code === 'ECONNREFUSED'
            ? 'PostgreSQL is not running. Start it with: npm run db:docker:up (Docker required), then retry.'
            : (error?.message || String(error));
        console.error('build-counter-model failed:', detail);
        process.exit(1);
    });
}
