import { useState } from 'react';
import { X, ChevronLeft, UserRound, ArrowRight, LoaderCircle, FileWarning } from 'lucide-react';
import { GoogleIcon, FacebookIcon } from './SocialIcons.jsx';
import { validateEmailClient, validateSocialLoginClient } from '../../services/emailValidator.js';

const STORAGE_SOCIAL_ACCOUNTS_KEY = 'farmer_saathi_saved_social_accounts';

export function getStoredSocialAccounts() {
  try {
    const stored = localStorage.getItem(STORAGE_SOCIAL_ACCOUNTS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const clean = parsed.filter(a => a?.email && validateEmailClient(a.email).valid);
        if (clean.length > 0) return clean;
      }
    }
  } catch {}
  return [
    { name: 'Devidas Kamainor', email: 'devdevudevidaskaminor@gmail.com', avatarColor: '#ea4335' }
  ];
}

export function saveStoredSocialAccount(account) {
  try {
    if (!account?.email || !validateEmailClient(account.email).valid) return;
    const current = getStoredSocialAccounts().filter(a => a.email.toLowerCase() !== account.email.toLowerCase());
    const updated = [account, ...current].slice(0, 5);
    localStorage.setItem(STORAGE_SOCIAL_ACCOUNTS_KEY, JSON.stringify(updated));
  } catch {}
}

