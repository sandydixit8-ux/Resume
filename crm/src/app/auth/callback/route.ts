import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Auth callback for email confirmation / magic links / OTP tokens.
 * Exchanges the code, then makes sure the user profile row exists before
 * sending them to onboarding.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  const next = searchParams.get("next") ?? "/onboarding/business";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    try {
      const admin = createAdminClient();
      await admin.from("users").upsert(
        {
          id: user.id,
          email: user.email ?? "",
          full_name:
            typeof user.user_metadata?.full_name === "string"
              ? user.user_metadata.full_name
              : user.email?.split("@")[0] ?? "User",
        },
        { onConflict: "id" }
      );
    } catch (err) {
      console.error("callback profile upsert failed", err);
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}