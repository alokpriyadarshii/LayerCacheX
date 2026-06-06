import 'dotenv/config'

import Keyv from 'keyv'
import { Bench } from 'tinybench'
import KeyvRedis from '@keyv/redis'
import { createCache } from 'cache-manager'
import { CacheableMemory } from 'cacheable'

import { getFromDb } from './helpers.js'
import { LayerCacheX } from '../packages/layercachex/src/layer_cache_x.js'
import { layerstore } from '../packages/layercachex/src/layer_store.js'
import { redisDriver } from '../packages/layercachex/src/drivers/redis.js'
import { memoryDriver } from '../packages/layercachex/src/drivers/memory.js'
import { REDIS_CREDENTIALS } from '../packages/layercachex/tests/helpers/index.js'

/**
 * Init providers
 */
const layercachex = new LayerCacheX({
  default: 'memory',
  stores: {
    memory: layerstore().useL1Layer(memoryDriver({ serialize: false })),
    redis: layerstore().useL2Layer(redisDriver({ connection: REDIS_CREDENTIALS })),
    tiered: layerstore()
      .useL1Layer(memoryDriver({ serialize: false }))
      .useL2Layer(redisDriver({ connection: REDIS_CREDENTIALS })),
  },
})

const layercachexMemory = layercachex.use('memory')
const layercachexRedis = layercachex.use('redis')
const layercachexTiered = layercachex.use('tiered')

const cacheManagerMemory = createCache({
  stores: [new Keyv({ store: new CacheableMemory() })],
})

const cacheManagerRedis = createCache({
  stores: [new Keyv({ store: new KeyvRedis('redis://localhost:6379') })],
})

const cacheManagerTiered = createCache({
  stores: [
    new Keyv({ store: new CacheableMemory() }),
    new Keyv({ store: new KeyvRedis('redis://localhost:6379') }),
  ],
})

/**
 * Benchmark
 */
const bench = new Bench()
await bench
  .add('L1 GetOrSet - LayerCacheX', () => {
    return layercachexMemory.getOrSet({
      key: 'layerCacheX:key',
      factory: () => getFromDb(),
      ttl: 100,
    })
  })
  .add('L1 GetOrSet - CacheManager', async () => {
    const result = await cacheManagerMemory.get('cm:key')
    if (result === null) {
      await cacheManagerMemory.set('cm:key', await getFromDb(), 100)
    }

    return result ?? 'value'
  })
  .add('L2 GetOrSet - LayerCacheX', () => {
    return layercachexRedis.getOrSet({
      key: 'layerCacheX:key',
      factory: () => getFromDb(),
      ttl: 100,
    })
  })
  .add('L2 GetOrSet - CacheManager', async () => {
    const result = await cacheManagerRedis.get('cm:key')
    if (result === null) {
      await cacheManagerRedis.set('cm:key', await getFromDb(), 100)
    }

    return result ?? 'value'
  })
  .add('Tiered GetOrSet - LayerCacheX', () => {
    return layercachexTiered.getOrSet({
      key: 'layerCacheX:key',
      factory: () => getFromDb(),
      ttl: 100,
    })
  })
  .add('Tiered GetOrSet - CacheManager', async () => {
    const result = await cacheManagerTiered.get('cm:key')
    if (result === null) {
      await cacheManagerTiered.set('cm:key', await getFromDb(), 100)
    }

    return result ?? 'value'
  })
  .add('Tiered Get - LayerCacheX', async () => {
    const result = await layercachexTiered.get({ key: 'layerCacheX:foo' })
    if (!result) await layercachexTiered.set({ key: 'layerCacheX:foo', value: 'value', ttl: '10s' })
  })
  .add('Tiered Get - CacheManager', async () => {
    const result = await cacheManagerTiered.get('cm:barbar')
    if (!result) await cacheManagerTiered.set('cm:barbar', 'value', 10_000)
  })
  .add('Tiered Set - LayerCacheX', async () => {
    await layercachexTiered.set({ key: 'key', value: 10 })
  })
  .add('Tiered Set - CacheManager', async () => {
    await cacheManagerTiered.set('key', 10)
  })
  .run()

console.table(bench.table())

await Promise.all([
  layercachex.disconnectAll(),
  cacheManagerMemory.disconnect(),
  cacheManagerRedis.disconnect(),
  cacheManagerTiered.disconnect(),
])
