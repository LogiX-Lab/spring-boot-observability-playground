# OpenTelemetry Observation at the order-front (Next.js UI)

## The Challenge — Why the Browser Cannot Send Traces

A Next.js application has two distinct execution environments:

| Environment | Where it runs | Can send OTLP? |
|---|---|---|
| **Browser** (React client components) | User's browser | ❌ CORS blocks OTLP; no persistent process |
| **Node.js server** (API routes, SSR) | Server process | ✅ Full access to network + OTel SDK |

All `"use client"` components in this project (`Cart.tsx`, `page.tsx`, `history/page.tsx`)
run in the browser. If they called `fetch("http://localhost:8081/...")` directly, the
browser would make the HTTP request — **no OTel SDK is running in the browser, so no
span is created and Jaeger never sees `order-front` in its dependency graph.**

The solution in this project is a **BFF (Backend-for-Frontend)** pattern: all API calls
are routed through a Next.js server-side Route Handler, which runs in the Node.js process
where the OTel SDK is active.

---

## The Four-File Setup

### File 1 — `instrumentation.ts` (Next.js entry point)

```ts
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation.node");
  }
}
```

Next.js calls `register()` once at server startup **before** any route is handled.
The `NEXT_RUNTIME` guard prevents the OTel SDK (which uses Node.js-only APIs like
`http`, `net`, `tls`) from being bundled or executed in the browser or Edge runtime.

### File 2 — `instrumentation.node.ts` (OTel SDK bootstrap)

```ts
import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { UndiciInstrumentation } from "@opentelemetry/instrumentation-undici";

process.env.OTEL_SERVICE_NAME ??= "order-front";

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({ url: "http://localhost:4318/v1/traces" }),
  instrumentations: [
    new HttpInstrumentation({
      ignoreIncomingRequestHook: (req) =>
        req.url?.startsWith("/_next/") || req.url?.startsWith("/favicon"),
    }),
    new UndiciInstrumentation(),   // ← instruments native fetch()
  ],
});
sdk.start();
```

Two instrumentations are active:

| Instrumentation | What it observes |
|---|---|
| `HttpInstrumentation` | Incoming HTTP requests to the Next.js server (creates the parent span per route call) |
| `UndiciInstrumentation` | Outgoing `fetch()` calls from Route Handlers to order-service (creates child spans + injects `traceparent`) |

`ignoreIncomingRequestHook` drops spans for `/_next/*` (hot-reload, asset chunks) and
`/favicon` to keep Jaeger free of noise.

### File 3 — `next.config.ts` (`serverExternalPackages`)

```ts
serverExternalPackages: [
  "@opentelemetry/sdk-node",
  "@opentelemetry/exporter-trace-otlp-http",
  "@opentelemetry/instrumentation-http",
  "@opentelemetry/instrumentation-undici",
  "@opentelemetry/instrumentation",
  "@opentelemetry/core",
  "@opentelemetry/sdk-trace-node",
  "@opentelemetry/sdk-trace-base",
  "@opentelemetry/resources",
]
```

Turbopack/Webpack would normally bundle these into a single ESM file. The OTel packages
ship CJS builds where some exports are omitted from the ESM variant — bundling them causes
`undefined` import errors at runtime. `serverExternalPackages` tells Next.js to leave
these packages unbundled and let Node.js `require()` them from `node_modules` directly.

### File 4 — `app/api/orders/route.ts` (BFF proxy)

```ts
const ORDER_API = process.env.ORDER_API_URL ?? "http://localhost:8081";

export async function GET(request: NextRequest) {
  const upstream = `${ORDER_API}/api/v1/order?...`;
  const res = await fetch(upstream);          // ← UndiciInstrumentation traces this
  return NextResponse.json(await res.json());
}

export async function POST(request: NextRequest) {
  const res = await fetch(`${ORDER_API}/api/v1/order`, { method: "POST", ... });
  return new NextResponse(await res.text(), { status: res.status });
}
```

