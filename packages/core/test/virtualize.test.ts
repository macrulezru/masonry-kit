import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMasonryEngine, type MasonryEngine } from '../src/masonry-engine'

function stubRect(el: HTMLElement, width: number, height: number, top = 0, left = 0) {
  el.getBoundingClientRect = () => ({
    top,
    left,
    right: left + width,
    bottom: top + height,
    width,
    height,
    x: left,
    y: top,
    toJSON() {},
  })
}

function makeEl(width: number, height: number): HTMLElement {
  const el = document.createElement('div')
  stubRect(el, width, height)
  return el
}

/** A `scrollContainer: 'self'` container — `clientHeight`/`clientWidth`/`scrollTop`/`scrollLeft` all need explicit stubs since happy-dom doesn't run real layout. */
function makeScrollSelfContainer(crossSize: number, clientMainSize: number): HTMLElement {
  const el = makeEl(crossSize, crossSize)
  Object.defineProperty(el, 'clientHeight', { value: clientMainSize, configurable: true })
  Object.defineProperty(el, 'clientWidth', { value: clientMainSize, configurable: true })
  Object.defineProperty(el, 'scrollTop', { value: 0, writable: true, configurable: true })
  Object.defineProperty(el, 'scrollLeft', { value: 0, writable: true, configurable: true })
  return el
}

let engine: MasonryEngine | undefined
afterEach(() => {
  engine?.destroy()
  engine = undefined
})

describe('virtualize — off (default)', () => {
  it('getVisibleIds() returns every packed id', () => {
    const container = makeEl(500, 0)
    document.body.appendChild(container)
    engine = createMasonryEngine(container, { columns: 1, gap: 0, minLaneSize: 200 })
    engine.setItems([
      { id: 'a', aspectRatio: 1 },
      { id: 'b', aspectRatio: 1 },
    ])
    expect(engine.getVisibleIds().sort()).toEqual(['a', 'b'])
  })
})

describe('virtualize — size estimation chain', () => {
  it('prefers estimatedSize over aspectRatio, and falls through to estimateSize() when neither is set', () => {
    const container = makeScrollSelfContainer(500, 1000)
    document.body.appendChild(container)

    engine = createMasonryEngine(container, {
      columns: 1,
      gap: 0,
      minLaneSize: 200,
      virtualize: true,
      scrollContainer: 'self',
      estimateSize: () => 77,
    })
    engine.setItems([
      { id: 'a', estimatedSize: 50, aspectRatio: 2 }, // estimatedSize wins over aspectRatio's 500/2=250
      { id: 'b', aspectRatio: 2 }, // 500 / 2
      { id: 'c' }, // neither set -> instance-wide estimateSize()
    ])

    const layout = engine.getLayout()
    expect(layout.find((i) => i.id === 'a')!.height).toBe(50)
    expect(layout.find((i) => i.id === 'b')!.height).toBe(250)
    expect(layout.find((i) => i.id === 'c')!.height).toBe(77)
  })

  it('falls back to its own cross size, with a one-time warning, when nothing has ever been measured', () => {
    const container = makeScrollSelfContainer(500, 1000)
    document.body.appendChild(container)

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    engine = createMasonryEngine(container, {
      columns: 1,
      gap: 0,
      minLaneSize: 200,
      virtualize: true,
      scrollContainer: 'self',
    })
    engine.setItems([{ id: 'a' }])

    expect(engine.getLayout()[0]!.height).toBe(500) // no measured items yet -> its own cross size
    expect(warnSpy).toHaveBeenCalledTimes(1)

    engine.addItem({ id: 'b' }) // still no real measurement anywhere -> same fallback, no extra warning
    expect(engine.getLayout().find((i) => i.id === 'b')!.height).toBe(500)
    expect(warnSpy).toHaveBeenCalledTimes(1)

    warnSpy.mockRestore()
  })

  it('falls back to the average of already-measured items instead, once at least one is real', () => {
    const container = makeScrollSelfContainer(500, 1000)
    document.body.appendChild(container)
    const measuredEl = makeEl(0, 200) // real measured height 200, vs. the 500 own-cross-size guess
    container.appendChild(measuredEl)

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    engine = createMasonryEngine(container, {
      columns: 1,
      gap: 0,
      minLaneSize: 200,
      virtualize: true,
      scrollContainer: 'self',
    })
    engine.setItems([{ id: 'measured', el: measuredEl }, { id: 'unestimated' }])

    expect(engine.getLayout().find((i) => i.id === 'unestimated')!.height).toBe(200)
    warnSpy.mockRestore()
  })

  it('does not fall through to estimatedSize/estimateSize() when virtualize is off — aspectRatio still applies, everything else excludes the item', () => {
    const container = makeEl(500, 0)
    document.body.appendChild(container)
    engine = createMasonryEngine(container, { columns: 1, gap: 0, minLaneSize: 200 })
    engine.setItems([
      { id: 'a', aspectRatio: 2 },
      { id: 'b', estimatedSize: 999 }, // ignored: virtualize is off
    ])

    const layout = engine.getLayout()
    expect(layout.map((i) => i.id)).toEqual(['a'])
    expect(layout[0]!.height).toBe(250)
  })
})

