import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/get-session";
import { CoachPanel } from "@/components/coach/panel";

export const dynamic = "force-dynamic";

export default async function CoachPage() {
  const s = await getSession();
  if (!s) redirect("/auth/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-950">AI Coach</h1>
        <p className="mt-1 text-sm text-navy-500">Actionable insights from your real data — what to double down on, what to fix.</p>
      </div>
      <CoachPanel />
    </div>
  );
}