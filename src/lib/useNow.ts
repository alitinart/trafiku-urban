import { useEffect, useState } from 'react';

/** Wall-clock seconds, re-rendering on each whole second. */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now() / 1000);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      setNow(Date.now() / 1000);
      t = setTimeout(tick, intervalMs - (Date.now() % intervalMs));
    };
    t = setTimeout(tick, intervalMs - (Date.now() % intervalMs));
    return () => clearTimeout(t);
  }, [intervalMs]);
  return now;
}
