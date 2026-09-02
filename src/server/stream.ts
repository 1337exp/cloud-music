import { existsSync } from 'node:fs';
import { absFromRelative, coverPathForHash } from './indexer';
import type { TrackRow } from './models';

export function audioResponse(row: TrackRow, rangeHeader: string | undefined): Response {
  const abs = absFromRelative(row.file_path);
  if (!existsSync(abs)) {
    return new Response('Файл не найден на диске', { status: 404 });
  }

  const file = Bun.file(abs);
  const size = file.size;
  const mime = row.mime_type || 'application/octet-stream';

  if (!rangeHeader) {
    return new Response(file, {
      headers: {
        'Content-Type': mime,
        'Content-Length': String(size),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'private, max-age=3600',
      },
    });
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match) {
    return new Response('Invalid Range', { status: 416 });
  }

  const start = match[1] ? Number(match[1]) : 0;
  let end = match[2] ? Number(match[2]) : size - 1;

  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start >= size || start > end) {
    return new Response('Range Not Satisfiable', {
      status: 416,
      headers: { 'Content-Range': `bytes */${size}` },
    });
  }

  end = Math.min(end, size - 1);
  const chunkSize = end - start + 1;

  return new Response(file.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': mime,
      'Content-Length': String(chunkSize),
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, max-age=3600',
    },
  });
}

export function coverResponse(row: TrackRow): Response {
  const cover = coverPathForHash(row.file_hash);
  if (cover) {
    return new Response(Bun.file(cover), {
      headers: {
        'Cache-Control': 'private, max-age=86400',
      },
    });
  }

  const title = escapeXml(row.title || 'Трек');
  const artist = escapeXml(row.artist || '');
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#2a2416"/>
      <stop offset="100%" stop-color="#141414"/>
    </linearGradient>
  </defs>
  <rect width="400" height="400" fill="url(#g)"/>
  <circle cx="200" cy="168" r="54" fill="none" stroke="#ffdb4d" stroke-width="6"/>
  <circle cx="200" cy="168" r="10" fill="#ffdb4d"/>
  <text x="200" y="270" text-anchor="middle" fill="#f2f2f2" font-family="Segoe UI, sans-serif" font-size="22">${title}</text>
  <text x="200" y="302" text-anchor="middle" fill="#8a8a8a" font-family="Segoe UI, sans-serif" font-size="16">${artist}</text>
</svg>`;

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
}

function escapeXml(value: string): string {
  return value
    .slice(0, 42)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
