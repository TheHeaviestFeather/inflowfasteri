import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Project } from "@/types/database";
import { ChevronDown, Plus, FolderOpen } from "lucide-react";
import { useMobileView } from "@/hooks/useMobileView";
import { cn } from "@/lib/utils";

interface ProjectSelectorProps {
  projects: Project[];
  currentProject: Project | null;
  onSelectProject: (project: Project) => void;
  onCreateProject: (name: string, description: string) => void;
}

export function ProjectSelector({
  projects,
  currentProject,
  onSelectProject,
  onCreateProject,
}: ProjectSelectorProps) {
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");
  const [nameError, setNameError] = useState("");
  const { isMobile } = useMobileView();

  const handleCreateProject = () => {
    if (!newProjectName.trim()) {
      setNameError("Project name is required");
      return;
    }
    setNameError("");
    onCreateProject(newProjectName.trim(), newProjectDescription.trim());
    setNewProjectName("");
    setNewProjectDescription("");
    setShowNewProjectDialog(false);
  };

  const handleNameChange = (value: string) => {
    setNewProjectName(value);
    if (value.trim()) {
      setNameError("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleCreateProject();
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            className={cn(
              "gap-2 justify-between touch-manipulation",
              isMobile 
                ? "w-full max-w-[180px] h-9 text-sm" 
                : "min-w-[200px] w-auto"
            )}
          >
            <div className="flex items-center gap-2 truncate">
              <FolderOpen className="h-4 w-4 flex-shrink-0" />
              <span className={cn(
                "truncate",
                isMobile ? "max-w-[100px]" : "max-w-[180px]"
              )}>
                {currentProject?.name || "Select Project"}
              </span>
            </div>
            <ChevronDown className="h-4 w-4 flex-shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          align="start" 
          className={cn(
            "bg-popover",
            isMobile ? "w-[220px]" : "w-[250px]"
          )}
        >
          {projects.map((project) => (
            <DropdownMenuItem
              key={project.id}
              onClick={() => onSelectProject(project)}
              className={cn(
                "cursor-pointer touch-manipulation",
                isMobile && "py-3"
              )}
            >
              <FolderOpen className="h-4 w-4 mr-2" />
              <span className="truncate">{project.name}</span>
            </DropdownMenuItem>
          ))}
          {projects.length > 0 && <DropdownMenuSeparator />}
          <DropdownMenuItem
            onClick={() => setShowNewProjectDialog(true)}
            className={cn(
              "cursor-pointer touch-manipulation",
              isMobile && "py-3"
            )}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showNewProjectDialog} onOpenChange={setShowNewProjectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <DialogDescription>
              Start a new instructional design project. Give it a name and optional description.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="projectName">
                Project Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="projectName"
                value={newProjectName}
                onChange={(e) => handleNameChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g., Sales Training Module"
                className={nameError ? "border-destructive" : ""}
              />
              {nameError && (
                <p className="text-sm text-destructive">{nameError}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="projectDescription">
                Description <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="projectDescription"
                value={newProjectDescription}
                onChange={(e) => setNewProjectDescription(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Brief description of the project..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewProjectDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateProject}>
              Create Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
