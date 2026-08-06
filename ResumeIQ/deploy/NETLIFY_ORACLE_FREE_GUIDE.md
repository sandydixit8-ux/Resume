# ResumeIQ AI — Free Forever: Netlify (frontend) + Oracle Cloud (backend)

Your setup:
- **Frontend (website)** → Netlify (free forever, fast CDN)
- **Backend (FastAPI API)** → Oracle Cloud Always Free VM (free forever, always on, no sleeping)
- **HTTPS** → Caddy auto-certs (backend) + Netlify (frontend)

> Total cost: **$0**. You only need an email, a mobile number, and a card for
> Oracle's free-tier verification (never charged).

---

## Part 1 — Backend on Oracle Cloud (do this first)

### 1.1 Create the Oracle account
1. Go to https://signup.oraclecloud.com
2. Region: nearest to you (e.g. Mumbai `ap-mumbai-1` if available).
3. Verify email, set password, add card (free tier — not charged).
4. Wait for the confirmation email.

### 1.2 Create a free VM
1. Log in at cloud.oracle.com → Menu → **Compute** → **Instances** → **Create instance**
2. Name: `resumeiq-api`
3. **Image and shape** → Edit → Image: **Ubuntu 24.04**
4. Shape: **Ampere** (ARM) → **VM.Standard.A1.Flex** → OCPUs: **2**, Memory: **12 GB** (both free)
5. **Add SSH keys**: paste your public key
   - On Windows: `type $env:USERPROFILE\.ssh\id_ed25519.pub`
   - No key yet? Run `ssh-keygen -t ed25519` first, then open the `.pub` file.
6. **Create**, wait ~2 min until *Running*.

### 1.3 Stable IP + open ports
1. **Networking** → **Reserved public IPs** → *Reserve* → attach to the instance.
2. **VCNs** → your VCN → **Security Lists** → default → **Add Ingress Rules** for both:
   - TCP **80** from `0.0.0.0/0`
   - TCP **443** from `0.0.0.0/0`
   - (22 should already be open)

### 1.4 Free subdomain (DuckDNS) for the API
1. https://www.duckdns.org → sign in → add subdomain `resumeiq-api`
   → you now have `resumeiq-api.duckdns.org`.
2. Note your DuckDNS **token**.

### 1.5 SSH in and install the backend
```powershell
ssh -i $env:USERPROFILE\.ssh\id_ed25519 ubuntu@<PUBLIC_IP>
```
On the server:
```bash
cd /tmp
git clone https://github.com/dixitsandeep339-netizen/Resume-IQ.git
cd Resume-IQ
sed -i "s/yourdomain\.com/resumeiq-api.duckdns.org/g" deploy/setup-backend-only.sh
sudo bash deploy/setup-backend-only.sh
```
This installs the Python backend + Caddy (HTTPS) + systemd.

### 1.6 Configure secrets
```bash
sudo nano /var/www/resumeiq/backend/.env
#  - SECRET_KEY        -> random long string
#  - ADMIN_PASSWORD    -> your admin login
#  - GROQ_API_KEY      -> free key from https://console.groq.com (or ANTHROPIC_API_KEY)
#  - CORS_ORIGINS      -> https://<your-site>.netlify.app   (fill in Part 2's URL)
#  - DATABASE_URL      -> sqlite:////var/www/resumeiq/data/dpiic.db   (already set)
#  - UPLOAD_DIR        -> /var/www/resumeiq/data/uploads              (already set)
sudo systemctl restart resumeiq-backend
```

### 1.7 Keep DuckDNS pointed at your server
```bash
curl "https://www.duckdns.org/update?domains=resumeiq-api&token=YOUR_TOKEN&ip="
sudo crontab -e
# add this line (every 5 minutes):
*/5 * * * * curl -s "https://www.duckdns.org/update?domains=resumeiq-api&token=YOUR_TOKEN&ip=" >/dev/null 2>&1
```

✅ Backend ready. Test: open `https://resumeiq-api.duckdns.org/api/v1/health` → should show `{"status":"ok",...}`.

---

## Part 2 — Frontend on Netlify

1. https://app.netlify.com → sign up → **Add new site** → **Import from Git** → connect GitHub.
2. Select the `Resume-IQ` repo. Netlify reads `netlify.toml` (already in the repo) — it builds Next.js automatically.
3. Wait for the build. Your site URL: `https://<something>.netlify.app`.
4. **Site settings → Environment variables** → Add:
   - `BACKEND_INTERNAL_URL` = `https://resumeiq-api.duckdns.org`
5. Trigger a **redeploy** (Deploys → *Deploy site* button).

## Part 3 — Wire the two together (final step)

1. On Oracle, update the backend CORS list with your exact Netlify URL:
   ```bash
   sudo nano /var/www/resumeiq/backend/.env
   # CORS_ORIGINS=https://<your-site>.netlify.app
   sudo systemctl restart resumeiq-backend
   ```
2. Test on `https://<your-site>.netlify.app`:
   - `/contact` → submit a message (goes to Oracle DB, shows in admin inbox)
   - `/pricing` → currency toggle + checkout
   - `/admin/login` → your `ADMIN_PASSWORD`

---

## Maintenance
- Backend logs: `ssh ... ; journalctl -u resumeiq-backend -f`
- Restart backend: `sudo systemctl restart resumeiq-backend`
- Update backend code: on the VM, `cd /tmp/Resume-IQ && git pull && sudo bash deploy/setup-backend-only.sh`
- Update frontend: push to GitHub → Netlify auto-redeploys.

## Cost checklist (should be $0)
- [ ] Oracle free VM (2 OCPU + 12 GB ARM) — free
- [ ] Oracle reserved IP + ports — free
- [ ] DuckDNS subdomain — free
- [ ] Caddy / Let's Encrypt HTTPS — free
- [ ] Netlify free plan — free (100 GB bandwidth / month)