export function SocialAccountModal({ provider, language, copy, busy, onSelect, onClose }) {
  const isGoogle = provider === 'google';
  const accounts = getStoredSocialAccounts();
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customEmail, setCustomEmail] = useState('');
  const [customName, setCustomName] = useState('');
  const [customError, setCustomError] = useState('');

  const title = isGoogle
    ? (language === 'kn' ? 'ಖಾತೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ' : language === 'hi' ? 'खाता चुनें' : language === 'mr' ? 'खाते निवडा' : 'Choose an account')
    : (language === 'kn' ? 'Facebook ನೊಂದಿಗೆ ಸೈನ್ ಇನ್ ಮಾಡಿ' : language === 'hi' ? 'Facebook से लॉग इन करें' : language === 'mr' ? 'Facebook सह लॉग इन करा' : 'Log in with Facebook');

  const subtitle = isGoogle
    ? (language === 'kn' ? 'Farmer Saathi ಗೆ ಮುಂದುವರಿಯಲು' : language === 'hi' ? 'Farmer Saathi पर जारी रखने के लिए' : language === 'mr' ? 'Farmer Saathi वर पुढे जाण्यासाठी' : 'to continue to Farmer Saathi')
    : (language === 'kn' ? 'ಮುಂದುವರಿಯಲು ಖಾತೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ' : language === 'hi' ? 'जारी रखने के लिए खाता चुनें' : language === 'mr' ? 'पुढे जाण्यासाठी खाते निवडा' : 'Select an account to continue');

  const useAnotherText = isGoogle
    ? (language === 'kn' ? 'ಮತ್ತೊಂದು ಖಾತೆಯನ್ನು ಬಳಸಿ' : language === 'hi' ? 'दूसरे खाते का उपयोग करें' : language === 'mr' ? 'दुसरे खाते वापरा' : 'Use another account')
    : (language === 'kn' ? 'ಮತ್ತೊಂದು ಖಾತೆಯೊಂದಿಗೆ ಲಾಗಿನ್ ಮಾಡಿ' : language === 'hi' ? 'दूसरे खाते से लॉग इन करें' : language === 'mr' ? 'दुسऱ्या खात्याने लॉग इन करा' : 'Log in with another account');

  const disclaimer = isGoogle
    ? (language === 'kn' ? 'ಮುಂದುವರಿಯಲು, Google ನಿಮ್ಮ ಹೆಸರು, ಇಮೇಲ್ ವಿಳಾಸ ಮತ್ತು ಭಾಷೆಯ ಆದ್ಯತೆಯನ್ನು Farmer Saathi ನೊಂದಿಗೆ ಹಂಚಿಕೊಳ್ಳುತ್ತದೆ.' : language === 'hi' ? 'जारी रखने के लिए, Google आपका नाम, ईमेल पता और भाषा प्राथमिकता Farmer Saathi के साथ साझा करेगा।' : 'To continue, Google will share your name, email address, and language preference with Farmer Saathi.')
    : (language === 'kn' ? 'Farmer Saathi ನಿಮ್ಮ ಹೆಸರು ಮತ್ತು ಇಮೇಲ್ ವಿಳಾಸವನ್ನು ಸ್ವೀಕರಿಸುತ್ತದೆ.' : language === 'hi' ? 'Farmer Saathi आपका नाम और ईमेल पता प्राप्त करेगा।' : 'Farmer Saathi will receive your name and email address.');

  function submitCustom(e) {
    e.preventDefault();
    setCustomError('');
    const check = validateSocialLoginClient(provider, customEmail, language);
    if (!check.valid) {
      setCustomError(check.error);
      return;
    }
    onSelect({
      email: check.email,
      name: customName.trim() || check.email.split('@')[0],
      avatarColor: isGoogle ? '#4285f4' : '#1877f2'
    });
  }

  return (
    <div className="social-modal-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="social-account-card">
        <button type="button" className="social-account-close" onClick={onClose} aria-label="Close" disabled={busy}>
          <X size={18} />
        </button>

        <div className="social-account-header">
          <span className="social-account-logo">{isGoogle ? <GoogleIcon /> : <FacebookIcon />}</span>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>

        <div className="social-account-list">
          {accounts.map(acc => (
            <button
              type="button"
              key={acc.email}
              className="social-account-item"
              onClick={() => {
                const check = validateSocialLoginClient(provider, acc.email, language);
                if (!check.valid) {
                  setCustomError(check.error);
                  return;
                }
                onSelect(acc);
              }}
              disabled={busy}
            >
              <span className="social-account-avatar" style={{ background: acc.avatarColor || (isGoogle ? '#ea4335' : '#1877f2') }}>
                {acc.name?.[0]?.toUpperCase() || acc.email[0].toUpperCase()}
              </span>
              <div className="social-account-info">
                <span className="social-account-name">{acc.name}</span>
                <span className="social-account-email">{acc.email}</span>
              </div>
              <ChevronLeft className="social-account-chevron" style={{ transform: 'rotate(180deg)' }} size={16} />
            </button>
          ))}

          {customError && (
            <div className="alert alert-error" style={{ margin: '6px 0', fontSize: '12px' }}>
              <FileWarning size={14} />
              {customError}
            </div>
          )}

          {!showCustomInput ? (
            <button
              type="button"
              className="social-account-custom-toggle"
              onClick={() => {
                setShowCustomInput(true);
                setCustomError('');
              }}
              disabled={busy}
            >
              <span className="social-account-custom-icon"><UserRound size={18} /></span>
              <span>{useAnotherText}</span>
            </button>
          ) : (
            <form className="social-account-custom-form" onSubmit={submitCustom}>
              <input
                type="email"
                className="social-account-custom-input"
                placeholder={language === 'hi' ? 'ईमेल पता दर्ज करें' : language === 'kn' ? 'ಇಮೇಲ್ ವಿಳಾಸವನ್ನು ನಮೂದಿಸಿ' : 'Enter email address'}
                value={customEmail}
                onChange={e => {
                  setCustomEmail(e.target.value);
                  setCustomError('');
                }}
                required
                autoFocus
              />
              <input
                type="text"
                className="social-account-custom-input"
                placeholder={language === 'hi' ? 'आपका नाम (वैकल्पिक)' : language === 'kn' ? 'ನಿಮ್ಮ ಹೆಸರು (ಐಚ್ಛಿಕ)' : 'Your name (optional)'}
                value={customName}
                onChange={e => setCustomName(e.target.value)}
              />
              <button className="primary-button" type="submit" disabled={busy || !customEmail.trim()}>
                {busy ? <LoaderCircle className="spin" size={16} /> : null}
                {copy.continue || 'Continue'}
                <ArrowRight size={16} />
              </button>
            </form>
          )}
        </div>

        <div className="social-account-footer">
          <p>{disclaimer}</p>
        </div>
      </div>
    </div>
  );
}

export default SocialAccountModal;

