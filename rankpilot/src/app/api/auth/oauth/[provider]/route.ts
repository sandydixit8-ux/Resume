import { NextRequest, NextResponse } from "next/server";
import { getClientIp } from "@/lib/http";
import { rateLimit } from "@/lib/security/rate-limit";
import { createFlow, oauthCookieSet, stateTtlMs } from "@/lib/auth/oauth/flow";
import { getProvider } from "@/lib/auth/oauth/provider";
import { log } from "@/lib/logger";

/**
 * GET /api/auth/oauth/[provider]  — start identity-provider login.
 *
 * Builds the authorization URL with PKCE (code_challenge) and a random state,
 * stashes the flow in a signed cookie, and redirects the browser to the
 * provider. The browser must return to the callback to complete the flow, so
 * this is a 303 to the provider's consent screen, never a JSON response; a
 * mismatched provider is 404 and an unconfigured provider 503.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const ip = getClientIp(req);
  const rl = rateLimit(`oauth:start:${ip}`, 20, 60_000);
  if (!rl.allowed) {
    return new NextResponse("Too many sign-in attempts. Try again shortly.", { status: 429 });
  }

  const { provider: providerName } = await params;
  const provider = getProvider(providerName);
  if (!provider) return new NextResponse("Not found", { status: 404 });

  const problem = provider.configProblem();
  if (problem) {
    log.warn("oauth.start.disabled", { ip, provider: providerName, problem });
    return new NextResponse("This sign-in method is not configured.", { status: 503 });
  }

  const redirectTo = req.nextUrl.searchParams.get("redirect") || "/app";
  const flow = createFlow({ redirectTo, redirectUri: provider.callbackUrl });

  const url = provider.authorizationUrl(flow.state, flow.codeChallenge);
  log.info("oauth.start", { ip, provider: providerName });

  const res = NextResponse.redirect(url, 303);
  res.headers.set("Set-Cookie", oauthCookieSet(flow.cookieValue, Math.floor(stateTtlMs() / 1000)));
  return res;
}