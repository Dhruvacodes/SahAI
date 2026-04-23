"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState
} from "react";

type AuthUser = {
  name: string;
  email: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Provides dashboard authentication state and actions to client components.
 *
 * @param props - Provider props containing the dashboard React tree.
 * @param props.children - Child components that can read authentication state.
 * @returns Auth context provider for the dashboard app.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>({
    email: "anm.supervisor@sahai.local",
    name: "ANM Supervisor"
  });

  const login = useCallback(async (email: string, password: string) => {
    const response = await fetch("/api/auth/login", {
      body: JSON.stringify({ email, password }),
      headers: {
        "Content-Type": "application/json"
      },
      method: "POST"
    });

    if (!response.ok) {
      throw new Error(await readAuthError(response));
    }

    const payload = (await response.json()) as { user?: Partial<AuthUser> };
    setUser({
      email,
      name: payload.user?.name ?? email.split("@")[0] ?? "Dashboard User"
    });
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      login,
      logout
    }),
    [login, logout, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Reads the current dashboard authentication context.
 *
 * @returns Current auth state and auth actions.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}

/**
 * Extracts a readable auth error from a failed response.
 *
 * @param response - Failed authentication response.
 * @returns Error message for login UI.
 */
async function readAuthError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? "Login failed.";
  } catch {
    return "Login failed.";
  }
}

