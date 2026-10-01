/**
 * Identity-provider plumbing used by the OAuth routes.
 *
 * Currently only Google. The registry is deliberately small: a second provider
 * must add its own adapter here plus a documented env contract, and nothing in
 * the routes hard-codes Google's endpoints.
 */

import { absoluteUrl } from "@/lib/site-url";
import { authorizationUrl as googleAuthUrl, exchangeGoogleCode } from "./google";
import type { GoogleProfile } from "./google";

export type OAuthProviderName = "google";

export interface OAuthProvider {
  name: OAuthProviderName;
  /** Absolute callback URL for the authorize (and token) request. */
  callbackUrl: string;
  /** Human reason the provider is unusable, or null when configured. */
  configProblem: () => string | null;
  /** Build the authorization URL for /start. */
  authorizationUrl(state: string, codeChallenge: string): string;
  /** Exchange the code from the callback for a verified profile. */
  exchangeCode(code: string, verifier: string): Promise<GoogleProfile | null>;
}

function googleConfig(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

function googleProvider(): OAuthProvider {
  const callbackUrl = absoluteUrl("/api/auth/oauth/google/callback");
  return {
    name: "google",
    callbackUrl,
    configProblem: () => {
      const config = googleConfig();
      if (!config) {
        return "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are not set, so Google sign-in is disabled";
      }
      return null;
    },
    authorizationUrl: (state, codeChallenge) => {
      const config = googleConfig();
      if (!config) throw new Error("google provider is not configured");
      return googleAuthUrl(config, { state, codeChallenge, redirectUri: callbackUrl });
    },
    exchangeCode: async (code, verifier) => {
      const config = googleConfig();
      if (!config) throw new Error("google provider is not configured");
      return exchangeGoogleCode(config, { code, verifier, redirectUri: callbackUrl });
    },
  };
}

function registry(): Record<OAuthProviderName, () => OAuthProvider> {
  return { google: googleProvider };
}

export function getProvider(name: string): OAuthProvider | null {
  const builder = registry()[name as OAuthProviderName];
  return builder ? builder() : null;
}

export function oauthProviderNames(): OAuthProviderName[] {
  return (Object.keys(registry()) as OAuthProviderName[]).sort();
}