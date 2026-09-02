<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import { TaoDropdownMenu, TaoEmpty, TaoTag } from '@1337exp/taoui';
import type { TaoDropdownAction } from '@1337exp/taoui';
import { formatDuration } from '@shared/format';
import type { Track } from '@shared/types';
import { useAuthStore } from '../stores/auth';
import { usePlayerStore } from '../stores/player';
import CoverArt from './CoverArt.vue';

const props = defineProps<{
  tracks: Track[];
  emptyTitle?: string;
  emptyText?: string;
  removable?: boolean;
  reorderable?: boolean;
}>();

const emit = defineEmits<{
  edit: [track: Track];
  remove: [track: Track];
  playlist: [track: Track];
  deleted: [track: Track];
  reorder: [tracks: Track[]];
}>();

const auth = useAuthStore();
const player = usePlayerStore();
const tableRef = ref<HTMLElement | null>(null);
const preview = ref<Track[] | null>(null);
const draggingId = ref<number | null>(null);
const shown = computed(() => preview.value ?? props.tracks);

let fromIndex = -1;
let dragging = false;
let pendingRow = false;
let finishing = false;
let moved = false;
let startY = 0;
let activePointerId: number | null = null;
let onPointerMove: ((event: PointerEvent) => void) | null = null;
let onRelease: ((event: Event) => void) | null = null;

watch(
  () => props.tracks,
  () => {
    if (!dragging) {
      preview.value = null;
    }
  },
);

watch(
  [tableRef, () => props.reorderable],
  ([element], [previous]) => {
    unbindTable(previous);
    if (element && props.reorderable) {
      bindTable(element);
    }
  },
  { flush: 'post' },
);

onUnmounted(() => {
  unbindTable(tableRef.value);
  finishDrag(false);
});

const actions = computed((): TaoDropdownAction[] => {
  const list: TaoDropdownAction[] = [{ id: 'playlist', name: 'В плейлист' }];
  if (auth.isEditor) {
    list.push({ id: 'edit', name: 'Изменить' });
    list.push({ id: 'delete', name: 'Удалить из библиотеки' });
  }
  if (props.removable) {
    list.push({ id: 'remove', name: 'Убрать из плейлиста' });
  }
  return list;
});

function onSelected(id: string, track: Track) {
  if (id === 'playlist') emit('playlist', track);
  if (id === 'edit') emit('edit', track);
  if (id === 'delete') emit('deleted', track);
  if (id === 'remove') emit('remove', track);
}

function indexAtClientY(clientY: number): number {
  const rows = tableRef.value?.querySelectorAll<HTMLElement>('[data-row]') ?? [];
  for (let i = 0; i < rows.length; i += 1) {
    const rect = rows[i]!.getBoundingClientRect();
    if (clientY < rect.top + rect.height / 2) {
      return i;
    }
  }
  return Math.max(0, rows.length - 1);
}

function moveTo(to: number): void {
  const list = [...shown.value];
  if (to < 0 || to >= list.length || to === fromIndex) {
    return;
  }
  const [item] = list.splice(fromIndex, 1);
  if (!item) {
    return;
  }
  list.splice(to, 0, item);
  preview.value = list;
  fromIndex = to;
  moved = true;
}

function bindTable(element: HTMLElement): void {
  element.addEventListener('pointerdown', onTablePointerDown);
  element.addEventListener('pointerup', onTablePointerEnd, true);
  element.addEventListener('pointercancel', onTablePointerEnd, true);
  element.addEventListener('lostpointercapture', onLostPointerCapture);
}

function unbindTable(element: HTMLElement | null | undefined): void {
  element?.removeEventListener('pointerdown', onTablePointerDown);
  element?.removeEventListener('pointerup', onTablePointerEnd, true);
  element?.removeEventListener('pointercancel', onTablePointerEnd, true);
  element?.removeEventListener('lostpointercapture', onLostPointerCapture);
}

function hitElement(event: PointerEvent): Element | null {
  const fromPoint = document.elementFromPoint(event.clientX, event.clientY);
  if (fromPoint) {
    return fromPoint;
  }
  return event.target instanceof Element ? event.target : null;
}

function samePointer(event: PointerEvent): boolean {
  return activePointerId == null || event.pointerId === activePointerId;
}

function releaseCapture(): void {
  const element = tableRef.value;
  const pointerId = activePointerId;
  if (!element || pointerId == null || !element.hasPointerCapture(pointerId)) {
    return;
  }
  try {
    element.releasePointerCapture(pointerId);
  } catch {
    /* already released */
  }
}

