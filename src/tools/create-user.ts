import { isRole, roleLabel } from '../shared/roles';
import { createUserAccount } from '../server/auth';
import { getDb } from '../server/db';

getDb();

const argv = Bun.argv.slice(2);
const force = argv.includes('--force');
const args = argv.filter((item) => item !== '--force');
const [username, password, roleRaw] = args;

if (!username || !password || !roleRaw) {
  console.log(`Создание пользователя (регистрация только через этот скрипт).

Использование:
  bun run user:create <логин> <пароль> <роль>
  bun run user:create <логин> <пароль> <роль> --force

Роли: listener | editor | admin
  listener  — слушает, плейлисты, история
  editor    — то же + загрузка, удаление, правки треков
  admin     — все права редактора

--force  обновить пароль и роль, если логин уже есть
`);
  process.exit(1);
}

if (!isRole(roleRaw)) {
  console.error(`Неизвестная роль «${roleRaw}». Допустимы: listener, editor, admin`);
  process.exit(1);
}

try {
  const user = await createUserAccount(username, password, roleRaw, { force });
  console.log(`Готово: ${user.username} (${roleLabel(user.role)}), id=${user.id}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
