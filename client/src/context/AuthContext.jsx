import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, tokenStore } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore the session on page load so a refresh does not sign the user out.
  useEffect(() => {
    let cancelled = false;

    async function restore() {
      if (!tokenStore.get()) {
        setLoading(false);
        return;
      }
      try {
        const { user: me } = await api.get('/auth/me');
        if (!cancelled) setUser(me);
      } catch {
        tokenStore.clear();
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    restore();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      async login(identifier, password) {
        const data = await api.post('/auth/login', { identifier, password });
        tokenStore.set(data.token);
        setUser(data.user);
        return data.user;
      },
      async register(fields) {
        const data = await api.post('/auth/register', fields);
        tokenStore.set(data.token);
        setUser(data.user);
        return data.user;
      },
      logout() {
        tokenStore.clear();
        setUser(null);
      },
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
