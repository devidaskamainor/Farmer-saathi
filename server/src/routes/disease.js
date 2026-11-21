import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
import { askGroq } from '../services/groq.js';
import { HttpError } from '../utils/http.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) return callback(new HttpError(400, 'Upload a JPG, PNG, or WebP image.'));
    callback(null, true);
  }
});

router.post('/analyze', requireAuth, (req, res, next) => upload.single('image')(req, res, error => {
  if (error) return next(error);
  next();
}), async (req, res, next) => {
  try {
    const symptoms = String(req.body?.symptoms || '').trim();
    if (!symptoms && !req.file) throw new HttpError(400, 'Describe the symptoms or attach a crop photo.');
    if (symptoms.length > 2000) throw new HttpError(400, 'Keep the symptom description under 2,000 characters.');
    if (req.file && !hasValidImageSignature(req.file)) throw new HttpError(400, 'The uploaded file does not match a supported JPG, PNG, or WebP image.');
    const prompt = `Assess the reported crop symptoms and attached photo, if present: ${symptoms || 'No written symptoms provided; assess visible evidence only.'}. Give possible causes, observations supporting each possibility, safe preventive crop care, and when to seek an agriculture expert or Krishi Vigyan Kendra. Clearly say this is not a confirmed diagnosis. Do not recommend pesticide mixtures or dosages.`;
    res.json(await askGroq({ farmer: req.farmer, task: 'Crop disease image and symptom guidance', prompt, image: req.file }));
  } catch (error) { next(error); }
});

function hasValidImageSignature(file) {
  const bytes = file.buffer;
  if (file.mimetype === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (file.mimetype === 'image/png') return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (file.mimetype === 'image/webp') return bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  return false;
}

export default router;
