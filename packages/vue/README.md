# **Masonry Kit Vue**

![Masonry Kit Vue](https://github.com/macrulezru/assets/blob/master/packages-images/masonry-kit-vue-vuecraft.png?raw=true)

Vue 3 `<MasonryGrid>` component and `useMasonry()` composable for
masonry/bento grid layouts, built on
[`@macrulez/masonry-kit-core`](https://www.npmjs.com/package/@macrulez/masonry-kit-core).
You own the card markup — this only measures it and positions it.

Part of the [masonry-kit](https://github.com/macrulezru/masonry-kit)
monorepo. See also
[`@macrulez/masonry-kit-nuxt`](https://www.npmjs.com/package/@macrulez/masonry-kit-nuxt)
if you're on Nuxt, and the
[`playground`](https://github.com/macrulezru/masonry-kit/tree/master/playground)
for a live example (bento spans, virtualization, a horizontal shelf,
keyboard reordering, SSR fallback).

---

## Features

- **`<MasonryGrid>`** — slot-per-item component: wraps each item's `#item` slot content in a measured wrapper `<div>`, forwards it to the engine, and applies its resolved position
- **`useMasonry()`** — low-level composable for when the slot-per-item component doesn't fit; you own the item elements, this wires the engine to a container and keeps it synced with reactive `items`
- **Bento spans** — `colSpan`/`rowSpan` per item, same as core
- **Virtualization** — `options.virtualize` renders a wrapper/slot only for currently visible items; the rest exist only as an estimate inside the engine, not in the DOM
- **FLIP-animated reflow, add/remove fade** — `options.animate` (default `true`); a removed item's wrapper stays mounted for `transitionDuration` so core's leave fade-out actually gets to play instead of being cut short by an immediate unmount
- **`sortable` keyboard reordering** — every item becomes keyboard-reorderable (space/enter to pick up, arrow keys to move, space/enter to drop, escape to cancel), announced through a live region; never mutates `items` — emits `reorder` with the new array, same idea as `v-model`
- **SSR-safe out of the box** — renders a CSS `columns` approximation until the engine's first real layout, no `<ClientOnly>` needed
- **The full `@macrulez/masonry-kit-core` surface, re-exported** — `createMasonryEngine`, `optionsEqual`, `resolveSsrColumns`, `setMasonryDefaults`, and their types are all available straight from `@macrulez/masonry-kit-vue` too, no separate core install needed

---

## When you'd reach for this

`@macrulez/masonry-kit-core`'s engine with Vue's own reactivity wired on top — a reactive `items` array in, positioned cards out.

- **A gallery/feed of cards with naturally differing heights** — `<MasonryGrid>` packs them into balanced columns reactively; add/remove/reorder `items` and it relayouts on its own, no manual relayout call needed.
- **A bento-style dashboard with some cards wider than others** — `colSpan` on the item object is the whole API, no separate CSS Grid template to keep in sync with the data.
- **A list large enough that mounting every card at once is expensive** — `options.virtualize` keeps only the currently visible window's cards actually in the DOM.
- **A reorderable list that needs to be keyboard-accessible, not just draggable** — `sortable` gives pick-up/move/drop via the keyboard with ARIA live-region announcements built in, no separate accessibility pass.
- **A Nuxt/SSR page rendering this grid** — no flash of unstyled or stacked content; a CSS `columns` approximation renders immediately server-side, swapped for the real layout the instant the engine measures on the client.

---

## Installation

Requires Vue `^3.3.0`.

```bash
npm install @macrulez/masonry-kit-vue
```

### Quick start

```vue
<script setup lang="ts">
import { MasonryGrid } from '@macrulez/masonry-kit-vue'

const items = [{ id: 'a' }, { id: 'b', colSpan: 2 }, { id: 'c' }]
</script>

<template>
  <MasonryGrid :items="items" :options="{ columns: 'auto', minLaneSize: 240 }">
    <template #item="{ item }">
      <MyCard :data="item" />
    </template>
  </MasonryGrid>
</template>
```

### More examples

#### Bento spans

```vue
<MasonryGrid :items="items" :options="{ columns: 4, gap: 14 }">
  <template #item="{ item }">
    <DemoCard :label="item.id" :height="item.size" />
  </template>
</MasonryGrid>
```

`colSpan` on any item stretches it across that many lanes; add/remove/shuffle `items` and every card reflows live.

#### Virtualizing a large list

```vue
<MasonryGrid :items="items" :options="{ virtualize: { overscan: 800 }, minLaneSize: 200 }">
  <template #item="{ item }">
    <Card :item="item" />
  </template>
</MasonryGrid>
```

Only items inside the visible range (± `overscan`) actually get a wrapper/slot mounted — the rest exist only as an estimate until they scroll into view.

#### Keyboard-reorderable items (`sortable`)

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { MasonryGrid, type MasonryGridItem } from '@macrulez/masonry-kit-vue'

const items = ref([{ id: 'a' }, { id: 'b' }, { id: 'c' }])

function onReorder(next: MasonryGridItem[]) {
  items.value = next
}
</script>

<template>
  <MasonryGrid :items="items" sortable @reorder="onReorder">
    <template #item="{ item }">
      <Card :item="item" />
    </template>
  </MasonryGrid>
</template>
```

Tab to a card, Space/Enter to pick it up, arrow keys to move it, Space/Enter to drop, Escape to cancel — no pointer/touch drag: masonry's skyline packing makes a live pointer-drag reflow inherently unpredictable (which neighbor ends up where depends on the exact path the cursor took, not just where it landed) in a way a discrete keyboard step isn't.

#### `useMasonry()` — the low-level escape hatch

```vue
<script setup lang="ts">
import { useTemplateRef } from 'vue'
import { useMasonry } from '@macrulez/masonry-kit-vue'

const container = useTemplateRef('container')
const cardA = useTemplateRef('cardA')
const cardB = useTemplateRef('cardB')

const { engine } = useMasonry(container, {
  items: [
    { id: 'a', el: cardA },
    { id: 'b', el: cardB },
  ],
  columns: 3,
})
</script>

<template>
  <div ref="container">
    <div ref="cardA">A</div>
    <div ref="cardB">B</div>
  </div>
</template>
```

`items[].el` accepts a ref, a getter, or a plain value (`MaybeRefOrGetter`) — it can start out `null` before the element mounts and `useMasonry` will pick it up automatically once it resolves.

#### `setMasonryDefaults()`

Package-wide fallback for any `MasonryOptions` field, read underneath an explicit `options` prop/argument. This is what
[`@macrulez/masonry-kit-nuxt`](https://www.npmjs.com/package/@macrulez/masonry-kit-nuxt)'s
module options configure under the hood — call it directly if you're not using Nuxt but still want project-wide defaults:

```ts
import { setMasonryDefaults } from '@macrulez/masonry-kit-vue'

setMasonryDefaults({ gap: 12, animate: true, transitionDuration: 200 })
```

---

## Documentation & links

- 📖 **Full documentation:** [npm.vuecraft.ru/en/packages/masonry-kit](https://npm.vuecraft.ru/en/packages/masonry-kit/guide/component.html)
- 🌐 **VueCraft:** [vuecraft.ru/en](https://vuecraft.ru/en)
- 👤 **Author:** [macrulez.ru/en](https://macrulez.ru/en)
- 💻 **GitHub:** [macrulezru/masonry-kit/packages/vue](https://github.com/macrulezru/masonry-kit/tree/master/packages/vue)
- 📦 **NPM:** [@macrulez/masonry-kit-vue](https://www.npmjs.com/package/@macrulez/masonry-kit-vue)
- 🐛 **Issues:** [github.com/macrulezru/masonry-kit/issues](https://github.com/macrulezru/masonry-kit/issues)

---

## License

MIT

---

## 💖 Support the project

Open source takes time and effort. If this library saves you time or brings value, consider supporting further development.

<a href="https://donate.cryptocloud.plus/M6O34NIN" target="_blank">
  <img src="https://img.shields.io/badge/Donate-CryptoCloud-8A2BE2?style=for-the-badge&logo=cryptocurrency&logoColor=white" alt="Donate via CryptoCloud">
</a>

Thank you for being part of this journey. ❤️
