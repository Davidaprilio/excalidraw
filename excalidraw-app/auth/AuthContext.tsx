import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";

import api from "../data/api";

import type { ReactNode } from "react";

export interface User {
  id: string;
  email: string;
  name: string;
  /** set when the user has a profile photo (see api.avatarUrl) */
  avatar_version?: string | null;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  /** resolves the MFA token when a second factor is needed, else null */
  login: (email: string, password: string) => Promise<string | null>;
  completeMfaLogin: (
    mfaToken: string,
    second: { code: string } | { recoveryCode: string },
  ) => Promise<void>;
  loginWithPasskey: () => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
  /** after profile changes */
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

/** Like useAuth, but null outside AuthProvider (the editor also runs without it) */
export function useOptionalAuth(): AuthContextType | null {
  return useContext(AuthContext);
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    const token = api.getToken();
    if (!token) {
      setIsLoading(false);
      return;
    }
    try {
      const res = await api.getMe();
      setUser(res.user);
    } catch {
      api.logout();
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (email: string, password: string) => {
    const res = await api.login(email, password);
    if ("mfaToken" in res) {
      return res.mfaToken;
    }
    setUser(res.user);
    return null;
  };

  const completeMfaLogin = async (
    mfaToken: string,
    second: { code: string } | { recoveryCode: string },
  ) => {
    const res = await api.completeMfaLogin(mfaToken, second);
    setUser(res.user);
  };

  const loginWithPasskey = async () => {
    const res = await api.loginWithPasskey();
    setUser(res.user);
  };

  const register = async (email: string, password: string, name?: string) => {
    const res = await api.register(email, password, name);
    setUser(res.user);
  };

  const logout = () => {
    api.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        completeMfaLogin,
        loginWithPasskey,
        register,
        logout,
        updateUser: setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
