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
  engineMock.destroy.mockClear()
})

function fireLayout() {
  const layoutHandler = engineMock.on.mock.calls.find(([event]) => event === 'layout')![1]
  layoutHandler({ items: [], visibleIds: [] })
}

const child = (item: { id: string }) => item.id

describe('MasonryGrid — SSR CSS-columns fallback (§4.4)', () => {
  it('renders the CSS columns approximation before the engine has ever laid out — conservative default of 2 columns/16px gap', () => {
    const { container, unmount } = render(createElement(MasonryGrid, { items: [{ id: 'a' }, { id: 'b' }] }, child))

    const grid = container.querySelector('.mk-grid') as HTMLElement
    expect(grid.style.columns).toBe('2')
    expect(grid.style.columnGap).toBe('16px')

    const item = container.querySelector('.mk-item') as HTMLElement
    expect(item.style.breakInside).toBe('avoid')
    expect(item.style.marginBottom).toBe('16px')

    unmount()
  })

  it('an explicit ssrColumns wins over columns/rows', () => {
    const { container, unmount } = render(
      createElement(MasonryGrid, { items: [{ id: 'a' }], options: { columns: 5, ssrColumns: 3, gap: 10 } }, child),
    )

    const grid = container.querySelector('.mk-grid') as HTMLElement
    expect(grid.style.columns).toBe('3')
    expect(grid.style.columnGap).toBe('10px')

    unmount()
  })

  it('reuses a concrete columns/rows value (no explicit ssrColumns needed) — rows when direction is horizontal', () => {
    const { container, unmount } = render(
      createElement(
        MasonryGrid,
        { items: [{ id: 'a' }], options: { direction: 'horizontal', rows: 4, columns: 7 } },
        child,
      ),
    )

    expect((container.querySelector('.mk-grid') as HTMLElement).style.columns).toBe('4')

    unmount()
  })

  it("falls back to 2 columns for columns: 'auto', since the container's real width isn't known pre-hydration", () => {
    const { container, unmount } = render(
      createElement(MasonryGrid, { items: [{ id: 'a' }], options: { columns: 'auto', minLaneSize: 240 } }, child),
    )

    expect((container.querySelector('.mk-grid') as HTMLElement).style.columns).toBe('2')

    unmount()
  })

  it('switches to the real transform-based layout the moment the engine reports its first layout, in the same reactive flush', () => {
    const { container, unmount } = render(createElement(MasonryGrid, { items: [{ id: 'a' }] }, child))
    expect((container.querySelector('.mk-grid') as HTMLElement).style.columns).toBeTruthy()

    act(() => fireLayout())

    expect((container.querySelector('.mk-grid') as HTMLElement).style.columns).toBeFalsy()
    expect((container.querySelector('.mk-item') as HTMLElement).style.breakInside).toBeFalsy()

    unmount()
  })
})
