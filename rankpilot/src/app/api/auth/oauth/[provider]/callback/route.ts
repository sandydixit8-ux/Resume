import { NextRequest, NextResponse } from "next/server";
import { err, getClientIp } from "@/lib/http";
import { rateLimit } from "@/lib/security/rate-limit";
import { createSession } from "@/lib/auth/service";
import { setSessionCookie } from "@/lib/auth/session";
import { oauthCookieClear, resolveFlow } from "@/lib/auth/oauth/flow";
import { getProvider } from "@/lib/auth/oauth/provider";
import { resolveOAuthIdentity } from "@/lib/auth/oauth/accounts";
import type { OAuthProviderName } from "@/lib/auth/oauth/accounts";
import { siteUrl } from "@/lib/site-url";
import { audit } from "@/lib/audit";
import { log } from "@/lib/logger";

/**
 * GET /api/auth/oauth/[provider]/callback
 *
 * The provider bounces the browser back here with `code` + `state`. We verify
 * the signed flow cookie matches the presented `state` (constant time), burn
 * the cookie, exchange the code for a verified identity, resolve the account
 * and land a session. Everything other than a successful login redirects the
 * browser back to the app (see `loginErrorUrl`) so an operator sees one web
 * surface rather than raw JSON — but a state mismatch is audited and rate
 * limited because that is the earliest sign of a replay / login-CSRF attempt.
 */

function loginErrorUrl(redirectTo: string, reason: string): string {
  const base = siteUrl();
  const url = new URL(redirectTo, base);
  if (reason) url.searchParams.set("oauth_error", reason);
  return url.toString();
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const ip = getClientIp(req);
  const rl = rateLimit(`oauth:callback:${ip}`, 30, 15 * 60_000);
  if (!rl.allowed) return err.rateLimited("Too many sign-in callbacks. Try again later.");

  const { provider: providerName } = await params;
  const provider = getProvider(providerName);
  if (!provider) return new NextResponse("Not found", { status: 404 });
  const problem = provider.configProblem();
  if (problem) return new NextResponse("This sign-in method is not configured.", { status: 503 });

  const code = req.nextUrl.searchParams.get("code") ?? "";
  const state = req.nextUrl.searchParams.get("state") ?? "";
  const oauthCookie = req.cookies.get("rankpilot_oauth")?.value ?? null;

  const flowResult = resolveFlow(oauthCookie, state);
  const fallback = "/app";
  if (!flowResult.ok) {
    if (flowResult.reason === "state_mismatch" || flowResult.reason === "invalid_signature") {
      log.warn("oauth.callback.state_failed", { ip, provider, reason: flowResult.reason });
    }
    const res = NextResponse.redirect(loginErrorUrl(fallback, "login_failed"), 303);
    res.headers.set("Set-Cookie", oauthCookieClear());
    return res;
  }

  const { flow } = flowResult;
  const profile = await provider.exchangeCode(code, flow.verifier);
  if (!profile) {
    log.warn("oauth.callback.exchange_failed", { ip, provider: providerName, reason: "bad_code" });
    const res = NextResponse.redirect(loginErrorUrl(flow.redirectTo, "login_failed"), 303);
    res.headers.set("Set-Cookie", oauthCookieClear());
    return res;
  }

  const identity = {
    provider: providerName as OAuthProviderName,
    subject: profile.subject,
    email: profile.email,
    emailVerified: profile.emailVerified,
    name: profile.name,
  };

  // The profile is verified and the email was confirmed by the provider, so a
  // mismatch here is a genuine internal failure, not an attack signal.
  const resolution = await resolveOAuthIdentity(identity);
  if (!resolution.ok) {
    log.warn("oauth.callback.no_membership", { ip, provider, email: identity.email });
    const res = NextResponse.redirect(loginErrorUrl(flow.redirectTo, "login_failed"), 303);
    res.headers.set("Set-Cookie", oauthCookieClear());
    return res;
  }

  const { token } = createSession(
    resolution.userId,
    resolution.tenantId,
    ip,
    req.headers.get("user-agent") || ""
  );

  audit({
    tenantId: resolution.tenantId,
    userId: resolution.userId,
    action:
      resolution.mode === "registered"
        ? "auth.oauth.register"
        : resolution.mode === "linked"
          ? "auth.oauth.link"
          : "auth.oauth.login",
    entity: "user",
    entityId: resolution.userId,
    meta: { provider },
    ip,
  });
  log.info("oauth.callback.ok", {
    ip,
    provider: providerName,
    userId: resolution.userId,
    tenantId: resolution.tenantId,
    mode: resolution.mode,
  });

  const res = NextResponse.redirect(loginErrorUrl(flow.redirectTo, ""), 303);
  res.headers.append("Set-Cookie", oauthCookieClear());
  res.headers.append("Set-Cookie", setSessionCookie(token));
  return res;
}