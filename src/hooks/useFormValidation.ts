import { useState, useCallback, useMemo } from "react";
import { z } from "zod";

// Common validation schemas
export const emailSchema = z
  .string()
  .min(1, "Email is required")
  .email("Please enter a valid email address")
  .max(255, "Email must be less than 255 characters");

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/\d/, "Password must contain a number");

export const nameSchema = z
  .string()
  .min(1, "Name is required")
  .max(100, "Name must be less than 100 characters")
  .regex(/^[a-zA-Z\s'-]+$/, "Name can only contain letters, spaces, hyphens, and apostrophes");

// Field validation state
export interface FieldValidation {
  value: string;
  error: string | null;
  touched: boolean;
  isValid: boolean;
}

// Hook for single field validation
export function useFieldValidation(schema: z.ZodSchema) {
  const [value, setValue] = useState("");
  const [touched, setTouched] = useState(false);
  
  const validation = useMemo(() => {
    if (!touched && !value) {
      return { error: null, isValid: false };
    }
    
    const result = schema.safeParse(value);
    if (result.success) {
      return { error: null, isValid: true };
    }
    
    return {
      error: result.error.errors[0]?.message || "Invalid input",
      isValid: false,
    };
  }, [value, touched, schema]);

  const handleChange = useCallback((newValue: string) => {
    setValue(newValue);
    if (!touched) setTouched(true);
  }, [touched]);

  const handleBlur = useCallback(() => {
    setTouched(true);
  }, []);

  const reset = useCallback(() => {
    setValue("");
    setTouched(false);
  }, []);

  return {
    value,
    setValue: handleChange,
    onBlur: handleBlur,
    error: touched ? validation.error : null,
    isValid: validation.isValid,
    touched,
    reset,
  };
}

// Password strength calculation
export interface PasswordStrength {
  score: number; // 0-4
  label: "weak" | "fair" | "good" | "strong";
  checks: {
    minLength: boolean;
    hasUppercase: boolean;
    hasLowercase: boolean;
    hasNumber: boolean;
    hasSpecial: boolean;
  };
}

export function calculatePasswordStrength(password: string): PasswordStrength {
  const checks = {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(password),
  };

  const score = Object.values(checks).filter(Boolean).length;
  
  let label: PasswordStrength["label"];
  if (score <= 1) label = "weak";
  else if (score <= 2) label = "fair";
  else if (score <= 3) label = "good";
  else label = "strong";

  return { score, label, checks };
}

// Hook for password with strength indicator
export function usePasswordValidation() {
  const [value, setValue] = useState("");
  const [touched, setTouched] = useState(false);

  const strength = useMemo(() => calculatePasswordStrength(value), [value]);
  
  const validation = useMemo(() => {
    const result = passwordSchema.safeParse(value);
    if (result.success) {
      return { error: null, isValid: true };
    }
    return {
      error: result.error.errors[0]?.message || "Invalid password",
      isValid: false,
    };
  }, [value]);

  const handleChange = useCallback((newValue: string) => {
    setValue(newValue);
    if (!touched) setTouched(true);
  }, [touched]);

  const handleBlur = useCallback(() => {
    setTouched(true);
  }, []);

  const reset = useCallback(() => {
    setValue("");
    setTouched(false);
  }, []);

  return {
    value,
    setValue: handleChange,
    onBlur: handleBlur,
    error: touched ? validation.error : null,
    isValid: validation.isValid,
    touched,
    strength,
    reset,
  };
}
