# Observability — Atlas #23 (B. Symbolic)

Three Pillars · Logs · Metrics · Traces

**Opens the operations arc.** The API series (17-19) covered building APIs.
The data-systems arc (20-22) covered the layer underneath. The operations arc
(23-25) covers RUNNING what you built. Atlas 23 is the foundation: the three
pillars and how to actually use them when production breaks.

Build script uses `node ./node_modules/vite/bin/vite.js build` (Vercel-fix
baked in). `.gitignore` baked in from first commit. Pre-flight secret scan clean.

## Conventions
- Palette: sky-300 primary, amber-400 accent
- Glyph: ◉ (bullseye — observation point)
- Type: Bricolage Grotesque · JetBrains Mono · Manrope
- New callout kind: `signal` (Radio icon) for instrumentation concepts

## Sections (all complete)

### 01 Three Pillars (612 lines)
Observability vs monitoring; logs/metrics/traces defined; MELT model; the
cardinality budget; trace_id as connective tissue; observability stacks.
**Interactive:** Three Pillars Comparison — one incident shown through three
lenses, with synthesis panel showing how combining them reveals the cause
(DB pool exhausted).

### 02 Logs (510 lines)
Structured logging; log levels; what to log and what NOT to log (PII time-bomb);
the indexed-vs-body cardinality discipline; sampling strategies; log shipping
agents; aggregation stacks (ELK, Loki, Datadog, Splunk, CloudWatch, ClickHouse).
**Interactive:** Log Cardinality Calculator — 13 log fields toggleable between
INDEXED and BODY-ONLY; total stream count updates live; verdict turns green/
amber/rose based on the math.

### 03 Metrics (570 lines)
Four metric types (counter/gauge/histogram/summary); why `rate()` is mandatory
for counters; why percentiles beat averages; USE method (Utilization/Saturation/
Errors) for resources; RED method (Rate/Errors/Duration) for services; cardinality
recap; Prometheus + Grafana stack architecture.
**Interactive:** Percentile vs Average Visualizer — three pre-built distributions
(tight cluster, long tail, bimodal) all with ~200ms average; SVG histogram with
marker lines for avg/p50/p95/p99; interpretation panel showing the user-experience
divergence.

### 04 Traces (542 lines)
What a trace is (root + child spans); why traces beat logs cross-service;
context propagation via W3C traceparent; OpenTelemetry architecture (API/SDK/
collector); head-based vs tail-based sampling; the cost reality; trace backends
(Jaeger, Tempo, Honeycomb, Datadog APM, X-Ray, Lightstep, Zipkin, SigNoz).
**Interactive:** Distributed Trace Explorer — POST /checkout fanning out to 8
services across 14 spans, total 1480ms; click any span for full details; the
tax-svc span tells the story (1200ms, 81% of total, external API call to Avalara).

Atlas closes with:
- "What you can do now" recap of all 4 sections
- "What you can build with all four" win callout
- Preview of remaining operations arc (Atlas 24 Reliability + Atlas 25 Incident Response)

## Run locally
```
npm install
npm run dev          # http://localhost:5173
```

## Series
- Atlas 17-19 — API series (Foundations · Security · Production)
- Atlas 20-22 — Data-systems arc (Databases · Distributed · Event-Driven) — complete
- **Atlas 23 — Observability (this one) — opens operations arc**
- Atlas 24 — Reliability (planned)
- Atlas 25 — Incident Response (planned)

## Push checklist
1. `git init && git add . && git commit -m "Atlas 23 — Observability"`
2. Create repo on github.com (suggested: `obs-atlas` under `denrod25-del`)
3. `git remote add origin git@github.com:denrod25-del/obs-atlas.git`
4. `git push -u origin main`
5. Connect at vercel.com/new → import the repo → deploy
