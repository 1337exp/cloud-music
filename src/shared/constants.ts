export const ROLES = ['listener', 'editor', 'admin'] as const;

export const MAX_PLAYLISTS_PER_USER = 100;
export const HISTORY_LIMIT = 50;
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;
export const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;
export const SESSION_COOKIE = 'mh_session';
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
export const JWT_EXPIRES = '30d';

export const AUDIO_EXTENSIONS = [
  '.mp3',
  '.flac',
  '.wav',
  '.ogg',
  '.opus',
  '.m4a',
  '.aac',
  '.aiff',
  '.aif',
  '.wma',
  '.webm',
] as const;
