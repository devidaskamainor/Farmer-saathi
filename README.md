# Farmer Saathi

A mobile-friendly farming assistant for Indian farmers. The Express API stores account and farm-profile data in standalone PostgreSQL. Weather, mandi data, and Groq advice are server-side integrations; weather falls back to Open-Meteo when OpenWeather is unavailable.

## Requirements

- Node.js 22 or later and npm
- PostgreSQL 13 or later
- SMTP credentials to send email verification links
- Optional API credentials for Sarvam, Groq, OpenWeather, and AGMARKNET

Weather uses OpenWeather when its key is accepted and otherwise falls back to Open-Meteo. Open-Meteo's free endpoint is for non-commercial use and requires attribution; the app displays that attribution with its weather data. For commercial use, configure a valid OpenWeather key or a paid weather API plan.

## Neon and local setup

The backend reads `DATABASE_URL` from the project-root `.env` file next to `package.json` (not `client/.env.local`). In the Neon console, create a database and copy its connection string from **Connect**. Put that value in the root `.env`:

```env
DATABASE_URL=postgresql://<role>:<password>@<your-neon-host>.neon.tech/<database>?sslmode=require
```

Do not include the angle brackets; use the exact connection string Neon gives you and URL-encode special characters in the password. The backend and migration CLI detect Neon hosts and enforce TLS with certificate validation, even if `DATABASE_SSL=false`; never disable certificate validation.

Run these commands from the project root in the VS Code terminal:

```powershell
npm run db:config
npm run db:ping -w server
npm run db:migrate -w server
npm run db:verify -w server
```

`db:config` checks root `.env` presence and PostgreSQL URL structure without printing credentials. `db:ping` checks connectivity without changing data. `db:migrate` applies numbered SQL migrations in order and records their checksums; repeating it skips already-applied migrations and validates the expected tables, indexes, foreign keys, and checks. `db:verify` checks the connection and schema without applying changes.

Start the app and check its health endpoint:

```powershell
npm run dev
Invoke-RestMethod http://localhost:4000/api/health
```

The health response reports `database: connected` only after a successful PostgreSQL query.

## Local setup

1. Create a PostgreSQL database, for example `farmer_saathi`.
2. Copy root `.env.example` to `.env`. Set `DATABASE_URL`, SMTP settings, `CLIENT_URL`, and `CLIENT_ORIGIN`. Locally both frontend values are `http://localhost:5173`; for phone/LAN testing, set `CLIENT_URL` to the dev machine's reachable frontend URL and include that exact origin in `CLIENT_ORIGIN`. Database and SMTP credentials are backend-only; do not put them in client environment variables.
3. Install dependencies from the project root:

   ```bash
   npm install
   ```

4. Check the connection and apply versioned schema migrations:

   ```bash
   npm run db:ping -w server
   npm run db:migrate -w server
   npm run db:verify -w server
   ```

5. Start the API and frontend:

   ```bash
   npm run dev
   ```

6. Open `http://localhost:5173`. The API listens on `http://localhost:4000`.

New accounts require email verification. Configure a working SMTP service, `CLIENT_URL`, and `CLIENT_ORIGIN`; verification links open the frontend, which submits the token to the API. If SMTP delivery fails after an account is created, resend using `POST /api/auth/verification/resend` with the account email. Passwords are hashed with bcrypt; session tokens are random, stored only as hashes, and delivered in HttpOnly cookies. Password reset is not currently supported.

### Gmail email verification

