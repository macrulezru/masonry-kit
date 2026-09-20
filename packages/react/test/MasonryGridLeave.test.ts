import { createElement } from 'react'
import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MasonryGrid } from '../src/MasonryGrid'

describe('MasonryGrid — leave animation (real engine)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps a removed item mounted through transitionDuration, then drops it', () => {
    const { container, rerender, unmount } = render(
      createElement(
        MasonryGrid,
        {
          items: [{ id: 'a' }, { id: 'b' }],
          options: { columns: 1, gap: 0, minLaneSize: 200, transitionDuration: 300 },
        },
        (item: { id: string }) => item.id,
      ),
    )
    expect(container.querySelectorAll('.mk-item')).toHaveLength(2)

    act(() =>
      rerender(
        createElement(
          MasonryGrid,
          { items: [{ id: 'b' }], options: { columns: 1, gap: 0, minLaneSize: 200, transitionDuration: 300 } },
          (item: { id: string }) => item.id,
        ),
      ),
    )

    // 'a' disappeared from `items` but is still mounted, fading out.
    expect(container.querySelectorAll('.mk-item')).toHaveLength(2)
    expect(container.textContent).toContain('a')

    act(() => vi.advanceTimersByTime(299))
    expect(container.querySelectorAll('.mk-item')).toHaveLength(2) // not quite yet

    act(() => vi.advanceTimersByTime(1))
    expect(container.querySelectorAll('.mk-item')).toHaveLength(1)
    expect(container.textContent).not.toContain('a')

    unmount()
  })

  it('drops a removed item immediately when animate is off', () => {
    const { container, rerender, unmount } = render(
      createElement(
        MasonryGrid,
        { items: [{ id: 'a' }, { id: 'b' }], options: { columns: 1, gap: 0, minLaneSize: 200, animate: false } },
        (item: { id: string }) => item.id,
      ),
    )

    act(() =>
      rerender(
        createElement(
          MasonryGrid,
          { items: [{ id: 'b' }], options: { columns: 1, gap: 0, minLaneSize: 200, animate: false } },
          (item: { id: string }) => item.id,
        ),
      ),
    )

    expect(container.querySelectorAll('.mk-item')).toHaveLength(1)
    expect(container.textContent).not.toContain('a')

    unmount()
  })

  it('re-adding the same id while it is still leaving renders the fresh item, not a stale duplicate', () => {
    const options = { columns: 1, gap: 0, minLaneSize: 200, transitionDuration: 300 }
    const { container, rerender, unmount } = render(
      createElement(MasonryGrid, { items: [{ id: 'a' }, { id: 'b' }], options }, (item: { id: string }) => item.id),
    )

    act(() =>
      rerender(createElement(MasonryGrid, { items: [{ id: 'b' }], options }, (item: { id: string }) => item.id)),
    ) // 'a' starts leaving
    act(() =>
      rerender(
        createElement(MasonryGrid, { items: [{ id: 'b' }, { id: 'a' }], options }, (item: { id: string }) => item.id),
      ),
    ) // 'a' comes right back

    expect(container.querySelectorAll('.mk-item')).toHaveLength(2) // not 3 — no duplicate ghost

    act(() => vi.advanceTimersByTime(300))
    expect(container.querySelectorAll('.mk-item')).toHaveLength(2) // the real 'a' is still there after the old ghost's timer fires

    unmount()
  })
})
