import React, { createContext, useContext, useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

type User = { name: string; email: string };
type AuthContextType = {
  user: User | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSession = async () => {
    try {
      const res = await fetch(`${API_URL}/api/auth/session`, { credentials: 'include' });
      if (!res.ok) throw new Error("Not logged in");
      const data = await res.json();
      if (data && Object.keys(data).length > 0 && data.user) {
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (err) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
  }, []);

  const login = async (email: string, pass: string) => {
    // 1. Get CSRF Token
    const csrfRes = await fetch(`${API_URL}/api/auth/csrf`, { credentials: 'include' });
    const { csrfToken } = await csrfRes.json();

    // 2. Post Credentials
    const res = await fetch(`${API_URL}/api/auth/callback/credentials`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      redirect: 'manual', // Prevent browser from following the 302 Auth.js redirect
      body: JSON.stringify({
        email,
        password: pass,
        csrfToken,
        redirect: false,
      }),
    });

    if (res.type === 'opaqueredirect' || res.status === 302 || res.ok) {
      // 3. Re-fetch session
      await fetchSession();
    } else {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Login failed');
    }
  };

  const logout = async () => {
    // Get CSRF Token for logout
    const csrfRes = await fetch(`${API_URL}/api/auth/csrf`, { credentials: 'include' });
    const { csrfToken } = await csrfRes.json();

    await fetch(`${API_URL}/api/auth/signout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      credentials: 'include',
      body: new URLSearchParams({ csrfToken, redirect: 'false' })
    });
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
