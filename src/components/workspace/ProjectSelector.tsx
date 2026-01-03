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

  const handleCreateProject = () => {
    if (newProjectName.trim()) {
      onCreateProject(newProjectName.trim(), newProjectDescription.trim());
      setNewProjectName("");
      setNewProjectDescription("");
      setShowNewProjectDialog(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2 min-w-[200px] justify-between">
            <div className="flex items-center gap-2 truncate">
              <FolderOpen className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">
                {currentProject?.name || "Select Project"}
              </span>
            </div>
            <ChevronDown className="h-4 w-4 flex-shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[250px]">
          {projects.map((project) => (
            <DropdownMenuItem
              key={project.id}
              onClick={() => onSelectProject(project)}
              className="cursor-pointer"
            >
              <FolderOpen className="h-4 w-4 mr-2" />
              <span className="truncate">{project.name}</span>
            </DropdownMenuItem>
          ))}
          {projects.length > 0 && <DropdownMenuSeparator />}
          <DropdownMenuItem
            onClick={() => setShowNewProjectDialog(true)}
            className="cursor-pointer"
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
              <Label htmlFor="projectName">Project Name</Label>
              <Input
                id="projectName"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="e.g., Sales Training Module"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="projectDescription">Description (optional)</Label>
              <Textarea
                id="projectDescription"
                value={newProjectDescription}
                onChange={(e) => setNewProjectDescription(e.target.value)}
                placeholder="Brief description of the project..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewProjectDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateProject} disabled={!newProjectName.trim()}>
              Create Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
