/** Find Grand Arena triplets: 3 combos, 15 unique heroes, maximize ≥90% win counts. */

const DEFAULT_MAX_COMBO_POOL = 80;

function heroIds(combo) {
    return (combo.myHeroIds || []).map(Number).filter((id) => id > 0 && id < 6000);
}

function setsDisjoint(heroSet, heroes) {
    for (const id of heroes) {
        if (heroSet.has(id)) return false;
    }
    return true;
}

function unionHeroIds(teams) {
    const ids = new Set();
    for (const team of teams) {
        for (const id of heroIds(team)) {
            ids.add(id);
        }
    }
    return ids;
}

function matchesRequiredHeroes(teams, requiredHeroIds = []) {
    const required = (requiredHeroIds || []).map(Number).filter((id) => id > 0);
    if (!required.length) {
        return true;
    }

    const heroUnion = unionHeroIds(teams);
    const requiredHeroes = required.filter((id) => id < 6000);
    const requiredPets = required.filter((id) => id >= 6000);

    for (const id of requiredHeroes) {
        if (!heroUnion.has(id)) {
            return false;
        }
    }
    for (const petId of requiredPets) {
        if (!teams.some((team) => Number(team.myPet) === petId)) {
            return false;
        }
    }
    return true;
}

function compareSelections(a, b) {
    return (
        b.totalHighWinCount - a.totalHighWinCount
        || b.minHighWinCount - a.minHighWinCount
    );
}

/**
 * Build disjoint 3-team Grand Arena lineups from strong counters.
 *
 * Caps the input pool (default 80) so O(n³) stays practical. With ~1100 unique
 * combos, an uncapped search can exceed V8's Set limit (~16.7M) and hang the page.
 *
 * @returns {{ selections: object[], totalCount: number, poolSize: number }}
 */
export function findGrandArenaSelections(combos, {
    heroesPerTeam = 5,
    maxResults = 5,
    requiredHeroIds = [],
    maxComboPool = DEFAULT_MAX_COMBO_POOL,
} = {}) {
    const poolLimit = Number.isFinite(maxComboPool) && maxComboPool > 0
        ? Math.floor(maxComboPool)
        : DEFAULT_MAX_COMBO_POOL;

    const validCombos = combos
        .map((combo) => ({
            ...combo,
            heroes: heroIds(combo),
            highWinCount: Number(combo.highWinCount) || 0,
        }))
        .filter((combo) => combo.heroes.length === heroesPerTeam)
        .sort((a, b) => (
            b.highWinCount - a.highWinCount
            || (Number(b.testCount) || 0) - (Number(a.testCount) || 0)
            || (Number(b.avgWinRate) || 0) - (Number(a.avgWinRate) || 0)
        ))
        .slice(0, poolLimit);

    const results = [];
    const n = validCombos.length;

    for (let i = 0; i < n; i++) {
        const comboA = validCombos[i];
        const heroesA = new Set(comboA.heroes);
        for (let j = i + 1; j < n; j++) {
            const comboB = validCombos[j];
            if (!setsDisjoint(heroesA, comboB.heroes)) continue;
            const heroesAB = new Set([...heroesA, ...comboB.heroes]);
            for (let k = j + 1; k < n; k++) {
                const comboC = validCombos[k];
                if (!setsDisjoint(heroesAB, comboC.heroes)) continue;

                const teams = [comboA, comboB, comboC];
                if (!matchesRequiredHeroes(teams, requiredHeroIds)) {
                    continue;
                }

                const highWins = [comboA.highWinCount, comboB.highWinCount, comboC.highWinCount];
                results.push({
                    teams,
                    totalHighWinCount: highWins[0] + highWins[1] + highWins[2],
                    minHighWinCount: Math.min(...highWins),
                });
            }
        }
    }

    results.sort(compareSelections);
    const totalCount = results.length;
    const keep = maxResults > 0 ? Math.min(maxResults, totalCount) : totalCount;

    return {
        selections: results.slice(0, keep),
        totalCount,
        poolSize: n,
    };
}
