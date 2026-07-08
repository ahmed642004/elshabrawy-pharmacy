"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

// Global transient toast (single slot — a new toast replaces the current one
// and resets the timer). Callers pass pre-translated strings. Placement and
// styling mirror the cart page's undo toast so the two read as one system.
const ToastContext = createContext<{ showToast: (message: string) => void } | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export default function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ id: Date.now(), message });
    timer.current = setTimeout(() => setToast(null), 2500);
  }, []);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <div
          key={toast.id}
          role="status"
          className="fixed bottom-24 left-1/2 z-[80] -translate-x-1/2 rounded-[10px] bg-neutral-800 px-4 py-3 text-[13.5px] text-white shadow-lg md:bottom-6"
          style={{ animation: "ccToastIn 200ms ease-out" }}
        >
          {toast.message}
        </div>
      )}
    </ToastContext.Provider>
  );
}
