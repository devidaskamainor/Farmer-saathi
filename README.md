# Farmer Saathi

A mobile-friendly farming assistant for Indian farmers. The app uses Supabase Auth for accounts and Supabase Postgres for farmer profiles, with row-level security (RLS) restricting records to their owner. Weather, mandi data, and Groq advice are server-side integrations; weather falls back to Open-Meteo if OpenWeather is unavailable.

## Requirements

- Node.js 22 or later and npm
- A Supabase project
- Optional API credentials for Groq, OpenWeather, and AGMARKNET

Weather uses OpenWeather when its key is accepted and otherwise falls back to Open-Meteo. Open-Meteo's free endpoint is for non-commercial use and requires attribution; the app displays that attribution with its weather data. For commercial use, configure a valid OpenWeather key or a paid weather API plan.

## Supabase setup

1. Ensure the Supabase project is active before running the app.
2. In the Supabase SQL Editor, run [`supabase/migrations/001_initial_schema.sql`](supabase/migrations/001_initial_schema.sql). It creates `farmers`, `farming_history`, and `saved_recommendations`, grants access to authenticated users, and enables owner-scoped RLS policies.
3. In Supabase Auth settings, configure the site URL and allowed redirect URLs for local and deployed frontend origins. Email confirmation is enabled by default on hosted projects; the sign-up screen tells farmers to confirm their email before signing in.
4. If the project's Data API settings do not expose the `public` schema, enable it for the authenticated role. The SQL script includes table grants and RLS; do not grant access to `anon` for farmer records.
5. Copy the project URL and its **publishable** key (not a secret/service-role key) into the environment files below.

The browser uses the publishable key with the signed-in farmer's Supabase session. Express verifies each access token and makes database requests with that same user token, so Postgres RLS applies. Never put a Supabase secret/service-role key in frontend or project environment files.

## Local setup

1. Copy root `.env.example` to `.env`. Set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`; add optional API keys if available.
2. Copy `client/.env.example` to `client/.env.local`. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to the same project URL and publishable key. Leave `VITE_API_URL` blank to use the local Vite proxy.
3. Install dependencies from the project root:

   ```bash
   npm install
   ```

4. Start the API and frontend:

   ```bash
   npm run dev
   ```

5. Open `http://localhost:5173`. The API listens on `http://localhost:4000`.

If Supabase credentials are not set, the UI explains what is missing and the API health route reports `database: not_configured`. No example farmer accounts or data are seeded.

## Environment variables

| Variable | Used by | Purpose |
| --- | --- | --- |
| `PORT` | Server | API port; defaults to `4000`. |
| `CLIENT_ORIGIN` | Server | Allowed frontend origin(s), comma-separated. |
| `SUPABASE_URL` | Server | Supabase project URL. |
| `SUPABASE_PUBLISHABLE_KEY` | Server | Publishable API key used with the farmer's bearer token and RLS. No service-role key is required. |
| `VITE_SUPABASE_URL` | Frontend | Same project URL for Supabase Auth. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Frontend | Same publishable key; intended for browser clients. |
| `VITE_API_URL` | Frontend | Optional Express API base URL ending in `/api`. |
| `GROQ_API_KEY` | Server | Enables the farming assistant and crop advice. |
| `GROQ_MODEL` | Server | Text model; defaults to `openai/gpt-oss-20b`. |
| `GROQ_VISION_MODEL` | Server | Image model; defaults to `qwen/qwen3.8-27b`. |
| `WEATHER_API_KEY` | Server | Optional OpenWeather key; Open-Meteo is used when the key is missing or rejected. |
| `AGMARKNET_API_KEY` | Server | Enables official market data from data.gov.in. |
| `AGMARKNET_RESOURCE_ID` | Server | Optional AGMARKNET resource override. |

Do not commit `.env` or `client/.env.local`. The checked-in examples contain blanks, not real credentials.

## Features

- Supabase Auth sign-up, sign-in, persisted sessions, and automatic access-token refresh.
- Farmer profile management for location, language, farm size, soil measurements, irrigation, and current crops.
- Responsive dashboard with source-labelled weather and reported mandi prices.
- Groq-backed farming questions, crop suggestions, irrigation advice, and symptom/photo assessment.
- English, Hindi, and Kannada preferences; assistant replies follow the selected language.
- Browser speech recognition and text-to-speech where supported.
- Supabase RLS policies for farmer profiles, farming history, and saved recommendations.
- Clear errors for missing Supabase setup and unavailable third-party services.

The Government Schemes page uses a source-linked catalogue maintained in the backend; it is not a live scheme API. Hindi and Kannada summaries are cached with each scheme's source revision, labeled as non-official translations, and require native-speaker review. When source content changes, increment its `sourceRevision`; the API will stop serving stale translations and fall back to English until the translation revision is updated. No translation API key or database migration is needed. Seed information and the optional Scikit-learn crop-prediction service remain deferred. Voice input/output uses browser APIs; server-side speech endpoints explain that no speech provider is configured.

## API routes

Supabase Auth handles sign-up and sign-in directly from the browser. Authenticated Express endpoints require `Authorization: Bearer <Supabase access token>`.

- `GET /api/health`
- `GET /api/farmers/profile`
- `GET /api/farmers/profile/:id`
- `PUT /api/farmers/profile/:id`
- `GET /api/weather`
- `GET /api/mandi/prices`
- `GET /api/mandi/compare`
- `POST /api/ai/ask`
- `POST /api/ai/crop-recommendations`
- `POST /api/ai/irrigation`
- `POST /api/ai/crop-protection`
- `POST /api/disease/analyze` (optional JPG, PNG, or WebP image up to 5 MB)
- `POST /api/voice/transcribe`, `POST /api/voice/speak` (browser speech is used instead)
- `GET /api/schemes?language=en|hi|kn`
- `GET /api/schemes/search?q=keyword&state=Karnataka&category=crop-insurance&language=kn`
- `GET /api/schemes/:id?language=hi`
- `POST /api/schemes/recommendations`

## Project structure

```text
client/                   React + Vite frontend
  src/app/                Application shell and routed application UI
  src/config/             Browser configuration, including Supabase
  src/services/           API client and browser voice integrations
  src/styles/             Global frontend styles
  src/main.jsx            React entry point
server/
  src/routes/             Express API route modules
  src/services/           Business integrations and data services
  src/config/             Server-side configuration
  src/middleware/         Authentication and request middleware
  src/utils/              Shared server utilities
  test/                   Node test suite
supabase/
  migrations/             Versioned Postgres SQL migrations
spec.md                   Project requirements
```

## Deployment

- Deploy the Vite client as a static site and set `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_API_URL` in its build environment.
- Deploy the Express server from the `server` workspace and set `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `CLIENT_ORIGIN`, and any optional service credentials.
- Configure Supabase Auth's production Site URL and redirect allow list.
- Keep RLS enabled. Do not add a service-role key to the API or browser configuration; database requests should continue to use the signed-in farmer's access token.
