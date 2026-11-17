import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '../services/api';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/auth/me').then((r) => setUser(r.data.user)).catch(() => setUser(null)).finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => setUser((await api.post('/auth/login', { email, password })).data.user), []);
  const register = useCallback(async (name, email, password) => setUser((await api.post('/auth/register', { name, email, password })).data.user), []);
  const logout = useCallback(async () => { await api.post('/auth/logout').catch(() => {}); setUser(null); }, []);

  return <Ctx.Provider value={{ user, loading, login, register, logout }}>{children}</Ctx.Provider>;
}
