<script setup lang="ts">
import { ref } from 'vue'
import { MasonryGrid } from '@macrulez/masonry-kit-vue'
import DemoCard from '../components/DemoCard.vue'
import { makeItem, makeItems, type DemoItem } from '../demoData'

interface BentoItem extends DemoItem {
  colSpan?: number
}

// Sparse set of wide cards among the regular ones — colSpan pulls the
// skyline up to the tallest lane it covers (§3.3), no CSS Grid row
// quantization involved.
const wideIndices = new Set([2, 8, 13])

const items = ref<BentoItem[]>(
  makeItems(18, { min: 100, max: 180 }).map((item, i) => ({ ...item, colSpan: wideIndices.has(i) ? 2 : undefined })),
)

let nextIndex = items.value.length

function addCard() {
  nextIndex += 1
  const extra = makeItem(nextIndex, { min: 100, max: 220 })
  items.value.push({ ...extra, colSpan: Math.random() < 0.3 ? 2 : undefined })
}

function removeLast() {
  items.value.pop()
}

function shuffle() {
  items.value = [...items.value].sort(() => Math.random() - 0.5)
}
</script>

<template>
  <section class="scene">
    <p class="scene-intro">
      <code>colSpan</code> cards span multiple lanes at once. The buttons below drive the same reactive
      <code>items</code> array that <code>&lt;MasonryGrid&gt;</code> forwards to <code>setItems</code> — add/remove/
      reorder all reflow live, no manual relayout call needed.
    </p>

    <div class="toolbar">
      <button class="toggle-btn" @click="addCard">+ Add card</button>
      <button class="toggle-btn" @click="removeLast">− Remove last</button>
      <button class="toggle-btn" @click="shuffle">Shuffle order</button>
    </div>

    <MasonryGrid :items="items" :options="{ columns: 4, gap: 14 }">
      <template #item="{ item }">
        <DemoCard
          :label="item.id"
          :height="item.size"
          :color="item.color"
          :badge="item.colSpan ? `colSpan ${item.colSpan}` : undefined"
        />
      </template>
    </MasonryGrid>
  </section>
</template>

<style scoped>
.scene {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.toolbar {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
</style>
