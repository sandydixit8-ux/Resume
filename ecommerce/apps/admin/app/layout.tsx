import type { Metadata } from "next";
import "./globals.css";
import { AdminShell } from "@/components/admin-shell";

export const metadata: Metadata = {
  title: "Nexus Admin",
  description: "Nexus platform administration.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-muted/30">
        <AdminShell>{children}</AdminShell>
      </body>
    </html>
  );
}