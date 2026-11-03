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
  function getBacking(map) {
    if (!map) return null;
    const candidates = Object.values(map).filter((v) => {
      if (!v || typeof v !== 'object' || Array.isArray(v) || v.__class__) return false;
      const proto = Object.getPrototypeOf(v);
      return proto === Object.prototype || proto === null;
    });
    return candidates[0] || null;
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
  const maps = data ? Object.entries(data).map(([k, v]) => ({ k, cls: className(v), type: typeof v })) : null;
  const map = data && Object.values(data).find((v) => className(v) === 'haxe.ds.IntMap');
  const mapKeys = map ? Object.keys(map) : null;
  const mapFieldVals = map ? Object.entries(map).map(([k, v]) => ({
    k,
    type: typeof v,
    cls: className(v),
    isPlain: v && typeof v === 'object' && !v.__class__ && !Array.isArray(v),
    proto: v && typeof v === 'object' ? String(Object.getPrototypeOf(v)) : null,
    keys: v && typeof v === 'object' && !v.__class__ ? Object.keys(v).slice(0, 12) : null,
  })) : null;

  // Try D field specifically (from earlier probe mapKeys:["D"])
  const backingD = map && map.D && typeof map.D === 'object' ? map.D : null;
  const entry1 = backingD && (backingD['1'] || backingD[1]);
  let entry1slots = null;
  if (entry1) {
    const stoneMap = Object.values(entry1).find((v) => className(v) === 'haxe.ds.IntMap');
    const stoneBacking = stoneMap && (stoneMap.D || getBacking(stoneMap));
    entry1slots = {
      entryCls: className(entry1),
      entryKeys: Object.keys(entry1),
      stoneMapCls: className(stoneMap),
      stoneBackingKeys: stoneBacking ? Object.keys(stoneBacking) : null,
      sample: stoneBacking ? Object.fromEntries(Object.entries(stoneBacking).slice(0, 3).map(([k, stone]) => {
        return [k, {
          cls: className(stone),
          idSem: callSem(stone, 'get_id'),
          id: stone && stone.id,
          keys: stone && typeof stone === 'object' ? Object.keys(stone).slice(0, 8) : null,
        }];
      })) : null,
    };
  }

  window.__verifyStones2 = {
    hasPlayer: !!player,
    hasData: !!data,
    maps,
    mapKeys,
    mapFieldVals,
    backingDKeys: backingD ? Object.keys(backingD).slice(0, 15) : null,
    entry1slots,
  };
})();
