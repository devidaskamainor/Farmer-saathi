import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
import { synthesizeSpeech, transcribeAudio } from '../services/sarvam.js';
import { getLanguageDefinition } from '../config/languages.js';
import { HttpError } from '../utils/http.js';

const router = Router();
const acceptedAudioTypes = new Set([
  'audio/aac', 'audio/aiff', 'audio/amr', 'audio/flac', 'audio/m4a', 'audio/mp4',
  'audio/mpeg', 'audio/ogg', 'audio/opus', 'audio/wav', 'audio/webm', 'audio/x-wav',
  'audio/x-ms-wma'
]);
const uploadAudio = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const mimetype = file.mimetype.split(';')[0].trim().toLowerCase();
    if (!acceptedAudioTypes.has(mimetype)) return callback(new HttpError(400, 'Record or upload a supported audio format.'));
    callback(null, true);
  }
});

router.post('/transcribe', requireAuth, (req, res, next) => uploadAudio.single('audio')(req, res, error => {
  if (error) return next(error);
  next();
}), async (req, res, next) => {
  try {
    const langDef = getLanguageDefinition(req.farmer.preferredLanguage);
    if (!langDef.sttSupported) {
      throw new HttpError(422, 'Voice input is not available for this language. Please type your question instead.');
    }
    if (!req.file?.buffer?.length) throw new HttpError(400, 'Record a short voice message or type your question.');
    const mimetype = req.file.mimetype.split(';')[0].trim().toLowerCase();
    const extension = mimetype === 'audio/webm' ? 'webm' : mimetype === 'audio/mp4' ? 'm4a' : 'audio';
    const result = await transcribeAudio({
      buffer: req.file.buffer,
      mimetype,
      filename: `recording.${extension}`,
      language: req.farmer.preferredLanguage
    });
    res.json(result);
  } catch (error) { next(error); }
});

router.post('/speak', requireAuth, async (req, res, next) => {
  try {
    const text = String(req.body?.text || '').trim();
    if (!text || text.length > 2500) throw new HttpError(400, 'Enter text of up to 2,500 characters for spoken playback.');
    const voice = getLanguageDefinition(req.farmer.preferredLanguage).sarvamTts;
    if (!voice) throw new HttpError(422, 'Spoken playback is not available in this language. The answer is still available as text.');
    const audio = await synthesizeSpeech(text, voice);
    res.set('Cache-Control', 'no-store').type('audio/wav').send(audio);
  } catch (error) { next(error); }
});

export default router;
