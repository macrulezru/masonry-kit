# **Masonry Kit**

![Masonry Kit](https://github.com/macrulezru/assets/blob/master/packages-images/masonry-kit-vuecraft.png?raw=true)

Framework-agnostic masonry/bento grid layout engine — `ResizeObserver`-measured,
`transform`-positioned, with bento-style `colSpan`/`rowSpan` cards built in
from the start, not bolted on later. Vue 3, React, and Nuxt adapters share
one core. You own the card markup and content; this only measures it and
packs it.

---

## Packages

| Package                                         | Description                                                                                                                           |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| [`@macrulez/masonry-kit-core`](packages/core)   | Framework-agnostic engine — `createMasonryEngine(container, options)`, no Vue/React involved.                                         |
| [`@macrulez/masonry-kit-vue`](packages/vue)     | `<MasonryGrid>` component (slot per item) and `useMasonry()` composable — plus every core export, re-exported.                        |
| [`@macrulez/masonry-kit-react`](packages/react) | `<MasonryGrid>` render-prop component and `useMasonry()` hook, mirroring the Vue adapter's API — plus every core export, re-exported. |
| [`@macrulez/masonry-kit-nuxt`](packages/nuxt)   | Nuxt module wrapping the Vue package — auto-imports `<MasonryGrid>`/`useMasonry`, seeds shared option defaults from `nuxt.config.ts`. |

---

## Features

- **Skyline packing generalized to spans** — classic shortest-lane masonry, extended to bento-style `colSpan`/`rowSpan` cards from the first line of code, not bolted on afterward; `'balanced'` (default) picks the least-filled lane group for each item, `'ordered'` keeps strict round-robin instead
- **One axis-agnostic engine for both directions** — `direction: 'vertical'` (columns) and `'horizontal'` (rows) share the same core geometry, not two separate algorithms to keep in sync
- **Transform-based positioning, not CSS `columns`/Grid masonry** — every item is measured via `ResizeObserver` and placed with `transform: translate()`, so a reflow never triggers layout of its own, and an image's height changing after `load` re-packs the grid automatically
- **Virtualization built in** (`virtualize`) — a two-phase layout for large lists: items outside the visible range (± overscan) skip real DOM measurement entirely and use an estimated size instead, so relayout stays cheap regardless of list size
- **FLIP-animated reflow** — items slide into their new slot instead of teleporting, and fade in/out on add/remove, entirely via inline styles (zero required CSS)
- **SSR-safe** — a CSS `columns` approximation renders before the engine exists (server-side, and for the one client frame before the first real measurement), then swaps to the exact layout in the same frame it measures
- **Keyboard-reorderable items** (`sortable`) — pick up/move/drop via space and arrow keys, announced through a live region; pointer/touch drag was tried and deliberately left out — masonry's skyline packing makes a live pointer-drag reflow inherently unpredictable (which neighbor ends up where depends on the exact path the cursor took, not just where it landed) in a way a discrete keyboard step isn't
- **Vue, React, and Nuxt adapters over one core** — a `<MasonryGrid>` component/hook pair for each framework, all re-exporting the full core surface, so installing just one adapter package reaches the framework-agnostic layer too
- **Zero peer dependencies in core** — `@macrulez/masonry-kit-core` runs anywhere, including outside a framework entirely

---

## When you'd reach for this

A grid of cards with naturally differing heights usually means either CSS `columns` (which fills top-to-bottom, then the next column — order rarely matches the visual reading order) or a heavier masonry library with its own opinions about markup. Masonry Kit measures your existing cards and packs them, leaving the markup and styling entirely yours.

- **A Pinterest-style image/card gallery** — Cards of different natural heights, packed into evenly height-balanced columns via skyline packing, instead of CSS `columns`' arbitrary fill order.
- **A bento/dashboard layout with cards of different sizes** — Some cards wider than others, via `colSpan`/`rowSpan`, sitting in the same skyline pack as the regular ones — not a hand-placed CSS Grid template that needs updating every time the data changes.
- **A feed with hundreds or thousands of cards** — `virtualize` keeps relayout cheap by estimating off-screen items instead of measuring the entire list on every scroll.
- **A horizontally scrolling shelf of cards** — `direction: 'horizontal'` packs into rows instead of columns — same engine, same options, just a different axis.
- **A masonry grid that needs to survive a full page load without flashing** — SSR/pre-hydration renders a CSS `columns` approximation, then switches to the exact layout the instant the engine measures for real, in the same frame.

---

## Installation

| Peer dependency              | Required                               |
| ---------------------------- | -------------------------------------- |
| Node.js `18+`                | always                                 |
| Vue `^3.3.0`                 | only for `@macrulez/masonry-kit-vue`   |
| React `^18.0.0 \|\| ^19.0.0` | only for `@macrulez/masonry-kit-react` |
| Nuxt `^3.9.0 \|\| ^4.0.0`    | only for `@macrulez/masonry-kit-nuxt`  |

Install whichever package matches your project — every adapter already
depends on `@macrulez/masonry-kit-core`, so you don't need to install
core yourself unless you're using it directly, with no framework:

```bash
npm install @macrulez/masonry-kit-core   # framework-agnostic core only
npm install @macrulez/masonry-kit-vue    # Vue 3
npm install @macrulez/masonry-kit-react  # React
npm install @macrulez/masonry-kit-nuxt   # Nuxt (pulls in the Vue adapter)
```

### Quick start — Vanilla / Core

```ts
import { createMasonryEngine } from '@macrulez/masonry-kit-core'

const container = document.querySelector('#grid')
const engine = createMasonryEngine(container, { columns: 'auto', minLaneSize: 240 })

engine.setItems([
  { id: 'a', el: document.querySelector('#card-a') },
  { id: 'b', el: document.querySelector('#card-b'), colSpan: 2 },
])
```

### Quick start — Vue

```vue
<script setup lang="ts">
import { MasonryGrid } from '@macrulez/masonry-kit-vue'

const items = [{ id: 'a' }, { id: 'b', colSpan: 2 }]
</script>

<template>
  <MasonryGrid :items="items" :options="{ columns: 'auto', minLaneSize: 240 }">
    <template #item="{ item }">
      <MyCard :data="item" />
    </template>
  </MasonryGrid>
</template>
```

### Quick start — React

```tsx
import { MasonryGrid } from '@macrulez/masonry-kit-react'

const items = [{ id: 'a' }, { id: 'b', colSpan: 2 }]

function Gallery() {
  return (
    <MasonryGrid items={items} options={{ columns: 'auto', minLaneSize: 240 }}>
      {(item) => <MyCard data={item} />}
    </MasonryGrid>
  )
}
```

### Quick start — Nuxt

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@macrulez/masonry-kit-nuxt'],
  masonry: {
    columns: 'auto',
    minLaneSize: 240,
  },
})
```

```vue
<template>
  <!-- <MasonryGrid>/useMasonry are auto-imported — no explicit import needed -->
  <MasonryGrid :items="items">
    <template #item="{ item }">
      <MyCard :data="item" />
    </template>
  </MasonryGrid>
