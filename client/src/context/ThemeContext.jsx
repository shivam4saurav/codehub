import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

// v2: the redesign made light the default, so older stored choices start fresh.
const THEME_KEY = 'codehub:theme-v2';
const MOTION_KEY = 'codehub:reduced-motion';

const ThemeContext = createContext(null);

const readStored = (key, fallback) => {
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
};

const systemPrefersDark = () =>
  window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;

const resolve = (preference) => {
  if (preference === 'system') return systemPrefersDark() ? 'dark' : 'light';
  return preference === 'dark' ? 'dark' : 'light';
};

export const ThemeProvider = ({ children }) => {
  // Light-first: anything unrecognised resolves to the paper theme.
  const [preference, setPreference] = useState(() => readStored(THEME_KEY, 'light'));
  const [reducedMotion, setReducedMotion] = useState(
    () => readStored(MOTION_KEY, 'false') === 'true',
  );

  const theme = resolve(preference);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('light', theme === 'light');
    root.classList.toggle('dark', theme === 'dark');
    root.style.colorScheme = theme;

    try {
      window.localStorage.setItem(THEME_KEY, preference);
    } catch {
      /* private mode - keep the in-memory value */
    }
  }, [preference, theme]);

  useEffect(() => {
    document.documentElement.dataset.reducedMotion = String(reducedMotion);
    try {
      window.localStorage.setItem(MOTION_KEY, String(reducedMotion));
    } catch {
      /* ignore */
    }
  }, [reducedMotion]);

  // Follow the OS while the user is on "system".
  useEffect(() => {
    if (preference !== 'system') return undefined;

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = () => setPreference('system');
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [preference]);

  const toggleTheme = useCallback(() => {
    setPreference((current) => (resolve(current) === 'dark' ? 'light' : 'dark'));
  }, []);

  const value = useMemo(
    () => ({
      theme,
      preference,
      setPreference,
      toggleTheme,
      reducedMotion,
      setReducedMotion,
      isDark: theme === 'dark',
    }),
    [theme, preference, toggleTheme, reducedMotion],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside <ThemeProvider>');
  return context;
};

export default ThemeContext;
