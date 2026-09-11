import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Set up Supabase" };
export const dynamic = "force-dynamic";

export default function SetupPage() {
  const hasUrl = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const hasAnon = Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const hasService = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold">VyaparOne CRM needs Supabase config</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This app stores data in Supabase (auth + Postgres). Add your project details to{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">crm/.env.local</code>, then restart the dev server.
        </p>

        <ol className="mt-4 space-y-2 text-sm">
          <li>
            1. Open{" "}
            <Link className="text-[var(--primary)] underline" href="https://supabase.com/dashboard" target="_blank" rel="noreferrer">
              supabase.com/dashboard
            </Link>{" "}
            and open your project.
          </li>
          <li>2. Go to Project Settings → API.</li>
          <li>3. Copy the Project URL and both API keys (anon + service_role).</li>
          <li>4. Create <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">crm/.env.local</code> and fill:</li>
        </ol>

        <pre className="mt-3 overflow-x-auto rounded-lg bg-zinc-900 p-3 text-xs leading-relaxed text-zinc-100">
{`NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key`}
        </pre>

        <div className="mt-4 rounded-lg border border-[var(--border)] bg-zinc-50 p-3 text-xs">
          <p className="font-medium text-foreground">Current status</p>
          <ul className="mt-1 space-y-1 text-muted-foreground">
            <li>Project URL: {hasUrl ? <span className="text-emerald-700">configured</span> : <span className="text-red-600">missing</span>}</li>
            <li>Anon key: {hasAnon ? <span className="text-emerald-700">configured</span> : <span className="text-red-600">missing</span>}</li>
            <li>Service role key: {hasService ? <span className="text-emerald-700">configured</span> : <span className="text-red-600">missing</span>}</li>
          </ul>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          After configuring, run{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">npm run dev</code> and open{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">http://localhost:3000</code>. You also need the database
          migrations applied (<code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">supabase db push</code>).
        </p>
      </div>
    </div>
  );
}
