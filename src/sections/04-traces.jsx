/* Section 04 — Distributed Traces.
 * Closes Atlas 23 and opens the rest of the operations arc.
 *
 * Prose + Distributed Trace Explorer + atlas-closing + arc-preview.
 *
 * The explorer: a real-shaped multi-service trace for POST /checkout.
 * 14 spans across 8 services, total ~1480ms. The tax-service span is
 * the bottleneck (1200ms, 81% of total) — and drilling in shows the
 * slowness is an external API call to Avalara. The user clicks any
 * span to see its details and watches how the Gantt chart makes a
 * cross-service problem immediately diagnosable in a way logs never
 * could.
 *
 * All prose strings use backticks (template literals).
 */

import { useState } from 'react';
import { Sparkles, GitBranch, AlertTriangle, CheckCircle2, Layers, Compass } from 'lucide-react';
import { Code, Callout, H2, P, Kbd, SectionLabel } from '../components/primitives.jsx';

// ───────────────────────────────────────────────────────────────────────
// Distributed Trace Explorer
// ───────────────────────────────────────────────────────────────────────

const TRACE_TOTAL = 1480;  // ms

const SPANS = [
  { id: 'root', name: 'POST /checkout',          service: 'api-gateway',  start: 0,    duration: 1480, parent: null,    depth: 0, color: 'sky',
    attrs: { 'http.method': 'POST', 'http.route': '/checkout', 'http.status_code': 200, 'user.id': 'usr_4242' } },
  { id: 'auth', name: 'POST /verify',             service: 'auth-svc',     start: 5,    duration: 25,   parent: 'root',  depth: 1, color: 'sky',
    attrs: { 'auth.method': 'jwt', 'auth.result': 'ok', 'http.status_code': 200 } },
  { id: 'cart', name: 'GET /cart/usr_4242',       service: 'cart-svc',     start: 35,   duration: 40,   parent: 'root',  depth: 1, color: 'sky',
    attrs: { 'cart.items': 4, 'http.status_code': 200 } },
  { id: 'cart-db', name: 'redis HGETALL',         service: 'redis',        start: 38,   duration: 10,   parent: 'cart',  depth: 2, color: 'sky',
    attrs: { 'db.system': 'redis', 'db.statement': 'HGETALL cart:usr_4242' } },
  { id: 'inv',  name: 'POST /check-stock',        service: 'inventory-svc',start: 80,   duration: 50,   parent: 'root',  depth: 1, color: 'sky',
    attrs: { 'items.checked': 4, 'items.in_stock': 4, 'http.status_code': 200 } },
  { id: 'inv-db', name: 'pg SELECT inventory',    service: 'postgres',     start: 88,   duration: 35,   parent: 'inv',   depth: 2, color: 'sky',
    attrs: { 'db.system': 'postgresql', 'db.rows': 4 } },
  { id: 'price', name: 'POST /compute-price',     service: 'pricing-svc',  start: 135,  duration: 20,   parent: 'root',  depth: 1, color: 'sky',
    attrs: { 'subtotal_cents': 8432, 'discounts_applied': 1, 'http.status_code': 200 } },
  { id: 'tax',  name: 'POST /compute-tax',        service: 'tax-svc',      start: 160,  duration: 1200, parent: 'root',  depth: 1, color: 'amber',
    bottleneck: true,
    attrs: { 'tax.jurisdiction': 'US-FL', 'http.status_code': 200, '⚠ duration_ms': '1200ms — 81% of total trace' } },
  { id: 'tax-ext', name: 'GET avalara.com/rates', service: 'tax-svc',      start: 165,  duration: 1190, parent: 'tax',   depth: 2, color: 'amber',
    bottleneck: true,
    attrs: { 'http.url': 'https://api.avalara.com/v2/rates', 'http.method': 'GET', 'http.status_code': 200, '⚠ external_dependency': 'Avalara — known latency variance', 'retry.count': 0 } },
  { id: 'pay',  name: 'POST /authorize',          service: 'payment-svc',  start: 1365, duration: 60,   parent: 'root',  depth: 1, color: 'sky',
    attrs: { 'payment.method': 'card', 'payment.amount_cents': 9120, 'http.status_code': 200 } },
  { id: 'pay-ext', name: 'POST stripe.com/charge',service: 'payment-svc',  start: 1370, duration: 50,   parent: 'pay',   depth: 2, color: 'sky',
    attrs: { 'http.url': 'https://api.stripe.com/v1/charges', 'http.status_code': 200, 'payment.id': 'ch_3R...' } },
  { id: 'order', name: 'POST /save-order',        service: 'order-svc',    start: 1430, duration: 30,   parent: 'root',  depth: 1, color: 'sky',
    attrs: { 'order.id': 'ord_xyz123', 'order.items': 4, 'http.status_code': 201 } },
  { id: 'order-db', name: 'pg INSERT orders',     service: 'postgres',     start: 1432, duration: 20,   parent: 'order', depth: 2, color: 'sky',
    attrs: { 'db.system': 'postgresql', 'db.statement': 'INSERT INTO orders ...', 'db.rows_affected': 1 } },
  { id: 'notif', name: 'POST /queue-email',       service: 'notif-svc',    start: 1465, duration: 12,   parent: 'root',  depth: 1, color: 'sky',
    attrs: { 'email.template': 'order_confirmation', 'queue.name': 'emails', 'http.status_code': 202 } },
];

