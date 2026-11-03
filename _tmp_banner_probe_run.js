(function () {
  try {
    const root = window.$haxe;
    const find = (n) => Object.values(root).find((v) => typeof v === 'function' && v.j === n);
    const Entry = find('game.model.user.banner.PlayerBannerEntry');
    const Watcher = find('game.model.user.banner.watch.PlayerBannerWatcher');
    const found = [];
    const seen = new Set();
    const walk = (o, path, depth) => {
      if (!o || typeof o !== 'object' || depth > 6 || seen.has(o) || found.length >= 10) return;
      seen.add(o);
      const cls = o.__class__ && o.__class__.j;
      if (cls && /PlayerBanner/i.test(cls)) {
        found.push({
          path: path,
          cls: cls,
          keys: Object.keys(o).slice(0, 40),
          props: o.__class__.prototype && o.__class__.prototype.__properties__
            ? Object.values(o.__class__.prototype.__properties__).slice(0, 50)
            : [],
        });
      }
      for (const key of Object.keys(o)) {
        const v = o[key];
        if (v && typeof v === 'object') walk(v, path + '.' + key, depth + 1);
      }
    };

    const Player = find('game.model.user.Player');
    if (Player) {
      for (const key of Object.keys(Player)) {
        const v = Player[key];
        if (v && typeof v === 'object') walk(v, 'Player.' + key, 0);
      }
    }

    // Also try GameModel / ModelUser
    for (const name of [
      'game.model.GameModel',
      'game.model.user.PlayerInventory',
      'game.model.user.PlayerBanners',
    ]) {
      const C = find(name);
      if (!C) continue;
      for (const key of Object.keys(C)) {
        const v = C[key];
        if (v && typeof v === 'object') walk(v, name + '.' + key, 0);
      }
    }

    window.__bannerProbeResult = {
      entryProto: Entry ? Object.getOwnPropertyNames(Entry.prototype).slice(0, 50) : null,
      entryProps: Entry && Entry.prototype.__properties__ ? Object.values(Entry.prototype.__properties__) : null,
      entryCtor: Entry ? String(Entry).slice(0, 500) : null,
      watcherProto: Watcher ? Object.getOwnPropertyNames(Watcher.prototype).slice(0, 50) : null,
      watcherProps: Watcher && Watcher.prototype.__properties__ ? Object.values(Watcher.prototype.__properties__) : null,
      found: found,
    };
  } catch (e) {
    window.__bannerProbeResult = { error: String(e && e.message || e) };
  }
})();
