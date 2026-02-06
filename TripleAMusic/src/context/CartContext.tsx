import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";

export interface CartItem {
  gigId: string;
  gigTitle: string;
  gigDate: string;
  gigTime?: string;
  locationName?: string;
  locationId?: string;
  ticketPrice: number;
  quantity: number;
  // Seating & tier info for reserved seating / tiered events
  tierId?: string;
  tierName?: string;
  seatIds?: string[];
}

interface CartContextValue {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  addItem: (item: Omit<CartItem, "quantity"> & { quantity?: number }) => void;
  updateQuantity: (gigId: string, quantity: number) => void;
  updateSeatIds: (gigId: string, seatIds: string[] | undefined) => void;
  removeItem: (gigId: string) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

const CART_STORAGE_KEY = "triplea_cart";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    // Load from localStorage on init
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored) as CartItem[];
      }
    } catch {
      // Ignore parse errors
    }
    return [];
  });

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = useCallback(
    (item: Omit<CartItem, "quantity"> & { quantity?: number }) => {
      setItems((prev) => {
        const existing = prev.find((i) => i.gigId === item.gigId);
        if (existing) {
          // Update quantity if item exists
          return prev.map((i) =>
            i.gigId === item.gigId
              ? {
                  ...i,
                  quantity: Math.min(10, i.quantity + (item.quantity ?? 1)),
                }
              : i,
          );
        }
        // Add new item
        return [...prev, { ...item, quantity: item.quantity ?? 1 }];
      });
    },
    [],
  );

  const updateQuantity = useCallback((gigId: string, quantity: number) => {
    if (quantity < 1) {
      setItems((prev) => prev.filter((i) => i.gigId !== gigId));
    } else {
      setItems((prev) =>
        prev.map((i) =>
          i.gigId === gigId ? { ...i, quantity: Math.min(10, quantity) } : i,
        ),
      );
    }
  }, []);

  const updateSeatIds = useCallback(
    (gigId: string, seatIds: string[] | undefined) => {
      setItems((prev) =>
        prev.map((i) =>
          i.gigId === gigId
            ? {
                ...i,
                seatIds: seatIds && seatIds.length > 0 ? seatIds : undefined,
              }
            : i,
        ),
      );
    },
    [],
  );

  const removeItem = useCallback((gigId: string) => {
    setItems((prev) => prev.filter((i) => i.gigId !== gigId));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce(
    (sum, item) => sum + item.ticketPrice * item.quantity,
    0,
  );

  return (
    <CartContext.Provider
      value={{
        items,
        itemCount,
        subtotal,
        addItem,
        updateQuantity,
        updateSeatIds,
        removeItem,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
