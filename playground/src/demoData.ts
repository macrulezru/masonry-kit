const PALETTE = ['#6d5bf6', '#1fa97a', '#e0526c', '#e8a33d', '#4f3fd6', '#2b9cd8', '#c2185b', '#00897b']

export interface DemoItem {
  id: string
  /** Size along whichever axis is the demo's main (content-measured) axis, in px. */
  size: number
  color: string
}

/** Deterministic pseudo-random size, so the demo grid looks the same on every reload instead of reshuffling. */
function seededSize(seed: number, min: number, max: number): number {
  const x = Math.sin(seed * 999.123) * 10000
  const frac = x - Math.floor(x)
  return Math.round(min + frac * (max - min))
}

/**
 * One item for a 1-based `index` — size/color both derive from it, so a card
 * appended later (e.g. via a "+ Add card" button, one at a time) still gets
 * its own distinct look instead of always reproducing `index`'s default of 0
 * the way calling `makeItems(1, ...)` per click would.
 */
export function makeItem(index: number, opts: { min?: number; max?: number } = {}): DemoItem {
  const { min = 90, max = 260 } = opts
  return {
    id: `item-${index}`,
    size: seededSize(index, min, max),
    color: PALETTE[(index - 1) % PALETTE.length]!,
  }
}

export function makeItems(count: number, opts: { min?: number; max?: number } = {}): DemoItem[] {
  return Array.from({ length: count }, (_, i) => makeItem(i + 1, opts))
}
