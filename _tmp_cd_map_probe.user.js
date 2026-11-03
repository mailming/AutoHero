(function () {
  function findClass(n) {
    return Object.values(window.$haxe || {}).find((v) => typeof v === 'function' && v.j === n);
  }
  function callSem(o, sem) {
    const p = o && o.__class__ && o.__class__.prototype && o.__class__.prototype.__properties__;
    if (!p) return undefined;
    const k = Object.keys(p).find((x) => p[x] === sem);
    if (!k || typeof o[k] !== 'function') return undefined;
    try { return o[k](); } catch (e) { return { __err: String(e) }; }
  }
  function className(o) { return o && o.__class__ && o.__class__.j || null; }

  // All clanDomination classes in $haxe
  const cdClasses = Object.values(window.$haxe || {})
    .filter((v) => typeof v === 'function' && typeof v.j === 'string' && /clanDomination/i.test(v.j))
    .map((v) => v.j)
    .sort();

  const Manager = findClass('game.mediator.gui.popup.GamePopupManager');
  const gk = Object.keys(Manager.__properties__ || {}).find((k) => Manager.__properties__[k] === 'get_instance');
  const manager = gk ? Manager[gk]() : null;
  const all = manager
    ? [...new Set(Object.values(manager).filter(Array.isArray).flat().filter((v) => v && v.__class__))]
    : [];

  const mapPopup = all.find((p) => className(p) === 'game.mechanics.clanDomination.popup.ClanDominationMapPopup');
  let mapInfo = null;
  if (mapPopup) {
    const med = Object.values(mapPopup).find((v) => v && v.__class__ && /Mediator/i.test(v.__class__.j || '')) || mapPopup;
    const props = med.__class__ && med.__class__.prototype && med.__class__.prototype.__properties__
      ? Object.values(med.__class__.prototype.__properties__).slice(0, 80)
      : [];
    const staticProps = med.__class__ && med.__class__.__properties__
      ? Object.values(med.__class__.__properties__).slice(0, 40)
      : [];
    const getters = {};
    const interesting = props.filter((s) => /level|enemy|target|select|player|team|attack|user|slot|point|node/i.test(String(s)));
    interesting.slice(0, 40).forEach((sem) => {
      const v = callSem(med, sem);
      getters[sem] = v == null ? null : {
        type: typeof v,
        cls: className(v),
        num: typeof v === 'number' ? v : null,
        str: typeof v === 'string' ? v.slice(0, 80) : null,
        keys: v && typeof v === 'object' ? Object.keys(v).slice(0, 20) : null,
      };
    });

    // Scan for selected enemy / level objects in mediator tree
    const hits = [];
    const seen = new Set();
    function walk(o, path, d) {
      if (!o || typeof o !== 'object' || d > 5 || seen.has(o) || hits.length > 40) return;
      seen.add(o);
      const cls = className(o);
      if (cls && /Enemy|Target|Level|Team|Player|User|Slot|Point|Node|Attack/i.test(cls) && /clanDomination|banner|battle|user/i.test(cls)) {
        hits.push({ path, cls, keys: Object.keys(o).slice(0, 20) });
      }
      try {
        Object.entries(o).forEach(([k, v]) => {
          if (v && typeof v === 'object') walk(v, path + '.' + k, d + 1);
        });
      } catch (e) {}
    }
    walk(med, 'med', 0);

    mapInfo = {
      popupCls: className(mapPopup),
      medCls: className(med),
      props: props.slice(0, 80),
      staticProps,
      getters,
      hits: hits.slice(0, 30),
      medKeys: Object.keys(med).slice(0, 40),
    };
  }

  // Does SelectAttackTargetPopup class even exist?
  const selectAttack = findClass('game.mechanics.clanDomination.popup.ClanDominationSelectAttackTargetPopup');
  const selectAttackMed = findClass('game.mechanics.clanDomination.mediator.ClanDominationSelectAttackTargetPopupMediator');

  window.__cdMapProbe = {
    open: all.map((p) => p.__class__.j),
    cdClasses: cdClasses.slice(0, 120),
    hasSelectAttackPopup: !!selectAttack,
    hasSelectAttackMed: !!selectAttackMed,
    mapInfo,
  };
})();
