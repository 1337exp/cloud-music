<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RouterView, useRoute, useRouter } from 'vue-router';
import { TaoButton, TaoLink, TaoTag } from '@1337exp/taoui';
import { roleLabel } from '@shared/roles';
import { useAuthStore } from '../stores/auth';
import PlayerBar from './PlayerBar.vue';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
const moreOpen = ref(false);

const links = computed(() => {
  const items = [
    { name: 'library', to: { name: 'library' }, label: 'Коллекция' },
    { name: 'playlists', to: { name: 'playlists' }, label: 'Плейлисты' },
    { name: 'history', to: { name: 'history' }, label: 'История' },
  ];
  if (auth.isEditor) {
    items.push({ name: 'upload', to: { name: 'upload' }, label: 'Загрузка' });
  }
  return items;
});

function isActive(name: string): boolean {
  if (name === 'playlists') {
    return route.name === 'playlists' || route.name === 'playlist';
  }
  return route.name === name;
}

watch(
  () => route.fullPath,
  () => {
    moreOpen.value = false;
  },
);

async function logout() {
  moreOpen.value = false;
  await auth.logout();
  await router.push({ name: 'login' });
}
</script>

<template>
  <div class="shell">
    <aside class="sidebar">
      <div class="brand">
        <span class="brand-mark" aria-hidden="true"></span>
        <span>Музыка</span>
      </div>

      <nav class="nav">
        <TaoLink
          v-for="link in links"
          :key="link.label"
          class="nav-link"
          :class="{ 'nav-link--active': isActive(link.name) }"
          :to="link.to"
        >
          {{ link.label }}
        </TaoLink>
      </nav>

      <div v-if="auth.user" class="account">
        <div>
          <strong>{{ auth.user.username }}</strong>
          <TaoTag type="neutral">{{ roleLabel(auth.user.role) }}</TaoTag>
        </div>
        <TaoButton variant="ghost" size="small" @click="logout">Выйти</TaoButton>
      </div>
    </aside>

    <main class="main">
      <RouterView />
    </main>

    <PlayerBar />

    <nav class="dock" aria-label="Разделы">
      <TaoLink
        v-for="link in links"
        :key="link.label"
        class="dock-link"
        :class="{ 'dock-link--active': isActive(link.name) }"
        :to="link.to"
      >
        {{ link.label }}
      </TaoLink>
      <button type="button" class="dock-link" :class="{ 'dock-link--active': moreOpen }" @click="moreOpen = !moreOpen">
        Ещё
      </button>
    </nav>

    <div v-if="moreOpen" class="sheet" @click.self="moreOpen = false">
      <div class="sheet-card" v-if="auth.user">
        <strong>{{ auth.user.username }}</strong>
        <TaoTag type="neutral">{{ roleLabel(auth.user.role) }}</TaoTag>
        <TaoButton variant="ghost" size="small" @click="logout">Выйти</TaoButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.shell {
  display: grid;
  grid-template-columns: var(--sidebar-width) 1fr;
  min-height: 100dvh;
  padding-bottom: calc(var(--player-height) + var(--nav-height) + env(safe-area-inset-bottom, 0px));
}

.sidebar {
  position: sticky;
  top: 0;
  display: flex;
  flex-direction: column;
  height: calc(100dvh - var(--player-height));
  padding: 22px 16px 16px;
  background: #0a0a0a;
  border-right: 1px solid var(--tao-color-border);
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 8px 28px;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.04em;
  color: var(--tao-color-text-strong);
}

.brand-mark {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid var(--tao-color-accent);
  box-shadow: inset 0 0 0 6px #0a0a0a, inset 0 0 0 8px var(--tao-color-accent);
}

.nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-link {
  padding: 10px 12px;
  border-radius: 8px;
  color: var(--tao-color-text-muted);
  text-decoration: none;
  font-size: 14px;
  font-weight: 600;
}

.nav-link:hover {
  color: var(--tao-color-text-strong);
  background: var(--tao-color-surface-hover);
}

.nav-link--active {
  color: var(--tao-color-text-strong);
  background: var(--tao-color-accent-subtle);
}

.account {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border-radius: 12px;
  background: var(--tao-color-surface-raised);
}

.account strong {
  display: block;
  margin-bottom: 6px;
  color: var(--tao-color-text-strong);
}

.main {
  min-width: 0;
  background:
    radial-gradient(1200px 420px at 10% -10%, rgba(255, 219, 77, 0.08), transparent 55%),
    var(--tao-color-bg);
}

.dock,
.sheet {
  display: none;
}

@media (max-width: 800px) {
  .shell {
    grid-template-columns: 1fr;
  }

  .sidebar {
    display: none;
  }

  .dock {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 40;
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: 1fr;
    height: calc(var(--nav-height) + env(safe-area-inset-bottom, 0px));
    padding-bottom: env(safe-area-inset-bottom, 0px);
    background: #0a0a0a;
    border-top: 1px solid var(--tao-color-border);
  }

  .dock-link {
    display: grid;
    place-items: center;
    min-height: var(--nav-height);
    padding: 0 4px;
    border: 0;
    background: transparent;
    color: var(--tao-color-text-muted);
    font: inherit;
    font-size: 11px;
    font-weight: 600;
    text-decoration: none;
    text-align: center;
    cursor: pointer;
  }

  .dock-link--active {
    color: var(--tao-color-accent);
  }

  .sheet {
    display: grid;
    place-items: end center;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: calc(var(--nav-height) + env(safe-area-inset-bottom, 0px));
    z-index: 90;
    background: var(--tao-color-overlay);
    padding: 16px;
  }

  .sheet-card {
    width: min(100%, 420px);
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px 12px;
    padding: 16px;
    border-radius: 16px;
    background: var(--tao-color-surface-raised);
  }

  .sheet-card strong {
    color: var(--tao-color-text-strong);
  }
}
</style>
