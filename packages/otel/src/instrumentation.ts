import { suppressTracing } from '@opentelemetry/core'
import type { Context, Span } from '@opentelemetry/api'
import type { CacheOperationMessage } from 'layercachex'
import type { TracingChannelSubscribers } from 'node:diagnostics_channel'
import { context, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api'
import {
  InstrumentationBase,
  InstrumentationNodeModuleDefinition,
} from '@opentelemetry/instrumentation'

import type {
  LayerCacheXInstrumentationConfig,
  LayerCacheXModuleExports,
  CacheOperationChannel,
} from './types.js'

const DEFAULT_CONFIG: Required<
  Pick<
    LayerCacheXInstrumentationConfig,
    'requireParentSpan' | 'includeKeys' | 'spanNamePrefix' | 'suppressInternalOperations'
  >
> = {
  requireParentSpan: true,
  includeKeys: false,
  spanNamePrefix: 'cache',
  suppressInternalOperations: true,
}

export class LayerCacheXInstrumentation extends InstrumentationBase<LayerCacheXInstrumentationConfig> {
  protected subscribed = false
  protected spans = new WeakMap<object, Span>()
  protected handlers?: TracingChannelSubscribers<CacheOperationMessage>

  /**
   * Tracks active getOrSet contexts so child operations (factory, set)
   * can be parented to the getOrSet span. Keyed by `store:key`.
   */
  #activeContexts = new Map<string, Context>()
  #cacheOperation?: CacheOperationChannel
  #originalLayerCacheX?: LayerCacheXModuleExports['LayerCacheX']

  /**
   * Resolves CJS and ESM exports to a stable module shape.
   */
  #getModuleExports(moduleExports: any): LayerCacheXModuleExports | undefined {
    if (!moduleExports) return

    if (moduleExports[Symbol.toStringTag] === 'Module') {
      return (moduleExports.default ?? moduleExports) as LayerCacheXModuleExports
    }

    return moduleExports as LayerCacheXModuleExports
  }

  /**
   * Replaces LayerCacheX constructor to inject instrumentation config wrappers.
   */
  #patchLayerCacheX(moduleExports: LayerCacheXModuleExports) {
    if (!moduleExports.LayerCacheX) return

    if (!this.#originalLayerCacheX) {
      this.#originalLayerCacheX = moduleExports.LayerCacheX
    }

    if (moduleExports.LayerCacheX !== this.#originalLayerCacheX) return

    const original = this.#originalLayerCacheX
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const instrumentation = this

    const LayerCacheXPatched = class LayerCacheXPatched extends original {
      /**
       * Wraps user config before delegating to the original LayerCacheX constructor.
       */
      constructor(config: any) {
        super(instrumentation.#patchConfig(config))
      }
    }

    Object.setPrototypeOf(LayerCacheXPatched, original)

    try {
      moduleExports.LayerCacheX = LayerCacheXPatched
    } catch {
      return
    }
  }

  /**
   * Restores the original LayerCacheX constructor when instrumentation is removed.
   */
  #unpatchLayerCacheX(moduleExports: LayerCacheXModuleExports) {
    if (!this.#originalLayerCacheX) return
    if (!moduleExports.LayerCacheX) return

    moduleExports.LayerCacheX = this.#originalLayerCacheX
  }

  /**
   * Adds internal operation suppression to LayerCacheX config when enabled.
   */
  #patchConfig(config: any) {
    if (!config || typeof config !== 'object') return config

    const instrumentationConfig = this.getConfig()
    if (instrumentationConfig.suppressInternalOperations !== true) return config

    const wrappedConfig = { ...config }
    const suppressWrapper = (fn: () => any) => context.with(suppressTracing(context.active()), fn)

    if (wrappedConfig.internalOperationWrapper) {
      const userWrapper = wrappedConfig.internalOperationWrapper
      wrappedConfig.internalOperationWrapper = (fn: any) => userWrapper(() => suppressWrapper(fn))
    } else {
      wrappedConfig.internalOperationWrapper = suppressWrapper
    }

    return wrappedConfig
  }

  /**
   * Subscribes handlers to the cache operation channel when instrumentation is active.
   */
  #subscribeIfEnabled() {
    if (!this.isEnabled()) return
    if (this.subscribed) return
    if (!this.#cacheOperation) return

    this.subscribed = true
    this.handlers = {
      start: (message) => this.#handleStart(message),
      end: () => {},
      asyncStart: () => {},
      asyncEnd: (message) => this.#handleAsyncEnd(message),
      error: (message) => this.#handleError(message),
    }

    this.#cacheOperation.subscribe(this.handlers)
  }

  /**
   * Unsubscribes handlers and clears runtime state tied to active spans.
   */
  #unsubscribe() {
    if (!this.subscribed || !this.handlers || !this.#cacheOperation) return

    this.#cacheOperation.unsubscribe(this.handlers)

    this.subscribed = false
    this.handlers = undefined
    this.spans = new WeakMap()
    this.#activeContexts.clear()
  }

  /**
   * Starts a span for each cache operation event and tracks getOrSet parent contexts.
   */
  #handleStart(message: CacheOperationMessage) {
    const config = this.getConfig()
    const contextKey = `${message.store}:${message.key}`

    // Only child operations (factory, set) use the active getOrSet context as parent.
    // getOrSet operations themselves always use the current context to avoid
    // chaining concurrent getOrSet calls for the same key into a nested hierarchy.
    const isGetOrSet = message.operation === 'getOrSet'
    const parentContext = !isGetOrSet
      ? (this.#activeContexts.get(contextKey) ?? context.active())
      : context.active()
    const parentSpan = trace.getSpan(parentContext)

    if (config.requireParentSpan && !parentSpan) return

    const spanName = this.#getSpanName(message)
    const span = this.tracer.startSpan(
      spanName,
      {
        kind: SpanKind.INTERNAL,
        attributes: this.#getStartAttributes(message),
      },
      parentContext,
    )

    this.spans.set(message, span)

    if (isGetOrSet) {
      this.#activeContexts.set(contextKey, trace.setSpan(context.active(), span))
    }
  }

  /**
   * Finalizes successful async spans and records result attributes.
   */
  #handleAsyncEnd(message: CacheOperationMessage) {
    const span = this.spans.get(message)
    if (!span) return

    if (message.hit !== undefined) span.setAttribute('cache.hit', message.hit)
    if (message.tier) span.setAttribute('cache.tier', message.tier)
    if (message.graced !== undefined) span.setAttribute('cache.graced', message.graced)

    span.end()
    this.spans.delete(message)

    if (message.operation === 'getOrSet') {
      this.#activeContexts.delete(`${message.store}:${message.key}`)
    }
  }

  /**
   * Finalizes failed spans and records exception details when available.
   */
  #handleError(message: CacheOperationMessage & { error?: unknown }) {
    const span = this.spans.get(message)
    if (!span) return

    if (message.error instanceof Error) {
      span.recordException(message.error)
      span.setStatus({ code: SpanStatusCode.ERROR, message: message.error.message })
    }

    span.end()
    this.spans.delete(message)

    if (message.operation === 'getOrSet') {
      this.#activeContexts.delete(`${message.store}:${message.key}`)
    }
  }

  /**
   * Builds the final span name using custom naming or the configured prefix.
   */
  #getSpanName(message: CacheOperationMessage) {
    const config = this.getConfig()

    if (config.spanName) return config.spanName(message)

    const prefix = config.spanNamePrefix ?? DEFAULT_CONFIG.spanNamePrefix
    return `${prefix}.${message.operation}`
  }

  /**
   * Builds initial attributes attached to spans at operation start.
   */
  #getStartAttributes(message: CacheOperationMessage) {
    const config = this.getConfig()
    const attributes: Record<string, string | boolean | string[]> = {
      'cache.operation': message.operation,
      'cache.store': message.store,
    }

    if (config.includeKeys) {
      if (message.key) {
        const key = config.keySanitizer ? config.keySanitizer(message.key) : message.key
        if (key) attributes['cache.key'] = key
      }

      if (message.keys?.length) {
        const keys = config.keySanitizer
          ? message.keys
              .map((key) => config.keySanitizer?.(key))
              .filter((key): key is string => !!key)
          : message.keys

        if (keys.length) attributes['cache.keys'] = keys
      }
    }

    return attributes
  }

  /**
   * Creates a new instrumentation instance with default and user config merged.
   */
  constructor(config: LayerCacheXInstrumentationConfig = {}) {
    super('@layercachex/otel', '0.1.0', { ...DEFAULT_CONFIG, ...config })
  }

  /**
   * Applies runtime config updates while preserving default values.
   */
  override setConfig(config: LayerCacheXInstrumentationConfig = {}) {
    super.setConfig({ ...DEFAULT_CONFIG, ...config })
  }

  /**
   * Declares the module patching lifecycle for layercachex instrumentation.
   */
  protected init() {
    return [
      new InstrumentationNodeModuleDefinition(
        'layercachex',
        ['>=1.6.0'],
        (moduleExports) => {
          const exports = this.#getModuleExports(moduleExports)
          if (!exports) return moduleExports

          this.#patchLayerCacheX(exports)
          this.#cacheOperation = exports.tracingChannels?.cacheOperation
          this.#subscribeIfEnabled()

          return moduleExports
        },
        (moduleExports) => {
          const exports = this.#getModuleExports(moduleExports)
          if (!exports) return

          this.#unpatchLayerCacheX(exports)
        },
      ),
    ]
  }

  /**
   * Enables instrumentation and subscribes to diagnostics channels when possible.
   */
  enable() {
    super.enable()

    // Guard: during super() constructor, class fields aren't initialized yet
    // so this.subscribed is undefined. Skip to avoid accessing uninitialized # fields.
    if (this.subscribed !== undefined) this.#subscribeIfEnabled()
  }

  /**
   * Disables instrumentation and cleans up subscribed channel handlers.
   */
  disable() {
    if (this.subscribed !== undefined) this.#unsubscribe()
    super.disable()
  }

  /**
   * Registers channel hooks manually when module interception is not available.
   */
  manuallyRegister(moduleExports: LayerCacheXModuleExports) {
    this.#cacheOperation = moduleExports.tracingChannels?.cacheOperation
    this.#patchLayerCacheX(moduleExports)
    this.#subscribeIfEnabled()
  }
}
