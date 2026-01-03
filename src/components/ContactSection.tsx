import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, MessageCircle } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export function ContactSection() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    
    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 800));
    
    toast({
      title: "You're on the list!",
      description: "We'll reach out within 24 hours.",
    });
    
    setEmail("");
    setIsSubmitting(false);
  };

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

          {/* Simple email capture */}
          <form onSubmit={handleSubmit} className="flex gap-2 max-w-md mx-auto">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              className="flex-1"
            />
            <Button type="submit" variant="hero" disabled={isSubmitting}>
              {isSubmitting ? "..." : <ArrowRight className="w-4 h-4" />}
            </Button>
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
