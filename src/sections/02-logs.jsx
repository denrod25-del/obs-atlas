/* Section 02 — Logs Done Right.
 *
 * Prose + Log Cardinality Calculator.
 *
 * The calculator: a set of LOG FIELDS the user is considering. Each has a
 * known cardinality (number of unique values). The user toggles which
 * fields are INDEXED (appear as Loki labels / Elasticsearch keyword
 * fields / Datadog facets) vs which live only in the message body.
 *
 * Total indexed-stream cardinality is the multiplicative product of all
 * toggled-in cardinalities. The verdict turns green/amber/rose based on
 * that product against typical aggregator limits.
 *
 * The teaching point: high-cardinality fields (user_id, trace_id,
 * request_id) belong in the BODY (full-text searchable) — NOT in
 * indexed labels. Putting them in labels blows up the index store
 * exponentially.
 *
 * All prose strings use backticks (template literals).
 */

import { useState, useMemo } from 'react';
import { Sparkles, FileText, ShieldCheck, AlertTriangle, XCircle, Tag, FileSearch } from 'lucide-react';
import { Code, Callout, H2, P, Kbd, SectionLabel } from '../components/primitives.jsx';

// ───────────────────────────────────────────────────────────────────────
// Log Cardinality Calculator
// ───────────────────────────────────────────────────────────────────────

const FIELDS = [
  // Safe — low cardinality, naturally bounded
  { id: 'service',     label: 'service',     cardinality: 10,        safe: true,  rec: 'index it', defaultIndexed: true,  hint: '~10 services' },
  { id: 'environment', label: 'environment', cardinality: 4,         safe: true,  rec: 'index it', defaultIndexed: true,  hint: '~4 envs' },
  { id: 'level',       label: 'level',       cardinality: 5,         safe: true,  rec: 'index it', defaultIndexed: true,  hint: '5 levels' },
  { id: 'region',      label: 'region',      cardinality: 4,         safe: true,  rec: 'index it', defaultIndexed: true,  hint: '~4 regions' },
  { id: 'method',      label: 'http_method', cardinality: 6,         safe: true,  rec: 'index it', defaultIndexed: false, hint: '6 HTTP verbs' },
  { id: 'status',      label: 'status_code', cardinality: 12,        safe: true,  rec: 'index it', defaultIndexed: false, hint: '~12 codes seen' },
  { id: 'endpoint',    label: 'endpoint',    cardinality: 80,        safe: true,  rec: 'index it', defaultIndexed: false, hint: '~80 unique paths' },
  // Borderline — moderate cardinality
  { id: 'host',        label: 'hostname',    cardinality: 500,       safe: 'caution', rec: 'index with caution', defaultIndexed: false, hint: '~500 pods/instances' },
  { id: 'tenant',      label: 'tenant_id',   cardinality: 2000,      safe: 'caution', rec: 'index with caution', defaultIndexed: false, hint: '~2K B2B tenants' },
  // Dangerous — unbounded
  { id: 'user_id',     label: 'user_id',     cardinality: 5_000_000, safe: false, rec: 'BODY ONLY',  defaultIndexed: false, hint: '~5M users' },
  { id: 'trace_id',    label: 'trace_id',    cardinality: 100_000_000, safe: false, rec: 'BODY ONLY', defaultIndexed: false, hint: '~100M traces/day' },
  { id: 'request_id',  label: 'request_id',  cardinality: 200_000_000, safe: false, rec: 'BODY ONLY', defaultIndexed: false, hint: '~200M reqs/day' },
  { id: 'ip',          label: 'client_ip',   cardinality: 10_000_000, safe: false, rec: 'BODY ONLY', defaultIndexed: false, hint: '~10M unique IPs' },
];

const LIMITS = {
  loki_safe:    100_000,        // Loki rule of thumb: <100K streams per tenant
  loki_warn:  1_000_000,        // anything past 1M is in pain territory
  // beyond: blowup
};

