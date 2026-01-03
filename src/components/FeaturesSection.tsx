import { GitBranch, Download, Layers } from "lucide-react";

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

          {/* Benefits grid */}
          <div className="grid md:grid-cols-3 gap-6">
            {/* First card - simple */}
            <div className="text-center p-6 rounded-xl bg-secondary/30 border border-border/50">
              <div className="w-10 h-10 mx-auto mb-3 rounded-lg gradient-primary flex items-center justify-center">
                <Layers className="w-5 h-5 text-primary-foreground" />
              </div>
              <h3 className="font-semibold mb-2">8 gated phases</h3>
              <p className="text-sm text-muted-foreground">
                From discovery to final audit—each phase builds on the last.
              </p>
            </div>

            {/* Approvals */}
            <div className="text-center p-6 rounded-xl bg-secondary/30 border border-border/50">
              <div className="w-10 h-10 mx-auto mb-3 rounded-lg gradient-primary flex items-center justify-center">
                <GitBranch className="w-5 h-5 text-primary-foreground" />
              </div>
              <h3 className="font-semibold mb-2">Approvals & versions</h3>
              <p className="text-sm text-muted-foreground">
                Nothing ships without your sign-off.
              </p>
            </div>

            {/* Exports */}
            <div className="text-center p-6 rounded-xl bg-secondary/30 border border-border/50">
              <div className="w-10 h-10 mx-auto mb-3 rounded-lg gradient-primary flex items-center justify-center">
                <Download className="w-5 h-5 text-primary-foreground" />
              </div>
              <h3 className="font-semibold mb-2">Client-ready exports</h3>
              <p className="text-sm text-muted-foreground">
                Markdown, DOCX, or PDF.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
