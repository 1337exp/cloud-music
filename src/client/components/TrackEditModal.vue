<script setup lang="ts">
import { ref, watch } from 'vue';
import { TaoButton, TaoFormField, TaoInput, TaoInputNumber, TaoModal, TaoTag, toast } from '@1337exp/taoui';
import type { Tag, Track } from '@shared/types';
import { api } from '../http';
import { t } from '../i18n';

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
    toast().success().message(t('edit.saved'));
  } catch (error) {
    toast().danger().message(error instanceof Error ? error.message : t('edit.failed'));
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <TaoModal v-model="open" :title="t('edit.title')">
    <form class="form" @submit.prevent="save">
      <TaoFormField :label="t('edit.name')">
        <TaoInput v-model="title" />
      </TaoFormField>
      <TaoFormField :label="t('edit.artist')">
        <TaoInput v-model="artist" />
      </TaoFormField>
      <TaoFormField :label="t('edit.album')">
        <TaoInput v-model="album" />
      </TaoFormField>
      <TaoFormField :label="t('edit.year')" :hint="t('edit.optional')">
        <TaoInputNumber v-model="year" :min="1900" :max="2100" />
      </TaoFormField>
      <TaoFormField :label="t('edit.tags')" :hint="t('edit.tagsHint')">
        <TaoInput v-model="tagDraft" :placeholder="t('edit.tagPlaceholder')" @keydown.enter.prevent="addTag" />
      </TaoFormField>
      <div class="tags">
        <TaoTag
          v-for="(tag, index) in tags"
          :key="tag"
          tone="info"
          clickable
          @click="tags.splice(index, 1)"
        >
          {{ tag }} ×
        </TaoTag>
      </div>
      <TaoButton type="submit" :loading="saving" block>{{ t('edit.save') }}</TaoButton>
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
