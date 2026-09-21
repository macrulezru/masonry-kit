import { addComponent, addImports, addPlugin, createResolver, defineNuxtModule } from '@nuxt/kit'
import type { NuxtModule } from '@nuxt/schema'
import type { LaneSpec } from '@macrulez/masonry-kit-vue'

export interface ModuleOptions {
  direction?: 'vertical' | 'horizontal'
  columns?: LaneSpec
  rows?: LaneSpec
  minLaneSize?: number
  gap?: number | { main?: number; cross?: number }
  placement?: 'balanced' | 'ordered'
  animate?: boolean
  transitionDuration?: number
  transitionEasing?: string
  ssrColumns?: number
}

const masonryKitModule: NuxtModule<ModuleOptions> = defineNuxtModule<ModuleOptions>({
  meta: {
    name: '@macrulez/masonry-kit-nuxt',
    configKey: 'masonry',
  },

  setup(options, nuxt) {
    const resolver = createResolver(import.meta.url)

    addComponent({ name: 'MasonryGrid', export: 'MasonryGrid', filePath: '@macrulez/masonry-kit-vue' })
    addImports({ name: 'useMasonry', from: '@macrulez/masonry-kit-vue' })

    const publicConfig: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(options)) {
      if (value !== undefined) publicConfig[key] = value
    }
    nuxt.options.runtimeConfig.public.masonry = publicConfig as ModuleOptions

    addPlugin(resolver.resolve('./runtime/plugin'))
  },
})

export default masonryKitModule
