# EmoTalk

**Emotion-driven conversational AI platform** for real-time voice and video communication. Users select emotional personas (joy, sadness, anxiety, anger) that shape how an AI agent speaks, responds, and animates an avatar in live calls.

---

## System Architecture

### C4 Level 1 — System Context

```mermaid
C4Context
  title EmoTalk — System Context

  Person(user, "User", "Joins a live call, selects emotions, records audio or chats with an AI agent")

  System(emotalk, "EmoTalk", "Emotion-driven conversational AI platform — real-time voice calls with animated avatar responses")

  System_Ext(agora, "Agora", "Real-time audio/video transport (RTC) and messaging (RTM)")
  System_Ext(openai, "OpenAI", "Audio transcription (Whisper) and LLM response generation (GPT-4o)")
  System_Ext(elevenlabs, "ElevenLabs", "Text-to-speech with emotion-tuned voice parameters")
  System_Ext(agora_cai, "Agora Conversational AI", "Managed conversational agent hosted inside an Agora channel")

  Rel(user, emotalk, "Opens browser, joins call, selects emotion, speaks or types")
  Rel(emotalk, agora, "Publishes/subscribes audio-video streams; generates RTC/RTM tokens")
  Rel(emotalk, openai, "Sends audio blobs for transcription; sends text for LLM completion")
  Rel(emotalk, elevenlabs, "Requests emotion-tuned speech synthesis (MP3 + timing data)")
  Rel(emotalk, agora_cai, "Starts/stops/updates AI agents inside Agora channels")
```

---

### C4 Level 2 — Container Diagram

```mermaid
C4Container
  title EmoTalk — Containers

  Person(user, "User", "Browser-based participant")

  Container(frontend, "Frontend", "React 18 + Vite + TypeScript", "Renders call UI, emotion selector, avatar, and audio meter. Streams audio via Agora RTC SDK.")
  Container(backend, "Backend API", "Node.js + Express 5", "Orchestrates AI services, generates Agora tokens, manages conversation sessions.")

  ContainerDb(conv_store, "Conversation Store", "In-memory (per-process)", "Maintains multi-turn chat history keyed by sessionId.")
  ContainerDb(voice_store, "Voice Config Store", "JSON file on disk", "Persists custom ElevenLabs voice-ID mappings per emotion.")
  ContainerDb(output_files, "Output Files", "Timestamped JSON on disk", "Stores transcription + AI response pairs for each analyzed clip.")

  System_Ext(agora_rtc, "Agora RTC/RTM", "Real-time media transport")
  System_Ext(openai, "OpenAI API", "Whisper transcription + GPT-4o chat")
  System_Ext(elevenlabs, "ElevenLabs API", "Emotion-aware TTS")
  System_Ext(agora_cai, "Agora CAI", "Hosted conversational agent")

  Rel(user, frontend, "HTTPS", "WebSocket / HTTP")
  Rel(frontend, backend, "REST API", "HTTP/JSON + multipart audio upload")
  Rel(frontend, agora_rtc, "Agora SDK", "Audio/video streams")

  Rel(backend, openai, "HTTPS", "Audio blob → transcript; prompt → completion")
  Rel(backend, elevenlabs, "HTTPS", "Text → MP3 + viseme timing")
  Rel(backend, agora_rtc, "HTTPS + token", "Token generation for RTC/RTM")
  Rel(backend, agora_cai, "HTTPS", "Start/stop/update conversational agents")

  Rel(backend, conv_store, "read/write", "Session history")
  Rel(backend, voice_store, "read/write", "Voice mappings")
  Rel(backend, output_files, "write", "Analysis results")
```

---

### C4 Level 3 — Backend Component Diagram

