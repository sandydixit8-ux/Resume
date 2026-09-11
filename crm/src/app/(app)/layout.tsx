import { redirect } from "next/navigation";
import { requireUser, getUserContext } from "@/lib/auth";
import { AppShell, type ShellContextData } from "@/components/layout/app-shell";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  const ctx = await getUserContext();

  // Users who have not completed onboarding go to the setup flow.
  if (!ctx.user?.organization_id) {
    redirect("/onboarding/business");
  }
  if (!ctx.organization) {
    redirect("/onboarding/business");
  }

  const supabase = await createClient();
  const { count: unread } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", ctx.user.id)
    .eq("is_read", false);

  const data: ShellContextData = {
    orgName: ctx.organization.name,
    userName: ctx.user.full_name,
    permissions: ctx.permissions,
    unreadNotifications: unread ?? 0,
  };

  return <AppShell data={data}>{children}</AppShell>;
}