import { ensureDataDirs, MUSIC_DIRS } from '../server/config';
import { getDb } from '../server/db';
import { reindexLibrary } from '../server/indexer';

ensureDataDirs();
getDb();

const prune = Bun.argv.includes('--prune');

console.log(`Индексация: ${MUSIC_DIRS.join(', ')}`);
if (prune) {
  console.log('Режим --prune: записи без файла на диске будут удалены');
}

const result = await reindexLibrary({ prune });

console.log(`Просмотрено файлов: ${result.scanned}`);
console.log(`Добавлено:          ${result.added}`);
console.log(`Обновлено:          ${result.updated}`);
console.log(`Уже были (хеш):     ${result.duplicates}`);
console.log(`Удалено из БД:      ${result.pruned}`);
console.log(`Ошибок:             ${result.failed}`);
