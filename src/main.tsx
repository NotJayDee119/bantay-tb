import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { AuthProvider } from "./hooks/useAuth";
import App from "./App";
import "./index.css";

// Shared query cache — data is considered fresh for 30s so switching between
// tabs/pages renders instantly from cache, then refetches in the background.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ScrollToTop />
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <App />
          <Toaster richColors position="top-right" />
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>
);
