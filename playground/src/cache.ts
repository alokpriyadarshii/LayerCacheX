import { pino } from 'pino'
import { LayerCacheX, layerstore } from 'layercachex'
import { redisDriver } from 'layercachex/drivers/redis'
import { memoryDriver } from 'layercachex/drivers/memory'
import { prometheusPlugin } from '@layercachex/plugin-prometheus'

export const layerCacheX = new LayerCacheX({
  default: 'memory',
  logger: pino({
    level: 'debug',
    transport: {
      target: 'pino-pretty',
      options: { colorize: true },
    },
  }),
  plugins: [prometheusPlugin()],
  stores: {
    memory: layerstore().useL1Layer(memoryDriver({})),

    redis: layerstore().useL2Layer(redisDriver({ connection: { host: 'localhost', port: 6379 } })),

    memoryAndRedis: layerstore()
      .useL1Layer(memoryDriver({}))
      .useL2Layer(redisDriver({ connection: { host: 'localhost', port: 6379 } })),
  },
})
