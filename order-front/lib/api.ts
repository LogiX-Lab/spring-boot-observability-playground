import { OrderRequest } from "./types";

const ORDER_API =
  process.env.NEXT_PUBLIC_ORDER_API ?? "http://localhost:8081";

export async function submitOrder(order: OrderRequest): Promise<string> {
  const res = await fetch(`${ORDER_API}/api/v1/order`, {
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
