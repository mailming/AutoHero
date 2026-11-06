import pg from 'pg';
import { findGrandArenaSelections } from './grand-arena-selection.mjs';

const { Pool } = pg;

const DEFAULT_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/autohero';

let pool = null;
let ready = false;
let lastError = null;

function getDatabaseUrl() {
    return process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
}

function createPool() {
    return new Pool({
        connectionString: getDatabaseUrl(),
        max: Number(process.env.PG_POOL_MAX || 20),
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 10_000,
    });
}

function maskDatabaseUrl(url) {
    try {
        const parsed = new URL(url);
        if (parsed.password) parsed.password = '****';
        return parsed.toString();
    } catch {
        return 'postgresql://****';
    }
}

export function getDatabaseStatus() {
    return {
        ready,
        url: maskDatabaseUrl(getDatabaseUrl()),
        lastError: lastError?.message || null,
    };
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS opponent_combos (
    id SERIAL PRIMARY KEY,
    combo_key TEXT NOT NULL UNIQUE,
    hero_ids INTEGER[] NOT NULL,
    hero_names TEXT[],
    pet INTEGER,
    banner INTEGER,
    opponent_user_id TEXT,
    opponent_name TEXT,
    opponent_place TEXT,
    opponent_power BIGINT,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS matchup_tests (
    id SERIAL PRIMARY KEY,
    opponent_combo_id INTEGER NOT NULL REFERENCES opponent_combos(id) ON DELETE CASCADE,
    session_id TEXT,
    my_hero_ids INTEGER[] NOT NULL,
    my_hero_names TEXT[],
    my_pet INTEGER,
    wins INTEGER,
    losses INTEGER,
    win_rate NUMERIC NOT NULL,
    rank INTEGER,
    tested_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_matchup_tests_unique_session
    ON matchup_tests (opponent_combo_id, session_id, my_hero_ids, my_pet);

CREATE INDEX IF NOT EXISTS idx_opponent_combos_last_seen
    ON opponent_combos (last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_matchup_tests_opponent_combo_id
    ON matchup_tests (opponent_combo_id);

CREATE INDEX IF NOT EXISTS idx_matchup_tests_tested_at
    ON matchup_tests (tested_at DESC);

CREATE INDEX IF NOT EXISTS idx_matchup_tests_win_rate
    ON matchup_tests (win_rate DESC);

-- Legacy round archive (optional full payload)
CREATE TABLE IF NOT EXISTS training_rounds (
    id SERIAL PRIMARY KEY,
    session_id TEXT NOT NULL UNIQUE,
    label TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    stopped_early BOOLEAN NOT NULL DEFAULT FALSE,
    opponent_combo_key TEXT,
    opponent_user_id TEXT,
    opponent_name TEXT,
    opponent_place TEXT,
    opponent_power BIGINT,
    tested_combos INTEGER,
    best_win_rate NUMERIC,
    best_hero_ids INTEGER[],
    best_hero_names TEXT[],
    best_pet INTEGER,
    best_banner INTEGER,
    best_wins INTEGER,
    best_losses INTEGER,
    best_detail JSONB,
    payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_rounds_completed_at
    ON training_rounds (completed_at DESC);

CREATE TABLE IF NOT EXISTS meta_team_snapshots (
    id SERIAL PRIMARY KEY,
    captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source TEXT NOT NULL DEFAULT 'hw-recruit',
    source_url TEXT,
    position_max INTEGER,
    pages_scraped INTEGER NOT NULL DEFAULT 0,
    total_teams INTEGER NOT NULL DEFAULT 0,
    unique_combos INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meta_team_snapshots_captured_at
    ON meta_team_snapshots (captured_at DESC);

CREATE TABLE IF NOT EXISTS meta_teams (
    id SERIAL PRIMARY KEY,
    snapshot_id INTEGER NOT NULL REFERENCES meta_team_snapshots(id) ON DELETE CASCADE,
    combo_key TEXT NOT NULL,
    hero_ids INTEGER[] NOT NULL,
    hero_names TEXT[],
    pet INTEGER,
    pet_name TEXT,
    banner INTEGER,
    popularity_count INTEGER,
    row_rank INTEGER,
    page_number INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (snapshot_id, row_rank)
);

CREATE INDEX IF NOT EXISTS idx_meta_teams_snapshot_id
    ON meta_teams (snapshot_id);

CREATE INDEX IF NOT EXISTS idx_meta_teams_combo_key
    ON meta_teams (combo_key);

CREATE INDEX IF NOT EXISTS idx_meta_teams_popularity
    ON meta_teams (popularity_count DESC NULLS LAST);
`;

const MIGRATION_SQL = `
ALTER TABLE training_rounds ADD COLUMN IF NOT EXISTS opponent_combo_key TEXT;
ALTER TABLE training_rounds ALTER COLUMN payload DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_training_rounds_opponent_combo_key
    ON training_rounds (opponent_combo_key);

ALTER TABLE training_rounds ADD COLUMN IF NOT EXISTS tester_user_id TEXT;
ALTER TABLE training_rounds ADD COLUMN IF NOT EXISTS tester_name TEXT;
ALTER TABLE training_rounds ADD COLUMN IF NOT EXISTS max_upgrade BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE training_rounds ADD COLUMN IF NOT EXISTS best_banner INTEGER;
ALTER TABLE training_rounds ADD COLUMN IF NOT EXISTS best_wins INTEGER;
ALTER TABLE training_rounds ADD COLUMN IF NOT EXISTS best_losses INTEGER;
ALTER TABLE training_rounds ADD COLUMN IF NOT EXISTS best_detail JSONB;

ALTER TABLE matchup_tests ADD COLUMN IF NOT EXISTS tester_user_id TEXT;
ALTER TABLE matchup_tests ADD COLUMN IF NOT EXISTS tester_name TEXT;
ALTER TABLE matchup_tests ADD COLUMN IF NOT EXISTS max_upgrade BOOLEAN NOT NULL DEFAULT TRUE;

DROP INDEX IF EXISTS idx_matchup_tests_unique_session;
CREATE UNIQUE INDEX IF NOT EXISTS idx_matchup_tests_unique_session
    ON matchup_tests (opponent_combo_id, session_id, my_hero_ids, my_pet, max_upgrade);

CREATE INDEX IF NOT EXISTS idx_matchup_tests_max_upgrade
    ON matchup_tests (max_upgrade);

CREATE INDEX IF NOT EXISTS idx_matchup_tests_my_combo_stats
    ON matchup_tests (max_upgrade, tester_user_id, win_rate DESC);
`;

function parseTimestamp(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseBigInt(value) {
    if (value == null || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : null;
}

export function buildComboKey(heroIds, pet, banner = 0) {
    const heroes = (Array.isArray(heroIds) ? heroIds : []).map(Number).filter((id) => id > 0 && id < 6000);
    return `${heroes.join(',')}|${Number(pet) || 0}|${Number(banner) || 0}`;
}

function extractOpponentTeam(body) {
    const team = body?.opponent?.team || {};
    const heroIds = Array.isArray(team.heroes)
        ? team.heroes.map(Number).filter((id) => id > 0 && id < 6000)
        : [];
    const pet = team.pet != null ? Number(team.pet) : null;
    const banner = team.banner != null ? Number(team.banner) : null;
    const comboKey = buildComboKey(heroIds, pet, banner);

    return {
        comboKey,
        heroIds,
        pet,
        banner,
        opponentUserId: body?.opponent?.userId != null ? String(body.opponent.userId) : null,
        opponentName: body?.opponent?.name || null,
        opponentPlace: body?.opponent?.place != null ? String(body.opponent.place) : null,
        opponentPower: parseBigInt(body?.opponent?.power),
    };
}

function extractTesterInfo(body) {
    const tester = body?.tester || {};
    const maxUpgrade = body?.config?.maxUpgrade ?? tester.maxUpgrade ?? body?.maxUpgrade;
    const isMaxUpgrade = maxUpgrade !== false;

    if (isMaxUpgrade) {
        return {
            userId: '0',
            name: 'maxHeros',
            maxUpgrade: true,
        };
    }

    const userId = tester.userId ?? body?.testerUserId ?? null;
    const name = tester.name ?? body?.testerName ?? null;
    return {
        userId: userId != null ? String(userId) : null,
        name: name != null ? String(name) : null,
        maxUpgrade: false,
    };
}

function compactBannerStones(stones) {
    if (!stones || typeof stones !== 'object') return {};
    const out = {};
    for (const [slot, value] of Object.entries(stones)) {
        if (value == null || value === '') continue;
        out[String(slot)] = Number.isFinite(Number(value)) ? Number(value) : value;
    }
    return out;
}

/**
 * Small JSON archive for SimLab / result detail pages (no simulation samples).
 */
function buildCompactRoundPayload(body, fields) {
    const best = body?.best || body?.rankings?.[0] || null;
    const opponentTeam = body?.opponent?.team || {};
    const label = fields.label || '';
    const isSimLab = typeof label === 'string' && label.toLowerCase().startsWith('simlab');
    // Full training rounds stay payload-free (size). SimLab needs pet/flag detail for the page.
    if (!isSimLab && !body?.forceStorePayload) return null;

    return {
        label: fields.label,
        maxUpgrade: fields.tester.maxUpgrade !== false,
        source: body?.opponent?.source || null,
        simLabGroupId: body?.simLabGroupId ? String(body.simLabGroupId) : null,
        simLabPhase: body?.simLabPhase ? String(body.simLabPhase) : null,
        best: best
            ? {
                heroes: Array.isArray(best.heroes) ? best.heroes.map(Number) : fields.bestHeroIds,
                heroNames: Array.isArray(best.heroNames) ? best.heroNames : fields.bestHeroNames,
                pet: best.pet != null ? Number(best.pet) : fields.bestPet,
                banner: best.banner != null
                    ? Number(best.banner)
                    : (body?.counterLineup?.banner != null
                        ? Number(body.counterLineup.banner)
                        : fields.bestBanner),
                bannerStones: compactBannerStones(
                    best.bannerStones
                    || body?.counterLineup?.bannerStones
                    || body?.config?.bannerStones
                ),
                favor: (best.favor && typeof best.favor === 'object' && Object.keys(best.favor).length)
                    ? best.favor
                    : (body?.counterLineup?.favor && typeof body.counterLineup.favor === 'object'
                        ? body.counterLineup.favor
                        : {}),
                wins: best.wins != null ? Number(best.wins) : null,
                losses: best.losses != null ? Number(best.losses) : null,
                winRate: best.winRate != null ? Number(best.winRate) : fields.bestWinRate,
                source: best.source || null,
                phase: body?.simLabPhase ? String(body.simLabPhase) : null,
            }
            : null,
        opponent: {
            userId: fields.opponent.opponentUserId,
            name: fields.opponent.opponentName,
            place: fields.opponent.opponentPlace,
            power: fields.opponent.opponentPower,
            banner: fields.opponent.banner,
            source: body?.opponent?.source || null,
            team: {
                heroes: fields.opponent.heroIds,
                pet: fields.opponent.pet,
                banner: fields.opponent.banner,
                bannerStones: compactBannerStones(
                    opponentTeam.bannerStones || opponentTeam.defenceBannerStones
                ),
                favor: opponentTeam.favor && typeof opponentTeam.favor === 'object'
                    ? opponentTeam.favor
                    : {},
            },
        },
        tester: {
            userId: fields.tester.userId,
            name: fields.tester.name,
            maxUpgrade: fields.tester.maxUpgrade !== false,
        },
    };
}

function extractBestDetail(best, body = null) {
    if (!best && !body) return null;
    const bannerStones = compactBannerStones(
        best?.bannerStones
        || body?.config?.bannerStones
        || body?.counterLineup?.bannerStones
    );
    const favor = best?.favor && typeof best.favor === 'object' ? best.favor : {};
    const detail = {
        banner: best?.banner != null ? Number(best.banner) : null,
        bannerStones,
        favor,
        source: best?.source || null,
        phase: body?.simLabPhase ? String(body.simLabPhase) : (best?.phase ? String(best.phase) : null),
    };
    if (
        detail.banner == null
        && !Object.keys(bannerStones).length
        && !Object.keys(favor).length
        && !detail.phase
    ) {
        return null;
    }
    return detail;
}

function extractRoundFields(body) {
    const best = body?.best || body?.rankings?.[0] || null;
    const opponent = extractOpponentTeam(body);
    const tester = extractTesterInfo(body);
    const fallbackBanner = best?.banner != null
        ? Number(best.banner)
        : (body?.counterLineup?.banner != null
            ? Number(body.counterLineup.banner)
            : (body?.config?.banner != null ? Number(body.config.banner) : null));
    const fields = {
        sessionId: body?.sessionId || `round_${Date.now()}`,
        label: body?.label || null,
        startedAt: parseTimestamp(body?.startedAt),
        completedAt: parseTimestamp(body?.completedAt),
        stoppedEarly: !!body?.stoppedEarly,
        opponent,
        tester,
        testedCombos: Number.isFinite(Number(body?.testedCombos)) ? Number(body.testedCombos) : null,
        bestWinRate: best?.winRate != null ? Number(best.winRate) : null,
        bestHeroIds: Array.isArray(best?.heroes) ? best.heroes.map(Number) : null,
        bestHeroNames: Array.isArray(best?.heroNames) ? best.heroNames : null,
        bestPet: best?.pet != null ? Number(best.pet) : null,
        bestBanner: Number.isFinite(fallbackBanner) && fallbackBanner > 0 ? fallbackBanner : null,
        bestWins: best?.wins != null ? Number(best.wins) : null,
        bestLosses: best?.losses != null ? Number(best.losses) : null,
        bestDetail: extractBestDetail(best, body),
        rankings: Array.isArray(body?.rankings) ? body.rankings : [],
    };
    // Keep bestDetail.banner aligned with the column we persist.
    if (fields.bestDetail && fields.bestBanner != null && fields.bestDetail.banner == null) {
        fields.bestDetail.banner = fields.bestBanner;
    }
    fields.payload = buildCompactRoundPayload(body, fields);
    return fields;
}

async function upsertOpponentCombo(client, opponent, testedAt) {
    const result = await client.query(
        `INSERT INTO opponent_combos (
            combo_key, hero_ids, pet, banner,
            opponent_user_id, opponent_name, opponent_place, opponent_power,
            first_seen_at, last_seen_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
        ON CONFLICT (combo_key) DO UPDATE SET
            opponent_user_id = COALESCE(EXCLUDED.opponent_user_id, opponent_combos.opponent_user_id),
            opponent_name = COALESCE(EXCLUDED.opponent_name, opponent_combos.opponent_name),
            opponent_place = COALESCE(EXCLUDED.opponent_place, opponent_combos.opponent_place),
            opponent_power = COALESCE(EXCLUDED.opponent_power, opponent_combos.opponent_power),
            last_seen_at = GREATEST(opponent_combos.last_seen_at, EXCLUDED.last_seen_at)
        RETURNING id, combo_key`,
        [
            opponent.comboKey,
            opponent.heroIds,
            opponent.pet,
            opponent.banner,
            opponent.opponentUserId,
            opponent.opponentName,
            opponent.opponentPlace,
            opponent.opponentPower,
            testedAt || new Date().toISOString(),
        ]
    );
    return result.rows[0];
}

async function saveMatchupTests(client, opponentComboId, sessionId, rankings, testedAt, tester = {}) {
    let saved = 0;
    const maxUpgrade = tester.maxUpgrade !== false;
    for (const ranking of rankings) {
        const myHeroIds = Array.isArray(ranking.heroes) ? ranking.heroes.map(Number) : [];
        if (!myHeroIds.length) continue;

        await client.query(
            `INSERT INTO matchup_tests (
                opponent_combo_id, session_id, my_hero_ids, my_hero_names, my_pet,
                wins, losses, win_rate, rank, tested_at,
                tester_user_id, tester_name, max_upgrade
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            ON CONFLICT (opponent_combo_id, session_id, my_hero_ids, my_pet, max_upgrade) DO UPDATE SET
                my_hero_names = EXCLUDED.my_hero_names,
                wins = EXCLUDED.wins,
                losses = EXCLUDED.losses,
                win_rate = EXCLUDED.win_rate,
                rank = EXCLUDED.rank,
                tested_at = EXCLUDED.tested_at,
                tester_user_id = EXCLUDED.tester_user_id,
                tester_name = EXCLUDED.tester_name`,
            [
                opponentComboId,
                sessionId,
                myHeroIds,
                Array.isArray(ranking.heroNames) ? ranking.heroNames : null,
                ranking.pet != null ? Number(ranking.pet) : null,
                ranking.wins != null ? Number(ranking.wins) : null,
                ranking.losses != null ? Number(ranking.losses) : null,
                ranking.winRate != null ? Number(ranking.winRate) : 0,
                ranking.rank != null ? Number(ranking.rank) : null,
                testedAt,
                tester.userId ?? null,
                tester.name ?? null,
                maxUpgrade,
            ]
        );
        saved++;
    }
    return saved;
}

export async function initDatabase() {
    if (!pool) {
        pool = createPool();
    }

    const client = await pool.connect();
    try {
        await client.query(SCHEMA_SQL);
        await client.query(MIGRATION_SQL);
        ready = true;
        lastError = null;
    } catch (error) {
        ready = false;
        lastError = error;
        throw error;
    } finally {
        client.release();
    }
}

export async function saveTrainingRound(body) {
    if (!pool) {
        pool = createPool();
    }

    const fields = extractRoundFields(body);
    if (!fields.opponent.heroIds.length) {
        throw new Error('Opponent team missing hero combo data');
    }

    const testedAt = fields.completedAt || new Date().toISOString();
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const opponentRow = await upsertOpponentCombo(client, fields.opponent, testedAt);
        const matchupCount = await saveMatchupTests(
            client,
            opponentRow.id,
            fields.sessionId,
            fields.rankings,
            testedAt,
            fields.tester
        );

        const roundResult = await client.query(
            `INSERT INTO training_rounds (
                session_id, label, started_at, completed_at, stopped_early,
                opponent_combo_key, opponent_user_id, opponent_name, opponent_place, opponent_power,
                tested_combos, best_win_rate, best_hero_ids, best_hero_names, best_pet,
                best_banner, best_wins, best_losses, best_detail, payload,
                tester_user_id, tester_name, max_upgrade
            ) VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8, $9, $10,
                $11, $12, $13, $14, $15,
                $16, $17, $18, $19::jsonb, $20::jsonb,
                $21, $22, $23
            )
            ON CONFLICT (session_id) DO UPDATE SET
                label = EXCLUDED.label,
                started_at = EXCLUDED.started_at,
                completed_at = EXCLUDED.completed_at,
                stopped_early = EXCLUDED.stopped_early,
                opponent_combo_key = EXCLUDED.opponent_combo_key,
                opponent_user_id = EXCLUDED.opponent_user_id,
                opponent_name = EXCLUDED.opponent_name,
                opponent_place = EXCLUDED.opponent_place,
                opponent_power = EXCLUDED.opponent_power,
                tested_combos = EXCLUDED.tested_combos,
                best_win_rate = EXCLUDED.best_win_rate,
                best_hero_ids = EXCLUDED.best_hero_ids,
                best_hero_names = EXCLUDED.best_hero_names,
                best_pet = EXCLUDED.best_pet,
                best_banner = COALESCE(EXCLUDED.best_banner, training_rounds.best_banner),
                best_wins = COALESCE(EXCLUDED.best_wins, training_rounds.best_wins),
                best_losses = COALESCE(EXCLUDED.best_losses, training_rounds.best_losses),
                best_detail = COALESCE(EXCLUDED.best_detail, training_rounds.best_detail),
                payload = COALESCE(EXCLUDED.payload, training_rounds.payload),
                tester_user_id = EXCLUDED.tester_user_id,
                tester_name = EXCLUDED.tester_name,
                max_upgrade = EXCLUDED.max_upgrade
            RETURNING id, session_id, completed_at`,
            [
                fields.sessionId,
                fields.label,
                fields.startedAt,
                testedAt,
                fields.stoppedEarly,
                fields.opponent.comboKey,
                fields.opponent.opponentUserId,
                fields.opponent.opponentName,
                fields.opponent.opponentPlace,
                fields.opponent.opponentPower,
                fields.testedCombos,
                fields.bestWinRate,
                fields.bestHeroIds,
                fields.bestHeroNames,
                fields.bestPet,
                fields.bestBanner,
                fields.bestWins,
                fields.bestLosses,
                fields.bestDetail ? JSON.stringify(fields.bestDetail) : null,
                fields.payload ? JSON.stringify(fields.payload) : null,
                fields.tester.userId,
                fields.tester.name,
                fields.tester.maxUpgrade !== false,
            ]
        );

        await client.query('COMMIT');
        ready = true;
        lastError = null;

        return {
            storage: 'postgresql',
            roundId: roundResult.rows[0].id,
            sessionId: roundResult.rows[0].session_id,
            completedAt: roundResult.rows[0].completed_at,
            opponentComboKey: opponentRow.combo_key,
            matchupCount,
            summary: {
                sessionId: fields.sessionId,
                label: fields.label,
                opponentComboKey: opponentRow.combo_key,
                opponentHeroes: fields.opponent.heroIds,
                opponentPet: fields.opponent.pet,
                opponent: fields.opponent.opponentName || fields.opponent.opponentUserId,
                bestWinRate: fields.bestWinRate,
                bestHeroes: fields.bestHeroNames,
                bestPet: fields.bestPet,
                comboCount: matchupCount,
            },
        };
    } catch (error) {
        await client.query('ROLLBACK');
        lastError = error;
        throw error;
    } finally {
        client.release();
    }
}

export async function getTrainingSummary() {
    if (!pool) {
        pool = createPool();
    }

    const [roundCount, opponentCount, matchupCount, latestMatchup] = await Promise.all([
        pool.query('SELECT COUNT(*)::int AS count FROM training_rounds'),
        pool.query('SELECT COUNT(*)::int AS count FROM opponent_combos'),
        pool.query('SELECT COUNT(*)::int AS count FROM matchup_tests'),
        pool.query(
            `SELECT oc.combo_key, oc.hero_ids, oc.pet, oc.opponent_name,
                    mt.my_hero_ids, mt.my_pet, mt.win_rate, mt.tested_at
             FROM matchup_tests mt
             JOIN opponent_combos oc ON oc.id = mt.opponent_combo_id
             ORDER BY mt.tested_at DESC NULLS LAST, mt.id DESC
             LIMIT 1`
        ),
    ]);

    const latestRow = latestMatchup.rows[0] || null;
    const latestSummary = latestRow
        ? {
            opponentComboKey: latestRow.combo_key,
            opponentHeroes: latestRow.hero_ids,
            opponentPet: latestRow.pet,
            opponentName: latestRow.opponent_name,
            myHeroes: latestRow.my_hero_ids,
            myPet: latestRow.my_pet,
            winRate: latestRow.win_rate != null ? Number(latestRow.win_rate) : null,
            testedAt: latestRow.tested_at,
        }
        : null;

    ready = true;
    lastError = null;

    return {
        storage: 'postgresql',
        databaseUrl: maskDatabaseUrl(getDatabaseUrl()),
        roundCount: roundCount.rows[0]?.count || 0,
        opponentComboCount: opponentCount.rows[0]?.count || 0,
        matchupTestCount: matchupCount.rows[0]?.count || 0,
        latestSessionId: latestRow ? null : null,
        latestSummary,
        roundFiles: roundCount.rows[0]?.count || 0,
        latestFile: latestRow?.combo_key || null,
    };
}

function normalizeHeroFilterIds(heroIds) {
    if (!Array.isArray(heroIds)) {
        return [];
    }
    return [...new Set(
        heroIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
    )];
}

function parseComboKey(comboKey) {
    if (!comboKey || typeof comboKey !== 'string') {
        return { heroIds: [], pet: 0, banner: 0 };
    }
    const [heroesPart = '', petPart = '0', bannerPart = '0'] = comboKey.split('|');
    const heroIds = heroesPart
        .split(',')
        .map((id) => Number(id))
        .filter((id) => id > 0 && id < 6000);
    return {
        heroIds,
        pet: Number(petPart) || 0,
        banner: Number(bannerPart) || 0,
    };
}

function buildOpponentSetMatchClauses({ heroIds, pet, banner, params, alias = 'oc' }) {
    const heroes = normalizeHeroFilterIds(heroIds).filter((id) => id < 6000);
    if (heroes.length !== 5) {
        return { clauses: [], valid: false };
    }

    const clauses = [];
    params.push(heroes);
    clauses.push(`${alias}.hero_ids @> $${params.length}::int[]`);
    clauses.push(`cardinality(${alias}.hero_ids) = 5`);

    const petValue = Number(pet) || 0;
    if (petValue > 0) {
        params.push(petValue);
        clauses.push(`${alias}.pet = $${params.length}`);
    }

    const bannerValue = Number(banner) || 0;
    if (bannerValue > 0) {
        params.push(bannerValue);
        clauses.push(`${alias}.banner = $${params.length}`);
    }

    return { clauses, valid: true };
}

function appendComboHeroFilterClauses({ heroIds, heroColumn, petColumn, params }) {
    const ids = normalizeHeroFilterIds(heroIds);
    if (!ids.length) {
        return [];
    }

    const clauses = [];
    const heroes = ids.filter((id) => id < 6000);
    const pets = ids.filter((id) => id >= 6000);

    if (heroes.length) {
        params.push(heroes);
        clauses.push(`${heroColumn} @> $${params.length}::int[]`);
    }
    for (const petId of pets) {
        params.push(petId);
        clauses.push(`${petColumn} = $${params.length}`);
    }
    return clauses;
}

const TRAINING_RESULT_SORTS = {
    list: 'oc.opponent_place',
    opponent: 'oc.combo_key',
    label: 'oc.opponent_name',
    tester: 'COALESCE(mt.tester_name, mt.tester_user_id::text, \'\')',
    team: "array_to_string(mt.my_hero_ids, ',') || '|' || COALESCE(mt.my_pet::text, '0')",
    winRate: 'mt.win_rate',
    record: 'mt.wins',
    when: 'mt.tested_at',
};

export function normalizeTrainingResultSort(sort, order) {
    const sortKey = TRAINING_RESULT_SORTS[sort] ? sort : 'when';
    const sortOrder = order === 'asc' ? 'asc' : 'desc';
    return { sort: sortKey, order: sortOrder };
}

function buildTrainingResultOrderBy(sort = 'when', order = 'desc') {
    const { sort: sortKey, order: sortOrder } = normalizeTrainingResultSort(sort, order);
    const column = TRAINING_RESULT_SORTS[sortKey];
    const direction = sortOrder === 'asc' ? 'ASC' : 'DESC';
    const nulls = sortOrder === 'asc' ? 'NULLS FIRST' : 'NULLS LAST';
    const parts = [`${column} ${direction} ${nulls}`];

    if (sortKey === 'record') {
        parts.push(`mt.losses ${direction} ${nulls}`);
    }
    if (sortKey !== 'when') {
        parts.push('mt.tested_at DESC NULLS LAST');
    }
    parts.push('mt.id DESC');
    return parts.join(', ');
}

function buildTrainingResultWhere({ comboKey, opponentHeroIds, myHeroIds, testerUserId, params }) {
    const clauses = [];
    if (comboKey) {
        params.push(comboKey);
        clauses.push(`oc.combo_key = $${params.length}`);
    }
    if (testerUserId != null && testerUserId !== '') {
        if (String(testerUserId) === '0') {
            clauses.push(`COALESCE(mt.tester_user_id, '0') = '0' AND COALESCE(mt.max_upgrade, TRUE) = TRUE`);
        } else {
            params.push(String(testerUserId));
            clauses.push(`mt.tester_user_id = $${params.length}`);
        }
    }
    clauses.push(...appendComboHeroFilterClauses({
        heroIds: opponentHeroIds,
        heroColumn: 'oc.hero_ids',
        petColumn: 'oc.pet',
        params,
    }));
    clauses.push(...appendComboHeroFilterClauses({
        heroIds: myHeroIds,
        heroColumn: 'mt.my_hero_ids',
        petColumn: 'mt.my_pet',
        params,
    }));
    return clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
}

export async function getTrainingTesters() {
    if (!pool) {
        pool = createPool();
    }

    const result = await pool.query(
        `SELECT
            COALESCE(tester_user_id, '0') AS tester_user_id,
            COALESCE(
                NULLIF(tester_name, ''),
                CASE WHEN COALESCE(max_upgrade, TRUE) THEN 'maxHeros' ELSE 'Unknown user' END
            ) AS tester_name,
            COALESCE(max_upgrade, TRUE) AS max_upgrade,
            COUNT(*)::int AS test_count,
            MAX(tested_at) AS last_tested_at
         FROM matchup_tests
         GROUP BY 1, 2, 3
         ORDER BY max_upgrade DESC, test_count DESC, tester_name ASC`
    );

    return result.rows.map((row) => ({
        testerUserId: row.tester_user_id,
        testerName: row.tester_name,
        maxUpgrade: row.max_upgrade,
        testCount: row.test_count,
        lastTestedAt: row.last_tested_at,
    }));
}

async function queryMyComboStats({ comboKey, opponentHeroIds, myHeroIds, testerUserId, minWinRate, limit } = {}) {
    if (!pool) {
        pool = createPool();
    }

    const params = [];
    const where = buildTrainingResultWhere({ comboKey, opponentHeroIds, myHeroIds, testerUserId, params });
    params.push(minWinRate);
    const minWinRateParam = `$${params.length}`;

    let limitClause = '';
    if (limit != null && limit > 0) {
        params.push(limit);
        limitClause = `LIMIT $${params.length}`;
    }

    const result = await pool.query(
        `SELECT
            mt.my_hero_ids,
            (array_agg(mt.my_hero_names ORDER BY mt.tested_at DESC NULLS LAST))[1] AS my_hero_names,
            mt.my_pet,
            COUNT(*)::int AS test_count,
            ROUND(AVG(mt.win_rate)::numeric, 1) AS avg_win_rate,
            COUNT(*) FILTER (WHERE mt.win_rate >= ${minWinRateParam})::int AS high_win_count,
            ROUND(MAX(mt.win_rate)::numeric, 1) AS best_win_rate
         FROM matchup_tests mt
         JOIN opponent_combos oc ON oc.id = mt.opponent_combo_id
         ${where}
         GROUP BY mt.my_hero_ids, mt.my_pet
         ORDER BY high_win_count DESC, test_count DESC, avg_win_rate DESC
         ${limitClause}`,
        params
    );

    return result.rows.map((row) => ({
        myHeroIds: row.my_hero_ids,
        myHeroNames: row.my_hero_names,
        myPet: row.my_pet,
        testCount: row.test_count,
        avgWinRate: row.avg_win_rate != null ? Number(row.avg_win_rate) : null,
        highWinCount: row.high_win_count,
        bestWinRate: row.best_win_rate != null ? Number(row.best_win_rate) : null,
    }));
}

export async function getTrainingResultCount({ comboKey, opponentHeroIds, myHeroIds, testerUserId } = {}) {
    if (!pool) {
        pool = createPool();
    }

    const params = [];
    const where = buildTrainingResultWhere({ comboKey, opponentHeroIds, myHeroIds, testerUserId, params });

    const result = await pool.query(
        `SELECT COUNT(*)::int AS count
         FROM matchup_tests mt
         JOIN opponent_combos oc ON oc.id = mt.opponent_combo_id
         ${where}`,
        params
    );

    return result.rows[0]?.count || 0;
}

export async function getTrainingResults({
    limit,
    offset = 0,
    comboKey,
    opponentHeroIds,
    myHeroIds,
    testerUserId,
    sort,
    order,
} = {}) {
    if (!pool) {
        pool = createPool();
    }

    const params = [];
    const where = buildTrainingResultWhere({ comboKey, opponentHeroIds, myHeroIds, testerUserId, params });

    let paging = '';
    if (offset > 0) {
        params.push(offset);
        paging += ` OFFSET $${params.length}`;
    }
    if (limit != null && limit > 0) {
        params.push(limit);
        paging += ` LIMIT $${params.length}`;
    }

    const result = await pool.query(
        `SELECT
            oc.combo_key,
            oc.hero_ids AS opponent_hero_ids,
            oc.pet AS opponent_pet,
            oc.opponent_name,
            oc.opponent_place,
            oc.opponent_power,
            mt.my_hero_ids,
            mt.my_hero_names,
            mt.my_pet,
            mt.win_rate,
            mt.wins,
            mt.losses,
            mt.rank,
            mt.tested_at,
            mt.session_id,
            mt.tester_user_id,
            mt.tester_name,
            mt.max_upgrade
         FROM matchup_tests mt
         JOIN opponent_combos oc ON oc.id = mt.opponent_combo_id
         ${where}
         ORDER BY ${buildTrainingResultOrderBy(sort, order)}
         ${paging}`,
        params
    );

    return result.rows;
}

export async function getTrainingResultStats({
    comboKey,
    opponentHeroIds,
    myHeroIds,
    testerUserId,
    topN = 10,
    minWinRate = 90,
    grandArenaMaxResults = 5,
    grandArenaComboPool = 80,
} = {}) {
    // Cap the GA input pool — uncapped O(n³) over 1000+ combos hangs Node and can throw
    // "Set maximum size exceeded" (V8 Set limit ~16.7M).
    const gaPoolLimit = Number.isFinite(grandArenaComboPool) && grandArenaComboPool > 0
        ? Math.floor(grandArenaComboPool)
        : 80;
    const gaResultLimit = grandArenaMaxResults > 0 ? grandArenaMaxResults : 5;

    const [gaCombos, topMyCombos, topHeroesResult] = await Promise.all([
        queryMyComboStats({
            comboKey,
            opponentHeroIds,
            myHeroIds: [],
            testerUserId,
            minWinRate,
            limit: gaPoolLimit,
        }),
        queryMyComboStats({ comboKey, opponentHeroIds, myHeroIds, testerUserId, minWinRate, limit: topN }),
        (async () => {
            if (!pool) {
                pool = createPool();
            }

            const params = [];
            const where = buildTrainingResultWhere({ comboKey, opponentHeroIds, myHeroIds, testerUserId, params });
            params.push(topN);
            const topLimit = `$${params.length}`;
            params.push(minWinRate);
            const minWinRateParam = `$${params.length}`;

            const result = await pool.query(
                `WITH filtered AS (
                    SELECT mt.my_hero_ids, mt.my_pet, mt.win_rate
                    FROM matchup_tests mt
                    JOIN opponent_combos oc ON oc.id = mt.opponent_combo_id
                    ${where}
                 ),
                 hero_rows AS (
                    SELECT unnest(my_hero_ids) AS hero_id, win_rate FROM filtered
                    UNION ALL
                    SELECT my_pet AS hero_id, win_rate FROM filtered WHERE my_pet IS NOT NULL
                 )
                 SELECT
                    hero_id,
                    COUNT(*)::int AS appearances,
                    COUNT(*) FILTER (WHERE win_rate >= ${minWinRateParam})::int AS wins_90,
                    ROUND(AVG(win_rate)::numeric, 1) AS avg_win_rate
                 FROM hero_rows
                 WHERE hero_id IS NOT NULL
                 GROUP BY hero_id
                 ORDER BY wins_90 DESC, avg_win_rate DESC, appearances DESC
                 LIMIT ${topLimit}`,
                params
            );
            return result.rows;
        })(),
    ]);

    const grandArenaRequiredHeroes = normalizeHeroFilterIds(myHeroIds);
    const grandArena = findGrandArenaSelections(gaCombos, {
        maxResults: gaResultLimit,
        requiredHeroIds: grandArenaRequiredHeroes,
        maxComboPool: gaPoolLimit,
    });

    return {
        topMyCombos: topMyCombos,
        topMyHeroes: topHeroesResult.map((row) => ({
            heroId: row.hero_id,
            appearances: row.appearances,
            wins90: row.wins_90,
            avgWinRate: row.avg_win_rate != null ? Number(row.avg_win_rate) : null,
        })),
        grandArenaSelections: grandArena.selections,
        grandArenaSelectionCount: grandArena.totalCount,
        grandArenaShownCount: grandArena.selections.length,
        comboPoolSize: grandArena.poolSize,
        grandArenaRequiredHeroes,
        minWinRate,
    };
}

export async function getOpponentSkipCheck({
    comboKey,
    opponentHeroIds,
    minWinRate = 90,
    maxAgeDays = 30,
} = {}) {
    if (!comboKey) {
        return { shouldSkip: false, reason: 'missing_combo_key' };
    }

    if (!pool) {
        pool = createPool();
    }

    const parsed = parseComboKey(comboKey);
    const explicitHeroIds = normalizeHeroFilterIds(opponentHeroIds).filter((id) => id < 6000);
    const matchHeroIds = explicitHeroIds.length === 5 ? explicitHeroIds : parsed.heroIds;
    const params = [];
    const { clauses, valid } = buildOpponentSetMatchClauses({
        heroIds: matchHeroIds,
        pet: parsed.pet,
        banner: parsed.banner,
        params,
    });
    const opponentWhere = valid
        ? clauses.join(' AND ')
        : (() => {
            params.push(comboKey);
            return `oc.combo_key = $${params.length}`;
        })();

    params.push(minWinRate);
    const minWinRateParam = `$${params.length}`;
    params.push(String(maxAgeDays));
    const maxAgeParam = `$${params.length}`;

    const result = await pool.query(
        `SELECT
            oc.combo_key,
            oc.opponent_name,
            MAX(mt.win_rate) AS best_win_rate,
            MAX(mt.tested_at) AS last_tested_at,
            (
                SELECT COALESCE(json_agg(ranked.match ORDER BY ranked.win_rate DESC, ranked.tested_at DESC), '[]'::json)
                FROM (
                    SELECT distinct_matches.*
                    FROM (
                        SELECT DISTINCT ON (best.my_hero_ids, COALESCE(best.my_pet, 0))
                            json_build_object(
                                'myHeroIds', best.my_hero_ids,
                                'myHeroNames', best.my_hero_names,
                                'myPet', best.my_pet,
                                'winRate', best.win_rate,
                                'testedAt', best.tested_at
                            ) AS match,
                            best.win_rate,
                            best.tested_at
                        FROM matchup_tests best
                        WHERE best.opponent_combo_id = oc.id
                          AND best.win_rate >= ${minWinRateParam}
                          AND best.tested_at >= NOW() - (${maxAgeParam}::text || ' days')::interval
                          AND COALESCE(best.max_upgrade, TRUE) = TRUE
                          AND cardinality(best.my_hero_ids) = 5
                        ORDER BY best.my_hero_ids, COALESCE(best.my_pet, 0), best.win_rate DESC, best.tested_at DESC
                    ) distinct_matches
                    ORDER BY distinct_matches.win_rate DESC, distinct_matches.tested_at DESC
                    LIMIT 50
                ) ranked
            ) AS best_matches
         FROM opponent_combos oc
         JOIN matchup_tests mt ON mt.opponent_combo_id = oc.id
         WHERE ${opponentWhere}
           AND mt.win_rate >= ${minWinRateParam}
           AND mt.tested_at >= NOW() - (${maxAgeParam}::text || ' days')::interval
           AND COALESCE(mt.max_upgrade, TRUE) = TRUE
         GROUP BY oc.id, oc.combo_key, oc.opponent_name`,
        params
    );

    const row = result.rows[0];
    const bestMatches = Array.isArray(row?.best_matches)
        ? row.best_matches.filter((match) => Array.isArray(match?.myHeroIds) && match.myHeroIds.length === 5)
        : [];
    if (!bestMatches.length) {
        return {
            shouldSkip: false,
            comboKey,
            minWinRate,
            maxAgeDays,
            bestMatches: [],
        };
    }

    const bestMatch = bestMatches[0];
    return {
        shouldSkip: true,
        comboKey: row.combo_key,
        opponentName: row.opponent_name,
        bestWinRate: row.best_win_rate != null ? Number(row.best_win_rate) : null,
        lastTestedAt: row.last_tested_at,
        bestMatch,
        bestMatches,
        minWinRate,
        maxAgeDays,
    };
}

export async function getUserCounterSkipCheck({
    comboKey,
    testerUserId,
    myHeroIds,
    myPet,
    maxAgeDays = 30,
} = {}) {
    if (!comboKey) {
        return { shouldSkip: false, reason: 'missing_combo_key' };
    }
    if (!testerUserId) {
        return { shouldSkip: false, reason: 'missing_tester_user_id' };
    }

    const heroIds = (Array.isArray(myHeroIds) ? myHeroIds : [])
        .map(Number)
        .filter((id) => id > 0 && id < 6000);
    const pet = myPet != null ? Number(myPet) : null;

    if (heroIds.length !== 5 || !pet) {
        return { shouldSkip: false, reason: 'missing_counter_lineup' };
    }

    if (!pool) {
        pool = createPool();
    }

    const parsed = parseComboKey(comboKey);
    const params = [];
    const { clauses, valid } = buildOpponentSetMatchClauses({
        heroIds: parsed.heroIds,
        pet: parsed.pet,
        banner: parsed.banner,
        params,
    });
    const opponentWhere = valid
        ? clauses.join(' AND ')
        : (() => {
            params.push(comboKey);
            return `oc.combo_key = $${params.length}`;
        })();

    params.push(String(testerUserId));
    const testerParam = `$${params.length}`;
    params.push(heroIds);
    const myHeroesParam = `$${params.length}`;
    params.push(pet);
    const myPetParam = `$${params.length}`;
    params.push(String(maxAgeDays));
    const maxAgeParam = `$${params.length}`;

    const result = await pool.query(
        `SELECT
            mt.my_hero_ids,
            mt.my_hero_names,
            mt.my_pet,
            mt.win_rate,
            mt.wins,
            mt.losses,
            mt.tested_at,
            mt.tester_user_id,
            mt.tester_name
         FROM matchup_tests mt
         JOIN opponent_combos oc ON oc.id = mt.opponent_combo_id
         WHERE ${opponentWhere}
           AND mt.tester_user_id = ${testerParam}
           AND COALESCE(mt.max_upgrade, TRUE) = FALSE
           AND mt.my_hero_ids = ${myHeroesParam}::int[]
           AND mt.my_pet = ${myPetParam}
           AND mt.tested_at >= NOW() - (${maxAgeParam}::text || ' days')::interval
         ORDER BY mt.tested_at DESC, mt.id DESC
         LIMIT 1`,
        params
    );

    const row = result.rows[0];
    if (!row) {
        return {
            shouldSkip: false,
            comboKey,
            testerUserId: String(testerUserId),
            maxAgeDays,
        };
    }

    return {
        shouldSkip: true,
        comboKey,
        testerUserId: row.tester_user_id,
        testerName: row.tester_name,
        cachedWinRate: row.win_rate != null ? Number(row.win_rate) : null,
        cachedWins: row.wins != null ? Number(row.wins) : null,
        cachedLosses: row.losses != null ? Number(row.losses) : null,
        lastTestedAt: row.tested_at,
        cachedMatch: {
            myHeroIds: row.my_hero_ids,
            myHeroNames: row.my_hero_names,
            myPet: row.my_pet,
            winRate: row.win_rate != null ? Number(row.win_rate) : null,
            wins: row.wins != null ? Number(row.wins) : null,
            losses: row.losses != null ? Number(row.losses) : null,
            testedAt: row.tested_at,
        },
        maxAgeDays,
    };
}

function formatCounterMatch(match) {
    if (!match || !Array.isArray(match.myHeroIds) || match.myHeroIds.length !== 5) {
        return null;
    }
    return {
        myHeroIds: match.myHeroIds.map(Number),
        myHeroNames: Array.isArray(match.myHeroNames) ? match.myHeroNames : [],
        myPet: match.myPet != null ? Number(match.myPet) : null,
        winRate: match.winRate != null ? Number(match.winRate) : null,
        wins: match.wins != null ? Number(match.wins) : null,
        losses: match.losses != null ? Number(match.losses) : null,
        testedAt: match.testedAt || null,
        maxUpgrade: match.maxUpgrade === true,
    };
}

async function queryDistinctCounterMatches({
    opponentComboId,
    opponentComboIds = null,
    minWinRate,
    maxAgeDays,
    maxUpgrade,
    testerUserId = null,
    limit = 2,
}) {
    const ids = Array.isArray(opponentComboIds) && opponentComboIds.length
        ? opponentComboIds.map(Number).filter((id) => Number.isFinite(id) && id > 0)
        : (opponentComboId != null ? [Number(opponentComboId)].filter((id) => Number.isFinite(id) && id > 0) : []);
    if (!ids.length) {
        return [];
    }

    const queryParams = [ids, minWinRate, String(maxAgeDays), Boolean(maxUpgrade)];
    const opponentIdsParam = '$1';
    const minWinRateParam = '$2';
    const maxAgeParam = '$3';
    const maxUpgradeParam = '$4';

    let testerClause = '';
    if (testerUserId != null && testerUserId !== '') {
        queryParams.push(String(testerUserId));
        testerClause = `AND best.tester_user_id = $${queryParams.length}`;
    }

    queryParams.push(Math.max(1, Number(limit) || 1));
    const limitParam = `$${queryParams.length}`;

    const result = await pool.query(
        `SELECT distinct_matches.match
         FROM (
            SELECT DISTINCT ON (best.my_hero_ids, COALESCE(best.my_pet, 0))
                json_build_object(
                    'myHeroIds', best.my_hero_ids,
                    'myHeroNames', best.my_hero_names,
                    'myPet', best.my_pet,
                    'winRate', best.win_rate,
                    'wins', best.wins,
                    'losses', best.losses,
                    'testedAt', best.tested_at,
                    'maxUpgrade', COALESCE(best.max_upgrade, TRUE)
                ) AS match,
                best.win_rate,
                best.tested_at
            FROM matchup_tests best
            WHERE best.opponent_combo_id = ANY(${opponentIdsParam}::int[])
              AND best.win_rate >= ${minWinRateParam}
              AND best.tested_at >= NOW() - (${maxAgeParam}::text || ' days')::interval
              AND COALESCE(best.max_upgrade, TRUE) = ${maxUpgradeParam}
              AND cardinality(best.my_hero_ids) = 5
              ${testerClause}
            ORDER BY best.my_hero_ids, COALESCE(best.my_pet, 0), best.win_rate DESC, best.tested_at DESC
         ) distinct_matches
         ORDER BY distinct_matches.win_rate DESC, distinct_matches.tested_at DESC
         LIMIT ${limitParam}`,
        queryParams
    );

    return result.rows
        .map((row) => formatCounterMatch(row.match))
        .filter(Boolean);
}

/**
 * Recommend attack lineups for an opponent defense combo.
 * - atPower: up to 3 winning lineups tested at the player's real power
 * - maxBeat: up to 3 best max-upgrade counters (attack still uses account power in-game)
 * Banner is ignored for matching — same heroes+pet share training across banners.
 */
export async function getTrainingCounters({
    comboKey,
    testerUserId,
    minWinRate = 50,
    maxAgeDays = 30,
    atPowerLimit = 3,
    maxBeatLimit = 3,
} = {}) {
    if (!comboKey) {
        return { ok: false, reason: 'missing_combo_key', atPower: [], maxBeat: [] };
    }

    if (!pool) {
        pool = createPool();
    }

    const parsed = parseComboKey(comboKey);
    const params = [];
    // Intentionally ignore banner: CD/arena banners vary while hero+pet training still applies.
    const { clauses, valid } = buildOpponentSetMatchClauses({
        heroIds: parsed.heroIds,
        pet: parsed.pet,
        banner: 0,
        params,
    });
    const opponentWhere = valid
        ? clauses.join(' AND ')
        : (() => {
            params.push(comboKey);
            return `oc.combo_key = $${params.length}`;
        })();

    const opponentMeta = await pool.query(
        `SELECT oc.id, oc.combo_key, oc.opponent_name, oc.opponent_user_id, oc.last_seen_at
         FROM opponent_combos oc
         WHERE ${opponentWhere}
         ORDER BY
            CASE WHEN oc.opponent_name ILIKE 'Meta:%' THEN 0 ELSE 1 END,
            oc.last_seen_at DESC NULLS LAST`,
        params
    );
    const rows = opponentMeta.rows || [];
    const meta = rows[0] || null;
    if (!meta) {
        return {
            ok: true,
            comboKey,
            opponentName: null,
            opponentUserId: null,
            testerUserId: testerUserId != null ? String(testerUserId) : null,
            minWinRate,
            maxAgeDays,
            atPower: [],
            maxBeat: [],
            reason: 'opponent_not_found',
        };
    }

    const opponentComboIds = rows.map((row) => row.id).filter((id) => id != null);
    const atLimit = Math.max(1, Math.min(5, Number(atPowerLimit) || 3));
    const maxLimit = Math.max(1, Math.min(5, Number(maxBeatLimit) || 3));

    const [atPower, maxBeat] = await Promise.all([
        testerUserId
            ? queryDistinctCounterMatches({
                opponentComboIds,
                minWinRate,
                maxAgeDays,
                maxUpgrade: false,
                testerUserId,
                limit: atLimit,
            })
            : Promise.resolve([]),
        queryDistinctCounterMatches({
            opponentComboIds,
            minWinRate,
            maxAgeDays,
            maxUpgrade: true,
            testerUserId: null,
            limit: maxLimit,
        }),
    ]);

    return {
        ok: true,
        comboKey: meta.combo_key || comboKey,
        opponentName: meta.opponent_name || null,
        opponentUserId: meta.opponent_user_id || null,
        testerUserId: testerUserId != null ? String(testerUserId) : null,
        minWinRate,
        maxAgeDays,
        matchedOpponentCombos: opponentComboIds.length,
        atPower,
        maxBeat,
    };
}

export async function getMatchups({ comboKey, limit = 50 } = {}) {
    if (!pool) {
        pool = createPool();
    }

    if (comboKey) {
        const result = await pool.query(
            `SELECT
                oc.combo_key,
                oc.hero_ids AS opponent_hero_ids,
                oc.pet AS opponent_pet,
                oc.banner AS opponent_banner,
                oc.opponent_name,
                oc.opponent_place,
                oc.opponent_power,
                oc.last_seen_at,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'myHeroIds', mt.my_hero_ids,
                            'myHeroNames', mt.my_hero_names,
                            'myPet', mt.my_pet,
                            'winRate', mt.win_rate,
                            'wins', mt.wins,
                            'losses', mt.losses,
                            'rank', mt.rank,
                            'testedAt', mt.tested_at,
                            'sessionId', mt.session_id
                        )
                        ORDER BY mt.win_rate DESC, mt.tested_at DESC
                    ) FILTER (WHERE mt.id IS NOT NULL),
                    '[]'::json
                ) AS tests
             FROM opponent_combos oc
             LEFT JOIN matchup_tests mt ON mt.opponent_combo_id = oc.id
             WHERE oc.combo_key = $1
             GROUP BY oc.id`,
            [comboKey]
        );
        return result.rows[0] || null;
    }

    const result = await pool.query(
        `SELECT
            oc.combo_key,
            oc.hero_ids AS opponent_hero_ids,
            oc.pet AS opponent_pet,
            oc.banner AS opponent_banner,
            oc.opponent_name,
            oc.opponent_place,
            oc.opponent_power,
            oc.last_seen_at,
            COUNT(mt.id)::int AS test_count,
            MAX(mt.tested_at) AS last_tested_at,
            MAX(mt.win_rate) AS best_win_rate
         FROM opponent_combos oc
         LEFT JOIN matchup_tests mt ON mt.opponent_combo_id = oc.id
         GROUP BY oc.id
         ORDER BY oc.last_seen_at DESC NULLS LAST, oc.id DESC
         LIMIT $1`,
        [limit]
    );

    return result.rows.map((row) => ({
        comboKey: row.combo_key,
        opponentHeroIds: row.opponent_hero_ids,
        opponentPet: row.opponent_pet,
        opponentBanner: row.opponent_banner,
        opponentName: row.opponent_name,
        opponentPlace: row.opponent_place,
        opponentPower: row.opponent_power != null ? Number(row.opponent_power) : null,
        lastSeenAt: row.last_seen_at,
        testCount: row.test_count,
        lastTestedAt: row.last_tested_at,
        bestWinRate: row.best_win_rate != null ? Number(row.best_win_rate) : null,
    }));
}

export async function getMetaTeamSnapshots({ limit = 20 } = {}) {
    if (!pool) {
        pool = createPool();
    }

    const result = await pool.query(
        `SELECT
            id,
            captured_at,
            source,
            source_url,
            position_max,
            pages_scraped,
            total_teams,
            unique_combos,
            notes
         FROM meta_team_snapshots
         ORDER BY captured_at DESC
         LIMIT $1`,
        [limit]
    );

    return result.rows.map((row) => ({
        id: row.id,
        capturedAt: row.captured_at,
        source: row.source,
        sourceUrl: row.source_url,
        positionMax: row.position_max,
        pagesScraped: row.pages_scraped,
        totalTeams: row.total_teams,
        uniqueCombos: row.unique_combos,
        notes: row.notes,
    }));
}

export async function getMetaTeamSnapshotById(snapshotId) {
    if (!pool) {
        pool = createPool();
    }

    const result = await pool.query(
        `SELECT
            id,
            captured_at,
            source,
            source_url,
            position_max,
            pages_scraped,
            total_teams,
            unique_combos,
            notes
         FROM meta_team_snapshots
         WHERE id = $1`,
        [snapshotId]
    );

    const row = result.rows[0];
    if (!row) return null;

    return {
        id: row.id,
        capturedAt: row.captured_at,
        source: row.source,
        sourceUrl: row.source_url,
        positionMax: row.position_max,
        pagesScraped: row.pages_scraped,
        totalTeams: row.total_teams,
        uniqueCombos: row.unique_combos,
        notes: row.notes,
    };
}

export async function getMetaTeamCountForSnapshot(snapshotId) {
    if (!pool) {
        pool = createPool();
    }

    const result = await pool.query(
        'SELECT COUNT(*)::int AS count FROM meta_teams WHERE snapshot_id = $1',
        [snapshotId]
    );
    return result.rows[0]?.count || 0;
}

export async function getMetaTeamsForSnapshot(snapshotId, { limit, offset = 0 } = {}) {
    if (!pool) {
        pool = createPool();
    }

    const params = [snapshotId];
    let paging = '';
    if (offset > 0) {
        params.push(offset);
        paging += ` OFFSET $${params.length}`;
    }
    if (limit != null && limit > 0) {
        params.push(limit);
        paging += ` LIMIT $${params.length}`;
    }

    const result = await pool.query(
        `SELECT
            combo_key,
            hero_ids,
            hero_names,
            pet,
            pet_name,
            banner,
            popularity_count,
            row_rank,
            page_number
         FROM meta_teams
         WHERE snapshot_id = $1
         ORDER BY row_rank ASC NULLS LAST, popularity_count DESC NULLS LAST
         ${paging}`,
        params
    );

    return result.rows.map((row) => ({
        comboKey: row.combo_key,
        heroIds: row.hero_ids,
        heroNames: row.hero_names,
        pet: row.pet,
        petName: row.pet_name,
        banner: row.banner,
        popularityCount: row.popularity_count,
        rowRank: row.row_rank,
        pageNumber: row.page_number,
    }));
}

export async function getMetaTeamCandidates({ snapshotId, limit } = {}) {
    if (!pool) {
        pool = createPool();
    }

    let resolvedSnapshotId = snapshotId;
    if (!resolvedSnapshotId) {
        const latest = await pool.query(
            `SELECT id FROM meta_team_snapshots ORDER BY captured_at DESC NULLS LAST, id DESC LIMIT 1`
        );
        resolvedSnapshotId = latest.rows[0]?.id;
        if (!resolvedSnapshotId) {
            return { snapshotId: null, candidates: [] };
        }
    }

    const params = [resolvedSnapshotId];
    let limitClause = '';
    if (limit != null && limit > 0) {
        params.push(limit);
        limitClause = ` LIMIT $${params.length}`;
    }

    const result = await pool.query(
        `SELECT
            combo_key,
            hero_ids,
            hero_names,
            pet,
            pet_name,
            banner,
            popularity_count,
            row_rank
         FROM (
            SELECT
                combo_key,
                hero_ids,
                hero_names,
                pet,
                pet_name,
                banner,
                popularity_count,
                row_rank,
                ROW_NUMBER() OVER (
                    PARTITION BY combo_key
                    ORDER BY popularity_count DESC NULLS LAST, row_rank ASC NULLS LAST
                ) AS dedupe_rank
            FROM meta_teams
            WHERE snapshot_id = $1
         ) ranked
         WHERE dedupe_rank = 1
         ORDER BY popularity_count DESC NULLS LAST, row_rank ASC NULLS LAST
         ${limitClause}`,
        params
    );

    return {
        snapshotId: resolvedSnapshotId,
        candidates: result.rows.map((row) => ({
            comboKey: row.combo_key,
            heroIds: row.hero_ids,
            heroNames: row.hero_names,
            pet: row.pet,
            petName: row.pet_name,
            banner: row.banner,
            popularityCount: row.popularity_count,
            rowRank: row.row_rank,
        })),
    };
}

function buildSimLabWhere({ testerUserId, myHeroIds, opponentHeroIds, params }) {
    const clauses = [`tr.label ILIKE 'simlab%'`];

    if (testerUserId != null && testerUserId !== '') {
        if (String(testerUserId) === '0') {
            clauses.push(`COALESCE(tr.tester_user_id, '0') = '0' AND COALESCE(tr.max_upgrade, TRUE) = TRUE`);
        } else {
            params.push(String(testerUserId));
            clauses.push(`tr.tester_user_id = $${params.length}`);
        }
    }

    clauses.push(...appendComboHeroFilterClauses({
        heroIds: myHeroIds,
        heroColumn: 'COALESCE(tr.best_hero_ids, ARRAY[]::int[])',
        petColumn: 'COALESCE(tr.best_pet, 0)',
        params,
    }));

    clauses.push(...appendComboHeroFilterClauses({
        heroIds: opponentHeroIds,
        heroColumn: 'COALESCE(oc.hero_ids, ARRAY[]::int[])',
        petColumn: 'COALESCE(oc.pet, 0)',
        params,
    }));

    return clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
}

function mapSimLabRoundRow(row) {
    let payload = row.payload;
    if (typeof payload === 'string') {
        try {
            payload = JSON.parse(payload);
        } catch {
            payload = null;
        }
    }
    let bestDetail = row.best_detail;
    if (typeof bestDetail === 'string') {
        try {
            bestDetail = JSON.parse(bestDetail);
        } catch {
            bestDetail = null;
        }
    }
    const best = payload?.best || payload?.rankings?.[0] || null;
    const opponentTeam = payload?.opponent?.team || {};
    const parsedCombo = parseComboKey(row.opponent_combo_key);

    const opponentHeroIds = Array.isArray(opponentTeam.heroes) && opponentTeam.heroes.length
        ? opponentTeam.heroes.map(Number)
        : (Array.isArray(row.oc_hero_ids) && row.oc_hero_ids.length
            ? row.oc_hero_ids.map(Number)
            : parsedCombo.heroIds);
    const opponentPet = opponentTeam.pet != null
        ? Number(opponentTeam.pet)
        : (row.oc_pet != null ? Number(row.oc_pet) : (parsedCombo.pet || null));
    const opponentBanner = opponentTeam.banner != null
        ? Number(opponentTeam.banner)
        : (payload?.opponent?.banner != null
            ? Number(payload.opponent.banner)
            : (row.oc_banner != null ? Number(row.oc_banner) : (parsedCombo.banner || null)));

    const myBanner = row.best_banner != null
        ? Number(row.best_banner)
        : (bestDetail?.banner != null
            ? Number(bestDetail.banner)
            : (best?.banner != null ? Number(best.banner) : null));
    const myBannerStones = compactBannerStones(
        bestDetail?.bannerStones || best?.bannerStones
    );
    const myFavor = (bestDetail?.favor && typeof bestDetail.favor === 'object' && Object.keys(bestDetail.favor).length)
        ? bestDetail.favor
        : (best?.favor && typeof best.favor === 'object' ? best.favor : {});
    const opponentBannerStones = compactBannerStones(
        opponentTeam.bannerStones || opponentTeam.defenceBannerStones
    );

    const groupId = payload?.simLabGroupId
        ? String(payload.simLabGroupId)
        : (row.group_id != null ? String(row.group_id) : String(row.session_id || ''));
    const phase = payload?.simLabPhase
        || bestDetail?.phase
        || best?.phase
        || null;

    return {
        sessionId: row.session_id,
        groupId,
        tryCount: row.try_count != null ? Number(row.try_count) : 1,
        phase: phase ? String(phase) : null,
        label: row.label,
        testedAt: row.group_tested_at || row.completed_at || row.started_at,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        source: payload?.opponent?.source || payload?.source || null,
        opponentComboKey: row.opponent_combo_key,
        opponentUserId: row.opponent_user_id != null ? String(row.opponent_user_id) : null,
        opponentName: row.opponent_name,
        opponentPlace: row.opponent_place,
        opponentPower: row.opponent_power != null ? Number(row.opponent_power) : null,
        opponentHeroIds,
        opponentPet,
        opponentBanner,
        opponentBannerStones,
        opponentFavor: opponentTeam.favor && typeof opponentTeam.favor === 'object'
            ? opponentTeam.favor
            : {},
        myHeroIds: row.best_hero_ids,
        myHeroNames: row.best_hero_names,
        myPet: row.best_pet != null
            ? Number(row.best_pet)
            : (best?.pet != null ? Number(best.pet) : null),
        myBanner,
        myBannerStones,
        myFavor,
        winRate: row.best_win_rate != null ? Number(row.best_win_rate) : null,
        wins: row.best_wins != null
            ? Number(row.best_wins)
            : (best?.wins != null ? Number(best.wins) : null),
        losses: row.best_losses != null
            ? Number(row.best_losses)
            : (best?.losses != null ? Number(best.losses) : null),
        testerUserId: row.tester_user_id != null ? String(row.tester_user_id) : null,
        testerName: row.tester_name || null,
        maxUpgrade: row.max_upgrade !== false,
        payload,
        bestDetail,
    };
}

function simLabGroupIdSql(alias = 'tr') {
    return `COALESCE(NULLIF(${alias}.payload->>'simLabGroupId', ''), ${alias}.session_id)`;
}

const SIMLAB_SELECT_SQL = `
            tr.session_id,
            tr.label,
            tr.started_at,
            tr.completed_at,
            tr.opponent_combo_key,
            tr.opponent_user_id,
            tr.opponent_name,
            tr.opponent_place,
            tr.opponent_power,
            tr.best_win_rate,
            tr.best_hero_ids,
            tr.best_hero_names,
            tr.best_pet,
            tr.best_banner,
            tr.best_wins,
            tr.best_losses,
            tr.best_detail,
            tr.tester_user_id,
            tr.tester_name,
            tr.max_upgrade,
            tr.payload,
            oc.hero_ids AS oc_hero_ids,
            oc.pet AS oc_pet,
            oc.banner AS oc_banner`;

/**
 * Accounts that have initiated SimLab runs.
 */
export async function getSimLabTesters() {
    if (!pool) {
        pool = createPool();
    }

    const result = await pool.query(
        `SELECT
            COALESCE(tester_user_id, '0') AS tester_user_id,
            COALESCE(
                NULLIF(tester_name, ''),
                CASE WHEN COALESCE(max_upgrade, TRUE) THEN 'maxHeros' ELSE 'Unknown user' END
            ) AS tester_name,
            COALESCE(max_upgrade, TRUE) AS max_upgrade,
            COUNT(*)::int AS test_count,
            MAX(COALESCE(completed_at, created_at)) AS last_tested_at
         FROM training_rounds
         WHERE label ILIKE 'simlab%'
         GROUP BY 1, 2, 3
         ORDER BY test_count DESC, tester_name ASC`
    );

    return result.rows.map((row) => ({
        testerUserId: row.tester_user_id,
        testerName: row.tester_name,
        maxUpgrade: row.max_upgrade,
        testCount: row.test_count,
        lastTestedAt: row.last_tested_at,
    }));
}

/**
 * Recent SimLab groups (one row per Counter Suggest Sim click).
 * Each group keeps the highest win-rate try; tryCount is the number of pet/favor/flag attempts.
 */
export async function getSimLabRounds({
    limit = 50,
    offset = 0,
    testerUserId,
    opponentHeroIds,
    myHeroIds,
} = {}) {
    if (!pool) {
        pool = createPool();
    }

    const safeLimit = Math.max(1, Math.min(500, Number(limit) || 50));
    const safeOffset = Math.max(0, Number(offset) || 0);
    const params = [];
    const where = buildSimLabWhere({
        testerUserId,
        myHeroIds,
        opponentHeroIds,
        params,
    });
    const groupExpr = simLabGroupIdSql('tr');

    params.push(safeLimit);
    const limitParam = `$${params.length}`;
    params.push(safeOffset);
    const offsetParam = `$${params.length}`;

    const result = await pool.query(
        `WITH filtered AS (
            SELECT ${SIMLAB_SELECT_SQL},
                   ${groupExpr} AS group_id
            FROM training_rounds tr
            LEFT JOIN opponent_combos oc ON oc.combo_key = tr.opponent_combo_key
            ${where}
         ),
         ranked AS (
            SELECT filtered.*,
                   COUNT(*) OVER (PARTITION BY group_id)::int AS try_count,
                   MAX(COALESCE(filtered.completed_at, filtered.started_at))
                       OVER (PARTITION BY group_id) AS group_tested_at,
                   ROW_NUMBER() OVER (
                       PARTITION BY group_id
                       ORDER BY filtered.best_win_rate DESC NULLS LAST,
                                COALESCE(filtered.completed_at, filtered.started_at) DESC NULLS LAST
                   ) AS rn
            FROM filtered
         )
         SELECT *
         FROM ranked
         WHERE rn = 1
         ORDER BY group_tested_at DESC NULLS LAST
         LIMIT ${limitParam} OFFSET ${offsetParam}`,
        params
    );

    return result.rows.map(mapSimLabRoundRow);
}

export async function getSimLabRoundCount({
    testerUserId,
    opponentHeroIds,
    myHeroIds,
} = {}) {
    if (!pool) {
        pool = createPool();
    }

    const params = [];
    const where = buildSimLabWhere({
        testerUserId,
        myHeroIds,
        opponentHeroIds,
        params,
    });
    const groupExpr = simLabGroupIdSql('tr');

    const result = await pool.query(
        `SELECT COUNT(*)::int AS count
         FROM (
            SELECT ${groupExpr} AS group_id
            FROM training_rounds tr
            LEFT JOIN opponent_combos oc ON oc.combo_key = tr.opponent_combo_key
            ${where}
            GROUP BY 1
         ) groups`,
        params
    );

    return result.rows[0]?.count || 0;
}

export async function getSimLabRoundBySession(sessionId) {
    if (!sessionId) return null;
    if (!pool) {
        pool = createPool();
    }

    const result = await pool.query(
        `SELECT ${SIMLAB_SELECT_SQL}
         FROM training_rounds tr
         LEFT JOIN opponent_combos oc ON oc.combo_key = tr.opponent_combo_key
         WHERE tr.session_id = $1
           AND tr.label ILIKE 'simlab%'
         LIMIT 1`,
        [String(sessionId)]
    );

    if (!result.rows[0]) return null;
    return mapSimLabRoundRow(result.rows[0]);
}

/**
 * One SimLab click: best try + every pet/favor/flag attempt in the group.
 */
export async function getSimLabGroupDetail(groupId) {
    if (!groupId) return null;
    if (!pool) {
        pool = createPool();
    }

    const groupKey = String(groupId);
    const groupExpr = simLabGroupIdSql('tr');
    const result = await pool.query(
        `SELECT ${SIMLAB_SELECT_SQL},
                ${groupExpr} AS group_id
         FROM training_rounds tr
         LEFT JOIN opponent_combos oc ON oc.combo_key = tr.opponent_combo_key
         WHERE tr.label ILIKE 'simlab%'
           AND ${groupExpr} = $1
         ORDER BY COALESCE(tr.completed_at, tr.started_at) ASC NULLS LAST, tr.session_id ASC`,
        [groupKey]
    );

    if (!result.rows.length) return null;

    const tries = result.rows.map((row) => mapSimLabRoundRow({
        ...row,
        try_count: result.rows.length,
        group_tested_at: null,
    }));
    const best = [...tries].sort((a, b) => {
        const winDiff = (Number(b.winRate) || 0) - (Number(a.winRate) || 0);
        if (winDiff) return winDiff;
        return String(b.testedAt || '').localeCompare(String(a.testedAt || ''));
    })[0];

    return {
        groupId: groupKey,
        tryCount: tries.length,
        best,
        tries,
    };
}

/**
 * Group SimLab rounds by attacking target (opponent user + defense combo).
 */
export function groupSimLabRoundsByTarget(rounds = []) {
    const groups = new Map();
    for (const round of Array.isArray(rounds) ? rounds : []) {
        const targetKey = [
            round.opponentUserId || 'unknown',
            round.opponentComboKey || [
                (round.opponentHeroIds || []).join(','),
                round.opponentPet || 0,
                round.opponentBanner || 0,
            ].join('|'),
        ].join('::');
        if (!groups.has(targetKey)) {
            groups.set(targetKey, {
                targetKey,
                opponentUserId: round.opponentUserId,
                opponentName: round.opponentName,
                opponentPlace: round.opponentPlace,
                opponentPower: round.opponentPower,
                opponentComboKey: round.opponentComboKey,
                opponentHeroIds: round.opponentHeroIds || [],
                opponentPet: round.opponentPet,
                opponentBanner: round.opponentBanner,
                opponentBannerStones: round.opponentBannerStones || {},
                opponentFavor: round.opponentFavor || {},
                source: round.source,
                rounds: [],
                bestWinRate: null,
                latestAt: null,
            });
        }
        const group = groups.get(targetKey);
        group.rounds.push(round);
        if (round.opponentName && !group.opponentName) group.opponentName = round.opponentName;
        if (round.opponentPower != null && group.opponentPower == null) {
            group.opponentPower = round.opponentPower;
        }
        if (round.source && !group.source) group.source = round.source;
        const wr = round.winRate != null ? Number(round.winRate) : null;
        if (wr != null && (group.bestWinRate == null || wr > group.bestWinRate)) {
            group.bestWinRate = wr;
        }
        const at = round.testedAt ? new Date(round.testedAt).getTime() : 0;
        if (at && (group.latestAt == null || at > group.latestAt)) {
            group.latestAt = at;
        }
    }

    const list = [...groups.values()];
    for (const group of list) {
        group.rounds.sort((a, b) => {
            const wrDiff = (Number(b.winRate) || 0) - (Number(a.winRate) || 0);
            if (wrDiff !== 0) return wrDiff;
            return new Date(b.testedAt || 0) - new Date(a.testedAt || 0);
        });
        group.runCount = group.rounds.length;
    }
    list.sort((a, b) => (b.latestAt || 0) - (a.latestAt || 0));
    return list;
}

export async function backfillMatchupsFromRounds() {
    if (!pool) {
        pool = createPool();
    }

    const legacy = await pool.query(
        `SELECT session_id, payload, completed_at
         FROM training_rounds
         WHERE payload IS NOT NULL
         ORDER BY id`
    );

    let imported = 0;
    for (const row of legacy.rows) {
        const body = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
        if (!body?.rankings?.length || !body?.opponent?.team?.heroes?.length) continue;
        body.sessionId = body.sessionId || row.session_id;
        body.completedAt = body.completedAt || row.completed_at;
        await saveTrainingRound(body);
        imported++;
    }

    return { importedFromPayload: imported };
}

export async function backfillMatchupsFromJsonDir() {
    const fs = await import('fs/promises');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'arena-training-results');

    let imported = 0;
    try {
        const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.json'));
        for (const file of files) {
            const raw = await fs.readFile(path.join(dir, file), 'utf8');
            const body = JSON.parse(raw);
            if (!body?.rankings?.length || !body?.opponent?.team?.heroes?.length) continue;
            await saveTrainingRound(body);
            imported++;
        }
    } catch {
        // directory may not exist
    }
    return { importedFromJson: imported };
}

export async function backfillAllMatchups() {
    const fromPayload = await backfillMatchupsFromRounds();
    const fromJson = await backfillMatchupsFromJsonDir();
    return { ...fromPayload, ...fromJson };
}

export async function closeDatabase() {
    if (pool) {
        await pool.end();
        pool = null;
    }
    ready = false;
}
