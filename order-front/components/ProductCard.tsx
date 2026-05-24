"use client";

import { Product } from "@/lib/types";

interface ProductCardProps {
  product: Product;
  onAdd: (product: Product) => void;
}

const CATEGORY_SYMBOL: Record<string, string> = {
  AERODYNAMICS: "⬡",
  INTERIOR: "⬟",
  BRAKES: "⬠",
  WHEELS: "◎",
  EXHAUST: "◈",
  LIFESTYLE: "◇",
};

export function ProductCard({ product, onAdd }: ProductCardProps) {
  return (
    <article className="bg-surface-card flex flex-col h-full rounded-2xl overflow-hidden shadow-sm border border-hairline">
      {/* Image area */}
      <div className="relative bg-surface-soft aspect-[4/3] flex items-center justify-center select-none overflow-hidden">
        <span className="text-[5rem] text-muted leading-none opacity-40">
          {CATEGORY_SYMBOL[product.category] ?? "◈"}
        </span>
        <span className="absolute bottom-3 left-3 text-muted text-[10px] tracking-[0.2em] uppercase font-bold">
          {product.category}
        </span>
      </div>

      {/* Content */}
      <div className="p-5 flex flex-col gap-4 flex-1">
        <div className="flex-1">
          <h3 className="text-on-dark font-bold text-xs tracking-[0.08em] uppercase leading-snug mb-2">
            {product.name}
          </h3>
          <p className="text-muted text-xs font-light leading-relaxed line-clamp-2">
            {product.description}
          </p>
        </div>

        {/* Price + CTA */}
        <div className="flex items-center justify-between pt-3 border-t border-hairline">
          <span className="text-body-strong font-bold text-sm tabular-nums">
            ${product.price.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </span>
          <button
            onClick={() => onAdd(product)}
            className="h-9 px-5 bg-accent text-white text-[10px] tracking-[0.2em] uppercase font-bold rounded-full hover:bg-accent-hover transition-colors"
          >
            ADD
          </button>
        </div>
      </div>
    </article>
  );
}
