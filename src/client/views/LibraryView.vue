<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { confirm, TaoInput, TaoPagination, TaoSelect, TaoTag, toast } from '@1337exp/taoui';
import type { Tag, Track, TrackListResponse, TrackSortKey } from '@shared/types';
import { DEFAULT_PAGE_SIZE } from '@shared/constants';
import { api } from '../http';
import { t } from '../i18n';
import { useAuthStore } from '../stores/auth';
import AddToPlaylistModal from '../components/AddToPlaylistModal.vue';
import TrackEditModal from '../components/TrackEditModal.vue';
import TrackTable from '../components/TrackTable.vue';
import type { CollectionQuery } from '../stores/player';

const auth = useAuthStore();
const tracks = ref<Track[]>([]);
const total = ref(0);
const page = ref(1);
const query = ref('');
const tag = ref('');
const tags = ref<Tag[]>([]);
const sort = ref<TrackSortKey>('createdAt');
const dir = ref<'asc' | 'desc'>('desc');
const loading = ref(false);
const editing = ref<Track | null>(null);
const playlistTrack = ref<Track | null>(null);
const editOpen = ref(false);
const playlistOpen = ref(false);

const sortOptions = computed(() => [
  { value: 'createdAt', label: t('library.sortNewest') },
  { value: 'title', label: t('library.sortTitle') },
  { value: 'artist', label: t('library.sortArtist') },
  { value: 'album', label: t('library.sortAlbum') },
  { value: 'duration', label: t('library.sortDuration') },
]);

// What the list on screen was loaded with (the search box runs ahead of it while the debounce waits).
const shownQuery = ref<CollectionQuery>({ q: '', tag: '', sort: 'createdAt', dir: 'desc' });

let timer: ReturnType<typeof setTimeout> | null = null;

const emptyText = computed(() => {
  if (query.value || tag.value) return t('library.emptyFiltered');
  if (auth.isEditor) return t('library.emptyEditor');
  return t('library.emptyListener');
});

async function load() {
  loading.value = true;
  try {
    const requested: CollectionQuery = { q: query.value, tag: tag.value, sort: sort.value, dir: dir.value };
    const params = new URLSearchParams({
      ...requested,
      page: String(page.value),
      pageSize: String(DEFAULT_PAGE_SIZE),
    });
    const data = await api<TrackListResponse>(`/api/tracks?${params}`);
    tracks.value = data.items;
    total.value = data.total;
    shownQuery.value = requested;
  } catch (error) {
    toast().danger().message(error instanceof Error ? error.message : t('library.loadFailed'));
  } finally {
    loading.value = false;
  }
}

async function loadTags() {
  const data = await api<{ tags: Tag[] }>('/api/tags');
  tags.value = data.tags;
}

function toggleTag(name: string) {
  tag.value = tag.value === name ? '' : name;
}

onMounted(() => {
  void load();
  void loadTags();
});

watch(page, () => void load());

// A new sort or tag starts from the first page; if it already is the first, the page watcher stays silent.
watch([sort, dir, tag], () => {
  if (page.value === 1) void load();
  else page.value = 1;
});

watch(query, () => {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    page.value = 1;
    void load();
  }, 280);
});

function onEdit(track: Track) {
  editing.value = track;
  editOpen.value = true;
}

function onPlaylist(track: Track) {
  playlistTrack.value = track;
  playlistOpen.value = true;
}

function onSaved(track: Track) {
  tracks.value = tracks.value.map((item) => (item.id === track.id ? track : item));
  void loadTags();
}

async function onDeleted(track: Track) {
  if (!(await confirm().title(t('library.deleteTitle')).message(track.title).danger())) {
    return;
  }
  await api(`/api/tracks/${track.id}`, { method: 'DELETE' });
  toast().success().message(t('library.deleted'));
  void load();
  void loadTags();
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1>{{ t('library.title') }}</h1>
        <p>{{ t('library.count', { n: total }) }}</p>
      </div>
      <div class="tools">
        <TaoInput v-model="query" :placeholder="t('library.search')">
          <template #prefix>⌕</template>
        </TaoInput>
        <TaoSelect v-model="sort" :options="sortOptions" />
      </div>
    </div>

    <div v-if="tags.length" class="chips">
      <TaoTag
        v-for="item in tags"
        :key="item.id"
        :tone="tag === item.name ? 'warning' : 'neutral'"
        clickable
        @click="toggleTag(item.name)"
      >
        {{ item.name }}
      </TaoTag>
    </div>

    <TrackTable
      :tracks="tracks"
      :collection="shownQuery"
      :empty-title="t('library.emptyTitle')"
      :empty-text="emptyText"
      @edit="onEdit"
      @playlist="onPlaylist"
      @deleted="onDeleted"
    />

    <div v-if="total > DEFAULT_PAGE_SIZE" class="pager">
      <TaoPagination v-model:page="page" :total="total" :page-size="DEFAULT_PAGE_SIZE" />
    </div>

    <TrackEditModal v-model="editOpen" :track="editing" @saved="onSaved" />
    <AddToPlaylistModal v-model="playlistOpen" :track="playlistTrack" />
  </div>
</template>

<style scoped>
.tools {
  display: flex;
  gap: 12px;
  flex: 1;
  max-width: 560px;
  justify-content: flex-end;
}

.tools :deep(.tao-input-wrapper) {
  flex: 1;
  min-width: 220px;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 18px;
}

.pager {
  display: flex;
  justify-content: center;
  margin-top: 24px;
}

@media (max-width: 800px) {
  .tools {
    max-width: none;
    flex-direction: column;
    align-items: stretch;
  }

  .tools :deep(.tao-input-wrapper) {
    min-width: 0;
  }
}
</style>
