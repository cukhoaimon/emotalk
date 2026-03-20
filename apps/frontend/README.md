# Frontend

Vite + React frontend with Agora RTC Web SDK.

## Setup

1. Create an environment file:
   - `cp .env.example .env`
2. Fill in at least:
   - `VITE_AGORA_APP_ID=<your agora app id>`
3. Optional:
   - `VITE_AGORA_CHANNEL` (default: `emotalk`)
   - `VITE_AGORA_TOKEN` (required if your Agora project uses token auth)
   - `VITE_AGORA_UID`

## Run

- `npm run dev -w @emotalk/frontend`
- open [http://localhost:5173](http://localhost:5173)

Use **Join** to publish local mic/camera to the channel and **Leave** to stop and disconnect.
