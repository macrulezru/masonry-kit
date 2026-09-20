import { describe, expect, it } from 'vitest'
import { resolveLaneCount, resolveLaneSize, resolveSsrColumns } from '../src/lanes'

describe('resolveLaneCount', () => {
  it('returns a fixed lane count as-is', () => {
    expect(resolveLaneCount(3, 999, 240, 16)).toBe(3)
  })

  it('computes an auto lane count from the container size and minLaneSize', () => {
    // 3 lanes of 240px + 2 inter-lane gaps of 16px = 752px
    expect(resolveLaneCount('auto', 752, 240, 16)).toBe(3)
    expect(resolveLaneCount('auto', 751, 240, 16)).toBe(2)
  })

  it('picks the smallest breakpoint key that still fits the container, else default', () => {
    const spec = { default: 4, 1024: 3, 768: 2, 480: 1 }
    expect(resolveLaneCount(spec, 400, 240, 16)).toBe(1)
    expect(resolveLaneCount(spec, 480, 240, 16)).toBe(1)
    expect(resolveLaneCount(spec, 600, 240, 16)).toBe(2)
    expect(resolveLaneCount(spec, 900, 240, 16)).toBe(3)
    expect(resolveLaneCount(spec, 2000, 240, 16)).toBe(4)
  })

  it('never returns fewer than 1 lane', () => {
    expect(resolveLaneCount('auto', 10, 240, 16)).toBe(1)
    expect(resolveLaneCount(0, 999, 240, 16)).toBe(1)
  })
})

describe('resolveLaneSize', () => {
  it('splits the container size across lanes, minus inter-lane gaps', () => {
    expect(resolveLaneSize(752, 3, 16)).toBeCloseTo(240)
  })

  it('never returns a negative size', () => {
    expect(resolveLaneSize(10, 5, 16)).toBe(0)
  })
})

describe('resolveSsrColumns', () => {
  it('an explicit value always wins, over any spec', () => {
    expect(resolveSsrColumns(5, 3)).toBe(3)
    expect(resolveSsrColumns('auto', 3)).toBe(3)
    expect(resolveSsrColumns(undefined, 3)).toBe(3)
  })

  it('reuses a plain-number spec as-is', () => {
    expect(resolveSsrColumns(4, undefined)).toBe(4)
  })

  it('uses the breakpoints object default, since the container size is unknown pre-hydration', () => {
    expect(resolveSsrColumns({ default: 3, 768: 1 }, undefined)).toBe(3)
  })

  it("falls back to a conservative 2 for 'auto'", () => {
    expect(resolveSsrColumns('auto', undefined)).toBe(2)
  })

  it('falls back to a conservative 2 when no spec is set at all', () => {
    expect(resolveSsrColumns(undefined, undefined)).toBe(2)
  })

  it('never returns fewer than 1 column', () => {
    expect(resolveSsrColumns(0, undefined)).toBe(1)
    expect(resolveSsrColumns(undefined, 0)).toBe(1)
  })
})
