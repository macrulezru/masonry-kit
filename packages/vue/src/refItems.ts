import { toValue, type MaybeRefOrGetter } from 'vue'
import type { MasonryItemDescriptor } from '@macrulez/masonry-kit-core'

/**
 * `useMasonry`'s item shape: unlike `<MasonryGrid>` (which always owns a
 * measured wrapper element per item), this low-level API has no wrapper of
 * its own, so `el` accepts a Vue ref/getter directly instead of requiring
 * the caller to dereference it before passing it in.
 */
export interface RefFriendlyMasonryItem extends Omit<MasonryItemDescriptor, 'el'> {
  el: MaybeRefOrGetter<HTMLElement | null | undefined>
}

/**
 * Unwraps a `RefFriendlyMasonryItem[]`, dropping any item whose `el` hasn't
 * resolved to an element yet. Reading `.value` here (via `toValue`, inside a
 * `watchEffect`) is what lets a ref that starts out `null` — e.g. an
 * unmounted template ref — settle in on its own once its element mounts,
 * even though the surrounding `items` array itself never changes identity.
 */
export function resolveItemsForCore(items: RefFriendlyMasonryItem[]): MasonryItemDescriptor[] {
  const descriptors: MasonryItemDescriptor[] = []
  for (const item of items) {
    const el = toValue(item.el)
    if (el) descriptors.push({ ...item, el })
  }
  return descriptors
}
