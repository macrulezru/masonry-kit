import { describe, expect, it, vi } from 'vitest'

const setMasonryDefaults = vi.fn()

vi.mock('@macrulez/masonry-kit-vue', () => ({ setMasonryDefaults }))

function mockNuxtApp(publicConfig: unknown) {
  vi.doMock('nuxt/app', () => ({
    defineNuxtPlugin: (fn: () => void) => fn,
    useRuntimeConfig: () => ({ public: { masonry: publicConfig } }),
  }))
}

describe('masonry-kit-nuxt plugin (universal — server and client)', () => {
  it('applies direction/minLaneSize from runtimeConfig', async () => {
    vi.resetModules()
    setMasonryDefaults.mockClear()
    mockNuxtApp({ direction: 'horizontal', minLaneSize: 200 })

    const { default: plugin } = await import('../src/runtime/plugin')
    plugin()

    expect(setMasonryDefaults).toHaveBeenCalledWith({ direction: 'horizontal', minLaneSize: 200 })
  })

  it('skips setMasonryDefaults when the module was never configured', async () => {
    vi.resetModules()
    setMasonryDefaults.mockClear()
    mockNuxtApp(undefined)

    const { default: plugin } = await import('../src/runtime/plugin')
    plugin()

    expect(setMasonryDefaults).not.toHaveBeenCalled()
  })
})
