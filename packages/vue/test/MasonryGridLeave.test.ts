import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MasonryGrid } from '../src/MasonryGrid'

describe('MasonryGrid — leave animation (real engine)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps a removed item mounted through transitionDuration, then drops it', async () => {
    const items = [{ id: 'a' }, { id: 'b' }]
    const wrapper = mount(MasonryGrid, {
      props: { items, options: { columns: 1, gap: 0, minLaneSize: 200, transitionDuration: 300 } },
      slots: { item: ({ item }: { item: { id: string } }) => item.id },
      attachTo: document.body,
    })
    await nextTick()
    expect(wrapper.findAll('.mk-item')).toHaveLength(2)

    await wrapper.setProps({ items: [{ id: 'b' }] })
    await nextTick()

    // 'a' disappeared from `items` but is still mounted, fading out.
    expect(wrapper.findAll('.mk-item')).toHaveLength(2)
    expect(wrapper.text()).toContain('a')

    vi.advanceTimersByTime(299)
    await nextTick()
    expect(wrapper.findAll('.mk-item')).toHaveLength(2) // not quite yet

    vi.advanceTimersByTime(1)
    await nextTick()
    expect(wrapper.findAll('.mk-item')).toHaveLength(1)
    expect(wrapper.text()).not.toContain('a')

    wrapper.unmount()
  })

  it('drops a removed item immediately when animate is off', async () => {
    const items = [{ id: 'a' }, { id: 'b' }]
    const wrapper = mount(MasonryGrid, {
      props: { items, options: { columns: 1, gap: 0, minLaneSize: 200, animate: false } },
      slots: { item: ({ item }: { item: { id: string } }) => item.id },
      attachTo: document.body,
    })
    await nextTick()

    await wrapper.setProps({ items: [{ id: 'b' }] })
    await nextTick()

    expect(wrapper.findAll('.mk-item')).toHaveLength(1)
    expect(wrapper.text()).not.toContain('a')

    wrapper.unmount()
  })

  it('re-adding the same id while it is still leaving renders the fresh item, not a stale duplicate', async () => {
    const items = [{ id: 'a' }, { id: 'b' }]
    const wrapper = mount(MasonryGrid, {
      props: { items, options: { columns: 1, gap: 0, minLaneSize: 200, transitionDuration: 300 } },
      slots: { item: ({ item }: { item: { id: string } }) => item.id },
      attachTo: document.body,
    })
    await nextTick()

    await wrapper.setProps({ items: [{ id: 'b' }] }) // 'a' starts leaving
    await nextTick()
    await wrapper.setProps({ items: [{ id: 'b' }, { id: 'a' }] }) // 'a' comes right back
    await nextTick()

    expect(wrapper.findAll('.mk-item')).toHaveLength(2) // not 3 — no duplicate ghost

    vi.advanceTimersByTime(300)
    await nextTick()
    expect(wrapper.findAll('.mk-item')).toHaveLength(2) // the real 'a' is still there after the old ghost's timer fires

    wrapper.unmount()
  })
})
