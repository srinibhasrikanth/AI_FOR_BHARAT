import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from "react";
import { authApi, UserData } from "@/lib/api";

// How long before token expiry to attempt a proactive refresh (2 min)
const REFRESH_MARGIN_MS = 2 * 60 * 1000;
// Retry delay when a cookie-based refresh fails but the local token is still alive
const REFRESH_RETRY_MS = 60 * 1000;

interface AuthContextType {
  user: UserData | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ALL_ROLES = ["patient", "doctor", "pharmacist", "admin"] as const;
const getTokenKey = (role: string) => `${role}_token`;

/** Decode a JWT payload (no signature verification — frontend only). */
function decodeJwtPayload(token: string): { exp?: number; role?: string } | null {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

/** Returns true if the token exists and its `exp` is more than 10 s in the future. */
function isTokenStillValid(token: string | null | undefined): boolean {
  if (!token) return false;
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return false;
  return payload.exp * 1000 > Date.now() + 10_000;
}

/**
 * Returns milliseconds until the token expires, minus a 2-minute safety margin.
 * If the token is invalid / already expired returns 0.
 */
function msUntilRefresh(token: string | null | undefined): number {
  if (!token) return 0;
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return 0;
  // Refresh before actual expiry so we never hit a 401 in flight
  const ms = payload.exp * 1000 - Date.now() - REFRESH_MARGIN_MS;
  return Math.max(ms, 0);
}

/** Remove every role-scoped token key from localStorage. */
function clearAllRoleTokens() {
  ALL_ROLES.forEach((role) => localStorage.removeItem(getTokenKey(role)));
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserData | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Schedule the next silent token refresh based on current token's exp. */
  const scheduleRefresh = useCallback((token: string | null) => {
    // Clear any previously scheduled refresh
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    const delay = msUntilRefresh(token);
    if (delay <= 0) return; // token already expired or missing — nothing to schedule

    refreshTimerRef.current = setTimeout(async () => {
      try {
        const storedRt = localStorage.getItem("mediflow_rt");
        const response = await authApi.refreshToken(storedRt);
        const { accessToken: newToken, user: refreshedUser, refreshToken: newRt } = response.data as any;
        setAccessToken(newToken);
        const updatedUser = refreshedUser ?? null;
        if (updatedUser) {
          setUser(updatedUser);
          const tokenKey = getTokenKey(updatedUser.role);
          localStorage.setItem(tokenKey, newToken);
          localStorage.setItem("mediflow_user", JSON.stringify(updatedUser));
        }
        if (newRt) localStorage.setItem("mediflow_rt", newRt);
        // Recursively schedule the next refresh for the new token
        scheduleRefresh(newToken);
      } catch {
        // Cookie-based refresh failed (common in cross-origin CloudFront production
        // until the user logs in again with the new sameSite:none cookie).
        // Do NOT log the user out — the localStorage access token is still valid.
        // Instead: read the current stored token and reschedule a retry before
        // it expires so the user stays authenticated as long as possible.
        console.warn("[AuthContext] Silent refresh failed — retrying from localStorage token.");
        try {
          const storedUser = localStorage.getItem("mediflow_user");
          if (storedUser) {
            const u: UserData = JSON.parse(storedUser);
            const storedToken = localStorage.getItem(getTokenKey(u.role));
            if (isTokenStillValid(storedToken)) {
              // Token is still alive — reschedule a retry in 60 s
              refreshTimerRef.current = setTimeout(() => scheduleRefresh(storedToken), REFRESH_RETRY_MS);
              return;
            }
          }
        } catch { /* ignore parse errors */ }
        // Token is gone/expired — nothing more we can do silently.
        console.warn("[AuthContext] Stored token also expired. User will need to log in again.");
      }
    }, delay);
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  // Restore session on mount: first try the refresh endpoint (uses HttpOnly
  // cookie). If that fails — e.g. cookie expired or network hiccup — fall back
  // to the access token that is still stored in localStorage so the user is
  // not logged out just because the refresh call errored.
  useEffect(() => {
    const restore = async () => {
      try {
        const storedRt = localStorage.getItem("mediflow_rt");
        const response = await authApi.refreshToken(storedRt);
        const { accessToken: newToken, user: refreshedUser, refreshToken: newRt } = response.data as any;
        if (newRt) localStorage.setItem("mediflow_rt", newRt);

        // Prefer the user returned by the refresh endpoint; fall back to localStorage
        let finalUser: UserData | null = refreshedUser ?? null;
        if (!finalUser) {
          const stored = localStorage.getItem("mediflow_user");
          if (stored) finalUser = JSON.parse(stored);
        }

        if (finalUser && newToken) {
          setUser(finalUser);
          setAccessToken(newToken);
          // Keep localStorage in sync
          localStorage.setItem("mediflow_user", JSON.stringify(finalUser));
          const tokenKey = getTokenKey(finalUser.role);
          localStorage.setItem(tokenKey, newToken);
          // Schedule the next silent refresh
          scheduleRefresh(newToken);
        }
      } catch {
        // Refresh cookie expired / invalid.
        // Before giving up, check whether we have a still-valid access token
        // in localStorage (covers "new tab" and short page-refresh scenarios).
        let restoredFromStorage = false;
        const storedUserStr = localStorage.getItem("mediflow_user");
        if (storedUserStr) {
          try {
            const storedUser: UserData = JSON.parse(storedUserStr);
            const tokenKey = getTokenKey(storedUser.role);
            const storedToken = localStorage.getItem(tokenKey);
            if (isTokenStillValid(storedToken)) {
              setUser(storedUser);
              setAccessToken(storedToken);
              restoredFromStorage = true;
              // Schedule refresh for this token too
              scheduleRefresh(storedToken);
            }
          } catch {
            // Corrupted localStorage — fall through to full clear
          }
        }

        if (!restoredFromStorage) {
          // Neither refresh nor local token is usable — proper sign-out.
          setUser(null);
          setAccessToken(null);
          localStorage.removeItem("mediflow_user");
          clearAllRoleTokens();
        }
      } finally {
        setIsLoading(false);
      }
    };
    restore();

    // ── Visibility-change listener ──────────────────────────────────────────
    // Razorpay / UPI payment apps navigate away from and back to the browser tab.
    // When the tab becomes visible again, the refresh timer may have fired while
    // the page was hidden and been silently ignored by the browser. Re-attempt a
    // token refresh every time the user returns to this tab.
    const handleVisibility = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const storedUserStr = localStorage.getItem("mediflow_user");
        if (!storedUserStr) return;
        const storedUser: UserData = JSON.parse(storedUserStr);
        const storedToken = localStorage.getItem(getTokenKey(storedUser.role));
        // If token is still valid and has > 5 min left, nothing to do
        if (storedToken) {
          const payload = decodeJwtPayload(storedToken);
          const msLeft = payload?.exp ? payload.exp * 1000 - Date.now() : 0;
          if (msLeft > 5 * 60 * 1000) return;
        }
        // Token is missing or nearly expired — try a refresh
        const storedRt = localStorage.getItem("mediflow_rt");
        const response = await authApi.refreshToken(storedRt);
        const { accessToken: newToken, user: refreshedUser, refreshToken: newRt } = response.data as any;
        if (newRt) localStorage.setItem("mediflow_rt", newRt);
        setAccessToken(newToken);
        const updatedUser = refreshedUser ?? storedUser;
        setUser(updatedUser);
        localStorage.setItem(getTokenKey(updatedUser.role), newToken);
        localStorage.setItem("mediflow_user", JSON.stringify(updatedUser));
        scheduleRefresh(newToken);
      } catch {
        // Refresh still failing — keep using localStorage token; do not log out.
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    // Cleanup timer and listener on unmount
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [scheduleRefresh]);

  const login = async (identifier: string, password: string) => {
    try {
      const response = await authApi.login({ identifier, password });
      const { user: userData, accessToken: token } = response.data;

      setUser(userData);
      setAccessToken(token);

      const tokenKey = getTokenKey(userData.role);
      localStorage.setItem(tokenKey, token);
      // Persist user so session survives a hard refresh
      localStorage.setItem("mediflow_user", JSON.stringify(userData));
      // Store refresh token as body-based fallback for cross-origin CloudFront
      // environments where the HttpOnly cookie may not be forwarded correctly.
      const rt = (response.data as any)?.refreshToken;
      if (rt) localStorage.setItem("mediflow_rt", rt);
      // Schedule automatic refresh
      scheduleRefresh(token);
    } catch (err) {
      throw err;
    }
  };

  const logout = async () => {
    // Cancel pending refresh
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    try {
      await authApi.logout();
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      setUser(null);
      setAccessToken(null);
      localStorage.removeItem("mediflow_user");
      localStorage.removeItem("mediflow_rt");
      clearAllRoleTokens(); // wipe every role token, not just the current one
    }
  };

  const refreshToken = async () => {
    try {
      const storedRt = localStorage.getItem("mediflow_rt");
      const response = await authApi.refreshToken(storedRt);
      const { accessToken: newToken, user: refreshedUser, refreshToken: newRt } = response.data as any;
      if (newRt) localStorage.setItem("mediflow_rt", newRt);

      setAccessToken(newToken);
      const updatedUser = refreshedUser ?? user;
      if (updatedUser) {
        const tokenKey = getTokenKey(updatedUser.role);
        localStorage.setItem(tokenKey, newToken);
        localStorage.setItem("mediflow_user", JSON.stringify(updatedUser));
        if (refreshedUser) setUser(refreshedUser);
      }
      // Reschedule after manual refresh too
      scheduleRefresh(newToken);
    } catch (err) {
      // ⚠️  Do NOT call logout() here.
      // Logging out on a failed refresh destroys tokens mid-flow (e.g. during
      // a Razorpay payment). The caller already handles the error gracefully,
      // and the existing access token in localStorage may still be valid.
      // A proper logout only happens when the user explicitly signs out, or
      // when a protected API call returns 401 and the user re-authenticates.
      console.warn("[AuthContext] Token refresh failed — retaining existing session.", err);
      throw err;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isAuthenticated: !!user && !!accessToken,
        isLoading,
        login,
        logout,
        refreshToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
