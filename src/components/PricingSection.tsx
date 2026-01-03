import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Get started with the essentials",
    features: [
      "3 active projects",
      "Markdown export",
      "Full AI workflow",
      "8-phase pipeline",
      "Community support",
    ],
    cta: "Start Free",
    variant: "outline" as const,
    highlighted: false,
  },
  {
    name: "Starter",
    price: "$10",
    period: "/month",
    description: "For freelancers and solo designers",
    features: [
      "10 active projects",
      "DOCX & PDF export",
      "Artifact version history",
      "Priority AI access",
      "Email support",
      "Client-ready formatting",
    ],
    cta: "Upgrade to Starter",
    variant: "hero" as const,
    highlighted: true,
  },
];

export function PricingSection() {
  return (
    <section id="pricing" className="py-24 bg-secondary/30">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Simple, <span className="gradient-text-accent">Transparent Pricing</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Start free, upgrade when you need more.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl p-8 ${
                plan.highlighted
                  ? "bg-card border-2 border-accent shadow-glow"
                  : "bg-card border border-border"
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="px-4 py-1 rounded-full gradient-accent text-accent-foreground text-sm font-medium">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>
                <p className="text-muted-foreground mt-2">{plan.description}</p>
              </div>

              <ul className="space-y-4 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-success/20 flex items-center justify-center">
                      <Check className="w-3 h-3 text-success" />
                    </div>
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button variant={plan.variant} className="w-full" size="lg">
                {plan.cta}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
