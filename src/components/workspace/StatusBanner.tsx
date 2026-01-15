import { cn } from "@/lib/utils";
import { Check, AlertTriangle, Clock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

type BannerStatus = "approved" | "stale" | "draft";

interface StatusBannerProps {
  status: BannerStatus;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

const BANNER_CONFIG: Record<BannerStatus, {
  icon: typeof Check;
  iconBg: string;
  iconColor: string;
  bgColor: string;
  borderColor: string;
  defaultTitle: string;
  defaultDescription: string;
}> = {
  approved: {
    icon: Check,
    iconBg: "bg-success",
    iconColor: "text-success-foreground",
    bgColor: "bg-success/10",
    borderColor: "border-success/30",
    defaultTitle: "Approval Confirmed",
    defaultDescription: "This deliverable has passed all quality gates.",
  },
  stale: {
    icon: AlertTriangle,
    iconBg: "bg-warning",
    iconColor: "text-warning-foreground",
    bgColor: "bg-warning/10",
    borderColor: "border-warning/30",
    defaultTitle: "Revision Required",
    defaultDescription: "This deliverable needs to be reviewed due to upstream changes.",
  },
  draft: {
    icon: Clock,
    iconBg: "bg-primary",
    iconColor: "text-primary-foreground",
    bgColor: "bg-primary/10",
    borderColor: "border-primary/30",
    defaultTitle: "Draft in Progress",
    defaultDescription: "This deliverable is being generated.",
  },
};

export function StatusBanner({ 
  status, 
  title, 
  description, 
  actionLabel,
  onAction 
}: StatusBannerProps) {
  const config = BANNER_CONFIG[status];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "rounded-xl p-5 border mb-6 flex items-center gap-4",
        config.bgColor,
        config.borderColor
      )}
    >
      <div className={cn(
        "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center",
        config.iconBg
      )}>
        <Icon className={cn("h-5 w-5", config.iconColor)} />
      </div>
      
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-foreground">
          {title || config.defaultTitle}
        </p>
        <p className="text-sm text-muted-foreground mt-0.5">
          {description || config.defaultDescription}
        </p>
      </div>

      {actionLabel && onAction && (
        <Button
          onClick={onAction}
          className="flex-shrink-0 px-6 py-2.5 rounded-lg gap-2 bg-primary hover:bg-primary/90"
        >
          {actionLabel}
          <ArrowRight className="h-4 w-4" />
        </Button>
      )}
    </motion.div>
  );
}
