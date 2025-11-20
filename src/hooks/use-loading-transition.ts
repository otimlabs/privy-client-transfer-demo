import { useState, useEffect, useRef, useCallback } from "react";

interface UseLoadingTransitionReturn {
  isLoading: boolean;
  startLoading: () => void;
  stopLoading: () => void;
}

export function useLoadingTransition(
  minDelay: number = 2000,
): UseLoadingTransitionReturn {
  const [isLoading, setIsLoading] = useState(true);
  const loadingStartTime = useRef<number>(Date.now());
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const startLoading = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    loadingStartTime.current = Date.now();
    setIsLoading(true);
  }, []);

  const stopLoading = useCallback(() => {
    const elapsed = Date.now() - loadingStartTime.current;
    const remaining = Math.max(minDelay - elapsed, 0);

    if (remaining === 0) {
      setIsLoading(false);
    } else {
      timeoutRef.current = setTimeout(() => {
        setIsLoading(false);
      }, remaining);
    }
  }, [minDelay]);

  useEffect(() => {
    stopLoading();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [stopLoading]);

  return {
    isLoading,
    startLoading,
    stopLoading,
  };
}
