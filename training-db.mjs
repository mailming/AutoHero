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
CREATE TABLE IF NOT EXISTS training_rounds (
    id SERIAL PRIMARY KEY,
    session_id TEXT NOT NULL UNIQUE,
    label TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    stopped_early BOOLEAN NOT NULL DEFAULT FALSE,
    opponent_user_id TEXT,
    opponent_name TEXT,
    opponent_place TEXT,
    opponent_power BIGINT,
    tested_combos INTEGER,
    best_win_rate NUMERIC,
    best_hero_ids INTEGER[],
    best_hero_names TEXT[],
    best_pet INTEGER,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS training_combo_results (
    id SERIAL PRIMARY KEY,
    round_id INTEGER NOT NULL REFERENCES training_rounds(id) ON DELETE CASCADE,
    rank INTEGER NOT NULL,
    heroes INTEGER[] NOT NULL,
    hero_names TEXT[],
    pet INTEGER,
    wins INTEGER,
    losses INTEGER,
    win_rate NUMERIC,
    average_battle_time NUMERIC,
    source TEXT,
    simulations JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_rounds_completed_at
    ON training_rounds (completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_training_rounds_opponent_user_id
    ON training_rounds (opponent_user_id);

CREATE INDEX IF NOT EXISTS idx_training_rounds_best_win_rate
    ON training_rounds (best_win_rate DESC);

CREATE INDEX IF NOT EXISTS idx_training_combo_results_round_id
    ON training_combo_results (round_id);

CREATE INDEX IF NOT EXISTS idx_training_combo_results_win_rate
    ON training_combo_results (win_rate DESC);
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

function extractRoundFields(body) {
    const best = body?.best || null;
    return {
        sessionId: body?.sessionId || `round_${Date.now()}`,
        label: body?.label || null,
        startedAt: parseTimestamp(body?.startedAt),
        completedAt: parseTimestamp(body?.completedAt),
        stoppedEarly: !!body?.stoppedEarly,
        opponentUserId: body?.opponent?.userId != null ? String(body.opponent.userId) : null,
        opponentName: body?.opponent?.name || null,
        opponentPlace: body?.opponent?.place != null ? String(body.opponent.place) : null,
        opponentPower: parseBigInt(body?.opponent?.power),
        testedCombos: Number.isFinite(Number(body?.testedCombos)) ? Number(body.testedCombos) : null,
        bestWinRate: best?.winRate != null ? Number(best.winRate) : null,
        bestHeroIds: Array.isArray(best?.heroes) ? best.heroes.map(Number) : null,
        bestHeroNames: Array.isArray(best?.heroNames) ? best.heroNames : null,
        bestPet: best?.pet != null ? Number(best.pet) : null,
        payload: body,
        rankings: Array.isArray(body?.rankings) ? body.rankings : [],
    };
}

export async function initDatabase() {
    if (!pool) {
        pool = new Pool({ connectionString: getDatabaseUrl() });
    }

    const client = await pool.connect();
    try {
        await client.query(SCHEMA_SQL);
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
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const roundResult = await client.query(
            `INSERT INTO training_rounds (
                session_id, label, started_at, completed_at, stopped_early,
                opponent_user_id, opponent_name, opponent_place, opponent_power,
                tested_combos, best_win_rate, best_hero_ids, best_hero_names, best_pet, payload
            ) VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8, $9,
                $10, $11, $12, $13, $14, $15::jsonb
            )
            ON CONFLICT (session_id) DO UPDATE SET
                label = EXCLUDED.label,
                started_at = EXCLUDED.started_at,
                completed_at = EXCLUDED.completed_at,
                stopped_early = EXCLUDED.stopped_early,
                opponent_user_id = EXCLUDED.opponent_user_id,
                opponent_name = EXCLUDED.opponent_name,
                opponent_place = EXCLUDED.opponent_place,
                opponent_power = EXCLUDED.opponent_power,
                tested_combos = EXCLUDED.tested_combos,
                best_win_rate = EXCLUDED.best_win_rate,
                best_hero_ids = EXCLUDED.best_hero_ids,
                best_hero_names = EXCLUDED.best_hero_names,
                best_pet = EXCLUDED.best_pet,
                payload = EXCLUDED.payload
            RETURNING id, session_id, completed_at`,
            [
                fields.sessionId,
                fields.label,
                fields.startedAt,
                fields.completedAt,
                fields.stoppedEarly,
                fields.opponentUserId,
                fields.opponentName,
                fields.opponentPlace,
                fields.opponentPower,
                fields.testedCombos,
                fields.bestWinRate,
                fields.bestHeroIds,
                fields.bestHeroNames,
                fields.bestPet,
                JSON.stringify(fields.payload),
            ]
        );

        const roundId = roundResult.rows[0].id;

        await client.query('DELETE FROM training_combo_results WHERE round_id = $1', [roundId]);

        for (const ranking of fields.rankings) {
            await client.query(
                `INSERT INTO training_combo_results (
                    round_id, rank, heroes, hero_names, pet, wins, losses,
                    win_rate, average_battle_time, source, simulations
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)`,
                [
                    roundId,
                    ranking.rank != null ? Number(ranking.rank) : null,
                    Array.isArray(ranking.heroes) ? ranking.heroes.map(Number) : [],
                    Array.isArray(ranking.heroNames) ? ranking.heroNames : null,
                    ranking.pet != null ? Number(ranking.pet) : null,
                    ranking.wins != null ? Number(ranking.wins) : null,
                    ranking.losses != null ? Number(ranking.losses) : null,
                    ranking.winRate != null ? Number(ranking.winRate) : null,
                    ranking.averageBattleTime != null ? Number(ranking.averageBattleTime) : null,
                    ranking.source || null,
                    JSON.stringify(ranking.simulations || []),
                ]
            );
        }

        await client.query('COMMIT');
        ready = true;
        lastError = null;

        return {
            storage: 'postgresql',
            roundId,
            sessionId: roundResult.rows[0].session_id,
            completedAt: roundResult.rows[0].completed_at,
            summary: {
                sessionId: fields.sessionId,
                label: fields.label,
                opponent: fields.opponentName || fields.opponentUserId,
                bestWinRate: fields.bestWinRate,
                bestHeroes: fields.bestHeroNames,
                bestPet: fields.bestPet,
                comboCount: fields.rankings.length,
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

    const countResult = await pool.query('SELECT COUNT(*)::int AS count FROM training_rounds');
    const latestResult = await pool.query(
        `SELECT session_id, completed_at, opponent_name, opponent_user_id,
                best_win_rate, best_hero_names, best_pet, payload
         FROM training_rounds
         ORDER BY completed_at DESC NULLS LAST, id DESC
         LIMIT 1`
    );

    const latestRow = latestResult.rows[0] || null;
    const latestSummary = latestRow
        ? {
            sessionId: latestRow.session_id,
            completedAt: latestRow.completed_at,
            opponent: {
                name: latestRow.opponent_name,
                userId: latestRow.opponent_user_id,
            },
            best: {
                winRate: latestRow.best_win_rate != null ? Number(latestRow.best_win_rate) : null,
                heroNames: latestRow.best_hero_names,
                pet: latestRow.best_pet,
            },
            payload: latestRow.payload,
        }
        : null;

    ready = true;
    lastError = null;

    return {
        storage: 'postgresql',
        databaseUrl: maskDatabaseUrl(getDatabaseUrl()),
        roundCount: countResult.rows[0]?.count || 0,
        latestSessionId: latestRow?.session_id || null,
        latestSummary,
        // Backward-compatible aliases for older scripts
        roundFiles: countResult.rows[0]?.count || 0,
        latestFile: latestRow?.session_id || null,
    };
}

export async function closeDatabase() {
    if (pool) {
        await pool.end();
        pool = null;
    }
    ready = false;
}
