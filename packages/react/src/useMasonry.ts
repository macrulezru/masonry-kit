import { useEffect, useLayoutEffect, useState } from 'react'
import {
  createMasonryEngine,
  type MasonryEngine,
  type MasonryItemDescriptor,
  type MasonryOptions,
} from '@macrulez/masonry-kit-core'

// SSR-safe: `useLayoutEffect` warns when it runs on the server (it never
// actually does), so this falls back to `useEffect` there — same trick as
// the rest of the React ecosystem (Redux, Framer Motion, ...) uses.
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

export interface UseMasonryItem extends Omit<MasonryItemDescriptor, 'el'> {
  /**
   * `null`/`undefined` while not yet mounted. Drive it from your own state
   * (e.g. a callback ref backed by `useState`) — a plain `useRef` won't
   * re-trigger this hook's effect when the element actually mounts.
   */
  el: HTMLElement | null | undefined
}

export interface UseMasonryOptions extends MasonryOptions {
  items?: UseMasonryItem[]
}

export interface UseMasonryReturn {
  engine: MasonryEngine | null
}

/**
 * Low-level escape hatch for when `<MasonryGrid>`'s render-prop layout
 * doesn't fit — you own the item elements, this only wires the engine to a
 * container and keeps it in sync with `options.items`.
 *
 * `container` and `options` are compared by reference — core has no live
 * `updateOptions()`, so a changed reference tears down and recreates the
 * engine. Pass a stable `container` (e.g. from `useState`, not `useRef`)
 * and memoize `options` (`useMemo`) if it isn't a module-level constant.
 */
export function useMasonry(container: HTMLElement | null, options: UseMasonryOptions = {}): UseMasonryReturn {
  const [engine, setEngine] = useState<MasonryEngine | null>(null)

  useIsomorphicLayoutEffect(() => {
    if (!container || typeof window === 'undefined') return
    // `options` also carries `items` (UseMasonryOptions), which core simply
    // ignores — it's not an object literal here, so TS's excess-property
    // check doesn't apply, and this avoids a throwaway destructure just to
    // strip a field core never reads anyway.
    const created = createMasonryEngine(container, options)
    setEngine(created)
    return () => {
      created.destroy()
      setEngine(null)
    }
    // `options` is compared by reference on purpose — see the doc comment above.
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
