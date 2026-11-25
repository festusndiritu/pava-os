import { useEffect, useState } from 'react';

/** useState that survives a refresh or re-login. Pass a null key to keep it in memory only. */
export function usePersistedState<T>(key: string | null, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!key) return;
    try {
      const raw = localStorage.getItem(key);
      setValue(raw ? JSON.parse(raw) : initial);
    } catch {}
    setLoadedKey(key);
  }, [key]);

  useEffect(() => {
    if (!key || loadedKey !== key) return;
    try {
      const json = JSON.stringify(value);
      if (json === JSON.stringify(initial)) localStorage.removeItem(key);
      else localStorage.setItem(key, json);
    } catch {}
  }, [value, loadedKey, key]);

  return [value, setValue] as const;
}
