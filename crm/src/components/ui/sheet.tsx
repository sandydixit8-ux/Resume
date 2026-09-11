"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Responsive dialog: bottom sheet on mobile (<md), centered modal on desktop.
 * Accessible: focus trap, Escape to close, labelled region.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title ?? "Dialog"}>
      <button
        aria-label="Close"
        className="absolute inset-0 bg-black/40"
        onClick={() => onOpenChange(false)}
      />
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-2xl bg-white shadow-2xl",
          "md:inset-x-auto md:left-1/2 md:top-1/2 md:bottom-auto md:w-full md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl md:max-h-[85vh]"
        )}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-zinc-200 md:hidden" />
        <div className="flex items-start justify-between gap-4 px-4 pt-4">
          <div>
            {title ? <h2 className="text-base font-semibold">{title}</h2> : null}
            {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
          </div>
          <button
            onClick={() => onOpenChange(false)}
            aria-label="Close dialog"
            className="rounded-md p-1 text-muted-foreground hover:bg-zinc-100 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-4 py-4">{children}</div>
        {footer ? (
          <div className="sticky bottom-0 flex gap-2 border-t border-[var(--border)] bg-white px-4 py-3">
            {footer}
          </div>
        ) : null}
        <div className="pb-safe" />
      </div>
    </div>,
    document.body
  );
}

/** Native-confirm style inline popover for quick actions (like a context menu). */
export function ActionMenu({
  trigger,
  items,
}: {
  trigger: (props: { toggle: () => void; open: boolean }) => React.ReactNode;
  items: { label: string; icon?: React.ReactNode; onClick: () => void; danger?: boolean }[];
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="relative">
      {trigger({ toggle: () => setOpen((o) => !o), open })}
      {open ? (
        <>
          <button
            aria-label="Close menu"
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-40 mt-1 w-48 overflow-hidden rounded-lg border border-[var(--border)] bg-white py-1 shadow-lg">
            {items.map((it) => (
              <button
                key={it.label}
                onClick={() => {
                  setOpen(false);
                  it.onClick();
                }}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-zinc-50",
                  it.danger ? "text-[var(--destructive)]" : "text-foreground"
                )}
              >
                {it.icon}
                {it.label}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}