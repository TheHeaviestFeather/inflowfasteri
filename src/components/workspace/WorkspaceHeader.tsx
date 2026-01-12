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
import { Project } from "@/types/database";
import { User, LogOut, Settings, LayoutDashboard, Menu } from "lucide-react";
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
  const userInitials = userEmail
    ? userEmail.substring(0, 2).toUpperCase()
    : "U";

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

        {/* Mobile menu */}
        {isMobile ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon"
                className="h-9 w-9 touch-manipulation"
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-popover">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium truncate">{userEmail}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer py-3 touch-manipulation" asChild>
                <Link to="/profile">
                  <User className="h-4 w-4 mr-2" />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer py-3 touch-manipulation" asChild>
                <Link to="/settings">
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={onSignOut} 
                className="cursor-pointer text-destructive py-3 touch-manipulation"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          /* Desktop user menu */
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
            <DropdownMenuContent align="end" className="w-56 bg-popover">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">{userEmail}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer" asChild>
                <Link to="/profile">
                  <User className="h-4 w-4 mr-2" />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer" asChild>
                <Link to="/settings">
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onSignOut} className="cursor-pointer text-destructive">
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
