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
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-600",
    borderColor: "border-emerald-200",
  },
  draft: {
    icon: FileText,
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
    borderColor: "border-blue-200",
  },
  updated: {
    icon: AlertTriangle,
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
    borderColor: "border-amber-200",
  },
  new: {
    icon: Sparkles,
    iconBg: "bg-purple-100",
    iconColor: "text-purple-600",
    borderColor: "border-purple-200",
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
        "w-full mt-4 bg-white border rounded-xl p-4",
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
        <p className="font-semibold text-sm text-slate-900">
          {displayTitle}
        </p>
        <p className="text-sm text-slate-600 mt-0.5">
          {displayDescription}
        </p>
      </div>
    </motion.button>
  );
}
