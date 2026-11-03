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

  const Data = findClass('game.model.user.banner.PlayerBannerData');
  const Watcher = findClass('game.model.user.banner.watch.PlayerBannerWatcher');
  const Entry = findClass('game.model.user.banner.PlayerBannerEntry');
  const Player = findClass('game.model.user.Player');

  // Scan $haxe values for live instances (statics often hold singletons)
  const hits = [];
  const seen = new Set();
  function note(o, path) {
    if (!o || typeof o !== 'object' || seen.has(o) || hits.length > 20) return;
    seen.add(o);
    const cls = className(o);
    if (!cls) return;
    if (/PlayerBanner|banner\.watch/i.test(cls)) {
      hits.push({ path, cls, keys: Object.keys(o).slice(0, 25) });
    }
  }

  // Breadth-limited scan from known roots
  const roots = [];
  try {
    const Manager = findClass('game.mediator.gui.popup.GamePopupManager');
    const gk = Object.keys(Manager.__properties__ || {}).find((k) => Manager.__properties__[k] === 'get_instance');
    const manager = gk ? Manager[gk]() : null;
    if (manager) roots.push(['popupManager', manager]);
    const all = manager
      ? [...new Set(Object.values(manager).filter(Array.isArray).flat().filter((v) => v && v.__class__))]
      : [];
    all.forEach((p, i) => roots.push(['popup' + i, p]));
  } catch (e) {}

  // Also try GameModel / Player instance via cheats
  try {
    if (window.cheats && typeof window.cheats.getSelfGame === 'function') {
      roots.push(['selfGame', window.cheats.getSelfGame()]);
    }
  } catch (e) {}
  try {
    if (window.lib && window.lib.player) roots.push(['lib.player', window.lib.player]);
  } catch (e) {}
  try {
    if (window.HWHData) roots.push(['HWHData', window.HWHData]);
  } catch (e) {}

  // Walk Player static prototype? look for instance on Application
  const App = findClass('game.Application') || findClass('game.GameApplication') || findClass('Application');
  if (App) {
    Object.keys(App).forEach((k) => {
      try { roots.push(['App.' + k, App[k]]); } catch (e) {}
    });
  }

  function walk(o, path, depth) {
    if (!o || typeof o !== 'object' || depth > 5 || seen.has(o)) return;
    note(o, path);
    let vals;
    try { vals = Object.values(o); } catch (e) { return; }
    for (let i = 0; i < vals.length && hits.length < 20; i++) {
      const v = vals[i];
      if (!v || typeof v !== 'object') continue;
      if (v.__class__) walk(v, path + '.' + (className(v) || i), depth + 1);
      else if (!Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype) {
        // plain map - check values
        Object.values(v).slice(0, 30).forEach((vv, j) => {
          if (vv && typeof vv === 'object' && vv.__class__) walk(vv, path + '.map' + j, depth + 1);
        });
      }
    }
  }
  roots.forEach(([p, o]) => walk(o, p, 0));

  // Demo gather popup: extract attack banner VO
  let demoBanner = null;
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
      const seen2 = new Set();
      const findEntry = (o, d) => {
        if (!o || typeof o !== 'object' || d > 7 || seen2.has(o) || demoBanner) return;
        seen2.add(o);
        if (className(o) === 'game.model.user.banner.PlayerBannerEntry') {
          const map = Object.values(o).find((v) => className(v) === 'haxe.ds.IntMap');
          let slots = {};
          if (map) {
            const backing = Object.values(map).find((v) => v && typeof v === 'object' && !v.__class__
              && !Array.isArray(v) && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null));
            if (backing) {
              Object.entries(backing).forEach(([k, stone]) => {
                slots[k] = stone && stone.__class__ ? (callSem(stone, 'get_id') ?? stone.id) : stone;
              });
            }
          }
          const desc = callSem(o, 'get_desc');
          demoBanner = {
            descId: desc ? callSem(desc, 'get_id') : null,
            slots,
            keys: Object.keys(o).slice(0, 20),
            props: o.__class__.prototype.__properties__
              ? Object.values(o.__class__.prototype.__properties__).slice(0, 30)
              : null,
          };
          return;
        }
        if (/BannerValueObject|TeamGatherPopupBanner/i.test(className(o) || '')) {
          // keep walking into it
        }
        try {
          Object.values(o).forEach((v) => findEntry(v, d + 1));
        } catch (e) {}
      };
      findEntry(med, 0);
      // also try semantic getters
      if (!demoBanner) {
        const candidates = ['get_banner', 'get_bannerVO', 'get_selectedBanner', 'get_currentBanner'];
        const info = {};
        candidates.forEach((sem) => {
          const v = callSem(med, sem);
          info[sem] = v == null ? null : {
            type: typeof v,
            cls: className(v),
            keys: v && typeof v === 'object' ? Object.keys(v).slice(0, 20) : null,
          };
        });
        demoBanner = { viaGetters: info };
      }
    }
  } catch (e) {
    demoBanner = { error: String(e) };
  }

  // InventoryItemType bannerStone storage count
  let stoneStorage = null;
  try {
    const InventoryItemType = findClass('game.data.storage._enum.lib.InventoryItemType');
    const typeMatches = Object.values(InventoryItemType || {}).filter(
      (v) => v && typeof v === 'object' && v.type === 'bannerStone'
    );
    stoneStorage = {
      count: typeMatches.length,
      storageCls: typeMatches[0] && typeMatches[0].storage && className(typeMatches[0].storage),
    };
  } catch (e) {
    stoneStorage = { error: String(e) };
  }

  window.__bannerClientProbe = {
    hasData: !!Data,
    hasWatcher: !!Watcher,
    hasEntry: !!Entry,
    hasPlayer: !!Player,
    dataProps: Data && Data.prototype && Data.prototype.__properties__
      ? Object.values(Data.prototype.__properties__).slice(0, 40)
      : null,
    watcherProps: Watcher && Watcher.prototype && Watcher.prototype.__properties__
      ? Object.values(Watcher.prototype.__properties__).slice(0, 40)
      : null,
    entryProps: Entry && Entry.prototype && Entry.prototype.__properties__
      ? Object.values(Entry.prototype.__properties__).slice(0, 40)
      : null,
    hits,
    demoBanner,
    stoneStorage,
    selfGameKeys: (() => {
      try {
        const g = window.cheats && window.cheats.getSelfGame && window.cheats.getSelfGame();
        return g ? Object.keys(g).slice(0, 40) : null;
      } catch (e) { return String(e); }
    })(),
  };
})();
