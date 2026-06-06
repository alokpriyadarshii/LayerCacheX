/**
 * Benchmark a single set operation on a tiered store ( memory + redis )
 */
import 'dotenv/config'

import Keyv from 'keyv'
import { Bench } from 'tinybench'
import KeyvRedis from '@keyv/redis'
import { createCache } from 'cache-manager'
import { CacheableMemory } from 'cacheable'
import { LayerCacheX, layerstore } from 'layercachex'
import { redisDriver } from 'layercachex/drivers/redis'
import { memoryDriver } from 'layercachex/drivers/memory'

import { REDIS_CREDENTIALS } from './helpers.js'

const bench = new Bench()

const layercachex = new LayerCacheX({
  default: 'tiered',
  stores: {
    tiered: layerstore()
      .useL1Layer(memoryDriver({}))
      .useL2Layer(redisDriver({ connection: REDIS_CREDENTIALS })),
  },
})

const layerCacheX = layercachex.use('tiered')

const cacheManager = createCache({
  stores: [
    new Keyv({
      store: new CacheableMemory({ ttl: 60_000, lruSize: 5000 }),
    }),

    new Keyv({
      store: new KeyvRedis('redis://localhost:6379'),
    }),
  ],
})

await layerCacheX.set({ key: 'key', value: 'value' })
await cacheManager.set('key', 'value')

bench
  .add('LayerCacheX', async () => {
    await layerCacheX.set({ key: 'key', value: 10 })
  })
  .add('CacheManager', async () => {
    await cacheManager.set('key', 10)
  })

await bench.run()
console.table(bench.table())

await Promise.all([layercachex.disconnectAll(), cacheManager.disconnect()])
