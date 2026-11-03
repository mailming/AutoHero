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
  function className(o) { return o && o.__class__ && o.__class__.j || null; }
  function stoneId(value) {
    if (value == null) return null;
    if (typeof value === 'number' || typeof value === 'string') {
      const id = Number(value);
      return Number.isFinite(id) && id > 0 ? id : null;
    }
    const semanticId = Number(callSem(value, 'get_id'));
    if (Number.isFinite(semanticId) && semanticId > 0) return semanticId;
    const rawId = Number(value._id ?? value.id);
    return Number.isFinite(rawId) && rawId > 0 ? rawId : null;
  }
  const Manager = findClass('game.mediator.gui.popup.GamePopupManager');
  const gk = Object.keys(Manager.__properties__ || {}).find((k) => Manager.__properties__[k] === 'get_instance');
  const manager = gk ? Manager[gk]() : null;
  const roots = manager ? [...new Set(Object.values(manager).filter(Array.isArray).flat().filter((v) => v && v.__class__))] : [];
  let player = null;
  const seen = new Set();
  function walk(o, d) {
    if (!o || typeof o !== 'object' || d > 8 || seen.has(o) || player) return;
    seen.add(o);
    if (className(o) === 'game.model.user.Player') { player = o; return; }
    try { Object.values(o).forEach((v) => walk(v, d + 1)); } catch (e) {}
  }
  roots.forEach((r) => walk(r, 0));
  const data = player && Object.values(player).find((v) => className(v) === 'game.model.user.banner.PlayerBannerData');
  const map = data && Object.values(data).find((v) => className(v) === 'haxe.ds.IntMap');
  const entry = map && map.D && (map.D['1'] || map.D[1]);
  const stoneMap = entry && Object.values(entry).find((v) => className(v) === 'haxe.ds.IntMap');
  const backing = stoneMap && stoneMap.D;
  const slots = {};
  if (backing) {
    Object.entries(backing).forEach(([k, stone]) => {
      const id = stoneId(stone);
      if (id != null) slots[String(k)] = id;
    });
  }
  window.__verifyStones3 = { hasPlayer: !!player, slots, stone0: backing && backing['0'] ? { _id: backing['0']._id, id: backing['0'].id } : null };
})();
