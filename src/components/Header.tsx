import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, loading } = useAuth();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          <Logo />

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-6" aria-label="Main navigation">
            <a
              href="#features"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md px-2 py-1"
            >
              How it works
            </a>
            <a
              href="#pricing"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md px-2 py-1"
            >
              Pricing
            </a>
            <a
              href="#contact"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md px-2 py-1"
            >
              Contact
            </a>
          </nav>

          {/* CTA - changes based on auth state */}
          <div className="hidden md:block">
            {!loading && user ? (
              <Button variant="hero" size="sm" asChild>
                <Link to="/dashboard">Go to Dashboard</Link>
              </Button>
            ) : (
              <Button variant="hero" size="sm" asChild>
                <Link to="/auth">Sign in</Link>
              </Button>
            )}
          </div>

          {/* Mobile menu toggle */}
          <button
            className="md:hidden p-2 -mr-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>

        {mobileMenuOpen && (
          <nav 
            id="mobile-menu"
            className="md:hidden py-4 border-t border-border/50"
            aria-label="Mobile navigation"
          >
            <div className="flex flex-col gap-3">
              <a href="#features" className="text-sm py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md px-2">
                How it works
              </a>
              <a href="#pricing" className="text-sm py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md px-2">
                Pricing
              </a>
              <a href="#contact" className="text-sm py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md px-2">
                Contact
              </a>
              {!loading && user ? (
                <Button variant="hero" className="mt-2" asChild>
                  <Link to="/dashboard">Go to Dashboard</Link>
                </Button>
              ) : (
                <Button variant="hero" className="mt-2" asChild>
                  <Link to="/auth">Sign in</Link>
                </Button>
              )}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
