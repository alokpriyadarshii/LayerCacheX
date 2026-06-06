import promClient from 'prom-client'
import type { LayerCacheX } from 'layercachex'
import type { LayerCacheXPlugin } from 'layercachex/types'

import type { PrometheusPluginOptions } from './types.js'

export class PrometheusPlugin implements LayerCacheXPlugin {
  #metrics: {
    cacheGracedHits: promClient.Counter
    cacheHits: promClient.Counter
    cacheMisses: promClient.Counter
    cacheWrites: promClient.Counter
    cacheDeletes: promClient.Counter
    cacheClears: promClient.Counter
    busMessagesPublished: promClient.Counter
    busMessagesReceived: promClient.Counter
  } = {} as any

  constructor(protected options: PrometheusPluginOptions) {
    this.#createMetrics()
  }

  /**
   * Build the metric name based on the prefix option.
   */
  #buildMetricName(name: string) {
    return `${this.options.prefix ?? 'layercachex'}_${name}`
  }

  /**
   * Create the Prometheus metrics.
   */
  #createMetrics() {
    const registry = this.options.registry ?? promClient.register

    this.#metrics.cacheGracedHits = new promClient.Counter({
      name: this.#buildMetricName('graced_hits'),
      help: 'Number of cache graced hits',
      labelNames: ['store', 'key', 'layer'],
      registers: [registry],
    })

    this.#metrics.cacheHits = new promClient.Counter({
      name: this.#buildMetricName('hits'),
      help: 'Number of cache hits',
      labelNames: ['store', 'key', 'layer'],
      registers: [registry],
    })

    this.#metrics.cacheMisses = new promClient.Counter({
      name: this.#buildMetricName('misses'),
      help: 'Number of cache misses',
      labelNames: ['store', 'key'],
      registers: [registry],
    })

    this.#metrics.cacheWrites = new promClient.Counter({
      name: this.#buildMetricName('writes'),
      help: 'Number of cache writes',
      labelNames: ['store', 'key'],
      registers: [registry],
    })

    this.#metrics.cacheDeletes = new promClient.Counter({
      name: this.#buildMetricName('deletes'),
      help: 'Number of cache deletes',
      labelNames: ['store', 'key'],
      registers: [registry],
    })

    this.#metrics.cacheClears = new promClient.Counter({
      name: this.#buildMetricName('clears'),
      help: 'Number of cache clears',
      labelNames: ['store'],
      registers: [registry],
    })

    this.#metrics.busMessagesPublished = new promClient.Counter({
      name: this.#buildMetricName('bus_messages_published'),
      help: 'Number of bus messages published',
      registers: [registry],
    })

    this.#metrics.busMessagesReceived = new promClient.Counter({
      name: this.#buildMetricName('bus_messages_received'),
      help: 'Number of bus messages received',
      registers: [registry],
    })
  }

  /**
   * Get the key label that will be used for the metrics
   * based on the keyGroups defined in the options.
   */
  #getKeyLabel(key: string) {
    for (const [regex, group] of this.options.keyGroups ?? []) {
      if (!regex.test(key)) continue

      if (typeof group === 'string') return group
      return group(regex.exec(key)!)
    }

    return key
  }

  /**
   * Register plugin. Will be called by LayerCacheX itself.
   *
   * We use this to collect events from LayerCacheX and
   * increment the metrics based on that.
   */
  register(layercachex: LayerCacheX<any>) {
    layercachex.on('cache:hit', (event) => {
      const key = this.#getKeyLabel(event.key)

      if (event.graced) {
        this.#metrics.cacheGracedHits.inc({ store: event.store, layer: event.layer, key })
      } else {
        this.#metrics.cacheHits.inc({ store: event.store, layer: event.layer, key })
      }
    })

    layercachex.on('cache:miss', async (event) => {
      const key = this.#getKeyLabel(event.key)
      this.#metrics.cacheMisses.inc({ store: event.store, key })
    })
    layercachex.on('cache:written', (event) => {
      const key = this.#getKeyLabel(event.key)
      this.#metrics.cacheWrites.inc({ store: event.store, key })
    })
    layercachex.on('cache:deleted', (event) => {
      const key = this.#getKeyLabel(event.key)
      this.#metrics.cacheDeletes.inc({ store: event.store, key })
    })
    layercachex.on('cache:cleared', (event) => {
      this.#metrics.cacheClears.inc({ store: event.store })
    })

    layercachex.on('bus:message:published', () => this.#metrics.busMessagesPublished.inc())
    layercachex.on('bus:message:received', () => this.#metrics.busMessagesReceived.inc())
  }
}
