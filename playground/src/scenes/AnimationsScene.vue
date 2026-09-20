<script setup lang="ts">
import { computed, ref } from 'vue'
import { MasonryGrid, type MasonryOptions } from '@macrulez/masonry-kit-vue'
import DemoCard from '../components/DemoCard.vue'
import { makeItem, makeItems, type DemoItem } from '../demoData'

const animate = ref(true)
const transitionDuration = ref(250)
const transitionEasing = ref('cubic-bezier(0.2, 0, 0, 1)')

const easingOptions = [
  { value: 'cubic-bezier(0.2, 0, 0, 1)', label: 'default (cubic-bezier)' },
  { value: 'ease', label: 'ease' },
  { value: 'ease-in-out', label: 'ease-in-out' },
  { value: 'linear', label: 'linear' },
  { value: 'cubic-bezier(0.34, 1.56, 0.64, 1)', label: 'back (overshoot)' },
]

const items = ref<DemoItem[]>(makeItems(12, { min: 100, max: 180 }))
let nextIndex = items.value.length

function addCard() {
  nextIndex += 1
  const item = makeItem(nextIndex, { min: 100, max: 180 })
  const index = Math.floor(Math.random() * (items.value.length + 1))
  items.value.splice(index, 0, item)
}

function removeRandomCard() {
  if (items.value.length === 0) return
  const index = Math.floor(Math.random() * items.value.length)
  items.value.splice(index, 1)
}

function shuffle() {
  items.value = [...items.value].sort(() => Math.random() - 0.5)
}

const options = computed<MasonryOptions>(() => ({
  columns: 4,
  gap: 14,
  animate: animate.value,
  transitionDuration: transitionDuration.value,
  transitionEasing: transitionEasing.value,
}))
</script>

<template>
  <section class="scene">
    <p class="scene-intro">
      Reflow FLIP-animates every card's <code>transform</code> (§5.2) — no JS ticking, a plain CSS transition on top of
      a position the engine already recomputes. New cards fade+scale in (<code>.mk-item-enter</code>), removed ones
      fade+scale out <em>in place</em> for <code>transitionDuration</code> before actually leaving the DOM
      (<code>.mk-item-leave</code>) instead of just vanishing. All inline styles — <code>animate: false</code> turns all
      of it off, with zero required CSS either way.
    </p>

    <div class="layout">
      <div class="canvas-col">
        <div class="toolbar">
          <button class="toggle-btn" @click="addCard">+ Add card (random position)</button>
          <button class="toggle-btn" @click="removeRandomCard">− Remove random card</button>
          <button class="toggle-btn" @click="shuffle">Shuffle order</button>
        </div>

        <MasonryGrid :items="items" :options="options">
          <template #item="{ item }">
            <DemoCard :label="item.id" :height="item.size" :color="item.color" />
          </template>
        </MasonryGrid>
      </div>

      <div class="panel">
        <p class="panel-title">Animation</p>
        <label class="field-row" style="margin-bottom: 14px; font-size: 12px; color: var(--color-text-muted)">
          <input v-model="animate" type="checkbox" /> animate
        </label>
        <template v-if="animate">
          <div class="field">
            <label
              >transitionDuration <span class="value">{{ transitionDuration }}ms</span></label
            >
            <input v-model.number="transitionDuration" type="range" min="0" max="1000" step="50" />
          </div>
          <div class="field">
            <label>transitionEasing</label>
            <select v-model="transitionEasing">
              <option v-for="opt in easingOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
          </div>
        </template>
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

.layout {
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: 16px;
  align-items: start;
}

@media (max-width: 860px) {
  .layout {
    grid-template-columns: 1fr;
  }
}

.canvas-col {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.toolbar {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
</style>
