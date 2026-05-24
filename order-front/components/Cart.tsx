"use client";

import { useId, useState } from "react";
import { CartItem, OrderRequest } from "@/lib/types";
import { MStripe } from "./MStripe";
import { submitOrder } from "@/lib/api";

interface CartProps {
  items: CartItem[];
  isOpen: boolean;
  onClose: () => void;
  onUpdateQty: (productId: number, delta: number) => void;
  onRemove: (productId: number) => void;
  onOrderSuccess: () => void;
}

type SubmitState = "idle" | "loading" | "success" | "error";

export function Cart({
  items,
  isOpen,
  onClose,
  onUpdateQty,
  onRemove,
  onOrderSuccess,
}: CartProps) {
  const [customerId, setCustomerId] = useState("");
  const [paymentToken, setPaymentToken] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const formId = useId();

  const total = items.reduce(
    (sum, ci) => sum + ci.product.price * ci.quantity,
    0
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (items.length === 0) return;

    setSubmitState("loading");
    setErrorMsg("");

    const order: OrderRequest = {
      id: Math.floor(Math.random() * 900_000) + 100_000,
      customerId: Number(customerId),
      paymentToken: paymentToken,
      orderStatus: "PLACED",
      items: items.map((ci) => ({
        productId: ci.product.id,
        quantity: ci.quantity,
        price: ci.product.price,
      })),
    };

    try {
      await submitOrder(order);
      setSubmitState("success");
      onOrderSuccess();
    } catch (err) {
      setSubmitState("error");
      setErrorMsg(
        err instanceof Error ? err.message : "Order submission failed"
      );
    }
  }

  function handleClose() {
    if (submitState === "success") {
      setSubmitState("idle");
      setCustomerId("");
      setPaymentToken("");
      setErrorMsg("");
    }
    onClose();
  }

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/75 z-40 transition-opacity"
          onClick={handleClose}
          aria-hidden="true"
        />
      )}

      {/* Slide-over panel */}
      <aside
        className={`fixed top-0 right-0 bottom-0 w-full max-w-[420px] bg-surface-soft border-l border-hairline z-50 flex flex-col transition-transform duration-300 ease-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        aria-label="Shopping cart"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-hairline flex-shrink-0">
          <h2 className="text-on-dark font-bold text-xs tracking-[0.25em] uppercase">
            Your Order
          </h2>
          <button
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center text-muted hover:text-on-dark text-2xl leading-none transition-colors"
            aria-label="Close cart"
          >
            ×
          </button>
        </div>
        <MStripe />

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {submitState === "success" ? (
            <SuccessView onClose={handleClose} />
          ) : (
            <>
              {/* Item list */}
              <div className="px-6 py-5">
                {items.length === 0 ? (
                  <div className="py-16 text-center">
                    <p className="text-muted text-xs tracking-[0.15em] uppercase">
                      Cart is empty
                    </p>
                    <p className="text-muted text-xs font-light mt-2">
                      Add products from the shop
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-0 divide-y divide-hairline">
                    {items.map((ci) => (
                      <li
                        key={ci.product.id}
                        className="py-4 flex items-start gap-4"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-on-dark text-[11px] font-bold tracking-[0.06em] uppercase leading-snug truncate">
                            {ci.product.name}
                          </p>
                          <p className="text-muted text-[11px] font-light mt-0.5">
                            ${ci.product.price.toFixed(2)} ea
                          </p>
                          <p className="text-body-strong text-xs font-bold mt-1">
                            $
                            {(ci.product.price * ci.quantity).toLocaleString(
                              "en-US",
                              { minimumFractionDigits: 2 }
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
                          <button
                            onClick={() => onUpdateQty(ci.product.id, -1)}
                            className="w-7 h-7 border border-hairline text-body hover:border-on-dark hover:text-on-dark flex items-center justify-center text-sm transition-colors"
                            aria-label="Decrease quantity"
                          >
                            −
                          </button>
                          <span className="text-on-dark text-xs w-5 text-center tabular-nums font-light">
                            {ci.quantity}
                          </span>
                          <button
                            onClick={() => onUpdateQty(ci.product.id, 1)}
                            className="w-7 h-7 border border-hairline text-body hover:border-on-dark hover:text-on-dark flex items-center justify-center text-sm transition-colors"
                            aria-label="Increase quantity"
                          >
                            +
                          </button>
                          <button
                            onClick={() => onRemove(ci.product.id)}
                            className="w-7 h-7 flex items-center justify-center text-muted hover:text-m-red ml-1 text-lg transition-colors"
                            aria-label={`Remove ${ci.product.name}`}
                          >
                            ×
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Total */}
              {items.length > 0 && (
                <div className="px-6 py-4 border-t border-hairline flex items-center justify-between bg-surface-card">
                  <span className="text-muted text-[10px] tracking-[0.2em] uppercase">
                    Order Total
                  </span>
                  <span className="text-on-dark font-bold text-sm tabular-nums tracking-wider">
                    ${total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              {/* Order form */}
              {items.length > 0 && (
                <form
                  id={formId}
                  onSubmit={handleSubmit}
                  className="px-6 pt-5 pb-4 space-y-4 border-t border-hairline"
                >
                  <p className="text-muted text-[10px] tracking-[0.2em] uppercase">
                    Customer Details
                  </p>

                  <div>
                    <label
                      className="block text-muted text-[10px] tracking-[0.15em] uppercase mb-2"
                      htmlFor={`${formId}-cid`}
                    >
                      Customer ID
                    </label>
                    <input
                      id={`${formId}-cid`}
                      type="number"
                      required
                      min={1}
                      value={customerId}
                      onChange={(e) => setCustomerId(e.target.value)}
                      placeholder="e.g. 1001"
                      className="w-full h-12 bg-surface-card border border-hairline text-body-strong text-sm font-light px-4 rounded-xl focus:border-accent focus:outline-none transition-colors placeholder:text-muted"
                    />
                  </div>

                  <div>
                    <label
                      className="block text-muted text-[10px] tracking-[0.15em] uppercase mb-2"
                      htmlFor={`${formId}-tok`}
                    >
                      Payment Token
                    </label>
                    <input
                      id={`${formId}-tok`}
                      type="text"
                      required
                      value={paymentToken}
                      onChange={(e) => setPaymentToken(e.target.value)}
                      placeholder="tok_..."
                      className="w-full h-12 bg-surface-card border border-hairline text-body-strong text-sm font-light px-4 rounded-xl focus:border-accent focus:outline-none transition-colors placeholder:text-muted"
                    />
                  </div>

                  {submitState === "error" && (
                    <p
                      className="text-m-red text-xs font-light tracking-wide"
                      role="alert"
                    >
                      {errorMsg || "Failed to place order. Check API connection."}
                    </p>
                  )}
                </form>
              )}
            </>
          )}
        </div>

        {/* Submit footer */}
        {items.length > 0 && submitState !== "success" && (
          <div className="px-6 py-5 border-t border-hairline flex-shrink-0">
            <button
              type="submit"
              form={formId}
              disabled={submitState === "loading"}
              className="w-full h-12 bg-accent text-white text-[10px] tracking-[0.25em] uppercase font-bold rounded-full hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitState === "loading" ? "PLACING ORDER…" : "PLACE ORDER"}
            </button>
          </div>
        )}
      </aside>
    </>
  );
}

function SuccessView({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-8 text-center py-20">
      <div className="w-14 h-14 rounded-full border-2 border-success flex items-center justify-center mb-6">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#0fa336"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <h3 className="text-on-dark font-bold text-xs tracking-[0.25em] uppercase mb-3">
        Order Placed
      </h3>
      <p className="text-body text-sm font-light leading-relaxed mb-10 max-w-xs">
        Your order has been submitted. Track progress in the M Driver&apos;s App or via the Kafka event stream.
      </p>
      <button
        onClick={onClose}
        className="h-12 px-10 border border-on-dark text-on-dark text-[10px] tracking-[0.25em] uppercase font-bold hover:bg-on-dark hover:text-canvas transition-colors"
      >
        CONTINUE SHOPPING
      </button>
    </div>
  );
}
