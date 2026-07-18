import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation } from "react-router-dom";
import { api, setAuthToken, type AuthUser, type Portal, type UserRole } from "@/lib/api";

const TOKEN_KEY = (role: UserRole) => `sunsports_token_${role}`;
const USER_KEY = (role: UserRole) => `sunsports_user_${role}`;

const LOGIN_PATH: Record<UserRole, string> = {
  parent: "/parent/login",
  coach: "/coach/login",
  admin: "/app/login",
};

function roleFromPath(pathname: string): UserRole | null {
  if (pathname.startsWith("/parent")) return "parent";
  if (pathname.startsWith("/coach")) return "coach";
  if (pathname.startsWith("/app")) return "admin";
  return null;
}

interface AuthContextValue {
  token: string | null;
  user: AuthUser | null;
  loading: boolean;
  activeRole: UserRole | null;
  login: (portal: Portal, phone: string, pin: string) => Promise<void>;
  logout: () => void;
  loginPath: (role?: UserRole) => string;
  isRole: (role: UserRole) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStored(role: UserRole) {
  try {
    let token = localStorage.getItem(TOKEN_KEY(role));
    let raw = localStorage.getItem(USER_KEY(role));
    if (role === "admin" && !token) {
      const legacyToken = localStorage.getItem("sunsports_token");
      const legacyUser = localStorage.getItem("sunsports_user");
      if (legacyToken) {
        localStorage.setItem(TOKEN_KEY("admin"), legacyToken);
        localStorage.removeItem("sunsports_token");
        token = legacyToken;
      }
      if (legacyUser) {
        localStorage.setItem(USER_KEY("admin"), legacyUser);
        localStorage.removeItem("sunsports_user");
        raw = legacyUser;
      }
    }
    const user = raw ? (JSON.parse(raw) as AuthUser) : null;
    if (user && user.role !== role) return { token: null, user: null };
    return { token, user };
  } catch {
    return { token: null, user: null };
  }
}

function writeStored(role: UserRole, token: string, user: AuthUser) {
  localStorage.setItem(TOKEN_KEY(role), token);
  localStorage.setItem(USER_KEY(role), JSON.stringify(user));
}

function clearStored(role: UserRole) {
  localStorage.removeItem(TOKEN_KEY(role));
  localStorage.removeItem(USER_KEY(role));
}

function AuthSession({ children }: { children: ReactNode }) {
  const location = useLocation();
  const activeRole = roleFromPath(location.pathname);
  const genRef = useRef(0);

  const [{ token, user }, setAuth] = useState<{ token: string | null; user: AuthUser | null }>(() => {
    if (!activeRole) return { token: null, user: null };
    const stored = readStored(activeRole);
    if (stored.token) setAuthToken(stored.token);
    return stored;
  });
  const [loading, setLoading] = useState(() => !!(activeRole && readStored(activeRole).token));

  useEffect(() => {
    const gen = ++genRef.current;

    if (!activeRole) {
      setAuth({ token: null, user: null });
      setAuthToken(null);
      setLoading(false);
      return;
    }

    const stored = readStored(activeRole);
    if (!stored.token) {
      setAuth({ token: null, user: null });
      setAuthToken(null);
      setLoading(false);
      return;
    }

    // Optimistic: keep stored session while validating
    setAuth(stored);
    setAuthToken(stored.token);
    setLoading(true);

    void api
      .authMe(stored.token)
      .then((u) => {
        if (gen !== genRef.current) return;
        if (u.role !== activeRole) {
          clearStored(activeRole);
          setAuth({ token: null, user: null });
          setAuthToken(null);
          return;
        }
        writeStored(activeRole, stored.token!, u);
        setAuth({ token: stored.token, user: u });
        setAuthToken(stored.token);
      })
      .catch(() => {
        if (gen !== genRef.current) return;
        // Only clear if storage still has the same failing token
        const current = readStored(activeRole);
        if (current.token === stored.token) {
          clearStored(activeRole);
          setAuth({ token: null, user: null });
          setAuthToken(null);
        }
      })
      .finally(() => {
        if (gen === genRef.current) setLoading(false);
      });
  }, [activeRole]);

  const login = useCallback(async (portal: Portal, phone: string, pin: string) => {
    const res = await api.login({ phone, pin, portal });
    // Bump generation so any in-flight authMe cannot wipe this session
    genRef.current += 1;
    writeStored(portal, res.token, res.user);
    setAuthToken(res.token);
    setAuth({ token: res.token, user: res.user });
    setLoading(false);
  }, []);

  const logout = useCallback(() => {
    genRef.current += 1;
    if (activeRole) clearStored(activeRole);
    setAuthToken(null);
    setAuth({ token: null, user: null });
    setLoading(false);
  }, [activeRole]);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      loading,
      activeRole,
      login,
      logout,
      loginPath: (role) => LOGIN_PATH[role ?? activeRole ?? "admin"],
      isRole: (role) => user?.role === role,
    }),
    [token, user, loading, activeRole, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return <AuthSession>{children}</AuthSession>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function getStoredToken(role: UserRole): string | null {
  return localStorage.getItem(TOKEN_KEY(role));
}