function formatNumber(n) {
  if (n >= 1e12) return (n / 1e12).toFixed(1) + 'T';
  if (n >= 1e9)  return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6)  return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3)  return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}

function LogCardinalityCalculator() {
  const initial = {};
  FIELDS.forEach(f => { initial[f.id] = f.defaultIndexed; });
  const [indexed, setIndexed] = useState(initial);

  const total = useMemo(() => {
    let product = 1;
    let dangerCount = 0;
    FIELDS.forEach(f => {
      if (indexed[f.id]) {
        product *= f.cardinality;
        if (f.safe === false) dangerCount++;
      }
    });
    return { product, dangerCount };
  }, [indexed]);

  let verdict, verdictColor, verdictText, verdictIcon;
  if (total.product <= LIMITS.loki_safe) {
    verdict = 'safe';
    verdictColor = { border: 'border-lime-400/60', bg: 'bg-lime-400/10', text: 'text-lime-400' };
    verdictText = `Stream count within typical aggregator budgets (<100K). Loki / Elasticsearch / Datadog will index this comfortably.`;
    verdictIcon = ShieldCheck;
  } else if (total.product <= LIMITS.loki_warn) {
    verdict = 'caution';
    verdictColor = { border: 'border-amber-400/60', bg: 'bg-amber-400/10', text: 'text-amber-400' };
    verdictText = `In the pain zone (100K - 1M streams). Some indexes will start to slow down. Aggregators will accept it but queries get slower; storage costs creep up. Defensible if you really need the indexing.`;
    verdictIcon = AlertTriangle;
  } else {
    verdict = 'blowup';
    verdictColor = { border: 'border-rose-400/60', bg: 'bg-rose-400/10', text: 'text-rose-400' };
    verdictText = `BLOWUP. Stream count exceeds 1M. Loki will reject ingestion or throttle aggressively. Elasticsearch index sizes will balloon. Managed log services will either drop data or charge an emergency-level bill. REMOVE the high-cardinality fields from indexing — keep them in the message body, accessible via full-text search.`;
    verdictIcon = XCircle;
  }

  const VIcon = verdictIcon;

  const reset = () => {
    const r = {};
    FIELDS.forEach(f => { r[f.id] = f.defaultIndexed; });
    setIndexed(r);
  };

  return (
    <div className="my-6 border border-sky-300/30 bg-zinc-900/40">
      <div className="flex items-center justify-between bg-zinc-950 px-4 py-2.5 border-b border-sky-300/30">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-sky-300" />
          <span className="text-sky-300 text-[11px] tracking-[0.25em] uppercase font-semibold"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            interactive · log cardinality calculator
          </span>
        </div>
      </div>

      <div className="p-4">
        <div className="mb-4 p-3 border border-zinc-800 bg-zinc-900/40 text-zinc-300 text-[13px] leading-relaxed italic">
          Toggle each log field between INDEXED (appears as a Loki label / Elasticsearch keyword
          field / Datadog facet — searchable via filter) and BODY-ONLY (lives in the log message,
          accessible via full-text search). The total stream cardinality is the multiplicative
          product of all INDEXED fields. Watch what happens when you index a high-cardinality
          field.
        </div>

        {/* Field grid */}
        <div className="space-y-1.5 mb-4">
          {FIELDS.map(f => {
            const isIndexed = indexed[f.id];
            const isDanger = f.safe === false;
            const isCaution = f.safe === 'caution';
            return (
              <div key={f.id}
                className={`grid grid-cols-[1fr_70px_88px_140px] sm:grid-cols-[1.2fr_70px_100px_180px] gap-2 items-center p-2 border ${
                  isIndexed
                    ? (isDanger ? 'border-rose-400/60 bg-rose-400/5' : isCaution ? 'border-amber-400/40 bg-amber-400/5' : 'border-sky-300/40 bg-sky-300/5')
                    : 'border-zinc-800 bg-zinc-900/30'
                }`}>
                <div className="min-w-0">
                  <div className={`text-[12px] font-bold ${isDanger ? 'text-rose-200' : isCaution ? 'text-amber-200' : 'text-zinc-200'}`}
                    style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                    {f.label}
                  </div>
                  <div className="text-zinc-500 text-[10px]">{f.hint}</div>
                </div>
                <div className="text-zinc-400 text-[11px] text-right"
                  style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  {formatNumber(f.cardinality)}
                </div>
                <div className={`text-[10px] tracking-[0.15em] uppercase font-semibold text-center ${
                  isDanger ? 'text-rose-400' : isCaution ? 'text-amber-400' : 'text-lime-400'
                }`} style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  {isDanger ? 'dangerous' : isCaution ? 'caution' : 'safe'}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setIndexed(prev => ({ ...prev, [f.id]: true }))}
                    className={`flex-1 px-1.5 py-1 border text-[9.5px] transition-colors flex items-center justify-center gap-1 ${
                      isIndexed
                        ? 'border-sky-300 bg-sky-300/15 text-sky-200 font-semibold'
                        : 'border-zinc-700 text-zinc-500 hover:border-sky-300/40 hover:text-zinc-300'
                    }`}
                    style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                    <Tag size={9} /> indexed
                  </button>
                  <button onClick={() => setIndexed(prev => ({ ...prev, [f.id]: false }))}
                    className={`flex-1 px-1.5 py-1 border text-[9.5px] transition-colors flex items-center justify-center gap-1 ${
                      !isIndexed
                        ? 'border-lime-400 bg-lime-400/10 text-lime-200 font-semibold'
                        : 'border-zinc-700 text-zinc-500 hover:border-lime-400/40 hover:text-zinc-300'
                    }`}
                    style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                    <FileSearch size={9} /> body only
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <button onClick={reset}
          className="px-2.5 py-1 border border-zinc-700 text-zinc-500 hover:text-zinc-200 hover:border-zinc-500 transition-colors text-[10.5px] mb-3"
          style={{ fontFamily: 'JetBrains Mono, monospace' }}>
          reset to recommended defaults
        </button>

        {/* Result panel */}
        <div className={`border ${verdictColor.border} ${verdictColor.bg} p-4`}>
          <div className={`flex items-center justify-between mb-2`}>
            <div className={`text-[10.5px] tracking-[0.25em] uppercase font-semibold flex items-center gap-2 ${verdictColor.text}`}
              style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              <VIcon size={12} />
              verdict · {verdict}
            </div>
            <div className="text-zinc-300 text-[11px]"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              total streams: <span className={`font-bold ${verdictColor.text}`}>{formatNumber(total.product)}</span>
            </div>
          </div>
          <div className="text-zinc-200 text-[12.5px] leading-relaxed">
            {verdictText}
          </div>
          {total.dangerCount > 0 && verdict !== 'safe' && (
            <div className="mt-2 pt-2 border-t border-zinc-700/40 text-rose-300 text-[11.5px]">
              ⚠ {total.dangerCount} high-cardinality field{total.dangerCount > 1 ? 's' : ''} currently indexed. Move {total.dangerCount > 1 ? 'them' : 'it'} to body-only.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Section content
// ───────────────────────────────────────────────────────────────────────

export default function Section02_Logs() {
  return (
    <>
      <SectionLabel>section 02</SectionLabel>
      <h2 className="text-zinc-50 text-[28px] leading-tight mb-3"
        style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 600 }}>
        Logs done right — structure, levels, cardinality
      </h2>
      <P>
        Section 01 framed logs as one of three pillars. This section goes deep on the operational
        discipline that makes logs actually useful. Most teams ship logs that are either
        unhelpful (unstructured text nobody can grep efficiently) or unaffordable (high-cardinality
        labels exploding the indexer). The fix is two practices applied consistently across every
        service: structured logging at the source and explicit cardinality discipline at the
        indexer.
      </P>

      <H2 num="◇ 01">Structured logging — the only kind worth shipping</H2>
      <P>
        A structured log line is a serialized object with named fields. Unstructured logging is
        a string nobody can reliably parse. The difference at debug time is dramatic.
      </P>
      <Code id="structured-vs-unstructured" lang="text">{`UNSTRUCTURED — what gets shipped by default by half the codebases out there:

   2026-01-15 14:32:15 ERROR Failed to process order for user 4242: db query timeout

   To find this entry by user_id, you grep. To get all ERROR-level entries
   between 14:30 and 14:35, you regex on the timestamp. To join with another
   service's logs by trace_id, you reach for awk and pray. Slow, fragile,
   does not scale.

STRUCTURED (JSON) — the only thing worth shipping:

   {
     "ts":           "2026-01-15T14:32:15.234Z",
     "level":        "ERROR",
     "service":      "orders-api",
     "env":          "prod",
     "msg":          "order processing failed",
     "user_id":      4242,
     "order_id":     "ord_xyz123",
     "trace_id":     "a3f9e2c8b1d4f5a6e7d2c4b8a9f3e1d2",
     "span_id":      "9f3a2c8b1d4f5a6e",
     "duration_ms":  3023,
     "error":        "db query timeout",
     "query":        "SELECT_orders"
   }

   To find this entry: filter by user_id=4242. Done in a second.
   To join with the trace: click the trace_id. Open in Jaeger. Done.
   To aggregate errors by query type: group by query. SQL-style queries
   work on JSON-indexed log stores (Datadog, Splunk, Loki with LogQL,
   Elasticsearch with KQL). The structure becomes power.`}</Code>
      <Callout kind="signal" title="STRUCTURED ONCE, USED EVERYWHERE">
        Use ONE shared logging helper across every service. It produces JSON. It always includes
        the standard fields (ts, level, service, env, trace_id, span_id). It validates against a
        loose schema. New services pick it up; old services migrate to it. The single biggest
        long-term observability investment is the team-wide adoption of a single structured
        logging library — and the absence of <Kbd>print()</Kbd> statements in production code.
      </Callout>

      <H2 num="◇ 02">Log levels — and the discipline of using them right</H2>
      <P>
        Almost every logging library ships with the same level hierarchy. Almost every team
        uses them inconsistently. The conventions:
      </P>
      <Code id="log-levels" lang="text">{`LEVEL    USE FOR                                  PRODUCTION?
─────    ───────                                  ───────────
TRACE    Function-entry/exit, every variable.     never
         Useful for development only. Enabling
         in prod fills disk in minutes.

DEBUG    Detailed flow information.               sometimes — sampled only
         "Got 42 rows from query X."              (e.g., 1% sampling)
         "Cache miss for key Y."

INFO     Significant business events.             yes — full
         "Order placed", "User registered",
         "Background job started".

WARN     Recoverable issues, suspicious things.   yes — full
         "Retried request after timeout",
         "Rate limit threshold approaching".

ERROR    Failed operations that the user           yes — full + alerting
         visibly experienced.                      
         "Order processing failed",
         "Payment declined".

FATAL    Service-fatal conditions.                 yes — page someone immediately
         "Cannot connect to primary DB",
         "Required config missing".

THE COMMON MISTAKE: logging EVERYTHING at INFO. The result: 100GB/day of
noise, signal-to-noise ratio approaching zero, alerts get ignored. Use
levels deliberately. Pretend each one has a different audience: TRACE for
yourself in dev, INFO for incident commanders, ERROR for whoever is on
call, FATAL for the executive who reads the post-mortem.`}</Code>

      <H2 num="◇ 03">What to log — and what NOT to log</H2>
      <ul className="text-zinc-300 text-[15px] leading-relaxed my-3 list-disc pl-6 space-y-2 max-w-prose">
        <li>
          <strong className="text-lime-300">DO log</strong> the input identifiers (user_id, tenant_id, order_id, request_id) — these are what you will need to correlate later.
        </li>
        <li>
          <strong className="text-lime-300">DO log</strong> the trace_id and span_id on every entry. This is the connective tissue between logs and traces.
        </li>
        <li>
          <strong className="text-lime-300">DO log</strong> the outcome and duration of significant operations. "Operation X for entity Y took Z ms" is gold during incidents.
        </li>
        <li>
          <strong className="text-lime-300">DO log</strong> external-call boundaries — request and response (status, not body) at every service-to-service or service-to-DB call.
        </li>
        <li>
          <strong className="text-rose-300">DO NOT log</strong> secrets, API keys, passwords, full credit card numbers, full SSNs, raw OAuth tokens. Logs end up in stores with different access controls than production data. Treat the log shipper as untrusted.
        </li>
        <li>
          <strong className="text-rose-300">DO NOT log</strong> PII (personal data) without explicit policy. Names + emails + IP addresses can violate GDPR/CCPA if shipped to the wrong region. Hash or omit.
        </li>
        <li>
          <strong className="text-rose-300">DO NOT log</strong> request bodies wholesale. Truncate. Log only the bits you actually need (user_id, action, key parameters), not "the whole JSON payload of every API call."
        </li>
        <li>
          <strong className="text-rose-300">DO NOT log</strong> for things metrics are better at (request counts, error counts, rates). Metrics aggregate cheaply; logs do not.
        </li>
      </ul>
      <Callout kind="warn" title="THE PII TIME-BOMB">
        Logs are written once and accessed many times — by engineers in many regions, by
        third-party log shippers, sometimes by ML pipelines. PII written into logs
        propagates everywhere and is essentially impossible to recall. Apply a SCRUBBING
        FILTER at the log shipper that drops or hashes known PII fields. Verify it during
        every new-service onboarding. The fine for a GDPR violation traced to a log entry can
        exceed an entire annual observability budget.
      </Callout>

      <H2 num="◇ 04">Indexed labels vs body — the cardinality discipline</H2>
      <P>
        Log aggregators index SOME fields for fast filtering and full-text search EVERYTHING.
        The fields you index are "labels" (Loki), "keyword fields" (Elasticsearch), or "facets"
        (Datadog). Indexed fields support fast filter operations: "show me ERROR entries from
        the orders-api service in prod for the last hour." That filtered subset can then be
        full-text searched for specific user IDs or trace IDs.
      </P>
      <Code id="labels-vs-body" lang="text">{`THE SPLIT:

  INDEXED (low cardinality, < few hundred unique values):
    - service, env, level
    - region, hostname (if bounded)
    - status_code, http_method
    - endpoint pattern (if templated, e.g., "/api/orders/:id" not raw URL)

  BODY ONLY (high cardinality, unbounded):
    - user_id, tenant_id, order_id, customer_id
    - trace_id, span_id, request_id
    - IP addresses, full URLs with query strings
    - timestamps in any non-aggregate form

THE INDEXED FIELDS determine your "stream cardinality" — the multiplicative
product of all indexed label values across all log entries. Modern
aggregators charge (in cost or in degraded performance) proportional to
stream cardinality.

Loki rule of thumb: <100K streams per tenant. Past that, the chunk store
falls behind. Past 1M, ingestion will fail. The math: 5 services × 4
envs × 5 levels × 4 regions = 400 streams. SAFE. Add user_id (5M users)
as a label: 400 × 5,000,000 = 2 BILLION streams. BROKEN.

The fix: keep user_id in the body. Full-text search retrieves it within
the label-filtered stream subset. Pattern: filter by (service, env, level)
first; full-text grep for the user_id second. Same query speed; safe
indexer.`}</Code>

      <SectionLabel>practice</SectionLabel>
      <H2 num="◇ 05">See cardinality blow up — and fix it</H2>
      <P>
        Each field can be indexed (filter-fast, multiplies into the stream count) or kept
        body-only (full-text searchable, free). The verdict updates as you toggle. Try
        indexing user_id or trace_id — watch the stream count jump from thousands to billions.
        Then move them back to body-only; the indexer breathes; full-text search still finds
        them when you need to.
      </P>

      <LogCardinalityCalculator />

      <H2 num="◇ 06">Sampling — when full-fidelity logs are too expensive</H2>
      <P>
        At sufficient scale, even structured logs become too expensive to ship in full. The
        knob is sampling. Two strategies, both useful:
      </P>
      <ul className="text-zinc-300 text-[15px] leading-relaxed my-3 list-disc pl-6 space-y-2 max-w-prose">
        <li>
          <strong className="text-sky-300">Head-based sampling (decide at log time).</strong> Each log line decides probabilistically whether to be shipped. <Kbd>Math.random() &lt; 0.1</Kbd> for 10% sampling. Simple. Predictable cost. The downside: you may sample away the one error log you needed.
        </li>
        <li>
          <strong className="text-sky-300">Tail-based sampling (decide at query time).</strong> Buffer all logs in a short-lived cheap store, then ship only the "interesting" ones (errors, slow requests, anomalies). Expensive infrastructure but you keep what you need. The Honeycomb / Datadog "live tail" features are this in disguise.
        </li>
        <li>
          <strong className="text-sky-300">Level-based sampling.</strong> Sample TRACE/DEBUG aggressively (1-10%); keep INFO entries entirely; keep WARN/ERROR/FATAL with no sampling. The defensible default.
        </li>
        <li>
          <strong className="text-sky-300">Per-trace sampling.</strong> When a trace is sampled, log everything for that trace; when not, drop most. Critical for correlating logs to sampled traces.
        </li>
      </ul>
      <Code id="sampling-pattern" lang="python">{`# Common pattern — keep all important logs, sample the rest
def should_emit(record):
    if record.level >= WARN:
        return True                              # always emit warnings and up
    if record.trace_sampled:
        return True                              # always emit logs for sampled traces
    if record.level == INFO:
        return True                              # full-rate for INFO in most setups
    # DEBUG / TRACE — sample
    return random.random() < 0.05               # 5% sampling`}</Code>

      <H2 num="◇ 07">Log shipping — agents, buffering, backpressure</H2>
      <P>
        Application code writes logs locally (stdout/stderr, a file, or a buffered network
        socket). An agent on the host (or sidecar in Kubernetes) reads them and forwards to
        the aggregator. The pattern matters because the boundary between application and
        agent is where most logs are lost.
      </P>
      <Code id="log-shipping" lang="text">{`THE FLOW:

   APPLICATION   ──► STDOUT     ──► HOST/POD AGENT   ──► AGGREGATOR
   (write log)        (kernel       (Fluent Bit,        (Loki, Elastic,
                       buffer)        Vector, Filebeat)   Datadog, Splunk)

WHERE LOGS GET LOST:

   1. APP buffer full, kernel drops bytes      → write logs unbuffered if you can
   2. Agent crashes, file not yet tailed       → use a persistent agent that
                                                  resumes from disk position
   3. Agent buffer overruns, drops batches     → tune the agent buffer; alert on drops
   4. Network to aggregator failing            → agent must have local-disk fallback
   5. Aggregator under load, returns 429       → agent must respect backpressure,
                                                  not retry hammer

THE COMMON AGENTS:
   FLUENT BIT     Lightweight, CNCF, written in C. Default in Kubernetes for
                  many distros. Configurable inputs/filters/outputs.
   VECTOR         Rust, fast, good observability of itself. Increasingly default.
   FILEBEAT       Elastic's agent. Good for ELK-centric stacks.
   PROMTAIL       Specifically for Loki. Simpler than the others.
   FLUENTD        The older, heavier sibling of Fluent Bit. Still widely deployed.

ALL OF THEM CAN: tail files, parse JSON, add labels, batch, buffer to disk,
forward over TCP/HTTP. The choice is mostly about ecosystem fit and the
tradeoff between resource use and configurability.`}</Code>

      <H2 num="◇ 08">The aggregation stacks</H2>
      <ul className="text-zinc-300 text-[15px] leading-relaxed my-3 list-disc pl-6 space-y-2 max-w-prose">
        <li>
          <strong className="text-sky-300">ELK / OpenSearch (Elasticsearch + Logstash + Kibana).</strong> The veteran. Full-text inverted index on every field by default — powerful queries, expensive at scale (index sizes balloon). Customizable to a fault.
        </li>
        <li>
          <strong className="text-sky-300">Grafana Loki.</strong> "Like Prometheus, but for logs." Indexes only labels (low cardinality); full-text searches happen within the label-filtered subset via streaming grep. Much cheaper at scale; less flexible than Elastic.
        </li>
        <li>
          <strong className="text-sky-300">Datadog Logs.</strong> Managed, integrates with Datadog APM/Metrics. "Facets" are their indexed-field equivalent. Powerful UI; cost scales steeply with ingest volume.
        </li>
        <li>
          <strong className="text-sky-300">Splunk.</strong> Enterprise default for over a decade. SPL (Splunk Processing Language) is genuinely powerful. Cost is famous: typical enterprise spend is 8-9 figures annually at scale.
        </li>
        <li>
          <strong className="text-sky-300">CloudWatch Logs / Cloud Logging / Azure Monitor.</strong> The cloud-provider defaults. Cheap-ish ingest, expensive query. Good for "I just need to find an error in a Lambda execution."
        </li>
        <li>
          <strong className="text-sky-300">ClickHouse / OpenObserve / SigNoz.</strong> Newer column-store approaches. Cheap, fast aggregate queries; less mature than Elastic/Splunk for arbitrary searches. Increasingly common for cost-conscious teams.
        </li>
      </ul>

      <H2 num="◇ 09">Hardening checklist for logs</H2>
      <ul className="text-zinc-300 text-[15px] leading-relaxed my-3 list-disc pl-6 space-y-1.5 max-w-prose">
        <li>✓ ALL services emit structured (JSON) logs via a single shared library</li>
        <li>✓ Standard fields included on every entry: ts, level, service, env, trace_id, span_id</li>
        <li>✓ Log levels used deliberately — INFO is not the default for everything</li>
        <li>✓ No secrets, PII, full request bodies, or auth tokens written to logs (verify with a scrubbing filter at the agent)</li>
        <li>✓ Indexed fields (Loki labels, ES keyword fields, Datadog facets) audited for cardinality — total stream count under ~100K</li>
        <li>✓ High-cardinality fields (user_id, trace_id, request_id, IP) live in body-only, accessible via full-text search</li>
        <li>✓ Sampling strategy explicit: WARN+ always, INFO usually full, DEBUG/TRACE sampled at 1-10%</li>
        <li>✓ Log agent (Fluent Bit / Vector / Promtail) has local-disk buffer for aggregator-outage tolerance</li>
        <li>✓ Agent drops alerted on — silent log loss is a worse incident than the one you can't debug</li>
        <li>✓ Ingest cost monitored as a budget line; cardinality dashboard exists; alerts on spikes</li>
      </ul>
      <Callout kind="info" title="WHAT'S NEXT">
        Section 03 turns to metrics — the four metric types (counter / gauge / histogram /
        summary), why percentiles beat averages on every dimension, the USE and RED methods
        for dashboard design, and the Prometheus + Grafana stack that powers most modern
        metric observability.
      </Callout>
    </>
  );
}
