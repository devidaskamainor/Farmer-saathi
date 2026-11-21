import { getLanguageDefinition, supportedLanguageCodes } from '../config/languages.js';

export const languageStorageKey = 'farmer-saathi-language';
export const supportedLanguages = new Set(supportedLanguageCodes);

export function readSavedLanguage() {
  try {
    const language = window.localStorage.getItem(languageStorageKey);
    return supportedLanguages.has(language) ? language : null;
  } catch {
    return null;
  }
}

export function saveLanguage(language) {
  try {
    window.localStorage.setItem(languageStorageKey, language);
  } catch {}
  const definition = getLanguageDefinition(language);
  if (typeof document !== 'undefined') {
    document.documentElement.lang = definition.locale;
    document.documentElement.dir = definition.direction;
  }
}

export function localizedCopy(resources, language) {
  return resources[language] || resources.en;
}
