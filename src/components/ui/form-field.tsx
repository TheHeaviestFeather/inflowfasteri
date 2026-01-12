import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle, XCircle, AlertCircle } from "lucide-react";
import type { PasswordStrength } from "@/hooks/useFormValidation";
import { forwardRef } from "react";

interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string | null;
  touched?: boolean;
  isValid?: boolean;
  icon?: React.ReactNode;
  hint?: string;
}

export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(
  ({ label, error, touched, isValid, icon, hint, className, id, ...props }, ref) => {
    const showError = touched && error;
    const showSuccess = touched && isValid && !error;

    return (
      <div className="space-y-2">
        <Label htmlFor={id} className="flex items-center gap-2">
          {icon}
          {label}
        </Label>
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {icon}
            </div>
          )}
          <Input
            ref={ref}
            id={id}
            className={cn(
              icon && "pl-10",
              showError && "border-destructive focus-visible:ring-destructive/50",
              showSuccess && "border-green-500 focus-visible:ring-green-500/50",
              className
            )}
            aria-invalid={showError ? "true" : "false"}
            aria-describedby={showError ? `${id}-error` : hint ? `${id}-hint` : undefined}
            {...props}
          />
          {touched && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {showError && <AlertCircle className="h-4 w-4 text-destructive" />}
              {showSuccess && <CheckCircle className="h-4 w-4 text-green-500" />}
            </div>
          )}
        </div>
        {showError && (
          <p id={`${id}-error`} className="text-xs text-destructive flex items-center gap-1">
            <XCircle className="h-3 w-3" />
            {error}
          </p>
        )}
        {!showError && hint && (
          <p id={`${id}-hint`} className="text-xs text-muted-foreground">
            {hint}
          </p>
        )}
      </div>
    );
  }
);
FormField.displayName = "FormField";

// Password strength indicator component
interface PasswordStrengthIndicatorProps {
  strength: PasswordStrength;
  show: boolean;
}

export function PasswordStrengthIndicator({ strength, show }: PasswordStrengthIndicatorProps) {
  if (!show) return null;

  const strengthColors = {
    weak: "bg-destructive",
    fair: "bg-orange-500",
    good: "bg-yellow-500",
    strong: "bg-green-500",
  };

  const strengthLabels = {
    weak: "Weak",
    fair: "Fair",
    good: "Good",
    strong: "Strong",
  };

  return (
    <div className="space-y-2">
      {/* Strength bar */}
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors duration-200",
              index < strength.score
                ? strengthColors[strength.label]
                : "bg-muted"
            )}
          />
        ))}
      </div>
      
      {/* Strength label */}
      <div className="flex items-center justify-between">
        <span className={cn(
          "text-xs font-medium",
          strength.label === "weak" && "text-destructive",
          strength.label === "fair" && "text-orange-500",
          strength.label === "good" && "text-yellow-600",
          strength.label === "strong" && "text-green-500"
        )}>
          {strengthLabels[strength.label]}
        </span>
      </div>

      {/* Requirement checklist */}
      <div className="grid grid-cols-2 gap-1 text-xs">
        {[
          { key: "minLength", label: "8+ characters" },
          { key: "hasUppercase", label: "Uppercase letter" },
          { key: "hasLowercase", label: "Lowercase letter" },
          { key: "hasNumber", label: "Number" },
        ].map(({ key, label }) => (
          <div
            key={key}
            className={cn(
              "flex items-center gap-1 transition-colors",
              strength.checks[key as keyof typeof strength.checks]
                ? "text-green-600"
                : "text-muted-foreground"
            )}
          >
            {strength.checks[key as keyof typeof strength.checks] ? (
              <CheckCircle className="h-3 w-3" />
            ) : (
              <XCircle className="h-3 w-3" />
            )}
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}
