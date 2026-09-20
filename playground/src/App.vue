<script setup lang="ts">
import { ref } from 'vue'
import ClassicScene from './scenes/ClassicScene.vue'
import BentoScene from './scenes/BentoScene.vue'
import ResponsiveScene from './scenes/ResponsiveScene.vue'
import HorizontalScene from './scenes/HorizontalScene.vue'
import VirtualizeScene from './scenes/VirtualizeScene.vue'
import AnimationsScene from './scenes/AnimationsScene.vue'
import SortableScene from './scenes/SortableScene.vue'
import SsrScene from './scenes/SsrScene.vue'

const tabs = [
  { id: 'classic', label: 'Classic masonry', component: ClassicScene },
  { id: 'bento', label: 'Bento (colSpan)', component: BentoScene },
  { id: 'responsive', label: 'Responsive lanes', component: ResponsiveScene },
  { id: 'horizontal', label: 'Horizontal lane', component: HorizontalScene },
  { id: 'virtualize', label: 'Virtualized (1000s)', component: VirtualizeScene },
  { id: 'animations', label: 'Animations', component: AnimationsScene },
  { id: 'sortable', label: 'Keyboard reorder', component: SortableScene },
  { id: 'ssr', label: 'SSR fallback', component: SsrScene },
] as const

const activeTab = ref<(typeof tabs)[number]['id']>('classic')
</script>

<template>
  <main>
    <header class="hero">
      <span class="badge">@macrulez/masonry-kit</span>
      <h1>masonry-kit playground</h1>
      <p class="subtitle">A JS-driven masonry/bento grid — you own the cards, the engine only measures and packs.</p>

      <nav class="tab-bar">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="tab"
          :class="{ 'is-active': activeTab === tab.id }"
          type="button"
          @click="activeTab = tab.id"
        >
          {{ tab.label }}
        </button>
      </nav>
    </header>

    <component :is="tabs.find((tab) => tab.id === activeTab)!.component" />
  </main>
</template>

<style scoped>
main {
  max-width: 1080px;
  margin: 0 auto;
  padding: 40px 24px 80px;
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.hero {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
}

.hero h1 {
  font-size: 26px;
}

.subtitle {
  color: var(--color-text-muted);
  font-size: 14px;
  margin-bottom: 8px;
}

.tab-bar {
  margin-top: 4px;
}
</style>
