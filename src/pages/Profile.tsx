import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Logo } from "@/components/Logo";
import { FormField } from "@/components/ui/form-field";
import { useFieldValidation, nameSchema } from "@/hooks/useFormValidation";
import { ArrowLeft, User, Mail, Clock, Calendar, Loader2 } from "lucide-react";
import { format } from "date-fns";

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HT)" },
  { value: "Europe/London", label: "Greenwich Mean Time (GMT)" },
  { value: "Europe/Paris", label: "Central European Time (CET)" },
  { value: "Europe/Berlin", label: "Central European Time (CET)" },
  { value: "Asia/Tokyo", label: "Japan Standard Time (JST)" },
  { value: "Asia/Shanghai", label: "China Standard Time (CST)" },
  { value: "Asia/Dubai", label: "Gulf Standard Time (GST)" },
  { value: "Australia/Sydney", label: "Australian Eastern Time (AET)" },
];

export default function Profile() {
  const navigate = useNavigate();
  const { profile, loading, saving, updateProfile } = useProfile();
  const nameField = useFieldValidation(nameSchema);
  const [timezone, setTimezone] = useState("America/New_York");
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setAuthLoading(false);
    };
    checkAuth();
  }, [navigate]);

  useEffect(() => {
    if (profile) {
      if (profile.full_name) {
        nameField.setValue(profile.full_name);
      }
      setTimezone(profile.timezone || "America/New_York");
    }
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Allow empty name or valid name
    if (nameField.value && !nameField.isValid) {
      return;
    }
    
    await updateProfile({ full_name: nameField.value, timezone });
  };

  const userInitials = profile?.email
    ? profile.email.substring(0, 2).toUpperCase()
    : "U";

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="h-14 bg-card border-b border-border flex items-center px-4">
          <Link to="/" className="flex items-center gap-2">
            <Logo />
          </Link>
        </header>
        <div className="container max-w-2xl py-8 px-4">
          <Skeleton className="h-8 w-32 mb-6" />
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-4 w-48 mt-2" />
            </CardHeader>
            <CardContent className="space-y-6">
              <Skeleton className="h-20 w-20 rounded-full mx-auto" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 bg-card border-b border-border flex items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <Logo />
        </Link>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/dashboard">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Link>
        </Button>
      </header>

      <div className="container max-w-2xl py-8 px-4">
        <h1 className="text-2xl font-bold mb-6">Profile</h1>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Personal Information
            </CardTitle>
            <CardDescription>
              Manage your personal details and preferences
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Avatar */}
              <div className="flex justify-center">
                <Avatar className="h-20 w-20">
                  <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
              </div>

              {/* Email (read-only) */}
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={profile?.email || ""}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Email cannot be changed
                </p>
              </div>

              {/* Full Name */}
              <FormField
                id="fullName"
                label="Full Name"
                type="text"
                value={nameField.value}
                onChange={(e) => nameField.setValue(e.target.value)}
                onBlur={nameField.onBlur}
                error={nameField.error}
                touched={nameField.touched}
                isValid={nameField.isValid}
                icon={<User className="h-4 w-4" />}
                placeholder="Enter your full name"
              />

              {/* Timezone */}
              <div className="space-y-2">
                <Label htmlFor="timezone" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Timezone
                </Label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger id="timezone">
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Account info */}
              <div className="pt-4 border-t border-border">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>
                    Member since {profile?.created_at 
                      ? format(new Date(profile.created_at), "MMMM d, yyyy")
                      : "—"}
                  </span>
                </div>
              </div>

              {/* Submit */}
              <Button 
                type="submit" 
                className="w-full" 
                disabled={saving || (nameField.value.length > 0 && !nameField.isValid)}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
