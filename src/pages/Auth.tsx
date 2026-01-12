import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { FormField, PasswordStrengthIndicator } from "@/components/ui/form-field";
import { useFieldValidation, usePasswordValidation, emailSchema, nameSchema } from "@/hooks/useFormValidation";
import { Mail, Lock, User, ArrowRight, AlertCircle } from "lucide-react";

export default function Auth() {
  const [mode, setMode] = useState<"login" | "signup" | "forgot" | "reset" | "verify">("login");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Validation hooks
  const emailField = useFieldValidation(emailSchema);
  const nameField = useFieldValidation(nameSchema);
  const passwordField = usePasswordValidation();

  // Reset fields when mode changes
  useEffect(() => {
    emailField.reset();
    nameField.reset();
    passwordField.reset();
  }, [mode]);

  useEffect(() => {
    // Check if this is a password reset callback
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const type = hashParams.get("type");
    if (type === "recovery") {
      setMode("reset");
    }
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode("reset");
        return;
      }
      if (session && mode !== "reset" && mode !== "verify") {
        navigate("/dashboard");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && mode !== "reset" && mode !== "verify") {
        navigate("/dashboard");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, mode]);

  const isFormValid = () => {
    if (mode === "login") {
      return emailField.isValid && passwordField.value.length >= 8;
    }
    if (mode === "signup") {
      return emailField.isValid && nameField.isValid && passwordField.isValid;
    }
    if (mode === "forgot") {
      return emailField.isValid;
    }
    if (mode === "reset") {
      return passwordField.isValid;
    }
    return true;
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isFormValid()) {
      toast.error("Please fix the validation errors before continuing.");
      return;
    }
    
    setLoading(true);

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: emailField.value,
          password: passwordField.value,
        });
        if (error) {
          if (error.message.includes("Email not confirmed")) {
            toast.error("Please verify your email before signing in. Check your inbox.");
            return;
          }
          throw error;
        }
        toast.success("Welcome back!");
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: emailField.value,
          password: passwordField.value,
          options: {
            emailRedirectTo: `${window.location.origin}/auth`,
            data: {
              full_name: nameField.value,
            },
          },
        });
        if (error) throw error;
        setMode("verify");
        toast.success("Check your email to verify your account!");
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(emailField.value, {
          redirectTo: `${window.location.origin}/auth`,
        });
        if (error) throw error;
        toast.success("Password reset email sent! Check your inbox.");
        setMode("login");
      } else if (mode === "reset") {
        const { error } = await supabase.auth.updateUser({ password: passwordField.value });
        if (error) throw error;
        toast.success("Password updated successfully! You can now sign in.");
        setMode("login");
      }
    } catch (error: any) {
      if (error.message.includes("User already registered")) {
        toast.error("This email is already registered. Please sign in instead.");
      } else {
        toast.error(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    switch (mode) {
      case "login": return "Welcome back";
      case "signup": return "Create your account";
      case "forgot": return "Reset your password";
      case "reset": return "Set new password";
      case "verify": return "Check your email";
    }
  };

  const getDescription = () => {
    switch (mode) {
      case "login": return "Sign in to continue to your workspace";
      case "signup": return "Get started with InFlow today";
      case "forgot": return "Enter your email to receive a reset link";
      case "reset": return "Enter your new password below";
      case "verify": return `We've sent a verification link to ${emailField.value}`;
    }
  };

  const getButtonText = () => {
    if (loading) return "Please wait...";
    switch (mode) {
      case "login": return "Sign In";
      case "signup": return "Create Account";
      case "forgot": return "Send Reset Link";
      case "reset": return "Update Password";
      case "verify": return "Resend Email";
    }
  };

  // Email verification view
  if (mode === "verify") {
    return (
      <div className="min-h-screen mesh-gradient flex items-center justify-center p-4">
        <Card className="w-full max-w-md glass border-border/50">
          <CardHeader className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Mail className="h-8 w-8 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold">{getTitle()}</CardTitle>
            <CardDescription>{getDescription()}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Click the link in your email to verify your account, then come back here to sign in.
            </p>
            <div className="flex flex-col gap-2">
              <Button variant="outline" onClick={() => setMode("login")} className="w-full">
                Back to Sign In
              </Button>
              <Button 
                variant="ghost" 
                onClick={async () => {
                  const { error } = await supabase.auth.resend({ type: "signup", email: emailField.value });
                  if (error) toast.error(error.message);
                  else toast.success("Verification email resent!");
                }}
                className="w-full text-sm text-muted-foreground"
              >
                Didn't receive it? Resend email
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen mesh-gradient flex items-center justify-center p-4">
      <Card className="w-full max-w-md glass border-border/50">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <Logo />
          </div>
          <CardTitle className="text-2xl font-bold">{getTitle()}</CardTitle>
          <CardDescription>{getDescription()}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            {mode === "signup" && (
              <FormField
                id="fullName"
                label="Full Name"
                type="text"
                placeholder="John Doe"
                value={nameField.value}
                onChange={(e) => nameField.setValue(e.target.value)}
                onBlur={nameField.onBlur}
                error={nameField.error}
                touched={nameField.touched}
                isValid={nameField.isValid}
                icon={<User className="h-4 w-4" />}
                required
              />
            )}
            
            {mode !== "reset" && (
              <FormField
                id="email"
                label="Email"
                type="email"
                placeholder="you@example.com"
                value={emailField.value}
                onChange={(e) => emailField.setValue(e.target.value)}
                onBlur={emailField.onBlur}
                error={emailField.error}
                touched={emailField.touched}
                isValid={emailField.isValid}
                icon={<Mail className="h-4 w-4" />}
                required
              />
            )}
            
            {(mode === "login" || mode === "signup" || mode === "reset") && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    {mode === "reset" ? "New Password" : "Password"}
                  </Label>
                  {mode === "login" && (
                    <button
                      type="button"
                      onClick={() => setMode("forgot")}
                      className="text-xs text-primary hover:underline"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={passwordField.value}
                    onChange={(e) => passwordField.setValue(e.target.value)}
                    onBlur={passwordField.onBlur}
                    className={`${
                      passwordField.touched && passwordField.error
                        ? "border-destructive focus-visible:ring-destructive/50"
                        : passwordField.touched && passwordField.isValid
                        ? "border-green-500 focus-visible:ring-green-500/50"
                        : ""
                    }`}
                    required
                    minLength={8}
                    aria-invalid={passwordField.touched && !!passwordField.error}
                  />
                  {passwordField.touched && passwordField.error && mode === "login" && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    </div>
                  )}
                </div>
                {passwordField.touched && passwordField.error && mode === "login" && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {passwordField.error}
                  </p>
                )}
                {/* Password strength indicators for signup/reset */}
                <PasswordStrengthIndicator
                  strength={passwordField.strength}
                  show={(mode === "signup" || mode === "reset") && passwordField.value.length > 0}
                />
              </div>
            )}
            
            <Button 
              type="submit" 
              className="w-full group" 
              disabled={loading || !isFormValid()}
            >
              {getButtonText()}
              {!loading && <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />}
            </Button>
          </form>
          
          <div className="mt-6 text-center space-y-2">
            {mode === "login" && (
              <button
                type="button"
                onClick={() => setMode("signup")}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Don't have an account? Sign up
              </button>
            )}
            {mode === "signup" && (
              <button
                type="button"
                onClick={() => setMode("login")}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Already have an account? Sign in
              </button>
            )}
            {(mode === "forgot" || mode === "reset") && (
              <button
                type="button"
                onClick={() => setMode("login")}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Back to sign in
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
