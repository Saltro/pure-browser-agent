import * as React from "react";
import { Toast as RadixToast } from "radix-ui";
import { cn } from "@/lib/utils";

type ToastVariant = "default" | "destructive";

type ToastItem = {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
};

type ToastContextType = {
  toasts: ToastItem[];
  toast: (item: Omit<ToastItem, "id">) => void;
  dismiss: (id: string) => void;
};

const ToastContext = React.createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const toast = React.useCallback((item: Omit<ToastItem, "id">) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, duration: 4000, ...item }]);
  }, []);

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <RadixToast.Provider>
      <ToastContext.Provider value={{ toasts, toast, dismiss }}>
        {children}
        <RadixToast.Viewport className="fixed bottom-4 right-4 z-[100] flex w-80 max-w-[100vw] flex-col gap-2 outline-none" />
        {toasts.map((t) => (
          <RadixToast.Root
            key={t.id}
            className={cn(
              "group pointer-events-auto relative flex w-full items-start justify-between gap-3 overflow-hidden rounded-md border p-4 pr-6 shadow-lg transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=open]:slide-in-from-bottom-full data-[state=closed]:slide-out-to-right-full",
              t.variant === "destructive"
                ? "border-destructive bg-destructive text-destructive-foreground"
                : "border-border bg-background text-foreground",
            )}
            duration={t.duration}
            onOpenChange={(open) => {
              if (!open) dismiss(t.id);
            }}
          >
            <div className="grid gap-1">
              {t.title && (
                <RadixToast.Title className="text-sm font-semibold">
                  {t.title}
                </RadixToast.Title>
              )}
              {t.description && (
                <RadixToast.Description className="text-sm opacity-80">
                  {t.description}
                </RadixToast.Description>
              )}
            </div>
            <RadixToast.Close className="absolute right-2 top-2 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none group-hover:opacity-100">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </RadixToast.Close>
          </RadixToast.Root>
        ))}
      </ToastContext.Provider>
    </RadixToast.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
