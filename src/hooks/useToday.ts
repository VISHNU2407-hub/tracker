import { useEffect, useState } from 'react';
import { todayISO } from '../services/date';

/**
 * Today's local date (YYYY-MM-DD) that automatically rolls over at midnight.
 * One timeout scheduled to the next local midnight (re-scheduled after each
 * fire), plus an immediate refresh when the tab becomes visible again
 * (covers sleep and backgrounded tabs). No polling.
 */
export function useToday(): string {
  const [today, setToday] = useState(todayISO);

  useEffect(() => {
    let timer = 0;
    const schedule = () => {
      const now = new Date();
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
      timer = window.setTimeout(() => {
        setToday(todayISO());
        schedule();
      }, next.getTime() - now.getTime());
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') setToday(todayISO());
    };
    document.addEventListener('visibilitychange', onVisible);

    schedule();

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return today;
}
