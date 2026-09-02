import type { Role } from './types';

export function canEditLibrary(role: Role): boolean {
  return role === 'editor' || role === 'admin';
}

export function roleLabel(role: Role): string {
  if (role === 'admin') return 'Админ';
  if (role === 'editor') return 'Редактор';
  return 'Слушатель';
}

export function isRole(value: string): value is Role {
  return value === 'listener' || value === 'editor' || value === 'admin';
}
