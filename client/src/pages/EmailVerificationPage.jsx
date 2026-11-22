import { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Leaf, LoaderCircle, ShieldCheck, FileWarning, ArrowRight } from 'lucide-react';
import { api, errorMessage } from '../services/api.js';
import { readSavedLanguage, localizedCopy } from '../services/languageStorage.js';
import { getBrowserHelpLanguage } from '../utils/authHelpUtils.js';
import { verificationCopy } from '../config/authTranslations.js';

export default function EmailVerificationPage({ onAuthenticated }) {
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
