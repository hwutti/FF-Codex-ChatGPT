import React, { createContext, useContext } from 'react';
import { useEinsatzplaeneCache, CacheStatus } from '../hooks/useEinsatzplaeneCache';
import { useAuth } from './AuthContext';

const EinsatzplaeneCacheContext = createContext<CacheStatus>({
  status: 'idle', cached: 0, total: 0,
});

export function EinsatzplaeneCacheProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  // Sync nur wenn eingeloggt — innerhalb AuthProvider
  const status = useEinsatzplaeneCache(!!user);
  return (
    <EinsatzplaeneCacheContext.Provider value={status}>
      {children}
    </EinsatzplaeneCacheContext.Provider>
  );
}

export function useEinsatzplaeneCacheStatus() {
  return useContext(EinsatzplaeneCacheContext);
}
