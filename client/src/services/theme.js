export const THEMES = [
  { id: 'light', name: 'Nature Green', icon: 'Sun', accent: '#315d3d', bg: '#f7f8f4' },
  { id: 'dark', name: 'Midnight Dark', icon: 'Moon', accent: '#48bb78', bg: '#0d1711' },
  { id: 'earth', name: 'Harvest Earth', icon: 'Sparkles', accent: '#b45309', bg: '#faf5ee' },
  { id: 'ocean', name: 'Monsoon Blue', icon: 'Droplets', accent: '#0284c7', bg: '#f2f7fb' }
];

const THEME_STORAGE_KEY = 'farmer_saathi_theme';

export function getSavedTheme() {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved && THEMES.some(t => t.id === saved)) return saved;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)')?.matches) {
      return 'dark';
    }
  } catch {}
  return 'light';
}

export function applyTheme(themeId) {
  const validTheme = THEMES.some(t => t.id === themeId) ? themeId : 'light';
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', validTheme);
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    const themeConfig = THEMES.find(t => t.id === validTheme);
    if (metaThemeColor && themeConfig) {
      metaThemeColor.setAttribute('content', themeConfig.bg);
    }
  }
  try {
    localStorage.setItem(THEME_STORAGE_KEY, validTheme);
  } catch {}
  return validTheme;
}
