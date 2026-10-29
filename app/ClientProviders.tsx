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
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:border focus:bg-background focus:px-4 focus:py-2 focus:text-foreground"
          >
            Skip to content
          </a>
          <Navigation />
          {/* Bottom padding clears the fixed mobile nav bar */}
          <div
            id="main-content"
            className="flex-1 pb-[calc(4rem+env(safe-area-inset-bottom))] xl:pb-0"
          >
            {children}
          </div>
          <Toaster position="top-center" />
        </ErrorBoundary>
      </ThemeProvider>
    </ConvexClientProvider>
  );
}
