(function () {
  function findClass(n) {
    return Object.values(window.$haxe || {}).find((v) => typeof v === 'function' && v.j === n);
  }
  function callSem(o, sem) {
    const p = o && o.__class__ && o.__class__.prototype && o.__class__.prototype.__properties__;
    if (!p) return undefined;
    const k = Object.keys(p).find((x) => p[x] === sem);
    if (!k || typeof o[k] !== 'function') return undefined;
    try { return o[k](); } catch (e) { return { __err: String(e) }; }
  }
  function className(o) {
    return o && o.__class__ && o.__class__.j || null;
  }
  function summarize(v) {
    if (v == null) return null;
    if (typeof v !== 'object') return { type: typeof v, value: v };
    if (v.__err) return v;
    if (Array.isArray(v)) return { type: 'array', value: v.slice(0, 8) };
    if (className(v) === 'haxe.ds.IntMap') {
      const backing = Object.values(v).find((x) => x && typeof x === 'object' && !x.__class__ && !Array.isArray(x)
        && (Object.getPrototypeOf(x) === Object.prototype || Object.getPrototypeOf(x) === null));
      const slots = {};
      if (backing) {
        Object.entries(backing).forEach(([k, stone]) => {
          slots[k] = stone && typeof stone === 'object'
            ? (callSem(stone, 'get_id') ?? stone.id ?? className(stone))
            : stone;
        });
      }
      return { type: 'IntMap', slots, keys: Object.keys(v) };
    }
    return {
      type: 'object',
      cls: className(v),
      keys: Object.keys(v).slice(0, 30),
      plain: (!v.__class__ && Object.getPrototypeOf(v) === Object.prototype)
        ? Object.fromEntries(Object.entries(v).slice(0, 10).map(([k, x]) => [k, typeof x === 'object' ? className(x) || typeof x : x]))
        : null,
    };
  }

  const Manager = findClass('game.mediator.gui.popup.GamePopupManager');
  const gk = Object.keys(Manager.__properties__ || {}).find((k) => Manager.__properties__[k] === 'get_instance');
  const manager = gk ? Manager[gk]() : null;
  const all = manager
    ? [...new Set(Object.values(manager).filter(Array.isArray).flat().filter((v) => v && v.__class__))]
    : [];

  const results = [];
  for (const popup of all) {
    const med = Object.values(popup).find((v) => v && v.__class__ && /Mediator/.test(v.__class__.j || '')) || popup;
    const teams = [];
    const seen = new Set();
    function walk(o, d) {
      if (!o || typeof o !== 'object' || d > 7 || seen.has(o)) return;
      seen.add(o);
      if (className(o) === 'game.data.storage.battle.BattleTeam') teams.push(o);
      try { Object.values(o).forEach((v) => walk(v, d + 1)); } catch (e) {}
    }
    walk(med, 0);
    for (const team of teams.slice(0, 3)) {
      results.push({
        popup: className(popup),
        banner: summarize(callSem(team, 'get_banner')),
        bannerVO: summarize(callSem(team, 'get_bannerVO')),
        bannerStones: summarize(callSem(team, 'get_bannerStones')),
        // also raw fields that look like maps
        rawStoneFields: Object.keys(team).filter((k) => {
          const v = team[k];
          return className(v) === 'haxe.ds.IntMap' || (v && typeof v === 'object' && !v.__class__ && !Array.isArray(v));
        }).slice(0, 10).map((k) => ({ k, summary: summarize(team[k]) })),
      });
    }
  }

  window.__bannerTeamStones = {
    open: all.map((p) => p.__class__.j),
    results,
  };
})();
