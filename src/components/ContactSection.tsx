import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, MessageCircle, CheckCircle, AlertCircle } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useFieldValidation, emailSchema } from "@/hooks/useFormValidation";
import { cn } from "@/lib/utils";

export function ContactSection() {
  const { toast } = useToast();
  const emailField = useFieldValidation(emailSchema);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!emailField.isValid) {
      return;
    }
    
    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 800));
    
    toast({
      title: "You're on the list!",
      description: "We'll reach out within 24 hours.",
    });
    
    emailField.reset();
    setIsSubmitting(false);
  };

  const showError = emailField.touched && emailField.error;
  const showSuccess = emailField.touched && emailField.isValid;

  return (
    <section id="contact" className="py-16 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-xl mx-auto text-center">
          {/* Simple feedback CTA */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 text-accent mb-6">
            <MessageCircle className="w-4 h-4" />
            <span className="text-sm font-medium">Questions or feedback?</span>
          </div>
          
          <h2 className="text-2xl font-bold mb-3">
            Let's talk
          </h2>
          <p className="text-muted-foreground mb-6">
            Drop your email and we'll reach out within a day.
          </p>

          {/* Simple email capture with validation */}
          <form onSubmit={handleSubmit} className="max-w-md mx-auto">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type="email"
                  value={emailField.value}
                  onChange={(e) => emailField.setValue(e.target.value)}
                  onBlur={emailField.onBlur}
                  placeholder="you@company.com"
                  required
                  className={cn(
                    "pr-10",
                    showError && "border-destructive focus-visible:ring-destructive/50",
                    showSuccess && "border-green-500 focus-visible:ring-green-500/50"
                  )}
                  aria-invalid={showError ? "true" : "false"}
                  aria-describedby={showError ? "email-error" : undefined}
                />
                {emailField.touched && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {showError && <AlertCircle className="h-4 w-4 text-destructive" />}
                    {showSuccess && <CheckCircle className="h-4 w-4 text-green-500" />}
                  </div>
                )}
              </div>
              <Button 
                type="submit" 
                variant="hero" 
                disabled={isSubmitting || !emailField.isValid}
              >
                {isSubmitting ? "..." : <ArrowRight className="w-4 h-4" />}
              </Button>
            </div>
            {showError && (
              <p id="email-error" className="text-xs text-destructive mt-2 text-left flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {emailField.error}
              </p>
            )}
          </form>

          <p className="text-xs text-muted-foreground mt-4">
            Or email us directly at{" "}
            <a href="mailto:hello@inflow.design" className="text-accent hover:underline">
              hello@inflow.design
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
