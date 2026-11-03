/**
 * Fills a throwaway library with made-up tracks, a demo user, playlists and a history: for screenshots and for trying
 * the player on something that is not your own collection.
 *
 *   DATA_DIR=./demo/data MUSIC_DIR=./demo/music bun run demo
 *
 * The demo admin is `demo` with a random password that is printed at the end (DEMO_USER / DEMO_PASSWORD set your own).
 * DATA_DIR and MUSIC_DIR are required, so this never writes into the real library by accident. The tracks are short silent-ish
 * WAV files (a quiet tone) with tags; their durations in the database are made up to look like songs, except for the
 * newest few, which are full length.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

if (!process.env.DATA_DIR || !process.env.MUSIC_DIR) {
  console.error('Set DATA_DIR and MUSIC_DIR to a throwaway folder first, for example:');
  console.error('  DATA_DIR=./demo/data MUSIC_DIR=./demo/music bun run demo');
  process.exit(1);
}

const { MUSIC_DIR, ensureDataDirs } = await import('../server/config');
const { createUserAccount } = await import('../server/auth');
const { getDb } = await import('../server/db');
const { recordPlay } = await import('../server/history');
const { reindexLibrary } = await import('../server/indexer');
const { addTrackToPlaylist, createPlaylist } = await import('../server/playlists');
const { syncTrackTags } = await import('../server/tracks');

const DEMO_USER = process.env.DEMO_USER ?? 'demo';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? crypto.randomUUID().slice(0, 13);
const TRACK_COUNT = 130;
/** The newest tracks (the top of the library) are full-length so a screenshot can show a real progress bar. */
const FULL_LENGTH_TRACKS = 14;

const albums: Array<{ artist: string; album: string; year: number; tag: string }> = [
  { artist: 'Velvet Harbor', album: 'Slow Water', year: 2019, tag: 'ambient' },
  { artist: 'Velvet Harbor', album: 'Night Tides', year: 2021, tag: 'ambient' },
  { artist: 'Paper Satellites', album: 'Small Signals', year: 2017, tag: 'indie' },
  { artist: 'Paper Satellites', album: 'Orbit Notes', year: 2020, tag: 'indie' },
  { artist: 'Glass Meridian', album: 'Neon Atlas', year: 2022, tag: 'synthwave' },
  { artist: 'Glass Meridian', album: 'Afterglow Drive', year: 2023, tag: 'synthwave' },
  { artist: 'The Quiet Orchard', album: 'Windfall', year: 2016, tag: 'folk' },
  { artist: 'Low Tide Club', album: 'Saltwater Sessions', year: 2018, tag: 'jazz' },
  { artist: 'Тихий Сад', album: 'Утренний свет', year: 2020, tag: 'акустика' },
  { artist: 'Тихий Сад', album: 'Дальние поезда', year: 2022, tag: 'акустика' },
  { artist: 'Полярная Станция', album: 'Север внутри', year: 2021, tag: 'ambient' },
  { artist: 'Mira Solenne', album: 'Golden Hour Letters', year: 2024, tag: 'pop' },
];

const titles = [
  'Lantern Season', 'Salt and Static', 'Midnight Cartography', 'Paper Moons', 'The Long Way Home',
  'Glass Rivers', 'Quiet Engines', 'Slow Burn', 'Harbor Lights', 'Last Train to Nowhere', 'Soft Collapse',
  'Fever Dream Cafe', 'Northbound', 'Violet Hour', 'Echo Garden', 'Winter Radio', 'Small Hours', 'Ocean Floor',
  'Honey and Smoke', 'Distant Thunder', 'Weightless', 'Blue Hotel', 'Amber', 'Tin Roof Rain', 'Open Window',
  'Rewind', 'Carousel', 'Static Bloom', 'Low Orbit', 'Sundial', 'Borrowed Time', 'Paper Lanterns', 'Drift',
  'Свет в окне', 'Снег над городом', 'Последний трамвай', 'Тёплый ветер', 'Белая ночь', 'Тишина после дождя',
  'Дорога домой', 'Полярный день', 'Старая плёнка', 'Утро без будильника', 'Огни вдалеке', 'Медленная река',
];

let seed = 7;
function random(): number {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}

function pick<T>(list: T[]): T {
  return list[Math.floor(random() * list.length)]!;
}

