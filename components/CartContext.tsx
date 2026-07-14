"use client";

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  cartBuyerIdentityUpdate,
  cartCreate,
  cartGet,
  cartLinesAdd,
  cartLinesRemove,
  cartLinesUpdate,
  type ShopifyCart,
} from "@/lib/shopify/cart";

export type CartItem = {
  slug: string;
  variantId: string;
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
  /** True while cart changes are still being written to Shopify. */
  syncing: boolean;
  /** Flushes pending Shopify writes, then returns the hosted-checkout URL. */
  prepareCheckout: () => Promise<string | null>;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

const STORAGE_KEY = "meridian-turf-cart";
const CART_ID_KEY = "meridian-turf-cart-id";
// How long after the last change to wait before writing the cart to Supabase,
// so rapid quantity clicks don't fire a request per click.
const SYNC_DEBOUNCE_MS = 2000;
// Same idea for Shopify quantity updates.
const SHOPIFY_UPDATE_DEBOUNCE_MS = 600;

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const userEmailRef = useRef<string | null>(null);
  const [pendingOps, setPendingOps] = useState(0);
  const syncTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Local state is the rendering source of truth (optimistic UI); every change
  // is serialized through opQueue so Shopify mutations apply in click order.
  const itemsRef = useRef<CartItem[]>([]);
  const cartIdRef = useRef<string | null>(null);
  const checkoutUrlRef = useRef<string | null>(null);
  // slug → Shopify cart line id, learned from each mutation's response.
  const lineMapRef = useRef<Record<string, string>>({});
  const opQueue = useRef<Promise<void>>(Promise.resolve());
  const dirtySlugs = useRef<Set<string>>(new Set());
  const updateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  itemsRef.current = items;

  function applyCartMeta(cart: ShopifyCart) {
    cartIdRef.current = cart.id;
    checkoutUrlRef.current = cart.checkoutUrl;
    localStorage.setItem(CART_ID_KEY, cart.id);
    const map: Record<string, string> = {};
    for (const line of cart.lines) {
      map[line.merchandise.product.handle] = line.id;
    }
    lineMapRef.current = map;
  }

  function resetCart() {
    cartIdRef.current = null;
    checkoutUrlRef.current = null;
    lineMapRef.current = {};
    localStorage.removeItem(CART_ID_KEY);
  }

  function enqueue(op: () => Promise<void>) {
    setPendingOps((n) => n + 1);
    opQueue.current = opQueue.current
      .then(op)
      .catch(async (err) => {
        console.error("Cart sync failed:", err);
        // Re-sync from Shopify so local state doesn't drift after a failure.
        const cartId = cartIdRef.current;
        if (cartId) {
          try {
            const cart = await cartGet(cartId);
            if (cart) {
              applyCartMeta(cart);
              setItems(itemsFromCart(cart));
            }
          } catch (refetchErr) {
            console.error("Cart re-sync failed:", refetchErr);
          }
        }
      })
      .finally(() => setPendingOps((n) => n - 1));
  }

  function itemsFromCart(cart: ShopifyCart): CartItem[] {
    return cart.lines.map((line) => ({
      slug: line.merchandise.product.handle,
      variantId: line.merchandise.id,
      name: line.merchandise.product.title,
      price: Number(line.merchandise.price.amount),
      quantity: line.quantity,
    }));
  }

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        // Instant paint from the local mirror; items from before the Shopify
        // migration have no variantId and can't check out, so drop them.
        const parsed = (JSON.parse(stored) as CartItem[]).filter((i) => i.variantId);
        setItems(parsed);
      }
    } catch (e) {
      console.error("Failed to load cart:", e);
    }

    // The Shopify cart is the authority: hydrate from it, and treat a missing
    // cart (expired, or consumed by a completed checkout) as empty. This is
    // also how the cart clears itself after a successful checkout.
    const cartId = localStorage.getItem(CART_ID_KEY);
    if (cartId) {
      cartIdRef.current = cartId;
      enqueue(async () => {
        const cart = await cartGet(cartId);
        if (cart) {
          applyCartMeta(cart);
          setItems(itemsFromCart(cart));
        } else {
          resetCart();
          setItems([]);
        }
      });
    }

    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
      userEmailRef.current = data.user?.email ?? null;
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
      userEmailRef.current = session?.user?.email ?? null;
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

    enqueue(async () => {
      const line = { merchandiseId: item.variantId, quantity: 1 };
      const cartId = cartIdRef.current;
      // Shopify merges lines with the same merchandise, so re-adding an
      // existing item increments its line rather than duplicating it.
      const cart = cartId ? await cartLinesAdd(cartId, [line]) : await cartCreate([line]);
      applyCartMeta(cart);
    });
  }

  function flushQuantityUpdates() {
    if (updateTimer.current) {
      clearTimeout(updateTimer.current);
      updateTimer.current = null;
    }
    const slugs = [...dirtySlugs.current];
    dirtySlugs.current.clear();
    if (slugs.length === 0) return;

    enqueue(async () => {
      const cartId = cartIdRef.current;
      if (!cartId) return;
      // Line ids are read inside the queued op, after any in-flight add has
      // finished and populated lineMapRef.
      const lines = slugs.flatMap((slug) => {
        const lineId = lineMapRef.current[slug];
        const current = itemsRef.current.find((i) => i.slug === slug);
        return lineId && current ? [{ id: lineId, quantity: current.quantity }] : [];
      });
      if (lines.length > 0) {
        applyCartMeta(await cartLinesUpdate(cartId, lines));
      }
    });
  }

  function updateQuantity(slug: string, quantity: number) {
    if (quantity < 1) return removeItem(slug);
    setItems((prev) =>
      prev.map((i) => (i.slug === slug ? { ...i, quantity } : i))
    );
    dirtySlugs.current.add(slug);
    if (updateTimer.current) clearTimeout(updateTimer.current);
    updateTimer.current = setTimeout(flushQuantityUpdates, SHOPIFY_UPDATE_DEBOUNCE_MS);
  }

  function removeItem(slug: string) {
    setItems((prev) => prev.filter((i) => i.slug !== slug));
    dirtySlugs.current.delete(slug);
    enqueue(async () => {
      const cartId = cartIdRef.current;
      const lineId = lineMapRef.current[slug];
      if (!cartId || !lineId) return;
      applyCartMeta(await cartLinesRemove(cartId, [lineId]));
    });
  }

  function clearCart() {
    setItems([]);
    dirtySlugs.current.clear();
    resetCart();
  }

  async function prepareCheckout(): Promise<string | null> {
    flushQuantityUpdates();
    await opQueue.current;

    // Best effort: attach the signed-in email so checkout is prefilled and
    // the order shows up on /orders for this account.
    const cartId = cartIdRef.current;
    const email = userEmailRef.current;
    if (cartId && email) {
      try {
        applyCartMeta(await cartBuyerIdentityUpdate(cartId, email));
      } catch (err) {
        console.error("Failed to set cart buyer identity:", err);
      }
    }

    return checkoutUrlRef.current;
  }

  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        subtotal,
        syncing: pendingOps > 0,
        prepareCheckout,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
