import {
  createElement,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'
import {
  createMasonryEngine,
  optionsEqual,
  resolveSsrColumns,
  type MasonryEngine,
  type MasonryItemDescriptor,
  type MasonryItemLayout,
  type MasonryOptions,
} from '@macrulez/masonry-kit-core'

export interface MasonryGridItem {
  id: string
  /** Overrides the instance-wide default at `direction: 'vertical'`. default 1 */
  colSpan?: number
  /** Overrides the instance-wide default at `direction: 'horizontal'`. default 1 */
  rowSpan?: number
  aspectRatio?: number
  /** Only consulted while `options.virtualize` is on — see `MasonryItemDescriptor.estimatedSize`. */
  estimatedSize?: number
  order?: number
}

export interface MasonryGridProps {
  items: MasonryGridItem[]
  options?: MasonryOptions
  /** Turns every wrapper into a keyboard-reorderable item (§5.4). default false */
  sortable?: boolean
  onLayout?: (items: MasonryItemLayout[]) => void
  /** Fired instead of mutating `items` — same idea as Vue's `@reorder`, bind it back to your own state yourself. */
  onReorder?: (items: MasonryGridItem[]) => void
  /** Called once per item — the React equivalent of the Vue adapter's `#item` slot. */
  children: (item: MasonryGridItem) => ReactNode
}

// SSR-safe: `useLayoutEffect` warns when it runs on the server, so this
// falls back to `useEffect` there. The layout variant runs synchronously
// after DOM mutations but before paint — needed so the SSR CSS-`columns`
// fallback (§4.4) switches to the real layout in one frame, not a flash.
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

/**
 * Returns an `options` reference that only changes when its *content* does.
 * `options` gets a fresh identity on every render unless the caller
 * memoizes it, and every effect below keys off it — see `optionsEqual`'s
 * own doc comment in core.
 */
function useStableOptions(options: MasonryOptions): MasonryOptions {
  const ref = useRef(options)
  if (!optionsEqual(ref.current, options)) ref.current = options
  return ref.current
}

const visuallyHidden: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
}

function sameIds(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false
  for (const id of a) if (!b.has(id)) return false
  return true
}

function resolvedAnimate(options: MasonryOptions): boolean {
  return options.animate ?? true
}
function resolvedTransitionDuration(options: MasonryOptions): number {
  return options.transitionDuration ?? 250
}

/** Mirrors core's own gap resolution — a `number` applies to both axes. Needed here too since the SSR-fallback CSS-`columns` styling (§4.4) is rendered before the engine exists to resolve it for us. */
function resolvedGap(options: MasonryOptions): { main: number; cross: number } {
  const gap = options.gap
  if (typeof gap === 'number') return { main: gap, cross: gap }
  return { main: gap?.main ?? 16, cross: gap?.cross ?? 16 }
}

/** Column count for the SSR-fallback CSS `columns` approximation (§4.4) — `columns`/`rows` (whichever `direction` uses) doubles as the lane spec input. */
function resolvedSsrColumns(options: MasonryOptions): number {
  const horizontal = options.direction === 'horizontal'
  const laneSpec = horizontal ? options.rows : options.columns
  return resolveSsrColumns(laneSpec, options.ssrColumns)
}

/** Adjacent-index swap for keyboard reordering (§5.4) — `toIndex` is already a valid, in-bounds index into the *same* array, so a plain splice-out/splice-in is correct as-is. */
function moveItem(items: MasonryGridItem[], id: string, toIndex: number): MasonryGridItem[] {
  const fromIndex = items.findIndex((item) => item.id === id)
  if (fromIndex === -1) return items
  const next = [...items]
  const [moved] = next.splice(fromIndex, 1)
  next.splice(Math.max(0, Math.min(toIndex, next.length)), 0, moved!)
  return next
}

function labelFor(id: string, items: MasonryGridItem[]): string {
  const position = items.findIndex((candidate) => candidate.id === id) + 1
  return `item ${position} of ${items.length}`
}

/**
 * Renders one measured wrapper `<div>` per item around whatever `children`
 * returns for it — item content stays entirely the caller's, this only
 * measures and positions the wrapper. With `options.virtualize` on, only the
 * currently visible items (± overscan) actually get a wrapper/render call at
 * all — the rest exist only as an estimate inside the engine (§3.5), not in
 * the DOM.
 *
 * With `options.animate` on (the default), an item removed from `items`
 * keeps its wrapper mounted for `transitionDuration` after it disappears
 * from the prop, so core's leave fade-out (§5.2) — applied directly to the
 * element the instant it notices the removal — actually gets to play instead
 * of being cut short by an immediate unmount.
 *
 * With `sortable` on (§5.4), every wrapper becomes keyboard-reorderable
 * (space/enter to pick up, arrow keys to move, space/enter to drop, escape
 * to cancel), announced through a live region. Reordering never mutates
 * `items` — it calls `onReorder` with the new array, same idea as Vue's
 * `@reorder`; store it back yourself.
 *
 * ```tsx
 * <MasonryGrid items={items} options={{ columns: 'auto', minLaneSize: 240 }}>
 *   {(item) => <MyCard data={item} />}
 * </MasonryGrid>
 * ```
 */
