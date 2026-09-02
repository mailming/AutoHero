import { formatCombo, HERO_NAMES, PET_NAMES, resolveHeroName } from './hero-names.mjs';
import { HERO_ICON_TOOLTIP_CSS, iconUrlForUnit, renderComboLabelHtml, renderHeroListHtml, renderUnitNameHtml } from './hero-icons.mjs';

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
    if (paging.testerUserId) {
        parts.push(`tester=${encodeURIComponent(paging.testerUserId)}`);
    }
    for (const id of paging.opponentHeroIds || []) {
        parts.push(`opponentHero=${encodeURIComponent(id)}`);
    }
    for (const id of paging.myHeroIds || []) {
        parts.push(`myHero=${encodeURIComponent(id)}`);
    }
    return parts.length ? `${parts.join('&')}&` : '';
}

function formatTesterLabel(tester) {
    if (!tester) return '—';
    const name = tester.testerName
        || (tester.maxUpgrade !== false ? 'maxHeros' : null)
        || (tester.testerUserId ? `User ${tester.testerUserId}` : '—');
    if (tester.maxUpgrade !== false && name === 'maxHeros') {
        return 'maxHeros';
    }
    return name;
}

function renderTesterFilter(paging = {}, testers = []) {
    const selected = paging.testerUserId ? String(paging.testerUserId) : '';
    const options = testers.map((tester) => {
        const value = String(tester.testerUserId ?? '');
        const label = formatTesterLabel(tester);
        const mode = tester.maxUpgrade !== false ? 'max upgrade' : 'user team';
        const selectedAttr = selected === value ? ' selected' : '';
        return `<option value="${escapeHtml(value)}"${selectedAttr}>${escapeHtml(label)} (${mode}) · ${tester.testCount ?? 0} tests</option>`;
    }).join('');

    return `
      <div class="filter-group filter-group-tester">
        <div class="filter-title">Tester account</div>
        <p class="filter-help muted">Show only tests from a specific account — <strong>maxHeros</strong> for max-upgrade sims, or a player name for real-team tests.</p>
        <div class="filter-row">
          <select id="tester-select" class="tester-select" aria-label="Filter by tester account">
            <option value=""${!selected ? ' selected' : ''}>All testers</option>
            ${options}
          </select>
          ${selected ? '<button type="button" class="ghost" onclick="applyTesterFilter(\'\')">Clear</button>' : ''}
        </div>
      </div>`;
}

function renderHeroFilterChips(side, heroIds) {
    return (heroIds || []).map((id) => {
        const label = resolveHeroName(id);
        return `<button type="button" class="chip" onclick="removeHeroFilter('${side}', ${Number(id)})" title="Remove ${escapeHtml(label)}">${renderUnitNameHtml(id, label)} <span class="chip-x">×</span></button>`;
    }).join('');
}

function renderFilterPickerOption(option) {
    const iconUrl = iconUrlForUnit(option.id);
    const iconHtml = iconUrl
        ? `<img class="filter-picker-icon" src="${escapeHtml(iconUrl)}" alt="" width="24" height="24" loading="lazy">`
        : '<span class="filter-picker-icon filter-picker-icon-fallback" aria-hidden="true"></span>';
    return `<button type="button" class="filter-picker-option" data-id="${option.id}" data-search="${escapeHtml(option.label.toLowerCase())}" role="option">${iconHtml}<span>${escapeHtml(option.label)}</span></button>`;
}

function renderHeroFilterSelect(side, heroIds) {
    const options = buildHeroFilterOptions(heroIds);
    const heroes = options.filter((option) => option.group === 'Heroes');
    const pets = options.filter((option) => option.group === 'Pets');
    const sideLabel = side === 'opponent' ? 'opponent' : 'your team';

    return `
        <div class="filter-picker" id="${side}-hero-picker" data-side="${side}">
          <input type="hidden" id="${side}-hero-select" value="">
          <button type="button" class="filter-picker-trigger" aria-haspopup="listbox" aria-expanded="false" aria-label="Choose ${sideLabel} hero or pet">
            <span class="filter-picker-placeholder">Choose a hero or pet…</span>
            <span class="filter-picker-caret" aria-hidden="true">▾</span>
          </button>
          <div class="filter-picker-menu" role="listbox" hidden>
            <div class="filter-picker-search-wrap">
              <input type="search" class="filter-picker-search" placeholder="Type to search heroes or pets…" autocomplete="off" aria-label="Search ${sideLabel} heroes and pets">
            </div>
            <div class="filter-picker-options">
              ${heroes.length ? `<div class="filter-picker-group-label">Heroes</div>${heroes.map(renderFilterPickerOption).join('')}` : ''}
              ${pets.length ? `<div class="filter-picker-group-label">Pets</div>${pets.map(renderFilterPickerOption).join('')}` : ''}
              <div class="filter-picker-empty muted" hidden>No matches — try a different name</div>
            </div>
          </div>
        </div>`;
}

