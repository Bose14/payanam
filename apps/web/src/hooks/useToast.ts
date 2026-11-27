import { useCallback, useEffect, useRef, useState } from 'react';

/** A short message that clears itself. The timer is cancelled on unmount and when a newer message arrives. */
export function useToast(durationMs = 3500) {
  const [toast, setToast] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    if (timer.current) clearTimeout(timer.current);
    setToast(msg);
    timer.current = setTimeout(() => setToast(''), durationMs);
  }, [durationMs]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return [toast, showToast] as const;
}
