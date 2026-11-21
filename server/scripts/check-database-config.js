import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const envPath = resolve(projectRoot, '.env');
const examplePath = resolve(projectRoot, '.env.example');
const textFilePath = resolve(projectRoot, '.env.txt');

async function exists(path) {
  try {
    await readFile(path);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw new Error('Could not inspect an environment file.');
  }
}

function decodeEnvFile(buffer) {
  if (buffer[0] === 0xff && buffer[1] === 0xfe) {
    return { text: buffer.subarray(2).toString('utf16le'), encoding: 'UTF-16LE' };
  }
  if (buffer[0] === 0xfe && buffer[1] === 0xff) {
    const swapped = Buffer.from(buffer.subarray(2));
    for (let index = 0; index + 1 < swapped.length; index += 2) {
      const current = swapped[index];
      swapped[index] = swapped[index + 1];
      swapped[index + 1] = current;
    }
    return { text: swapped.toString('utf16le'), encoding: 'UTF-16BE' };
  }
  const hasUtf8Bom = buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
  return {
    text: new TextDecoder('utf-8', { fatal: true }).decode(buffer),
    encoding: hasUtf8Bom ? 'UTF-8 with BOM' : 'UTF-8'
  };
}

async function main() {
  const rootEnvExists = await exists(envPath);
  const exampleExists = await exists(examplePath);
  const textFileExists = await exists(textFilePath);
  console.log(`Repository-root .env exists: ${rootEnvExists ? 'yes' : 'no'}`);
  console.log(`Repository-root .env.example exists: ${exampleExists ? 'yes' : 'no'}`);
  console.log(`A .env.txt file exists: ${textFileExists ? 'yes (wrong filename)' : 'no'}`);

  if (!rootEnvExists) {
    console.log('DATABASE_URL defined: no');
    console.log('DATABASE_URL non-empty: no');
    console.log('PostgreSQL URL scheme: no');
    console.log('Hostname present: no');
    process.exitCode = 1;
    return;
  }

  let decoded;
  try {
    decoded = decodeEnvFile(await readFile(envPath));
  } catch {
    console.log('Could not parse root .env. Save it as UTF-8 or UTF-16 and check its formatting.');
    process.exitCode = 1;
    return;
  }
  const declarations = decoded.text.match(/^\s*(?:export\s+)?DATABASE_URL\s*=/gm) || [];
  const values = dotenv.parse(decoded.text);
  const value = typeof values.DATABASE_URL === 'string' ? values.DATABASE_URL.trim() : '';
  const defined = declarations.length > 0;
  const nonEmpty = value.length > 0;
  let postgresScheme = false;
  let hostnamePresent = false;

  if (nonEmpty) {
    try {
      const parsed = new URL(value);
      postgresScheme = ['postgres:', 'postgresql:'].includes(parsed.protocol.toLowerCase());
      hostnamePresent = Boolean(parsed.hostname);
      if (/[<>\s]/.test(parsed.hostname)) hostnamePresent = false;
    } catch {
      // Report invalid URL structure without printing any part of the value.
    }
  }

  console.log(`.env encoding: ${decoded.encoding}`);
  console.log(`DATABASE_URL defined: ${defined ? 'yes' : 'no'}`);
  console.log(`DATABASE_URL declarations: ${declarations.length}`);
  console.log(`DATABASE_URL non-empty: ${nonEmpty ? 'yes' : 'no'}`);
  console.log(`PostgreSQL URL scheme: ${postgresScheme ? 'yes' : 'no'}`);
  console.log(`Hostname present: ${hostnamePresent ? 'yes' : 'no'}`);

  if (!defined || declarations.length !== 1 || !nonEmpty || !postgresScheme || !hostnamePresent) {
    process.exitCode = 1;
  }
}

main().catch(() => {
  console.error('Database configuration diagnostic failed without displaying configuration values.');
  process.exitCode = 1;
});
