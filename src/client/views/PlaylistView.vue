<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { confirm, TaoButton, TaoInput, toast } from '@1337exp/taoui';
import type { PlaylistDetail, Track } from '@shared/types';
import { api } from '../http';
import { t } from '../i18n';
import { usePlayerStore } from '../stores/player';
import AddToPlaylistModal from '../components/AddToPlaylistModal.vue';
import TrackEditModal from '../components/TrackEditModal.vue';
import TrackTable from '../components/TrackTable.vue';

const route = useRoute();
const router = useRouter();
const player = usePlayerStore();
const playlist = ref<PlaylistDetail | null>(null);
const title = ref('');
const editing = ref<Track | null>(null);
const playlistTrack = ref<Track | null>(null);
const editOpen = ref(false);
const playlistOpen = ref(false);

async function load() {
  const data = await api<{ playlist: PlaylistDetail }>(`/api/playlists/${route.params.id}`);
  playlist.value = data.playlist;
  title.value = data.playlist.title;
}

onMounted(() => void load());
watch(() => route.params.id, () => void load());

async function rename() {
  if (!playlist.value || title.value.trim() === playlist.value.title) return;
  try {
    await api(`/api/playlists/${playlist.value.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ title: title.value }),
    });
    toast().success().message(t('playlist.renamed'));
    await load();
  } catch (error) {
    toast().danger().message(error instanceof Error ? error.message : t('playlist.saveFailed'));
  }
}

async function onReorder(tracks: Track[]) {
  if (!playlist.value) return;
  const previous = playlist.value.tracks;
  playlist.value = { ...playlist.value, tracks, trackCount: tracks.length };
  player.applyQueueOrder(tracks);
  try {
    const data = await api<{ playlist: PlaylistDetail }>(`/api/playlists/${playlist.value.id}/tracks/order`, {
      method: 'PUT',
      body: JSON.stringify({ trackIds: tracks.map((track) => track.id) }),
    });
    playlist.value = data.playlist;
    player.applyQueueOrder(data.playlist.tracks);
  } catch (error) {
    playlist.value = { ...playlist.value, tracks: previous, trackCount: previous.length };
    player.applyQueueOrder(previous);
    toast().danger().message(error instanceof Error ? error.message : t('playlist.orderFailed'));
  }
}

async function onRemove(track: Track) {
  if (!playlist.value) return;
  await api(`/api/playlists/${playlist.value.id}/tracks/${track.id}`, { method: 'DELETE' });
  await load();
}

async function onDeleted(track: Track) {
  if (!(await confirm().title(t('playlist.deleteTrackTitle')).message(track.title).danger())) {
    return;
  }
  await api(`/api/tracks/${track.id}`, { method: 'DELETE' });
  toast().success().message(t('library.deleted'));
  await load();
}

async function destroy() {
  if (!playlist.value) return;
  if (!(await confirm().title(t('playlists.deleteTitle')).message(playlist.value.title).danger())) {
    return;
  }
  await api(`/api/playlists/${playlist.value.id}`, { method: 'DELETE' });
  await router.push({ name: 'playlists' });
}
</script>

<template>
  <div v-if="playlist" class="page">
    <div class="page-head">
      <div class="title-edit">
        <TaoInput v-model="title" @blur="rename" @keydown.enter.prevent="rename" />
        <p>{{ t('playlists.trackCount', { n: playlist.trackCount }) }}</p>
      </div>
      <TaoButton variant="ghost" tone="danger" @click="destroy">{{ t('playlist.deleteAction') }}</TaoButton>
    </div>

    <TrackTable
      :tracks="playlist.tracks"
      removable
      reorderable
      :empty-title="t('playlist.emptyTitle')"
      :empty-text="t('playlist.emptyText')"
      @edit="(track) => { editing = track; editOpen = true }"
      @playlist="(track) => { playlistTrack = track; playlistOpen = true }"
      @remove="onRemove"
      @deleted="onDeleted"
      @reorder="onReorder"
    />

    <TrackEditModal v-model="editOpen" :track="editing" @saved="load" />
    <AddToPlaylistModal v-model="playlistOpen" :track="playlistTrack" />
  </div>
</template>

<style scoped>
.title-edit {
  min-width: min(420px, 100%);
}

.title-edit p {
  margin: 8px 0 0;
  color: var(--tao-color-text-muted);
}

@media (max-width: 800px) {
  .title-edit {
    min-width: 0;
  }
}
</style>
