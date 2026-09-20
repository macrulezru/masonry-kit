<script setup lang="ts">
import { ref } from 'vue'
import { MasonryGrid } from '@macrulez/masonry-kit-vue'
import DemoCard from '../components/DemoCard.vue'
import { makeItems } from '../demoData'

interface LaneItem {
  id: string
  size: number
  color: string
  rowSpan?: number
}

// `size` becomes each card's WIDTH here — at direction: 'horizontal' the main
// (content-measured) axis is x, not y, but it's the exact same skyline engine.
const items: LaneItem[] = makeItems(16, { min: 140, max: 320 }).map((item, i) => ({
  ...item,
  rowSpan: i % 5 === 0 ? 2 : undefined,
}))

// `<MasonryGrid>` has no `expose()`, so `$el` (Vue's built-in escape hatch,
// not a custom exposed property) is how a `ref` here reaches its actual root
// element — the same one the engine treats as its scroll container.
const gridRef = ref<{ $el: HTMLElement } | null>(null)
function laneEl(): HTMLElement | null {
  return gridRef.value?.$el ?? null
}

function scrollLane(direction: -1 | 1) {
  laneEl()?.scrollBy({ left: direction * 320, behavior: 'smooth' })
}

// The lane only ever scrolls horizontally, so redirecting a plain vertical
// wheel into scrollLeft doesn't fight anything a wheel would otherwise do
// here — and it's a far more discoverable gesture than shift+wheel, which
// the native (now hidden, see .lane below) scrollbar would normally hint at.
function onWheel(event: WheelEvent) {
  if (event.deltaY === 0) return
  event.preventDefault()
  laneEl()?.scrollBy({ left: event.deltaY })
}
</script>

<template>
  <section class="scene">
    <p class="scene-intro">
      <code>direction: 'horizontal'</code> packs along x instead of y, through the exact same skyline algorithm (§3.1) —
      just a different axis mapping, not a second implementation. The container scrolls horizontally (<code
        >overflow-x: auto</code
      >, set by the engine itself) and needs an explicit CSS height, since the engine only ever reads that axis, never
      guesses it.
    </p>

    <div class="lane-shell">
      <button class="lane-nav" type="button" aria-label="Scroll left" @click="scrollLane(-1)">‹</button>

      <MasonryGrid
        ref="gridRef"
        class="lane"
        :items="items"
        :options="{ direction: 'horizontal', rows: 3, gap: 14 }"
        @wheel="onWheel"
      >
        <template #item="{ item }">
          <DemoCard
            :label="item.id"
            :width="item.size"
            :color="item.color"
            :badge="item.rowSpan ? `rowSpan ${item.rowSpan}` : undefined"
          />
        </template>
      </MasonryGrid>

      <button class="lane-nav" type="button" aria-label="Scroll right" @click="scrollLane(1)">›</button>
    </div>
  </section>
</template>

<style scoped>
.scene {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.lane-shell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.lane-nav {
  flex: none;
  appearance: none;
  width: 36px;
  height: 36px;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  box-shadow: var(--shadow-sm);
}

.lane-nav:hover {
  border-color: var(--color-accent);
  color: var(--color-accent-dark);
}

.lane {
  display: block;
  flex: 1;
  min-width: 0;
  height: 420px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  /* A classic (space-reserving) OS scrollbar would eat into the last row's
     own height — masonry-kit fills exactly the box it's given (§3.2), it has
     no notion of "leave room for a scrollbar". Scrolling itself still works
     fully (wheel here, or the nav buttons above), just without the native
     scrollbar's own UI, which is what the buttons/wheel handling replace. */
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.lane::-webkit-scrollbar {
  display: none;
}
</style>
