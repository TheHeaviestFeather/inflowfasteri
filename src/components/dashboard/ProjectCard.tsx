import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MessageSquare, FileText, Clock, ArrowRight, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ProjectWithStats {
  id: string;
  name: string;
  description: string | null;
  status: string;
  mode: string;
  updated_at: string;
  created_at: string;
  message_count: number;
  artifact_count: number;
}

interface ProjectCardProps {
  project: ProjectWithStats;
  onOpen: (projectId: string) => void;
  onEdit: (e: React.MouseEvent, project: ProjectWithStats) => void;
  onDelete: (e: React.MouseEvent, project: ProjectWithStats) => void;
}

export function ProjectCard({ project, onOpen, onEdit, onDelete }: ProjectCardProps) {
  return (
    <Card
      className="group hover:border-primary/50 transition-colors cursor-pointer"
      onClick={() => onOpen(project.id)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base truncate">{project.name}</CardTitle>
            {project.description && (
              <CardDescription className="mt-1 line-clamp-2">
                {project.description}
              </CardDescription>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Badge
              variant="outline"
              className={
                project.mode === "quick"
                  ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                  : "bg-blue-500/10 text-blue-600 border-blue-500/20"
              }
            >
              {project.mode === "quick" ? "Quick" : "Standard"}
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger
                asChild
                onClick={(e) => e.stopPropagation()}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={(e) => onEdit(e, project)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={(e) => onDelete(e, project)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
          <div className="flex items-center gap-1">
            <MessageSquare className="h-3.5 w-3.5" />
            <span>{project.message_count}</span>
          </div>
          <div className="flex items-center gap-1">
            <FileText className="h-3.5 w-3.5" />
            <span>{project.artifact_count}</span>
          </div>
          <div className="flex items-center gap-1 ml-auto">
            <Clock className="h-3.5 w-3.5" />
            <span>{formatDistanceToNow(new Date(project.updated_at), { addSuffix: true })}</span>
          </div>
        </div>
        <Button variant="outline" size="sm" className="w-full group/btn">
          Open Project
          <ArrowRight className="ml-2 h-4 w-4 group-hover/btn:translate-x-1 transition-transform" />
        </Button>
      </CardContent>
    </Card>
  );
}
