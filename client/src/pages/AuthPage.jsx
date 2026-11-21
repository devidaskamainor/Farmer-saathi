import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Leaf, Sprout, Search, Check, ChevronLeft, Globe2, FileWarning,
  ShieldCheck, LoaderCircle, ArrowRight, Volume2, Mic, MicOff
} from 'lucide-react';
import { api, errorMessage } from '../services/api.js';
import { createSpeechRecognition, speakText, stopSpeaking } from '../services/voice.js';
import { validateEmailClient, validateSocialLoginClient } from '../services/emailValidator.js';
import { languageOptions } from '../config/languages.js';
import { authCopy, authHelpContent, registrationQuestions } from '../config/authTranslations.js';
import { readSavedLanguage, saveLanguage, localizedCopy } from '../services/languageStorage.js';
import Field from '../components/common/Field.jsx';
import ThemePicker from '../components/common/ThemePicker.jsx';
import { GoogleIcon, FacebookIcon } from '../components/auth/SocialIcons.jsx';
import SocialAccountModal, { saveStoredSocialAccount } from '../components/auth/SocialAccountModal.jsx';
import AuthHelp, { getBrowserHelpLanguage } from '../components/auth/AuthHelp.jsx';

function splitList(value) {
  return value.split(',').map(part => part.trim()).filter(Boolean).slice(0, 20);
}

