() => {
  const root = window.$haxe;
  const find = (n) => Object.values(root).find((v) => typeof v === 'function' && v.j === n);
  const callSem = (o, sem) => {
    const p = o && o.__class__ && o.__class__.prototype && o.__class__.prototype.__properties__;
    if (!p) return undefined;
    const k = Object.keys(p).find((x) => p[x] === sem);
    if (!k || typeof o[k] !== 'function') return undefined;
    try { return o[k](); } catch (e) { return undefined; }
  };

  const Manager = find('game.mediator.gui.popup.GamePopupManager');
  const gk = Object.keys(Manager.__properties__ || {}).find((k) => Manager.__properties__[k] === 'get_instance');
  const manager = Manager[gk]();
  const all = [...new Set(Object.values(manager).filter(Array.isArray).flat().filter((v) => v && v.__class__))];

  let bannerData = null;
  const seen = new Set();
  const walk = (o, d) => {
    if (!o || typeof o !== 'object' || d > 7 || seen.has(o) || bannerData) return;
    seen.add(o);
    if (o.__class__ && o.__class__.j === 'game.model.user.banner.PlayerBannerData') {
      bannerData = o;
      return;
    }
    for (const v of Object.values(o)) walk(v, d + 1);
  };
  for (const p of all) walk(p, 0);

  // Also search common globals / player
  const globals = [window.player, window.Player, window.gameUser, window.user];
  for (const g of globals) walk(g, 0);

  const PlayerBannerData = find('game.model.user.banner.PlayerBannerData');
  const PlayerBannerEntry = find('game.model.user.banner.PlayerBannerEntry');
  const dataProps = PlayerBannerData && PlayerBannerData.prototype && PlayerBannerData.prototype.__properties__
    ? Object.values(PlayerBannerData.prototype.__properties__)
    : [];
  const entryProps = PlayerBannerEntry && PlayerBannerEntry.prototype && PlayerBannerEntry.prototype.__properties__
    ? Object.values(PlayerBannerEntry.prototype.__properties__)
    : [];

  let entriesSummary = null;
  if (bannerData) {
    const maybeLists = [
      callSem(bannerData, 'get_list'),
      callSem(bannerData, 'get_entries'),
      callSem(bannerData, 'get_banners'),
      bannerData.list,
      bannerData.entries,
    ];
    let arr = [];
    for (const candidate of maybeLists) {
      if (Array.isArray(candidate) && candidate.length) { arr = candidate; break; }
      if (candidate && typeof candidate === 'object') {
        const vals = Object.values(candidate);
        if (vals.length) { arr = vals; break; }
      }
    }
    entriesSummary = arr.slice(0, 10).map((e, i) => ({
      i,
      cls: e && e.__class__ && e.__class__.j,
      id: callSem(e, 'get_id') || e.id || e._id || null,
      slots: callSem(e, 'get_slots') || e.slots || null,
      keys: e && typeof e === 'object' ? Object.keys(e).slice(0, 25) : null,
    }));
  }

  const gather = all.find((p) => (p.__class__.j || '').indexOf('ArenaAttackTeamGatherPopupWithEnemyTeam') >= 0);
  const med = gather && Object.values(gather).find((v) => v && v.__class__ && /Mediator/.test(v.__class__.j || ''));
  const gatherBanner = med ? {
    banner: callSem(med, 'get_banner'),
    banners: callSem(med, 'get_banners'),
    teamBanner: callSem(med, 'get_teamBanner'),
    selectedBanner: callSem(med, 'get_selectedBanner'),
  } : null;

  // Inspect TeamGatherPopupBannerValueObject on gather tree
  let gatherBannerVO = null;
  if (med) {
    const seen2 = new Set();
    const walk2 = (o, d) => {
      if (!o || typeof o !== 'object' || d > 6 || seen2.has(o) || gatherBannerVO) return;
      seen2.add(o);
      const cls = o.__class__ && o.__class__.j;
      if (cls && /TeamGatherPopupBannerValueObject|MultiTeamGatherPopupBannerValueObject|PlayerBannerEntry/.test(cls)) {
        gatherBannerVO = {
          cls,
          id: callSem(o, 'get_id') || o.id || o._id || null,
          slots: callSem(o, 'get_slots') || o.slots || null,
          keys: Object.keys(o).slice(0, 30),
          props: o.__class__.prototype && o.__class__.prototype.__properties__
            ? Object.values(o.__class__.prototype.__properties__)
            : [],
        };
        return;
      }
      for (const v of Object.values(o)) walk2(v, d + 1);
    };
    walk2(med, 0);
  }

  return {
    hasBannerData: !!bannerData,
    dataProps: dataProps.slice(0, 40),
    entryProps: entryProps.slice(0, 40),
    entriesSummary,
    open: all.map((p) => p.__class__.j),
    gatherBanner,
    gatherBannerVO,
  };
}
