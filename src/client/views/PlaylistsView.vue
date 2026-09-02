<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { confirm, TaoButton, TaoCard, TaoEmpty, TaoInput, TaoInputGroup, toast } from '@1337exp/taoui';
import type { PlaylistSummary } from '@shared/types';
import { MAX_PLAYLISTS_PER_USER } from '@shared/constants';
import { api } from '../http';

const router = useRouter();
const playlists = ref<PlaylistSummary[]>([]);
const title = ref('');
const creating = ref(false);

async function load() {
  const data = await api<{ playlists: PlaylistSummary[] }>('/api/playlists');
  playlists.value = data.playlists;
}

onMounted(() => void load());

async function create() {
  creating.value = true;
  try {
    const data = await api<{ playlist: PlaylistSummary }>('/api/playlists', {
      method: 'POST',
      body: JSON.stringify({ title: title.value }),
    });
    title.value = '';
    toast().success().message('Плейлист создан');
    await router.push({ name: 'playlist', params: { id: data.playlist.id } });
  } catch (error) {
    toast().error().message(error instanceof Error ? error.message : 'Не удалось создать');
  } finally {
    creating.value = false;
  }
}

async function remove(playlist: PlaylistSummary) {
  if (!(await confirm().title('Удалить плейлист?').message(playlist.title).danger())) {
    return;
  }
  await api(`/api/playlists/${playlist.id}`, { method: 'DELETE' });
  toast().success().message('Удалено');
  await load();
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1>Плейлисты</h1>
        <p>{{ playlists.length }} / {{ MAX_PLAYLISTS_PER_USER }}</p>
      </div>
      <form class="create" @submit.prevent="create">
        <TaoInputGroup>
          <TaoInput
            v-model="title"
            placeholder="Новый плейлист"
            :disabled="playlists.length >= MAX_PLAYLISTS_PER_USER"
          />
          <template #after>
            <TaoButton
              type="submit"
              :loading="creating"
              :disabled="playlists.length >= MAX_PLAYLISTS_PER_USER"
            >
              Создать
            </TaoButton>
          </template>
        </TaoInputGroup>
      </form>
    </div>

    <TaoEmpty v-if="!playlists.length" title="Плейлистов пока нет">
      Соберите подборку — до {{ MAX_PLAYLISTS_PER_USER }} штук на аккаунт.
    </TaoEmpty>

    <div v-else class="grid">
      <TaoCard
        v-for="playlist in playlists"
        :key="playlist.id"
        hover
        :padding="18"
        @click="router.push({ name: 'playlist', params: { id: playlist.id } })"
      >
        <div class="card">
          <div>
            <strong>{{ playlist.title }}</strong>
            <p>Треков: {{ playlist.trackCount }}</p>
          </div>
          <TaoButton variant="ghost" tone="danger" size="small" @click.stop="remove(playlist)">Удалить</TaoButton>
        </div>
      </TaoCard>
    </div>
  </div>
</template>

<style scoped>
.create {
  width: min(380px, 100%);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
}

.card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  cursor: pointer;
}

.card strong {
  color: var(--tao-color-text-strong);
}

.card p {
  margin: 4px 0 0;
  color: var(--tao-color-text-muted);
}

@media (max-width: 800px) {
  .create {
    width: 100%;
  }

  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