export default function AuthPage({ onAuthenticated }) {
  const [register, setRegister] = useState(false);
  const [mode, setMode] = useState('simple');
  const [guidedStage, setGuidedStage] = useState('steps');
  const [stepIndex, setStepIndex] = useState(0);
  const [stepValue, setStepValue] = useState('');
  const savedLanguage = readSavedLanguage();
  const [language, setLanguage] = useState(savedLanguage || getBrowserHelpLanguage());
  const [showLanguageChoice, setShowLanguageChoice] = useState(!savedLanguage);
  const [languageSearch, setLanguageSearch] = useState('');
  const [socialModal, setSocialModal] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', village: '', district: '', state: '', currentCrops: '' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speechNotice, setSpeechNotice] = useState('');
  const recognitionRef = useRef(null);
  const copy = localizedCopy(authCopy, language);
  const questions = localizedCopy(registrationQuestions, language);
  const currentQuestion = questions[stepIndex];

  useEffect(() => () => {
    recognitionRef.current?.abort();
    stopSpeaking();
  }, []);

  function updateLanguage(nextLanguage) {
    setLanguage(nextLanguage);
    saveLanguage(nextLanguage);
  }

  async function confirmLanguage() {
    saveLanguage(language);
    setShowLanguageChoice(false);
    setLanguageSearch('');
    await speakText(copy.languageWelcome, language);
  }

  const filteredLanguages = languageOptions.filter(({ code, nativeName, englishName, label }) => {
    if (!languageSearch.trim()) return true;
    const query = languageSearch.trim().toLowerCase();
    return (
      code.toLowerCase().includes(query) ||
      nativeName.toLowerCase().includes(query) ||
      englishName.toLowerCase().includes(query) ||
      label.toLowerCase().includes(query)
    );
  });

  function setFormValue(key, value) {
    setForm(previous => ({ ...previous, [key]: value }));
  }

  function startGuidedSetup() {
    setMode('guided');
    setGuidedStage('steps');
    setStepIndex(0);
    setStepValue(form.name);
    setError('');
    setNotice('');
  }

  function goToQuestion(index) {
    const target = Math.max(0, Math.min(index, questions.length - 1));
    setStepIndex(target);
    setStepValue(form[questions[target].key] || '');
    setSpeechNotice('');
    setGuidedStage('steps');
  }

  function moveQuestion(skip = false) {
    const question = questions[stepIndex];
    const value = skip ? '' : stepValue.trim();
    if (question.required && !value) {
      setSpeechNotice(language === 'kn' ? 'ದಯವಿಟ್ಟು ನಿಮ್ಮ ಹೆಸರನ್ನು ಹೇಳಿ ಅಥವಾ ಟೈಪ್ ಮಾಡಿ.' : language === 'hi' ? 'कृपया अपना नाम बोलें या लिखें।' : 'Please say or type your name.');
      return;
    }
    const nextForm = { ...form, [question.key]: value };
    setForm(nextForm);
    setSpeechNotice('');
    if (stepIndex === questions.length - 1) {
      setGuidedStage('review');
    } else {
      const nextIndex = stepIndex + 1;
      setStepIndex(nextIndex);
      setStepValue(nextForm[questions[nextIndex].key] || '');
    }
  }

  function startListening() {
    const recognition = createSpeechRecognition(language);
    if (!recognition) { setSpeechNotice(copy.recognitionUnavailable); return; }
    try {
      recognitionRef.current = recognition;
      recognition.onstart = () => { setListening(true); setSpeechNotice(''); };
      recognition.onend = () => { setListening(false); recognitionRef.current = null; };
      recognition.onerror = () => { setListening(false); setSpeechNotice(copy.microphoneError); };
      recognition.onresult = event => setStepValue(event.results?.[0]?.[0]?.transcript || '');
      recognition.start();
    } catch { setListening(false); setSpeechNotice(copy.microphoneError); }
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  async function repeatQuestion() {
    const result = await speakText(currentQuestion.prompt, language);
    if (!result.ok && result.reason !== 'cancelled') {
      const helpCopy = localizedCopy(authHelpContent, language);
      setSpeechNotice(result.reason === 'unsupported' ? helpCopy.speechUnsupported : helpCopy.voiceMissing);
    }
  }

  async function submit(event) {
    event.preventDefault(); setError('');
    const emailCheck = validateEmailClient(form.email, language);
    if (!emailCheck.valid) {
      setError(emailCheck.error);
      return;
    }
    setBusy(true);
    try {
      const requestBody = {
        name: form.name.trim(), preferredLanguage: language,
        village: form.village.trim(), district: form.district.trim(), state: form.state.trim(),
        currentCrops: splitList(form.currentCrops),
        email: emailCheck.email,
        password: form.password
      };
      const { data } = await api.post(register ? '/auth/register' : '/auth/login', requestBody);
      if (data.verificationRequired) {
        setNotice(copy.confirmation);
      } else {
        setNotice('');
        onAuthenticated(data);
      }
    } catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  }

  async function resendVerification() {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const { data } = await api.post('/auth/verification/resend', { email: form.email.trim() });
      setNotice(data.message);
    } catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  }

  function handleSocialAuth(provider) {
    setError('');
    setNotice('');
    if (provider === 'google' && import.meta.env.VITE_GOOGLE_CLIENT_ID) {
      const redirectUri = `${window.location.origin}/dashboard`;
      const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(import.meta.env.VITE_GOOGLE_CLIENT_ID)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=openid%20email%20profile&prompt=select_account`;
      window.location.href = googleAuthUrl;
      return;
    }
    setSocialModal(provider);
  }

  async function handleSelectSocialAccount(account) {
    const provider = socialModal || 'google';
    const validation = validateSocialLoginClient(provider, account.email, language);
    if (!validation.valid) {
      setError(validation.error);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { data } = await api.post('/auth/social', {
        provider,
        email: validation.email,
        name: account.name?.trim() || validation.email.split('@')[0],
        preferredLanguage: language
      });
      saveStoredSocialAccount({ ...account, email: validation.email });
      setSocialModal(null);
      onAuthenticated(data);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const onAuthLanguageChange = nextLanguage => {
    updateLanguage(nextLanguage);
    setShowLanguageChoice(false);
  };

  return <main className="auth-page">
    <section className="auth-story">
      <div className="brand brand-light"><span className="brand-mark"><Leaf size={21} /></span><span>Farmer Saathi</span></div>
      <div className="auth-story-copy"><span className="eyebrow light-eyebrow"><span className="live-dot" />{language === 'kn' ? 'ಪ್ರತಿ ಬೆಳೆಯ ಋತುವಿಗೂ ಸಹಾಯ' : language === 'hi' ? 'हर फसल के मौसम में साथ' : 'A little help for every growing season'}</span>
        <h1>{language === 'kn' ? <>ಒಳ್ಳೆಯ ನಿರ್ಧಾರಗಳು<br />ಇಲ್ಲಿಂದ ಬೆಳೆಯುತ್ತವೆ.</> : language === 'hi' ? <>अच्छे फैसले<br />यहीं से बढ़ते हैं।</> : <>Good decisions<br />grow from here.</>}</h1>
        <p>{language === 'kn' ? 'ಹವಾಮಾನ, ಮಾರುಕಟ್ಟೆ ಮಾಹಿತಿ ಮತ್ತು ಕೃಷಿ ಸಲಹೆ ಒಂದೇ ಕಡೆ.' : language === 'hi' ? 'मौसम, बाज़ार की जानकारी और खेती की सलाह एक ही जगह।' : 'Weather, market information and practical crop guidance, together in one place.'}</p>
      </div>
      <div className="story-note"><Sprout size={18} /><span>{language === 'kn' ? 'ನಮ್ಮ ಆಹಾರ ಬೆಳೆಸುವ ರೈತರಿಗಾಗಿ.' : language === 'hi' ? 'हमारा भोजन उगाने वाले किसानों के लिए।' : 'Made for the people who grow our food.'}</span></div>
      <span className="story-decoration story-decoration-one" /><span className="story-decoration story-decoration-two" />
    </section>
    <section className="auth-form-wrap"><div className={`auth-form-stack ${showLanguageChoice ? 'auth-form-stack-wide' : ''}`}>
      {showLanguageChoice ? <div className="auth-form-card language-choice-card">
        <div className="language-choice-header">
          <span className="eyebrow">FARMER SAATHI</span>
          <h2>{copy.languageTitle}</h2>
          <p className="muted">{copy.languageDescription}</p>
        </div>
        <div className="language-search-box">
          <Search size={15} />
          <input
            type="search"
            className="language-search-input"
            placeholder={language === 'kn' ? 'ಭಾಷೆಯನ್ನು ಹುಡುಕಿ...' : language === 'hi' ? 'भाषा खोजें...' : language === 'mr' ? 'भाषा शोधा...' : 'Search language...'}
            value={languageSearch}
            onChange={event => setLanguageSearch(event.target.value)}
            aria-label="Search language"
          />
        </div>
        <div className="language-choice-list" role="radiogroup" aria-label={copy.languageTitle}>
          {filteredLanguages.map(({ code, nativeName, englishName }) => {
            const isSelected = language === code;
            return <button
              type="button"
              key={code}
              role="radio"
              aria-checked={isSelected}
              className={`language-choice ${isSelected ? 'language-choice-selected' : ''}`}
              onClick={() => setLanguage(code)}
            >
              <div className="language-choice-info">
                <span className="language-native-name">{nativeName}</span>
                <span className="language-english-name">{englishName}</span>
              </div>
              <span className="language-choice-indicator" aria-hidden="true">
                {isSelected ? <Check size={13} strokeWidth={3} /> : null}
              </span>
            </button>;
          })}
          {filteredLanguages.length === 0 && <div className="language-empty-hint">
            No language matching &ldquo;{languageSearch}&rdquo;
          </div>}
        </div>
        <div className="language-choice-actions">
          {savedLanguage ? <button type="button" className="subtle-button language-choice-back" onClick={() => { setShowLanguageChoice(false); setLanguageSearch(''); }}><ChevronLeft size={16} />{copy.back || 'Back'}</button> : null}
          <button className="primary-button auth-submit language-choice-submit" onClick={confirmLanguage} type="button">{copy.continue}<ArrowRight size={18} /></button>
        </div>
      </div> : <>
        <div className="auth-form-card">
          <div className="auth-card-topline">
            <span className="eyebrow">{language === 'kn' ? 'ನಿಮ್ಮ ಕೃಷಿ ಸಹಾಯಕ' : language === 'hi' ? 'आपका कृषि सहायक' : language === 'mr' ? 'तुमचा शेती सोबती' : 'YOUR FARMING COMPANION'}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ThemePicker />
              <button className="auth-language-change" type="button" onClick={() => setShowLanguageChoice(true)}><Globe2 size={14} />{copy.changeLanguage}</button>
            </div>
          </div>
          <h2>{register ? copy.registerTitle : copy.loginTitle}</h2>
          <p className="muted">{register ? copy.registerDescription : copy.loginDescription}</p>
          {register && <div className="auth-mode-switch"><button type="button" className={mode === 'simple' ? 'auth-mode-active' : ''} onClick={() => { setMode('simple'); setError(''); }}>{copy.visualMode}</button><button type="button" className={mode === 'guided' ? 'auth-mode-active' : ''} onClick={startGuidedSetup}>{copy.voiceMode}</button></div>}

          {!register || mode === 'simple' ? <form onSubmit={submit} className="form-stack">
            {register && <Field label={copy.name} placeholder={copy.namePlaceholder} autoComplete="name" value={form.name} onChange={name => setFormValue('name', name)} required />}
            <Field label={copy.email} type="email" placeholder={copy.emailPlaceholder} autoComplete="email" value={form.email} onChange={email => setFormValue('email', email)} required />
            <Field label={copy.password} type="password" placeholder={register ? copy.passwordPlaceholder : copy.password} autoComplete={register ? 'new-password' : 'current-password'} value={form.password} onChange={password => setFormValue('password', password)} required minLength={register ? 8 : 1} />
            {!register && <Link className="text-link forgot-password-link" to="/forgot-password">{copy.forgotPassword}</Link>}
            {register && <>
              <div className="field-grid"><Field label={`${copy.village} (${copy.optional})`} placeholder={copy.villagePlaceholder} value={form.village} onChange={village => setFormValue('village', village)} /><Field label={`${copy.district} (${copy.optional})`} placeholder={copy.districtPlaceholder} value={form.district} onChange={district => setFormValue('district', district)} /></div>
              <div className="field-grid"><Field label={`${copy.state} (${copy.optional})`} placeholder={copy.statePlaceholder} value={form.state} onChange={state => setFormValue('state', state)} /><Field label={`${copy.crops} (${copy.optional})`} placeholder={copy.cropsPlaceholder} value={form.currentCrops} onChange={currentCrops => setFormValue('currentCrops', currentCrops)} /></div>
            </>}
            {register && <p className="field-hint">{copy.credentialsHint}</p>}
            {error && <div className="alert alert-error" role="alert"><FileWarning size={17} />{error}</div>}
            {notice && <div className="alert alert-success" role="status"><ShieldCheck size={17} />{notice}</div>}
            <button disabled={busy} className="primary-button auth-submit">{busy ? <LoaderCircle className="spin" size={18} /> : null}{register ? copy.createAccount : copy.signIn}<ArrowRight size={18} /></button>
            {register && form.email && <button className="text-link" type="button" disabled={busy} onClick={resendVerification}>{copy.resendVerification}</button>}
          </form> : guidedStage === 'steps' ? <form onSubmit={event => { event.preventDefault(); moveQuestion(); }} className="form-stack guided-registration">
            <div className="guided-step-count">{copy.step} {stepIndex + 1} / {questions.length}</div>
            <h3 className="guided-question">{currentQuestion.prompt}</h3>
            <p className="field-hint">{copy.manualHint}</p>
            <div className="guided-voice-actions">
              <button type="button" className="subtle-button" onClick={repeatQuestion}><Volume2 size={17} />{copy.repeatQuestion}</button>
              <button type="button" className={`guided-mic ${listening ? 'mic-listening' : ''}`} onClick={listening ? stopListening : startListening} aria-label={listening ? copy.stopListening : copy.speakAnswer}>{listening ? <MicOff size={21} /> : <Mic size={21} />}{listening ? copy.stopListening : copy.speakAnswer}</button>
            </div>
            <Field label={currentQuestion.key === 'currentCrops' ? copy.crops : copy[currentQuestion.key]} placeholder={currentQuestion.key === 'currentCrops' ? copy.crops : copy[currentQuestion.key]} value={stepValue} onChange={setStepValue} autoComplete={currentQuestion.key === 'name' ? 'name' : 'off'} />
            {listening && <p className="guided-status" role="status">{copy.listening}</p>}
            {speechNotice && <p className="auth-help-notice" role="status">{speechNotice}</p>}
            {error && <div className="alert alert-error" role="alert"><FileWarning size={17} />{error}</div>}
            <div className="guided-step-footer"><button className="subtle-button" type="button" disabled={stepIndex === 0} onClick={() => goToQuestion(stepIndex - 1)}><ChevronLeft size={16} />{copy.back}</button><div>{!currentQuestion.required && <button className="text-link" type="button" onClick={() => moveQuestion(true)}>{copy.skip}</button>}<button className="primary-button" type="submit">{copy.next}<ArrowRight size={17} /></button></div></div>
          </form> : guidedStage === 'review' ? <div className="form-stack guided-registration">
            <div className="guided-step-count">{copy.reviewTitle}</div><h3 className="guided-question">{copy.reviewQuestion}</h3>
            <dl className="registration-summary">{questions.map(question => <div key={question.key}><dt>{question.key === 'currentCrops' ? copy.crops : copy[question.key]}</dt><dd>{form[question.key]?.trim() || copy.notProvided}</dd></div>)}</dl>
            {error && <div className="alert alert-error" role="alert"><FileWarning size={17} />{error}</div>}
            <div className="guided-step-footer"><button className="subtle-button" type="button" onClick={() => goToQuestion(0)}>{copy.changeInfo}</button><button className="primary-button" type="button" onClick={() => setGuidedStage('credentials')}><Check size={17} />{copy.confirmInfo}</button></div>
          </div> : <form onSubmit={submit} className="form-stack guided-registration">
            <div className="guided-step-count">{copy.credentialsTitle}</div><h3 className="guided-question">{form.name}</h3><p className="field-hint">{copy.credentialsHint}</p>
            <Field label={copy.email} type="email" placeholder={copy.emailPlaceholder} autoComplete="email" value={form.email} onChange={email => setFormValue('email', email)} required />
            <Field label={copy.password} type="password" placeholder={copy.passwordPlaceholder} autoComplete="new-password" value={form.password} onChange={password => setFormValue('password', password)} required minLength={8} />
            {error && <div className="alert alert-error" role="alert"><FileWarning size={17} />{error}</div>}
            {notice && <div className="alert alert-success" role="status"><ShieldCheck size={17} />{notice}</div>}
            {form.email && <button className="text-link" type="button" disabled={busy} onClick={resendVerification}>{copy.resendVerification}</button>}
            <div className="guided-step-footer"><button className="subtle-button" type="button" onClick={() => setGuidedStage('review')}><ChevronLeft size={16} />{copy.back}</button><button className="primary-button" disabled={busy}>{busy ? <LoaderCircle className="spin" size={18} /> : null}{copy.accountCreate}<ArrowRight size={17} /></button></div>
          </form>}

          <div className="auth-social-section">
            <div className="auth-divider">
              <span>{copy.orContinueWith || 'Or continue with'}</span>
            </div>
            <div className="auth-social-buttons">
              <button
                type="button"
                className="social-button social-button-google"
                onClick={() => handleSocialAuth('google')}
                disabled={busy}
              >
                <GoogleIcon />
                <span>{copy.googleSignIn || 'Continue with Google'}</span>
              </button>
              <button
                type="button"
                className="social-button social-button-facebook"
                onClick={() => handleSocialAuth('facebook')}
                disabled={busy}
              >
                <FacebookIcon />
                <span>{copy.facebookSignIn || 'Continue with Facebook'}</span>
              </button>
            </div>
          </div>

          <p className="switch-auth">{register ? copy.switchToLogin : copy.switchToRegister} <button onClick={() => { setRegister(!register); setMode('simple'); setGuidedStage('steps'); setError(''); setNotice(''); setSpeechNotice(''); }} type="button">{register ? copy.useSignIn : copy.useRegister}</button></p>
          <p className="privacy-note"><ShieldCheck size={15} />{copy.privacy}</p>
        </div>
        <AuthHelp initialLanguage={language} onLanguageChange={onAuthLanguageChange} />
      </>}
    </div></section>
    {socialModal && <SocialAccountModal provider={socialModal} language={language} copy={copy} busy={busy} onSelect={handleSelectSocialAccount} onClose={() => setSocialModal(null)} />}
  </main>;
}
