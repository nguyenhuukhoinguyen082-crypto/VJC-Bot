"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect, type ReactNode } from "react";
import { api } from "./api";
import { useAuthStore } from "./store";

function AuthProvider({ children }: { children: ReactNode }) {
  const { setUser, setLoading } = useAuthStore();

  useEffect(() => {
    const loadUser = async () => {
      const userData = await api.fetchMe();
      if (userData && typeof sessionStorage !== "undefined") {
        sessionStorage.setItem("user_group", userData.group);
      }
      setUser(userData);
      setLoading(false);
    };
    loadUser();
  }, [setUser, setLoading]);

  return <>{children}</>;
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}
