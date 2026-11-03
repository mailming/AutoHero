(function () {
  function findClass(n) {
    return Object.values(window.$haxe || {}).find((v) => typeof v === 'function' && v.j === n);
  }
  function callSem(o, sem) {
    const p = o && o.__class__ && o.__class__.prototype && o.__class__.prototype.__properties__;
    if (!p) return undefined;
    const k = Object.keys(p).find((x) => p[x] === sem);
    if (!k || typeof o[k] !== 'function') return undefined;
    try { return o[k](); } catch (e) { return undefined; }
  }
  function className(o) {
    return o && o.__class__ && o.__class__.j || null;
  }
  function getIntMapBacking(map) {
    if (!map) return null;
    const candidates = Object.values(map).filter((v) => {
      if (!v || typeof v !== 'object' || Array.isArray(v) || v.__class__) return false;
      const proto = Object.getPrototypeOf(v);
      return proto === Object.prototype || proto === null;
    });
    if (candidates.length === 1) return candidates[0];
    const likely = candidates.filter((v) => {
      const vals = Object.values(v);
      return vals.length === 0 || vals.every((x) => className(x) === 'game.data.storage.resource.BannerStoneDescription' || typeof x === 'number');
    });
    return likely[0] || candidates[0] || null;
  }
  function slotsFromEntry(entry) {
    if (!entry) return null;
    const map = Object.values(entry).find((v) => className(v) === 'haxe.ds.IntMap');
    const backing = getIntMapBacking(map);
    const slots = {};
    const raw = {};
    if (backing) {
      Object.entries(backing).forEach(([k, stone]) => {
        raw[k] = {
          type: typeof stone,
          cls: className(stone),
          id: stone && typeof stone === 'object'
            ? (callSem(stone, 'get_id') ?? stone.id ?? stone._id ?? null)
            : stone,
        };
        const id = raw[k].id;
        if (id != null && Number(id) > 0) slots[String(k)] = Number(id);
      });
    }
    const desc = callSem(entry, 'get_desc');
    const id = callSem(entry, 'get_id') ?? entry.Fd ?? null;
    return {
      id: id != null ? Number(id) : null,
      descId: desc ? Number(callSem(desc, 'get_id')) : null,
      mapCls: className(map),
      mapKeys: map ? Object.keys(map) : null,
      backingKeys: backing ? Object.keys(backing) : null,
      slots,
      raw,
      fieldTypes: Object.fromEntries(Object.keys(entry).map((k) => {
        const v = entry[k];
        return [k, { type: typeof v, cls: className(v), isArr: Array.isArray(v) }];
      })),
    };
  }
  function findPlayer() {
    const Manager = findClass('game.mediator.gui.popup.GamePopupManager');
    const gk = Object.keys(Manager.__properties__ || {}).find((k) => Manager.__properties__[k] === 'get_instance');
    const manager = gk ? Manager[gk]() : null;
    const all = manager
      ? [...new Set(Object.values(manager).filter(Array.isArray).flat().filter((v) => v && v.__class__))]
      : [];
    const seen = new Set();
    let player = null;
    function walk(o, d) {
      if (!o || typeof o !== 'object' || d > 6 || seen.has(o) || player) return;
      seen.add(o);
      if (className(o) === 'game.model.user.Player') {
        player = o;
        return;
      }
      try { Object.values(o).forEach((v) => walk(v, d + 1)); } catch (e) {}
    }
    all.forEach((p) => walk(p, 0));
    return player;
  }
  function findBannerData(player) {
    if (!player) return null;
    return Object.values(player).find((v) => className(v) === 'game.model.user.banner.PlayerBannerData') || null;
  }
  function entriesFromData(data) {
    if (!data) return [];
    const map = Object.values(data).find((v) => className(v) === 'haxe.ds.IntMap');
    const backing = getIntMapBacking(map);
    if (!backing) return [];
    return Object.entries(backing).map(([id, entry]) => ({ id: Number(id), entry }));
  }

  const player = findPlayer();
  const data = findBannerData(player);
  const entries = entriesFromData(data).slice(0, 8).map(({ id, entry }) => ({
    mapId: id,
    ...slotsFromEntry(entry),
  }));

  // team_getBanners arena assignment id -> look up entry
  let arenaBannerId = null;
  let arenaSlots = null;
  // Also dump demo battle team banner
  let demoTeamBanner = null;
  try {
    const Manager = findClass('game.mediator.gui.popup.GamePopupManager');
    const gk = Object.keys(Manager.__properties__ || {}).find((k) => Manager.__properties__[k] === 'get_instance');
    const manager = gk ? Manager[gk]() : null;
    const all = manager
      ? [...new Set(Object.values(manager).filter(Array.isArray).flat().filter((v) => v && v.__class__))]
      : [];
    const demo = all.find((p) => String(p.__class__.j || '').includes('DemoBattleAttackTeamGatherPopup'));
    if (demo) {
      const med = Object.values(demo).find((v) => v && v.__class__ && /Mediator/.test(v.__class__.j || '')) || demo;
      const seen = new Set();
      let vo = null;
      let team = null;
      function walk(o, d) {
        if (!o || typeof o !== 'object' || d > 6 || seen.has(o)) return;
        seen.add(o);
        if (!team && className(o) === 'game.data.storage.battle.BattleTeam') team = o;
        if (!vo && className(o) === 'game.mediator.gui.popup.banner.PlayerBannerEntryValueObject') vo = o;
        try { Object.values(o).forEach((v) => walk(v, d + 1)); } catch (e) {}
      }
      walk(med, 0);
      const bannerFromTeam = team
        ? (typeof team.Wy === 'function' ? team.Wy() : callSem(team, 'get_banner'))
        : null;
      const entryFromVo = vo
        ? Object.values(vo).find((v) => className(v) === 'game.model.user.banner.PlayerBannerEntry')
        : null;
      const entryFromBanner = bannerFromTeam && typeof bannerFromTeam === 'object'
        ? (className(bannerFromTeam) === 'game.model.user.banner.PlayerBannerEntry'
          ? bannerFromTeam
          : Object.values(bannerFromTeam).find((v) => className(v) === 'game.model.user.banner.PlayerBannerEntry'))
        : null;
      demoTeamBanner = {
        teamBannerType: typeof bannerFromTeam,
        teamBannerCls: className(bannerFromTeam),
        teamBannerNum: typeof bannerFromTeam === 'number' ? bannerFromTeam : null,
        voSlots: slotsFromEntry(entryFromVo),
        bannerSlots: slotsFromEntry(entryFromBanner),
        teamProps: team && team.__class__ && team.__class__.prototype && team.__class__.prototype.__properties__
          ? Object.values(team.__class__.prototype.__properties__).slice(0, 40)
          : null,
      };
    }
  } catch (e) {
    demoTeamBanner = { error: String(e) };
  }

  window.__bannerSlotsProbe = {
    hasPlayer: !!player,
    hasData: !!data,
    dataKeys: data ? Object.keys(data) : null,
    dataProps: data && data.__class__ && data.__class__.prototype && data.__class__.prototype.__properties__
      ? Object.values(data.__class__.prototype.__properties__).slice(0, 40)
      : null,
    entries,
    demoTeamBanner,
  };
})();
