import { useState } from "react";
import { cn } from "@/lib/utils";
import { 
  Check, 
  Clock, 
  AlertTriangle, 
  Copy, 
  Share2, 
  Pencil,
  MessageSquare,
  MoreHorizontal,
  Type
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { formatArtifactContent } from "@/utils/artifactFormatter";
import { motion } from "framer-motion";
import { ArtifactType } from "@/types/database";

type TextSize = "small" | "medium" | "large";

const TEXT_SIZE_CONFIG: Record<TextSize, { label: string; fontSize: string; lineHeight: string }> = {
  small: { label: "Small", fontSize: "0.875rem", lineHeight: "1.5" },
  medium: { label: "Medium", fontSize: "1rem", lineHeight: "1.625" },
  large: { label: "Large", fontSize: "1.125rem", lineHeight: "1.75" },
};

type ArtifactStatus = "approved" | "stale" | "draft";

interface ArtifactCardNewProps {
  title: string;
  status: ArtifactStatus;
  version: number;
  modifiedAgo: string;
  content: string;
  artifactType: ArtifactType;
  commentCount?: number;
  feedback?: string;
  onEdit?: () => void;
  onCopy?: () => void;
  onShare?: () => void;
}

const STATUS_CONFIG: Record<ArtifactStatus, {
  icon: typeof Check;
  label: string;
  badgeClass: string;
}> = {
  approved: {
    icon: Check,
    label: "Approved",
    badgeClass: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
  stale: {
    icon: AlertTriangle,
    label: "Needs Review",
    badgeClass: "bg-amber-100 text-amber-700 border-amber-200",
  },
  draft: {
    icon: Clock,
    label: "Draft",
    badgeClass: "bg-blue-100 text-blue-700 border-blue-200",
  },
};

export function ArtifactCardNew({
  title,
  status,
  version,
  modifiedAgo,
  content,
  artifactType,
  commentCount = 0,
  feedback,
  onEdit,
  onCopy,
  onShare,
}: ArtifactCardNewProps) {
  const [textSize, setTextSize] = useState<TextSize>("medium");
  const statusConfig = STATUS_CONFIG[status];
  const StatusIcon = statusConfig.icon;
  const formattedContent = formatArtifactContent(content, artifactType);
  const textSizeConfig = TEXT_SIZE_CONFIG[textSize];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden"
    >
      {/* Header */}
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-slate-900 truncate">
              {title}
            </h3>
            <div className="flex items-center gap-3 mt-2 text-sm text-slate-500">
              <span>Version {version}</span>
              <span>•</span>
              <span>Modified {modifiedAgo}</span>
            </div>
          </div>
          <Badge 
            variant="outline" 
            className={cn("gap-1.5 px-3 py-1 rounded-md font-medium", statusConfig.badgeClass)}
          >
            <StatusIcon className="h-3.5 w-3.5" />
            {statusConfig.label}
          </Badge>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onEdit}
            className="h-8 gap-1.5 text-slate-600 hover:text-slate-900"
          >
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCopy}
            className="h-8 gap-1.5 text-slate-600 hover:text-slate-900"
          >
            <Copy className="h-4 w-4" />
            Copy
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onShare}
            className="h-8 gap-1.5 text-slate-600 hover:text-slate-900"
          >
            <Share2 className="h-4 w-4" />
            Share
          </Button>
          
          {/* Text Size Control */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 text-slate-600 hover:text-slate-900"
              >
                <Type className="h-4 w-4" />
                {textSizeConfig.label}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="bg-white z-50">
              {(Object.keys(TEXT_SIZE_CONFIG) as TextSize[]).map((size) => (
                <DropdownMenuItem
                  key={size}
                  onClick={() => setTextSize(size)}
                  className={cn(textSize === size && "bg-slate-100 font-medium")}
                >
                  {TEXT_SIZE_CONFIG[size].label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-white z-50">
            <DropdownMenuItem>Export as Markdown</DropdownMenuItem>
            <DropdownMenuItem>View History</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Body */}
      <ScrollArea className="h-[400px]">
        <div className="p-8">
          <div 
            className={cn(
              "prose prose-slate max-w-none",
              "prose-headings:font-bold prose-headings:text-slate-900",
              "prose-strong:text-slate-900",
              "[&>*:first-child]:mt-0"
            )}
            style={{ 
              fontSize: textSizeConfig.fontSize, 
              lineHeight: textSizeConfig.lineHeight 
            }}
          >
            <style>{`
              .artifact-prose p { margin-top: 0.75rem; margin-bottom: 0.75rem; line-height: 1.5rem; color: #334155; }
              .artifact-prose ul, .artifact-prose ol { margin-top: 0.75rem; margin-bottom: 0.75rem; }
              .artifact-prose li { margin-top: 0.25rem; margin-bottom: 0.25rem; line-height: 1.5rem; color: #334155; }
              .artifact-prose h2 { margin-top: 1.25rem; margin-bottom: 0.75rem; }
              .artifact-prose h3 { margin-top: 1rem; margin-bottom: 0.5rem; }
              .artifact-prose .table-wrapper { display: block; max-width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; touch-action: pan-x; margin: 1rem 0; border-radius: 0.5rem; }
              .artifact-prose table { border-collapse: collapse; width: max-content; min-width: 100%; font-size: 0.875rem; }
              .artifact-prose thead { background-color: #f1f5f9; }
              .artifact-prose th { border: 1px solid #e2e8f0; padding: 0.5rem 0.75rem; text-align: left; font-weight: 600; color: #1e293b; white-space: nowrap; }
              .artifact-prose td { border: 1px solid #e2e8f0; padding: 0.5rem 0.75rem; color: #334155; }
              .artifact-prose tr:nth-child(even) { background-color: #f8fafc; }
              .artifact-prose blockquote { border-left: 3px solid #3b82f6; background: #eff6ff; padding: 0.75rem 1rem; margin: 1rem 0; font-style: italic; }
              .artifact-prose del { text-decoration: line-through; color: #94a3b8; }
              .artifact-prose ul.contains-task-list { list-style: none; padding-left: 0; }
              .artifact-prose li.task-list-item { display: flex; align-items: flex-start; gap: 0.5rem; }
              .artifact-prose li.task-list-item input[type="checkbox"] { margin-top: 0.25rem; width: 1rem; height: 1rem; accent-color: #3b82f6; cursor: pointer; }
              .artifact-prose li.task-list-item input[type="checkbox"]:checked + * { color: #94a3b8; text-decoration: line-through; }
            `}</style>
            <div className="artifact-prose">
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[[rehypeSanitize, {
                  ...defaultSchema,
                  tagNames: [...(defaultSchema.tagNames || []), 'input'],
                  attributes: {
                    ...defaultSchema.attributes,
                    input: ['type', 'checked', 'disabled', 'className'],
                    li: [...(defaultSchema.attributes?.li || []), 'className'],
                    ul: [...(defaultSchema.attributes?.ul || []), 'className'],
                  },
                }]]}
                components={{
                  table: ({ children }) => (
                    <div className="table-wrapper">
                      <table>{children}</table>
                    </div>
                  ),
                }}
              >
                {formattedContent}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Feedback Section */}
      {(feedback || commentCount > 0) && (
        <div className="p-6 border-t border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2 text-sm text-slate-600 mb-3">
            <MessageSquare className="h-4 w-4" />
            <span className="font-medium">Feedback</span>
            {commentCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {commentCount}
              </Badge>
            )}
          </div>
          {feedback && (
            <p className="text-sm text-slate-700 bg-white p-3 rounded-lg border border-slate-200">
              {feedback}
            </p>
          )}
        </div>
      )}
    </motion.div>
  );
}