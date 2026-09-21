import { setMasonryDefaults, type MasonryDefaults } from '@macrulez/masonry-kit-vue'
import { defineNuxtPlugin, useRuntimeConfig } from 'nuxt/app'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig().public.masonry as MasonryDefaults | undefined
  if (config) setMasonryDefaults(config)
})