```mermaid
C4Component
  title EmoTalk Backend — Components

  Container_Boundary(backend, "Backend API (Express 5)") {
    Component(agora_route, "Agora Router", "Express Router", "GET /agora/session — RTC token + appId\nPOST /agora/agent/start|leave|update")
    Component(audio_route, "Audio Analysis Router", "Express Router", "POST /analyze-audio (recorded clip)\nPOST /analyze-audio/live (streaming chunk)")
    Component(chat_route, "Chat Router", "Express Router", "POST /chat — emotion-driven text reply\nGET|DELETE /chat/:sessionId")
    Component(avatar_route, "Avatar Router", "Express Router", "GET|PUT /avatar/voices\nPOST /avatar/speech — TTS + viseme data")

    Component(agent_svc, "Conversational Agent Service", "Service", "Manages Agora CAI agent lifecycle; injects emotion system prompts into agent config")
    Component(ai_svc, "AI Service", "Service", "Calls OpenAI GPT-4o with emotion persona system prompt; returns text response")
    Component(speech_svc, "Speech Service", "Service", "Calls OpenAI Whisper to transcribe uploaded audio blobs")
    Component(avatar_svc, "Avatar Speech Service", "Service", "Calls ElevenLabs TTS; generates viseme timeline and gesture beats from response text")
    Component(chat_svc, "Chat Service", "Service", "Multi-turn chat with optional web-search tool; maintains session memory")
    Component(emotion_cfg, "Emotion Config", "Config", "System prompts and voice parameters for joy / sadness / anxiety / anger")
    Component(conv_store, "Conversation Store", "In-memory store", "Session-scoped message history")
    Component(voice_store, "Voice Config Store", "File-backed store", "Persisted ElevenLabs voice-ID map per emotion")
  }

  System_Ext(openai, "OpenAI API")
  System_Ext(elevenlabs, "ElevenLabs API")
  System_Ext(agora_cai, "Agora CAI API")

  Rel(agora_route, agent_svc, "delegates agent ops")
  Rel(audio_route, speech_svc, "transcribe audio")
  Rel(audio_route, ai_svc, "generate emotion reply")
  Rel(chat_route, chat_svc, "multi-turn chat")
  Rel(avatar_route, avatar_svc, "synthesise speech + animation")

  Rel(agent_svc, emotion_cfg, "reads system prompt")
  Rel(agent_svc, agora_cai, "HTTPS")
  Rel(ai_svc, emotion_cfg, "reads persona config")
  Rel(ai_svc, openai, "HTTPS")
  Rel(speech_svc, openai, "HTTPS")
  Rel(avatar_svc, elevenlabs, "HTTPS")
  Rel(avatar_svc, voice_store, "reads voice mapping")
  Rel(chat_svc, conv_store, "reads/writes history")
  Rel(chat_svc, openai, "HTTPS")
```

---

## Project Structure

```
emotalk/
├── apps/
│   ├── frontend/          # React + Vite SPA
│   │   └── src/
│   │       ├── App.tsx                  # Root component & state machine
│   │       ├── components/
│   │       │   ├── EmotionAvatar.tsx    # Viseme-driven animated avatar
│   │       │   ├── CallSetupPanel.tsx   # Channel join / role selection
│   │       │   ├── LiveResponsePanel.tsx
│   │       │   └── AudioMeterCard.tsx
│   │       ├── hooks/                   # Custom React hooks
│   │       ├── lib/
│   │       │   ├── api.ts               # Typed API client
│   │       │   ├── emotions.ts          # Emotion type definitions
│   │       │   └── conversational-ai-api/  # Agora CAI SDK wrapper
│   │       └── store/                   # Client-side state
│   └── backend/           # Express 5 API
│       └── src/
│           ├── app.js                   # Express setup & middleware
│           ├── config/
│           │   └── emotions.js          # System prompts + voice settings
│           ├── controllers/
│           ├── routes/
│           ├── services/                # Core business logic
│           │   ├── conversationalAgentService.js
│           │   ├── avatarSpeechService.js
│           │   ├── chatService.js
│           │   ├── aiService.js
│           │   └── speechService.js
│           └── utils/
└── packages/
    └── shared/            # Cross-cutting types & utilities
```

---

## Key User Flows

### 1. Recorded Clip Analysis
```
User records mic clip → POST /analyze-audio →
  Whisper transcription → GPT-4o emotion reply →
  ElevenLabs TTS + viseme timeline →
  Avatar animates mouth + gesture beats
```

### 2. Live Conversational Agent (Agora CAI)
```
User joins channel → POST /agora/agent/start (emotion) →
  Agora CAI agent joins channel with emotion system prompt →
  Agent listens, transcribes, generates, speaks in real-time →
  PATCH /agora/agent/:id/update to change emotion mid-call
```

### 3. Text Chat
```
POST /chat { message, emotion, sessionId } →
  GPT-4o with emotion persona (± web search tool) →
  Response returned; session history maintained in-memory
```

---

## Emotions

| Emotion | Personality | Voice | Visual |
|---------|-------------|-------|--------|
| **Joy** | Energetic, optimistic, high-hype | Fast (1.08×), high style (0.82) | Pink→purple gradient, animated canvas |
| **Sadness** | Slow, empathetic, non-judgmental | Slow (0.92×), low style (0.28) | Cool blues, soft imagery |
| **Anxiety** | Alert, risk-aware, fast-thinking | Rapid (1.02×), high stability (0.40) | Cyan→blue, restless motion |
| **Anger** | Sharp, intense, action-focused | Punchy (1.05×), very low stability (0.22) | Red→orange heat gradient |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite |
| Real-time media | Agora RTC SDK v4, Agora RTM v2 |
| Backend | Node.js, Express 5 |
| LLM | OpenAI GPT-4o |
| Transcription | OpenAI Whisper (`gpt-4o-mini-transcribe`) |
| TTS | ElevenLabs (`eleven_flash_v2_5`) |
| Conversational AI | Agora Conversational AI (CAI) |

---

## Getting Started

### Prerequisites

- Node.js 20+
- API keys: OpenAI, ElevenLabs, Agora (App ID + Certificate + CAI credentials)

### Setup

