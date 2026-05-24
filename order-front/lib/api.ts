import { OrderHistoryItem, OrderRequest } from "./types";

// All calls go through the Next.js BFF proxy (/api/orders) so that
// the Node.js server makes the outgoing HTTP request to order-service.
// This creates traceable spans from order-front → order-service in Jaeger.

export async function submitOrder(order: OrderRequest): Promise<string> {
  const res = await fetch("/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(order),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(errText || `HTTP ${res.status}`);
  }
  return res.text();
}

export async function fetchOrders(
  customerId?: number
): Promise<OrderHistoryItem[]> {
  const url = customerId ? `/api/orders?customerId=${customerId}` : "/api/orders";
  const res = await fetch(url);
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(errText || `HTTP ${res.status}`);
  }
  return res.json();
}
