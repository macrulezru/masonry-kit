import {
  computed,
  defineComponent,
  h,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
  type PropType,
  type VNodeRef,
} from 'vue'
import {
  createMasonryEngine,
  optionsEqual,
  resolveSsrColumns,
  type MasonryEngine,
  type MasonryItemDescriptor,
  type MasonryItemLayout,
  type MasonryOptions,
} from '@macrulez/masonry-kit-core'
import { masonryDefaults } from './config'

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

let instanceCounter = 0

// "sr-only" pattern — visible to screen readers, hidden visually.
const visuallyHidden = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: '0',
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: '0',
} as const

/**
 * Renders one measured wrapper `<div>` per item around that item's `#item`
 * slot — item content stays entirely the caller's, this only measures and
 * positions the wrapper. With `options.virtualize` on, only the currently
 * visible items (± overscan) actually get a wrapper/slot at all.
 *
 * With `options.animate` on (the default), an item removed from `items`
 * keeps its wrapper mounted for `transitionDuration` so core's leave
 * fade-out (§5.2) gets to play instead of being cut short.
 *
 * With `sortable` on (§5.4), every wrapper becomes keyboard-reorderable
 * (space/enter to pick up, arrow keys to move, space/enter to drop, escape
 * to cancel), announced through a live region. Reordering never mutates
 * `items` — it emits `reorder` with the new array; bind it back yourself
 * (`@reorder="items = $event"`).
 *
 * ```vue
 * <MasonryGrid :items="items" :options="{ columns: 'auto', minLaneSize: 240 }">
 *   <template #item="{ item }">
 *     <MyCard :data="item" />
 *   </template>
 * </MasonryGrid>
 * ```
 */
