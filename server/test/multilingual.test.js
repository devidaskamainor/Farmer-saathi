import assert from 'node:assert/strict';
import test from 'node:test';
import { getLanguageDefinition, languageConfig, supportedLanguageCodes } from '../src/config/languages.js';
import { targetLanguageCodes, languageOptions } from '../../shared/languages.js';
import { profileUpdates, updateFarmerProfile, validatePreferredLanguage } from '../src/services/farmerProfiles.js';

test('target languages list contains exactly the 13 required languages', () => {
  const expected = ['en', 'kn', 'hi', 'ta', 'te', 'mr', 'bn', 'gu', 'ml', 'pa', 'or', 'as', 'ur'];
  assert.deepEqual([...targetLanguageCodes], expected);
  for (const code of expected) {
    assert.ok(supportedLanguageCodes.includes(code), `${code} must be in supportedLanguageCodes`);
    assert.ok(languageConfig[code], `${code} must be in languageConfig`);
    assert.equal(languageConfig[code].textSupported, true, `${code} must support text`);
  }
});

test('language selector options prioritize all 13 target languages with native and English names', () => {
  const targetOptions = languageOptions.slice(0, 13);
  const targetCodes = targetOptions.map(opt => opt.code);
  assert.deepEqual(targetCodes, ['en', 'kn', 'hi', 'ta', 'te', 'mr', 'bn', 'gu', 'ml', 'pa', 'or', 'as', 'ur']);

  assert.equal(targetOptions[0].label, 'English');
  assert.equal(targetOptions[1].label, 'ಕನ್ನಡ (Kannada)');
  assert.equal(targetOptions[2].label, 'हिन्दी (Hindi)');
  assert.equal(targetOptions[3].label, 'தமிழ் (Tamil)');
  assert.equal(targetOptions[4].label, 'తెలుగు (Telugu)');
  assert.equal(targetOptions[5].label, 'मराठी (Marathi)');
  assert.equal(targetOptions[6].label, 'বাংলা (Bengali)');
  assert.equal(targetOptions[7].label, 'ગુજરાતી (Gujarati)');
  assert.equal(targetOptions[8].label, 'മലയാളം (Malayalam)');
  assert.equal(targetOptions[9].label, 'ਪੰਜਾਬੀ (Punjabi)');
  assert.equal(targetOptions[10].label, 'ଓଡ଼ିଆ (Odia)');
  assert.equal(targetOptions[11].label, 'অসমীয়া (Assamese)');
  assert.equal(targetOptions[12].label, 'اردو (Urdu)');
});

test('Sarvam STT and TTS capabilities are accurately configured for target languages', () => {
  // TTS is supported for 11 languages with official Sarvam Bulbul voices
  const ttsSupported = ['en', 'hi', 'bn', 'gu', 'kn', 'ml', 'mr', 'or', 'pa', 'ta', 'te'];
  for (const code of ttsSupported) {
    assert.equal(languageConfig[code].ttsSupported, true, `${code} should have ttsSupported: true`);
    assert.ok(languageConfig[code].sarvamTts, `${code} should have sarvamTts voice`);
    assert.ok(languageConfig[code].sarvamTts.speaker, `${code} should have voice speaker`);
  }

  // Assamese and Urdu do not have official Sarvam Bulbul TTS
  assert.equal(languageConfig.as.ttsSupported, false);
  assert.equal(languageConfig.as.sarvamTts, null);
  assert.equal(languageConfig.ur.ttsSupported, false);
  assert.equal(languageConfig.ur.sarvamTts, null);

  // STT supported in Saaras v4
  const sttSupported = ['en', 'hi', 'bn', 'gu', 'kn', 'ml', 'mr', 'or', 'pa', 'ta', 'te'];
  for (const code of sttSupported) {
    assert.equal(languageConfig[code].sttSupported, true, `${code} should have sttSupported: true`);
  }
  // Odia uses Sarvam-specific locale od-IN
  assert.equal(languageConfig.or.sarvamSttLocale, 'od-IN');

  // Assamese and Urdu STT
  assert.equal(languageConfig.as.sttSupported, false);
  assert.equal(languageConfig.ur.sttSupported, false);
});

test('all 13 target languages pass backend preferredLanguage validation and profile updates', async () => {
  for (const code of targetLanguageCodes) {
    assert.equal(validatePreferredLanguage(code), code);

    const db = {
      async query(sql, values) {
        assert.match(sql, /update farmers set preferred_language = \$1/);
        assert.equal(values[0], code);
        return { rows: [{ id: 'farmer-test', preferred_language: values[0] }] };
      }
    };
    const updated = await updateFarmerProfile(db, 'farmer-test', profileUpdates({ preferredLanguage: code }));
    assert.equal(updated.preferredLanguage, code);
  }
});
