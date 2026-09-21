import { toValue, type MaybeRefOrGetter } from 'vue'
import type { MasonryItemDescriptor } from '@macrulez/masonry-kit-core'

export interface RefFriendlyMasonryItem extends Omit<MasonryItemDescriptor, 'el'> {
  el: MaybeRefOrGetter<HTMLElement | null | undefined>
}

export function resolveItemsForCore(items: RefFriendlyMasonryItem[]): MasonryItemDescriptor[] {
  const descriptors: MasonryItemDescriptor[] = []
  for (const item of items) {
    const el = toValue(item.el)
    if (el) descriptors.push({ ...item, el })
  }
  return descriptors
}
