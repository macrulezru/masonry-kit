export interface MasonryItemDescriptor {
  id: string
  /** Existing DOM node, or a resolver for one (e.g. an unmounted Vue ref). Omitted/null-returning items are skipped until it resolves. */
  el?: HTMLElement | (() => HTMLElement | null)
  /** How many adjacent lanes this item spans at `direction: 'vertical'`, clamped to `[1, lanes]` each relayout. default 1 */
  colSpan?: number
  /** Same as `colSpan`, used at `direction: 'horizontal'`. default 1 */
  rowSpan?: number
  /**
   * width/height, used as a provisional main-axis size before the element has
   * a real measured size (first mount, or not yet rendered) — see §4.3 of the
   * tech spec. Without it, such an item is left out of the layout until its
   * `ResizeObserver` reports a real size — unless `virtualize` is on, in
   * which case `estimatedSize`/`MasonryOptions.estimateSize` step in instead
   * (see §3.5).
   */
  aspectRatio?: number
  /**
   * Explicit main-axis size estimate in px, used only while `virtualize` is
   * on and this item has no real measurement yet — takes priority over
   * `aspectRatio` (§3.5). Ignored when `virtualize` is off.
   */
  estimatedSize?: number
  /** Explicit pack order; default is position in the array passed to `setItems`. */
  order?: number
}

export type LaneBreakpoints = { default: number; [maxCrossSize: number]: number }

/** A lane (column at `vertical`, row at `horizontal`) count: fixed, fluid from `minLaneSize`, or breakpoints keyed by the container's cross-axis size (nearest key `>=` the container size wins, else `default`). */
export type LaneSpec = number | 'auto' | LaneBreakpoints

export interface MasonryOptions {
  /** default 'vertical' */
  direction?: 'vertical' | 'horizontal'
  /** Lane spec at `direction: 'vertical'`. default 'auto' */
  columns?: LaneSpec
  /** Lane spec at `direction: 'horizontal'`. default 'auto' */
  rows?: LaneSpec
  /** Required for `columns`/`rows: 'auto'` — the fluid lane size that decides how many lanes fit. default 240 */
  minLaneSize?: number
  /** default 16/16 */
  gap?: number | { main?: number; cross?: number }
  /**
   * 'balanced' (default) places each item in the lane(s) with the least
   * content so far (skyline packing). 'ordered' is strict round-robin —
   * less balanced, but keeps physical placement order equal to item order.
   */
  placement?: 'balanced' | 'ordered'
  /**
   * Two-phase layout for large lists (§3.5): items outside the visible range
   * (± `overscan`) skip real DOM measurement entirely and use an estimated
   * size instead, so `setItems`/`relayout` stay cheap regardless of list
   * size. `overscan` is in px along the main axis. default `false` (off);
   * `true` uses the default overscan (600)
   */
  virtualize?: boolean | { overscan?: number }
  /**
   * Which element's scroll position/viewport size to track for `virtualize`.
   * `'self'` — the engine's own container scrolls (typical for
   * `direction: 'horizontal'`). `'window'` — the page scrolls (typical for
   * `direction: 'vertical'`). An explicit element — a custom scroll ancestor
   * outside the container. default `'window'` at `vertical`, `'self'` at
   * `horizontal`. Ignored when `virtualize` is off.
   */
  scrollContainer?: HTMLElement | 'self' | 'window'
  /**
   * Fallback main-axis size estimate (px) for `virtualize`, used only when a
   * given item has neither `estimatedSize` nor `aspectRatio` set. Ignored
   * when `virtualize` is off. Without this either, an item with none of the
   * three falls back to the average size of already-measured items (or its
   * own cross size, if nothing has been measured yet) — see §9.
   */
  estimateSize?: (item: MasonryItemDescriptor) => number
  /**
   * FLIP-animates `transform` on reflow (§5.2) instead of teleporting
   * elements, and fades newly-mounted/removed items in/out (opacity only —
   * a `scale()` was tried and dropped, since it changes an item's *painted*
   * size in a way the gap/position math doesn't account for) — both via
   * inline styles, so this works with zero required CSS.
   * `.mk-item-enter`/`.mk-item-moving`/`.mk-item-leave` are also toggled as
   * hooks for additional CSS on top (§7). default `true`
   */
  animate?: boolean
  /** ms. Ignored when `animate` is off. default 250 */
  transitionDuration?: number
  /** Any valid CSS `transition-timing-function` value. Ignored when `animate` is off. default `'cubic-bezier(0.2, 0, 0, 1)'` */
  transitionEasing?: string
  /**
   * Explicit column count for the pure-CSS `columns` approximation a
   * framework adapter renders before the engine exists — server-side, and
   * for the one client frame before the first real measurement (§4.4). The
   * engine itself never reads this field; it's resolved via
   * `resolveSsrColumns` and consumed entirely by the adapter. Unset falls
   * back to `columns`/`rows` (if already a concrete number/breakpoints
   * value) or a conservative default of 2.
   */
  ssrColumns?: number
}

/** A resolved item's box for the current layout pass, direction-agnostic (already mapped to physical x/y/width/height regardless of `direction`). */
export interface MasonryItemLayout {
  id: string
  x: number
  y: number
  width: number
  height: number
}

export interface MasonryEngineEventMap {
  /**
   * Fired at the end of every relayout (initial, structural change, resize-,
   * or scroll-triggered) with every item's resolved box. `visibleIds` is the
   * same set `getVisibleIds()` returns for this pass — every packed item's id
   * when `virtualize` is off.
   */
  layout: { items: MasonryItemLayout[]; visibleIds: string[] }
}
