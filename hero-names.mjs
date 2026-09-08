/** In-game display names for hero/pet IDs (from LIB_HERO_NAME_* / docs + user verification). */

export const HERO_NAMES = {
    1: 'Aurora', 2: 'Galahad', 3: 'Keira', 4: 'Astaroth', 5: 'Kai', 6: 'Phobos', 7: 'Thea',
    8: 'Daredevil', 9: 'Heidi', 10: 'Faceless', 11: 'Chabba', 12: 'Arachne', 13: 'Orion',
    14: 'Fox', 15: 'Ginger', 16: 'Dante', 17: 'Mojo', 18: 'Judge', 19: 'Dark Star', 20: 'Artemis',
    21: 'Markus', 22: 'Peppy', 23: 'Lian', 24: 'Cleaver', 25: 'Ishmael', 26: 'Lilith', 27: 'Luther',
    28: 'Qing Mao', 29: 'Dorian', 30: 'Cornelius', 31: 'Jet', 32: 'Helios', 33: 'Lars', 34: 'Krista',
    35: 'Jorgen', 36: 'Maya', 37: 'Jhu', 38: 'Elmir', 39: 'Ziri', 40: 'Nebula', 41: "K'arkh",
    42: 'Rufus', 43: 'Celeste', 44: 'Astrid and Lucas', 45: 'Satori', 46: 'Martha', 47: 'Andvari',
    48: 'Sebastian', 49: 'Yasmine', 50: 'Corvus', 51: 'Morrigan', 52: 'Isaac', 53: 'Alvanor',
    54: 'Tristan', 55: 'Iris', 56: 'Amira', 57: 'Fafnir', 58: 'Aidan', 59: 'Kayla',
    60: 'Mushy and Shroom', 61: 'Julius', 62: 'Polaris', 63: 'Lara Croft', 64: 'Augustus',
    65: 'Ninja Turtles', 66: 'Folio', 67: 'Lyria', 68: 'Guus', 69: 'Cascade', 70: 'Electra von Grave',
    71: 'Fluffy', 72: 'Byrna', 73: 'Adam', 74: 'Somna',
};

export const PET_NAMES = {
    6000: 'Fenris', 6001: 'Oliver', 6002: 'Merlin', 6003: 'Mara', 6004: 'Cain',
    6005: 'Albus', 6006: 'Axel', 6007: 'Biscuit', 6008: 'Khorus', 6009: 'Vex',
};

export function resolveHeroName(id) {
    const n = Number(id);
    if (!Number.isFinite(n)) return String(id);
    if (n >= 6000 && n < 7000) return PET_NAMES[n] || `Pet ${n}`;
    return HERO_NAMES[n] || `Hero ${n}`;
}

export function resolvePetName(id) {
    const n = Number(id);
    if (!Number.isFinite(n) || n < 6000) return null;
    return PET_NAMES[n] || `Pet ${n}`;
}

export function formatCombo(heroIds, pet, heroNamesOverride = null) {
    const ids = (Array.isArray(heroIds) ? heroIds : []).map(Number).filter((id) => id > 0 && id < 6000);
    const names = Array.isArray(heroNamesOverride) && heroNamesOverride.length
        ? heroNamesOverride.map((name, i) => name || resolveHeroName(ids[i]))
        : ids.map(resolveHeroName);
    const petId = pet != null ? Number(pet) : null;
    const petName = petId ? resolvePetName(petId) : null;
    const label = petName
        ? `${names.join(', ')} + ${petName}`
        : names.join(', ');

    return { heroIds: ids, heroNames: names, pet: petId, petName, label };
}
