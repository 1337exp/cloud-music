import { existsSync } from 'node:fs';
import { readdir, unlink } from 'node:fs/promises';
import { extname, isAbsolute, join, parse, relative, resolve, sep } from 'node:path';
import { parseFile } from 'music-metadata';
import { AUDIO_EXTENSIONS } from '../shared/constants';
import type { ReindexResult, Track } from '../shared/types';
import { COVERS_DIR, MUSIC_DIRS, UPLOAD_DIR } from './config';
import { getDb, nowSeconds } from './db';
import type { TrackRow } from './models';
import { deleteUnusedTags, hydrateTracks } from './tracks';

const AUDIO_SET = new Set<string>(AUDIO_EXTENSIONS);

const MIME_BY_EXT: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.flac': 'audio/flac',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.aiff': 'audio/aiff',
  '.aif': 'audio/aiff',
  '.wma': 'audio/x-ms-wma',
  '.webm': 'audio/webm',
};

export function isAudioFile(filePath: string): boolean {
  return AUDIO_SET.has(extname(filePath).toLowerCase());
}

export function mimeFromPath(filePath: string): string {
  return MIME_BY_EXT[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

export function toStoredPath(absPath: string): string {
  return resolve(absPath).split(sep).join('/');
}

function relativeToLibraries(absPath: string): string[] {
  const aliases: string[] = [];
  for (const dir of MUSIC_DIRS) {
    const rel = relative(dir, absPath);
    if (rel && !rel.startsWith('..') && !isAbsolute(rel)) {
      aliases.push(rel.split(sep).join('/'));
    }
  }
  return aliases;
}

export function absFromStored(stored: string): string {
  const asNative = stored.split('/').join(sep);
  if (isAbsolute(asNative)) {
    return resolve(asNative);
  }

  for (const dir of MUSIC_DIRS) {
    const candidate = join(dir, stored);
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return join(MUSIC_DIRS[0] ?? UPLOAD_DIR, stored);
}

/** @deprecated имя для старых импортов — путь из БД, в т.ч. с другого диска */
export const absFromRelative = absFromStored;

export async function hashFile(filePath: string): Promise<string> {
  const hasher = new Bun.CryptoHasher('sha256');
  const reader = Bun.file(filePath).stream().getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    hasher.update(value);
  }

  return hasher.digest('hex');
}

export function coverPathForHash(hash: string): string | null {
  const jpg = join(COVERS_DIR, `${hash}.jpg`);
  const png = join(COVERS_DIR, `${hash}.png`);
  if (existsSync(jpg)) return jpg;
  if (existsSync(png)) return png;
  return null;
}

async function saveCover(hash: string, data: Uint8Array, format: string): Promise<boolean> {
  const ext = format.toLowerCase().includes('png') ? '.png' : '.jpg';
  const target = join(COVERS_DIR, `${hash}${ext}`);
  await Bun.write(target, data);
  return true;
}

export interface ExtractedMeta {
  title: string;
  artist: string;
  album: string;
  year: number | null;
  durationMs: number;
  mimeType: string;
  hasCover: boolean;
}

export async function extractMetadata(filePath: string, hash: string): Promise<ExtractedMeta> {
  const fallbackTitle = parse(filePath).name;
  const mimeType = mimeFromPath(filePath);

  try {
    const meta = await parseFile(filePath, { duration: true });
    const picture = meta.common.picture?.[0];
    let hasCover = false;

    if (picture?.data?.length) {
      hasCover = await saveCover(hash, picture.data, picture.format || '');
    }

    const artists = meta.common.artists?.filter(Boolean) ?? [];
    const artist =
      artists.join(', ') || meta.common.artist || meta.common.albumartist || '';

    return {
      title: meta.common.title?.trim() || fallbackTitle,
      artist: artist.trim(),
      album: (meta.common.album ?? '').trim(),
      year: meta.common.year ?? null,
      durationMs: Math.round((meta.format.duration ?? 0) * 1000),
      mimeType,
      hasCover,
    };
  } catch {
    return {
      title: fallbackTitle,
      artist: '',
      album: '',
      year: null,
      durationMs: 0,
      mimeType,
      hasCover: Boolean(coverPathForHash(hash)),
    };
  }
}

export type IngestStatus = 'added' | 'duplicate' | 'updated';

export interface IngestResult {
  status: IngestStatus;
  track: Track;
  copiedPath?: string;
}

export async function ingestFile(absPath: string): Promise<IngestResult> {
  const db = getDb();
  const hash = await hashFile(absPath);
  const stored = toStoredPath(absPath);
  const size = Bun.file(absPath).size;
  const ts = nowSeconds();

  const byHash = db.query('SELECT * FROM tracks WHERE file_hash = ?').get(hash) as TrackRow | null;
  if (byHash) {
    const sameFile = resolve(absFromStored(byHash.file_path)) === resolve(absPath);
    return {
      status: 'duplicate',
      track: hydrateTracks([byHash])[0]!,
      copiedPath: sameFile ? undefined : absPath,
    };
  }

  const meta = await extractMetadata(absPath, hash);
  let byPath: TrackRow | null = null;
  for (const key of [stored, ...relativeToLibraries(absPath)]) {
    byPath = db.query('SELECT * FROM tracks WHERE file_path = ?').get(key) as TrackRow | null;
    if (byPath) {
      break;
    }
  }

  if (byPath) {
    db.run(
      `UPDATE tracks
       SET title = ?, artist = ?, album = ?, duration_ms = ?, year = ?,
           file_path = ?, file_hash = ?, mime_type = ?, file_size = ?, has_cover = ?, updated_at = ?
       WHERE id = ?`,
      [
        meta.title,
        meta.artist,
        meta.album,
        meta.durationMs,
        meta.year,
        stored,
        hash,
        meta.mimeType,
        size,
        meta.hasCover ? 1 : 0,
        ts,
        byPath.id,
      ],
    );
    const updated = db.query('SELECT * FROM tracks WHERE id = ?').get(byPath.id) as TrackRow;
    return { status: 'updated', track: hydrateTracks([updated])[0]! };
  }

  const result = db.run(
    `INSERT INTO tracks (
      title, artist, album, duration_ms, year, file_path, file_hash, mime_type, file_size, has_cover, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      meta.title,
      meta.artist,
      meta.album,
      meta.durationMs,
      meta.year,
      stored,
      hash,
      meta.mimeType,
      size,
      meta.hasCover ? 1 : 0,
      ts,
      ts,
    ],
  );

  const row = db.query('SELECT * FROM tracks WHERE id = ?').get(Number(result.lastInsertRowid)) as TrackRow;
  return { status: 'added', track: hydrateTracks([row])[0]! };
}

async function walkAudioFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  let entries;

  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }

  for (const entry of entries) {
    if (entry.name.startsWith('.')) {
      continue;
    }
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walkAudioFiles(full)));
    } else if (isAudioFile(full)) {
      out.push(full);
    }
  }

  return out;
}

export async function reindexLibrary(options: { prune?: boolean } = {}): Promise<ReindexResult> {
  const files: string[] = [];
  for (const dir of MUSIC_DIRS) {
    if (!existsSync(dir)) {
      console.warn(`Пропуск: папка музыки не найдена (${dir})`);
      continue;
    }
    files.push(...(await walkAudioFiles(dir)));
  }
  const result: ReindexResult = {
    scanned: files.length,
    added: 0,
    updated: 0,
    duplicates: 0,
    pruned: 0,
    failed: 0,
  };

  for (const file of files) {
    try {
      const ingested = await ingestFile(file);
      if (ingested.status === 'added') result.added += 1;
      else if (ingested.status === 'updated') result.updated += 1;
      else result.duplicates += 1;
    } catch (error) {
      result.failed += 1;
      console.error(`Не удалось проиндексировать ${file}:`, error);
    }
  }

  if (options.prune) {
    const rows = getDb().query('SELECT id, file_path, file_hash FROM tracks').all() as Array<{
      id: number;
      file_path: string;
      file_hash: string;
    }>;

    for (const row of rows) {
      const abs = absFromStored(row.file_path);
      if (!existsSync(abs)) {
        await deleteTrackFiles(row.file_path, row.file_hash);
        getDb().run('DELETE FROM tracks WHERE id = ?', [row.id]);
        result.pruned += 1;
      }
    }

    deleteUnusedTags();
  }

  return result;
}

export async function deleteTrackFiles(storedPath: string, hash: string): Promise<void> {
  const audio = absFromStored(storedPath);
  const cover = coverPathForHash(hash);

  try {
    if (existsSync(audio)) {
      await unlink(audio);
    }
  } catch {
    // ignore
  }

  try {
    if (cover) {
      await unlink(cover);
    }
  } catch {
    // ignore
  }
}

export async function uniqueLibraryPath(fileName: string): Promise<string> {
  const safe = fileName.replace(/[<>:"/\\|?*\u0000]/g, '_').trim() || 'track';
  const parsed = parse(safe);
  const ext = parsed.ext || '.mp3';
  const base = parsed.name || 'track';
  let candidate = join(UPLOAD_DIR, `${base}${ext}`);
  let i = 1;

  while (existsSync(candidate)) {
    candidate = join(UPLOAD_DIR, `${base}-${i}${ext}`);
    i += 1;
  }

  return candidate;
}