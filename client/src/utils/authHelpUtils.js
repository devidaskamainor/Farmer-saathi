import { readSavedLanguage, supportedLanguages } from '../services/languageStorage.js';
import { getLanguageDefinition } from '../config/languages.js';

export function getAuthHelpTopic(question) {
  const text = (question || '').toLocaleLowerCase();
  if (/forgot|reset|password|पासवर्ड|मरेत|ಪಾಸ್.?ವರ್ಡ್|ಮರೆತ/.test(text)) return 'password';
  if (/register|sign.?up|create account|new account|रजिस्टर|खाता|पंजीकरण|ನೋಂದಣಿ|ಖಾತೆ/.test(text)) return 'register';
  if (/email|confirm|verification|ईमेल|पुष्टि|ದೃಢೀಕರಣ|ಇಮೇಲ್/.test(text)) return 'email';
  if (/log.?in|sign.?in|login|लॉग.?इन|साइन.?इन|ಲಾಗಿನ್|ಲಾಗ್.?ಇನ್|ಸೈನ್.?ಇನ್/.test(text)) return 'login';
  return 'other';
}

export function detectAuthHelpLanguage(text) {
  if (!text) return null;
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
    const code = (browserLanguage || '').toLowerCase().split('-')[0];
    if (supportedLanguages?.has?.(code)) return code;
    const candidate = getLanguageDefinition(code);
    if (candidate && candidate.code !== 'en') return candidate.code;
  }
  return readSavedLanguage() || 'en';
}
