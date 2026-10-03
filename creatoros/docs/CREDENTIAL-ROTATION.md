# Credential Rotation Runbook — CreatorOS

**Why:** three live/provider credentials were exposed in a plaintext chat transcript
during this engagement. Treat them as compromised. **Do not deploy to production until
every item below is done.** This document intentionally contains no secret values.

## 1. What is exposed and what to do

| Credential | Where it lives | Action |
| --- | --- | --- |
| Brevo API key (`xkeysib-...`) | `BREVO_API_KEY` — powers transactional email | **Regenerate** (this is the active provider) |
| Brevo SMTP key (`xsmtpsib-...`) | Not used by the app (app uses the HTTP API) | **Revoke / delete** |
| Cashfree LIVE secret key | `CASHFREE_SECRET_KEY` — payment + webhook signature | **Regenerate** in Cashfree dashboard |

`AUTH_SECRET` was verified present (64 chars) and was **not** exposed — no action needed.
`CASHFREE_CLIENT_ID` is a public client identifier, but rotate it together with the secret
if your Cashfree plan supports it.

## 2. Brevo — rotate API key, revoke SMTP key

1. Log in to Brevo → avatar (top-right) → **SMTP & API**.
2. **API Keys** tab: revoke the exposed key, then **Create a new API key** with the
   same transactional-email scope. Copy it.
3. **SMTP** tab: delete the exposed `xsmtpsib-...` SMTP key (the app never uses SMTP).
4. Update `BREVO_API_KEY` in:
   - local `creatoros/.env`
   - production `/home/ubuntu/app/.env`
5. Redeploy / restart the app so the new env is loaded.
6. Verify: trigger a password-reset email and confirm delivery; check app logs for the
   email provider resolving to `brevo`.

## 3. Cashfree — rotate LIVE secret key

1. Cashfree Merchant Dashboard → **Developers → API Keys / Credentials**.
2. Select the **LIVE** environment and **regenerate the Secret Key**. Keep the existing
   Client ID unless you also choose to rotate it.
3. Update `CASHFREE_SECRET_KEY` (and `CASHFREE_CLIENT_ID` if rotated) in local `.env`
   and production `/home/ubuntu/app/.env`.
4. Redeploy / restart.
5. Verify: create a small one-time test order and confirm it becomes `ACTIVE`; trigger a
   test webhook and confirm the signature validates (no `401` in logs).

## 4. Post-rotation verification checklist

- [ ] Grep local + production `.env` — no old key strings remain.
- [ ] Password-reset email sends via Brevo.
- [ ] Store checkout creates an order and a receipt renders.
- [ ] Cashfree webhook signature verifies (no signature failures in logs).
- [ ] Admin account password changed (it was also visible in the transcript).
- [ ] Confirm Cashfree dashboard **PG webhook signing secret** equals `CASHFREE_SECRET_KEY`
      (the mapping was not confirmed from the dashboard).

## 5. Handling rules

- Never paste secrets into chat, tickets, screenshots, or docs.
- Set production env vars directly on the server, not through an AI session.
- Rotate **any** other credential seen in the same transcript window, even if you believe
  it is unused.
- After rotating, keep the old key disabled for at least one deploy cycle to confirm
  nothing else depends on it, then delete it.
