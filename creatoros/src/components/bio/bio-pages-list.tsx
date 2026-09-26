"use client";

import Link from "next/link";
import { Link2, Plus, QrCode } from "lucide-react";

export interface BioPageRow {
  id: string;
  slug: string;
  title: string;
  published: number;
}

export function BioPagesList({ pages, username }: { pages: BioPageRow[]; username: string }) {
  return (
    <div className="space-y-4">
      {pages.length === 0 && (
        <div className="card p-8 text-center">
          <p className="text-navy-500">No bio pages yet. Create your first page to get started.</p>
        </div>
      )}
      {pages.map((p) => (
        <div key={p.id} className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-navy-900">{p.title}</h3>
              {p.published ? (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-600">Live</span>
              ) : (
                <span className="rounded-full bg-navy-100 px-2 py-0.5 text-xs font-medium text-navy-500">Draft</span>
              )}
            </div>
            <p className="mt-1 text-sm text-navy-500">
              {username ? (
                <>
                  creatoros.app/@<span className="font-medium text-brand-600">{username}</span>{p.slug ? `/${p.slug}` : ""}
                </>
              ) : (
                "Username not set yet"
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {username && (
              <>
                <Link href={`/@${username}${p.slug ? `/${p.slug}` : ""}`} target="_blank" className="btn-secondary !px-3 !py-1.5 text-xs">
                  <Link2 className="h-3.5 w-3.5" /> Open
                </Link>
                <a className="btn-secondary !px-3 !py-1.5 text-xs" href={`/api/bio/${p.id}/qr`} target="_blank" rel="noreferrer">
                  <QrCode className="h-3.5 w-3.5" /> QR
                </a>
              </>
            )}
            <Link href={`/app/bio/${p.id}`} className="btn-primary !px-3 !py-1.5 text-xs">
              <Plus className="h-3.5 w-3.5" /> Edit
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}

export function NewBioPageButton({ onCreate }: { onCreate: () => void }) {
  return (
    <button type="button" onClick={onCreate} className="btn-primary">
      <Plus className="h-4 w-4" /> New page
    </button>
  );
}