<script setup lang="ts">
import { MasonryGrid } from '@macrulez/masonry-kit-vue'
import DemoCard from '../components/DemoCard.vue'
import { makeItems } from '../demoData'

const items = makeItems(24)
</script>

<template>
  <section class="scene">
    <p class="scene-intro">
      24 cards with natural, unpredictable heights (real DOM measurement via <code>ResizeObserver</code>, no row
      quantization) — each one packed into the currently shortest column (classic skyline packing, §3.2). Resize the
      window to see <code>columns: 'auto'</code> respond to <code>minLaneSize</code>.
    </p>

    <MasonryGrid :items="items" :options="{ columns: 'auto', minLaneSize: 220, gap: 16 }">
      <template #item="{ item }">
        <DemoCard :label="item.id" :height="item.size" :color="item.color" />
      </template>
    </MasonryGrid>

    <div class="callout">
      <span class="badge">Also available</span>
      <p>
        <code>useMasonry()</code> is a low-level composable for when the slot-per-item
        <code>&lt;MasonryGrid&gt;</code> doesn't fit — same engine, you own the item elements directly:
      </p>
      <pre class="code-preview"><span class="k">const</span> { engine } = useMasonry(containerRef, {
  items: <span class="k">computed</span>(() =&gt; [{ id: <span class="s">'a'</span>, el: aRef }, ...]),
  columns: <span class="s">'auto'</span>,
})</pre>
    </div>
  </section>
</template>

<style scoped>
.scene {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.callout {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px 20px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  max-width: 640px;
}

.callout p {
  font-size: 13px;
  color: var(--color-text-muted);
  line-height: 1.5;
}

.callout code {
  font-family: var(--font-mono);
  font-size: 12px;
  background: var(--color-surface-alt);
  padding: 1px 5px;
  border-radius: 4px;
}
</style>
