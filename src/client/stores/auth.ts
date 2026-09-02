import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { LoginResponse, UserPublic } from '@shared/types';
import { canEditLibrary } from '@shared/roles';
import { api, setUnauthorizedHandler } from '../http';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserPublic | null>(null);
  const ready = ref(false);
  let boot: Promise<void> | null = null;

  const isEditor = computed(() => (user.value ? canEditLibrary(user.value.role) : false));

  setUnauthorizedHandler(() => {
    user.value = null;
  });

  async function bootstrap(): Promise<void> {
    if (boot) {
      return boot;
    }

    boot = (async () => {
      try {
        const data = await api<{ user: UserPublic }>('/api/auth/me');
        user.value = data.user;
      } catch {
        user.value = null;
      } finally {
        ready.value = true;
      }
    })();

    return boot;
  }

  async function login(username: string, password: string): Promise<void> {
    const data = await api<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    user.value = data.user;
    ready.value = true;
  }

  async function logout(): Promise<void> {
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } finally {
      user.value = null;
    }
  }

  return { user, ready, isEditor, bootstrap, login, logout };
});