function detachPointerListeners(): void {
  if (onPointerMove) {
    window.removeEventListener('pointermove', onPointerMove);
  }
  if (onRelease) {
    window.removeEventListener('pointerup', onRelease, true);
    window.removeEventListener('pointercancel', onRelease, true);
    window.removeEventListener('mouseup', onRelease, true);
    window.removeEventListener('dragend', onRelease, true);
  }
  onPointerMove = null;
  onRelease = null;
}

function beginDrag(index: number): void {
  fromIndex = index;
  dragging = true;
  pendingRow = false;
  draggingId.value = shown.value[index]?.id ?? null;
  preview.value = [...shown.value];
}

function finishDrag(emitReorder = true): void {
  if (finishing) {
    return;
  }
  finishing = true;
  const next = preview.value;
  const shouldEmit =
    emitReorder &&
    dragging &&
    moved &&
    next != null &&
    next.some((track, i) => track.id !== props.tracks[i]?.id);
  dragging = false;
  pendingRow = false;
  draggingId.value = null;
  releaseCapture();
  detachPointerListeners();
  activePointerId = null;
  finishing = false;
  if (shouldEmit && next) {
    emit('reorder', next);
  }
  preview.value = null;
}

function onTablePointerEnd(event: PointerEvent): void {
  if (!dragging && !pendingRow) {
    return;
  }
  if (!samePointer(event)) {
    return;
  }
  finishDrag();
}

function onLostPointerCapture(): void {
  if (dragging || pendingRow) {
    finishDrag();
  }
}

function onTablePointerDown(event: PointerEvent): void {
  if (!props.reorderable || event.button !== 0 || !tableRef.value) {
    return;
  }
  if (dragging || pendingRow) {
    finishDrag();
  }

  const target = hitElement(event);
  if (!target || !(target instanceof Element) || target.closest('.menu, a, .num')) {
    return;
  }

  const row = target.closest('[data-row]');
  if (!(row instanceof HTMLElement) || !tableRef.value.contains(row)) {
    return;
  }
  const index = Number(row.dataset.index);
  if (!Number.isFinite(index) || index < 0) {
    return;
  }

  const onHandle = Boolean(target.closest('.handle'));
  if (!onHandle && event.pointerType === 'touch') {
    return;
  }

  startY = event.clientY;
  fromIndex = index;
  moved = false;
  activePointerId = event.pointerId;

  if (onHandle) {
    beginDrag(index);
  } else {
    pendingRow = true;
  }

  if (event.pointerType !== 'mouse') {
    try {
      tableRef.value.setPointerCapture(event.pointerId);
    } catch {
      /* window listeners still track the pointer */
    }
  }

  onPointerMove = (moveEvent: PointerEvent) => {
    if (!samePointer(moveEvent)) {
      return;
    }
    if (moveEvent.pointerType === 'mouse' && moveEvent.buttons === 0) {
      finishDrag();
      return;
    }
    const delta = Math.abs(moveEvent.clientY - startY);
    if (pendingRow && !dragging) {
      if (delta <= 8) {
        return;
      }
      moved = true;
      beginDrag(fromIndex);
    }
    if (!dragging) {
      return;
    }
    moveEvent.preventDefault();
    if (delta > 3) {
      moved = true;
    }
    moveTo(indexAtClientY(moveEvent.clientY));
  };

  onRelease = (upEvent: Event) => {
    if (upEvent instanceof PointerEvent && !samePointer(upEvent)) {
      return;
    }
    finishDrag();
  };

  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onRelease, true);
  window.addEventListener('pointercancel', onRelease, true);
  window.addEventListener('mouseup', onRelease, true);
  window.addEventListener('dragend', onRelease, true);
}

function onRowClick(track: Track): void {
  if (moved) {
    moved = false;
    return;
  }
  void player.playTrack(track, shown.value);
}
</script>