Because `fetch()` runs inside the Node.js server process, `UndiciInstrumentation`
intercepts it and:
1. Creates a child span under the active incoming HTTP span
2. Injects the W3C `traceparent` header into the outgoing request to order-service
3. order-service extracts the header and creates its spans as children of this span

---

## Request Flow with Spans

```
Browser (no OTel)
  │
  │  fetch("/api/orders", { method: "POST" })        ← relative URL, goes to Next.js server
  ▼
Next.js Node.js process  (OTel SDK active)
  │
  ├─ span: "POST /api/orders"                        ← HttpInstrumentation (incoming)
  │    │
  │    └─ span: "POST http://localhost:8081/..."     ← UndiciInstrumentation (outgoing)
  │         │   headers: { traceparent: "00-<traceId>-<spanId>-01" }
  │         │
  │         ▼
  │     order-service  (Spring Boot + Micrometer Tracing)
  │         │
  │         ├─ span: "POST /api/v1/order"            ← child of UndiciInstrumentation span
  │         │    └─ span: "query [INSERT orders]"    ← datasource-micrometer
  │         │
  │         └─ span: "send orders.topic"             ← KafkaTemplate
  │              └─ span: "receive orders.topic"     [payment-service]
  │                   └─ span: "query [INSERT payment]"
  │
  └─ OTLP HTTP POST /v1/traces → Jaeger :4318
```

All spans in this tree share the **same `traceId`**. Jaeger groups them into a single
trace and draws the directed edges `order-front → order-service → payment-service`
in the System Architecture diagram.

---

## npm Packages Installed

```json
"@opentelemetry/sdk-node":                   "^0.218.0"
"@opentelemetry/exporter-trace-otlp-http":   "^0.218.0"
"@opentelemetry/instrumentation-http":        "^0.218.0"
"@opentelemetry/instrumentation-undici":      "^0.28.0"
"@opentelemetry/resources":                   "^2.7.1"
"@opentelemetry/semantic-conventions":        "^1.41.1"
```

---

## Why `UndiciInstrumentation` and Not `HttpInstrumentation` for Outgoing Calls

Node.js 18+ replaced the internal HTTP client used by native `fetch()` with **undici**,
a fully async HTTP/1.1 client. `HttpInstrumentation` only patches the legacy `http` /
`https` modules — it does not see calls made via `fetch()`.

`UndiciInstrumentation` patches undici's request internals directly, so it captures
every `fetch()` call regardless of whether it goes through the `http` module or not.

---

## What Is NOT Observed

| Layer | Observed? | Reason |
|---|---|---|
| Browser React component renders | ❌ | No OTel SDK in browser; would need `@opentelemetry/sdk-web` (out of scope) |
| Next.js Edge runtime routes | ❌ | SDK is Node.js-only; guarded by `NEXT_RUNTIME === "nodejs"` |
| Static asset delivery (`/_next/*`) | ❌ | Explicitly filtered by `ignoreIncomingRequestHook` |
| Outgoing calls from client `fetch` | ❌ | Runs in the browser, not in Node.js |

---

## Relevant Files

| File | Role |
|---|---|
| `order-front/instrumentation.ts` | Next.js lifecycle hook — registers OTel SDK at server startup |
| `order-front/instrumentation.node.ts` | NodeSDK bootstrap: exporter, HttpInstrumentation, UndiciInstrumentation |
| `order-front/next.config.ts` | `serverExternalPackages` prevents Turbopack ESM bundling of OTel CJS packages |
| `order-front/app/api/orders/route.ts` | BFF proxy — server-side `fetch()` is instrumented by UndiciInstrumentation |
| `order-front/lib/api.ts` | Client helper — calls `/api/orders` (relative), routes through BFF |
| `order-front/app/history/page.tsx` | History page fetch — also calls `/api/orders` through BFF |
