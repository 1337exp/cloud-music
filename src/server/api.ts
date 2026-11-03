import { unlink } from 'node:fs/promises';
import { Hono, type Context } from 'hono';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, MAX_UPLOAD_BYTES } from '../shared/constants';
import type { TrackIdsResponse, TrackListResponse, TrackSortKey, UploadResult } from '../shared/types';
import {
  authenticate,
  clearSessionCookie,
  requireAuth,
  requireEditor,
  setSessionCookie,
  signSession,
  type AppVars,
} from './auth';
import { getDb, nowSeconds } from './db';
import { listHistory, recordPlay } from './history';
import { deleteTrackFiles, ingestFile, isAudioFile, uniqueLibraryPath } from './indexer';
import type { TrackRow } from './models';
import {
  addTrackToPlaylist,
  createPlaylist,
  deletePlaylist,
  getPlaylistDetail,
  listPlaylists,
  removeTrackFromPlaylist,
  renamePlaylist,
  reorderPlaylistTracks,
} from './playlists';
import { errorText, fail, requestLang, tr } from './messages';
import { audioResponse, coverResponse } from './stream';
import { getTrackById, getTrackRowById, hydrateTracks, listTags, syncTrackTags } from './tracks';

export const api = new Hono<AppVars>();

api.get('/health', (c) => c.json({ ok: true }));

api.post('/auth/login', async (c) => {
  const body = await c.req.json().catch(() => null);
  const username = String(body?.username ?? '').trim();
  const password = String(body?.password ?? '');

  if (!username || !password) {
    return fail(c, 400, 'invalid', 'credentialsRequired');
  }

  const user = await authenticate(username, password);
  if (!user) {
    return fail(c, 401, 'invalid', 'badCredentials');
  }

  const token = await signSession(user);
  setSessionCookie(c, token);
  return c.json({ user });
});

const authed = new Hono<AppVars>();
authed.use('*', requireAuth);

authed.get('/auth/me', (c) => c.json({ user: c.get('user') }));

authed.post('/auth/logout', (c) => {
  clearSessionCookie(c);
  return c.json({ ok: true });
});

const SORT_COLUMNS: Record<TrackSortKey, string> = {
  title: 't.title COLLATE NOCASE',
  artist: 't.artist COLLATE NOCASE',
  album: 't.album COLLATE NOCASE',
  createdAt: 't.created_at',
  duration: 't.duration_ms',
};

