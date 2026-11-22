import { useState, useEffect, useRef } from 'react';
import {
  Leaf, ShieldCheck, LoaderCircle, ArrowRight, Volume2, Square, Languages
} from 'lucide-react';
import { api, errorMessage } from '../../services/api.js';
import { speakText, stopSpeaking } from '../../services/voice.js';
import { detectSpeechLanguage, getLanguageDefinition } from '../../config/languages.js';
import useFarm from '../../hooks/useFarm.js';
import Card from '../common/Card.jsx';
import ErrorNotice from '../common/ErrorNotice.jsx';
import MetaLine from '../common/MetaLine.jsx';

export function AdviceResult({ result, title = 'Saathi’s guidance' }) {
  const { farmer } = useFarm();
  const [playing, setPlaying] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [displayedText, setDisplayedText] = useState(result?.answer || '');
  const [translatedLang, setTranslatedLang] = useState('');
  const [voiceNotice, setVoiceNotice] = useState('');
  const preferredLang = farmer?.preferredLanguage || 'en';
  const langDef = getLanguageDefinition(preferredLang);
  const playbackRef = useRef(0);

  useEffect(() => {
    setDisplayedText(result?.answer || '');
    setTranslatedLang('');
    setVoiceNotice('');
    stopSpeaking();
    setPlaying(false);
  }, [result]);

  useEffect(() => {
    return () => {
      playbackRef.current += 1;
      stopSpeaking();
    };
  }, []);

  async function handleToggleVoice() {
    if (playing) {
      playbackRef.current += 1;
      stopSpeaking();
      setPlaying(false);
      return;
    }

    const currentReq = ++playbackRef.current;
    setVoiceNotice('');
    let textToSpeak = displayedText;
    let targetLang = translatedLang || detectSpeechLanguage(textToSpeak, preferredLang);

    // If guidance is currently in English and user prefers a regional language (e.g. Kannada, Hindi),
    // automatically translate before speaking so the farmer hears the guidance in their regional language!
    if (preferredLang !== 'en' && (!translatedLang || translatedLang === 'en') && detectSpeechLanguage(textToSpeak, 'en') === 'en') {
      setTranslating(true);
      try {
        const { data } = await api.post('/ai/translate', {
          text: textToSpeak,
          targetLanguage: preferredLang
        });
        if (data?.translatedText) {
          textToSpeak = data.translatedText;
          targetLang = preferredLang;
          setDisplayedText(textToSpeak);
          setTranslatedLang(preferredLang);
        }
      } catch (err) {
        console.warn('Translation failed, speaking original text:', err?.message);
      } finally {
        setTranslating(false);
      }
    }

    if (currentReq !== playbackRef.current) return;
    setPlaying(true);
    try {
      const res = await speakText(textToSpeak, targetLang);
      if (currentReq !== playbackRef.current) return;
      if (!res.ok && res.reason === 'voice-unavailable') {
        setVoiceNotice(`Spoken playback is not installed on this device for ${targetLang}. Text is displayed above.`);
      }
    } catch (err) {
      console.warn('Speech playback error:', err?.message);
    } finally {
      if (currentReq === playbackRef.current) {
        setPlaying(false);
      }
    }
  }

  async function handleTranslateClick() {
    if (translating) return;
    stopSpeaking();
    setPlaying(false);
    setVoiceNotice('');
    setTranslating(true);
    try {
      const { data } = await api.post('/ai/translate', {
        text: result.answer,
        targetLanguage: preferredLang
      });
      if (data?.translatedText) {
        setDisplayedText(data.translatedText);
        setTranslatedLang(preferredLang);
        // Automatically start speaking the translated advice
        const currentReq = ++playbackRef.current;
        setPlaying(true);
        try {
          await speakText(data.translatedText, preferredLang);
        } finally {
          if (currentReq === playbackRef.current) setPlaying(false);
        }
      }
    } catch (err) {
      console.warn('Translation failed:', err?.message);
    } finally {
      setTranslating(false);
    }
  }

  if (!result) return null;

  return (
    <Card className="result-card">
      <div className="result-head">
        <span className="result-icon"><Leaf size={18} /></span>
        <div>
          <span className="eyebrow">AI-GENERATED GUIDANCE</span>
          <h3>{title}</h3>
        </div>
        <span className="ai-pill">{result.source}</span>
      </div>

      {/* Voice & Translation Toolbar */}
      <div className="advice-voice-bar">
        <button
          type="button"
          className={`primary-button voice-action-btn ${playing ? 'active' : ''}`}
          onClick={handleToggleVoice}
          disabled={translating}
          title={playing ? 'Stop speaking' : 'Listen to guidance in your language'}
        >
          {translating ? <LoaderCircle size={15} className="spin" /> : playing ? <Square size={15} /> : <Volume2 size={15} />}
          <span>
            {translating
              ? 'Translating…'
              : playing
                ? (preferredLang === 'kn' ? 'ಮಾತು ನಿಲ್ಲಿಸಿ' : preferredLang === 'hi' ? 'बोलना बंद करें' : 'Stop speaking')
                : (preferredLang === 'kn' ? 'ಧ್ವನಿಯಲ್ಲಿ ಕೇಳಿ' : preferredLang === 'hi' ? 'आवाज़ में सुनें' : 'Listen')}
          </span>
        </button>

        {preferredLang !== 'en' && translatedLang !== preferredLang && (
          <button
            type="button"
            className="secondary-button voice-action-btn"
            onClick={handleTranslateClick}
            disabled={translating || playing}
            title={`Translate to ${langDef?.nativeName || 'Regional'}`}
          >
            {translating ? <LoaderCircle size={14} className="spin" /> : <Languages size={14} />}
            <span>
              {preferredLang === 'kn'
                ? 'ಕನ್ನಡಕ್ಕೆ ಅನುವಾದಿಸಿ'
                : preferredLang === 'hi'
                  ? 'हिंदी में अनुवाद करें'
                  : `Translate to ${langDef?.nativeName || 'Regional'}`}
            </span>
          </button>
        )}
      </div>

      {voiceNotice && (
        <div className="alert alert-soft" style={{ fontSize: '11px', margin: '4px 0 10px' }}>
          {voiceNotice}
        </div>
      )}

      <div className="answer-text" style={{ whiteSpace: 'pre-wrap' }}>{displayedText}</div>

      <div className="result-disclaimer">
        <ShieldCheck size={15} />
        General guidance can be incomplete. Check local conditions and consult an agriculture expert for important decisions.
      </div>
      <MetaLine source={result.source} time={result.generatedAt} />
    </Card>
  );
}

export function AdviceForm({ endpoint, submitLabel, title, children, buildBody, requireFile = false }) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post(
        endpoint,
        buildBody(event.currentTarget),
        requireFile ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined
      );
      setResult(data);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Card className="form-card">
        <form onSubmit={submit} className="form-stack">
          {children}
          {error && <ErrorNotice>{error}</ErrorNotice>}
          <button disabled={loading} className="primary-button form-submit">
            {loading ? <LoaderCircle className="spin" size={17} /> : null}
            {submitLabel}
            <ArrowRight size={17} />
          </button>
        </form>
      </Card>
      {result && <AdviceResult result={result} title={title} />}
    </>
  );
}
