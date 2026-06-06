import { layerstore } from '../src/layer_store.js'
import { LayerCacheX } from '../src/layer_cache_x.js'
import { memoryDriver } from '../src/drivers/memory.js'
import type { RawLayerCacheXOptions } from '../src/types/main.js'

/**
 * A factory that creates a new LayerCacheX instance
 * Handy for quickly creating a new instance in a test
 */
export class LayerCacheXFactory {
  #parameters: RawLayerCacheXOptions = {}

  /**
   * Assign custom parameters to the final instance
   */
  merge(parameters: RawLayerCacheXOptions) {
    Object.assign(this.#parameters, parameters)
    return this
  }

  /**
   * Create a new instance of LayerCacheX
   */
  create() {
    const layerCacheX = new LayerCacheX({
      default: 'primary',
      ttl: '30s',
      stores: {
        primary: layerstore().useL1Layer(memoryDriver({ maxItems: 100 })),
        secondary: layerstore().useL1Layer(memoryDriver({ maxItems: 100 })),
      },
      ...this.#parameters,
    })

    return { layerCacheX }
  }
}