function renderHeroFilters(paging = {}) {
    const opponentHeroIds = paging.opponentHeroIds || [];
    const myHeroIds = paging.myHeroIds || [];
    const testers = paging.testers || [];
    const hasFilters = opponentHeroIds.length > 0 || myHeroIds.length > 0 || !!paging.testerUserId;

    return `
  <section class="section" id="filters">
    <div class="section-head">
      <h2>Filter results</h2>
      <p class="section-lead">Pick a tester account and/or heroes to narrow what you see. Everything below updates to match.</p>
    </div>
    <div class="filters card">
      ${renderTesterFilter(paging, testers)}
      <div class="filter-group">
        <div class="filter-title">Opponent team includes</div>
        <p class="filter-help muted">Show opponents whose lineup has <em>all</em> of these heroes or pets.</p>
        <div class="chips" id="opponent-chips">
          ${renderHeroFilterChips('opponent', opponentHeroIds) || '<span class="muted">No filter — any opponent</span>'}
        </div>
        <div class="filter-row">
          ${renderHeroFilterSelect('opponent', opponentHeroIds)}
          <button type="button" onclick="addHeroFilter('opponent')">Add</button>
          ${opponentHeroIds.length ? `<button type="button" class="ghost" onclick="clearHeroFilter('opponent')">Clear all</button>` : ''}
        </div>
      </div>
      <div class="filter-group">
        <div class="filter-title">Your counter team includes</div>
        <p class="filter-help muted">Show only your teams that have <em>all</em> of these heroes or pets. For Grand Arena below, each selected hero must appear on one of the 3 teams (15 unique heroes total).</p>
        <div class="chips" id="my-chips">
          ${renderHeroFilterChips('my', myHeroIds) || '<span class="muted">No filter — any of your teams</span>'}
        </div>
        <div class="filter-row">
          ${renderHeroFilterSelect('my', myHeroIds)}
          <button type="button" onclick="addHeroFilter('my')">Add</button>
          ${myHeroIds.length ? `<button type="button" class="ghost" onclick="clearHeroFilter('my')">Clear all</button>` : ''}
        </div>
      </div>
      ${hasFilters ? '<div class="filter-active">Filters on — you are viewing a subset of saved tests.</div>' : ''}
    </div>
  </section>`;
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

function formatRecord(wins, losses) {
    if (wins == null && losses == null) return '—';
    return `${wins ?? 0}W / ${losses ?? 0}L`;
}

function winRateClass(winRate, minWinRate = 90) {
    if (winRate == null) return '';
    if (winRate >= minWinRate) return 'good';
    if (winRate >= 50) return 'mid';
    return 'bad';
}

function renderWinRateCell(winRate, minWinRate = 90) {
    const cls = winRateClass(winRate, minWinRate);
    const solved = winRate != null && winRate >= minWinRate
        ? `<span class="badge solved">Strong counter</span>`
        : '';
    return `<span class="win ${cls}">${escapeHtml(formatPct(winRate))}</span>${solved}`;
}

function renderPageIntro(minWinRate = 90) {
    return `
  <section class="intro card">
    <h2>How to use this page</h2>
    <p class="intro-lead">
      Hero Wars Helper’s <strong>Arena Training</strong> runs practice battles (no arena attempts spent).
      It tries to find a team that beats each opponent at least <strong>${minWinRate}%</strong> of the time, then saves the results here.
    </p>
    <ol class="intro-steps">
      <li><strong>Run training in HWH</strong> — start Arena Training or the loop; it checks arena opponents, then popular meta teams.</li>
      <li><strong>Filter (optional)</strong> — focus on specific heroes on either side; all sections below follow your filters.</li>
      <li><strong>Pick teams</strong> — use the best-team tables and Grand Arena section; scroll to the bottom for every individual test.</li>
    </ol>
  </section>`;
}

function renderPageNav() {
    return `
  <nav class="page-nav" aria-label="Page sections">
    <span class="page-nav-label">Jump to:</span>
    <a href="#filters">Filters</a>
    <a href="#insights">Best teams</a>
    <a href="#recommendations">Grand Arena</a>
    <a href="#results">Full log</a>
  </nav>`;
}

function renderSummaryFooter(summary = {}, paging = {}) {
    const minWinRate = paging.stats?.minWinRate ?? 90;
    const filteredTotal = paging.total ?? 0;
    const latest = summary.latestSummary;
    const latestLine = latest
        ? `${escapeHtml(formatPct(latest.winRate))} vs ${escapeHtml(latest.opponentName || 'opponent')} · ${escapeHtml(formatWhen(latest.testedAt))}`
        : 'No tests saved yet';
    const filteredHighlight = filteredTotal !== summary.matchupTestCount ? ' footer-stat-highlight' : '';

    return `
  <footer class="page-footer">
    <div class="footer-stats">
      <span class="footer-stat"><strong>${summary.opponentComboCount ?? 0}</strong> unique opponents</span>
      <span class="footer-stat"><strong>${summary.matchupTestCount ?? 0}</strong> tests saved</span>
      <span class="footer-stat"><strong>${summary.roundCount ?? 0}</strong> training runs</span>
      <span class="footer-stat${filteredHighlight}"><strong>${filteredTotal}</strong> shown after filters</span>
    </div>
    <p class="footer-meta"><span class="meta-label">Most recent test:</span> ${latestLine}</p>
    <p class="footer-meta">Green = ${minWinRate}%+ win rate (training goal for a reliable counter).</p>
  </footer>`;
}

function renderDevLinks() {
    return `
  <details class="dev-links">
    <summary>API &amp; raw data</summary>
    <p class="muted">
      <a href="/training/results?limit=0">All results (JSON)</a> ·
      <a href="/training/summary">Summary (JSON)</a> ·
      <a href="/training/meta-view">Meta teams</a>
    </p>
  </details>`;
}

function renderTrainingStats(stats = {}) {
    const minWinRate = stats.minWinRate ?? 90;
    const topCombos = stats.topMyCombos || [];
    const topHeroes = stats.topMyHeroes || [];

    const comboRows = topCombos.map((row, index) => {
        return `
        <tr>
            <td>${index + 1}</td>
            <td>${renderComboLabelHtml(row.myHeroIds, row.myPet, row.myHeroNames)}</td>
            <td class="win good">${escapeHtml(formatPct(row.avgWinRate))}</td>
            <td class="win">${escapeHtml(formatPct(row.bestWinRate))}</td>
            <td>${row.highWinCount ?? 0}</td>
            <td class="muted">${row.testCount ?? 0}</td>
        </tr>`;
    }).join('');

    const heroRows = topHeroes.map((row, index) => {
        const label = resolveHeroName(row.heroId);
        const isPet = Number(row.heroId) >= 6000;
        return `
        <tr>
            <td>${index + 1}</td>
            <td>${renderUnitNameHtml(row.heroId, label)}${isPet ? ' <span class="muted">(pet)</span>' : ''}</td>
            <td>${row.wins90 ?? 0}</td>
            <td class="win good">${escapeHtml(formatPct(row.avgWinRate))}</td>
            <td class="muted">${row.appearances ?? 0}</td>
        </tr>`;
    }).join('');

    return `
  <section class="section" id="insights">
    <div class="section-head">
      <h2>Your best counters</h2>
      <p class="section-lead">Teams and heroes that win most often against the opponents you filtered. A strong counter means ${minWinRate}%+ win rate in simulations.</p>
    </div>
    <div class="stats-grid">
      <div class="stats-panel card">
        <h3>Top 10 full teams</h3>
        <p class="muted stats-note">Best 5-hero + pet lineups, ranked by how often they reach ${minWinRate}%+.</p>
        <div class="table-wrap stats-table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Your team</th>
                <th>Avg win %</th>
                <th>Best win %</th>
                <th>Times ${minWinRate}%+</th>
                <th>Tests</th>
              </tr>
            </thead>
            <tbody>
              ${comboRows || `<tr><td colspan="6" class="muted">No data yet — run Arena Training in HWH first.</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
      <div class="stats-panel card">
        <h3>Top 10 heroes &amp; pets</h3>
        <p class="muted stats-note">Who shows up most in your ${minWinRate}%+ winning lineups.</p>
        <div class="table-wrap stats-table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Hero / pet</th>
                <th>${minWinRate}%+ wins</th>
                <th>Avg win %</th>
                <th>Lineups</th>
              </tr>
            </thead>
            <tbody>
              ${heroRows || `<tr><td colspan="5" class="muted">No data yet.</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </section>`;
}

function renderGrandArenaTeamCell(team, minWinRate) {
    return `
      <div class="ga-team">
        <div>${renderComboLabelHtml(team.myHeroIds, team.myPet, team.myHeroNames)}</div>
        <div class="muted ga-team-meta">${minWinRate}%+ wins: ${team.highWinCount ?? 0} · avg ${escapeHtml(formatPct(team.avgWinRate))}</div>
      </div>`;
}

function renderGrandArenaSelections(stats = {}) {
    const minWinRate = stats.minWinRate ?? 90;
    const selections = stats.grandArenaSelections || [];
    const totalFound = stats.grandArenaSelectionCount ?? selections.length;
    const shownCount = stats.grandArenaShownCount ?? selections.length;
    const poolSize = stats.comboPoolSize ?? 0;
    const myHeroFilterNote = (stats.grandArenaRequiredHeroes || []).length
        ? 'With your hero filter on, each selected hero must appear on exactly one of the 3 teams below.'
        : '';

    const rows = selections.map((selection, index) => {
        const [team1, team2, team3] = selection.teams;
        return `
        <tr>
            <td>${index + 1}</td>
            <td>${renderGrandArenaTeamCell(team1, minWinRate)}</td>
            <td>${renderGrandArenaTeamCell(team2, minWinRate)}</td>
            <td>${renderGrandArenaTeamCell(team3, minWinRate)}</td>
            <td class="win good">${selection.totalHighWinCount}</td>
            <td>${selection.minHighWinCount}</td>
        </tr>`;
    }).join('');

    return `
  <section class="section" id="recommendations">
    <div class="section-head">
      <h2>Grand Arena — suggested defense</h2>
      <p class="section-lead">
        Three teams built from your best counters. Each hero is used once across all teams (15 heroes total); pets can repeat.
        ${totalFound ? `Found ${totalFound} valid lineup${totalFound === 1 ? '' : 's'} from ${poolSize} strong teams${shownCount < totalFound ? ` — top ${shownCount} shown` : ''}.` : ''}
        ${myHeroFilterNote ? `${myHeroFilterNote}` : ''}
      </p>
    </div>
    <div class="stats-panel card ga-panel">
      <div class="table-wrap ga-table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Defense team 1</th>
              <th>Defense team 2</th>
              <th>Defense team 3</th>
              <th>Combined ${minWinRate}%+ wins</th>
              <th>Lowest team score</th>
            </tr>
          </thead>
          <tbody>
            ${rows || `<tr><td colspan="6" class="muted">Not enough ${minWinRate}%+ teams yet — need 15 different heroes across 3 five-hero lineups.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  </section>`;
}

export function renderTrainingResultsPage(results, summary = {}, paging = {}) {
    const total = paging.total ?? results.length;
    const offset = paging.offset ?? 0;
    const pageSize = paging.pageSize ?? results.length;
    const minWinRate = paging.stats?.minWinRate ?? 90;
    const shownFrom = total === 0 ? 0 : offset + 1;
    const shownTo = Math.min(offset + results.length, total);
    const nextOffset = offset + results.length;
    const hasMore = nextOffset < total;

    const queryBase = buildTrainingQueryBase(paging);
    const allLink = `/?${queryBase}limit=0`;
    const nextLink = `/?${queryBase}offset=${nextOffset}&limit=${pageSize}`;

    const rows = results.map((row) => {
        const opponentLabel = row.opponentPlayer || 'Unknown';
        const source = row.opponentPlace ? `#${row.opponentPlace}` : '—';
        const testerLabel = formatTesterLabel(row);
        return `
        <tr>
            <td class="muted">${escapeHtml(source)}</td>
            <td>${renderComboLabelHtml(row.opponentCombo.heroIds, row.opponentCombo.pet, row.opponentCombo.heroNames)}</td>
            <td class="muted">${escapeHtml(opponentLabel)}</td>
            <td class="muted">${escapeHtml(testerLabel)}</td>
            <td>${renderComboLabelHtml(row.myCombo.heroIds, row.myCombo.pet, row.myCombo.heroNames)}</td>
            <td>${renderWinRateCell(row.winRate, minWinRate)}</td>
            <td class="muted">${escapeHtml(formatRecord(row.wins, row.losses))}</td>
            <td class="muted">${escapeHtml(formatWhen(row.testedAt))}</td>
        </tr>`;
    }).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Arena Training Results</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: system-ui, sans-serif;
      margin: 0;
      background: #0f1419;
      color: #e7ecf3;
      line-height: 1.5;
    }
    .page {
      max-width: 1200px;
      margin: 0 auto;
      padding: 24px 20px 48px;
    }
    .page-header { margin-bottom: 20px; }
    h1 { margin: 0 0 6px; font-size: 1.6rem; }
    .subtitle { margin: 0; color: #9fb3d1; font-size: 0.95rem; max-width: 52rem; }
    .meta { color: #8b9bb4; margin: 8px 0 0; font-size: 0.85rem; }
    .meta-label { color: #9fb3d1; }
    .threshold-note { margin-top: 4px; }
    .card {
      border: 1px solid #243044;
      border-radius: 10px;
      background: #151d28;
    }
    .intro { padding: 18px 20px; margin-bottom: 16px; }
    .intro h2 { margin: 0 0 8px; font-size: 1.05rem; }
    .intro-lead { margin: 0 0 12px; color: #c8d4e8; }
    .intro-steps { margin: 0; padding-left: 1.25rem; color: #b8c5da; }
    .intro-steps li + li { margin-top: 6px; }
    .page-footer {
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid #243044;
      font-size: 0.75rem;
      color: #8b9bb4;
      line-height: 1.6;
    }
    .footer-stats {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 16px;
      margin-bottom: 6px;
    }
    .footer-stat strong { color: #9fb3d1; font-weight: 600; }
    .footer-stat-highlight strong { color: #9fc5ff; }
    .footer-meta { margin: 4px 0 0; font-size: 0.72rem; }
    .footer-meta .meta-label { color: #7a8fa8; }
    .page-nav {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 16px 0 20px;
      padding: 10px 12px;
      border: 1px solid #243044;
      border-radius: 999px;
      background: #121820;
      position: sticky;
      top: 8px;
      z-index: 2;
    }
    .page-nav a {
      color: #c8d4e8;
      text-decoration: none;
      padding: 6px 12px;
      border-radius: 999px;
      font-size: 0.85rem;
    }
    .page-nav a:hover { background: #243044; color: #fff; }
    .page-nav-label { color: #7a8fa8; font-size: 0.8rem; padding: 6px 4px 6px 8px; }
    .section { margin-bottom: 28px; scroll-margin-top: 72px; }
    .section-head { margin-bottom: 12px; }
    .section-head h2 { margin: 0 0 4px; font-size: 1.15rem; }
    .section-lead { margin: 0; color: #9fb3d1; font-size: 0.9rem; max-width: 52rem; }
    .dev-links { margin-top: 12px; font-size: 0.85rem; color: #8b9bb4; }
    .dev-links summary { cursor: pointer; color: #9fb3d1; }
    .toolbar { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin-bottom: 12px; }
    .toolbar a, .toolbar button {
      color: #e7ecf3; background: #1a2433; border: 1px solid #2f3f57; border-radius: 6px;
      padding: 8px 12px; font-size: 0.9rem; text-decoration: none; cursor: pointer;
    }
    .toolbar a:hover, .toolbar button:hover { background: #243044; }
    .filters {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;
      padding: 16px;
    }
    .filter-help em { color: #9fb3d1; font-style: normal; font-weight: 600; }
    .filter-group { display: flex; flex-direction: column; gap: 8px; }
    .filter-title { font-size: 0.95rem; font-weight: 600; color: #e7ecf3; }
    .filter-help { margin: 0; font-size: 0.82rem; }
    .filter-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .tester-select {
      min-width: 280px;
      flex: 1;
      min-height: 40px;
      color: #e7ecf3;
      background: #1a2433;
      border: 1px solid #2f3f57;
      border-radius: 6px;
      padding: 8px 10px;
      font-size: 0.9rem;
    }
    .tester-select:hover, .tester-select:focus {
      background: #243044;
      border-color: #3a5a8a;
      outline: none;
    }
    .filter-group-tester {
      grid-column: 1 / -1;
      padding-bottom: 12px;
      border-bottom: 1px solid #243044;
      margin-bottom: 4px;
    }
    .filter-picker {
      position: relative;
      min-width: 240px;
      flex: 1;
    }
    .filter-picker-trigger {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      min-height: 40px;
      color: #e7ecf3;
      background: #1a2433;
      border: 1px solid #2f3f57;
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 0.9rem;
      cursor: pointer;
      text-align: left;
    }
    .filter-picker-trigger:hover,
    .filter-picker.open .filter-picker-trigger {
      background: #243044;
      border-color: #3a5a8a;
    }
    .filter-picker-placeholder,
    .filter-picker-value { color: #e7ecf3; flex: 1; }
    .filter-picker-placeholder { color: #8b9bb4; }
    .filter-picker-caret { color: #9fb3d1; font-size: 0.75rem; margin-left: auto; }
    .filter-picker-menu {
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      right: 0;
      z-index: 30;
      max-height: 320px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      background: #151d28;
      border: 1px solid #3a5a8a;
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
      padding: 6px;
    }
    .filter-picker-menu[hidden] { display: none; }
    .filter-picker-search-wrap {
      padding: 4px 4px 8px;
      border-bottom: 1px solid #243044;
      margin-bottom: 4px;
    }
    .filter-picker-search {
      width: 100%;
      box-sizing: border-box;
      color: #e7ecf3;
      background: #1a2433;
      border: 1px solid #2f3f57;
      border-radius: 6px;
      padding: 8px 10px;
      font-size: 0.9rem;
    }
    .filter-picker-search:focus {
      outline: none;
      border-color: #3a5a8a;
      box-shadow: 0 0 0 2px rgba(58, 90, 138, 0.35);
    }
    .filter-picker-options {
      overflow: auto;
      max-height: 240px;
      padding-right: 2px;
    }
    .filter-picker-empty {
      padding: 12px 8px;
      font-size: 0.85rem;
      text-align: center;
    }
    .filter-picker-option[hidden],
    .filter-picker-group-label[hidden] {
      display: none;
    }
    .filter-picker-group-label {
      padding: 6px 8px 4px;
      font-size: 0.72rem;
      font-weight: 600;
      color: #9fb3d1;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .filter-picker-option {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      padding: 6px 8px;
      border: none;
      border-radius: 6px;
      background: transparent;
      color: #e7ecf3;
      font-size: 0.9rem;
      text-align: left;
      cursor: pointer;
    }
    .filter-picker-option:hover,
    .filter-picker-option:focus {
      background: #243044;
      outline: none;
    }
    .filter-picker-icon {
      width: 24px;
      height: 24px;
      border-radius: 4px;
      flex-shrink: 0;
    }
    .filter-picker-icon-fallback {
      display: inline-block;
      width: 24px;
      height: 24px;
      background: #243044;
      border-radius: 4px;
    }
    .filter-picker-trigger .filter-picker-icon {
      width: 28px;
      height: 28px;
    }
    .filter-row button {
      color: #e7ecf3; background: #243044; border: 1px solid #3a4f6d; border-radius: 6px;
      padding: 8px 12px; font-size: 0.9rem; cursor: pointer;
    }
    .filter-row button.ghost { background: transparent; border-color: #2f3f57; }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; min-height: 28px; align-items: center; }
    .chip {
      display: inline-flex; align-items: center; gap: 6px; color: #e7ecf3; background: #243044;
      border: 1px solid #3a4f6d; border-radius: 999px; padding: 4px 10px; font-size: 0.85rem; cursor: pointer;
    }
    .chip:hover { background: #2f3f57; }
    .chip-x { color: #9fb3d1; font-weight: 700; }
    .filter-active {
      grid-column: 1 / -1;
      padding: 10px 12px;
      border-radius: 8px;
      background: #1a2a40;
      border: 1px solid #3a5a8a;
      color: #9fc5ff;
      font-size: 0.85rem;
    }
    .stats-grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px;
    }
    .stats-panel { padding: 16px; }
    .stats-panel h3 { margin: 0 0 4px; font-size: 1rem; color: #e7ecf3; }
    .stats-note { margin: 0 0 12px; font-size: 0.85rem; }
    .stats-table-wrap { max-height: 360px; }
    .ga-table-wrap { max-height: 480px; }
    .ga-team { display: flex; flex-direction: column; gap: 4px; }
    .ga-team-meta { font-size: 0.8rem; }
    .table-wrap {
      overflow: auto;
      border: 1px solid #243044;
      border-radius: 8px;
    }
    #results .table-wrap { max-height: calc(100vh - 120px); }
    table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
    th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #243044; vertical-align: top; }
    th { color: #9fb3d1; font-weight: 600; position: sticky; top: 0; background: #151d28; z-index: 1; }
    tr:hover td { background: #1a2433; }
    .muted { color: #8b9bb4; font-size: 0.85rem; }
    .win { font-weight: 600; }
    .good { color: #6ee7a0; }
    .mid { color: #f6d365; }
    .bad { color: #f87171; }
    .badge {
      display: inline-block;
      margin-left: 6px;
      padding: 1px 7px;
      border-radius: 999px;
      font-size: 0.72rem;
      font-weight: 600;
      vertical-align: middle;
    }
    .badge.solved { background: #1a3d2e; color: #6ee7a0; border: 1px solid #2d6a4f; }
    a { color: #7cb8ff; }
    .status { color: #9fb3d1; font-size: 0.9rem; }
    ${HERO_ICON_TOOLTIP_CSS}
  </style>
</head>
<body>
  <div class="page">
    <header class="page-header">
      <h1>Arena Training Results</h1>
      <p class="subtitle">Saved practice-battle results from Hero Wars Helper. Find strong counters, plan Grand Arena defense, or look up any matchup.</p>
      ${renderDevLinks()}
    </header>

    ${renderPageIntro(minWinRate)}
    ${renderPageNav()}

    ${renderHeroFilters(paging)}
    ${renderTrainingStats(paging.stats)}
    ${renderGrandArenaSelections(paging.stats)}

    <section class="section" id="results">
      <div class="section-head">
        <h2>Full test log</h2>
        <p class="section-lead">Every saved simulation — one row per opponent and the team you tested against them. Newest first.</p>
      </div>
      <div class="toolbar">
        <span class="status">Rows ${shownFrom}–${shownTo} of ${total}</span>
        ${pageSize > 0 && offset + pageSize < total ? `<a href="${allLink}">Show all</a>` : ''}
        ${hasMore ? `<a href="${nextLink}">Load ${Math.min(pageSize, total - nextOffset)} more</a>` : ''}
        ${offset > 0 ? `<a href="/?${queryBase}limit=${pageSize}">Back to start</a>` : ''}
      </div>
      <div class="table-wrap card">
        <table>
          <thead>
            <tr>
              <th>List #</th>
              <th>Opponent team</th>
              <th>Label</th>
              <th>Tester</th>
              <th>Your team</th>
              <th>Win rate</th>
              <th>Sim record</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="8" class="muted">Nothing here yet — run Arena Training in HWH to start collecting results.</td></tr>'}
          </tbody>
        </table>
      </div>
      ${hasMore ? `<p class="meta" style="margin-top:12px"><a href="${nextLink}">Load more results</a> · <a href="${allLink}">Show all ${total}</a></p>` : ''}
    </section>

    ${renderSummaryFooter(summary, paging)}
  </div>
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
    function applyTesterFilter(value) {
      const url = currentParams();
      if (value) {
        url.searchParams.set('tester', value);
      } else {
        url.searchParams.delete('tester');
        url.searchParams.delete('testerUserId');
      }
      url.searchParams.delete('offset');
      window.location.href = url.toString();
    }
    function closeAllFilterPickers() {
      document.querySelectorAll('.filter-picker.open').forEach((picker) => {
        picker.classList.remove('open');
        const menu = picker.querySelector('.filter-picker-menu');
        const trigger = picker.querySelector('.filter-picker-trigger');
        const search = picker.querySelector('.filter-picker-search');
        if (menu) menu.hidden = true;
        if (trigger) trigger.setAttribute('aria-expanded', 'false');
        if (search) search.value = '';
        filterPickerByText(picker, '');
      });
    }
    function filterPickerByText(picker, query) {
      const normalized = String(query || '').trim().toLowerCase();
      const options = picker.querySelectorAll('.filter-picker-option');
      const groups = picker.querySelectorAll('.filter-picker-group-label');
      let visibleCount = 0;

      options.forEach((option) => {
        const searchText = option.dataset.search || option.textContent.toLowerCase();
        const match = !normalized || searchText.includes(normalized);
        option.hidden = !match;
        if (match) visibleCount += 1;
      });

      groups.forEach((label) => {
        let node = label.nextElementSibling;
        let groupVisible = false;
        while (node && !node.classList.contains('filter-picker-group-label')) {
          if (node.classList.contains('filter-picker-option') && !node.hidden) {
            groupVisible = true;
            break;
          }
          node = node.nextElementSibling;
        }
        label.hidden = !groupVisible;
      });

      const empty = picker.querySelector('.filter-picker-empty');
      if (empty) empty.hidden = visibleCount > 0;
      return visibleCount;
    }
    function visibleFilterPickerOptions(picker) {
      return [...picker.querySelectorAll('.filter-picker-option')].filter((option) => !option.hidden);
    }
    function openFilterPicker(picker) {
      const menu = picker.querySelector('.filter-picker-menu');
      const trigger = picker.querySelector('.filter-picker-trigger');
      const search = picker.querySelector('.filter-picker-search');
      picker.classList.add('open');
      if (menu) menu.hidden = false;
      if (trigger) trigger.setAttribute('aria-expanded', 'true');
      if (search) {
        search.value = '';
        filterPickerByText(picker, '');
        setTimeout(() => search.focus(), 0);
      }
    }
    function pickFilterOptionFromSearch(picker, side) {
      const search = picker.querySelector('.filter-picker-search');
      const query = search ? search.value.trim().toLowerCase() : '';
      const visible = visibleFilterPickerOptions(picker);
      if (!visible.length) return false;

      let match = visible.find((option) => option.dataset.search === query);
      if (!match && visible.length === 1) {
        match = visible[0];
      }
      if (!match) {
        match = visible.find((option) => option.dataset.search.startsWith(query));
      }
      if (!match) return false;

      setFilterPickerSelection(picker, match);
      closeAllFilterPickers();
      addHeroFilter(side);
      return true;
    }
    function setFilterPickerSelection(picker, optionButton) {
      const hidden = picker.querySelector('input[type="hidden"]');
      const trigger = picker.querySelector('.filter-picker-trigger');
      if (!hidden || !trigger || !optionButton) return;
      hidden.value = optionButton.dataset.id || '';
      const icon = optionButton.querySelector('.filter-picker-icon');
      const label = optionButton.querySelector('span:last-child');
      trigger.innerHTML = '';
      if (icon) {
        trigger.appendChild(icon.cloneNode(true));
      }
      const valueSpan = document.createElement('span');
      valueSpan.className = 'filter-picker-value';
      valueSpan.textContent = label ? label.textContent : '';
      trigger.appendChild(valueSpan);
      const caret = document.createElement('span');
      caret.className = 'filter-picker-caret';
      caret.setAttribute('aria-hidden', 'true');
      caret.textContent = '▾';
      trigger.appendChild(caret);
    }
    function initFilterPickers() {
      document.querySelectorAll('.filter-picker').forEach((picker) => {
        const trigger = picker.querySelector('.filter-picker-trigger');
        const menu = picker.querySelector('.filter-picker-menu');
        const side = picker.dataset.side;
        if (!trigger || !menu) return;

        trigger.addEventListener('click', (event) => {
          event.stopPropagation();
          const isOpen = picker.classList.contains('open');
          closeAllFilterPickers();
          if (!isOpen) {
            openFilterPicker(picker);
          }
        });

        if (menu) {
          menu.addEventListener('click', (event) => event.stopPropagation());
        }

        const search = picker.querySelector('.filter-picker-search');
        if (search) {
          search.addEventListener('input', () => filterPickerByText(picker, search.value));
          search.addEventListener('keydown', (event) => {
            event.stopPropagation();
            if (event.key === 'Enter') {
              event.preventDefault();
              if (!pickFilterOptionFromSearch(picker, side)) {
                const first = visibleFilterPickerOptions(picker)[0];
                if (first) {
                  setFilterPickerSelection(picker, first);
                  closeAllFilterPickers();
                  addHeroFilter(side);
                }
              }
            } else if (event.key === 'Escape') {
              closeAllFilterPickers();
            } else if (event.key === 'ArrowDown') {
              event.preventDefault();
              const first = visibleFilterPickerOptions(picker)[0];
              if (first) first.focus();
            }
          });
        }

        menu.querySelectorAll('.filter-picker-option').forEach((option) => {
          option.addEventListener('click', (event) => {
            event.stopPropagation();
            setFilterPickerSelection(picker, option);
            closeAllFilterPickers();
          });
        });

        trigger.addEventListener('keydown', (event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            addHeroFilter(side);
          } else if (event.key === 'Escape') {
            closeAllFilterPickers();
          } else if (event.key === 'ArrowDown' || event.key === ' ') {
            event.preventDefault();
            closeAllFilterPickers();
            openFilterPicker(picker);
            const firstOption = visibleFilterPickerOptions(picker)[0];
            if (firstOption) firstOption.focus();
          }
        });
      });

      document.addEventListener('click', closeAllFilterPickers);
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closeAllFilterPickers();
      });
    }
    initFilterPickers();
    const testerSelect = document.getElementById('tester-select');
    if (testerSelect) {
      testerSelect.addEventListener('change', () => applyTesterFilter(testerSelect.value));
    }
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
            ? team.heroNames
            : (team.heroIds || []).map((id) => resolveHeroName(id));
        const petLabel = team.petName || (team.pet ? resolveHeroName(team.pet) : '—');
        return `
        <tr>
            <td>${escapeHtml(team.rowRank ?? '—')}</td>
            <td class="pop">${escapeHtml(team.popularityCount ?? '—')}</td>
            <td>${renderHeroListHtml(team.heroIds, heroLabel)}</td>
            <td class="muted">${team.pet ? renderUnitNameHtml(team.pet, petLabel) : escapeHtml(petLabel)}</td>
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
    ${HERO_ICON_TOOLTIP_CSS}
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
        testerUserId: row.tester_user_id != null ? String(row.tester_user_id) : null,
        testerName: row.tester_name || null,
        maxUpgrade: row.max_upgrade !== false,
    };
}

function sanitizeHeroNames(names) {
    if (!Array.isArray(names)) return null;
    const cleaned = names.map((n) => (
        n && !String(n).startsWith('Hero ') ? n : null
    ));
    return cleaned.some(Boolean) ? cleaned : null;
}
