import { languageConfig } from '../config/languages.js';
import { api } from './api.js';

let speechRequestId = 0;
let activeAudioElement = null;
let activeAudioUrl = null;

export function speechLocale(language) {
  return languageConfig[language]?.locale || languageConfig.en.locale;
}

export function createSpeechRecognition(language) {
  if (typeof window === 'undefined') return null;
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return null;
  const recognition = new SpeechRecognition();
  recognition.lang = speechLocale(language);
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  return recognition;
}

function findVoice(language) {
  const synth = window.speechSynthesis;
  if (!synth) return null;
  const locale = speechLocale(language).toLowerCase();
  const languageTag = locale.split('-')[0];
  const voices = synth.getVoices();
  const tag = voice => (voice.lang || '').toLowerCase().replace('_', '-');
  return voices.find(voice => tag(voice) === locale)
    || voices.find(voice => tag(voice).split('-')[0] === languageTag)
    || null;
}

function waitForVoice(language) {
  const synth = window.speechSynthesis;
  if (!synth) return Promise.resolve(null);
  const current = findVoice(language);
  if (current) return Promise.resolve(current);

  return new Promise(resolve => {
    let timeoutId;
    const onVoicesChanged = () => {
      const voice = findVoice(language);
      if (voice) finish(voice);
    };
    const finish = voice => {
      window.clearTimeout(timeoutId);
      synth.removeEventListener?.('voiceschanged', onVoicesChanged);
      resolve(voice);
    };
    synth.addEventListener?.('voiceschanged', onVoicesChanged);
    timeoutId = window.setTimeout(() => finish(findVoice(language)), 1200);
  });
}

export function stopSpeaking() {
  speechRequestId += 1;
  if (activeAudioElement) {
    try {
      activeAudioElement.pause();
      activeAudioElement.currentTime = 0;
    } catch {}
    activeAudioElement = null;
  }
  if (activeAudioUrl) {
    try { URL.revokeObjectURL(activeAudioUrl); } catch {}
    activeAudioUrl = null;
  }
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    try { window.speechSynthesis.cancel(); } catch {}
  }
}

export async function speakText(text, language) {
  const cleanText = String(text || '').trim();
  if (!cleanText) return { ok: false, reason: 'empty' };

  stopSpeaking();
  const requestId = ++speechRequestId;

  // 1. First prioritize Sarvam AI server TTS for natural Indic speech (Kannada, Hindi, etc.)
  const langDef = languageConfig[language];
  if (langDef?.sarvamTts) {
    try {
      const response = await api.post('/voice/speak', {
        text: cleanText.slice(0, 2500),
        language
      }, {
        responseType: 'blob',
        timeout: 25000
      });

      if (requestId !== speechRequestId) return { ok: false, reason: 'cancelled' };

      if (response.data && response.data.size > 0) {
        const audioUrl = URL.createObjectURL(response.data);
        activeAudioUrl = audioUrl;
        const audio = new Audio(audioUrl);
        activeAudioElement = audio;

        await new Promise((resolve, reject) => {
          audio.onended = () => resolve();
          audio.onerror = e => reject(e);
          audio.play().catch(reject);
        });

        if (activeAudioUrl === audioUrl) {
          URL.revokeObjectURL(audioUrl);
          activeAudioUrl = null;
          activeAudioElement = null;
        }
        return { ok: true, source: 'sarvam' };
      }
    } catch (err) {
      if (requestId !== speechRequestId) return { ok: false, reason: 'cancelled' };
      console.warn('Sarvam voice playback unavailable, trying device speech synthesis:', err?.message);
    }
  }

  // 2. Fall back to local browser window.speechSynthesis if supported and available
  if (typeof window === 'undefined' || !window.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined') {
    return { ok: false, reason: 'unsupported' };
  }

  const synth = window.speechSynthesis;
  const voice = await waitForVoice(language);
  if (requestId !== speechRequestId) return { ok: false, reason: 'cancelled' };
  if (!voice) return { ok: false, reason: 'voice-unavailable' };

  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.lang = speechLocale(language);
  utterance.voice = voice;
  try {
    synth.speak(utterance);
    return { ok: true, source: 'browser' };
  } catch {
    return { ok: false, reason: 'playback-failed' };
  }
}
