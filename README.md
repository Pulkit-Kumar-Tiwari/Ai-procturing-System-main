# Verity Exam Demo

## Run locally

```powershell
npm install
npm start
```

Open the `http://localhost:3000` URL printed by the server on the computer running it. The server listens on all network interfaces and also prints LAN URLs; another device on the same network can use one of those URLs to reach the app and backend. Allow Node.js through the computer's firewall on the selected network if prompted.

The Node.js/Express backend serves the frontend and persists exam catalogs, live session status, and submitted answers in `data/backend.json`. Open the same server origin on the examiner and candidate devices; do not open the HTML files directly. Browsers only allow camera access on `localhost` or a secure HTTPS origin, so a LAN URL using HTTP is enough to check backend access but not candidate camera access. For live exams on other devices, serve the app through a trusted HTTPS reverse proxy or hosting provider.

## Deploy on Vercel

Vercel routes `/api/*` requests through the shared serverless API function using `vercel.json`; it does not provide durable storage for `data/backend.json`. Create a Neon Postgres database, copy its pooled connection string, then add it to the Vercel project's environment variables as `DATABASE_URL` for every environment you deploy. Redeploy after saving the variable. The API creates its tables automatically on first use; verify the deployment by opening `/api/health` and confirming it returns `{"ok":true}`. If it reports that `DATABASE_URL` is missing, add the variable to the right Vercel environment and redeploy.

The app's frontend and API must use the same Vercel deployment origin. For live video across separate networks, configure TURN using Vercel environment variables as described below; the default STUN server is not sufficient on every network.

## Live video across devices

Live video is WebRTC peer-to-peer: the backend exchanges connection offers and answers, but does not receive, record, or store the camera stream. Candidate consent is required and sharing can be stopped at any time. The server provides a public STUN server by default. STUN alone does not work on every network; when devices are on different networks or behind restrictive firewalls, configure a TURN relay on the backend:

```powershell
$env:TURN_URL = "turn:turn.example.com:3478"
$env:TURN_USERNAME = "<turn-username>"
$env:TURN_CREDENTIAL = "<turn-credential>"
npm start
```

`TURN_URL` can contain comma-separated URLs. Use credentials from your own TURN provider; do not commit real credentials.

## API

- `GET /api/health` — server health check
- `GET /api/rtc-config` — STUN/TURN configuration for WebRTC
- `GET /api/exams` — list exams
- `POST /api/exams` — create an exam
- `GET /api/sessions` — list live sessions
- `PUT /api/sessions/:id` — update a live session
- `POST /api/submissions` — save an exam submission

Candidate camera video is still not uploaded or saved by the backend.
