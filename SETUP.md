# SecurePortal — Microsoft Sign-In Application

Production-ready authentication portal with Microsoft Entra ID (OAuth), email/password fallback, session management, and a post-login dashboard.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Auth:** Better Auth (email/password + Microsoft OAuth)
- **Database:** PostgreSQL (via Prisma ORM)
- **Styling:** Tailwind CSS 4 + shadcn/ui
- **Hosting:** Vercel (recommended)

---

## Project Structure

```
src/
├── app/
│   ├── api/auth/[...all]/route.ts   ← Better Auth API handler
│   ├── layout.tsx                   ← Root layout
│   ├── page.tsx                     ← Sign-in / Dashboard page
│   └── globals.css
├── lib/
│   ├── auth.ts                      ← Server-side auth config
│   ├── auth-client.ts               ← Client-side auth client
│   └── db.ts                        ← Prisma database client
└── components/ui/                   ← shadcn/ui components
prisma/
└── schema.prisma                    ← Database schema
.env                                 ← Environment variables (not committed)
.env.example                         ← Template for env vars
```

---

## Local Development

```bash
# 1. Install dependencies
npm install

# 2. Copy env template and fill in your values
cp .env.example .env

# 3. Push database schema
npx prisma db push

# 4. Start dev server
npm run dev
```

Open http://localhost:3000

---

## Deployment Guide (Vercel)

### Step 1 — Azure Entra ID (Microsoft OAuth)

1. Go to [Azure Portal → Entra ID → App registrations](https://portal.azure.com/#blade/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/RegisteredApps)
2. Click **New registration**
3. Name: `SecurePortal`
4. Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**
5. Redirect URI: **Web** → `https://your-app.vercel.app/api/auth/callback/microsoft`
6. Click **Register**
7. Copy **Application (client) ID** → `MICROSOFT_CLIENT_ID`
8. Go to **Certificates & secrets** → **New client secret**
9. Copy the **Value** → `MICROSOFT_CLIENT_SECRET`
10. Go to **Manifest** → set `"signInAudience": "AzureADandPersonalMicrosoftAccount"` → **Save**

### Step 2 — Vercel Project

1. Push your code to GitHub
2. Go to [Vercel](https://vercel.com) → **Import** your GitHub repo
3. Framework preset: **Next.js** (auto-detected)
4. Click **Deploy**

### Step 3 — Vercel Postgres (Storage)

1. In your Vercel project → **Storage** tab
2. Click **Create Database → Postgres (Neon)**
3. Select your region → **Create**
4. Click **Connect to Project** → select your app
5. Vercel auto-adds `POSTGRES_PRISMA_URL` and other Neon vars

### Step 4 — Environment Variables

Go to Vercel → **Settings → Environment Variables** and add:

| Variable | Value |
|---|---|
| `BETTER_AUTH_SECRET` | Generate with `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | `https://your-app.vercel.app` |
| `MICROSOFT_CLIENT_ID` | From Step 1 |
| `MICROSOFT_CLIENT_SECRET` | From Step 1 |
| `MICROSOFT_TENANT_ID` | `common` |

The `POSTGRES_PRISMA_URL` is auto-set by Vercel Postgres (Step 3).

### Step 5 — Final Deploy

Go to **Deployments** → latest deploy → **Redeploy**

Visit your live URL → Click **Continue with Microsoft** → Done.

---

## Troubleshooting

| Issue | Fix |
|---|---|
| CORS error | Ensure `NEXT_PUBLIC_APP_URL` is NOT set. Auth client uses relative URLs. |
| `AADSTS50194` error | Set `signInAudience` to `AzureADandPersonalMicrosoftAccount` in Azure Manifest. |
| `invalid_request` after OAuth | Ensure redirect URI in Azure matches `/api/auth/callback/microsoft` exactly. |
| Build fails on `useSearchParams` | The page is wrapped in `<Suspense>` — ensure `src/app/page.tsx` has the wrapper. |
| Database resets on deploy | You're using SQLite — switch to Vercel Postgres (see Step 3 above). |

---

## Viewing Data

```bash
npx prisma studio
```

Opens http://localhost:5555 with a visual database browser.