/** The WHERE part of a collection query (search and tag), shared by the page list and the id list. */
function trackFilter(c: Context): { whereSql: string; params: string[] } {
  const q = (c.req.query('q') ?? '').trim();
  const tag = (c.req.query('tag') ?? '').trim();
  const where: string[] = [];
  const params: string[] = [];

  if (q) {
    const like = `%${q}%`;
    where.push(
      `(t.title LIKE ? OR t.artist LIKE ? OR t.album LIKE ? OR EXISTS (
          SELECT 1 FROM track_tags tt JOIN tags g ON g.id = tt.tag_id
          WHERE tt.track_id = t.id AND g.name LIKE ?
        ))`,
    );
    params.push(like, like, like, like);
  }

  if (tag) {
    where.push(
      `EXISTS (
        SELECT 1 FROM track_tags tt JOIN tags g ON g.id = tt.tag_id
        WHERE tt.track_id = t.id AND g.name = ? COLLATE NOCASE
      )`,
    );
    params.push(tag);
  }

  return { whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

function trackOrder(c: Context): string {
  const sort = (c.req.query('sort') ?? 'createdAt') as TrackSortKey;
  const dir = c.req.query('dir') === 'asc' ? 'ASC' : 'DESC';
  return `ORDER BY ${SORT_COLUMNS[sort] ?? SORT_COLUMNS.createdAt} ${dir}, t.id DESC`;
}

authed.get('/tracks', (c) => {
  const page = Math.max(1, Number(c.req.query('page') ?? 1) || 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number(c.req.query('pageSize') ?? DEFAULT_PAGE_SIZE) || DEFAULT_PAGE_SIZE),
  );
  const { whereSql, params } = trackFilter(c);
  const db = getDb();
  const total = (db.query(`SELECT COUNT(*) as n FROM tracks t ${whereSql}`).get(...params) as { n: number }).n;

  const rows = db
    .query(`SELECT t.* FROM tracks t ${whereSql} ${trackOrder(c)} LIMIT ? OFFSET ?`)
    .all(...params, pageSize, (page - 1) * pageSize) as TrackRow[];

  const payload: TrackListResponse = {
    items: hydrateTracks(rows),
    total,
    page,
    pageSize,
  };

  return c.json(payload);
});

/** Ids of the whole collection in list order: the player queue does not depend on which page is open. */
authed.get('/tracks/ids', (c) => {
  const { whereSql, params } = trackFilter(c);
  const rows = getDb()
    .query(`SELECT t.id as id FROM tracks t ${whereSql} ${trackOrder(c)}`)
    .all(...params) as Array<{ id: number }>;
  const payload: TrackIdsResponse = { ids: rows.map((row) => row.id) };
  return c.json(payload);
});

authed.get('/tracks/:id', (c) => {
  const track = getTrackById(Number(c.req.param('id')));
  if (!track) {
    return fail(c, 404, 'not_found', 'trackNotFound');
  }
  return c.json({ track });
});

authed.get('/tracks/:id/audio', (c) => {
  const row = getTrackRowById(Number(c.req.param('id')));
  if (!row) {
    return fail(c, 404, 'not_found', 'trackNotFound');
  }
  return audioResponse(row, c.req.header('Range'));
});

authed.get('/tracks/:id/cover', (c) => {
  const row = getTrackRowById(Number(c.req.param('id')));
  if (!row) {
    return fail(c, 404, 'not_found', 'trackNotFound');
  }
  return coverResponse(row);
});

authed.patch('/tracks/:id', requireEditor, async (c) => {
  const id = Number(c.req.param('id'));
  const existing = getTrackRowById(id);
  if (!existing) {
    return fail(c, 404, 'not_found', 'trackNotFound');
  }

  const body = await c.req.json().catch(() => null);
  const title = body?.title != null ? String(body.title).trim() : existing.title;
  const artist = body?.artist != null ? String(body.artist) : existing.artist;
  const album = body?.album != null ? String(body.album) : existing.album;
  const year =
    body?.year === null || body?.year === ''
      ? null
      : body?.year != null
        ? Number(body.year)
        : existing.year;

  if (!title) {
    return fail(c, 400, 'invalid', 'titleEmpty');
  }

  getDb().run(
    'UPDATE tracks SET title = ?, artist = ?, album = ?, year = ?, updated_at = ? WHERE id = ?',
    [title, artist.trim(), album.trim(), Number.isFinite(year) ? year : null, nowSeconds(), id],
  );

  if (Array.isArray(body?.tags)) {
    syncTrackTags(
      id,
      body.tags.map((tag: unknown) => String(tag)),
    );
  }

  return c.json({ track: getTrackById(id) });
});

authed.delete('/tracks/:id', requireEditor, async (c) => {
  const id = Number(c.req.param('id'));
  const row = getTrackRowById(id);
  if (!row) {
    return fail(c, 404, 'not_found', 'trackNotFound');
  }

  await deleteTrackFiles(row.file_path, row.file_hash);
  getDb().run('DELETE FROM tracks WHERE id = ?', [id]);
  return c.json({ ok: true });
});

authed.post('/tracks/upload', requireEditor, async (c) => {
  const body = await c.req.parseBody({ all: true });
  const raw = body.files ?? body.file;
  const files = (Array.isArray(raw) ? raw : raw ? [raw] : []).filter(
    (item): item is File => item instanceof File,
  );

  if (!files.length) {
    return fail(c, 400, 'invalid', 'noFiles');
  }

  const lang = requestLang(c);
  const result: UploadResult = { added: [], duplicates: [], failed: [] };

  for (const file of files) {
    try {
      if (file.size > MAX_UPLOAD_BYTES) {
        result.failed.push({ fileName: file.name, message: tr(lang, 'fileTooLarge') });
        continue;
      }

      const target = await uniqueLibraryPath(file.name);
      if (!isAudioFile(target)) {
        result.failed.push({ fileName: file.name, message: tr(lang, 'unsupportedFormat') });
        continue;
      }

      await Bun.write(target, await file.arrayBuffer());
      const ingested = await ingestFile(target);

      if (ingested.status === 'duplicate') {
        if (ingested.copiedPath) {
          try {
            await unlink(ingested.copiedPath);
          } catch {
            // ignore
          }
        }
        result.duplicates.push({ fileName: file.name, track: ingested.track });
      } else {
        result.added.push(ingested.track);
      }
    } catch (error) {
      result.failed.push({
        fileName: file.name,
        message: errorText(c, error, 'processFailed'),
      });
    }
  }

  return c.json(result);
});

authed.get('/tags', (c) => c.json({ tags: listTags() }));

authed.get('/playlists', (c) => c.json({ playlists: listPlaylists(c.get('user').id) }));

authed.post('/playlists', async (c) => {
  const body = await c.req.json().catch(() => null);
  try {
    const playlist = createPlaylist(c.get('user').id, String(body?.title ?? ''));
    return c.json({ playlist }, 201);
  } catch (error) {
    return c.json(
      { error: 'invalid', message: errorText(c, error, 'createFailed') },
      400,
    );
  }
});

authed.get('/playlists/:id', (c) => {
  const playlist = getPlaylistDetail(c.get('user').id, Number(c.req.param('id')));
  if (!playlist) {
    return fail(c, 404, 'not_found', 'playlistNotFound');
  }
  return c.json({ playlist });
});

authed.patch('/playlists/:id', async (c) => {
  const body = await c.req.json().catch(() => null);
  try {
    const playlist = renamePlaylist(c.get('user').id, Number(c.req.param('id')), String(body?.title ?? ''));
    if (!playlist) {
      return fail(c, 404, 'not_found', 'playlistNotFound');
    }
    return c.json({ playlist });
  } catch (error) {
    return c.json(
      { error: 'invalid', message: errorText(c, error, 'saveFailed') },
      400,
    );
  }
});

authed.delete('/playlists/:id', (c) => {
  const ok = deletePlaylist(c.get('user').id, Number(c.req.param('id')));
  if (!ok) {
    return fail(c, 404, 'not_found', 'playlistNotFound');
  }
  return c.json({ ok: true });
});

authed.post('/playlists/:id/tracks', async (c) => {
  const body = await c.req.json().catch(() => null);
  const trackId = Number(body?.trackId);
  if (!trackId) {
    return fail(c, 400, 'invalid', 'trackMissing');
  }

  try {
    const ok = addTrackToPlaylist(c.get('user').id, Number(c.req.param('id')), trackId);
    if (!ok) {
      return fail(c, 404, 'not_found', 'playlistNotFound');
    }
    return c.json({ ok: true });
  } catch (error) {
    return c.json(
      { error: 'invalid', message: errorText(c, error, 'addFailed') },
      400,
    );
  }
});

authed.put('/playlists/:id/tracks/order', async (c) => {
  const body = await c.req.json().catch(() => null);
  const trackIds = Array.isArray(body?.trackIds) ? body.trackIds.map((id: unknown) => Number(id)) : [];
  if (!trackIds.length || trackIds.some((id: number) => !id)) {
    return fail(c, 400, 'invalid', 'badOrder');
  }

  try {
    const playlist = reorderPlaylistTracks(c.get('user').id, Number(c.req.param('id')), trackIds);
    if (!playlist) {
      return fail(c, 404, 'not_found', 'playlistNotFound');
    }
    return c.json({ playlist });
  } catch (error) {
    return c.json(
      { error: 'invalid', message: errorText(c, error, 'orderFailed') },
      400,
    );
  }
});

authed.delete('/playlists/:id/tracks/:trackId', (c) => {
  const ok = removeTrackFromPlaylist(
    c.get('user').id,
    Number(c.req.param('id')),
    Number(c.req.param('trackId')),
  );
  if (!ok) {
    return fail(c, 404, 'not_found', 'playlistNotFound');
  }
  return c.json({ ok: true });
});

authed.get('/history', (c) => c.json({ items: listHistory(c.get('user').id) }));

authed.post('/history', async (c) => {
  const body = await c.req.json().catch(() => null);
  const trackId = Number(body?.trackId);
  const track = getTrackById(trackId);
  if (!track) {
    return fail(c, 404, 'not_found', 'trackNotFound');
  }
  recordPlay(c.get('user').id, trackId);
  return c.json({ ok: true });
});

api.route('/', authed);
