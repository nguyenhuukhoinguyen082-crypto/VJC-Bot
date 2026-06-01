"use client";

import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center">
      <AlertTriangle className="h-16 w-16 text-destructive mb-6 animate-pulse" />
      <h1 className="text-2xl font-bold mb-2">Turbulence Encountered</h1>
      <p className="text-muted-foreground mb-8 max-w-md">
        Something went wrong on our end. Our crew is working on it. Please try again.
      </p>
      <Button
        onClick={reset}
        className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white"
      >
        Try Again
      </Button>
    </div>
  );
}
