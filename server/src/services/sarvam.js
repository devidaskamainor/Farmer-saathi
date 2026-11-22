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

export function splitTextIntoSpeechChunks(text, maxChunkLen = 1200) {
  const str = String(text || '').trim();
  if (str.length <= maxChunkLen) return [str];

  const chunks = [];
  let remaining = str;

  while (remaining.length > 0) {
    if (remaining.length <= maxChunkLen) {
      chunks.push(remaining);
      break;
    }

    let splitIdx = -1;
    const searchSlice = remaining.slice(0, maxChunkLen);
    const sentenceMatch = searchSlice.match(/.*[.?!।\n]\s+/s);
    if (sentenceMatch && sentenceMatch[0].length >= maxChunkLen * 0.3) {
      splitIdx = sentenceMatch[0].length;
    } else {
      const lastSpace = searchSlice.lastIndexOf(' ');
      if (lastSpace >= maxChunkLen * 0.3) {
        splitIdx = lastSpace + 1;
      } else {
        splitIdx = maxChunkLen;
      }
    }

    const chunk = remaining.slice(0, splitIdx).trim();
    if (chunk) chunks.push(chunk);
    remaining = remaining.slice(splitIdx).trim();
  }

  return chunks;
}

export function concatenateWavBuffers(buffers) {
  const valid = buffers.filter(b => Buffer.isBuffer(b) && b.length > 0);
  if (!valid.length) return Buffer.alloc(0);
  if (valid.length === 1) return valid[0];

  const allHaveWavHeader = valid.every(b => b.length >= 44 && b.subarray(0, 4).toString() === 'RIFF');
  if (!allHaveWavHeader) {
    return Buffer.concat(valid);
  }

  const firstHeader = Buffer.from(valid[0].subarray(0, 44));
  const pcmChunks = valid.map(b => b.subarray(44));
  const totalPcmLength = pcmChunks.reduce((acc, c) => acc + c.length, 0);

  const combined = Buffer.alloc(44 + totalPcmLength);
  firstHeader.copy(combined, 0);
  combined.writeUInt32LE(36 + totalPcmLength, 4);
  combined.writeUInt32LE(totalPcmLength, 40);

  let offset = 44;
  for (const chunk of pcmChunks) {
    chunk.copy(combined, offset);
    offset += chunk.length;
  }

  return combined;
}

async function synthesizeSingleChunk(chunkText, voice, apiKey) {
  const result = await requestJson(textToSpeechEndpoint, {
    method: 'POST',
    headers: { 'api-subscription-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: chunkText,
      language_code: voice.languageCode,
      model: voice.model,
      speaker: voice.speaker,
      output_audio_codec: 'wav'
    })
  }, 'Spoken playback is temporarily unavailable.');

  const encodedAudio = result?.audios?.[0];
  if (typeof encodedAudio !== 'string' || !encodedAudio ||
      encodedAudio.length > maximumAudioResponseBytes * 4 / 3) {
    throw new HttpError(502, 'The speech service returned invalid audio. Please try again.');
  }
  let audio;
  try {
    audio = Buffer.from(encodedAudio, 'base64');
  } catch {
    throw new HttpError(502, 'The speech service returned invalid audio. Please try again.');
  }
  if (!audio.length || audio.length > maximumAudioResponseBytes) {
    throw new HttpError(502, 'The speech service returned invalid audio. Please try again.');
  }
  return audio;
}

export async function synthesizeSpeech(text, voice) {
  const apiKey = getApiKey();
  const chunks = splitTextIntoSpeechChunks(text, 500);

  if (chunks.length <= 1) {
    return synthesizeSingleChunk(chunks[0] || text, voice, apiKey);
  }

  // Synthesize chunks in parallel for immediate, low-latency audio response
  const buffers = await Promise.all(
    chunks.map(chunk => synthesizeSingleChunk(chunk, voice, apiKey))
  );
  return concatenateWavBuffers(buffers);
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
