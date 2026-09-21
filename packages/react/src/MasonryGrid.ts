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
import { getItemId } from './itemId'

export interface MasonryGridItem {
  id?: string
  colSpan?: number
  rowSpan?: number
  aspectRatio?: number
  estimatedSize?: number
  order?: number
  [key: string]: unknown
}

export interface MasonryGridProps {
  items: MasonryGridItem[]
  options?: MasonryOptions
  sortable?: boolean
  onLayout?: (items: MasonryItemLayout[]) => void
  onReorder?: (items: MasonryGridItem[]) => void
  children: (item: MasonryGridItem) => ReactNode
}

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

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

function resolvedGap(options: MasonryOptions): { main: number; cross: number } {
  const gap = options.gap
  if (typeof gap === 'number') return { main: gap, cross: gap }
  return { main: gap?.main ?? 16, cross: gap?.cross ?? 16 }
}

function resolvedSsrColumns(options: MasonryOptions): number {
  const horizontal = options.direction === 'horizontal'
  const laneSpec = horizontal ? options.rows : options.columns
  return resolveSsrColumns(laneSpec, options.ssrColumns)
}

function moveItem(items: MasonryGridItem[], id: string, toIndex: number): MasonryGridItem[] {
  const fromIndex = items.findIndex((item) => getItemId(item) === id)
  if (fromIndex === -1) return items
  const next = [...items]
  const [moved] = next.splice(fromIndex, 1)
  next.splice(Math.max(0, Math.min(toIndex, next.length)), 0, moved!)
  return next
}

function labelFor(id: string, items: MasonryGridItem[]): string {
  const position = items.findIndex((candidate) => getItemId(candidate) === id) + 1
  return `item ${position} of ${items.length}`
}

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

  const renderedItems = useMemo(() => {
    const base = visibleIds === null ? items : items.filter((item) => visibleIds.has(getItemId(item)))
    if (leaving.size === 0) return base
    const baseIds = new Set(base.map((item) => getItemId(item)))
    const ghosts = [...leaving.values()].filter((item) => !baseIds.has(getItemId(item)))
    return ghosts.length === 0 ? base : [...base, ...ghosts]
  }, [items, visibleIds, leaving])

  function syncItemsNow() {
    const engine = engineRef.current
    if (!engine) return
    const descriptors: MasonryItemDescriptor[] = itemsRef.current.map((item) => {
      const id = getItemId(item)
      return {
        id,
        el: itemEls.current.get(id),
        colSpan: item.colSpan,
        rowSpan: item.rowSpan,
        aspectRatio: item.aspectRatio,
        estimatedSize: item.estimatedSize,
        order: item.order,
      }
    })
    engine.setItems(descriptors)
  }

  const lastDiffedItems = useRef<MasonryGridItem[] | null>(null)
  if (lastDiffedItems.current !== items) {
    lastDiffedItems.current = items
    const nextIds = new Set(items.map((item) => getItemId(item)))
    for (const item of items) itemCache.current.set(getItemId(item), item)

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

  useIsomorphicLayoutEffect(() => {
    if (!containerNode) return
    setVisibleIds((prev) => {
      if (options.virtualize) return prev && prev.size === 0 ? prev : new Set()
      return prev === null ? prev : null
    })
    previousIds.current = new Set(itemsRef.current.map((item) => getItemId(item)))
    itemCache.current.clear()
    for (const item of itemsRef.current) itemCache.current.set(getItemId(item), item)

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

  useIsomorphicLayoutEffect(() => {
    syncItemsNow()
  }, [containerNode, options, renderedItems])

  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [liveMessage, setLiveMessage] = useState('')
  const keyboardDragSnapshotRef = useRef<MasonryGridItem[] | null>(null)

  function announce(message: string) {
    setLiveMessage(message)
  }

  function onItemKeydown(event: ReactKeyboardEvent, item: MasonryGridItem) {
    if (!sortable || !engineRef.current) return
    const id = getItemId(item)

    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault()
      if (activeDragId === id) {
        setActiveDragId(null)
        keyboardDragSnapshotRef.current = null
        engineRef.current.setDragging(null)
        announce(`Dropped ${labelFor(id, items)}.`)
      } else if (activeDragId === null) {
        setActiveDragId(id)
        keyboardDragSnapshotRef.current = items
        engineRef.current.setDragging(id)
        announce(`Picked up ${labelFor(id, items)}. Use arrow keys to move, space to drop, escape to cancel.`)
      }
      return
    }

    if (activeDragId !== id) return

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

    const currentIndex = items.findIndex((candidate) => getItemId(candidate) === id)
    const step = event.key === forwardKey ? 1 : -1
    const nextIndex = currentIndex + step
    if (nextIndex < 0 || nextIndex >= items.length) return

    const reordered = moveItem(items, id, nextIndex)
    onReorderRef.current?.(reordered)
    announce(`Moved to ${labelFor(id, reordered)}.`)
  }

  const itemChildren = renderedItems.map((item) => {
    const id = getItemId(item)
    const isLeaving = leaving.has(id)
    const sortableAttrs = sortable
      ? {
          tabIndex: 0,
          role: 'button',
          'aria-roledescription': 'Reorderable item',
          'aria-describedby': instructionsId,
          'aria-pressed': activeDragId === id ? 'true' : 'false',
          onKeyDown: (event: ReactKeyboardEvent) => onItemKeydown(event, item),
        }
      : {}
    return createElement(
      'div',
      {
        key: id,
        className: 'mk-item',
        style: {
          ...(hasLaidOut ? {} : { breakInside: 'avoid', marginBottom: `${resolvedGap(options).main}px` }),
          ...(isLeaving ? { pointerEvents: 'none' } : {}),
        },
        ref: (el: HTMLElement | null) => {
          if (el) itemEls.current.set(id, el)
          else itemEls.current.delete(id)
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
