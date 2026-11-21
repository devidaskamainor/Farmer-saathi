import { Router } from 'express';

const router = Router();
router.post('/transcribe', (_req, res) => res.status(501).json({ message: 'Speech recognition runs in your browser when supported. No audio is sent to the server.' }));
router.post('/speak', (_req, res) => res.status(501).json({ message: 'Spoken answers use your browser’s built-in speech synthesis.' }));
export default router;
