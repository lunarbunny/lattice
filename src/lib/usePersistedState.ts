import { useState, useEffect } from "react";

export function usePersistedState<T>(
  key: string,
  fallback: T,
  parse: (raw: string) => T = (raw) => raw as T,
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw != null ? parse(raw) : fallback;
    } catch {
      return fallback;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, String(value));
    } catch { /* private mode */ }
  }, [key, value]);

  return [value, setValue];
}
