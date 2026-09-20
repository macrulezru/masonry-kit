import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

const { createMasonryEngine, engineMock } = vi.hoisted(() => {
  const engineMock = { setItems: vi.fn(), on: vi.fn(() => () => {}), destroy: vi.fn() }
  return { createMasonryEngine: vi.fn(() => engineMock), engineMock }
})
vi.mock('@macrulez/masonry-kit-core', () => ({ createMasonryEngine }))

const { useMasonry } = await import('../src/useMasonry')

afterEach(() => {
  createMasonryEngine.mockClear()
  engineMock.setItems.mockClear()
  engineMock.destroy.mockClear()
})

function lastSetItemsCall() {
  return engineMock.setItems.mock.calls.at(-1)![0] as { id: string; el: unknown }[]
}

describe('useMasonry — ref-friendly item.el', () => {
  it('drops an item whose el ref has not resolved yet, then includes it once it does', async () => {
    const container = ref<HTMLElement | null>(null)
    const itemRef = ref<HTMLElement | null>(null)
    const show = ref(false)

    const Host = defineComponent({
      setup() {
        useMasonry(container, { items: [{ id: 'a', el: itemRef }] })
        return () => [h('div', { ref: container }), show.value ? h('div', { ref: itemRef }) : null]
      },
    })

    const wrapper = mount(Host, { attachTo: document.body })
    await nextTick()
    expect(lastSetItemsCall()).toEqual([])

    show.value = true
    await nextTick()
    expect(itemRef.value).toBeInstanceOf(HTMLElement)
    expect(lastSetItemsCall()).toEqual([{ id: 'a', el: itemRef.value }])

    wrapper.unmount()
  })

  it('passes masonryDefaults then options through to createMasonryEngine, and destroys the engine on unmount', async () => {
    const container = ref<HTMLElement | null>(null)

    const Host = defineComponent({
      setup() {
        useMasonry(container, { direction: 'horizontal' })
        return () => h('div', { ref: container })
      },
    })

    const wrapper = mount(Host, { attachTo: document.body })
    await nextTick()

    const [, options] = createMasonryEngine.mock.calls[0]!
    expect(options).toMatchObject({ direction: 'horizontal' })

    wrapper.unmount()
    expect(engineMock.destroy).toHaveBeenCalledOnce()
  })
})
