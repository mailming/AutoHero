/** Find Grand Arena triplets: 3 combos, 15 unique heroes, maximize ≥90% win counts. */

function heroIds(combo) {
    return (combo.myHeroIds || []).map(Number).filter((id) => id > 0 && id < 6000);
}

function setsDisjoint(heroSet, heroes) {
    for (const id of heroes) {
        if (heroSet.has(id)) return false;
    }
    return true;
}

function comboKey(combo) {
    const heroes = heroIds(combo).slice().sort((a, b) => a - b).join(',');
    const pet = combo.myPet != null ? Number(combo.myPet) : '';
    return `${heroes}|${pet}`;
}

export function findGrandArenaSelections(combos, {
    heroesPerTeam = 5,
    maxResults = 500,
} = {}) {
    const validCombos = combos
        .map((combo) => ({
            ...combo,
            heroes: heroIds(combo),
            highWinCount: Number(combo.highWinCount) || 0,
        }))
        .filter((combo) => combo.heroes.length === heroesPerTeam);

    const results = [];
    const seen = new Set();
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

                const keys = [comboA, comboB, comboC].map(comboKey).sort();
                const dedupeKey = keys.join('||');
                if (seen.has(dedupeKey)) continue;
                seen.add(dedupeKey);

                const highWins = [comboA.highWinCount, comboB.highWinCount, comboC.highWinCount];
                results.push({
                    teams: [comboA, comboB, comboC],
                    totalHighWinCount: highWins[0] + highWins[1] + highWins[2],
                    minHighWinCount: Math.min(...highWins),
                });
            }
        }
    }

    results.sort((a, b) => (
        b.totalHighWinCount - a.totalHighWinCount
        || b.minHighWinCount - a.minHighWinCount
    ));

    if (maxResults > 0) {
        return results.slice(0, maxResults);
    }
    return results;
}
