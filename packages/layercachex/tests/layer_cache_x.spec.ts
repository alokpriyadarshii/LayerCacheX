import { Redis } from 'ioredis'
import { test } from '@japa/runner'

import { layerstore } from '../src/layer_store.js'
import { LayerCacheX } from '../src/layer_cache_x.js'
import { REDIS_CREDENTIALS } from './helpers/index.js'
import { memoryDriver } from '../src/drivers/memory.js'
import { redisBusDriver, redisDriver } from '../src/drivers/redis.js'
import { LayerCacheXFactory } from '../factories/layercachex_factory.js'

test.group('LayerCacheX', () => {
  test('Subscribe to an event', async ({ assert }) => {
    assert.plan(2)

    const { layerCacheX } = new LayerCacheXFactory().create()

    layerCacheX.on('cache:hit', (event) => {
      assert.equal(event.key, 'foo')
      assert.equal(event.value, 'bar')
    })

    await layerCacheX.set({ key: 'foo', value: 'bar' })
    await layerCacheX.get({ key: 'foo' })
  })

  test('Unsubscribe from an event', async ({ assert }) => {
    const { layerCacheX } = new LayerCacheXFactory().create()

    const listener = () => assert.fail()

    layerCacheX.on('cache:hit', listener)
    layerCacheX.off('cache:hit', listener)

    await layerCacheX.set({ key: 'foo', value: 'bar' })
    await layerCacheX.get({ key: 'foo' })
  })

  test('instances of cache should be cached and re-used', async ({ assert }) => {
    const layerCacheX = new LayerCacheX({
      default: 'memory',
      stores: {
        memory: layerstore().useL1Layer(memoryDriver({})),
        redis: layerstore().useL2Layer(redisDriver({ connection: REDIS_CREDENTIALS })),
      },
    })

    const memory = layerCacheX.use('memory')
    assert.equal(memory, layerCacheX.use('memory'))

    const redis = layerCacheX.use('redis')
    assert.equal(redis, layerCacheX.use('redis'))
    assert.equal(memory, layerCacheX.use('memory'))

    await layerCacheX.disconnectAll()
  })

  test('create store with multiple layers', async ({ assert, cleanup }) => {
    const layerCacheX = new LayerCacheX({
      default: 'memory',
      stores: {
        memory: layerstore().useL1Layer(memoryDriver({})),

        multi: layerstore()
          .useL1Layer(memoryDriver({}))
          .useL2Layer(redisDriver({ connection: REDIS_CREDENTIALS }))
          .useBus(redisBusDriver({ connection: REDIS_CREDENTIALS })),
      },
    })

    cleanup(() => layerCacheX.disconnectAll())

    await layerCacheX.use('multi').set({ key: 'foo', value: 'bar' })

    assert.equal(await layerCacheX.use('multi').get({ key: 'foo' }), 'bar')
  })

  test('use custom logger', async ({ assert, cleanup }) => {
    const logger = {
      loggedMessages: [] as any,
      child: () => logger,
      log: (level: string, message: any) => logger.loggedMessages.push({ level, message }),
      trace: (message: any) => logger.log('trace', message),
      debug: (message: any) => logger.log('debug', message),
    }

    // @ts-expect-error too lazy to implement the entire interface
    const { layerCacheX } = new LayerCacheXFactory().merge({ logger }).create()
    cleanup(() => layerCacheX.disconnectAll())

    assert.isAbove(logger.loggedMessages.length, 0)
  })

  test('use custom prefix per store', async ({ assert, cleanup }) => {
    const redis = new Redis(REDIS_CREDENTIALS)
    const layerCacheX = new LayerCacheX({
      default: 'a1',
      stores: {
        a1: layerstore().useL2Layer(redisDriver({ connection: REDIS_CREDENTIALS, prefix: 'one' })),
        a2: layerstore().useL2Layer(redisDriver({ connection: REDIS_CREDENTIALS, prefix: 'two' })),
      },
    })

    cleanup(async () => {
      redis.disconnect()
      await layerCacheX.disconnectAll()
    })

    await layerCacheX.use('a1').set({ key: 'foo', value: 'bar' })
    await layerCacheX.use('a2').set({ key: 'foo', value: 'baz' })

    assert.include(await redis.get('one:foo'), '"bar"')
    assert.include(await redis.get('two:foo'), '"baz"')
  })

  test('use default options', async ({ assert, cleanup }) => {
    const redis = new Redis(REDIS_CREDENTIALS)
    const layerCacheX = new LayerCacheX({
      default: 'a1',
      ttl: '12h',
      grace: '24h',
      stores: {
        a1: layerstore({ grace: '12h' }).useL2Layer(
          redisDriver({ connection: REDIS_CREDENTIALS, prefix: 'one' }),
        ),

        a2: layerstore().useL2Layer(redisDriver({ connection: REDIS_CREDENTIALS, prefix: 'two' })),
      },
    })

    cleanup(async () => {
      redis.disconnect()
      await layerCacheX.clearAll()
      await layerCacheX.disconnectAll()
    })

    await layerCacheX.use('a1').set({ key: 'foo', value: 'bar' })
    await layerCacheX.use('a2').set({ key: 'foo', value: 'baz' })

    const a1Ttl = await redis.ttl('one:foo')
    const a2Ttl = await redis.ttl('two:foo')

    // a1 physical TTL should include its 12h grace period
    assert.closeTo(a1Ttl, 24 * 60 * 60, 1)

    // a2 physical TTL should include the default 24h grace period
    assert.closeTo(a2Ttl, 36 * 60 * 60, 1)
  })

  test('use custom grace period per store', async ({ assert, cleanup }) => {
    const redis = new Redis(REDIS_CREDENTIALS)
    const layerCacheX = new LayerCacheX({
      default: 'a1',
      stores: {
        a1: layerstore({ grace: '6h' }).useL2Layer(
          redisDriver({ connection: REDIS_CREDENTIALS, prefix: 'one' }),
        ),
        a2: layerstore({ grace: '12h' }).useL2Layer(
          redisDriver({ connection: REDIS_CREDENTIALS, prefix: 'two' }),
        ),
      },
    })

    cleanup(async () => {
      redis.disconnect()
      await layerCacheX.clear()
      await layerCacheX.disconnectAll()
    })

    await layerCacheX.use('a1').set({ key: 'foo', value: 'bar' })
    await layerCacheX.use('a2').set({ key: 'foo', value: 'baz' })

    const a1Ttl = await redis.ttl('one:foo')
    const a2Ttl = await redis.ttl('two:foo')

    assert.isAbove(a1Ttl, 6 * 60 * 60 - 1)
    assert.isAbove(a2Ttl, 12 * 60 * 60 - 1)
  })

  test('able to register a plugin', async ({ assert }) => {
    assert.plan(2)

    new LayerCacheX({
      default: 'memory',
      stores: {
        memory: layerstore().useL1Layer(memoryDriver({})),
      },
      plugins: [
        {
          register(layercachex) {
            assert.instanceOf(layercachex, LayerCacheX)
            assert.isDefined(layercachex.use('memory'))
          },
        },
      ],
    })
  })

  test('able to register multiple plugins', async ({ assert }) => {
    assert.plan(4)

    new LayerCacheX({
      default: 'memory',
      stores: {
        memory: layerstore().useL1Layer(memoryDriver({})),
      },
      plugins: [
        {
          register(layercachex) {
            assert.instanceOf(layercachex, LayerCacheX)
            assert.isDefined(layercachex.use('memory'))
          },
        },
        {
          register(layercachex) {
            assert.instanceOf(layercachex, LayerCacheX)
            assert.isDefined(layercachex.use('memory'))
          },
        },
      ],
    })
  })

  test('should expose the default store name', async ({ assert }) => {
    const { layerCacheX } = new LayerCacheXFactory().create()

    assert.equal(layerCacheX.defaultStoreName, 'primary')
  })

  test('should not accept some options', async () => {
    const opts = {
      default: 'memory',
      stores: { memory: layerstore().useL1Layer(memoryDriver({})) },
    }

    new LayerCacheX({
      ...opts,
      // @ts-expect-error invalid option
      tags: ['foo'],
    })

    new LayerCacheX({
      ...opts,
      // @ts-expect-error invalid option
      skipBusNotify: true,
    })

    new LayerCacheX({
      ...opts,
      // @ts-expect-error invalid option
      skipL2Write: true,
    })
  })
})
