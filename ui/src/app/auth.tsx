import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Permission } from "@erp-software/shared";
import { api, session, setBusinessBlockedHandler, setSessionExpiredHandler } from "@/lib/api-client";
import type { Me } from "@/lib/types";
import { meKey } from "./auth-keys";

interface AuthState {
  me: Me | undefined;
  status: "loading" | "signed-in" | "signed-out";
  error: unknown;
  branch: Me["branches"][number] | undefined;
  setBranch: (id: string) => void;
  // Mobile number or email.
  login: (identifier: string, password: string) => Promise<void>;
  // Why the user was signed out (shop suspended…), shown on the login page.
  notice: string | null;
  logout: () => Promise<void>;
  can: (...permissions: Permission[]) => boolean;
  refetch: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [hasToken, setHasToken] = useState(() => Boolean(session.token));
  const [branchId, setBranchId] = useState(() => session.branchId);
  // Why the session ended (shop suspended…), shown on the login page.
  const [notice, setNotice] = useState<string | null>(null);

  const signOutLocally = useCallback(() => {
    session.clear();
    setBranchId(null);
    setHasToken(false);
    queryClient.clear();
  }, [queryClient]);

  const meQuery = useQuery({
    queryKey: meKey,
    queryFn: async ({ signal }) => {
      const me = await api.get<Me>("/users/me", undefined, signal);
      // Keep the stored branch valid before any page queries run (they send it as x-branch-id).
      if (!me.branches.some((b) => b.id === session.branchId)) session.branchId = me.branches[0]?.id ?? null;
      return me;
    },
    enabled: hasToken,
    staleTime: 5 * 60_000,
    retry: (count, err) =>
      (err as { status?: number }).status !== 401 && (err as { status?: number }).status !== 403 && count < 2,
  });

  useEffect(() => setSessionExpiredHandler(signOutLocally), [signOutLocally]);

  // The shop was suspended (or not approved) while someone was signed in: end the session and say why.
  // Deferred so the cache isn't cleared while the failing query is still settling.
  useEffect(
    () =>
      setBusinessBlockedHandler((message) =>
        setTimeout(() => {
          setNotice(message);
          signOutLocally();
        }),
      ),
    [signOutLocally],
  );

  // The selected branch, falling back to the one the /me fetch stored, then the first available.
  const me = meQuery.data;
  const branch =
    me?.branches.find((b) => b.id === branchId) ??
    me?.branches.find((b) => b.id === session.branchId) ??
    me?.branches[0];

  const setBranch = useCallback(
    (id: string) => {
      session.branchId = id;
      setBranchId(id);
      // Every branch-scoped query refetches for the new branch.
      queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] !== meKey[0] });
    },
    [queryClient],
  );

  const login = useCallback(
    async (identifier: string, password: string) => {
      const res = await api.post<{ token: string; refreshToken: string }>(
        "/auth/login",
        { identifier, password },
        { auth: false },
      );
      setNotice(null);
      // Nothing cached for a previous user (maybe of another shop) may show for this one.
      // resetQueries (not clear) keeps the mounted /users/me observer, so it refetches with the new token.
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== meKey[0] });
      session.set(res);
      setHasToken(true);
      await queryClient.resetQueries({ queryKey: meKey });
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    const refreshToken = session.refreshToken;
    if (refreshToken) await api.post("/auth/logout", { refreshToken }, { auth: false }).catch(() => {});
    signOutLocally();
  }, [signOutLocally]);

  const granted = useMemo(() => new Set(me?.permissions ?? []), [me]);
  const can = useCallback(
    (...permissions: Permission[]) => Boolean(me && (me.isOwner || permissions.some((p) => granted.has(p)))),
    [me, granted],
  );

  // Only a 401/403 on /users/me means signed out; any other failure (network, 5xx) keeps the
  // session and RequireAuth shows the error with a retry-later / sign-out choice.
  const meStatus = (meQuery.error as { status?: number } | null)?.status;
  const status: AuthState["status"] = !hasToken
    ? "signed-out"
    : me
      ? "signed-in"
      : meStatus === 401 || meStatus === 403
        ? "signed-out"
        : "loading";

  const value = useMemo<AuthState>(
    () => ({
      me,
      status,
      error: meQuery.error,
      branch,
      setBranch,
      login,
      notice,
      logout,
      can,
      refetch: () => void meQuery.refetch(),
    }),
    [me, status, meQuery, branch, setBranch, login, notice, logout, can],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
