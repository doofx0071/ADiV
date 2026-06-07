"use client";

import ConvexClientProvider from "./ConvexClientProvider";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { Navigation } from "@/components/layout/navigation";
import { ErrorBoundary } from "@/components/layout/error-boundary";
import { Toaster } from "sonner";
import type { ReactNode } from "react";

export function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <ConvexClientProvider>
      <ThemeProvider>
        <ErrorBoundary>
          <Navigation />
          <div className="flex-1">{children}</div>
          <Toaster />
        </ErrorBoundary>
      </ThemeProvider>
    </ConvexClientProvider>
  );
}
