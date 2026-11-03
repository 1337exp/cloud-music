import { MAX_PLAYLISTS_PER_USER } from '../shared/constants';
import type { PlaylistDetail, PlaylistSummary, Track } from '../shared/types';
import { getDb, nowSeconds } from './db';
import type { TrackRow } from './models';
import { hydrateTracks } from './tracks';
import { AppError } from './messages';

interface PlaylistRow {
  id: number;
  user_id: number;
  title: string;
  created_at: number;
  updated_at: number;
}

function countTracks(playlistId: number): number {
  const row = getDb()
    .query('SELECT COUNT(*) as n FROM playlist_tracks WHERE playlist_id = ?')
    .get(playlistId) as { n: number };
  return row.n;
}

export function listPlaylists(userId: number): PlaylistSummary[] {
  const rows = getDb()
    .query('SELECT * FROM playlists WHERE user_id = ? ORDER BY updated_at DESC, id DESC')
    .all(userId) as PlaylistRow[];

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    trackCount: countTracks(row.id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export function getOwnedPlaylist(userId: number, playlistId: number): PlaylistRow | null {
  return (
    (getDb()
      .query('SELECT * FROM playlists WHERE id = ? AND user_id = ?')
      .get(playlistId, userId) as PlaylistRow | null) ?? null
  );
}

export function playlistTracks(playlistId: number): Track[] {
  const rows = getDb()
    .query(
      `SELECT t.*
       FROM playlist_tracks pt
       JOIN tracks t ON t.id = pt.track_id
       WHERE pt.playlist_id = ?
       ORDER BY pt.position ASC, t.title COLLATE NOCASE`,
    )
    .all(playlistId) as TrackRow[];

  return hydrateTracks(rows);
}

export function getPlaylistDetail(userId: number, playlistId: number): PlaylistDetail | null {
  const row = getOwnedPlaylist(userId, playlistId);
  if (!row) {
    return null;
  }

  const tracks = playlistTracks(playlistId);
  return {
    id: row.id,
    title: row.title,
    trackCount: tracks.length,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tracks,
  };
}

export function createPlaylist(userId: number, title: string): PlaylistSummary {
  const name = title.trim();
  if (!name) {
    throw new AppError('playlistTitleEmpty');
  }

  const db = getDb();
  const count = db.query('SELECT COUNT(*) as n FROM playlists WHERE user_id = ?').get(userId) as { n: number };
  if (count.n >= MAX_PLAYLISTS_PER_USER) {
    throw new AppError('playlistLimit', { n: MAX_PLAYLISTS_PER_USER });
  }

  const ts = nowSeconds();
  const result = db.run('INSERT INTO playlists (user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?)', [
    userId,
    name,
    ts,
    ts,
  ]);

  return {
    id: Number(result.lastInsertRowid),
    title: name,
    trackCount: 0,
    createdAt: ts,
    updatedAt: ts,
  };
}

export function renamePlaylist(userId: number, playlistId: number, title: string): PlaylistSummary | null {
  const row = getOwnedPlaylist(userId, playlistId);
  if (!row) {
    return null;
  }

  const name = title.trim();
  if (!name) {
    throw new AppError('playlistTitleEmpty');
  }

  const ts = nowSeconds();
  getDb().run('UPDATE playlists SET title = ?, updated_at = ? WHERE id = ?', [name, ts, playlistId]);
  return {
    id: row.id,
    title: name,
    trackCount: countTracks(row.id),
    createdAt: row.created_at,
    updatedAt: ts,
  };
}

export function deletePlaylist(userId: number, playlistId: number): boolean {
  const row = getOwnedPlaylist(userId, playlistId);
  if (!row) {
    return false;
  }
  getDb().run('DELETE FROM playlists WHERE id = ?', [playlistId]);
  return true;
}

export function addTrackToPlaylist(userId: number, playlistId: number, trackId: number): boolean {
  const playlist = getOwnedPlaylist(userId, playlistId);
  if (!playlist) {
    return false;
  }

  const db = getDb();
  const exists = db.query('SELECT 1 FROM tracks WHERE id = ?').get(trackId);
  if (!exists) {
    throw new AppError('trackNotFound');
  }

  const already = db
    .query('SELECT 1 FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?')
    .get(playlistId, trackId);
  if (already) {
    return true;
  }

  const pos = db
    .query('SELECT COALESCE(MAX(position), 0) as n FROM playlist_tracks WHERE playlist_id = ?')
    .get(playlistId) as { n: number };

  db.run('INSERT INTO playlist_tracks (playlist_id, track_id, position) VALUES (?, ?, ?)', [
    playlistId,
    trackId,
    pos.n + 1,
  ]);
  db.run('UPDATE playlists SET updated_at = ? WHERE id = ?', [nowSeconds(), playlistId]);
  return true;
}

export function removeTrackFromPlaylist(userId: number, playlistId: number, trackId: number): boolean {
  const playlist = getOwnedPlaylist(userId, playlistId);
  if (!playlist) {
    return false;
  }

  getDb().run('DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?', [playlistId, trackId]);
  getDb().run('UPDATE playlists SET updated_at = ? WHERE id = ?', [nowSeconds(), playlistId]);
  return true;
}

export function reorderPlaylistTracks(userId: number, playlistId: number, trackIds: number[]): PlaylistDetail | null {
  const playlist = getOwnedPlaylist(userId, playlistId);
  if (!playlist) {
    return null;
  }

  const current = getDb()
    .query('SELECT track_id FROM playlist_tracks WHERE playlist_id = ?')
    .all(playlistId) as Array<{ track_id: number }>;
  const currentIds = current.map((row) => row.track_id).sort((a, b) => a - b);
  const nextIds = [...trackIds].sort((a, b) => a - b);

  if (
    currentIds.length !== nextIds.length ||
    currentIds.some((id, i) => id !== nextIds[i]) ||
    new Set(trackIds).size !== trackIds.length
  ) {
    throw new AppError('playlistOrderMismatch');
  }

  const db = getDb();
  const tx = db.transaction(() => {
    for (const [i, trackId] of trackIds.entries()) {
      db.run('UPDATE playlist_tracks SET position = ? WHERE playlist_id = ? AND track_id = ?', [
        i + 1,
        playlistId,
        trackId,
      ]);
    }
    db.run('UPDATE playlists SET updated_at = ? WHERE id = ?', [nowSeconds(), playlistId]);
  });
  tx();

  return getPlaylistDetail(userId, playlistId);
}
