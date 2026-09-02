<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { TaoButton, TaoFormField, TaoInput, TaoModal, TaoSelect, toast } from '@1337exp/taoui';
import type { PlaylistSummary, Track } from '@shared/types';
import { MAX_PLAYLISTS_PER_USER } from '@shared/constants';
import { api } from '../http';

const props = defineProps<{
  track: Track | null;
}>();

const open = defineModel<boolean>({ default: false });

const playlists = ref<PlaylistSummary[]>([]);
const playlistId = ref<number | null>(null);
const newTitle = ref('');
const saving = ref(false);

async function load() {
  const data = await api<{ playlists: PlaylistSummary[] }>('/api/playlists');
  playlists.value = data.playlists;
  playlistId.value = data.playlists[0]?.id ?? null;
}

watch(open, (value) => {
  if (value) void load();
});

onMounted(() => {
  if (open.value) void load();
});

async function add() {
  if (!props.track) return;
  saving.value = true;
  try {
    let id = playlistId.value;
    if (!id) {
      const title = newTitle.value.trim();
      if (!title) {
        toast().warning().message('Создайте плейлист или выберите существующий');
        saving.value = false;
        return;
      }
      const created = await api<{ playlist: PlaylistSummary }>('/api/playlists', {
        method: 'POST',
        body: JSON.stringify({ title }),
      });
      id = created.playlist.id;
    }

    await api(`/api/playlists/${id}/tracks`, {
      method: 'POST',
      body: JSON.stringify({ trackId: props.track.id }),
    });
    toast().success().message('Добавлено в плейлист');
    open.value = false;
    newTitle.value = '';
  } catch (error) {
    toast().error().message(error instanceof Error ? error.message : 'Не удалось добавить');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <TaoModal v-model="open" title="Добавить в плейлист">
    <form class="form" @submit.prevent="add">
      <TaoFormField v-if="playlists.length" label="Плейлист">
        <TaoSelect
          v-model="playlistId"
          :options="playlists.map((item) => ({ value: item.id, label: `${item.title} (${item.trackCount})` }))"
        />
      </TaoFormField>
      <TaoFormField
        v-if="playlists.length < MAX_PLAYLISTS_PER_USER"
        :label="playlists.length ? 'Или новый' : 'Название'"
      >
        <TaoInput v-model="newTitle" placeholder="Вечерний микс" @focus="playlistId = null" />
      </TaoFormField>
      <TaoButton type="submit" :loading="saving" block>Добавить</TaoButton>
    </form>
  </TaoModal>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: min(380px, 70vw);
}
</style>
