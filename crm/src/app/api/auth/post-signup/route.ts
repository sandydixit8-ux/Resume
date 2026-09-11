import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Called right after signup to create the user's profile row in `public.users`
 * (needed before onboarding can attach an organization). Uses the service role
 * client because the row must exist even before email confirmation.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as { email?: string; name?: string } | null;
  if (!body?.email) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const name = body.name?.trim() || body.email.split("@")[0];

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    const admin = createAdminClient();
    await admin
      .from("users")
      .upsert(
        {
          id: user.id,
          email: user.email ?? body.email,
          full_name: name,
        },
        { onConflict: "id" }
      );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("post-signup failed", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}