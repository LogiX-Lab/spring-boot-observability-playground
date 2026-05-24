import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent Turbopack from bundling OTel packages so they use their CJS
  // builds via native Node.js require (the ESM builds omit some exports).
  serverExternalPackages: [
    "@opentelemetry/sdk-node",
    "@opentelemetry/exporter-trace-otlp-http",
    "@opentelemetry/resources",
    "@opentelemetry/instrumentation-http",
    "@opentelemetry/instrumentation-undici",
    "@opentelemetry/instrumentation",
    "@opentelemetry/core",
    "@opentelemetry/sdk-trace-node",
    "@opentelemetry/sdk-trace-base",
  ],
};

export default nextConfig;
