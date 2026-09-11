"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";
import { useState } from "react";
import { FAB_ACTIONS } from "@/lib/nav";
import { Sheet } from "@/components/ui/sheet";

export function Fab({ permissions }: { permissions: string[] }) {
  const [open, setOpen] = useState(false);
  const actions = FAB_ACTIONS.filter(
    (a) => !a.perms || a.perms.some((p) => permissions.includes(p))
  );

  if (actions.length === 0) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Quick actions"
        className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--primary)] text-white shadow-lg shadow-orange-600/30 transition-transform active:scale-95 lg:bottom-6"
      >
        <Plus className={cn("h-6 w-6 transition-transform", open && "rotate-45")} />
      </button>
      <Sheet open={open} onOpenChange={setOpen} title="Quick actions" description="One-tap actions">
        <div className="grid grid-cols-2 gap-2">
          {actions.map((a) => (
            <Link
              key={a.label}
              href={a.href}
              onClick={() => setOpen(false)}
              className="rounded-lg border border-[var(--border)] bg-white px-3 py-3 text-center text-xs font-medium hover:bg-zinc-50"
            >
              {a.label}
            </Link>
          ))}
        </div>
      </Sheet>
    </>
  );
}