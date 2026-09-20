export { MasonryGrid } from './MasonryGrid'
export type { MasonryGridItem } from './MasonryGrid'

export { useMasonry } from './useMasonry'
export type { UseMasonryOptions, UseMasonryReturn } from './useMasonry'

export { setMasonryDefaults, masonryDefaults } from './config'
export type { MasonryDefaults } from './config'

export type { RefFriendlyMasonryItem } from './refItems'

// Every @macrulez/masonry-kit-core export is re-exported here too, so
// installing just @macrulez/masonry-kit-vue reaches the framework-agnostic
// layer directly, without a separate dependency on @macrulez/masonry-kit-core.
export * from '@macrulez/masonry-kit-core'
