import { resolveLaneCount, resolveLaneSize } from './lanes'
import { packLanes, type PackInput } from './packing'
import { createResizeWatcher } from './resize-watcher'
import type { MasonryEngineEventMap, MasonryItemDescriptor, MasonryItemLayout, MasonryOptions } from './types'

export interface MasonryEngine {
  setItems(items: MasonryItemDescriptor[]): void
  updateItem(id: string, patch: Partial<Omit<MasonryItemDescriptor, 'id'>>): void
  addItem(item: MasonryItemDescriptor, index?: number): void
  removeItem(id: string): void
  /** Forces an immediate recomputation, bypassing the rAF batching (e.g. right after a manual content mutation). */
  relayout(): void
  getLayout(): MasonryItemLayout[]
  /** Ids that should have a real DOM element right now — see `MasonryOptions.virtualize` (§3.5). Every packed item's id when `virtualize` is off. */
  getVisibleIds(): string[]
  /**
   * Excludes `id` from packing/positioning entirely (§5.4) — everyone else
   * reflows immediately as if it weren't in the list, and its element's
   * `transform`/`opacity`/classes are left 100% to the caller (a drag
   * gesture following the pointer, say) until this is called again with
   * `null`, which re-includes it on the next relayout: since its `transform`
   * is whatever the caller last set (not empty), it FLIP-animates from there
   * into its packed slot instead of popping in.
   */
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
  // Consumer convenience (§7) — lets custom CSS reference the same timing
  // (e.g. a hover effect) without hardcoding it separately. Core's own
  // animation logic below uses the resolved JS values directly, not these.
  if (animate) {
    container.style.setProperty('--mk-transition-duration', `${transitionDuration}ms`)
    container.style.setProperty('--mk-transition-easing', transitionEasing)
  }
  // `horizontal`'s container is a fixed-size scroll viewport (its own height
  // is the consumer's to set — §3.1/§7), not a box the engine grows to fit
  // the content like `vertical`'s. A 1px spacer, positioned at the packed
  // content's far edge via the same `transform: translate()` every item
  // already uses, gives the container a real `scrollWidth` to scroll through
  // without touching its own layout width — setting `container.style.width`
  // instead would make the container itself grow to fit all content, leaving
  // nothing to scroll and blowing out whatever it's embedded in.
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
  }

  const items = new Map<string, MasonryItemDescriptor>()
  let order: string[] = []
  let lastLayout: MasonryItemLayout[] = []
  let lastVisibleIds: string[] = []
  // Persists a real measurement across relayouts even once an item scrolls
  // back out of view and its element unmounts (§3.5) — without this, a
  // virtualized item would keep reverting to its raw estimate every time it
  // leaves the measured window, instead of staying self-corrected.
  const measuredMainSize = new Map<string, number>()
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

  /** Re-syncs which elements are observed for resize — only needed when the item set/its elements change, not on every resize-triggered relayout (that would tear down and rebuild every observer on each frame). */
  function syncObservedElements() {
    watcher.unobserveAll()
    watcher.observe(container)
    for (const id of order) {
      const el = resolveElement(items.get(id)!)
      if (el) watcher.observe(el)
    }
  }

  /**
   * Best-effort fade-out for an item leaving the item set (§5.2), applied
   * directly to whatever element it currently resolves to — core doesn't own
   * that element's DOM lifecycle (a framework adapter does), so this can't
   * delay the element's actual removal by itself. `<MasonryGrid>` keeps the
   * element mounted for `transitionDuration` after removal specifically so
   * this gets to play out instead of being cut short — see TECH_SPEC
   * §5.2/§6.2 for why that delay has to live in the adapter.
   *
   * Opacity only, deliberately — an accompanying `scale()` was tried and
   * dropped (see §5.2's note on this) since it changes the element's
   * *painted* box size while position/gap math never accounts for that,
   * which reads as the layout itself getting the gap wrong even though the
   * underlying positions never moved.
   */
  function applyLeaveStyling(id: string) {
    if (!animate) return
    const item = items.get(id)
    const el = item ? resolveElement(item) : null
    if (!el) return
    el.classList.add('mk-item-leave')
    el.style.transition = transitionValue
    el.style.opacity = '0'
  }

  /** Drops `will-change`/`.mk-item-moving` once the transition triggered by `applyPosition` actually finishes — not indefinitely, since holding a compositing layer open forever is the classic `will-change` gotcha (§7). */
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

  /**
   * Applies an item's resolved position — instantly on its very first
   * placement (else it would visibly slide in from the origin instead of
   * just fading into its real spot), FLIP-animated on every placement after
   * that (§5.2). A no-op transform (position genuinely unchanged since last
   * time) is skipped entirely, so a static item's `transitionend`
   * listener/`will-change` churn stays at zero. Returns `true` for a first
   * placement under `animate` — the caller batches *every* such item's
   * "commit the instant state, then enable the transition" step into one
   * shared forced reflow instead of one per item (see `relayout`'s pass 3).
   *
   * "First placement" is read off the *element itself* (`transform` still
   * unset — pass 1 never touches it) rather than a per-id flag: under
   * `virtualize`, the same id gets a brand-new DOM element each time it
   * re-enters the visible range (the old one was unmounted while it was out
   * of view), and a per-id flag would wrongly treat that fresh element as
   * "already positioned", animating it in from the origin exactly like the
   * bug this function exists to avoid.
   */
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

  /** The visible window along the main axis, in container-relative coordinates (± `overscan`) — see `MasonryOptions.scrollContainer`. */
  function resolveVisibleRange(): [number, number] {
    // 'self': items are positioned via `transform` in the container's own
    // unscrolled coordinate space, so its `getBoundingClientRect()` never
    // moves as it scrolls itself — `scrollTop`/`scrollLeft` is the only thing
    // that actually tells us how far into that content the viewport sits.
    if (scrollContainerOption === 'self') {
      const scrollOffset = direction === 'vertical' ? container.scrollTop : container.scrollLeft
      const viewportSize = direction === 'vertical' ? container.clientHeight : container.clientWidth
      return [scrollOffset - overscan, scrollOffset + viewportSize + overscan]
    }

    // 'window' and an explicit ancestor element both scroll *around*
    // `container` rather than being `container` itself, so their own
    // `getBoundingClientRect()` already reflects all of that scrolling —
    // container-relative position is just the gap between the two rects.
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

  /** Estimated main-axis size for an item with no real measurement (yet) — §3.5's `estimatedSize → aspectRatio → estimateSize()` chain, only consulted at all when `virtualize` is on (aspectRatio alone still applies either way — see §4.3). */
  function resolveEstimatedMainSize(item: MasonryItemDescriptor, crossSize: number): number | undefined {
    if (virtualizeEnabled && item.estimatedSize !== undefined) return item.estimatedSize
    if (item.aspectRatio) return direction === 'vertical' ? crossSize / item.aspectRatio : crossSize * item.aspectRatio
    if (!virtualizeEnabled) return undefined
    if (estimateSizeFn) return estimateSizeFn(item)

    // Last resort (§9): average of whatever's actually been measured so far,
    // else this item's own cross size (a "roughly square" guess) — plus a
    // one-time warning, since silently guessing on a virtualized list is
    // easy to miss until the layout visibly looks wrong.
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

    // Pass 1 (writes): fix every mounted item's cross-axis size before reading
    // anything back, so the natural main-axis size read in pass 2 reflects the
    // size it will actually be packed at, instead of thrashing layout item by
    // item. Items with no resolvable element yet (always true for anything
    // outside the visible range under `virtualize`) simply have nothing to
    // write here — they're still included below, just via an estimate.
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

    // Pass 2 (reads + size resolution): a mounted item gets measured for
    // real; an unmounted one falls back to its last known real measurement,
    // then an estimate (§3.5). An item with none of the above sits out of
    // this pass entirely — see tech spec §4.3. It settles in on its own once
    // it has SOME size to go on.
    const mainSizes = new Map<string, number>()
    const packInputs: PackInput[] = []
    for (const id of ids) {
      const item = items.get(id)!
      const crossSize = crossSizes.get(id)!
      const el = elements.get(id)

      let mainSize: number | undefined
      if (el) {
        const measured = direction === 'vertical' ? el.getBoundingClientRect().height : el.getBoundingClientRect().width
        if (measured > 0) {
          mainSize = measured
          measuredMainSize.set(id, measured)
        }
      }
      if (mainSize === undefined) mainSize = measuredMainSize.get(id)
      if (mainSize === undefined) mainSize = resolveEstimatedMainSize(item, crossSize)
      if (mainSize === undefined) continue

      mainSizes.set(id, mainSize)
      packInputs.push({ id, span: spans.get(id)!, mainSize })
    }

    const { items: packed, totalMainSize } = packLanes(packInputs, lanes, gapMain, placement)

    // Pass 3 (writes): position mounted items; every packed item (mounted or
    // not) still gets a `layout`/visible-id entry.
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

    // One shared forced reflow commits every entering item's instant
    // (untransitioned) state at once, instead of one reflow per item —
    // mounting dozens of items in the same pass would otherwise thrash
    // layout by forcing it once per element (§4).
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
