/**
 * Benchmark a single get operation on a tiered store ( memory + redis )
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
    new Keyv({ store: new CacheableMemory() }),
    new Keyv({ store: new KeyvRedis('redis://localhost:6379') }),
  ],
})

await layerCacheX.set({ key: 'layerCacheX:key', value: 'value', ttl: '10s' })
await cacheManager.set('cm:key', 'value', 10_000)

bench
  .add('LayerCacheX', async () => {
    await layerCacheX.get({ key: 'layerCacheX:key' })
  })
  .add('CacheManager', async () => {
    await cacheManager.get('cm:key')
  })

await bench.run()
console.table(bench.table())

await Promise.all([layercachex.disconnectAll(), cacheManager.disconnect()])
