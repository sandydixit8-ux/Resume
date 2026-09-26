import { redirect } from "next/navigation";
import { ShoppingBag } from "lucide-react";
import { getSession } from "@/lib/auth/get-session";
import { can } from "@/lib/auth/rbac";
import { row } from "@/lib/db/db";
import { StoreManager } from "@/components/store/store-manager";

export const dynamic = "force-dynamic";

export default async function StorePage() {
  const s = await getSession();
  if (!s) redirect("/auth/login");
  if (!can(s.role as never, "store:read")) redirect("/app");

  const profile = row<{ username: string }>(
    "SELECT username FROM profiles WHERE tenant_id = ? ORDER BY created_at ASC LIMIT 1",
    s.org.id
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-navy-950">Store</h1>
          <p className="mt-1 text-sm text-navy-500">Products sold from your link-in-bio page. Payments via Stripe.</p>
        </div>
        <span className="btn-secondary">
          <ShoppingBag className="h-4 w-4" /> {profile?.username ? `/@${profile.username}` : ""}
        </span>
      </div>

      <StoreManager canWrite={can(s.role as never, "store:write")} />
    </div>
  );
}
