import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/get-session";
import { listNotifications } from "@/lib/notifications/engine";
import { NotificationsList } from "@/components/notifications/notifications-list";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const s = await getSession();
  if (!s) redirect("/auth/login");

  const notifications = listNotifications(s.org.id, s.user.id).map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    read: n.read,
    created_at: n.created_at,
  }));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-950">Notifications</h1>
        <p className="mt-1 text-sm text-navy-500">Reactions, comments and happenings in your workspace.</p>
      </div>
      <NotificationsList initial={notifications} />
    </div>
  );
}