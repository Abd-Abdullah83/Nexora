"use client";

import useSWR from "swr";

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: "customer" | "admin" | "seller_individual" | "seller_business";
  // Present only for seller roles.
  sellerId?: string;
}

async function fetchSession(url: string) {
  const res = await fetch(url);
  if (res.status === 401) return { user: null }; // Not logged in — not an error
  if (!res.ok) throw new Error("Session fetch failed");
  return res.json();
}

export function useSession() {
  const { data, error, isLoading, mutate } = useSWR<{
    user: SessionUser | null;
  }>("/api/auth/me", fetchSession, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });

  return {
    user: data?.user ?? null,
    isLoggedIn: !!data?.user,
    isLoading,
    error,
    refresh: mutate,
  };
}
