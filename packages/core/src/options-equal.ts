import type { MasonryOptions } from './types'

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (typeof Node !== 'undefined' && (a instanceof Node || b instanceof Node)) return false
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) return false
  return aKeys.every((key) => valuesEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]))
}

export function optionsEqual(a: MasonryOptions, b: MasonryOptions): boolean {
  if (a === b) return true
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof MasonryOptions>
  for (const key of keys) {
    if (!valuesEqual(a[key], b[key])) return false
  }
  return true
}
