import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Logo } from "@/components/Logo";
import { ProjectSelector } from "./ProjectSelector";
import { PhaseProgress } from "./PhaseProgress";
import { Project, Artifact } from "@/types/database";
import { User, LogOut, Settings, LayoutDashboard } from "lucide-react";
import { Link } from "react-router-dom";

interface WorkspaceHeaderProps {
  projects: Project[];
  currentProject: Project | null;
  onSelectProject: (project: Project) => void;
  onCreateProject: (name: string, description: string) => void;
  userEmail?: string;
  onSignOut: () => void;
  artifacts?: Artifact[];
  currentStage?: string | null;
  mode?: "standard" | "quick";
}

export function WorkspaceHeader({
  projects,
  currentProject,
  onSelectProject,
  onCreateProject,
  userEmail,
  onSignOut,
  artifacts = [],
  currentStage,
  mode = "standard",
}: WorkspaceHeaderProps) {
  const userInitials = userEmail
    ? userEmail.substring(0, 2).toUpperCase()
    : "U";

  return (
    <header className="h-14 bg-card border-b border-border flex items-center justify-between px-4">
      <div className="flex items-center gap-4">
        <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <Logo />
        </Link>
        <div className="h-6 w-px bg-border" />
        <ProjectSelector
          projects={projects}
          currentProject={currentProject}
          onSelectProject={onSelectProject}
          onCreateProject={onCreateProject}
        />
        {currentProject && artifacts.length > 0 && (
          <>
            <div className="h-6 w-px bg-border hidden md:block" />
            <div className="hidden md:block">
              <PhaseProgress 
                artifacts={artifacts} 
                currentStage={currentStage} 
                mode={mode} 
              />
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild className="gap-2">
          <Link to="/dashboard">
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-9 w-9 rounded-full p-0">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{userEmail}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer">
              <User className="h-4 w-4 mr-2" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onSignOut} className="cursor-pointer text-destructive">
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
