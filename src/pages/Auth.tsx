import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { Mail, Lock, User, ArrowRight, CheckCircle, XCircle } from "lucide-react";

// Password strength validation
const validatePassword = (password: string) => {
  const checks = {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /\d/.test(password),
  };
  const isValid = Object.values(checks).every(Boolean);
  return { checks, isValid };
};

export default function Auth() {
  const [mode, setMode] = useState<"login" | "signup" | "forgot" | "reset" | "verify">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Password validation state
  const passwordValidation = useMemo(() => validatePassword(password), [password]);
  const showPasswordHints = mode === "signup" || mode === "reset";

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

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) {
          // Handle unverified email
          if (error.message.includes("Email not confirmed")) {
            toast.error("Please verify your email before signing in. Check your inbox.");
            return;
          }
          throw error;
        }
        toast.success("Welcome back!");
      } else if (mode === "signup") {
        // Validate password strength before signup
        if (!passwordValidation.isValid) {
          toast.error("Please ensure your password meets all requirements.");
          return;
        }

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth`,
            data: {
              full_name: fullName,
            },
          },
        });
        if (error) throw error;
        
        // Switch to verification mode instead of login
        setMode("verify");
        toast.success("Check your email to verify your account!");
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth`,
        });
        if (error) throw error;
        toast.success("Password reset email sent! Check your inbox.");
        setMode("login");
      } else if (mode === "reset") {
        // Validate password strength before reset
        if (!passwordValidation.isValid) {
          toast.error("Please ensure your password meets all requirements.");
          return;
        }

        const { error } = await supabase.auth.updateUser({ password });
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
      case "verify": return `We've sent a verification link to ${email}`;
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
                  const { error } = await supabase.auth.resend({ type: "signup", email });
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
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
            )}
            
            {mode !== "reset" && (
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
            )}
            
            {(mode === "login" || mode === "signup" || mode === "reset") && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">
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
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                    minLength={8}
                  />
                </div>
                {/* Password strength indicators for signup/reset */}
                {showPasswordHints && password.length > 0 && (
                  <div className="grid grid-cols-2 gap-1 text-xs mt-2">
                    {[
                      { key: "minLength", label: "8+ characters" },
                      { key: "hasUppercase", label: "Uppercase letter" },
                      { key: "hasLowercase", label: "Lowercase letter" },
                      { key: "hasNumber", label: "Number" },
                    ].map(({ key, label }) => (
                      <div
                        key={key}
                        className={`flex items-center gap-1 ${
                          passwordValidation.checks[key as keyof typeof passwordValidation.checks]
                            ? "text-green-600"
                            : "text-muted-foreground"
                        }`}
                      >
                        {passwordValidation.checks[key as keyof typeof passwordValidation.checks] ? (
                          <CheckCircle className="h-3 w-3" />
                        ) : (
                          <XCircle className="h-3 w-3" />
                        )}
                        {label}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            <Button type="submit" className="w-full group" disabled={loading}>
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
