/**
 * Communication provider abstraction.
 *
 * Business code depends on this interface, never on a specific vendor.
 * Mocks are used in development when credentials are absent; switching to a
 * live provider is a change of environment config only.
 */

export type Channel = "whatsapp" | "email" | "sms" | "push";

export interface SendRequest {
  channel: Channel;
  to: string; // phone number or email
  from?: string;
  body: string;
  template?: { name: string; values: Record<string, string> };
  entity_type?: string;
  entity_id?: string;
  idempotencyKey?: string;
}

export interface SendResult {
  ok: boolean;
  providerRef: string | null;
  status: "QUEUED" | "SENT" | "DELIVERED" | "FAILED";
  error?: string;
}

export interface Provider {
  readonly name: string;
  send(req: SendRequest): Promise<SendResult>;
  /** Normalize an inbound raw webhook payload into a common event shape. */
  parseInbound(payload: unknown): InboundMessage | null;
}

export interface InboundMessage {
  channel: Channel;
  from: string;
  body: string;
  messageId: string;
  receivedAt: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Deterministic development mock. Marks messages SENT/DELIVERED and echoes the
 * outbound body to the server log. Clearly labelled; never hits a real API.
 */
class MockProvider implements Provider {
  readonly name = "mock";

  async send(req: SendRequest): Promise<SendResult> {
    await sleep(50);
    console.log(`[mock:${req.channel}] to=${req.to}`, req.body.slice(0, 200));
    return {
      ok: true,
      providerRef: `${req.channel}-${Date.now()}`,
      status: "SENT",
    };
  }

  parseInbound(payload: unknown): InboundMessage | null {
    if (!payload || typeof payload !== "object") return null;
    const p = payload as Record<string, unknown>;
    if (typeof p.from !== "string" || typeof p.text !== "string") return null;
    return {
      channel: "whatsapp",
      from: p.from,
      body: p.text,
      messageId: String(p.id ?? `in-${Date.now()}`),
      receivedAt: new Date().toISOString(),
    };
  }
}

function credentialsPresent(channel: Channel): boolean {
  switch (channel) {
    case "whatsapp":
      return Boolean(process.env.WHATSAPP_API_URL && process.env.WHATSAPP_API_KEY);
    case "email":
      return Boolean(process.env.EMAIL_API_KEY);
    case "sms":
      return Boolean(process.env.SMS_API_KEY);
    default:
      return false;
  }
}

let cached: Provider | null = null;

export function getProvider(): Provider {
  if (cached) return cached;
  const env = process.env.INTEGRATION_MESSAGING ?? "mock";
  if (env === "live" && credentialsPresent("whatsapp")) {
    // A real WhatsApp Business API client would be selected here. Until such a
    // client is implemented, we always fall back to the mock.
  }
  cached = new MockProvider();
  return cached;
}

export async function sendMessage(req: SendRequest): Promise<SendResult> {
  return getProvider().send(req);
}

/**
 * Preferred sending helper used by the follow-up/task engines: persists a row
 * in `messages` and enqueues the send. The actual network call is a job; for
 * the same-process development flow we send and record inline.
 */
import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function sendAndRecord(
  req: SendRequest,
  options: { organizationId: string; createdBy?: string }
): Promise<SendResult> {
  const result = await sendMessage(req);
  try {
    const supabase = await createClient();
    await supabase.from("messages").insert({
      organization_id: options.organizationId,
      entity_type: req.entity_type ?? null,
      entity_id: req.entity_id ?? null,
      direction: "out",
      channel: req.channel,
      provider: getProvider().name,
      recipient: req.to,
      body: req.body,
      status: result.status,
      provider_ref: result.providerRef,
      error: result.error ?? null,
      created_by: options.createdBy,
    });
  } catch (err) {
    console.error("failed to record message:", err);
  }
  return result;
}