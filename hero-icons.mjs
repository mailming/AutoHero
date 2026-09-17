import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { HERO_NAMES, PET_NAMES, formatCombo, resolveHeroName } from './hero-names.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

/** Remote source (hw-recruit arena team icons). */
export const HW_RECRUIT_REMOTE_BASE = 'https://hw-recruit.com/modules/hwrecruit/images';

/** On-disk cache directory and web path served by the bridge. */
export const ICONS_DIR = path.join(ROOT, 'assets', 'hw-recruit-icons');
export const LOCAL_ICON_WEB_PATH = '/icons/hw-recruit';

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * hw-recruit filenames: heroes use zero-padded ids (07.png), pets use 6--N.png (6008 → 6--8.png).
 */
export function hwRecruitIconFilename(unitId) {
    const id = Number(unitId);
    if (!Number.isFinite(id) || id <= 0) return null;
    if (id >= 6000 && id < 7000) {
        const suffix = id - 6000;
        if (suffix < 0 || suffix > 9) return null;
        return `6--${suffix}.png`;
    }
    if (id < 6000) {
        return `${String(id).padStart(2, '0')}.png`;
    }
    return null;
}

export function hwRecruitRemoteIconUrl(unitId) {
    const filename = hwRecruitIconFilename(unitId);
    return filename ? `${HW_RECRUIT_REMOTE_BASE}/${filename}` : null;
}

export function localIconPath(unitId) {
    const filename = hwRecruitIconFilename(unitId);
    return filename ? path.join(ICONS_DIR, filename) : null;
}

export function localIconUrl(unitId) {
    const filename = hwRecruitIconFilename(unitId);
    if (!filename) return null;
    const filePath = path.join(ICONS_DIR, filename);
    if (!fs.existsSync(filePath)) return null;
    return `${LOCAL_ICON_WEB_PATH}/${filename}`;
}

/** Prefer cached local icon; fall back to remote only if missing on disk. */
export function iconUrlForUnit(unitId) {
    return localIconUrl(unitId) || hwRecruitRemoteIconUrl(unitId);
}

export function listCachedIconFilenames() {
    if (!fs.existsSync(ICONS_DIR)) return [];
    return fs.readdirSync(ICONS_DIR)
        .filter((name) => name.endsWith('.png'))
        .sort();
}

/** All known heroes/pets → icon URL (local when cached). */
export function buildIconMap() {
    const map = {};
    for (const id of Object.keys(HERO_NAMES)) {
        const url = iconUrlForUnit(id);
        if (url) map[id] = url;
    }
    for (const id of Object.keys(PET_NAMES)) {
        const url = iconUrlForUnit(id);
        if (url) map[id] = url;
    }
    return map;
}

export const UNIT_ICON_MAP = buildIconMap();

export function renderUnitNameHtml(unitId, displayName = null) {
    const id = Number(unitId);
    const label = escapeHtml(displayName ?? resolveHeroName(id));
    const iconUrl = UNIT_ICON_MAP[id] || iconUrlForUnit(id);
    if (!iconUrl) {
        return `<span class="unit-label">${label}</span>`;
    }
    return `<span class="unit-hover"><span class="unit-label">${label}</span><span class="unit-tip" role="tooltip"><img src="${escapeHtml(iconUrl)}" alt="${label}" loading="lazy" width="48" height="48"></span></span>`;
}

export function renderHeroListHtml(heroIds, heroNamesOverride = null) {
    const combo = formatCombo(heroIds, null, heroNamesOverride);
    const parts = combo.heroIds.map((heroId, index) => renderUnitNameHtml(heroId, combo.heroNames[index]));
    return `<span class="combo-label">${parts.join('<span class="unit-sep">, </span>')}</span>`;
}

export function renderComboLabelHtml(heroIds, pet, heroNamesOverride = null) {
    const combo = formatCombo(heroIds, pet, heroNamesOverride);
    const parts = combo.heroIds.map((heroId, index) => renderUnitNameHtml(heroId, combo.heroNames[index]));
    let html = parts.join('<span class="unit-sep">, </span>');
    if (combo.pet) {
        html += `<span class="unit-plus"> + </span>${renderUnitNameHtml(combo.pet, combo.petName)}`;
    }
    return `<span class="combo-label">${html}</span>`;
}

export const HERO_ICON_TOOLTIP_CSS = `
    .unit-hover {
      position: relative;
      display: inline;
      border-bottom: 1px dotted #5a7a9a;
      cursor: help;
    }
    .unit-hover .unit-label { color: inherit; }
    .unit-hover .unit-tip {
      display: none;
      position: absolute;
      bottom: calc(100% + 8px);
      left: 50%;
      transform: translateX(-50%);
      z-index: 20;
      padding: 6px;
      background: #1a2433;
      border: 1px solid #3a5a8a;
      border-radius: 8px;
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.45);
      pointer-events: none;
      white-space: nowrap;
    }
    .unit-hover .unit-tip::after {
      content: '';
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      border: 6px solid transparent;
      border-top-color: #3a5a8a;
    }
    .unit-hover:hover .unit-tip,
    .unit-hover:focus-within .unit-tip {
      display: block;
    }
    .unit-tip img {
      width: 48px;
      height: 48px;
      display: block;
      border-radius: 4px;
    }
    .combo-label { line-height: 1.6; }
    .combo-label .unit-sep,
    .combo-label .unit-plus { color: #8b9bb4; border: none; cursor: default; }
    td .unit-hover, .ga-team .unit-hover, .chip .unit-hover { white-space: normal; }
`;
