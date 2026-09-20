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
  engineMock.destroy.mockClear()
})

function fireLayout() {
  const layoutHandler = engineMock.on.mock.calls.find(([event]) => event === 'layout')![1]
  layoutHandler({ items: [], visibleIds: [] })
}

describe('MasonryGrid — SSR CSS-columns fallback (§4.4)', () => {
  it('renders the CSS columns approximation before the engine has ever laid out — conservative default of 2 columns/16px gap', async () => {
    const wrapper = mount(MasonryGrid, {
      props: { items: [{ id: 'a' }, { id: 'b' }] },
      slots: { item: ({ item }: { item: { id: string } }) => item.id },
      attachTo: document.body,
    })
    await nextTick()

    const grid = wrapper.get('.mk-grid')
    expect(grid.attributes('style')).toContain('columns: 2')
    expect(grid.attributes('style')).toContain('column-gap: 16px')

    const item = wrapper.get('.mk-item')
    expect(item.attributes('style')).toContain('break-inside: avoid')
    expect(item.attributes('style')).toContain('margin-bottom: 16px')

    wrapper.unmount()
  })

  it('an explicit ssrColumns wins over columns/rows', async () => {
    const wrapper = mount(MasonryGrid, {
      props: { items: [{ id: 'a' }], options: { columns: 5, ssrColumns: 3, gap: 10 } },
      slots: { item: () => 'A' },
      attachTo: document.body,
    })
    await nextTick()

    const grid = wrapper.get('.mk-grid')
    expect(grid.attributes('style')).toContain('columns: 3')
    expect(grid.attributes('style')).toContain('column-gap: 10px')

    wrapper.unmount()
  })

  it('reuses a concrete columns/rows value (no explicit ssrColumns needed) — rows when direction is horizontal', async () => {
    const wrapper = mount(MasonryGrid, {
      props: { items: [{ id: 'a' }], options: { direction: 'horizontal', rows: 4, columns: 7 } },
      slots: { item: () => 'A' },
      attachTo: document.body,
    })
    await nextTick()

    expect(wrapper.get('.mk-grid').attributes('style')).toContain('columns: 4')

    wrapper.unmount()
  })

  it("falls back to 2 columns for columns: 'auto', since the container's real width isn't known pre-hydration", async () => {
    const wrapper = mount(MasonryGrid, {
      props: { items: [{ id: 'a' }], options: { columns: 'auto', minLaneSize: 240 } },
      slots: { item: () => 'A' },
      attachTo: document.body,
    })
    await nextTick()

    expect(wrapper.get('.mk-grid').attributes('style')).toContain('columns: 2')

    wrapper.unmount()
  })

  it('switches to the real transform-based layout the moment the engine reports its first layout, in the same tick as that reactive flush', async () => {
    const wrapper = mount(MasonryGrid, {
      props: { items: [{ id: 'a' }] },
      slots: { item: () => 'A' },
      attachTo: document.body,
    })
    await nextTick()
    expect(wrapper.get('.mk-grid').attributes('style')).toContain('columns')

    fireLayout()
    await nextTick()

    expect(wrapper.get('.mk-grid').attributes('style')).toBeFalsy()
    expect(wrapper.get('.mk-item').attributes('style') ?? '').not.toContain('break-inside')

    wrapper.unmount()
  })
})
