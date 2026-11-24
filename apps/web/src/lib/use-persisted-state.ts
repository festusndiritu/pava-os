import { useEffect, useState } from 'react';

/** useState that survives a refresh or re-login. Pass a null key to keep it in memory only. */
export function usePersistedState<T>(key: string | null, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!key) return;
    try {
      const raw = localStorage.getItem(key);
      if (raw) setValue(JSON.parse(raw));
    } catch {}
    setReady(true);
  }, [key]);

  useEffect(() => {
    if (!ready || !key) return;
    try {
      const json = JSON.stringify(value);
      if (json === JSON.stringify(initial)) localStorage.removeItem(key);
      else localStorage.setItem(key, json);
    } catch {}
  }, [value, ready, key]);

  return [value, setValue] as const;
}
