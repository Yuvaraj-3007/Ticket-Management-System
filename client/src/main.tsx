import * as Sentry from "@sentry/react";
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import { ThemeProvider } from "@/contexts/ThemeContext";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  enabled: !!import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  beforeSend(event) {
    if (event.request?.data && typeof event.request.data === "object") {
      const data = event.request.data as Record<string, unknown>;
      for (const key of ["password", "token", "secret"]) {
        delete data[key];
      }
    }
    return event;
  },
});

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <Sentry.ErrorBoundary
        fallback={
          <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="text-center p-8">
              <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
              <p className="text-muted-foreground text-sm">The error has been reported. Please refresh the page.</p>
            </div>
          </div>
        }
      >
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </Sentry.ErrorBoundary>
    </ThemeProvider>
  </StrictMode>,
)
