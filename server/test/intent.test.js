import test from 'node:test';
import assert from 'node:assert/strict';
import { detectIntent } from '../src/services/intent.js';

const examples = [
  ['Will it rain tomorrow?', 'WEATHER_QUERY'],
  ['Which crop should I grow in my field?', 'CROP_RECOMMENDATION'],
  ['My tomato leaves are turning yellow.', 'CROP_DISEASE'],
  ['When should I water my crop?', 'IRRIGATION_ADVICE'],
  ['What is the onion mandi price?', 'MANDI_PRICE'],
  ['How do I improve my soil?', 'SOIL_ADVICE'],
  ['Tell me about government schemes', 'GOVERNMENT_SCHEME'],
  ['कल बारिश होगी?', 'WEATHER_QUERY'],
  ['कौन सी फसल उगाऊं?', 'CROP_RECOMMENDATION'],
  ['मेरे टमाटर के पत्ते पीले हैं', 'CROP_DISEASE'],
  ['ನಾಳೆ ಮಳೆ ಬರುತ್ತದೆಯೇ?', 'WEATHER_QUERY'],
  ['ನನ್ನ ಹೊಲದಲ್ಲಿ ಯಾವ ಬೆಳೆ ಬೆಳೆಯಲಿ?', 'CROP_RECOMMENDATION'],
  ['ನನ್ನ ಟೊಮೇಟೊ ಎಲೆಗಳು ಹಳದಿಯಾಗಿವೆ', 'CROP_DISEASE'],
  ['ಟೊಮೇಟೊ ಮಾರುಕಟ್ಟೆ ಬೆಲೆ ಎಷ್ಟು?', 'MANDI_PRICE'],
  ['ನೀರಾವರಿಗೆ ಯಾವಾಗ ನೀರು ಹಾಕಬೇಕು?', 'IRRIGATION_ADVICE'],
  ['ನಮಸ್ಕಾರ', 'UNKNOWN_INTENT']
];

for (const [message, expected] of examples) {
  test(`detects ${expected} for ${message}`, () => {
    assert.equal(detectIntent(message), expected);
  });
}
