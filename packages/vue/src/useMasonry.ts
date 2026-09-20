import { onBeforeUnmount, onMounted, shallowRef, toValue, watchEffect, type MaybeRefOrGetter } from 'vue'
import { createMasonryEngine, type MasonryEngine, type MasonryOptions } from '@macrulez/masonry-kit-core'
import { masonryDefaults } from './config'
import { resolveItemsForCore, type RefFriendlyMasonryItem } from './refItems'

export interface UseMasonryOptions extends MasonryOptions {
  items?: MaybeRefOrGetter<RefFriendlyMasonryItem[]>
}

export interface UseMasonryReturn {
  engine: ReturnType<typeof shallowRef<MasonryEngine | null>>
}

/**
 * Low-level escape hatch for when `<MasonryGrid>`'s slot-per-item layout
 * doesn't fit — you own the item elements, this only wires the engine to a
 * container and keeps it in sync with reactive items.
 */
export function useMasonry(
  container: MaybeRefOrGetter<HTMLElement | null | undefined>,
  options: UseMasonryOptions = {},
): UseMasonryReturn {
  const engine = shallowRef<MasonryEngine | null>(null)
  let stopSyncItems: (() => void) | null = null

  onMounted(() => {
    const el = toValue(container)
    if (!el || typeof window === 'undefined') return

    // masonryDefaults first, then options on top — see config.ts and
    // MasonryGrid.ts for why the merge order matters.
    const createdEngine = createMasonryEngine(el, {
      ...masonryDefaults,
      ...options,
    })
    engine.value = createdEngine

    // watchEffect (not a plain watch on options.items) so that an item's el
    // ref — read via toValue() inside resolveItemsForCore during this very
    // callback — is itself tracked as a dependency. That lets a ref that
    // starts out null resolve correctly once its element mounts, even though
    // the surrounding `items` array itself never changes identity in that case.
    if (options.items) {
      stopSyncItems = watchEffect(() => {
        createdEngine.setItems(resolveItemsForCore(toValue(options.items) ?? []))
      })
    }
  })

  onBeforeUnmount(() => {
    stopSyncItems?.()
    engine.value?.destroy()
    engine.value = null
  })

  return { engine }
}
