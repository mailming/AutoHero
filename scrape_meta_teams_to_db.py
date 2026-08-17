#!/usr/bin/env python3
"""
Scrape Hero Wars arena meta teams from hw-recruit.com and save each run as a
timestamped snapshot in PostgreSQL.

Each run creates:
  - one row in meta_team_snapshots (capture time + scrape metadata)
  - many rows in meta_teams (team combos with popularity counts)

Usage:
  pip install -r requirements.txt
  npm run db:init
  python scrape_meta_teams_to_db.py
  python scrape_meta_teams_to_db.py --position 10 --max-page 20
"""
from __future__ import annotations

import argparse
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

import psycopg2
import psycopg2.extras
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv

load_dotenv()

HERO_NAMES = {
    1: 'Aurora', 2: 'Galahad', 3: 'Keira', 4: 'Astaroth', 5: 'Kai', 6: 'Phobos', 7: 'Thea',
    8: 'Daredevil', 9: 'Heidi', 10: 'Faceless', 11: 'Chabba', 12: 'Arachne', 13: 'Orion',
    14: 'Fox', 15: 'Ginger', 16: 'Dante', 17: 'Mojo', 18: 'Judge', 19: 'Dark Star', 20: 'Artemis',
    21: 'Markus', 22: 'Peppy', 23: 'Lian', 24: 'Cleaver', 25: 'Ishmael', 26: 'Lilith', 27: 'Luther',
    28: 'Qing Mao', 29: 'Dorian', 30: 'Cornelius', 31: 'Jet', 32: 'Helios', 33: 'Lars', 34: 'Krista',
    35: 'Jorgen', 36: 'Maya', 37: 'Jhu', 38: 'Elmir', 39: 'Ziri', 40: 'Nebula', 41: "K'arkh",
    42: 'Rufus', 43: 'Celeste', 44: 'Astrid and Lucas', 45: 'Satori', 46: 'Martha', 47: 'Andvari',
    48: 'Sebastian', 49: 'Yasmine', 50: 'Corvus', 51: 'Morrigan', 52: 'Isaac', 53: 'Alvanor',
    54: 'Tristan', 55: 'Iris', 56: 'Amira', 57: 'Fafnir', 58: 'Aidan', 59: 'Kayla',
    60: 'Mushy and Shroom', 61: 'Julius', 62: 'Polaris', 63: 'Lara Croft', 64: 'Augustus',
    65: 'Ninja Turtles', 66: 'Folio', 67: 'Lyria', 68: 'Guus', 69: 'Cascade', 70: 'Electra von Grave',
    71: 'Fluffy', 72: 'Byrna', 73: 'Adam', 74: 'Somna',
}

PET_NAMES = {
    6000: 'Merlin', 6001: 'Angus', 6002: 'Ava', 6003: 'Cain', 6004: 'Oliver',
    6005: 'Fenris', 6006: 'Cain', 6007: 'Vulcan', 6008: 'Axel',
}

DEFAULT_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/autohero'
DEFAULT_BASE_URL = 'https://hw-recruit.com/arena'


def get_database_url() -> str:
    return os.getenv('DATABASE_URL', DEFAULT_DATABASE_URL)


def build_combo_key(hero_ids: list[int], pet: int | None = None, banner: int | None = None) -> str:
    heroes = [int(h) for h in hero_ids if 0 < int(h) < 6000]
    pet_id = int(pet or 0)
    banner_id = int(banner or 0)
    return f"{','.join(str(h) for h in heroes)}|{pet_id}|{banner_id}"


def resolve_hero_name(hero_id: int) -> str:
    if hero_id >= 6000:
        return PET_NAMES.get(hero_id, f'Pet {hero_id}')
    return HERO_NAMES.get(hero_id, f'Hero {hero_id}')


def parse_team_images(image_names: list[str]) -> dict[str, Any]:
    banner = 0
    hero_ids: list[int] = []
    pet_id: int | None = None

    for image_name in image_names:
        base = image_name.replace('.png', '').replace('.webp', '')
        if '--' in base:
            banner = int(base.split('--', 1)[0])
            continue
        if not base.isdigit():
            continue

        value = int(base, 10)
        if value >= 6000:
            pet_id = value
        elif value < 6000:
            hero_ids.append(value)

    hero_ids = hero_ids[:5]
    hero_names = [resolve_hero_name(h) for h in hero_ids]
    pet_name = PET_NAMES.get(pet_id) if pet_id else None

    return {
        'hero_ids': hero_ids,
        'hero_names': hero_names,
        'pet': pet_id,
        'pet_name': pet_name,
        'banner': banner or None,
        'combo_key': build_combo_key(hero_ids, pet_id, banner),
    }


