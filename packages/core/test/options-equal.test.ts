import { describe, expect, it } from 'vitest'
import { optionsEqual } from '../src/options-equal'

describe('optionsEqual', () => {
  it('treats two empty options as equal', () => {
    expect(optionsEqual({}, {})).toBe(true)
  })

  it('treats identical primitive fields as equal, even across different object references', () => {
    expect(optionsEqual({ direction: 'vertical', minLaneSize: 240 }, { direction: 'vertical', minLaneSize: 240 })).toBe(
      true,
    )
  })

  it('detects a changed primitive field', () => {
    expect(optionsEqual({ minLaneSize: 240 }, { minLaneSize: 200 })).toBe(false)
  })

  it('detects a field present in only one side', () => {
    expect(optionsEqual({ animate: true }, { animate: true, transitionDuration: 300 })).toBe(false)
  })

  it('recurses into a plain object field — gap as {main, cross}', () => {
    expect(optionsEqual({ gap: { main: 10, cross: 20 } }, { gap: { main: 10, cross: 20 } })).toBe(true)
    expect(optionsEqual({ gap: { main: 10, cross: 20 } }, { gap: { main: 10, cross: 21 } })).toBe(false)
  })

  it('treats a number gap and an equivalent-looking object gap as different (structurally different shapes)', () => {
    expect(optionsEqual({ gap: 10 }, { gap: { main: 10, cross: 10 } })).toBe(false)
  })

  it('recurses into the breakpoints form of columns/rows', () => {
    expect(optionsEqual({ columns: { default: 4, 768: 2 } }, { columns: { default: 4, 768: 2 } })).toBe(true)
    expect(optionsEqual({ columns: { default: 4, 768: 2 } }, { columns: { default: 4, 768: 3 } })).toBe(false)
  })

  it("compares 'auto' and a fixed number correctly", () => {
    expect(optionsEqual({ columns: 'auto' }, { columns: 'auto' })).toBe(true)
    expect(optionsEqual({ columns: 'auto' }, { columns: 4 })).toBe(false)
  })

  it('compares virtualize as boolean or {overscan}', () => {
    expect(optionsEqual({ virtualize: true }, { virtualize: true })).toBe(true)
    expect(optionsEqual({ virtualize: { overscan: 600 } }, { virtualize: { overscan: 600 } })).toBe(true)
    expect(optionsEqual({ virtualize: { overscan: 600 } }, { virtualize: { overscan: 400 } })).toBe(false)
  })

  it('compares scrollContainer HTMLElements by reference, not structurally', () => {
    const a = document.createElement('div')
    const b = document.createElement('div')
    // Two distinct, otherwise-identical (empty) elements must never compare
    // equal just because neither has any own enumerable properties — this
    // is the exact footgun `valuesEqual`'s `Node` guard exists to avoid.
    expect(optionsEqual({ scrollContainer: a }, { scrollContainer: b })).toBe(false)
    expect(optionsEqual({ scrollContainer: a }, { scrollContainer: a })).toBe(true)
  })

  it('compares estimateSize functions by reference', () => {
    const fn = () => 100
    expect(optionsEqual({ estimateSize: fn }, { estimateSize: fn })).toBe(true)
    expect(optionsEqual({ estimateSize: () => 100 }, { estimateSize: () => 100 })).toBe(false)
  })

  it('a fresh object with identical content compares equal (the actual bug this exists to fix)', () => {
    // Simulates a framework adapter re-creating an inline `options` literal
    // on every unrelated re-render — content-identical, different reference.
    const makeOptions = () => ({ columns: 4, gap: 14 })
    expect(optionsEqual(makeOptions(), makeOptions())).toBe(true)
  })
})
