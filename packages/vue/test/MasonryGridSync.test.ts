import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

const { createMasonryEngine, engineMock } = vi.hoisted(() => {
  const engineMock = { setItems: vi.fn(), on: vi.fn(() => () => {}), destroy: vi.fn(), setDragging: vi.fn() }
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
    const show = ref(false)

    const Host = defineComponent({
      setup() {
        return () => h(MasonryGrid, { items: show.value ? [{ id: 'a' }] : [] }, { item: () => 'A' })
      },
    })

    const wrapper = mount(Host, { attachTo: document.body })
    await nextTick()
    expect(lastSetItemsCall()).toEqual([])

    show.value = true
    await nextTick()
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

    wrapper.unmount()
  })

  it('forwards colSpan/rowSpan/aspectRatio/order through to the item descriptor', async () => {
    const wrapper = mount(MasonryGrid, {
      props: { items: [{ id: 'a', colSpan: 2, rowSpan: 1, aspectRatio: 1.5, order: 3 }] },
      slots: { item: () => 'A' },
      attachTo: document.body,
    })
    await nextTick()

    expect(lastSetItemsCall()[0]).toMatchObject({ colSpan: 2, rowSpan: 1, aspectRatio: 1.5, order: 3 })

    wrapper.unmount()
  })

  it('recreates the engine when options changes, since core has no live updateOptions', async () => {
    const options = ref({ columns: 2 })

    const Host = defineComponent({
      setup() {
        return () => h(MasonryGrid, { items: [{ id: 'a' }], options: options.value }, { item: () => 'A' })
      },
    })

    const wrapper = mount(Host, { attachTo: document.body })
    await nextTick()
    expect(createMasonryEngine).toHaveBeenCalledTimes(1)
    expect(createMasonryEngine.mock.calls[0]![1]).toMatchObject({ columns: 2 })

    options.value = { columns: 4 }
    await nextTick()

    expect(engineMock.destroy).toHaveBeenCalledOnce()
    expect(createMasonryEngine).toHaveBeenCalledTimes(2)
    expect(createMasonryEngine.mock.calls[1]![1]).toMatchObject({ columns: 4 })
    // Items lost when the old engine was destroyed are re-synced onto the new one.
    expect(lastSetItemsCall()).toEqual([{ id: 'a', el: expect.any(HTMLElement) }])

    wrapper.unmount()
  })

  it('does NOT recreate the engine when a new options object has identical content', async () => {
    const items = ref([{ id: 'a' }])

    const Host = defineComponent({
      setup() {
        return () => h(MasonryGrid, { items: items.value, options: { columns: 2 } }, { item: () => 'A' })
      },
    })

    const wrapper = mount(Host, { attachTo: document.body })
    await nextTick()
    expect(createMasonryEngine).toHaveBeenCalledTimes(1)

    // Re-renders the Host (a new `options` object every time), without ever
    // changing `items`' actual content or `options`' actual content.
    items.value = [...items.value]
    await nextTick()
    items.value = [...items.value]
    await nextTick()

    expect(createMasonryEngine).toHaveBeenCalledTimes(1) // still just the one engine
    expect(engineMock.destroy).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it('forwards the engine layout event as its own layout emit', async () => {
    const wrapper = mount(MasonryGrid, {
      props: { items: [{ id: 'a' }] },
      slots: { item: () => 'A' },
      attachTo: document.body,
    })
    await nextTick()

    const layoutHandler = engineMock.on.mock.calls.find(([event]) => event === 'layout')![1]
    const items = [{ id: 'a', x: 0, y: 0, width: 100, height: 50 }]
    layoutHandler({ items })

    expect(wrapper.emitted('layout')).toEqual([[items]])

    wrapper.unmount()
  })

  it('does not re-sync when the component re-renders for an unrelated reason (e.g. the sortable live-region announcing a pickup)', async () => {
    const wrapper = mount(MasonryGrid, {
      props: { items: [{ id: 'a' }], sortable: true },
      slots: { item: ({ item }: { item: { id: string } }) => item.id },
      attachTo: document.body,
    })
    await nextTick()
    const callsAfterMount = engineMock.setItems.mock.calls.length

    // Space picks the item up, which calls `announce()` — a reactive
    // `liveMessage` update that re-renders the component, with `items`
    // itself never having changed.
    await wrapper.find('.mk-item').trigger('keydown', { key: ' ' })
    await nextTick()

    expect(engineMock.setItems.mock.calls).toHaveLength(callsAfterMount)

    wrapper.unmount()
  })
})
