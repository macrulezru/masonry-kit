import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { MasonryGrid } from '../src/MasonryGrid'

describe('MasonryGrid', () => {
  it('renders one measured wrapper per item, running the real engine', async () => {
    const wrapper = mount(MasonryGrid, {
      props: { items: [{ id: 'a' }, { id: 'b' }], options: { columns: 2, gap: 0, minLaneSize: 200 } },
      slots: {
        item: ({ item }: { item: { id: string } }) => `Item ${item.id}`,
      },
      attachTo: document.body,
    })

    await nextTick()
    // The engine's own resize-watcher schedules its first relayout via rAF —
    // give it a tick before asserting on styles it applies.
    await new Promise((resolve) => requestAnimationFrame(resolve))

    const items = wrapper.findAll('.mk-item')
    expect(items).toHaveLength(2)
    expect(wrapper.find('.mk-grid').text()).toContain('Item a')
    expect(wrapper.find('.mk-grid').text()).toContain('Item b')
    expect((items[0]!.element as HTMLElement).style.position).toBe('absolute')

    wrapper.unmount()
  })

  it('keeps core-applied container styles (position/height) after switching off the SSR fallback (§4.4)', async () => {
    const wrapper = mount(MasonryGrid, {
      props: { items: [{ id: 'a' }, { id: 'b' }], options: { columns: 2, gap: 0, minLaneSize: 200 } },
      slots: { item: ({ item }: { item: { id: string } }) => item.id },
      attachTo: document.body,
    })
    await nextTick()
    await new Promise((resolve) => requestAnimationFrame(resolve))

    const grid = wrapper.find('.mk-grid').element as HTMLElement
    expect(grid.style.position).toBe('relative')
    expect(grid.style.height).not.toBe('')

    wrapper.unmount()
  })
})
