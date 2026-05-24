"use client";

import { useCallback, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { ProductCard } from "@/components/ProductCard";
import { Cart } from "@/components/Cart";
import { MStripe } from "@/components/MStripe";
import { PRODUCTS } from "@/lib/products";
import { CartItem, Product } from "@/lib/types";

export default function ShopPage() {
  const [cartOpen, setCartOpen] = useState(false);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  const cartCount = cartItems.reduce((sum, ci) => sum + ci.quantity, 0);

  const handleAdd = useCallback((product: Product) => {
    setCartItems((prev) => {
      const existing = prev.find((ci) => ci.product.id === product.id);
      if (existing) {
        return prev.map((ci) =>
          ci.product.id === product.id
            ? { ...ci, quantity: ci.quantity + 1 }
            : ci
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    setCartOpen(true);
  }, []);

  const handleUpdateQty = useCallback((productId: number, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((ci) =>
          ci.product.id === productId
            ? { ...ci, quantity: ci.quantity + delta }
            : ci
        )
        .filter((ci) => ci.quantity > 0)
    );
  }, []);

  const handleRemove = useCallback((productId: number) => {
    setCartItems((prev) => prev.filter((ci) => ci.product.id !== productId));
  }, []);

  const handleOrderSuccess = useCallback(() => {
    setCartItems([]);
  }, []);

  return (
    <>
      <Navbar cartCount={cartCount} onCartOpen={() => setCartOpen(true)} />

      {/* Hero band */}
      <section className="relative bg-surface-soft border-b border-hairline overflow-hidden">
        <div
          className="absolute inset-0 flex items-center justify-end pr-10 pointer-events-none select-none"
          aria-hidden="true"
        >
          <span
            className="font-bold text-on-dark leading-none tracking-tighter opacity-[0.04]"
            style={{ fontSize: "clamp(12rem, 40vw, 32rem)" }}
          >
            M
          </span>
        </div>

        <div className="relative z-10 px-8 md:px-14 py-20 md:py-28">
          <p className="text-muted text-[10px] tracking-[0.3em] uppercase mb-4 font-bold">
            M Performance Parts &amp; Accessories
          </p>
          <h1 className="text-on-dark font-bold text-4xl md:text-6xl uppercase leading-none tracking-tight mb-6 max-w-2xl">
            ENGINEERED
            <br />
            FOR THE
            <br />
            TRACK.
          </h1>
          <p className="text-body font-light max-w-md leading-relaxed text-sm md:text-base">
            Precision parts selected by M engineers. Every component validated
            on the Nürburgring Nordschleife.
          </p>
          <button
            onClick={() =>
              document
                .getElementById("products")
                ?.scrollIntoView({ behavior: "smooth" })
            }
            className="mt-8 h-12 px-8 bg-accent text-white text-[10px] tracking-[0.25em] uppercase font-bold rounded-full hover:bg-accent-hover transition-colors"
          >
            SHOP NOW
          </button>
        </div>
      </section>

      <MStripe />

      {/* Product grid */}
      <main id="products" className="px-6 md:px-10 py-12">
        <div className="flex items-baseline justify-between mb-8">
          <h2 className="text-on-dark font-bold text-xs tracking-[0.25em] uppercase">
            All Products
          </h2>
          <span className="text-muted text-[10px] tracking-[0.15em] uppercase">
            {PRODUCTS.length} Items
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {PRODUCTS.map((product) => (
            <ProductCard key={product.id} product={product} onAdd={handleAdd} />
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-hairline px-8 md:px-14 py-10">
        <MStripe />
        <div className="pt-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <span className="text-on-dark font-bold text-sm tracking-widest uppercase">
            M
          </span>
          <p className="text-muted text-[10px] tracking-[0.1em] font-light">
            Demo UI · spring-boot-observability-playground ·{" "}
            <code className="text-body-strong font-bold">
              POST /api/v1/order
            </code>
          </p>
        </div>
      </footer>

      <Cart
        items={cartItems}
        isOpen={cartOpen}
        onClose={() => setCartOpen(false)}
        onUpdateQty={handleUpdateQty}
        onRemove={handleRemove}
        onOrderSuccess={handleOrderSuccess}
      />
    </>
  );
}
