import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

export function ThinkingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="flex gap-3 justify-start"
    >
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
        <Sparkles className="h-4 w-4 text-primary-foreground" />
      </div>
      <div className="chat-bubble-assistant px-4 py-3 flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Thinking</span>
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60"
              animate={{ opacity: [0.4, 1, 0.4], scale: [0.8, 1, 0.8] }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                delay: i * 0.2,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}
