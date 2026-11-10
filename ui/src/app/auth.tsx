import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Permission } from "@automobile/shared";
import { api, session, setSessionExpiredHandler } from "@/lib/api-client";
import type { Me } from "@/lib/types";

interface AuthState {
  me: Me | undefined;
  status: "loading" | "signed-in" | "signed-out";
  error: unknown;
  branch: Me["branches"][number] | undefined;
  setBranch: (id: string) => void;
  login: (email: string, password: string) => Promise<void>;
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

export const meKey = ["me"] as const;

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [hasToken, setHasToken] = useState(() => Boolean(session.token));
  const [branchId, setBranchId] = useState(() => session.branchId);

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
    retry: (count, err) => (err as { status?: number }).status !== 401 && count < 2,
  });

  const signOutLocally = useCallback(() => {
    session.set(null);
    setHasToken(false);
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => setSessionExpiredHandler(signOutLocally), [signOutLocally]);

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
    async (email: string, password: string) => {
      const res = await api.post<{ token: string; refreshToken: string }>(
        "/auth/login",
        { email, password },
        { auth: false },
      );
      session.set(res);
      setHasToken(true);
      await queryClient.invalidateQueries({ queryKey: meKey });
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    const refreshToken = session.refreshToken;
    if (refreshToken) await api.post("/auth/logout", { refreshToken }, { auth: false }).catch(() => {});
    signOutLocally();
  }, [signOutLocally]);

  const can = useCallback(
    (...permissions: Permission[]) =>
      Boolean(me && (me.isOwner || permissions.some((p) => me.permissions.includes(p)))),
    [me],
  );

  const status: AuthState["status"] = !hasToken
    ? "signed-out"
    : me
      ? "signed-in"
      : meQuery.isError
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
      logout,
      can,
      refetch: () => void meQuery.refetch(),
    }),
    [me, status, meQuery, branch, setBranch, login, logout, can],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
