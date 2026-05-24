"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MStripe } from "./MStripe";
import { useTheme } from "./ThemeProvider";

interface NavbarProps {
  cartCount: number;
  onCartOpen: () => void;
}

const NAV_ITEMS = [
  { label: "Shop", href: "/" },
  { label: "History", href: "/history" },
];

export function Navbar({ cartCount, onCartOpen }: NavbarProps) {
  const { theme, toggle } = useTheme();
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30">
      <nav className="bg-canvas border-b border-hairline flex items-center justify-between px-6 md:px-10 h-16">
        {/* Logo */}
        <div className="flex items-center gap-8">
          <Link
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
          </Link>

          {/* Navigation */}
          <div className="hidden md:flex items-center gap-6">
            {NAV_ITEMS.map(({ label, href }) => (
              <Link
                key={label}
                href={href}
                className={`text-xs tracking-[0.15em] uppercase transition-colors ${
                  pathname === href
                    ? "text-on-dark font-bold"
                    : "text-body hover:text-on-dark"
                }`}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2">
          {/* Theme toggle */}
          <button
            onClick={toggle}
            className="w-11 h-11 rounded-full border border-hairline flex items-center justify-center hover:border-on-dark transition-colors"
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          >
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </button>

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
        </div>
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

function SunIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-on-dark"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-on-dark"
      aria-hidden="true"
    >
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  );
}
