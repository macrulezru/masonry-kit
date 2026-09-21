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

export function useMasonry(
  container: MaybeRefOrGetter<HTMLElement | null | undefined>,
  options: UseMasonryOptions = {},
): UseMasonryReturn {
  const engine = shallowRef<MasonryEngine | null>(null)
  let stopSyncItems: (() => void) | null = null

  onMounted(() => {
    const el = toValue(container)
    if (!el || typeof window === 'undefined') return

    const createdEngine = createMasonryEngine(el, {
      ...masonryDefaults,
      ...options,
    })
    engine.value = createdEngine

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
