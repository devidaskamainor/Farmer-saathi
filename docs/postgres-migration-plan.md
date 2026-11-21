# PostgreSQL migration plan

## Audit findings

- Supabase Auth currently handles email/password registration, login, persisted sessions, and access-token validation.
- `public.farmers` is queried by the Express API through Supabase PostgREST. The `farmers` row ID is the Auth user ID.
- The legacy schema also defines `farming_history` and `saved_recommendations`; the current application has no routes that read or write those tables.
- Government scheme records and translations are versioned in backend source, not Supabase tables.
- Weather and mandi records are fetched from external providers on demand; the application does not persist them.
- Crop images use Multer memory storage and are sent to the AI service; no uploaded files are persisted.
- No Supabase Storage, Realtime, or Edge Functions use was found.
- No Supabase database access credentials were provided to this workspace, so source data cannot be exported or validated here.

## Target architecture

1. Use `pg` connection pooling via backend-only `DATABASE_URL`; configure TLS for hosted database URLs when required.
2. Keep the existing Express API. Store bcrypt password hashes, email-verification state, one-time verification-token hashes, and opaque hashed session tokens in PostgreSQL. Deliver the raw session token only in an HttpOnly cookie.
3. Keep all SQL on the server and use parameterized queries. Resolve each request's farmer from the authenticated session; never trust a client-supplied user ID.
4. Preserve farmer IDs and fields, farming history, saved recommendations, indexes, constraints, and timestamps in versioned PostgreSQL migrations.
5. Keep weather, mandi, image-analysis, and scheme behavior unchanged; these currently do not depend on Supabase storage services.

## Safe cutover sequence

1. Back up the source Supabase database and keep the original project unchanged.
2. Create the target PostgreSQL database and apply `database/migrations/`.
3. Run `npm run db:import-supabase -w server` with a read-only `SUPABASE_DATABASE_URL` and target `DATABASE_URL`. It imports Auth user IDs/emails/password hashes and verification state, farmer profiles, farming history, and saved recommendations in a target transaction.
4. Compare exported/imported counts, IDs, foreign-key relationships, and representative profiles. Confirm password-hash compatibility by testing login for selected accounts. If a hash cannot be verified, require a password reset; never migrate plaintext passwords.
5. Configure the API's `DATABASE_URL`, SMTP verification-email settings, cookie settings, and production `CLIENT_ORIGIN`. Test registration, email verification, login, logout, session expiry, profile updates, and cross-user isolation.
6. Deploy the backend and frontend, then monitor errors before retiring Supabase Auth/PostgREST use. Do not delete the original Supabase project or data as part of this migration.

## Current limitation

The import utility can be run only by an operator who can read the original Supabase PostgreSQL database (including `auth.users.encrypted_password`) and has a separate empty target PostgreSQL database. No source or target database credentials were provided to this workspace, so no existing production data was exported or imported. Bcrypt-compatible hashes and Supabase email-confirmation timestamps are carried over. Accounts without a compatible hash are imported with login disabled and require password recovery; plaintext passwords are never migrated. New registrations require SMTP email verification.
