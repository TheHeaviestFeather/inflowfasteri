import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function Logo({ className, size = "md" }: LogoProps) {
  const sizeClasses = {
    sm: "text-xl",
    md: "text-2xl",
    lg: "text-4xl",
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="relative">
        <div className="gradient-primary rounded-lg p-1.5">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className={cn("text-primary-foreground", {
              "w-5 h-5": size === "sm",
              "w-6 h-6": size === "md",
              "w-8 h-8": size === "lg",
            })}
          >
            <path
              d="M12 2L2 7L12 12L22 7L12 2Z"
              fill="currentColor"
              opacity="0.9"
            />
            <path
              d="M2 17L12 22L22 17"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M2 12L12 17L22 12"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-accent rounded-full animate-pulse-soft" />
      </div>
      <span className={cn("font-bold tracking-tight", sizeClasses[size])}>
        <span className="text-foreground">In</span>
        <span className="gradient-text-accent">Flow</span>
      </span>
    </div>
  );
}
