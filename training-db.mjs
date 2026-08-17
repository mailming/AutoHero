import pg from 'pg';

const { Pool } = pg;

const DEFAULT_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/autohero';

let pool = null;
let ready = false;
let lastError = null;

function getDatabaseUrl() {
    return process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
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

function extractRoundFields(body) {
    const best = body?.best || null;
    const opponent = extractOpponentTeam(body);
    return {
        sessionId: body?.sessionId || `round_${Date.now()}`,
        label: body?.label || null,
        startedAt: parseTimestamp(body?.startedAt),
        completedAt: parseTimestamp(body?.completedAt),
        stoppedEarly: !!body?.stoppedEarly,
        opponent,
        testedCombos: Number.isFinite(Number(body?.testedCombos)) ? Number(body.testedCombos) : null,
        bestWinRate: best?.winRate != null ? Number(best.winRate) : null,
        bestHeroIds: Array.isArray(best?.heroes) ? best.heroes.map(Number) : null,
        bestHeroNames: Array.isArray(best?.heroNames) ? best.heroNames : null,
        bestPet: best?.pet != null ? Number(best.pet) : null,
        rankings: Array.isArray(body?.rankings) ? body.rankings : [],
    };
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

async function saveMatchupTests(client, opponentComboId, sessionId, rankings, testedAt) {
    let saved = 0;
    for (const ranking of rankings) {
        const myHeroIds = Array.isArray(ranking.heroes) ? ranking.heroes.map(Number) : [];
        if (!myHeroIds.length) continue;

        await client.query(
            `INSERT INTO matchup_tests (
                opponent_combo_id, session_id, my_hero_ids, my_hero_names, my_pet,
                wins, losses, win_rate, rank, tested_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (opponent_combo_id, session_id, my_hero_ids, my_pet) DO UPDATE SET
                my_hero_names = EXCLUDED.my_hero_names,
                wins = EXCLUDED.wins,
                losses = EXCLUDED.losses,
                win_rate = EXCLUDED.win_rate,
                rank = EXCLUDED.rank,
                tested_at = EXCLUDED.tested_at`,
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
            ]
        );
        saved++;
    }
    return saved;
}

export async function initDatabase() {
    if (!pool) {
        pool = new Pool({ connectionString: getDatabaseUrl() });
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
        pool = new Pool({ connectionString: getDatabaseUrl() });
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
            testedAt
        );

        const roundResult = await client.query(
            `INSERT INTO training_rounds (
                session_id, label, started_at, completed_at, stopped_early,
                opponent_combo_key, opponent_user_id, opponent_name, opponent_place, opponent_power,
                tested_combos, best_win_rate, best_hero_ids, best_hero_names, best_pet, payload
            ) VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8, $9, $10,
                $11, $12, $13, $14, $15, NULL
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
                best_pet = EXCLUDED.best_pet
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
        pool = new Pool({ connectionString: getDatabaseUrl() });
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

export async function getTrainingResultCount({ comboKey } = {}) {
    if (!pool) {
        pool = new Pool({ connectionString: getDatabaseUrl() });
    }

    const params = [];
    let where = '';
    if (comboKey) {
        params.push(comboKey);
        where = 'WHERE oc.combo_key = $1';
    }

    const result = await pool.query(
        `SELECT COUNT(*)::int AS count
         FROM matchup_tests mt
         JOIN opponent_combos oc ON oc.id = mt.opponent_combo_id
         ${where}`,
        params
    );

    return result.rows[0]?.count || 0;
}

export async function getTrainingResults({ limit, offset = 0, comboKey } = {}) {
    if (!pool) {
        pool = new Pool({ connectionString: getDatabaseUrl() });
    }

    const params = [];
    let where = '';
    if (comboKey) {
        params.push(comboKey);
        where = 'WHERE oc.combo_key = $1';
    }

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
            mt.session_id
         FROM matchup_tests mt
         JOIN opponent_combos oc ON oc.id = mt.opponent_combo_id
         ${where}
         ORDER BY mt.tested_at DESC NULLS LAST, mt.id DESC
         ${paging}`,
        params
    );

    return result.rows;
}

export async function getOpponentSkipCheck({
    comboKey,
    minWinRate = 80,
    maxAgeDays = 30,
} = {}) {
    if (!comboKey) {
        return { shouldSkip: false, reason: 'missing_combo_key' };
    }

    if (!pool) {
        pool = new Pool({ connectionString: getDatabaseUrl() });
    }

    const result = await pool.query(
        `SELECT
            oc.combo_key,
            oc.opponent_name,
            MAX(mt.win_rate) AS best_win_rate,
            MAX(mt.tested_at) AS last_tested_at,
            (
                SELECT json_build_object(
                    'myHeroIds', best.my_hero_ids,
                    'myHeroNames', best.my_hero_names,
                    'myPet', best.my_pet,
                    'winRate', best.win_rate,
                    'testedAt', best.tested_at
                )
                FROM matchup_tests best
                WHERE best.opponent_combo_id = oc.id
                  AND best.win_rate >= $2
                  AND best.tested_at >= NOW() - ($3::text || ' days')::interval
                ORDER BY best.win_rate DESC, best.tested_at DESC
                LIMIT 1
            ) AS best_match
         FROM opponent_combos oc
         JOIN matchup_tests mt ON mt.opponent_combo_id = oc.id
         WHERE oc.combo_key = $1
           AND mt.win_rate >= $2
           AND mt.tested_at >= NOW() - ($3::text || ' days')::interval
         GROUP BY oc.id, oc.combo_key, oc.opponent_name`,
        [comboKey, minWinRate, String(maxAgeDays)]
    );

    const row = result.rows[0];
    if (!row?.best_match) {
        return {
            shouldSkip: false,
            comboKey,
            minWinRate,
            maxAgeDays,
        };
    }

    return {
        shouldSkip: true,
        comboKey: row.combo_key,
        opponentName: row.opponent_name,
        bestWinRate: row.best_win_rate != null ? Number(row.best_win_rate) : null,
        lastTestedAt: row.last_tested_at,
        bestMatch: row.best_match,
        minWinRate,
        maxAgeDays,
    };
}

export async function getMatchups({ comboKey, limit = 50 } = {}) {
    if (!pool) {
        pool = new Pool({ connectionString: getDatabaseUrl() });
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
        pool = new Pool({ connectionString: getDatabaseUrl() });
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
        pool = new Pool({ connectionString: getDatabaseUrl() });
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
        pool = new Pool({ connectionString: getDatabaseUrl() });
    }

    const result = await pool.query(
        'SELECT COUNT(*)::int AS count FROM meta_teams WHERE snapshot_id = $1',
        [snapshotId]
    );
    return result.rows[0]?.count || 0;
}

export async function getMetaTeamsForSnapshot(snapshotId, { limit, offset = 0 } = {}) {
    if (!pool) {
        pool = new Pool({ connectionString: getDatabaseUrl() });
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
        pool = new Pool({ connectionString: getDatabaseUrl() });
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

export async function backfillMatchupsFromRounds() {
    if (!pool) {
        pool = new Pool({ connectionString: getDatabaseUrl() });
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
