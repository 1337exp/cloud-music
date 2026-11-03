#!/usr/bin/env node
/**
 * Screenshots for the README, in English and Russian: the library with the player, a playlist and the phone layout.
 *
 *   npm run screenshot
 *
 * Needs Bun (the server and the demo seed run on it) and Chrome or Edge (driven through playwright-core, nothing is
 * downloaded). Everything happens in a temporary folder: a made-up library, its own database and a random demo
 * password, on spare ports, so your real collection is never touched. The folder is removed at the end.
 * Output: docs/media/{library,playlist,mobile}-{en,ru}.png
 */
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'docs', 'media');
const API_PORT = 8791;
const WEB_PORT = 5194;
const USER = 'demo';
const PASSWORD = randomUUID().slice(0, 13);

mkdirSync(OUT, { recursive: true });
const work = mkdtempSync(join(tmpdir(), 'cloud-music-shots-'));
const env = {
  ...process.env,
  DATA_DIR: join(work, 'data'),
  MUSIC_DIR: join(work, 'music'),
  DEMO_USER: USER,
  DEMO_PASSWORD: PASSWORD,
};

const children = [];

async function waitFor(url, ms = 30000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Nothing came up at ${url}`);
}

function start(command, args, extraEnv) {
  const child = spawn(command, args, { cwd: ROOT, env: { ...env, ...extraEnv }, stdio: 'ignore' });
  children.push(child);
  return child;
}

async function launch() {
  for (const channel of ['chrome', 'msedge']) {
    try {
      return await chromium.launch({ channel, args: ['--autoplay-policy=no-user-gesture-required'] });
    } catch {
      // try the next one
    }
  }
  throw new Error('Neither Chrome nor Edge could be launched');
}

async function main() {
  const seed = spawnSync('bun', ['src/tools/demo-seed.ts'], { cwd: ROOT, env, stdio: ['ignore', 'ignore', 'inherit'] });
  if (seed.status !== 0) throw new Error('The demo seed failed (is Bun installed?)');

  start('bun', ['src/server/index.ts'], { PORT: String(API_PORT), HOST: '127.0.0.1' });
  await waitFor(`http://127.0.0.1:${API_PORT}/api/health`);

  const vite = join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
  start(
    process.execPath,
    [vite, '--config', 'src/client/vite.config.ts', '--port', String(WEB_PORT), '--strictPort'],
    { MH_API_URL: `http://127.0.0.1:${API_PORT}` },
  );
  const url = `http://localhost:${WEB_PORT}`;
  await waitFor(url);

  const browser = await launch();
  try {
    for (const lang of ['en', 'ru']) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
      await context.addInitScript((value) => {
        localStorage.setItem('mh-lang', value);
        localStorage.setItem('mh-volume', '0.7');
      }, lang);
      const page = await context.newPage();

      const shot = async (name) => {
        await page.waitForTimeout(600);
        await page.screenshot({ path: join(OUT, `${name}-${lang}.png`) });
        console.log(`docs/media/${name}-${lang}.png`);
      };

      // The player listens for keys on the window: a few arrows seek, Space pauses where the shot is taken.
      const playAndFreeze = async (seekSteps) => {
        await page.locator('[data-row]').nth(2).click();
        await page.waitForFunction(() => document.querySelector('.player .play')?.getAttribute('aria-label') !== null);
        await page.waitForTimeout(500);
        for (let i = 0; i < seekSteps; i += 1) await page.keyboard.press('ArrowRight');
        await page.keyboard.press('Space');
      };

      await page.goto(`${url}/login`);
      await page.locator('input[autocomplete="username"]').fill(USER);
      await page.locator('input[type="password"]').fill(PASSWORD);
      await page.locator('button[type="submit"]').click();
      await page.waitForSelector('[data-row]');
      await page.locator('.page-head h1').hover();

      await playAndFreeze(14);
      await shot('library');

      await page.getByRole('link', { name: lang === 'ru' ? 'Плейлисты' : 'Playlists' }).first().click();
      await page.locator('.grid').getByText('Evening drive').first().click();
      await page.waitForSelector('[data-row]');
      await page.mouse.move(640, 20);
      await shot('playlist');

      // The phone: the library with the bottom tabs and the compact player.
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(url);
      await page.waitForSelector('[data-row]');
      await page.locator('[data-row]').nth(2).click();
      await page.waitForTimeout(500);
      await page.keyboard.press('Space');
      await page.mouse.move(2, 2);
      await shot('mobile');

      await context.close();
    }
  } finally {
    await browser.close();
  }
}

try {
  await main();
} finally {
  for (const child of children) child.kill();
  // give Windows a moment to release the database file before the folder goes
  await new Promise((r) => setTimeout(r, 800));
  rmSync(work, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
}
