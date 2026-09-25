import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

const API = process.env.REACT_APP_BACKEND_URL;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [authError, setAuthError] = useState('');

  const restoreSession = async () => {
    const savedToken = localStorage.getItem('token');
    setLoading(true);
    setAuthError('');
    if (!savedToken) {
      setUser(null);
      setToken(null);
      setLoading(false);
      return;
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await axios.get(`${API}/api/auth/me`, {
          headers: { Authorization: `Bearer ${savedToken}` }
        });
        setUser(response.data);
        setToken(savedToken);
        setLoading(false);
        return;
      } catch (error) {
        const status = error.response?.status;
        if (status === 401 || status === 403) {
          localStorage.removeItem('token');
          setToken(null);
          setUser(null);
          setLoading(false);
          return;
        }
        if (attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
          continue;
        }
        setToken(savedToken);
        setAuthError('No se pudo conectar con el servidor. Tu sesión sigue guardada.');
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    restoreSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email, password) => {
    const response = await axios.post(`${API}/api/auth/login`, { email, password });
    const { token, user } = response.data;
    localStorage.setItem('token', token);
    setToken(token);
    setUser(user);
    setAuthError('');
    return response.data;
  };

  const register = async (userData) => {
    const response = await axios.post(`${API}/api/auth/register`, userData);
    return response.data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setAuthError('');
  };

  const getAuthHeader = () => {
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const refreshUser = async () => {
    if (!token) return null;
    const response = await axios.get(`${API}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setUser(response.data);
    return response.data;
  };

  return (
    <AuthContext.Provider value={{ user, loading, token, authError, login, register, logout, getAuthHeader, refreshUser, restoreSession }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
};
