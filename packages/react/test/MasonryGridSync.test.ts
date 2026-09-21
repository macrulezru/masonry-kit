import { createElement, useState } from 'react'
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

const { MasonryGrid } = await import('../src/MasonryGrid')

afterEach(() => {
  createMasonryEngine.mockClear()
  engineMock.setItems.mockClear()
  engineMock.on.mockClear()
  engineMock.destroy.mockClear()
})

function lastSetItemsCall() {
  return engineMock.setItems.mock.calls.at(-1)![0] as { id: string; el: unknown }[]
}

describe('MasonryGrid — item sync (mocked engine)', () => {
  it('only includes items whose wrapper has actually mounted', async () => {
    let setShow!: (next: boolean) => void

    function Host() {
      const [show, setShowState] = useState(false)
      setShow = setShowState
      return createElement(MasonryGrid, { items: show ? [{ id: 'a' }] : [] }, () => 'A')
    }

    const { unmount } = render(createElement(Host))
    expect(lastSetItemsCall()).toEqual([])

    await act(async () => setShow(true))
    expect(lastSetItemsCall()).toEqual([
      {
        id: 'a',
        el: expect.any(HTMLElement),
        colSpan: undefined,
        rowSpan: undefined,
        aspectRatio: undefined,
        order: undefined,
      },
    ])

    unmount()
  })

  it('forwards colSpan/rowSpan/aspectRatio/order through to the item descriptor', () => {
    const { unmount } = render(
      createElement(
        MasonryGrid,
        { items: [{ id: 'a', colSpan: 2, rowSpan: 1, aspectRatio: 1.5, order: 3 }] },
        () => 'A',
      ),
    )

    expect(lastSetItemsCall()[0]).toMatchObject({ colSpan: 2, rowSpan: 1, aspectRatio: 1.5, order: 3 })

    unmount()
  })

  it('recreates the engine when the options reference changes, since core has no live updateOptions', async () => {
    let setOptions!: (next: { columns: number }) => void

    function Host() {
      const [options, setOptionsState] = useState({ columns: 2 })
      setOptions = setOptionsState
      return createElement(MasonryGrid, { items: [{ id: 'a' }], options }, () => 'A')
    }

    const { unmount } = render(createElement(Host))
    expect(createMasonryEngine).toHaveBeenCalledTimes(1)
    expect(createMasonryEngine.mock.calls[0]![1]).toMatchObject({ columns: 2 })

    await act(async () => setOptions({ columns: 4 }))

    expect(engineMock.destroy).toHaveBeenCalledOnce()
    expect(createMasonryEngine).toHaveBeenCalledTimes(2)
    expect(createMasonryEngine.mock.calls[1]![1]).toMatchObject({ columns: 4 })
    // Items lost when the old engine was destroyed are re-synced onto the new one.
    expect(lastSetItemsCall()).toEqual([
      {
        id: 'a',
        el: expect.any(HTMLElement),
        colSpan: undefined,
        rowSpan: undefined,
        aspectRatio: undefined,
        order: undefined,
      },
    ])

    unmount()
  })

  it('does NOT recreate the engine when a new options object has identical content', async () => {
    let bumpItems!: () => void

    function Host() {
      const [items, setItems] = useState([{ id: 'a' }])
      bumpItems = () => setItems((prev) => [...prev])
      return createElement(MasonryGrid, { items, options: { columns: 2 } }, () => 'A')
    }

    const { unmount } = render(createElement(Host))
    expect(createMasonryEngine).toHaveBeenCalledTimes(1)

    // Re-renders the Host (a new `options` object every time), without ever
    // changing `items`' actual content or `options`' actual content.
    await act(async () => bumpItems())
    await act(async () => bumpItems())

    expect(createMasonryEngine).toHaveBeenCalledTimes(1) // still just the one engine
    expect(engineMock.destroy).not.toHaveBeenCalled()

    unmount()
  })

  it('auto-generates a stable id for an item with none, keyed by object identity', async () => {
    const item = { colSpan: 2 }
    let bump!: () => void

    function Host() {
      const [items, setItems] = useState([item])
      bump = () => setItems([item])
      return createElement(MasonryGrid, { items }, () => 'A')
    }

    const { unmount } = render(createElement(Host))
    const firstId = lastSetItemsCall()[0]!.id
    expect(firstId).toBeTruthy()

    await act(async () => bump())
    expect(lastSetItemsCall()[0]!.id).toBe(firstId)

    unmount()
  })

  it('forwards the engine layout event as its own onLayout call', () => {
    const onLayout = vi.fn()
    const { unmount } = render(createElement(MasonryGrid, { items: [{ id: 'a' }], onLayout }, () => 'A'))

    const layoutHandler = engineMock.on.mock.calls.find(([event]) => event === 'layout')![1]
    const items = [{ id: 'a', x: 0, y: 0, width: 100, height: 50 }]
    act(() => layoutHandler({ items, visibleIds: ['a'] }))

    expect(onLayout).toHaveBeenCalledTimes(1)
    expect(onLayout).toHaveBeenCalledWith(items)

    unmount()
  })
})
