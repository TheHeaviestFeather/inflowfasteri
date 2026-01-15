import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface UserBilling {
  tier: string;
  credits_used: number;
  credits_limit: number;
}

interface ProfileSidebarProps {
  profile: Profile | null;
  billing: UserBilling | null;
  projectCount: number;
  totalMessages: number;
}

function getInitials(name: string | null, email: string): string {
  if (name) {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return email[0].toUpperCase();
}

export function ProfileSidebar({ profile, billing, projectCount, totalMessages }: ProfileSidebarProps) {
  return (
    <Card>
      <CardHeader className="text-center">
        <Avatar className="h-20 w-20 mx-auto mb-4">
          <AvatarImage src={profile?.avatar_url || undefined} />
          <AvatarFallback className="text-lg bg-primary text-primary-foreground">
            {getInitials(profile?.full_name || null, profile?.email || "")}
          </AvatarFallback>
        </Avatar>
        <CardTitle className="text-lg">{profile?.full_name || "User"}</CardTitle>
        <CardDescription className="truncate">{profile?.email}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Plan</span>
          <Badge variant="secondary" className="capitalize">
            {billing?.tier || "free"}
          </Badge>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Credits</span>
            <span className="font-medium">
              {billing?.tier === "pro" 
                ? "Unlimited" 
                : `${billing?.credits_used ?? 0} / ${billing?.credits_limit ?? 50}`}
            </span>
          </div>
          {billing?.tier !== "pro" && (
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-300"
                style={{ 
                  width: `${Math.min(((billing?.credits_used ?? 0) / (billing?.credits_limit ?? 50)) * 100, 100)}%` 
                }}
              />
            </div>
          )}
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Projects</span>
          <span className="font-medium">{projectCount}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Total Messages</span>
          <span className="font-medium">{totalMessages}</span>
        </div>
      </CardContent>
    </Card>
  );
}