/** A RIFF/WAVE file: a quiet sine tone and an INFO list that music-metadata reads as title, artist, album, year. */
function wav(info: Record<string, string>, frequency: number, seconds: number): Uint8Array {
  const rate = 8000;
  const samples = rate * seconds;
  const data = new Uint8Array(samples);
  for (let i = 0; i < samples; i += 1) {
    data[i] = 128 + Math.round(Math.sin((2 * Math.PI * frequency * i) / rate) * 12);
  }

  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  for (const [id, value] of Object.entries(info)) {
    const text = encoder.encode(`${value}\0`);
    const padded = new Uint8Array(text.length + (text.length % 2));
    padded.set(text);
    const chunk = new Uint8Array(8 + padded.length);
    const view = new DataView(chunk.buffer);
    chunk.set(encoder.encode(id), 0);
    view.setUint32(4, text.length, true);
    chunk.set(padded, 8);
    chunks.push(chunk);
  }
  const infoSize = 4 + chunks.reduce((sum, chunk) => sum + chunk.length, 0);

  const total = 12 + 24 + (8 + infoSize) + (8 + data.length);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  let at = 0;
  const text = (value: string) => {
    out.set(encoder.encode(value), at);
    at += value.length;
  };
  text('RIFF');
  view.setUint32(at, total - 8, true);
  at += 4;
  text('WAVE');
  text('fmt ');
  view.setUint32(at, 16, true);
  view.setUint16(at + 4, 1, true);
  view.setUint16(at + 6, 1, true);
  view.setUint32(at + 8, rate, true);
  view.setUint32(at + 12, rate, true);
  view.setUint16(at + 16, 1, true);
  view.setUint16(at + 18, 8, true);
  at += 20;
  text('LIST');
  view.setUint32(at, infoSize, true);
  at += 4;
  text('INFO');
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  text('data');
  view.setUint32(at, data.length, true);
  at += 4;
  out.set(data, at);
  return out;
}

ensureDataDirs();
mkdirSync(MUSIC_DIR, { recursive: true });

const used = new Set<string>();
const planned: Array<{ title: string; tag: string }> = [];
for (let i = 0; i < TRACK_COUNT; i += 1) {
  const album = albums[i % albums.length]!;
  let title = pick(titles);
  while (used.has(`${album.album}/${title}`)) {
    title = pick(titles);
  }
  used.add(`${album.album}/${title}`);
  planned.push({ title, tag: album.tag });
  const file = `${String(i + 1).padStart(3, '0')}.wav`;
  await Bun.write(
    join(MUSIC_DIR, file),
    wav(
      { INAM: title, IART: album.artist, IPRD: album.album, ICRD: String(album.year), IGNR: album.tag },
      180 + (i % 24) * 22,
      i >= TRACK_COUNT - FULL_LENGTH_TRACKS ? 170 + Math.floor(random() * 70) : 2,
    ),
  );
}

const result = await reindexLibrary();
console.log(`Indexed: +${result.added}, ${result.failed} failed`);

const db = getDb();
const ids = (db.query('SELECT id FROM tracks ORDER BY id').all() as Array<{ id: number }>).map((row) => row.id);

// Songs, not two-second beeps: the short files get a made-up length (the player still ends them after two seconds).
for (const id of ids.slice(0, TRACK_COUNT - FULL_LENGTH_TRACKS)) {
  db.run('UPDATE tracks SET duration_ms = ? WHERE id = ?', [(150 + Math.floor(random() * 190)) * 1000, id]);
}
for (const [i, id] of ids.entries()) {
  const tags = [planned[i]?.tag ?? 'pop'];
  if (random() < 0.25) tags.push('favourites');
  syncTrackTags(id, tags);
}

const user = await createUserAccount(DEMO_USER, DEMO_PASSWORD, 'admin', { force: true });

const drive = createPlaylist(user.id, 'Evening drive');
for (const id of ids.slice(8, 24)) addTrackToPlaylist(user.id, drive.id, id);
const focus = createPlaylist(user.id, 'Focus');
for (const id of ids.slice(40, 52)) addTrackToPlaylist(user.id, focus.id, id);
const morning = createPlaylist(user.id, 'Утро');
for (const id of ids.slice(80, 90)) addTrackToPlaylist(user.id, morning.id, id);

for (const id of ids.slice(2, 12)) recordPlay(user.id, id);

console.log(`${ids.length} tracks, 3 playlists, an admin account:`);
console.log(`  login:    ${DEMO_USER}`);
console.log(`  password: ${DEMO_PASSWORD}`);
