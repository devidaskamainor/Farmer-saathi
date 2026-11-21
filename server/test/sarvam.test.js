import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { getLanguageDefinition } from '../src/config/languages.js';
import { synthesizeSpeech, transcribeAudio } from '../src/services/sarvam.js';

const originalApiKey = process.env.SARVAM_API_KEY;
const originalFetch = globalThis.fetch;

afterEach(() => {
  if (originalApiKey === undefined) delete process.env.SARVAM_API_KEY;
  else process.env.SARVAM_API_KEY = originalApiKey;
  globalThis.fetch = originalFetch;
});

test('transcribes audio with Saaras v4 and the selected Sarvam locale', async () => {
  process.env.SARVAM_API_KEY = 'test-key';
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => ({ transcript: 'ಮಳೆಯಾಗಿದೆ', language_code: 'kn-IN', language_probability: 0.99 }) };
  };

  const result = await transcribeAudio({
    buffer: Buffer.from('audio bytes'),
    mimetype: 'audio/webm',
    filename: 'recording.webm',
    language: 'kn'
  });

  assert.equal(request.url, 'https://api.sarvam.ai/speech-to-text');
  assert.equal(request.options.headers['api-subscription-key'], 'test-key');
  assert.equal(request.options.body.get('model'), 'saaras:v4');
  assert.equal(request.options.body.get('mode'), 'transcribe');
  assert.equal(request.options.body.get('language_code'), 'kn-IN');
  assert.equal(request.options.body.get('file').type, 'audio/webm');
  assert.deepEqual(result, { transcript: 'ಮಳೆಯಾಗಿದೆ', languageCode: 'kn-IN', languageProbability: 0.99 });
});

test('uses Sarvam-specific Kashmiri and Odia recognition locales', async () => {
  process.env.SARVAM_API_KEY = 'test-key';
  const requestedLocales = [];
  globalThis.fetch = async (_url, options) => {
    requestedLocales.push(options.body.get('language_code'));
    return { ok: true, json: async () => ({ transcript: 'recognized words' }) };
  };

  for (const language of ['ks', 'or']) {
    await transcribeAudio({
      buffer: Buffer.from('audio bytes'),
      mimetype: 'audio/webm',
      filename: 'recording.webm',
      language
    });
  }

  assert.deepEqual(requestedLocales, ['ks-IN', 'od-IN']);
});

test('keeps Bulbul voice selection language-specific and returns WAV audio', async () => {
  process.env.SARVAM_API_KEY = 'test-key';
  let requestBody;
  globalThis.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return { ok: true, json: async () => ({ audios: [Buffer.from('RIFF-audio').toString('base64')] }) };
  };

  const audio = await synthesizeSpeech('Hello farmer', getLanguageDefinition('en').sarvamTts);

  assert.equal(requestBody.language_code, 'en-IN');
  assert.equal(requestBody.model, 'bulbul:v4-flash');
  assert.equal(requestBody.speaker, 'shubh_en_narration');
  assert.equal(requestBody.output_audio_codec, 'wav');
  assert.equal(audio.toString(), 'RIFF-audio');
  assert.equal(getLanguageDefinition('ml').sarvamTts.model, 'bulbul:v3');
  assert.equal(getLanguageDefinition('or').sarvamTts.model, 'bulbul:v3');
  assert.equal(getLanguageDefinition('ks').sarvamTts, null);
});

test('does not make provider requests when the Sarvam key is missing', async () => {
  delete process.env.SARVAM_API_KEY;
  let requestMade = false;
  globalThis.fetch = async () => { requestMade = true; };

  await assert.rejects(
    transcribeAudio({ buffer: Buffer.from('audio'), mimetype: 'audio/webm', filename: 'recording.webm', language: 'en' }),
    error => error.status === 503 && /SARVAM_API_KEY/.test(error.message)
  );
  assert.equal(requestMade, false);
});

test('maps provider failures to safe generic errors', async () => {
  process.env.SARVAM_API_KEY = 'test-key';
  globalThis.fetch = async () => ({ ok: false, status: 403, json: async () => ({ message: 'do not expose provider details' }) });

  await assert.rejects(
    transcribeAudio({ buffer: Buffer.from('audio'), mimetype: 'audio/webm', filename: 'recording.webm', language: 'en' }),
    error => error.status === 502 && !error.message.includes('provider details')
  );
});
