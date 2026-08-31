# FanPulse web

Vite + React UI for the FanPulse Nest API. Run the API on port **3001** first.

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

App: `http://localhost:5173`. API calls go through `/api` → `http://localhost:3001`.

Backend SIWE must match the page origin (`SIWE_DOMAIN=localhost:5173`, `SIWE_URI=http://localhost:5173`).
