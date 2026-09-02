<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { confirm, TaoInput, TaoPagination, TaoSelect, TaoTag, toast } from '@1337exp/taoui';
import type { Tag, Track, TrackListResponse, TrackSortKey } from '@shared/types';
import { DEFAULT_PAGE_SIZE } from '@shared/constants';
import { api } from '../http';
import { useAuthStore } from '../stores/auth';
import AddToPlaylistModal from '../components/AddToPlaylistModal.vue';
import TrackEditModal from '../components/TrackEditModal.vue';
import TrackTable from '../components/TrackTable.vue';

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

const sortOptions = [
  { value: 'createdAt', label: 'Сначала новые' },
  { value: 'title', label: 'Название' },
  { value: 'artist', label: 'Исполнитель' },
  { value: 'album', label: 'Альбом' },
  { value: 'duration', label: 'Длительность' },
];

let timer: ReturnType<typeof setTimeout> | null = null;

const emptyText = computed(() => {
  if (query.value || tag.value) return 'Попробуйте другой запрос или снимите тег.';
  if (auth.isEditor) return 'Загрузите файлы в разделе «Загрузка» или прогоните индексацию.';
  return 'Попросите редактора добавить музыку.';
});

function trackCountLabel(n: number): string {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return `${n} трек`;
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return `${n} трека`;
  return `${n} треков`;
}

async function load() {
  loading.value = true;
  try {
    const params = new URLSearchParams({
      q: query.value,
      tag: tag.value,
      sort: sort.value,
      dir: dir.value,
      page: String(page.value),
      pageSize: String(DEFAULT_PAGE_SIZE),
    });
    const data = await api<TrackListResponse>(`/api/tracks?${params}`);
    tracks.value = data.items;
    total.value = data.total;
  } catch (error) {
    toast().error().message(error instanceof Error ? error.message : 'Не удалось загрузить треки');
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
  page.value = 1;
}

onMounted(() => {
  void load();
  void loadTags();
});

watch([page, sort, dir, tag], () => void load());

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
  if (!(await confirm().title('Удалить трек?').message(track.title).danger())) {
    return;
  }
  await api(`/api/tracks/${track.id}`, { method: 'DELETE' });
  toast().success().message('Трек удалён');
  void load();
  void loadTags();
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1>Коллекция</h1>
        <p>{{ trackCountLabel(total) }}</p>
      </div>
      <div class="tools">
        <TaoInput v-model="query" placeholder="Поиск по названию, исполнителю, тегу">
          <template #prefix>⌕</template>
        </TaoInput>
        <TaoSelect v-model="sort" :options="sortOptions" />
      </div>
    </div>

    <div v-if="tags.length" class="chips">
      <TaoTag
        v-for="item in tags"
        :key="item.id"
        :type="tag === item.name ? 'warning' : 'neutral'"
        pointer
        @click="toggleTag(item.name)"
      >
        {{ item.name }}
      </TaoTag>
    </div>

    <TrackTable
      :tracks="tracks"
      empty-title="Ничего не нашлось"
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
