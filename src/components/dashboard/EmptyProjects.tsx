import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FolderOpen, Plus } from "lucide-react";

interface EmptyProjectsProps {
  onCreateClick: () => void;
}

export function EmptyProjects({ onCreateClick }: EmptyProjectsProps) {
  return (
    <Card className="p-12 text-center">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
        <FolderOpen className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium mb-2">No projects yet</h3>
      <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
        Create your first project to start designing engaging learning experiences.
      </p>
      <Button onClick={onCreateClick} className="gap-2">
        <Plus className="h-4 w-4" />
        Create Your First Project
      </Button>
    </Card>
  );
}
