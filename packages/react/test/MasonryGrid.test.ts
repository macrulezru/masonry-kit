import { createElement } from 'react'
import { act, render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MasonryGrid } from '../src/MasonryGrid'

describe('MasonryGrid', () => {
  it('renders one measured wrapper per item, running the real engine', async () => {
    const { container } = render(
      createElement(
        MasonryGrid,
        { items: [{ id: 'a' }, { id: 'b' }], options: { columns: 2, gap: 0, minLaneSize: 200 } },
        (item: { id: string }) => `Item ${item.id}`,
      ),
    )

    // The engine's own resize-watcher schedules its first relayout via rAF —
    // give it a tick before asserting on styles it applies.
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve))
    })

    const items = container.querySelectorAll('.mk-item')
    expect(items).toHaveLength(2)
    expect(container.querySelector('.mk-grid')?.textContent).toContain('Item a')
    expect(container.querySelector('.mk-grid')?.textContent).toContain('Item b')
    expect((items[0] as HTMLElement).style.position).toBe('absolute')
  })

  it('keeps core-applied container styles (position/height) after switching off the SSR fallback (§4.4)', async () => {
    const { container } = render(
      createElement(
        MasonryGrid,
        { items: [{ id: 'a' }, { id: 'b' }], options: { columns: 2, gap: 0, minLaneSize: 200 } },
        (item: { id: string }) => item.id,
      ),
    )
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve))
    })

    const grid = container.querySelector('.mk-grid') as HTMLElement
    expect(grid.style.position).toBe('relative')
    expect(grid.style.height).not.toBe('')
  })
})
