# **Masonry Kit Nuxt**

![Masonry Kit Nuxt](https://github.com/macrulezru/assets/blob/master/packages-images/masonry-kit-nuxt-vuecraft.png?raw=true)

Nuxt module wrapping
[`@macrulez/masonry-kit-vue`](https://www.npmjs.com/package/@macrulez/masonry-kit-vue):
auto-imported `<MasonryGrid>`/`useMasonry`, a universal plugin that
seeds their option defaults from your `nuxt.config.ts`, and no manual
`<ClientOnly>` wrapping needed — the component is already SSR-safe on
its own, rendering a CSS `columns` approximation until it can measure
for real.

Part of the [masonry-kit](https://github.com/macrulezru/masonry-kit)
monorepo.

---

## Features

- **Auto-imports `<MasonryGrid>` and `useMasonry`** — no explicit `import` anywhere in your app
- **Module options forwarded through `runtimeConfig`** — `direction`, `columns`, `rows`, `minLaneSize`, `gap`, `placement`, `animate`, `transitionDuration`, `transitionEasing`, `ssrColumns`, set once in `nuxt.config.ts` and applied everywhere
- **A universal (server + client) plugin seeds those defaults** — most option defaults only matter once the engine exists client-side, but `ssrColumns` is read directly by `<MasonryGrid>`'s render function, which runs during SSR too — so the plugin isn't `.client`-only
- **No `<ClientOnly>` needed anywhere** — `<MasonryGrid>` renders a CSS `columns` approximation server-side and switches to the real transform-based layout the moment it measures on the client, in the same frame

---

## When you'd reach for this

You're already on Nuxt and want `<MasonryGrid>`/`useMasonry` wired up with zero manual setup — auto-imports, and one place to configure defaults instead of passing the same options at every call site.

- **Passing the same `gap`/`columns` to every single `<MasonryGrid>` on the site gets old** — Set them once in `nuxt.config.ts` and every instance that doesn't override them picks up your project's defaults automatically.
- **You'd rather not remember to import `<MasonryGrid>` in every component** — Auto-imports mean it's just available, the same way Nuxt's own built-ins are.
- **A team member reaches for `<ClientOnly>` out of habit** — There's nothing to wrap; the component already renders a safe SSR approximation and swaps to the real layout after hydration on its own.

---

## Installation

```bash
npm install @macrulez/masonry-kit-nuxt
```

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@macrulez/masonry-kit-nuxt'],
  masonry: {
    columns: 'auto',
    minLaneSize: 240,
    gap: 16,
  },
})
```

Requires Nuxt `^3.9.0 || ^4.0.0`.

### Quick start

Once the module is registered, just use the component — no imports:

```vue
<template>
  <!-- <MasonryGrid>/useMasonry are auto-imported -->
  <MasonryGrid :items="items">
    <template #item="{ item }">
      <MyCard :data="item" />
    </template>
  </MasonryGrid>
</template>
```

See
[`@macrulez/masonry-kit-vue`'s README](https://www.npmjs.com/package/@macrulez/masonry-kit-vue)
for the full `<MasonryGrid>`/`useMasonry` API — props, slots, `sortable`, virtualization, and more.

### More examples

#### What the module does

1. **Auto-imports** `<MasonryGrid>` and `useMasonry` from `@macrulez/masonry-kit-vue` — no explicit `import` needed in your components.
2. **Forwards module options** (`direction`, `columns`, `rows`, `minLaneSize`, `gap`, `placement`, `animate`, `transitionDuration`, `transitionEasing`, `ssrColumns`) into `runtimeConfig.public.masonry`.
3. **Registers a universal plugin** that reads that runtime config and calls `setMasonryDefaults(...)` — so every `<MasonryGrid>`/`useMasonry` use that doesn't pass its own `options` picks up your configured defaults.

#### Module options

| Option               | Falls through to                                        |
| -------------------- | ------------------------------------------------------- |
| `direction`          | core's own default (`'vertical'`) when unset            |
| `columns` / `rows`   | core's own default (`'auto'`) when unset                |
| `minLaneSize`        | core's own default (`240`) when unset                   |
| `gap`                | core's own default (`16`/`16`) when unset               |
| `placement`          | core's own default (`'balanced'`) when unset            |
| `animate`            | core's own default (`true`) when unset                  |
| `transitionDuration` | core's own default (`250`) when unset                   |
| `transitionEasing`   | core's own default when unset                           |
| `ssrColumns`         | `columns`/`rows` (if concrete), else a conservative `2` |

None of these are hardcoded in the module itself — an option you don't set stays `undefined` all the way through to `@macrulez/masonry-kit-core`'s own default, so a future change to core's default keeps applying automatically for Nuxt consumers too.

#### Overriding defaults per instance

Module options are the _fallback_, not a ceiling — any `<MasonryGrid :options="...">` prop still wins for that one instance:

```vue
<template>
  <MasonryGrid :items="items" :options="{ columns: 2 }">
    <!-- uses 2 columns here, regardless of the module-wide default -->
    <template #item="{ item }">
      <MyCard :data="item" />
    </template>
  </MasonryGrid>
</template>
```

---

## Documentation & links

- 📖 **Full documentation:** [npm.vuecraft.ru/en/packages/masonry-kit](https://npm.vuecraft.ru/en/packages/masonry-kit/guide/nuxt-module.html)
- 🌐 **VueCraft:** [vuecraft.ru/en](https://vuecraft.ru/en)
- 👤 **Author:** [macrulez.ru/en](https://macrulez.ru/en)
- 💻 **GitHub:** [macrulezru/masonry-kit/packages/nuxt](https://github.com/macrulezru/masonry-kit/tree/master/packages/nuxt)
- 📦 **NPM:** [@macrulez/masonry-kit-nuxt](https://www.npmjs.com/package/@macrulez/masonry-kit-nuxt)
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