describe('virtualize — real measurement', () => {
  it('prefers a real measurement over any estimate once mounted, and keeps using it after the element unmounts again', () => {
    const container = makeScrollSelfContainer(500, 1000)
    document.body.appendChild(container)

    let mounted = false
    const realEl = makeEl(0, 123)
    container.appendChild(realEl)

    engine = createMasonryEngine(container, {
      columns: 1,
      gap: 0,
      minLaneSize: 200,
      virtualize: true,
      scrollContainer: 'self',
    })
    engine.setItems([{ id: 'a', el: () => (mounted ? realEl : null), aspectRatio: 2 }])
    expect(engine.getLayout()[0]!.height).toBe(250)

    mounted = true
    engine.relayout()
    expect(engine.getLayout()[0]!.height).toBe(123)

    mounted = false
    engine.relayout()
    expect(engine.getLayout()[0]!.height).toBe(123)
  })
})

describe('virtualize — visible range (scrollContainer: self)', () => {
  it('only includes items within clientHeight + overscan of the current scroll position', () => {
    const container = makeScrollSelfContainer(500, 150)
    document.body.appendChild(container)

    engine = createMasonryEngine(container, {
      columns: 1,
      gap: 0,
      minLaneSize: 200,
      virtualize: { overscan: 0 },
      scrollContainer: 'self',
    })
    // Each item estimates to 500 / 5 = 100px tall -> stacked at [0,100), [100,200), [200,300), [300,400), [400,500).
    engine.setItems(Array.from({ length: 5 }, (_, i) => ({ id: `item-${i}`, aspectRatio: 5 })))

    // Viewport [0,150]: item-0 [0,100) and item-1 [100,200) both overlap it.
    expect(engine.getVisibleIds().sort()).toEqual(['item-0', 'item-1'])
    // Every item still gets a real computed position, visible or not.
    expect(
      engine
        .getLayout()
        .map((i) => i.id)
        .sort(),
    ).toEqual(['item-0', 'item-1', 'item-2', 'item-3', 'item-4'])

    Object.defineProperty(container, 'scrollTop', { value: 220, configurable: true })
    engine.relayout()
    // Viewport [220,370]: item-2 [200,300) and item-3 [300,400) overlap it; item-1 [100,200) and item-4 [400,500) don't.
    expect(engine.getVisibleIds().sort()).toEqual(['item-2', 'item-3'])
  })

  it('widens the visible range by overscan on both sides', () => {
    const container = makeScrollSelfContainer(500, 150)
    document.body.appendChild(container)

    engine = createMasonryEngine(container, {
      columns: 1,
      gap: 0,
      minLaneSize: 200,
      virtualize: { overscan: 140 },
      scrollContainer: 'self',
    })
    engine.setItems(Array.from({ length: 5 }, (_, i) => ({ id: `item-${i}`, aspectRatio: 5 })))

    // Viewport [0,150] widened by 140 on each side -> [-140, 290]: item-0..item-2 overlap, item-3 [300,400) doesn't.
    expect(engine.getVisibleIds().sort()).toEqual(['item-0', 'item-1', 'item-2'])
  })
})

describe('virtualize — scroll listener', () => {
  it('listens on window by default at direction: vertical, and removes it on destroy', () => {
    const container = makeEl(500, 0)
    document.body.appendChild(container)
    const addSpy = vi.spyOn(window, 'addEventListener')
    const removeSpy = vi.spyOn(window, 'removeEventListener')

    engine = createMasonryEngine(container, { virtualize: true })
    expect(addSpy).toHaveBeenCalledWith('scroll', expect.any(Function), { passive: true })

    engine.destroy()
    engine = undefined
    expect(removeSpy).toHaveBeenCalledWith('scroll', expect.any(Function))

    addSpy.mockRestore()
    removeSpy.mockRestore()
  })

  it('listens on the container itself by default at direction: horizontal', () => {
    const container = makeEl(0, 300)
    document.body.appendChild(container)
    const addSpy = vi.spyOn(container, 'addEventListener')

    engine = createMasonryEngine(container, { direction: 'horizontal', virtualize: true })
    expect(addSpy).toHaveBeenCalledWith('scroll', expect.any(Function), { passive: true })
  })

  it('attaches no scroll listener at all when virtualize is off', () => {
    const container = makeEl(500, 0)
    document.body.appendChild(container)
    const addSpy = vi.spyOn(window, 'addEventListener')

    engine = createMasonryEngine(container)
    expect(addSpy).not.toHaveBeenCalledWith('scroll', expect.anything(), expect.anything())

    addSpy.mockRestore()
  })
})
