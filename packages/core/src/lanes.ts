import type { LaneSpec } from './types'

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

  const keys = Object.keys(spec)
    .filter((key) => key !== 'default')
    .map(Number)
    .sort((a, b) => a - b)
  for (const key of keys) {
    if (crossContainerSize <= key) return Math.max(1, Math.floor(spec[key]))
  }
  return Math.max(1, Math.floor(spec.default))
}

export function resolveLaneSize(crossContainerSize: number, lanes: number, gapCross: number): number {
  return Math.max(0, (crossContainerSize - (lanes - 1) * gapCross) / lanes)
}

export function resolveSsrColumns(spec: LaneSpec | undefined, explicit: number | undefined): number {
  if (explicit !== undefined) return Math.max(1, Math.floor(explicit))
  if (spec === undefined || spec === 'auto') return 2
  if (typeof spec === 'number') return Math.max(1, Math.floor(spec))
  return Math.max(1, Math.floor(spec.default))
}
