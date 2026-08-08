# Deploy ResumeIQ on Oracle Cloud Always Free (permanent, $0)

This runs your app on a free Oracle Cloud VM **forever** — no sleeping, no hour caps, always on.
The only recurring cost (if any) is a domain; this guide uses the free **DuckDNS** subdomain instead.

> Time: ~30 minutes. You need: an email address, a credit/debit card for Oracle's free-tier signup
> (they do NOT charge it), and a mobile number for verification.

---

## 1. Create the Oracle Cloud account

1. Go to https://signup.oraclecloud.com
2. Region: pick the one closest to you (e.g. Mumbai `ap-mumbai-1` if available).
3. Provide email, password, and card for verification (free tier — nothing is charged).
4. Finish signup and wait for the confirmation email (~minutes).

## 2. Create a free VM (compute instance)

1. Log in to the **Oracle Cloud Console** (cloud.oracle.com).
2. Menu -> **Compute** -> **Instances** -> **Create instance**.
3. Name: `resumeiq`
4. **Image and shape** -> Edit -> Image: **Ubuntu 24.04** (or 22.04).
5. Shape: select **Ampere** (ARM), **VM.Standard.A1.Flex**, and set:
   - OCPUs: **2**
   - Memory: **12 GB**  (both are free within the always-free allotment)
6. **Add SSH keys**: choose *Paste public keys* — paste your public key
   (on Windows: `type $env:USERPROFILE\.ssh\id_ed25519.pub`; if you have no key yet:
   `ssh-keygen -t ed25519` and open the `.pub` file).
7. **Boot volume** -> leave default (free tier includes ~200 GB total; 50 GB is plenty).
8. **Create**. Wait ~2 minutes until *Running*.

## 3. Keep the IP stable (free)

Oracle's default public IP changes on restart. To keep it forever:
- Menu -> **Networking** -> **Reserved public IPs** -> *Reserve public IP address* -> attach it to the `resumeiq` instance.

## 4. Open ports 80 and 443

1. Menu -> **Networking** -> **Virtual cloud networks** -> click your VCN.
2. Click **Security Lists** -> the `Default Security List` -> **Add Ingress Rules**:
   - Source CIDR: `0.0.0.0/0`  |  IP Protocol: TCP  |  Destination Port: **80**
   - Source CIDR: `0.0.0.0/0`  |  IP Protocol: TCP  |  Destination Port: **443**
   - (Port 22 should already be open.)
3. Save.

## 5. Get a free subdomain (DuckDNS)

1. Go to https://www.duckdns.org and sign in (Google/GitHub/Reddit login).
2. Add a subdomain, e.g. `resumeiq` -> you now own `resumeiq.duckdns.org`.
3. Note your **token** (shown on the page) — you'll set up auto-renewal later.

## 6. SSH into the server and install

From your Windows machine:

```powershell
ssh -i $env:USERPROFILE\.ssh\id_ed25519 ubuntu@<PUBLIC_IP>
```

Then on the server:

```bash
# Download the deploy tooling
cd /tmp
git clone https://github.com/sandydixit8-ux/Resume.git
cd Resume

# Point it at your free subdomain
sed -i "s/yourdomain\.com/resumeiq.duckdns.org/g" deploy/setup-vps.sh

# Run the one-shot installer (this takes several minutes)
sudo bash deploy/setup-vps.sh
```

When it finishes it prints the site URL. It also creates `backend/.env` — fill in the secrets:

```bash
sudo nano /var/www/resumeiq/backend/.env
#  - SECRET_KEY        -> random long string
#  - ADMIN_PASSWORD    -> your admin login
#  - ANTHROPIC_API_KEY -> your key (if you have one)
#  - DATABASE_URL      -> sqlite:////var/www/resumeiq/data/dpiic.db   (already set)
#  - UPLOAD_DIR        -> /var/www/resumeiq/data/uploads              (already set)
sudo systemctl restart resumeiq-backend
```

## 7. Point DuckDNS at your server

DuckDNS needs to know your VM's IP. Do it once manually and set up auto-renewal:

```bash
# Manual check: visits a URL that updates the record
curl "https://www.duckdns.org/update?domains=resumeiq&token=YOUR_TOKEN&ip="

# Auto-renew every 5 minutes (edit with your token)
sudo crontab -e
# add this line:
*/5 * * * * curl -s "https://www.duckdns.org/update?domains=resumeiq&token=YOUR_TOKEN&ip=" >/dev/null 2>&1
```

Caddy automatically gets a free HTTPS certificate for `resumeiq.duckdns.org`.

## 8. Done — test it

- Site: `https://resumeiq.duckdns.org`
- Admin: `https://resumeiq.duckdns.org/admin/login`
- Test `/contact` (submit a message) and `/pricing`.

---

## Maintenance

- Restart services: `sudo systemctl restart resumeiq-backend` / `resumeiq-frontend`
- Logs: `journalctl -u resumeiq-backend -f` and `journalctl -u resumeiq-frontend -f`
- Update code: `cd /var/www/resumeiq && sudo git pull && sudo bash /var/www/resumeiq/deploy/...`
  (simplest: re-run `sudo bash /tmp/Resume-IQ/deploy/setup-vps.sh` after pulling).

## Cost checklist (should be $0)
- [ ] Oracle free-tier VM (2 OCPU + 12 GB ARM) — free
- [ ] Reserved public IP — free
- [ ] Boot volume — free (within 200 GB free quota)
- [ ] DuckDNS subdomain — free
- [ ] HTTPS via Caddy / Let's Encrypt — free
