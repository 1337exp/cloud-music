<script setup lang="ts">
import type { Track } from '@shared/types';

defineProps<{
  track: Pick<Track, 'id' | 'title' | 'artist'>;
  size?: number;
}>();
</script>

<template>
  <img
    class="cover"
    :src="`/api/tracks/${track.id}/cover`"
    :alt="track.title"
    draggable="false"
    :style="{ width: `${size ?? 40}px`, height: `${size ?? 40}px` }"
  />
</template>

<style scoped>
.cover {
  display: block;
  object-fit: cover;
  border-radius: 4px;
  background: #1a1a1a;
  flex-shrink: 0;
}
</style>
