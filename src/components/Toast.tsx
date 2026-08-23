import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { IconCheck, IconAlert, IconInfo, IconX } from "./Icons";

type Kind = "success" | "warning" | "error";

interface Toast {
  id: number;
  kind: Kind;
  title: string;
  detail?: string;
}

interface ToastCtx {
  push: (kind: Kind, title: string, detail?: string) => void;
}

const Ctx = createContext<ToastCtx | null>(null);

export function useToast(): ToastCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

const STYLE: Record<Kind, { border: string; iconBg: string; icon: ReactNode }> = {
  success: {
    border: "border-emerald-400/40",
    iconBg: "bg-emerald-400/15 text-emerald-300",
    icon: <IconCheck className="h-3.5 w-3.5" strokeWidth={2.2} />,
  },
  warning: {
    border: "border-warn/40",
    iconBg: "bg-warn/15 text-warn",
    icon: <IconAlert className="h-3.5 w-3.5" strokeWidth={2} />,
  },
  error: {
    border: "border-danger/40",
    iconBg: "bg-danger/15 text-danger",
    icon: <IconInfo className="h-3.5 w-3.5" strokeWidth={2} />,
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const push = useCallback(
    (kind: Kind, title: string, detail?: string) => {
      const id = ++counter.current;
      setToasts((t) => [...t.slice(-3), { id, kind, title, detail }]);
      window.setTimeout(() => dismiss(id), 5200);
    },
    [dismiss]
  );

  const value = useMemo(() => ({ push }), [push]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex w-[min(360px,calc(100vw-40px))] flex-col gap-2">
        {toasts.map((t) => {
          const s = STYLE[t.kind];
          return (
            <div
              key={t.id}
              className={`toast-in pointer-events-auto flex items-start gap-3 rounded-xl border ${s.border} bg-raised/95 px-3.5 py-3 shadow-2xl shadow-black/50 backdrop-blur`}
            >
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${s.iconBg}`}
              >
                {s.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold leading-snug text-txt">{t.title}</p>
                {t.detail && (
                  <p className="mt-0.5 text-[12px] leading-snug text-mute">{t.detail}</p>
                )}
              </div>
              <button
                onClick={() => dismiss(t.id)}
                className="rounded-md p-1 text-faint transition-colors hover:bg-line/50 hover:text-txt"
                aria-label="Dismiss notification"
              >
                <IconX className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}
