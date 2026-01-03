import { FileText, GitBranch, Download } from "lucide-react";

const benefits = [
  {
    icon: FileText,
    title: "8 artifacts, 1 conversation",
    description: "Contract → Discovery → Persona → Strategy → Blueprint → Scenarios → Assessment → Audit",
  },
  {
    icon: GitBranch,
    title: "Approvals & version history",
    description: "Nothing ships without your sign-off. Full revision tracking included.",
  },
  {
    icon: Download,
    title: "Client-ready exports",
    description: "Markdown free, DOCX/PDF on Starter. Professional formatting built in.",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-20 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Section header */}
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">
              How it works
            </h2>
            <p className="text-muted-foreground">
              One structured conversation. Eight deliverables.
            </p>
          </div>

          {/* Benefits - horizontal on desktop */}
          <div className="grid md:grid-cols-3 gap-6">
            {benefits.map((benefit, index) => (
              <div
                key={benefit.title}
                className="text-center p-6 rounded-xl bg-secondary/30 border border-border/50"
              >
                <div className="w-12 h-12 mx-auto mb-4 rounded-xl gradient-primary flex items-center justify-center">
                  <benefit.icon className="w-6 h-6 text-primary-foreground" />
                </div>
                <h3 className="font-semibold mb-2">{benefit.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {benefit.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
