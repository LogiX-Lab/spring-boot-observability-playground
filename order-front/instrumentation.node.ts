/**
 * Node.js-only OpenTelemetry setup.
 * Only imported when NEXT_RUNTIME === "nodejs" (see instrumentation.ts).
 *
 * Sends traces to Jaeger via OTLP HTTP.
 * Override the endpoint with OTEL_EXPORTER_OTLP_ENDPOINT env var.
 */
import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { UndiciInstrumentation } from "@opentelemetry/instrumentation-undici";

// NodeSDK reads OTEL_SERVICE_NAME automatically (OTel standard env var)
process.env.OTEL_SERVICE_NAME ??= "order-front";

const endpoint =
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://localhost:4318/v1/traces";

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({ url: endpoint }),
  instrumentations: [
    new HttpInstrumentation({
      // Skip noisy Next.js internal asset requests
      ignoreIncomingRequestHook: (req) =>
        (req.url?.startsWith("/_next/") ?? false) ||
        (req.url?.startsWith("/favicon") ?? false),
    }),
    // Instruments Node.js native fetch (undici) — traces outgoing API calls
    // from Next.js route handlers to the order-service backend
    new UndiciInstrumentation(),
  ],
});

sdk.start();
