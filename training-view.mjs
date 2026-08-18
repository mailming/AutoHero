import { formatCombo, HERO_NAMES, PET_NAMES, resolveHeroName } from './hero-names.mjs';

export function parseHeroFilterParams(searchParams, key) {
    const values = searchParams.getAll(key);
    const ids = values
        .map((value) => Number(value))
        .filter((id) => Number.isFinite(id) && id > 0);
    return [...new Set(ids)];
}

function buildHeroFilterOptions(selectedIds = []) {
    const selected = new Set(selectedIds.map(Number));
    const options = [];
    for (const [id, name] of Object.entries(HERO_NAMES)) {
        const heroId = Number(id);
        if (!selected.has(heroId)) {
            options.push({ id: heroId, label: name, group: 'Heroes' });
        }
    }
    for (const [id, name] of Object.entries(PET_NAMES)) {
        const petId = Number(id);
        if (!selected.has(petId)) {
            options.push({ id: petId, label: name, group: 'Pets' });
        }
    }
    options.sort((a, b) => a.label.localeCompare(b.label));
    return options;
}

function buildTrainingQueryBase(paging = {}) {
    const parts = [];
    if (paging.comboKey) {
        parts.push(`comboKey=${encodeURIComponent(paging.comboKey)}`);
    }
    for (const id of paging.opponentHeroIds || []) {
        parts.push(`opponentHero=${encodeURIComponent(id)}`);
    }
    for (const id of paging.myHeroIds || []) {
        parts.push(`myHero=${encodeURIComponent(id)}`);
    }
    return parts.length ? `${parts.join('&')}&` : '';
}

function renderHeroFilterChips(side, heroIds) {
    return (heroIds || []).map((id) => {
        const label = resolveHeroName(id);
        return `<button type="button" class="chip" onclick="removeHeroFilter('${side}', ${Number(id)})" title="Remove ${escapeHtml(label)}">${escapeHtml(label)} <span class="chip-x">×</span></button>`;
    }).join('');
}

function renderHeroFilterSelect(side, heroIds) {
    const options = buildHeroFilterOptions(heroIds);
    const optionGroups = {
        Heroes: [],
        Pets: [],
    };
    for (const option of options) {
        optionGroups[option.group].push(
            `<option value="${option.id}">${escapeHtml(option.label)}</option>`
        );
    }
    return `
        <select id="${side}-hero-select" aria-label="${side} hero filter">
            <option value="">Add hero or pet…</option>
            ${optionGroups.Heroes.length ? `<optgroup label="Heroes">${optionGroups.Heroes.join('')}</optgroup>` : ''}
            ${optionGroups.Pets.length ? `<optgroup label="Pets">${optionGroups.Pets.join('')}</optgroup>` : ''}
        </select>`;
}

function renderHeroFilters(paging = {}) {
    const opponentHeroIds = paging.opponentHeroIds || [];
    const myHeroIds = paging.myHeroIds || [];
    const hasFilters = opponentHeroIds.length > 0 || myHeroIds.length > 0;

    return `
  <div class="filters">
    <div class="filter-group">
      <div class="filter-title">Opponent combo filter</div>
      <div class="chips" id="opponent-chips">
        ${renderHeroFilterChips('opponent', opponentHeroIds) || '<span class="muted">Any opponent combo</span>'}
      </div>
      <div class="filter-row">
        ${renderHeroFilterSelect('opponent', opponentHeroIds)}
        <button type="button" onclick="addHeroFilter('opponent')">Add</button>
        ${opponentHeroIds.length ? `<button type="button" class="ghost" onclick="clearHeroFilter('opponent')">Clear</button>` : ''}
      </div>
    </div>
    <div class="filter-group">
      <div class="filter-title">My combo filter</div>
      <div class="chips" id="my-chips">
        ${renderHeroFilterChips('my', myHeroIds) || '<span class="muted">Any of my combos</span>'}
      </div>
      <div class="filter-row">
        ${renderHeroFilterSelect('my', myHeroIds)}
        <button type="button" onclick="addHeroFilter('my')">Add</button>
        ${myHeroIds.length ? `<button type="button" class="ghost" onclick="clearHeroFilter('my')">Clear</button>` : ''}
      </div>
    </div>
    ${hasFilters ? '<div class="filter-note muted">Results must include every selected hero/pet in that combo.</div>' : ''}
  </div>`;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function formatPct(winRate) {
    if (winRate == null) return '—';
    return `${Number(winRate).toFixed(1)}%`;
}

function formatWhen(iso) {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleString();
    } catch {
        return String(iso);
    }
}

