import { describe, expect, it, vi } from 'vitest'
import { createMasonryEngine } from '../src/masonry-engine'

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

describe('animate — default on', () => {
  it('positions a newly-mounted item instantly, with a fade-in (opacity only, no scale/size change) and the mk-item-enter class', () => {
    const container = makeContainer(500)
    const a = makeEl(0, 50)
    container.appendChild(a)

    const engine = createMasonryEngine(container, { columns: 1, gap: 0, minLaneSize: 200 })
    engine.setItems([{ id: 'a', el: a }])

    // The *final* state after the enter sequence: correct position, full opacity.
    expect(a.style.transform).toBe('translate(0px, 0px)')
    expect(a.style.opacity).toBe('1')
    expect(a.classList.contains('mk-item-enter')).toBe(true)
    expect(a.style.transition).toContain('transform')
    expect(a.style.transform).not.toContain('scale') // dropped — see TECH_SPEC §5.2

    engine.destroy()
  })

  it('batches every item entering in the same relayout into one shared forced reflow, not one per item', () => {
    const container = makeContainer(500)
    const a = makeEl(0, 50)
    const b = makeEl(0, 30)
    const c = makeEl(0, 20)
    container.append(a, b, c)

    const readSpy = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get')

    const engine = createMasonryEngine(container, { columns: 1, gap: 0, minLaneSize: 200 })
    engine.setItems([
      { id: 'a', el: a },
      { id: 'b', el: b },
      { id: 'c', el: c },
    ])

    // All three enter in the same pass — exactly one forced reflow read for
    // the whole batch, not three (§4/§5.2).
    expect(readSpy).toHaveBeenCalledTimes(1)
    for (const el of [a, b, c]) {
      expect(el.style.opacity).toBe('1')
      expect(el.style.transition).toContain('transform')
    }

    readSpy.mockRestore()
    engine.destroy()
  })

  it('positions a fresh element for an id instantly, even if that same id was already positioned via a different (now-unmounted) element before', () => {
    // This is the virtualize scroll-out/scroll-back-in case: the wrapper for
    // a given id gets unmounted while out of view and a brand-new one
    // mounted when it scrolls back — the *id* has "been positioned before",
    // but this specific *element* never has, and must get the instant
    // first-placement treatment, not FLIP-animate in from nothing.
    const container = makeContainer(500)
    const firstEl = makeEl(0, 50)
    container.appendChild(firstEl)

    const engine = createMasonryEngine(container, { columns: 1, gap: 0, minLaneSize: 200 })
    engine.setItems([{ id: 'a', el: firstEl }])
    expect(firstEl.style.transform).toBe('translate(0px, 0px)')

    engine.setItems([{ id: 'a', el: undefined }]) // 'a' scrolls out — no resolvable element

    const secondEl = makeEl(0, 50) // 'a' scrolls back in — a brand-new element
    container.appendChild(secondEl)
    engine.setItems([{ id: 'a', el: secondEl }])

    expect(secondEl.style.transform).toBe('translate(0px, 0px)')
    expect(secondEl.classList.contains('mk-item-enter')).toBe(true)
    expect(secondEl.classList.contains('mk-item-moving')).toBe(false)

    engine.destroy()
  })

  it('FLIP-animates a reflow: transition + will-change + mk-item-moving get set when the position actually changes', () => {
    const container = makeContainer(500)
    const a = makeEl(0, 50)
    const b = makeEl(0, 30)
    container.append(a, b)

    const engine = createMasonryEngine(container, { columns: 1, gap: 0, minLaneSize: 200 })
    engine.setItems([{ id: 'a', el: a }])
    expect(a.style.transform).toBe('translate(0px, 0px)')

    // Adding b before a in pack order (via explicit `order`) pushes a down — a real reflow.
    engine.setItems([
      { id: 'b', el: b, order: 0 },
      { id: 'a', el: a, order: 1 },
    ])

    expect(a.style.transform).toBe('translate(0px, 30px)')
    expect(a.classList.contains('mk-item-moving')).toBe(true)
    expect(a.style.willChange).toBe('transform')
    expect(a.style.transition).toContain('transform')

    engine.destroy()
  })

  it('skips the transition/will-change/moving-class churn entirely when a relayout does not actually move the item', () => {
    const container = makeContainer(500)
    const a = makeEl(0, 50)
    container.appendChild(a)

    const engine = createMasonryEngine(container, { columns: 1, gap: 0, minLaneSize: 200 })
    engine.setItems([{ id: 'a', el: a }])
    expect(a.classList.contains('mk-item-moving')).toBe(false) // first placement is "enter", not "moving"
    a.dispatchEvent(new Event('transitionend')) // let the enter transition settle, as it would for real

    engine.relayout() // nothing changed since the last pass
    expect(a.classList.contains('mk-item-moving')).toBe(false)
    expect(a.style.willChange).toBe('auto')

    engine.destroy()
  })

  it('clears will-change and mk-item-moving once the transition actually finishes', () => {
    const container = makeContainer(500)
    const a = makeEl(0, 50)
    const b = makeEl(0, 30)
    container.append(a, b)

    const engine = createMasonryEngine(container, { columns: 1, gap: 0, minLaneSize: 200 })
    engine.setItems([{ id: 'a', el: a }])
    engine.setItems([
      { id: 'b', el: b, order: 0 },
      { id: 'a', el: a, order: 1 },
    ])
    expect(a.classList.contains('mk-item-moving')).toBe(true)

    a.dispatchEvent(new Event('transitionend'))

    expect(a.classList.contains('mk-item-moving')).toBe(false)
    expect(a.style.willChange).toBe('auto')

    engine.destroy()
  })

  it('fades an item out (mk-item-leave, opacity 0) when it is removed, without touching its position or the DOM node itself', () => {
    const container = makeContainer(500)
    const a = makeEl(0, 50)
    container.appendChild(a)

    const engine = createMasonryEngine(container, { columns: 1, gap: 0, minLaneSize: 200 })
    engine.setItems([{ id: 'a', el: a }])
    const frozenTransform = a.style.transform

    engine.removeItem('a')

    expect(a.classList.contains('mk-item-leave')).toBe(true)
    expect(a.style.opacity).toBe('0')
    expect(a.style.transform).toBe(frozenTransform) // position stays exactly where it was — only opacity fades
    expect(container.contains(a)).toBe(true) // core never removes the element itself — see TECH_SPEC §5.2/§6.2

    engine.destroy()
  })

  it('uses custom transitionDuration/transitionEasing in the transition string and as container CSS custom properties', () => {
    const container = makeContainer(500)
    const a = makeEl(0, 50)
    container.appendChild(a)

    const engine = createMasonryEngine(container, {
      columns: 1,
      gap: 0,
      minLaneSize: 200,
      transitionDuration: 400,
      transitionEasing: 'ease-out',
    })
    engine.setItems([{ id: 'a', el: a }])

    expect(a.style.transition).toContain('400ms')
    expect(a.style.transition).toContain('ease-out')
    expect(container.style.getPropertyValue('--mk-transition-duration')).toBe('400ms')
    expect(container.style.getPropertyValue('--mk-transition-easing')).toBe('ease-out')

    engine.destroy()
  })
})

describe('animate: false', () => {
  it('positions items instantly, with no transition/classes/CSS variables at all', () => {
    const container = makeContainer(500)
    const a = makeEl(0, 50)
    const b = makeEl(0, 30)
    container.append(a, b)

    const engine = createMasonryEngine(container, { columns: 1, gap: 0, minLaneSize: 200, animate: false })
    engine.setItems([{ id: 'a', el: a }])
    expect(a.style.transform).toBe('translate(0px, 0px)')
    expect(a.classList.contains('mk-item-enter')).toBe(false)
    expect(a.style.transition).toBe('')

    engine.setItems([
      { id: 'b', el: b, order: 0 },
      { id: 'a', el: a, order: 1 },
    ])
    expect(a.style.transform).toBe('translate(0px, 30px)')
    expect(a.classList.contains('mk-item-moving')).toBe(false)
    expect(a.style.transition).toBe('')

    engine.removeItem('a')
    expect(a.classList.contains('mk-item-leave')).toBe(false)
    expect(a.style.opacity).toBe('')

    expect(container.style.getPropertyValue('--mk-transition-duration')).toBe('')

    engine.destroy()
  })
})
