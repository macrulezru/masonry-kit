import { addComponent, addImports, addPlugin, createResolver, defineNuxtModule } from '@nuxt/kit'
import type { NuxtModule } from '@nuxt/schema'
import type { LaneSpec } from '@macrulez/masonry-kit-vue'

export interface ModuleOptions {
  /** Falls through to @macrulez/masonry-kit-core's own default ('vertical') when unset. */
  direction?: 'vertical' | 'horizontal'
  columns?: LaneSpec
  rows?: LaneSpec
  /** Falls through to @macrulez/masonry-kit-core's own default (240) when unset. */
  minLaneSize?: number
  gap?: number | { main?: number; cross?: number }
  placement?: 'balanced' | 'ordered'
  /** Falls through to @macrulez/masonry-kit-core's own default (true) when unset. */
  animate?: boolean
  /** Falls through to @macrulez/masonry-kit-core's own default (250) when unset. */
  transitionDuration?: number
  transitionEasing?: string
  /** CSS-columns SSR fallback (§4.4). Falls through to `columns`/`rows` (if concrete), else a conservative default of 2, when unset. */
  ssrColumns?: number
}

const masonryKitModule: NuxtModule<ModuleOptions> = defineNuxtModule<ModuleOptions>({
  meta: {
    name: '@macrulez/masonry-kit-nuxt',
    configKey: 'masonry',
  },
  // No `defaults` here on purpose: an option the user didn't set in
  // nuxt.config.ts must stay `undefined` all the way through to
  // @macrulez/masonry-kit-core's own defaults — hardcoding one here would
  // silently shadow it, making a change to core's default look like it does
  // nothing for a Nuxt consumer.
  setup(options, nuxt) {
    const resolver = createResolver(import.meta.url)

    addComponent({ name: 'MasonryGrid', export: 'MasonryGrid', filePath: '@macrulez/masonry-kit-vue' })
    addImports({ name: 'useMasonry', from: '@macrulez/masonry-kit-vue' })

    nuxt.options.runtimeConfig.public.masonry = {
      direction: options.direction,
      columns: options.columns,
      rows: options.rows,
      minLaneSize: options.minLaneSize,
      gap: options.gap,
      placement: options.placement,
      animate: options.animate,
      transitionDuration: options.transitionDuration,
      transitionEasing: options.transitionEasing,
      ssrColumns: options.ssrColumns,
    }

    // Universal plugin (server + client) — most of these are only consulted
    // once the engine exists client-side (onMounted), but `ssrColumns`
    // (§4.4) is read directly by <MasonryGrid>'s render function, which also
    // runs during SSR, so the defaults need to be seeded there too.
    addPlugin(resolver.resolve('./runtime/plugin'))
  },
})

export default masonryKitModule
