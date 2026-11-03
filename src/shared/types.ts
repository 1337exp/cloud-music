export type Role = 'listener' | 'editor' | 'admin';

export interface UserPublic {
  id: number;
  username: string;
  role: Role;
}

export interface Tag {
  id: number;
  name: string;
}

export interface Track {
  id: number;
  title: string;
  artist: string;
  album: string;
  durationMs: number;
  year: number | null;
  hasCover: boolean;
  createdAt: number;
  updatedAt: number;
  tags: Tag[];
}

export type TrackSortKey = 'title' | 'artist' | 'album' | 'createdAt' | 'duration';
export type SortDir = 'asc' | 'desc';

export interface TrackListResponse {
  items: Track[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TrackIdsResponse {
  ids: number[];
}

export interface PlaylistSummary {
  id: number;
  title: string;
  trackCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface PlaylistDetail extends PlaylistSummary {
  tracks: Track[];
}

export interface HistoryItem {
  id: number;
  playedAt: number;
  track: Track;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  user: UserPublic;
}

export interface DuplicateTrackError {
  error: 'duplicate';
  message: string;
  track: Track;
}

export interface ApiErrorBody {
  error: string;
  message: string;
}

export interface UploadResult {
  added: Track[];
  duplicates: Array<{ fileName: string; track: Track }>;
  failed: Array<{ fileName: string; message: string }>;
}

export interface ReindexResult {
  scanned: number;
  added: number;
  updated: number;
  duplicates: number;
  pruned: number;
  failed: number;
}