export function MasonryGrid(props: MasonryGridProps) {
  const { items, options: optionsProp = {}, sortable = false, onLayout, onReorder, children } = props
  const options = useStableOptions(optionsProp)
  const instanceId = useId()
  const instructionsId = `${instanceId}-instructions`
  const liveRegionId = `${instanceId}-live`

  const [containerNode, setContainerNode] = useState<HTMLElement | null>(null)
  const containerNodeRef = useRef<HTMLElement | null>(null)
  containerNodeRef.current = containerNode

  const itemEls = useRef(new Map<string, HTMLElement>())
  const engineRef = useRef<MasonryEngine | null>(null)

  const [hasLaidOut, setHasLaidOut] = useState(false)
  const [visibleIds, setVisibleIds] = useState<Set<string> | null>(() => (options.virtualize ? new Set() : null))
  const [leaving, setLeaving] = useState<Map<string, MasonryGridItem>>(new Map())
  const itemCache = useRef(new Map<string, MasonryGridItem>())
  const previousIds = useRef(new Set<string>())

  const itemsRef = useRef(items)
  itemsRef.current = items
  const optionsRef = useRef(options)
  optionsRef.current = options
  const onReorderRef = useRef(onReorder)
  onReorderRef.current = onReorder
  const onLayoutRef = useRef(onLayout)
  onLayoutRef.current = onLayout

  // `null` renders every item. With `virtualize` on, starts as an empty Set
  // until the engine's first estimate-only relayout reports which ids are
  // visible.
  const renderedItems = useMemo(() => {
    const base = visibleIds === null ? items : items.filter((item) => visibleIds.has(item.id))
    if (leaving.size === 0) return base
    const baseIds = new Set(base.map((item) => item.id))
    const ghosts = [...leaving.values()].filter((item) => !baseIds.has(item.id))
    return ghosts.length === 0 ? base : [...base, ...ghosts]
  }, [items, visibleIds, leaving])

  function syncItemsNow() {
    const engine = engineRef.current
    if (!engine) return
    const descriptors: MasonryItemDescriptor[] = itemsRef.current.map((item) => ({
      id: item.id,
      el: itemEls.current.get(item.id),
      colSpan: item.colSpan,
      rowSpan: item.rowSpan,
      aspectRatio: item.aspectRatio,
      estimatedSize: item.estimatedSize,
      order: item.order,
    }))
    engine.setItems(descriptors)
  }

  // Diffs `items` against the last-seen id set and starts a fade-out
  // "ghost" for anything that disappeared and had a mounted element.
  // Deliberately run *during render* (React's "adjust state while
  // rendering" pattern), not in an effect: an effect runs after commit,
  // which would be one commit too late to catch the wrapper before it
  // unmounts. The removal timer itself is a real side effect and lives in
  // a separate effect below.
  const lastDiffedItems = useRef<MasonryGridItem[] | null>(null)
  if (lastDiffedItems.current !== items) {
    lastDiffedItems.current = items
    const nextIds = new Set(items.map((item) => item.id))
    for (const item of items) itemCache.current.set(item.id, item)

    let additions: Map<string, MasonryGridItem> | null = null
    for (const id of previousIds.current) {
      if (nextIds.has(id) || leaving.has(id)) continue
      if (!itemEls.current.get(id) || !resolvedAnimate(options)) continue
      const cached = itemCache.current.get(id)
      if (!cached) continue
      additions ??= new Map(leaving)
      additions.set(id, cached)
    }
    if (additions) setLeaving(additions)

    previousIds.current = nextIds
  }

  // `scheduledLeaveIds` tracks which `leaving` entries already have a
  // pending timer so a re-render doesn't schedule a duplicate one.
  const scheduledLeaveIds = useRef(new Set<string>())
  useEffect(() => {
    for (const id of leaving.keys()) {
      if (scheduledLeaveIds.current.has(id)) continue
      scheduledLeaveIds.current.add(id)
      setTimeout(() => {
        scheduledLeaveIds.current.delete(id)
        setLeaving((prev) => {
          const next = new Map(prev)
          next.delete(id)
          return next
        })
        itemCache.current.delete(id)
      }, resolvedTransitionDuration(optionsRef.current))
    }
    for (const id of scheduledLeaveIds.current) {
      if (!leaving.has(id)) scheduledLeaveIds.current.delete(id)
    }
  }, [leaving])

  // Core has no `updateOptions`, so a changed `options` *content* tears
  // down and recreates the engine. `options` here is already
  // `useStableOptions(optionsProp)` — content-compared, not just
  // reference-compared.
  useIsomorphicLayoutEffect(() => {
    if (!containerNode) return
    setVisibleIds((prev) => {
      if (options.virtualize) return prev && prev.size === 0 ? prev : new Set()
      return prev === null ? prev : null
    })
    previousIds.current = new Set(itemsRef.current.map((item) => item.id))
    itemCache.current.clear()
    for (const item of itemsRef.current) itemCache.current.set(item.id, item)

    const engine = createMasonryEngine(containerNode, options)
    engineRef.current = engine
    const unsubscribe = engine.on('layout', (payload: { items: MasonryItemLayout[]; visibleIds: string[] }) => {
      setHasLaidOut(true)
      onLayoutRef.current?.(payload.items)
      if (options.virtualize) {
        const next = new Set(payload.visibleIds)
        setVisibleIds((prev) => (prev && sameIds(prev, next) ? prev : next))
      }
    })

    return () => {
      unsubscribe()
      engine.destroy()
      engineRef.current = null
    }
  }, [containerNode, options])

  // The only place that calls `syncItemsNow()` — deps duplicate the engine
  // creation effect's own deps so a fresh engine always gets synced too.
  useIsomorphicLayoutEffect(() => {
    syncItemsNow()
  }, [containerNode, options, renderedItems])

  // ---------------------------------------------------------------------
  // Sortable (§5.4): keyboard reordering, opt-in via `sortable`. Never
  // mutates `items` — just calls `onReorder` with the new array, letting
  // the caller's own state stay the single source of truth.
  // ---------------------------------------------------------------------
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [liveMessage, setLiveMessage] = useState('')
  const keyboardDragSnapshotRef = useRef<MasonryGridItem[] | null>(null)

  function announce(message: string) {
    setLiveMessage(message)
  }

  function onItemKeydown(event: ReactKeyboardEvent, item: MasonryGridItem) {
    if (!sortable || !engineRef.current) return

    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault()
      if (activeDragId === item.id) {
        setActiveDragId(null)
        keyboardDragSnapshotRef.current = null
        engineRef.current.setDragging(null)
        announce(`Dropped ${labelFor(item.id, items)}.`)
      } else if (activeDragId === null) {
        setActiveDragId(item.id)
        keyboardDragSnapshotRef.current = items
        engineRef.current.setDragging(item.id)
        announce(`Picked up ${labelFor(item.id, items)}. Use arrow keys to move, space to drop, escape to cancel.`)
      }
      return
    }

    if (activeDragId !== item.id) return

    if (event.key === 'Escape') {
      event.preventDefault()
      setActiveDragId(null)
      engineRef.current.setDragging(null)
      if (keyboardDragSnapshotRef.current) onReorderRef.current?.(keyboardDragSnapshotRef.current)
      keyboardDragSnapshotRef.current = null
      announce('Reordering cancelled.')
      return
    }

    const horizontal = options.direction === 'horizontal'
    const forwardKey = horizontal ? 'ArrowRight' : 'ArrowDown'
    const backwardKey = horizontal ? 'ArrowLeft' : 'ArrowUp'
    if (event.key !== forwardKey && event.key !== backwardKey) return
    event.preventDefault()

    const currentIndex = items.findIndex((candidate) => candidate.id === item.id)
    const step = event.key === forwardKey ? 1 : -1
    const nextIndex = currentIndex + step
    if (nextIndex < 0 || nextIndex >= items.length) return

    const reordered = moveItem(items, item.id, nextIndex)
    onReorderRef.current?.(reordered)
    announce(`Moved to ${labelFor(item.id, reordered)}.`)
  }

  const itemChildren = renderedItems.map((item) => {
    const isLeaving = leaving.has(item.id)
    const sortableAttrs = sortable
      ? {
          tabIndex: 0,
          role: 'button',
          'aria-roledescription': 'Reorderable item',
          'aria-describedby': instructionsId,
          'aria-pressed': activeDragId === item.id ? 'true' : 'false',
          onKeyDown: (event: ReactKeyboardEvent) => onItemKeydown(event, item),
        }
      : {}
    return createElement(
      'div',
      {
        key: item.id,
        className: 'mk-item',
        style: {
          ...(hasLaidOut ? {} : { breakInside: 'avoid', marginBottom: `${resolvedGap(options).main}px` }),
          ...(isLeaving ? { pointerEvents: 'none' } : {}),
        },
        ref: (el: HTMLElement | null) => {
          if (el) itemEls.current.set(item.id, el)
          else itemEls.current.delete(item.id)
        },
        ...sortableAttrs,
      },
      children(item),
    )
  })

  return createElement(
    'div',
    {
      ref: setContainerNode,
      className: 'mk-grid',
      style: hasLaidOut
        ? undefined
        : { columns: resolvedSsrColumns(options), columnGap: `${resolvedGap(options).cross}px` },
    },
    [
      ...itemChildren,
      sortable
        ? createElement(
            'span',
            { key: '__mk_instructions', id: instructionsId, style: visuallyHidden },
            'Press space or enter to pick up this item. While picked up, use the arrow keys to move it, space or enter to drop it, or escape to cancel.',
          )
        : null,
      sortable
        ? createElement(
            'span',
            { key: '__mk_live', id: liveRegionId, role: 'status', 'aria-live': 'polite', style: visuallyHidden },
            liveMessage,
          )
        : null,
    ],
  )
}
