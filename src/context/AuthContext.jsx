import { createContext, useContext, useMemo, useState } from 'react';
import { authApi } from '../api/authApi';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user') || 'null'));

  const saveAuthenticatedUser = (response) => {
    const data = response?.data || response;

    if (!data?.token) {
      throw new Error('Backend không trả về token đăng nhập.');
    }

    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data));
    setUser(data);
    return data;
  };

  const login = async (username, password) => {
    const response = await authApi.login({ username, password });
    return saveAuthenticatedUser(response);
  };

  const loginWithGoogle = async (credential) => {
    const response = await authApi.googleLogin(credential);
    return saveAuthenticatedUser(response);
  };

  const updateUser = (changes) => {
    setUser((current) => {
      const next = { ...(current || {}), ...(changes || {}) };
      localStorage.setItem('user', JSON.stringify(next));
      return next;
    });
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const value = useMemo(() => ({ user, login, loginWithGoogle, logout, updateUser }), [user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
