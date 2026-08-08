# ResumeIQ — Oracle Cloud Free Backend Guide (beginner edition)

This guide puts your ResumeIQ **backend (API)** on a **free Oracle Cloud VM** so your live
Netlify site can do real resume analysis, admin login, and data storage.

- Cost: **$0** (Oracle asks for a card only to verify you; it never charges you on free tier)
- Time: about 30–45 minutes, one time
- After this guide you'll have: `https://resumeiq-api.duckdns.org` → your API

> If you get stuck at any step, save this file and tell me the step number +
> what you see on screen.

---

## What you need before starting

- Your **Netlify site URL** from Part 1 (e.g. `https://my-site-name.netlify.app`)
- Your **Groq API key** (free from https://console.groq.com — you already have one in `backend/.env`)
- An email, a phone number, and a debit/credit card (card is only for Oracle verification)
- Windows 10/11 PC

---

## Step 1 — Create your Oracle Cloud account (10 min)

1. Open **https://signup.oraclecloud.com** in your browser.
2. Fill in:
   - Country/region (closest to you, e.g. India → **India**)
   - Name, email, password (make the password long and save it somewhere)
3. Click **Continue** and verify the **email** code they send you.
4. Add a payment method (debit/credit card). Oracle will charge a tiny test amount
   (~$1) and refund it immediately. This is normal — it's only to confirm the card is real.
5. Verify your **phone number** with the text code.
6. Click **Create account**.
7. Wait for the confirmation email. It can take **2–10 minutes**. Open the email and click the
   **link inside it** to activate your account.

> If you don't get the email, check Spam. If it still doesn't arrive, wait 15 min and
> click "Resend email" on the signup page.

## Step 2 — Create an SSH key on your PC (5 min)

This is like a key that lets you unlock your new server from your PC.

1. Press the **Windows key**, type `powershell`, and press **Enter**.
2. Paste this and press Enter:
   ```
   ssh-keygen -t ed25519 -f $env:USERPROFILE\.ssh\id_ed25519 -N ""
   ```
3. Paste this and press Enter to see your public key:
   ```
   type $env:USERPROFILE\.ssh\id_ed25519.pub
   ```
4. Copy the **whole output line** that starts with `ssh-ed25519 AAAA...`. You'll paste it in Step 3.

## Step 3 — Log in to Oracle Cloud and create the free server (10 min)

1. Go to **https://cloud.oracle.com** and sign in.
2. You'll see a screen asking you to pick a **Compartment** and **Home region**.
   - Compartment: leave the default (root).
   - Home region: pick the one closest to you (e.g. **Mumbai**). **You can't change this later.**
3. Click the **hamburger menu (☰)** top-left → **Compute** → **Instances**.
4. Click **Create instance**.
5. Fill in:
   - **Name**: `resumeiq-api`
   - **Placement**: leave defaults (don't enable "Always Free eligible" unless it's on by default)
6. In **Image and shape** → click **Edit**:
   - **Image**: make sure it says **Ubuntu 24.04** (or 24.04+. If not, click Change image → select Ubuntu 24.04)
   - **Shape**: click **Change shape** → choose **Ampere** → **VM.Standard.A1.Flex** → set
     **OCPUs: 2**, **Memory (GB): 12** (both show as free). Click **Select shape**.
7. In **Networking**: leave defaults (it creates a VCN automatically).
8. In **Add SSH keys**: select **Paste public keys** → paste the `ssh-ed25519 AAAA...`
   line you copied in Step 2.
9. Leave Boot volume default (it says "Boot volume 200 GB" — that's free).
10. Click **Create**.
11. Wait ~2 minutes. The instance status will change from *Provisioning* → **Running**.

## Step 4 — Give the server a fixed address + open the ports (5 min)

1. **☰ Menu → Networking → Reserved public IPs** → click **Reserve public IP address**.
   - Name: `resumeiq-ip` → click **Reserve**.
2. On the new IP page → **Assigned instance** → click **Assign** → select `resumeiq-api` → **Assign**.
   - Note the **IP address** shown (e.g. `146.56.44.12`). You'll need it in Step 6.
3. **☰ Menu → Networking → Virtual cloud networks** → click your VCN (named something like
   `resumeiq-api-vcn`) → click **Security Lists** → click the **default** security list.
4. Click **Add Ingress Rules**. Add **two** rules. For each: Source Type = CIDR, Source CIDR = `0.0.0.0/0`, then:
   - Rule 1: **IP Protocol TCP**, Source Port Range `(leave blank)`, **Destination Port Range: 80**
   - Rule 2: **IP Protocol TCP**, Source Port Range `(leave blank)`, **Destination Port Range: 443**
   - (port 22 for SSH is usually already open; if it's not, add it too: TCP, port `22`)

## Step 5 — Get a free web address for the API (DuckDNS, 5 min)

1. Open **https://www.duckdns.org** and sign in with Google or GitHub.
2. In **Sub Domains**, type `resumeiq-api`, click **Add domain**.
3. You now have `resumeiq-api.duckdns.org`.
4. On that page you'll see your **token** (a long string under "Token for account"). Copy it —
   you'll need it in Step 7. **Keep this page open.**

## Step 6 — Install the backend on the server (10 min)

1. On your PC, open **PowerShell** again.
2. Connect to your server (replace `146.56.44.12` with **your** IP from Step 4):
   ```
   ssh -i $env:USERPROFILE\.ssh\id_ed25519 ubuntu@146.56.44.12
   ```
   - The first time it asks **"Are you sure you want to continue connecting?"** → type `yes`, press Enter.
3. You're now on the server (the prompt changes to something like `ubuntu@resumeiq-api:~$`).
   Run these **three** commands one at a time (paste, press Enter, wait for each to finish):
   ```
   cd /tmp
   git clone https://github.com/sandydixit8-ux/Resume.git
   cd Resume
   ```
4. Point the installer at your DuckDNS address (replace `resumeiq-api` with yours if you picked a different name):
   ```
   sed -i "s/yourdomain\.com/resumeiq-api.duckdns.org/g" ResumeIQ/deploy/setup-backend-only.sh
   ```
5. Run the installer (this takes a few minutes — it installs Python, the app, HTTPS, and auto-start):
   ```
   sudo bash ResumeIQ/deploy/setup-backend-only.sh
   ```
6. When it finishes you'll see "Backend install complete!".

> Note: the install path in the guide uses the new repo layout (`ResumeIQ/...`). Your new repo
> `sandydixit8-ux/Resume` already has this structure.

## Step 7 — Set your passwords and AI key (5 min)

1. On the server, open the settings file:
   ```
   sudo nano /var/www/resumeiq/backend/.env
   ```
2. Use the arrow keys to move the cursor. Change these lines:
   - `SECRET_KEY=` → make up a long random string, e.g. `k9Xf2qRv7mBw4tLz8pQn3YjH5sD1cA6` (any long text)
   - `ADMIN_USERNAME=admin` → leave as-is, or change to your login name
   - `ADMIN_PASSWORD=CHANGE_ME...` → set your admin password (this is the password for `/admin/login`)
   - `GROQ_API_KEY=` → paste your Groq key (from `backend/.env` on your PC)
   - `CORS_ORIGINS=https://yourdomain.com,...` → replace with **your** Netlify URL, e.g.:
     ```
     CORS_ORIGINS=https://my-site-name.netlify.app
     ```
3. Save and exit: press **Ctrl+X**, then **Y**, then **Enter**.
4. Restart the backend:
   ```
   sudo systemctl restart resumeiq-backend
   ```
5. Test it. In **your PC's browser**, open:
   ```
   https://resumeiq-api.duckdns.org/api/v1/health
   ```
   You should see something like `{"status":"ok", ...}`.

## Step 8 — Keep the address updated (automatic, 5 min)

DuckDNS addresses are free and need a refresh every 5 minutes so they always point at your server.

1. Still on the server, run (replace `YOUR_TOKEN` with the token you copied in Step 5):
   ```
   curl "https://www.duckdns.org/update?domains=resumeiq-api&token=YOUR_TOKEN&ip="
   ```
   It should print `OK`.
2. Add that to an automatic timer:
   ```
   sudo crontab -e
   ```
   - It may ask which editor: type `1` for **nano** and press Enter.
   - Use the arrow keys to go to the bottom, and paste this line (replace the token):
     ```
     */5 * * * * curl -s "https://www.duckdns.org/update?domains=resumeiq-api&token=YOUR_TOKEN&ip=" >/dev/null 2>&1
     ```
   - Save and exit: **Ctrl+X**, then **Y**, then **Enter**.

## Step 9 — Connect your Netlify site to the backend (2 min)

1. Open **https://app.netlify.com** → your ResumeIQ site → **Site configuration** → **Environment variables**.
2. Click **Add a variable**:
   - **Key**: `BACKEND_INTERNAL_URL`
   - **Value**: `https://resumeiq-api.duckdns.org`
3. Click **Save**.
4. Go to **Deploys** → click **Deploy site** (or **Trigger deploy**) to rebuild with the new setting.
5. Wait for the build to finish.

## Step 10 — Test everything on your live site

Open your live URL (e.g. `https://my-site-name.netlify.app`):

1. **Admin login** → `https://my-site-name.netlify.app/admin/login`
   - Username: `admin` (or whatever you set in Step 7)
   - Password: what you set in Step 7
   - You should land on the **dashboard** showing visitor stats.
2. **Analyze a resume** → `/analyze` → paste a resume → **Analyze** → you should get an ATS score.
3. **Interview questions** → `/interview` → upload/paste a resume → generate questions.

---

## Common problems

| Symptom | Fix |
|---|---|
| `https://resumeiq-api.duckdns.org/api/v1/health` won't load | Ports 80/443 not opened (redo Step 4), or DuckDNS cron not set (Step 8), or the server is still installing (wait) |
| Admin login says "Invalid credentials" | Wrong `ADMIN_PASSWORD` (Step 7) or the .env edit didn't save (redo Step 7.3) |
| Site loads but "no AI / demo answer" | `GROQ_API_KEY` missing/wrong in server .env (redo Step 7) |
| Site can't reach API (errors on every page) | `BACKEND_INTERNAL_URL` not set on Netlify (redo Step 9) |
| Backend stopped working | `ssh ... ` then `sudo systemctl restart resumeiq-backend` |
| Update backend code later | on the server: `cd /tmp/Resume && git pull && sudo bash ResumeIQ/deploy/setup-backend-only.sh` |

## Useful commands

- See backend logs: on the server → `journalctl -u resumeiq-backend -f` (Ctrl+C to stop)
- Check the app is running: on the server → `sudo systemctl status resumeiq-backend`
- Disconnect from the server: type `exit` and press Enter

## Cost reminder

Everything here is on the **free tier** ($0). Oracle never charges you as long as you don't
upgrade. Netlify's free plan covers the frontend. DuckDNS, Caddy, and Let's Encrypt are free too.