export const MasonryGrid = defineComponent({
  name: 'MasonryGrid',
  props: {
    items: { type: Array as PropType<MasonryGridItem[]>, required: true },
    options: { type: Object as PropType<MasonryOptions>, default: () => ({}) },
    sortable: { type: Boolean, default: false },
  },
  emits: ['layout', 'reorder'],
  setup(props, { slots, emit }) {
    const instanceId = `mk-${++instanceCounter}`
    const container = ref<HTMLElement | null>(null)
    const itemEls = new Map<string, HTMLElement>()
    const itemRefCallbacks = new Map<string, VNodeRef>()
    let engine: MasonryEngine | null = null
    let unsubscribe: (() => void) | null = null
    let stopWatchItems: (() => void) | null = null
    let stopWatchOptions: (() => void) | null = null
    let syncScheduled = false

    // `null` renders every item. With `virtualize` on, starts as an empty
    // Set until the engine's first estimate-only relayout reports which ids
    // are visible.
    const visibleIds = shallowRef<Set<string> | null>(props.options.virtualize ? new Set() : null)

    // Flips to `true` synchronously inside the `layout` handler below, so
    // Vue's next reactive flush swaps the SSR CSS-columns fallback (§4.4)
    // for the real layout before the browser paints.
    const hasLaidOut = ref(false)

    // Items that just disappeared from `props.items` but are still fading
    // out — see `renderedItems` below.
    const leaving = shallowRef<Map<string, MasonryGridItem>>(new Map())
    const itemCache = new Map<string, MasonryGridItem>()
    let previousIds = new Set<string>()

    const renderedItems = computed(() => {
      const base =
        visibleIds.value === null ? props.items : props.items.filter((item) => visibleIds.value!.has(item.id))
      if (leaving.value.size === 0) return base
      const baseIds = new Set(base.map((item) => item.id))
      const ghosts = [...leaving.value.values()].filter((item) => !baseIds.has(item.id))
      return ghosts.length === 0 ? base : [...base, ...ghosts]
    })

    function sameIds(a: Set<string>, b: Set<string>): boolean {
      if (a.size !== b.size) return false
      for (const id of a) if (!b.has(id)) return false
      return true
    }

    function resolvedAnimate(): boolean {
      return props.options.animate ?? masonryDefaults.animate ?? true
    }
    function resolvedTransitionDuration(): number {
      return props.options.transitionDuration ?? masonryDefaults.transitionDuration ?? 250
    }

    function resolvedGap(): { main: number; cross: number } {
      const gap = props.options.gap ?? masonryDefaults.gap
      if (typeof gap === 'number') return { main: gap, cross: gap }
      return { main: gap?.main ?? 16, cross: gap?.cross ?? 16 }
    }

    /** Column count for the SSR-fallback CSS `columns` approximation (§4.4). */
    function resolvedSsrColumns(): number {
      const horizontal = (props.options.direction ?? masonryDefaults.direction) === 'horizontal'
      const laneSpec = horizontal
        ? (props.options.rows ?? masonryDefaults.rows)
        : (props.options.columns ?? masonryDefaults.columns)
      return resolveSsrColumns(laneSpec, props.options.ssrColumns ?? masonryDefaults.ssrColumns)
    }

    /** Starts a fade-out "ghost" for anything that disappeared from `nextItems` and has a mounted element to animate. */
    function trackLeavingItems(nextItems: MasonryGridItem[]) {
      const nextIds = new Set(nextItems.map((item) => item.id))
      for (const item of nextItems) itemCache.set(item.id, item)

      let additions: Map<string, MasonryGridItem> | null = null
      for (const id of previousIds) {
        if (nextIds.has(id) || leaving.value.has(id)) continue
        if (!itemEls.get(id) || !resolvedAnimate()) continue
        const cached = itemCache.get(id)
        if (!cached) continue

        additions ??= new Map(leaving.value)
        additions.set(id, cached)

        setTimeout(() => {
          const next = new Map(leaving.value)
          next.delete(id)
          leaving.value = next
          itemCache.delete(id)
        }, resolvedTransitionDuration())
      }
      if (additions) leaving.value = additions

      previousIds = nextIds
    }

    function syncItemsNow() {
      if (!engine) return
      const descriptors: MasonryItemDescriptor[] = props.items.map((item) => ({
        id: item.id,
        el: itemEls.get(item.id),
        colSpan: item.colSpan,
        rowSpan: item.rowSpan,
        aspectRatio: item.aspectRatio,
        estimatedSize: item.estimatedSize,
        order: item.order,
      }))
      engine.setItems(descriptors)
    }

    // Batches ref-callback-triggered mount/unmount from the same Vue patch
    // into one `setItems()` call.
    function scheduleSyncItems() {
      if (syncScheduled) return
      syncScheduled = true
      queueMicrotask(() => {
        syncScheduled = false
        syncItemsNow()
      })
    }

    // Vue calls a function `ref` on every patch of its element
    // unconditionally, regardless of identity — the `el === itemEls.get(id)`
    // check below is what actually gates re-syncing on a real change.
    function getItemRefCallback(id: string): VNodeRef {
      let callback = itemRefCallbacks.get(id)
      if (callback) return callback
      callback = (el) => {
        if (el === itemEls.get(id)) return
        if (el) {
          itemEls.set(id, el as HTMLElement)
        } else {
          itemEls.delete(id)
          itemRefCallbacks.delete(id)
        }
        scheduleSyncItems()
      }
      itemRefCallbacks.set(id, callback)
      return callback
    }

    // Core has no `updateOptions`, so a changed `options` *content* tears
    // down and recreates the engine. Compared by content (`optionsEqual`),
    // not by reference — see its own doc comment in core.
    function createEngine() {
      if (!container.value) return
      visibleIds.value = props.options.virtualize ? new Set() : null
      previousIds = new Set(props.items.map((item) => item.id))
      itemCache.clear()
      for (const item of props.items) itemCache.set(item.id, item)
      engine = createMasonryEngine(container.value, {
        ...masonryDefaults,
        ...props.options,
      })
      unsubscribe = engine.on('layout', (payload: { items: MasonryItemLayout[]; visibleIds: string[] }) => {
        hasLaidOut.value = true
        emit('layout', payload.items)
        if (props.options.virtualize) {
          const next = new Set(payload.visibleIds)
          if (!visibleIds.value || !sameIds(visibleIds.value, next)) visibleIds.value = next
        }
      })
      syncItemsNow()
    }

    // Sortable (§5.4): keyboard reordering, opt-in via `sortable`. Never
    // mutates `props.items` — just emits `reorder` with the new array.
    const activeDragId = ref<string | null>(null)
    const liveMessage = ref('')
    const instructionsId = `${instanceId}-instructions`
    const liveRegionId = `${instanceId}-live`

    function announce(message: string) {
      liveMessage.value = message
    }

    function labelFor(id: string, items: MasonryGridItem[]): string {
      const position = items.findIndex((candidate) => candidate.id === id) + 1
      return `item ${position} of ${items.length}`
    }

    let keyboardDragSnapshot: MasonryGridItem[] | null = null

    /** Adjacent-index swap for keyboard reordering (§5.4). */
    function moveItem(items: MasonryGridItem[], id: string, toIndex: number): MasonryGridItem[] {
      const fromIndex = items.findIndex((item) => item.id === id)
      if (fromIndex === -1) return items
      const next = [...items]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(Math.max(0, Math.min(toIndex, next.length)), 0, moved!)
      return next
    }

    function onItemKeydown(event: KeyboardEvent, item: MasonryGridItem) {
      if (!props.sortable || !engine) return

      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault()
        if (activeDragId.value === item.id) {
          activeDragId.value = null
          keyboardDragSnapshot = null
          engine.setDragging(null)
          announce(`Dropped ${labelFor(item.id, props.items)}.`)
        } else if (activeDragId.value === null) {
          activeDragId.value = item.id
          keyboardDragSnapshot = props.items
          engine.setDragging(item.id)
          announce(
            `Picked up ${labelFor(item.id, props.items)}. Use arrow keys to move, space to drop, escape to cancel.`,
          )
        }
        return
      }

      if (activeDragId.value !== item.id) return

      if (event.key === 'Escape') {
        event.preventDefault()
        activeDragId.value = null
        engine.setDragging(null)
        if (keyboardDragSnapshot) emit('reorder', keyboardDragSnapshot)
        keyboardDragSnapshot = null
        announce('Reordering cancelled.')
        return
      }

      const horizontal = props.options.direction === 'horizontal'
      const forwardKey = horizontal ? 'ArrowRight' : 'ArrowDown'
      const backwardKey = horizontal ? 'ArrowLeft' : 'ArrowUp'
      if (event.key !== forwardKey && event.key !== backwardKey) return
      event.preventDefault()

      const currentIndex = props.items.findIndex((candidate) => candidate.id === item.id)
      const step = event.key === forwardKey ? 1 : -1
      const nextIndex = currentIndex + step
      if (nextIndex < 0 || nextIndex >= props.items.length) return

      const reordered = moveItem(props.items, item.id, nextIndex)
      emit('reorder', reordered)
      announce(`Moved to ${labelFor(item.id, reordered)}.`)
    }

    onMounted(() => {
      if (!container.value || typeof window === 'undefined') return
      createEngine()
      stopWatchItems = watch(
        () => props.items,
        (next) => {
          trackLeavingItems(next)
          syncItemsNow()
        },
        { deep: true },
      )
      stopWatchOptions = watch(
        () => props.options,
        (next, prev) => {
          if (optionsEqual(next, prev)) return
          unsubscribe?.()
          engine?.destroy()
          createEngine()
        },
        { deep: true },
      )
    })

    onBeforeUnmount(() => {
      stopWatchItems?.()
      stopWatchOptions?.()
      unsubscribe?.()
      engine?.destroy()
    })

    return () =>
      h(
        'div',
        {
          ref: container,
          class: 'mk-grid',
          // `{}`, not `undefined` — Vue's `patchStyle` treats a style binding
          // going from an object to `undefined` as "remove the whole style
          // attribute", wiping out position/height/transform core sets
          // imperatively (§5.2). `{}` only clears the keys Vue itself set.
          style: hasLaidOut.value ? {} : { columns: resolvedSsrColumns(), columnGap: `${resolvedGap().cross}px` },
        },
        [
          ...renderedItems.value.map((item) => {
            const isLeaving = leaving.value.has(item.id)
            const sortableAttrs = props.sortable
              ? {
                  tabindex: 0,
                  role: 'button',
                  'aria-roledescription': 'Reorderable item',
                  'aria-describedby': instructionsId,
                  'aria-pressed': activeDragId.value === item.id ? 'true' : 'false',
                  onKeydown: (event: KeyboardEvent) => onItemKeydown(event, item),
                }
              : {}
            return h(
              'div',
              {
                key: item.id,
                class: 'mk-item',
                style: {
                  ...(hasLaidOut.value ? {} : { breakInside: 'avoid', marginBottom: `${resolvedGap().main}px` }),
                  ...(isLeaving ? { pointerEvents: 'none' } : {}),
                },
                ref: getItemRefCallback(item.id),
                ...sortableAttrs,
              },
              slots.item?.({ item }),
            )
          }),
          props.sortable
            ? h(
                'span',
                { id: instructionsId, style: visuallyHidden },
                'Press space or enter to pick up this item. While picked up, use the arrow keys to move it, space or enter to drop it, or escape to cancel.',
              )
            : null,
          props.sortable
            ? h(
                'span',
                { id: liveRegionId, role: 'status', 'aria-live': 'polite', style: visuallyHidden },
                liveMessage.value,
              )
            : null,
        ],
      )
  },
})
