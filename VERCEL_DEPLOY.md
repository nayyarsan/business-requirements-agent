# Deploying BRD Creator (GitHub + Vercel)

## Important limitation (read first)
This app’s backend uses the GitHub Copilot SDK + the Copilot CLI (`copilot.exe`) and an authenticated Copilot session.

Vercel Serverless/Edge functions are not a good fit for running the Copilot CLI runtime.

**Recommended approach:**
- Deploy the **UI** to Vercel (static site)
- Deploy the **API server** (`brd-app/server.js`) to a persistent host (VM/container) that can run Bun + Copilot CLI

The UI can call the API cross-origin (CORS is enabled in the server).

---

## 1) Push to GitHub

From the repo root:

```powershell
git init
git add .
git commit -m "Initial BRD Creator"

# Create a new GitHub repo, then add it as origin:
git remote add origin https://github.com/<YOUR_ORG_OR_USER>/<YOUR_REPO>.git
git branch -M main
git push -u origin main
```

Notes:
- Don’t commit secrets. `.env*` is ignored by `.gitignore`.

---

## 2) Deploy the UI to Vercel (static)

In Vercel:
1. **New Project** → import your GitHub repo
2. **Root Directory**: set to `brd-app/public`
3. **Framework Preset**: Other (Static)
4. Deploy

This publishes the dashboard UI.

---

## 3) Deploy the API server somewhere persistent

You need a host that:
- can run **Bun**
- can run the bundled Copilot CLI inside `brd-app/node_modules/@github/copilot-<platform>-<arch>/`
- can authenticate Copilot CLI (`copilot auth login`)

Run on the host:

```bash
cd brd-app
bun install
bun run server.js
```

Set environment variables:
- `PORT=3000`
- `CORS_ORIGIN=https://<your-vercel-site>.vercel.app`
- `COPILOT_SEND_TIMEOUT_MS=300000`

---

## 4) Point the Vercel UI to your API

The UI supports an API base URL.

Option A (quick, per-browser):
- In DevTools console on the deployed UI:

```js
localStorage.setItem('apiBaseUrl', 'https://your-api.example.com');
location.reload();
```

Option B (recommended, commit-time):
- Edit `brd-app/public/index.html` and set:

```js
window.BRD_APP_CONFIG = { apiBaseUrl: "https://your-api.example.com" };
```

Then push to GitHub → Vercel redeploys.
