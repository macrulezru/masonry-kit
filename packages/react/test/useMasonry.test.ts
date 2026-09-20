import { createElement, useMemo, useState } from 'react'
import { act, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const { createMasonryEngine, engineMock } = vi.hoisted(() => {
  const engineMock = { setItems: vi.fn(), on: vi.fn(() => () => {}), destroy: vi.fn() }
  return { createMasonryEngine: vi.fn(() => engineMock), engineMock }
})
vi.mock('@macrulez/masonry-kit-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@macrulez/masonry-kit-core')>()
  return { ...actual, createMasonryEngine }
})

const { useMasonry } = await import('../src/useMasonry')

afterEach(() => {
  createMasonryEngine.mockClear()
  engineMock.setItems.mockClear()
  engineMock.destroy.mockClear()
})

function lastSetItemsCall() {
  return engineMock.setItems.mock.calls.at(-1)![0] as { id: string; el: unknown }[]
}

describe('useMasonry — el resolves via your own state, not a mutable ref', () => {
  it('drops an item whose el has not mounted yet, then includes it once it does', () => {
    let setShow!: (next: boolean) => void
    let capturedItemEl: HTMLElement | null = null

    function Host() {
      const [container, setContainer] = useState<HTMLElement | null>(null)
      const [itemEl, setItemEl] = useState<HTMLElement | null>(null)
      const [show, setShowState] = useState(false)
      setShow = setShowState
      capturedItemEl = itemEl
      // Memoized: an unmemoized inline object would give `useMasonry` a new
      // `options` reference on every render (including ones this same hook
      // itself triggers, e.g. once its engine is created) — see the hook's
      // own doc comment on why a stable reference matters.
      const options = useMemo(() => ({ items: [{ id: 'a', el: itemEl }] }), [itemEl])
      useMasonry(container, options)
      return createElement('div', null, [
        createElement('div', { key: 'container', ref: setContainer }),
        show ? createElement('div', { key: 'item', ref: setItemEl }) : null,
      ])
    }

    const { unmount } = render(createElement(Host))
    expect(lastSetItemsCall()).toEqual([])

    act(() => setShow(true))
    expect(capturedItemEl).toBeInstanceOf(HTMLElement)
    expect(lastSetItemsCall()).toEqual([{ id: 'a', el: capturedItemEl }])

    unmount()
  })

  it('passes options through to createMasonryEngine, and destroys the engine on unmount', () => {
    function Host() {
      const [container, setContainer] = useState<HTMLElement | null>(null)
      const options = useMemo(() => ({ direction: 'horizontal' as const }), [])
      useMasonry(container, options)
      return createElement('div', { ref: setContainer })
    }

    const { unmount } = render(createElement(Host))

    const [, options] = createMasonryEngine.mock.calls[0]!
    expect(options).toMatchObject({ direction: 'horizontal' })
    expect(createMasonryEngine).toHaveBeenCalledOnce()

    unmount()
    expect(engineMock.destroy).toHaveBeenCalledOnce()
  })
})
