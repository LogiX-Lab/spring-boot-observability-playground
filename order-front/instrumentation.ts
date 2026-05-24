/**
 * Next.js instrumentation entry point.
 * Loaded by the Next.js runtime before the app starts.
 * Delegates to the Node.js-specific file to avoid loading native
 * OTel packages in the Edge or browser bundles.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation.node");
  }
}
