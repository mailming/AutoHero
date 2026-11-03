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

  const Med = findClass('game.mechanics.clanDomination.mediator.ClanDominationSelectAttackTargetPopupMediator');
  const proto = Med && Med.prototype;
  const sourceSnippets = {};
  if (proto) {
    ['createPopup', 'pva', 'tT', 'Yhb', 'Wa', 'hc', 'aDe', 'H0c', 'UNj'].forEach((name) => {
      if (typeof proto[name] === 'function') {
        try {
          sourceSnippets[name] = Function.prototype.toString.call(proto[name]).slice(0, 500);
        } catch (e) {
          sourceSnippets[name] = String(e);
        }
      }
    });
  }

  // Inspect AttackTargetRenderer
  const Renderer = findClass('game.mechanics.clanDomination.popup.ClanDominationAttackTargetRenderer');
  const rendererProps = Renderer && Renderer.prototype && Renderer.prototype.__properties__
    ? Object.values(Renderer.prototype.__properties__)
    : null;

  // Town tooltip VO
  const TownVO = findClass('game.mechanics.clanDomination.popup.ClanDominationMapTownTooltipValueObject');
  const townProps = TownVO && TownVO.prototype && TownVO.prototype.__properties__
    ? Object.values(TownVO.prototype.__properties__)
    : null;
  const EnemyCastleVO = findClass('game.mechanics.clanDomination.popup.ClanDominationMapEnemyCastleTooltipValueObject');
  const enemyCastleProps = EnemyCastleVO && EnemyCastleVO.prototype && EnemyCastleVO.prototype.__properties__
    ? Object.values(EnemyCastleVO.prototype.__properties__)
    : null;

  // PlayerClanDominationData
  const PlayerCD = findClass('game.mechanics.clanDomination.model.PlayerClanDominationData');
  const playerCdProps = PlayerCD && PlayerCD.prototype && PlayerCD.prototype.__properties__
    ? Object.values(PlayerCD.prototype.__properties__)
    : null;

  window.__cdMedProbe = {
    medProps: Med && Med.prototype && Med.prototype.__properties__
      ? Object.values(Med.prototype.__properties__)
      : null,
    medFields: Med && Med.prototype ? Object.getOwnPropertyNames(Med.prototype) : null,
    sourceSnippets,
    rendererProps,
    townProps,
    enemyCastleProps,
    playerCdProps,
  };
})();
