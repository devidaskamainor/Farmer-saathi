import { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Leaf, LoaderCircle, ShieldCheck, FileWarning } from 'lucide-react';
import { api, errorMessage } from '../services/api.js';
import { readSavedLanguage, localizedCopy } from '../services/languageStorage.js';
import { getBrowserHelpLanguage } from '../utils/authHelpUtils.js';
import { passwordResetCopy } from '../config/authTranslations.js';
import Field from '../components/common/Field.jsx';

export default function ResetPasswordPage() {
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
      <div className="brand"><span className="brand-mark"><img src="/logo.png" alt="Farmer Saathi Logo" className="brand-logo-img" /></span><span>Farmer Saathi</span></div>
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
