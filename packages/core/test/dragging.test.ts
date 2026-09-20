import { describe, expect, it } from 'vitest'
import { createMasonryEngine, type MasonryEngine } from '../src/masonry-engine'

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

function makeContainer(width: number): HTMLElement {
  const el = makeEl(width, 0)
  document.body.appendChild(el)
  return el
}

let engine: MasonryEngine | undefined

describe('setDragging', () => {
  it('excludes the dragging item from packing/layout — others reflow to fill its gap immediately', () => {
    const container = makeContainer(500)
    const a = makeEl(0, 50)
    const b = makeEl(0, 30)
    container.append(a, b)

    engine = createMasonryEngine(container, { columns: 1, gap: 0, minLaneSize: 200 })
    engine.setItems([
      { id: 'a', el: a, order: 0 },
      { id: 'b', el: b, order: 1 },
    ])
    expect(engine.getLayout().find((i) => i.id === 'b')!.y).toBe(50) // b stacked below a

    engine.setDragging('a')

    expect(engine.getLayout().map((i) => i.id)).toEqual(['b'])
    expect(engine.getVisibleIds()).toEqual(['b'])
    expect(engine.getLayout().find((i) => i.id === 'b')!.y).toBe(0) // b reflowed up into a's old spot

    engine.destroy()
  })

  it('never touches the dragging item element at all — no width/transform/class writes', () => {
    const container = makeContainer(500)
    const a = makeEl(0, 50)
    const b = makeEl(0, 30)
    container.append(a, b)

    engine = createMasonryEngine(container, { columns: 1, gap: 0, minLaneSize: 200 })
    engine.setItems([
      { id: 'a', el: a, order: 0 },
      { id: 'b', el: b, order: 1 },
    ])
    const transformBeforeDrag = a.style.transform

    const widthBeforeDrag = a.style.width

    engine.setDragging('a')
    a.style.transform = 'translate(123px, 456px)' // simulates the consumer following the pointer
    engine.relayout() // even a forced relayout must leave it alone while dragging

    expect(a.style.transform).toBe('translate(123px, 456px)') // untouched by relayout — stayed exactly as the caller set it
    expect(a.style.width).toBe(widthBeforeDrag) // pass 1 didn't re-run for it either — width is just whatever it already was
    expect(transformBeforeDrag).not.toBe('') // sanity: it really was positioned before dragging started

    engine.destroy()
  })

  it('re-including a dragged item FLIP-animates it from its last (caller-set) transform into its packed slot, not an instant snap', () => {
    const container = makeContainer(500)
    const a = makeEl(0, 50)
    const b = makeEl(0, 30)
    container.append(a, b)

    engine = createMasonryEngine(container, { columns: 1, gap: 0, minLaneSize: 200 })
    engine.setItems([
      { id: 'a', el: a, order: 0 },
      { id: 'b', el: b, order: 1 },
    ])

    engine.setDragging('a')
    a.style.transform = 'translate(123px, 456px)'

    engine.setDragging(null)

    // mk-item-enter was already added back when 'a' was first ever placed (by design it's
    // never removed — see §5.2), so the real signal that this went through the FLIP/"moving"
    // path rather than an instant re-placement is mk-item-moving plus a real transition value.
    expect(a.classList.contains('mk-item-moving')).toBe(true)
    expect(a.style.transition).toContain('transform')
    expect(a.style.transform).toBe('translate(0px, 0px)') // back in its normal packed slot

    engine.destroy()
  })

  it('is a no-op when called again with the id already dragging', () => {
    const container = makeContainer(500)
    const a = makeEl(0, 50)
    container.appendChild(a)

    engine = createMasonryEngine(container, { columns: 1, gap: 0, minLaneSize: 200 })
    engine.setItems([{ id: 'a', el: a }])

    engine.setDragging('a')
    const layoutAfterFirstCall = engine.getLayout()
    engine.setDragging('a') // same id again

    expect(engine.getLayout()).toEqual(layoutAfterFirstCall)

    engine.destroy()
  })
})
