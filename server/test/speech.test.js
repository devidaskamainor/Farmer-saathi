import assert from 'node:assert/strict';
import test from 'node:test';
import { cleanSpeechText, detectSpeechLanguage } from '../src/config/languages.js';
import { splitTextIntoSpeechChunks, concatenateWavBuffers } from '../src/services/sarvam.js';

test('cleanSpeechText strips markdown formatting and preserves natural prose', () => {
  const markdown = `
### 1. ಬೆಳೆ ನಿರ್ವಹಣೆ
- **ಟೊಮೇಟೊ ಬೆಳೆ** ಉತ್ತಮವಾಗಿ ಬೆಳೆಯಲು ನೀರು ಹಾಕಿ.
- ಕೀಟಗಳಿಗಾಗಿ *ಅಫಿಡ್* ಗಮನಿಸಿ.
[ಹೆಚ್ಚಿನ ಮಾಹಿತಿ](https://example.com)
---
`;
  const cleaned = cleanSpeechText(markdown);
  assert.ok(!cleaned.includes('###'));
  assert.ok(!cleaned.includes('**'));
  assert.ok(!cleaned.includes('*ಅಫಿಡ್*'));
  assert.ok(!cleaned.includes('---'));
  assert.ok(!cleaned.includes('https://example.com'));
  assert.ok(cleaned.includes('ಟೊಮೇಟೊ ಬೆಳೆ ಉತ್ತಮವಾಗಿ ಬೆಳೆಯಲು ನೀರು ಹಾಕಿ'));
  assert.ok(cleaned.includes('ಹೆಚ್ಚಿನ ಮಾಹಿತಿ'));
});

test('detectSpeechLanguage identifies regional Indian scripts accurately', () => {
  assert.equal(detectSpeechLanguage('ನನ್ನ ಟೊಮೇಟೊ ಬೆಳೆ ಹಳದಿ ಎಲೆಗಳಾಗುತ್ತಿವೆ', 'en'), 'kn');
  assert.equal(detectSpeechLanguage('నా టమోటా పంటలో తెగులు వచ్చింది', 'en'), 'te');
  assert.equal(detectSpeechLanguage('என் தக்காளி பயிரில் பூச்சி தாக்குதல்', 'en'), 'ta');
  assert.equal(detectSpeechLanguage('എന്റെ തക്കാളി ചെടികൾക്ക് രോഗബാധയുണ്ട്', 'en'), 'ml');
  assert.equal(detectSpeechLanguage('ମୋ ଟମାଟୋ ଫସଲରେ ରୋଗ ଲାଗିଛି', 'en'), 'or');
  assert.equal(detectSpeechLanguage('મારા ટામેટાના પાકમાં જીવાત પડી છે', 'en'), 'gu');
  assert.equal(detectSpeechLanguage('ਮੇਰੇ ਟਮਾਟਰ ਦੀ ਫ਼ਸਲ ਵਿੱਚ ਕੀੜੇ ਲੱਗ ਗਏ ਹਨ', 'en'), 'pa');
  assert.equal(detectSpeechLanguage('আমার টমেটো ফসলে রোগ হয়েছে', 'en'), 'bn');
  assert.equal(detectSpeechLanguage('मेरे टमाटर की फसल में पीले पत्ते आ रहे हैं', 'en'), 'hi');
  assert.equal(detectSpeechLanguage('माझ्या टोमॅटो पिकावर रोग पडला आहे', 'mr'), 'mr');
  assert.equal(detectSpeechLanguage('How can I protect my tomato crop?', 'en'), 'en');
});

test('splitTextIntoSpeechChunks splits long text at natural sentence boundaries', () => {
  const shortText = 'ನಮಸ್ಕಾರ ರೈತ ಮಿತ್ರ. ನಿಮ್ಮ ಬೆಳೆಗೆ ನೀರು ಹಾಕಿ.';
  assert.deepEqual(splitTextIntoSpeechChunks(shortText, 500), [shortText]);

  const s1 = 'ಮೊದಲ ವಾಕ್ಯ ಇಲ್ಲಿ ಮುಗಿಯುತ್ತದೆ. ';
  const s2 = 'ಎರಡನೇ ವಾಕ್ಯ ಇಲ್ಲಿ ಮುಗಿಯುತ್ತದೆ. ';
  const s3 = 'ಮೂರನೇ ವಾಕ್ಯ ಇಲ್ಲಿ ಮುಗಿಯುತ್ತದೆ.';
  const longText = s1.repeat(20) + s2.repeat(20) + s3;

  const chunks = splitTextIntoSpeechChunks(longText, 600);
  assert.ok(chunks.length > 1);
  for (const chunk of chunks) {
    assert.ok(chunk.length <= 600, `Chunk length ${chunk.length} should be <= 600`);
    assert.ok(chunk.length > 0);
  }
});

test('concatenateWavBuffers merges multiple WAV buffers and recalculates header length', () => {
  function makeMockWav(pcmLength) {
    const buf = Buffer.alloc(44 + pcmLength, 0x12);
    buf.write('RIFF', 0);
    buf.writeUInt32LE(36 + pcmLength, 4);
    buf.write('WAVEfmt ', 8);
    buf.writeUInt32LE(16, 16);
    buf.writeUInt16LE(1, 20); // PCM
    buf.writeUInt16LE(1, 22); // Mono
    buf.writeUInt32LE(16000, 24); // 16kHz
    buf.writeUInt32LE(32000, 28);
    buf.writeUInt16LE(2, 32);
    buf.writeUInt16LE(16, 34);
    buf.write('data', 36);
    buf.writeUInt32LE(pcmLength, 40);
    return buf;
  }

  const wav1 = makeMockWav(100);
  const wav2 = makeMockWav(200);
  const combined = concatenateWavBuffers([wav1, wav2]);

  assert.equal(combined.length, 44 + 300);
  assert.equal(combined.subarray(0, 4).toString(), 'RIFF');
  assert.equal(combined.readUInt32LE(4), 36 + 300);
  assert.equal(combined.subarray(36, 40).toString(), 'data');
  assert.equal(combined.readUInt32LE(40), 300);
});
