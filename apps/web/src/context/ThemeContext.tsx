import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

export type ThemeMode = 'auto' | 'day' | 'night';
export type ActiveTheme = 'day' | 'night';

interface ThemeContextType {
  mode: ThemeMode;
  theme: ActiveTheme;
  setMode: (mode: ThemeMode) => void;
  cycleMode: () => void;
  isSunlight: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function getAutoTheme(): ActiveTheme {
  const now = new Date();
  const time = now.getHours() + now.getMinutes() / 60;
  // Day mode from 6:00 AM (dawn) to 6:30 PM (18.5, dusk)
  return time >= 6.0 && time < 18.5 ? 'day' : 'night';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('payanam_theme_mode') as ThemeMode | null;
    return saved === 'day' || saved === 'night' || saved === 'auto' ? saved : 'auto';
  });

  const [theme, setTheme] = useState<ActiveTheme>(() => {
    const saved = localStorage.getItem('payanam_theme_mode') as ThemeMode | null;
    if (saved === 'day') return 'day';
    if (saved === 'night') return 'night';
    return getAutoTheme();
  });

  const applyTheme = useCallback((activeTheme: ActiveTheme) => {
    setTheme(activeTheme);
    document.documentElement.setAttribute('data-theme', activeTheme);
    document.body.setAttribute('data-theme', activeTheme);
    if (activeTheme === 'day') {
      document.body.style.backgroundColor = '#f8fafc';
      document.body.style.color = '#020617';
    } else {
      document.body.style.backgroundColor = '#050811';
      document.body.style.color = '#ffffff';
    }
  }, []);

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    localStorage.setItem('payanam_theme_mode', newMode);
    if (newMode === 'auto') {
      applyTheme(getAutoTheme());
    } else {
      applyTheme(newMode);
    }
  }, [applyTheme]);

  const cycleMode = useCallback(() => {
    if (mode === 'auto') setMode('day');
    else if (mode === 'day') setMode('night');
    else setMode('auto');
  }, [mode, setMode]);

  // Handle auto-detection and periodic clock check
  useEffect(() => {
    if (mode === 'auto') {
      applyTheme(getAutoTheme());
      const interval = setInterval(() => {
        applyTheme(getAutoTheme());
      }, 60000); // Check every minute
      return () => clearInterval(interval);
    } else {
      applyTheme(mode);
    }
  }, [mode, applyTheme]);

  return (
    <ThemeContext.Provider value={{ mode, theme, setMode, cycleMode, isSunlight: theme === 'day' }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