const SPAN_COLORS = {
  sky:   { bg: 'bg-sky-300/70',   border: 'border-sky-300',   text: 'text-zinc-200' },
  amber: { bg: 'bg-amber-400/90', border: 'border-amber-400', text: 'text-amber-200' },
};

function DistributedTraceExplorer() {
  const [selectedId, setSelectedId] = useState('tax-ext');  // start on the bottleneck child
  const selected = SPANS.find(s => s.id === selectedId);

  return (
    <div className="my-6 border border-sky-300/30 bg-zinc-900/40">
      <div className="flex items-center justify-between bg-zinc-950 px-4 py-2.5 border-b border-sky-300/30">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-sky-300" />
          <span className="text-sky-300 text-[11px] tracking-[0.25em] uppercase font-semibold"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            interactive · distributed trace explorer
          </span>
        </div>
      </div>

      <div className="p-4">
        {/* Trace metadata */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          <div className="border border-zinc-800 bg-zinc-950/60 p-2">
            <div className="text-zinc-500 text-[9px] tracking-[0.25em] uppercase"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}>trace_id</div>
            <div className="text-zinc-200 text-[10.5px]"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}>a3f9e2c8…f3e1d2</div>
          </div>
          <div className="border border-zinc-800 bg-zinc-950/60 p-2">
            <div className="text-zinc-500 text-[9px] tracking-[0.25em] uppercase"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}>total</div>
            <div className="text-zinc-100 text-[13px] font-bold"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}>1480ms</div>
          </div>
          <div className="border border-zinc-800 bg-zinc-950/60 p-2">
            <div className="text-zinc-500 text-[9px] tracking-[0.25em] uppercase"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}>spans</div>
            <div className="text-zinc-100 text-[13px] font-bold"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}>14</div>
          </div>
          <div className="border border-amber-400/40 bg-amber-400/5 p-2">
            <div className="text-amber-400 text-[9px] tracking-[0.25em] uppercase"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}>bottleneck</div>
            <div className="text-amber-300 text-[11.5px] font-semibold"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}>tax-svc · 81%</div>
          </div>
        </div>

        {/* Gantt chart */}
        <div className="border border-zinc-800 bg-zinc-950/80 p-3 mb-3">
          <div className="text-zinc-500 text-[9.5px] tracking-[0.25em] uppercase mb-2 flex items-center gap-1.5"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            <GitBranch size={11} /> span tree · click any span for details
          </div>
          <div className="space-y-0.5"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            {SPANS.map(s => {
              const leftPct = (s.start / TRACE_TOTAL) * 100;
              const widthPct = Math.max((s.duration / TRACE_TOTAL) * 100, 0.4);
              const colorCfg = SPAN_COLORS[s.color];
              const isSelected = s.id === selectedId;
              return (
                <button key={s.id}
                  onClick={() => setSelectedId(s.id)}
                  className={`w-full grid grid-cols-[180px_1fr_55px] sm:grid-cols-[210px_1fr_60px] gap-2 items-center py-0.5 px-1 text-left transition-colors ${
                    isSelected ? 'bg-sky-300/10 ring-1 ring-sky-300/40' : 'hover:bg-zinc-900/50'
                  }`}>
                  <div className={`text-[10px] truncate ${s.bottleneck ? colorCfg.text + ' font-semibold' : 'text-zinc-300'}`}
                    style={{ paddingLeft: `${s.depth * 10}px` }}>
                    {s.depth > 0 ? '↳ ' : ''}<span className="text-zinc-500">[{s.service}]</span> {s.name}
                  </div>
                  <div className="relative h-3.5 bg-zinc-900 border border-zinc-800">
                    <div className={`absolute h-full ${colorCfg.bg} ${colorCfg.border} border`}
                      style={{ left: `${leftPct}%`, width: `${widthPct}%` }} />
                  </div>
                  <div className={`text-[9.5px] text-right ${s.bottleneck ? 'text-amber-300 font-semibold' : 'text-zinc-500'}`}>
                    {s.duration}ms
                  </div>
                </button>
              );
            })}
          </div>
          <div className="mt-2 pt-2 border-t border-zinc-800 text-zinc-600 text-[9.5px] flex justify-between"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            <span>0ms</span><span>time →</span><span>1480ms</span>
          </div>
        </div>

        {/* Span details */}
        <div className={`border ${selected.bottleneck ? 'border-amber-400/50 bg-amber-400/5' : 'border-zinc-800 bg-zinc-900/40'} p-3 mb-3`}>
          <div className="flex items-center justify-between mb-2">
            <div className={`text-[10px] tracking-[0.25em] uppercase font-semibold flex items-center gap-1.5 ${
              selected.bottleneck ? 'text-amber-400' : 'text-sky-300'
            }`} style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              {selected.bottleneck && <AlertTriangle size={11} />}
              span details · {selected.id}
            </div>
            <div className="text-zinc-500 text-[9.5px]"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              {selected.duration}ms · starts at {selected.start}ms
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 text-[11px]"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            <div className="flex justify-between border-b border-zinc-800 pb-1">
              <span className="text-zinc-500">name</span>
              <span className="text-zinc-200">{selected.name}</span>
            </div>
            <div className="flex justify-between border-b border-zinc-800 pb-1">
              <span className="text-zinc-500">service</span>
              <span className="text-zinc-200">{selected.service}</span>
            </div>
            <div className="flex justify-between border-b border-zinc-800 pb-1">
              <span className="text-zinc-500">parent</span>
              <span className="text-zinc-200">{selected.parent || '(root)'}</span>
            </div>
            <div className="flex justify-between border-b border-zinc-800 pb-1">
              <span className="text-zinc-500">depth</span>
              <span className="text-zinc-200">{selected.depth}</span>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-zinc-800">
            <div className="text-zinc-500 text-[9.5px] tracking-[0.25em] uppercase mb-1"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              attributes
            </div>
            <div className="space-y-0.5 text-[10.5px]"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              {Object.entries(selected.attrs).map(([k, v]) => (
                <div key={k} className="flex gap-2 items-start">
                  <span className={`shrink-0 ${k.startsWith('⚠') ? 'text-amber-400 font-semibold' : 'text-zinc-500'}`}>
                    {k}
                  </span>
                  <span className="text-zinc-600">=</span>
                  <span className={k.startsWith('⚠') ? 'text-amber-200' : 'text-zinc-300'}>
                    {String(v)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Synthesis */}
        <div className="border border-sky-300/50 bg-sky-300/10 p-3">
          <div className="text-sky-300 text-[10px] tracking-[0.25em] uppercase font-semibold mb-1.5 flex items-center gap-1.5"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            <Compass size={11} /> what the trace tells you
          </div>
          <div className="text-zinc-200 text-[12.5px] leading-relaxed">
            The diagnosis is immediate from the Gantt chart. <Kbd>tax-svc</Kbd> took 1200ms of
            the 1480ms total — 81% of latency. Drilling into the child span reveals the
            slowness: an external API call to <Kbd>api.avalara.com/rates</Kbd>. The fix is
            obvious: add caching, set a tighter timeout, or use an async tax-quote that does
            not block checkout. Without traces, the symptoms would have been "checkout is
            slow" in metrics and "tax-service had a slow request" in logs. The trace shows
            you WHY and WHERE in one view — and confirms that the other seven services are
            fine.
          </div>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Section content
// ───────────────────────────────────────────────────────────────────────

export default function Section04_Traces() {
  return (
    <>
      <SectionLabel>section 04</SectionLabel>
      <h2 className="text-zinc-50 text-[28px] leading-tight mb-3"
        style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 600 }}>
        Distributed traces — the per-request causal chain
      </h2>
      <P>
        Logs answer "what happened to this request?" Metrics answer "how is the system
        trending?" Traces answer a different question that neither one can: "where did this
        ONE request spend its time, across all the services it touched?" In a monolith you
        could read a stack trace; in a distributed system you need traces, which are stack
        traces stretched across machines. Most production debugging in a microservice
        environment starts with a slow trace.
      </P>

      <H2 num="◇ 01">What a trace is — root span and child spans</H2>
      <P>
        A trace represents one logical operation — a user request, a background job, a
        message-handler invocation. It is composed of SPANS, each representing a unit of
        work. Spans nest: a child span is part of its parent span. Every span carries the
        same <Kbd>trace_id</Kbd>; its own <Kbd>span_id</Kbd> and the <Kbd>parent_span_id</Kbd>
        of its caller form the causal chain.
      </P>
      <Code id="span-model" lang="text">{`A SPAN HAS:
   trace_id         The trace this span belongs to (same for every span in trace)
   span_id          This span's unique ID
   parent_span_id   The span that caused this one (NULL for the root)
   name             Operation name ("POST /checkout", "db SELECT users")
   start_time       Unix timestamp with microsecond precision
   duration         How long the operation took (in microseconds)
   attributes       Key-value tags (http.method, db.statement, user.id, ...)
   events           Time-stamped log-like entries within the span
   status           OK / ERROR / UNSET

A TRACE IS:
   The DAG (directed acyclic graph) of all spans sharing a trace_id, reconstructed
   from the parent_span_id links. Visualized as a Gantt chart by every trace
   viewer — Jaeger, Tempo, Datadog APM, Honeycomb, X-Ray, etc.

   Total trace duration = root span duration. The root is the outermost call
   (typically the HTTP request handler at the API gateway or first service).`}</Code>

      <H2 num="◇ 02">Why traces beat logs for cross-service debugging</H2>
      <P>
        In a microservice architecture, a single user request can touch 10-50 services. Logs
        scatter across all of them. To reconstruct what happened, you would need to grep N
        log streams and stitch entries by timestamp and trace_id — assuming the trace_id is
        even propagated correctly. Traces do this stitching for you, automatically.
      </P>
      <Code id="why-traces-win" lang="text">{`THE SCENARIO: user reports "checkout is slow." 1480ms response time.

WITH LOGS ONLY:
   1. Find logs for the user's request (search by user_id or trace_id)
   2. Each service emitted ~10 lines for this request → 80+ lines total
   3. Sort by timestamp across 8 services with potentially-skewed clocks
   4. Manually compute: which service held the request longest?
   5. Time-to-diagnosis: 15-30 minutes if you are lucky.

WITH TRACES:
   1. Open the trace by ID (or pick one slow trace from an exemplar)
   2. See the Gantt chart. Visual scan: the tax-service span is HUGE.
   3. Drill into it. External API call to Avalara — 1190ms.
   4. Time-to-diagnosis: 30 seconds.

THE DIFFERENCE IS THE SHAPE. Logs are a sorted list of moments. Traces
are a tree of nested durations. Latency problems are tree-shaped; logs
flatten them into something hard to read.`}</Code>

      <H2 num="◇ 03">Context propagation — how trace_id moves between services</H2>
      <P>
        The trace_id has to flow with the request across every service boundary. The W3C
        Trace Context specification standardizes this via two HTTP headers:
        <Kbd>traceparent</Kbd> and <Kbd>tracestate</Kbd>. Modern instrumentation libraries
        inject these automatically.
      </P>
      <Code id="traceparent-header" lang="text">{`# Every outbound HTTP request from an instrumented service includes:

traceparent: 00-a3f9e2c8b1d4f5a6e7d2c4b8a9f3e1d2-9f3a2c8b1d4f5a6e-01
             │  │                                │                │
             │  │                                │                └─ trace flags (sampled=01)
             │  │                                └─ parent span_id (16 hex chars)
             │  └─ trace_id (32 hex chars)
             └─ version (currently 00)

THE FLOW:
   1. API gateway receives request, generates a trace_id, creates root span.
   2. Gateway calls tax-service. Outbound request includes traceparent header
      with the new trace_id and gateway's span_id as the parent.
   3. Tax-service receives, extracts traceparent, creates a child span using
      the existing trace_id and parent_span_id.
   4. Tax-service calls Avalara externally. The OUTBOUND request includes
      traceparent — Avalara might ignore it, but if they were instrumented
      compatibly, the chain would extend.

PROPAGATION GAPS ARE THE #1 TRACE BUG. If service B does not pass the
traceparent header through, its calls to C, D, E will start NEW traces
that look orphan-rooted. The Gantt chart looks broken: the parent ends
where service A finished and you cannot see what B/C/D/E did.

ALWAYS use OpenTelemetry's instrumentation libraries — they inject and
extract traceparent automatically across HTTP, gRPC, Kafka, etc.`}</Code>

      <H2 num="◇ 04">OpenTelemetry — the standard you should be using</H2>
      <P>
        OpenTelemetry (OTel) is the merger of OpenTracing and OpenCensus. It is now the
        industry-standard instrumentation framework, hosted by the CNCF, and supported by
        essentially every observability vendor. The architecture has three parts.
      </P>
      <Code id="otel-architecture" lang="text">{`OTEL ARCHITECTURE:

   1. THE API
       Programming-language SDKs for instrumenting code.
       Stable API: tracer.start_span(name) { ... }
       Vendor-neutral: same code works with any backend.

   2. THE SDK
       Processes spans within the process: sampling decisions, batching,
       attribute enrichment, span exporting.

   3. THE COLLECTOR
       A separate process (sidecar, daemon, or central gateway) that:
         - RECEIVERS:  ingest from OTLP, Jaeger, Zipkin, Prometheus, etc.
         - PROCESSORS: tail-sample, redact PII, batch, attribute
         - EXPORTERS:  send to Tempo, Jaeger, Datadog, Honeycomb, ...

DEPLOYMENT PATTERNS:

   AGENT MODE          COLLECTOR AS SIDECAR     CENTRAL GATEWAY
   ──────────          ────────────────────     ───────────────
   Apps export             App ─► sidecar         All apps ─► gateway ─► backends
   directly to        ──►  sidecar ─► backend         ─► backend
   the backend.
                       Process-local           Central concentration point.
   Simple. Higher      buffering and           Easier policy management
   cardinality risk    enrichment.             (sampling, redaction).
                                                Single point of failure if not HA.

A typical production setup uses an OTel agent on each host/pod that ships to a
small fleet of central collectors, which apply tail-sampling and ship to the
backend of choice.`}</Code>

      <H2 num="◇ 05">Sampling — head-based vs tail-based</H2>
      <P>
        Tracing every request in production is expensive — both in CPU on each service and
        in storage at the backend. Sampling is non-optional at scale. Two flavors, each
        suited to different needs.
      </P>
      <Code id="sampling-strategies" lang="text">{`HEAD-BASED SAMPLING
   The sampling decision is made at the ROOT span — typically at the API
   gateway, before any work is done. Once made, the decision propagates with
   the trace context (the traceparent's "sampled" flag).

   + Cheap: a sampled-out trace produces no spans, no CPU cost
   + Consistent: an entire trace is either fully traced or not at all
   - Random: you might sample out an interesting trace and sample IN a
     boring one

   Use head-based with a low rate (1-10%) when you mostly want representative
   samples for analytics and you don't need to capture every error.

TAIL-BASED SAMPLING
   The sampling decision is made AFTER the entire trace is complete. The OTel
   collector buffers all spans for some window (typically 30-60 seconds), then
   inspects the completed trace and decides whether to keep it.

   + Targeted: keep ALL traces that errored, exceeded a latency threshold, or
     touched specific code paths
   + Discard most "normal" traces — high signal-to-noise ratio
   - Expensive infrastructure: the collector must buffer everything,
     reassemble traces, and decide quickly
   - Tail sampling can drop spans if they arrive after the buffer window
     (the dreaded "out-of-order span" problem)

   Use tail-based when you can afford the infrastructure — Honeycomb, Datadog,
   Tempo with tail sampling all support it.

THE TYPICAL PRODUCTION RECIPE:
   Head sample at 100% in dev, 10% in staging, 1-5% in prod for "normal"
   traffic. Tail-sample 100% of errors, 100% of slow requests (> p99),
   100% of specific high-value endpoints. End result: ~5-10% effective
   sample rate but with all the important traces retained.`}</Code>
      <Callout kind="signal" title="THE EXEMPLAR PATTERN">
        Metrics histograms can include "exemplars" — pointers to specific sampled traces that
        contributed to each bucket. Click a tall bar in a p99 latency histogram → jump
        directly to a real example trace that fell in that bucket. This is the killer feature
        that turns metrics and traces from "separate pillars" into "one workflow." Supported
        natively by Grafana, Honeycomb, Datadog, and Tempo.
      </Callout>

      <H2 num="◇ 06">The cost reality of distributed tracing</H2>
      <P>
        Traces are by far the most expensive of the three pillars to operate. Each request can
        generate 20+ spans; each span has timestamp, duration, attributes — typically 1-2 KB
        per span. A million requests per day at 20 spans each = 20-40 GB of span data daily.
        Multiply by retention, redundancy, query overhead.
      </P>
      <Code id="trace-cost" lang="text">{`THE BUDGET MATH:

   1M req/day × 20 spans × 1.5KB = 30 GB/day
   30 GB/day × 30 days = 900 GB/month (with no retention discount)
   At managed APM prices ($1-5/GB ingested): $900 - $4,500/month per million daily requests

   For a busy service at 100M req/day: $90K - $450K/month JUST for traces.

THIS IS WHY EVERYONE SAMPLES. The 1-5% head-sample + 100% errors/slow tail-sample
pattern brings effective cost down 10-20x while keeping all the important data.

THE TRADE TO BE EXPLICIT ABOUT:
   100% tracing: every request traceable forever — premium $$$
   100% errors + 5% sample: every error traceable, representative samples otherwise — typical
   100% errors + 1% sample: budget option — works for high-traffic services
   No tracing: monitoring without observability — common, regrettable

A FRUGAL ALTERNATIVE: self-hosted Tempo + Grafana on cheap object storage.
Tempo stores traces in S3/GCS rather than expensive databases. At hyperscale,
this can be 1/10th the cost of managed APM with equivalent functionality.`}</Code>

      <SectionLabel>practice</SectionLabel>
      <H2 num="◇ 07">Explore a real-shaped trace</H2>
      <P>
        A POST <Kbd>/checkout</Kbd> request fanning out to 8 services across 14 spans, totaling
        1480ms. Click any span to see its full details — name, service, parent, attributes.
        The tax-service span tells the story; drill into its child to find the actual cause.
        This is what an on-call engineer sees when they open a slow trace in Jaeger / Tempo /
        Datadog APM. The shape gives the diagnosis.
      </P>

      <DistributedTraceExplorer />

      <H2 num="◇ 08">Where traces ship in production</H2>
      <ul className="text-zinc-300 text-[15px] leading-relaxed my-3 list-disc pl-6 space-y-2 max-w-prose">
        <li><strong className="text-sky-300">Jaeger</strong> — CNCF graduated; the open-source classic. Self-hostable, Cassandra/Elastic backend. The "default" if you are doing it yourself without preference.</li>
        <li><strong className="text-sky-300">Grafana Tempo</strong> — newer, S3/GCS-backed (cheap). Integrates tightly with Grafana dashboards and Loki logs. Increasingly the self-hosted default.</li>
        <li><strong className="text-sky-300">Honeycomb</strong> — managed, opinionated, designed for high-cardinality. The "events as the unit of observability" framing. Beloved by SRE-heavy teams.</li>
        <li><strong className="text-sky-300">Datadog APM</strong> — managed, integrated with Datadog Metrics/Logs. Easiest "all in one" experience; correspondingly expensive.</li>
        <li><strong className="text-sky-300">AWS X-Ray</strong> — managed by AWS, integrates with AWS services natively. Cheap and easy if you are AWS-native; limited beyond the AWS perimeter.</li>
        <li><strong className="text-sky-300">Lightstep / Splunk Observability</strong> — enterprise; deep root-cause-analysis features; correspondingly enterprise pricing.</li>
        <li><strong className="text-sky-300">Zipkin</strong> — Twitter&apos;s original (2012); still in use; smaller ecosystem than Jaeger now but battle-tested.</li>
        <li><strong className="text-sky-300">SigNoz / OpenObserve</strong> — newer open-source unified observability stacks (metrics + logs + traces in one product); ClickHouse-backed for cost efficiency.</li>
      </ul>

      <H2 num="◇ 09">Hardening checklist for distributed traces</H2>
      <ul className="text-zinc-300 text-[15px] leading-relaxed my-3 list-disc pl-6 space-y-1.5 max-w-prose">
        <li>✓ ALL services instrumented with OpenTelemetry (or compatible) — including legacy ones</li>
        <li>✓ <Kbd>traceparent</Kbd> header propagated across every service boundary (HTTP, gRPC, Kafka, queues, cron jobs)</li>
        <li>✓ Trace context extends into background jobs and async workers (not just synchronous HTTP)</li>
        <li>✓ Database queries and external API calls each get their own child span — that&apos;s where most time goes</li>
        <li>✓ Trace sampling strategy explicit: head-based percentage + tail-based 100% for errors and slow requests</li>
        <li>✓ Exemplars enabled on key metrics — one click from p99 spike to representative trace</li>
        <li>✓ Trace_id and span_id included in every log line (set by shared logging helper, see §02)</li>
        <li>✓ "Orphan-root" trace detection in place — alert when too many traces start mid-flow (means propagation broke)</li>
        <li>✓ Span attributes audited — no PII or secrets baked into <Kbd>db.statement</Kbd> or HTTP URLs</li>
        <li>✓ Trace retention configured: typically 7-14 days hot, 30+ cold/sampled — long enough to investigate a week-old report</li>
      </ul>

      {/* ────────────────────────────────────────────────────────────────── */}
      {/* CLOSING — Atlas 23 wrap + operations-arc preview                 */}
      {/* ────────────────────────────────────────────────────────────────── */}

      <SectionLabel>end of atlas</SectionLabel>
      <H2 num="◆">What you can do now</H2>
      <P>Four sections back, "observability" was a word your platform team said in meetings. Now you can:</P>
      <ul className="text-zinc-300 text-[15px] leading-relaxed my-3 list-disc pl-6 space-y-1.5 max-w-prose">
        <li><strong className="text-sky-300">Reach for the right pillar.</strong> Metrics for "when and how bad"; logs for "what"; traces for "where." Combine them through trace_id correlation. Know what each one can and cannot tell you.</li>
        <li><strong className="text-sky-300">Ship logs that scale.</strong> Structured JSON via a shared helper. Levels used deliberately. No PII, no secrets, no raw request bodies. Indexed fields under 100K stream cardinality; high-cardinality stuff in the body.</li>
        <li><strong className="text-sky-300">Build dashboards that mean something.</strong> RED method (rate / errors / duration) per service. USE method (utilization / saturation / errors) per resource. Alert on p99, not averages. Templated endpoints in labels, never raw URLs.</li>
        <li><strong className="text-sky-300">Trace across services.</strong> OpenTelemetry instrumentation. <Kbd>traceparent</Kbd> propagated everywhere. Head-sampled normal traffic; tail-sampled errors and slow requests. Exemplars connecting metric spikes to real traces.</li>
      </ul>

      <Callout kind="win" title="WHAT YOU CAN BUILD WITH ALL FOUR">
        You now have the foundation for any modern observability stack — from "I have a single
        Python service and grafana cloud" to "I run 200 microservices and need to debug a
        cross-service tail-latency regression." The pieces — structured logs, RED/USE metrics,
        OpenTelemetry traces, trace_id correlation — are the same regardless of scale; only
        the operating discipline grows.
      </Callout>

      <SectionLabel>what comes next</SectionLabel>
      <H2 num="◆">The operations arc continues</H2>
      <P>
        Observability is necessary but not sufficient. Knowing what your system is doing only
        matters if you can decide how reliable it SHOULD be — and have a plan for when it
        breaks anyway. The next two atlases close the operations arc.
      </P>
      <Code id="operations-arc" lang="text">{`ATLAS 23 — OBSERVABILITY              ✓ "What is actually happening inside the system?"
   ◉ · complete                        Logs · metrics · traces · OpenTelemetry · cardinality

ATLAS 24 — RELIABILITY                "How reliable IS the system, and how reliable should it be?"
   (planned)                           SLIs · SLOs · SLAs · error budgets · chaos engineering
                                       The math of "good enough"; when to ship fast vs slow

ATLAS 25 — INCIDENT RESPONSE           "What happens when something breaks?"
   (planned)                           On-call · alerting · escalation · postmortems
                                       Blameless culture; the discipline of learning from outages`}</Code>
      <P>
        The skills compound. You cannot have a meaningful SLO without metrics (Atlas 23 §03).
        You cannot run a useful postmortem without traces and logs to reconstruct what
        happened (Atlas 23 §01, §02, §04). The operations arc, like the data-systems arc
        before it, is one continuous story. The next chapter starts at Atlas 24.
      </P>
      <P>
        Reference index at <Kbd>atlases.vercel.app</Kbd>. The series continues.
      </P>
      <div className="text-zinc-500 text-center text-[10.5px] tracking-[0.3em] uppercase mt-12 mb-4"
        style={{ fontFamily: 'JetBrains Mono, monospace' }}>
        ◉ · atlas twenty-three · complete · operations arc opened
      </div>
    </>
  );
}
