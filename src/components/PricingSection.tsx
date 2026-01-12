import { Button } from "@/components/ui/button";
import { Check, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export function PricingSection() {
  return (
    <section id="pricing" className="py-20 bg-secondary/30">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto text-center">
          {/* Simple header */}
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">
            Start free, upgrade when you're ready
          </h2>
          <p className="text-muted-foreground mb-10">
            50 free credits to get started. Need more? $10/month for 500 credits.
          </p>

          {/* Compact comparison */}
          <div className="bg-card rounded-2xl border border-border p-8 text-left">
            <div className="grid sm:grid-cols-2 gap-8">
              {/* Free */}
              <div>
                <div className="mb-4">
                  <span className="text-xl font-bold">Free</span>
                  <span className="text-muted-foreground ml-2">to start</span>
                </div>
                <ul className="space-y-2.5 text-sm">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-success" />
                    50 credits included
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-success" />
                    Unlimited projects
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-success" />
                    Full AI workflow
                  </li>
                </ul>
              </div>

              {/* Starter */}
              <div className="sm:border-l sm:border-border sm:pl-8">
                <div className="mb-4">
                  <span className="text-xl font-bold">$10</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
                <ul className="space-y-2.5 text-sm">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-success" />
                    500 credits/month
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-success" />
                    DOCX & PDF exports
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-success" />
                    Version history
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-border">
              <Button variant="hero" size="lg" className="w-full" asChild>
                <Link to="/auth">
                  Start your first project
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
