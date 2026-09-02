import { resolve } from 'node:path';

const cwd = resolve(import.meta.dir, '../..');

const server = Bun.spawn(['bun', '--watch', 'src/server/index.ts'], {
  cwd,
  stdout: 'inherit',
  stderr: 'inherit',
  stdin: 'inherit',
});

const client = Bun.spawn(['bun', 'x', 'vite', '--config', 'src/client/vite.config.ts'], {
  cwd,
  stdout: 'inherit',
  stderr: 'inherit',
  stdin: 'inherit',
});

function shutdown() {
  server.kill();
  client.kill();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

const codes = await Promise.all([server.exited, client.exited]);
process.exit(codes.find((code) => code !== 0) ?? 0);
