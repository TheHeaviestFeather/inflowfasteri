import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { UserMenu } from "@/components/UserMenu";
import { ProjectSelector } from "./ProjectSelector";
import { Project } from "@/types/database";
import { LayoutDashboard } from "lucide-react";
import { Link } from "react-router-dom";
import { useMobileView } from "@/hooks/useMobileView";
import { cn } from "@/lib/utils";

interface WorkspaceHeaderProps {
  projects: Project[];
  currentProject: Project | null;
  onSelectProject: (project: Project) => void;
  onCreateProject: (name: string, description: string) => void;
  userEmail?: string;
  onSignOut: () => void;
}

export function WorkspaceHeader({
  projects,
  currentProject,
  onSelectProject,
  onCreateProject,
  userEmail,
  onSignOut,
}: WorkspaceHeaderProps) {
  const { isMobile } = useMobileView();

  return (
    <header className={cn(
      "bg-card border-b border-border flex items-center justify-between",
      isMobile ? "h-12 px-2" : "h-14 px-4"
    )}>
      <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
        <Link 
          to="/" 
          className="flex items-center gap-2 hover:opacity-80 transition-opacity flex-shrink-0 touch-manipulation"
        >
          <Logo />
        </Link>
        <div className="h-6 w-px bg-border hidden sm:block" />
        <div className="min-w-0 flex-1">
          <ProjectSelector
            projects={projects}
            currentProject={currentProject}
            onSelectProject={onSelectProject}
            onCreateProject={onCreateProject}
          />
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        {/* Dashboard link - icon only on mobile */}
        <Button 
          variant="ghost" 
          size={isMobile ? "icon" : "sm"} 
          asChild 
          className={cn(
            "touch-manipulation",
            isMobile ? "h-9 w-9" : "gap-2"
          )}
        >
          <Link to="/dashboard">
            <LayoutDashboard className="h-4 w-4" />
            {!isMobile && <span>Dashboard</span>}
          </Link>
        </Button>

        {/* User menu */}
        <UserMenu
          email={userEmail || null}
          onSignOut={onSignOut}
          compact
        />
      </div>
    </header>
  );
}
