import type { MiddlewareHandler } from 'hono';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { SignJWT, jwtVerify } from 'jose';
import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { JWT_EXPIRES, SESSION_COOKIE, SESSION_TTL_SECONDS } from '../shared/constants';
import { canEditLibrary } from '../shared/roles';
import type { Role, UserPublic } from '../shared/types';
import { JWT_SECRET_FILE, ensureDataDirs } from './config';
import { getDb, nowSeconds } from './db';
import type { UserRow } from './models';
import { fail } from './messages';

export type AppVars = {
  Variables: {
    user: UserPublic;
  };
};

let secretKey: Uint8Array | null = null;

function getSecretKey(): Uint8Array {
  if (secretKey) {
    return secretKey;
  }

  const fromEnv = process.env.JWT_SECRET?.trim();
  if (fromEnv && fromEnv.length >= 16) {
    secretKey = new TextEncoder().encode(fromEnv);
    return secretKey;
  }

  ensureDataDirs();
  if (existsSync(JWT_SECRET_FILE)) {
    secretKey = new Uint8Array(readFileSync(JWT_SECRET_FILE));
    return secretKey;
  }

  const generated = crypto.getRandomValues(new Uint8Array(32));
  writeFileSync(JWT_SECRET_FILE, generated);
  secretKey = generated;
  return secretKey;
}

export async function signSession(user: UserPublic): Promise<string> {
  return new SignJWT({
    id: user.id,
    username: user.username,
    role: user.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRES)
    .sign(getSecretKey());
}

export async function verifySession(token: string): Promise<UserPublic> {
  const { payload } = await jwtVerify(token, getSecretKey());
  const id = Number(payload.id ?? payload.sub);
  const username = String(payload.username ?? '');
  const role = payload.role as Role;

  if (!id || !username || !role) {
    throw new Error('Invalid token');
  }

  return { id, username, role };
}

export function setSessionCookie(c: Context, token: string): void {
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    path: '/',
    sameSite: 'Lax',
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearSessionCookie(c: Context): void {
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
}

export const requireAuth: MiddlewareHandler<AppVars> = async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) {
    return fail(c, 401, 'unauthorized', 'needAuth');
  }

  try {
    const session = await verifySession(token);
    const row = getDb()
      .query('SELECT id, username, role FROM users WHERE id = ?')
      .get(session.id) as Pick<UserRow, 'id' | 'username' | 'role'> | null;

    if (!row) {
      clearSessionCookie(c);
      return fail(c, 401, 'unauthorized', 'needAuth');
    }

    c.set('user', { id: row.id, username: row.username, role: row.role });
    await next();
  } catch {
    clearSessionCookie(c);
    return fail(c, 401, 'unauthorized', 'needAuth');
  }
};

export const requireEditor: MiddlewareHandler<AppVars> = async (c, next) => {
  const user = c.get('user');
  if (!canEditLibrary(user.role)) {
    return fail(c, 403, 'forbidden', 'forbidden');
  }
  await next();
};

export async function createUserAccount(
  username: string,
  password: string,
  role: Role,
  options: { force?: boolean } = {},
): Promise<UserPublic> {
  const name = username.trim();
  if (name.length < 2 || name.length > 32) {
    throw new Error('Логин: от 2 до 32 символов');
  }
  if (password.length < 6) {
    throw new Error('Пароль: минимум 6 символов');
  }

  const db = getDb();
  const existing = db.query('SELECT id FROM users WHERE username = ?').get(name) as { id: number } | null;
  const hash = await Bun.password.hash(password, { algorithm: 'argon2id' });
  const ts = nowSeconds();

  if (existing) {
    if (!options.force) {
      throw new Error(`Пользователь «${name}» уже существует. Передайте --force, чтобы обновить.`);
    }
    db.run('UPDATE users SET password_hash = ?, role = ? WHERE id = ?', [hash, role, existing.id]);
    return { id: existing.id, username: name, role };
  }

  const result = db.run('INSERT INTO users (username, password_hash, role, created_at) VALUES (?, ?, ?, ?)', [
    name,
    hash,
    role,
    ts,
  ]);

  return { id: Number(result.lastInsertRowid), username: name, role };
}

export async function authenticate(username: string, password: string): Promise<UserPublic | null> {
  const row = getDb().query('SELECT * FROM users WHERE username = ?').get(username.trim()) as UserRow | null;
  if (!row) {
    return null;
  }

  const ok = await Bun.password.verify(password, row.password_hash);
  if (!ok) {
    return null;
  }

  return { id: row.id, username: row.username, role: row.role };
}
