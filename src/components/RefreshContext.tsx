import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { userPreferenceService } from '../services/userPreferenceService';

interface RefreshContextValue {
  lastRefresh: number;       // timestamp
  isRefreshing: boolean;
  triggerRefresh: () => void;
}

const RefreshContext = createContext<RefreshContextValue>({
  lastRefresh: Date.now(),
  isRefreshing: false,
  triggerRefresh: () => {},
});

export function RefreshProvider({ children }: { children: React.ReactNode }) {
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const intervalRef = useRef<number | null>(null);

  const triggerRefresh = useCallback(() => {
    setIsRefreshing(true);
    // simulate data fetch delay
    setTimeout(() => {
      setLastRefresh(Date.now());
      setIsRefreshing(false);
    }, 600);
  }, []);

  // Auto-refresh interval
  useEffect(() => {
    const setup = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      const prefs = userPreferenceService.getPreferences();
      if (prefs.autoRefresh && prefs.refreshIntervalSeconds > 0) {
        intervalRef.current = window.setInterval(triggerRefresh, prefs.refreshIntervalSeconds * 1000);
      }
    };
    setup();
    // Re-check every 5s in case settings change
    const check = setInterval(setup, 5000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      clearInterval(check);
    };
  }, [triggerRefresh]);

  return (
    <RefreshContext.Provider value={{ lastRefresh, isRefreshing, triggerRefresh }}>
      {children}
    </RefreshContext.Provider>
  );
}

export function useRefresh() {
  return useContext(RefreshContext);
}
