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

export const masonryDefaults: MasonryDefaults = {}

export function setMasonryDefaults(next: Partial<MasonryDefaults>) {
  Object.assign(masonryDefaults, next)
}
