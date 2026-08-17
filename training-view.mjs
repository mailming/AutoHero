import { formatCombo } from './hero-names.mjs';

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

    const queryBase = comboKey ? `comboKey=${encodeURIComponent(comboKey)}&` : '';
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
    JSON: <a href="/training/results?limit=0">/training/results</a>
  </p>
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
