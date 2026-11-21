import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { findSchemeById, findSchemes, localizeScheme, potentiallyRelevantSchemes } from '../services/schemes.js';
import { HttpError } from '../utils/http.js';

const router = Router();
const supportedCategories = new Set(['income-support', 'crop-insurance', 'water-management']);
router.use(requireAuth);

router.get('/search', (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length > 100) throw new HttpError(400, 'Search text must be 100 characters or fewer.');
  validateFilters(req.query.state, req.query.category);
  res.json(catalogueResponse(findSchemes({ q, state: req.query.state, category: req.query.category }), req.farmer, req.query.language));
});

router.get('/', (req, res) => {
  validateFilters(req.query.state, req.query.category);
  const state = String(req.query.state || '').trim();
  const category = String(req.query.category || '').trim();
  res.json(catalogueResponse(findSchemes({ state, category }), req.farmer, req.query.language));
});

router.get('/:id', (req, res) => {
  const scheme = findSchemeById(req.params.id);
  if (!scheme) throw new HttpError(404, 'Scheme not found.');
  const language = requestedLanguage(req.query.language, req.farmer.preferredLanguage);
  res.json({
    scheme: {
      ...localizeScheme(scheme, language),
      potentiallyRelevant: potentiallyRelevantSchemes(req.farmer).some(item => item.id === scheme.id)
    },
    dataType: 'verified-catalogue',
    verificationDate: scheme.verificationDate
  });
});

router.post('/recommendations', (req, res) => {
  res.json(catalogueResponse(potentiallyRelevantSchemes(req.farmer), req.farmer, req.body?.language, 'Potentially relevant'));
});

function catalogueResponse(results, farmer, languageValue, relevance = 'Verified catalogue') {
  const language = requestedLanguage(languageValue, farmer.preferredLanguage);
  return {
    schemes: results.map(scheme => ({
      ...localizeScheme(scheme, language),
      potentiallyRelevant: potentiallyRelevantSchemes(farmer).some(item => item.id === scheme.id)
    })),
    total: results.length,
    dataType: 'verified-catalogue',
    relevance,
    verificationDate: '2026-11-20',
    mySchemeUrl: 'https://www.myscheme.gov.in/',
    disclaimer: 'Potentially relevant results are not a determination of eligibility. Check the official guidelines.'
  };
}

function validateFilters(stateValue, categoryValue) {
  const state = String(stateValue || '').trim();
  const category = String(categoryValue || '').trim();
  if (state.length > 100) throw new HttpError(400, 'State filter must be 100 characters or fewer.');
  if (category && !supportedCategories.has(category)) throw new HttpError(400, 'Choose a supported scheme category.');
}

function requestedLanguage(value, preferredLanguage) {
  const language = value === undefined ? (preferredLanguage || 'en') : String(value);
  if (!['en', 'hi', 'kn'].includes(language)) throw new HttpError(400, 'Choose a supported scheme language.');
  return language;
}
export default router;
