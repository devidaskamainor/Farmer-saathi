import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, Route, Routes, useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import {
  Activity, ArrowRight, BadgeIndianRupee, CalendarDays, Check, ChevronDown, ChevronLeft,
  Cloud, CloudRain, Droplets, FileWarning, Globe2, House, Leaf, LoaderCircle, LogOut, MapPin,
  Landmark, Menu, MessageCircle, Mic, MicOff, Pencil, Plus, Save, Search, Send, ShieldCheck, Sprout, Sun,
  Trash2, Upload, UserRound, Volume2, VolumeX, Wind
} from 'lucide-react';
import { api, errorMessage } from '../services/api.js';
import { createSpeechRecognition, speakText, stopSpeaking } from '../services/voice.js';
import { getLanguageDefinition, languageConfig, languageOptions, supportedLanguageCodes } from '../config/languages.js';
import { words, serviceCopy, defaultServiceItems, assistantCopy, schemesCopy, schemeDetailLabels, schemeExtraLabels } from '../config/translations.js';
import { authCopy, authHelpContent, verificationCopy, passwordResetCopy, registrationQuestions } from '../config/authTranslations.js';

const languageStorageKey = 'farmer-saathi-language';
const supportedLanguages = new Set(supportedLanguageCodes);

function readSavedLanguage() {
  try {
    const language = window.localStorage.getItem(languageStorageKey);
    return supportedLanguages.has(language) ? language : null;
  } catch { return null; }
}

function saveLanguage(language) {
  try { window.localStorage.setItem(languageStorageKey, language); } catch { /* Storage can be disabled in private browser modes. */ }
  const definition = getLanguageDefinition(language);
  if (typeof document !== 'undefined') {
    document.documentElement.lang = definition.locale;
    document.documentElement.dir = definition.direction;
  }
}

function localizedCopy(resources, language) {
  return resources[language] || resources.en;
}

const nav = [
  { to: '/dashboard', key: 'overview', icon: House }, { to: '/weather', key: 'weather', icon: Cloud },
  { to: '/markets', key: 'markets', icon: BadgeIndianRupee }, { to: '/crops', key: 'crops', icon: Sprout },
  { to: '/assistant', key: 'assistant', icon: MessageCircle }, { to: '/irrigation', key: 'irrigation', icon: Droplets },
  { to: '/disease', key: 'disease', icon: Activity }, { to: '/profile', key: 'profile', icon: UserRound }
];
const publicAuthPaths = new Set(['/verify-email', '/forgot-password', '/reset-password']);

export default function App() {
  const location = useLocation();
  const [authenticated, setAuthenticated] = useState(false);
  const [farmer, setFarmer] = useState(null);
  const [checking, setChecking] = useState(true);
  const [profileError, setProfileError] = useState('');

  useEffect(() => {
    const definition = getLanguageDefinition(farmer?.preferredLanguage || readSavedLanguage() || getBrowserHelpLanguage());
    document.documentElement.lang = definition.locale;
    document.documentElement.dir = definition.direction;
  }, [farmer?.preferredLanguage]);

  useEffect(() => {
    let active = true;
    if (publicAuthPaths.has(location.pathname)) {
      setChecking(false);
      return () => { active = false; };
    }
    setChecking(true);
    api.get('/auth/session')
      .then(({ data }) => {
        if (!active) return;
        setAuthenticated(true);
        setFarmer(data.farmer);
      })
      .catch(error => {
        if (!active) return;
        if (error.response?.status === 401) {
          setAuthenticated(false);
          setFarmer(null);
        } else {
          setProfileError(errorMessage(error));
        }
      })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, [location.pathname]);

  useEffect(() => {
    if (farmer?.preferredLanguage && supportedLanguages.has(farmer.preferredLanguage)) saveLanguage(farmer.preferredLanguage);
  }, [farmer?.preferredLanguage]);

  const onAuthenticated = data => {
    setAuthenticated(true);
    setFarmer(data.farmer);
    setProfileError('');
  };
  const signOut = async () => {
    try { await api.post('/auth/logout'); }
    catch (error) { window.alert(errorMessage(error)); }
    setAuthenticated(false);
    setFarmer(null);
  };

  if (location.pathname === '/verify-email') {
    return <EmailVerificationPage onAuthenticated={onAuthenticated} />;
  }
  if (location.pathname === '/forgot-password') return <ForgotPasswordPage />;
  if (location.pathname === '/reset-password') return <ResetPasswordPage />;
  if (checking) return <div className="full-loading"><LoaderCircle className="spin" /><span>Opening your farm…</span></div>;
  if (profileError && !farmer) return <div className="error-screen"><ShieldCheck size={30} /><h1>Could not connect to your account</h1><p>{profileError}</p><button className="primary-button" onClick={() => window.location.reload()}>Try again</button></div>;
  if (!authenticated) return <AuthPage onAuthenticated={onAuthenticated} />;
  if (!farmer) return <div className="full-loading"><LoaderCircle className="spin" /><span>Loading your profile…</span></div>;

  return <Routes>
    <Route element={<AppShell farmer={farmer} setFarmer={setFarmer} onSignOut={signOut} />}>
      <Route index element={<Navigate to="/dashboard" replace />} />
      <Route path="dashboard" element={<Dashboard />} />
      <Route path="weather" element={<WeatherPage />} />
      <Route path="markets" element={<MarketsPage />} />
      <Route path="crops" element={<CropsPage />} />
      <Route path="assistant" element={<AssistantPage />} />
      <Route path="irrigation" element={<IrrigationPage />} />
      <Route path="disease" element={<DiseasePage />} />
      <Route path="schemes" element={<SchemesPage />} />
      <Route path="profile" element={<ProfilePage />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Route>
  </Routes>;
}

function EmailVerificationPage({ onAuthenticated }) {
  const location = useLocation();
  const navigate = useNavigate();
  const token = new URLSearchParams(location.search).get('token') || '';
  const language = readSavedLanguage() || getBrowserHelpLanguage();
  const copy = localizedCopy(verificationCopy, language);
  const [status, setStatus] = useState(token ? 'ready' : 'error');
  const [message, setMessage] = useState('');
  const [verifiedFarmer, setVerifiedFarmer] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (token) window.history.replaceState(window.history.state, '', location.pathname);
  }, [location.pathname, token]);

  async function verifyEmailAddress() {
    if (!token || busy) return;
    setBusy(true);
    setStatus('submitting');
    setMessage('');
    try {
      const { data } = await api.post('/auth/verify', { token });
      if (!data?.farmer) throw new Error(copy.invalid);
      setVerifiedFarmer(data.farmer);
      setStatus('success');
    } catch (error) {
      setMessage(errorMessage(error));
      setStatus('error');
    } finally {
      setBusy(false);
    }
  }

  function continueToFarmerSaathi() {
    onAuthenticated({ farmer: verifiedFarmer });
    navigate('/dashboard', { replace: true });
  }

  return <main className="verification-page">
    <section className="verification-card card" aria-labelledby="verification-title">
      <div className="brand"><span className="brand-mark"><Leaf size={21} /></span><span>Farmer Saathi</span></div>
      <h1 id="verification-title">{copy.title}</h1>
      {status === 'ready' && <p className="muted">{copy.ready}</p>}
      {status === 'submitting' && <p className="verification-progress" role="status"><LoaderCircle className="spin" size={18} />{copy.verifying}</p>}
      {status === 'success' && <div className="alert alert-success" role="status"><ShieldCheck size={18} />{copy.success}</div>}
      {status === 'error' && <div className="alert alert-error" role="alert"><FileWarning size={18} />{message || copy.invalid}</div>}
      {status === 'ready' && <button className="primary-button verification-action" type="button" disabled={busy} onClick={verifyEmailAddress}>{copy.verify}<ArrowRight size={17} /></button>}
      {status === 'success' && <button className="primary-button verification-action" type="button" onClick={continueToFarmerSaathi}>{copy.continue}<ArrowRight size={17} /></button>}
      {status === 'error' && <Link className="subtle-button verification-action" to="/">{copy.signIn}</Link>}
    </section>
  </main>;
}

function ForgotPasswordPage() {
  const language = readSavedLanguage() || getBrowserHelpLanguage();
  const copy = localizedCopy(passwordResetCopy, language);
  const [email, setEmail] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setNotice('');
    setError('');
    setBusy(true);
    try {
      await api.post('/auth/password/forgot', { email: email.trim() });
      setNotice(copy.requestSent);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setBusy(false);
    }
  }

  return <main className="verification-page">
    <section className="verification-card card" aria-labelledby="forgot-password-title">
      <div className="brand"><span className="brand-mark"><Leaf size={21} /></span><span>Farmer Saathi</span></div>
      <h1 id="forgot-password-title">{copy.forgotTitle}</h1>
      <p className="muted">{copy.forgotDescription}</p>
      <form className="form-stack" onSubmit={submit}>
        <Field label={localizedCopy(authCopy, language).email} type="email" autoComplete="email" maxLength={254} value={email} onChange={setEmail} required />
        {error && <div className="alert alert-error" role="alert"><FileWarning size={17} />{error}</div>}
        {notice && <div className="alert alert-success" role="status"><ShieldCheck size={17} />{notice}</div>}
        <button className="primary-button verification-action" disabled={busy}>
          {busy ? <LoaderCircle className="spin" size={18} /> : null}{copy.sendReset}
        </button>
      </form>
      <Link className="subtle-button verification-action" to="/">{copy.signIn}</Link>
    </section>
  </main>;
}

function ResetPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [token] = useState(() => new URLSearchParams(location.search).get('token') || '');
  const language = readSavedLanguage() || getBrowserHelpLanguage();
  const copy = localizedCopy(passwordResetCopy, language);
  const [status, setStatus] = useState(token ? 'ready' : 'error');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (token) window.history.replaceState(window.history.state, '', location.pathname);
  }, [location.pathname, token]);

  useEffect(() => {
    if (status !== 'success') return undefined;
    const timer = window.setTimeout(() => navigate('/', { replace: true }), 2000);
    return () => window.clearTimeout(timer);
  }, [navigate, status]);

  async function submit(event) {
    event.preventDefault();
    setError('');
    const passwordBytes = new TextEncoder().encode(password).length;
    if (passwordBytes < 8 || passwordBytes > 72) {
      setError(copy.passwordInvalid);
      return;
    }
    if (password !== confirmation) {
      setError(copy.passwordMismatch);
      return;
    }

    setBusy(true);
    setStatus('submitting');
    try {
      await api.post('/auth/password/reset', { token, password });
      setPassword('');
      setConfirmation('');
      setStatus('success');
    } catch (requestError) {
      setError(errorMessage(requestError));
      setStatus('error');
    } finally {
      setBusy(false);
    }
  }

  return <main className="verification-page">
    <section className="verification-card card" aria-labelledby="reset-password-title">
      <div className="brand"><span className="brand-mark"><Leaf size={21} /></span><span>Farmer Saathi</span></div>
      <h1 id="reset-password-title">{copy.resetTitle}</h1>
      {status === 'ready' || status === 'submitting' ? <>
        <p className="muted">{copy.resetDescription}</p>
        <form className="form-stack" onSubmit={submit}>
          <Field label={copy.newPassword} type="password" autoComplete="new-password" minLength={8} maxLength={72} value={password} onChange={setPassword} required disabled={busy} />
          <Field label={copy.confirmPassword} type="password" autoComplete="new-password" minLength={8} maxLength={72} value={confirmation} onChange={setConfirmation} required disabled={busy} />
          <p className="field-hint">{copy.passwordHint}</p>
          {error && <div className="alert alert-error" role="alert"><FileWarning size={17} />{error}</div>}
          <button className="primary-button verification-action" disabled={busy}>
            {busy ? <LoaderCircle className="spin" size={18} /> : null}{busy ? copy.resetting : copy.reset}
          </button>
        </form>
      </> : status === 'success' ? <>
        <div className="alert alert-success" role="status"><ShieldCheck size={18} />{copy.resetSuccess}</div>
        <Link className="subtle-button verification-action" to="/">{copy.signIn}</Link>
      </> : <>
        <div className="alert alert-error" role="alert"><FileWarning size={18} />{error || copy.invalidReset}</div>
        <Link className="subtle-button verification-action" to="/">{copy.signIn}</Link>
      </>}
    </section>
  </main>;
}

function GoogleIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
  </svg>;
}

function FacebookIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2" aria-hidden="true">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>;
}

