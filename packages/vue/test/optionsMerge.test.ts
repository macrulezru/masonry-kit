import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

const { createMasonryEngine } = vi.hoisted(() => ({
  createMasonryEngine: vi.fn(() => ({
    setItems: vi.fn(),
    on: vi.fn(() => () => {}),
    destroy: vi.fn(),
  })),
}))

vi.mock('@macrulez/masonry-kit-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@macrulez/masonry-kit-core')>()
  return { ...actual, createMasonryEngine }
})

const { MasonryGrid } = await import('../src/MasonryGrid')
const { setMasonryDefaults, masonryDefaults } = await import('../src/config')

afterEach(() => {
  createMasonryEngine.mockClear()
  for (const key of Object.keys(masonryDefaults)) delete (masonryDefaults as Record<string, unknown>)[key]
})

function mountOne(options?: Record<string, unknown>) {
  return mount(MasonryGrid, {
    props: { items: [{ id: 'a' }], ...(options ? { options } : {}) },
    slots: { item: () => 'A' },
    attachTo: document.body,
  })
}

describe('option merge order: props.options > masonryDefaults (Nuxt) > @macrulez/masonry-kit-core default', () => {
  it('passes direction/columns through as undefined when nothing overrides them, so core applies its own default', async () => {
    const wrapper = mountOne()
    await wrapper.vm.$nextTick()

    const [, options] = createMasonryEngine.mock.calls[0]!
    expect(options.direction).toBeUndefined()
    expect(options.columns).toBeUndefined()

    wrapper.unmount()
  })

  it('applies a Nuxt-level default (set via setMasonryDefaults) when the component prop does not override it', async () => {
    setMasonryDefaults({ minLaneSize: 300 })
    const wrapper = mountOne()
    await wrapper.vm.$nextTick()

    const [, options] = createMasonryEngine.mock.calls[0]!
    expect(options.minLaneSize).toBe(300)

    wrapper.unmount()
  })

  it('lets an explicit component-level option override the Nuxt-level default', async () => {
    setMasonryDefaults({ minLaneSize: 300 })
    const wrapper = mountOne({ minLaneSize: 180 })
    await wrapper.vm.$nextTick()

    const [, options] = createMasonryEngine.mock.calls[0]!
    expect(options.minLaneSize).toBe(180)

    wrapper.unmount()
  })

  it('forwards every option (not just direction/columns) straight through to core', async () => {
    const wrapper = mountOne({ direction: 'horizontal', gap: 24, placement: 'ordered' })
    await wrapper.vm.$nextTick()

    const [, options] = createMasonryEngine.mock.calls[0]!
    expect(options).toMatchObject({ direction: 'horizontal', gap: 24, placement: 'ordered' })

    wrapper.unmount()
  })
})
