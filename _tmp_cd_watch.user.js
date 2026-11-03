(function () {
  if (window.__cdWatchInstalled) {
    window.__cdWatchLog = window.__cdWatchLog || [];
    window.__cdWatchLog.push({ at: Date.now(), note: 'already installed' });
    return;
  }
  window.__cdWatchInstalled = true;
  window.__cdWatchLog = [];

  function findClass(n) {
    return Object.values(window.$haxe || {}).find((v) => typeof v === 'function' && v.j === n);
  }
  function className(o) { return o && o.__class__ && o.__class__.j || null; }
  function listOpen() {
    try {
      const Manager = findClass('game.mediator.gui.popup.GamePopupManager');
      const gk = Object.keys(Manager.__properties__ || {}).find((k) => Manager.__properties__[k] === 'get_instance');
      const manager = gk ? Manager[gk]() : null;
      const all = manager
        ? [...new Set(Object.values(manager).filter(Array.isArray).flat().filter((v) => v && v.__class__))]
        : [];
      return all.map((p) => {
        const med = Object.values(p).find((v) => v && v.__class__ && /Mediator/.test(v.__class__.j || ''));
        const info = { popup: className(p), mediator: className(med) };
        if (med) {
          info.mlj = med.mlj;
          info.keys = Object.keys(med).slice(0, 25);
          const props = med.__class__ && med.__class__.prototype && med.__class__.prototype.__properties__;
          if (props) info.props = Object.values(props).slice(0, 30);
        }
        return info;
      });
    } catch (e) {
      return [{ error: String(e) }];
    }
  }

  function snapshot(reason, extra) {
    const entry = {
      at: Date.now(),
      reason,
      open: listOpen(),
      extra: extra || null,
    };
    window.__cdWatchLog.push(entry);
    if (window.__cdWatchLog.length > 30) window.__cdWatchLog.shift();
    console.log('[CD Watch]', reason, entry);
    return entry;
  }

  const Send = window.Send;
  if (typeof Send === 'function') {
    window.Send = async function patchedSend(payload) {
      try {
        const calls = payload && payload.calls ? payload.calls : [];
        const cdCalls = calls.filter((c) => c && /clanDomination/i.test(c.name || ''));
        if (cdCalls.length) {
          snapshot('send:' + cdCalls.map((c) => c.name).join(','), {
            args: cdCalls.map((c) => ({ name: c.name, args: c.args })),
          });
        }
      } catch (e) {}
      const result = await Send.apply(this, arguments);
      try {
        const calls = payload && payload.calls ? payload.calls : [];
        const cdCalls = calls.filter((c) => c && /clanDomination_getEnemyTeams/i.test(c.name || ''));
        if (cdCalls.length) {
          setTimeout(() => snapshot('after getEnemyTeams', {
            responsePreview: (() => {
              try {
                const row = result && result.results && result.results[0];
                const resp = row && row.result && row.result.response;
                if (Array.isArray(resp)) {
                  return {
                    len: resp.length,
                    firstUserId: resp[0] && resp[0].userId,
                    firstPower: resp[0] && resp[0].defense && resp[0].defense.powerSum,
                  };
                }
                return typeof resp;
              } catch (e) { return String(e); }
            })(),
          }), 300);
          setTimeout(() => snapshot('after getEnemyTeams +1s'), 1000);
        }
      } catch (e) {}
      return result;
    };
  }

  // Also poll for SelectAttack / Castle popups
  setInterval(() => {
    const open = listOpen();
    const interesting = open.filter((o) => /SelectAttack|CastlePopup|DefenseTeamGather|AttackTarget|NoTeam/i.test(o.popup || ''));
    if (interesting.length) {
      const key = interesting.map((o) => o.popup).join('|');
      if (window.__cdWatchLastKey !== key) {
        window.__cdWatchLastKey = key;
        snapshot('popup appeared', { interesting });
      }
    }
  }, 400);

  snapshot('watch installed');
})();
