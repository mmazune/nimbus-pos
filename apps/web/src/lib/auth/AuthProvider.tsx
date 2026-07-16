import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { ApiError } from "@/lib/api/client";
import {
  getMeRequest,
  loginWithPasswordRequest,
  loginWithPinRequest,
  logoutRequest,
} from "@/lib/auth/auth-api";
import {
  getDisplayName,
  isCashierCompatible,
  isSupervisorCompatible,
  isWaiterCompatible,
  resolveDefaultMembership,
} from "@/lib/auth/role";
import { clearStoredTokens, getStoredTokens, storeTokens } from "@/lib/auth/token-storage";

import type { AuthMeResponse, LoginResponse, StoredTokens, WaiterSessionState } from "./types";

type AuthStatus = "booting" | "loading" | "anonymous" | "authenticated";

type AuthContextValue = WaiterSessionState & {
  accessToken: string | null;
  refreshToken: string | null;
  authError: string | null;
  displayName: string;
  loginWithPassword: (email: string, password: string) => Promise<AuthMeResponse>;
  loginWithPin: (branchId: string, pin: string) => Promise<AuthMeResponse>;
  loadMe: (tokenOverride?: string) => Promise<AuthMeResponse>;
  logout: () => Promise<void>;
  clearSession: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type AuthProviderProps = {
  children: ReactNode;
};

function tokenPairFromLogin(response: LoginResponse): StoredTokens {
  return {
    accessToken: response.accessToken,
    refreshToken: response.refreshToken,
  };
}

export function AuthProvider({ children }: AuthProviderProps) {
  const queryClient = useQueryClient();
  const restoredRef = useRef(false);
  const [status, setStatus] = useState<AuthStatus>("booting");
  const [tokens, setTokens] = useState<StoredTokens | null>(null);
  const [user, setUser] = useState<AuthMeResponse | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const clearSession = useCallback(() => {
    clearStoredTokens();
    setTokens(null);
    setUser(null);
    setStatus("anonymous");
    queryClient.clear();
  }, [queryClient]);

  const loadMe = useCallback(
    async (tokenOverride?: string) => {
      const token = tokenOverride || tokens?.accessToken;
      if (!token) {
        clearSession();
        throw new ApiError({
          status: 401,
          code: "UNAUTHORIZED",
          message: "Session token is missing.",
        });
      }

      setStatus("loading");
      setAuthError(null);

      try {
        const me = await getMeRequest(token);
        setUser(me);
        setStatus("authenticated");
        return me;
      } catch (error) {
        if (error instanceof ApiError && error.isAuthError) {
          clearSession();
          setAuthError("Your session expired. Please log in again.");
        } else {
          setStatus(tokens ? "authenticated" : "anonymous");
          setAuthError(error instanceof Error ? error.message : "Could not load session.");
        }
        throw error;
      }
    },
    [clearSession, tokens],
  );

  const applyLogin = useCallback(
    async (response: LoginResponse) => {
      const nextTokens = tokenPairFromLogin(response);
      storeTokens(nextTokens);
      setTokens(nextTokens);
      const me = await loadMe(nextTokens.accessToken);
      return me;
    },
    [loadMe],
  );

  const loginWithPassword = useCallback(
    async (email: string, password: string) => {
      setStatus("loading");
      setAuthError(null);
      try {
        return await applyLogin(await loginWithPasswordRequest(email, password));
      } catch (error) {
        clearSession();
        setAuthError(error instanceof Error ? error.message : "Login failed.");
        throw error;
      }
    },
    [applyLogin, clearSession],
  );

  const loginWithPin = useCallback(
    async (branchId: string, pin: string) => {
      setStatus("loading");
      setAuthError(null);
      try {
        return await applyLogin(await loginWithPinRequest(branchId, pin));
      } catch (error) {
        clearSession();
        setAuthError(error instanceof Error ? error.message : "Quick PIN login failed.");
        throw error;
      }
    },
    [applyLogin, clearSession],
  );

  const logout = useCallback(async () => {
    const token = tokens?.accessToken;
    if (token) {
      try {
        await logoutRequest(token);
      } catch {
        // Local session clearing still wins when the backend logout request cannot complete.
      }
    }

    clearSession();
  }, [clearSession, tokens]);

  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    const stored = getStoredTokens();
    if (!stored) {
      setStatus("anonymous");
      return;
    }

    setTokens(stored);
    void loadMe(stored.accessToken).catch(() => {
      // loadMe already clears expired sessions and sets the user-facing auth error.
    });
  }, [loadMe]);

  const membership = resolveDefaultMembership(user);

  const value = useMemo<AuthContextValue>(
    () => ({
      accessToken: tokens?.accessToken || null,
      refreshToken: tokens?.refreshToken || null,
      authError,
      user,
      isAuthenticated: status === "authenticated" && !!tokens?.accessToken,
      isLoading: status === "booting" || status === "loading",
      isWaiter: isWaiterCompatible(user),
      isCashier: isCashierCompatible(user),
      isSupervisor: isSupervisorCompatible(user),
      branchId: user?.context.defaultBranchId || membership?.branchId || null,
      branchName: membership?.branchName || null,
      organizationId: user?.context.defaultOrganizationId || membership?.organizationId || null,
      displayName: getDisplayName(user),
      loginWithPassword,
      loginWithPin,
      loadMe,
      logout,
      clearSession,
    }),
    [
      authError,
      clearSession,
      loadMe,
      loginWithPassword,
      loginWithPin,
      logout,
      membership,
      status,
      tokens,
      user,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