```bash
# Install all workspaces
npm install

# Copy and fill in environment variables
cp .env.example .env
```

Required `.env` values:

```env
PORT=3000
CORS_ORIGIN=http://localhost:5173

OPENAI_API_KEY=
AGORA_APP_ID=
AGORA_APP_CERTIFICATE=
ELEVENLABS_API_KEY=

# Optional: per-emotion ElevenLabs voice IDs
ELEVENLABS_VOICE_ID_JOY=
ELEVENLABS_VOICE_ID_SADNESS=
ELEVENLABS_VOICE_ID_ANXIETY=
ELEVENLABS_VOICE_ID_ANGER=

# Agora Conversational AI (required for live agent mode)
AGORA_CAI_CUSTOMER_ID=
AGORA_CAI_CUSTOMER_SECRET=
AGORA_CAI_BASE_URL=
```

### Run

```bash
# Start both frontend and backend in dev mode
npm run dev

# Or individually
npm run dev --workspace=apps/frontend
npm run dev --workspace=apps/backend
```

Frontend: http://localhost:5173
Backend: http://localhost:3000

---

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/agora/session` | Get RTC session token + appId |
| `POST` | `/agora/agent/start` | Start live AI agent in channel |
| `PATCH` | `/agora/agent/:id/update` | Change agent emotion mid-call |
| `POST` | `/agora/agent/:id/leave` | Stop agent |
| `POST` | `/analyze-audio` | Transcribe + respond to recorded clip |
| `POST` | `/analyze-audio/live` | Process live audio chunk (no persistence) |
| `POST` | `/chat` | Emotion-driven text chat |
| `GET` | `/chat/:sessionId` | Retrieve session history |
| `DELETE` | `/chat/:sessionId` | Clear session |
| `POST` | `/avatar/speech` | Generate TTS + viseme/gesture data |
| `GET` | `/avatar/voices` | List available voice mappings |
| `PUT` | `/avatar/voices` | Save custom voice mapping |
| `GET` | `/health` | Health check |

---

## Workspace Commands

```bash
npm run dev      # Start all apps in development mode
npm run build    # Build all apps
npm run test     # Run tests across all workspaces
npm run lint     # Lint all workspaces
```

## End-to-End Data Flow

```mermaid
flowchart TD
    User(["👤 User"])

    subgraph FlowA ["Flow A — Recorded Clip Analysis"]
        direction TB
        A1["Select emotion\njoy / sadness / anxiety / anger"]
        A2["Record mic clip"]
        A3["POST /analyze-audio\naudio blob + emotion"]
        A4["Emotion Config\nsystem prompt + voice params"]
        A5["OpenAI Whisper\ntranscribe audio"]
        A6["OpenAI GPT-4o\nemotion-tuned completion"]
        A7["ElevenLabs TTS\neleven_flash_v2_5"]
        A8["MP3 + viseme timing"]
        A9["Avatar animates\nmouth + gesture beats"]

        A1 --> A2 --> A3
        A3 --> A4
        A3 --> A5
        A4 -->|"system prompt"| A6
        A5 -->|"transcript"| A6
        A6 -->|"reply text"| A7
        A7 --> A8 --> A9
    end

    subgraph FlowB ["Flow B — Live Conversational Agent"]
        direction TB
        B1["Join channel\npick emotion"]
        B2["GET /agora/session\nRTC token + appId"]
        B3["Agora RTC\njoin channel"]
        B4["POST /agora/agent/start\nemotion + channel"]
        B5["Emotion Config\nsystem prompt"]
        B6["Agora CAI Agent\njoins same channel"]
        B7["User speaks\naudio stream via RTC"]
        B8["OpenAI Whisper\ninternal transcription"]
        B9["OpenAI GPT-4o\nemotion prompt → reply"]
        B10["ElevenLabs TTS\nemotion-tuned speech"]
        B11["Agora RTC\nagent audio stream"]
        B12["User hears\nagent response"]

        B1 --> B2 --> B3
        B1 --> B4
        B4 --> B5 -->|"system prompt"| B6
        B6 --> B3
        B3 --> B7 --> B8 --> B9 --> B10 --> B11 --> B12
    end

    subgraph FlowC ["Flow C — Mid-Call Emotion Switch"]
        direction TB
        C1["Switch emotion\nduring live call"]
        C2["PATCH /agora/agent/:id/update\nnew emotion"]
        C3["Emotion Config\nnew system prompt + voice params"]
        C4["Agora CAI Agent\nupdated config"]
        C5["Continues stream\nwith new emotion voice"]

        C1 --> C2 --> C3 --> C4 --> C5
    end

    User --> FlowA
    User --> FlowB
    User --> FlowC
```

---

## Conventions

- Keep application-specific code inside its app directory (`apps/frontend`, `apps/backend`).
- Move reusable code into `packages/shared` instead of duplicating it.
- Emotion system prompts and voice parameters live in `apps/backend/src/config/emotions.js` — change personalities there, not in service code.
