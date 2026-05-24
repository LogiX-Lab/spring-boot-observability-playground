"use client";

import { useState, useCallback } from "react";
import { Navbar } from "@/components/Navbar";
import { MStripe } from "@/components/MStripe";

const ORDER_API =
  process.env.NEXT_PUBLIC_ORDER_API ?? "http://localhost:8081";

interface OrderItem {
  productId: number;
  quantity: number;
  price: number;
}

interface Order {
  id: number;
  customerId: number;
  status: string;
  totalAmount: number;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}

type FetchState = "idle" | "loading" | "done" | "error";

const STATUS_COLOR: Record<string, string> = {
  PLACED: "text-m-blue-light",
  PAYMENT_VERIFIED: "text-success",
  CANCELLED: "text-m-red",
  FAILED: "text-m-red",
};

export default function HistoryPage() {
  const [customerIdInput, setCustomerIdInput] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [fetchState, setFetchState] = useState<FetchState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const fetchOrders = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      setFetchState("loading");
      setErrorMsg("");

      const url = customerIdInput.trim()
        ? `${ORDER_API}/api/v1/order?customerId=${customerIdInput.trim()}`
        : `${ORDER_API}/api/v1/order`;

      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: Order[] = await res.json();
        setOrders(data);
        setFetchState("done");
      } catch (err) {
        setErrorMsg(
          err instanceof Error ? err.message : "Failed to fetch orders"
        );
        setFetchState("error");
      }
    },
    [customerIdInput]
  );

  return (
    <>
      <Navbar cartCount={0} onCartOpen={() => {}} />

      {/* Header */}
      <section className="bg-surface-soft border-b border-hairline px-8 md:px-14 py-12">
        <p className="text-muted text-[10px] tracking-[0.3em] uppercase mb-3 font-bold">
          Order Management
        </p>
        <h1 className="text-on-dark font-bold text-3xl md:text-4xl uppercase leading-none tracking-tight">
          ORDER HISTORY
        </h1>
      </section>

      <MStripe />

      {/* Search */}
      <div className="px-8 md:px-14 py-8 border-b border-hairline bg-surface-soft">
        <form
          onSubmit={fetchOrders}
          className="flex items-end gap-3 flex-wrap"
        >
          <div className="flex-1 min-w-[200px] max-w-xs">
            <label className="block text-muted text-[10px] tracking-[0.15em] uppercase mb-2">
              Customer ID (optional)
            </label>
            <input
              type="number"
              min={1}
              value={customerIdInput}
              onChange={(e) => setCustomerIdInput(e.target.value)}
              placeholder="Leave blank for all orders"
              className="w-full h-12 bg-surface-card border border-hairline text-body-strong text-sm font-light px-3 focus:border-on-dark focus:outline-none transition-colors placeholder:text-muted"
            />
          </div>
          <button
            type="submit"
            disabled={fetchState === "loading"}
            className="h-12 px-8 border border-on-dark text-on-dark text-[10px] tracking-[0.25em] uppercase font-bold hover:bg-on-dark hover:text-canvas transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {fetchState === "loading" ? "LOADING…" : "SEARCH"}
          </button>
        </form>
      </div>

      {/* Results */}
      <main className="px-8 md:px-14 py-10">
        {fetchState === "idle" && (
          <p className="text-muted text-xs tracking-[0.15em] text-center py-16 uppercase">
            Enter a customer ID and click Search to view orders
          </p>
        )}

        {fetchState === "error" && (
          <p className="text-m-red text-xs tracking-wide text-center py-10">
            {errorMsg}
          </p>
        )}

        {fetchState === "done" && orders.length === 0 && (
          <p className="text-muted text-xs tracking-[0.15em] text-center py-16 uppercase">
            No orders found
          </p>
        )}

        {fetchState === "done" && orders.length > 0 && (
          <div>
            <div className="flex items-baseline justify-between mb-6">
              <h2 className="text-on-dark font-bold text-xs tracking-[0.25em] uppercase">
                Results
              </h2>
              <span className="text-muted text-[10px] tracking-[0.15em] uppercase">
                {orders.length} order{orders.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Table header */}
            <div className="hidden md:grid grid-cols-[120px_100px_180px_120px_180px_40px] gap-4 px-5 py-3 border border-hairline bg-surface-card text-muted text-[10px] tracking-[0.15em] uppercase mb-px">
              <span>Order ID</span>
              <span>Customer</span>
              <span>Status</span>
              <span className="text-right">Total</span>
              <span>Date</span>
              <span />
            </div>

            {/* Rows */}
            <div className="border border-hairline divide-y divide-hairline">
              {orders.map((order) => (
                <div key={order.id} className="bg-surface-card">
                  {/* Main row */}
                  <button
                    className="w-full hidden md:grid grid-cols-[120px_100px_180px_120px_180px_40px] gap-4 px-5 py-4 hover:bg-surface-elevated transition-colors text-left"
                    onClick={() =>
                      setExpandedId(expandedId === order.id ? null : order.id)
                    }
                    aria-expanded={expandedId === order.id}
                  >
                    <span className="text-on-dark text-xs font-bold tabular-nums">
                      #{order.id}
                    </span>
                    <span className="text-body text-xs font-light">
                      {order.customerId}
                    </span>
                    <span
                      className={`text-xs font-bold tracking-[0.1em] uppercase ${STATUS_COLOR[order.status] ?? "text-body"}`}
                    >
                      {order.status}
                    </span>
                    <span className="text-body-strong text-xs font-bold tabular-nums text-right">
                      ${order.totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-muted text-[10px] font-light">
                      {new Date(order.createdAt).toLocaleString()}
                    </span>
                    <span className="text-muted text-sm text-right">
                      {expandedId === order.id ? "▲" : "▼"}
                    </span>
                  </button>

                  {/* Mobile row */}
                  <button
                    className="w-full flex md:hidden flex-col gap-1.5 px-5 py-4 hover:bg-surface-elevated transition-colors text-left"
                    onClick={() =>
                      setExpandedId(expandedId === order.id ? null : order.id)
                    }
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-on-dark text-xs font-bold">
                        #{order.id}
                      </span>
                      <span
                        className={`text-[10px] font-bold tracking-[0.1em] uppercase ${STATUS_COLOR[order.status] ?? "text-body"}`}
                      >
                        {order.status}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted text-[10px]">
                        Customer {order.customerId}
                      </span>
                      <span className="text-body-strong text-xs font-bold">
                        ${order.totalAmount.toFixed(2)}
                      </span>
                    </div>
                    <span className="text-muted text-[10px] font-light">
                      {new Date(order.createdAt).toLocaleString()}
                    </span>
                  </button>

                  {/* Expanded items */}
                  {expandedId === order.id && (
                    <div className="border-t border-hairline bg-surface-soft px-5 py-4">
                      <p className="text-muted text-[10px] tracking-[0.2em] uppercase mb-3">
                        Line Items
                      </p>
                      <div className="space-y-2">
                        {order.items.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between py-2 border-b border-hairline last:border-0"
                          >
                            <div className="flex gap-4 items-center">
                              <span className="text-muted text-[10px] uppercase tracking-[0.1em] w-24">
                                Product #{item.productId}
                              </span>
                              <span className="text-body text-xs font-light">
                                Qty: {item.quantity}
                              </span>
                              <span className="text-body text-xs font-light">
                                @ ${item.price.toFixed(2)}
                              </span>
                            </div>
                            <span className="text-body-strong text-xs font-bold tabular-nums">
                              ${(item.quantity * item.price).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-hairline px-8 md:px-14 py-8">
        <MStripe />
        <div className="pt-6 flex items-center justify-between">
          <span className="text-on-dark font-bold text-sm tracking-widest uppercase">
            M
          </span>
          <p className="text-muted text-[10px] tracking-[0.1em] font-light">
            Source:{" "}
            <code className="text-body-strong font-bold">
              GET /api/v1/order
            </code>
          </p>
        </div>
      </footer>
    </>
  );
}
