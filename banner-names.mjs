/**
 * War Flag / Pattern ID → display names.
 *
 * Flag order matches official Nexters docs (War Flags & Patterns).
 * Pattern IDs use 12 ranks per type: id = typeIndex * 12 + colorIndex + 1.
 */

export const BANNER_NAMES = {
    1: 'Fervor',
    2: 'Pet Strength',
    3: 'Decline',
    4: 'Swift Warriors',
    5: 'Frost',
    6: 'Recovery',
    7: 'Readiness',
    8: 'Vanguard',
    9: 'Bastion',
    10: 'Steel Storm',
    11: 'False Immortality',
};

export const BANNER_EFFECTS = {
    1: 'Tank energy gain +10%',
    2: 'Selected pet skill power +10% (not patronage)',
    3: 'Enemy healing −10%',
    4: 'Warrior skill cooldown −5%',
    5: 'Every 18s: Frost (−2 skill levels for 8s)',
    6: 'All healing +10%',
    7: 'Rear hero +100 energy at start / every 20s (+20 per red pattern)',
    8: 'Front hero heal every 4s (1.6% max HP + 0.3% per red pattern)',
    9: 'Start: allies armor = 30%→5% of front hero armor over 20s (+3s per red pattern)',
    10: 'Multi-target physical skill damage +12% (+3% per red pattern)',
    11: '10% vamp aura (cap 3% team max HP + 0.7% per red pattern)',
};

/** Pattern types in ID order (12 color ranks each). */
export const PATTERN_TYPES = [
    'Magic Attack',
    'Magic Defense',
    'Physical Attack',
    'Armor',
    'Enemy Dodge Reduction',
    'Armor Penetration',
    'Enemy Crit Chance Reduction',
    'Magic Penetration',
    'Magic Mastery',
    'Health',
    'Barrier',
    'Attack Mastery',
    'Strength',
];

export const PATTERN_COLORS = [
    'White',
    'Green',
    'Blue',
    'Violet',
    'Orange',
    'Red',
    'Red+1',
    'Red+2',
    'Red+3',
    'Red+4',
    'Red+5',
    'Red+6',
];

export function resolveBannerName(bannerId) {
    const id = Number(bannerId);
    if (!Number.isFinite(id) || id <= 0) return null;
    return BANNER_NAMES[id] || null;
}

export function resolveBannerEffect(bannerId) {
    const id = Number(bannerId);
    if (!Number.isFinite(id) || id <= 0) return null;
    return BANNER_EFFECTS[id] || null;
}

export function resolveBannerLabel(bannerId) {
    const id = Number(bannerId);
    if (!Number.isFinite(id) || id <= 0) return '—';
    const name = resolveBannerName(id);
    return name ? `Flag #${id} · ${name}` : `Flag #${id}`;
}

export function decodePatternId(patternId) {
    const id = Number(patternId);
    if (!Number.isFinite(id) || id <= 0) return null;
    const typeIndex = Math.floor((id - 1) / 12);
    const colorIndex = (id - 1) % 12;
    const type = PATTERN_TYPES[typeIndex] || null;
    const color = PATTERN_COLORS[colorIndex] || null;
    if (!type && !color) return null;
    return {
        id,
        typeIndex,
        colorIndex,
        type: type || `Type ${typeIndex + 1}`,
        color: color || `Rank ${colorIndex + 1}`,
    };
}

export function resolvePatternLabel(patternId) {
    const decoded = decodePatternId(patternId);
    if (!decoded) return patternId == null || patternId === '' ? '—' : String(patternId);
    return `${decoded.type} ${decoded.color}`;
}

export function resolvePatternShortLabel(patternId) {
    const decoded = decodePatternId(patternId);
    if (!decoded) return patternId == null || patternId === '' ? '—' : `#${patternId}`;
    return `${decoded.type} ${decoded.color} (#${decoded.id})`;
}
