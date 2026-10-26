/**
 * Runtime helpers for counter-model.json produced by build-counter-model.mjs.
 *
 * scoreAttackVsDefense(model, attackIds, defenseIds)
 * suggestCountersForDefense(model, defenseIds, { ownedHeroIds, limit })
 */

export function scoreAttackVsDefense(model, attackHeroIds, defenseHeroIds) {
    const matrix = model?.liftMatrix || {};
    const defense = (defenseHeroIds || []).map(Number).filter((id) => id > 0 && id < 6000);
    let score = 0;
    let edges = 0;
    const details = [];
    for (const a of (attackHeroIds || []).map(Number).filter((id) => id > 0 && id < 6000)) {
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
                winRate: cell.winRate,
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

/**
 * Rank owned heroes as counters to a defense lineup using summed positive lift.
 */
export function suggestCountersForDefense(model, defenseHeroIds, { ownedHeroIds = null, limit = 15 } = {}) {
    const defense = (defenseHeroIds || []).map(Number).filter((id) => id > 0 && id < 6000);
    const owned = ownedHeroIds ? new Set(ownedHeroIds.map(Number)) : null;
    const byDefense = model?.countersByDefense || {};
    /** @type {Map<number, { attackId: number, lift: number, fights: number, edges: number }>} */
    const scores = new Map();

    for (const d of defense) {
        const list = byDefense[String(d)] || [];
        for (const entry of list) {
            if (entry.lift <= 0) continue;
            if (owned && !owned.has(entry.attackId)) continue;
            const cur = scores.get(entry.attackId) || {
                attackId: entry.attackId,
                attackName: entry.attackName,
                lift: 0,
                fights: 0,
                edges: 0
            };
            cur.lift += entry.lift;
            cur.fights += entry.fights;
            cur.edges += 1;
            scores.set(entry.attackId, cur);
        }
    }

    return [...scores.values()]
        .sort((a, b) => b.lift - a.lift || b.fights - a.fights)
        .slice(0, Math.max(1, limit));
}

/**
 * Prefer exact team counters from the DB model when defense combo_key is known.
 */
export function suggestTeamsForDefenseKey(model, defenseComboKey, { limit = 5 } = {}) {
    const list = model?.bestTeamsByDefense?.[defenseComboKey] || [];
    return list.slice(0, Math.max(1, limit));
}
