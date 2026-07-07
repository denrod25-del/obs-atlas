/* Section 01 — The Three Pillars.
 *
 * Prose + Three Pillars Comparison Visualizer.
 *
 * The simulator: one incident scenario ("latency spike on /api/orders").
 * Student picks logs / metrics / traces and sees what each pillar reveals
 * about the SAME incident — plus what it CANNOT tell them. The point: no
 * single pillar is enough; the diagnosis comes from combining them.
 *
 * The shown data is realistic-looking but static. Logs show structured
 * JSON entries with ERRORs around the incident window. Metrics show
 * sparkline-style ASCII charts. Traces show a Gantt chart of one slow
 * request highlighting the bottleneck.
 *
 * All prose strings use backticks (template literals).
 */

import { useState } from 'react';
import { Sparkles, FileText, BarChart3, GitBranch, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Code, Callout, H2, P, Kbd, SectionLabel } from '../components/primitives.jsx';

// ───────────────────────────────────────────────────────────────────────
// Three Pillars Comparison Visualizer
// ───────────────────────────────────────────────────────────────────────

const PILLARS = [
  { id: 'logs',    label: 'Logs',    icon: FileText,  color: 'text-amber-300', border: 'border-amber-400', bg: 'bg-amber-400/10' },
  { id: 'metrics', label: 'Metrics', icon: BarChart3, color: 'text-sky-300',   border: 'border-sky-300',   bg: 'bg-sky-300/10' },
  { id: 'traces',  label: 'Traces',  icon: GitBranch, color: 'text-lime-300',  border: 'border-lime-400',  bg: 'bg-lime-400/10' },
];

// Pre-built log entries (structured JSON style)
const LOG_ENTRIES = [
  { t: '14:31:55', level: 'INFO',  service: 'orders-api',  msg: 'request received', extra: 'endpoint=/api/orders user_id=4242 method=POST' },
  { t: '14:31:55', level: 'INFO',  service: 'orders-api',  msg: 'order persisted',   extra: 'order_id=ord_xyz123 duration_ms=42' },
  { t: '14:32:02', level: 'WARN',  service: 'orders-api',  msg: 'db pool wait',      extra: 'pool_size=20 in_use=20 wait_ms=180' },
  { t: '14:32:08', level: 'WARN',  service: 'orders-api',  msg: 'db pool wait',      extra: 'pool_size=20 in_use=20 wait_ms=950' },
  { t: '14:32:15', level: 'ERROR', service: 'orders-api',  msg: 'db query timeout',  extra: 'query=SELECT_orders timeout_ms=3000 trace_id=tx_a14f9' },
  { t: '14:32:18', level: 'ERROR', service: 'orders-api',  msg: 'db query timeout',  extra: 'query=SELECT_orders timeout_ms=3000 trace_id=tx_b22e1' },
  { t: '14:32:25', level: 'ERROR', service: 'orders-api',  msg: 'db pool exhausted', extra: 'pool_size=20 in_use=20 wait_timeout=5000ms' },
  { t: '14:32:30', level: 'WARN',  service: 'orders-api',  msg: 'circuit open',      extra: 'service=postgres failures=12 window=60s' },
];

const LOG_TONES = {
  INFO:  'text-zinc-400',
  WARN:  'text-amber-300',
  ERROR: 'text-rose-300',
};

