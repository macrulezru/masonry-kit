import { useEffect, useLayoutEffect, useState } from 'react'
import {
  createMasonryEngine,
  type MasonryEngine,
  type MasonryItemDescriptor,
  type MasonryOptions,
} from '@macrulez/masonry-kit-core'

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

export interface UseMasonryItem extends Omit<MasonryItemDescriptor, 'el'> {
  el: HTMLElement | null | undefined
}

export interface UseMasonryOptions extends MasonryOptions {
  items?: UseMasonryItem[]
}

export interface UseMasonryReturn {
  engine: MasonryEngine | null
}

export function useMasonry(container: HTMLElement | null, options: UseMasonryOptions = {}): UseMasonryReturn {
  const [engine, setEngine] = useState<MasonryEngine | null>(null)

  useIsomorphicLayoutEffect(() => {
    if (!container || typeof window === 'undefined') return
    const created = createMasonryEngine(container, options)
    setEngine(created)
    return () => {
      created.destroy()
      setEngine(null)
    }
  }, [container, options])

  useIsomorphicLayoutEffect(() => {
    if (!engine || !options.items) return
    const descriptors: MasonryItemDescriptor[] = options.items.filter(
      (item): item is UseMasonryItem & { el: HTMLElement } => Boolean(item.el),
    )
    engine.setItems(descriptors)
  }, [engine, options.items])

  return { engine }
}
