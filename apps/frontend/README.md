# Frontend

Vite + React frontend with Agora RTC Web SDK and backend-driven audio analysis.

## Setup

1. Create an environment file:
   - `cp .env.example .env`
2. Recommended for this MVP:
   - Set `VITE_BACKEND_URL=http://localhost:3000`
   - Set `VITE_AGORA_CHANNEL=emotalk`
3. If you are not using the backend token endpoint yet:
   - Set `VITE_AGORA_APP_ID=<your agora app id>`
4. If your backend is generating tokens:
   - Put `AGORA_APP_ID` and `AGORA_APP_CERTIFICATE` in `apps/backend/.env`

## Run

- `npm run dev -w @emotalk/frontend`
- open [http://localhost:5173](http://localhost:5173)

Use **Join & Publish** to capture local mic/camera and send it to Agora.

Use **Open Debug Tab** to open a second viewer tab that subscribes to the same channel for a remote sanity check.

Use **Start Recording** to create a temporary browser-local `.webm` clip.

Select up to 3 emotions and use **Analyze Selected Recording** to send the chosen clip to the backend `/analyze-audio` route.

The backend must be running with `OPENAI_API_KEY` configured for transcription and response generation.
