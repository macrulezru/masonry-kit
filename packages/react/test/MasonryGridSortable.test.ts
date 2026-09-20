import { createElement, useMemo, useState } from 'react'
import { act, fireEvent, render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MasonryGrid, type MasonryGridItem } from '../src/MasonryGrid'

/** A host that owns `items` reactively and wires `onReorder` back to it — exactly what a real consumer does. */
function mountSortable(items: MasonryGridItem[], options: Record<string, unknown> = {}) {
  let currentItems = items
  let setItemsState!: (next: MasonryGridItem[]) => void

  function Host() {
    const [itemsState, setState] = useState(items)
    currentItems = itemsState
    setItemsState = setState
    const mergedOptions = useMemo(() => ({ columns: 1, gap: 0, minLaneSize: 200, ...options }), [])
    return createElement(
      MasonryGrid,
      {
        items: itemsState,
        options: mergedOptions,
        sortable: true,
        onReorder: (next: MasonryGridItem[]) => setState(next),
      },
      (item: MasonryGridItem) => item.id,
    )
  }

  const utils = render(createElement(Host))
  return { ...utils, getItems: () => currentItems, setItems: (next: MasonryGridItem[]) => setItemsState(next) }
}

describe('MasonryGrid — sortable (keyboard)', () => {
  it('picks up, moves, and drops via space/arrow-keys/space, updating aria-pressed and emitting reorder', () => {
    const { container, getItems, unmount } = mountSortable([{ id: 'a' }, { id: 'b' }, { id: 'c' }])

    const first = () => container.querySelectorAll('.mk-item')[0]!
    expect(first().getAttribute('tabindex')).toBe('0')
    expect(first().getAttribute('role')).toBe('button')
    expect(first().getAttribute('aria-pressed')).toBe('false')

    act(() => fireEvent.keyDown(first(), { key: ' ' })) // pick up 'a'
    expect(first().getAttribute('aria-pressed')).toBe('true')

    act(() => fireEvent.keyDown(first(), { key: 'ArrowDown' })) // swap with 'b'
    expect(getItems().map((i) => i.id)).toEqual(['b', 'a', 'c'])

    act(() => fireEvent.keyDown(first(), { key: ' ' })) // drop — 'a' is still the same DOM node (keyed by id), now first in the list
    expect(first().getAttribute('aria-pressed')).toBe('false')

    unmount()
  })

  it('cancels with Escape, reverting to the order at pick-up time', () => {
    const { container, getItems, unmount } = mountSortable([{ id: 'a' }, { id: 'b' }, { id: 'c' }])

    // Keyed by id, so 'a' keeps the same DOM node (and so real focus) even
    // once the swap below moves it to a different position in the list —
    // re-querying by position here would land on 'b' instead after the move.
    const findA = () => [...container.querySelectorAll('.mk-item')].find((el) => el.textContent === 'a')!
    act(() => fireEvent.keyDown(findA(), { key: ' ' }))
    act(() => fireEvent.keyDown(findA(), { key: 'ArrowDown' }))
    expect(getItems().map((i) => i.id)).toEqual(['b', 'a', 'c'])

    act(() => fireEvent.keyDown(findA(), { key: 'Escape' }))
    expect(getItems().map((i) => i.id)).toEqual(['a', 'b', 'c'])

    unmount()
  })

  it('does nothing on arrow keys when the item is not picked up, and does not respond at all when sortable is off', () => {
    let currentItems: MasonryGridItem[] = [{ id: 'a' }, { id: 'b' }]

    function Host() {
      const [itemsState, setState] = useState<MasonryGridItem[]>(currentItems)
      currentItems = itemsState
      const options = useMemo(() => ({ columns: 1, gap: 0, minLaneSize: 200 }), [])
      return createElement(
        MasonryGrid,
        { items: itemsState, options, onReorder: (next: MasonryGridItem[]) => setState(next) },
        (item: MasonryGridItem) => item.id,
      )
    }

    const { container, unmount } = render(createElement(Host))

    const first = container.querySelectorAll('.mk-item')[0]!
    expect(first.getAttribute('tabindex')).toBeNull()
    expect(first.getAttribute('role')).toBeNull()
    act(() => fireEvent.keyDown(first, { key: ' ' }))
    act(() => fireEvent.keyDown(first, { key: 'ArrowDown' }))
    expect(currentItems.map((i) => i.id)).toEqual(['a', 'b']) // untouched — sortable is off

    unmount()
  })
})
