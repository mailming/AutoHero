import { formatCombo, HERO_NAMES, PET_NAMES, resolveHeroName } from './hero-names.mjs';
import {
    BANNER_EFFECTS,
    BANNER_NAMES,
    PATTERN_COLORS,
    PATTERN_TYPES,
    decodePatternId,
    resolveBannerEffect,
    resolveBannerLabel,
    resolvePatternShortLabel,
} from './banner-names.mjs';
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
    const sort = paging.sort || 'when';
    const order = paging.order || 'desc';
    parts.push(`sort=${encodeURIComponent(sort)}`);
    parts.push(`order=${encodeURIComponent(order)}`);
    return parts.length ? `${parts.join('&')}&` : '';
}

const TRAINING_SORT_LABELS = {
    list: 'arena list rank',
    opponent: 'defend team',
    label: 'label',
    tester: 'tester',
    team: 'attack team',
    winRate: 'win rate',
    record: 'sim record',
    when: 'date tested',
};

function buildSortLink(columnKey, paging) {
    const currentSort = paging.sort || 'when';
    const currentOrder = paging.order || 'desc';
    const nextOrder = currentSort === columnKey && currentOrder === 'desc' ? 'asc' : 'desc';
    const queryBase = buildTrainingQueryBase({ ...paging, sort: columnKey, order: nextOrder });
    return `/?${queryBase}`;
}

function renderSortableTh(label, columnKey, paging, className = '') {
    const currentSort = paging.sort || 'when';
    const currentOrder = paging.order || 'desc';
    const isActive = currentSort === columnKey;
    const indicator = isActive ? (currentOrder === 'asc' ? ' ▲' : ' ▼') : '';
    const ariaSort = isActive ? (currentOrder === 'asc' ? 'ascending' : 'descending') : 'none';
    const cls = className ? ` class="${escapeHtml(className)}"` : '';
    return `<th${cls} aria-sort="${ariaSort}"><a class="sort-link" href="${buildSortLink(columnKey, paging)}">${escapeHtml(label)}${indicator}</a></th>`;
}