function LogsView() {
  return (
    <div>
      <div className="border border-zinc-800 bg-zinc-950/60 p-3 mb-3">
        <div className="text-zinc-500 text-[9.5px] tracking-[0.25em] uppercase mb-2 flex items-center gap-1.5"
          style={{ fontFamily: 'JetBrains Mono, monospace' }}>
          <FileText size={11} /> structured logs · orders-api · 14:31-14:33 UTC
        </div>
        <div className="space-y-1 text-[10.5px]"
          style={{ fontFamily: 'JetBrains Mono, monospace' }}>
          {LOG_ENTRIES.map((e, i) => (
            <div key={i} className="flex gap-2 items-start py-0.5">
              <span className="text-zinc-600 shrink-0 w-16">{e.t}</span>
              <span className={`shrink-0 w-12 font-semibold ${LOG_TONES[e.level]}`}>{e.level}</span>
              <span className="shrink-0 w-24 text-zinc-500">{e.service}</span>
              <span className="text-zinc-200">{e.msg}</span>
              <span className="text-zinc-500 text-[10px]">{e.extra}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="border border-lime-400/40 bg-lime-400/5 p-3">
          <div className="text-lime-400 text-[10px] tracking-[0.25em] uppercase font-semibold mb-1.5"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            what logs tell you
          </div>
          <div className="text-zinc-200 text-[12px] leading-relaxed">
            Exact error messages with stack-trace fragments. Specific timestamps and request IDs. The narrative of WHAT happened to individual requests. Here: db pool waits started at 14:32:02, queries began timing out at 14:32:15, circuit breaker opened at 14:32:30.
          </div>
        </div>
        <div className="border border-rose-400/40 bg-rose-400/5 p-3">
          <div className="text-rose-400 text-[10px] tracking-[0.25em] uppercase font-semibold mb-1.5"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            what logs do NOT tell you
          </div>
          <div className="text-zinc-200 text-[12px] leading-relaxed">
            What does "normal" look like. How many requests succeeded vs failed. Whether the rate of errors is rising or steady. Where in the broader request flow the bottleneck lives. Logs are episodes; you cannot see the shape of the system from them.
          </div>
        </div>
      </div>
    </div>
  );
}

// Simple ASCII sparkline for the metrics view
function Sparkline({ data, height = 30, color = 'text-sky-300' }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const width = data.length * 6;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full"
      style={{ maxWidth: '100%' }}>
      <polyline
        points={data.map((v, i) => `${i * 6 + 3},${height - 2 - ((v - min) / range) * (height - 4)}`).join(' ')}
        fill="none"
        className={color}
        stroke="currentColor"
        strokeWidth={1.5}
      />
      {data.map((v, i) => (
        <circle key={i}
          cx={i * 6 + 3}
          cy={height - 2 - ((v - min) / range) * (height - 4)}
          r={1.5}
          className={color}
          fill="currentColor"
        />
      ))}
    </svg>
  );
}

function MetricsView() {
  // Simulated 14:25 → 14:35 (10 minute window, sample per minute = 11 points)
  const requestRate = [840, 850, 855, 845, 860, 855, 850, 845, 860, 855, 850];      // flat ~850 rpm
  const p99Latency  = [78,  82,  79,  80,  77,  79, 1800, 4200, 4100, 3800, 950];   // huge spike
  const errorRate   = [0.1, 0.2, 0.1, 0.2, 0.1, 0.2,  18,   34,    28,   22,    8]; // % errors
  const dbPoolUsed  = [12,  14,  13,  15,  14,  16,  20,   20,    20,   20,   18];  // saturated

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div className="border border-zinc-800 bg-zinc-950/60 p-3">
          <div className="flex items-center justify-between mb-1">
            <div className="text-zinc-400 text-[10px] tracking-[0.2em] uppercase"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              request rate (rpm)
            </div>
            <div className="text-sky-300 text-[11px] font-bold"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              ~850 (flat)
            </div>
          </div>
          <Sparkline data={requestRate} color="text-sky-300" />
        </div>
        <div className="border border-zinc-800 bg-zinc-950/60 p-3">
          <div className="flex items-center justify-between mb-1">
            <div className="text-zinc-400 text-[10px] tracking-[0.2em] uppercase"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              p99 latency (ms)
            </div>
            <div className="text-rose-300 text-[11px] font-bold"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              80 → 4200ms · SPIKE
            </div>
          </div>
          <Sparkline data={p99Latency} color="text-rose-300" />
        </div>
        <div className="border border-zinc-800 bg-zinc-950/60 p-3">
          <div className="flex items-center justify-between mb-1">
            <div className="text-zinc-400 text-[10px] tracking-[0.2em] uppercase"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              error rate (%)
            </div>
            <div className="text-rose-300 text-[11px] font-bold"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              0.1% → 34%
            </div>
          </div>
          <Sparkline data={errorRate} color="text-rose-300" />
        </div>
        <div className="border border-amber-400/40 bg-amber-400/5 p-3">
          <div className="flex items-center justify-between mb-1">
            <div className="text-amber-300 text-[10px] tracking-[0.2em] uppercase"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              db pool in-use (max 20)
            </div>
            <div className="text-amber-300 text-[11px] font-bold"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              SATURATED 14:32-14:35
            </div>
          </div>
          <Sparkline data={dbPoolUsed} color="text-amber-300" />
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="border border-lime-400/40 bg-lime-400/5 p-3">
          <div className="text-lime-400 text-[10px] tracking-[0.25em] uppercase font-semibold mb-1.5"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            what metrics tell you
          </div>
          <div className="text-zinc-200 text-[12px] leading-relaxed">
            The shape of the incident across the whole system. Request rate stayed flat (so it&apos;s NOT a traffic spike). p99 latency exploded 50×. Error rate climbed to 34%. The DB pool saturated right at the same moment. The hypothesis writes itself: the DB became the bottleneck without any change in load.
          </div>
        </div>
        <div className="border border-rose-400/40 bg-rose-400/5 p-3">
          <div className="text-rose-400 text-[10px] tracking-[0.25em] uppercase font-semibold mb-1.5"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            what metrics do NOT tell you
          </div>
          <div className="text-zinc-200 text-[12px] leading-relaxed">
            Which exact query. Whether a code change or external factor caused it. What individual requests experienced. Why the DB pool saturated — was it a slow query, a downstream timeout, or something else? Metrics give you the WHAT and WHEN; the WHY needs another pillar.
          </div>
        </div>
      </div>
    </div>
  );
}

// Trace Gantt-style visualization
const TRACE_SPANS = [
  { name: 'POST /api/orders',          start: 0,    duration: 4180, depth: 0, color: 'sky' },
  { name: 'middleware: auth',          start: 5,    duration: 8,    depth: 1, color: 'sky' },
  { name: 'middleware: rate-limit',    start: 14,   duration: 3,    depth: 1, color: 'sky' },
  { name: 'handler: createOrder',      start: 18,   duration: 4155, depth: 1, color: 'sky' },
  { name: 'validate request',          start: 19,   duration: 2,    depth: 2, color: 'sky' },
  { name: 'db: get_pool_connection',   start: 22,   duration: 4100, depth: 2, color: 'amber' },
  { name: 'db: INSERT orders',         start: 4122, duration: 35,   depth: 2, color: 'sky' },
  { name: 'queue: publish OrderCreated', start: 4158, duration: 18,depth: 2, color: 'sky' },
];

function TracesView() {
  const total = 4200;
  const SPAN_COLORS = {
    sky:   { bg: 'bg-sky-300/80',   border: 'border-sky-300',   text: 'text-zinc-900' },
    amber: { bg: 'bg-amber-400/90', border: 'border-amber-400', text: 'text-zinc-900' },
  };

  return (
    <div>
      <div className="border border-zinc-800 bg-zinc-950/60 p-3 mb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-zinc-500 text-[9.5px] tracking-[0.25em] uppercase flex items-center gap-1.5"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            <GitBranch size={11} /> trace · request tx_a14f9 · total 4180ms
          </div>
          <div className="text-rose-300 text-[10px]"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            98.1% of time in one span ▼
          </div>
        </div>
        <div className="space-y-1"
          style={{ fontFamily: 'JetBrains Mono, monospace' }}>
          {TRACE_SPANS.map((s, i) => {
            const leftPct = (s.start / total) * 100;
            const widthPct = Math.max((s.duration / total) * 100, 0.3);
            const color = SPAN_COLORS[s.color];
            return (
              <div key={i} className="grid grid-cols-[210px_1fr_60px] gap-2 items-center">
                <div className={`text-[10.5px] truncate ${s.depth > 0 ? 'pl-' + s.depth * 2 : ''} ${s.color === 'amber' ? 'text-amber-300 font-semibold' : 'text-zinc-300'}`}
                  style={{ paddingLeft: `${s.depth * 8}px` }}>
                  {s.depth > 0 ? '↳ ' : ''}{s.name}
                </div>
                <div className="relative h-4 bg-zinc-900 border border-zinc-800">
                  <div className={`absolute h-full ${color.bg} ${color.border} border`}
                    style={{ left: `${leftPct}%`, width: `${widthPct}%` }} />
                </div>
                <div className={`text-[10px] text-right ${s.color === 'amber' ? 'text-amber-300 font-semibold' : 'text-zinc-500'}`}>
                  {s.duration}ms
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-2 pt-2 border-t border-zinc-800 text-zinc-600 text-[10px]"
          style={{ fontFamily: 'JetBrains Mono, monospace' }}>
          time → 0ms .................................................... 4180ms
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="border border-lime-400/40 bg-lime-400/5 p-3">
          <div className="text-lime-400 text-[10px] tracking-[0.25em] uppercase font-semibold mb-1.5"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            what traces tell you
          </div>
          <div className="text-zinc-200 text-[12px] leading-relaxed">
            Exactly WHERE the slow request spent its time. <Kbd>db: get_pool_connection</Kbd> took 4100ms of the 4180ms total — 98.1% of latency, before any actual query ran. The bottleneck is not the query; it&apos;s WAITING for a connection. Combined with the metrics view (pool saturated), the root cause is now nailed: pool size 20 is too small for the load.
          </div>
        </div>
        <div className="border border-rose-400/40 bg-rose-400/5 p-3">
          <div className="text-rose-400 text-[10px] tracking-[0.25em] uppercase font-semibold mb-1.5"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            what traces do NOT tell you
          </div>
          <div className="text-zinc-200 text-[12px] leading-relaxed">
            How representative this trace is — was it one slow request or a thousand like it? Whether this pattern existed before the incident or only after. The full population context. Without sampling discipline, you also pay a fortune to keep traces for every request.
          </div>
        </div>
      </div>
    </div>
  );
}

function ThreePillarsComparison() {
  const [pillar, setPillar] = useState('logs');
  const current = PILLARS.find(p => p.id === pillar);

  return (
    <div className="my-6 border border-sky-300/30 bg-zinc-900/40">
      <div className="flex items-center justify-between bg-zinc-950 px-4 py-2.5 border-b border-sky-300/30">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-sky-300" />
          <span className="text-sky-300 text-[11px] tracking-[0.25em] uppercase font-semibold"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            interactive · three pillars comparison
          </span>
        </div>
      </div>

      <div className="p-4">
        {/* Incident header */}
        <div className="border border-rose-400/40 bg-rose-400/5 p-3 mb-4">
          <div className="text-rose-400 text-[10px] tracking-[0.25em] uppercase font-semibold mb-1 flex items-center gap-1.5"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            <AlertTriangle size={11} /> the incident
          </div>
          <div className="text-zinc-200 text-[13px] leading-relaxed">
            At 14:32 UTC, p99 latency on <Kbd>/api/orders</Kbd> spiked from 80ms to 4200ms.
            Error rate climbed from 0.1% to 34%. You&apos;re paged. Where do you look first?
          </div>
        </div>

        {/* Pillar tabs */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {PILLARS.map(p => {
            const Icon = p.icon;
            const isActive = pillar === p.id;
            return (
              <button key={p.id} onClick={() => setPillar(p.id)}
                className={`px-3 py-2 border transition-colors text-left ${
                  isActive
                    ? `${p.border} ${p.bg} ${p.color}`
                    : 'border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
                }`}
                style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                <div className="flex items-center gap-1.5 text-[12px] font-semibold">
                  <Icon size={13} />
                  {p.label}
                </div>
                <div className="text-[9.5px] opacity-80 mt-0.5">
                  {p.id === 'logs' && 'discrete events with context'}
                  {p.id === 'metrics' && 'aggregated time-series'}
                  {p.id === 'traces' && 'one request, all spans'}
                </div>
              </button>
            );
          })}
        </div>

        {/* View */}
        {pillar === 'logs' && <LogsView />}
        {pillar === 'metrics' && <MetricsView />}
        {pillar === 'traces' && <TracesView />}

        {/* Synthesis */}
        <div className="mt-4 border border-sky-300/50 bg-sky-300/10 p-3">
          <div className="text-sky-300 text-[10px] tracking-[0.25em] uppercase font-semibold mb-1.5 flex items-center gap-1.5"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            <CheckCircle2 size={11} /> the synthesis · combining all three
          </div>
          <div className="text-zinc-200 text-[12.5px] leading-relaxed">
            <strong className="text-sky-200">Logs</strong> gave you the error symptoms and the
            timeline. <strong className="text-sky-200">Metrics</strong> showed the shape — flat
            traffic but a saturated DB pool. <strong className="text-sky-200">Traces</strong>
            pinned the exact bottleneck — 98% of latency was waiting for a pool connection,
            not running queries. None of these alone would have given you the diagnosis: the
            DB pool size is too small for the load. The fix is one config change. The skill
            is reaching for all three pillars in the right order.
          </div>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Section content
// ───────────────────────────────────────────────────────────────────────

export default function Section01_ThreePillars() {
  return (
    <>
      <SectionLabel>section 01</SectionLabel>
      <h2 className="text-zinc-50 text-[28px] leading-tight mb-3"
        style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 600 }}>
        The three pillars — and why you need all of them
      </h2>
      <P>
        Atlas 17-19 covered building APIs. Atlas 20-22 covered the data layer underneath. This
        atlas opens a new arc — running what you built. You can have correctly-designed APIs,
        perfectly-tuned databases, and elegant event-driven flows; if you cannot see what is
        actually happening when production breaks, none of that matters at 3 AM. Observability
        is the discipline of building systems you can debug from the outside.
      </P>

      <H2 num="◇ 01">Observability is not monitoring</H2>
      <P>
        The distinction matters because the words get confused. The cleanest framing comes from
        control theory (where the term "observability" originates):
      </P>
      <Code id="observability-vs-monitoring" lang="text">{`MONITORING:
   Continuous collection of pre-defined signals from a system.
   You decide in advance: "watch CPU, latency, error rate, queue depth."
   Alert when these cross thresholds.

   Good for KNOWN failure modes. Useless against the unknown.

OBSERVABILITY:
   The property of a system that lets you ask arbitrary questions about
   its internal state from outside, without changing the code.

   Includes monitoring, but extends to: "WHY did p99 latency spike at
   14:32?" "Which customer's request caused the surge?" "What was the
   memory layout when the OOM happened?"

   Good for UNKNOWN failure modes — which is most production outages.

THE TEST: can you answer a NEW question about your production system in the
next 5 minutes? If yes, your system is observable. If you have to ship a
code change to add instrumentation first, you have monitoring, not
observability.`}</Code>

      <H2 num="◇ 02">The three pillars defined</H2>
      <Code id="three-pillars" lang="text">{`LOGS                                      METRICS
────                                      ───────
Discrete events with context.             Numeric time-series, aggregated.
Each entry: timestamp + structured data.  Each datapoint: timestamp + value(s).
Cardinality: HIGH (one per event).        Cardinality: BOUNDED (label combinations).
Storage: expensive — keep everything.     Storage: cheap — pre-aggregated.
Best for: WHAT happened to this request.  Best for: HOW IS the system trending.

TRACES
──────
One request's path across services, with timing per step (each step = a span).
Each span: timestamp + duration + service + operation + parent_span + tags.
Cardinality: per-request (one trace per request, but sampled in practice).
Storage: very expensive — sample aggressively.
Best for: WHERE in the request did the time go (or the error happen).`}</Code>

      <H2 num="◇ 03">Why no single pillar is enough</H2>
      <P>
        Each pillar has a blind spot. The art of debugging production is knowing which to reach
        for first — and which to reach for next when the first one runs out of information.
      </P>
      <ul className="text-zinc-300 text-[15px] leading-relaxed my-3 list-disc pl-6 space-y-2 max-w-prose">
        <li>
          <strong className="text-amber-300">Logs alone:</strong> you have errors, but you do not know how many succeeded; you do not know if this is normal noise or a real spike; you cannot tell where in the request the failure happened if your services do not propagate context.
        </li>
        <li>
          <strong className="text-sky-300">Metrics alone:</strong> you can see the shape of the incident — latency, error rate, throughput — but not the specific cause. You see the DB pool saturated; you do not see which query caused it.
        </li>
        <li>
          <strong className="text-lime-300">Traces alone:</strong> you can see one slow request in beautiful detail. You cannot tell if it is representative or a singular outlier. You also cannot keep traces for every request in production without paying more for observability than for compute.
        </li>
      </ul>
      <Callout kind="signal" title="THE COMBINATION IS THE WORKFLOW">
        Production debugging usually goes: <strong className="text-sky-200">metrics tell you
        WHEN and HOW BAD</strong> (the dashboard says p99 latency spiked at 14:32). <strong className="text-sky-200">Logs tell you WHAT</strong> (errors say "db pool exhausted").
        <strong className="text-sky-200"> Traces tell you WHERE</strong> (98% of slow-request
        time was waiting for a pool connection). The diagnosis emerges from combining all
        three — and from connecting them via shared identifiers (trace IDs in logs,
        exemplars linking metrics to traces).
      </Callout>

      <H2 num="◇ 04">MELT — the expanded four-signal model</H2>
      <P>
        The "three pillars" model is canonical but slightly outdated. The modern framing — used
        by the OpenTelemetry project and adopted broadly — adds a fourth: events. The acronym
        is MELT.
      </P>
      <Code id="melt" lang="text">{`M  METRICS    Aggregated numeric time-series.
               (request rate, p99 latency, error rate, queue depth)

E  EVENTS     Discrete, well-defined occurrences with rich context.
               (deployment happened, feature flag flipped, user signed up,
                config changed, scaling event triggered)
               
               Events are different from logs: they describe what HAPPENED at
               the business or system level, not what a log line was emitted.
               Events have schemas; logs often do not.

L  LOGS       Unstructured or semi-structured text with timestamps.
               (everything from print statements to JSON-formatted application
                logs)

T  TRACES     Per-request, multi-span causal chains.
               (the full timeline of one request across services)

Events are the newest addition. They turn out to be vital for correlation:
"the deployment at 14:31 caused the latency spike at 14:32" is impossible
to assert without an event saying "deployment at 14:31." Most teams just
emit these as log entries; treating them as a separate signal makes
correlation queries (deployment → latency change) much easier.`}</Code>

      <H2 num="◇ 05">Cardinality — the budget that determines cost</H2>
      <P>
        Every label and dimension you add to your observability data is a cost. Cardinality is
        the number of unique combinations of label values. Low cardinality is cheap; high
        cardinality is exponentially expensive — and the most common production blow-up.
      </P>
      <Code id="cardinality" lang="text">{`A METRIC LIKE:
    http_requests_total{method, status, endpoint, region}

With:
    method   ∈ {GET, POST, PUT, DELETE, PATCH}            → 5
    status   ∈ {200, 400, 401, 403, 404, 500, 502, 503}    → 8
    endpoint ∈ {/api/orders, /api/users, ...}              → 50
    region   ∈ {us-east-1, us-west-2, eu-central-1, ap-1}  → 4

Total cardinality: 5 × 8 × 50 × 4 = 8,000 series.
On a typical metrics backend, each series costs ~$10/year. Total: $80K/year.

ADD ONE BAD LABEL:
    http_requests_total{method, status, endpoint, region, user_id}

With user_id ∈ {1, 2, 3, ..., 5,000,000 unique users}:

  Total cardinality: 8,000 × 5,000,000 = 40 BILLION series.
  Estimated cost: more than your AWS bill.
  
  Your metrics backend will either drop data, charge you a fortune, or
  refuse to ingest. This is the canonical observability blow-up.

THE RULE: NEVER use unbounded values (user_id, request_id, IP, URL with
query strings) as METRIC labels. That is what LOGS and TRACES are for —
those are designed for high cardinality.`}</Code>

      <SectionLabel>practice</SectionLabel>
      <H2 num="◇ 06">See the same incident through three lenses</H2>
      <P>
        One incident, three views. Click each pillar tab to see what it reveals — and the
        explicit callout for what it does NOT reveal. The synthesis panel at the bottom shows
        what you only get by combining all three.
      </P>

      <ThreePillarsComparison />

      <H2 num="◇ 07">Correlating the three — trace IDs as the connective tissue</H2>
      <P>
        The pillars are most useful when they are CONNECTED. The standard mechanism: every
        request gets a trace ID assigned at the edge (load balancer, gateway, first service).
        This ID flows with the request through every downstream call. Every log line and
        metric exemplar references it. Result: from any log entry you can jump to the trace;
        from any trace span you can find the related logs; from a slow request in metrics
        you can pick an exemplar trace.
      </P>
      <Code id="trace-id-correlation" lang="json">{`# A typical structured log entry with trace context
{
  "ts":        "2026-01-15T14:32:15.234Z",
  "level":     "ERROR",
  "service":   "orders-api",
  "msg":       "db query timeout",
  "trace_id":  "a3f9e2c8b1d4f5a6e7d2c4b8a9f3e1d2",     # ← the connector
  "span_id":   "9f3a2c8b1d4f5a6e",
  "query":     "SELECT_orders",
  "user_id":   4242,
  "duration_ms": 3000
}

# Click the trace_id in your log viewer → opens the trace in Jaeger/Zipkin/Tempo
# Click "show logs" in your trace viewer → filters logs by this trace_id
# Click an exemplar dot on a metric chart → jumps to a representative trace
# Click "show metrics" from a trace → shows the relevant aggregate metrics`}</Code>

      <H2 num="◇ 08">The observability stack — what to use</H2>
      <Code id="obs-stack" lang="text">{`OPEN SOURCE / SELF-HOSTED              MANAGED SAAS
────────────────────────              ────────────
Logs:    Loki, Elasticsearch          Datadog Logs, Splunk, Sumo, Better Stack
         (with FluentBit, Vector,
         Logstash for shipping)
                                      
Metrics: Prometheus + Grafana         Datadog Metrics, New Relic, Honeycomb,
         (Mimir/Thanos for HA)         Chronosphere, AWS CloudWatch
                                      
Traces:  Jaeger, Tempo, Zipkin         Datadog APM, Honeycomb, Lightstep,
                                      AWS X-Ray, New Relic APM

Events:  Often emitted as logs and    Most managed platforms have event types
         filtered by attributes        as first-class objects now

INSTRUMENTATION: OpenTelemetry (OTel) is the standard. All managed vendors
accept OTel-format data. Self-hosted stacks ingest OTel natively. Use it
for new code regardless of where the data ends up.

THE COST REALITY: a managed observability bill for a moderately busy service
can easily exceed the compute bill. Spending on observability is investment;
not spending on it is debt. Budget 10-20% of compute spend for observability,
and watch it carefully — cardinality blow-ups will spike the bill silently.`}</Code>

      <H2 num="◇ 09">Hardening checklist for observability foundations</H2>
      <ul className="text-zinc-300 text-[15px] leading-relaxed my-3 list-disc pl-6 space-y-1.5 max-w-prose">
        <li>✓ All three pillars instrumented (not just logs)</li>
        <li>✓ Trace IDs propagated through every service boundary (no "broken traces")</li>
        <li>✓ Logs include trace_id and span_id by default — emitted via shared logging helper</li>
        <li>✓ Cardinality of every metric label reviewed before deployment</li>
        <li>✓ NO user_id, request_id, URL-with-query, IP, or any unbounded value used as a metric label</li>
        <li>✓ OpenTelemetry used for all new instrumentation regardless of vendor</li>
        <li>✓ Sampling strategy explicit per pillar — logs (usually full), metrics (full), traces (sampled)</li>
        <li>✓ Observability cost tracked as a budget line — and monitored for cardinality-driven spikes</li>
        <li>✓ Dashboards include "events" annotations (deploys, flag flips, config changes)</li>
        <li>✓ On-call runbook starts with "open the metrics dashboard for the service" — not "ssh into a host"</li>
      </ul>
      <Callout kind="info" title="WHAT'S NEXT">
        Section 02 goes deep on the logs pillar — structured logging schemas, log levels done
        right, sampling at the source, the aggregation stacks that actually work at scale,
        and the operational discipline that keeps a logging bill from becoming a budget
        emergency.
      </Callout>
    </>
  );
}
