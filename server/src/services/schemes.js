import { getSchemeContent } from './schemeTranslations.js';

const verificationDate = '2026-11-20';

export const schemeCatalogue = [
  {
    id: 'pm-kisan',
    sourceRevision: 1,
    name: 'Pradhan Mantri Kisan Samman Nidhi (PM-KISAN)',
    category: 'income-support',
    level: 'Central',
    states: ['All India'],
    department: 'Department of Agriculture and Farmers Welfare, Ministry of Agriculture and Farmers Welfare',
    description: 'Income support for eligible landholding farmer families.',
    intendedFor: 'Eligible landholding farmer families.',
    eligibility: 'Eligibility is determined by the PM-KISAN rules and state verification records. Current exclusions and withholding rules can change. Please check the official status and guidelines.',
    benefits: 'The PM-KISAN portal describes financial benefit of ₹6,000 per year in three equal instalments, subject to eligibility and verification.',
    documents: 'Please check the official scheme guidelines for the documents currently accepted in your state.',
    application: 'Complete new-farmer registration through the PM-KISAN portal or contact an authorised local/Common Service Centre. Mandatory eKYC may be required.',
    informationUrl: 'https://pmkisan.gov.in/',
    applicationUrl: 'https://pmkisan.gov.in/',
    verificationDate
  },
  {
    id: 'pmfby',
    sourceRevision: 1,
    name: 'Pradhan Mantri Fasal Bima Yojana (PMFBY)',
    category: 'crop-insurance',
    level: 'Central',
    states: ['All India'],
    department: 'Ministry of Agriculture and Farmers Welfare',
    description: 'Government-backed crop insurance to help farmers manage losses from covered crop risks.',
    intendedFor: 'Farmers growing notified crops in notified areas, subject to the scheme rules and local notification.',
    eligibility: 'Coverage and enrolment depend on the notified crop, area, season, land or tenant status, and local scheme rules. Please check the official guidelines.',
    benefits: 'The scheme provides crop insurance cover against eligible and notified risks. Premium shares and coverage details are set under the applicable notification.',
    documents: 'Please check the official scheme guidelines for land records, bank details, crop details, sowing evidence, and any documents required by the implementing insurer.',
    application: 'Apply through the official PMFBY portal or an authorised bank, CSC, or insurance provider during the announced enrolment period.',
    informationUrl: 'https://pmfby.gov.in/',
    applicationUrl: 'https://pmfby.gov.in/',
    verificationDate
  },
  {
    id: 'karnataka-raitha-suraksha-pmfby',
    sourceRevision: 1,
    name: 'Karnataka Raitha Suraksha / PMFBY Crop Insurance',
    category: 'crop-insurance',
    level: 'State',
    states: ['Karnataka'],
    department: 'Department of Agriculture, Government of Karnataka',
    description: 'Karnataka information and access point for crop insurance under PMFBY.',
    intendedFor: 'Farmers seeking crop insurance in Karnataka.',
    eligibility: 'Eligibility depends on the Karnataka notification, insured crop and area, enrolment period, and PMFBY rules.',
    benefits: 'Please check the official scheme guidelines. Insurance coverage and applicable premium details are notified season by season.',
    documents: 'Please check the official scheme guidelines. Document requirements may vary for landholding and tenant farmers.',
    application: 'Use the official Karnataka agriculture portal or visit an authorised Raitha Samparka Kendra/bank/insurance enrolment centre.',
    informationUrl: 'https://raitamitra.karnataka.gov.in/88/karnataka-raitha-suraksha-pradhana-mantri-fasal-bima-yojana/kn',
    applicationUrl: 'https://raitamitra.karnataka.gov.in/88/karnataka-raitha-suraksha-pradhana-mantri-fasal-bima-yojana/kn',
    verificationDate
  },
  {
    id: 'krishi-bhagya',
    sourceRevision: 1,
    name: 'Krishi Bhagya Scheme',
    category: 'water-management',
    level: 'State',
    states: ['Karnataka'],
    department: 'Department of Agriculture, Government of Karnataka',
    description: 'Karnataka scheme information for rainwater harvesting and efficient farm water use.',
    intendedFor: 'Farmers seeking assistance for on-farm rainwater management, subject to current program availability.',
    eligibility: 'The official Karnataka page is a programme information page. Specific eligibility, beneficiary rules, subsidy rates, and current availability must be confirmed from the department.',
    benefits: 'Please check the official scheme guidelines for the current assistance package and subsidy details.',
    documents: 'Please check the official scheme guidelines; confirm document requirements with the local agriculture office.',
    application: 'Contact the local Department of Agriculture office or Raitha Samparka Kendra. Confirm whether the scheme is open in your district and current year.',
    informationUrl: 'https://raitamitra.karnataka.gov.in/52/krishi-bhagya-scheme/kn',
    applicationUrl: 'https://raitamitra.karnataka.gov.in/52/krishi-bhagya-scheme/kn',
    verificationDate
  }
];

export function findSchemes({ q = '', state = '', category = '' } = {}) {
  const query = String(q).trim().toLocaleLowerCase();
  const stateFilter = String(state).trim().toLocaleLowerCase();
  const categoryFilter = String(category).trim().toLocaleLowerCase();
  return schemeCatalogue.filter(scheme => {
    const translatedContent = ['en', 'hi', 'kn'].flatMap(language => Object.values(getSchemeContent(scheme, language).content));
    const searchable = [scheme.department, scheme.category, scheme.states.join(' '), ...translatedContent].join(' ').toLocaleLowerCase();
    const matchesQuery = !query || searchable.includes(query);
    const matchesState = !stateFilter || stateFilter === 'all' ||
      scheme.states.some(value => value.toLocaleLowerCase().includes(stateFilter)) ||
      scheme.states.includes('All India');
    const matchesCategory = !categoryFilter || scheme.category === categoryFilter;
    return matchesQuery && matchesState && matchesCategory;
  });
}

export function findSchemeById(id) {
  return schemeCatalogue.find(scheme => scheme.id === String(id));
}

export function localizeScheme(scheme, language = 'en') {
  const { content, translation } = getSchemeContent(scheme, language);
  const contentLanguage = ['translated', 'original'].includes(translation.status) ? language : 'en';
  return { ...scheme, ...content, contentLanguage, translation };
}

export function potentiallyRelevantSchemes(farmer = {}) {
  const state = String(farmer.state || '').trim().toLocaleLowerCase();
  return schemeCatalogue.filter(scheme => {
    if (scheme.states.includes('All India')) return true;
    return Boolean(state) && scheme.states.some(value => value.toLocaleLowerCase() === state);
  });
}
