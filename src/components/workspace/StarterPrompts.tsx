import { Button } from "@/components/ui/button";
import { Sparkles, Users, BookOpen, Target, MessageSquare } from "lucide-react";

interface StarterPromptsProps {
  onSelectPrompt: (prompt: string) => void;
}

const STARTER_PROMPTS = [
  {
    icon: Users,
    label: "Onboard new employees",
    prompt: "I need to create an onboarding training program for new employees. They need to learn our company culture, processes, and tools within their first 30 days.",
  },
  {
    icon: Target,
    label: "Upskill my sales team",
    prompt: "I want to design a training program to improve my sales team's performance. They need to learn better negotiation techniques and product knowledge.",
  },
  {
    icon: BookOpen,
    label: "Compliance training",
    prompt: "I need to create mandatory compliance training for our organization. It should cover safety protocols, data privacy, and workplace ethics.",
  },
  {
    icon: MessageSquare,
    label: "Customer service skills",
    prompt: "I want to develop a customer service training program that teaches communication skills, problem resolution, and empathy in customer interactions.",
  },
];

export function StarterPrompts({ onSelectPrompt }: StarterPromptsProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center px-4">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <Sparkles className="h-8 w-8 text-primary" />
      </div>
      <h3 className="text-xl font-semibold mb-2">Start your ID journey</h3>
      <p className="text-muted-foreground max-w-md mb-8">
        I'll guide you through the instructional design process. 
        Choose a starting point or describe your project.
      </p>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
        {STARTER_PROMPTS.map((item) => {
          const Icon = item.icon;
          return (
            <Button
              key={item.label}
              variant="outline"
              className="h-auto py-3 px-4 justify-start text-left"
              onClick={() => onSelectPrompt(item.prompt)}
            >
              <Icon className="h-4 w-4 mr-3 flex-shrink-0 text-primary" />
              <span className="text-sm">{item.label}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
