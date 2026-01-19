"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { User, Session } from "@supabase/supabase-js";
import {
  getSession,
  getUser,
  signOut as authSignOut,
  onAuthStateChange,
  getUserRole,
  type UserRole,
} from "@/lib/auth";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: UserRole;
  isLoading: boolean;
  isAuthenticated: boolean;
  signOut: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Initialize auth state
  const initializeAuth = useCallback(async () => {
    try {
      const { session: currentSession } = await getSession();
      setSession(currentSession);

      if (currentSession) {
        const { user: currentUser } = await getUser();
        setUser(currentUser);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error("Error initializing auth:", error);
      setUser(null);
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Refresh auth state
  const refreshAuth = useCallback(async () => {
    await initializeAuth();
  }, [initializeAuth]);

  // Sign out handler
  const signOut = useCallback(async () => {
    try {
      await authSignOut();
      setUser(null);
      setSession(null);
      router.push("/login");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  }, [router]);

  // Initialize on mount and subscribe to auth changes
  useEffect(() => {
    initializeAuth();

    // Subscribe to auth state changes
    const subscription = onAuthStateChange((event, newSession) => {
      console.log("Auth state changed:", event);
      setSession(newSession);

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        if (newSession?.user) {
          setUser(newSession.user);
        }
      } else if (event === "SIGNED_OUT") {
        setUser(null);
        setSession(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [initializeAuth]);

  // Auto-refresh token before expiry
  useEffect(() => {
    if (!session?.expires_at) return;

    const expiresAt = session.expires_at * 1000; // Convert to milliseconds
    const now = Date.now();
    const timeUntilExpiry = expiresAt - now;

    // Refresh 5 minutes before expiry
    const refreshTime = timeUntilExpiry - 5 * 60 * 1000;

    if (refreshTime > 0) {
      const timeout = setTimeout(() => {
        refreshAuth();
      }, refreshTime);

      return () => clearTimeout(timeout);
    } else if (timeUntilExpiry > 0) {
      // Token expires in less than 5 minutes, refresh now
      refreshAuth();
    }
  }, [session?.expires_at, refreshAuth]);

  const value: AuthContextType = {
    user,
    session,
    role: getUserRole(user),
    isLoading,
    isAuthenticated: !!user && !!session,
    signOut,
    refreshAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to access auth context
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

/**
 * Hook to require authentication
 * Redirects to login if not authenticated
 */
export function useRequireAuth() {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!auth.isLoading && !auth.isAuthenticated) {
      router.push("/login");
    }
  }, [auth.isLoading, auth.isAuthenticated, router]);

  return auth;
}

/**
 * Hook to check if user has required roles
 */
export function useHasRole(requiredRoles: UserRole[]) {
  const { role, isLoading } = useAuth();
  return {
    hasRole: requiredRoles.includes(role),
    isLoading,
  };
}
