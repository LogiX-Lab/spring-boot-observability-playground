"use client";

import { MStripe } from "./MStripe";

interface NavbarProps {
  cartCount: number;
  onCartOpen: () => void;
}

export function Navbar({ cartCount, onCartOpen }: NavbarProps) {
  return (
    <header className="sticky top-0 z-30">
      <nav className="bg-canvas border-b border-hairline flex items-center justify-between px-6 md:px-10 h-16">
        {/* Logo */}
        <div className="flex items-center gap-8">
          <a
            href="/"
            className="flex items-center gap-2 select-none"
            aria-label="M Shop home"
          >
            <span
              className="text-on-dark font-bold text-2xl tracking-widest uppercase leading-none"
              aria-hidden="true"
            >
              M
            </span>
            <span className="text-muted text-xs tracking-[0.25em] uppercase hidden sm:block">
              Performance
            </span>
          </a>

          {/* Navigation */}
          <div className="hidden md:flex items-center gap-6">
            {["Shop", "Parts", "Lifestyle", "About"].map((label) => (
              <a
                key={label}
                href="#"
                className="text-body hover:text-on-dark text-xs tracking-[0.15em] uppercase transition-colors"
              >
                {label}
              </a>
            ))}
          </div>
        </div>

        {/* Cart */}
        <button
          onClick={onCartOpen}
          className="relative w-11 h-11 rounded-full border border-hairline flex items-center justify-center hover:border-on-dark transition-colors"
          aria-label={`Open cart${cartCount > 0 ? `, ${cartCount} items` : ""}`}
        >
          <CartIcon />
          {cartCount > 0 && (
            <span
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-m-red text-on-dark text-[10px] font-bold flex items-center justify-center leading-none"
              aria-hidden="true"
            >
              {cartCount > 9 ? "9+" : cartCount}
            </span>
          )}
        </button>
      </nav>
      <MStripe />
    </header>
  );
}

function CartIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-on-dark"
      aria-hidden="true"
    >
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 01-8 0" />
    </svg>
  );
}
