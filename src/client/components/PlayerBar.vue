<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { TaoSlider, TaoTooltip } from '@1337exp/taoui';
import { formatClock } from '@shared/format';
import { t } from '../i18n';
import { usePlayerStore } from '../stores/player';
import CoverArt from './CoverArt.vue';

const player = usePlayerStore();
const expanded = ref(false);

const progress = computed({
  get: () => player.currentTime,
  set: (value: number) => player.seek(Number(value)),
});

const volume = computed({
  get: () => Math.round(player.volume * 100),
  set: (value: number) => player.setVolume(Number(value) / 100),
});

const repeatTitle = computed(() => {
  if (player.repeat === 'all') return t('player.repeatAll');
  if (player.repeat === 'one') return t('player.repeatOne');
  return t('player.repeatOff');
});

const shuffleTitle = computed(() => (player.shuffle ? t('player.shuffleOn') : t('player.shuffleOff')));

const progressPercent = computed(() => {
  if (!player.duration) return 0;
  return Math.min(100, (player.currentTime / player.duration) * 100);
});

function isMobile(): boolean {
  return window.matchMedia('(max-width: 800px)').matches;
}

function onNowClick() {
  if (isMobile() && player.hasTrack) {
    expanded.value = !expanded.value;
  }
}

function collapse() {
  expanded.value = false;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
}

function onKeydown(event: KeyboardEvent) {
  if (isTypingTarget(event.target)) {
    return;
  }
  if (event.code === 'Space') {
    event.preventDefault();
    void player.toggle();
  }
  if (event.code === 'ArrowRight') {
    player.seek(Math.min(player.duration, player.currentTime + 5));
  }
  if (event.code === 'ArrowLeft') {
    player.seek(Math.max(0, player.currentTime - 5));
  }
  if (event.code === 'Escape') {
    expanded.value = false;
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown);
  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', () => void player.toggle());
    navigator.mediaSession.setActionHandler('pause', () => void player.toggle());
    navigator.mediaSession.setActionHandler('previoustrack', () => void player.prev());
    navigator.mediaSession.setActionHandler('nexttrack', () => void player.next());
  }
});

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <footer class="player" :class="{ 'player--expanded': expanded }">
    <div class="mini-progress" aria-hidden="true">
      <span :style="{ width: `${progressPercent}%` }"></span>
    </div>

    <button v-if="expanded" type="button" class="collapse" @click="collapse">{{ t('player.collapse') }}</button>

    <div class="now" @click="onNowClick">
      <template v-if="player.current">
        <CoverArt :track="player.current" :size="expanded ? 160 : 52" />
        <div class="meta">
          <strong>{{ player.current.title }}</strong>
          <span>{{ player.current.artist || t('common.unknownArtist') }}</span>
        </div>
      </template>
      <div v-else class="meta muted">
        <strong>{{ t('player.idleTitle') }}</strong>
        <span>{{ t('player.idleHint') }}</span>
      </div>
      <button
        type="button"
        class="play play--mini"
        :disabled="!player.hasTrack"
        :aria-label="player.playing ? t('player.pause') : t('player.play')"
        @click.stop="player.toggle()"
      >
        <svg v-if="player.playing" viewBox="0 0 24 24" width="20" height="20">
          <path fill="currentColor" d="M7 6h3v12H7V6zm7 0h3v12h-3V6z" />
        </svg>
        <svg v-else viewBox="0 0 24 24" width="20" height="20">
          <path fill="currentColor" d="M8 5v14l11-7L8 5z" />
        </svg>
      </button>
    </div>

    <div class="transport">
      <div class="controls">
        <button type="button" class="icon-btn" :disabled="!player.hasTrack" :aria-label="t('player.prev')" @click="player.prev()">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path fill="currentColor" d="M6 6h2v12H6V6zm3.5 6 8.5 6V6l-8.5 6z" />
          </svg>
        </button>
        <button
          type="button"
          class="play"
          :disabled="!player.hasTrack"
          :aria-label="player.playing ? t('player.pause') : t('player.play')"
          @click="player.toggle()"
        >
          <svg v-if="player.playing" viewBox="0 0 24 24" width="20" height="20">
            <path fill="currentColor" d="M7 6h3v12H7V6zm7 0h3v12h-3V6z" />
          </svg>
          <svg v-else viewBox="0 0 24 24" width="20" height="20">
            <path fill="currentColor" d="M8 5v14l11-7L8 5z" />
          </svg>
        </button>
        <button type="button" class="icon-btn" :disabled="!player.hasTrack" :aria-label="t('player.next')" @click="player.next()">
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path fill="currentColor" d="M16 6h2v12h-2V6zM6 18l8.5-6L6 6v12z" />
          </svg>
        </button>
      </div>
      <div class="seek">
        <span>{{ formatClock(player.currentTime) }}</span>
        <TaoSlider
          v-model="progress"
          variant="thin"
          :min="0"
          :max="Math.max(player.duration, 0.1)"
          :step="0.1"
          :disabled="!player.hasTrack"
        />
        <span>{{ formatClock(player.duration) }}</span>
      </div>
    </div>

    <div class="extra">
        <TaoTooltip :content="repeatTitle">
        <button
          type="button"
          class="icon-btn"
          :aria-label="repeatTitle"
          :class="{ 'is-on': player.repeat !== 'off' }"
          @click="player.cycleRepeat()"
        >
          <span v-if="player.repeat === 'one'">1</span>
          <svg v-else viewBox="0 0 24 24" width="16" height="16">
            <path
              fill="currentColor"
              d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"
            />
          </svg>
        </button>
      </TaoTooltip>
      <TaoTooltip :content="shuffleTitle">
        <button
          type="button"
          class="icon-btn"
          :aria-label="shuffleTitle"
          :class="{ 'is-on': player.shuffle }"
          @click="player.toggleShuffle()"
        >
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path
              fill="currentColor"
              d="M10.59 9.17 5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"
            />
          </svg>
        </button>
      </TaoTooltip>
      <button type="button" class="icon-btn" :aria-label="player.muted ? t('player.unmute') : t('player.mute')" @click="player.toggleMute()">
        <svg viewBox="0 0 24 24" width="16" height="16">
          <path
            fill="currentColor"
            :d="player.muted || player.volume === 0
              ? 'M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4 9.91 6.09 12 8.18V4z'
              : 'M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z'"
          />
        </svg>
      </button>
      <div class="vol">
        <TaoSlider v-model="volume" variant="thin" :min="0" :max="100" :step="1" />
      </div>
    </div>
  </footer>
