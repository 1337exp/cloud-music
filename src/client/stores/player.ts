import { defineStore } from 'pinia';
import { computed, ref, watch, watchEffect } from 'vue';
import type { SortDir, Track, TrackIdsResponse, TrackSortKey } from '@shared/types';
import { api } from '../http';
import { lang, t } from '../i18n';

type RepeatMode = 'off' | 'all' | 'one';

/** What the list on screen was built from; the player asks the server for the same list without paging. */
export interface CollectionQuery {
  q: string;
  tag: string;
  sort: TrackSortKey;
  dir: SortDir;
}

/** Failed tracks in a row after which the player stops skipping (a dead server, a whole folder gone). */
const MAX_SKIPS = 5;

const audio = new Audio();
audio.preload = 'metadata';

function shuffled(count: number, first: number): number[] {
  const rest = Array.from({ length: count }, (_, i) => i).filter((i) => i !== first);
  for (let i = rest.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j]!, rest[i]!];
  }
  return first >= 0 ? [first, ...rest] : rest;
}

export const usePlayerStore = defineStore('player', () => {
  const current = ref<Track | null>(null);
  /** The queue: track ids in list order. For the library it is the whole collection, not the open page. */
  const ids = ref<number[]>([]);
  /** Indexes into `ids` in the order they play: the same as `ids`, or a permutation when shuffled. */
  const order = ref<number[]>([]);
  const pos = ref(-1);
  const playing = ref(false);
  const currentTime = ref(0);
  const duration = ref(0);
  const volume = ref(Number(localStorage.getItem('mh-volume') ?? 0.9));
  const muted = ref(false);
  const repeat = ref<RepeatMode>('off');
  const shuffle = ref(false);

  const known = new Map<number, Track>();
  let playToken = 0;
  let queueToken = 0;
  let skips = 0;

  audio.volume = volume.value;

  const hasTrack = computed(() => current.value !== null);

  function remember(tracks: Track[]): void {
    for (const track of tracks) {
      known.set(track.id, track);
    }
  }

  function currentIndex(): number {
    return pos.value >= 0 ? (order.value[pos.value] ?? -1) : -1;
  }

  /** Lays out the play order around the track at `index` in `ids`. */
  function rebuildOrder(index: number): void {
    const count = ids.value.length;
    if (shuffle.value && count > 1) {
      order.value = shuffled(count, index);
      pos.value = index >= 0 ? 0 : -1;
    } else {
      order.value = Array.from({ length: count }, (_, i) => i);
      pos.value = index;
    }
  }

  function setQueue(next: number[], currentId: number): void {
    ids.value = next;
    rebuildOrder(next.indexOf(currentId));
  }

  function syncMediaSession(): void {
    if (!('mediaSession' in navigator) || !current.value) {
      return;
    }

    const track = current.value;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist || t('common.unknownArtist'),
      album: track.album || '',
      artwork: [{ src: `/api/tracks/${track.id}/cover`, sizes: '400x400', type: 'image/jpeg' }],
    });
    navigator.mediaSession.playbackState = playing.value ? 'playing' : 'paused';
  }

  watch([current, lang], syncMediaSession);

  watchEffect(() => {
    const name = t('app.name');
    document.title = current.value ? `${current.value.title} — ${name}` : name;
  });

  async function fetchTrack(id: number): Promise<Track | null> {
    try {
      const data = await api<{ track: Track }>(`/api/tracks/${id}`);
      known.set(id, data.track);
      return data.track;
    } catch {
      return null;
    }
  }

  /**
   * Starts a track. `audio.play()` is called before anything is awaited: the click that led here is a user gesture
   * and phones only let playback start inside it, so metadata and history must not hold it up.
   */
  async function play(id: number): Promise<void> {
    const token = (playToken += 1);
    audio.src = `/api/tracks/${id}/audio`;
    audio.play().catch(() => {
      // interrupted by the next track, or blocked by the browser: the play/pause events tell the real state
    });

    const track = known.get(id) ?? (await fetchTrack(id));
    if (token !== playToken || !track) {
      return;
    }
    current.value = track;
    api('/api/history', { method: 'POST', body: JSON.stringify({ trackId: id }) }).catch(() => {
      // history is best-effort
    });
  }

  /** A fixed list: a playlist or the history. */
  async function playList(tracks: Track[], startIndex: number): Promise<void> {
    if (!tracks.length) {
      return;
    }
    queueToken += 1;
    remember(tracks);
    const start = Math.max(0, Math.min(startIndex, tracks.length - 1));
    const track = tracks[start]!;
    skips = 0;
    setQueue(
      tracks.map((item) => item.id),
      track.id,
    );
    await play(track.id);
  }

  /**
   * A track from the library list. The page it was clicked on starts the queue at once, then the ids of the whole
   * collection (same search, tag and sort) replace it, so playback goes on past the last track of the page.
   */
  async function playCollection(track: Track, query: CollectionQuery, page: Track[]): Promise<void> {
    const token = (queueToken += 1);
    remember(page);
    remember([track]);
    skips = 0;
    setQueue(
      page.map((item) => item.id),
      track.id,
    );
    const started = play(track.id);

    try {
      const data = await api<TrackIdsResponse>(`/api/tracks/ids?${new URLSearchParams({ ...query })}`);
      const now = current.value?.id ?? track.id;
      if (token === queueToken && data.ids.includes(now)) {
        setQueue(data.ids, now);
      }
    } catch {
      // the page stays the queue
    }
    await started;
  }

  async function toggle(): Promise<void> {
    if (!current.value) {
      return;
    }
    if (audio.paused) {
      await audio.play().catch(() => undefined);
    } else {
      audio.pause();
    }
  }

  /**
   * Moves along the queue. `auto` is a track that ended by itself: it stops at the end of the queue, while the
   * button just does nothing there. With repeat "all" both wrap around.
   */
  async function go(step: 1 | -1, auto: boolean): Promise<void> {
    const count = order.value.length;
    if (!count || pos.value < 0) {
      return;
    }

    let next = pos.value + step;
    if (next < 0 || next >= count) {
      if (repeat.value !== 'all') {
        if (auto) {
          audio.pause();
        }
        return;
      }
      if (step === 1) {
        if (shuffle.value && count > 1) {
          // a new round: another shuffle that does not start with the track that just played
          const last = currentIndex();
          let fresh = shuffled(count, -1);
          while (fresh[0] === last) {
            fresh = shuffled(count, -1);
          }
          order.value = fresh;
        }
        next = 0;
      } else {
        next = count - 1;
      }
    }

    pos.value = next;
    await play(ids.value[order.value[next]!]!);
  }

  async function next(): Promise<void> {
    await go(1, false);
  }

  async function prev(): Promise<void> {
    if (audio.currentTime > 3 || (pos.value <= 0 && repeat.value !== 'all')) {
      audio.currentTime = 0;
      return;
    }
    await go(-1, false);
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

  function toggleShuffle(): void {
    shuffle.value = !shuffle.value;
    rebuildOrder(currentIndex());
  }

  /** The playlist on screen was reordered: the queue follows it if it is the same tracks. */
  function applyQueueOrder(tracks: Track[]): void {
    const now = current.value?.id;
    const same =
      tracks.length === ids.value.length && tracks.every((track) => ids.value.includes(track.id));
    if (now == null || !same) {
      return;
    }
    remember(tracks);
    setQueue(
      tracks.map((track) => track.id),
      now,
    );
  }

  audio.addEventListener('timeupdate', () => {
    currentTime.value = audio.currentTime;
    duration.value = audio.duration || 0;
  });

  audio.addEventListener('loadedmetadata', () => {
    duration.value = audio.duration || 0;
  });

  audio.addEventListener('playing', () => {
    skips = 0;
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
    if (repeat.value === 'one') {
      audio.currentTime = 0;
      audio.play().catch(() => undefined);
      return;
    }
    void go(1, true);
  });

  // A file that is gone or broken: move on instead of sitting in silence, but give up after a few in a row.
  audio.addEventListener('error', () => {
    if (!audio.error || audio.error.code === MediaError.MEDIA_ERR_ABORTED) {
      return;
    }
    skips += 1;
    if (skips < MAX_SKIPS) {
      void go(1, true);
    }
  });

  return {
    current,
    playing,
    currentTime,
    duration,
    volume,
    muted,
    repeat,
    shuffle,
    hasTrack,
    playList,
    playCollection,
    toggle,
    next,
    prev,
    seek,
    setVolume,
    toggleMute,
    cycleRepeat,
    toggleShuffle,
    applyQueueOrder,
  };
});
