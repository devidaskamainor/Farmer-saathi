import { projectRoot } from '../src/config/env.js';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import pg from 'pg';
import { normalizeNeonSslMode } from '../src/config/postgresConnection.js';

const { Client } = pg;
const migrationsDir = resolve(projectRoot, 'database/migrations');

async function applyMigrations() {
  if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL to the standalone PostgreSQL database.');
  const target = new Client({
    connectionString: normalizeNeonSslMode(process.env.DATABASE_URL),
    ...sslOptions('DATABASE', process.env.DATABASE_URL)
  });
  try {
    await target.connect();
    await target.query(`create table if not exists schema_migrations (
      name text primary key,
      checksum text not null,
      applied_at timestamptz not null default now()
    )`);
    const files = (await readdir(migrationsDir)).filter(name => /^\d+_.+\.sql$/.test(name)).sort();
    for (const name of files) {
      const sql = await readFile(resolve(migrationsDir, name), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const existing = await target.query('select checksum from schema_migrations where name = $1', [name]);
      if (existing.rowCount) {
        if (existing.rows[0].checksum !== checksum) throw new Error(`Applied migration ${name} was changed; create a new migration instead.`);
        console.info(`Already applied ${name}`);
        continue;
      }
      await target.query('begin');
      try {
        await target.query(sql);
        await target.query('insert into schema_migrations (name, checksum) values ($1, $2)', [name, checksum]);
        await target.query('commit');
        console.info(`Applied ${name}`);
      } catch (error) {
        await target.query('rollback');
        throw error;
      }
    }
    await verifySchema(target);
  } finally { await target.end(); }
}

async function verifyDatabase() {
  if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL to the standalone PostgreSQL database.');
  const target = new Client({
    connectionString: normalizeNeonSslMode(process.env.DATABASE_URL),
    ...sslOptions('DATABASE', process.env.DATABASE_URL)
  });
  try {
    await target.connect();
    await verifySchema(target);
    console.info('PostgreSQL connection and required schema checks passed.');
  } finally { await target.end(); }
}

async function pingDatabase() {
  if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL to the standalone PostgreSQL database.');
  const target = new Client({
    connectionString: normalizeNeonSslMode(process.env.DATABASE_URL),
    ...sslOptions('DATABASE', process.env.DATABASE_URL)
  });
  try {
    await target.connect();
    await target.query('select 1');
    console.info('PostgreSQL connection successful.');
  } finally { await target.end(); }
}

async function verifySchema(target) {
  const requiredTables = [
    'app_users', 'farmers', 'auth_sessions', 'auth_email_verifications', 'auth_password_resets',
    'farming_history', 'saved_recommendations', 'schema_migrations'
  ];
  const tableResult = await target.query(
    `select table_name from information_schema.tables
     where table_schema = current_schema() and table_name = any($1::text[])`,
    [requiredTables]
  );
  const tableNames = new Set(tableResult.rows.map(row => row.table_name));
  const missingTables = requiredTables.filter(name => !tableNames.has(name));
  if (missingTables.length) throw new Error(`Missing PostgreSQL tables: ${missingTables.join(', ')}.`);

  const requiredPrimaryKeys = [
    'app_users', 'farmers', 'auth_sessions', 'auth_email_verifications', 'auth_password_resets',
    'farming_history', 'saved_recommendations', 'schema_migrations'
  ];
  const primaryKeyResult = await target.query(
    `select relation.relname as table_name
     from pg_constraint constraint_row
     join pg_class relation on relation.oid = constraint_row.conrelid
     where constraint_row.contype = 'p'
       and constraint_row.connamespace = current_schema()::regnamespace`
  );
  const primaryKeyTables = new Set(primaryKeyResult.rows.map(row => row.table_name));
  const missingPrimaryKeys = requiredPrimaryKeys.filter(name => !primaryKeyTables.has(name));
  if (missingPrimaryKeys.length) throw new Error(`Missing PostgreSQL primary keys: ${missingPrimaryKeys.join(', ')}.`);

  const expectedForeignKeys = [
    ['farmers', 'app_users'],
    ['auth_sessions', 'app_users'],
    ['auth_email_verifications', 'app_users'],
    ['auth_password_resets', 'app_users'],
    ['farming_history', 'farmers'],
    ['saved_recommendations', 'farmers']
  ];
  const foreignKeyResult = await target.query(
    `select child.relname as table_name, parent.relname as referenced_table
     from pg_constraint constraint_row
     join pg_class child on child.oid = constraint_row.conrelid
     join pg_class parent on parent.oid = constraint_row.confrelid
     where constraint_row.contype = 'f'
       and constraint_row.connamespace = current_schema()::regnamespace`
  );
  const actualForeignKeys = new Set(foreignKeyResult.rows.map(row => `${row.table_name}:${row.referenced_table}`));
  const missingForeignKeys = expectedForeignKeys
    .filter(([table, referenced]) => !actualForeignKeys.has(`${table}:${referenced}`))
    .map(([table, referenced]) => `${table} -> ${referenced}`);
  if (missingForeignKeys.length) throw new Error(`Missing PostgreSQL foreign keys: ${missingForeignKeys.join(', ')}.`);

  const requiredIndexes = [
    'app_users_email_lower_unique',
    'auth_sessions_user_expires_idx',
    'auth_email_verifications_expires_idx',
    'auth_password_resets_expires_idx',
    'farming_history_farmer_created_idx',
    'saved_recommendations_farmer_created_idx',
    'farming_history_farmer_event_date_idx'
  ];
  const indexResult = await target.query(
    `select indexname, indexdef from pg_indexes
     where schemaname = current_schema() and indexname = any($1::text[])`,
    [requiredIndexes]
  );
  const indexNames = new Set(indexResult.rows.map(row => row.indexname));
  const missingIndexes = requiredIndexes.filter(name => !indexNames.has(name));
  if (missingIndexes.length) throw new Error(`Missing PostgreSQL indexes: ${missingIndexes.join(', ')}.`);
  const emailIndex = indexResult.rows.find(row => row.indexname === 'app_users_email_lower_unique');
  if (!emailIndex?.indexdef.startsWith('CREATE UNIQUE INDEX')) {
    throw new Error('The app_users email index must enforce case-insensitive uniqueness.');
  }

  const requiredUniqueConstraints = [
    'auth_sessions_token_hash_key',
    'auth_email_verifications_user_id_key',
    'auth_email_verifications_token_hash_key',
    'auth_password_resets_token_hash_key'
  ];
  const uniqueResult = await target.query(
    `select conname from pg_constraint
     where contype = 'u' and connamespace = current_schema()::regnamespace
       and conname = any($1::text[])`,
    [requiredUniqueConstraints]
  );
  const uniqueNames = new Set(uniqueResult.rows.map(row => row.conname));
  const missingUniqueConstraints = requiredUniqueConstraints.filter(name => !uniqueNames.has(name));
  if (missingUniqueConstraints.length) throw new Error(`Missing PostgreSQL unique constraints: ${missingUniqueConstraints.join(', ')}.`);

  const requiredChecks = ['farmers_preferred_language_check', 'farmers_farm_size_check', 'farmers_soil_check', 'farmers_farm_plan_check', 'farming_history_event_type_check', 'farming_history_amount_check', 'saved_recommendations_recommendation_type_check'];
  const checkResult = await target.query(
    `select conname from pg_constraint
     where contype = 'c' and connamespace = current_schema()::regnamespace
       and conname = any($1::text[])`,
    [requiredChecks]
  );
  const checkNames = new Set(checkResult.rows.map(row => row.conname));
  const missingChecks = requiredChecks.filter(name => !checkNames.has(name));
  if (missingChecks.length) throw new Error(`Missing PostgreSQL check constraints: ${missingChecks.join(', ')}.`);

  const requiredColumns = [
    ['farmers', 'farm_plan'],
    ['farming_history', 'event_type'],
    ['farming_history', 'event_date'],
    ['farming_history', 'amount'],
    ['farming_history', 'unit']
  ];
  const columnResult = await target.query(
    `select table_name, column_name from information_schema.columns
     where table_schema = current_schema()
       and (table_name, column_name) in (select * from unnest($1::text[], $2::text[]))`,
    [requiredColumns.map(([table]) => table), requiredColumns.map(([, column]) => column)]
  );
  const actualColumns = new Set(columnResult.rows.map(row => `${row.table_name}:${row.column_name}`));
  const missingColumns = requiredColumns
    .filter(([table, column]) => !actualColumns.has(`${table}:${column}`))
    .map(([table, column]) => `${table}.${column}`);
  if (missingColumns.length) throw new Error(`Missing PostgreSQL columns: ${missingColumns.join(', ')}.`);
}

async function migrateData() {
  if (!process.env.SUPABASE_DATABASE_URL) throw new Error('Set SUPABASE_DATABASE_URL to the read-only source Supabase Postgres connection string.');
  if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL to the standalone PostgreSQL database.');
  if (process.env.SUPABASE_DATABASE_URL === process.env.DATABASE_URL) throw new Error('Source and target database URLs must be different.');

  const source = new Client({
    connectionString: normalizeNeonSslMode(process.env.SUPABASE_DATABASE_URL),
    ...sslOptions('SUPABASE_DATABASE', process.env.SUPABASE_DATABASE_URL)
  });
  const target = new Client({
    connectionString: normalizeNeonSslMode(process.env.DATABASE_URL),
    ...sslOptions('DATABASE', process.env.DATABASE_URL)
  });
  try {
    await source.connect();
    await target.connect();
    await migrateDataWithClients(source, target);
  } finally {
    await Promise.all([source.end(), target.end()]);
  }
}

async function migrateDataWithClients(source, target) {
  await source.query('begin read only');
  let sourceData;
  try {
    const [users, farmers, history, recommendations] = await Promise.all([
      source.query(`select id, email, encrypted_password, email_confirmed_at, created_at, updated_at
        from auth.users where email is not null order by id`),
      source.query(`select id, name, email, state, district, village, preferred_language, farm_size,
        soil, irrigation_facilities, current_crops, created_at, updated_at
        from public.farmers order by id`),
      source.query(`select id, farmer_id, crop, planting_date, harvest_date, notes, created_at
        from public.farming_history order by id`),
      source.query(`select id, farmer_id, recommendation_type, details, related_crop, sources, created_at
        from public.saved_recommendations order by id`)
    ]);
    sourceData = { users: users.rows, farmers: farmers.rows, history: history.rows, recommendations: recommendations.rows };
    await source.query('commit');
  } catch (error) {
    await source.query('rollback');
    throw new Error(`Could not read the expected Supabase auth/public tables. Verify the source permissions and schema. ${error.message}`, { cause: error });
  }

  validateSourceData(sourceData);
  const emptyCounts = await target.query(`select
    (select count(*)::int from app_users) as users,
    (select count(*)::int from farmers) as farmers,
    (select count(*)::int from farming_history) as history,
    (select count(*)::int from saved_recommendations) as recommendations`);
  const counts = emptyCounts.rows[0];
  if (Object.values(counts).some(count => count !== 0)) {
    throw new Error('Target tables are not empty. No data was changed; use a new empty database after backing it up.');
  }

  await target.query('begin');
  try {
    for (const user of sourceData.users) {
      await target.query(
        `insert into app_users (id, email, password_hash, email_verified_at, created_at, updated_at)
         values ($1, $2, $3, $4, $5, $6)`,
        [
          user.id, user.email, isBcryptHash(user.encrypted_password) ? user.encrypted_password : '!password-reset-required!',
          user.email_confirmed_at, user.created_at, user.updated_at
        ]
      );
    }
    for (const farmer of sourceData.farmers) {
      await target.query(
        `insert into farmers
         (id, name, email, state, district, village, preferred_language, farm_size, soil,
          irrigation_facilities, current_crops, created_at, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          farmer.id, farmer.name, farmer.email, farmer.state, farmer.district, farmer.village,
          farmer.preferred_language, farmer.farm_size, farmer.soil, farmer.irrigation_facilities,
          farmer.current_crops, farmer.created_at, farmer.updated_at
        ]
      );
    }
    for (const row of sourceData.history) {
      await target.query(
        `insert into farming_history
         (id, farmer_id, crop, planting_date, harvest_date, notes, created_at, event_type, event_date, amount, unit)
         values ($1, $2, $3, $4, $5, $6, $7, $8, coalesce($9::date, current_date), null, '')`,
        [
          row.id, row.farmer_id, row.crop, row.planting_date, row.harvest_date, row.notes, row.created_at,
          row.harvest_date ? 'harvest' : row.planting_date ? 'sowing' : 'observation',
          row.harvest_date || row.planting_date || (row.created_at instanceof Date ? row.created_at.toISOString().slice(0, 10) : String(row.created_at).slice(0, 10))
        ]
      );
    }
    for (const row of sourceData.recommendations) {
      await target.query(
        `insert into saved_recommendations
         (id, farmer_id, recommendation_type, details, related_crop, sources, created_at)
         values ($1, $2, $3, $4, $5, $6, $7)`,
        [row.id, row.farmer_id, row.recommendation_type, row.details, row.related_crop, row.sources, row.created_at]
      );
    }

    const [users, farmers, history, recommendations] = await Promise.all([
      target.query('select count(*)::int as count from app_users'),
      target.query('select count(*)::int as count from farmers'),
      target.query('select count(*)::int as count from farming_history'),
      target.query('select count(*)::int as count from saved_recommendations')
    ]);
    const targetCounts = [users, farmers, history, recommendations].map(result => result.rows[0].count);
    const sourceCounts = [sourceData.users.length, sourceData.farmers.length, sourceData.history.length, sourceData.recommendations.length];
    if (targetCounts.some((count, index) => count !== sourceCounts[index])) {
      throw new Error(`Count validation failed. Source=${sourceCounts.join('/')}; target=${targetCounts.join('/')}.`);
    }
    const orphanProfiles = await target.query(`select count(*)::int as count from farmers f
      left join app_users u on u.id = f.id where u.id is null`);
    if (orphanProfiles.rows[0].count !== 0) throw new Error('Target validation failed: farmer profiles do not have matching accounts.');
    await target.query('commit');
    const resetRequired = sourceData.users.filter(user => !isBcryptHash(user.encrypted_password)).length;
    console.info(`Migrated users=${sourceCounts[0]}, farmers=${sourceCounts[1]}, history=${sourceCounts[2]}, recommendations=${sourceCounts[3]}; password recovery required for ${resetRequired} account(s).`);
  } catch (error) {
    await target.query('rollback');
    throw error;
  }
}

function validateSourceData(data) {
  const emailById = new Map(data.users.map(user => [user.id, user]));
  for (const farmer of data.farmers) {
    if (!emailById.has(farmer.id)) throw new Error(`Farmer ${farmer.id} has no matching email-based Supabase account. No target data was changed.`);
  }
  const farmerIds = new Set(data.farmers.map(farmer => farmer.id));
  for (const row of [...data.history, ...data.recommendations]) {
    if (!farmerIds.has(row.farmer_id)) throw new Error(`Record ${row.id} has no matching farmer profile. No target data was changed.`);
  }
}

function isBcryptHash(value) {
  if (typeof value !== 'string') return false;
  const match = /^\$2[ab]\$(\d{2})\$[./A-Za-z0-9]{53}$/.exec(value);
  return Boolean(match && Number(match[1]) >= 4 && Number(match[1]) <= 31);
}

function sslOptions(prefix, connectionString) {
  const insecure = process.env[`${prefix}_SSL_REJECT_UNAUTHORIZED`] === 'false';
  const sslSetting = process.env[`${prefix}_SSL`];
  const hostname = new URL(connectionString).hostname.toLowerCase();
  const neon = hostname === 'neon.tech' || hostname.endsWith('.neon.tech');
  const enabled = neon || sslSetting === 'true' || (sslSetting !== 'false' && process.env.NODE_ENV === 'production');
  return enabled ? { ssl: { rejectUnauthorized: !insecure } } : {};
}

const command = process.argv[2];
try {
  if (command === 'schema') await applyMigrations();
  else if (command === 'ping') await pingDatabase();
  else if (command === 'verify') await verifyDatabase();
  else if (command === 'data') await migrateData();
  else throw new Error('Usage: node server/scripts/migrate-database.js <ping|schema|verify|data>');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
