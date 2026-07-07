/* Section 03 — Metrics Done Right.
 *
 * Prose + Percentile vs Average Visualizer.
 *
 * The visualizer: three pre-built latency distributions (tight cluster,
 * long tail, bimodal) — same approximate average, radically different
 * shapes. For each, render an SVG histogram with marker lines for avg,
 * p50, p95, p99. The user toggles between scenarios and sees how a
 * single "average latency" number hides everything that matters about
 * user experience.
 *
 * The teaching aim: averages are a lie at scale. Use percentiles (and
 * histograms) for service-level metrics. p99 is the worst-experience
 * number that 1% of users actually felt — that is the alerting metric,
 * not avg.
 *
 * All prose strings use backticks (template literals).
 */

import { useState, useMemo } from 'react';
import { Sparkles, TrendingUp, Activity, Layers, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Code, Callout, H2, P, Kbd, SectionLabel } from '../components/primitives.jsx';

// ───────────────────────────────────────────────────────────────────────
// Percentile vs Average Visualizer
// ───────────────────────────────────────────────────────────────────────

/* Synthesize three latency distributions. Each is a list of latency values
 * in ms — we then bucket into a histogram and compute percentiles.
 * Distributions are carefully tuned so all three have ~200ms average.
 */
function generateDistributions() {
  // Tight: requests cluster around 200ms with small variance
  const tight = [];
  for (let i = 0; i < 10000; i++) {
    // Normal-ish around 200, stddev ~30
    const u1 = Math.random(), u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    tight.push(Math.max(50, 200 + z * 30));
  }

  // Long tail: most requests at 50-100ms, but ~3% are 1500-3000ms
  const longTail = [];
  for (let i = 0; i < 10000; i++) {
    if (Math.random() < 0.03) {
      // slow outliers
      longTail.push(1500 + Math.random() * 1500);
    } else {
      // fast majority
      longTail.push(60 + Math.random() * 90);
    }
  }

  // Bimodal: roughly half fast (80ms), half slow (320ms)
  const bimodal = [];
  for (let i = 0; i < 10000; i++) {
    if (Math.random() < 0.5) {
      bimodal.push(70 + Math.random() * 30);
    } else {
      bimodal.push(290 + Math.random() * 60);
    }
  }

  return { tight, longTail, bimodal };
}

function computeStats(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const sum = sorted.reduce((a, b) => a + b, 0);
  const avg = sum / n;
  const pct = (p) => sorted[Math.floor((p / 100) * (n - 1))];
  return {
    avg: Math.round(avg),
    p50: Math.round(pct(50)),
    p95: Math.round(pct(95)),
    p99: Math.round(pct(99)),
    min: Math.round(sorted[0]),
    max: Math.round(sorted[n - 1]),
  };
}

function histogram(values, bins = 30, maxClamp = 1600) {
  const clamped = values.map(v => Math.min(v, maxClamp));
  const max = Math.max(...clamped);
  const min = Math.min(...clamped);
  const width = (max - min) / bins;
  const buckets = new Array(bins).fill(0);
  clamped.forEach(v => {
    const idx = Math.min(Math.floor((v - min) / width), bins - 1);
    buckets[idx]++;
  });
  return { buckets, min, max, width };
}

const DISTRIBUTIONS = (() => {
  const dist = generateDistributions();
  return [
    {
      id: 'tight',
      label: 'Tight cluster',
      blurb: 'Normal-ish distribution centered ~200ms with small variance. Every request feels about the same.',
      values: dist.tight,
      interpretation: `Every user feels the same thing — ~200ms. Average, p50, p95, p99 are all close together. This is a healthy, predictable service. Operators sleep well.`,
      tone: 'good',
    },
    {
      id: 'long-tail',
      label: 'Long tail',
      blurb: 'Most requests fast (~80ms), but ~3% experience 1500-3000ms. The classic real-world shape — caches miss, DBs spike, GC pauses.',
      values: dist.longTail,
      interpretation: `The average looks fine but is a LIE. p50 says 95ms — feels fast. p99 says 2800ms — 1 in 100 users wait nearly 3 seconds. At a million requests per day, that is ten thousand miserable user experiences. The average hides them entirely. This is what you SHOULD be alerting on.`,
      tone: 'bad',
    },
    {
      id: 'bimodal',
      label: 'Bimodal',
      blurb: 'Two clear clusters — one fast (~80ms), one slow (~320ms). Suggests two distinct code paths or load conditions.',
      values: dist.bimodal,
      interpretation: `Half your traffic feels good; half feels sluggish. The average (~200ms) describes NO actual user — nobody experiences 200ms. The percentiles immediately reveal the bimodal shape: p50 below the slow cluster, p95/p99 inside it. This pattern usually means: two code paths (cache hit vs cache miss), or two user populations (free vs paid tier), or a partial degradation in one zone. Investigate the SHAPE, not the average.`,
      tone: 'caution',
    },
  ];
})();

