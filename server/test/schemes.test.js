import test from 'node:test';
import assert from 'node:assert/strict';
import { findSchemeById, findSchemes, localizeScheme, potentiallyRelevantSchemes, schemeCatalogue } from '../src/services/schemes.js';
import { contentFields, getSchemeContent, translationSourceRevisions } from '../src/services/schemeTranslations.js';

test('returns all relevant schemes for an empty filter', () => {
  assert.equal(findSchemes().length, 4);
});

test('filters schemes by Karnataka state', () => {
  const results = findSchemes({ state: 'Karnataka' });
  assert.ok(results.every(scheme => scheme.states.includes('All India') || scheme.states.includes('Karnataka')));
  assert.ok(results.some(scheme => scheme.id === 'krishi-bhagya'));
});

test('searches scheme names and categories', () => {
  assert.ok(findSchemes({ q: 'PM-KISAN' }).some(scheme => scheme.id === 'pm-kisan'));
  assert.equal(findSchemes({ category: 'crop-insurance' }).length, 2);
});

test('finds a scheme detail without inventing a missing record', () => {
  assert.equal(findSchemeById('pmfby')?.name, 'Pradhan Mantri Fasal Bima Yojana (PMFBY)');
  assert.equal(findSchemeById('missing-scheme'), undefined);
});

test('only recommends central and matching-state schemes from a saved state', () => {
  const results = potentiallyRelevantSchemes({ state: 'Karnataka', currentCrops: ['Tomato'] });
  assert.ok(results.some(scheme => scheme.id === 'krishi-bhagya'));
  assert.ok(results.some(scheme => scheme.id === 'pm-kisan'));
  assert.ok(!potentiallyRelevantSchemes({ currentCrops: ['Tomato'] }).some(scheme => scheme.id === 'krishi-bhagya'));
});

test('all scheme records have complete Hindi and Kannada translations with source metadata', () => {
  for (const scheme of schemeCatalogue) {
    for (const language of ['hi', 'kn']) {
      const localized = getSchemeContent(scheme, language);
      assert.equal(localized.translation.status, 'translated', `${scheme.id} ${language}`);
      assert.equal(localized.translation.officialTranslation, false);
      assert.equal(localized.translation.reviewStatus, 'needs-native-speaker-review');
      assert.equal(localized.translation.sourceUrl, scheme.informationUrl);
      assert.equal(localized.translation.sourceRevision, scheme.sourceRevision);
      assert.equal(translationSourceRevisions[scheme.id][language], scheme.sourceRevision);
      for (const field of contentFields) {
        if (typeof scheme[field] === 'string') {
          assert.ok(localized.content[field]?.trim(), `${scheme.id} ${language} missing ${field}`);
        }
      }
    }
  }
});

test('scheme translations preserve all numeric facts from the English source', () => {
  const numberTokens = value => value.match(/\d[\d,.]*/g) || [];
  for (const scheme of schemeCatalogue) {
    const source = getSchemeContent(scheme, 'en').content;
    for (const language of ['hi', 'kn']) {
      const localized = getSchemeContent(scheme, language).content;
      for (const field of contentFields) {
        if (typeof source[field] === 'string') {
          assert.deepEqual(numberTokens(localized[field]), numberTokens(source[field]), `${scheme.id} ${language} ${field}`);
        }
      }
    }
  }
});

test('source revision changes make cached translations stale and fall back to English', () => {
  const scheme = findSchemeById('pm-kisan');
  const localized = getSchemeContent({ ...scheme, sourceRevision: scheme.sourceRevision + 1 }, 'hi');
  assert.equal(localized.translation.status, 'stale');
  assert.equal(localized.content.name, scheme.name);
  assert.equal(localized.content.eligibility, scheme.eligibility);
});

test('untranslated scheduled languages are reported as unavailable and show original English content', () => {
  const scheme = findSchemeById('pm-kisan');
  const localized = localizeScheme(scheme, 'as');
  assert.equal(localized.translation.status, 'unavailable');
  assert.equal(localized.translation.language, 'as');
  assert.equal(localized.contentLanguage, 'en');
  assert.equal(localized.name, scheme.name);
});

test('search accepts Hindi and Kannada scheme names', () => {
  assert.ok(findSchemes({ q: 'प्रधानमंत्री किसान' }).some(scheme => scheme.id === 'pm-kisan'));
  assert.ok(findSchemes({ q: 'ಕೃಷಿ ಭಾಗ್ಯ' }).some(scheme => scheme.id === 'krishi-bhagya'));
});
