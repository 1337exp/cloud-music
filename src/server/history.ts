import { HISTORY_LIMIT } from '../shared/constants';
import type { HistoryItem } from '../shared/types';
import { getDb, nowSeconds } from './db';
import type { TrackRow } from './models';
import { hydrateTracks } from './tracks';

export function recordPlay(userId: number, trackId: number): void {
  const db = getDb();
  const last = db
    .query('SELECT track_id FROM play_history WHERE user_id = ? ORDER BY played_at DESC, id DESC LIMIT 1')
    .get(userId) as { track_id: number } | null;

  if (last?.track_id === trackId) {
    return;
  }

  db.run('INSERT INTO play_history (user_id, track_id, played_at) VALUES (?, ?, ?)', [
    userId,
    trackId,
    nowSeconds(),
  ]);

  db.run(
    `DELETE FROM play_history
     WHERE user_id = ?
       AND id NOT IN (
         SELECT id FROM play_history WHERE user_id = ? ORDER BY played_at DESC, id DESC LIMIT ?
       )`,
    [userId, userId, HISTORY_LIMIT],
  );
}

export function listHistory(userId: number): HistoryItem[] {
  const rows = getDb()
    .query(
      `SELECT h.id as history_id, h.played_at as played_at, t.*
       FROM play_history h
       JOIN tracks t ON t.id = h.track_id
       WHERE h.user_id = ?
       ORDER BY h.played_at DESC, h.id DESC
       LIMIT ?`,
    )
    .all(userId, HISTORY_LIMIT) as Array<TrackRow & { history_id: number; played_at: number }>;

  const tracks = hydrateTracks(rows);
  return rows.map((row, index) => ({
    id: row.history_id,
    playedAt: row.played_at,
    track: tracks[index]!,
  }));
}
