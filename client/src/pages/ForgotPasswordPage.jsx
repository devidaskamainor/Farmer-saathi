import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Leaf, LoaderCircle, ShieldCheck, FileWarning } from 'lucide-react';
import { api, errorMessage } from '../services/api.js';
import { readSavedLanguage, localizedCopy } from '../services/languageStorage.js';
import { getBrowserHelpLanguage } from '../utils/authHelpUtils.js';
import { passwordResetCopy, authCopy } from '../config/authTranslations.js';
import Field from '../components/common/Field.jsx';

export default function ForgotPasswordPage() {
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
      <div className="brand"><span className="brand-mark"><img src="/logo.png" alt="Farmer Saathi Logo" className="brand-logo-img" /></span><span>Farmer Saathi</span></div>
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
