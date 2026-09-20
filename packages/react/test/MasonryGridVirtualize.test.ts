import { createElement } from 'react'
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
})

function lastSetItemsCall() {
  return engineMock.setItems.mock.calls.at(-1)![0] as { id: string; el: unknown }[]
}

function layoutHandler() {
  return engineMock.on.mock.calls.find(([event]) => event === 'layout')![1] as (payload: {
    items: unknown[]
    visibleIds: string[]
  }) => void
}

const child = (item: { id: string }) => item.id

describe('MasonryGrid — virtualize (mocked engine)', () => {
  it('renders nothing until the first layout event, instead of mounting every item and immediately discarding most of them', () => {
    const items = Array.from({ length: 50 }, (_, i) => ({ id: `item-${i}` }))
    const { container, unmount } = render(createElement(MasonryGrid, { items, options: { virtualize: true } }, child))

    expect(container.querySelectorAll('.mk-item')).toHaveLength(0)
    // Every item is still sent to the engine (with `el: undefined`) so its
    // estimate participates in the very first, DOM-free relayout.
    expect(lastSetItemsCall()).toHaveLength(50)
    expect(lastSetItemsCall().every((d) => d.el === undefined)).toBe(true)

    unmount()
  })

  it('renders a wrapper only for the ids the engine reports as visible', () => {
    const items = Array.from({ length: 50 }, (_, i) => ({ id: `item-${i}` }))
    const { container, unmount } = render(createElement(MasonryGrid, { items, options: { virtualize: true } }, child))

    act(() => layoutHandler()({ items: [], visibleIds: ['item-3', 'item-4'] }))

    expect(container.querySelectorAll('.mk-item')).toHaveLength(2)
    expect(container.textContent).toContain('item-3')
    expect(container.textContent).toContain('item-4')
    expect(container.textContent).not.toContain('item-0')

    unmount()
  })

  it('resolves elements for the now-visible items on the next sync, keeping the rest as el: undefined', () => {
    const items = Array.from({ length: 3 }, (_, i) => ({ id: `item-${i}` }))
    const { unmount } = render(createElement(MasonryGrid, { items, options: { virtualize: true } }, child))

    act(() => layoutHandler()({ items: [], visibleIds: ['item-1'] }))

    const call = lastSetItemsCall()
    expect(call.find((d) => d.id === 'item-1')!.el).toBeInstanceOf(HTMLElement)
    expect(call.find((d) => d.id === 'item-0')!.el).toBeUndefined()
    expect(call.find((d) => d.id === 'item-2')!.el).toBeUndefined()

    unmount()
  })

  it('batches every item mounted in the same commit into a single setItems() call', () => {
    const items = Array.from({ length: 50 }, (_, i) => ({ id: `item-${i}` }))
    const { unmount } = render(createElement(MasonryGrid, { items, options: { virtualize: true } }, child))
    expect(engineMock.setItems.mock.calls).toHaveLength(1) // the initial, synchronous engine-creation sync

    act(() => layoutHandler()({ items: [], visibleIds: Array.from({ length: 10 }, (_, i) => `item-${i}`) }))

    // 10 items mount in the same commit — their ref callbacks all fire
    // synchronously, but must collapse into exactly one more setItems() call,
    // not ten (each one individually triggers a full, if cheap, relayout).
    expect(engineMock.setItems.mock.calls).toHaveLength(2)
    expect(lastSetItemsCall().filter((d) => d.el instanceof HTMLElement)).toHaveLength(10)

    unmount()
  })

  it('does not re-sync when the reported visible set has the same ids as before (order aside)', () => {
    const items = Array.from({ length: 5 }, (_, i) => ({ id: `item-${i}` }))
    const { unmount } = render(createElement(MasonryGrid, { items, options: { virtualize: true } }, child))

    act(() => layoutHandler()({ items: [], visibleIds: ['item-1', 'item-2'] }))
    const callsAfterFirst = engineMock.setItems.mock.calls.length

    // A fresh `Set` with the same members in a different order — a naive
    // state reassignment would still count as "changed" by reference and
    // re-render for nothing.
    act(() => layoutHandler()({ items: [], visibleIds: ['item-2', 'item-1'] }))

    expect(engineMock.setItems.mock.calls).toHaveLength(callsAfterFirst)

    unmount()
  })

  it('drops a never-visible item immediately on removal — nothing was ever mounted to animate', () => {
    const items = [{ id: 'item-0' }, { id: 'item-1' }]
    const options = { virtualize: true }
    const { container, rerender, unmount } = render(createElement(MasonryGrid, { items, options }, child))
    // item-0 never becomes visible in this test — nothing ever mounts a wrapper for it.
    act(() => layoutHandler()({ items: [], visibleIds: ['item-1'] }))
    expect(container.querySelectorAll('.mk-item')).toHaveLength(1)

    // Same `options` reference — only `items` changes, so the engine isn't
    // recreated (which would otherwise reset `visibleIds` and mask what
    // this test is actually checking).
    act(() => rerender(createElement(MasonryGrid, { items: [{ id: 'item-1' }], options }, child))) // item-0 removed from items

    expect(container.querySelectorAll('.mk-item')).toHaveLength(1) // no leave-ghost for item-0 — it had no element to animate

    unmount()
  })

  it('renders every item unconditionally when virtualize is off, regardless of getVisibleIds', () => {
    const items = [{ id: 'a' }, { id: 'b' }]
    const { container, unmount } = render(createElement(MasonryGrid, { items }, child))

    expect(container.querySelectorAll('.mk-item')).toHaveLength(2)

    // Even if a 'layout' event somehow reported a narrower visible set, it's ignored.
    act(() => layoutHandler()({ items: [], visibleIds: ['a'] }))
    expect(container.querySelectorAll('.mk-item')).toHaveLength(2)

    unmount()
  })
})
