const definitions = {
  en: { englishName: 'English', nativeName: 'English', locale: 'en-IN', script: 'Latin', direction: 'ltr', interfaceSupport: 'complete' },
  as: { englishName: 'Assamese', nativeName: 'অসমীয়া', locale: 'as-IN', script: 'Bengali', direction: 'ltr', interfaceSupport: 'english-fallback' },
  bn: { englishName: 'Bengali', nativeName: 'বাংলা', locale: 'bn-IN', script: 'Bengali', direction: 'ltr', interfaceSupport: 'english-fallback' },
  brx: { englishName: 'Bodo', nativeName: 'बड़ो', locale: 'brx-IN', script: 'Devanagari', direction: 'ltr', interfaceSupport: 'english-fallback' },
  doi: { englishName: 'Dogri', nativeName: 'डोगरी', locale: 'doi-IN', script: 'Devanagari', direction: 'ltr', interfaceSupport: 'english-fallback' },
  gu: { englishName: 'Gujarati', nativeName: 'ગુજરાતી', locale: 'gu-IN', script: 'Gujarati', direction: 'ltr', interfaceSupport: 'english-fallback' },
  hi: { englishName: 'Hindi', nativeName: 'हिन्दी', locale: 'hi-IN', script: 'Devanagari', direction: 'ltr', interfaceSupport: 'partial' },
  kn: { englishName: 'Kannada', nativeName: 'ಕನ್ನಡ', locale: 'kn-IN', script: 'Kannada', direction: 'ltr', interfaceSupport: 'partial' },
  ks: { englishName: 'Kashmiri', nativeName: 'کٲشُر', locale: 'ks-Arab-IN', script: 'Arabic', direction: 'rtl', interfaceSupport: 'english-fallback' },
  kok: { englishName: 'Konkani', nativeName: 'कोंकणी', locale: 'kok-IN', script: 'Devanagari', direction: 'ltr', interfaceSupport: 'english-fallback' },
  mai: { englishName: 'Maithili', nativeName: 'मैथिली', locale: 'mai-IN', script: 'Devanagari', direction: 'ltr', interfaceSupport: 'english-fallback' },
  ml: { englishName: 'Malayalam', nativeName: 'മലയാളം', locale: 'ml-IN', script: 'Malayalam', direction: 'ltr', interfaceSupport: 'english-fallback' },
  mni: { englishName: 'Manipuri (Meitei)', nativeName: 'ꯃꯤꯇꯩꯂꯣꯟ', locale: 'mni-IN', script: 'Meetei_Mayek', direction: 'ltr', interfaceSupport: 'english-fallback' },
  mr: { englishName: 'Marathi', nativeName: 'मराठी', locale: 'mr-IN', script: 'Devanagari', direction: 'ltr', interfaceSupport: 'english-fallback' },
  ne: { englishName: 'Nepali', nativeName: 'नेपाली', locale: 'ne-IN', script: 'Devanagari', direction: 'ltr', interfaceSupport: 'english-fallback' },
  or: { englishName: 'Odia', nativeName: 'ଓଡ଼ିଆ', locale: 'or-IN', script: 'Odia', direction: 'ltr', interfaceSupport: 'english-fallback' },
  pa: { englishName: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', locale: 'pa-IN', script: 'Gurmukhi', direction: 'ltr', interfaceSupport: 'english-fallback' },
  sa: { englishName: 'Sanskrit', nativeName: 'संस्कृतम्', locale: 'sa-IN', script: 'Devanagari', direction: 'ltr', interfaceSupport: 'english-fallback' },
  sat: { englishName: 'Santali', nativeName: 'ᱥᱟᱱᱛᱟᱲᱤ', locale: 'sat-IN', script: 'Ol_Chiki', direction: 'ltr', interfaceSupport: 'english-fallback' },
  sd: { englishName: 'Sindhi', nativeName: 'سنڌي', locale: 'sd-IN', script: 'Arabic', direction: 'rtl', interfaceSupport: 'english-fallback' },
  ta: { englishName: 'Tamil', nativeName: 'தமிழ்', locale: 'ta-IN', script: 'Tamil', direction: 'ltr', interfaceSupport: 'english-fallback' },
  te: { englishName: 'Telugu', nativeName: 'తెలుగు', locale: 'te-IN', script: 'Telugu', direction: 'ltr', interfaceSupport: 'english-fallback' },
  ur: { englishName: 'Urdu', nativeName: 'اردو', locale: 'ur-IN', script: 'Arabic', direction: 'rtl', interfaceSupport: 'english-fallback' }
};

const sarvamTtsVoices = {
  en: { languageCode: 'en-IN', model: 'bulbul:v4-flash', speaker: 'shubh_en_narration' },
  hi: { languageCode: 'hi-IN', model: 'bulbul:v4-flash', speaker: 'shubh_hi_customer' },
  bn: { languageCode: 'bn-IN', model: 'bulbul:v4-flash', speaker: 'arnab_bn_conversation' },
  gu: { languageCode: 'gu-IN', model: 'bulbul:v4-flash', speaker: 'bhavik_gu_conversation' },
  kn: { languageCode: 'kn-IN', model: 'bulbul:v4-flash', speaker: 'chaitra_kn_conversation' },
  ml: { languageCode: 'ml-IN', model: 'bulbul:v3', speaker: 'shubh' },
  mr: { languageCode: 'mr-IN', model: 'bulbul:v4-flash', speaker: 'ishita_mr_conversational' },
  or: { languageCode: 'od-IN', model: 'bulbul:v3', speaker: 'shubh' },
  pa: { languageCode: 'pa-IN', model: 'bulbul:v4-flash', speaker: 'anand_pa_conversation' },
  ta: { languageCode: 'ta-IN', model: 'bulbul:v4-flash', speaker: 'gokul_ta_narration' },
  te: { languageCode: 'te-IN', model: 'bulbul:v4-flash', speaker: 'kavitha_te_conversation' }
};

export const languageConfig = Object.freeze(Object.fromEntries(
  Object.entries(definitions).map(([code, details]) => [
    code,
    Object.freeze({
      ...details,
      id: code,
      sarvamSttLocale: code === 'ks' ? 'ks-IN' : code === 'or' ? 'od-IN' : details.locale,
      sarvamTts: sarvamTtsVoices[code] ? Object.freeze(sarvamTtsVoices[code]) : null,
      aiSupport: 'prompted-unverified',
      speechRecognition: 'browser-dependent',
      textToSpeech: 'browser-dependent'
    })
  ])
));

export const supportedLanguageCodes = Object.freeze(Object.keys(languageConfig));
export const languageOptions = Object.freeze(
  supportedLanguageCodes.map(code => Object.freeze({ code, ...languageConfig[code], label: languageConfig[code].nativeName }))
);

export function getLanguageDefinition(language) {
  return languageConfig[language] || languageConfig.en;
}

export function isSupportedLanguage(language) {
  return Object.hasOwn(languageConfig, language);
}
