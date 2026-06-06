import { trace } from '@opentelemetry/api'
import { memoryDriver } from 'layercachex/drivers/memory'
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base'

import { LayerCacheXInstrumentation } from '../src/instrumentation.js'

/**
 * Controls how layercachex instrumentation is attached during tests.
 */
export type SetupMode = 'modulePatch' | 'manualRegister'

/**
 * Signature used by Japa to register test cleanup callbacks.
 */
type CleanupFn = (callback: () => Promise<void> | void) => void

/**
 * Reused tracer setup shared across tests.
 */
let tracerSetup: { exporter: InMemorySpanExporter; provider: BasicTracerProvider } | undefined

/**
 * Creates a singleton tracer provider and in-memory exporter for the suite.
 * Existing exporters are reset between tests to isolate assertions.
 */
const setupTracer = () => {
  if (tracerSetup) {
    tracerSetup.exporter.reset()
    return tracerSetup
  }

  const exporter = new InMemorySpanExporter()
  const provider = new BasicTracerProvider({
    spanProcessors: [new SimpleSpanProcessor(exporter)],
  })

  trace.setGlobalTracerProvider(provider)

  tracerSetup = { exporter, provider }
  return tracerSetup
}

/**
 * Boots instrumentation for a test and returns all runtime handles.
 * Supports both automatic module patching and manual registration mode.
 */
export const setupInstrumentation = async (
  cleanup: CleanupFn,
  config: ConstructorParameters<typeof LayerCacheXInstrumentation>[0] = {},
  mode: SetupMode = 'modulePatch',
) => {
  const { exporter, provider } = setupTracer()
  void provider

  const instrumentation = new LayerCacheXInstrumentation(config)
  const moduleDefinitions = (instrumentation as any)._modules as any[]
  const moduleDefinition = moduleDefinitions[0]

  const layercachexModule = await import('layercachex')

  if (mode === 'modulePatch') {
    moduleDefinition.patch?.(layercachexModule)
    instrumentation.enable()
  } else {
    const moduleExports = (layercachexModule as any).default ?? layercachexModule
    instrumentation.enable()
    instrumentation.manuallyRegister(moduleExports)
  }

  cleanup(async () => {
    instrumentation.disable()
  })

  return { exporter, instrumentation, layercachexModule }
}

/**
 * Builds a minimal in-memory LayerCacheX store used by instrumentation tests.
 */
export const createMemoryStore = (layercachexModule: any) => {
  const cache = new layercachexModule.LayerCacheX({
    default: 'memory',
    stores: {
      memory: layercachexModule.layerstore().useL1Layer(memoryDriver({})),
    },
  })

  return cache.use('memory')
}
