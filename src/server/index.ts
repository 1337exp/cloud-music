import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import { api } from './api';
import { HOST, PORT, ROOT, ensureDataDirs } from './config';
import { getDb } from './db';

ensureDataDirs();
getDb();

const app = new Hono();
app.route('/api', api);

const clientDir = join(ROOT, 'dist/client');
const clientIndex = join(clientDir, 'index.html');

if (existsSync(clientIndex)) {
  app.use('/*', serveStatic({ root: clientDir }));
  app.get('*', async (c) => {
    if (c.req.path.startsWith('/api')) {
      return c.notFound();
    }
    return new Response(Bun.file(clientIndex), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  });
}

console.log(`Облако Музыки: http://127.0.0.1:${PORT}`);

Bun.serve({
  port: PORT,
  hostname: HOST,
  fetch: app.fetch,
});
