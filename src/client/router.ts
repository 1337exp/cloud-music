import { createRouter, createWebHistory } from 'vue-router';
import { canEditLibrary } from '@shared/roles';
import { useAuthStore } from './stores/auth';
import LoginView from './views/LoginView.vue';
import AppShell from './components/AppShell.vue';
import LibraryView from './views/LibraryView.vue';
import PlaylistsView from './views/PlaylistsView.vue';
import PlaylistView from './views/PlaylistView.vue';
import HistoryView from './views/HistoryView.vue';
import UploadView from './views/UploadView.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: LoginView, meta: { public: true } },
    {
      path: '/',
      component: AppShell,
      children: [
        { path: '', name: 'library', component: LibraryView },
        { path: 'playlists', name: 'playlists', component: PlaylistsView },
        { path: 'playlists/:id', name: 'playlist', component: PlaylistView },
        { path: 'history', name: 'history', component: HistoryView },
        { path: 'upload', name: 'upload', component: UploadView, meta: { editor: true } },
      ],
    },
  ],
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  await auth.bootstrap();

  if (!auth.user && to.name !== 'login') {
    return { name: 'login' };
  }

  if (auth.user && to.name === 'login') {
    return { name: 'library' };
  }

  if (to.meta.editor && auth.user && !canEditLibrary(auth.user.role)) {
    return { name: 'library' };
  }

  return true;
});
