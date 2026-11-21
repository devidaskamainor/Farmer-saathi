import { getLanguageDefinition } from '../config/languages.js';
import { HttpError } from '../utils/http.js';

const speechToTextEndpoint = 'https://api.sarvam.ai/speech-to-text';
const textToSpeechEndpoint = 'https://api.sarvam.ai/text-to-speech';
const requestTimeoutMs = 45_000;
const maximumAudioResponseBytes = 15 * 1024 * 1024;

export async function transcribeAudio({ buffer, mimetype, filename, language }) {
  const apiKey = getApiKey();
  const languageConfig = getLanguageDefinition(language);
  const form = new FormData();
  form.set('file', new Blob([buffer], { type: mimetype }), filename);
  form.set('model', 'saaras:v4');
  form.set('mode', 'transcribe');
  form.set('language_code', languageConfig.sarvamSttLocale);

  const result = await requestJson(speechToTextEndpoint, {
    method: 'POST',
    headers: { 'api-subscription-key': apiKey },
    body: form
  }, 'Speech transcription is temporarily unavailable.');
  const transcript = typeof result?.transcript === 'string' ? result.transcript.trim() : '';
  if (!transcript) throw new HttpError(502, 'No speech could be recognized. Please try again or type your question.');

  return {
    transcript: transcript.slice(0, 4000),
    languageCode: typeof result.language_code === 'string' ? result.language_code : null,
    languageProbability: Number.isFinite(result.language_probability) ? result.language_probability : null
  };
}

export async function synthesizeSpeech(text, voice) {
  const apiKey = getApiKey();
  const result = await requestJson(textToSpeechEndpoint, {
    method: 'POST',
    headers: { 'api-subscription-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      language_code: voice.languageCode,
      model: voice.model,
      speaker: voice.speaker,
      output_audio_codec: 'wav'
    })
  }, 'Spoken playback is temporarily unavailable.');

  const encodedAudio = result?.audios?.[0];
  if (typeof encodedAudio !== 'string' || !encodedAudio ||
      encodedAudio.length > maximumAudioResponseBytes * 4 / 3 ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encodedAudio)) {
    throw new HttpError(502, 'The speech service returned invalid audio. Please try again.');
  }
  const audio = Buffer.from(encodedAudio, 'base64');
  if (!audio.length || audio.length > maximumAudioResponseBytes) {
    throw new HttpError(502, 'The speech service returned invalid audio. Please try again.');
  }
  return audio;
}

function getApiKey() {
  const apiKey = process.env.SARVAM_API_KEY?.trim();
  if (!apiKey) throw new HttpError(503, 'Voice services are not configured. Add SARVAM_API_KEY on the server.');
  return apiKey;
}

async function requestJson(url, options, unavailableMessage) {
  let response;
  try {
    response = await fetch(url, { ...options, signal: AbortSignal.timeout(requestTimeoutMs) });
  } catch (error) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      throw new HttpError(504, 'The speech service took too long to respond. Please try again.');
    }
    throw new HttpError(502, unavailableMessage);
  }

  if (!response.ok) {
    if (response.status === 429) throw new HttpError(503, 'The speech service is busy. Please wait a moment and try again.');
    if (response.status === 400) throw new HttpError(422, 'The audio or text could not be processed. Please check it and try again.');
    throw new HttpError(502, unavailableMessage);
  }

  try {
    return await response.json();
  } catch {
    throw new HttpError(502, 'The speech service returned an invalid response. Please try again.');
  }
}
