import { beforeEach, describe, expect, it } from 'vitest'
import { createMasonryEngine, type MasonryEngine } from '../src/masonry-engine'

/** happy-dom doesn't run real CSS layout, so every element's box has to be stubbed explicitly — width/height here stand in for whatever the real browser would have measured. */
function stubRect(el: HTMLElement, width: number, height: number) {
  el.getBoundingClientRect = () => ({
    top: 0,
    left: 0,
    right: width,
    bottom: height,
    width,
    height,
    x: 0,
    y: 0,
    toJSON() {},
  })
}

function makeEl(width: number, height: number): HTMLElement {
  const el = document.createElement('div')
  stubRect(el, width, height)
  return el
}

describe('createMasonryEngine — vertical', () => {
  let container: HTMLElement
  let engine: MasonryEngine | undefined

  beforeEach(() => {
    container = makeEl(500, 0) // cross-axis (width) = 500
    document.body.appendChild(container)
  })

  it('packs measured items into the shortest column and sizes the container to the tallest one', () => {
    const a = makeEl(0, 100)
    const b = makeEl(0, 40)
    container.append(a, b)

    engine = createMasonryEngine(container, { columns: 2, gap: 10, minLaneSize: 200 })
    engine.setItems([
      { id: 'a', el: a },
      { id: 'b', el: b },
    ])

    // laneSize = (500 - 10) / 2 = 245
    const layout = engine.getLayout()
    expect(layout.find((i) => i.id === 'a')).toMatchObject({ x: 0, y: 0, width: 245, height: 100 })
    expect(layout.find((i) => i.id === 'b')).toMatchObject({ x: 255, y: 0, width: 245, height: 40 })
    expect(container.style.height).toBe('100px')
  })

  it('resolves a function-form `el` (e.g. an unmounted Vue ref) at relayout time', () => {
    const a = makeEl(0, 50)
    container.append(a)

    engine = createMasonryEngine(container, { columns: 1, gap: 0, minLaneSize: 200 })
    engine.setItems([{ id: 'a', el: () => a }])

    expect(engine.getLayout()).toEqual([{ id: 'a', x: 0, y: 0, width: 500, height: 50 }])
  })

  it('uses aspectRatio to estimate size before a real measurement, and excludes items with neither', () => {
    const withRatio = document.createElement('div') // un-stubbed: getBoundingClientRect reports all-zero, like an unmeasured element
    const withNothing = document.createElement('div')
    container.append(withRatio, withNothing)

    engine = createMasonryEngine(container, { columns: 1, gap: 0, minLaneSize: 200 })
    engine.setItems([
      { id: 'withRatio', el: withRatio, aspectRatio: 2 }, // width/height = 2 -> height = crossSize / 2
      { id: 'withNothing', el: withNothing },
    ])

    const layout = engine.getLayout()
    expect(layout.map((i) => i.id)).toEqual(['withRatio'])
    expect(layout[0].height).toBeCloseTo(250) // crossSize 500 / aspectRatio 2
  })

  it('places a colSpan item across multiple lanes and clamps a span wider than the lane count', () => {
    const wide = makeEl(0, 30)
    container.append(wide)

    engine = createMasonryEngine(container, { columns: 2, gap: 0, minLaneSize: 200 })
    engine.setItems([{ id: 'wide', el: wide, colSpan: 5 }])

    const layout = engine.getLayout()
    expect(layout[0]).toMatchObject({ x: 0, width: 500 }) // clamped to 2 lanes -> full container width
  })

  it('removeItem drops the item from the next layout', () => {
    const a = makeEl(0, 10)
    const b = makeEl(0, 10)
    container.append(a, b)

    engine = createMasonryEngine(container, { columns: 1, gap: 0, minLaneSize: 200 })
    engine.setItems([
      { id: 'a', el: a },
      { id: 'b', el: b },
    ])
    expect(engine.getLayout().map((i) => i.id)).toEqual(['a', 'b'])

    engine.removeItem('a')
    expect(engine.getLayout().map((i) => i.id)).toEqual(['b'])
  })

  it('emits a layout event with the same data returned by getLayout()', () => {
    const a = makeEl(0, 10)
    container.append(a)

    engine = createMasonryEngine(container, { columns: 1, gap: 0, minLaneSize: 200 })
    let received: unknown
    engine.on('layout', (payload) => {
      received = payload.items
    })
    engine.setItems([{ id: 'a', el: a }])

    expect(received).toEqual(engine.getLayout())
  })
})

describe('createMasonryEngine — horizontal', () => {
  it('packs along x and resolves lanes from the container height', () => {
    const container = makeEl(0, 300) // cross-axis (height) = 300
    document.body.appendChild(container)
    const a = makeEl(80, 0)
    const b = makeEl(50, 0)
    container.append(a, b)

    const engine = createMasonryEngine(container, { direction: 'horizontal', rows: 2, gap: 10, minLaneSize: 100 })
    engine.setItems([
      { id: 'a', el: a },
      { id: 'b', el: b },
    ])

    // laneSize = (300 - 10) / 2 = 145
    const layout = engine.getLayout()
    expect(layout.find((i) => i.id === 'a')).toMatchObject({ x: 0, y: 0, width: 80, height: 145 })
    expect(layout.find((i) => i.id === 'b')).toMatchObject({ x: 0, y: 155, width: 50, height: 145 })
    expect(container.style.overflowX).toBe('auto')
    expect(container.style.overflowY).toBe('hidden')
  })

  it('never grows the container itself to fit the content — a spacer carries the scrollable width instead', () => {
    const container = makeEl(0, 300)
    document.body.appendChild(container)
    const a = makeEl(80, 0)
    container.append(a)

    const engine = createMasonryEngine(container, { direction: 'horizontal', rows: 1, gap: 0, minLaneSize: 100 })
    engine.setItems([{ id: 'a', el: a }])

    // The container's own layout width must stay untouched — setting it to
    // fit the content would leave nothing for overflow-x: auto to scroll,
    // and the container would blow out whatever it's embedded in instead.
    expect(container.style.width).toBe('')

    const spacer = container.querySelector<HTMLElement>('[aria-hidden="true"]')
    expect(spacer?.style.transform).toBe('translate(80px, 0)')
  })

  it('removes the spacer on destroy', () => {
    const container = makeEl(0, 300)
    document.body.appendChild(container)
    const engine = createMasonryEngine(container, { direction: 'horizontal' })
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull()

    engine.destroy()
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull()
  })
})
