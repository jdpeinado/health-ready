import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiJson, ApiError } from "../api/client";
import type { PublicUser } from "../api/types";
import type { LoginInput } from "@health-ready/shared";

export function useMe() {
  return useQuery<PublicUser | null>({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        return await api<PublicUser>("/auth/me");
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    staleTime: 60_000,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) =>
      apiJson<PublicUser>("/auth/login", "POST", input),
    onSuccess: (user) => qc.setQueryData(["me"], user),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiJson("/auth/logout", "POST", {}),
    onSuccess: () => qc.setQueryData(["me"], null),
  });
}
