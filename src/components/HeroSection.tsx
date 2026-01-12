import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export function HeroSection() {
  const { user, loading } = useAuth();

  return (
    <section className="relative min-h-[90vh] flex items-center pt-16 overflow-hidden">
      {/* Subtle background */}
      <div className="absolute inset-0 bg-gradient-to-b from-secondary/50 to-background pointer-events-none" />
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left - Copy */}
          <div className="max-w-xl">
            {/* Problem → Solution in one line */}
            <p className="text-muted-foreground mb-4 animate-fade-in">
              Stop juggling ChatGPT tabs and scattered docs.
            </p>
            
            {/* Headline - Benefit focused */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6 animate-slide-up">
              Ship training projects{" "}
              <span className="gradient-text">3x faster</span>
            </h1>

            {/* One sentence value prop */}
            <p className="text-lg text-muted-foreground mb-8 animate-slide-up" style={{ animationDelay: "0.1s" }}>
              An AI workflow that guides you from discovery to deliverables—with 
              artifacts your clients actually want.
            </p>

            {/* CTA - Different for logged in vs logged out */}
            <div className="animate-slide-up" style={{ animationDelay: "0.2s" }}>
              {!loading && user ? (
                <Button variant="hero" size="xl" className="w-full sm:w-auto" asChild>
                  <Link to="/dashboard">
                    Go to Dashboard
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                </Button>
              ) : (
                <>
                  <Button variant="hero" size="xl" className="w-full sm:w-auto" asChild>
                    <Link to="/auth">
                      Start your first project free
                      <ArrowRight className="w-5 h-5" />
                    </Link>
                  </Button>
                  <p className="text-sm text-muted-foreground mt-3">
                    No credit card · 50 free credits
                  </p>
                </>
              )}
            </div>

            {/* Social proof - authentic messaging */}
            <div className="mt-10 pt-6 border-t border-border/50 animate-fade-in" style={{ animationDelay: "0.3s" }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Built by L&D professionals, for L&D professionals
                </p>
              </div>
            </div>
          </div>

          {/* Right - Interactive Preview */}
          <div className="animate-slide-up lg:animate-none" style={{ animationDelay: "0.2s" }}>
            <div className="relative">
              {/* Glow */}
              <div className="absolute -inset-4 bg-gradient-to-r from-accent/20 to-primary/20 rounded-3xl blur-2xl opacity-60" />
              
              {/* Chat preview */}
              <div className="relative bg-card rounded-2xl shadow-2xl border border-border overflow-hidden">
                {/* Window chrome */}
                <div className="flex items-center gap-2 px-4 py-3 bg-secondary/50 border-b border-border">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-destructive/60" />
                    <div className="w-2.5 h-2.5 rounded-full bg-warning/60" />
                    <div className="w-2.5 h-2.5 rounded-full bg-success/60" />
                  </div>
                  <span className="flex-1 text-center text-xs text-muted-foreground">New Project</span>
                </div>

                {/* Chat */}
                <div className="p-5 space-y-4">
                  {/* User input */}
                  <div className="flex justify-end">
                    <div className="bg-primary text-primary-foreground px-4 py-2.5 rounded-2xl rounded-br-md max-w-[85%]">
                      <p className="text-sm">
                        New hire onboarding for customer service. They struggle with escalation calls.
                      </p>
                    </div>
                  </div>

                  {/* AI Response */}
                  <div className="flex justify-start">
                    <div className="bg-secondary px-4 py-3 rounded-2xl rounded-bl-md max-w-[90%]">
                      <p className="text-sm mb-3">
                        Great project! I've drafted your <strong>Phase 1 Contract</strong> with 
                        clear scope and success metrics.
                      </p>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-success" />
                          <span className="text-xs">Phase 1 Contract ready</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <div className="w-4 h-4 rounded-full border-2 border-current" />
                          <span className="text-xs">Discovery Report next...</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Suggested actions */}
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs bg-accent/20 text-accent-foreground px-3 py-1.5 rounded-full">
                      Review contract
                    </span>
                    <span className="text-xs bg-accent/20 text-accent-foreground px-3 py-1.5 rounded-full">
                      APPROVE
                    </span>
                  </div>
                </div>

                {/* Input bar */}
                <div className="px-4 py-3 border-t border-border bg-background/50">
                  <div className="flex items-center gap-2 bg-secondary rounded-lg px-3 py-2">
                    <span className="text-sm text-muted-foreground flex-1">Ask about next steps...</span>
                    <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
                      <ArrowRight className="w-3.5 h-3.5 text-primary-foreground" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
