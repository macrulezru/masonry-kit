# **Masonry Kit React**

![Masonry Kit React](https://github.com/macrulezru/assets/blob/master/packages-images/masonry-kit-react-vuecraft.png?raw=true)

React `<MasonryGrid>` render-prop component and `useMasonry()` hook for
masonry/bento grid layouts, mirroring
[`@macrulez/masonry-kit-vue`](https://www.npmjs.com/package/@macrulez/masonry-kit-vue)'s
API. Built on
[`@macrulez/masonry-kit-core`](https://www.npmjs.com/package/@macrulez/masonry-kit-core).
You own the card markup — this only measures it and positions it.

Part of the [masonry-kit](https://github.com/macrulezru/masonry-kit)
monorepo.

---

## Features

- **`<MasonryGrid>`** — render-prop component: calls `children(item)` for each item, wraps the result in a measured wrapper `<div>`, forwards it to the engine, and applies its resolved position
- **`useMasonry()`** — low-level hook for when the render-prop component doesn't fit; you own the item elements, this wires the engine to a container and keeps it synced with `options.items`
- **Bento spans** — `colSpan`/`rowSpan` per item, same as core
- **Virtualization** — `options.virtualize` renders a wrapper/render call only for currently visible items; the rest exist only as an estimate inside the engine, not in the DOM
- **FLIP-animated reflow, add/remove fade** — `options.animate` (default `true`); a removed item's wrapper stays mounted for `transitionDuration` so core's leave fade-out actually gets to play instead of being cut short by an immediate unmount
- **`sortable` keyboard reordering** — every item becomes keyboard-reorderable (space/enter to pick up, arrow keys to move, space/enter to drop, escape to cancel), announced through a live region; never mutates `items` — calls `onReorder` with the new array
- **SSR-safe out of the box** — renders a CSS `columns` approximation until the engine's first real layout, using `useLayoutEffect`'s SSR-safe fallback under the hood
- **The full `@macrulez/masonry-kit-core` surface, re-exported** — `createMasonryEngine`, `optionsEqual`, `resolveSsrColumns`, and their types are all available straight from `@macrulez/masonry-kit-react` too, no separate core install needed

---

## When you'd reach for this

The same capabilities as the Vue adapter, for a React codebase — the same core engine underneath, just without the Vue dependency.

- **A React app needs the same masonry layout a Vue app already has** — a design system, or a project mid-migration where the packing behavior should be identical regardless of which framework a given screen is written in.
- **A gallery/feed of cards with naturally differing heights** — `<MasonryGrid>` packs them into balanced columns; update `items` and it relayouts on its own, no manual relayout call.
- **A bento-style dashboard with some cards wider than others** — `colSpan` on the item object is the whole API, no separate CSS Grid template to keep in sync with the data.
- **A list large enough that mounting every card at once is expensive** — `options.virtualize` keeps only the currently visible window's cards actually in the DOM.
- **A reorderable list that needs to be keyboard-accessible, not just draggable** — `sortable` gives pick-up/move/drop via the keyboard with ARIA live-region announcements built in.

---

## Installation

Requires React `^18.0.0 || ^19.0.0`.

```bash
npm install @macrulez/masonry-kit-react
```

### Quick start

```tsx
import { MasonryGrid } from '@macrulez/masonry-kit-react'

const items = [{ id: 'a' }, { id: 'b', colSpan: 2 }, { id: 'c' }]

function Gallery() {
  return (
    <MasonryGrid items={items} options={{ columns: 'auto', minLaneSize: 240 }}>
      {(item) => <MyCard data={item} />}
    </MasonryGrid>
  )
}
```

`options` is compared by reference — memoize it (`useMemo`, or a module-level constant) if it isn't already stable, so an unrelated re-render doesn't tear down and recreate the engine. See `useStableOptions` in the source if you need this without memoizing yourself.

### More examples

#### Bento spans

```tsx
<MasonryGrid items={items} options={{ columns: 4, gap: 14 }}>
  {(item) => <DemoCard label={item.id} height={item.size} />}
</MasonryGrid>
```

`colSpan` on any item stretches it across that many lanes; update `items` and every card reflows live.

#### Virtualizing a large list

```tsx
<MasonryGrid items={items} options={{ virtualize: { overscan: 800 }, minLaneSize: 200 }}>
  {(item) => <Card item={item} />}
</MasonryGrid>
```

Only items inside the visible range (± `overscan`) actually get rendered — the rest exist only as an estimate until they scroll into view.

#### Keyboard-reorderable items (`sortable`)

```tsx
import { useState } from 'react'
import { MasonryGrid, type MasonryGridItem } from '@macrulez/masonry-kit-react'

function SortableGallery() {
  const [items, setItems] = useState<MasonryGridItem[]>([{ id: 'a' }, { id: 'b' }, { id: 'c' }])

  return (
    <MasonryGrid items={items} sortable onReorder={setItems}>
      {(item) => <Card item={item} />}
    </MasonryGrid>
  )
}
```

Tab to a card, Space/Enter to pick it up, arrow keys to move it, Space/Enter to drop, Escape to cancel — no pointer/touch drag: masonry's skyline packing makes a live pointer-drag reflow inherently unpredictable (which neighbor ends up where depends on the exact path the cursor took, not just where it landed) in a way a discrete keyboard step isn't.

#### `useMasonry()` — the low-level escape hatch

```tsx
import { useState } from 'react'
import { useMasonry } from '@macrulez/masonry-kit-react'

function Grid() {
  const [container, setContainer] = useState<HTMLElement | null>(null)
  const [cardA, setCardA] = useState<HTMLElement | null>(null)
  const [cardB, setCardB] = useState<HTMLElement | null>(null)

  useMasonry(container, {
    items: [
      { id: 'a', el: cardA },
      { id: 'b', el: cardB },
    ],
    columns: 3,
  })

  return (
    <div ref={setContainer}>
      <div ref={setCardA}>A</div>
      <div ref={setCardB}>B</div>
    </div>
  )
}
```

Use a state-backed callback ref (`useState`, not `useRef`) for `container` and every item's `el` — a plain `useRef` won't re-trigger the hook when the element actually mounts.

---

## Documentation & links

- 📖 **Full documentation:** [npm.vuecraft.ru/en/packages/masonry-kit](https://npm.vuecraft.ru/en/packages/masonry-kit/guide/react-component.html)
- 🌐 **VueCraft:** [vuecraft.ru/en](https://vuecraft.ru/en)
- 👤 **Author:** [macrulez.ru/en](https://macrulez.ru/en)
- 💻 **GitHub:** [macrulezru/masonry-kit/packages/react](https://github.com/macrulezru/masonry-kit/tree/master/packages/react)
- 📦 **NPM:** [@macrulez/masonry-kit-react](https://www.npmjs.com/package/@macrulez/masonry-kit-react)
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
