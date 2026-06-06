import type { LayerCacheXPlugin } from 'layercachex/types'

import type { PrometheusPluginOptions } from './src/types.js'
import { PrometheusPlugin } from './src/prometheus_plugin.js'

/**
 * Prometheus Plugin for LayerCacheX
 */
export function prometheusPlugin(options: PrometheusPluginOptions = {}): LayerCacheXPlugin {
  return new PrometheusPlugin(options)
}
