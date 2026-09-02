import { getDb } from './db';
import { mapTag, type TagRow, type TrackRow } from './models';
import { mapTrack } from './models';
import type { Tag, Track } from '../shared/types';

export function tagsForTracks(trackIds: number[]): Map<number, Tag[]> {
  const map = new Map<number, Tag[]>();
  if (!trackIds.length) {
    return map;
  }

  const placeholders = trackIds.map(() => '?').join(', ');
  const rows = getDb()
    .query(
      `SELECT tt.track_id as track_id, g.id as id, g.name as name
       FROM track_tags tt
       JOIN tags g ON g.id = tt.tag_id
       WHERE tt.track_id IN (${placeholders})
       ORDER BY g.name COLLATE NOCASE`,
    )
    .all(...trackIds) as Array<TagRow & { track_id: number }>;

  for (const row of rows) {
    const list = map.get(row.track_id) ?? [];
    list.push(mapTag(row));
    map.set(row.track_id, list);
  }

  return map;
}

export function hydrateTracks(rows: TrackRow[]): Track[] {
  const tags = tagsForTracks(rows.map((row) => row.id));
  return rows.map((row) => mapTrack(row, tags.get(row.id) ?? []));
}

export function getTrackById(id: number): Track | null {
  const row = getDb().query('SELECT * FROM tracks WHERE id = ?').get(id) as TrackRow | null;
  if (!row) {
    return null;
  }
  return hydrateTracks([row])[0] ?? null;
}

export function getTrackRowById(id: number): TrackRow | null {
  return (getDb().query('SELECT * FROM tracks WHERE id = ?').get(id) as TrackRow | null) ?? null;
}

export function getTrackByHash(hash: string): Track | null {
  const row = getDb().query('SELECT * FROM tracks WHERE file_hash = ?').get(hash) as TrackRow | null;
  if (!row) {
    return null;
  }
  return hydrateTracks([row])[0] ?? null;
}

export function listTags(): Tag[] {
  const rows = getDb().query('SELECT * FROM tags ORDER BY name COLLATE NOCASE').all() as TagRow[];
  return rows.map(mapTag);
}

export function upsertTag(name: string): Tag {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Имя тега пустое');
  }

  const db = getDb();
  db.run('INSERT INTO tags (name) VALUES (?) ON CONFLICT(name) DO NOTHING', [trimmed]);
  const row = db.query('SELECT * FROM tags WHERE name = ? COLLATE NOCASE').get(trimmed) as TagRow;
  return mapTag(row);
}

export function syncTrackTags(trackId: number, names: string[]): Tag[] {
  const unique = [...new Set(names.map((name) => name.trim()).filter(Boolean))];
  const db = getDb();

  db.run('DELETE FROM track_tags WHERE track_id = ?', [trackId]);
  for (const name of unique) {
    const tag = upsertTag(name);
    db.run('INSERT OR IGNORE INTO track_tags (track_id, tag_id) VALUES (?, ?)', [trackId, tag.id]);
  }

  db.run('DELETE FROM tags WHERE id NOT IN (SELECT DISTINCT tag_id FROM track_tags)');
  return tagsForTracks([trackId]).get(trackId) ?? [];
}

export function deleteUnusedTags(): void {
  getDb().run('DELETE FROM tags WHERE id NOT IN (SELECT DISTINCT tag_id FROM track_tags)');
}
