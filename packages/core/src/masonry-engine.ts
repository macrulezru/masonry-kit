import { resolveLaneCount, resolveLaneSize } from './lanes'
import { packLanes, type PackInput } from './packing'
import { createResizeWatcher } from './resize-watcher'
import type { MasonryEngineEventMap, MasonryItemDescriptor, MasonryItemLayout, MasonryOptions } from './types'

export interface MasonryEngine {
  setItems(items: MasonryItemDescriptor[]): void
  updateItem(id: string, patch: Partial<Omit<MasonryItemDescriptor, 'id'>>): void
  addItem(item: MasonryItemDescriptor, index?: number): void
  removeItem(id: string): void
  relayout(): void
  getLayout(): MasonryItemLayout[]
  getVisibleIds(): string[]
  setDragging(id: string | null): void
  on<E extends keyof MasonryEngineEventMap>(event: E, handler: (payload: MasonryEngineEventMap[E]) => void): () => void
  destroy(): void
}

const DEFAULT_MIN_LANE_SIZE = 240
const DEFAULT_GAP = 16
const DEFAULT_OVERSCAN = 600
const DEFAULT_TRANSITION_DURATION = 250
const DEFAULT_TRANSITION_EASING = 'cubic-bezier(0.2, 0, 0, 1)'

function resolveElement(item: MasonryItemDescriptor): HTMLElement | null {
  if (typeof item.el === 'function') return item.el()
  return item.el ?? null
}

function findIncompleteImages(el: HTMLElement): HTMLImageElement[] {
  const images = el instanceof HTMLImageElement ? [el] : Array.from(el.querySelectorAll('img'))
  return images.filter((img) => !img.complete)
}

