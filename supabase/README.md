# Supabase database

- `migrations/` contains versioned SQL migrations.
- Apply migrations with the Supabase SQL Editor or Supabase CLI.
- Keep table creation, grants, indexes, and RLS policies in migrations.
- Do not store service-role keys in frontend or project environment files.

Current migration:

- `001_initial_schema.sql`: farmer profiles and owner-scoped farming history/recommendations.
