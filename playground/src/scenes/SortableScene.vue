<script setup lang="ts">
import { ref } from 'vue'
import { MasonryGrid, type MasonryGridItem } from '@macrulez/masonry-kit-vue'
import DemoCard from '../components/DemoCard.vue'
import { makeItems, type DemoItem } from '../demoData'

const items = ref<DemoItem[]>(makeItems(14, { min: 100, max: 180 }))

const options = { columns: 4, gap: 14 }

function onReorder(next: MasonryGridItem[]) {
  items.value = next as DemoItem[]
}
</script>

<template>
  <section class="scene">
    <p class="scene-intro">
      <code>sortable: true</code> (§5.4) turns every card into a keyboard-reorderable item, driving the same reactive
      <code>items</code> array via <code>@reorder</code>. Pointer/touch drag was tried and deliberately removed —
      masonry's skyline packing means every other card's position depends on the ones before it, so a live pointer-drag
      reflow is fundamentally unpredictable in a way keyboard reordering (a discrete ±1 step) isn't.
    </p>
    <p class="scene-hint">
      Keyboard: <kbd>Tab</kbd> to a card, <kbd>Space</kbd> to pick it up, <kbd>arrow keys</kbd> to move it,
      <kbd>Space</kbd> to drop, <kbd>Esc</kbd> to cancel.
    </p>

    <MasonryGrid :items="items" :options="options" sortable @reorder="onReorder">
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

.scene-hint {
  font-size: 12px;
  color: var(--color-text-faint);
}

.scene-hint kbd {
  font-family: var(--font-mono);
  font-size: 11px;
  background: var(--color-surface-alt);
  border: 1px solid var(--color-border);
  border-bottom-width: 2px;
  border-radius: 4px;
  padding: 1px 5px;
}
</style>