function AuthPage({ onAuthenticated }) {
  const [register, setRegister] = useState(false);
  const [mode, setMode] = useState('simple');
  const [guidedStage, setGuidedStage] = useState('steps');
  const [stepIndex, setStepIndex] = useState(0);
  const [stepValue, setStepValue] = useState('');
  const savedLanguage = readSavedLanguage();
  const [language, setLanguage] = useState(savedLanguage || getBrowserHelpLanguage());
  const [showLanguageChoice, setShowLanguageChoice] = useState(!savedLanguage);
  const [languageSearch, setLanguageSearch] = useState('');
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
    event.preventDefault(); setError(''); setBusy(true);
    try {
      const requestBody = {
        name: form.name.trim(), preferredLanguage: language,
        village: form.village.trim(), district: form.district.trim(), state: form.state.trim(),
        currentCrops: splitList(form.currentCrops),
        email: form.email.trim(),
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

  async function handleSocialAuth(provider) {
    setError('');
    setNotice('');
    const promptText = provider === 'google'
      ? (language === 'kn' ? 'ಮುಂದುವರಿಯಲು ನಿಮ್ಮ Google ಇಮೇಲ್ ವಿಳಾಸವನ್ನು ನಮೂದಿಸಿ:' : language === 'hi' ? 'जारी रखने के लिए अपना Google ईमेल दर्ज करें:' : language === 'mr' ? 'पुढे जाण्यासाठी आपला Google ईमेल प्रविष्ट करा:' : 'Enter your Google email address to continue:')
      : (language === 'kn' ? 'ಮುಂದುವರಿಯಲು ನಿಮ್ಮ Facebook ಇಮೇಲ್ ವಿಳಾಸವನ್ನು ನಮೂದಿಸಿ:' : language === 'hi' ? 'जारी रखने के लिए अपना Facebook ईमेल दर्ज करें:' : language === 'mr' ? 'पुढे जाण्यासाठी आपला Facebook ईमेल प्रविष्ट करा:' : 'Enter your Facebook email address to continue:');
    
    const email = window.prompt(promptText, form.email || '');
    if (!email || !email.trim()) return;

    setBusy(true);
    try {
      const { data } = await api.post('/auth/social', {
        provider,
        email: email.trim(),
        name: form.name.trim() || email.trim().split('@')[0],
        preferredLanguage: language
      });
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
          <div className="auth-card-topline"><span className="eyebrow">{language === 'kn' ? 'ನಿಮ್ಮ ಕೃಷಿ ಸಹಾಯಕ' : language === 'hi' ? 'आपका कृषि सहायक' : language === 'mr' ? 'तुमचा शेती सोबती' : 'YOUR FARMING COMPANION'}</span><button className="auth-language-change" type="button" onClick={() => setShowLanguageChoice(true)}><Globe2 size={14} />{copy.changeLanguage}</button></div>
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
  </main>;
}

function getAuthHelpTopic(question) {
  const text = question.toLocaleLowerCase();
  if (/forgot|reset|password|पासवर्ड|मरेत|ಪಾಸ್.?ವರ್ಡ್|ಮರೆತ/.test(text)) return 'password';
  if (/register|sign.?up|create account|new account|रजिस्टर|खाता|पंजीकरण|ನೋಂದಣಿ|ಖಾತೆ/.test(text)) return 'register';
  if (/email|confirm|verification|ईमेल|पुष्टि|ದೃಢೀಕರಣ|ಇಮೇಲ್/.test(text)) return 'email';
  if (/log.?in|sign.?in|login|लॉग.?इन|साइन.?इन|ಲಾಗಿನ್|ಲಾಗ್.?ಇನ್|ಸೈನ್.?ಇನ್/.test(text)) return 'login';
  return 'other';
}

function detectAuthHelpLanguage(text) {
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

function getBrowserHelpLanguage() {
  const browserLanguages = typeof navigator === 'undefined'
    ? ['en']
    : navigator.languages?.length ? navigator.languages : [navigator.language || 'en'];
  for (const browserLanguage of browserLanguages) {
    const code = browserLanguage.toLowerCase().split('-')[0];
    if (supportedLanguages.has(code)) return code;
  }
  return 'en';
}

function AuthHelp({ initialLanguage, onLanguageChange = () => {} }) {
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

function Field({ label, value, onChange, type = 'text', ...props }) {
  return <label className="field"><span>{label}</span><input type={type} value={value} onChange={event => onChange(event.target.value)} {...props} /></label>;
}

function AppShell({ farmer, setFarmer, onSignOut }) {
  const [mobileNav, setMobileNav] = useState(false);
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine);
  const t = words[farmer?.preferredLanguage] || words.en;
  const location = useLocation();
  const page = nav.find(item => item.to === location.pathname);
  const initials = farmer?.name?.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase() || 'F';

  useEffect(() => {
    const updateStatus = () => setOffline(!navigator.onLine);
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
    };
  }, []);

  async function changeLanguage(value) {
    saveLanguage(value);
    setFarmer(prev => prev ? { ...prev, preferredLanguage: value } : prev);
    try {
      const { data } = await api.put(`/farmers/profile/${farmer._id}`, { preferredLanguage: value });
      setFarmer(data.farmer);
      saveLanguage(data.farmer.preferredLanguage);
    } catch (error) { window.alert(errorMessage(error)); }
  }

  return <div className="app-shell">
    {mobileNav && <button className="mobile-backdrop" onClick={() => setMobileNav(false)} aria-label="Close navigation" />}
    <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
      <Link to="/dashboard" className="brand"><span className="brand-mark"><Leaf size={21} /></span><span>Farmer Saathi</span></Link>
      <div className="side-section-label">YOUR FARM</div>
      <nav className="side-nav" aria-label="Main navigation">{nav.map(({ to, key, icon: Icon }) => <NavLink key={to} to={to} onClick={() => setMobileNav(false)} className={({ isActive }) => `nav-item ${isActive ? 'nav-active' : ''}`}><Icon size={18} strokeWidth={1.8} /><span>{t[key]}</span>{key === 'assistant' && <span className="nav-new">AI</span>}</NavLink>)}</nav>
      <div className="sidebar-bottom"><div className="helper-card"><div className="helper-icon"><Sprout size={18} /></div><b>Growing takes care.</b><span>Take one decision at a time.</span></div>
        <button className="signout-button" onClick={onSignOut}><LogOut size={17} />{t.signOut}</button>
      </div>
    </aside>
    <main className="main-area">
      <header className="topbar"><button className="mobile-menu" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu /></button><div className="crumbs"><span>Farmer Saathi</span><span className="crumb-slash">/</span><b>{t[page?.key] || t.overview}</b></div>
        <div className="topbar-right"><label className="language-control"><Globe2 size={16} /><span className="sr-only">{t.language}</span><select aria-label={t.language} value={farmer?.preferredLanguage || 'en'} onChange={e => changeLanguage(e.target.value)}>{languageOptions.map(({ code, label }) => <option key={code} value={code}>{label}</option>)}</select><ChevronDown size={13} /></label><span className="topbar-divider" /><div className="user-chip"><span className="avatar">{initials}</span><span className="user-name">{farmer?.name?.split(' ')[0]}</span></div></div>
      </header>
      {offline && <div className="offline-banner" role="status">You’re offline. Live weather, market data, and account updates are unavailable; no cached forecast or price is shown.</div>}
      <div className="page-content"><Outlet context={{ farmer, setFarmer }} /></div>
    </main>
  </div>;
}

function useFarm() { return useOutletContext(); }
function PageTitle({ eyebrow, title, description, action }) {
  return <div className="page-title-row"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</div>;
}
function Card({ className = '', children }) { return <section className={`card ${className}`}>{children}</section>; }
function ErrorNotice({ children, retry }) { return <div className="alert alert-error"><FileWarning size={17} /><span>{children}</span>{retry && <button onClick={retry}>Try again</button>}</div>; }
function LoadingBox({ label = 'Getting the latest information…' }) { return <div className="loading-box"><LoaderCircle className="spin" size={21} /><span>{label}</span></div>; }
function MetaLine({ source, time }) { const attribution = source === 'Open-Meteo' ? <>Weather data by <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a>, adapted under <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>; location data by <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">GeoNames</a>.</> : source || 'Source provided by data service'; return <div className="data-meta"><span><ShieldCheck size={13} /> {attribution}</span><span>{time ? `Updated ${new Date(time).toLocaleString()}` : 'Forecast date shown on each day'}</span></div>; }
function useRequest(path, dependencies = []) {
  const [state, setState] = useState({ data: null, error: '', loading: true });
  const load = async () => {
    setState(previous => ({ ...previous, loading: true, error: '' }));
    try { const { data } = await api.get(path); setState({ data, error: '', loading: false }); }
    catch (error) { setState({ data: null, error: errorMessage(error), loading: false }); }
  };
  useEffect(() => { load(); }, dependencies);
  return { ...state, load };
}

function VoiceWelcome({ farmer }) {
  const language = supportedLanguages.has(farmer?.preferredLanguage) ? farmer.preferredLanguage : 'en';
  const copy = localizedCopy(serviceCopy, language);
  const [speechNotice, setSpeechNotice] = useState('');
  const firstName = farmer?.name?.split(' ')[0] || '';
  const serviceLinks = [
    ['weather', '/weather', Cloud],
    ['crops', '/crops', Sprout],
    ['disease', '/disease', FileWarning],
    ['irrigation', '/irrigation', Droplets],
    ['markets', '/markets', BadgeIndianRupee],
    ['schemes', '/schemes', Landmark],
    ['assistant', '/assistant', MessageCircle],
    ['cropHealth', '/disease', Leaf],
    ['profile', '/profile', UserRound]
  ];

  async function readWelcome() {
    const response = await speakText(`${copy.greeting(firstName)} ${copy.intro}`, language);
    if (response.ok || response.reason === 'cancelled') setSpeechNotice('');
    else {
      const helpCopy = localizedCopy(authHelpContent, language);
      setSpeechNotice(response.reason === 'unsupported' ? helpCopy.speechUnsupported : helpCopy.voiceMissing);
    }
  }

  return <Card className="voice-welcome-card">
    <div className="voice-welcome-head">
      <span className="assistant-avatar" aria-hidden="true"><Leaf size={22} /></span>
      <div className="voice-welcome-copy">
        <span className="eyebrow">{copy.title}</span>
        <h2>{copy.greeting(firstName)}</h2>
        <p>{copy.intro}</p>
      </div>
    </div>
    <div className="voice-welcome-actions">
      <button className="primary-button voice-start-button" type="button" onClick={readWelcome}>
        <Volume2 size={18} />
        <span>{copy.start}</span>
      </button>
      <button className="subtle-button voice-stop-button" type="button" onClick={stopSpeaking}>
        <VolumeX size={17} />
        <span>{copy.stop}</span>
      </button>
      <Link className="subtle-button voice-chat-link" to="/assistant">
        <Mic size={18} />
        <span>{copy.talk}</span>
      </Link>
    </div>
    {speechNotice && <p className="voice-welcome-notice" role="status">{speechNotice}</p>}
    <h3 className="voice-services-title">{copy.servicesTitle}</h3>
    <div className="voice-service-grid">
      {serviceLinks.map(([key, to, Icon]) => {
        const item = copy.services?.[key] || defaultServiceItems[key];
        const [title, description, action] = item;
        return (
          <Link
            className="voice-service-card"
            to={to}
            key={key}
            aria-label={`${title}: ${description}`}
          >
            <div className="card-top">
              <span className="feature-icon" aria-hidden="true">
                <Icon size={20} />
              </span>
            </div>
            <div className="card-body">
              <b className="card-title">{title}</b>
              <span className="card-desc">{description}</span>
            </div>
            <div className="card-action">
              <strong>{action}</strong>
              <ArrowRight size={15} aria-hidden="true" />
            </div>
          </Link>
        );
      })}
    </div>
  </Card>;
}

function Dashboard() {
  const { farmer } = useFarm();
  const t = words[farmer?.preferredLanguage] || words.en;
  const weather = useRequest('/weather');
  const market = useRequest(`/mandi/prices?state=${encodeURIComponent(farmer?.state || '')}&district=${encodeURIComponent(farmer?.district || '')}`);
  const locationName = [farmer?.village, farmer?.district, farmer?.state].filter(Boolean).join(', ');
  const firstName = farmer?.name?.split(' ')[0] || '';
  return <>
    <div className="welcome-band"><div className="welcome-copy"><span className="eyebrow light-eyebrow">{t.welcome}, {firstName}</span><h1>{t.dashboard}</h1><p>A clearer view of the day, with useful guidance for what comes next.</p><div className="welcome-location"><MapPin size={15} />{locationName || <Link to="/profile">{t.location} <ArrowRight size={14} /></Link>}</div></div><div className="welcome-art"><div className="sun-disc"><Sun size={33} /></div><div className="hill hill-back" /><div className="hill hill-front" /><div className="art-leaf art-leaf-one"><Leaf /></div><div className="art-leaf art-leaf-two"><Leaf /></div></div></div>
    <VoiceWelcome farmer={farmer} />
    <div className="dashboard-planner"><PlannerPanel compact /></div>
    <div className="section-heading"><div><span className="eyebrow">TODAY</span><h2>Your daily picture</h2></div><span className="date-stamp"><CalendarDays size={16} />{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</span></div>
    <div className="dashboard-grid">
      <Card className="weather-summary"><div className="card-head"><div><span className="eyebrow">{t.forecast.toUpperCase()}</span><h3>Weather outlook</h3></div><Link className="icon-link" to="/weather" aria-label="Open weather"><ArrowRight size={18} /></Link></div>
        {weather.loading ? <LoadingBox label="Checking forecast…" /> : weather.error ? <div className="empty-block"><Cloud size={25} /><p>{weather.error}</p><Link to="/weather">Open weather <ArrowRight size={14} /></Link></div> : <><div className="current-weather"><div className="weather-symbol"><WeatherIcon conditions={weather.data.current.conditions} size={27} /></div><div><strong>{Math.round(weather.data.current.temperatureC)}°</strong><span>{weather.data.current.conditions}</span></div><div className="weather-place"><MapPin size={14} />{weather.data.location}</div></div><div className="weather-metrics"><Metric icon={Droplets} label="Humidity" value={`${weather.data.current.humidity}%`} /><Metric icon={Wind} label="Wind" value={`${weather.data.current.windSpeedMs} m/s`} /><Metric icon={CloudRain} label="Rain now" value={`${weather.data.current.rainfallMm} mm`} /></div><MetaLine source={weather.data.source} time={weather.data.fetchedAt} /></>}
      </Card>
      <Card className="market-summary"><div className="card-head"><div><span className="eyebrow">LOCAL MARKETS</span><h3>Reported mandi prices</h3></div><Link className="icon-link" to="/markets" aria-label="Open mandi prices"><ArrowRight size={18} /></Link></div>
        {market.loading ? <LoadingBox label="Checking market data…" /> : market.error ? <div className="empty-block"><BadgeIndianRupee size={25} /><p>{market.error}</p><Link to="/markets">Search mandi prices <ArrowRight size={14} /></Link></div> : market.data.records.length ? <><div className="price-list">{market.data.records.slice(0, 4).map((row, i) => <PriceRow key={`${row.market}-${row.commodity}-${i}`} row={row} />)}</div><MetaLine source={market.data.source} time={market.data.fetchedAt} /></> : <div className="empty-block"><BadgeIndianRupee size={25} /><p>No records matched your saved location. Search another district or crop.</p><Link to="/markets">Search market prices <ArrowRight size={14} /></Link></div>}
      </Card>
      <Link to="/crops" className="card feature-card crop-feature"><div className="feature-top"><span className="feature-icon"><Sprout size={20} /></span><span className="pill">PERSONALIZED</span></div><div><h3>Which crop fits your farm?</h3><p>Get ideas based on the details you’ve shared, with missing information called out.</p><span className="text-link">Explore crop advice <ArrowRight size={16} /></span></div></Link>
      <Link to="/assistant" className="card feature-card ask-feature"><div className="feature-top"><span className="feature-icon"><MessageCircle size={20} /></span><span className="pill pill-soft">HERE TO HELP</span></div><div><h3>A question came up?</h3><p>Ask in your preferred language about crops, weather, soil or farm care.</p><span className="text-link">Ask Saathi <ArrowRight size={16} /></span></div></Link>
      <Card className="tip-card"><div className="tip-icon"><ShieldCheck size={20} /></div><div><span className="eyebrow">A NOTE ON ADVICE</span><p>Weather and market information shows its source and date. AI suggestions are guidance, not a confirmed diagnosis or local expert assessment.</p></div></Card>
    </div>
    <div className="dashboard-history"><FarmHistoryPanel compact /></div>
  </>;
}

function Metric({ icon: Icon, label, value }) { return <div className="weather-metric"><Icon size={16} /><span>{label}</span><b>{value}</b></div>; }
function WeatherIcon({ conditions = '', size = 21 }) {
  const value = conditions.toLowerCase();
  const Icon = /rain|storm|drizzle|snow|shower/.test(value) ? CloudRain : /cloud|overcast|fog|mist/.test(value) ? Cloud : Sun;
  return <Icon size={size} />;
}
function PriceRow({ row }) { return <div className="price-row"><div><b>{row.commodity || 'Commodity'}</b><span>{[row.market, row.district, row.marketDate || 'Date not reported'].filter(Boolean).join(' · ')}</span></div><div className="price-right"><b>{row.modalPrice == null ? '—' : `₹${row.modalPrice.toLocaleString('en-IN')}`}</b><span>{row.priceUnit || 'Unit not reported'}</span></div></div>; }

function WeatherPage() {
  const { farmer } = useFarm();
  const weather = useRequest('/weather');
  return <><PageTitle eyebrow="WEATHER ASSISTANT" title="Plan with the forecast" description="Forecasts are fetched from a weather service. Farming suggestions are estimates, not observations of your field." action={<Link className="subtle-button" to="/profile"><MapPin size={15} />{[farmer?.district, farmer?.state].filter(Boolean).join(', ') || 'Set location'}</Link>} />
    <Card className="content-card">{weather.loading ? <LoadingBox /> : weather.error ? <ErrorNotice retry={weather.load}>{weather.error}</ErrorNotice> : <><div className="weather-detail-top"><div className="weather-big-icon"><WeatherIcon conditions={weather.data.current.conditions} size={31} /></div><div><span className="eyebrow">{weather.data.location}</span><div className="big-temperature">{Math.round(weather.data.current.temperatureC)}°<span>C</span></div><p className="capitalize">{weather.data.current.conditions}</p></div><div className="weather-detail-metrics"><Metric icon={Droplets} label="Humidity" value={`${weather.data.current.humidity}%`} /><Metric icon={Wind} label="Wind" value={`${weather.data.current.windSpeedMs} m/s`} /><Metric icon={CloudRain} label="Rainfall" value={`${weather.data.current.rainfallMm} mm`} /></div></div>
      <div className="section-heading compact-heading"><div><span className="eyebrow">NEXT DAYS</span><h2>{weather.data.forecast.length}-day forecast</h2></div><span className="small-muted">Local forecast dates</span></div>
      <div className="forecast-grid">{weather.data.forecast.map(day => <div className="forecast-day" key={day.date}><span>{new Date(`${day.date}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'short' })}</span><WeatherIcon conditions={day.conditions} size={21} /><b>{Math.round(day.maxC)}° <i>{Math.round(day.minC)}°</i></b><span className="forecast-rain"><Droplets size={13} />{day.rainMm} mm rain</span><span className="forecast-condition">{day.conditions}</span></div>)}</div>
      {(() => { const rainyDay = weather.data.forecast.find(day => day.rainMm > 0); return <div className="weather-advisory"><div className="advisory-icon"><ShieldCheck size={18} /></div><div><b>{rainyDay ? `Rain is forecast for ${new Date(`${rainyDay.date}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}` : 'Use the forecast as a planning aid'}</b><p>{rainyDay ? `The service reports ${rainyDay.rainMm} mm of forecast rain for that date. Check drainage and field moisture before planning irrigation; local conditions may differ.` : 'No rainfall is listed in the returned forecast. Check soil moisture before irrigating; forecast detail may not reflect your exact village.'}</p></div></div>; })()}<MetaLine source={weather.data.source} time={weather.data.fetchedAt} /></>}</Card>
  </>;
}

function PlannerPanel({ compact = false }) {
  const plan = useRequest('/planner');
  return <Card className={`planner-card ${compact ? 'planner-card-compact' : ''}`}>
    <div className="card-head planner-heading">
      <div><span className="eyebrow">PERSONALIZED FARM PLANNER</span><h2>Seven-day irrigation outlook</h2></div>
      <Link className="subtle-button" to="/profile"><UserRound size={15} />Farm details</Link>
    </div>
    {plan.loading ? <LoadingBox label="Combining your saved farm details with the forecast…" /> : plan.error ? <ErrorNotice retry={plan.load}>{plan.error}</ErrorNotice> : <>
      {plan.data.forecastUnavailable
        ? <div className="alert alert-error" role="status"><Cloud size={17} />{plan.data.forecastUnavailableMessage}</div>
        : <div className="planner-recommendation"><Droplets size={18} /><p>{plan.data.recommendation}</p></div>}
      {plan.data.forecast.length > 0 && <div className="planner-days" aria-label="Seven-day rainfall forecast">
        {plan.data.forecast.map(day => <div className="planner-day" key={day.date}>
          <span>{new Date(`${day.date}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'short' })}</span>
          <b>{Number.isFinite(day.rainMm) ? `${day.rainMm} mm` : '—'}</b>
          <small>{Number.isFinite(day.maxC) ? `${Math.round(day.maxC)}°C max` : 'Temperature unavailable'} · {day.conditions}</small>
        </div>)}
      </div>}
      {plan.data.alerts.length > 0 && <div className="planner-alerts">
        <h3>Weather and farming risks</h3>
        {plan.data.alerts.slice(0, compact ? 3 : 8).map(alert => <article className={`planner-alert planner-alert-${alert.severity}`} key={alert.id}>
          <div><b>{alert.title}</b><span>{alert.affectedCrop} · {alert.period} · {alert.severity}</span></div>
          <p>{alert.reason}</p><p>{alert.action}</p><small>Source: {alert.source}</small>
        </article>)}
      </div>}
      {plan.data.alerts.length === 0 && plan.data.forecast.length > 0 && <p className="small-muted">No configured general weather threshold was met. Thresholds are not crop- or region-specific and do not guarantee safe field conditions.</p>}
      {plan.data.alerts.length > 0 && <p className="small-muted">These are general configurable weather indicators, not crop-specific or regional risk diagnoses.</p>}
      {plan.data.missingInformation.length > 0 && <div className="planner-missing"><b>Information that would improve this plan</b><span>{plan.data.missingInformation.join(' · ')}</span></div>}
      {plan.data.soilMoisture && <p className="planner-measurement">Soil moisture: {plan.data.soilMoisture.percent}% · entered by you on {plan.data.soilMoisture.measuredAt}. This is not a live sensor reading.</p>}
      {plan.data.reviewDays.length > 0 && <p className="planner-review-days">Soil-moisture review days: {plan.data.reviewDays.map(day => day.date).join(', ')}. These are review prompts, not irrigation instructions.</p>}
      <MetaLine source={plan.data.forecastSource || 'Weather forecast unavailable'} time={plan.data.fetchedAt} />
    </>}
  </Card>;
}

function MarketsPage() {
  const { farmer } = useFarm();
  const [filters, setFilters] = useState({ commodity: '', market: '', state: farmer?.state || '', district: farmer?.district || '' });
  const [result, setResult] = useState(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  async function search(event) { event?.preventDefault(); setLoading(true); setError(''); try { const { data } = await api.get('/mandi/compare', { params: filters }); setResult(data); } catch (e) { setResult(null); setError(errorMessage(e)); } finally { setLoading(false); } }
  useEffect(() => { search(); }, []);
  return <><PageTitle eyebrow="MARKET INTELLIGENCE" title="Know the mandi price" description="Browse reported prices from the official market data source. Each record carries its market date." />
    <Card className="content-card"><form onSubmit={search} className="filter-form"><Field label="Crop or commodity" placeholder="e.g. Tomato" value={filters.commodity} onChange={commodity => setFilters({ ...filters, commodity })} /><Field label="Market" placeholder="Optional market name" value={filters.market} onChange={market => setFilters({ ...filters, market })} /><Field label="State" placeholder="e.g. Karnataka" value={filters.state} onChange={state => setFilters({ ...filters, state })} /><Field label="District" placeholder="e.g. Mysuru" value={filters.district} onChange={district => setFilters({ ...filters, district })} /><button className="primary-button search-button" disabled={loading}>{loading ? <LoaderCircle className="spin" size={17} /> : null}Search prices</button></form>
      {loading && <LoadingBox label="Fetching reported market records…" />}{error && !loading && <ErrorNotice retry={search}>{error}</ErrorNotice>}
      {!loading && !error && result && <><div className="results-heading"><div><span className="eyebrow">{result.total} RECORDS</span><h2>Available mandi prices</h2></div><span className="rupee-note">Unit shown only when reported</span></div>
        {result.records.length ? <div className="table-wrap"><table><thead><tr><th>Commodity</th><th>Mandi</th><th>Market date</th><th>Min</th><th>Max</th><th>Modal</th><th>Unit</th></tr></thead><tbody>{result.records.map((row, i) => <tr key={`${row.market}-${row.commodity}-${row.marketDate}-${i}`}><td><b>{row.commodity || '—'}</b></td><td>{row.market || '—'}<small>{row.district}{row.state ? `, ${row.state}` : ''}</small></td><td>{row.marketDate || 'Not reported'}</td><td>{formatRupees(row.minPrice)}</td><td>{formatRupees(row.maxPrice)}</td><td className="modal-price">{formatRupees(row.modalPrice)}</td><td>{row.priceUnit || 'Not reported'}</td></tr>)}</tbody></table></div> : <div className="empty-state"><BadgeIndianRupee size={28} /><h3>No records found</h3><p>Try a wider location or a different crop. No price is estimated when records are missing.</p></div>}
        <MandiTrendCharts trends={result.trends || []} source={result.source} />
        <MetaLine source={result.source} time={result.fetchedAt} />
      </>}
    </Card>
  </>;
}
function MandiTrendCharts({ trends, source }) {
  return <section className="mandi-trends" aria-labelledby="mandi-trend-title">
    <div className="results-heading"><div><span className="eyebrow">HISTORICAL RECORDS</span><h2 id="mandi-trend-title">Comparable price trends</h2></div></div>
    {trends.length === 0
      ? <p className="small-muted">No chart shown: at least two dated records with the same commodity, market, variety, grade, and reported unit are required.</p>
      : <div className="mandi-trend-grid">{trends.map((trend, index) => {
        const values = trend.series.map(point => point.modalPrice);
        const minimum = Math.min(...values);
        const range = Math.max(...values) - minimum || 1;
        const first = trend.series[0];
        const latest = trend.series[trend.series.length - 1];
        const points = trend.series.map((point, pointIndex) => {
          const x = trend.series.length < 2 ? 140 : 8 + pointIndex * (264 / (trend.series.length - 1));
          const y = 52 - ((point.modalPrice - minimum) / range) * 44;
          return `${x},${y}`;
        }).join(' ');
        return <article className="mandi-trend-card" key={`${trend.market}-${trend.commodity}-${trend.priceUnit}-${index}`}>
          <div className="mandi-trend-title"><b>{trend.commodity} · {trend.market}</b><span>{trend.variety || 'Variety not reported'} · {trend.grade || 'Grade not reported'}</span></div>
          <svg className="mandi-trend-line" viewBox="0 0 280 60" role="img" aria-label={`${trend.commodity} modal price trend at ${trend.market}`}>
            <polyline points={points} fill="none" stroke="#648767" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="mandi-trend-change"><span>{formatRupees(first.modalPrice)} ({first.date}) → {formatRupees(latest.modalPrice)} ({latest.date})</span><b>{trend.change >= 0 ? '+' : ''}{formatRupees(trend.change)}{trend.changePercent == null ? '' : ` (${trend.changePercent.toFixed(1)}%)`}</b></div>
          <small>{trend.priceUnit} · same-market records from {source}</small>
        </article>;
      })}</div>}
  </section>;
}
function SchemesPage() {
  const { farmer } = useFarm();
  const language = supportedLanguages.has(farmer?.preferredLanguage) ? farmer.preferredLanguage : 'en';
  const copy = localizedCopy(schemesCopy, language);
  const detailLabels = localizedCopy(schemeDetailLabels, language);
  const extraLabels = localizedCopy(schemeExtraLabels, language);
  const [query, setQuery] = useState('');
  const [state, setState] = useState(farmer?.state || '');
  const [category, setCategory] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const detailRequestRef = useRef(0);

  async function load() {
    setLoading(true); setError('');
    try {
      const params = { state: state || '', category };
      const { data } = query.trim()
        ? await api.get('/schemes/search', { params: { ...params, q: query.trim() } })
        : await api.get('/schemes', { params });
      setResult(data);
    } catch (e) { setResult(null); setError(errorMessage(e)); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  function categoryLabel(value) {
    return value === 'income-support' ? copy.income : value === 'crop-insurance' ? copy.insurance : value === 'water-management' ? copy.water : value;
  }

  async function loadDetails(id, contentLanguage) {
    const requestId = ++detailRequestRef.current;
    setDetailLoading(true);
    setDetailError('');
    try {
      const { data } = await api.get(`/schemes/${encodeURIComponent(id)}`, { params: { language: contentLanguage } });
      if (requestId === detailRequestRef.current) setSelected(data.scheme);
    } catch (e) {
      if (requestId === detailRequestRef.current) setDetailError(errorMessage(e));
    } finally {
      if (requestId === detailRequestRef.current) setDetailLoading(false);
    }
  }

  function showDetails(scheme) {
    setSelected(scheme);
    loadDetails(scheme.id, language);
  }

  function closeDetails() {
    detailRequestRef.current += 1;
    setSelected(null);
    setDetailLoading(false);
    setDetailError('');
  }

  return <><PageTitle eyebrow={copy.eyebrow} title={copy.title} description={copy.description} action={result?.dataType === 'verified-catalogue' ? <span className="scheme-data-badge"><ShieldCheck size={14} />{extraLabels.catalogue} · {result.verificationDate}</span> : null} />
    <Card className="scheme-catalogue-card">
      <form className="scheme-filter-form" onSubmit={event => { event.preventDefault(); load(); }}>
        <label className="field scheme-search-field"><span>{copy.search}</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder={language === 'kn' ? 'ಯೋಜನೆಯ ಹೆಸರು ಅಥವಾ ವಿಭಾಗ' : language === 'hi' ? 'योजना का नाम या श्रेणी' : 'Scheme name or keyword'} /></label>
        <label className="field"><span>{copy.state}</span><select value={state} onChange={event => setState(event.target.value)}><option value="">{copy.allStates}</option><option value="Karnataka">{extraLabels.karnataka}</option><option value="All India">{extraLabels.allIndia}</option></select></label>
        <label className="field"><span>{copy.category}</span><select value={category} onChange={event => setCategory(event.target.value)}><option value="">{copy.allCategories}</option><option value="income-support">{copy.income}</option><option value="crop-insurance">{copy.insurance}</option><option value="water-management">{copy.water}</option></select></label>
        <button className="primary-button scheme-search-button" type="submit" disabled={loading}>{loading ? <LoaderCircle className="spin" size={16} /> : null}{copy.search}</button>
      </form>
      {loading ? <LoadingBox label={copy.loading} /> : error ? <ErrorNotice retry={load}>{error}</ErrorNotice> : <>
        {result?.schemes?.length ? <div className="scheme-grid">{result.schemes.map(scheme => <article className="scheme-card" key={scheme.id}>
          <div className="scheme-card-head"><span className="scheme-level"><Landmark size={14} />{scheme.level === 'Central' ? copy.central : copy.stateScheme}</span><span className="scheme-category">{categoryLabel(scheme.category)}</span></div>
          {scheme.potentiallyRelevant && <span className="scheme-relevance-badge">{copy.relevant} · {detailLabels.notEligibility}</span>}
          {scheme.translation?.status === 'translated' && <span className="scheme-translation-badge">{detailLabels.translatedNotice}</span>}
          <h2>{scheme.name}</h2><p>{scheme.description}</p>
          <div className="scheme-audience"><b>{scheme.intendedFor}</b><span>{scheme.states.map(value => value === 'All India' ? extraLabels.allIndia : value === 'Karnataka' ? extraLabels.karnataka : value).join(', ')}</span></div>
          <div className="scheme-card-actions"><button type="button" className="primary-button" onClick={() => showDetails(scheme)}>{copy.details}<ArrowRight size={15} /></button><a className="subtle-button" href={scheme.informationUrl} target="_blank" rel="noreferrer">{copy.official}<ArrowRight size={15} /></a></div>
        </article>)}</div> : <div className="empty-state scheme-empty"><Landmark size={28} /><h3>{copy.noResults}</h3><p>Check the official myScheme portal for current records.</p><a className="primary-button" href={result?.mySchemeUrl || 'https://www.myscheme.gov.in/'} target="_blank" rel="noreferrer">{copy.myScheme}<ArrowRight size={16} /></a></div>}
      </>}
    </Card>
    {selected && <div className="scheme-detail-overlay" role="dialog" aria-modal="true" aria-label={selected.name} onMouseDown={event => { if (event.target === event.currentTarget) closeDetails(); }}><Card className="scheme-detail-card">
      <div className="scheme-detail-head"><div><span className="eyebrow">{categoryLabel(selected.category)} · {selected.level}</span><h2>{selected.name}</h2></div><button type="button" className="subtle-button" onClick={closeDetails}>{copy.close}</button></div>
      <div className="scheme-language-switch" role="group" aria-label="Scheme detail language">
        <button type="button" className={selected.contentLanguage === language ? 'scheme-language-active' : ''} onClick={() => loadDetails(selected.id, language)} disabled={detailLoading}>{copy.preferred}</button>
        {language !== 'en' && <button type="button" className={selected.contentLanguage === 'en' ? 'scheme-language-active' : ''} onClick={() => loadDetails(selected.id, 'en')} disabled={detailLoading}>{copy.original}</button>}
      </div>
      {detailLoading ? <LoadingBox label={copy.loading} /> : detailError ? <><ErrorNotice>{detailError}</ErrorNotice><p className="scheme-detail-description">{selected.description}</p><a href={selected.informationUrl} target="_blank" rel="noreferrer">{copy.official}</a></> : <>
      <p className="scheme-detail-description">{selected.description}</p>
      {selected.translation?.status === 'translated' && <p className="scheme-detail-language">{detailLabels.translatedNotice}</p>}
      {['unavailable', 'stale'].includes(selected.translation?.status) && <p className="scheme-detail-language">{detailLabels.unavailableNotice}</p>}
      <div className="scheme-detail-grid">
        <section><h3>{copy.requirements}</h3><p><b>{detailLabels.intendedFor}:</b> {selected.intendedFor}</p><p><b>{detailLabels.eligibility}:</b> {selected.eligibility}</p></section>
        <section><h3>{detailLabels.benefits}</h3><p>{selected.benefits}</p></section>
        <section><h3>{detailLabels.documents}</h3><p>{selected.documents}</p></section>
        <section><h3>{copy.apply}</h3><p>{selected.application}</p></section>
      </div>
      <div className="scheme-source"><ShieldCheck size={16} /><div><b>{copy.source}</b><p>{selected.department}</p><span>{extraLabels.verified} {selected.verificationDate}</span><a href={selected.translation?.sourceUrl || selected.informationUrl} target="_blank" rel="noreferrer">{selected.translation?.sourceUrl || selected.informationUrl}</a></div></div>
      <div className="scheme-detail-actions"><a className="primary-button" href={selected.applicationUrl} target="_blank" rel="noreferrer">{copy.apply}<ArrowRight size={16} /></a><a className="subtle-button" href={selected.informationUrl} target="_blank" rel="noreferrer">{copy.official}<ArrowRight size={16} /></a></div>
      </>}
    </Card></div>}
  </>;
}

function formatRupees(value) { return value == null ? '—' : `₹${Number(value).toLocaleString('en-IN')}`; }

function AdviceResult({ result, title = 'Saathi’s guidance' }) { return result ? <Card className="result-card"><div className="result-head"><span className="result-icon"><Leaf size={18} /></span><div><span className="eyebrow">AI-GENERATED GUIDANCE</span><h3>{title}</h3></div><span className="ai-pill">{result.source}</span></div><div className="answer-text">{result.answer}</div><div className="result-disclaimer"><ShieldCheck size={15} />General guidance can be incomplete. Check local conditions and consult an agriculture expert for important decisions.</div><MetaLine source={result.source} time={result.generatedAt} /></Card> : null; }
function AdviceForm({ endpoint, submitLabel, title, children, buildBody, requireFile = false }) {
  const [result, setResult] = useState(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  async function submit(event) { event.preventDefault(); setError(''); setLoading(true); try { const { data } = await api.post(endpoint, buildBody(event.currentTarget), requireFile ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined); setResult(data); } catch (e) { setError(errorMessage(e)); } finally { setLoading(false); } }
  return <><Card className="form-card"><form onSubmit={submit} className="form-stack">{children}{error && <ErrorNotice>{error}</ErrorNotice>}<button disabled={loading} className="primary-button form-submit">{loading ? <LoaderCircle className="spin" size={17} /> : null}{submitLabel}<ArrowRight size={17} /></button></form></Card>{result && <AdviceResult result={result} title={title} />}</>;
}

function CropsPage() {
  const { farmer } = useFarm();
  return <><PageTitle eyebrow="CROP ADVISOR" title="Explore what may grow well" description="Suggestions use only the farm details you’ve supplied. Missing soil or weather information is not filled in." />
    <div className="two-column-layout"><div className="side-context"><Card className="profile-context"><div className="context-top"><span className="feature-icon"><Sprout size={19} /></span><span className="eyebrow">YOUR FARM DETAILS</span></div><h3>{farmer?.village || farmer?.district || 'Location not set'}</h3><p>{[farmer?.district, farmer?.state].filter(Boolean).join(', ') || 'Add your location to personalize crop guidance.'}</p><div className="context-list"><ContextRow label="Soil" value={farmer?.soil?.type || 'Not provided'} /><ContextRow label="Farm size" value={farmer?.farmSize ? `${farmer.farmSize} acres` : 'Not provided'} /><ContextRow label="Current crops" value={farmer?.currentCrops?.join(', ') || 'Not provided'} /><ContextRow label="Water" value={farmer?.irrigationFacilities?.join(', ') || 'Not provided'} /></div><Link className="text-link" to="/profile">Update farm details <ArrowRight size={15} /></Link></Card><div className="safety-note"><ShieldCheck size={18} /><div><b>Information may be incomplete</b><p>AI advice is a starting point. Confirm planting choices with local agricultural guidance and current conditions.</p></div></div></div>
      <AdviceForm endpoint="/ai/crop-recommendations" title="Crop suggestions" submitLabel="Get crop ideas" buildBody={form => ({ details: form.elements.details.value })}><label className="field"><span>What are you planning for?</span><textarea name="details" rows="5" placeholder="For example: planning a crop for the coming monsoon, limited irrigation, harvested groundnut last season…" /></label><p className="field-hint">Optional: add season, planting plans or field observations. Soil measurements are read from your profile only if you entered them.</p></AdviceForm>
    </div></>;
}
function ContextRow({ label, value }) { return <div className="context-row"><span>{label}</span><b>{value}</b></div>; }

function AssistantPage() {
  const { farmer, setFarmer } = useFarm();
  const navigate = useNavigate();
  const language = supportedLanguages.has(farmer?.preferredLanguage) ? farmer.preferredLanguage : 'en';
  const copy = localizedCopy(assistantCopy, language);
  const firstName = farmer?.name?.split(' ')[0] || '';
  const serviceText = localizedCopy(serviceCopy, language);
  const greeting = `${serviceText.greeting(firstName)} ${serviceText.intro}`;
  const [messages, setMessages] = useState([{ role: 'assistant', answer: greeting }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [playingAudio, setPlayingAudio] = useState(false);
  const [speechError, setSpeechError] = useState('');
  const [locationRequest, setLocationRequest] = useState('');
  const [locationToConfirm, setLocationToConfirm] = useState('');
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const discardRecordingRef = useRef(false);
  const recordingTimerRef = useRef(null);
  const transcriptionAbortRef = useRef(null);
  const speechAbortRef = useRef(null);
  const audioRef = useRef(null);
  const audioCacheRef = useRef(new Map());
  const playbackRequestRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimeout(recordingTimerRef.current);
      transcriptionAbortRef.current?.abort();
      speechAbortRef.current?.abort();
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
      chunksRef.current = [];
      releaseMicrophone();
      stopAudio(false);
      for (const url of audioCacheRef.current.values()) URL.revokeObjectURL(url);
      audioCacheRef.current.clear();
      stopSpeaking();
    };
  }, []);

  function handleVoiceCommand(message) {
    const text = message.toLocaleLowerCase();
    if (/^(repeat|दोहराएं|पुनः सुनाएं|ಮತ್ತೆ ಹೇಳಿ|ಮತ್ತೆ ಕೇಳಿ|மீண்டும்|మళ్ళీ వినండి|पुन्हा सांगा|আবার শুনুন|ફરી સાંભળો|വീണ്ടും കേൾക്കുക|ਮੁੜ ਸੁਣੋ|ପୁଣି ଶୁଣନ୍ତୁ|পুনৰ শুনক|دوبارہ سنیں)$/.test(text)) {
      const lastAssistant = [...messages].reverse().find(item => item.role === 'assistant');
      if (lastAssistant) speak(lastAssistant.answer);
      return true;
    }
    if (/^(home|main menu|मुख्य पृष्ठ|होम|ಮುಖ್ಯ ಪುಟ|ಹೋಮ್|முகப்பு|ప్రధాన పేజీ|প্রধান পাতা|ਮੁੱਖ ਪੰਨਾ|مرکزی صفحہ)$/.test(text)) { navigate('/dashboard'); return true; }
    if (/^(stop speaking|रुकिए|बोलना बंद करें|ಮಾತು ನಿಲ್ಲಿಸಿ|ನಿಲ್ಲಿಸಿ|நிறுத்து|ఆపండి|थांबवा|বন্ধ করুন|બંધ કરો|നിർത്തുക|ਬੰਦ ਕਰੋ|ବନ୍ଦ କରନ୍ତୁ|কোৱা বন্ধ কৰক|بولنا بند کریں)$/.test(text)) { stopAudio(); return true; }
    if (/^(new conversation|नई बातचीत|ಹೊಸ ಸಂಭಾಷಣೆ|புதிய உரையாடல்|కొత్త సంభాషణ|नवीन संभाषण|নতুন বার্তালাপ|નવી વાતચીત|പുതിയ സംഭാഷണം|ਨਵੀਂ ਗੱਲਬਾਤ|ନୂଆ କଥାବାର୍ତ୍ତା|নতুন কথোপকথন|نئی گفتگو)$/.test(text)) { startNewConversation(); return true; }
    if (/weather|हवामान|मौसम|ಹವಾಮಾನ|வானிலை|వాతావరణం|আবহাওয়া|હવામાન|കാലാവസ്ഥ|ਮੌਸਮ|ପାଣିପାଗ|বতৰ|موسم/.test(text)) { navigate('/weather'); return true; }
    if (/mandi|market|भाव|मंडी|ಬೆಲೆ|ಮಾರುಕಟ್ಟೆ|சந்தை|మార్కెట్|বাজার|બજાર|വിപണി|ਮੰਡੀ|ମଣ୍ଡି|বজাৰ|منڈی/.test(text)) { navigate('/markets'); return true; }
    if (/crop disease|crop problem|रोग|बीमारी|ಬೆಳೆ ಸಮಸ್ಯೆ|ರೋಗ|நோய்|తెగులు|कीड|রোগ|રોગ|രോഗം|ਬਿਮਾਰੀ|ରୋଗ|ৰোগ|بیماری/.test(text)) { navigate('/disease'); return true; }
    if (/irrigation|supply|सिंचाई|पानी|ನೀರಾವರಿ|நீர்ப்பாசனம்|నీటిపారుదల|सिंचन|সেচ|સિંચાઈ|ജലസേചനം|ਸਿੰਚਾਈ|ଜଳସେଚନ|জলসিঞ্চন|آبپاشی/.test(text)) { navigate('/irrigation'); return true; }
    if (/crop recommendation|choose crop|फसल चुन|फसल सलाह|ಬೆಳೆ ಆಯ್ಕೆ|ಬೆಳೆ ಸಲಹೆ|பயிர்|పంట|पीक सल्ला|ফসল|પાક|വിള|ਫ਼ਸਲ|ଫସଲ|শস্য|فصل/.test(text)) { navigate('/crops'); return true; }
    return false;
  }

  async function speak(text) {
    setSpeechError('');
    const voice = languageConfig[language]?.sarvamTts;
    if (!voice) {
      setSpeechError(copy.speechUnavailable);
      return;
    }
    if (!text || text.length > 2500) {
      setSpeechError(copy.speechTooLong);
      return;
    }

    stopAudio();
    const requestId = playbackRequestRef.current;
    const cacheKey = `${language}:${text}`;
    let url = audioCacheRef.current.get(cacheKey);
    try {
      if (!url) {
        const controller = new AbortController();
        speechAbortRef.current = controller;
        const response = await api.post('/voice/speak', { text }, {
          responseType: 'blob',
          timeout: 45000,
          signal: controller.signal
        });
        if (!response.data?.size) throw new Error('Empty audio response');
        url = URL.createObjectURL(response.data);
        audioCacheRef.current.set(cacheKey, url);
        while (audioCacheRef.current.size > 3) {
          const oldestKey = audioCacheRef.current.keys().next().value;
          URL.revokeObjectURL(audioCacheRef.current.get(oldestKey));
          audioCacheRef.current.delete(oldestKey);
        }
      }
      if (!mountedRef.current || requestId !== playbackRequestRef.current) return;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        if (audioRef.current === audio) audioRef.current = null;
        if (mountedRef.current) setPlayingAudio(false);
      };
      audio.onerror = () => {
        if (audioRef.current === audio) audioRef.current = null;
        if (mountedRef.current) {
          setPlayingAudio(false);
          setSpeechError(copy.speechError);
        }
      };
      await audio.play();
      if (mountedRef.current) setPlayingAudio(true);
    } catch (playbackError) {
      if (playbackError?.name !== 'CanceledError' && playbackError?.name !== 'AbortError' && mountedRef.current) {
        setSpeechError(playbackError?.response ? errorMessage(playbackError) : copy.speechError);
      }
    }
  }

  function stopAudio(updateState = true) {
    playbackRequestRef.current += 1;
    speechAbortRef.current?.abort();
    speechAbortRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (updateState && mountedRef.current) setPlayingAudio(false);
  }

  function releaseMicrophone() {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }

  async function sendText(message, bypassLocationConfirmation = false) {
    const text = String(message || '').trim();
    if (!text || (loading && !bypassLocationConfirmation)) return;
    if (locationRequest && !bypassLocationConfirmation) {
      setInput('');
      setMessages(old => [...old, { role: 'user', answer: text }, { role: 'assistant', answer: copy.confirmLocation(text) }]);
      setLocationToConfirm(text);
      return;
    }
    if (!bypassLocationConfirmation && handleVoiceCommand(text)) return;
    setInput('');
    setError('');
    setSpeechError('');
    setMessages(old => [...old, { role: 'user', answer: text }]);
    setLoading(true);
    try {
      const history = [...messages, { role: 'user', answer: text }].slice(-8).map(item => ({ role: item.role, text: item.answer }));
      const { data } = await api.post('/ai/ask', { message: text, history });
      setMessages(old => [...old, { role: 'assistant', answer: data.answer }]);
      if (data.action === 'open_schemes') navigate('/schemes');
      if (data.action === 'ask_location') setLocationRequest(text);
    } catch (e) { setError(errorMessage(e)); }
    finally { setLoading(false); }
  }

  async function send(event) {
    event?.preventDefault();
    await sendText(input);
  }

  async function startListening() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setSpeechError(copy.voiceUnsupported);
      return;
    }
    const langDef = languageConfig[language];
    if (langDef && !langDef.sttSupported) {
      setSpeechError(copy.voiceUnsupported);
      return;
    }
    setSpeechError('');
    stopAudio();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mountedRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      streamRef.current = stream;
      discardRecordingRef.current = false;
      const preferredType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
        .find(type => MediaRecorder.isTypeSupported?.(type));
      const recorder = preferredType ? new MediaRecorder(stream, { mimeType: preferredType }) : new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = event => {
        if (event.data?.size) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        clearTimeout(recordingTimerRef.current);
        discardRecordingRef.current = true;
        chunksRef.current = [];
        releaseMicrophone();
        if (mountedRef.current) {
          setListening(false);
          setSpeechError(copy.voiceError);
        }
      };
      recorder.onstop = async () => {
        clearTimeout(recordingTimerRef.current);
        const discardRecording = discardRecordingRef.current;
        discardRecordingRef.current = false;
        const chunks = chunksRef.current;
        chunksRef.current = [];
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        const mimetype = blob.type.split(';')[0].toLowerCase();
        releaseMicrophone();
        if (!mountedRef.current || discardRecording) return;
        setListening(false);
        if (!blob.size) {
          setSpeechError(copy.voiceError);
          return;
        }
        if (blob.size > 5 * 1024 * 1024) {
          setSpeechError(copy.clipTooLarge);
          return;
        }
        const formData = new FormData();
        const extension = mimetype === 'audio/mp4' ? 'm4a' : 'webm';
        formData.append('audio', blob, `recording.${extension}`);
        const controller = new AbortController();
        transcriptionAbortRef.current = controller;
        setTranscribing(true);
        try {
          const { data } = await api.post('/voice/transcribe', formData, {
            timeout: 45000,
            signal: controller.signal
          });
          if (!mountedRef.current) return;
          setInput(data.transcript || '');
          setSpeechError(data.transcript ? copy.reviewSpeech : copy.voiceError);
        } catch (transcriptionError) {
          if (transcriptionError?.name !== 'CanceledError' && transcriptionError?.name !== 'AbortError' && mountedRef.current) {
            setSpeechError(errorMessage(transcriptionError));
          }
        } finally {
          if (mountedRef.current) setTranscribing(false);
        }
      };
      recorder.start(250);
      setListening(true);
      recordingTimerRef.current = window.setTimeout(() => {
        if (recorder.state === 'recording') recorder.stop();
      }, 28_000);
    } catch {
      releaseMicrophone();
      setListening(false);
      setSpeechError(copy.voiceError);
    }
  }

  function stopListening() {
    clearTimeout(recordingTimerRef.current);
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    else {
      releaseMicrophone();
      setListening(false);
    }
  }

  function startNewConversation() {
    if (recorderRef.current?.state === 'recording') discardRecordingRef.current = true;
    stopListening();
    transcriptionAbortRef.current?.abort();
    setTranscribing(false);
    stopAudio();
    setMessages([{ role: 'assistant', answer: greeting }]);
    setInput('');
    setError('');
    setSpeechError('');
    setLocationRequest('');
    setLocationToConfirm('');
  }

  async function confirmLocation() {
    if (!locationToConfirm) return;
    const originalRequest = locationRequest;
    setLoading(true);
    try {
      const { data } = await api.put(`/farmers/profile/${farmer._id}`, { village: locationToConfirm });
      setFarmer(data.farmer);
      setMessages(old => [...old, { role: 'assistant', answer: copy.saved(locationToConfirm) }]);
      setLocationRequest('');
      setLocationToConfirm('');
      await sendText(originalRequest, true);
    } catch (e) { setError(errorMessage(e)); }
    finally { setLoading(false); }
  }

  function cancelLocation() {
    setMessages(old => [...old, { role: 'assistant', answer: copy.cancel }]);
    setLocationRequest('');
    setLocationToConfirm('');
  }

  const lastAssistant = [...messages].reverse().find(item => item.role === 'assistant');
  return <><PageTitle eyebrow={copy.eyebrow} title={copy.title} description={copy.description} action={<span className="language-badge"><Globe2 size={15} />{languageConfig[language]?.nativeName || languageConfig.en.nativeName}</span>} />
    <Card className="chat-card">
      <div className="chat-heading"><span className="assistant-avatar"><Leaf size={19} /></span><div><b>Saathi</b><span>{copy.eyebrow} · {languageConfig[language]?.nativeName || languageConfig.en.nativeName}</span></div><span className="chat-status"><span className="status-dot" />{copy.ready}</span></div>
      <div className="assistant-actions" aria-label="Assistant actions">
        <button type="button" onClick={() => lastAssistant && speak(lastAssistant.answer)}><Volume2 size={16} />{copy.listen}</button>
        <button type="button" onClick={() => lastAssistant && speak(lastAssistant.answer)}><Volume2 size={16} />{copy.repeat}</button>
        <button type="button" onClick={() => stopAudio()}><VolumeX size={16} />{copy.stopSpeaking}</button>
        <button type="button" onClick={startNewConversation}><Plus size={16} />{copy.newConversation}</button>
        <button type="button" onClick={() => navigate('/dashboard')}><House size={16} />{copy.home}</button>
      </div>
      <div className="message-list">{messages.map((message, i) => <div key={i} className={`message-row ${message.role === 'user' ? 'message-user' : ''}`}><div className="message-avatar">{message.role === 'assistant' ? <Leaf size={14} /> : <UserRound size={14} />}</div><div className="message-content"><div className={`message-bubble ${message.role === 'user' ? 'bubble-user' : ''}`}>{message.answer}</div>{message.role === 'assistant' && <button className="speak-button" type="button" onClick={() => speak(message.answer)}><Volume2 size={14} />{copy.listen}</button>}</div></div>)}{loading && <div className="typing-indicator"><span /><span /><span /> Saathi is thinking…</div>}</div>
      {locationToConfirm && <div className="location-confirm"><button className="primary-button" type="button" onClick={confirmLocation}><Check size={17} />{copy.confirm}</button><button className="subtle-button" type="button" onClick={cancelLocation}>{copy.change}</button></div>}
      {error && <div className="chat-error"><ErrorNotice>{error}</ErrorNotice></div>}
      {(speechError || (!languageConfig[language]?.sarvamTts && !speechError)) && <p className="chat-speech-notice" role="status">{speechError || copy.speechUnavailable}</p>}
      <form className="chat-composer" onSubmit={send}>
        <button className={`mic-button ${listening ? 'mic-listening' : ''}`} type="button" onClick={listening ? stopListening : startListening} disabled={loading || transcribing} aria-label={listening ? copy.stopListening : transcribing ? copy.transcribing : copy.microphone}>{listening ? <MicOff size={18} /> : transcribing ? <LoaderCircle className="spin" size={18} /> : <Mic size={18} />}</button>
        <input value={input} onChange={e => setInput(e.target.value)} placeholder={copy.composer} aria-label={copy.composer} />
        <button className="send-button" disabled={!input.trim() || loading || listening || transcribing} aria-label={copy.send}><Send size={18} /></button>
      </form>
      <div className="composer-note">{transcribing ? copy.transcribing : listening ? copy.listening : copy.voicePrivacy}{playingAudio ? ` ${copy.stopSpeaking}.` : ''}</div>
    </Card>
  </>;
}

function IrrigationPage() {
  return <><PageTitle eyebrow="WATER PLANNING" title="Think through irrigation" description="Get a cautious checklist based on your crop, stage and any rainfall information you share." />
    <PlannerPanel />
    <div className="two-column-layout"><div className="side-context"><Card className="irrigation-info"><span className="feature-icon"><Droplets size={20} /></span><h3>Before you water</h3><div className="check-list"><div><Check size={15} /><span>Check soil moisture at the root zone.</span></div><div><Check size={15} /><span>Account for recent and expected rain.</span></div><div><Check size={15} /><span>Use the crop’s growth stage as a guide.</span></div><div><Check size={15} /><span>Follow local agriculture advice for exact timing.</span></div></div><p>Saathi won’t estimate a soil moisture reading or give a precise schedule from missing data.</p></Card></div>
      <AdviceForm endpoint="/ai/irrigation" title="Irrigation guidance" submitLabel="Get irrigation guidance" buildBody={form => ({ crop: form.elements.crop.value, growthStage: form.elements.stage.value, rainfall: form.elements.rainfall.value })}>
        <Field label="Crop" name="crop" placeholder="e.g. Cotton" value={undefined} onChange={() => {}} />
        <label className="field"><span>Growth stage</span><select name="stage" defaultValue=""><option value="">Select if known</option><option>Recently sown</option><option>Vegetative growth</option><option>Flowering</option><option>Fruit or grain formation</option><option>Near harvest</option></select></label>
        <Field label="Expected or recent rainfall" placeholder="e.g. Moderate rain yesterday" value={undefined} onChange={() => {}} name="rainfall" />
        <p className="field-hint">Farm profile information, including soil type and water access, is also shared with the AI when available.</p>
      </AdviceForm>
    </div></>;
}

function DiseasePage() {
  const [fileName, setFileName] = useState('');
  const [image, setImage] = useState(null);
  const [imageError, setImageError] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  useEffect(() => {
    if (!image) { setPreviewUrl(''); return undefined; }
    const url = URL.createObjectURL(image);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);
  function chooseImage(event) {
    const selected = event.target.files?.[0] || null;
    if (selected && !['image/jpeg', 'image/png', 'image/webp'].includes(selected.type)) {
      event.target.value = '';
      setImage(null);
      setFileName('');
      setImageError('Choose a JPG, PNG, or WebP image.');
      return;
    }
    if (selected && selected.size > 5 * 1024 * 1024) {
      event.target.value = '';
      setImage(null);
      setFileName('');
      setImageError('Image must be 5 MB or smaller.');
      return;
    }
    setImage(selected);
    setFileName(selected?.name || '');
    setImageError('');
  }
  return <><PageTitle eyebrow="CROP HEALTH" title="Describe what you see" description="Share symptoms for possible causes and safe next steps. This is not a confirmed diagnosis." />
    <div className="two-column-layout"><div className="side-context"><Card className="disease-info"><span className="disease-mark"><Activity size={20} /></span><h3>Help Saathi understand</h3><div className="symptom-examples"><span>Which crop is affected?</span><span>When did the symptoms begin?</span><span>Are there spots, insects or wilting?</span><span>Has the weather changed recently?</span></div><p>For serious damage or fast spread, contact a local agriculture expert or Krishi Vigyan Kendra.</p></Card><div className="safety-note"><ShieldCheck size={18} /><div><b>Be careful with treatments</b><p>No pesticide mixtures or unsupported dosages will be suggested.</p></div></div></div>
      <AdviceForm endpoint="/disease/analyze" requireFile title="Possible causes" submitLabel="Review symptoms" buildBody={form => { const body = new FormData(); body.append('symptoms', form.elements.symptoms.value); if (form.elements.image.files[0]) body.append('image', form.elements.image.files[0]); return body; }}>
        <label className="field"><span>What are you noticing?</span><textarea name="symptoms" rows="6" placeholder="Describe the crop, affected parts, when it started, and any visible changes…" /></label>
        <label className="upload-box"><input name="image" type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseImage} /><span className="upload-icon"><Upload size={18} /></span><span><b>{fileName || 'Add a crop photo (optional)'}</b><small>JPG, PNG or WebP · up to 5 MB</small></span><Plus size={18} /></label>
        {imageError && <div className="alert alert-error" role="alert"><FileWarning size={17} />{imageError}</div>}
        {previewUrl && <figure className="disease-image-preview"><img src={previewUrl} alt="Preview of the selected crop photo" /><figcaption>Preview only. This image is sent for analysis only when you submit and is not saved by this page.</figcaption></figure>}
        <p className="field-hint">A photo can help, but image analysis may miss important details. Avoid including people or personal information.</p>
      </AdviceForm>
    </div></>;
}

function FarmHistoryPanel({ compact = false }) {
  const history = useRequest('/farmers/history');
  const [form, setForm] = useState(emptyActivity());
  const [editingId, setEditingId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  function resetForm() {
    setForm(emptyActivity());
    setEditingId('');
    setError('');
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const request = editingId
        ? api.put(`/farmers/history/${editingId}`, form)
        : api.post('/farmers/history', form);
      await request;
      setNotice(editingId ? 'Farm record updated.' : 'Farm record saved.');
      resetForm();
      await history.load();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setBusy(false);
    }
  }

  async function remove(activity) {
    if (!window.confirm(`Remove this ${activity.eventType} record for ${activity.crop}?`)) return;
    setError('');
    setNotice('');
    try {
      await api.delete(`/farmers/history/${activity.id}`);
      setNotice('Farm record removed.');
      if (editingId === activity.id) resetForm();
      await history.load();
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  }

  const activities = history.data?.activities || [];
  return <Card className="farm-history-card">
    <div className="card-head"><div><span className="eyebrow">FARM PROGRESS</span><h2>{compact ? 'Recent farm activity' : 'Farm activity history'}</h2></div>{compact && <Link className="text-link" to="/profile">Manage records <ArrowRight size={14} /></Link>}</div>
    {!compact && <form className="farm-activity-form" onSubmit={submit}>
      <div className="field-grid three-fields">
        <Field label="Crop" value={form.crop} onChange={crop => setForm(old => ({ ...old, crop }))} maxLength={100} required />
        <label className="field"><span>Activity</span><select value={form.eventType} onChange={event => setForm(old => ({ ...old, eventType: event.target.value }))}>
          <option value="sowing">Sowing</option><option value="irrigation">Irrigation</option><option value="fertilizer">Fertilizer application</option><option value="observation">Crop observation</option><option value="disease">Disease symptoms</option><option value="harvest">Harvest / yield</option>
        </select></label>
        <Field label="Date" type="date" value={form.eventDate} onChange={eventDate => setForm(old => ({ ...old, eventDate }))} required />
      </div>
      <div className="field-grid">
        <Field label="Amount (optional)" type="number" min="0" max="999999999.999" step="any" value={form.amount} onChange={amount => setForm(old => ({ ...old, amount }))} placeholder="Only if known" />
        <Field label="Unit (optional)" value={form.unit} onChange={unit => setForm(old => ({ ...old, unit }))} maxLength={40} placeholder="e.g. kg, mm, bags" />
      </div>
      <label className="field"><span>Notes (optional)</span><textarea rows="3" maxLength="1000" value={form.notes} onChange={event => setForm(old => ({ ...old, notes: event.target.value }))} /></label>
      {error && <ErrorNotice>{error}</ErrorNotice>}{notice && <div className="alert alert-success" role="status"><Check size={16} />{notice}</div>}
      <div className="farm-history-actions"><button className="primary-button" disabled={busy}>{busy ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />}{editingId ? 'Save changes' : 'Add farm record'}</button>{editingId && <button className="subtle-button" type="button" onClick={resetForm}>Cancel edit</button>}</div>
    </form>}
    {history.loading ? <LoadingBox label="Loading your farm records…" /> : history.error ? <ErrorNotice retry={history.load}>{history.error}</ErrorNotice> : activities.length === 0
      ? <div className="empty-state"><Sprout size={24} /><p>No farm activity recorded yet. Historical information appears after you add a record.</p></div>
      : <ol className="farm-timeline">{activities.slice(0, compact ? 5 : 100).map(activity => <li key={activity.id}>
        <span className="farm-timeline-dot" />
        <div className="farm-timeline-body">
          <div className="farm-timeline-heading"><b>{activity.crop} · {activity.eventType.replaceAll('_', ' ')}</b><time dateTime={activity.eventDate}>{formatActivityDate(activity.eventDate)}</time></div>
          {activity.amount != null && <span className="farm-timeline-amount">{activity.amount} {activity.unit}</span>}
          {activity.notes && <p>{activity.notes}</p>}
        </div>
        {!compact && <div className="farm-timeline-actions">
          <button type="button" className="subtle-button" aria-label={`Edit ${activity.crop} ${activity.eventType} record`} onClick={() => { setEditingId(activity.id); setForm({ crop: activity.crop, eventType: activity.eventType, eventDate: String(activity.eventDate).slice(0, 10), amount: activity.amount ?? '', unit: activity.unit || '', notes: activity.notes || '' }); setError(''); setNotice(''); }}><Pencil size={14} />Edit</button>
          <button type="button" className="subtle-button" aria-label={`Remove ${activity.crop} ${activity.eventType} record`} onClick={() => remove(activity)}><Trash2 size={14} />Remove</button>
        </div>}
      </li>)}</ol>}
  </Card>;
}

function emptyActivity() {
  return { crop: '', eventType: 'observation', eventDate: localDateInput(), amount: '', unit: '', notes: '' };
}

function localDateInput() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatActivityDate(value) {
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function ProfilePage() {
  const { farmer, setFarmer } = useFarm();
  const [form, setForm] = useState(() => farmerToForm(farmer));
  const [saved, setSaved] = useState(false); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const languageDefinition = languageConfig[form.preferredLanguage] || languageConfig.en;
  useEffect(() => { setForm(farmerToForm(farmer)); }, [farmer]);
  const set = (key, value) => setForm(old => ({ ...old, [key]: value }));
  async function submit(event) {
    event.preventDefault(); setSaved(false); setError(''); setBusy(true);
    const body = {
      name: form.name, state: form.state, district: form.district, village: form.village,
      preferredLanguage: form.preferredLanguage, farmSize: form.farmSize ? Number(form.farmSize) : null,
      soil: { type: form.soilType, nitrogen: optionalNumber(form.nitrogen), phosphorus: optionalNumber(form.phosphorus), potassium: optionalNumber(form.potassium), ph: optionalNumber(form.ph), moisturePct: optionalNumber(form.moisturePct), moistureMeasuredAt: form.moistureMeasuredAt || undefined },
      farmPlan: { crop: form.planCrop, growthStage: form.growthStage, sowingDate: form.sowingDate, irrigationMethod: form.irrigationMethod },
      irrigationFacilities: splitList(form.irrigationFacilities), currentCrops: splitList(form.currentCrops)
    };
    try { const { data } = await api.put(`/farmers/profile/${farmer._id}`, body); setFarmer(data.farmer); setSaved(true); }
    catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  }
  return <><PageTitle eyebrow="YOUR FARM PROFILE" title="Keep your farm details close" description="Saathi uses saved details to avoid asking you the same questions again. Add only what you know." />
    <Card className="profile-form-card"><form onSubmit={submit} className="form-stack"><div className="profile-section-title"><span className="profile-section-icon"><UserRound size={18} /></span><div><h2>About you and your farm</h2><p>These details stay linked to your account.</p></div></div>
      <div className="field-grid"><Field label="Farmer name" value={form.name} onChange={v => set('name', v)} required /><Field label="Email address" value={farmer?.email || ''} onChange={() => {}} type="email" disabled /></div>
      <div className="field-grid three-fields"><Field label="State" value={form.state} onChange={v => set('state', v)} placeholder="e.g. Karnataka" /><Field label="District" value={form.district} onChange={v => set('district', v)} placeholder="e.g. Mysuru" /><Field label="Village or town" value={form.village} onChange={v => set('village', v)} placeholder="e.g. Hunsur" /></div>
      <div className="field-grid three-fields"><label className="field"><span>Preferred language</span><select value={form.preferredLanguage} onChange={e => set('preferredLanguage', e.target.value)}>{languageOptions.map(({ code, label }) => <option key={code} value={code}>{label}</option>)}</select></label><Field label="Farm size (acres)" type="number" min="0" step="0.1" value={form.farmSize} onChange={v => set('farmSize', v)} placeholder="Optional" /><Field label="Soil type" value={form.soilType} onChange={v => set('soilType', v)} placeholder="e.g. Red loam" /></div>
      <p className="field-hint">{languageDefinition.interfaceSupport === 'english-fallback'
        ? `The ${languageDefinition.nativeName} interface is not translated yet; English is shown for untranslated screens.`
        : 'Some interface sections are translated; untranslated text falls back to English.'} AI replies are requested in {languageDefinition.englishName}, but quality has not been verified for every language. Voice input and spoken output depend on browser and device support.</p>
      <div className="profile-divider" /><div className="profile-section-title"><span className="profile-section-icon"><Sprout size={18} /></span><div><h2>Soil and crop details</h2><p>Soil test values are optional. Leave them blank if you don’t know them.</p></div></div>
      <div className="field-grid four-fields"><Field label="Nitrogen (N)" type="number" min="0" value={form.nitrogen} onChange={v => set('nitrogen', v)} placeholder="Not measured" /><Field label="Phosphorus (P)" type="number" min="0" value={form.phosphorus} onChange={v => set('phosphorus', v)} placeholder="Not measured" /><Field label="Potassium (K)" type="number" min="0" value={form.potassium} onChange={v => set('potassium', v)} placeholder="Not measured" /><Field label="Soil pH" type="number" min="0" max="14" step="0.1" value={form.ph} onChange={v => set('ph', v)} placeholder="Not measured" /></div>
      <div className="field-grid"><Field label="Current crops" value={form.currentCrops} onChange={v => set('currentCrops', v)} placeholder="Separate crops with commas" /><Field label="Irrigation facilities" value={form.irrigationFacilities} onChange={v => set('irrigationFacilities', v)} placeholder="e.g. Borewell, drip (comma separated)" /></div>
      <div className="field-grid three-fields"><Field label="Planner crop" value={form.planCrop} onChange={v => set('planCrop', v)} placeholder="Crop for irrigation planning" /><Field label="Sowing date" type="date" value={form.sowingDate} onChange={v => set('sowingDate', v)} /><label className="field"><span>Growth stage</span><select value={form.growthStage} onChange={e => set('growthStage', e.target.value)}><option value="">Not provided</option><option>Recently sown</option><option>Vegetative growth</option><option>Flowering</option><option>Fruit or grain formation</option><option>Near harvest</option></select></label></div>
      <div className="field-grid three-fields"><Field label="Irrigation method" value={form.irrigationMethod} onChange={v => set('irrigationMethod', v)} placeholder="e.g. Drip, furrow, sprinkler" /><Field label="Measured soil moisture (%)" type="number" min="0" max="100" step="any" value={form.moisturePct} onChange={v => set('moisturePct', v)} placeholder="Optional; enter only if measured" /><Field label="Measurement date" type="date" value={form.moistureMeasuredAt} onChange={v => set('moistureMeasuredAt', v)} /></div>
      <p className="field-hint">Soil moisture must be a farmer-entered measurement with its date; it is never treated as live sensor data. The planner ignores readings older than the configured validity period.</p>
      {saved && <div className="alert alert-success"><Check size={17} />Your farm profile has been saved.</div>}{error && <ErrorNotice>{error}</ErrorNotice>}
      <div className="form-footer"><span><ShieldCheck size={15} />Only you can view and update your farm profile.</span><button className="primary-button" disabled={busy}>{busy ? <LoaderCircle className="spin" size={17} /> : <Save size={17} />}{words[farmer?.preferredLanguage]?.save || 'Save changes'}</button></div>
    </form></Card>
    <FarmHistoryPanel />
  </>;
}

function farmerToForm(farmer = {}) { return { name: farmer.name || '', state: farmer.state || '', district: farmer.district || '', village: farmer.village || '', preferredLanguage: farmer.preferredLanguage || 'en', farmSize: farmer.farmSize ?? '', soilType: farmer.soil?.type || '', nitrogen: farmer.soil?.nitrogen ?? '', phosphorus: farmer.soil?.phosphorus ?? '', potassium: farmer.soil?.potassium ?? '', ph: farmer.soil?.ph ?? '', moisturePct: farmer.soil?.moisturePct ?? '', moistureMeasuredAt: farmer.soil?.moistureMeasuredAt || '', planCrop: farmer.farmPlan?.crop || farmer.currentCrops?.[0] || '', growthStage: farmer.farmPlan?.growthStage || '', sowingDate: farmer.farmPlan?.sowingDate || '', irrigationMethod: farmer.farmPlan?.irrigationMethod || '', irrigationFacilities: farmer.irrigationFacilities?.join(', ') || '', currentCrops: farmer.currentCrops?.join(', ') || '' }; }
function optionalNumber(value) { return value === '' ? undefined : Number(value); }
function splitList(value) { return value.split(',').map(part => part.trim()).filter(Boolean).slice(0, 20); }
