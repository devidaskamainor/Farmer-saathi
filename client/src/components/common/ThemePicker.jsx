import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { THEMES, applyTheme, getSavedTheme } from '../../services/theme.js';

export function ThemePicker() {
  const [theme, setTheme] = useState(getSavedTheme());
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function selectTheme(id) {
    setTheme(id);
    applyTheme(id);
    setOpen(false);
  }

  const currentTheme = THEMES.find(t => t.id === theme) || THEMES[0];

  return (
    <div className="theme-switcher-wrapper" ref={ref}>
      <button
        type="button"
        className="theme-switcher-button"
        onClick={() => setOpen(prev => !prev)}
        aria-label="Change color theme"
        title={`Theme: ${currentTheme.name}`}
      >
        <span className="theme-dot" style={{ background: currentTheme.accent }} />
        <span>{currentTheme.name.split(' ')[0]}</span>
        <ChevronDown size={12} />
      </button>
      {open && (
        <div className="theme-menu" role="menu">
          {THEMES.map(t => (
            <button
              type="button"
              key={t.id}
              className={`theme-option ${theme === t.id ? 'theme-option-active' : ''}`}
              onClick={() => selectTheme(t.id)}
            >
              <span className="theme-option-dot" style={{ background: t.accent }} />
              <span>{t.name}</span>
              {theme === t.id && <Check size={14} className="theme-check" strokeWidth={2.5} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default ThemePicker;

