import EventEmitter from 'node:events'
import { ms } from './utils/string/ms.js'
import { noopLogger } from './utils/logger.js'

import { Logger } from './logger.js'
import { resolveTtl } from './helpers.js'
import type { FactoryError } from './errors.js'
import { JsonSerializer } from './serializers/json.js'
import type { CacheSerializer, Duration, Emitter, RawLayerCacheXOptions } from './types/main.js'

const defaultSerializer = new JsonSerializer()

/**
 * The default options to use throughout the library
 *
 * Some of them can be override on a per-cache basis
 * or on a per-operation basis
 */
export class LayerCacheXOptions {
  #options: RawLayerCacheXOptions

  /**
   * The default TTL for all caches
   *
   * @default 30m
   */
  ttl: Duration = ms.parse('30m')

  /**
   * Default prefix for all caches
   */
  prefix: string = 'layercachex'

  /**
   * The grace period options
   */
  grace: Duration | false = false
  graceBackoff: Duration = ms.parse('10s')

  /**
   * Whether to suppress L2 cache errors
   */
  suppressL2Errors?: boolean

  /**
   * The soft and hard timeouts for the factories
   */
  timeout: Duration = 0
  hardTimeout?: Duration = null

  /**
   * The logger used throughout the library
   */
  logger: Logger

  /**
   * The emitter used throughout the library
   */
  emitter: Emitter = new EventEmitter()

  /**
   * Serializer to use for the cache
   */
  serializer: CacheSerializer

  /**
   * Max time to wait for the lock to be acquired
   */
  lockTimeout?: Duration = null

  /**
   * Duration for the circuit breaker to stay open
   * if l2 cache fails
   */
  l2CircuitBreakerDuration: number | undefined

  /**
   * If the L1 cache should be serialized
   */
  serializeL1: boolean = true
  onFactoryError?: (error: FactoryError) => void
  internalOperationWrapper?: RawLayerCacheXOptions['internalOperationWrapper']

  constructor(options: RawLayerCacheXOptions) {
    this.#options = { ...this, ...options }

    this.prefix = this.#options.prefix!
    this.ttl = this.#options.ttl!
    this.timeout = this.#options.timeout ?? 0
    this.hardTimeout = this.#options.hardTimeout
    this.suppressL2Errors = this.#options.suppressL2Errors
    this.lockTimeout = this.#options.lockTimeout
    this.grace = this.#options.grace!
    this.graceBackoff = this.#options.graceBackoff!

    this.emitter = this.#options.emitter!
    this.serializer = this.#options.serializer ?? defaultSerializer
    this.l2CircuitBreakerDuration = resolveTtl(this.#options.l2CircuitBreakerDuration, null)

    this.logger = new Logger(this.#options.logger ?? noopLogger())
    this.onFactoryError = this.#options.onFactoryError
    this.internalOperationWrapper = this.#options.internalOperationWrapper
  }

  serializeL1Cache(shouldSerialize: boolean = true) {
    this.serializeL1 = shouldSerialize
    return this
  }

  cloneWith(options: RawLayerCacheXOptions) {
    const newOptions = { ...this.#options, ...options }
    return new LayerCacheXOptions(newOptions)
  }
}
