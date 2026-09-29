import * as SecureStore from "expo-secure-store";
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type Membership = { organizationId: string; organizationName: string; role: string };
export type Actor = { id: string; name: string; email: string; memberships: Membership[] };
export type Milestone = { id: string; title: string; criteria: string; amount: number; dueAt: string; verdict: string; trustScore: number; releasedAt: string | null; _count?: { assets: number } };
export type Project = { id: string; name: string; description: string; location: string; budget: number; funded: number; organizationId: string; milestones: Milestone[]; _count: { assets: number } };
export type Asset = { id: string; thumbnailUrl: string; caption: string | null; status: string; trustScore: number; sha256: string; createdAt: string; milestone: { id: string; title: string } | null };

const TOKEN_KEY = "proofpay.session.v1";
const API_BASE = (process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
type SessionApi = { actor: Actor | null; loading: boolean; error: string; login: (email: string, password: string) => Promise<void>; logout: () => Promise<void>; api: <T = any>(path: string, options?: RequestInit) => Promise<T>; refreshActor: () => Promise<void>; getToken: () => Promise<string | null> };
const SessionContext = createContext<SessionApi | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [actor, setActor] = useState<Actor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const getToken = useCallback(() => SecureStore.getItemAsync(TOKEN_KEY), []);
  const api = useCallback(async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    const form = typeof FormData !== "undefined" && options.body instanceof FormData;
    const response = await fetch(`${API_BASE}${path}`, { ...options, headers: { ...(form ? {} : { "content-type": "application/json" }), ...(token ? { authorization: `Bearer ${token}` } : {}), ...options.headers } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error ?? `Request failed (${response.status})`);
    return data as T;
  }, []);
  const refreshActor = useCallback(async () => {
    const result = await api<{ user: Actor | null }>("/api/auth/session");
    setActor(result.user);
  }, [api]);
  useEffect(() => {
    let active = true;
    SecureStore.getItemAsync(TOKEN_KEY)
      .then(token => token ? fetch(`${API_BASE}/api/auth/session`, { headers: { authorization: `Bearer ${token}` } }) : null)
      .then(response => response?.json())
      .then(data => { if (active) setActor(data?.user ?? null); })
      .catch(() => { if (active) setActor(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const login = useCallback(async (email: string, password: string) => {
    setError("");
    const response = await fetch(`${API_BASE}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json", "x-proofpay-client": "native" }, body: JSON.stringify({ email, password }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error ?? `Sign in failed (${response.status})`);
    const token = response.headers.get("x-proofpay-session-token");
    if (!token) throw new Error("The server did not return a mobile session. Update and restart the ProofPay web server.");
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    const session = await api<{ user: Actor | null }>("/api/auth/session");
    if (!session.user) throw new Error("Session could not be loaded. Please sign in again.");
    setActor(session.user);
  }, [api]);
  const logout = useCallback(async () => { try { await api("/api/auth/logout", { method: "POST" }); } finally { await SecureStore.deleteItemAsync(TOKEN_KEY); setActor(null); } }, [api]);
  const value = useMemo(() => ({ actor, loading, error, login, logout, api, refreshActor, getToken }), [actor, loading, error, login, logout, api, refreshActor, getToken]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be inside SessionProvider");
  return value;
}

export const apiBase = API_BASE;
