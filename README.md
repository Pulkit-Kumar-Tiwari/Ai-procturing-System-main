# Verity Exam Demo

## Run locally

```powershell
npm install
npm start
```

Open `http://localhost:3000`.

The Node.js/Express backend serves the frontend and persists exam catalogs, live session status, and submitted answers in `data/backend.json`. For multiple devices, make the server reachable to both devices and open the same server URL on each. The example server uses HTTP; use a trusted HTTPS reverse proxy for deployed use (camera access on other devices requires a secure context).

## Live video across devices

Live video is WebRTC peer-to-peer: the backend exchanges connection offers and answers, but does not receive, record, or store the camera stream. Candidate consent is required and sharing can be stopped at any time. The server provides a public STUN server by default. Some network and firewall combinations require a TURN relay for connectivity; configure a TURN service using environment variables:

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