The backend loads SMTP settings from the repository-root `.env` at startup. For Gmail, use `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, and `SMTP_SECURE=false`; the mail transport requires STARTTLS on non-implicit-TLS connections. Set `SMTP_USER` and `SMTP_FROM` to the authorized sender address and use a Google App Password for `SMTP_PASSWORD` (not the normal account password). Enable 2-Step Verification before creating an App Password. Restart the backend after changing `.env`.

At startup the API reports whether required SMTP settings are present and whether the port/security settings are valid; it never logs their values. That diagnostic does not test Gmail authentication or delivery. To verify delivery end to end, register with an inbox you control, open the frontend verification link received there, and select **Verify email**. For an account already created but still unverified, use the app's resend-verification action.

Password recovery uses the same SMTP settings. It stores only a SHA-256 token hash in `auth_password_resets`; tokens expire after 15 minutes, are single-use, and a successful reset deletes all active sessions. Review `database/migrations/003_password_resets.sql`, then explicitly run `npm run db:migrate -w server` before using password recovery. Migrations are not run automatically during startup.

Ask Saathi voice features use Sarvam Saaras v4 for transcription and Sarvam Bulbul for spoken playback. Add `SARVAM_API_KEY` to the repository-root `.env` to enable them. Recording is explicit, limited to 28 seconds in the browser, and sent to the server for transcription; transcripts are not sent until reviewed and submitted. Text input remains available. Spoken playback is available only in the languages listed in the environment/features section below; the app does not substitute a different language voice.

To configure voice locally, add `SARVAM_API_KEY=your_sarvam_api_key` to the root `.env` (next to the root `package.json`) and replace the placeholder with a key from your Sarvam dashboard. Keep it server-side; never add it to a `VITE_` variable or commit `.env`.

Farm planning and progress tracking require migration `004_farm_planning_and_history.sql`. Review it before applying it with `npm run db:migrate -w server`; existing history dates are retained and labeled as sowing, harvest, or observation when possible. The planner uses a seven-day Open-Meteo forecast and only recent, farmer-entered soil-moisture measurements. It produces weather risk alerts and soil-moisture review prompts, not exact water quantities or a disease diagnosis.

## Environment variables

| Variable | Used by | Purpose |
| --- | --- | --- |
| `PORT` | Server | API port; defaults to `4000`. |
| `CLIENT_URL` | Server | Canonical frontend URL used in email verification links; e.g. `http://localhost:5173` locally or the deployed HTTPS frontend. |
| `CLIENT_ORIGIN` | Server | Allowed frontend origin(s), comma-separated. Development also accepts HTTP localhost/private-LAN origins; production accepts only configured origins. |
| `DATABASE_URL` | Server | Standalone PostgreSQL connection string. |
| `DATABASE_SSL` | Server/scripts | Set `true` when the database host requires TLS; Neon hosts always use validated TLS. |
| `DATABASE_SSL_REJECT_UNAUTHORIZED` | Server/scripts | Keep `true` to validate the database certificate. |
| `DATABASE_POOL_MAX` | Server | Maximum PostgreSQL pool size; defaults to `10`. |
| `SESSION_COOKIE_NAME` | Server | Session-cookie name. |
| `SESSION_DURATION_DAYS` | Server | Session lifetime from 1 to 90 days; defaults to `14`. |
| `SESSION_COOKIE_SAME_SITE` | Server | Cookie policy (`lax`, `strict`, or `none`). Cross-site cookies require `none` and Secure. |
| `SESSION_COOKIE_SECURE` | Server | Set `true` for HTTPS; defaults to true in production. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Server | SMTP provider settings for verification email. |
| `API_PUBLIC_URL` | Server | Public API origin used for same-origin request checks. |
| `SUPABASE_DATABASE_URL` | Migration script only | Read-only legacy source connection used only during the one-time Supabase import. |
| `SUPABASE_DATABASE_SSL`, `SUPABASE_DATABASE_SSL_REJECT_UNAUTHORIZED` | Migration script only | TLS options for the legacy source connection. |
| `VITE_API_URL` | Frontend | Optional Express API base URL ending in `/api`; leave blank for the local Vite proxy. |
| `GROQ_API_KEY` | Server | Enables the farming assistant and crop advice. |
| `GROQ_MODEL` | Server | Text model; defaults to `openai/gpt-oss-20b`. |
| `GROQ_VISION_MODEL` | Server | Image model; defaults to `qwen/qwen3.8-27b`. |
| `WEATHER_API_KEY` | Server | Optional OpenWeather key; Open-Meteo is used when the key is missing or rejected. |
| `AGMARKNET_API_KEY` | Server | Enables official market data from data.gov.in. |
| `AGMARKNET_RESOURCE_ID` | Server | Optional AGMARKNET resource override. |
| `SARVAM_API_KEY` | Server | Enables Saaras v4 speech transcription and Bulbul text-to-speech. |
| `FARM_ALERT_HEAVY_RAIN_MM`, `FARM_ALERT_SEVERE_RAIN_MM` | Server | Daily rainfall thresholds for planner alerts; defaults are 25 mm and 50 mm. |
| `FARM_ALERT_HIGH_TEMPERATURE_C` | Server | High-temperature alert threshold; defaults to 38 °C. |
| `FARM_ALERT_DRY_DAY_RAIN_MM`, `FARM_ALERT_DRY_SPELL_DAYS` | Server | Rainfall and consecutive-day thresholds for prolonged dry-weather alerts. |
| `FARM_SOIL_MOISTURE_LOW_PCT`, `FARM_SOIL_MEASUREMENT_MAX_AGE_DAYS` | Server | Planner threshold and freshness window for farmer-entered soil moisture. |

