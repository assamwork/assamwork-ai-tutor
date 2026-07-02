# AssamWork AI Deployment

Production target:

- `www.assamwork.com` → Shopify
- `ai.assamwork.com` → Vercel React frontend
- Backend → Render URL now; `https://api.assamwork.com` later

## 1. Create GitHub repository

1. Create a private or public GitHub repository.
2. Push this repository to GitHub.
3. Confirm `.env`, virtual environments, `db/`, `node_modules/`, and build output are not committed.

## 2. Deploy backend on Render

1. Open Render.
2. Create a new Web Service from the GitHub repository.
3. Use the repository root as the service root.
4. Render can use `render.yaml`, or configure manually:

Build Command:

```bash
pip install -r requirements.txt
```

Start Command:

```bash
uvicorn app:app --host 0.0.0.0 --port $PORT
```

## 3. Required backend environment variables

Set these in Render:

```bash
GEMINI_API_KEY=your_gemini_api_key
ADMIN_EMAILS=admin@example.com
FIREBASE_PROJECT_ID=your_firebase_project_id
HF_TOKEN=optional_huggingface_token
APP_ENV=production
```

Do not commit real values.

## 4. Deploy frontend on Vercel

1. Open Vercel.
2. Import the same GitHub repository.
3. Configure:

Root Directory:

```bash
frontend-v2
```

Build Command:

```bash
npm run build
```

Output Directory:

```bash
dist
```

Install Command:

```bash
npm install
```

## 5. Required frontend environment variables

Set these in Vercel:

```bash
VITE_API_URL=https://your-render-service.onrender.com
VITE_ADMIN_EMAILS=admin@example.com
VITE_FIREBASE_API_KEY=your_firebase_web_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_firebase_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_firebase_app_id
```

## 6. Connect `ai.assamwork.com` to Vercel

1. Add `ai.assamwork.com` as a Vercel domain.
2. In DNS, add the Vercel-provided CNAME or A record.
3. Keep `www.assamwork.com` pointed to Shopify.
4. Wait for Vercel SSL certificate provisioning.

## 7. Point frontend to backend URL

1. Copy the Render service URL.
2. Set `VITE_API_URL` in Vercel to that Render URL.
3. Redeploy the Vercel project after changing environment variables.
4. Later, when `https://api.assamwork.com` is ready, update `VITE_API_URL` and redeploy.

## 8. Smoke test checklist

Backend:

- Open `/`
- Open `/docs`
- Confirm `/ask` responds
- Confirm admin `/library` rejects missing token
- Confirm admin user can load `/library`
- Confirm upload works
- Confirm re-index works

Frontend:

- Open `ai.assamwork.com`
- Login with Firebase
- Open `/chat`
- Ask a question
- Confirm answer renders
- Confirm sources render
- Open `/study`
- Open `/profile`
- Open `/settings`
- Open `/admin/library` as admin
- Confirm upload, delete, re-index, search, and refresh
- Confirm non-admin cannot access admin page
- Confirm mobile layout