</template>
```

### More examples

#### Bento spans

A wider item pulls the skyline up to the tallest of every lane it covers — no separate CSS Grid template to keep in sync with the data:

```ts
engine.setItems([
  { id: 'hero', el: heroEl, colSpan: 2 },
  { id: 'a', el: aEl },
  { id: 'b', el: bEl },
])
```

#### Virtualizing a large list

```ts
const engine = createMasonryEngine(container, {
  virtualize: { overscan: 800 },
  estimateSize: (item) => item.estimatedHeight ?? 200,
})
```

Only items within the visible range (± `overscan`) get measured; the rest are positioned from an estimate until they scroll into view.

#### Horizontal shelf

```ts
const engine = createMasonryEngine(container, { direction: 'horizontal', rows: 2, minLaneSize: 160 })
```

Same engine, same options shape — `rows` replaces `columns`, and the container needs an explicit CSS height set by you; the engine sets `overflow-x: auto` but never a height in `horizontal` mode.

---

## Documentation & links

- 📖 **Full documentation:** [npm.vuecraft.ru/en/packages/masonry-kit](https://npm.vuecraft.ru/en/packages/masonry-kit/guide/overview.html)
- 🌐 **VueCraft:** [vuecraft.ru/en](https://vuecraft.ru/en)
- 👤 **Author:** [macrulez.ru/en](https://macrulez.ru/en)
- 💻 **GitHub:** [macrulezru/masonry-kit](https://github.com/macrulezru/masonry-kit)
- 📦 **NPM:** [@macrulez/masonry-kit-core](https://www.npmjs.com/package/@macrulez/masonry-kit-core)
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
