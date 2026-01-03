import { Check, ArrowRight } from "lucide-react";

const phases = [
  {
    number: "01",
    title: "Contract",
    description: "Define scope, constraints, and success criteria with your stakeholders.",
    artifacts: ["Project scope", "Success metrics", "Timeline"],
    color: "from-blue-500 to-blue-600",
  },
  {
    number: "02",
    title: "Discovery",
    description: "Gather evidence through interviews, observations, and data analysis.",
    artifacts: ["Discovery report", "Gap analysis", "Evidence log"],
    color: "from-indigo-500 to-indigo-600",
  },
  {
    number: "03",
    title: "Persona",
    description: "Build learner profiles based on real data, not assumptions.",
    artifacts: ["Learner persona", "Motivation map", "Barriers list"],
    color: "from-violet-500 to-violet-600",
  },
  {
    number: "04",
    title: "Strategy",
    description: "Choose the right instructional approach for your learners and context.",
    artifacts: ["Design strategy", "Modality selection", "Risk assessment"],
    color: "from-purple-500 to-purple-600",
  },
  {
    number: "05",
    title: "Blueprint",
    description: "Structure your learning experience with clear objectives and activities.",
    artifacts: ["Course blueprint", "Learning objectives", "Activity map"],
    color: "from-fuchsia-500 to-fuchsia-600",
  },
  {
    number: "06",
    title: "Scenarios",
    description: "Create realistic practice opportunities that mirror job performance.",
    artifacts: ["Scenario bank", "Branching logic", "Feedback scripts"],
    color: "from-pink-500 to-pink-600",
  },
  {
    number: "07",
    title: "Assessment",
    description: "Design valid measurements that actually predict job performance.",
    artifacts: ["Assessment kit", "Rubrics", "Evaluation plan"],
    color: "from-rose-500 to-rose-600",
  },
  {
    number: "08",
    title: "Audit",
    description: "Final quality check against evidence, constraints, and best practices.",
    artifacts: ["Final audit", "Compliance check", "Launch checklist"],
    color: "from-orange-500 to-orange-600",
  },
];

export function WorkflowSection() {
  return (
    <section id="workflow" className="py-24 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            A Proven <span className="gradient-text-accent">8-Phase Pipeline</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Each phase builds on the last. No shortcuts, no gaps, no guesswork.
          </p>
        </div>

        <div className="relative">
          {/* Connection line */}
          <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-500 via-purple-500 to-orange-500 hidden lg:block" />

          <div className="space-y-8">
            {phases.map((phase, index) => (
              <div
                key={phase.number}
                className="relative flex items-start gap-6 group"
              >
                {/* Phase number circle */}
                <div className="relative z-10 flex-shrink-0">
                  <div
                    className={`w-16 h-16 rounded-full bg-gradient-to-br ${phase.color} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}
                  >
                    <span className="text-lg font-bold text-white">
                      {phase.number}
                    </span>
                  </div>
                </div>

                {/* Phase content */}
                <div className="flex-1 bg-card rounded-xl border border-border p-6 group-hover:border-accent/30 group-hover:shadow-lg transition-all">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold mb-2">
                        {phase.title}
                      </h3>
                      <p className="text-muted-foreground mb-4">
                        {phase.description}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {phase.artifacts.map((artifact) => (
                          <span
                            key={artifact}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-xs font-medium"
                          >
                            <Check className="w-3 h-3" />
                            {artifact}
                          </span>
                        ))}
                      </div>
                    </div>

                    {index < phases.length - 1 && (
                      <div className="hidden lg:flex items-center justify-center w-10 h-10 rounded-full bg-secondary">
                        <ArrowRight className="w-5 h-5 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
