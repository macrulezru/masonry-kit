<script setup lang="ts">
import { MasonryGrid } from '@macrulez/masonry-kit-vue'
import DemoCard from '../components/DemoCard.vue'
import { makeItems } from '../demoData'

const items = makeItems(12, { min: 90, max: 220 })
const ssrColumns = 3
const gap = 16
</script>

<template>
  <section class="scene">
    <p class="scene-intro">
      §4.4: before the engine's first client-side measurement — which, in a real SSR app (see
      <code>@macrulez/masonry-kit-nuxt</code>), means the server-rendered HTML itself —
      <code>&lt;MasonryGrid&gt;</code> renders a pure-CSS <code>columns</code> approximation instead of nothing: real
      content, visible with zero JS, using <code>MasonryOptions.ssrColumns</code> (or <code>columns</code>/<code
        >rows</code
      >
      if already a concrete number) for the column count. The moment the engine's first layout pass completes, it
      switches to the real transform-based layout in the same reactive flush — this playground is a client-only Vite SPA
      though, so that live switch happens before the first paint and can't actually be watched here. The two panels
      below are a <strong>static side-by-side</strong> of the two end states instead, same data, same
      <code>ssrColumns: 3</code>.
    </p>

    <div class="panels">
      <div class="panel">
        <h3>What the server sends (CSS <code>columns</code>)</h3>
        <div class="ssr-fallback" :style="{ columns: ssrColumns, columnGap: `${gap}px` }">
          <div v-for="item in items" :key="item.id" :style="{ breakInside: 'avoid', marginBottom: `${gap}px` }">
            <DemoCard :label="item.id" :height="item.size" :color="item.color" />
          </div>
        </div>
        <p class="panel-note">Top-to-bottom per column, left-to-right — plain multi-column flow, no JS involved.</p>
      </div>

      <div class="panel">
        <h3>After the first client measurement (real layout)</h3>
        <MasonryGrid :items="items" :options="{ columns: ssrColumns, gap }">
          <template #item="{ item }">
            <DemoCard :label="item.id" :height="item.size" :color="item.color" />
          </template>
        </MasonryGrid>
        <p class="panel-note">Balanced skyline packing (§3.2) — notice some cards land in a different column.</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.scene {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.panels {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 24px;
  align-items: start;
}

.panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.panel h3 {
  font-size: 13px;
  font-weight: 600;
}

.panel-note {
  font-size: 12px;
  color: var(--color-text-faint);
}
</style>
