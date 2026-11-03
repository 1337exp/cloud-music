<script setup lang="ts">
import { computed, ref } from 'vue';
import { TaoAlert, TaoButton, TaoFileDrop, TaoProgress, toast } from '@1337exp/taoui';
import type { Track, UploadResult } from '@shared/types';
import { api } from '../http';
import { t } from '../i18n';

const files = ref<File[]>([]);
const uploading = ref(false);
const progress = ref(0);
const last = ref<UploadResult | null>(null);

const accept = '.mp3,.flac,.wav,.ogg,.opus,.m4a,.aac,.aiff,.aif,.wma,.webm';

const summary = computed(() => last.value);

function onClear() {
  files.value = [];
}

async function upload() {
  if (!files.value.length) return;
  uploading.value = true;
  progress.value = 8;
  last.value = { added: [], duplicates: [], failed: [] };

  try {
    const pack = new FormData();
    for (const file of files.value) {
      pack.append('files', file);
    }
    progress.value = 35;
    const result = await api<UploadResult>('/api/tracks/upload', {
      method: 'POST',
      body: pack,
    });
    last.value = result;
    progress.value = 100;

    const reused = result.duplicates.length;
    const added = result.added.length;
    const ok = added + reused;

    if (ok && !result.failed.length) {
      toast()
        .success()
        .message(successMessage(added, reused));
    } else if (ok && result.failed.length) {
      toast()
        .warning()
        .message(t('upload.partial', { message: successMessage(added, reused), failed: result.failed.length }));
    } else if (result.failed.length) {
      toast().danger().message(t('upload.errors', { n: result.failed.length }));
    }
    files.value = [];
  } catch (error) {
    toast().danger().message(error instanceof Error ? error.message : t('upload.failed'));
  } finally {
    uploading.value = false;
  }
}

function trackLabel(track: Track): string {
  return [track.artist, track.title].filter(Boolean).join(' — ') || track.title;
}

function successMessage(added: number, reused: number): string {
  if (added && reused) {
    return t('upload.addedAndReused', { added, reused });
  }
  if (reused && !added) {
    return reused === 1 ? t('upload.reusedOne') : t('upload.reusedMany', { n: reused });
  }
  return added === 1 ? t('upload.addedOne') : t('upload.addedMany', { n: added });
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1>{{ t('upload.title') }}</h1>
      </div>
    </div>

    <TaoFileDrop
      v-model="files"
      multiple
      :accept="accept"
      size="large"
      list
      show-clear
      @clear-request="onClear"
    />

    <div class="actions">
      <TaoButton :disabled="!files.length" :loading="uploading" @click="upload">
        {{ t('upload.button') }} {{ files.length ? `(${files.length})` : '' }}
      </TaoButton>
    </div>

    <TaoProgress v-if="uploading || progress === 100" :progress="progress" />

    <div v-if="summary" class="report">
      <TaoAlert v-if="summary.added.length" tone="success" :title="t('upload.added')">
        {{ summary.added.map(trackLabel).join(', ') }}
      </TaoAlert>
      <TaoAlert v-if="summary.duplicates.length" tone="success" :title="t('upload.duplicates')">
        {{ summary.duplicates.map((item) => trackLabel(item.track)).join(', ') }}
      </TaoAlert>
      <TaoAlert v-if="summary.failed.length" tone="danger" :title="t('upload.failedTitle')">
        {{ summary.failed.map((item) => `${item.fileName}: ${item.message}`).join('; ') }}
      </TaoAlert>
    </div>
  </div>
</template>

<style scoped>
.actions {
  margin: 16px 0;
}

.report {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 20px;
}
</style>