</template>

<style scoped>
.player {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 50;
  display: grid;
  grid-template-columns: minmax(180px, 1fr) minmax(280px, 2fr) minmax(160px, 1fr);
  align-items: center;
  gap: 16px;
  height: var(--player-height);
  padding: 0 18px;
  background: color-mix(in srgb, #121212 88%, transparent);
  border-top: 1px solid var(--tao-color-border);
  backdrop-filter: blur(18px);
}

.now,
.extra,
.controls {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.meta {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.meta strong,
.meta span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.meta strong {
  font-size: 14px;
  color: var(--tao-color-text-strong);
}

.meta span {
  font-size: 12px;
  color: var(--tao-color-text-muted);
}

.transport {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.controls {
  justify-content: center;
}

.seek {
  display: grid;
  grid-template-columns: 40px 1fr 40px;
  align-items: center;
  gap: 8px;
  width: min(100%, 560px);
  font-size: 11px;
  color: var(--tao-color-text-muted);
  font-variant-numeric: tabular-nums;
}

.icon-btn,
.play {
  border: 0;
  background: transparent;
  color: var(--tao-color-text);
  cursor: pointer;
  display: grid;
  place-items: center;
}

.icon-btn {
  width: 32px;
  height: 32px;
  border-radius: var(--tao-radius-md);
}

.icon-btn:hover,
.icon-btn.is-on {
  color: var(--tao-color-accent);
}

.play {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--tao-color-accent);
  color: var(--tao-color-on-accent);
}

.play:disabled,
.icon-btn:disabled {
  opacity: 0.35;
  cursor: default;
}

.extra {
  justify-content: flex-end;
}

.vol {
  width: 96px;
}

.muted {
  color: var(--tao-color-text-muted);
}

.mini-progress,
.collapse,
.play--mini {
  display: none;
}

@media (max-width: 800px) {
  .player {
    bottom: calc(var(--nav-height) + env(safe-area-inset-bottom, 0px));
    grid-template-columns: 1fr;
    height: var(--player-height);
    gap: 0;
    padding: 0 10px 0 12px;
  }

  .mini-progress {
    display: block;
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: var(--tao-color-border);
  }

  .mini-progress span {
    display: block;
    height: 100%;
    background: var(--tao-color-accent);
  }

  .now {
    height: var(--player-height);
  }

  .play--mini {
    display: grid;
    margin-left: auto;
    flex-shrink: 0;
  }

  .transport,
  .extra {
    display: none;
  }

  .player--expanded {
    top: 0;
    bottom: 0;
    z-index: 80;
    height: auto;
    padding: 12px 20px calc(24px + env(safe-area-inset-bottom, 0px));
    overflow: auto;
    align-content: start;
    gap: 18px;
  }

  .player--expanded .mini-progress {
    display: none;
  }

  .player--expanded .collapse {
    display: block;
    justify-self: start;
    border: 0;
    background: transparent;
    color: var(--tao-color-text-muted);
    font: inherit;
    font-size: 14px;
    cursor: pointer;
    min-height: 40px;
  }

  .player--expanded .now {
    height: auto;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 8px 0;
  }

  .player--expanded .play--mini {
    display: none;
  }

  .player--expanded .meta {
    align-items: center;
  }

  .player--expanded .transport,
  .player--expanded .extra {
    display: flex;
    width: 100%;
  }

  .player--expanded .seek {
    width: 100%;
  }

  .player--expanded .extra {
    justify-content: center;
  }

  .player--expanded .vol {
    width: 140px;
  }

  .player--expanded .icon-btn {
    width: 44px;
    height: 44px;
  }
}
</style>
