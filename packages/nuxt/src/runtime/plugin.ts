import { setMasonryDefaults, type MasonryDefaults } from '@macrulez/masonry-kit-vue'
import { defineNuxtPlugin, useRuntimeConfig } from 'nuxt/app'

// Universal (runs on both server and client), not `.client`-suffixed:
// `ssrColumns` (§4.4) is read directly by <MasonryGrid>'s render function,
// which runs during SSR too.
export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig().public.masonry as MasonryDefaults | undefined
  if (config) setMasonryDefaults(config)
})
