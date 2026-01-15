import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEnsureProfile } from "@/hooks/useEnsureProfile";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { UserMenu } from "@/components/UserMenu";
import { dashboardLogger } from "@/lib/logger";

// Dashboard components
import { ProfileSidebar } from "@/components/dashboard/ProfileSidebar";
import { ProjectCard } from "@/components/dashboard/ProjectCard";
import { CreateProjectDialog } from "@/components/dashboard/CreateProjectDialog";
import { EditProjectDialog } from "@/components/dashboard/EditProjectDialog";
import { DeleteProjectDialog } from "@/components/dashboard/DeleteProjectDialog";
import { EmptyProjects } from "@/components/dashboard/EmptyProjects";

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

  const [projects, setProjects] = useState<ProjectWithStats[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [billing, setBilling] = useState<UserBilling | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  
  // Create dialog state
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

  const totalMessages = projects.reduce((sum, p) => sum + p.message_count, 0);

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
            <ProfileSidebar
              profile={profile}
              billing={billing}
              projectCount={projects.length}
              totalMessages={totalMessages}
            />
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
              <CreateProjectDialog
                open={createDialogOpen}
                onOpenChange={setCreateDialogOpen}
                name={newProjectName}
                onNameChange={setNewProjectName}
                description={newProjectDescription}
                onDescriptionChange={setNewProjectDescription}
                onSubmit={handleCreateProject}
                creating={creating}
              />
            </div>

            {projects.length === 0 ? (
              <EmptyProjects onCreateClick={() => setCreateDialogOpen(true)} />
            ) : (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {projects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onOpen={handleOpenProject}
                    onEdit={handleEditClick}
                    onDelete={handleDeleteClick}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Edit Dialog */}
      <EditProjectDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        name={editName}
        onNameChange={setEditName}
        description={editDescription}
        onDescriptionChange={setEditDescription}
        onSubmit={handleSaveEdit}
        saving={saving}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteProjectDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        projectName={deletingProject?.name}
        onConfirm={handleConfirmDelete}
        deleting={deleting}
      />
    </div>
  );
}
