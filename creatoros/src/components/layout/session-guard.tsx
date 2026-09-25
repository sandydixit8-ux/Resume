import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/get-session";

export default async function SessionGuard({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/auth/login");
  return <>{children}</>;
}