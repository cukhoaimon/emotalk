# Audio Emotion Backend

Node.js + Express backend that accepts uploaded audio, transcribes it, and returns a conversational AI reply in a selected emotion.

## Features

- Upload `.wav`, `.mp4`, `.m4a`, or `.webm` audio files with `multer`
- Validate a single `emotion` value for each conversation turn
- Transcribe audio with the OpenAI transcription API
- Generate one conversational reply in the selected emotion
- Basic rate limiting for API safety
- Save each successful result to `outputs/latest-output.json` and a timestamped JSON file
- Clean modular structure for hackathon-friendly maintenance
- Reuse the same conversation engine for both voice and text chat
- Expose a live-audio endpoint for short non-persisted call chunks

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

- `file`: `.wav`, `.mp4`, `.m4a`, or `.webm` audio file
- `emotion`: a single emotion such as `joy`
- `sessionId` (optional): continue an existing conversation session

### `POST /analyze-audio/live`

Form-data fields:

- `file`: short live audio chunk, typically `.webm`
- `emotion`: a single emotion such as `joy`
- `sessionId` (optional): continue an existing conversation session

This endpoint skips output persistence so it can be used for live call loops.

### Example response

```json
{
  "sessionId": "d6435802-d526-431c-b4f5-2fe4c90b4a96",
  "transcript": "I failed my exam, what should I do?",
  "emotion": "joy",
  "reply": "This hurts right now, but it does not define you. Take a breath, look at what went wrong, and turn this into a recovery plan for the next exam.",
  "toolEvents": [],
  "output": {
    "directory": "D:\\My Progress\\lotus\\backend\\outputs",
    "timestampedFilename": "analysis-2026-03-21T01-23-45-000Z.json",
    "latestFilename": "latest-output.json"
  }
}
```

### `POST /chat`

JSON body:

- `message`: user text input
- `emotion`: a single emotion such as `fear`
- `sessionId` (optional): continue an existing conversation session

## Notes

- Supported emotions: `joy`, `sadness`, `anger`, `fear`, `disgust`
- Invalid file types, missing emotion, unsupported emotions, and OpenAI API failures return JSON errors
- Uploaded files are deleted after each request finishes
- Successful requests also write JSON output files into the `outputs/` folder
- The Agora session endpoint is intended for the hackathon MVP so multiple local tabs can join the same channel with different identities
- `.webm` uploads are supported for browser-recorded clips from the frontend

## Example curl

```bash
curl -X POST http://localhost:3000/analyze-audio \
  -F "file=@./sample.wav" \
  -F "emotion=joy"
```
