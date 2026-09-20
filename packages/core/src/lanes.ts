import type { LaneSpec } from './types'

/**
 * Resolves a `LaneSpec` to a concrete lane count for the container's current
 * cross-axis size — see tech spec §3.4.
 */
export function resolveLaneCount(
  spec: LaneSpec,
  crossContainerSize: number,
  minLaneSize: number,
  gapCross: number,
): number {
  if (spec === 'auto') {
    return Math.max(1, Math.floor((crossContainerSize + gapCross) / (minLaneSize + gapCross)))
  }
  if (typeof spec === 'number') {
    return Math.max(1, Math.floor(spec))
  }
  // Breakpoints: nearest key `>= crossContainerSize` wins (as in react-masonry-css), else `default`.
  const keys = Object.keys(spec)
    .filter((key) => key !== 'default')
    .map(Number)
    .sort((a, b) => a - b)
  for (const key of keys) {
    if (crossContainerSize <= key) return Math.max(1, Math.floor(spec[key]))
  }
  return Math.max(1, Math.floor(spec.default))
}

/** Splits the container's cross-axis size into `lanes` equal lanes, accounting for `lanes - 1` inter-lane gaps. */
export function resolveLaneSize(crossContainerSize: number, lanes: number, gapCross: number): number {
  return Math.max(0, (crossContainerSize - (lanes - 1) * gapCross) / lanes)
}

/**
 * Column count for the CSS `columns` SSR/pre-hydration approximation (§4.4)
 * — resolved without knowing the container's real size, since none of this
 * runs measured (the engine itself never calls this; a framework adapter
 * does, before the engine exists). An explicit `ssrColumns` always wins;
 * otherwise a `LaneSpec` that's already a concrete number/breakpoints object
 * (no measurement needed to resolve it) is reused as-is; `'auto'` or unset
 * falls back to a conservative `2` — safe on both mobile and desktop widths,
 * never uncomfortably narrow.
 */
export function resolveSsrColumns(spec: LaneSpec | undefined, explicit: number | undefined): number {
  if (explicit !== undefined) return Math.max(1, Math.floor(explicit))
  if (spec === undefined || spec === 'auto') return 2
  if (typeof spec === 'number') return Math.max(1, Math.floor(spec))
  return Math.max(1, Math.floor(spec.default))
}
