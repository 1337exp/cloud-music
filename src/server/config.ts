import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';

export const ROOT = resolve(import.meta.dir, '../..');
const CONFIG_FILE = join(ROOT, 'server.config.json');

interface FileConfig {
  host?: string;
  port?: number;
  dataDir?: string;
  database?: string;
  musicDirs?: string[];
  uploadDir?: string;
}

function readFileConfig(): FileConfig {
  if (!existsSync(CONFIG_FILE)) {
    return {};
  }

  try {
    return JSON.parse(readFileSync(CONFIG_FILE, 'utf8')) as FileConfig;
  } catch (error) {
    console.error(`Не удалось прочитать ${CONFIG_FILE}:`, error);
    return {};
  }
}

function resolvePath(value: string, base = ROOT): string {
  return isAbsolute(value) ? resolve(value) : resolve(base, value);
}

const fileConfig = readFileConfig();

export const HOST = process.env.HOST ?? fileConfig.host ?? '0.0.0.0';
export const PORT = Number(process.env.PORT ?? fileConfig.port ?? 8787);

export const DATA_DIR = resolvePath(process.env.DATA_DIR ?? fileConfig.dataDir ?? './data');

const databaseName = fileConfig.database ?? 'music.db';
export const DB_PATH = process.env.DB_PATH
  ? resolvePath(process.env.DB_PATH)
  : isAbsolute(databaseName)
    ? resolve(databaseName)
    : join(DATA_DIR, databaseName);

export const COVERS_DIR = join(DATA_DIR, 'covers');
export const JWT_SECRET_FILE = join(DATA_DIR, '.jwt-secret');

const fromEnvMusic = process.env.MUSIC_DIR?.trim();
const rawMusicDirs = fromEnvMusic
  ? [fromEnvMusic]
  : fileConfig.musicDirs?.length
    ? fileConfig.musicDirs
    : ['./data/music'];

export const MUSIC_DIRS = [...new Set(rawMusicDirs.map((dir) => resolvePath(dir)))];
export const UPLOAD_DIR = resolvePath(fileConfig.uploadDir ?? MUSIC_DIRS[0] ?? join(DATA_DIR, 'music'));
/** Каталог загрузки и первый корень библиотеки. */
export const MUSIC_DIR = UPLOAD_DIR;

export function ensureDataDirs(): void {
  mkdirSync(DATA_DIR, { recursive: true });
  mkdirSync(COVERS_DIR, { recursive: true });

  for (const dir of new Set([UPLOAD_DIR, ...MUSIC_DIRS])) {
    try {
      mkdirSync(dir, { recursive: true });
    } catch (error) {
      console.warn(`Папка музыки недоступна (${dir}):`, error);
    }
  }
}
