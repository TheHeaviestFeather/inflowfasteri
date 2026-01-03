import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Play } from "lucide-react";

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden mesh-gradient">
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-accent/10 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-float-delayed" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/80 border border-border mb-8 animate-fade-in">
            <Sparkles className="w-4 h-4 text-accent" />
            <span className="text-sm font-medium text-foreground">
              AI-Powered Instructional Design
            </span>
          </div>

          {/* Main headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight mb-6 animate-slide-up">
            Design Learning That{" "}
            <span className="gradient-text">Actually Works</span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-slide-up" style={{ animationDelay: "0.1s" }}>
            Replace scattered docs and ad-hoc prompting with a structured AI pipeline. 
            From discovery to deployment—one intelligent workflow for evidence-based learning solutions.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up" style={{ animationDelay: "0.2s" }}>
            <Button variant="hero" size="xl" className="w-full sm:w-auto">
              Start Your First Project
              <ArrowRight className="w-5 h-5" />
            </Button>
            <Button variant="outline" size="xl" className="w-full sm:w-auto">
              <Play className="w-5 h-5" />
              Watch Demo
            </Button>
          </div>

          {/* Social proof */}
          <div className="mt-12 pt-8 border-t border-border/50 animate-fade-in" style={{ animationDelay: "0.3s" }}>
            <p className="text-sm text-muted-foreground mb-4">
              Trusted by instructional designers worldwide
            </p>
            <div className="flex items-center justify-center gap-8 opacity-60">
              <div className="text-2xl font-bold text-foreground">500+</div>
              <div className="h-8 w-px bg-border" />
              <div className="text-sm text-muted-foreground">Projects Created</div>
              <div className="h-8 w-px bg-border hidden sm:block" />
              <div className="text-2xl font-bold text-foreground hidden sm:block">4.9★</div>
              <div className="text-sm text-muted-foreground hidden sm:block">User Rating</div>
            </div>
          </div>
        </div>

        {/* Hero Visual - Chat Preview */}
        <div className="mt-16 max-w-5xl mx-auto animate-slide-up" style={{ animationDelay: "0.4s" }}>
          <div className="relative">
            {/* Glow effect */}
            <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 rounded-3xl blur-2xl opacity-50" />
            
            {/* Chat preview card */}
            <div className="relative bg-card rounded-2xl shadow-2xl border border-border overflow-hidden">
              {/* Window header */}
              <div className="flex items-center gap-2 px-4 py-3 bg-secondary/50 border-b border-border">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                </div>
                <div className="flex-1 text-center">
                  <span className="text-sm font-medium text-muted-foreground">InFlow Workspace</span>
                </div>
              </div>

              {/* Chat content */}
              <div className="p-6 space-y-4">
                {/* User message */}
                <div className="flex justify-end">
                  <div className="chat-bubble-user px-4 py-3 max-w-md">
                    <p className="text-sm">
                      I need to create onboarding training for new customer service reps. 
                      They struggle with handling escalated calls.
                    </p>
                  </div>
                </div>

                {/* Assistant message */}
                <div className="flex justify-start">
                  <div className="chat-bubble-assistant px-4 py-3 max-w-lg">
                    <p className="text-sm mb-3">
                      Great starting point! Let me help you scope this properly. Based on your description, 
                      I'm detecting a <strong>Standard Mode</strong> project involving interpersonal skills.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <span className="px-2 py-1 text-xs rounded-full bg-accent/20 text-accent font-medium">
                        Phase 1: Discovery
                      </span>
                      <span className="px-2 py-1 text-xs rounded-full bg-muted text-muted-foreground">
                        8 Phases Total
                      </span>
                    </div>
                  </div>
                </div>

                {/* Typing indicator */}
                <div className="flex justify-start">
                  <div className="flex gap-1 px-4 py-3">
                    <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-pulse" />
                    <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-pulse" style={{ animationDelay: "0.2s" }} />
                    <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-pulse" style={{ animationDelay: "0.4s" }} />
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
