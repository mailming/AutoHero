(async function () {
  try {
    const Send = window.Send;
    if (typeof Send !== 'function') {
      window.__bannerApiProbe = { error: 'no Send' };
      return;
    }
    const response = await Send({
      calls: [
        { name: 'team_getBanners', args: {}, context: { actionTs: Date.now() }, ident: 'team_getBanners' },
        { name: 'userGetInfo', args: {}, context: { actionTs: Date.now() }, ident: 'userGetInfo' },
      ],
    });
    const get = (ident) => {
      const row = response.results?.find((r) => r.ident === ident);
      return row?.result?.response ?? row?.result ?? null;
    };
    const banners = get('team_getBanners');
    const userInfo = get('userGetInfo');
    const sampleBanner = (() => {
      if (!banners) return null;
      if (Array.isArray(banners)) return banners[0] || null;
      if (typeof banners === 'object') {
        const vals = Object.values(banners);
        return vals[0] || null;
      }
      return null;
    })();

    // Also try reading from open gather BattleTeam
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
    const Manager = findClass('game.mediator.gui.popup.GamePopupManager');
    let gatherTeamBanner = null;
    let gatherEntrySlots = null;
    if (Manager) {
      const gk = Object.keys(Manager.__properties__ || {}).find((k) => Manager.__properties__[k] === 'get_instance');
      const manager = gk ? Manager[gk]() : null;
      const all = manager
        ? [...new Set(Object.values(manager).filter(Array.isArray).flat().filter((v) => v && v.__class__))]
        : [];
      const gather = all.find((p) => String(p.__class__.j || '').includes('ArenaAttackTeamGatherPopupWithEnemyTeam'))
        || all.find((p) => String(p.__class__.j || '').includes('ClanDominationSelectAttackTargetPopup'));
      if (gather) {
        const med = Object.values(gather).find((v) => v && v.__class__ && /Mediator/.test(v.__class__.j || '')) || gather;
        const enemy = callSem(med, 'get_enemy') || med.fj || null;
        const teams = enemy && Array.isArray(enemy.ex) ? enemy.ex : [];
        const team = teams[0] || null;
        if (team) {
          const banner = typeof team.Wy === 'function' ? team.Wy() : callSem(team, 'get_banner');
          gatherTeamBanner = {
            type: typeof banner,
            cls: banner && banner.__class__ && banner.__class__.j,
            keys: banner && typeof banner === 'object' ? Object.keys(banner).slice(0, 40) : null,
            id: banner && typeof banner === 'object'
              ? (callSem(banner, 'get_id') ?? banner.id ?? banner.bannerId)
              : banner,
            slots: banner && typeof banner === 'object'
              ? (callSem(banner, 'get_slots') ?? banner.slots)
              : null,
            props: banner && banner.__class__ && banner.__class__.prototype && banner.__class__.prototype.__properties__
              ? Object.values(banner.__class__.prototype.__properties__).slice(0, 40)
              : null,
          };
          // If banner is PlayerBannerEntry VO wrapper
          if (banner && typeof banner === 'object') {
            const entry = Object.values(banner).find((v) => v && v.__class__ && v.__class__.j === 'game.model.user.banner.PlayerBannerEntry');
            if (entry) {
              const map = Object.values(entry).find((v) => v && v.__class__ && v.__class__.j === 'haxe.ds.IntMap');
              let slotsObj = null;
              if (map) {
                const backing = Object.values(map).find((v) => v && typeof v === 'object' && !Array.isArray(v) && !v.__class__
                  && Object.getPrototypeOf(v) === Object.prototype);
                if (backing) {
                  slotsObj = {};
                  Object.entries(backing).forEach(([k, stone]) => {
                    const id = stone && stone.__class__
                      ? (callSem(stone, 'get_id') ?? stone.id)
                      : stone;
                    slotsObj[k] = id;
                  });
                }
              }
              gatherEntrySlots = {
                entryKeys: Object.keys(entry).slice(0, 30),
                entryProps: entry.__class__.prototype.__properties__
                  ? Object.values(entry.__class__.prototype.__properties__).slice(0, 40)
                  : null,
                slotsObj,
                descId: (() => {
                  const desc = callSem(entry, 'get_desc');
                  return desc ? callSem(desc, 'get_id') : null;
                })(),
              };
            }
          }
        }
      }
    }

    window.__bannerApiProbe = {
      bannersType: banners == null ? null : (Array.isArray(banners) ? 'array' : typeof banners),
      bannersKeys: banners && typeof banners === 'object' && !Array.isArray(banners) ? Object.keys(banners).slice(0, 20) : null,
      bannersLen: Array.isArray(banners) ? banners.length : (banners && typeof banners === 'object' ? Object.keys(banners).length : null),
      sampleBanner,
      sampleBannerKeys: sampleBanner && typeof sampleBanner === 'object' ? Object.keys(sampleBanner) : null,
      userInfoBanner: userInfo?.banner ?? null,
      userInfoBanners: userInfo?.banners ?? null,
      userInfoBannerStones: userInfo?.bannerStones ?? null,
      gatherTeamBanner,
      gatherEntrySlots,
      openPopups: (() => {
        try {
          const Manager2 = findClass('game.mediator.gui.popup.GamePopupManager');
          const gk2 = Object.keys(Manager2.__properties__ || {}).find((k) => Manager2.__properties__[k] === 'get_instance');
          const manager2 = gk2 ? Manager2[gk2]() : null;
          const all2 = manager2
            ? [...new Set(Object.values(manager2).filter(Array.isArray).flat().filter((v) => v && v.__class__))]
            : [];
          return all2.map((p) => p.__class__.j);
        } catch (e) {
          return String(e);
        }
      })(),
    };
  } catch (e) {
    window.__bannerApiProbe = { error: String(e && e.message || e), stack: String(e && e.stack || '') };
  }
})();
