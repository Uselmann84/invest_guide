import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { TabId } from '../models/types';

interface NavRequest {
  // Open an institution detail in the Institutions tab
  institutionId?: string;
  // Open a stock detail in the Stocks tab
  ticker?: string;
  // Marker so consumers can react each time even if values match
  nonce: number;
}

interface NavigationContextValue {
  activeTab: TabId;
  setActiveTab: (t: TabId) => void;
  openInstitution: (id: string) => void;
  openStock: (ticker: string) => void;
  /** Pop back to the tab the user came from (set by openInstitution/openStock). */
  goBack: () => boolean;
  /** Whether a back target is currently available */
  hasBack: boolean;
  pendingRequest: NavRequest | null;
  consumeRequest: () => void;
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

export function NavigationProvider({ children, activeTab, setActiveTab }: {
  children: React.ReactNode;
  activeTab: TabId;
  setActiveTab: (t: TabId) => void;
}) {
  const [pendingRequest, setPendingRequest] = useState<NavRequest | null>(null);
  const [backStack, setBackStack] = useState<TabId[]>([]);
  const nonceRef = useRef(0);

  const openInstitution = useCallback((id: string) => {
    nonceRef.current += 1;
    setBackStack(s => [...s, activeTab]);
    setPendingRequest({ institutionId: id, nonce: nonceRef.current });
    setActiveTab('institutions');
  }, [setActiveTab, activeTab]);

  const openStock = useCallback((ticker: string) => {
    nonceRef.current += 1;
    setBackStack(s => [...s, activeTab]);
    setPendingRequest({ ticker, nonce: nonceRef.current });
    setActiveTab('stocks');
  }, [setActiveTab, activeTab]);

  const goBack = useCallback(() => {
    let popped = false;
    setBackStack(s => {
      if (s.length === 0) return s;
      const target = s[s.length - 1];
      setActiveTab(target);
      popped = true;
      return s.slice(0, -1);
    });
    return popped;
  }, [setActiveTab]);

  const consumeRequest = useCallback(() => setPendingRequest(null), []);

  return (
    <NavigationContext.Provider value={{
      activeTab,
      setActiveTab,
      openInstitution,
      openStock,
      goBack,
      hasBack: backStack.length > 0,
      pendingRequest,
      consumeRequest,
    }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error('useNavigation must be used within NavigationProvider');
  return ctx;
}

// Hook for pages to react to pending requests targeted at them.
export function useNavRequest(targetTab: TabId, handler: (req: NavRequest) => void) {
  const { activeTab, pendingRequest, consumeRequest } = useNavigation();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!pendingRequest) return;
    if (activeTab !== targetTab) return;
    // Defer to next frame so the page is mounted/visible
    const t = requestAnimationFrame(() => {
      handlerRef.current(pendingRequest);
      consumeRequest();
    });
    return () => cancelAnimationFrame(t);
  }, [pendingRequest, activeTab, targetTab, consumeRequest]);
}
