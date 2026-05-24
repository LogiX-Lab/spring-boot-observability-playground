/**
 * BFF proxy route: /api/orders
 *
 * Forwards requests to the order-service so that the Next.js Node.js process
 * makes the outgoing HTTP call. This lets OpenTelemetry (UndiciInstrumentation)
 * create a child span and inject the W3C traceparent header, which makes
 * order-front appear in the Jaeger System Architecture diagram connected to
 * order-service.
 */
import { NextRequest, NextResponse } from "next/server";

const ORDER_API =
  process.env.ORDER_API_URL ?? "http://localhost:8081";

export async function GET(request: NextRequest) {
  const customerId = request.nextUrl.searchParams.get("customerId");
  const upstream = customerId
    ? `${ORDER_API}/api/v1/order?customerId=${customerId}`
    : `${ORDER_API}/api/v1/order`;

  const res = await fetch(upstream);
  if (!res.ok) {
    return NextResponse.json(
      { error: `Upstream error: ${res.status}` },
      { status: res.status }
    );
  }
  return NextResponse.json(await res.json());
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const res = await fetch(`${ORDER_API}/api/v1/order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text().catch(() => "");
  return new NextResponse(text, { status: res.status });
}