<template>
  <TaoEmpty v-if="!tracks.length" :title="emptyTitle ?? 'Пока тихо'">
    {{ emptyText ?? 'Здесь появятся треки, когда библиотека наполнится.' }}
  </TaoEmpty>

  <div
    v-else
    ref="tableRef"
    class="table"
    :class="{ 'table--reorder': reorderable, 'table--dragging': draggingId != null }"
    role="table"
    @dragstart.prevent
  >
    <div class="head" role="row">
      <span v-if="reorderable" class="grip-col"></span>
      <span>#</span>
      <span>Трек</span>
      <span class="hide-sm">Альбом</span>
      <span class="hide-sm">Теги</span>
      <span>Время</span>
      <span></span>
    </div>
    <div
      v-for="(track, i) in shown"
      :key="track.id"
      class="row"
      :class="{
        'row--active': player.current?.id === track.id,
        'row--dragging': draggingId === track.id,
      }"
      :data-index="i"
      data-row
      role="row"
      @dblclick="onRowClick(track)"
      @click="onRowClick(track)"
    >
      <div
        v-if="reorderable"
        class="handle"
        role="button"
        aria-label="Перетащить"
        @click.stop
      >
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <circle cx="5" cy="3" r="1.3" fill="currentColor" />
          <circle cx="11" cy="3" r="1.3" fill="currentColor" />
          <circle cx="5" cy="8" r="1.3" fill="currentColor" />
          <circle cx="11" cy="8" r="1.3" fill="currentColor" />
          <circle cx="5" cy="13" r="1.3" fill="currentColor" />
          <circle cx="11" cy="13" r="1.3" fill="currentColor" />
        </svg>
      </div>
      <button type="button" class="num" :aria-label="`Играть ${track.title}`" @click.stop="onRowClick(track)">
        <span class="index">{{ i + 1 }}</span>
        <span class="play-icon">
          <svg viewBox="0 0 24 24" width="14" height="14">
            <path fill="currentColor" d="M8 5v14l11-7z" />
          </svg>
        </span>
      </button>
      <span class="track">
        <CoverArt :track="track" />
        <span class="names">
          <strong>{{ track.title }}</strong>
          <small>{{ track.artist || 'Неизвестный исполнитель' }}</small>
        </span>
      </span>
      <span class="hide-sm album">{{ track.album || '—' }}</span>
      <span class="hide-sm tags">
        <TaoTag v-for="tag in track.tags" :key="tag.id" type="neutral">{{ tag.name }}</TaoTag>
      </span>
      <span class="time">{{ formatDuration(track.durationMs) }}</span>
      <span class="menu" @click.stop>
        <TaoDropdownMenu :actions="actions" @selected="(id) => onSelected(id, track)" />
      </span>
    </div>
  </div>
</template>

<style scoped>
.table {
  display: flex;
  flex-direction: column;
}

.head,
.row {
  display: grid;
  grid-template-columns: 48px minmax(180px, 2fr) minmax(120px, 1.2fr) minmax(120px, 1fr) 64px 40px;
  gap: 12px;
  align-items: center;
  width: 100%;
  padding: 8px 10px;
  text-align: left;
}

.table--reorder .head,
.table--reorder .row {
  grid-template-columns: 28px 48px minmax(180px, 2fr) minmax(120px, 1.2fr) minmax(120px, 1fr) 64px 40px;
}

.head {
  color: var(--tao-color-text-muted);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.row {
  border-radius: 8px;
}

.row:hover,
.row--active {
  background: rgba(255, 255, 255, 0.04);
}

.row--active strong {
  color: var(--tao-color-accent);
}

.row--dragging {
  opacity: 0.55;
  background: var(--tao-color-accent-subtle);
}

.table--dragging {
  cursor: grabbing;
  user-select: none;
}

.table--dragging .row {
  cursor: grabbing;
}

.handle {
  display: grid;
  place-items: center;
  width: 100%;
  height: 36px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--tao-color-text-muted);
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.handle svg {
  pointer-events: none;
}

.handle:hover,
.handle:active {
  color: var(--tao-color-text-strong);
  cursor: grabbing;
}

.num {
  position: relative;
  display: grid;
  place-items: center;
  color: var(--tao-color-text-muted);
  width: 100%;
  height: 36px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.play-icon {
  display: none;
}

.row:hover .index,
.row--active .index {
  display: none;
}

.row:hover .play-icon,
.row--active .play-icon {
  display: grid;
  color: var(--tao-color-text-strong);
}

.track {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.names {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.names strong,
.names small,
.album {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.names strong {
  color: var(--tao-color-text-strong);
  font-size: 14px;
  font-weight: 500;
}

.names small,
.album,
.time {
  color: var(--tao-color-text-muted);
}

.album,
.time {
  font-size: 14px;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.time {
  font-variant-numeric: tabular-nums;
}

@media (max-width: 800px) {
  .head {
    display: none;
  }

  .head,
  .row {
    grid-template-columns: 1fr 48px 44px;
    padding: 10px 4px;
    min-height: 56px;
  }

  .table--reorder .head,
  .table--reorder .row {
    grid-template-columns: 36px 1fr 48px 44px;
  }

  .num,
  .hide-sm {
    display: none;
  }

  .play-icon {
    display: none;
  }

  .handle {
    height: 44px;
  }
}
</style>
