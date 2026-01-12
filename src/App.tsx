import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Workspace from "./pages/Workspace";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import TermsOfService from "./pages/TermsOfService";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import FormatterTest from "./pages/FormatterTest";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

/**
 * Route-level ErrorBoundary wrapper
 * Provides crash resilience - one broken page doesn't crash the entire app
 */
const RouteErrorBoundary = ({ children, name }: { children: React.ReactNode; name: string }) => (
  <ErrorBoundary
    fallbackTitle={`${name} Error`}
    fallbackDescription={`The ${name.toLowerCase()} page encountered an error. Click below to try again.`}
  >
    {children}
  </ErrorBoundary>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="system">
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<RouteErrorBoundary name="Home"><Index /></RouteErrorBoundary>} />
            <Route path="/auth" element={<RouteErrorBoundary name="Authentication"><Auth /></RouteErrorBoundary>} />
            <Route path="/dashboard" element={<RouteErrorBoundary name="Dashboard"><Dashboard /></RouteErrorBoundary>} />
            <Route path="/workspace" element={<RouteErrorBoundary name="Workspace"><Workspace /></RouteErrorBoundary>} />
            <Route path="/profile" element={<RouteErrorBoundary name="Profile"><Profile /></RouteErrorBoundary>} />
            <Route path="/settings" element={<RouteErrorBoundary name="Settings"><Settings /></RouteErrorBoundary>} />
            <Route path="/terms" element={<RouteErrorBoundary name="Terms of Service"><TermsOfService /></RouteErrorBoundary>} />
            <Route path="/privacy" element={<RouteErrorBoundary name="Privacy Policy"><PrivacyPolicy /></RouteErrorBoundary>} />
            <Route path="/dev/formatter-test" element={<RouteErrorBoundary name="Formatter Test"><FormatterTest /></RouteErrorBoundary>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
