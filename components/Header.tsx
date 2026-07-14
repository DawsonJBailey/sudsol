"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { useCart } from "./CartContext";
import { createClient } from "@/utils/supabase/client";
import SearchBar, { type SearchProduct } from "./SearchBar";

const navLinks = [
  { label: "Sod", href: "/shop/sod" },
  { label: "Seed", href: "/shop/seed" },
  { label: "Plugs", href: "/shop/plugs" },
  { label: "Guides", href: "/guides" },
  { label: "Pest ID", href: "/pest-identifier" },
  { label: "Contact Us", href: "/contact" },
];

type Profile = {
  full_name: string | null;
  avatar_url: string | null;
};

export default function Header({ searchProducts = [] }: { searchProducts?: SearchProduct[] }) {
  const { items, removeItem, updateQuantity, subtotal, prepareCheckout } = useCart();
  const [checkingOut, setCheckingOut] = useState(false);

  async function handleCheckout() {
    setCheckingOut(true);
    try {
      const url = await prepareCheckout();
      if (url) {
        window.location.assign(url);
        return;
      }
    } catch (e) {
      console.error("Checkout failed:", e);
    }
    setCheckingOut(false);
  }
  const count = items.reduce((sum, i) => sum + i.quantity, 0);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const cartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }
    supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("id", user.id)
      .single()
      .then(({ data }) => setProfile(data));
    // Re-fetch on navigation so edits made on /profile show up as soon as you leave the page.
  }, [supabase, user, pathname]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
      if (cartRef.current && !cartRef.current.contains(e.target as Node)) {
        setCartOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setCartOpen(false);
  }, [pathname]);

  async function handleSignOut() {
    setMenuOpen(false);
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  const initial = (profile?.full_name || user?.email || "?")
    .charAt(0)
    .toUpperCase();

  return (
    <header className="border-b border-pine/10 bg-parchment sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link
          href="/"
          className="font-display text-2xl font-600 text-pine tracking-tight"
        >
          Meridian Turf Co.
        </Link>
        <nav className="hidden md:flex gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-charcoal/80 hover:text-pine font-medium transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-4">
          <SearchBar products={searchProducts} />
          <div className="relative" ref={cartRef}>
            <button
              type="button"
              onClick={() => setCartOpen((open) => !open)}
              className="rounded-full bg-pine text-parchment px-5 py-2 text-sm font-medium hover:bg-pine-dark transition-colors"
              aria-label="Open cart"
              aria-expanded={cartOpen}
            >
              Cart{count > 0 ? ` (${count})` : ""}
            </button>
            {cartOpen ? (
              <div className="absolute right-0 mt-2 w-80 rounded-lg border border-pine/10 bg-white shadow-lg z-40">
                {items.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <p className="text-sm text-charcoal/60">
                      Your cart is empty
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="max-h-80 overflow-y-auto py-2">
                      {items.map((item) => (
                        <div
                          key={item.slug}
                          className="flex items-center justify-between gap-3 px-4 py-2"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-charcoal truncate">
                              {item.name}
                            </p>
                            <p className="text-xs text-charcoal/60">
                              ${item.price.toFixed(2)} each
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() =>
                                  updateQuantity(item.slug, item.quantity - 1)
                                }
                                className="w-6 h-6 rounded-full border border-pine/20 text-pine text-sm hover:bg-parchment-dark"
                                aria-label={`Decrease quantity of ${item.name}`}
                              >
                                −
                              </button>
                              <span className="w-5 text-center text-sm">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() =>
                                  updateQuantity(item.slug, item.quantity + 1)
                                }
                                className="w-6 h-6 rounded-full border border-pine/20 text-pine text-sm hover:bg-parchment-dark"
                                aria-label={`Increase quantity of ${item.name}`}
                              >
                                +
                              </button>
                            </div>
                            <button
                              onClick={() => removeItem(item.slug)}
                              className="text-xs text-clay hover:underline"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-pine/10 px-4 py-3">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-sm font-semibold text-charcoal">
                          Subtotal
                        </span>
                        <span className="text-sm font-semibold text-charcoal">
                          ${subtotal.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Link
                          href="/cart"
                          onClick={() => setCartOpen(false)}
                          className="flex-1 text-center rounded-full border border-pine/20 text-pine text-sm font-medium py-2 hover:bg-parchment-dark transition-colors"
                        >
                          View Cart
                        </Link>
                        <button
                          type="button"
                          onClick={handleCheckout}
                          disabled={checkingOut}
                          className="flex-1 text-center rounded-full bg-pine text-parchment text-sm font-medium py-2 hover:bg-pine-dark transition-colors disabled:opacity-60"
                        >
                          {checkingOut ? "Opening…" : "Checkout"}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : null}
          </div>
          {user ? (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                className="block h-9 w-9 rounded-full overflow-hidden border border-pine/20 hover:ring-2 hover:ring-gold transition-shadow"
                aria-label="Account menu"
              >
                {profile?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.avatar_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center bg-pine text-parchment text-sm font-medium">
                    {initial}
                  </span>
                )}
              </button>
              {menuOpen ? (
                <div className="absolute right-0 mt-2 w-44 rounded-lg border border-pine/10 bg-white shadow-lg py-1 z-40">
                  <Link
                    href="/profile"
                    onClick={() => setMenuOpen(false)}
                    className="block px-4 py-2 text-sm text-charcoal/80 hover:bg-parchment"
                  >
                    Edit Profile
                  </Link>
                  <Link
                    href="/orders"
                    onClick={() => setMenuOpen(false)}
                    className="block px-4 py-2 text-sm text-charcoal/80 hover:bg-parchment"
                  >
                    My Orders
                  </Link>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="block w-full text-left px-4 py-2 text-sm text-charcoal/80 hover:bg-parchment"
                  >
                    Sign Out
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <Link
              href="/login"
              className="text-sm font-medium text-charcoal/80 hover:text-pine transition-colors"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
