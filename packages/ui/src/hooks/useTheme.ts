import { useSyncExternalStore } from 'react';
import { themeStore } from '../stores/theme.ts';

export function useTheme() {
  const theme = useSyncExternalStore(
    themeStore.subscribe,
    themeStore.get,
  );

  return { theme, setTheme: themeStore.set, toggleTheme: themeStore.toggle };
}
