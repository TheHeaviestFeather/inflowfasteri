import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEnsureProfile } from "@/hooks/useEnsureProfile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  MoreVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { UserMenu } from "@/components/UserMenu";
import { formatDistanceToNow } from "date-fns";
import { dashboardLogger } from "@/lib/logger";

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

export default function Dashboard() {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const { ensureProfileExists, ensureBillingExists } = useEnsureProfile();
  const profileEnsuredRef = useRef(false);
  const lastUserIdRef = useRef<string | null>(null);

  const [projects, setProjects] = useState<ProjectWithStats[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [billing, setBilling] = useState<UserBilling | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");
  const [creating, setCreating] = useState(false);

  // Edit state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectWithStats | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingProject, setDeletingProject] = useState<ProjectWithStats | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Reset profile ensured flag when user changes (e.g., logout/login as different user)
  useEffect(() => {
    if (user?.id !== lastUserIdRef.current) {
      profileEnsuredRef.current = false;
      lastUserIdRef.current = user?.id ?? null;
    }
  }, [user?.id]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  // Fetch profile, billing, and projects using the view
  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      // First, ensure profile and billing records exist (fallback for trigger failures)
      // Only do this once per session to avoid repeated DB calls
      if (!profileEnsuredRef.current) {
        profileEnsuredRef.current = true;
        await Promise.all([
          ensureProfileExists(user),
          ensureBillingExists(user.id),
        ]);
      }

      // Fetch profile, billing, and projects in parallel using the view
      const [profileResult, billingResult, projectsResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, email, full_name, avatar_url")
          .eq("id", user.id)
          .maybeSingle(),
        supabase.from("user_billing").select("tier, credits_used, credits_limit").eq("user_id", user.id).maybeSingle(),
        // Use the view to get projects with stats in a single query!
        supabase
          .from("projects_with_stats")
          .select("*")
          .order("updated_at", { ascending: false }),
      ]);

      if (profileResult.data) {
        setProfile(profileResult.data as Profile);
      } else if (user.email) {
        // Fallback: use user data from auth if profile not found
        setProfile({
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || null,
          avatar_url: null,
        });
      }

      if (billingResult.data) {
        setBilling(billingResult.data as UserBilling);
      } else {
        // Fallback: use default free tier values
        setBilling({
          tier: "free",
          credits_used: 0,
          credits_limit: 50,
        });
      }

      if (projectsResult.error) {
        dashboardLogger.error("Error fetching projects", { error: projectsResult.error });
        toast.error("Failed to load projects");
      } else {
        setProjects(projectsResult.data as ProjectWithStats[]);
      }

      setDataLoading(false);
    };

    fetchData();
  }, [user, ensureProfileExists, ensureBillingExists]);

  const handleCreateProject = async () => {
    if (!user || !newProjectName.trim()) return;

    setCreating(true);

    // Ensure profile exists before creating project (FK constraint)
    const profileExists = await ensureProfileExists(user);
    if (!profileExists) {
      dashboardLogger.error("Failed to ensure profile exists before project creation");
      toast.error("Unable to set up your account. Please try refreshing the page.");
      setCreating(false);
      return;
    }

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
      dashboardLogger.error("Error creating project", { error });
      // Provide more helpful error message for FK constraint violations
      if (error.code === "23503") {
        toast.error("Account setup incomplete. Please try signing out and back in.");
      } else {
        toast.error("Failed to create project. Please try again.");
      }
    } else {
      toast.success("Project created!");
      // Reset form state before navigating
      setNewProjectName("");
      setNewProjectDescription("");
      navigate("/workspace");
    }
    setCreating(false);
    setCreateDialogOpen(false);
  };

  const handleOpenProject = (projectId: string) => {
    navigate(`/workspace?project=${projectId}`);
  };

  const handleEditClick = (e: React.MouseEvent, project: ProjectWithStats) => {
    e.stopPropagation();
    setEditingProject(project);
    setEditName(project.name);
    setEditDescription(project.description || "");
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingProject || !editName.trim()) return;

    setSaving(true);
    const { error } = await supabase
      .from("projects")
      .update({
        name: editName.trim(),
        description: editDescription.trim() || null,
      })
      .eq("id", editingProject.id);

    if (error) {
      dashboardLogger.error("Error updating project", { error });
      toast.error("Failed to update project");
    } else {
      setProjects((prev) =>
        prev.map((p) =>
          p.id === editingProject.id
            ? { ...p, name: editName.trim(), description: editDescription.trim() || null }
            : p
        )
      );
      toast.success("Project updated!");
    }
    setSaving(false);
    setEditDialogOpen(false);
    setEditingProject(null);
  };

  const handleDeleteClick = (e: React.MouseEvent, project: ProjectWithStats) => {
    e.stopPropagation();
    setDeletingProject(project);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingProject) return;

    setDeleting(true);
    const { error } = await supabase.from("projects").delete().eq("id", deletingProject.id);

    if (error) {
      dashboardLogger.error("Error deleting project", { error });
      toast.error("Failed to delete project");
    } else {
      setProjects((prev) => prev.filter((p) => p.id !== deletingProject.id));
      toast.success("Project deleted");
    }
    setDeleting(false);
    setDeleteDialogOpen(false);
    setDeletingProject(null);
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
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return email[0].toUpperCase();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/">
            <Logo />
          </Link>
          <UserMenu
            email={profile?.email || null}
            fullName={profile?.full_name}
            avatarUrl={profile?.avatar_url}
            onSignOut={signOut}
          />
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
                  <span className="font-medium">{projects.length}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total Messages</span>
                  <span className="font-medium">
                    {projects.reduce((sum, p) => sum + p.message_count, 0)}
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
                    <DialogDescription>Start a new instructional design project</DialogDescription>
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
                              <DropdownMenuItem onClick={(e) => handleEditClick(e, project)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={(e) => handleDeleteClick(e, project)}
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
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>Update your project details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Project Name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description (optional)</Label>
              <Textarea
                id="edit-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={!editName.trim() || saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog 
        open={deleteDialogOpen} 
        onOpenChange={(open) => {
          // Prevent closing while delete is in progress
          if (!deleting) {
            setDeleteDialogOpen(open);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingProject?.name}"? This action cannot be
              undone and will permanently remove all messages and artifacts.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
            >
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete Project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
