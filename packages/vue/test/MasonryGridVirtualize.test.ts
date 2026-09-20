import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
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

describe('MasonryGrid — virtualize (mocked engine)', () => {
  it('renders nothing until the first layout event, instead of mounting every item and immediately discarding most of them', async () => {
    const items = Array.from({ length: 50 }, (_, i) => ({ id: `item-${i}` }))
    const wrapper = mount(MasonryGrid, {
      props: { items, options: { virtualize: true } },
      slots: { item: ({ item }: { item: { id: string } }) => item.id },
      attachTo: document.body,
    })
    await nextTick()

    expect(wrapper.findAll('.mk-item')).toHaveLength(0)
    // Every item is still sent to the engine (with `el: undefined`) so its
    // estimate participates in the very first, DOM-free relayout.
    expect(lastSetItemsCall()).toHaveLength(50)
    expect(lastSetItemsCall().every((d) => d.el === undefined)).toBe(true)

    wrapper.unmount()
  })

  it('renders a wrapper only for the ids the engine reports as visible', async () => {
    const items = Array.from({ length: 50 }, (_, i) => ({ id: `item-${i}` }))
    const wrapper = mount(MasonryGrid, {
      props: { items, options: { virtualize: true } },
      slots: { item: ({ item }: { item: { id: string } }) => item.id },
      attachTo: document.body,
    })
    await nextTick()

    layoutHandler()({ items: [], visibleIds: ['item-3', 'item-4'] })
    await nextTick()

    expect(wrapper.findAll('.mk-item')).toHaveLength(2)
    expect(wrapper.text()).toContain('item-3')
    expect(wrapper.text()).toContain('item-4')
    expect(wrapper.text()).not.toContain('item-0')

    wrapper.unmount()
  })

  it('resolves elements for the now-visible items on the next sync, keeping the rest as el: undefined', async () => {
    const items = Array.from({ length: 3 }, (_, i) => ({ id: `item-${i}` }))
    const wrapper = mount(MasonryGrid, {
      props: { items, options: { virtualize: true } },
      slots: { item: ({ item }: { item: { id: string } }) => item.id },
      attachTo: document.body,
    })
    await nextTick()

    layoutHandler()({ items: [], visibleIds: ['item-1'] })
    await nextTick()

    const call = lastSetItemsCall()
    expect(call.find((d) => d.id === 'item-1')!.el).toBeInstanceOf(HTMLElement)
    expect(call.find((d) => d.id === 'item-0')!.el).toBeUndefined()
    expect(call.find((d) => d.id === 'item-2')!.el).toBeUndefined()

    wrapper.unmount()
  })

  it('batches every item mounted in the same patch into a single setItems() call', async () => {
    const items = Array.from({ length: 50 }, (_, i) => ({ id: `item-${i}` }))
    const wrapper = mount(MasonryGrid, {
      props: { items, options: { virtualize: true } },
      slots: { item: ({ item }: { item: { id: string } }) => item.id },
      attachTo: document.body,
    })
    await nextTick()
    expect(engineMock.setItems.mock.calls).toHaveLength(1) // the initial, synchronous createEngine() sync

    layoutHandler()({ items: [], visibleIds: Array.from({ length: 10 }, (_, i) => `item-${i}`) })
    await nextTick()

    // 10 items mount in the same patch — their ref callbacks all fire
    // synchronously, but must collapse into exactly one more setItems() call,
    // not ten (each one individually triggers a full, if cheap, relayout).
    expect(engineMock.setItems.mock.calls).toHaveLength(2)
    expect(lastSetItemsCall().filter((d) => d.el instanceof HTMLElement)).toHaveLength(10)

    wrapper.unmount()
  })

  it('does not re-sync when the reported visible set has the same ids as before (order aside)', async () => {
    const items = Array.from({ length: 5 }, (_, i) => ({ id: `item-${i}` }))
    const wrapper = mount(MasonryGrid, {
      props: { items, options: { virtualize: true } },
      slots: { item: ({ item }: { item: { id: string } }) => item.id },
      attachTo: document.body,
    })
    await nextTick()

    layoutHandler()({ items: [], visibleIds: ['item-1', 'item-2'] })
    await nextTick()
    const callsAfterFirst = engineMock.setItems.mock.calls.length

    // A fresh `Set` with the same members in a different order — a naive
    // `shallowRef` reassignment would still count as "changed" by reference
    // and re-render for nothing.
    layoutHandler()({ items: [], visibleIds: ['item-2', 'item-1'] })
    await nextTick()

    expect(engineMock.setItems.mock.calls).toHaveLength(callsAfterFirst)

    wrapper.unmount()
  })

  it('drops a never-visible item immediately on removal — nothing was ever mounted to animate', async () => {
    const items = [{ id: 'item-0' }, { id: 'item-1' }]
    const wrapper = mount(MasonryGrid, {
      props: { items, options: { virtualize: true } },
      slots: { item: ({ item }: { item: { id: string } }) => item.id },
      attachTo: document.body,
    })
    await nextTick()
    // item-0 never becomes visible in this test — nothing ever mounts a wrapper for it.
    layoutHandler()({ items: [], visibleIds: ['item-1'] })
    await nextTick()
    expect(wrapper.findAll('.mk-item')).toHaveLength(1)

    await wrapper.setProps({ items: [{ id: 'item-1' }] }) // item-0 removed from props.items
    await nextTick()

    expect(wrapper.findAll('.mk-item')).toHaveLength(1) // no leave-ghost for item-0 — it had no element to animate

    wrapper.unmount()
  })

  it('renders every item unconditionally when virtualize is off, regardless of getVisibleIds', async () => {
    const items = [{ id: 'a' }, { id: 'b' }]
    const wrapper = mount(MasonryGrid, {
      props: { items },
      slots: { item: ({ item }: { item: { id: string } }) => item.id },
      attachTo: document.body,
    })
    await nextTick()

    expect(wrapper.findAll('.mk-item')).toHaveLength(2)

    // Even if a 'layout' event somehow reported a narrower visible set, it's ignored.
    layoutHandler()({ items: [], visibleIds: ['a'] })
    await nextTick()
    expect(wrapper.findAll('.mk-item')).toHaveLength(2)

    wrapper.unmount()
  })
})
