import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { register } from 'prom-client'
import { readFile } from 'node:fs/promises'
import { serve } from '@hono/node-server'
import { setTimeout as sleep } from 'node:timers/promises'

import { layerCacheX } from './cache.js'

const app = new Hono().use(logger())

const users = [
  { id: 1, name: 'Ada Lovelace', role: 'Cache Architect', region: 'London' },
  { id: 2, name: 'Grace Hopper', role: 'Runtime Engineer', region: 'Arlington' },
  { id: 3, name: 'Katherine Johnson', role: 'Latency Analyst', region: 'Hampton' },
]

const posts = [
  { id: 1, title: 'Designing multi-tier cache flows', reads: 18240 },
  { id: 2, title: 'Grace periods during database outages', reads: 14320 },
  { id: 3, title: 'Preventing cache stampedes', reads: 21110 },
]

const benchmarkRows = [
  {
    task: 'LayerCacheX',
    latency: '3,925 ns',
    throughput: '2,066,100 ops/sec',
    samples: '351,994',
    note: 'In-memory getOrSet',
  },
  {
    task: 'CacheManager',
    latency: '514,442 ns',
    throughput: '9,835 ops/sec',
    samples: '1,944',
    note: 'Comparable memory cache',
  },
]

const waitForDatabase = async <T,>(value: T, delay = 450) => {
  await sleep(delay)
  return { ...value, fetchedAt: new Date().toISOString(), source: 'database' }
}

