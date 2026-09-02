import type { Tag, Track } from '../shared/types';

export interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  role: 'listener' | 'editor' | 'admin';
  created_at: number;
}

export interface TrackRow {
  id: number;
  title: string;
  artist: string;
  album: string;
  duration_ms: number;
  year: number | null;
  file_path: string;
  file_hash: string;
  mime_type: string;
  file_size: number;
  has_cover: number;
  created_at: number;
  updated_at: number;
}

export interface TagRow {
  id: number;
  name: string;
}

export function mapTrack(row: TrackRow, tags: Tag[] = []): Track {
  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
    album: row.album,
    durationMs: row.duration_ms,
    year: row.year,
    hasCover: Boolean(row.has_cover),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tags,
  };
}

export function mapTag(row: TagRow): Tag {
  return { id: row.id, name: row.name };
}
