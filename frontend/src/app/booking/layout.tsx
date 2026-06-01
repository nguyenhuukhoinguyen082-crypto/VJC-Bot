import { AuthGuard } from "@/components/auth/auth-guard";
import { Suspense } from "react";

export default function BookingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[40vh] text-muted-foreground">
          Loading...
        </div>
      }
    >
      <AuthGuard>{children}</AuthGuard>
    </Suspense>
  );
}
