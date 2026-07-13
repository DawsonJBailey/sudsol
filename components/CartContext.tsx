"use client";

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { createClient } from "@/utils/supabase/client";

export type CartItem = {
  slug: string;
  name: string;
  price: number;
  quantity: number;
};

type CartContextType = {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">) => void;
  removeItem: (slug: string) => void;
  updateQuantity: (slug: string, quantity: number) => void;
  clearCart: () => void;
  subtotal: number;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

const STORAGE_KEY = "meridian-turf-cart";
// How long after the last change to wait before writing the cart to Supabase,
// so rapid quantity clicks don't fire a request per click.
const SYNC_DEBOUNCE_MS = 2000;

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const syncTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setItems(JSON.parse(stored));
    } catch (e) {
      console.error("Failed to load cart:", e);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    }
  }, [items, loaded]);

  // Track the logged-in user so we know whose cart to mirror server-side.
  // This shadow copy in Supabase (not localStorage) is what the abandoned-cart
  // cron job queries, since it has no access to the browser's localStorage.
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!loaded || !userId) return;

    if (syncTimeout.current) clearTimeout(syncTimeout.current);
    syncTimeout.current = setTimeout(() => {
      const supabase = createClient();
      supabase
        .from("carts")
        .upsert({
          user_id: userId,
          items,
          updated_at: new Date().toISOString(),
          hubspot_synced_at: null,
        })
        .then(({ error }) => {
          if (error) console.error("Failed to sync cart:", error);
        });
    }, SYNC_DEBOUNCE_MS);

    return () => {
      if (syncTimeout.current) clearTimeout(syncTimeout.current);
    };
  }, [items, loaded, userId]);

  function addItem(item: Omit<CartItem, "quantity">) {
    setItems((prev) => {
      const existing = prev.find((i) => i.slug === item.slug);
      if (existing) {
        return prev.map((i) =>
          i.slug === item.slug ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  }

  function removeItem(slug: string) {
    setItems((prev) => prev.filter((i) => i.slug !== slug));
  }

  function updateQuantity(slug: string, quantity: number) {
    if (quantity < 1) return removeItem(slug);
    setItems((prev) =>
      prev.map((i) => (i.slug === slug ? { ...i, quantity } : i))
    );
  }

  function clearCart() {
    setItems([]);
  }

  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, clearCart, subtotal }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
