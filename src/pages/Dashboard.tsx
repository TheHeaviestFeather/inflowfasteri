import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { 
  Plus, 
  MessageSquare, 
  FileText, 
  Clock, 
  FolderOpen, 
  LogOut, 
  Loader2,
  ArrowRight,
  User
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { formatDistanceToNow } from "date-fns";

interface ProjectWithStats {
  id: string;
  name: string;
  description: string | null;
  status: string;
  mode: string;
  updated_at: string;
  created_at: string;
  messageCount: number;
  artifactCount: number;
}

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  tier: string;
}

export default function Dashboard() {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();

  const [projects, setProjects] = useState<ProjectWithStats[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");
  const [creating, setCreating] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  // Fetch profile and projects with stats
  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      // Fetch profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileData) {
        setProfile(profileData as Profile);
      }

      // Fetch projects
      const { data: projectsData, error: projectsError } = await supabase
        .from("projects")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (projectsError) {
        console.error("Error fetching projects:", projectsError);
        toast.error("Failed to load projects");
        setDataLoading(false);
        return;
      }

      // Fetch stats for each project
      const projectsWithStats: ProjectWithStats[] = await Promise.all(
        (projectsData || []).map(async (project) => {
          const [messagesRes, artifactsRes] = await Promise.all([
            supabase
              .from("messages")
              .select("id", { count: "exact", head: true })
              .eq("project_id", project.id),
            supabase
              .from("artifacts")
              .select("id", { count: "exact", head: true })
              .eq("project_id", project.id),
          ]);

          return {
            ...project,
            messageCount: messagesRes.count || 0,
            artifactCount: artifactsRes.count || 0,
          };
        })
      );

      setProjects(projectsWithStats);
      setDataLoading(false);
    };

    fetchData();
  }, [user]);

  const handleCreateProject = async () => {
    if (!user || !newProjectName.trim()) return;

    setCreating(true);
    const { data, error } = await supabase
      .from("projects")
      .insert({
        user_id: user.id,
        name: newProjectName.trim(),
        description: newProjectDescription.trim() || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating project:", error);
      toast.error("Failed to create project");
    } else {
      toast.success("Project created!");
      navigate("/workspace");
    }
    setCreating(false);
    setCreateDialogOpen(false);
  };

  const handleOpenProject = (projectId: string) => {
    navigate(`/workspace?project=${projectId}`);
  };

  if (authLoading || dataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    }
    return email[0].toUpperCase();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:block">
              {profile?.email}
            </span>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-4 gap-8">
          {/* Profile Sidebar */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader className="text-center">
                <Avatar className="h-20 w-20 mx-auto mb-4">
                  <AvatarImage src={profile?.avatar_url || undefined} />
                  <AvatarFallback className="text-lg bg-primary text-primary-foreground">
                    {getInitials(profile?.full_name || null, profile?.email || "")}
                  </AvatarFallback>
                </Avatar>
                <CardTitle className="text-lg">
                  {profile?.full_name || "User"}
                </CardTitle>
                <CardDescription className="truncate">
                  {profile?.email}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Plan</span>
                  <Badge variant="secondary" className="capitalize">
                    {profile?.tier || "free"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Projects</span>
                  <span className="font-medium">{projects.length}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total Messages</span>
                  <span className="font-medium">
                    {projects.reduce((sum, p) => sum + p.messageCount, 0)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Projects Grid */}
          <div className="lg:col-span-3">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold">Your Projects</h1>
                <p className="text-muted-foreground">
                  Manage and access your instructional design projects
                </p>
              </div>
              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    New Project
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Project</DialogTitle>
                    <DialogDescription>
                      Start a new instructional design project
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="project-name">Project Name</Label>
                      <Input
                        id="project-name"
                        placeholder="e.g., Sales Training Program"
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="project-description">Description (optional)</Label>
                      <Textarea
                        id="project-description"
                        placeholder="Brief description of your project..."
                        value={newProjectDescription}
                        onChange={(e) => setNewProjectDescription(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleCreateProject} 
                      disabled={!newProjectName.trim() || creating}
                    >
                      {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Create Project
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {projects.length === 0 ? (
              <Card className="p-12 text-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <FolderOpen className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-2">No projects yet</h3>
                <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                  Create your first project to start designing engaging learning experiences.
                </p>
                <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create Your First Project
                </Button>
              </Card>
            ) : (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {projects.map((project) => (
                  <Card 
                    key={project.id} 
                    className="group hover:border-primary/50 transition-colors cursor-pointer"
                    onClick={() => handleOpenProject(project.id)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base truncate">
                            {project.name}
                          </CardTitle>
                          {project.description && (
                            <CardDescription className="mt-1 line-clamp-2">
                              {project.description}
                            </CardDescription>
                          )}
                        </div>
                        <Badge 
                          variant="outline" 
                          className={project.mode === "quick" 
                            ? "bg-amber-500/10 text-amber-600 border-amber-500/20" 
                            : "bg-blue-500/10 text-blue-600 border-blue-500/20"
                          }
                        >
                          {project.mode === "quick" ? "Quick" : "Standard"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                        <div className="flex items-center gap-1">
                          <MessageSquare className="h-3.5 w-3.5" />
                          <span>{project.messageCount}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <FileText className="h-3.5 w-3.5" />
                          <span>{project.artifactCount}</span>
                        </div>
                        <div className="flex items-center gap-1 ml-auto">
                          <Clock className="h-3.5 w-3.5" />
                          <span>{formatDistanceToNow(new Date(project.updated_at), { addSuffix: true })}</span>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        className="w-full justify-between group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                      >
                        Open Project
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}