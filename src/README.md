# DomiDom 🎯

**Licensed real-money Dominican dominoes platform.**  
2v2 partner dominoes · Real-time multiplayer · DomiCoin wallet · Stake-style UI

---

## ⚠️ Legal Notice

This platform facilitates real-money wagering. You **must** hold a valid gambling license in your jurisdiction before accepting real deposits. Operating without a license is illegal. Consult a lawyer familiar with Dominican Republic gambling law (Ley No. 139-11).

---

## 🚀 Deploy to Render (Step-by-Step for Beginners)

### Step 1 — Create a GitHub repo

1. Go to [github.com](https://github.com) → sign in → click **"New"** (top-left green button)
2. Name it `domidom` → click **Create repository**
3. On the next page, click **"uploading an existing file"**
4. Drag and drop **`server.js`** and the **`public/`** folder (with `index.html` inside)
5. Click **Commit changes**

### Step 2 — Create a Render account

1. Go to [render.com](https://render.com) → sign up (free)
2. Click **New +** → **Web Service**
3. Click **Connect GitHub** → authorize → select your `domidom` repo
4. Fill in:
   - **Name**: `domidom`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Plan**: Free (sleeps after 15 min idle) or Starter ($7/mo for always-on)
5. Click **Create Web Service**

### Step 3 — Set environment variables

In Render → your service → **Environment** tab → click **Add Environment Variable**:

| Key | Value | Notes |
|-----|-------|-------|
| `ADMIN_USER` | `your_username` | Your account will have admin powers |
| `SUPABASE_URL` | `https://xxx.supabase.co` | From Supabase project settings |
| `SUPABASE_KEY` | `service_role_key` | **NOT** the anon key — use service role |
| `RESEND_API_KEY` | `re_xxx` | Optional — real email verification |
| `EMAIL_FROM` | `noreply@yourdomain.com` | Optional — sender address |
| `BANK_NAME` | `Banco Popular Dominicano` | Your bank name |
| `BANK_ACCOUNT` | `8121234567` | Your account number |

### Step 4 — Set up Supabase database

1. Go to [supabase.com](https://supabase.com) → create a project
2. Click **SQL Editor** → paste and run:
```sql
create table if not exists domidom_state (
  id text primary key,
  data jsonb
);
```
3. Get your URL and service-role key from **Settings → API**

### Step 5 — Deploy

- Render auto-deploys when you push to GitHub
- To update: edit files on GitHub → commit → Render redeploys automatically (~2 min)

### Step 6 — Create your admin account

1. Go to your Render URL → Register with the same username you set in `ADMIN_USER`
2. An **⚙️ Admin** button will appear in the top bar after login
3. Use the Admin Panel to approve deposits, process withdrawals, manage users

---

## 📦 package.json

Create this file in your GitHub repo root:

```json
{
  "name": "domidom",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": { "start": "node server.js" },
  "dependencies": {
    "express": "^4.19.2",
    "socket.io": "^4.7.5",
    "@supabase/supabase-js": "^2.43.0",
    "resend": "^3.2.0"
  },
  "engines": { "node": ">=18" }
}
```

---

## 🏦 Deposit Flow

1. Player clicks **Depositar** → sees your bank account number + a reference code
2. Player transfers real money to your bank account using that reference
3. Player clicks **Notificar Transferencia** to alert you
4. You verify the bank transfer → go to Admin Panel → **Depósitos** tab → click **✅ Aprobar**
5. DomiCoins are instantly credited to the player's wallet

## 💸 Withdrawal Flow

1. Player clicks **Retirar** → enters amount and bank details
2. Coins are immediately deducted (held)
3. You receive the request in Admin Panel → **Retiros** tab
4. You process the bank transfer manually → click **✅ Pagado**
5. Player is notified

---

## 🎮 Game Modes

| Mode | Cost | Bots | Stats |
|------|------|------|-------|
| Provinces | Buy-in required | ❌ Humans only | ✅ |
| Friend Room | Optional buy-in | ✅ Optional | ✅ |
| Practice | Free | ✅ Required | ❌ |

---

## 🔒 Security Notes

- Server-authoritative game logic — clients cannot cheat
- Passwords hashed with scrypt+salt
- Admin identity verified server-side on every operation
- Rate limiting on all financial endpoints
- This is a strong baseline. For a production gambling site, you should also add: audit logging, WAF, professional security audit, KYC verification system

---

## ⚙️ Architecture Note

The single JSON-blob persistence (all accounts in one Supabase row) works well for hundreds to a few thousand users. At sustained 1,000+ concurrent players, refactor to per-account row writes. This is the main scaling improvement target.