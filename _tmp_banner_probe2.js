(function () {
  var root = window.$haxe;
  function find(n) {
    return Object.values(root).find(function (v) { return typeof v === 'function' && v.j === n; });
  }
  var Watcher = find('game.model.user.banner.watch.PlayerBannerWatcher');
  var Player = find('game.model.user.Player');
  function callSem(o, sem) {
    var p = o && o.__class__ && o.__class__.prototype && o.__class__.prototype.__properties__;
    if (!p) return;
    var k = Object.keys(p).find(function (x) { return p[x] === sem; });
    if (!k || typeof o[k] !== 'function') return;
    try { return o[k](); } catch (e) { return null; }
  }
  var watcher = null;
  var path = null;
  function maybeSet(v, pth) {
    if (!v || typeof v !== 'object' || watcher) return;
    if (Watcher && v instanceof Watcher) {
      watcher = v;
      path = pth;
      return;
    }
    if (v.__class__ && v.__class__.j === 'game.model.user.banner.watch.PlayerBannerWatcher') {
      watcher = v;
      path = pth;
    }
  }
  if (Player) {
    Object.keys(Player).forEach(function (k) {
      var v = Player[k];
      maybeSet(v, 'Player.' + k);
      if (!v || typeof v !== 'object') return;
      Object.keys(v).forEach(function (k2) {
        var v2 = v[k2];
        maybeSet(v2, 'Player.' + k + '.' + k2);
        if (!v2 || typeof v2 !== 'object') return;
        Object.keys(v2).forEach(function (k3) {
          maybeSet(v2[k3], 'Player.' + k + '.' + k2 + '.' + k3);
        });
      });
    });
  }
  if (!watcher) {
    window.__bannerProbeResult = { error: 'no watcher', playerStaticKeys: Player ? Object.keys(Player).slice(0, 40) : null };
    return;
  }
  var yf = watcher.yf;
  var mapObj = null;
  if (yf) {
    if (yf.h && typeof yf.h === 'object') mapObj = yf.h;
    else if (yf.D && typeof yf.D === 'object') mapObj = yf.D;
    else if (typeof yf === 'object') mapObj = yf;
  }
  var entries = [];
  if (mapObj) {
    Object.keys(mapObj).forEach(function (id) {
      if (entries.length >= 10) return;
      var entry = mapObj[id];
      if (!entry || typeof entry !== 'object') return;
      var bannerId = callSem(entry, 'get_id');
      if (bannerId == null) bannerId = entry.Fd != null ? entry.Fd : Number(id);
      var stoneFields = {};
      Object.keys(entry).forEach(function (fk) {
        if (fk === '__class__') return;
        var fv = entry[fk];
        if (Array.isArray(fv)) {
          stoneFields[fk] = { type: 'array', value: fv.slice(0, 8) };
        } else if (fv && typeof fv === 'object' && fv.h && typeof fv.h === 'object') {
          stoneFields[fk] = { type: 'map.h', value: fv.h };
        } else if (fv && typeof fv === 'object' && fv.D && typeof fv.D === 'object') {
          var sample = {};
          Object.keys(fv.D).slice(0, 6).forEach(function (dk) { sample[dk] = fv.D[dk]; });
          stoneFields[fk] = { type: 'map.D', keys: Object.keys(fv.D).slice(0, 12), sample: sample };
        } else if (typeof fv === 'number' || typeof fv === 'string' || typeof fv === 'boolean') {
          stoneFields[fk] = fv;
        } else if (fv && typeof fv === 'object' && fv.__class__) {
          stoneFields[fk] = { cls: fv.__class__.j, keys: Object.keys(fv).slice(0, 12) };
        }
      });
      entries.push({ id: bannerId, stoneFields: stoneFields });
    });
  }
  window.__bannerProbeResult = {
    path: path,
    watcherKeys: Object.keys(watcher),
    yfClass: yf && yf.__class__ && yf.__class__.j,
    yfKeys: yf ? Object.keys(yf).slice(0, 20) : null,
    entries: entries,
  };
})();
