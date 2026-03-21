# Audio Emotion Backend

Node.js + Express backend that accepts an uploaded audio file, transcribes it with OpenAI, and returns multiple emotion-based AI responses.

## Features

- Upload `.wav`, `.mp4`, `.m4a`, or `.webm` audio/video files with `multer`
- Validate a JSON `emotions` array with a max of 3 emotions
- Transcribe audio with the OpenAI transcription API
- Generate one chat response per emotion in parallel with `Promise.all`
- Basic rate limiting for API safety
- Save each successful result to `outputs/latest-output.json` and a timestamped JSON file
- Clean modular structure for hackathon-friendly maintenance

## Project Structure

```text
src/
  config/
  controllers/
  middleware/
  routes/
  services/
  utils/
```

## Setup

```bash
npm install
```

Create a `.env` file:

```env
OPENAI_API_KEY=your_key_here
PORT=3000
CORS_ORIGIN=http://localhost:5173
AGORA_APP_ID=your_agora_app_id
AGORA_APP_CERTIFICATE=your_agora_app_certificate
AGORA_TOKEN_EXPIRATION_SECONDS=3600
```

Run the server:

```bash
npm run dev
```

Or:

```bash
npm start
```

## API

### `GET /agora/session`

Returns an Agora RTC session payload for the frontend MVP. Query params:

- `channel`: channel name
- `role`: `broadcast` or `debug`

If `AGORA_APP_CERTIFICATE` is configured, the backend generates a fresh RTC token per request.

### `POST /analyze-audio`

Form-data fields:

- `file`: `.wav`, `.mp4`, `.m4a`, or `.webm` audio/video file
- `emotions`: JSON string such as `["joy","fear"]`

### Example response

```json
{
  "transcript": "I failed my exam, what should I do?",
  "responses": [
    {
      "emotion": "joy",
      "text": "This is just a setback! You can absolutely recover from this."
    },
    {
      "emotion": "fear",
      "text": "If you do not act quickly, this could affect your next steps, so make a plan right away."
    }
  ],
  "output": {
    "directory": "D:\\My Progress\\lotus\\backend\\outputs",
    "timestampedFilename": "analysis-2026-03-21T01-23-45-000Z.json",
    "latestFilename": "latest-output.json"
  }
}
```

## Notes

- Supported emotions: `joy`, `sadness`, `anger`, `fear`, `disgust`
- Invalid file types, missing emotions, more than 3 emotions, and OpenAI API failures return JSON errors
- Uploaded files are deleted after each request finishes
- Successful requests also write JSON output files into the `outputs/` folder
- The Agora session endpoint is intended for the hackathon MVP so multiple local tabs can join the same channel with different identities
- `.webm` uploads are supported for browser-recorded clips from the frontend

## Example curl

```bash
curl -X POST http://localhost:3000/analyze-audio \
  -F "file=@./sample.wav" \
  -F "emotions=[\"joy\",\"sadness\"]"
```
