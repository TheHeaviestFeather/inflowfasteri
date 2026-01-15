import { cn } from "@/lib/utils";
import { Check, FileText, AlertTriangle, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { ArtifactType, ARTIFACT_LABELS } from "@/types/database";

type NotificationType = "approved" | "draft" | "updated" | "new";

interface NotificationCardProps {
  type: NotificationType;
  artifactType: ArtifactType;
  title?: string;
  description?: string;
  onClick?: () => void;
}

const NOTIFICATION_CONFIG: Record<NotificationType, {
  icon: typeof Check;
  iconBg: string;
  iconColor: string;
  borderColor: string;
}> = {
  approved: {
    icon: Check,
    iconBg: "bg-success/15",
    iconColor: "text-success",
    borderColor: "border-success/30",
  },
  draft: {
    icon: FileText,
    iconBg: "bg-primary/15",
    iconColor: "text-primary",
    borderColor: "border-primary/30",
  },
  updated: {
    icon: AlertTriangle,
    iconBg: "bg-warning/15",
    iconColor: "text-warning",
    borderColor: "border-warning/30",
  },
  new: {
    icon: Sparkles,
    iconBg: "bg-accent/15",
    iconColor: "text-accent",
    borderColor: "border-accent/30",
  },
};

export function NotificationCard({ 
  type, 
  artifactType, 
  title, 
  description,
  onClick 
}: NotificationCardProps) {
  const config = NOTIFICATION_CONFIG[type];
  const Icon = config.icon;

  const displayTitle = title || (type === "approved" 
    ? `${ARTIFACT_LABELS[artifactType]} Approved` 
    : `${ARTIFACT_LABELS[artifactType]} Ready`);

  const displayDescription = description || (type === "approved"
    ? "This deliverable has been approved and locked."
    : "Click to view the deliverable in the artifact panel.");

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2, delay: 0.1 }}
      onClick={onClick}
      className={cn(
        "w-full mt-4 bg-card border rounded-xl p-4",
        "shadow-md hover:shadow-lg transition-shadow duration-200",
        "flex items-start gap-3 text-left",
        config.borderColor
      )}
    >
      <div className={cn(
        "flex-shrink-0 w-11 h-11 rounded-lg flex items-center justify-center",
        config.iconBg
      )}>
        <Icon className={cn("h-5 w-5", config.iconColor)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-foreground">
          {displayTitle}
        </p>
        <p className="text-sm text-muted-foreground mt-0.5">
          {displayDescription}
        </p>
      </div>
    </motion.button>
  );
}
