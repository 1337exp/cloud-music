<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { toast } from '@1337exp/taoui';
import type { HistoryItem, Track } from '@shared/types';
import { HISTORY_LIMIT } from '@shared/constants';
import { api } from '../http';
import { t } from '../i18n';
import AddToPlaylistModal from '../components/AddToPlaylistModal.vue';
import TrackEditModal from '../components/TrackEditModal.vue';
import TrackTable from '../components/TrackTable.vue';

const items = ref<HistoryItem[]>([]);
const editing = ref<Track | null>(null);
const playlistTrack = ref<Track | null>(null);
const editOpen = ref(false);
const playlistOpen = ref(false);

const tracks = ref<Track[]>([]);

async function load() {
  const data = await api<{ items: HistoryItem[] }>('/api/history');
  items.value = data.items;
  tracks.value = data.items.map((item) => item.track);
}

onMounted(() => void load());

async function onDeleted(track: Track) {
  await api(`/api/tracks/${track.id}`, { method: 'DELETE' });
  toast().success().message(t('library.deleted'));
  await load();
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1>{{ t('history.title') }}</h1>
        <p>{{ t('history.hint', { limit: HISTORY_LIMIT }) }}</p>
      </div>
    </div>

    <TrackTable
      :tracks="tracks"
      :empty-title="t('history.emptyTitle')"
      :empty-text="t('history.emptyText')"
      @edit="(track) => { editing = track; editOpen = true }"
      @playlist="(track) => { playlistTrack = track; playlistOpen = true }"
      @deleted="onDeleted"
    />

    <TrackEditModal v-model="editOpen" :track="editing" @saved="load" />
    <AddToPlaylistModal v-model="playlistOpen" :track="playlistTrack" />
  </div>
</template>
