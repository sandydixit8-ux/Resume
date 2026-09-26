import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { SITE_URL } from "@/lib/constants";
import { sign } from "@/lib/auth/session";

export interface EmailMessage {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  fromName?: string;
  fromEmail?: string;
  replyTo?: string;
}

export interface EmailResult {
  provider: string;
  providerId: string;
  previewPath?: string;
}

/** Replace {{placeholder}} tokens in a template body. */
export function renderTokens(body: string, vars: Record<string, string | number>): string {
  return body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key: string) => {
    if (key in vars) return String(vars[key]);
    return "";
  });
}

/** Build the unsubscribe link for a tenant + recipient email. */
export function buildUnsubscribeUrl(tenantId: string, email: string): string {
  const token = sign({ scope: "email_unsubscribe", tenantId, email });
  return `${SITE_URL}/api/email/unsubscribe?t=${token}`;
}

export function emailConfigured(): boolean {
  const provider = (process.env.EMAIL_PROVIDER || "log").toLowerCase();
  if (provider === "resend") return Boolean(process.env.RESEND_API_KEY);
  if (provider === "mailgun") return Boolean(process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN);
  return true; // log provider always available
}

export function defaultFromEmail(): string {
  return process.env.EMAIL_FROM || "no-reply@creatoros.dev";
}

/**
 * Provider-agnostic mailer. Choose a backend with EMAIL_PROVIDER:
 *   - "log"    (default) writes rendered HTML to data/emails/ — dev preview, zero config
 *   - "resend" uses the Resend HTTP API (RESEND_API_KEY)
 *   - "mailgun" uses the Mailgun HTTP API (MAILGUN_API_KEY + MAILGUN_DOMAIN)
 * Unsupported/unauthorized backends fall back to log mode so sends never hard-fail in dev.
 */
export async function sendEmail(msg: EmailMessage): Promise<EmailResult> {
  const provider = (process.env.EMAIL_PROVIDER || "log").toLowerCase();
  const from = `${msg.fromName || process.env.EMAIL_FROM_NAME || "CreatorOS"} <${msg.fromEmail || defaultFromEmail()}>`;

  if (provider === "resend" && process.env.RESEND_API_KEY) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [msg.toName ? `${msg.toName} <${msg.to}>` : msg.to],
        subject: msg.subject,
        html: msg.html,
        reply_to: msg.replyTo,
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as { id: string };
      return { provider: "resend", providerId: data.id };
    }
  }

  if (provider === "mailgun" && process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN) {
    const form = new FormData();
    form.set("from", from);
    form.set("to", msg.toName ? `${msg.toName} <${msg.to}>` : msg.to);
    form.set("subject", msg.subject);
    form.set("html", msg.html);
    if (msg.replyTo) form.set("h:Reply-To", msg.replyTo);
    const res = await fetch(`https://api.mailgun.net/v3/${process.env.MAILGUN_DOMAIN}/messages`, {
      method: "POST",
      headers: { Authorization: `Basic ${Buffer.from(`api:${process.env.MAILGUN_API_KEY}`).toString("base64")}` },
      body: form,
    });
    if (res.ok) {
      const data = (await res.json()) as { id: string };
      return { provider: "mailgun", providerId: data.id };
    }
  }

  // log provider (default / fallback)
  const id = randomBytes(8).toString("hex");
  const dir = join(process.cwd(), "data", "emails");
  mkdirSync(dir, { recursive: true });
  const filename = `${Date.now()}-${id}.html`;
  const previewPath = join(dir, filename);
  writeFileSync(
    previewPath,
    `<!-- to: ${msg.to} -->\n<!-- subject: ${msg.subject} -->\n<div style="padding:16px;font:14px/1.5 sans-serif">${msg.html}</div>`,
    "utf8"
  );
  return { provider: "log", providerId: id, previewPath };
}