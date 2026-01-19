/**
 * Authentication utilities using Supabase Auth
 */

import { createBrowserClient } from "@supabase/ssr";
import type { User, Session, AuthError } from "@supabase/supabase-js";

// Create browser client for auth operations
export function createAuthClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Singleton client instance
let authClient: ReturnType<typeof createAuthClient> | null = null;

export function getAuthClient() {
  if (!authClient) {
    authClient = createAuthClient();
  }
  return authClient;
}

/**
 * Sign in with email and password
 */
export async function signInWithEmail(
  email: string,
  password: string
): Promise<{ user: User | null; session: Session | null; error: AuthError | null }> {
  const supabase = getAuthClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  return {
    user: data.user,
    session: data.session,
    error,
  };
}

/**
 * Sign up with email and password
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  metadata?: { full_name?: string }
): Promise<{ user: User | null; session: Session | null; error: AuthError | null }> {
  const supabase = getAuthClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata,
    },
  });

  return {
    user: data.user,
    session: data.session,
    error,
  };
}

/**
 * Sign in with OAuth provider
 */
export async function signInWithOAuth(
  provider: "google" | "github"
): Promise<{ error: AuthError | null }> {
  const supabase = getAuthClient();
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });

  return { error };
}

/**
 * Sign out the current user
 */
export async function signOut(): Promise<{ error: AuthError | null }> {
  const supabase = getAuthClient();
  const { error } = await supabase.auth.signOut();
  return { error };
}

/**
 * Get current session
 */
export async function getSession(): Promise<{
  session: Session | null;
  error: AuthError | null;
}> {
  const supabase = getAuthClient();
  const { data, error } = await supabase.auth.getSession();
  return {
    session: data.session,
    error,
  };
}

/**
 * Get current user
 */
export async function getUser(): Promise<{
  user: User | null;
  error: AuthError | null;
}> {
  const supabase = getAuthClient();
  const { data, error } = await supabase.auth.getUser();
  return {
    user: data.user,
    error,
  };
}

/**
 * Refresh the session
 */
export async function refreshSession(): Promise<{
  session: Session | null;
  error: AuthError | null;
}> {
  const supabase = getAuthClient();
  const { data, error } = await supabase.auth.refreshSession();
  return {
    session: data.session,
    error,
  };
}

/**
 * Send password reset email
 */
export async function resetPassword(
  email: string
): Promise<{ error: AuthError | null }> {
  const supabase = getAuthClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset-password`,
  });
  return { error };
}

/**
 * Update password
 */
export async function updatePassword(
  newPassword: string
): Promise<{ user: User | null; error: AuthError | null }> {
  const supabase = getAuthClient();
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
  });
  return {
    user: data.user,
    error,
  };
}

/**
 * Subscribe to auth state changes
 */
export function onAuthStateChange(
  callback: (event: string, session: Session | null) => void
) {
  const supabase = getAuthClient();
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
  return data.subscription;
}

/**
 * Get access token for API calls
 */
export async function getAccessToken(): Promise<string | null> {
  const { session } = await getSession();
  return session?.access_token ?? null;
}

// User role type
export type UserRole = "admin" | "recruiter" | "hiring_manager" | "interviewer" | "viewer";

/**
 * Get user role from metadata
 */
export function getUserRole(user: User | null): UserRole {
  if (!user) return "viewer";
  return (user.app_metadata?.role as UserRole) || "recruiter";
}

/**
 * Check if user has required role
 */
export function hasRole(user: User | null, requiredRoles: UserRole[]): boolean {
  const userRole = getUserRole(user);
  return requiredRoles.includes(userRole);
}
