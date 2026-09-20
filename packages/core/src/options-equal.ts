import type { MasonryOptions } from './types'

/**
 * Structural equality for a single value — recurses into plain objects
 * (`gap`, `virtualize`, the breakpoints form of `columns`/`rows`), but
 * treats DOM nodes and functions (`estimateSize`) as opaque, compared only
 * by reference. A DOM element has no own enumerable properties, so without
 * the `Node` guard two different empty elements would compare equal.
 */
function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (typeof Node !== 'undefined' && (a instanceof Node || b instanceof Node)) return false
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) return false
  return aKeys.every((key) => valuesEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]))
}

/**
 * Structural (not just referential) equality for `MasonryOptions` — used by
 * framework adapters to decide whether an `options` prop/argument reference
 * change is a *real* change worth tearing down and recreating the engine
 * for (core has no live `updateOptions()` — see §6.2/§6.5), or just an
 * incidental new object with identical content (e.g. an inline object
 * literal getting a fresh reference on every unrelated re-render).
 */
export function optionsEqual(a: MasonryOptions, b: MasonryOptions): boolean {
  if (a === b) return true
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof MasonryOptions>
  for (const key of keys) {
    if (!valuesEqual(a[key], b[key])) return false
  }
  return true
}
