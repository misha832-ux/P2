# P2 — AI-Assisted Writing Research Tool

🔗 **Live Demo:** https://p2-diin.onrender.com

---

## Overview

P2 is a research data-collection web application designed to study how people write with and without AI assistance. Participants complete a guided, four-step flow: they enter their demographic information, write a short reflection using AI help, then write another reflection entirely by hand (no copy/paste allowed). All responses are stored for later analysis.

The project is intended for academic or UX research comparing AI-assisted writing versus unassisted writing on environmental sustainability topics.

---

## Application Flow

The app walks participants through four steps, shown via a progress bar:

1. **Your Info** — Collects user ID, name (optional), age, gender, and profession.
2. **AI Writing** — Participant writes a reflection on energy habits *with* AI assistance. A 10-minute countdown timer auto-submits when it expires. The participant also logs the AI prompt they used.
3. **Manual Writing** — Participant writes a reflection on individual vs. global impact *without* AI. Copy/paste is fully disabled. 10-minute timer auto-submits.
4. **Done** — Thank you screen confirming submission.

---

## Running Locally

### Prerequisites
- Node.js 18+
- A MongoDB connection string (e.g. MongoDB Atlas free tier)

### Backend

```bash
cd backend
npm install
# Create a .env file with:
# DATABASE_URL=mongodb+srv://<user>:<password>@<cluster>/p2
npm run prisma:generate
npm run prisma:db:push
npm run dev
```

### Frontend

```bash
cd frontend
npm install
# Create a .env file with:
# VITE_API_URL=http://localhost:3000
npm run dev
```

---

## Key Implementation Details

- **Rate limiting:** max 30 requests per IP per minute on all `/api/` routes.
- **Request timeout:** server responds with `503` if a handler takes longer than 9 seconds; frontend aborts at 10 seconds.
- **Paste prevention:** the manual writing step blocks `paste`, `copy`, `cut`, context menus, and Ctrl+V at multiple levels (`onPaste`, `beforeinput` event, `onKeyDown`).
- **Auto-submit:** both timed writing pages auto-submit when the 10-minute timer runs out, using a ref guard to prevent double-submission.
- **Keep-alive pings:** the frontend pings `/api/ping` every 5 minutes to prevent Render's free-tier cold starts during a session.

---

## Environment Variables

| Variable | Location | Description |
|----------|----------|-------------|
| `DATABASE_URL` | `backend/.env` | MongoDB connection string |
| `VITE_API_URL` | `frontend/.env` | Base URL of the backend API |

---

## Keeping the Server Alive

The backend is hosted on Render's free tier, which spins down after inactivity,
delaying the first request by 50 seconds or more (cold start).

To prevent this, an external UptimeRobot monitor pings `/api/ping` every 5 minutes,
keeping the server warm at all times — regardless of whether anyone is using the app.

If you redeploy or set up your own instance:
1. Sign up for free at [uptimerobot.com](https://uptimerobot.com)
2. Create a new **HTTP(S)** monitor
3. Set the URL to `https://<your-backend>.onrender.com/api/ping`
4. Set the interval to **5 minutes**

The frontend also pings `/api/ping` every 5 minutes while the app is open in a browser,
but this alone is not enough since no pings go out when no one is using the app.
