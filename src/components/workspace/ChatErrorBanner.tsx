import { useState } from "react";
import { AlertTriangle, RefreshCw, Wifi, WifiOff, Clock, CreditCard, X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatError } from "@/hooks/useChat";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface ChatErrorBannerProps {
  error: ChatError | null;
  onRetry?: () => void;
  onDismiss?: () => void;
  isRetrying?: boolean;
}

const ERROR_CONFIG: Record<ChatError["type"], { icon: typeof AlertTriangle; color: string; bgColor: string }> = {
  network: { icon: WifiOff, color: "text-red-600", bgColor: "bg-red-500/10 border-red-500/30" },
  timeout: { icon: Clock, color: "text-amber-600", bgColor: "bg-amber-500/10 border-amber-500/30" },
  rate_limit: { icon: Clock, color: "text-amber-600", bgColor: "bg-amber-500/10 border-amber-500/30" },
  credits: { icon: CreditCard, color: "text-orange-600", bgColor: "bg-orange-500/10 border-orange-500/30" },
  server: { icon: AlertTriangle, color: "text-red-600", bgColor: "bg-red-500/10 border-red-500/30" },
  stream_interrupted: { icon: Wifi, color: "text-amber-600", bgColor: "bg-amber-500/10 border-amber-500/30" },
};

export function ChatErrorBanner({ error, onRetry, onDismiss, isRetrying }: ChatErrorBannerProps) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <AnimatePresence>
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -20, height: 0 }}
          animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, y: -20, height: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
          <div className={cn(
            "mx-4 mb-4 px-4 py-3 rounded-lg border",
            ERROR_CONFIG[error.type].bgColor
          )}>
            <div className="flex items-center gap-3">
              {(() => {
                const Icon = ERROR_CONFIG[error.type].icon;
                return <Icon className={cn("h-5 w-5 flex-shrink-0", ERROR_CONFIG[error.type].color)} />;
              })()}
              
              <div className="flex-1 min-w-0">
                <p className={cn("font-medium text-sm", ERROR_CONFIG[error.type].color)}>
                  {error.message}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {error.details && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDetails(!showDetails)}
                    className={cn("h-8 gap-1.5 text-muted-foreground hover:text-foreground")}
                  >
                    {showDetails ? (
                      <>
                        <ChevronUp className="h-3.5 w-3.5" />
                        Hide
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3.5 w-3.5" />
                        Details
                      </>
                    )}
                  </Button>
                )}
                {error.canRetry && onRetry && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onRetry}
                    disabled={isRetrying}
                    className={cn("h-8 gap-1.5", ERROR_CONFIG[error.type].color)}
                  >
                    <RefreshCw className={cn("h-3.5 w-3.5", isRetrying && "animate-spin")} />
                    {isRetrying ? "Retrying..." : "Retry"}
                  </Button>
                )}
                {onDismiss && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onDismiss}
                    className="h-8 w-8"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            <AnimatePresence>
              {showDetails && error.details && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.15 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 pt-3 border-t border-current/10">
                    <pre className="text-xs text-muted-foreground font-mono whitespace-pre-wrap break-all bg-background/50 rounded p-2 max-h-32 overflow-auto">
                      {error.details}
                    </pre>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
