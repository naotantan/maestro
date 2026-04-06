type Theme = 'light' | 'dark';

function getInitialTheme(): Theme {
  const stored = localStorage.getItem('theme');
  if (stored === 'light' || stored === 'dark') return stored;
  return 'dark';
}

function applyTheme(theme: Theme) {
  document.body.classList.toggle('light', theme === 'light');
}

let currentTheme: Theme = getInitialTheme();
const listeners = new Set<(theme: Theme) => void>();

applyTheme(currentTheme);

export const themeStore = {
  get(): Theme {
    return currentTheme;
  },

  set(theme: Theme) {
    currentTheme = theme;
    localStorage.setItem('theme', theme);
    applyTheme(theme);
    listeners.forEach(fn => fn(theme));
  },

  toggle() {
    themeStore.set(currentTheme === 'dark' ? 'light' : 'dark');
  },

  subscribe(fn: (theme: Theme) => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
