import { cleanSpeechText, detectSpeechLanguage, languageConfig } from '../config/languages.js';
import { api } from './api.js';

let speechRequestId = 0;
let activeAudioElement = null;
let activeAudioUrl = null;
let globalAudioCtx = null;
let currentSourceNode = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!globalAudioCtx || globalAudioCtx.state === 'closed') {
    globalAudioCtx = new AudioContextClass();
  }
  return globalAudioCtx;
}

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
    timeoutId = window.setTimeout(() => finish(findVoice(language)), 800);
  });
}

export function stopSpeaking() {
  speechRequestId += 1;

  if (currentSourceNode) {
    try {
      currentSourceNode.stop();
      currentSourceNode.disconnect();
    } catch {}
    currentSourceNode = null;
  }

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
  const cleanText = cleanSpeechText(text);
  if (!cleanText) return { ok: false, reason: 'empty' };

  stopSpeaking();
  const requestId = ++speechRequestId;
  const targetLanguage = detectSpeechLanguage(cleanText, language);

  // Eagerly unlock AudioContext during the user's click gesture
  const audioCtx = getAudioContext();
  if (audioCtx && audioCtx.state === 'suspended') {
    try { await audioCtx.resume(); } catch {}
  }

  // 1. First prioritize Sarvam AI server TTS for natural Indic speech (Kannada, Hindi, etc.)
  const langDef = languageConfig[targetLanguage] || languageConfig[language];
  if (langDef?.sarvamTts) {
    try {
      const response = await api.post('/voice/speak', {
        text: cleanText,
        language: targetLanguage
      }, {
        responseType: 'arraybuffer',
        timeout: 45000
      });

      if (requestId !== speechRequestId) return { ok: false, reason: 'cancelled' };

      const arrayBuffer = response.data;
      if (arrayBuffer && arrayBuffer.byteLength > 44) {
        // High fidelity playback via AudioContext
        if (audioCtx && typeof audioCtx.decodeAudioData === 'function') {
          try {
            if (audioCtx.state === 'suspended') {
              await audioCtx.resume();
            }
            const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
            if (requestId !== speechRequestId) return { ok: false, reason: 'cancelled' };

            const source = audioCtx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioCtx.destination);
            currentSourceNode = source;

            await new Promise((resolve, reject) => {
              source.onended = () => {
                if (currentSourceNode === source) currentSourceNode = null;
                resolve();
              };
              try { source.start(0); } catch (startErr) { reject(startErr); }
            });

            return { ok: true, source: 'sarvam' };
          } catch (ctxErr) {
            console.warn('AudioContext playback fallback to HTML5 Audio:', ctxErr?.message);
          }
        }

        // HTML5 Audio fallback for WAV or MP3 buffer
        const isWav = new Uint8Array(arrayBuffer.slice(0, 4)).reduce((acc, b) => acc + String.fromCharCode(b), '') === 'RIFF';
        const mimeType = isWav ? 'audio/wav' : 'audio/mpeg';
        const audioBlob = new Blob([arrayBuffer], { type: mimeType });
        const audioUrl = URL.createObjectURL(audioBlob);
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
        return { ok: true, source: 'server' };
      }
    } catch (err) {
      if (requestId !== speechRequestId) return { ok: false, reason: 'cancelled' };
      console.warn('Server voice playback unavailable, trying direct Indic audio synthesis:', err?.message);
    }
  }

  // 2. Direct client-side Indic audio fallback
  const shortLang = (targetLanguage || language || 'kn').split('-')[0].toLowerCase();
  try {
    const sentenceChunks = cleanText.length <= 180 ? [cleanText] : (cleanText.match(/[^.?!।\n]+[.?!।\n]+|[^.?!।\n]+$/g) || [cleanText]);
    let playedDirect = false;
    for (const chunk of sentenceChunks) {
      if (requestId !== speechRequestId) return { ok: false, reason: 'cancelled' };
      const trimmed = chunk.trim();
      if (!trimmed) continue;
      const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(trimmed)}&tl=${encodeURIComponent(shortLang)}&client=tw-ob`;
      const audio = new Audio(ttsUrl);
      activeAudioElement = audio;
      await new Promise((resolve, reject) => {
        audio.onended = () => resolve();
        audio.onerror = () => reject(new Error('Audio load failed'));
        audio.play().catch(reject);
      });
      playedDirect = true;
    }
    if (playedDirect) return { ok: true, source: 'indic-tts' };
  } catch (indicErr) {
    console.warn('Direct Indic TTS unavailable, trying browser speech synthesis:', indicErr?.message);
  }

  // 3. Fall back to local browser window.speechSynthesis
  if (typeof window !== 'undefined' && window.speechSynthesis && typeof SpeechSynthesisUtterance !== 'undefined') {
    const synth = window.speechSynthesis;
    const voice = await waitForVoice(targetLanguage);
    if (requestId !== speechRequestId) return { ok: false, reason: 'cancelled' };

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = speechLocale(targetLanguage);
    if (voice) {
      utterance.voice = voice;
    }

    try {
      synth.cancel();
      await new Promise((resolve, reject) => {
        utterance.onend = () => resolve();
        utterance.onerror = e => {
          if (e.error === 'canceled' || e.error === 'interrupted') resolve();
          else reject(e);
        };
        synth.speak(utterance);
      });
      return { ok: true, source: 'browser' };
    } catch {}
  }

  return { ok: true, source: 'fallback' };
}
