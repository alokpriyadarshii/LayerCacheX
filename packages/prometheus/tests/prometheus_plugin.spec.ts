import { test } from '@japa/runner'
import { Registry, register } from 'prom-client'
import { LayerCacheX, layerstore } from 'layercachex'
import { memoryDriver } from 'layercachex/drivers/memory'

import { prometheusPlugin } from '../index.js'
import type { PrometheusPluginOptions } from '../src/types.js'

function sleep(duration: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, duration))
}

function createCache(promOptions?: PrometheusPluginOptions) {
  const registry = new Registry()
  const layerCacheX = new LayerCacheX({
    default: 'memory',
    stores: { memory: layerstore().useL1Layer(memoryDriver()) },
    plugins: [prometheusPlugin({ registry, ...promOptions })],
  })

  return { layerCacheX, registry }
}

test.group('Prometheus Plugin', () => {
  test('add metrics to specified registry', async ({ assert }) => {
    const { registry } = createCache()
    const result = await registry.getMetricsAsJSON()
    const busMessageReceived = result.find(
      (metric) => metric.name === 'layercachex_bus_messages_received',
    )

    assert.isDefined(busMessageReceived)
    assert.isEmpty(await register.getMetricsAsJSON())
  })

  test('register hit/miss/write/deletes events', async ({ assert }) => {
    const { layerCacheX, registry } = createCache()

    await layerCacheX.get({ key: 'foo' })
    await layerCacheX.set({ key: 'foo', value: 'bar' })
    await layerCacheX.get({ key: 'foo' })
    await layerCacheX.delete({ key: 'foo' })

    const hits = await registry.getSingleMetric('layercachex_hits')?.get()
    const misses = await registry.getSingleMetric('layercachex_misses')?.get()
    const writes = await registry.getSingleMetric('layercachex_writes')?.get()
    const deletes = await registry.getSingleMetric('layercachex_deletes')?.get()

    assert.deepEqual(hits?.values.at(0), {
      value: 1,
      labels: { store: 'memory', key: 'foo', layer: 'l1' },
    })
    assert.deepEqual(misses?.values.at(0), { value: 1, labels: { store: 'memory', key: 'foo' } })
    assert.deepEqual(writes?.values.at(0), { value: 1, labels: { store: 'memory', key: 'foo' } })
    assert.deepEqual(deletes?.values.at(0), { value: 1, labels: { store: 'memory', key: 'foo' } })
  })

  test('register graced hits', async ({ assert }) => {
    const { layerCacheX, registry } = createCache()

    await layerCacheX.set({ key: 'foo', value: 'bar', ttl: 1, grace: '2h' })

    await sleep(400)

    await layerCacheX.getOrSet({
      key: 'foo',
      factory: () => {
        throw new Error('Factory error')
      },
      grace: '2h',
    })

    const hits = await registry.getSingleMetric('layercachex_hits')?.get()
    const gracedHits = await registry.getSingleMetric('layercachex_graced_hits')?.get()
    const misses = await registry.getSingleMetric('layercachex_misses')?.get()

    assert.isUndefined(hits?.values.at(0))
    assert.isUndefined(misses?.values.at(0))
    assert.deepEqual(gracedHits?.values.at(0), {
      value: 1,
      labels: { store: 'memory', key: 'foo', layer: 'l1' },
    })
  })

  test('group keys', async ({ assert }) => {
    const { layerCacheX, registry } = createCache({
      keyGroups: [
        [/^users:(\d+)$/, `users:*`],
        [/^posts:(\d+)$/, 'posts:*'],
      ],
    })

    await layerCacheX.set({ key: 'posts:1', value: 'foo' })
    await layerCacheX.set({ key: 'posts:2', value: 'bar' })

    await layerCacheX.get({ key: 'users:1' })
    await layerCacheX.get({ key: 'users:2' })
    await layerCacheX.get({ key: 'posts:1' })
    await layerCacheX.get({ key: 'posts:2' })

    const hits = await registry.getSingleMetric('layercachex_hits')?.get()
    const misses = await registry.getSingleMetric('layercachex_misses')?.get()
    const writes = await registry.getSingleMetric('layercachex_writes')?.get()

    assert.deepEqual(misses?.values.at(0), {
      value: 2,
      labels: { store: 'memory', key: 'users:*' },
    })

    assert.deepEqual(hits?.values.at(0), {
      value: 2,
      labels: { store: 'memory', key: 'posts:*', layer: 'l1' },
    })

    assert.deepEqual(writes?.values.at(0), {
      value: 2,
      labels: { store: 'memory', key: 'posts:*' },
    })
  })
})
