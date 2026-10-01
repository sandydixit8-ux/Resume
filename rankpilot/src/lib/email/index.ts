/**
 * Email delivery.
 *
 * Deliberately not bound to one vendor. `EmailProvider` is the contract; the
 * provider is chosen by `EMAIL_PROVIDER` at boot. Adding SES or SMTP means
 * adding a module here and nothing else -- no route, no business logic, and no
 * call site changes.
 *
 * RankPilot ships with a `webhook` provider because it has no vendor
 * dependency: point EMAIL_WEBHOOK_URL at whatever already sends mail for you
 * (an ESP, a Lambda, an internal relay).
 *
 * A missing or failing transport returns an explicit reason. It never pretends
 * to have sent: "we emailed you" that delivered nothing is worse than an
 * error, because the user then waits for a message that will never arrive.
 */

export type EmailTemplate =
  | "password_reset"
  | "email_verification"
  | "password_changed"
  | "security_notification";

export type EmailResult =
  | { sent: true; provider: string }
  | {
      sent: false;
      reason: "not_configured" | "unknown_provider" | "send_failed";
      provider: string;
      detail?: string;
    };

export interface EmailMessage {
  to: string;
  template: EmailTemplate;
  subject: string;
  text: string;
  html?: string;
  /** Opaque correlation data for the receiving system. Never a secret. */
  data?: Record<string, string>;
}

export interface EmailProvider {
  readonly name: string;
  isConfigured(): boolean;
  send(msg: EmailMessage): Promise<EmailResult>;
}

const TIMEOUT_MS = 10_000;

function subjectFor(template: EmailTemplate): string {
  switch (template) {
    case "password_reset":
      return "Reset your RankPilot password";
    case "email_verification":
      return "Verify your RankPilot email address";
    case "password_changed":
      return "Your RankPilot password was changed";
    case "security_notification":
      return "Security notice for your RankPilot account";
  }
}

/** POSTs to an operator-configured HTTP endpoint. Vendor-neutral. */
class WebhookProvider implements EmailProvider {
  readonly name = "webhook";

  private url(): string | null {
    const url = process.env.EMAIL_WEBHOOK_URL?.trim();
    // Operator config, not user input: this rejects a misconfiguration early
    // rather than defending against an attacker.
    return url && /^https?:\/\//i.test(url) ? url : null;
  }

  isConfigured(): boolean {
    return this.url() !== null;
  }

  async send(msg: EmailMessage): Promise<EmailResult> {
    const url = this.url();
    if (!url) return { sent: false, reason: "not_configured", provider: this.name };

    const headers: Record<string, string> = { "content-type": "application/json" };
    const token = process.env.EMAIL_WEBHOOK_TOKEN?.trim();
    if (token) headers.authorization = `Bearer ${token}`;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          to: msg.to,
          from: process.env.EMAIL_FROM?.trim() || undefined,
          template: msg.template,
          subject: msg.subject || subjectFor(msg.template),
          text: msg.text,
          html: msg.html,
          data: msg.data,
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) {
        return {
          sent: false,
          reason: "send_failed",
          provider: this.name,
          detail: `endpoint responded ${res.status}`,
        };
      }
      return { sent: true, provider: this.name };
    } catch (e) {
      return {
        sent: false,
        reason: "send_failed",
        provider: this.name,
        detail: e instanceof Error ? e.message : "unknown error",
      };
    }
  }
}

const PROVIDERS: Record<string, EmailProvider> = {
  webhook: new WebhookProvider(),
};

export function getEmailProvider(): EmailProvider {
  const name = process.env.EMAIL_PROVIDER?.trim().toLowerCase() || "webhook";
  return PROVIDERS[name] ?? new UnknownProvider(name);
}

class UnknownProvider implements EmailProvider {
  constructor(private readonly requested: string) {}
  get name(): string {
    return this.requested;
  }
  isConfigured(): boolean {
    return false;
  }
  async send(): Promise<EmailResult> {
    return { sent: false, reason: "unknown_provider", provider: this.requested };
  }
}

export function isEmailConfigured(): boolean {
  return getEmailProvider().isConfigured();
}

export async function sendEmail(
  template: EmailTemplate,
  to: string,
  text: string,
  extra: { html?: string; data?: Record<string, string> } = {}
): Promise<EmailResult> {
  return getEmailProvider().send({
    to,
    template,
    subject: subjectFor(template),
    text,
    ...extra,
  });
}

export const RESET_TTL_MINUTES = Number(process.env.RESET_TOKEN_TTL_MINUTES || 60);
export const VERIFICATION_TTL_MINUTES = Number(process.env.VERIFY_TOKEN_TTL_MINUTES || 60 * 24);
