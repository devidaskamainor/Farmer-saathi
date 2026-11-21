import {
  cleanSpeechText,
  detectSpeechLanguage,
  getLanguageDefinition,
  isSupportedLanguage,
  languageConfig,
  supportedLanguageCodes
} from '../../../shared/languages.js';

export {
  cleanSpeechText,
  detectSpeechLanguage,
  getLanguageDefinition,
  isSupportedLanguage,
  languageConfig,
  supportedLanguageCodes
};

export const supportedLanguages = new Set(supportedLanguageCodes);
