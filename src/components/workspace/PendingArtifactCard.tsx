import { ArtifactType, ARTIFACT_LABELS } from "@/types/database";
import { motion } from "framer-motion";

interface PendingArtifactCardProps {
  artifactType: ArtifactType;
  status: "pending" | "revision_required";
}

export function PendingArtifactCard({ artifactType, status }: PendingArtifactCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-card border-2 border-dashed border-border rounded-xl p-5 opacity-60 mt-4"
    >
      {status === "revision_required" && (
        <span className="inline-block bg-destructive/10 text-destructive text-xs font-bold px-3 py-1 rounded-md mb-3">
          REVISION REQUIRED
        </span>
      )}
      {status === "pending" && (
        <span className="inline-block bg-muted text-muted-foreground text-xs font-bold px-3 py-1 rounded-md mb-3">
          PENDING
        </span>
      )}
      <h3 className="text-base font-bold text-foreground">
        {ARTIFACT_LABELS[artifactType]}
      </h3>
    </motion.div>
  );
}
