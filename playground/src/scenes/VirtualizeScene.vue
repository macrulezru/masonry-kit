<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { MasonryGrid } from '@macrulez/masonry-kit-vue'
import DemoCard from '../components/DemoCard.vue'
import { makeItems } from '../demoData'

const TOTAL = 3000
// estimatedSize mirrors DemoCard's actual rendered height, so the engine's
// DOM-free estimate pass (§3.5) already lands right where the real,
// once-mounted measurement will confirm it — no visible resettling on scroll.
const items = makeItems(TOTAL, { min: 100, max: 260 }).map((item) => ({ ...item, estimatedSize: item.size }))

const gridRef = ref<{ $el: HTMLElement } | null>(null)
const mountedCount = ref(0)

// `@layout` fires before Vue has patched the DOM to the new visible set (the
// engine emits synchronously, inside the same call that goes on to update the
// component's own visible-ids state) — nextTick() waits for that patch before
// counting what's actually mounted right now.
async function onLayout() {
  await nextTick()
  mountedCount.value = gridRef.value?.$el.querySelectorAll('.mk-item').length ?? 0
}
</script>

<template>
  <section class="scene">
    <p class="scene-intro">
      <code>virtualize: true</code> on {{ TOTAL.toLocaleString() }} cards — only the ones within the viewport (±
      <code>overscan</code>) actually mount; the rest exist purely as an estimated position inside the engine (§3.5), no
      DOM node at all. Scroll and watch the counter track it live.
    </p>
    <p class="scene-stat">
      <strong>{{ mountedCount }}</strong> / {{ TOTAL.toLocaleString() }} cards currently in the DOM
    </p>

    <MasonryGrid
      ref="gridRef"
      :items="items"
      :options="{ columns: 'auto', minLaneSize: 200, gap: 12, virtualize: true }"
      @layout="onLayout"
    >
      <template #item="{ item }">
        <DemoCard :label="item.id" :height="item.size" :color="item.color" />
      </template>
    </MasonryGrid>
  </section>
</template>

<style scoped>
.scene {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.scene-stat {
  font-size: 13px;
  color: var(--color-text-muted);
}

.scene-stat strong {
  font-family: var(--font-mono);
  color: var(--color-accent-dark);
  font-size: 15px;
}
</style>
