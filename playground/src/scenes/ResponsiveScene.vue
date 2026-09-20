<script setup lang="ts">
import { computed, ref } from 'vue'
import { MasonryGrid, type MasonryOptions } from '@macrulez/masonry-kit-vue'
import DemoCard from '../components/DemoCard.vue'
import { makeItems } from '../demoData'

const items = makeItems(20, { min: 80, max: 220 })

type ColumnsMode = 'auto' | 'fixed-2' | 'fixed-3' | 'fixed-4' | 'breakpoints'
const columnsMode = ref<ColumnsMode>('auto')
const minLaneSize = ref(220)
const gap = ref(16)
const placement = ref<NonNullable<MasonryOptions['placement']>>('balanced')

const columns = computed<MasonryOptions['columns']>(() => {
  switch (columnsMode.value) {
    case 'fixed-2':
      return 2
    case 'fixed-3':
      return 3
    case 'fixed-4':
      return 4
    case 'breakpoints':
      return { default: 4, 1024: 3, 768: 2, 480: 1 }
    default:
      return 'auto'
  }
})

const options = computed<MasonryOptions>(() => ({
  columns: columns.value,
  minLaneSize: minLaneSize.value,
  gap: gap.value,
  placement: placement.value,
}))

// A read-only pretty-printed preview of exactly what gets sent to the engine.
const optionsPreview = computed(() => JSON.stringify(options.value, null, 2))
</script>

<template>
  <section class="scene">
    <p class="scene-intro">
      Every field below writes straight into a live <code>MasonryOptions</code> object — nothing is hardcoded per
      control. Watch the grid (and the code preview) update as you change something.
    </p>

    <div class="layout">
      <MasonryGrid class="canvas" :items="items" :options="options">
        <template #item="{ item }">
          <DemoCard :label="item.id" :height="item.size" :color="item.color" />
        </template>
      </MasonryGrid>

      <div class="panels">
        <div class="panel">
          <p class="panel-title">Lanes</p>
          <div class="field">
            <label>columns</label>
            <select v-model="columnsMode">
              <option value="auto">auto (fluid)</option>
              <option value="fixed-2">fixed: 2</option>
              <option value="fixed-3">fixed: 3</option>
              <option value="fixed-4">fixed: 4</option>
              <option value="breakpoints">breakpoints</option>
            </select>
          </div>
          <div v-if="columnsMode === 'auto'" class="field">
            <label
              >minLaneSize <span class="value">{{ minLaneSize }}px</span></label
            >
            <input v-model.number="minLaneSize" type="range" min="120" max="360" step="10" />
          </div>
          <div class="field">
            <label
              >gap <span class="value">{{ gap }}px</span></label
            >
            <input v-model.number="gap" type="range" min="0" max="40" step="2" />
          </div>
          <div class="field">
            <label>placement</label>
            <select v-model="placement">
              <option value="balanced">balanced (skyline)</option>
              <option value="ordered">ordered (round-robin)</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <div class="preview">
      <p class="panel-title">options: MasonryOptions</p>
      <pre class="code-preview">{{ optionsPreview }}</pre>
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

.canvas {
  display: block;
}

.panels {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.preview {
  max-width: 100%;
}
</style>
