<script setup lang="ts">
import { ref, watch } from 'vue';
import { TaoButton, TaoFormField, TaoInput, TaoInputNumber, TaoModal, TaoTag, toast } from '@1337exp/taoui';
import type { Tag, Track } from '@shared/types';
import { api } from '../http';

const props = defineProps<{
  track: Track | null;
}>();

const open = defineModel<boolean>({ default: false });
const emit = defineEmits<{
  saved: [track: Track];
}>();

const title = ref('');
const artist = ref('');
const album = ref('');
const year = ref<number | null>(null);
const tags = ref<string[]>([]);
const tagDraft = ref('');
const saving = ref(false);

watch(
  () => props.track,
  (track) => {
    if (!track) return;
    title.value = track.title;
    artist.value = track.artist;
    album.value = track.album;
    year.value = track.year;
    tags.value = track.tags.map((tag: Tag) => tag.name);
  },
  { immediate: true },
);

function addTag() {
  const name = tagDraft.value.trim();
  if (!name) return;
  if (!tags.value.some((item) => item.toLowerCase() === name.toLowerCase())) {
    tags.value.push(name);
  }
  tagDraft.value = '';
}

async function save() {
  if (!props.track) return;
  saving.value = true;
  try {
    const data = await api<{ track: Track }>(`/api/tracks/${props.track.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        title: title.value,
        artist: artist.value,
        album: album.value,
        year: year.value,
        tags: tags.value,
      }),
    });
    emit('saved', data.track);
    open.value = false;
    toast().success().message('Трек обновлён');
  } catch (error) {
    toast().error().message(error instanceof Error ? error.message : 'Не удалось сохранить');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <TaoModal v-model="open" title="Редактирование трека">
    <form class="form" @submit.prevent="save">
      <TaoFormField label="Название">
        <TaoInput v-model="title" />
      </TaoFormField>
      <TaoFormField label="Исполнитель">
        <TaoInput v-model="artist" />
      </TaoFormField>
      <TaoFormField label="Альбом">
        <TaoInput v-model="album" />
      </TaoFormField>
      <TaoFormField label="Год" hint="Необязательно">
        <TaoInputNumber v-model="year" :min="1900" :max="2100" />
      </TaoFormField>
      <TaoFormField label="Теги" hint="Жанр и любые пометки. Enter — добавить">
        <TaoInput v-model="tagDraft" placeholder="Например: jazz" @keydown.enter.prevent="addTag" />
      </TaoFormField>
      <div class="tags">
        <TaoTag
          v-for="(tag, index) in tags"
          :key="tag"
          type="info"
          pointer
          @click="tags.splice(index, 1)"
        >
          {{ tag }} ×
        </TaoTag>
      </div>
      <TaoButton type="submit" :loading="saving" block>Сохранить</TaoButton>
    </form>
  </TaoModal>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: min(420px, 70vw);
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
</style>
