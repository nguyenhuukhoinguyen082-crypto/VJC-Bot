"use client";

import { useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/lib/store";

const PANEL_GROUPS = new Set(["dev", "director", "staff"]);

export function AuthGuard({
  children,
  requirePanel = false,
}: {
  children: React.ReactNode;
  requirePanel?: boolean;
}) {
  const { user, isLoading } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      const query = searchParams.toString();
      const returnTo = query ? `${pathname}?${query}` : pathname;
      router.replace(`/login?redirect=${encodeURIComponent(returnTo)}`);
      return;
    }
    if (requirePanel && !PANEL_GROUPS.has(user.group)) {
      router.replace("/dashboard");
    }
  }, [user, isLoading, requirePanel, router, pathname, searchParams]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (!user) return null;
  if (requirePanel && !PANEL_GROUPS.has(user.group)) return null;

  return <>{children}</>;
}