export function renderTrainingResultsPage(results, summary = {}, paging = {}) {
    const total = paging.total ?? results.length;
    const offset = paging.offset ?? 0;
    const pageSize = paging.pageSize ?? results.length;
    const comboKey = paging.comboKey;
    const shownFrom = total === 0 ? 0 : offset + 1;
    const shownTo = Math.min(offset + results.length, total);
    const nextOffset = offset + results.length;
    const hasMore = nextOffset < total;

    const queryBase = buildTrainingQueryBase(paging);
    const allLink = `/?${queryBase}limit=0`;
    const nextLink = `/?${queryBase}offset=${nextOffset}&limit=${pageSize}`;

    const rows = results.map((row) => `
        <tr>
            <td>${escapeHtml(row.opponentCombo.label)}</td>
            <td class="muted">${escapeHtml(row.opponentPlayer || '—')}${row.opponentPlace ? ` #${escapeHtml(row.opponentPlace)}` : ''}</td>
            <td>${escapeHtml(row.myCombo.label)}</td>
            <td class="win ${row.winRate >= 50 ? 'good' : 'bad'}">${escapeHtml(formatPct(row.winRate))}</td>
            <td class="muted">${escapeHtml(formatWhen(row.testedAt))}</td>
        </tr>
    `).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Arena Training Results</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; margin: 24px; background: #0f1419; color: #e7ecf3; }
    h1 { margin: 0 0 8px; font-size: 1.4rem; }
    .meta { color: #8b9bb4; margin-bottom: 12px; font-size: 0.9rem; }
    .toolbar { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin-bottom: 16px; }
    .toolbar a, .toolbar button {
      color: #e7ecf3; background: #1a2433; border: 1px solid #2f3f57; border-radius: 6px;
      padding: 8px 12px; font-size: 0.9rem; text-decoration: none; cursor: pointer;
    }
    .toolbar a:hover, .toolbar button:hover { background: #243044; }
    .filters {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;
      margin-bottom: 16px; padding: 16px; border: 1px solid #243044; border-radius: 8px; background: #151d28;
    }
    .filter-group { display: flex; flex-direction: column; gap: 8px; }
    .filter-title { font-size: 0.9rem; font-weight: 600; color: #9fb3d1; }
    .filter-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .filter-row select {
      min-width: 220px; flex: 1; color: #e7ecf3; background: #1a2433; border: 1px solid #2f3f57;
      border-radius: 6px; padding: 8px 10px; font-size: 0.9rem;
    }
    .filter-row button.ghost { background: transparent; }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; min-height: 28px; align-items: center; }
    .chip {
      display: inline-flex; align-items: center; gap: 6px; color: #e7ecf3; background: #243044;
      border: 1px solid #3a4f6d; border-radius: 999px; padding: 4px 10px; font-size: 0.85rem; cursor: pointer;
    }
    .chip:hover { background: #2f3f57; }
    .chip-x { color: #9fb3d1; font-weight: 700; }
    .filter-note { grid-column: 1 / -1; font-size: 0.85rem; }
    .table-wrap {
      max-height: calc(100vh - 180px);
      overflow: auto;
      border: 1px solid #243044;
      border-radius: 8px;
    }
    table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
    th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #243044; vertical-align: top; }
    th { color: #9fb3d1; font-weight: 600; position: sticky; top: 0; background: #151d28; z-index: 1; }
    tr:hover td { background: #151d28; }
    .muted { color: #8b9bb4; font-size: 0.85rem; }
    .win { font-weight: 600; }
    .good { color: #6ee7a0; }
    .bad { color: #f87171; }
    a { color: #7cb8ff; }
    .status { color: #9fb3d1; font-size: 0.9rem; }
  </style>
</head>
<body>
  <h1>Arena Training Results</h1>
  <p class="meta">
    ${summary.opponentComboCount ?? 0} opponent combos ·
    ${summary.matchupTestCount ?? total} tests ·
    JSON: <a href="/training/results?limit=0">/training/results</a> ·
    <a href="/training/meta-view">Meta teams</a>
  </p>
  ${renderHeroFilters(paging)}
  <div class="toolbar">
    <span class="status">Showing ${shownFrom}–${shownTo} of ${total}</span>
    ${pageSize > 0 && offset + pageSize < total ? `<a href="${allLink}">Show all</a>` : ''}
    ${hasMore ? `<a href="${nextLink}">Load ${Math.min(pageSize, total - nextOffset)} more</a>` : ''}
    ${offset > 0 ? `<a href="/?${queryBase}limit=${pageSize}">Back to start</a>` : ''}
  </div>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>Opponent combo</th>
          <th>Opponent</th>
          <th>My combo</th>
          <th>Win %</th>
          <th>Last tested</th>
        </tr>
      </thead>
      <tbody>
        ${rows || '<tr><td colspan="5" class="muted">No results yet.</td></tr>'}
      </tbody>
    </table>
  </div>
  ${hasMore ? `<p class="meta" style="margin-top:16px"><a href="${nextLink}">Load more results</a> · <a href="${allLink}">Show all ${total}</a></p>` : ''}
  <script>
    function currentParams() {
      return new URL(window.location.href);
    }
    function heroFilterKey(side) {
      return side === 'opponent' ? 'opponentHero' : 'myHero';
    }
    function addHeroFilter(side) {
      const select = document.getElementById(side + '-hero-select');
      const id = select && select.value;
      if (!id) return;
      const url = currentParams();
      const key = heroFilterKey(side);
      if (!url.searchParams.getAll(key).includes(String(id))) {
        url.searchParams.append(key, id);
      }
      url.searchParams.delete('offset');
      window.location.href = url.toString();
    }
    function removeHeroFilter(side, id) {
      const url = currentParams();
      const key = heroFilterKey(side);
      const remaining = url.searchParams.getAll(key).filter((value) => value !== String(id));
      url.searchParams.delete(key);
      remaining.forEach((value) => url.searchParams.append(key, value));
      url.searchParams.delete('offset');
      window.location.href = url.toString();
    }
    function clearHeroFilter(side) {
      const url = currentParams();
      url.searchParams.delete(heroFilterKey(side));
      url.searchParams.delete('offset');
      window.location.href = url.toString();
    }
    document.querySelectorAll('.filter-row select').forEach((select) => {
      select.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          const side = select.id.replace('-hero-select', '');
          addHeroFilter(side);
        }
      });
    });
  </script>
</body>
</html>`;
}

export function renderMetaTeamsPage(teams, snapshot, snapshots = [], paging = {}) {
    const total = paging.total ?? teams.length;
    const offset = paging.offset ?? 0;
    const pageSize = paging.pageSize ?? teams.length;
    if (!snapshot) {
        return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" /><title>Meta Arena Teams</title>
<style>body{font-family:system-ui,sans-serif;margin:24px;background:#0f1419;color:#e7ecf3;}</style>
</head><body>
<h1>Meta Arena Teams</h1>
<p>No snapshots yet. Run <code>python scrape_meta_teams_to_db.py</code> first.</p>
<p><a href="/training/view">Training results</a></p>
</body></html>`;
    }

    const snapshotId = snapshot.id;
    const shownFrom = total === 0 ? 0 : offset + 1;
    const shownTo = Math.min(offset + teams.length, total);
    const nextOffset = offset + teams.length;
    const hasMore = nextOffset < total;

    const queryBase = `snapshotId=${snapshotId}&`;
    const nextLink = `/training/meta-view?${queryBase}offset=${nextOffset}&limit=${pageSize}`;
    const allLink = `/training/meta-view?${queryBase}limit=0`;
    const startLink = `/training/meta-view?${queryBase}limit=${pageSize}`;

    const snapshotOptions = snapshots.map((s) => {
        const selected = s.id === snapshotId ? ' selected' : '';
        const label = `#${s.id} — ${formatWhen(s.capturedAt)} (${s.totalTeams} teams)`;
        return `<option value="${s.id}"${selected}>${escapeHtml(label)}</option>`;
    }).join('');

    const rows = teams.map((team) => {
        const heroLabel = Array.isArray(team.heroNames) && team.heroNames.length
            ? team.heroNames.join(', ')
            : (team.heroIds || []).join(', ');
        const petLabel = team.petName || (team.pet ? `Pet ${team.pet}` : '—');
        return `
        <tr>
            <td>${escapeHtml(team.rowRank ?? '—')}</td>
            <td class="pop">${escapeHtml(team.popularityCount ?? '—')}</td>
            <td>${escapeHtml(heroLabel)}</td>
            <td class="muted">${escapeHtml(petLabel)}</td>
            <td class="muted">${escapeHtml(team.banner ?? '—')}</td>
            <td class="muted mono">${escapeHtml(team.comboKey)}</td>
            <td class="muted">${escapeHtml(team.pageNumber ?? '—')}</td>
        </tr>
    `;
    }).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Meta Arena Teams</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; margin: 24px; background: #0f1419; color: #e7ecf3; }
    h1 { margin: 0 0 8px; font-size: 1.4rem; }
    .meta { color: #8b9bb4; margin-bottom: 12px; font-size: 0.9rem; }
    .toolbar { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin-bottom: 16px; }
    .toolbar a, .toolbar select {
      color: #e7ecf3; background: #1a2433; border: 1px solid #2f3f57; border-radius: 6px;
      padding: 8px 12px; font-size: 0.9rem; text-decoration: none;
    }
    .toolbar a:hover { background: #243044; }
    .table-wrap {
      max-height: calc(100vh - 220px);
      overflow: auto;
      border: 1px solid #243044;
      border-radius: 8px;
    }
    table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
    th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #243044; vertical-align: top; }
    th { color: #9fb3d1; font-weight: 600; position: sticky; top: 0; background: #151d28; z-index: 1; }
    tr:hover td { background: #151d28; }
    .muted { color: #8b9bb4; font-size: 0.85rem; }
    .pop { font-weight: 600; color: #f6d365; }
    .mono { font-family: ui-monospace, monospace; font-size: 0.8rem; }
    a { color: #7cb8ff; }
    .status { color: #9fb3d1; font-size: 0.9rem; }
  </style>
</head>
<body>
  <h1>Meta Arena Teams</h1>
  <p class="meta">
    Snapshot #${escapeHtml(snapshotId)} · captured ${escapeHtml(formatWhen(snapshot?.capturedAt))} ·
    ${escapeHtml(snapshot?.source || 'hw-recruit')} · position ≤ ${escapeHtml(snapshot?.positionMax ?? '—')} ·
    ${escapeHtml(snapshot?.totalTeams ?? 0)} teams (${escapeHtml(snapshot?.uniqueCombos ?? 0)} unique) ·
    <a href="/training/meta-snapshots">JSON snapshots</a> ·
    <a href="/training/meta-teams?snapshotId=${snapshotId}">JSON teams</a> ·
    <a href="/training/view">Training results</a>
  </p>
  <div class="toolbar">
    <label class="status">Snapshot
      <select onchange="if(this.value) location.href='/training/meta-view?snapshotId='+this.value">
        ${snapshotOptions}
      </select>
    </label>
    <span class="status">Showing ${shownFrom}–${shownTo} of ${total}</span>
    ${pageSize > 0 && offset + pageSize < total ? `<a href="${allLink}">Show all</a>` : ''}
    ${hasMore ? `<a href="${nextLink}">Load ${Math.min(pageSize, total - nextOffset)} more</a>` : ''}
    ${offset > 0 ? `<a href="${startLink}">Back to start</a>` : ''}
  </div>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>Rank</th>
          <th>Count</th>
          <th>Team</th>
          <th>Pet</th>
          <th>Banner</th>
          <th>Combo key</th>
          <th>Page</th>
        </tr>
      </thead>
      <tbody>
        ${rows || '<tr><td colspan="7" class="muted">No meta teams in this snapshot.</td></tr>'}
      </tbody>
    </table>
  </div>
  ${hasMore ? `<p class="meta" style="margin-top:16px"><a href="${nextLink}">Load more</a> · <a href="${allLink}">Show all ${total}</a></p>` : ''}
</body>
</html>`;
}

export function formatTrainingResultRow(row) {
    const opponentCombo = formatCombo(row.opponent_hero_ids, row.opponent_pet);
    const myCombo = formatCombo(
        row.my_hero_ids,
        row.my_pet,
        sanitizeHeroNames(row.my_hero_names)
    );

    return {
        opponentComboKey: row.combo_key,
        opponentCombo,
        opponentPlayer: row.opponent_name,
        opponentPlace: row.opponent_place,
        opponentPower: row.opponent_power != null ? Number(row.opponent_power) : null,
        myCombo,
        winRate: row.win_rate != null ? Number(row.win_rate) : null,
        wins: row.wins != null ? Number(row.wins) : null,
        losses: row.losses != null ? Number(row.losses) : null,
        rank: row.rank != null ? Number(row.rank) : null,
        testedAt: row.tested_at,
        sessionId: row.session_id,
    };
}

function sanitizeHeroNames(names) {
    if (!Array.isArray(names)) return null;
    const cleaned = names.map((n) => (
        n && !String(n).startsWith('Hero ') ? n : null
    ));
    return cleaned.some(Boolean) ? cleaned : null;
}
