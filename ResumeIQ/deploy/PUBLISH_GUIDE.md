# How to Publish ResumeIQ — Step by Step (no coding needed)

This guide tells you exactly what to click to put your ResumeIQ website on the internet so anyone can use it.

> **Big picture:** your project is two parts:
> 1. **Frontend** (the website people see) → hosted free on **Netlify**
> 2. **Backend** (the AI brain + database) → hosted on a free server (Oracle Cloud)
>
> Netlify and Oracle are both free. Oracle asks for a card only to verify you're human — **it never charges you** if you stay on the free tier.

---

## What you need before starting (10 minutes)

- A **GitHub account** (your code is already there: https://github.com/dixitsandeep339-netizen/Resume-IQ)
- An **email address** you can check
- A **mobile phone** for text verification
- A **debit/credit card** (needed only for Oracle's free-tier verification, never charged)
- Your **Groq AI key** (free, from https://console.groq.com — if you don't have one, the AI features show a "demo" answer instead)

---

## Part 1 — Host the website on Netlify (15 minutes)

This puts your site online at a public address like `https://resumeiq.netlify.app`.

1. Go to **https://app.netlify.com** and click **Sign up** → choose **GitHub**.
2. Authorize Netlify to see your GitHub account.
3. Click **Add new site** → **Import an existing project**.
4. Pick GitHub, then choose the **Resume-IQ** repository.
5. Netlify will ask for build settings — **leave everything as is** (the repo already contains a `netlify.toml` file that tells Netlify exactly what to do).
6. Click **Deploy site**.
7. Wait ~3 minutes for the build. When it finishes you'll see a URL like `https://<something>.netlify.app`. **Write this URL down** — you'll need it in Part 2.

✅ Website is live now. But the AI parts won't fully work until the backend is online (Part 2).

> Optional: In **Site settings → Site details → Change site name**, set it to `resumeiq` so your URL is `https://resumeiq.netlify.app`.

---

## Part 2 — Host the backend on Oracle Cloud (free) (30 minutes)

This is the "AI brain". It must run on a server that's always on. Oracle gives you one for free forever.

### 2.1 Create the Oracle account
1. Go to **https://signup.oraclecloud.com**.
2. Fill in your details (country, name, email, password).
3. Add your card when asked (free tier — **not charged**, just verified).
4. Verify your phone with the text code.
5. Wait for the confirmation email (can take a few minutes).

### 2.2 Get an SSH key (needed to control your server from Windows)
1. Press **Win** key, type `powershell`, open it.
2. Paste this and press Enter:
   ```
   ssh-keygen -t ed25519 -f $env:USERPROFILE\.ssh\id_ed25519 -N ""
   ```
3. Type this to see your key, then copy the whole output line that starts with `ssh-ed25519`:
   ```
   type $env:USERPROFILE\.ssh\id_ed25519.pub
   ```

### 2.3 Create the free server (VM)
1. Log in at **https://cloud.oracle.com** → Menu (☰) → **Compute** → **Instances** → **Create instance**.
2. Name it: `resumeiq-api`.
3. Under **Image and shape** → **Edit** → make sure **Image** = `Ubuntu 24.04`.
4. Under **Shape**: pick **Ampere** → **VM.Standard.A1.Flex**, set **OCPUs = 2**, **Memory = 12 GB** (both free).
5. Under **Add SSH keys**: choose **Paste public keys** and paste the `ssh-ed25519...` line from step 2.2.
6. Click **Create instance**. Wait ~2 minutes until status says **Running**.

### 2.4 Give the server a fixed address + open the ports
1. Menu (☰) → **Networking** → **Reserved public IPs** → **Reserve public IP address** → name it `resumeiq-ip` → **Reserve**.
2. Open the new IP → **Assigned instance** → select your `resumeiq-api` instance → attach it.
3. Menu (☰) → **Networking** → **Virtual cloud networks** → click your VCN → **Security Lists** → click the default list → **Add Ingress Rules** → add **two** rules, each with `0.0.0.0/0`:
   - `TCP 80`
   - `TCP 443`
   - (port 22 is usually already open)

### 2.5 Get a free web address for the API (DuckDNS)
1. Go to **https://www.duckdns.org** → sign in with Google/GitHub → add a subdomain: `resumeiq-api`.
2. You now have `resumeiq-api.duckdns.org`. Note the **token** shown on that page.

### 2.6 Install the backend on the server (one command)
1. Find your server's **public IP** on the instance page (e.g. `123.45.67.89`).
2. Open PowerShell and connect:
   ```
   ssh -i $env:USERPROFILE\.ssh\id_ed25519 ubuntu@<YOUR_PUBLIC_IP>
   ```
3. Once connected, run these lines one by one (paste each, press Enter, wait):
   ```
   cd /tmp
   git clone https://github.com/dixitsandeep339-netizen/Resume-IQ.git
   cd Resume-IQ
   sed -i "s/yourdomain\.com/resumeiq-api.duckdns.org/g" deploy/setup-backend-only.sh
   sudo bash deploy/setup-backend-only.sh
   ```
4. Wait for it to finish (it installs Python, the app, HTTPS, and the auto-start service).

### 2.7 Add your secrets
1. Run:
   ```
   sudo nano /var/www/resumeiq/backend/.env
   ```
2. In the file, change these lines (use the arrow keys to move):
   - `SECRET_KEY=` → set to any long random text you make up, e.g. `xk9Fj2mQvR84LpZa7TybHw3` (longer = better)
   - `ADMIN_PASSWORD=` → set to your admin login password
   - `GROQ_API_KEY=` → paste your free Groq key
   - `CORS_ORIGINS=` → set to your Netlify URL from Part 1, e.g. `https://resumeiq.netlify.app`
3. Save and exit: press **Ctrl+X**, then **Y**, then **Enter**.
4. Restart the backend:
   ```
   sudo systemctl restart resumeiq-backend
   ```

### 2.8 Keep the address updated (one-time cron job)
1. On the server, run:
   ```
   curl "https://www.duckdns.org/update?domains=resumeiq-api&token=YOUR_TOKEN&ip="
   ```
   (replace `YOUR_TOKEN` with the token from step 2.5)
2. Run `sudo crontab -e`, choose an editor if asked (nano), then add this line at the bottom:
   ```
   */5 * * * * curl -s "https://www.duckdns.org/update?domains=resumeiq-api&token=YOUR_TOKEN&ip=" >/dev/null 2>&1
   ```
3. Save and exit (**Ctrl+X**, **Y**, **Enter**).

✅ Backend ready. Test it: open `https://resumeiq-api.duckdns.org/api/v1/health` in your browser → you should see `{"status":"ok",...}`.

---

## Part 3 — Connect the website to the backend (5 minutes)

1. Go back to **Netlify** → your site → **Site settings** → **Environment variables**.
2. Click **Add a variable**:
   - Key: `BACKEND_INTERNAL_URL`
   - Value: `https://resumeiq-api.duckdns.org`
3. Click **Save**, then go to **Deploys** → click **Deploy site** (or trigger a redeploy).
4. Wait for the build to finish.

✅ Done! Open `https://resumeiq.netlify.app` and test:
- `/upload` → paste a resume, click Analyze
- `/builder` → pick a country + template, export
- `/interview` → paste/upload a resume, generate questions
- `/admin/login` → your `ADMIN_PASSWORD`

---

## Everyday things you might need

| What | How |
|---|---|
| Restart the backend | `ssh -i $env:USERPROFILE\.ssh\id_ed25519 ubuntu@<IP>` then `sudo systemctl restart resumeiq-backend` |
| See backend logs | on the server: `journalctl -u resumeiq-backend -f` (Ctrl+C to stop) |
| Update the website | push new code to GitHub — Netlify redeploys automatically |
| Update the backend | on the server: `cd /tmp/Resume-IQ && git pull && sudo bash deploy/setup-backend-only.sh` |

---

## Problems?

- **AI says "demo" / no AI answer** → your `GROQ_API_KEY` in the server `.env` is missing or wrong. Re-do step 2.7 and restart.
- **Website can't reach the API** → check `BACKEND_INTERNAL_URL` on Netlify (Part 3) and that `https://resumeiq-api.duckdns.org/api/v1/health` opens.
- **Cost** → the only way you'd ever be charged is if you upgrade Oracle/Netlify past the free tier. Don't upgrade — free tier is enough for this.
