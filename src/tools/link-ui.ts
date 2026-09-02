import { existsSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const dest = resolve(import.meta.dir, '../../node_modules/@1337exp/taoui');
const src = resolve(import.meta.dir, '../../../../git/taoui');

if (existsSync(join(src, 'package.json')) && existsSync(join(dest, 'package.json'))) {
  process.exit(0);
}

if (!existsSync(join(src, 'package.json'))) {
  console.warn('Tao UI не найден по пути', src);
  process.exit(0);
}

if (existsSync(dest) && !existsSync(join(dest, 'package.json'))) {
  rmSync(dest, { recursive: true, force: true });
}

if (process.platform === 'win32') {
  const result = Bun.spawnSync(['cmd', '/c', 'mklink', '/J', dest, src], {
    stdout: 'inherit',
    stderr: 'inherit',
  });
  process.exit(result.exitCode);
}

const result = Bun.spawnSync(['ln', '-s', src, dest], {
  stdout: 'inherit',
  stderr: 'inherit',
});
process.exit(result.exitCode);
