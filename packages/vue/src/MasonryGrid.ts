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

let instanceCounter = 0

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

    const visibleIds = shallowRef<Set<string> | null>(props.options.virtualize ? new Set() : null)
    const hasLaidOut = ref(false)
    const leaving = shallowRef<Map<string, MasonryGridItem>>(new Map())
    const itemCache = new Map<string, MasonryGridItem>()
    let previousIds = new Set<string>()

    const renderedItems = computed(() => {
      const base =
        visibleIds.value === null ? props.items : props.items.filter((item) => visibleIds.value!.has(getItemId(item)))
      if (leaving.value.size === 0) return base
      const baseIds = new Set(base.map((item) => getItemId(item)))
      const ghosts = [...leaving.value.values()].filter((item) => !baseIds.has(getItemId(item)))
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

    function resolvedSsrColumns(): number {
      const horizontal = (props.options.direction ?? masonryDefaults.direction) === 'horizontal'
      const laneSpec = horizontal
        ? (props.options.rows ?? masonryDefaults.rows)
        : (props.options.columns ?? masonryDefaults.columns)
      return resolveSsrColumns(laneSpec, props.options.ssrColumns ?? masonryDefaults.ssrColumns)
    }

    function trackLeavingItems(nextItems: MasonryGridItem[]) {
      const nextIds = new Set(nextItems.map((item) => getItemId(item)))
      for (const item of nextItems) itemCache.set(getItemId(item), item)

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
      const descriptors: MasonryItemDescriptor[] = props.items.map((item) => {
        const id = getItemId(item)
        return {
          id,
          el: itemEls.get(id),
          colSpan: item.colSpan,
          rowSpan: item.rowSpan,
          aspectRatio: item.aspectRatio,
          estimatedSize: item.estimatedSize,
          order: item.order,
        }
      })
      engine.setItems(descriptors)
    }

    function scheduleSyncItems() {
      if (syncScheduled) return
      syncScheduled = true
      queueMicrotask(() => {
        syncScheduled = false
        syncItemsNow()
      })
    }

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

    function createEngine() {
      if (!container.value) return
      visibleIds.value = props.options.virtualize ? new Set() : null
      previousIds = new Set(props.items.map((item) => getItemId(item)))
      itemCache.clear()
      for (const item of props.items) itemCache.set(getItemId(item), item)
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

    const activeDragId = ref<string | null>(null)
    const liveMessage = ref('')
    const instructionsId = `${instanceId}-instructions`
    const liveRegionId = `${instanceId}-live`

    function announce(message: string) {
      liveMessage.value = message
    }

    function labelFor(id: string, items: MasonryGridItem[]): string {
      const position = items.findIndex((candidate) => getItemId(candidate) === id) + 1
      return `item ${position} of ${items.length}`
    }

    let keyboardDragSnapshot: MasonryGridItem[] | null = null

    function moveItem(items: MasonryGridItem[], id: string, toIndex: number): MasonryGridItem[] {
      const fromIndex = items.findIndex((item) => getItemId(item) === id)
      if (fromIndex === -1) return items
      const next = [...items]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(Math.max(0, Math.min(toIndex, next.length)), 0, moved!)
      return next
    }

    function onItemKeydown(event: KeyboardEvent, item: MasonryGridItem) {
      if (!props.sortable || !engine) return
      const id = getItemId(item)

      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault()
        if (activeDragId.value === id) {
          activeDragId.value = null
          keyboardDragSnapshot = null
          engine.setDragging(null)
          announce(`Dropped ${labelFor(id, props.items)}.`)
        } else if (activeDragId.value === null) {
          activeDragId.value = id
          keyboardDragSnapshot = props.items
          engine.setDragging(id)
          announce(`Picked up ${labelFor(id, props.items)}. Use arrow keys to move, space to drop, escape to cancel.`)
        }
        return
      }

      if (activeDragId.value !== id) return

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

      const currentIndex = props.items.findIndex((candidate) => getItemId(candidate) === id)
      const step = event.key === forwardKey ? 1 : -1
      const nextIndex = currentIndex + step
      if (nextIndex < 0 || nextIndex >= props.items.length) return

      const reordered = moveItem(props.items, id, nextIndex)
      emit('reorder', reordered)
      announce(`Moved to ${labelFor(id, reordered)}.`)
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
          style: hasLaidOut.value ? {} : { columns: resolvedSsrColumns(), columnGap: `${resolvedGap().cross}px` },
        },
        [
          ...renderedItems.value.map((item) => {
            const id = getItemId(item)
            const isLeaving = leaving.value.has(id)
            const sortableAttrs = props.sortable
              ? {
                  tabindex: 0,
                  role: 'button',
                  'aria-roledescription': 'Reorderable item',
                  'aria-describedby': instructionsId,
                  'aria-pressed': activeDragId.value === id ? 'true' : 'false',
                  onKeydown: (event: KeyboardEvent) => onItemKeydown(event, item),
                }
              : {}
            return h(
              'div',
              {
                key: id,
                class: 'mk-item',
                style: {
                  ...(hasLaidOut.value ? {} : { breakInside: 'avoid', marginBottom: `${resolvedGap().main}px` }),
                  ...(isLeaving ? { pointerEvents: 'none' } : {}),
                },
                ref: getItemRefCallback(id),
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
