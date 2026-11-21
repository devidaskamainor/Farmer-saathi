import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const envPath = resolve(projectRoot, '.env');
let contents;

try {
  contents = readFileSync(envPath);
} catch (error) {
  if (error.code !== 'ENOENT') {
    throw new Error(`Could not read the repository-root .env file (${error.code || 'file error'}).`, { cause: error });
  }
}

if (contents) {
  const parsed = dotenv.parse(decodeEnvFile(contents));
  for (const [key, value] of Object.entries(parsed)) {
    if (!process.env[key]?.trim()) process.env[key] = value;
  }
}

function decodeEnvFile(contents) {
  if (contents[0] === 0xff && contents[1] === 0xfe) {
    return contents.subarray(2).toString('utf16le');
  }
  if (contents[0] === 0xfe && contents[1] === 0xff) {
    const swapped = Buffer.from(contents.subarray(2));
    for (let index = 0; index + 1 < swapped.length; index += 2) {
      const current = swapped[index];
      swapped[index] = swapped[index + 1];
      swapped[index + 1] = current;
    }
    return swapped.toString('utf16le');
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(contents);
}
