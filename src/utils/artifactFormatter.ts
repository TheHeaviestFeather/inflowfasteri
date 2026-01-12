/**
 * Dedicated artifact content formatter
 * Handles cleaning and normalizing artifact content for display
 *
 * Uses a composable transformation pipeline for clarity and reusability.
 */

import { ArtifactType } from "@/types/database";

// =============================================================================
// Types
// =============================================================================

type TextTransform = (content: string) => string;

// =============================================================================
// Composable Transformations
// Each transformation is a single, focused operation that can be reused.
// =============================================================================

const transforms = {
  /**
   * Convert ALL CAPS lines to ## headings
   * e.g., "EXECUTIVE SUMMARY" → "## EXECUTIVE SUMMARY"
   */
  allCapsToHeading: (content: string): string =>
    content.replace(/^([A-Z][A-Z\s&]+):?\s*$/gm, "\n## $1\n"),

  /**
   * Convert **ALL CAPS** lines to ## headings
   * e.g., "**RECOMMENDATIONS**" → "## RECOMMENDATIONS"
   */
  boldAllCapsToHeading: (content: string): string =>
    content.replace(/^\*\*([A-Z][A-Z\s&]+)\*\*:?\s*$/gm, "\n## $1\n"),

  /**
   * Remove bold formatting from inside heading markers
   * e.g., "### **Title**" → "### Title"
   */
  stripBoldFromHeadings: (content: string): string =>
    content
      .replace(/^###\s*\*\*(.+?)\*\*\s*$/gm, "### $1")
      .replace(/^##\s*\*\*(.+?)\*\*\s*$/gm, "## $1"),

  /**
   * Convert standalone **Label:** Value to list items
   * e.g., "**Name:** John" → "- **Name:** John"
   * Does not affect numbered lists like "1. **Label:** Value"
   */
  boldLabelToListItem: (content: string): string =>
    content.replace(/^(?!\d+\.)\s*\*\*([^*:]+):\*\*\s+(.+)$/gm, "- **$1:** $2"),

  /**
   * Convert unicode bullet characters to standard dashes
   * e.g., "• Item" → "- Item"
   */
  normalizeBullets: (content: string): string =>
    content.replace(/^[•◦▪▸►]\s*/gm, "- "),

  /**
   * Convert nested unicode bullets while preserving indentation
   */
  normalizeNestedBullets: (content: string): string =>
    content.replace(/^(\s+)[•◦▪▸►]\s*/gm, "$1- "),

  /**
   * Convert checklist unicode characters to dashes
   * e.g., "☐ Task" → "- Task"
   */
  normalizeChecklists: (content: string): string =>
    content.replace(/^[☐☑✓✗✔✘]\s*/gm, "- "),

  /**
   * Ensure ## headings have blank lines before and after
   */
  spaceAroundH2: (content: string): string =>
    content.replace(/\n(##[^\n]+)\n(?!\n)/g, "\n\n$1\n\n"),

  /**
   * Ensure ### headings have blank lines before and after
   */
  spaceAroundH3: (content: string): string =>
    content.replace(/\n(###[^\n]+)\n(?!\n)/g, "\n\n$1\n\n"),

  /**
   * Convert bulleted quotes to blockquotes
   * e.g., '- "Quote text"' → '> "Quote text"'
   */
  bulletedQuoteToBlockquote: (content: string): string =>
    content.replace(/^\s*[-•]\s*"([^"]+)"\s*$/gm, '\n> "$1"\n'),

  /**
   * Convert standalone quotes to blockquotes
   * e.g., '"Quote text"' at line start → '> "Quote text"'
   */
  standaloneQuoteToBlockquote: (content: string): string =>
    content.replace(/^\s*"([^"]+)"\s*$/gm, '\n> "$1"\n'),

  /**
   * Convert attributed quotes to blockquotes with attribution
   * e.g., '"Quote" - Author' → '> "Quote"\n> — Author'
   */
  attributedQuoteToBlockquote: (content: string): string =>
    content.replace(/^\s*[-•]?\s*"([^"]+)"\s*[-—–]\s*(.+)$/gm, '\n> "$1"\n> — $2\n'),

  /**
   * Join **Label:** that's split across two lines
   * e.g., "**Name:**\n  John" → "**Name:** John"
   */
  joinSplitLabelValue: (content: string): string =>
    content.replace(/^\*\*([^*:]+):\*\*\s*\n\s*([^\n-#*])/gm, "**$1:** $2"),
} as const;

// =============================================================================
// Code Fence Handling
// Separate from simple transforms due to complex stateful logic
// =============================================================================

/**
 * Handle fenced code blocks - either remove or contain them properly
 */
function handleCodeFences(content: string): string {
  let result = content;

  // Remove ```json blocks containing JSON data (internal data leakage)
  result = result.replace(/```json\s*\n?\{[\s\S]*?\}\s*\n?```/gi, "");

  // Remove empty or whitespace-only code blocks
  result = result.replace(/```\w*\s*\n?\s*\n?```/gi, "");

  // Handle unclosed code fences (truncation issue)
  result = result.replace(/```(\w*)\n([\s\S]*?)(?=\n##|\n\*\*[A-Z]|$)/gi, (match, _lang, codeContent) => {
    if (!match.includes("```", 3)) {
      return codeContent.trim();
    }
    return match;
  });

  // Extract prose content that was incorrectly marked as code
  result = result.replace(/```\s*\n((?:(?!```)[^\n]*\n)*?)```/g, (match, innerContent) => {
    const isProse = /[.!?]\s|^\s*[-*]\s|^\s*#{1,4}\s/m.test(innerContent);
    const isCode = /[{}\[\];]|function\s|const\s|let\s|var\s|=>/m.test(innerContent);

    if (isProse && !isCode) {
      return "\n" + innerContent.trim() + "\n";
    }
    return match;
  });

  return result;
}

// =============================================================================
// Pipeline Utilities
// =============================================================================

/**
 * Apply a sequence of transformations to content
 */
function applyTransforms(content: string, transformList: TextTransform[]): string {
  return transformList.reduce((result, transform) => transform(result), content);
}

// =============================================================================
// Universal Cleanup (applied to all content)
// =============================================================================

const universalCleanupTransforms: TextTransform[] = [
  // Remove trailing status:draft]] or similar database artifacts
  (c) => c.replace(/\s*status:\s*\w+\]*\]*\s*$/gi, ""),
  (c) => c.replace(/\[\[.*?status:\s*\w+.*?\]\]/gi, ""),
  // Remove leaked database id references
  (c) => c.replace(/\s*(was\s+)?id:[a-f0-9-]{36}\]*\]*\s*$/gi, ""),
  (c) => c.replace(/\s*id:[a-f0-9-]{36}\s*/gi, ""),
  // Remove STATE: { ... } blocks
  (c) => c.replace(/STATE:\s*\{[\s\S]*?\}\s*/gi, ""),
  // Remove artifact_type markers
  (c) => c.replace(/artifact_type:\s*["']?\w+["']?\s*/gi, ""),
  // Remove version/timestamp markers
  (c) => c.replace(/\b(version|updated_at|created_at):\s*["']?[\w\d-]+["']?\s*/gi, ""),
];

function universalCleanup(content: string): string {
  return applyTransforms(content, universalCleanupTransforms);
}

// =============================================================================
// Final Cleanup (applied after type-specific formatting)
// =============================================================================

function finalCleanup(content: string): string {
  let cleaned = content;

  // Remove excessive blank lines (more than 2)
  cleaned = cleaned.replace(/\n{4,}/g, "\n\n\n");

  // Remove trailing whitespace from lines
  cleaned = cleaned.replace(/[ \t]+$/gm, "");

  // Trim start and end
  cleaned = cleaned.trim();

  // Remove orphaned internal JSON objects
  cleaned = cleaned.replace(/^\s*\{\s*"[\s\S]{20,}?\}\s*$/gm, (match) => {
    if (/"(id|version|status|artifact_type|content)":/i.test(match)) {
      return "";
    }
    return match;
  });

  return cleaned;
}

// =============================================================================
// Type-Specific Formatter Pipelines
// Each formatter is now a clear list of transformations to apply.
// =============================================================================

/**
 * Discovery Report: complex nested structures, stakeholder quotes, bullets
 */
function formatDiscoveryReport(content: string): string {
  return applyTransforms(handleCodeFences(content), [
    transforms.allCapsToHeading,
    transforms.boldAllCapsToHeading,
    transforms.stripBoldFromHeadings,
    transforms.boldLabelToListItem,
    transforms.bulletedQuoteToBlockquote,
    transforms.standaloneQuoteToBlockquote,
    transforms.attributedQuoteToBlockquote,
    transforms.normalizeBullets,
    transforms.normalizeNestedBullets,
    transforms.joinSplitLabelValue,
    transforms.spaceAroundH2,
    transforms.spaceAroundH3,
  ]);
}

/**
 * Learner Persona: similar to discovery report, lighter treatment
 */
function formatPersona(content: string): string {
  return applyTransforms(handleCodeFences(content), [
    transforms.allCapsToHeading,
    transforms.boldAllCapsToHeading,
    transforms.boldLabelToListItem,
  ]);
}

/**
 * Performance Report: pipe-delimited tables, indented sections
 */
function formatPerformanceReport(content: string): string {
  let formatted = handleCodeFences(content);

  // Type-specific: pipe-delimited recommendation rows (4 fields)
  formatted = formatted.replace(
    /^\s*-?\s*\*\*Category:\*\*\s*([^|]+)\s*\|\s*\*\*Description:\*\*\s*([^|]+)\s*\|\s*\*\*Impact On Gap:\*\*\s*([^|]+)\s*\|\s*\*\*Responsibility:\*\*\s*(.+)$/gm,
    (_, category, description, impact, responsibility) =>
      `#### ${category.trim()}\n- **Description:** ${description.trim()}\n- **Impact:** ${impact.trim()}\n- **Responsibility:** ${responsibility.trim()}`
  );

  // Type-specific: pipe-delimited rows (3 fields)
  formatted = formatted.replace(
    /^\s*-?\s*\*\*([^:*]+):\*\*\s*([^|]+)\s*\|\s*\*\*([^:*]+):\*\*\s*([^|]+)\s*\|\s*\*\*([^:*]+):\*\*\s*(.+)$/gm,
    (_, label1, val1, label2, val2, label3, val3) =>
      `- **${label1.trim()}:** ${val1.trim()}\n  - **${label2.trim()}:** ${val2.trim()}\n  - **${label3.trim()}:** ${val3.trim()}`
  );

  // Type-specific: special top-level labels
  formatted = formatted.replace(/^\*\*Report Title:\*\*\s+(.+)$/gm, "# $1");
  formatted = formatted.replace(/^\*\*Executive Summary:\*\*\s+(.+)$/gm, "## Executive Summary\n$1");
  formatted = formatted.replace(/^\*\*Recommendations:\*\*\s*$/gm, "## Recommendations");
  formatted = formatted.replace(/^\*\*([^*:]+):\*\*\s*$/gm, "## $1");

  // Type-specific: normalize ### to ##
  formatted = formatted.replace(/^###\s+(.+)$/gm, "## $1");

  // Type-specific: indented sections
  formatted = formatted.replace(/^  \*\*([^*:]+):\*\*\s*$/gm, "### $1");
  formatted = formatted.replace(/^  \*\*([^*:]+):\*\*\s+(.+)$/gm, "- **$1:** $2");
  formatted = formatted.replace(/^    -\s*\*\*([^*:]+):\*\*\s+(.+)$/gm, "  - **$1:** $2");
  formatted = formatted.replace(/^    \*\*([^*:]+):\*\*\s+(.+)$/gm, "  - **$1:** $2");
  formatted = formatted.replace(/^    -\s+(.+)$/gm, "  - $1");

  // Apply common transforms
  return applyTransforms(formatted, [
    transforms.boldLabelToListItem,
    transforms.normalizeBullets,
  ]);
}

/**
 * Final Audit: executive summary, numbered sections, checklists
 */
function formatFinalAudit(content: string): string {
  let formatted = handleCodeFences(content);

  // Type-specific: normalize numbered section headings
  formatted = formatted.replace(/^##\s*(\d+\.)\s*(.+)$/gm, "## $1 $2");

  return applyTransforms(formatted, [
    transforms.allCapsToHeading,
    transforms.boldAllCapsToHeading,
    transforms.boldLabelToListItem,
    transforms.normalizeChecklists,
    transforms.normalizeBullets,
    transforms.spaceAroundH2,
  ]);
}

/**
 * Generic artifacts: light-touch cleanup only
 */
function formatGenericArtifact(content: string): string {
  return applyTransforms(handleCodeFences(content), [
    transforms.normalizeBullets,
  ]);
}

// =============================================================================
// Main Export
// =============================================================================

/**
 * Format artifact content based on type.
 * Applies universal cleanup, type-specific formatting, then final cleanup.
 */
export function formatArtifactContent(content: string, artifactType: ArtifactType): string {
  const cleaned = universalCleanup(content);

  const formatters: Record<string, (c: string) => string> = {
    discovery_report: formatDiscoveryReport,
    learner_persona: formatPersona,
    performance_recommendation_report: formatPerformanceReport,
    final_audit: formatFinalAudit,
  };

  const formatter = formatters[artifactType] ?? formatGenericArtifact;
  const formatted = formatter(cleaned);

  return finalCleanup(formatted);
}
