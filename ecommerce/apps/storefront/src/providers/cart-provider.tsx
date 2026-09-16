"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { cartApi, getCartToken } from "@/lib/api";

type CartContextValue = {
  itemCount: number;
  ready: boolean;
  refresh: () => Promise<void>;
  addToCart: (variantId: string, quantity: number) => Promise<void>;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [itemCount, setItemCount] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getCartToken()) {
      setReady(true);
      return;
    }
    cartApi
      .getCart()
      .then((cart) => setItemCount(cart.totals.itemCount))
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, []);

  const refresh = useCallback(async () => {
    const cart = await cartApi.getCart();
    setItemCount(cart.totals.itemCount);
  }, []);

  const addToCart = useCallback(async (variantId: string, quantity: number) => {
    const cart = await cartApi.addItem(variantId, quantity);
    setItemCount(cart.totals.itemCount);
  }, []);

  const value = useMemo(() => ({ itemCount, ready, refresh, addToCart }), [itemCount, ready, refresh, addToCart]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within a CartProvider");
  return context;
}