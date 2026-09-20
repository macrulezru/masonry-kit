import type { MasonryOptions } from '@macrulez/masonry-kit-core'

export type MasonryDefaults = Pick<
  MasonryOptions,
  | 'direction'
  | 'columns'
  | 'rows'
  | 'minLaneSize'
  | 'gap'
  | 'placement'
  | 'animate'
  | 'transitionDuration'
  | 'transitionEasing'
  | 'ssrColumns'
>

/**
 * Mutated in place by @macrulez/masonry-kit-nuxt's client plugin from
 * nuxt.config.ts module options. Deliberately starts empty rather than
 * hardcoding a value for any of these fields: every one already has its own
 * default inside @macrulez/masonry-kit-core, and this object is merged in
 * *underneath* an explicit `options` prop, but *over* nothing when left
 * empty — so an unset field here still falls through to core's own default.
 * Hardcoding a value here would silently shadow it, making changing core's
 * default look like it does nothing from the Vue/Nuxt side.
 */
export const masonryDefaults: MasonryDefaults = {}

export function setMasonryDefaults(next: Partial<MasonryDefaults>) {
  Object.assign(masonryDefaults, next)
}
