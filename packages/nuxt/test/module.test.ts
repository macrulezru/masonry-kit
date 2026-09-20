import { beforeEach, describe, expect, it, vi } from 'vitest'

const addImports = vi.fn()
const addPlugin = vi.fn()
const addComponent = vi.fn()

vi.mock('@nuxt/kit', () => ({
  createResolver: () => ({ resolve: (p: string) => `/resolved${p.replace(/^\./, '')}` }),
  addImports,
  addPlugin,
  addComponent,
  defineNuxtModule: <T extends Record<string, unknown>>(definition: {
    defaults: T
    setup: (options: T, nuxt: unknown) => void
  }) => {
    return (inlineOptions: Partial<T>, nuxt: unknown) => {
      const options = { ...definition.defaults, ...inlineOptions }
      return definition.setup(options, nuxt)
    }
  },
}))

function createMockNuxt() {
  return {
    options: {
      runtimeConfig: {
        public: {} as Record<string, unknown>,
      },
    },
  }
}

describe('@macrulez/masonry-kit-nuxt module', () => {
  beforeEach(() => {
    addImports.mockClear()
    addPlugin.mockClear()
    addComponent.mockClear()
  })

  it('registers <MasonryGrid> as a global component', async () => {
    const { default: masonryKitModule } = await import('../src/module')
    const nuxt = createMockNuxt()

    // @ts-expect-error the mocked defineNuxtModule returns a plain callable, matching the runtime shape
    masonryKitModule({}, nuxt)

    expect(addComponent).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'MasonryGrid', filePath: '@macrulez/masonry-kit-vue' }),
    )
  })

  it('auto-imports useMasonry from @macrulez/masonry-kit-vue', async () => {
    const { default: masonryKitModule } = await import('../src/module')
    const nuxt = createMockNuxt()

    // @ts-expect-error see above
    masonryKitModule({}, nuxt)

    expect(addImports).toHaveBeenCalledWith({ name: 'useMasonry', from: '@macrulez/masonry-kit-vue' })
  })

  it('registers the universal (server + client) plugin', async () => {
    const { default: masonryKitModule } = await import('../src/module')
    const nuxt = createMockNuxt()

    // @ts-expect-error see above
    masonryKitModule({}, nuxt)

    expect(addPlugin).toHaveBeenCalledWith('/resolved/runtime/plugin')
  })

  it('forwards only the module options the user actually set, leaving the rest undefined', async () => {
    const { default: masonryKitModule } = await import('../src/module')
    const nuxt = createMockNuxt()

    // @ts-expect-error see above
    masonryKitModule({ minLaneSize: 200 }, nuxt)

    // No `direction` here: leaving it `undefined` (not defaulting it to
    // 'vertical' in this module) is what lets @macrulez/masonry-kit-core's
    // own default take effect — a hardcoded default here would silently
    // shadow core's and never let it be reached.
    expect(nuxt.options.runtimeConfig.public.masonry).toEqual({
      direction: undefined,
      columns: undefined,
      rows: undefined,
      minLaneSize: 200,
      gap: undefined,
      placement: undefined,
      animate: undefined,
      transitionDuration: undefined,
      transitionEasing: undefined,
      ssrColumns: undefined,
    })
  })

  it('forwards animate/transitionDuration/transitionEasing under their own names', async () => {
    const { default: masonryKitModule } = await import('../src/module')
    const nuxt = createMockNuxt()

    // @ts-expect-error see above
    masonryKitModule({ animate: false, transitionDuration: 400, transitionEasing: 'ease-out' }, nuxt)

    expect(nuxt.options.runtimeConfig.public.masonry).toMatchObject({
      animate: false,
      transitionDuration: 400,
      transitionEasing: 'ease-out',
    })
  })

  it('forwards ssrColumns under its own name', async () => {
    const { default: masonryKitModule } = await import('../src/module')
    const nuxt = createMockNuxt()

    // @ts-expect-error see above
    masonryKitModule({ ssrColumns: 3 }, nuxt)

    expect(nuxt.options.runtimeConfig.public.masonry).toMatchObject({ ssrColumns: 3 })
  })

  it('forwards direction/columns/gap/placement under their own names', async () => {
    const { default: masonryKitModule } = await import('../src/module')
    const nuxt = createMockNuxt()

    // @ts-expect-error see above
    masonryKitModule({ direction: 'horizontal', columns: 3, gap: 24, placement: 'ordered' }, nuxt)

    expect(nuxt.options.runtimeConfig.public.masonry).toMatchObject({
      direction: 'horizontal',
      columns: 3,
      gap: 24,
      placement: 'ordered',
    })
  })
})