function PercentileVisualizer() {
  const [distIdx, setDistIdx] = useState(1);  // start on long-tail (most instructive)
  const dist = DISTRIBUTIONS[distIdx];

  const stats = useMemo(() => computeStats(dist.values), [dist]);
  const histo = useMemo(() => histogram(dist.values, 30, 1600), [dist]);

  // SVG dimensions
  const svgW = 800;
  const svgH = 200;
  const barW = svgW / histo.buckets.length;
  const maxBucket = Math.max(...histo.buckets);
  const xForVal = (v) => ((Math.min(v, 1600) - histo.min) / (histo.max - histo.min)) * svgW;

  const markers = [
    { label: 'avg',  value: stats.avg, color: '#fb923c', solid: false },  // amber
    { label: 'p50',  value: stats.p50, color: '#7dd3fc', solid: true  },
    { label: 'p95',  value: stats.p95, color: '#f472b6', solid: true  },  // pink
    { label: 'p99',  value: stats.p99, color: '#f87171', solid: true  },  // rose
  ];

  return (
    <div className="my-6 border border-sky-300/30 bg-zinc-900/40">
      <div className="flex items-center justify-between bg-zinc-950 px-4 py-2.5 border-b border-sky-300/30">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-sky-300" />
          <span className="text-sky-300 text-[11px] tracking-[0.25em] uppercase font-semibold"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            interactive · percentile vs average
          </span>
        </div>
      </div>

      <div className="p-4">
        {/* Scenario tabs */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          {DISTRIBUTIONS.map((d, i) => (
            <button key={d.id} onClick={() => setDistIdx(i)}
              className={`px-3 py-2 border text-[11.5px] transition-colors text-left ${
                i === distIdx
                  ? 'border-sky-300 bg-sky-300/15 text-sky-200'
                  : 'border-zinc-700 text-zinc-400 hover:border-sky-300/50 hover:text-zinc-200'
              }`}
              style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              <div className="font-semibold">{d.label}</div>
              <div className="text-[9.5px] opacity-80 mt-0.5">10,000 reqs · ~{stats.avg}ms avg</div>
            </button>
          ))}
        </div>

        <div className="mb-3 p-3 border border-zinc-800 bg-zinc-900/40 text-zinc-300 text-[13px] leading-relaxed italic">
          {dist.blurb}
        </div>

        {/* Stat row */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          {markers.map(m => (
            <div key={m.label} className="border border-zinc-800 bg-zinc-950/60 p-2">
              <div className="text-zinc-500 text-[9.5px] tracking-[0.25em] uppercase font-semibold"
                style={{ fontFamily: 'JetBrains Mono, monospace', color: m.color }}>
                {m.label}
              </div>
              <div className="text-zinc-100 text-[18px] font-bold leading-none mt-1"
                style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                {m.value}<span className="text-zinc-500 text-[11px]">ms</span>
              </div>
            </div>
          ))}
        </div>

        {/* Histogram SVG */}
        <div className="border border-zinc-800 bg-zinc-950/80 p-3 mb-3">
          <div className="text-zinc-500 text-[9.5px] tracking-[0.25em] uppercase mb-2"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            distribution histogram (latency ms → request count)
          </div>
          <svg viewBox={`0 0 ${svgW} ${svgH + 30}`} className="w-full" preserveAspectRatio="none">
            {/* Bars */}
            {histo.buckets.map((count, i) => {
              const barH = (count / maxBucket) * svgH;
              return (
                <rect key={i}
                  x={i * barW + 1}
                  y={svgH - barH}
                  width={barW - 2}
                  height={barH}
                  className="fill-sky-300/40"
                />
              );
            })}
            {/* Baseline */}
            <line x1={0} y1={svgH} x2={svgW} y2={svgH} stroke="#3f3f46" strokeWidth={1} />
            {/* Marker lines */}
            {markers.map((m, i) => {
              const x = xForVal(m.value);
              const dashed = !m.solid;
              return (
                <g key={m.label}>
                  <line x1={x} y1={0} x2={x} y2={svgH}
                    stroke={m.color}
                    strokeWidth={1.5}
                    strokeDasharray={dashed ? '4 3' : 'none'} />
                  <text x={x} y={svgH + 14}
                    fill={m.color}
                    fontSize="10"
                    fontFamily="JetBrains Mono, monospace"
                    textAnchor="middle"
                    fontWeight="700">
                    {m.label}
                  </text>
                  <text x={x} y={svgH + 25}
                    fill={m.color}
                    fontSize="8"
                    fontFamily="JetBrains Mono, monospace"
                    textAnchor="middle"
                    opacity="0.7">
                    {m.value}ms
                  </text>
                </g>
              );
            })}
            {/* X-axis labels */}
            <text x={5} y={svgH - 5} fill="#52525b" fontSize="8" fontFamily="JetBrains Mono, monospace">
              {Math.round(histo.min)}ms
            </text>
            <text x={svgW - 30} y={svgH - 5} fill="#52525b" fontSize="8" fontFamily="JetBrains Mono, monospace">
              {Math.round(histo.max)}ms+
            </text>
          </svg>
        </div>

        {/* Interpretation */}
        <div className={`border p-3 ${
          dist.tone === 'good' ? 'border-lime-400/60 bg-lime-400/10' :
          dist.tone === 'bad'  ? 'border-rose-400/60 bg-rose-400/10' :
                                 'border-amber-400/60 bg-amber-400/10'
        }`}>
          <div className={`text-[10.5px] tracking-[0.25em] uppercase font-semibold mb-1.5 flex items-center gap-2 ${
            dist.tone === 'good' ? 'text-lime-400' :
            dist.tone === 'bad'  ? 'text-rose-400' :
                                   'text-amber-400'
          }`} style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            {dist.tone === 'good' ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
            user experience interpretation
          </div>
          <div className="text-zinc-200 text-[12.5px] leading-relaxed">
            {dist.interpretation}
          </div>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Section content
// ───────────────────────────────────────────────────────────────────────

export default function Section03_Metrics() {
  return (
    <>
      <SectionLabel>section 03</SectionLabel>
      <h2 className="text-zinc-50 text-[28px] leading-tight mb-3"
        style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 600 }}>
        Metrics done right — types, percentiles, methods
      </h2>
      <P>
        Metrics are aggregated numeric time-series. Each datapoint is a timestamp plus a value
        (or a small bundle of values, in the case of histograms). The discipline of metrics is
        deciding WHAT to record and HOW to summarize — because aggregation throws away
        information, and choosing the wrong summary can make a healthy service look broken or
        a broken one look healthy.
      </P>

      <H2 num="◇ 01">The four metric types</H2>
      <P>
        Prometheus codified the four types, and the rest of the industry has converged on the
        same model. Each is suited to a different kind of measurement.
      </P>
      <Code id="metric-types" lang="text">{`TYPE       SEMANTICS                                EXAMPLE
────       ─────────                                ───────
COUNTER    Monotonically increasing.                http_requests_total
           Goes up only; resets only on restart.    errors_total
           Use rate() in queries to get per-second. bytes_sent_total

GAUGE      Snapshot of a value at a moment in time. memory_bytes_in_use
           Can go up OR down.                       queue_depth
                                                    open_connections
                                                    cpu_temperature

HISTOGRAM  Distribution of values into buckets.     request_duration_seconds
           Each bucket is itself a counter.          (with buckets at 5ms, 10ms, 50ms,
           Used to compute percentiles via            100ms, 500ms, 1s, 5s, ...)
           histogram_quantile() in PromQL.

SUMMARY    Pre-computed quantiles (e.g., p50, p95   request_duration_seconds_p99
           p99) computed client-side over a sliding (with quantile=0.99)
           window. Cheaper to query than histograms
           but CANNOT be aggregated across instances
           — a fundamental limitation.

THE PRACTICAL CHOICE: use HISTOGRAM for distributions you might want to
aggregate (per-service, per-endpoint, per-region). Use SUMMARY only when
you know you will never aggregate. Use COUNTER for "how many" and GAUGE
for "how much right now."`}</Code>

      <H2 num="◇ 02">Counter, the workhorse — and why you always use rate()</H2>
      <P>
        Counters are the most common metric type. A counter tracks "how many of X have happened
        since this process started." On its own, the absolute value is useless — what you want
        is the RATE of increase per second over some window.
      </P>
      <Code id="counter-rate" lang="text">{`# Wrong: querying the raw counter value
http_requests_total
  → 1,294,847,302
  (a number that grows by ~thousand per second; useless as a chart)

# Right: rate() over a window
rate(http_requests_total[5m])
  → 853.42 (requests per second, averaged over the last 5 minutes)

# Same pattern for errors
rate(http_errors_total[5m]) / rate(http_requests_total[5m])
  → 0.0034 (error rate as a fraction, the canonical SLI)

WHY rate() AND NOT THE ABSOLUTE VALUE:
   - Counter values reset on process restart; raw values would have
     huge negative steps. rate() handles resets cleanly.
   - The interesting question is almost always "how fast is X happening
     RIGHT NOW," not "how many of X have ever happened."
   - Charts of rates are interpretable; charts of cumulative counters
     are unreadable (they always go up).`}</Code>

      <H2 num="◇ 03">Why percentiles beat averages</H2>
      <P>
        The single most common mistake in metrics: alerting on average latency. Average is the
        most useless summary statistic for a distribution that has a long tail — which is
        every real production service.
      </P>
      <Code id="average-is-a-lie" lang="text">{`SERVICE A (tight cluster):                SERVICE B (long tail):

   All requests near 200ms.                  9700 reqs at 60-100ms
   Average: 200ms.                           300 reqs at 2000-3000ms
   p50:     200ms.                           Average: 195ms.
   p99:     230ms.                           p50:      85ms.
                                              p99:    2700ms.

   USERS FEEL: 200ms.                        USERS FEEL: usually 85ms; sometimes 2700ms.
   Operations: healthy.                      Operations: BROKEN for 1% of users.

SAME AVERAGE. RADICALLY DIFFERENT USER EXPERIENCES.

The average tells you nothing about the worst case. The worst case is what
generates support tickets, what triggers timeouts in downstream services,
what gets noticed. Alert on p99. Always.

THE CASE FOR REPORTING p50 ALONGSIDE p99:
   p50 alone hides the tail (same problem as average).
   p99 alone misses the typical experience.
   Both together: "typical user sees X; worst 1% sees Y."`}</Code>
      <Callout kind="signal" title="THE LIE OF AVERAGES, IN ONE LINE">
        An average says nothing about a distribution&apos;s shape. Two distributions with the
        same average can have completely different user experiences. The choice of summary
        statistic is a choice about which subset of users you care about — and the average
        cares about none of them in particular.
      </Callout>

      <SectionLabel>practice</SectionLabel>
      <H2 num="◇ 04">See three distributions hiding behind the same average</H2>
      <P>
        Three pre-built latency distributions, each with approximately the same average. The
        histogram shows the actual shape. The marker lines show where avg, p50, p95, and p99
        fall. Read the user-experience interpretation panel for each — note how dramatically
        the same "200ms average" describes different realities.
      </P>

      <PercentileVisualizer />

      <H2 num="◇ 05">The USE method — for resources</H2>
      <P>
        Brendan Gregg&apos;s USE method: for every RESOURCE, watch three things. Resources are
        things with finite capacity that can be saturated — CPU, memory, disk, network, file
        handles, thread pools, connection pools.
      </P>
      <Code id="use-method" lang="text">{`U  UTILIZATION   What percentage of the resource is busy?
                    CPU: cpu_busy_percent
                    Disk: disk_util_percent
                    Pool: pool_used / pool_size

S  SATURATION    How much extra work is queued waiting?
                    CPU: load_average / cpu_count
                    Disk: io_queue_depth
                    Pool: pool_wait_count

E  ERRORS         How many error events for this resource?
                    CPU: scheduler_pressure_events
                    Disk: io_error_count
                    Pool: pool_acquire_timeout_count

THE INSIGHT: utilization alone misleads. A pool can be 70% utilized
(looks fine) but have a queue of 50 waiters (broken — your service is
saturated, not busy). Always show ALL THREE for any resource.

APPLY TO EVERY MAJOR RESOURCE IN YOUR STACK:
   CPU, memory, disk space, disk I/O, network bandwidth, file descriptors,
   thread pools, connection pools, message queues, lock contention.`}</Code>

      <H2 num="◇ 06">The RED method — for services</H2>
      <P>
        Tom Wilkie&apos;s RED method: for every SERVICE (or endpoint), watch three things. RED
        is the application-layer counterpart to USE.
      </P>
      <Code id="red-method" lang="text">{`R  RATE       Requests per second.
                rate(http_requests_total[5m])
                
                Tells you the load. Drops indicate upstream problems;
                spikes indicate something interesting (or a bot).

E  ERRORS     Errors per second (or error rate as a percentage).
                rate(http_errors_total[5m])
                rate(http_errors_total[5m]) / rate(http_requests_total[5m])

                Most important alert metric. SLOs are defined here.

D  DURATION   Latency distribution.
                histogram_quantile(0.99, request_duration_seconds_bucket)
                histogram_quantile(0.50, request_duration_seconds_bucket)
                
                Use p99 (and p50, for context). Never just average.

RED IS THE DEFAULT DASHBOARD TEMPLATE for any service. Three panels —
rate, errors, duration — per endpoint, refreshing every 10-30 seconds.
This is what an on-call engineer pulls up first. If you only have time
to instrument ONE thing, instrument RED on your most important endpoints.`}</Code>
      <Callout kind="tip" title="USE FOR INFRA, RED FOR SERVICES">
        The two methods are complementary, not competing. USE works on RESOURCES — physical
        and logical things with capacity. RED works on SERVICES — request-response APIs.
        A typical observability setup uses USE dashboards for hosts, databases, queues, and
        pools; RED dashboards for HTTP services, RPC endpoints, and message-handler workers.
        Together they cover every layer of a modern stack.
      </Callout>

      <H2 num="◇ 07">Cardinality, again — and why it matters more for metrics</H2>
      <P>
        Cardinality came up in §01 and §02 — for metrics it is the single most expensive
        observability decision you make. Every unique combination of label values creates a
        separate time-series. Time-series storage costs scale linearly with cardinality. The
        canonical blow-up: putting <Kbd>user_id</Kbd> or <Kbd>request_id</Kbd> in a metric
        label.
      </P>
      <Code id="metric-cardinality" lang="text">{`# Safe — low-cardinality labels
http_requests_total{service, method, status, endpoint}
  Cardinality: ~5 × 6 × 12 × 80 = 28,800 series
  Storage at ~$10/series/year on managed metrics: $288K/year

# Catastrophic — one bad label
http_requests_total{service, method, status, endpoint, user_id}
  Cardinality: 28,800 × 5,000,000 users = 144 BILLION series
  Storage: pick your favorite "more than the entire AWS bill" number

THE RULES FOR METRIC LABELS:
   ✓ Bounded by the application itself (status codes, error types, code paths)
   ✓ Bounded by deployment topology (region, environment, instance role)
   ✓ Templated endpoints, not raw URLs ("/api/orders/:id" not "/api/orders/42")
   
   ✗ NEVER user_id, customer_id, account_id
   ✗ NEVER trace_id, span_id, request_id
   ✗ NEVER raw URLs, query parameters, IP addresses
   ✗ NEVER timestamp-derived values

These belong in LOGS or TRACES — both are designed for high cardinality.
Metrics are for AGGREGATE, BOUNDED measurements. If you find yourself
wanting to "see metrics per user," you want logs or traces.`}</Code>

      <H2 num="◇ 08">The Prometheus + Grafana stack</H2>
      <P>
        The de-facto standard for metrics observability. Used by everything from solo projects
        to hyperscalers. The architecture is worth understanding at a glance:
      </P>
      <Code id="prom-stack" lang="text">{`                  ┌──────────────────────────────────────┐
                  │            APPLICATIONS              │
                  │  exposes /metrics endpoint (HTTP)    │
                  │  text format, e.g.:                  │
                  │    http_requests_total{status="200"} │
                  │      1294847                         │
                  └──────────────┬───────────────────────┘
                                 │ scrape every 15s
                                 ▼
                  ┌──────────────────────────────────────┐
                  │           PROMETHEUS                 │
                  │  pulls metrics from configured       │
                  │  targets · TSDB on local disk        │
                  │  alerting rules · recording rules    │
                  └──────────────┬───────────────────────┘
                                 │ PromQL queries
                                 ▼
                  ┌──────────────────────────────────────┐
                  │             GRAFANA                  │
                  │  dashboards · charts · alerts        │
                  │  reads from Prometheus (and 50+      │
                  │  other backends)                     │
                  └──────────────────────────────────────┘

KEY ARCHITECTURAL CHOICES:

   PULL, NOT PUSH: Prometheus scrapes targets rather than receiving pushes.
   Targets are discovered via service discovery (Kubernetes API, DNS,
   Consul, EC2 tags). The control plane decides what to scrape.

   LOCAL STORAGE: Prometheus stores metrics on local disk by default. For
   high availability and long-term retention, use Mimir / Thanos / Cortex
   — they federate Prometheus storage and serve queries from a cluster.

   PROMQL: a functional language for time-series queries. Steep learning
   curve, but capable. Standard queries: rate(), histogram_quantile(),
   sum() / by(label), topk(), absent().

THE MANAGED EQUIVALENTS:
   Datadog Metrics, New Relic, Chronosphere, Grafana Cloud — all speak
   Prometheus-compatible APIs (mostly). Lift-and-shift is real.`}</Code>

      <H2 num="◇ 09">Hardening checklist for metrics</H2>
      <ul className="text-zinc-300 text-[15px] leading-relaxed my-3 list-disc pl-6 space-y-1.5 max-w-prose">
        <li>✓ Every service exposes a <Kbd>/metrics</Kbd> endpoint (or equivalent), scraped at 15-30 sec intervals</li>
        <li>✓ RED dashboard exists for every service (rate, errors, p50+p99 duration)</li>
        <li>✓ USE dashboard exists for every shared resource (DB, cache, queue, pool)</li>
        <li>✓ Alerting is on p99 latency and error RATE, never on average latency or absolute counts</li>
        <li>✓ Histograms (not summaries) used for any latency that might be aggregated across instances</li>
        <li>✓ Endpoint labels use TEMPLATES, not raw URLs (e.g., <Kbd>/users/:id</Kbd> not <Kbd>/users/4242</Kbd>)</li>
        <li>✓ No metric label uses user_id, request_id, trace_id, or any unbounded value</li>
        <li>✓ Cardinality dashboard exists; alerts fire when total series count grows abnormally</li>
        <li>✓ Recording rules pre-compute expensive queries (e.g., aggregate rates by service)</li>
        <li>✓ Alerts include a runbook link pointing to a real procedure, not a generic doc</li>
        <li>✓ Long-term retention configured (Mimir / Thanos / Cortex / managed equivalent) for capacity planning</li>
      </ul>
      <Callout kind="info" title="WHAT'S NEXT">
        Section 04 turns to traces — the per-request causal chains that let you debug across
        services. OpenTelemetry as the standard, head-based vs tail-based sampling, the cost
        reality of full tracing, and the atlas-closing wrap that opens the road to Atlas 24
        (Reliability — SLIs, SLOs, error budgets, and the discipline of "how reliable is
        reliable enough").
      </Callout>
    </>
  );
}