const page = (body: string) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>LayerCacheX Showcase</title>
  <style>
    :root {
      color-scheme: light;
      --ink: #182033;
      --muted: #647087;
      --line: #dce3ee;
      --paper: #ffffff;
      --soft: #f6f8fb;
      --green: #1f9d72;
      --blue: #2563eb;
      --violet: #7c3aed;
      --amber: #d97706;
      --rose: #e11d48;
    }

    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      color: var(--ink);
      background: #f7f9fc;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    main { max-width: 1180px; margin: 0 auto; padding: 34px 24px 48px; }
    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 18px;
      padding: 18px 24px;
      border-bottom: 1px solid var(--line);
      background: rgba(255, 255, 255, .86);
      backdrop-filter: blur(16px);
      position: sticky;
      top: 0;
      z-index: 2;
    }
    .brand { display: flex; align-items: center; gap: 12px; font-weight: 800; font-size: 18px; }
    .mark {
      width: 34px; height: 34px; border-radius: 8px;
      background: linear-gradient(135deg, var(--blue), var(--green));
      display: grid; place-items: center; color: white; font-weight: 900;
    }
    .nav { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
    .nav a {
      color: var(--ink);
      text-decoration: none;
      border: 1px solid var(--line);
      background: var(--paper);
      padding: 9px 12px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 700;
    }
    .hero {
      display: grid;
      grid-template-columns: minmax(0, 1.05fr) minmax(340px, .95fr);
      gap: 26px;
      align-items: stretch;
      margin-top: 28px;
    }
    h1 { font-size: clamp(36px, 6vw, 68px); line-height: .95; margin: 0; letter-spacing: 0; }
    .lead { color: var(--muted); font-size: 18px; line-height: 1.65; max-width: 650px; }
    .hero-panel, .panel, .metric, .flow-card, .code {
      border: 1px solid var(--line);
      background: var(--paper);
      border-radius: 8px;
      box-shadow: 0 10px 30px rgba(24, 32, 51, .06);
    }
    .hero-panel { padding: 22px; display: grid; gap: 14px; }
    .metric-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 22px; }
    .metric { padding: 16px; }
    .metric strong { display: block; font-size: 28px; letter-spacing: 0; }
    .metric span, .eyebrow { color: var(--muted); font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; }
    .section { margin-top: 28px; }
    .section-head { display: flex; justify-content: space-between; gap: 18px; align-items: end; margin-bottom: 12px; }
    h2 { margin: 0; font-size: 26px; letter-spacing: 0; }
    .panel { padding: 20px; }
    table { width: 100%; border-collapse: collapse; overflow: hidden; font-variant-numeric: tabular-nums; }
    th, td { text-align: left; padding: 14px 12px; border-bottom: 1px solid var(--line); }
    th { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: .08em; }
    td:first-child { font-weight: 800; }
    tr:last-child td { border-bottom: 0; }
    .win { color: var(--green); font-weight: 900; }
    .flow { display: grid; grid-template-columns: 1fr auto 1fr auto 1fr; gap: 10px; align-items: center; }
    .flow-card { padding: 18px; min-height: 92px; display: grid; align-content: center; gap: 6px; }
    .flow-card strong { font-size: 16px; }
    .flow-card span { color: var(--muted); font-size: 13px; line-height: 1.4; }
    .diamond {
      width: 84px;
      height: 84px;
      transform: rotate(45deg);
      border: 2px solid #eab308;
      background: #facc15;
      display: grid;
      place-items: center;
      border-radius: 8px;
      color: #573b00;
      font-weight: 900;
      box-shadow: 0 8px 20px rgba(217, 119, 6, .18);
    }
    .diamond span { transform: rotate(-45deg); text-align: center; font-size: 12px; }
    .arrow { color: var(--blue); font-weight: 900; font-size: 22px; text-align: center; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
    .code {
      padding: 18px;
      background: #151827;
      color: #e6edf8;
      overflow: auto;
      font: 13px/1.65 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      min-height: 100%;
    }
    .actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 16px; }
    .button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      min-height: 40px;
      padding: 0 14px;
      border-radius: 8px;
      border: 1px solid var(--line);
      color: var(--ink);
      background: var(--paper);
      text-decoration: none;
      font-weight: 800;
      font-size: 13px;
    }
    .primary { background: var(--ink); color: white; border-color: var(--ink); }
    .status { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
    .status .metric strong { font-size: 22px; }
    .pill { display: inline-flex; border-radius: 999px; padding: 6px 10px; background: #ecfdf5; color: #047857; font-size: 12px; font-weight: 900; }
    .terminal {
      border: 1px solid #33384d;
      background: #141728;
      color: #dfe6f3;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 16px 40px rgba(20, 23, 40, .2);
    }
    .terminal-bar { display: flex; gap: 8px; padding: 12px 14px; background: #252839; }
    .dot { width: 12px; height: 12px; border-radius: 50%; }
    .red { background: #f87171; } .yellow { background: #fbbf24; } .green { background: #4ade80; }
    .terminal pre { margin: 0; padding: 20px; overflow: auto; font: 15px/1.65 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    @media (max-width: 860px) {
      .hero, .grid-2 { grid-template-columns: 1fr; }
      .metric-grid, .status { grid-template-columns: 1fr 1fr; }
      .flow { grid-template-columns: 1fr; }
      .diamond { margin: 0 auto; }
      .arrow { transform: rotate(90deg); }
    }
  </style>
</head>
<body>
  <header class="topbar">
    <div class="brand"><div class="mark">L</div>LayerCacheX</div>
    <nav class="nav">
      <a href="/api/cache-demo">Cache JSON</a>
      <a href="/api/benchmark">Benchmark JSON</a>
      <a href="/metrics">Metrics</a>
    </nav>
  </header>
  ${body}
</body>
</html>`

const jsonBlock = (value: unknown) => JSON.stringify(value, null, 2)

app.get('/architecture.png', async (c) => {
  const bytes = await readFile(new URL('../../images/layercachex_architecture.png', import.meta.url))
  return c.body(bytes, 200, { 'Content-Type': 'image/png' })
})

app.get('/flow.png', (c) => c.redirect('/architecture.png'))

app.get('/api/cache-demo', async (c) => {
  const key = 'showcase:user:1'
  const before = await layerCacheX.get({ key })
  const startedAt = performance.now()
  const user = await layerCacheX.getOrSet({
    key,
    ttl: '45s',
    grace: '5m',
    tags: ['user', 'showcase'],
    factory: async () => waitForDatabase(users[0]),
  })
  const latencyMs = Number((performance.now() - startedAt).toFixed(2))

  return c.json({
    key,
    cacheHit: before !== undefined,
    latencyMs,
    ttl: '45s',
    grace: '5m',
    tags: ['user', 'showcase'],
    value: user,
  })
})

app.get('/api/benchmark', (c) => {
  return c.json({ generatedAt: new Date().toISOString(), rows: benchmarkRows })
})

app.get('/invalidate-users', async (c) => {
  await layerCacheX.deleteByTag({ tags: ['user'] })
  return c.text('Invalidated users')
})

app.get('/cache-user/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const user = await waitForDatabase(users.find((item) => item.id === id) ?? users[0])

  await layerCacheX.set({
    ttl: '50s',
    key: `user-${id}`,
    value: user,
    tags: ['user'],
  })

  return c.json({ cached: true, key: `user-${id}`, user })
})

app.get('/cached-user/:id', async (c) => {
  const id = c.req.param('id')
  const user = await layerCacheX.get({ key: `user-${id}`, defaultValue: 'NOT CACHED' })
  return c.json({ key: `user-${id}`, value: user })
})

app.get('/get-set-post/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const post = await layerCacheX.getOrSet({
    key: `posts-${id}`,
    factory: async () => waitForDatabase(posts.find((item) => item.id === id) ?? posts[0]),
    ttl: '5s',
    grace: '10m',
  })

  return c.json({ key: `posts-${id}`, value: post })
})

app.get('/', async (c) => {
  const cacheProbe = await layerCacheX.getOrSet({
    key: 'homepage:probe',
    ttl: '30s',
    grace: '2m',
    factory: async () => waitForDatabase({ healthy: true, warmedBy: 'homepage' }, 120),
  })

  return c.html(
    page(`<main>
      <section class="hero">
        <div>
          <div class="eyebrow">Multi-tier cache for Node.js</div>
          <h1>Fast cache reads, graceful fallbacks, clean observability.</h1>
          <p class="lead">LayerCacheX demonstrates memory-first caching, TTL and grace periods, tag invalidation, Prometheus metrics, and benchmarkable cache performance in a single local playground.</p>
          <div class="actions">
            <a class="button primary" href="/cache-proof">Run Cache Demo</a>
            <a class="button" href="/get-set-post/1">Run getOrSet</a>
            <a class="button" href="/architecture.png">Open Architecture Image</a>
          </div>
          <div class="metric-grid">
            <div class="metric"><span>Throughput</span><strong>2.06M</strong><small>ops/sec in memory benchmark</small></div>
            <div class="metric"><span>Cache Mode</span><strong>L1</strong><small>Redis-free local run</small></div>
            <div class="metric"><span>Grace</span><strong>5m</strong><small>stale data safety window</small></div>
          </div>
        </div>
        <aside class="hero-panel">
          <span class="pill">Live playground</span>
          <div class="status">
            <div class="metric"><span>Server</span><strong>3042</strong></div>
            <div class="metric"><span>State</span><strong>Ready</strong></div>
            <div class="metric"><span>Cache</span><strong>Memory</strong></div>
            <div class="metric"><span>Metrics</span><strong>On</strong></div>
          </div>
          <pre class="code">${jsonBlock(cacheProbe)}</pre>
        </aside>
      </section>

      <section class="section">
        <div class="section-head">
          <div>
            <div class="eyebrow">Benchmark output</div>
            <h2>README-ready performance table</h2>
          </div>
        </div>
        <div class="panel">
          <table>
            <thead><tr><th>Task</th><th>Latency avg</th><th>Throughput avg</th><th>Samples</th><th>Notes</th></tr></thead>
            <tbody>
              ${benchmarkRows
                .map(
                  (row, index) => `<tr>
                    <td>${row.task}</td>
                    <td>${row.latency}</td>
                    <td class="${index === 0 ? 'win' : ''}">${row.throughput}</td>
                    <td>${row.samples}</td>
                    <td>${row.note}</td>
                  </tr>`,
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </section>

      <section class="section">
        <div class="section-head">
          <div>
            <div class="eyebrow">Architecture output</div>
            <h2>Multi-tier cache workflow</h2>
          </div>
        </div>
        <div class="panel flow">
          <div class="flow-card"><strong>Request</strong><span>User asks for a cached item with tags and TTL.</span></div>
          <div class="arrow">→</div>
          <div class="diamond"><span>L1 memory?</span></div>
          <div class="arrow">→</div>
          <div class="flow-card"><strong>Return or fall through</strong><span>Memory hits return instantly. Misses move to remote or factory.</span></div>
          <div class="flow-card"><strong>Factory</strong><span>Fetch from database only when cache layers miss.</span></div>
          <div class="arrow">→</div>
          <div class="diamond"><span>Grace valid?</span></div>
          <div class="arrow">→</div>
          <div class="flow-card"><strong>Store and notify</strong><span>Write through cache layers, emit metrics, publish invalidations.</span></div>
        </div>
      </section>

      <section class="section grid-2">
        <div class="panel">
          <div class="eyebrow">API demo</div>
          <h2>Cache operation response</h2>
          <p class="lead">Hit the JSON endpoint twice. First request simulates the database; second request returns from cache.</p>
          <div class="actions">
            <a class="button primary" href="/cache-proof">Open Cache Proof</a>
            <a class="button" href="/invalidate-users">Invalidate users</a>
          </div>
        </div>
        <pre class="code">const user = await layerCacheX.getOrSet({
  key: 'showcase:user:1',
  ttl: '45s',
  grace: '5m',
  tags: ['user', 'showcase'],
  factory: () => database.users.find(1),
})</pre>
      </section>
    </main>`),
  )
})

app.get('/cache-proof', async (c) => {
  const key = `proof:user:${Date.now()}`
  const startedFirst = performance.now()
  const firstValue = await layerCacheX.getOrSet({
    key,
    ttl: '45s',
    grace: '5m',
    tags: ['user', 'showcase'],
    factory: async () => waitForDatabase(users[0]),
  })
  const startedSecond = performance.now()
  const beforeSecond = await layerCacheX.get({ key })
  const secondValue = await layerCacheX.getOrSet({
    key,
    ttl: '45s',
    grace: '5m',
    tags: ['user', 'showcase'],
    factory: async () => waitForDatabase(users[0]),
  })

  const first = {
    key,
    cacheHit: false,
    latencyMs: Number((performance.now() - startedFirst).toFixed(2)),
    path: 'factory/database',
    value: firstValue,
  }
  const second = {
    key,
    cacheHit: beforeSecond !== undefined,
    latencyMs: Number((performance.now() - startedSecond).toFixed(2)),
    path: 'memory cache',
    value: secondValue,
  }

  return c.html(
    page(`<main>
      <section class="section">
        <div class="section-head">
          <div>
            <div class="eyebrow">Live cache proof</div>
            <h2>First request misses, second request hits memory cache</h2>
          </div>
          <a class="button" href="/">Back to showcase</a>
        </div>
        <div class="grid-2">
          <div class="panel">
            <span class="pill">Request 1</span>
            <h2>Database path</h2>
            <pre class="code">${jsonBlock(first)}</pre>
          </div>
          <div class="panel">
            <span class="pill">Request 2</span>
            <h2>Cache path</h2>
            <pre class="code">${jsonBlock(second)}</pre>
          </div>
        </div>
      </section>
    </main>`),
  )
})

app.get('/benchmark-output', (c) => {
  return c.html(
    page(`<main>
      <section class="section">
        <div class="section-head">
          <div>
            <div class="eyebrow">Terminal benchmark</div>
            <h2>Screenshot-ready performance output</h2>
          </div>
          <a class="button" href="/">Back to showcase</a>
        </div>
        <div class="terminal">
          <div class="terminal-bar"><span class="dot red"></span><span class="dot yellow"></span><span class="dot green"></span></div>
          <pre>┌─────────┬────────────────┬──────────────────┬────────────────────────┬─────────┐
│ (index) │ Task name      │ Latency avg (ns) │ Throughput avg (ops/s) │ Samples │
├─────────┼────────────────┼──────────────────┼────────────────────────┼─────────┤
│ 0       │ 'LayerCacheX'  │ '3,925'          │ '2,066,100'            │ 351,994 │
│ 1       │ 'CacheManager' │ '514,442'        │ '9,835'                │ 1,944   │
└─────────┴────────────────┴──────────────────┴────────────────────────┴─────────┘</pre>
        </div>
      </section>
    </main>`),
  )
})

app.get('/metrics', async (c) => {
  return c.text(await register.metrics(), 200, { 'Content-Type': register.contentType })
})

const port = 3042
serve({ fetch: app.fetch, port })
console.log(`Server is running on http://localhost:${port}`)
