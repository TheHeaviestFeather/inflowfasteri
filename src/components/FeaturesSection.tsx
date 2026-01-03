import { 
  MessageSquare, 
  Layers, 
  FileCheck, 
  Download, 
  GitBranch, 
  Shield 
} from "lucide-react";

const features = [
  {
    icon: MessageSquare,
    title: "Conversational AI Workflow",
    description:
      "Chat naturally with your ID consultant. Get guidance through discovery, design, and validation phases with evidence-based recommendations.",
  },
  {
    icon: Layers,
    title: "Structured Artifact Pipeline",
    description:
      "From contracts to final audits—8 gated phases ensure quality. Upstream revisions automatically flag downstream dependencies.",
  },
  {
    icon: FileCheck,
    title: "Approval Gates",
    description:
      "Nothing moves forward without your sign-off. Approve, revise, or request changes at every phase with full version control.",
  },
  {
    icon: Download,
    title: "Export-Ready Deliverables",
    description:
      "Generate client-ready documents in Markdown, DOCX, or PDF. Complete with cover pages, TOC, and professional formatting.",
  },
  {
    icon: GitBranch,
    title: "Quick & Standard Modes",
    description:
      "Right-size your process. Quick Mode for job aids and checklists. Standard Mode for complex training programs.",
  },
  {
    icon: Shield,
    title: "Evidence Integrity",
    description:
      "No fabricated data. Every recommendation is grounded in your discovery evidence with clear audit trails.",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-24 bg-secondary/30">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Everything You Need to{" "}
            <span className="gradient-text">Design Better Learning</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            A complete toolkit for instructional designers who want rigor without the chaos.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className="group relative p-6 bg-card rounded-xl border border-border hover:border-accent/50 transition-all duration-300 hover:shadow-lg"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-lg gradient-primary flex items-center justify-center group-hover:shadow-glow transition-shadow">
                  <feature.icon className="w-6 h-6 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2 group-hover:text-accent transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
