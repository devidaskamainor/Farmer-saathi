import { useState, useEffect, useRef } from 'react';
import {
  MessageCircle, ChevronDown, Globe2, Volume2, Mic, MicOff, Send, ShieldCheck
} from 'lucide-react';
import { createSpeechRecognition, speakText, stopSpeaking } from '../../services/voice.js';
import { languageOptions, supportedLanguageCodes } from '../../config/languages.js';
import { authHelpContent } from '../../config/authTranslations.js';
import { localizedCopy, supportedLanguages } from '../../services/languageStorage.js';

export function getAuthHelpTopic(question) {
  const text = question.toLocaleLowerCase();
  if (/forgot|reset|password|पासवर्ड|मरेत|ಪಾಸ್.?ವರ್ಡ್|ಮರೆತ/.test(text)) return 'password';
  if (/register|sign.?up|create account|new account|रजिस्टर|खाता|पंजीकरण|ನೋಂದಣಿ|ಖಾತೆ/.test(text)) return 'register';
  if (/email|confirm|verification|ईमेल|पुष्टि|ದೃಢೀಕರಣ|ಇಮೇಲ್/.test(text)) return 'email';
  if (/log.?in|sign.?in|login|लॉग.?इन|साइन.?इन|ಲಾಗಿನ್|ಲಾಗ್.?ಇನ್|ಸೈನ್.?ಇನ್/.test(text)) return 'login';
  return 'other';
}

export function detectAuthHelpLanguage(text) {
  if (/[\u0C80-\u0CFF]/.test(text)) return 'kn';
  if (/[\u0B80-\u0BFF]/.test(text)) return 'ta';
  if (/[\u0C00-\u0C7F]/.test(text)) return 'te';
  if (/[\u0A80-\u0AFF]/.test(text)) return 'gu';
  if (/[\u0D00-\u0D7F]/.test(text)) return 'ml';
  if (/[\u0A00-\u0A7F]/.test(text)) return 'pa';
  if (/[\u0B00-\u0B7F]/.test(text)) return 'or';
  if (/[\u0980-\u09FF]/.test(text)) return 'bn';
  if (/[\u0600-\u06FF\u0750-\u08FF]/.test(text)) return 'ur';
  if (/[\u0900-\u097F]/.test(text)) return 'hi';
  return null;
}

export function getBrowserHelpLanguage() {
  const browserLanguages = typeof navigator === 'undefined'
    ? ['en']
    : navigator.languages?.length ? navigator.languages : [navigator.language || 'en'];
  for (const browserLanguage of browserLanguages) {
    const code = browserLanguage.toLowerCase().split('-')[0];
    if (supportedLanguages.has(code)) return code;
  }
  return 'en';
}

