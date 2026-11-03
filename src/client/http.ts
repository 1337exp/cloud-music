import { lang, t } from './i18n';

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('X-Lang', lang.value);
  const isForm = init.body instanceof FormData;

  if (!isForm && init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(path, {
    ...init,
    headers,
    credentials: 'include',
  });

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await response.json() : null;

  if (response.status === 401 && !path.endsWith('/auth/login')) {
    onUnauthorized?.();
  }

  if (!response.ok) {
    throw new ApiError(response.status, data?.message ?? t('common.requestFailed'), data);
  }

  return data as T;
}