Never commit `.env` or `client/.env.local`. The checked-in examples contain placeholders only.

## Migrating data from Supabase

The application no longer uses Supabase at runtime. Supabase/Auth data is not automatically moved and the original project is not deleted or modified.

1. Back up the source database before migration. In PowerShell, run `pg_dump --format=custom --file=supabase-backup.dump $env:SUPABASE_DATABASE_URL` in a secure terminal, and keep the backup private.
2. Create a separate empty PostgreSQL database and set its `DATABASE_URL` in the server `.env`. Set `SUPABASE_DATABASE_URL` only in the migration process to a read-only source connection that can read `auth.users` and the three legacy `public` tables. Keep TLS certificate validation enabled for hosted Supabase connections. Do not reuse the production target URL.
3. Apply schema migrations to the empty target:

   ```bash
   npm run db:migrate -w server
   ```

4. Run the import:

   ```bash
   npm run db:import-supabase -w server
   ```

   The importer reads source data in a read-only transaction, preserves IDs and timestamps, writes target data in one transaction, checks record counts and profile relationships, and aborts if the target has any user/profile/history/recommendation rows. It never writes to the source. Profiles with broken relationships abort the import. Only full bcrypt `$2a$`/`$2b$` hashes that match the backend bcrypt format are copied; other accounts are imported with login disabled and require password recovery. No Supabase sessions are imported or assumed valid, and plaintext passwords are never moved.

5. Compare the reported counts with the source, test representative account logins and profile access, then switch the deployed backend to the target `DATABASE_URL`. Keep the backup and original Supabase project until post-cutover verification is complete.

`SUPABASE_DATABASE_URL` is used only by the one-time import script; it is not read by the application server. Do not commit it or put it in any `VITE_` variable. The import currently requires the original schema's `auth.users`, `public.farmers`, `public.farming_history`, and `public.saved_recommendations` tables.

## Features

- PostgreSQL-backed email/password registration, login, email verification, and logout.
- Bcrypt password hashes and HttpOnly cookie sessions; protected profile routes use the session identity, never a client-provided user ID.
- Farmer profile management for location, language, farm size, soil measurements, irrigation, and current crops.
- Seven-day personalized farm planner with configurable weather thresholds, risk alerts, explicit missing inputs, and no fabricated irrigation quantities.
- Owner-scoped farm activity history for sowing, irrigation, fertilizer, observations, disease symptoms, and harvest/yield records.
- Responsive dashboard with source-labelled weather and reported mandi prices.
- Groq-backed farming questions, crop suggestions, irrigation advice, and symptom/photo assessment.
- A preferred-language selector for English and the 22 scheduled Indian languages. English is the interface fallback; Hindi and Kannada have partial interface translations. Other interface translations are not yet available.
- Groq prompts request responses in the selected language. A one-time writing-system check can retry an answer, but language quality is not certified for any model/language pair.
- Ask Saathi uses Sarvam Saaras v4 for native-script transcription in English and the 22 scheduled Indian languages; voice recording is uploaded only after the user starts and stops it. Transcripts must be reviewed and manually sent.
- Ask Saathi spoken playback uses Sarvam Bulbul in English, Hindi, Bengali, Gujarati, Kannada, Malayalam, Marathi, Odia, Punjabi, Tamil, and Telugu. Other language selections keep text answers and explicitly report that spoken playback is unavailable. The app does not substitute a different-language voice.
- Browser speech helpers remain available in account-help and onboarding areas when a matching device/browser capability exists.
- Offline mode caches only the static application shell; private farm records and live weather/market data are not cached or shown as current while offline.
- Source-linked government scheme catalogue; it is stored in the application and is not live scheme API data. Hindi/Kannada explanations are labeled non-official and tied to source revisions.

