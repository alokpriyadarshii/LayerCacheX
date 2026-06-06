import { test } from '@japa/runner'
import { ms } from '../src/utils/string/ms.js'

import { LayerCacheXOptions } from '../src/layer_cache_x_options.js'

test.group('LayerCacheX Options', () => {
  test('default values', ({ assert }) => {
    const options = new LayerCacheXOptions({})

    assert.deepEqual(options.ttl, ms.parse('30m'))
    assert.deepEqual(options.prefix, 'layercachex')
  })

  test('override defaults', ({ assert }) => {
    const options = new LayerCacheXOptions({ ttl: '10m', prefix: 'foo' })

    assert.deepEqual(options.ttl, '10m')
    assert.deepEqual(options.prefix, 'foo')
  })

  test('override with cloneWith', ({ assert }) => {
    const options = new LayerCacheXOptions({ ttl: '10m', prefix: 'foo' }).cloneWith({ ttl: '20m' })

    assert.deepEqual(options.ttl, '20m')
    assert.deepEqual(options.prefix, 'foo')
    assert.deepEqual(options.grace, false)
  })
})
