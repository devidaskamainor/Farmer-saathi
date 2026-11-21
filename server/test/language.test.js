import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { getLanguageDefinition, languageConfig, supportedLanguageCodes } from '../src/config/languages.js';
import { profileUpdates, updateFarmerProfile, validatePreferredLanguage } from '../src/services/farmerProfiles.js';
import { askGroq, localizeAssistantText } from '../src/services/groq.js';

test('language catalog includes English and all 22 scheduled Indian languages', () => {
  assert.equal(supportedLanguageCodes.length, 23);
  assert.deepEqual(
    ['as', 'bn', 'brx', 'doi', 'gu', 'hi', 'kn', 'ks', 'kok', 'mai', 'ml', 'mni', 'mr', 'ne', 'or', 'pa', 'sa', 'sat', 'sd', 'ta', 'te', 'ur']
      .filter(code => supportedLanguageCodes.includes(code)).length,
    22
  );
  assert.equal(languageConfig.kn.nativeName, 'ಕನ್ನಡ');
  assert.equal(languageConfig.kn.locale, 'kn-IN');
  assert.equal(languageConfig.mr.locale, 'mr-IN');
  assert.equal(languageConfig.mr.sarvamSttLocale, 'mr-IN');
  assert.equal(languageConfig.mr.sarvamTts.languageCode, 'mr-IN');
  assert.equal(languageConfig.ur.direction, 'rtl');
  assert.equal(getLanguageDefinition('not-supported').englishName, 'English');
  assert.equal(languageConfig.as.interfaceSupport, 'english-fallback');
});

test('database migration allows exactly every shared language code', async () => {
  const migration = await readFile(new URL('../../database/migrations/006_preferred_language_codes.sql', import.meta.url), 'utf8');
  const check = migration.match(/check\s*\(preferred_language\s+in\s*\(([\s\S]*?)\)\)/i);
  assert.ok(check, 'migration must define the preferred-language check');
  const migrationCodes = [...check[1].matchAll(/'([a-z]+)'/g)].map(([, code]) => code).sort();
  assert.deepEqual(migrationCodes, [...supportedLanguageCodes].sort());
});

test('preferred-language changes map to the existing PostgreSQL profile column', () => {
  assert.deepEqual(profileUpdates({ preferredLanguage: 'ta' }), [
    { column: 'preferred_language', value: 'ta' }
  ]);
});

test('Marathi is accepted and saved through the profile update service', async () => {
  const language = validatePreferredLanguage('mr');
  const db = {
    async query(sql, values) {
      assert.match(sql, /update farmers set preferred_language = \$1/);
      assert.equal(values[0], language);
      return { rows: [{ id: 'farmer-1', preferred_language: values[0] }] };
    }
  };
  const farmer = await updateFarmerProfile(db, 'farmer-1', profileUpdates({ preferredLanguage: language }));
  assert.equal(farmer.preferredLanguage, 'mr');
});

test('unsupported profile languages fail validation before any database update', async () => {
  let databaseCalled = false;
  assert.throws(() => validatePreferredLanguage('xx'), {
    status: 400,
    message: 'Choose a language from the supported list.'
  });
  const db = { async query() { databaseCalled = true; return { rows: [] }; } };
  assert.equal(databaseCalled, false);
  assert.equal(validatePreferredLanguage('en'), 'en');
});

test('AI request names the selected language and retries once when the response uses another script', async () => {
  const previousKey = process.env.GROQ_API_KEY;
  const previousFetch = globalThis.fetch;
  const requestBodies = [];
  process.env.GROQ_API_KEY = 'test-key';
  globalThis.fetch = async (_url, options) => {
    requestBodies.push(JSON.parse(options.body));
    const answer = requestBodies.length === 1 ? 'Water the crop early in the morning.' : 'ಬೆಳಿಗ್ಗೆ ಬೇಗ ಬೆಳೆಗಳಿಗೆ ನೀರು ಹಾಕಿ.';
    return new Response(JSON.stringify({ choices: [{ message: { content: answer } }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  };
  try {
    const result = await askGroq({
      farmer: { preferredLanguage: 'kn', name: 'Ravi', soil: {}, currentCrops: [] },
      task: 'Irrigation guidance',
      prompt: 'When should I water tomato?'
    });

    assert.equal(requestBodies.length, 2);
    assert.match(requestBodies[0].messages[0].content, /Kannada \(ಕನ್ನಡ\)/);
    assert.match(requestBodies[1].messages.at(-1).content, /Rewrite your previous answer in Kannada/);
    assert.match(result.answer, /ಬೆಳಿಗ್ಗೆ/);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = previousKey;
  }
});

test('canned assistant messages are localized through the configured AI for newly added languages', async () => {
  const previousKey = process.env.GROQ_API_KEY;
  const previousFetch = globalThis.fetch;
  let requestBody;
  process.env.GROQ_API_KEY = 'test-key';
  globalThis.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return new Response(JSON.stringify({ choices: [{ message: { content: 'আপোনাৰ গাঁও বা জিলাৰ নাম কওক।' } }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  };
  try {
    const result = await localizeAssistantText(
      { preferredLanguage: 'as', name: 'Ravi', soil: {}, currentCrops: [] },
      'Which village or district should I use?'
    );
    assert.match(requestBody.messages[0].content, /Assamese \(অসমীয়া\)/);
    assert.match(requestBody.messages[1].content, /Translate the following assistant message/);
    assert.equal(result, 'আপোনাৰ গাঁও বা জিলাৰ নাম কওক।');
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = previousKey;
  }
});

test('AI response is rejected when the one language correction attempt still uses the wrong script', async () => {
  const previousKey = process.env.GROQ_API_KEY;
  const previousFetch = globalThis.fetch;
  let requestCount = 0;
  process.env.GROQ_API_KEY = 'test-key';
  globalThis.fetch = async () => {
    requestCount += 1;
    return new Response(JSON.stringify({ choices: [{ message: { content: 'Please water the crop.' } }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  };
  try {
    await assert.rejects(askGroq({
      farmer: { preferredLanguage: 'kn', name: 'Ravi', soil: {}, currentCrops: [] },
      task: 'Irrigation guidance',
      prompt: 'When should I water tomato?'
    }), { status: 502, message: /could not answer in ಕನ್ನಡ/ });
    assert.equal(requestCount, 2);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = previousKey;
  }
});
