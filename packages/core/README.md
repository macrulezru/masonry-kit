# **Masonry Kit Core**

![Masonry Kit Core](https://github.com/macrulezru/assets/blob/master/packages-images/masonry-kit-vuecraft.png?raw=true)

Framework-agnostic masonry/bento grid layout engine. No Vue, no React —
just a `createMasonryEngine(container, options)` factory returning plain
imperative methods that any framework adapter can wrap in its own
reactivity.

Part of the [masonry-kit](https://github.com/macrulezru/masonry-kit)
monorepo. Framework adapters:
[`@macrulez/masonry-kit-vue`](https://www.npmjs.com/package/@macrulez/masonry-kit-vue),
[`@macrulez/masonry-kit-react`](https://www.npmjs.com/package/@macrulez/masonry-kit-react),
[`@macrulez/masonry-kit-nuxt`](https://www.npmjs.com/package/@macrulez/masonry-kit-nuxt).

---

## Features

- **Skyline packing generalized to spans** — [`packLanes()`](./src/packing.ts): classic shortest-lane placement for `span: 1`, generalized to bento-style multi-lane items by searching every valid starting lane for the one whose tallest covered edge is lowest; `'ordered'` skips the search for strict round-robin instead
- **One axis-agnostic engine, not two** — [`masonry-engine.ts`](./src/masonry-engine.ts) shares its geometry between `direction: 'vertical'` (columns) and `'horizontal'` (rows); internally everything is "lane"/"main"/"cross", mapped to physical axes only at the edges
- **`ResizeObserver`-batched relayout** — every observed element's resize is batched into one `requestAnimationFrame`-scheduled recompute ([`resize-watcher.ts`](./src/resize-watcher.ts)), so a dozen images finishing `load` in the same frame trigger one relayout, not a dozen
- **Transform-based positioning** — every item gets `position: absolute` and `transform: translate(x, y)`, never `top`/`left`, so a reflow is compositor-only, not a layout-triggering one
- **Virtualization** (`virtualize`) — a two-phase layout for large lists: items outside the visible range (± `overscan`) skip real DOM measurement entirely and use `estimatedSize`/`aspectRatio`/`estimateSize()` instead; `getVisibleIds()` reports which ids should actually have a mounted element right now
- **FLIP-animated reflow, opacity-only enter/leave** — `animate: true` (default) transitions `transform` on reflow and fades new/removed items via `opacity`, entirely through inline styles, zero required CSS
- **`setDragging(id | null)`** — excludes an item from packing/positioning entirely, for building your own drag or keyboard-reorder interaction on top; re-including it FLIP-animates from wherever you last positioned it into its packed slot instead of snapping there
- **`resolveSsrColumns()`** — the CSS `columns` count a framework adapter renders before the engine exists (SSR, pre-hydration), resolved without measuring anything; the engine itself never reads it
- **`optionsEqual()`** — structural (not just referential) equality for `MasonryOptions`, for an adapter to decide whether an `options` reference change is a real change worth tearing down and recreating the engine for
- **Zero runtime dependencies, zero peer dependencies** — usable standalone in any environment, including outside a framework entirely

---

## When you'd reach for this

You're writing a framework adapter of your own, working somewhere Vue/React/Nuxt aren't an option, or just want the raw engine without a component/hook layer on top.

- **Building an adapter for a framework not already covered** — Svelte, a vanilla web component, a custom internal framework. The engine exposes plain `setItems`/`updateItem`/`on('layout', ...)` methods with no assumptions about how your reactivity works.
- **A vanilla script with no build step or framework at all** — `createMasonryEngine` works the same way loaded straight from a `<script type="module">`.
- **You need control an adapter's component API doesn't expose** — direct access to `setDragging`, a forced `relayout()`, or the raw `layout` event payload for a custom overlay or debug view.
- **Testing masonry-packing logic in isolation** — `packLanes()` is a pure function with no DOM involved at all; assert on lane/position output directly.

---

## Installation

```bash
npm install @macrulez/masonry-kit-core
```

No peer dependencies. Requires Node.js `18+` in a Node/SSR context; in the browser, real measurement needs `ResizeObserver` (no polyfill bundled).

### Quick start

```ts
import { createMasonryEngine } from '@macrulez/masonry-kit-core'

const engine = createMasonryEngine(document.querySelector('#grid'), {
  columns: 'auto',
  minLaneSize: 240,
  gap: 16,
})

engine.setItems([
  { id: 'a', el: document.querySelector('#card-a') },
  { id: 'b', el: document.querySelector('#card-b'), colSpan: 2 },
])

engine.on('layout', ({ items }) => {
  // items: [{ id, x, y, width, height }, ...]
})

engine.destroy() // stops the ResizeObserver, removes listeners
```

### More examples

#### `createMasonryEngine(container, options?)`

| Method                    |                                                                                               |
| ------------------------- | --------------------------------------------------------------------------------------------- |
| `setItems(items)`         | Replaces the full item list — the usual way to sync a reactive `items` array                  |
| `updateItem(id, patch)`   | Patches one item's descriptor fields (`colSpan`, `order`, ...) in place                       |
| `addItem(item, index?)`   | Inserts a single item, optionally at a specific position in the pack order                    |
| `removeItem(id)`          | Removes one item, applying its leave fade-out first                                           |
| `relayout()`              | Forces an immediate recompute, bypassing the rAF batching                                     |
| `getLayout()`             | The current resolved boxes — for building your own overlay/debug view                         |
| `getVisibleIds()`         | Ids that should have a real element right now (every packed id when `virtualize` is off)      |
| `setDragging(id \| null)` | Excludes `id` from packing entirely — see "Building your own drag/reorder" below              |
| `on(event, handler)`      | Subscribes to `'layout'`, fired at the end of every relayout; returns an unsubscribe function |
| `destroy()`               | Tears down the `ResizeObserver` and any scroll listener                                       |

#### Bento spans (`colSpan`/`rowSpan`)

```ts
engine.setItems([
  { id: 'hero', el: heroEl, colSpan: 2 }, // spans 2 lanes
  { id: 'a', el: aEl },
  { id: 'b', el: bEl },
])
```

A wider item pulls the skyline up to the tallest of every lane it covers — no separate CSS Grid template to keep in sync with the data.

#### Virtualizing a large list

```ts
const engine = createMasonryEngine(container, {
  virtualize: { overscan: 800 },
  estimateSize: (item) => item.estimatedHeight ?? 200,
})

engine.on('layout', ({ visibleIds }) => {
  // mount/unmount your own elements for visibleIds only
})
```

Items outside the visible window are positioned from an estimate and never measured until they actually scroll into range.

#### Horizontal direction

```ts
const engine = createMasonryEngine(container, { direction: 'horizontal', rows: 3, minLaneSize: 160 })
```

Same engine, same options shape — `rows` replaces `columns`. The container needs an explicit CSS height set by you; the engine sets `overflow-x: auto` but never a height in `horizontal` mode.

#### SSR / pre-hydration approximation

```ts
import { resolveSsrColumns } from '@macrulez/masonry-kit-core'

resolveSsrColumns(options.columns, options.ssrColumns) // e.g. 2 — render a CSS `columns: 2` approximation with this
```

Used internally by every framework adapter to render a CSS `columns` fallback before the engine has measured anything for real — see [`@macrulez/masonry-kit-vue`](https://www.npmjs.com/package/@macrulez/masonry-kit-vue)'s README for how that fallback switches over.

#### Building your own drag/reorder interaction

```ts
engine.setDragging('card-3') // excluded from packing — position it yourself
// ...your own drag/keyboard-move logic updates card-3's transform directly...
engine.setDragging(null) // re-included, FLIP-animates into its packed slot
```

This is exactly what `@macrulez/masonry-kit-vue`/`-react`'s `sortable` keyboard reordering is built on.

---

## Documentation & links

- 📖 **Full documentation:** [npm.vuecraft.ru/en/packages/masonry-kit](https://npm.vuecraft.ru/en/packages/masonry-kit/guide/overview.html)
- 🌐 **VueCraft:** [vuecraft.ru/en](https://vuecraft.ru/en)
- 👤 **Author:** [macrulez.ru/en](https://macrulez.ru/en)
- 💻 **GitHub:** [macrulezru/masonry-kit/packages/core](https://github.com/macrulezru/masonry-kit/tree/master/packages/core)
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
