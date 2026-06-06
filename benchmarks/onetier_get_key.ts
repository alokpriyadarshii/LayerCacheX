/**
 * Benchmark a single get operation on a redis store
 */
import 'dotenv/config'

import Keyv from 'keyv'
import { Redis } from 'ioredis'
import { Bench } from 'tinybench'
import KeyvRedis from '@keyv/redis'
import { createCache } from 'cache-manager'
import { LayerCacheX, layerstore } from 'layercachex'
import { redisDriver } from 'layercachex/drivers/redis'

import { REDIS_CREDENTIALS } from './helpers.js'

const bench = new Bench()

const layercachex = new LayerCacheX({
  default: 'redis',
  stores: {
    redis: layerstore().useL2Layer(redisDriver({ connection: REDIS_CREDENTIALS })),
  },
})

const keyv = new Keyv(new KeyvRedis('redis://localhost:6379'))
const cacheManager = await createCache({
  stores: [new Keyv(new KeyvRedis('redis://localhost:6379'))],
})

await keyv.set('key', 'value')
await layercachex.set({ key: 'key', value: 'value' })
await cacheManager.set('key', 'value')

const ioredis = new Redis()

bench
  .add('ioredis', async () => {
    await ioredis.get('key')
  })
  .add('LayerCacheX', async () => {
    await layercachex.get({ key: 'key' })
  })
  .add('Keyv', async () => {
    await keyv.get('key')
  })
  .add('CacheManager', async () => {
    await cacheManager.get('key')
  })

await bench.run()
console.table(bench.table())

await Promise.all([
  layercachex.disconnectAll(),
  ioredis.quit(),
  cacheManager.disconnect(),
  keyv.disconnect(),
])