export function AuthHelp({ initialLanguage, onLanguageChange = () => {} }) {
  const [open, setOpen] = useState(false);
  const [language, setLanguage] = useState(initialLanguage || getBrowserHelpLanguage());
  const [messages, setMessages] = useState(() => [{ role: 'assistant', text: localizedCopy(authHelpContent, initialLanguage || getBrowserHelpLanguage()).greeting }]);
  const [input, setInput] = useState('');
  const [listening, setListening] = useState(false);
  const [speechNotice, setSpeechNotice] = useState('');
  const recognitionRef = useRef(null);
  const messageListRef = useRef(null);
  const copy = localizedCopy(authHelpContent, language);

  useEffect(() => {
    if (messageListRef.current) messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
  }, [messages, open]);

  useEffect(() => () => {
    recognitionRef.current?.abort();
    stopSpeaking();
  }, []);

  function changeLanguage(nextLanguage) {
    recognitionRef.current?.abort();
    stopSpeaking();
    setListening(false);
    setLanguage(nextLanguage);
    onLanguageChange(nextLanguage);
    setMessages([{ role: 'assistant', text: localizedCopy(authHelpContent, nextLanguage).greeting }]);
    setInput('');
    setSpeechNotice('');
  }

  function answerQuestion(question, knownTopic) {
    const cleanQuestion = question.trim();
    if (!cleanQuestion) return;
    const answerLanguage = detectAuthHelpLanguage(cleanQuestion) || language;
    const topic = knownTopic || getAuthHelpTopic(cleanQuestion);
    setLanguage(answerLanguage);
    if (answerLanguage !== language) onLanguageChange(answerLanguage);
    setMessages(previous => [
      ...previous,
      { role: 'user', text: cleanQuestion },
      { role: 'assistant', text: localizedCopy(authHelpContent, answerLanguage).answers[topic] }
    ]);
    setInput('');
    setSpeechNotice('');
  }

  function submitQuestion(event) {
    event.preventDefault();
    answerQuestion(input);
  }

  function startListening() {
    const recognition = createSpeechRecognition(language);
    if (!recognition) { setSpeechNotice(copy.voiceUnsupported); return; }
    try {
      recognitionRef.current = recognition;
      recognition.onstart = () => { setListening(true); setSpeechNotice(''); };
      recognition.onend = () => { setListening(false); recognitionRef.current = null; };
      recognition.onerror = () => { setListening(false); setSpeechNotice(copy.voiceError); };
      recognition.onresult = event => {
        setInput(event.results?.[0]?.[0]?.transcript || '');
        setSpeechNotice(copy.speechReview);
      };
      recognition.start();
    } catch {
      setListening(false);
      setSpeechNotice(copy.voiceError);
    }
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  async function speak(text) {
    const result = await speakText(text, language);
    if (result.ok || result.reason === 'cancelled') { setSpeechNotice(''); return; }
    setSpeechNotice(result.reason === 'unsupported' ? copy.speechUnsupported : copy.voiceMissing);
  }

  function toggleHelp() {
    if (open) {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
      setListening(false);
      stopSpeaking();
    }
    setOpen(value => !value);
  }

  return <section className={`auth-help ${open ? 'auth-help-open' : ''}`} aria-label="Sign in and registration help">
    <button className="auth-help-toggle" type="button" aria-expanded={open} onClick={toggleHelp}>
      <span className="auth-help-icon"><MessageCircle size={17} /></span>
      <span className="auth-help-toggle-copy"><b>{copy.title}</b><small>{copy.subtitle}</small></span>
      <ChevronDown className={open ? 'auth-help-chevron-open' : ''} size={17} />
    </button>
    {open && <div className="auth-help-panel">
      <div className="auth-help-tools">
        <span className="auth-help-status"><span className="status-dot" />Saathi</span>
        <label className="auth-help-language"><span className="sr-only">{copy.language}</span><select value={language} onChange={event => changeLanguage(event.target.value)} aria-label={copy.language}>{languageOptions.map(({ code, label }) => <option key={code} value={code}>{label}</option>)}</select><Globe2 size={14} /></label>
      </div>
      <div className="auth-help-messages" ref={messageListRef} role="log" aria-live="polite" aria-label="Saathi conversation">
        {messages.map((message, index) => <div className={`auth-help-message ${message.role === 'user' ? 'auth-help-user' : ''}`} key={`${index}-${message.role}`}>
          <div className="auth-help-bubble">{message.text}</div>
          {message.role === 'assistant' && <button className="auth-help-listen" type="button" onClick={() => speak(message.text)}><Volume2 size={14} />{copy.listen}</button>}
        </div>)}
      </div>
      <div className="auth-help-prompts" aria-label="Common account questions">
        {copy.prompts.map(([topic, label]) => <button type="button" key={topic} onClick={() => answerQuestion(label, topic)}>{label}</button>)}
      </div>
      {speechNotice && <p className="auth-help-notice" role="status">{speechNotice}</p>}
      <form className="auth-help-composer" onSubmit={submitQuestion}>
        <button className={`auth-help-mic ${listening ? 'mic-listening' : ''}`} type="button" onClick={listening ? stopListening : startListening} aria-label={listening ? copy.stopVoice : copy.voice} title={listening ? copy.stopVoice : copy.voice}>{listening ? <MicOff size={17} /> : <Mic size={17} />}</button>
        <input value={input} onChange={event => {
          const value = event.target.value;
          setInput(value);
          const detectedLanguage = detectAuthHelpLanguage(value);
          if (detectedLanguage) {
            setLanguage(detectedLanguage);
            onLanguageChange(detectedLanguage);
          }
        }} placeholder={copy.placeholder} aria-label={copy.placeholder} />
        <button className="auth-help-send" type="submit" disabled={!input.trim()} aria-label={copy.send}><Send size={16} /></button>
      </form>
      <p className="auth-help-voice-hint">{copy.voiceLanguageHint}</p>
      <p className="auth-help-privacy"><ShieldCheck size={14} />{copy.privacy}</p>
    </div>}
  </section>;
}

export default AuthHelp;
