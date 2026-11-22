import { useState, useEffect } from 'react';
import { X, ArrowRight, LoaderCircle, FileWarning } from 'lucide-react';
import { GoogleIcon, FacebookIcon } from './SocialIcons.jsx';
import { validateSocialLoginClient } from '../../services/emailValidator.js';

const STORAGE_SOCIAL_ACCOUNTS_KEY = 'farmer_saathi_saved_social_accounts';

export function getStoredSocialAccounts() {
  return [];
}

export function saveStoredSocialAccount() {
  // Never save or expose previous users' email addresses to subsequent visitors
  try {
    localStorage.removeItem(STORAGE_SOCIAL_ACCOUNTS_KEY);
  } catch {}
}

export function SocialAccountModal({ provider, language, copy, busy, onSelect, onClose }) {
  const isGoogle = provider === 'google';
  const [customEmail, setCustomEmail] = useState('');
  const [customName, setCustomName] = useState('');
  const [customError, setCustomError] = useState('');

  useEffect(() => {
    try {
      localStorage.removeItem(STORAGE_SOCIAL_ACCOUNTS_KEY);
    } catch {}
  }, []);

  const title = isGoogle
    ? (language === 'kn' ? 'Google ಖಾತೆಯೊಂದಿಗೆ ಮುಂದುವರಿಯಿರಿ' : language === 'hi' ? 'Google खाते से जारी रखें' : language === 'mr' ? 'Google खात्यासह पुढे जा' : 'Continue with Google')
    : (language === 'kn' ? 'Facebook ನೊಂದಿಗೆ ಸೈನ್ ಇನ್ ಮಾಡಿ' : language === 'hi' ? 'Facebook से लॉग इन करें' : language === 'mr' ? 'Facebook सह लॉग इन करा' : 'Log in with Facebook');

  const subtitle = isGoogle
    ? (language === 'kn' ? 'ನಿಮ್ಮ Google ಇಮೇಲ್ ನಮೂದಿಸಿ' : language === 'hi' ? 'अपना Google ईमेल दर्ज करें' : language === 'mr' ? 'तुमचा Google ईमेल प्रविष्ट करा' : 'Enter your Google email to sign in')
    : (language === 'kn' ? 'ಮುಂದುವರಿಯಲು ನಿಮ್ಮ ಇಮೇಲ್ ನಮೂದಿಸಿ' : language === 'hi' ? 'जारी रखने के लिए अपना ईमेल दर्ज करें' : language === 'mr' ? 'पुढे जाण्यासाठी तुमचा ईमेल प्रविष्ट करा' : 'Enter your email to continue');

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
          {customError && (
            <div className="alert alert-error" style={{ margin: '6px 0', fontSize: '12px' }}>
              <FileWarning size={14} />
              {customError}
            </div>
          )}

          <form className="social-account-custom-form" onSubmit={submitCustom}>
            <input
              type="email"
              className="social-account-custom-input"
              placeholder={language === 'hi' ? 'ईमेल पता दर्ज करें (उदा. user@gmail.com)' : language === 'kn' ? 'ಇಮೇಲ್ ವಿಳಾಸ ನಮೂದಿಸಿ (ಉದಾ. user@gmail.com)' : 'Enter email address (e.g. user@gmail.com)'}
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
        </div>

        <div className="social-account-footer">
          <p>{disclaimer}</p>
        </div>
      </div>
    </div>
  );
}

export default SocialAccountModal;