import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authService } from '@/services/api';
import { ApiError } from '@/services/http';
import type { AdminUser } from '@/types';

export type AuthContextValue = {
  user: AdminUser | null;
  /** Verdadeiro enquanto a sessão está sendo verificada no carregamento. */
  isLoading: boolean;
  login: (email: string, password: string) => Promise<AdminUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  const refresh = useCallback(async () => {
    try {
      const response = await authService.me();
      setUser(response.user);
    } catch (error) {
      // 401 apenas significa "não há sessão": não é um erro de tela.
      if (!(error instanceof ApiError) || error.status !== 401) {
        console.error('Falha ao verificar a sessão', error);
      }
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await authService.login(email, password);
      setUser(response.user);
      await queryClient.invalidateQueries();
      return response.user;
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      setUser(null);
      queryClient.clear();
    }
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isLoading, login, logout, refresh }),
    [user, isLoading, login, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de <AuthProvider>.');
  }
  return context;
}