(() => {
  const root = window.$haxe;
  const find = (n) => Object.values(root).find((v) => typeof v === 'function' && v.j === n);
  const Entry = find('game.model.user.banner.PlayerBannerEntry');
  const Watcher = find('game.model.user.banner.watch.PlayerBannerWatcher');
  const callSem = (o, sem) => {
    const p = o && o.__class__ && o.__class__.prototype && o.__class__.prototype.__properties__;
    if (!p) return undefined;
    const k = Object.keys(p).find((x) => p[x] === sem);
    if (!k || typeof o[k] !== 'function') return undefined;
    try { return o[k](); } catch (e) { return 'ERR:' + e.message; }
  };

  // Find live PlayerBannerWatcher instance on Player / GameModel
  const found = [];
  const seen = new Set();
  const walk = (o, path, depth) => {
    if (!o || typeof o !== 'object' || depth > 5 || seen.has(o) || found.length >= 8) return;
    seen.add(o);
    const cls = o.__class__ && o.__class__.j;
    if (cls && /PlayerBanner/i.test(cls)) {
      found.push({
        path,
        cls,
        keys: Object.keys(o).slice(0, 30),
        props: o.__class__.prototype && o.__class__.prototype.__properties__
          ? Object.values(o.__class__.prototype.__properties__).slice(0, 40)
          : [],
      });
    }
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === 'object' && v) walk(v, path + '.' + k, depth + 1);
    }
  };

  const Player = find('game.model.user.Player');
  let playerInst = null;
  if (Player) {
    for (const v of Object.values(Player)) {
      if (v && typeof v === 'object' && v.__class__ && /Player/.test(v.__class__.j || '')) {
        playerInst = v;
        break;
      }
    }
    // also check static fields that look like singleton
    for (const [k, v] of Object.entries(Player)) {
      if (v && typeof v === 'object' && !playerInst) {
        if (Object.keys(v).some((x) => /banner|hero|team|inventory/i.test(x))) {
          walk(v, 'Player.' + k, 0);
        }
      }
    }
  }

  // Broader: scan window for PlayerBannerWatcher instances via known class
  if (Watcher) {
    for (const v of Object.values(root)) {
      if (!v || typeof v !== 'object') continue;
      for (const [k, vv] of Object.entries(v)) {
        if (vv instanceof Watcher) {
          found.push({ path: 'root.' + (v.j || k), cls: 'WatcherInstance', keys: Object.keys(vv).slice(0, 40) });
        }
      }
    }
  }

  return {
    entryProto: Entry ? Object.getOwnPropertyNames(Entry.prototype).slice(0, 40) : null,
    entryProps: Entry && Entry.prototype.__properties__ ? Object.values(Entry.prototype.__properties__) : null,
    entryCtor: Entry ? String(Entry).slice(0, 400) : null,
    watcherProto: Watcher ? Object.getOwnPropertyNames(Watcher.prototype).slice(0, 40) : null,
    watcherProps: Watcher && Watcher.prototype.__properties__ ? Object.values(Watcher.prototype.__properties__) : null,
    found,
  };
})()
