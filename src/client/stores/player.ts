import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import type { Track } from '@shared/types';
import { api } from '../http';

type RepeatMode = 'off' | 'all' | 'one';

const audio = new Audio();
audio.preload = 'metadata';

export const usePlayerStore = defineStore('player', () => {
  const current = ref<Track | null>(null);
  const queue = ref<Track[]>([]);
  const index = ref(-1);
  const playing = ref(false);
  const currentTime = ref(0);
  const duration = ref(0);
  const volume = ref(Number(localStorage.getItem('mh-volume') ?? 0.9));
  const muted = ref(false);
  const repeat = ref<RepeatMode>('off');
  const shuffle = ref(false);

  audio.volume = volume.value;

  const hasTrack = computed(() => current.value !== null);

  function syncMediaSession(): void {
    if (!('mediaSession' in navigator) || !current.value) {
      return;
    }

    const track = current.value;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist || 'Неизвестный исполнитель',
      album: track.album || '',
      artwork: [{ src: `/api/tracks/${track.id}/cover`, sizes: '400x400', type: 'image/jpeg' }],
    });
    navigator.mediaSession.playbackState = playing.value ? 'playing' : 'paused';
  }

  async function load(track: Track): Promise<void> {
    current.value = track;
    audio.src = `/api/tracks/${track.id}/audio`;
    audio.currentTime = 0;
    document.title = `${track.title} — Облако Музыки`;
    syncMediaSession();
    try {
      await api('/api/history', {
        method: 'POST',
        body: JSON.stringify({ trackId: track.id }),
      });
    } catch {
      // history is best-effort
    }
  }

  async function playList(tracks: Track[], startIndex: number): Promise<void> {
    if (!tracks.length) {
      return;
    }
    queue.value = tracks;
    index.value = Math.max(0, Math.min(startIndex, tracks.length - 1));
    await load(tracks[index.value]!);
    await audio.play();
    playing.value = true;
    syncMediaSession();
  }

  async function playTrack(track: Track, tracks?: Track[]): Promise<void> {
    const list = tracks?.length ? tracks : queue.value.length ? queue.value : [track];
    const i = list.findIndex((item) => item.id === track.id);
    await playList(list, i >= 0 ? i : 0);
  }

  async function toggle(): Promise<void> {
    if (!current.value) {
      return;
    }
    if (playing.value) {
      audio.pause();
      playing.value = false;
    } else {
      await audio.play();
      playing.value = true;
    }
    syncMediaSession();
  }

  function pickNextIndex(step: 1 | -1): number | null {
    if (!queue.value.length || index.value < 0) {
      return null;
    }

    if (repeat.value === 'one' && step === 1) {
      return index.value;
    }

    if (shuffle.value && queue.value.length > 1) {
      let next = index.value;
      while (next === index.value) {
        next = Math.floor(Math.random() * queue.value.length);
      }
      return next;
    }

    const next = index.value + step;
    if (next >= 0 && next < queue.value.length) {
      return next;
    }
    if (repeat.value === 'all') {
      return step === 1 ? 0 : queue.value.length - 1;
    }
    return null;
  }

  async function next(): Promise<void> {
    const i = pickNextIndex(1);
    if (i == null) {
      playing.value = false;
      audio.pause();
      return;
    }
    index.value = i;
    await load(queue.value[i]!);
    await audio.play();
    playing.value = true;
    syncMediaSession();
  }

  async function prev(): Promise<void> {
    if (audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    const i = pickNextIndex(-1);
    if (i == null) {
      audio.currentTime = 0;
      return;
    }
    index.value = i;
    await load(queue.value[i]!);
    await audio.play();
    playing.value = true;
    syncMediaSession();
  }

  function seek(seconds: number): void {
    audio.currentTime = seconds;
    currentTime.value = seconds;
  }

  function setVolume(value: number): void {
    volume.value = value;
    audio.volume = muted.value ? 0 : value;
    localStorage.setItem('mh-volume', String(value));
  }

  function toggleMute(): void {
    muted.value = !muted.value;
    audio.volume = muted.value ? 0 : volume.value;
  }

  function cycleRepeat(): void {
    repeat.value = repeat.value === 'off' ? 'all' : repeat.value === 'all' ? 'one' : 'off';
  }

  function applyQueueOrder(tracks: Track[]): void {
    if (!current.value || queue.value.length !== tracks.length) {
      return;
    }

    const same = queue.value.every((track) => tracks.some((item) => item.id === track.id));
    if (!same) {
      return;
    }

    queue.value = tracks;
    index.value = tracks.findIndex((track) => track.id === current.value?.id);
  }

  audio.addEventListener('timeupdate', () => {
    currentTime.value = audio.currentTime;
    duration.value = audio.duration || 0;
  });

  audio.addEventListener('loadedmetadata', () => {
    duration.value = audio.duration || 0;
  });

  audio.addEventListener('play', () => {
    playing.value = true;
    syncMediaSession();
  });

  audio.addEventListener('pause', () => {
    playing.value = false;
    syncMediaSession();
  });

  audio.addEventListener('ended', () => {
    void next();
  });

  watch(current, syncMediaSession);

  return {
    current,
    queue,
    index,
    playing,
    currentTime,
    duration,
    volume,
    muted,
    repeat,
    shuffle,
    hasTrack,
    playList,
    playTrack,
    toggle,
    next,
    prev,
    seek,
    setVolume,
    toggleMute,
    cycleRepeat,
    applyQueueOrder,
  };
});