export function createMasonryEngine(container: HTMLElement, options: MasonryOptions = {}): MasonryEngine {
  const direction = options.direction ?? 'vertical'
  const minLaneSize = options.minLaneSize ?? DEFAULT_MIN_LANE_SIZE
  const placement = options.placement ?? 'balanced'
  const gapMain = typeof options.gap === 'number' ? options.gap : (options.gap?.main ?? DEFAULT_GAP)
  const gapCross = typeof options.gap === 'number' ? options.gap : (options.gap?.cross ?? DEFAULT_GAP)
  const laneSpec = direction === 'horizontal' ? (options.rows ?? 'auto') : (options.columns ?? 'auto')

  const virtualizeEnabled = !!options.virtualize
  const overscan =
    typeof options.virtualize === 'object' ? (options.virtualize.overscan ?? DEFAULT_OVERSCAN) : DEFAULT_OVERSCAN
  const scrollContainerOption: HTMLElement | 'self' | 'window' =
    options.scrollContainer ?? (direction === 'vertical' ? 'window' : 'self')
  const estimateSizeFn = options.estimateSize

  const animate = options.animate ?? true
  const transitionDuration = options.transitionDuration ?? DEFAULT_TRANSITION_DURATION
  const transitionEasing = options.transitionEasing ?? DEFAULT_TRANSITION_EASING
  const transitionValue = `transform ${transitionDuration}ms ${transitionEasing}, opacity ${transitionDuration}ms ${transitionEasing}`

  container.style.position = 'relative'

  if (animate) {
    container.style.setProperty('--mk-transition-duration', `${transitionDuration}ms`)
    container.style.setProperty('--mk-transition-easing', transitionEasing)
  }

  let horizontalSpacer: HTMLElement | null = null
  if (direction === 'horizontal') {
    container.style.overflowX = 'auto'
    container.style.overflowY = 'hidden'
    horizontalSpacer = document.createElement('div')
    horizontalSpacer.setAttribute('aria-hidden', 'true')
    horizontalSpacer.style.position = 'absolute'
    horizontalSpacer.style.top = '0'
    horizontalSpacer.style.left = '0'
    horizontalSpacer.style.width = '1px'
    horizontalSpacer.style.height = '1px'
    horizontalSpacer.style.visibility = 'hidden'
    horizontalSpacer.style.pointerEvents = 'none'
    container.appendChild(horizontalSpacer)
  } else {
    container.style.overflowX = 'clip'
  }

  const items = new Map<string, MasonryItemDescriptor>()
  let order: string[] = []
  let lastLayout: MasonryItemLayout[] = []
  let lastVisibleIds: string[] = []
  const measuredMainSize = new Map<string, number>()
  const trackedImages = new WeakSet<HTMLImageElement>()
  let warnedMissingEstimate = false
  let draggingId: string | null = null

  const listeners = new Map<keyof MasonryEngineEventMap, Set<(payload: unknown) => void>>()
  function emit<E extends keyof MasonryEngineEventMap>(event: E, payload: MasonryEngineEventMap[E]) {
    for (const handler of listeners.get(event) ?? []) handler(payload)
  }

  const watcher = createResizeWatcher(relayout)

  function onScroll() {
    watcher.scheduleNow()
  }
  const scrollTarget: HTMLElement | Window | null = virtualizeEnabled
    ? scrollContainerOption === 'window'
      ? window
      : scrollContainerOption === 'self'
        ? container
        : scrollContainerOption
    : null
  scrollTarget?.addEventListener('scroll', onScroll, { passive: true })

  function packOrder(): string[] {
    return order
      .map((id, index) => ({ id, key: items.get(id)?.order ?? index }))
      .sort((a, b) => a.key - b.key)
      .map((entry) => entry.id)
  }

  function syncObservedElements() {
    watcher.unobserveAll()
    watcher.observe(container)
    for (const id of order) {
      const el = resolveElement(items.get(id)!)
      if (el) watcher.observe(el)
    }
  }

  function applyLeaveStyling(id: string) {
    if (!animate) return
    const item = items.get(id)
    const el = item ? resolveElement(item) : null
    if (!el) return
    el.classList.add('mk-item-leave')
    el.style.transition = transitionValue
    el.style.opacity = '0'
  }

  function clearAnimationState(el: HTMLElement) {
    const onTransitionEnd = (event: TransitionEvent) => {
      if (event.target !== el) return
      el.style.willChange = 'auto'
      el.classList.remove('mk-item-moving')
      el.removeEventListener('transitionend', onTransitionEnd)
    }
    el.style.willChange = 'transform'
    el.addEventListener('transitionend', onTransitionEnd)
  }

  function applyPosition(el: HTMLElement, x: number, y: number): boolean {
    const transform = `translate(${x}px, ${y}px)`
    const isFirstPosition = el.style.transform === ''

    if (isFirstPosition) {
      if (!animate) {
        el.style.transform = transform
        return false
      }
      el.style.transition = 'none'
      el.style.transform = transform
      el.style.opacity = '0'
      el.classList.add('mk-item-enter')
      return true
    }

    if (el.style.transform === transform) return false
    if (animate) {
      el.style.transition = transitionValue
      el.classList.add('mk-item-moving')
      clearAnimationState(el)
    }
    el.style.transform = transform
    return false
  }

  function resolveVisibleRange(): [number, number] {
    if (scrollContainerOption === 'self') {
      const scrollOffset = direction === 'vertical' ? container.scrollTop : container.scrollLeft
      const viewportSize = direction === 'vertical' ? container.clientHeight : container.clientWidth
      return [scrollOffset - overscan, scrollOffset + viewportSize + overscan]
    }

    const containerRect = container.getBoundingClientRect()
    const containerMainStart = direction === 'vertical' ? containerRect.top : containerRect.left

    let viewportStart: number
    let viewportSize: number
    if (scrollContainerOption === 'window') {
      viewportStart = 0
      viewportSize = direction === 'vertical' ? window.innerHeight : window.innerWidth
    } else {
      const scrollRect = scrollContainerOption.getBoundingClientRect()
      viewportStart = direction === 'vertical' ? scrollRect.top : scrollRect.left
      viewportSize = direction === 'vertical' ? scrollContainerOption.clientHeight : scrollContainerOption.clientWidth
    }

    return [viewportStart - containerMainStart - overscan, viewportStart + viewportSize - containerMainStart + overscan]
  }

  function resolveEstimatedMainSize(item: MasonryItemDescriptor, crossSize: number): number | undefined {
    if (virtualizeEnabled && item.estimatedSize !== undefined) return item.estimatedSize
    if (item.aspectRatio) return direction === 'vertical' ? crossSize / item.aspectRatio : crossSize * item.aspectRatio
    if (!virtualizeEnabled) return undefined
    if (estimateSizeFn) return estimateSizeFn(item)

    if (!warnedMissingEstimate) {
      warnedMissingEstimate = true
      console.warn(
        '[masonry-kit] `virtualize` is on but an item has no `estimatedSize`, no `aspectRatio`, and `estimateSize` returned nothing — falling back to a guessed size. Set one of these for accurate initial positions.',
      )
    }
    const measured = [...measuredMainSize.values()]
    return measured.length > 0 ? measured.reduce((sum, value) => sum + value, 0) / measured.length : crossSize
  }

  function relayout() {
    const containerRect = container.getBoundingClientRect()
    const crossContainerSize = direction === 'vertical' ? containerRect.width : containerRect.height
    const lanes = resolveLaneCount(laneSpec, crossContainerSize, minLaneSize, gapCross)
    const laneSize = resolveLaneSize(crossContainerSize, lanes, gapCross)

    const ids = packOrder().filter((id) => id !== draggingId)
    const elements = new Map<string, HTMLElement>()
    const spans = new Map<string, number>()
    const crossSizes = new Map<string, number>()

    for (const id of ids) {
      const item = items.get(id)!
      const rawSpan = direction === 'vertical' ? (item.colSpan ?? 1) : (item.rowSpan ?? 1)
      const span = Math.min(Math.max(1, Math.floor(rawSpan) || 1), lanes)
      spans.set(id, span)
      const crossSize = span * laneSize + (span - 1) * gapCross
      crossSizes.set(id, crossSize)

      const el = resolveElement(item)
      if (!el) continue
      elements.set(id, el)

      el.style.position = 'absolute'
      el.style.top = '0'
      el.style.left = '0'
      if (direction === 'vertical') el.style.width = `${crossSize}px`
      else el.style.height = `${crossSize}px`
    }

    const mainSizes = new Map<string, number>()
    const packInputs: PackInput[] = []
    for (const id of ids) {
      const item = items.get(id)!
      const crossSize = crossSizes.get(id)!
      const el = elements.get(id)

      let mainSize: number | undefined
      if (el) {
        const incompleteImages = findIncompleteImages(el)
        if (incompleteImages.length === 0) {
          const measured =
            direction === 'vertical' ? el.getBoundingClientRect().height : el.getBoundingClientRect().width
          if (measured > 0) {
            mainSize = measured
            measuredMainSize.set(id, measured)
          }
        } else {
          for (const img of incompleteImages) {
            if (trackedImages.has(img)) continue
            trackedImages.add(img)
            img.addEventListener('load', relayout, { once: true })
            img.addEventListener('error', relayout, { once: true })
          }
        }
      }
      if (mainSize === undefined) mainSize = measuredMainSize.get(id)
      if (mainSize === undefined) mainSize = resolveEstimatedMainSize(item, crossSize)
      if (mainSize === undefined) continue

      mainSizes.set(id, mainSize)
      packInputs.push({ id, span: spans.get(id)!, mainSize })
    }

    const { items: packed, totalMainSize } = packLanes(packInputs, lanes, gapMain, placement)

    const visibleRange = virtualizeEnabled ? resolveVisibleRange() : null
    const layout: MasonryItemLayout[] = []
    const visibleIds: string[] = []
    const entering: HTMLElement[] = []
    for (const rect of packed) {
      const crossSize = crossSizes.get(rect.id)!
      const mainSize = mainSizes.get(rect.id)!
      const crossPos = rect.laneIndex * (laneSize + gapCross)

      const x = direction === 'vertical' ? crossPos : rect.mainPos
      const y = direction === 'vertical' ? rect.mainPos : crossPos
      const width = direction === 'vertical' ? crossSize : mainSize
      const height = direction === 'vertical' ? mainSize : crossSize

      const el = elements.get(rect.id)
      if (el && applyPosition(el, x, y)) entering.push(el)

      layout.push({ id: rect.id, x, y, width, height })

      if (!visibleRange || (rect.mainPos + mainSize >= visibleRange[0] && rect.mainPos <= visibleRange[1])) {
        visibleIds.push(rect.id)
      }
    }

    if (direction === 'vertical') container.style.height = `${totalMainSize}px`
    else if (horizontalSpacer) horizontalSpacer.style.transform = `translate(${totalMainSize}px, 0)`

    if (entering.length > 0) {
      void entering[0]!.offsetHeight
      for (const el of entering) {
        el.style.transition = transitionValue
        el.style.opacity = '1'
        clearAnimationState(el)
      }
    }

    lastLayout = layout
    lastVisibleIds = visibleIds
    emit('layout', { items: layout, visibleIds })
  }

  function setItemList(next: MasonryItemDescriptor[]) {
    const nextIds = new Set(next.map((item) => item.id))
    for (const id of order) {
      if (nextIds.has(id)) continue
      applyLeaveStyling(id)
      measuredMainSize.delete(id)
    }
    items.clear()
    order = next.map((item) => item.id)
    for (const item of next) items.set(item.id, item)
    syncObservedElements()
  }

  watcher.observe(container)

  return {
    setItems(next) {
      setItemList(next)
      relayout()
    },
    updateItem(id, patch) {
      const existing = items.get(id)
      if (!existing) return
      items.set(id, { ...existing, ...patch })
      syncObservedElements()
      relayout()
    },
    addItem(item, index) {
      items.set(item.id, item)
      if (index === undefined || index >= order.length) order.push(item.id)
      else order.splice(index, 0, item.id)
      syncObservedElements()
      relayout()
    },
    removeItem(id) {
      applyLeaveStyling(id)
      items.delete(id)
      order = order.filter((existing) => existing !== id)
      measuredMainSize.delete(id)
      syncObservedElements()
      relayout()
    },
    relayout,
    getLayout() {
      return [...lastLayout]
    },
    getVisibleIds() {
      return [...lastVisibleIds]
    },
    setDragging(id) {
      if (draggingId === id) return
      draggingId = id
      relayout()
    },
    on(event, handler) {
      if (!listeners.has(event)) listeners.set(event, new Set())
      const set = listeners.get(event)!
      set.add(handler as (payload: unknown) => void)
      return () => set.delete(handler as (payload: unknown) => void)
    },
    destroy() {
      watcher.destroy()
      scrollTarget?.removeEventListener('scroll', onScroll)
      horizontalSpacer?.remove()
      items.clear()
      order = []
      lastLayout = []
      lastVisibleIds = []
      measuredMainSize.clear()
      draggingId = null
      listeners.clear()
    },
  }
}
