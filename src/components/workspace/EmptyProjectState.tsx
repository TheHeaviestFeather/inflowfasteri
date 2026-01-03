import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Rocket, Lightbulb, Users, Target } from "lucide-react";

interface EmptyProjectStateProps {
  onCreateProject: (name: string, description: string) => void;
}

export function EmptyProjectState({ onCreateProject }: EmptyProjectStateProps) {
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [nameError, setNameError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) {
      setNameError("Project name is required");
      return;
    }
    setNameError("");
    onCreateProject(projectName.trim(), projectDescription.trim());
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProjectName(e.target.value);
    if (e.target.value.trim()) {
      setNameError("");
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Rocket className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold mb-3">Welcome to Your ID Workspace</h1>
          <p className="text-muted-foreground text-lg">
            Create your first project to start designing effective learning experiences
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card border rounded-xl p-6 mb-8">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="projectName" className="text-base">
                Project Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="projectName"
                value={projectName}
                onChange={handleNameChange}
                placeholder="e.g., Sales Training Module"
                className={nameError ? "border-destructive" : ""}
                autoFocus
              />
              {nameError && (
                <p className="text-sm text-destructive">{nameError}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="projectDescription" className="text-base">
                Description <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="projectDescription"
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                placeholder="Brief description of your training project..."
                rows={3}
              />
            </div>
            <Button type="submit" size="lg" className="w-full">
              Create Project & Start
            </Button>
          </div>
        </form>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <Lightbulb className="h-6 w-6 mx-auto mb-2 text-amber-500" />
            <h3 className="font-medium mb-1">AI-Guided Process</h3>
            <p className="text-sm text-muted-foreground">
              Step-by-step guidance through 8 ID phases
            </p>
          </div>
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <Users className="h-6 w-6 mx-auto mb-2 text-blue-500" />
            <h3 className="font-medium mb-1">Learner-Centered</h3>
            <p className="text-sm text-muted-foreground">
              Build personas and learning objectives
            </p>
          </div>
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <Target className="h-6 w-6 mx-auto mb-2 text-green-500" />
            <h3 className="font-medium mb-1">Deliverable Artifacts</h3>
            <p className="text-sm text-muted-foreground">
              Generate professional ID documents
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
