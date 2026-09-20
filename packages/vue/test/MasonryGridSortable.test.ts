import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { MasonryGrid, type MasonryGridItem } from '../src/MasonryGrid'

/** A host that owns `items` reactively and wires `@reorder` back to it — exactly what a real consumer does. */
function mountSortable(items: MasonryGridItem[], options: Record<string, unknown> = {}) {
  const itemsRef = ref(items)
  const mergedOptions = { columns: 1, gap: 0, minLaneSize: 200, ...options }
  const Host = defineComponent({
    setup() {
      return () =>
        h(
          MasonryGrid,
          {
            items: itemsRef.value,
            options: mergedOptions,
            sortable: true,
            onReorder: (next: MasonryGridItem[]) => {
              itemsRef.value = next
            },
          },
          { item: ({ item }: { item: MasonryGridItem }) => item.id },
        )
    },
  })
  const wrapper = mount(Host, { attachTo: document.body })
  return { wrapper, itemsRef }
}

describe('MasonryGrid — sortable (keyboard)', () => {
  it('picks up, moves, and drops via space/arrow-keys/space, updating aria-pressed and emitting reorder', async () => {
    const { wrapper, itemsRef } = mountSortable([{ id: 'a' }, { id: 'b' }, { id: 'c' }])
    await nextTick()

    const first = () => wrapper.findAll('.mk-item')[0]!
    expect(first().attributes('tabindex')).toBe('0')
    expect(first().attributes('role')).toBe('button')
    expect(first().attributes('aria-pressed')).toBe('false')

    await first().trigger('keydown', { key: ' ' }) // pick up 'a'
    expect(first().attributes('aria-pressed')).toBe('true')

    await first().trigger('keydown', { key: 'ArrowDown' }) // swap with 'b'
    expect(itemsRef.value.map((i) => i.id)).toEqual(['b', 'a', 'c'])

    await first().trigger('keydown', { key: ' ' }) // drop — 'a' is still the same DOM node (keyed by id), now first in the list
    expect(first().attributes('aria-pressed')).toBe('false')

    wrapper.unmount()
  })

  it('cancels with Escape, reverting to the order at pick-up time', async () => {
    const { wrapper, itemsRef } = mountSortable([{ id: 'a' }, { id: 'b' }, { id: 'c' }])
    await nextTick()

    // Keyed by id, so 'a' keeps the same DOM node (and so real focus) even
    // once the swap below moves it to a different position in the list —
    // re-querying by position here would land on 'b' instead after the move.
    const a = wrapper.findAll('.mk-item').find((w) => w.text() === 'a')!
    await a.trigger('keydown', { key: ' ' })
    await a.trigger('keydown', { key: 'ArrowDown' })
    expect(itemsRef.value.map((i) => i.id)).toEqual(['b', 'a', 'c'])

    await a.trigger('keydown', { key: 'Escape' })
    expect(itemsRef.value.map((i) => i.id)).toEqual(['a', 'b', 'c'])

    wrapper.unmount()
  })

  it('does nothing on arrow keys when the item is not picked up, and does not respond at all when sortable is off', async () => {
    const itemsRef = ref<MasonryGridItem[]>([{ id: 'a' }, { id: 'b' }])
    const options = { columns: 1, gap: 0, minLaneSize: 200 }
    const Host = defineComponent({
      setup() {
        return () =>
          h(
            MasonryGrid,
            {
              items: itemsRef.value,
              options,
              onReorder: (next: MasonryGridItem[]) => {
                itemsRef.value = next
              },
            },
            { item: ({ item }: { item: MasonryGridItem }) => item.id },
          )
      },
    })
    const wrapper = mount(Host, { attachTo: document.body })
    await nextTick()

    const first = wrapper.findAll('.mk-item')[0]!
    expect(first.attributes('tabindex')).toBeUndefined()
    expect(first.attributes('role')).toBeUndefined()
    await first.trigger('keydown', { key: ' ' })
    await first.trigger('keydown', { key: 'ArrowDown' })
    expect(itemsRef.value.map((i) => i.id)).toEqual(['a', 'b']) // untouched — sortable is off

    wrapper.unmount()
  })
})
