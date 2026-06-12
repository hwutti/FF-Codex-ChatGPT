import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../api';

interface AuthContextType {
  user: any;
  token: string | null;
  login: (userOrToken: any, maybeUser?: any) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser]   = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearSession = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  useEffect(() => {
    if (window.location.pathname === '/login') {
      setIsLoading(false);
      return;
    }

    const savedUser  = localStorage.getItem('user');

    // Gecachten User sofort einsetzen → App startet auch offline
    if (savedUser) {
      try { setUser(JSON.parse(savedUser)); } catch {}
    }

    // Im Hintergrund beim Server verifizieren
    authApi.me()
      .then(data => {
        setUser(data);
        localStorage.setItem('user', JSON.stringify(data)); // Cache aktualisieren
      })
      .catch((err: any) => {
        const isNetworkError = !err.response; // kein response = offline/Netzwerkfehler
        if (isNetworkError && savedUser) {
          // Offline aber gecachter User vorhanden → eingeloggt bleiben
          return;
        }
        // Online aber 401/403 → echte Session abgelaufen → ausloggen
        clearSession();
      })
      .finally(() => setIsLoading(false));
  }, []);

  // auth:logout Event vom API-Interceptor abfangen (kein Hard-Redirect, kein Reload-Loop)
  useEffect(() => {
    const handler = () => clearSession();
    window.addEventListener('auth:logout', handler);
    return () => window.removeEventListener('auth:logout', handler);
  }, []);

  const login = (userOrToken: any, maybeUser?: any) => {
    const userData = maybeUser || userOrToken;
    setToken(null);
    setUser(userData);
    localStorage.removeItem('token');
    localStorage.setItem('user', JSON.stringify(userData)); // für Offline-Fallback cachen
  };

  const logout = async () => {
    try { await authApi.logout(); } catch {}
    clearSession();
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
