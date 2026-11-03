(async function () {
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
  function getBacking(map) {
    if (!map || className(map) !== 'haxe.ds.IntMap') return null;
    return Object.values(map).find((v) => v && typeof v === 'object' && !v.__class__ && !Array.isArray(v)
      && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null)) || null;
  }
  function slotsFromEntry(entry) {
    if (!entry) return {};
    const map = Object.values(entry).find((v) => className(v) === 'haxe.ds.IntMap');
    const backing = getBacking(map);
    const out = {};
    if (backing) {
      Object.entries(backing).forEach(([k, stone]) => {
        const id = stone && typeof stone === 'object' ? (callSem(stone, 'get_id') ?? stone.id) : stone;
        if (Number(id) > 0) out[String(k)] = Number(id);
      });
    }
    return out;
  }
  const Manager = findClass('game.mediator.gui.popup.GamePopupManager');
  const gk = Object.keys(Manager.__properties__ || {}).find((k) => Manager.__properties__[k] === 'get_instance');
  const manager = gk ? Manager[gk]() : null;
  const roots = manager ? [...new Set(Object.values(manager).filter(Array.isArray).flat().filter((v) => v && v.__class__))] : [];
  let player = null;
  const seen = new Set();
  function walk(o, d) {
    if (!o || typeof o !== 'object' || d > 6 || seen.has(o) || player) return;
    seen.add(o);
    if (className(o) === 'game.model.user.Player') { player = o; return; }
    try { Object.values(o).forEach((v) => walk(v, d + 1)); } catch (e) {}
  }
  roots.forEach((r) => walk(r, 0));
  const data = player && Object.values(player).find((v) => className(v) === 'game.model.user.banner.PlayerBannerData');
  const map = data && Object.values(data).find((v) => className(v) === 'haxe.ds.IntMap');
  const backing = getBacking(map);

  let teamBanners = null;
  try {
    const r = await window.Send({
      calls: [{ name: 'team_getBanners', args: {}, context: { actionTs: Date.now() }, ident: 'b' }],
    });
    teamBanners = r.results?.[0]?.result?.response || {};
  } catch (e) {
    teamBanners = { error: String(e) };
  }
  const bannerId = Number(teamBanners?.arena) || 1;
  const entry = backing && (backing[String(bannerId)] || backing[bannerId]);
  window.__verifyStones = {
    hasPlayer: !!player,
    bannerId,
    attackStones: slotsFromEntry(entry),
    open: roots.map((p) => p.__class__.j),
  };
})();