## API routes

- `GET /api/health`
- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`
- `GET /api/auth/session`, `GET /api/auth/verify` (confirmation page), `POST /api/auth/verify`
- `POST /api/auth/verification/resend`
- `GET /api/farmers/profile`
- `GET /api/farmers/profile/:id`
- `PUT /api/farmers/profile/:id`
- `GET /api/farmers/history`
- `POST /api/farmers/history`, `PUT /api/farmers/history/:id`, `DELETE /api/farmers/history/:id`
- `GET /api/planner`
- `GET /api/weather`
- `GET /api/mandi/prices`
- `GET /api/mandi/compare`
- `POST /api/ai/ask`
- `POST /api/ai/crop-recommendations`
- `POST /api/ai/irrigation`
- `POST /api/ai/crop-protection`
- `POST /api/disease/analyze` (optional JPG, PNG, or WebP image up to 5 MB)
- `POST /api/voice/transcribe` (authenticated, up to 5 MB audio; Saaras v4)
- `POST /api/voice/speak` (authenticated; Bulbul audio returned as WAV, text up to 2,500 characters)
- `GET /api/schemes?language=en|hi|kn`
- `GET /api/schemes/search?q=keyword&state=Karnataka&category=crop-insurance&language=kn`
- `GET /api/schemes/:id?language=hi`
- `POST /api/schemes/recommendations`

## Language support

The shared language catalog is in `shared/languages.js`; the stored IDs, browser locales, Sarvam transcription locales, and supported Bulbul voices are defined there. Preferred language values are validated by the API and constrained by `database/migrations/005_indian_languages.sql`. Apply pending schema migrations explicitly with `npm run db:migrate -w server`; migrations are not run during app startup.

The current UI resources are English-first with partial Hindi and Kannada translations. For all other languages the app intentionally displays English for untranslated screens, marks that fallback in language metadata, and does not display internal translation keys. Ask Saathi sends the preferred language to the existing Groq integration, but model output has not been tested end-to-end for each language. Sarvam speech features require a configured API key and network access; no provider delivery is assumed until tested with a valid key.

## Project structure

```text
client/                   React + Vite frontend
  src/app/                Application shell and routed UI
  src/services/           API client and browser voice integrations
  src/styles/             Global frontend styles
server/
  scripts/                PostgreSQL schema and one-time data migration commands
  src/routes/             Express API route modules
  src/services/           Business integrations and data services
  src/config/             Server configuration and PostgreSQL pool
  src/middleware/         Authentication and request middleware
  test/                   Node test suite
database/migrations/      Version-controlled PostgreSQL schema migrations
docs/                     Migration notes and project documentation
```

## Deployment

Create a standalone PostgreSQL database with TLS enabled when required by the provider. Configure `DATABASE_URL`, SMTP settings, `API_PUBLIC_URL`, `CLIENT_URL`, `CLIENT_ORIGIN`, and optional service credentials in the backend's secret environment. `CLIENT_URL` is the canonical frontend URL used in verification emails; `CLIENT_ORIGIN` is the exact comma-separated CORS allowlist. Run `npm run db:migrate -w server` before starting the API. Deploy the Vite client with `VITE_API_URL` pointing to the API's `/api` base URL, or proxy `/api` through the same origin. For different frontend/API sites, allow the exact frontend origin in `CLIENT_ORIGIN`, use HTTPS, and configure `SESSION_COOKIE_SAME_SITE=none` and `SESSION_COOKIE_SECURE=true`. Configure the frontend host to serve the SPA for `/verify-email`. Verify `/api/health`, registration/verification, login, logout, and profile isolation after deployment.
