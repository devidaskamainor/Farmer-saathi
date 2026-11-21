import { SarvamAIClient } from 'sarvamai';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

process.loadEnvFile(resolve(dirname(fileURLToPath(import.meta.url)), '../.env'));

const apiKey = process.env.SARVAM_API_KEY?.trim();
if (!apiKey) {
  console.error('Add your SARVAM_API_KEY to the repository-root .env, then run this script again.');
  process.exitCode = 1;
} else {
  try {
    const client = new SarvamAIClient({ apiSubscriptionKey: apiKey });
    const response = await client.chat.completions({
      model: 'sarvam-105b-conversations',
      messages: [{ role: 'user', content: 'Say hello to a farmer in one short sentence.' }],
      max_tokens: 100
    });
    const reply = response.choices?.[0]?.message?.content;
    if (typeof reply !== 'string' || !reply.trim()) throw new Error('Empty response');
    console.log(reply);
  } catch (error) {
    const status = Number.isInteger(error?.statusCode) ? ` (HTTP ${error.statusCode})` : '';
    console.error(`Sarvam request failed${status}.`);
    process.exitCode = 1;
  }
}
