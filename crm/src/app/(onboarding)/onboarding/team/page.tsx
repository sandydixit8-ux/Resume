import type { Metadata } from "next";
import { TeamForm } from "@/components/onboarding/team-form";

export const metadata: Metadata = { title: "Invite team" };

export default function TeamPage() {
  return <TeamForm />;
}