function renderTestLogLead(paging = {}) {
    const sort = paging.sort || 'when';
    const order = paging.order || 'desc';
    if (sort === 'when' && order === 'desc') {
        return 'Attack next to defend. Click a team to filter; click headers to sort.';
    }
    const label = TRAINING_SORT_LABELS[sort] || sort;
    const direction = order === 'asc' ? 'asc' : 'desc';
    return `Sorted by ${label} (${direction}). Click a team to filter.`;
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
        <div class="filter-title">Tester</div>
        <p class="filter-help muted"><strong>maxHeros</strong> = max sims · name = real team</p>
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

/** Collect hero + pet ids for team filter chips. */
function collectTeamFilterIds(heroIds, pet) {
    const ids = (Array.isArray(heroIds) ? heroIds : [])
        .map(Number)
        .filter((id) => Number.isFinite(id) && id > 0);
    const petId = Number(pet);
    if (Number.isFinite(petId) && petId > 0) {
        ids.push(petId);
    }
    return [...new Set(ids)];
}

function renderClickableTeamFilter(side, heroIds, pet, heroNamesOverride = null) {
    const filterIds = collectTeamFilterIds(heroIds, pet);
    const comboHtml = renderComboLabelHtml(heroIds, pet, heroNamesOverride);
    if (!filterIds.length) {
        return comboHtml;
    }
    const label = side === 'my' ? 'your counter team' : 'opponent team';
    return `<button type="button" class="team-filter-btn" data-side="${side}" data-ids="${filterIds.join(',')}" title="Filter to this ${label}" onclick="applyTeamFilter(this)">${comboHtml}</button>`;
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
            <span class="filter-picker-placeholder">Add hero or pet…</span>
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
      <h2>Filters</h2>
      <p class="section-lead">Must include <em>all</em> selected units. Click any team below to set a filter.</p>
    </div>
    <div class="filters card">
      ${renderTesterFilter(paging, testers)}
      <div class="filter-group">
        <div class="filter-title">Opponent includes</div>
        <div class="chips" id="opponent-chips">
          ${renderHeroFilterChips('opponent', opponentHeroIds) || '<span class="muted">Any</span>'}
        </div>
        <div class="filter-row">
          ${renderHeroFilterSelect('opponent', opponentHeroIds)}
          <button type="button" onclick="addHeroFilter('opponent')">Add</button>
          ${opponentHeroIds.length ? `<button type="button" class="ghost" onclick="clearHeroFilter('opponent')">Clear</button>` : ''}
        </div>
      </div>
      <div class="filter-group">
        <div class="filter-title">Your counter includes</div>
        <div class="chips" id="my-chips">
          ${renderHeroFilterChips('my', myHeroIds) || '<span class="muted">Any</span>'}
        </div>
        <div class="filter-row">
          ${renderHeroFilterSelect('my', myHeroIds)}
          <button type="button" onclick="addHeroFilter('my')">Add</button>
          ${myHeroIds.length ? `<button type="button" class="ghost" onclick="clearHeroFilter('my')">Clear</button>` : ''}
        </div>
      </div>
      ${hasFilters ? '<div class="filter-active">Filters active</div>' : ''}
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
        ? `<span class="badge solved">${escapeHtml(String(minWinRate))}%+</span>`
        : '';
    return `<span class="win ${cls}">${escapeHtml(formatPct(winRate))}</span>${solved}`;
}

/** Gold SimLab: defense tested with full pet favors + flag + slots. Badge at ≥95%. */
const GOLD_SIMLAB_WIN_RATE = 95;
const GOLD_SIMLAB_MIN_SLOTS = 3;
const GOLD_SIMLAB_MIN_FAVORS = 5;

function countFilledBannerSlots(stones) {
    if (!stones || typeof stones !== 'object') return 0;
    return Object.entries(stones)
        .filter(([, value]) => value != null && value !== '')
        .length;
}

export function isGoldSimLabDefense(round = {}) {
    const heroIds = Array.isArray(round.opponentHeroIds)
        ? round.opponentHeroIds.map(Number).filter((id) => id > 0 && id < 6000)
        : [];
    const favorNeed = heroIds.length || GOLD_SIMLAB_MIN_FAVORS;
    const favorCount = formatFavorEntries(round.opponentFavor).length;
    const banner = round.opponentBanner;
    const hasFlag = banner != null && banner !== '' && Number(banner) > 0;
    const slotCount = countFilledBannerSlots(round.opponentBannerStones);
    return hasFlag && slotCount >= GOLD_SIMLAB_MIN_SLOTS && favorCount >= favorNeed;
}

export function isGoldSimLabBadge(round = {}, goldWinRate = GOLD_SIMLAB_WIN_RATE) {
    const winRate = round.winRate != null ? Number(round.winRate) : null;
    return isGoldSimLabDefense(round)
        && winRate != null
        && Number.isFinite(winRate)
        && winRate >= goldWinRate;
}

function renderGoldSimLabBadge() {
    return `<span class="badge gold" title="Gold SimLab · full defense favor / flag / slots · ≥${GOLD_SIMLAB_WIN_RATE}%">Gold</span>`;
}

function renderSimLabWinRateCell(round, minWinRate = 90) {
    const winRate = round?.winRate;
    const cls = winRateClass(winRate, minWinRate);
    if (isGoldSimLabBadge(round)) {
        return `<span class="win ${cls}">${escapeHtml(formatPct(winRate))}</span>${renderGoldSimLabBadge()}`;
    }
    const solved = winRate != null && winRate >= minWinRate
        ? `<span class="badge solved">${escapeHtml(String(minWinRate))}%+</span>`
        : '';
    return `<span class="win ${cls}">${escapeHtml(formatPct(winRate))}</span>${solved}`;
}

function renderPageIntro(minWinRate = 90) {
    return `
  <section class="intro card">
    <p class="intro-lead">
      Practice battles from HWH Arena Training (no attempts spent). Goal: <strong>${minWinRate}%+</strong> win rate.
      Live pet/flag sims → <a href="/training/simlab-view">SimLab</a>.
    </p>
  </section>`;
}

function renderPageNav() {
    return `
  <nav class="page-nav" aria-label="Page sections">
    <a href="/training/simlab-view">SimLab</a>
    <a href="#filters">Filters</a>
    <a href="#insights">Counters</a>
    <a href="#recommendations">Grand Arena</a>
    <a href="#results">Log</a>
  </nav>`;
}

function formatFlagLabel(bannerId) {
    return resolveBannerLabel(bannerId);
}

function formatFlagTitle(bannerId) {
    const effect = resolveBannerEffect(bannerId);
    const label = resolveBannerLabel(bannerId);
    return effect ? `${label} — ${effect}` : label;
}

function formatPetLabel(petId) {
    if (petId == null || petId === '') return 'No pet';
    return resolveHeroName(petId);
}

function formatBannerStonesLabel(stones) {
    if (!stones || typeof stones !== 'object') return '';
    const entries = Object.entries(stones)
        .filter(([, value]) => value != null && value !== '')
        .sort((a, b) => Number(a[0]) - Number(b[0]));
    if (!entries.length) return '';
    return entries
        .map(([slot, id]) => `S${slot}: ${resolvePatternShortLabel(id)}`)
        .join(' · ');
}

function formatPatternCompactLabel(patternId) {
    const decoded = decodePatternId(patternId);
    if (!decoded) {
        return patternId == null || patternId === '' ? '—' : `#${patternId}`;
    }
    return `${decoded.type} ${decoded.color}`;
}

function formatBannerStonesHtml(stones) {
    if (!stones || typeof stones !== 'object') return '';
    const entries = Object.entries(stones)
        .filter(([, value]) => value != null && value !== '')
        .sort((a, b) => Number(a[0]) - Number(b[0]));
    if (!entries.length) return '';
    return entries.map(([slot, id]) => {
        const label = formatPatternCompactLabel(id);
        const title = resolvePatternShortLabel(id);
        return `<div class="sim-slot-line" title="${escapeHtml(title)}"><span class="sim-chip-k">S${escapeHtml(String(slot))}</span> ${escapeHtml(label)}</div>`;
    }).join('');
}

function formatFavorEntries(favor) {
    if (!favor || typeof favor !== 'object') return [];
    return Object.entries(favor)
        .filter(([, value]) => value != null && Number(value) > 0)
        .map(([heroId, petId]) => {
            const hero = Number(heroId);
            const pet = Number(petId);
            return {
                heroId: hero,
                petId: pet,
                heroName: resolveHeroName(hero),
                petName: resolveHeroName(pet),
            };
        })
        .sort((a, b) => a.heroName.localeCompare(b.heroName));
}

function formatFavorLabel(favor) {
    const entries = formatFavorEntries(favor);
    return entries.map((entry) => `${entry.heroName} → ${entry.petName}`).join(', ');
}

function formatFavorHtml(favor) {
    const entries = formatFavorEntries(favor);
    if (!entries.length) {
        return '<span class="muted">—</span>';
    }
    return entries.map((entry) => (
        `<span class="favor-pair" title="${escapeHtml(`${entry.heroName} → ${entry.petName}`)}">`
        + `${renderUnitNameHtml(entry.heroId, entry.heroName)}`
        + `<span class="favor-arrow">→</span>`
        + `${renderUnitNameHtml(entry.petId, entry.petName)}`
        + `</span>`
    )).join('');
}

function renderSimLabLegend() {
    const flagRows = Object.keys(BANNER_NAMES)
        .map(Number)
        .sort((a, b) => a - b)
        .map((id) => `
          <tr>
            <td class="num mono">${escapeHtml(String(id))}</td>
            <td>${escapeHtml(BANNER_NAMES[id])}</td>
            <td class="muted">${escapeHtml(BANNER_EFFECTS[id] || '')}</td>
          </tr>`)
        .join('');
    const typeRows = PATTERN_TYPES.map((name, index) => {
        const from = index * 12 + 1;
        const to = from + 11;
        return `
          <tr>
            <td class="num mono">${from}–${to}</td>
            <td>${escapeHtml(name)}</td>
          </tr>`;
    }).join('');
    const petRows = Object.keys(PET_NAMES)
        .map(Number)
        .sort((a, b) => a - b)
        .map((id) => `
          <tr>
            <td class="num mono">${escapeHtml(String(id))}</td>
            <td>${renderUnitNameHtml(id, PET_NAMES[id])}</td>
          </tr>`)
        .join('');

    // Collapsed by default so the log stays first (Training puts reference tables after results).
    return `
  <section class="section" id="legend">
    <details class="sim-legend-details card">
      <summary>
        <span class="sim-legend-summary-title">Legends</span>
        <span class="muted">Pet favor · war flags · flag slots</span>
      </summary>
      <div class="sim-legend">
        <div class="sim-legend-grid">
          <div class="sim-legend-panel">
            <h3>Pet favor</h3>
            <p class="muted stats-note">Hero → Pet = patronage on that hero. Team pet is separate (shown after +).</p>
            <div class="table-wrap legend-table-wrap">
              <table class="data-table">
                <thead><tr><th class="num">ID</th><th>Pet</th></tr></thead>
                <tbody>${petRows}</tbody>
              </table>
            </div>
          </div>
          <div class="sim-legend-panel">
            <h3>War flags</h3>
            <p class="muted stats-note">Flag # on each run. Effects listed here.</p>
            <div class="table-wrap legend-table-wrap">
              <table class="data-table">
                <thead><tr><th class="num">#</th><th>Name</th><th>Effect</th></tr></thead>
                <tbody>${flagRows}</tbody>
              </table>
            </div>
          </div>
          <div class="sim-legend-panel">
            <h3>Flag slots</h3>
            <p class="muted stats-note">S1–S3 patterns. ID = type×12 + rank (White→Red+6).</p>
            <p class="muted stats-note ranks">${escapeHtml(PATTERN_COLORS.join(' · '))}</p>
            <div class="table-wrap legend-table-wrap">
              <table class="data-table">
                <thead><tr><th class="num">IDs</th><th>Type</th></tr></thead>
                <tbody>${typeRows}</tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </details>
  </section>`;
}

function formatSourceLabel(source, label) {
    const raw = String(source || label || '');
    if (/clanDomination|simlab-counter-cd/i.test(raw)) return 'Clan Domination';
    if (/gather|simlab-counter/i.test(raw)) return 'Arena';
    if (raw) return raw;
    return 'SimLab';
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
      <span class="footer-stat"><strong>${summary.opponentComboCount ?? 0}</strong> opponents</span>
      <span class="footer-stat"><strong>${summary.matchupTestCount ?? 0}</strong> tests</span>
      <span class="footer-stat"><strong>${summary.roundCount ?? 0}</strong> runs</span>
      <span class="footer-stat${filteredHighlight}"><strong>${filteredTotal}</strong> shown</span>
    </div>
    <p class="footer-meta"><span class="meta-label">Latest:</span> ${latestLine} · Green = ${minWinRate}%+</p>
  </footer>`;
}

function renderDevLinks() {
    return `
  <details class="dev-links">
    <summary>API &amp; raw data</summary>
    <p class="muted">
      <a href="/training/results?limit=0">All results (JSON)</a> ·
      <a href="/training/summary">Summary (JSON)</a> ·
      <a href="/training/simlab?limit=50">SimLab (JSON)</a> ·
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
            <td class="num">${index + 1}</td>
            <td>${renderClickableTeamFilter('my', row.myHeroIds, row.myPet, row.myHeroNames)}</td>
            <td class="num win good">${escapeHtml(formatPct(row.avgWinRate))}</td>
            <td class="num win">${escapeHtml(formatPct(row.bestWinRate))}</td>
            <td class="num">${row.highWinCount ?? 0}</td>
            <td class="num muted">${row.testCount ?? 0}</td>
        </tr>`;
    }).join('');

    const heroRows = topHeroes.map((row, index) => {
        const label = resolveHeroName(row.heroId);
        const isPet = Number(row.heroId) >= 6000;
        return `
        <tr>
            <td class="num">${index + 1}</td>
            <td>${renderUnitNameHtml(row.heroId, label)}${isPet ? ' <span class="muted">pet</span>' : ''}</td>
            <td class="num">${row.wins90 ?? 0}</td>
            <td class="num win good">${escapeHtml(formatPct(row.avgWinRate))}</td>
            <td class="num muted">${row.appearances ?? 0}</td>
        </tr>`;
    }).join('');

    return `
  <section class="section" id="insights">
    <div class="section-head">
      <h2>Best counters</h2>
      <p class="section-lead">Top lineups &amp; units at ${minWinRate}%+ vs current filters.</p>
    </div>
    <div class="stats-grid">
      <div class="stats-panel card">
        <div class="panel-head">
          <h3>Top 10 teams</h3>
          <p class="muted stats-note">${minWinRate}%+ frequency</p>
        </div>
        <div class="table-wrap stats-table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th class="num">#</th>
                <th>Your team</th>
                <th class="num">Avg</th>
                <th class="num">Best</th>
                <th class="num">${minWinRate}%+</th>
                <th class="num">Tests</th>
              </tr>
            </thead>
            <tbody>
              ${comboRows || `<tr><td colspan="6" class="muted">No data yet</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
      <div class="stats-panel card">
        <div class="panel-head">
          <h3>Top 10 heroes &amp; pets</h3>
          <p class="muted stats-note">In ${minWinRate}%+ lineups</p>
        </div>
        <div class="table-wrap stats-table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th class="num">#</th>
                <th>Unit</th>
                <th class="num">${minWinRate}%+</th>
                <th class="num">Avg</th>
                <th class="num">Lineups</th>
              </tr>
            </thead>
            <tbody>
              ${heroRows || `<tr><td colspan="5" class="muted">No data yet</td></tr>`}
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
        <div>${renderClickableTeamFilter('my', team.myHeroIds, team.myPet, team.myHeroNames)}</div>
        <div class="muted ga-team-meta"><span class="num">${team.highWinCount ?? 0}</span> @${minWinRate}%+ · avg ${escapeHtml(formatPct(team.avgWinRate))}</div>
      </div>`;
}

function renderGrandArenaSelections(stats = {}) {
    const minWinRate = stats.minWinRate ?? 90;
    const selections = stats.grandArenaSelections || [];
    const totalFound = stats.grandArenaSelectionCount ?? selections.length;
    const shownCount = stats.grandArenaShownCount ?? selections.length;
    const poolSize = stats.comboPoolSize ?? 0;
    const myHeroFilterNote = (stats.grandArenaRequiredHeroes || []).length
        ? ' Filter heroes must land on different teams.'
        : '';

    const rows = selections.map((selection, index) => {
        const [team1, team2, team3] = selection.teams;
        return `
        <tr>
            <td class="num">${index + 1}</td>
            <td>${renderGrandArenaTeamCell(team1, minWinRate)}</td>
            <td>${renderGrandArenaTeamCell(team2, minWinRate)}</td>
            <td>${renderGrandArenaTeamCell(team3, minWinRate)}</td>
            <td class="num win good">${selection.totalHighWinCount}</td>
            <td class="num">${selection.minHighWinCount}</td>
        </tr>`;
    }).join('');

    const status = totalFound
        ? `${totalFound} lineup${totalFound === 1 ? '' : 's'} from top ${poolSize}${shownCount < totalFound ? ` · showing ${shownCount}` : ''}.`
        : '';

    return `
  <section class="section" id="recommendations">
    <div class="section-head">
      <h2>Grand Arena defense</h2>
      <p class="section-lead">
        3 teams · 15 unique heroes · pets may repeat.
        ${status}${myHeroFilterNote}
      </p>
    </div>
    <div class="stats-panel card ga-panel">
      <div class="table-wrap ga-table-wrap">
        <table class="data-table ga-table">
          <thead>
            <tr>
              <th class="num">#</th>
              <th>Team 1</th>
              <th>Team 2</th>
              <th>Team 3</th>
              <th class="num">Σ ${minWinRate}%+</th>
              <th class="num">Min</th>
            </tr>
          </thead>
          <tbody>
            ${rows || `<tr><td colspan="6" class="muted">Need 15 heroes across 3 ${minWinRate}%+ teams</td></tr>`}
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
        const place = row.opponentPlace != null ? `#${row.opponentPlace}` : '';
        const testerLabel = formatTesterLabel(row);
        return `
        <tr>
            <td class="num muted">${escapeHtml(place || '—')}</td>
            <td>
              <div class="matchup-side">
                <span class="matchup-k">ATK</span>
                ${renderClickableTeamFilter('my', row.myCombo.heroIds, row.myCombo.pet, row.myCombo.heroNames)}
              </div>
              <div class="muted matchup-meta">${escapeHtml(testerLabel)}</div>
            </td>
            <td class="matchup-vs muted">vs</td>
            <td>
              <div class="matchup-side">
                <span class="matchup-k">DEF</span>
                ${renderClickableTeamFilter('opponent', row.opponentCombo.heroIds, row.opponentCombo.pet, row.opponentCombo.heroNames)}
              </div>
              <div class="muted matchup-meta">${escapeHtml(opponentLabel)}${place ? ` · ${escapeHtml(place)}` : ''}</div>
            </td>
            <td class="num">${renderWinRateCell(row.winRate, minWinRate)}</td>
            <td class="muted nowrap">${escapeHtml(formatWhen(row.testedAt))}</td>
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
      line-height: 1.45;
    }
    .page {
      max-width: 1440px;
      margin: 0 auto;
      padding: 20px 24px 40px;
    }
    .page-header {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      justify-content: space-between;
      gap: 12px 24px;
      margin-bottom: 12px;
    }
    .page-header-main { min-width: 0; flex: 1; }
    h1 { margin: 0 0 4px; font-size: 1.45rem; letter-spacing: -0.02em; }
    .subtitle { margin: 0; color: #9fb3d1; font-size: 0.88rem; }
    .meta { color: #8b9bb4; margin: 8px 0 0; font-size: 0.85rem; }
    .meta-label { color: #9fb3d1; }
    .card {
      border: 1px solid #243044;
      border-radius: 8px;
      background: #151d28;
    }
    .intro { padding: 10px 14px; margin-bottom: 12px; }
    .intro-lead { margin: 0; color: #c8d4e8; font-size: 0.88rem; }
    .page-footer {
      margin-top: 28px;
      padding-top: 14px;
      border-top: 1px solid #243044;
      font-size: 0.75rem;
      color: #8b9bb4;
      line-height: 1.5;
    }
    .footer-stats {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 18px;
      margin-bottom: 4px;
    }
    .footer-stat strong { color: #9fb3d1; font-weight: 600; }
    .footer-stat-highlight strong { color: #9fc5ff; }
    .footer-meta { margin: 2px 0 0; font-size: 0.72rem; }
    .footer-meta .meta-label { color: #7a8fa8; }
    .page-nav {
      display: inline-flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px;
      padding: 4px;
      border: 1px solid #243044;
      border-radius: 8px;
      background: #121820;
      position: sticky;
      top: 8px;
      z-index: 2;
    }
    .page-nav a {
      color: #c8d4e8;
      text-decoration: none;
      padding: 6px 10px;
      border-radius: 6px;
      font-size: 0.82rem;
      white-space: nowrap;
    }
    .page-nav a:hover { background: #243044; color: #fff; }
    .section { margin-bottom: 22px; scroll-margin-top: 56px; }
    .section-head {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 6px 14px;
      margin-bottom: 10px;
    }
    .section-head h2 { margin: 0; font-size: 1.05rem; }
    .section-lead { margin: 0; color: #9fb3d1; font-size: 0.84rem; }
    .section-lead em { color: #c8d4e8; font-style: normal; font-weight: 600; }
    .dev-links { font-size: 0.8rem; color: #8b9bb4; }
    .dev-links summary { cursor: pointer; color: #9fb3d1; }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 12px;
      align-items: center;
      margin-bottom: 8px;
      min-height: 36px;
    }
    .toolbar a, .toolbar button {
      color: #e7ecf3; background: #1a2433; border: 1px solid #2f3f57; border-radius: 6px;
      padding: 6px 10px; font-size: 0.84rem; text-decoration: none; cursor: pointer;
    }
    .toolbar a:hover, .toolbar button:hover { background: #243044; }
    .filters {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px 20px;
      padding: 14px 16px;
      align-items: start;
    }
    @media (max-width: 820px) {
      .filters { grid-template-columns: 1fr; }
    }
    .filter-help em { color: #9fb3d1; font-style: normal; font-weight: 600; }
    .filter-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 0;
      height: 100%;
    }
    .filter-title { font-size: 0.88rem; font-weight: 600; color: #e7ecf3; line-height: 1.2; }
    .filter-help { margin: 0; font-size: 0.78rem; line-height: 1.35; }
    .filter-group .chips { flex: 1; }
    .filter-row { display: flex; flex-wrap: nowrap; gap: 8px; align-items: center; }
    .tester-select {
      min-width: 0;
      flex: 1;
      min-height: 38px;
      color: #e7ecf3;
      background: #1a2433;
      border: 1px solid #2f3f57;
      border-radius: 6px;
      padding: 7px 10px;
      font-size: 0.88rem;
    }
    .tester-select:hover, .tester-select:focus {
      background: #243044;
      border-color: #3a5a8a;
      outline: none;
    }
    .filter-group-tester {
      grid-column: 1 / -1;
      height: auto;
      padding-bottom: 12px;
      border-bottom: 1px solid #243044;
      margin-bottom: 2px;
    }
    .filter-picker {
      position: relative;
      min-width: 0;
      flex: 1;
    }
    .filter-picker-trigger {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      min-height: 38px;
      color: #e7ecf3;
      background: #1a2433;
      border: 1px solid #2f3f57;
      border-radius: 6px;
      padding: 5px 10px;
      font-size: 0.88rem;
      cursor: pointer;
      text-align: left;
    }
    .filter-picker-trigger:hover,
    .filter-picker.open .filter-picker-trigger {
      background: #243044;
      border-color: #3a5a8a;
    }
    .filter-picker-placeholder,
    .filter-picker-value { color: #e7ecf3; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
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
      font-size: 0.88rem;
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
      font-size: 0.88rem;
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
      width: 26px;
      height: 26px;
    }
    .filter-row button {
      color: #e7ecf3; background: #243044; border: 1px solid #3a4f6d; border-radius: 6px;
      padding: 7px 12px; font-size: 0.84rem; cursor: pointer; flex-shrink: 0; min-height: 38px;
    }
    .filter-row button.ghost { background: transparent; border-color: #2f3f57; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; min-height: 30px; align-items: center; align-content: flex-start; }
    .chip {
      display: inline-flex; align-items: center; gap: 6px; color: #e7ecf3; background: #243044;
      border: 1px solid #3a4f6d; border-radius: 999px; padding: 3px 9px; font-size: 0.82rem; cursor: pointer;
    }
    .chip:hover { background: #2f3f57; }
    .chip-x { color: #9fb3d1; font-weight: 700; }
    .filter-active {
      grid-column: 1 / -1;
      padding: 8px 12px;
      border-radius: 6px;
      background: #1a2a40;
      border: 1px solid #3a5a8a;
      color: #9fc5ff;
      font-size: 0.82rem;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
      align-items: stretch;
    }
    @media (max-width: 980px) {
      .stats-grid { grid-template-columns: 1fr; }
    }
    .stats-panel {
      padding: 12px 12px 10px;
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .panel-head {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      justify-content: space-between;
      gap: 4px 12px;
      margin-bottom: 8px;
    }
    .stats-panel h3 { margin: 0; font-size: 0.95rem; color: #e7ecf3; }
    .stats-note { margin: 0; font-size: 0.78rem; }
    .stats-table-wrap { max-height: 360px; flex: 1; }
    .ga-table-wrap { max-height: 480px; }
    .ga-panel { padding: 12px; }
    .ga-team { display: flex; flex-direction: column; gap: 3px; }
    .ga-team-meta { font-size: 0.76rem; }
    .table-wrap {
      overflow: auto;
      border: 1px solid #243044;
      border-radius: 8px;
    }
    #results .table-wrap { max-height: calc(100vh - 120px); }
    table { width: 100%; border-collapse: collapse; font-size: 0.86rem; }
    th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #243044; vertical-align: middle; }
    th { color: #9fb3d1; font-weight: 600; position: sticky; top: 0; background: #151d28; z-index: 1; white-space: nowrap; }
    th .sort-link { color: inherit; text-decoration: none; display: inline-flex; align-items: center; gap: 2px; }
    th .sort-link:hover { color: #fff; }
    th[aria-sort]:not([aria-sort="none"]) .sort-link { color: #9fc5ff; }
    tr:hover td { background: #1a2433; }
    .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    th.num { text-align: right; }
    .nowrap { white-space: nowrap; }
    .ga-table th:nth-child(2),
    .ga-table th:nth-child(3),
    .ga-table th:nth-child(4),
    .ga-table td:nth-child(2),
    .ga-table td:nth-child(3),
    .ga-table td:nth-child(4) { min-width: 180px; }
    .team-filter-btn {
      display: inline;
      margin: 0;
      padding: 0;
      border: none;
      background: transparent;
      color: inherit;
      font: inherit;
      text-align: left;
      cursor: pointer;
      border-radius: 4px;
    }
    .team-filter-btn:hover .combo-label,
    .team-filter-btn:focus-visible .combo-label {
      color: #9fc5ff;
      text-decoration: underline;
      text-underline-offset: 2px;
    }
    .team-filter-btn:focus-visible {
      outline: 2px solid #3a5a8a;
      outline-offset: 2px;
    }
    .muted { color: #8b9bb4; font-size: 0.82rem; }
    .win { font-weight: 600; }
    .good { color: #6ee7a0; }
    .mid { color: #f6d365; }
    .bad { color: #f87171; }
    .badge {
      display: inline-block;
      margin-left: 6px;
      padding: 1px 6px;
      border-radius: 999px;
      font-size: 0.7rem;
      font-weight: 600;
      vertical-align: middle;
    }
    .badge.solved { background: #1a3d2e; color: #6ee7a0; border: 1px solid #2d6a4f; }
    a { color: #7cb8ff; }
    .status { color: #9fb3d1; font-size: 0.84rem; margin-right: auto; }
    .matchup-log td { vertical-align: top; }
    .matchup-side {
      display: flex; align-items: flex-start; gap: 8px;
    }
    .matchup-k {
      flex: 0 0 auto; margin-top: 2px;
      font-size: 0.68rem; font-weight: 700; letter-spacing: .04em;
      text-transform: uppercase; color: #8b9bb4;
    }
    .matchup-vs {
      width: 2.2rem; text-align: center; color: #8b9bb4;
      font-size: 0.78rem; font-weight: 600; vertical-align: middle !important;
    }
    .matchup-meta { margin-top: 4px; font-size: 0.78rem; }
    ${HERO_ICON_TOOLTIP_CSS}
  </style>
</head>
<body>
  <div class="page">
    <header class="page-header">
      <div class="page-header-main">
        <h1>Arena Training Results</h1>
        <p class="subtitle">Counters, Grand Arena defense, and matchup log from HWH.</p>
      </div>
      ${renderPageNav()}
    </header>

    ${renderPageIntro(minWinRate)}
    ${renderDevLinks()}

    ${renderHeroFilters(paging)}
    ${renderTrainingStats(paging.stats)}
    ${renderGrandArenaSelections(paging.stats)}

    <section class="section" id="results">
      <div class="section-head">
        <h2>Test log</h2>
        <p class="section-lead">${renderTestLogLead(paging)}</p>
      </div>
      <div class="toolbar">
        <span class="status">${shownFrom}–${shownTo} / ${total}</span>
        ${pageSize > 0 && offset + pageSize < total ? `<a href="${allLink}">All</a>` : ''}
        ${hasMore ? `<a href="${nextLink}">+${Math.min(pageSize, total - nextOffset)}</a>` : ''}
        ${offset > 0 ? `<a href="/?${queryBase}limit=${pageSize}">Start</a>` : ''}
      </div>
      <div class="table-wrap card">
        <table class="data-table matchup-log">
          <thead>
            <tr>
              ${renderSortableTh('#', 'list', paging, 'num')}
              ${renderSortableTh('Attack', 'team', paging)}
              <th class="matchup-vs" aria-hidden="true"></th>
              ${renderSortableTh('Defend', 'opponent', paging)}
              ${renderSortableTh('Win %', 'winRate', paging, 'num')}
              ${renderSortableTh('When', 'when', paging)}
            </tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="6" class="muted">No results yet — run Arena Training in HWH</td></tr>'}
          </tbody>
        </table>
      </div>
      ${hasMore ? `<p class="meta"><a href="${nextLink}">More</a> · <a href="${allLink}">All ${total}</a></p>` : ''}
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
    function applyTeamFilter(button) {
      const side = button && button.dataset ? button.dataset.side : '';
      const key = heroFilterKey(side);
      if (!key || (side !== 'opponent' && side !== 'my')) return;
      const ids = String(button.dataset.ids || '')
        .split(',')
        .map(Number)
        .filter((id) => Number.isFinite(id) && id > 0);
      if (!ids.length) return;
      const url = currentParams();
      url.searchParams.delete(key);
      ids.forEach((id) => url.searchParams.append(key, String(id)));
      url.searchParams.delete('offset');
      url.hash = 'filters';
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

function renderSimLabSupportBits({ banner, bannerStones, favor, maxUpgrade, goldDefense = false }) {
    const flagText = formatFlagLabel(banner);
    const flagTitle = formatFlagTitle(banner);
    const stonesHtml = formatBannerStonesHtml(bannerStones);
    const flagMissing = banner == null || banner === '';
    const favorEntries = formatFavorEntries(favor);
    const bits = [];
    if (goldDefense) {
        bits.push('<span class="sim-chip gold-sim" title="Gold SimLab defense · full favor / flag / slots"><span class="sim-chip-k">Gold</span> Sim</span>');
    }
    bits.push(
        `<span class="sim-chip${flagMissing ? ' warn' : ''}" title="${escapeHtml(flagTitle)}"><span class="sim-chip-k">Flag</span> ${escapeHtml(flagText)}</span>`,
    );
    if (stonesHtml) {
        bits.push(`<span class="sim-chip sim-chip-slots"><span class="sim-chip-k">Slots</span> <span class="sim-slots">${stonesHtml}</span></span>`);
    } else {
        bits.push('<span class="sim-chip warn"><span class="sim-chip-k">Slots</span> —</span>');
    }
    if (favorEntries.length) {
        bits.push(`<span class="sim-chip sim-chip-favor"><span class="sim-chip-k">Favor</span> <span class="favor-list">${formatFavorHtml(favor)}</span></span>`);
    } else {
        bits.push('<span class="sim-chip warn"><span class="sim-chip-k">Favor</span> —</span>');
    }
    if (maxUpgrade === true) {
        bits.push('<span class="sim-chip warn"><span class="sim-chip-k">Power</span> max</span>');
    } else if (maxUpgrade === false) {
        bits.push('<span class="sim-chip"><span class="sim-chip-k">Power</span> acct</span>');
    }
    return bits.join('');
}

function renderSimLabFilters(paging = {}) {
    const opponentHeroIds = paging.opponentHeroIds || [];
    const myHeroIds = paging.myHeroIds || [];
    const testers = paging.testers || [];
    const hasFilters = opponentHeroIds.length > 0 || myHeroIds.length > 0 || !!paging.testerUserId;

    return `
  <section class="section" id="filters">
    <div class="section-head">
      <h2>Filters</h2>
      <p class="section-lead">Must include <em>all</em> selected units.</p>
    </div>
    <div class="filters card">
      <div class="filter-group filter-group-tester">
        <div class="filter-title">Tester</div>
        <p class="filter-help muted">Who started the Sim</p>
        <div class="filter-row">
          <select id="tester-select" class="tester-select" aria-label="Filter by SimLab initiator">
            <option value=""${!paging.testerUserId ? ' selected' : ''}>All</option>
            ${testers.map((tester) => {
                const value = String(tester.testerUserId ?? '');
                const label = formatTesterLabel(tester);
                const selectedAttr = String(paging.testerUserId || '') === value ? ' selected' : '';
                return `<option value="${escapeHtml(value)}"${selectedAttr}>${escapeHtml(label)} · ${tester.testCount ?? 0}</option>`;
            }).join('')}
          </select>
          ${paging.testerUserId ? '<button type="button" class="ghost" onclick="applyTesterFilter(\'\')">Clear</button>' : ''}
        </div>
      </div>
      <div class="filter-group">
        <div class="filter-title">Opponent includes</div>
        <div class="chips" id="opponent-chips">
          ${renderHeroFilterChips('opponent', opponentHeroIds) || '<span class="muted">Any</span>'}
        </div>
        <div class="filter-row">
          ${renderHeroFilterSelect('opponent', opponentHeroIds)}
          <button type="button" onclick="addHeroFilter('opponent')">Add</button>
          ${opponentHeroIds.length ? '<button type="button" class="ghost" onclick="clearHeroFilter(\'opponent\')">Clear</button>' : ''}
        </div>
      </div>
      <div class="filter-group">
        <div class="filter-title">Your team includes</div>
        <div class="chips" id="my-chips">
          ${renderHeroFilterChips('my', myHeroIds) || '<span class="muted">Any</span>'}
        </div>
        <div class="filter-row">
          ${renderHeroFilterSelect('my', myHeroIds)}
          <button type="button" onclick="addHeroFilter('my')">Add</button>
          ${myHeroIds.length ? '<button type="button" class="ghost" onclick="clearHeroFilter(\'my\')">Clear</button>' : ''}
        </div>
      </div>
      ${hasFilters ? '<div class="filter-active">Filters active</div>' : ''}
    </div>
  </section>`;
}

function buildSimLabQueryBase(paging = {}) {
    const params = new URLSearchParams();
    if (paging.testerUserId) params.set('tester', paging.testerUserId);
    for (const id of paging.opponentHeroIds || []) params.append('opponentHero', String(id));
    for (const id of paging.myHeroIds || []) params.append('myHero', String(id));
    if (paging.pageSize != null) params.set('limit', String(paging.pageSize));
    if (paging.offset > 0) params.set('offset', String(paging.offset));
    const qs = params.toString();
    return qs ? `${qs}&` : '';
}

function renderSimLabNav(active = 'list') {
    return `
  <nav class="page-nav" aria-label="Related pages">
    <a href="/training/view">Training</a>
    <a href="/training/simlab-view"${active === 'list' ? ' aria-current="page"' : ''}>SimLab</a>
    <a href="#filters">Filters</a>
    <a href="#results">Log</a>
    <a href="/training/meta-view">Meta</a>
  </nav>`;
}

function renderSimLabFilterScript() {
    return `
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
    function applyTeamFilter(button) {
      const side = button && button.dataset ? button.dataset.side : '';
      const key = heroFilterKey(side);
      if (!key || (side !== 'opponent' && side !== 'my')) return;
      const ids = String(button.dataset.ids || '')
        .split(',')
        .map(Number)
        .filter((id) => Number.isFinite(id) && id > 0);
      if (!ids.length) return;
      const url = currentParams();
      url.searchParams.delete(key);
      ids.forEach((id) => url.searchParams.append(key, String(id)));
      url.searchParams.delete('offset');
      url.hash = 'filters';
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
    function setFilterPickerSelection(picker, optionButton) {
      const hidden = picker.querySelector('input[type="hidden"]');
      const trigger = picker.querySelector('.filter-picker-trigger');
      if (!hidden || !trigger || !optionButton) return;
      hidden.value = optionButton.dataset.id || '';
      const icon = optionButton.querySelector('.filter-picker-icon');
      const label = optionButton.querySelector('span:last-child');
      trigger.innerHTML = '';
      if (icon) trigger.appendChild(icon.cloneNode(true));
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
    function pickFilterOptionFromSearch(picker, side) {
      const search = picker.querySelector('.filter-picker-search');
      const query = search ? search.value.trim().toLowerCase() : '';
      const visible = visibleFilterPickerOptions(picker);
      if (!visible.length) return false;
      let match = visible.find((option) => option.dataset.search === query);
      if (!match && visible.length === 1) match = visible[0];
      if (!match) match = visible.find((option) => option.dataset.search.startsWith(query));
      if (!match) return false;
      setFilterPickerSelection(picker, match);
      closeAllFilterPickers();
      addHeroFilter(side);
      return true;
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
          if (!isOpen) openFilterPicker(picker);
        });
        menu.addEventListener('click', (event) => event.stopPropagation());
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
            addHeroFilter(side);
          });
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
  </script>`;
}

function renderSimLabSharedStyles() {
    return `
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: system-ui, sans-serif;
      background: #0f1419;
      color: #e7ecf3;
      line-height: 1.45;
    }
    .page { max-width: 1440px; margin: 0 auto; padding: 20px 24px 40px; }
    .page-header {
      display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between;
      gap: 12px 24px; margin-bottom: 12px;
    }
    .page-header-main { min-width: 0; flex: 1; }
    h1 { margin: 0 0 4px; font-size: 1.45rem; letter-spacing: -0.02em; }
    .subtitle { margin: 0; color: #9fb3d1; font-size: 0.88rem; }
    .meta { color: #8b9bb4; margin: 8px 0 0; font-size: 0.85rem; }
    .page-nav {
      display: inline-flex; flex-wrap: wrap; align-items: center; gap: 4px;
      padding: 4px; border: 1px solid #243044; border-radius: 8px; background: #121820;
      position: sticky; top: 8px; z-index: 2;
    }
    .page-nav a {
      color: #c8d4e8; text-decoration: none; padding: 6px 10px; border-radius: 6px;
      font-size: 0.82rem; white-space: nowrap;
    }
    .page-nav a:hover, .page-nav a[aria-current="page"] { background: #243044; color: #fff; }
    .section { margin-bottom: 22px; scroll-margin-top: 56px; }
    .section-head {
      display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 14px; margin-bottom: 10px;
    }
    .section-head h2 { margin: 0; font-size: 1.05rem; }
    .section-lead { margin: 0; color: #9fb3d1; font-size: 0.84rem; }
    .section-lead em { color: #c8d4e8; font-style: normal; font-weight: 600; }
    .card { background: #151d28; border: 1px solid #243044; border-radius: 8px; }
    .intro { padding: 10px 14px; margin-bottom: 12px; }
    .intro-lead { margin: 0; color: #c8d4e8; font-size: 0.88rem; }
    .toolbar {
      display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: center;
      margin-bottom: 8px; min-height: 36px;
    }
    .toolbar a, .toolbar button, .detail-actions a {
      color: #e7ecf3; background: #1a2433; border: 1px solid #2f3f57; border-radius: 6px;
      padding: 6px 10px; font-size: 0.84rem; text-decoration: none; cursor: pointer;
    }
    .toolbar a:hover, .toolbar button:hover, .detail-actions a:hover, a.detail-btn:hover { background: #243044; }
    a.detail-btn {
      display: inline-block; color: #e7ecf3; background: #1a2433; border: 1px solid #2f3f57;
      border-radius: 6px; padding: 5px 10px; font-size: 0.8rem; text-decoration: none; white-space: nowrap;
    }
    .status { color: #9fb3d1; font-size: 0.84rem; margin-right: auto; }
    .filters {
      display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px 20px; padding: 14px 16px; align-items: start;
    }
    @media (max-width: 820px) { .filters { grid-template-columns: 1fr; } }
    .filter-group { display: flex; flex-direction: column; gap: 8px; min-width: 0; height: 100%; }
    .filter-title { font-size: 0.88rem; font-weight: 600; color: #e7ecf3; line-height: 1.2; }
    .filter-help { margin: 0; font-size: 0.78rem; }
    .filter-group .chips { flex: 1; }
    .filter-row { display: flex; flex-wrap: nowrap; gap: 8px; align-items: center; }
    .filter-row button {
      color: #e7ecf3; background: #243044; border: 1px solid #3a4f6d; border-radius: 6px;
      padding: 7px 12px; font-size: 0.84rem; cursor: pointer; flex-shrink: 0; min-height: 38px;
    }
    .filter-row button.ghost { background: transparent; border-color: #2f3f57; }
    .tester-select {
      min-width: 0; flex: 1; min-height: 38px; color: #e7ecf3; background: #1a2433;
      border: 1px solid #2f3f57; border-radius: 6px; padding: 7px 10px; font-size: 0.88rem;
    }
    .tester-select:hover, .tester-select:focus {
      background: #243044; border-color: #3a5a8a; outline: none;
    }
    .filter-group-tester {
      grid-column: 1 / -1; height: auto; padding-bottom: 12px;
      border-bottom: 1px solid #243044; margin-bottom: 2px;
    }
    .filter-picker { position: relative; min-width: 0; flex: 1; }
    .filter-picker-trigger {
      display: flex; align-items: center; gap: 8px; width: 100%; min-height: 38px;
      color: #e7ecf3; background: #1a2433; border: 1px solid #2f3f57; border-radius: 6px;
      padding: 5px 10px; font-size: 0.88rem; cursor: pointer; text-align: left;
    }
    .filter-picker-trigger:hover,
    .filter-picker.open .filter-picker-trigger { background: #243044; border-color: #3a5a8a; }
    .filter-picker-placeholder, .filter-picker-value {
      color: #e7ecf3; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .filter-picker-placeholder { color: #8b9bb4; }
    .filter-picker-caret { color: #9fb3d1; font-size: 0.75rem; margin-left: auto; }
    .filter-picker-menu {
      position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 30;
      max-height: 320px; overflow: hidden; display: flex; flex-direction: column;
      background: #151d28; border: 1px solid #3a5a8a; border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45); padding: 6px;
    }
    .filter-picker-menu[hidden] { display: none; }
    .filter-picker-search-wrap {
      padding: 4px 4px 8px; border-bottom: 1px solid #243044; margin-bottom: 4px;
    }
    .filter-picker-search {
      width: 100%; box-sizing: border-box; color: #e7ecf3; background: #1a2433;
      border: 1px solid #2f3f57; border-radius: 6px; padding: 8px 10px; font-size: 0.88rem;
    }
    .filter-picker-search:focus {
      outline: none; border-color: #3a5a8a; box-shadow: 0 0 0 2px rgba(58, 90, 138, 0.35);
    }
    .filter-picker-options { overflow: auto; max-height: 240px; padding-right: 2px; }
    .filter-picker-empty { padding: 12px 8px; font-size: 0.85rem; text-align: center; }
    .filter-picker-option[hidden], .filter-picker-group-label[hidden] { display: none; }
    .filter-picker-group-label {
      padding: 6px 8px 4px; font-size: 0.72rem; font-weight: 600; color: #9fb3d1;
      text-transform: uppercase; letter-spacing: 0.04em;
    }
    .filter-picker-option {
      display: flex; align-items: center; gap: 10px; width: 100%; padding: 6px 8px;
      border: none; border-radius: 6px; background: transparent; color: #e7ecf3;
      font-size: 0.88rem; text-align: left; cursor: pointer;
    }
    .filter-picker-option:hover, .filter-picker-option:focus { background: #243044; outline: none; }
    .filter-picker-icon { width: 24px; height: 24px; border-radius: 4px; flex-shrink: 0; }
    .filter-picker-icon-fallback {
      display: inline-block; width: 24px; height: 24px; background: #243044; border-radius: 4px;
    }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; min-height: 30px; align-items: center; align-content: flex-start; }
    .chip {
      display: inline-flex; align-items: center; gap: 6px; color: #e7ecf3; background: #243044;
      border: 1px solid #3a4f6d; border-radius: 999px; padding: 3px 9px; font-size: 0.82rem; cursor: pointer;
    }
    .chip:hover { background: #2f3f57; }
    .chip-x { color: #9fb3d1; font-weight: 700; }
    .filter-active {
      grid-column: 1 / -1; padding: 8px 12px; border-radius: 6px;
      background: #1a2a40; border: 1px solid #3a5a8a; color: #9fc5ff; font-size: 0.82rem;
    }
    .sim-legend-details { padding: 0; overflow: hidden; }
    .sim-legend-details > summary {
      list-style: none; cursor: pointer; display: flex; flex-wrap: wrap; align-items: baseline;
      gap: 6px 12px; padding: 12px 16px; user-select: none;
    }
    .sim-legend-details > summary::-webkit-details-marker { display: none; }
    .sim-legend-summary-title { font-size: 0.95rem; font-weight: 600; color: #e7ecf3; }
    .sim-legend-details[open] > summary { border-bottom: 1px solid #243044; }
    .sim-legend { padding: 14px 16px; }
    .sim-legend-grid {
      display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; align-items: start;
    }
    @media (max-width: 1100px) { .sim-legend-grid { grid-template-columns: 1fr; } }
    .sim-legend-panel { min-width: 0; }
    .sim-legend h3 { margin: 0 0 4px; font-size: 0.92rem; color: #e7ecf3; }
    .stats-note { margin: 0 0 8px; font-size: 0.78rem; }
    .stats-note.ranks { margin-top: -4px; }
    .legend-table-wrap { max-height: 280px; border: 1px solid #243044; border-radius: 8px; }
    .table-wrap { overflow: auto; }
    #results .table-wrap { max-height: calc(100vh - 140px); }
    .sim-meta-row-compact { margin-top: 6px; gap: 4px; }
    .sim-meta-row-compact .sim-chip { font-size: 0.72rem; padding: 2px 6px; }
    .sim-meta-row-compact .favor-list { gap: 2px 6px; }
    .sim-meta-row-compact .sim-slots { display: none; }
    table { width: 100%; border-collapse: collapse; font-size: 0.86rem; }
    th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #243044; vertical-align: middle; }
    th {
      color: #9fb3d1; font-weight: 600; background: #151d28; position: sticky; top: 0; z-index: 1;
      white-space: nowrap;
    }
    tr:hover td { background: #1a2433; }
    .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    th.num { text-align: right; }
    .nowrap { white-space: nowrap; }
    .muted { color: #8b9bb4; font-size: 0.82rem; }
    .mono { font-family: ui-monospace, Consolas, monospace; font-size: 0.78rem; }
    .win { font-weight: 600; }
    .good { color: #6ee7a0; }
    .mid { color: #f6d365; }
    .bad { color: #f87171; }
    .badge {
      display: inline-block; margin-left: 6px; padding: 1px 6px; border-radius: 999px;
      font-size: 0.7rem; font-weight: 600; vertical-align: middle;
    }
    .badge.solved { background: #1a3d2e; color: #6ee7a0; border: 1px solid #2d6a4f; }
    .badge.gold {
      background: linear-gradient(135deg, #3d2e12 0%, #5a4518 100%);
      color: #f6e27a;
      border: 1px solid #c9a227;
      letter-spacing: .04em;
      text-transform: uppercase;
    }
    a { color: #7cb8ff; }
    .empty {
      padding: 24px 16px; text-align: center; color: #8b9bb4;
      border: 1px dashed #2f3f57; border-radius: 8px;
    }
    .team-filter-btn {
      appearance: none; border: 0; background: transparent; padding: 0; margin: 0;
      color: inherit; font: inherit; cursor: pointer; text-align: left;
    }
    .team-filter-btn:hover { text-decoration: underline; text-underline-offset: 2px; }
    .sim-chip {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 3px 8px; border-radius: 999px; font-size: 0.78rem;
      background: #1a2433; border: 1px solid #2f3f57; color: #d7e3f4;
    }
    .sim-chip.warn { border-color: #6a4a20; background: #2a2012; color: #f6d365; }
    .sim-chip.gold-sim {
      border-color: #c9a227; background: #2a2412; color: #f6e27a;
    }
    .sim-chip-k { color: #8b9bb4; font-weight: 600; text-transform: uppercase; font-size: 0.68rem; letter-spacing: .04em; }
    .sim-chip-slots, .sim-chip-favor { align-items: flex-start; max-width: 100%; border-radius: 8px; }
    .sim-slots { display: flex; flex-direction: column; gap: 2px; }
    .sim-slot-line { font-size: 0.78rem; line-height: 1.3; color: #d7e3f4; }
    .favor-list, .favor-cell {
      display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: center;
    }
    .favor-pair {
      display: inline-flex; align-items: center; gap: 4px; white-space: nowrap;
    }
    .favor-arrow { color: #8b9bb4; font-size: 0.75rem; }
    .detail-grid {
      display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px;
    }
    @media (max-width: 900px) { .detail-grid { grid-template-columns: 1fr; } }
    .detail-card { padding: 14px 16px; }
    .detail-card h2 { margin: 0 0 10px; font-size: 1rem; }
    .detail-meta {
      display: flex; flex-wrap: wrap; gap: 8px 14px; margin: 0 0 12px; color: #9fb3d1; font-size: 0.84rem;
    }
    .detail-meta strong { color: #e7ecf3; }
    .detail-actions { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 14px; }
    .detail-block { margin-top: 12px; }
    .detail-block-title {
      font-size: 0.72rem; font-weight: 700; letter-spacing: .06em; text-transform: uppercase;
      color: #9fb3d1; margin-bottom: 6px;
    }
    .sim-meta-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
    pre.payload {
      margin: 0; padding: 12px; overflow: auto; max-height: 420px;
      background: #0f1419; border: 1px solid #243044; border-radius: 8px;
      color: #c8d4e8; font-size: 0.75rem; line-height: 1.4;
    }
    ${HERO_ICON_TOOLTIP_CSS}
`;
}

function renderSimLabLogRow(round, minWinRate) {
    const name = round.opponentName || (round.opponentUserId ? `User ${round.opponentUserId}` : 'Unknown');
    const place = round.opponentPlace != null ? `#${round.opponentPlace}` : '—';
    const groupId = round.groupId || round.sessionId || '';
    const tryCount = Number(round.tryCount) || 1;
    const detailHref = groupId
        ? `/training/simlab-view?groupId=${encodeURIComponent(groupId)}`
        : '';
    const detailCell = detailHref
        ? `<a class="detail-btn" href="${escapeHtml(detailHref)}">View detail</a>`
        : '<span class="muted">—</span>';
    const goldDefense = isGoldSimLabDefense(round);
    const defenseBits = renderSimLabSupportBits({
        banner: round.opponentBanner,
        bannerStones: round.opponentBannerStones,
        favor: round.opponentFavor,
        goldDefense,
    });
    const attackBits = renderSimLabSupportBits({
        banner: round.myBanner,
        bannerStones: round.myBannerStones,
        favor: round.myFavor,
        maxUpgrade: round.maxUpgrade,
    });
    return `
      <tr>
        <td class="num muted">${escapeHtml(String(place))}</td>
        <td>
          ${renderClickableTeamFilter('opponent', round.opponentHeroIds, round.opponentPet)}
          <div class="sim-meta-row sim-meta-row-compact">${defenseBits}</div>
        </td>
        <td class="muted">${escapeHtml(name)}</td>
        <td class="muted">${escapeHtml(formatTesterLabel(round))}</td>
        <td>
          ${renderClickableTeamFilter('my', round.myHeroIds, round.myPet, round.myHeroNames)}
          <div class="sim-meta-row sim-meta-row-compact">${attackBits}</div>
          <div class="muted" style="margin-top:4px">${tryCount} tr${tryCount === 1 ? 'y' : 'ies'}</div>
        </td>
        <td class="num">${renderSimLabWinRateCell(round, minWinRate)}</td>
        <td class="num muted">${escapeHtml(formatRecord(round.wins, round.losses))}</td>
        <td class="muted nowrap">${escapeHtml(formatWhen(round.testedAt))}</td>
        <td>${detailCell}</td>
      </tr>`;
}

/**
 * SimLab list page — main-view style log with filters + detail links.
 */
export function renderSimLabPage(rounds = [], options = {}) {
    const minWinRate = options.minWinRate ?? 90;
    const total = options.total ?? rounds.length;
    const offset = options.offset ?? 0;
    const pageSize = options.pageSize ?? rounds.length;
    const paging = {
        testerUserId: options.testerUserId || '',
        opponentHeroIds: options.opponentHeroIds || [],
        myHeroIds: options.myHeroIds || [],
        testers: options.testers || [],
        offset,
        pageSize,
    };
    const shownFrom = total === 0 ? 0 : offset + 1;
    const shownTo = Math.min(offset + rounds.length, total);
    const nextOffset = offset + rounds.length;
    const hasMore = nextOffset < total;
    const queryBase = buildSimLabQueryBase({ ...paging, offset: 0 });
    const allLink = `/training/simlab-view?${queryBase}limit=0`;
    const nextLink = `/training/simlab-view?${buildSimLabQueryBase({ ...paging, offset: nextOffset })}limit=${pageSize}`;
    const startLink = `/training/simlab-view?${queryBase}limit=${pageSize}`;
    const rows = (Array.isArray(rounds) ? rounds : [])
        .map((round) => renderSimLabLogRow(round, minWinRate))
        .join('');
    const jsonQuery = new URLSearchParams();
    jsonQuery.set('limit', String(pageSize > 0 ? pageSize : 100));
    if (paging.testerUserId) jsonQuery.set('tester', paging.testerUserId);
    for (const id of paging.opponentHeroIds) jsonQuery.append('opponentHero', String(id));
    for (const id of paging.myHeroIds) jsonQuery.append('myHero', String(id));

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>SimLab</title>
  <style>
    ${renderSimLabSharedStyles()}
  </style>
</head>
<body>
  <div class="page">
    <header class="page-header">
      <div class="page-header-main">
        <h1>SimLab</h1>
        <p class="subtitle">One row per Sim click (best win %). View detail lists every pet / favor / flag try.</p>
      </div>
      ${renderSimLabNav('list')}
    </header>

    <section class="intro card">
      <p class="intro-lead">
        Same layout as Training. Each row is one Counter Suggest Sim <em>group</em> showing the best win %.
        Open <strong>View detail</strong> for every attempt (pet, favor, flag).
        Green = ${escapeHtml(String(minWinRate))}%.
        <span class="badge gold">Gold</span> = full defense favor / flag / slots and ≥${GOLD_SIMLAB_WIN_RATE}%.
      </p>
    </section>

    ${renderSimLabFilters(paging)}

    <section class="section" id="results">
      <div class="section-head">
        <h2>Test log</h2>
        <p class="section-lead">One row per Sim group — best result only. Flag / favor chips show target defense and best attack.</p>
      </div>
      <div class="toolbar">
        <span class="status">${shownFrom}–${shownTo} / ${total}</span>
        ${pageSize > 0 && offset + pageSize < total ? `<a href="${allLink}">All</a>` : ''}
        ${hasMore ? `<a href="${nextLink}">+${Math.min(pageSize, total - nextOffset)}</a>` : ''}
        ${offset > 0 ? `<a href="${startLink}">Start</a>` : ''}
        <a href="/training/simlab?${escapeHtml(jsonQuery.toString())}">JSON</a>
      </div>
      <div class="table-wrap card">
        <table class="data-table">
          <thead>
            <tr>
              <th class="num">#</th>
              <th>Opponent</th>
              <th>Label</th>
              <th>Tester</th>
              <th>Your team</th>
              <th class="num">Win %</th>
              <th class="num">W/L</th>
              <th>When</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="9" class="muted">No runs — clear filters or Sim from Counter Suggest</td></tr>'}
          </tbody>
        </table>
      </div>
      ${hasMore ? `<p class="meta"><a href="${nextLink}">More</a> · <a href="${allLink}">All ${total}</a></p>` : ''}
    </section>

    ${renderSimLabLegend()}
  </div>
  ${renderSimLabFilterScript()}
</body>
</html>`;
}

function renderSimLabTryRow(tryRound, minWinRate, isBest) {
    const flagMissing = tryRound.myBanner == null || tryRound.myBanner === '';
    const slotsHtml = formatBannerStonesHtml(tryRound.myBannerStones);
    return `
      <tr class="${isBest ? 'sim-try-best' : ''}">
        <td class="muted">${escapeHtml(tryRound.phase || '—')}${isBest ? ' <span class="badge solved">Best</span>' : ''}</td>
        <td>${renderUnitNameHtml(tryRound.myPet, formatPetLabel(tryRound.myPet))}</td>
        <td class="favor-cell">${formatFavorHtml(tryRound.myFavor)}</td>
        <td>
          <span class="sim-chip${flagMissing ? ' warn' : ''}" title="${escapeHtml(formatFlagTitle(tryRound.myBanner))}">
            ${escapeHtml(formatFlagLabel(tryRound.myBanner))}
          </span>
          ${slotsHtml ? `<div class="sim-slots" style="margin-top:6px">${slotsHtml}</div>` : ''}
        </td>
        <td class="num">${renderWinRateCell(tryRound.winRate, minWinRate)}</td>
        <td class="num muted">${escapeHtml(formatRecord(tryRound.wins, tryRound.losses))}</td>
        <td class="muted nowrap">${escapeHtml(formatWhen(tryRound.testedAt))}</td>
      </tr>`;
}

/**
 * SimLab group detail: best summary + every pet/favor/flag try (no raw payload).
 */
export function renderSimLabDetailPage(detail, options = {}) {
    const minWinRate = options.minWinRate ?? 90;
    // Accept legacy single-round objects or { best, tries, groupId }.
    const best = detail?.best || (detail?.sessionId || detail?.myHeroIds ? detail : null);
    const tries = Array.isArray(detail?.tries) && detail.tries.length
        ? detail.tries
        : (best ? [best] : []);
    const groupId = detail?.groupId || best?.groupId || best?.sessionId || '';

    if (!best) {
        return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" /><title>SimLab detail</title>
<style>${renderSimLabSharedStyles()}
tr.sim-try-best td { background: #1a2a40; }
</style></head>
<body><div class="page">
  <header class="page-header">
    <div class="page-header-main"><h1>SimLab detail</h1><p class="subtitle">Group not found.</p></div>
    ${renderSimLabNav()}
  </header>
  <div class="empty">No SimLab group for that id.</div>
  <p class="meta"><a href="/training/simlab-view">Back to SimLab</a></p>
</div></body></html>`;
    }

    const name = best.opponentName || (best.opponentUserId ? `User ${best.opponentUserId}` : 'Unknown');
    const tryRows = tries.map((tryRound) => renderSimLabTryRow(
        tryRound,
        minWinRate,
        tryRound.sessionId === best.sessionId
            || (
                Number(tryRound.winRate) === Number(best.winRate)
                && Number(tryRound.myPet) === Number(best.myPet)
                && Number(tryRound.myBanner) === Number(best.myBanner)
            )
    )).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>SimLab · ${escapeHtml(name)}</title>
  <style>
    ${renderSimLabSharedStyles()}
    tr.sim-try-best td { background: #1a2a40; }
  </style>
</head>
<body>
  <div class="page">
    <header class="page-header">
      <div class="page-header-main">
        <h1>SimLab detail</h1>
        <p class="subtitle">Best result plus every pet / favor / flag try in this Sim group.</p>
      </div>
      ${renderSimLabNav()}
    </header>

    <div class="detail-actions">
      <a href="/training/simlab-view">← Back to SimLab log</a>
      <a href="/training/view">Training</a>
      <a href="/training/simlab?groupId=${encodeURIComponent(groupId)}">JSON</a>
    </div>

    <div class="detail-meta">
      <span><strong>When</strong> ${escapeHtml(formatWhen(best.testedAt))}</span>
      <span><strong>Best win</strong> ${renderSimLabWinRateCell(best, minWinRate)}</span>
      <span><strong>W/L</strong> ${escapeHtml(formatRecord(best.wins, best.losses))}</span>
      <span><strong>Tries</strong> ${escapeHtml(String(detail?.tryCount || tries.length))}</span>
      <span><strong>Tester</strong> ${escapeHtml(formatTesterLabel(best))}</span>
      <span><strong>Source</strong> ${escapeHtml(formatSourceLabel(best.source, best.label))}</span>
    </div>

    <div class="detail-grid">
      <section class="detail-card card">
        <h2>Target defense</h2>
        <div class="detail-block">
          <div class="detail-block-title">Team</div>
          ${renderComboLabelHtml(best.opponentHeroIds, best.opponentPet)}
          <div class="muted" style="margin-top:6px">
            ${escapeHtml(name)}
            ${best.opponentUserId ? ` · id ${escapeHtml(String(best.opponentUserId))}` : ''}
            ${best.opponentPlace != null ? ` · #${escapeHtml(String(best.opponentPlace))}` : ''}
            ${best.opponentPower != null ? ` · ${escapeHtml(String(Math.round(Number(best.opponentPower))))} pwr` : ''}
          </div>
        </div>
        <div class="detail-block">
          <div class="detail-block-title">Support</div>
          <div class="sim-meta-row">
            ${renderSimLabSupportBits({
                banner: best.opponentBanner,
                bannerStones: best.opponentBannerStones,
                favor: best.opponentFavor,
                goldDefense: isGoldSimLabDefense(best),
            })}
          </div>
        </div>
      </section>

      <section class="detail-card card">
        <h2>Best attack</h2>
        <div class="detail-block">
          <div class="detail-block-title">Team</div>
          ${renderComboLabelHtml(best.myHeroIds, best.myPet, best.myHeroNames)}
        </div>
        <div class="detail-block">
          <div class="detail-block-title">Support</div>
          <div class="sim-meta-row">
            ${renderSimLabSupportBits({
                banner: best.myBanner,
                bannerStones: best.myBannerStones,
                favor: best.myFavor,
                maxUpgrade: best.maxUpgrade,
            })}
          </div>
        </div>
      </section>
    </div>

    <section class="section" style="margin-top:18px">
      <div class="section-head">
        <h2>All tries</h2>
        <p class="section-lead">Pet sweep → favor → flag attempts that led to the best result.</p>
      </div>
      <div class="table-wrap card">
        <table class="data-table">
          <thead>
            <tr>
              <th>Phase</th>
              <th>Pet</th>
              <th>Favor</th>
              <th>Flag / slots</th>
              <th class="num">Win %</th>
              <th class="num">W/L</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            ${tryRows || '<tr><td colspan="7" class="muted">No tries stored</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>
  </div>
</body>
</html>`;
}
