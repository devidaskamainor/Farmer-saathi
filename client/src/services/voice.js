const languageLocales = { en: 'en-IN', hi: 'hi-IN', kn: 'kn-IN' };
let speechRequestId = 0;

export function speechLocale(language) {
  return languageLocales[language] || languageLocales.en;
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

export async function speakText(text, language) {
  if (typeof window === 'undefined' || !window.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined') {
    return { ok: false, reason: 'unsupported' };
  }

  const requestId = ++speechRequestId;
  const synth = window.speechSynthesis;
  synth.cancel();
  const voice = await waitForVoice(language);
  if (requestId !== speechRequestId) return { ok: false, reason: 'cancelled' };
  if (!voice) return { ok: false, reason: 'voice-unavailable' };

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = speechLocale(language);
  utterance.voice = voice;
  try {
    synth.speak(utterance);
    return { ok: true };
  } catch {
    return { ok: false, reason: 'playback-failed' };
  }
}

export function stopSpeaking() {
  speechRequestId += 1;
  if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
}
