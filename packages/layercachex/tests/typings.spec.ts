import { test } from '@japa/runner'

import { layerstore } from '../src/layer_store.js'
import { LayerCacheX } from '../src/layer_cache_x.js'
import { memoryDriver } from '../src/drivers/memory.js'
import type { Duration } from '../src/types/helpers.js'
import type { CacheEvents } from '../src/types/events.js'
import { CacheFactory } from '../factories/cache_factory.js'
import { LayerCacheXFactory } from '../factories/layercachex_factory.js'

test.group('Typings', () => {
  test('named caches typings', async ({ expectTypeOf }) => {
    const layerCacheX = new LayerCacheX({
      default: 'primary',
      stores: {
        primary: layerstore().useL1Layer(memoryDriver({ maxItems: 100 })),
        secondary: layerstore().useL1Layer(memoryDriver({ maxItems: 100 })),
      },
    })

    expectTypeOf(layerCacheX.use).parameter(0).toEqualTypeOf<'primary' | 'secondary' | undefined>()
  })

  test('get() typings on cache', async ({ expectTypeOf }) => {
    const { cache } = new CacheFactory().create()

    const r1 = await cache.get<string>({ key: 'key' })
    const r2 = await cache.get({ key: 'key', defaultValue: 'hey' })
    const r3 = await cache.get({ key: 'key', defaultValue: () => 'hey' })
    const r4 = await cache.get({ key: 'key', defaultValue: () => 10 })
    const r5 = await cache.get({ key: 'key', defaultValue: () => ({ foo: 'bar' }) })
    const r6 = await cache.get({ key: 'key', defaultValue: { bar: 'foo' } })
    const r7 = await cache.get({ key: 'key' })

    expectTypeOf(r1).toEqualTypeOf<string>()
    expectTypeOf(r2).toEqualTypeOf<string>()
    expectTypeOf(r3).toEqualTypeOf<string>()
    expectTypeOf(r4).toEqualTypeOf<number>()
    expectTypeOf(r5).toEqualTypeOf<{ foo: string }>()
    expectTypeOf(r6).toEqualTypeOf<{ bar: string }>()
    expectTypeOf(r7).toEqualTypeOf<any>()
  })

  test('get() typings on layerCacheX', async ({ expectTypeOf }) => {
    const { layerCacheX } = new LayerCacheXFactory().create()

    const r1 = await layerCacheX.get<string>({ key: 'key' })
    const r2 = await layerCacheX.get({ key: 'key', defaultValue: 'hey' })
    const r3 = await layerCacheX.get({ key: 'key', defaultValue: () => 'hey' })
    const r4 = await layerCacheX.get({ key: 'key', defaultValue: () => 10 })
    const r5 = await layerCacheX.get({ key: 'key', defaultValue: () => ({ foo: 'bar' }) })
    const r6 = await layerCacheX.get({ key: 'key', defaultValue: { bar: 'foo' } })
    const r7 = await layerCacheX.use('secondary').get({ key: 'key', defaultValue: { bar: 'foo' } })
    const r8 = await layerCacheX.get({ key: 'key' })

    expectTypeOf(r1).toEqualTypeOf<string>()
    expectTypeOf(r2).toEqualTypeOf<string>()
    expectTypeOf(r3).toEqualTypeOf<string>()
    expectTypeOf(r4).toEqualTypeOf<number>()
    expectTypeOf(r5).toEqualTypeOf<{ foo: string }>()
    expectTypeOf(r6).toEqualTypeOf<{ bar: string }>()
    expectTypeOf(r7).toEqualTypeOf<{ bar: string }>()
    expectTypeOf(r8).toEqualTypeOf<any>()
  })

  test('pull() typings on cache', async ({ expectTypeOf }) => {
    const { cache } = new CacheFactory().create()

    const r1 = await cache.pull<string>('key')
    const r2 = await cache.pull('key')

    expectTypeOf(r1).toEqualTypeOf<string | null | undefined>()
    expectTypeOf(r2).toEqualTypeOf<any>()
  })

  test('pull() typings on layerCacheX', async ({ expectTypeOf }) => {
    const { layerCacheX } = new LayerCacheXFactory().create()

    const r1 = await layerCacheX.pull<string>('key')
    const r2 = await layerCacheX.pull('key')

    expectTypeOf(r1).toEqualTypeOf<string | null | undefined>()
    expectTypeOf(r2).toEqualTypeOf<any>()
  })

  test('getOrSet() typings on cache', async ({ expectTypeOf }) => {
    const { cache } = new CacheFactory().create()

    const r1 = await cache.getOrSet<string>({ key: 'key', factory: () => 'hey' })
    const r2 = await cache.getOrSet({ key: 'key', factory: () => 32 })
    const r3 = await cache.getOrSet({ key: 'key', factory: () => 50_000 })
    const r4 = await cache.getOrSet({
      key: 'key',
      ttl: 1000,
      factory: () => 34,
    })

    expectTypeOf(r1).toEqualTypeOf<string>()
    expectTypeOf(r2).toEqualTypeOf<number>()
    expectTypeOf(r3).toEqualTypeOf<number>()
    expectTypeOf(r4).toEqualTypeOf<number>()
  })

  test('getOrSet() typings on layerCacheX', async ({ expectTypeOf }) => {
    const { layerCacheX } = new LayerCacheXFactory().create()

    const r1 = await layerCacheX.getOrSet<string>({ key: 'key', factory: () => 'hey' })
    const r2 = await layerCacheX.getOrSet({ key: 'key', factory: () => 32 })
    const r3 = await layerCacheX.getOrSet({ key: 'key', factory: () => 50_000 })
    const r4 = await layerCacheX.getOrSet({
      key: 'key',
      ttl: 1000,
      factory: () => 34,
    })

    expectTypeOf(r1).toEqualTypeOf<string>()
    expectTypeOf(r2).toEqualTypeOf<number>()
    expectTypeOf(r3).toEqualTypeOf<number>()
    expectTypeOf(r4).toEqualTypeOf<number>()
  })

  test('on() events list', async ({ expectTypeOf }) => {
    const { layerCacheX } = new LayerCacheXFactory().create()

    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    expectTypeOf(layerCacheX.on).parameter(0).toEqualTypeOf<keyof CacheEvents>

    layerCacheX.on('cache:cleared', (payload) => {
      expectTypeOf(payload).toEqualTypeOf<CacheEvents['cache:cleared']>()
    })
  })

  test('getOrSet() options parameters typings', async ({ expectTypeOf }) => {
    const { layerCacheX } = new LayerCacheXFactory().create()

    expectTypeOf(layerCacheX.getOrSet).parameter(0).exclude(undefined).toMatchTypeOf<{
      ttl?: Duration
      timeout?: Duration
      hardTimeout?: Duration
      grace?: false | Duration
      suppressL2Errors?: boolean
      lockTimeout?: Duration
    }>()
  })

  test('get() options parameters typings', async ({ expectTypeOf }) => {
    const { layerCacheX } = new LayerCacheXFactory().create()

    expectTypeOf(layerCacheX.get).parameter(0).exclude(undefined).not.toHaveProperty('lockTimeout')
    expectTypeOf(layerCacheX.get).parameter(0).exclude(undefined).not.toHaveProperty('timeout')
  })

  test('delete() options parameters typings', async ({ expectTypeOf }) => {
    const { layerCacheX } = new LayerCacheXFactory().create()

    expectTypeOf(layerCacheX.delete).parameter(0).exclude(undefined).not.toHaveProperty('lockTimeout')
    expectTypeOf(layerCacheX.delete).parameter(0).exclude(undefined).not.toHaveProperty('timeout')
    expectTypeOf(layerCacheX.delete).parameter(0).exclude(undefined).toHaveProperty('suppressL2Errors')
  })

  test('deleteMany() options parameters typings', async ({ expectTypeOf }) => {
    const { layerCacheX } = new LayerCacheXFactory().create()

    expectTypeOf(layerCacheX.deleteMany).parameter(0).exclude(undefined).not.toHaveProperty('lockTimeout')
    expectTypeOf(layerCacheX.deleteMany).parameter(0).exclude(undefined).not.toHaveProperty('timeout')
    expectTypeOf(layerCacheX.deleteMany)
      .parameter(0)
      .exclude(undefined)
      .toHaveProperty('suppressL2Errors')
  })

  test('set() options parameters typings', async ({ expectTypeOf }) => {
    const { layerCacheX } = new LayerCacheXFactory().create()

    expectTypeOf(layerCacheX.set).parameter(0).exclude(undefined).toMatchTypeOf<{
      ttl?: Duration
      timeout?: Duration
      hardTimeout?: Duration
      grace?: false | Duration
      suppressL2Errors?: boolean
      lockTimeout?: Duration
    }>()
  })

  test('setForever() options parameters typings', async ({ expectTypeOf }) => {
    const { layerCacheX } = new LayerCacheXFactory().create()

    expectTypeOf(layerCacheX.setForever).parameter(0).exclude(undefined).toMatchTypeOf<{
      ttl?: Duration
      timeout?: Duration
      hardTimeout?: Duration
      grace?: false | Duration
      suppressL2Errors?: boolean
      lockTimeout?: Duration
    }>()
  })

  test('stores entries should accept raw options', async ({ expectTypeOf }) => {
    expectTypeOf(layerstore).toBeCallableWith({ grace: '4h' })
  })

  test('cant pass ttl when using getOrSetForever', async () => {
    const { layerCacheX } = new LayerCacheXFactory().create()

    layerCacheX.getOrSetForever({
      key: 'foo',
      factory: () => 'bar',
      // @ts-expect-error - should not accept ttl
      ttl: 100,
    })

    // @ts-expect-error - should not accept ttl
    layerCacheX.getOrSetForever({ key: 'foo', factory: () => 'bar', ttl: '50ms' })
  })
})
