import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User, Settings, LogOut, ChevronDown } from "lucide-react";

interface UserMenuProps {
  email: string | null;
  fullName?: string | null;
  avatarUrl?: string | null;
  onSignOut: () => void;
  compact?: boolean;
}

export function UserMenu({ email, fullName, avatarUrl, onSignOut, compact = false }: UserMenuProps) {
  const getInitials = (name: string | null, email: string | null) => {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    if (email) {
      return email[0].toUpperCase();
    }
    return "U";
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          className={compact ? "h-8 w-8 rounded-full p-0" : "gap-2 pl-2 pr-3"}
          aria-label={`User menu for ${fullName || email || "user"}`}
        >
          <Avatar className={compact ? "h-8 w-8" : "h-7 w-7"}>
            <AvatarImage src={avatarUrl || undefined} alt="" />
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
              {getInitials(fullName || null, email)}
            </AvatarFallback>
          </Avatar>
          {!compact && (
            <>
              <span className="text-sm max-w-[120px] truncate hidden sm:block">
                {fullName || email}
              </span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            {fullName && <p className="text-sm font-medium">{fullName}</p>}
            <p className="text-xs text-muted-foreground truncate">{email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/profile" className="cursor-pointer">
            <User className="h-4 w-4 mr-2" aria-hidden="true" />
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/settings" className="cursor-pointer">
            <Settings className="h-4 w-4 mr-2" aria-hidden="true" />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onSignOut} className="cursor-pointer text-destructive focus:text-destructive">
          <LogOut className="h-4 w-4 mr-2" aria-hidden="true" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