def get_page_content(url: str, retries: int = 3) -> str | None:
    headers = {
        'User-Agent': (
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
            '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        )
    }

    for attempt in range(retries):
        try:
            response = requests.get(url, headers=headers, timeout=30)
            response.raise_for_status()
            return response.text
        except requests.exceptions.RequestException as exc:
            if attempt < retries - 1:
                print(f'[WARNING] Failed to fetch {url}, retrying... ({attempt + 1}/{retries})')
                time.sleep(2)
            else:
                print(f'[ERROR] Failed to fetch {url} after {retries} attempts: {exc}')
                return None
    return None


def extract_teams_from_page(html_content: str, page_number: int) -> list[dict[str, Any]]:
    soup = BeautifulSoup(html_content, 'html.parser')
    teams: list[dict[str, Any]] = []

    for row in soup.select('table tbody tr'):
        team_cell = row.find('td', class_=lambda c: c and 'views-field-team' in c and 'team-1' not in c)
        if not team_cell:
            continue

        rank_cell = row.find('td', class_=lambda c: c and 'views-field-counter' in c)
        count_cell = row.find('td', class_=lambda c: c and 'views-field-team-1' in c)

        image_names = [
            img.get('src', '').split('/')[-1]
            for img in team_cell.find_all('img')
            if img.get('src')
        ]
        if not image_names:
            continue

        parsed = parse_team_images(image_names)
        if len(parsed['hero_ids']) != 5:
            print(f'[WARNING] Skipping row with {len(parsed["hero_ids"])} heroes on page {page_number}: {image_names}')
            continue

        popularity = None
        row_rank = None
        if count_cell:
            try:
                popularity = int(count_cell.get_text(strip=True).replace(',', ''))
            except ValueError:
                popularity = None
        if rank_cell:
            try:
                row_rank = int(rank_cell.get_text(strip=True))
            except ValueError:
                row_rank = None

        teams.append({
            **parsed,
            'popularity_count': popularity,
            'row_rank': row_rank,
            'page_number': page_number,
        })

    return teams


def build_page_url(
    base_url: str,
    position: int,
    page_index: int,
    *,
    server_min: str = '',
    server_max: str = '',
) -> str:
    params = {
        'server': str(server_min),
        'server_1': str(server_max),
        'position': str(position),
    }
    query = urlencode(params)
    if page_index <= 1:
        return f'{base_url}?{query}'
    return f'{base_url}?{query}&page={page_index - 1}'


def scrape_all_teams(
    base_url: str,
    position: int,
    max_page: int,
    delay_seconds: float,
    *,
    server_min: str = '',
    server_max: str = '',
) -> tuple[list[dict[str, Any]], int]:
    all_teams: list[dict[str, Any]] = []
    pages_scraped = 0
    page_number = 1

    while True:
        if max_page > 0 and page_number > max_page:
            break

        url = build_page_url(
            base_url,
            position,
            page_number,
            server_min=server_min,
            server_max=server_max,
        )
        print(f'[INFO] Scraping page {page_number}: {url}')
        html = get_page_content(url)
        if not html:
            print(f'[ERROR] Stopping after failed fetch on page {page_number}')
            break

        teams = extract_teams_from_page(html, page_number)
        if not teams:
            print(f'[INFO] No teams found on page {page_number}, stopping')
            break

        all_teams.extend(teams)
        pages_scraped += 1
        print(f'  Found {len(teams)} teams (running total: {len(all_teams)})')

        page_number += 1
        if delay_seconds > 0:
            time.sleep(delay_seconds)

    return all_teams, pages_scraped


def save_snapshot_to_db(
    teams: list[dict[str, Any]],
    *,
    source_url: str,
    position_max: int,
    pages_scraped: int,
    notes: str | None = None,
) -> int:
    captured_at = datetime.now(timezone.utc)
    unique_combo_keys = {team['combo_key'] for team in teams}

    conn = psycopg2.connect(get_database_url())
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    '''
                    INSERT INTO meta_team_snapshots (
                        captured_at, source, source_url, position_max,
                        pages_scraped, total_teams, unique_combos, notes
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                    ''',
                    (
                        captured_at,
                        'hw-recruit',
                        source_url,
                        position_max,
                        pages_scraped,
                        len(teams),
                        len(unique_combo_keys),
                        notes,
                    ),
                )
                snapshot_id = cur.fetchone()[0]

                rows = [
                    (
                        snapshot_id,
                        team['combo_key'],
                        team['hero_ids'],
                        team['hero_names'],
                        team.get('pet'),
                        team.get('pet_name'),
                        team.get('banner'),
                        team.get('popularity_count'),
                        team.get('row_rank'),
                        team.get('page_number', 1),
                    )
                    for team in teams
                ]

                psycopg2.extras.execute_batch(
                    cur,
                    '''
                    INSERT INTO meta_teams (
                        snapshot_id, combo_key, hero_ids, hero_names, pet, pet_name,
                        banner, popularity_count, row_rank, page_number
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (snapshot_id, row_rank) DO UPDATE SET
                        combo_key = EXCLUDED.combo_key,
                        hero_ids = EXCLUDED.hero_ids,
                        hero_names = EXCLUDED.hero_names,
                        pet = EXCLUDED.pet,
                        pet_name = EXCLUDED.pet_name,
                        banner = EXCLUDED.banner,
                        popularity_count = EXCLUDED.popularity_count,
                        page_number = EXCLUDED.page_number
                    ''',
                    rows,
                    page_size=200,
                )

        return snapshot_id
    finally:
        conn.close()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Scrape hw-recruit arena teams into PostgreSQL meta snapshots')
    parser.add_argument('--position', type=int, default=10, help='Max arena position filter')
    parser.add_argument('--server-min', default='', help='Server min filter (hw-recruit server param)')
    parser.add_argument('--server-max', '--server-1', dest='server_max', default='', help='Server max filter (hw-recruit server_1 param)')
    parser.add_argument('--max-page', type=int, default=0, help='Max pages to scrape (0 = until empty)')
    parser.add_argument('--delay', type=float, default=1.0, help='Delay between page requests in seconds')
    parser.add_argument('--base-url', default=DEFAULT_BASE_URL, help='hw-recruit arena base URL')
    parser.add_argument('--notes', default='', help='Optional note stored on the snapshot row')
    parser.add_argument('--dry-run', action='store_true', help='Scrape only; do not write to PostgreSQL')
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    source_url = build_page_url(
        args.base_url,
        args.position,
        1,
        server_min=args.server_min,
        server_max=args.server_max,
    )
    notes = args.notes or None
    if args.server_max:
        server_note = f'server_1={args.server_max}'
        notes = f'{notes}; {server_note}' if notes else server_note

    print('[INFO] Starting hw-recruit meta team scrape')
    print(
        f'[INFO] server={args.server_min or "*"} server_1={args.server_max or "*"} '
        f'position={args.position}, max_page={args.max_page or "all"}, '
        f'database={get_database_url().split("@")[-1]}'
    )
    print()

    teams, pages_scraped = scrape_all_teams(
        args.base_url,
        args.position,
        args.max_page,
        args.delay,
        server_min=args.server_min,
        server_max=args.server_max,
    )

    if not teams:
        print('[ERROR] No teams scraped')
        return

    unique_combos = len({team['combo_key'] for team in teams})
    print()
    print('=' * 60)
    print('SCRAPE RESULTS')
    print('=' * 60)
    print(f'Pages scraped: {pages_scraped}')
    print(f'Total teams: {len(teams)}')
    print(f'Unique combos: {unique_combos}')
    print()
    print('Top 5 by popularity:')
    for team in sorted(teams, key=lambda t: t.get('popularity_count') or 0, reverse=True)[:5]:
        heroes = ', '.join(team['hero_names'])
        print(f"  #{team.get('row_rank')} {heroes} — count {team.get('popularity_count')}")

    if args.dry_run:
        print()
        print('[INFO] Dry run complete — nothing written to database')
        return

    snapshot_id = save_snapshot_to_db(
        teams,
        source_url=source_url,
        position_max=args.position,
        pages_scraped=pages_scraped,
        notes=notes,
    )

    print()
    print(f'[SUCCESS] Saved snapshot {snapshot_id} with {len(teams)} meta teams')
    print('[INFO] View snapshots: GET http://127.0.0.1:9876/training/meta-snapshots')
    print(f'[INFO] View teams: GET http://127.0.0.1:9876/training/meta-teams?snapshotId={snapshot_id}')


if __name__ == '__main__':
    main()
