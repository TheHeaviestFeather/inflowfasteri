/**
 * Dedicated artifact content formatter
 * Uses a strategy pattern for type-specific formatting
 */

import { ArtifactType } from "@/types/database";

/**
 * Formatter strategy type - takes content and returns formatted content
 */
type FormatterStrategy = (content: string) => string;

/**
 * Registry of formatters by artifact type
 * To add a new formatter, simply add an entry to this map
 */
const FORMATTERS: Partial<Record<ArtifactType, FormatterStrategy>> = {
  discovery_report: formatDiscoveryReport,
  learner_persona: formatPersona,
  performance_recommendation_report: formatPerformanceReport,
  final_audit: formatFinalAudit,
};

/**
 * Extract actual content if the input is a JSON response structure
 * Handles cases where the AI mistakenly put the full JSON response in the content field
 */
function extractContentFromJson(content: string): string {
  const trimmed = content.trim();

  // Check if content looks like a JSON response structure
  if (trimmed.startsWith('{') && trimmed.includes('"message"')) {
    try {
      const parsed = JSON.parse(trimmed);

      // If this is a full AI response structure, extract the artifact content
      if (parsed.artifact?.content && typeof parsed.artifact.content === 'string') {
        return parsed.artifact.content;
      }

      // If there's just a content field at the top level
      if (parsed.content && typeof parsed.content === 'string') {
        return parsed.content;
      }
    } catch {
      // Not valid JSON, continue with original content
    }
  }

  // Handle code-fenced JSON
  let cleaned = trimmed;
  const codeBlockMatch = cleaned.match(/^```(?:json)?\s*([\s\S]*?)```$/);
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim();
    if (cleaned.startsWith('{') && cleaned.includes('"message"')) {
      try {
        const parsed = JSON.parse(cleaned);
        if (parsed.artifact?.content) {
          return parsed.artifact.content;
        }
        if (parsed.content) {
          return parsed.content;
        }
      } catch {
        // Not valid JSON
      }
    }
  }

  return content;
}

/**
 * Format artifact content based on type
 * Discovery Reports get special handling for their complex structure
 */
export function formatArtifactContent(content: string, artifactType: ArtifactType): string {
  // First, check if content is actually a JSON structure and extract the real content
  const extractedContent = extractContentFromJson(content);

  // Apply universal cleanup
  const cleaned = universalCleanup(extractedContent);

  // Get type-specific formatter or use generic formatter
  const formatter = FORMATTERS[artifactType] ?? formatGenericArtifact;
  const formatted = formatter(cleaned);

  return finalCleanup(formatted);
}

/**
 * Universal cleanup applied to all artifact types
 * Removes database artifacts, status metadata, and obvious junk
 */
function universalCleanup(content: string): string {
  return content
    // Remove trailing status:draft]] or similar database query artifacts
    .replace(/\s*status:\s*\w+\]*\]*\s*$/gi, "")
    .replace(/\[\[.*?status:\s*\w+.*?\]\]/gi, "")
    // Remove leaked database id references (e.g., "was id:uuid]]" or "id:uuid]]")
    .replace(/\s*(was\s+)?id:[a-f0-9-]{36}\]*\]*\s*$/gi, "")
    .replace(/\s*id:[a-f0-9-]{36}\s*/gi, "")
    // STATE: { ... } blocks (internal state leakage)
    .replace(/STATE:\s*\{[\s\S]*?\}\s*/gi, "")
    // Remove artifact_type markers that leaked through
    .replace(/artifact_type:\s*["']?\w+["']?\s*/gi, "")
    // Remove version/id markers
    .replace(/\b(version|updated_at|created_at):\s*["']?[\w\d-]+["']?\s*/gi, "");
}

/**
 * Handle fenced code blocks - either remove or contain them properly
 */
function handleCodeFences(content: string): string {
  return content
    // Pattern 1: ```json blocks with actual JSON data (remove entirely - internal data)
    .replace(/```json\s*\n?\{[\s\S]*?\}\s*\n?```/gi, "")
    // Pattern 2: Empty or whitespace-only code blocks
    .replace(/```\w*\s*\n?\s*\n?```/gi, "")
    // Pattern 3: Unclosed code fences (common truncation issue)
    .replace(/```(\w*)\n([\s\S]*?)(?=\n##|\n\*\*[A-Z]|$)/gi, (match, _lang, codeContent) => {
      if (!match.includes("```", 3)) {
        return codeContent.trim();
      }
      return match;
    })
    // Pattern 4: Properly closed code blocks that contain prose (mismarked as code)
    .replace(/```\s*\n((?:(?!```)[^\n]*\n)*?)```/g, (match, innerContent) => {
      const isProse = /[.!?]\s|^\s*[-*]\s|^\s*#{1,4}\s/m.test(innerContent);
      const isCode = /[{}\[\];]|function\s|const\s|let\s|var\s|=>/m.test(innerContent);
      if (isProse && !isCode) {
        return "\n" + innerContent.trim() + "\n";
      }
      return match;
    });
}

/**
 * Shared formatting helpers used by multiple formatters
 */
const commonFormatters = {
  /** Normalize ALL CAPS headings to ## headings */
  normalizeAllCapsHeadings: (content: string) =>
    content
      .replace(/^([A-Z][A-Z\s&]+):?\s*$/gm, "\n## $1\n")
      .replace(/^\*\*([A-Z][A-Z\s&]+)\*\*:?\s*$/gm, "\n## $1\n"),

  /** Normalize bold section headings */
  normalizeSectionHeadings: (content: string) =>
    content
      .replace(/^###\s*\*\*(.+?)\*\*\s*$/gm, "### $1")
      .replace(/^##\s*\*\*(.+?)\*\*\s*$/gm, "## $1"),

  /** Convert **Label:** Value to list items (when not numbered) */
  convertLabelValueToList: (content: string) =>
    content.replace(/^(?!\d+\.)\s*\*\*([^*:]+):\*\*\s+(.+)$/gm, "- **$1:** $2"),

  /** Normalize bullet point characters to standard dash */
  normalizeBullets: (content: string) =>
    content.replace(/^[•◦▪▸►]\s*/gm, "- ").replace(/^(\s+)[•◦▪▸►]\s*/gm, "$1- "),

  /** Ensure proper spacing around headings */
  ensureHeadingSpacing: (content: string) =>
    content
      .replace(/\n(##[^\n]+)\n(?!\n)/g, "\n\n$1\n\n")
      .replace(/\n(###[^\n]+)\n(?!\n)/g, "\n\n$1\n\n"),
};

/**
 * Format Discovery Report specifically
 * These have complex nested structures with stakeholder quotes, bullets, etc.
 */
function formatDiscoveryReport(content: string): string {
  let formatted = handleCodeFences(content);

  formatted = commonFormatters.normalizeAllCapsHeadings(formatted);
  formatted = commonFormatters.normalizeSectionHeadings(formatted);
  formatted = commonFormatters.convertLabelValueToList(formatted);

  // Handle stakeholder quotes - convert to blockquotes
  formatted = formatted
    .replace(/^\s*[-•]\s*"([^"]+)"\s*$/gm, '\n> "$1"\n')
    .replace(/^\s*"([^"]+)"\s*$/gm, '\n> "$1"\n')
    // Handle attributed quotes: "Quote" - Attribution or "Quote" — Attribution
    .replace(/^\s*[-•]?\s*"([^"]+)"\s*[-—–]\s*(.+)$/gm, '\n> "$1"\n> — $2\n');

  formatted = commonFormatters.normalizeBullets(formatted);

  // Clean up key-value pairs that should be on same line
  formatted = formatted.replace(/^\*\*([^*:]+):\*\*\s*\n\s*([^\n-#*])/gm, "**$1:** $2");

  formatted = commonFormatters.ensureHeadingSpacing(formatted);

  return formatted;
}

/**
 * Format Learner Persona specifically
 */
function formatPersona(content: string): string {
  let formatted = handleCodeFences(content);

  formatted = commonFormatters.normalizeAllCapsHeadings(formatted);
  formatted = commonFormatters.convertLabelValueToList(formatted);

  return formatted;
}

/**
 * Format Performance Improvement Recommendation Report
 * Has complex structure with key-value pairs, indented sections, and pipe-delimited tables
 */
function formatPerformanceReport(content: string): string {
  let formatted = handleCodeFences(content);

  // Handle pipe-delimited recommendation rows - convert to structured list items
  formatted = formatted.replace(
    /^\s*-?\s*\*\*Category:\*\*\s*([^|]+)\s*\|\s*\*\*Description:\*\*\s*([^|]+)\s*\|\s*\*\*Impact On Gap:\*\*\s*([^|]+)\s*\|\s*\*\*Responsibility:\*\*\s*(.+)$/gm,
    (_, category, description, impact, responsibility) =>
      `#### ${category.trim()}\n- **Description:** ${description.trim()}\n- **Impact:** ${impact.trim()}\n- **Responsibility:** ${responsibility.trim()}`
  );

  // Handle simpler pipe-delimited patterns (3 fields)
  formatted = formatted.replace(
    /^\s*-?\s*\*\*([^:*]+):\*\*\s*([^|]+)\s*\|\s*\*\*([^:*]+):\*\*\s*([^|]+)\s*\|\s*\*\*([^:*]+):\*\*\s*(.+)$/gm,
    (_, label1, val1, label2, val2, label3, val3) =>
      `- **${label1.trim()}:** ${val1.trim()}\n  - **${label2.trim()}:** ${val2.trim()}\n  - **${label3.trim()}:** ${val3.trim()}`
  );

  // Handle top-level **Label:** Value headers
  formatted = formatted
    .replace(/^\*\*Report Title:\*\*\s+(.+)$/gm, "# $1")
    .replace(/^\*\*Executive Summary:\*\*\s+(.+)$/gm, "## Executive Summary\n$1")
    .replace(/^\*\*Recommendations:\*\*\s*$/gm, "## Recommendations")
    .replace(/^\*\*([^*:]+):\*\*\s*$/gm, "## $1");

  // Normalize headers (### to ##)
  formatted = formatted.replace(/^###\s+(.+)$/gm, "## $1");

  // Handle indented **Label:** Value pairs
  formatted = formatted
    .replace(/^  \*\*([^*:]+):\*\*\s*$/gm, "### $1")
    .replace(/^  \*\*([^*:]+):\*\*\s+(.+)$/gm, "- **$1:** $2");

  // Four-space indent (deeper nesting)
  formatted = formatted
    .replace(/^    -\s*\*\*([^*:]+):\*\*\s+(.+)$/gm, "  - **$1:** $2")
    .replace(/^    \*\*([^*:]+):\*\*\s+(.+)$/gm, "  - **$1:** $2")
    .replace(/^    -\s+(.+)$/gm, "  - $1");

  // Convert remaining top-level **Label:** Value to list items
  formatted = formatted.replace(/^\*\*([^*:]+):\*\*\s+(.+)$/gm, "- **$1:** $2");

  formatted = commonFormatters.normalizeBullets(formatted);

  return formatted;
}

/**
 * Format Final Audit specifically
 * Has executive summary, numbered sections, checklists, and recommendations
 */
function formatFinalAudit(content: string): string {
  let formatted = handleCodeFences(content);

  formatted = commonFormatters.normalizeAllCapsHeadings(formatted);

  // Handle numbered sections like "## 1. Executive Summary"
  formatted = formatted.replace(/^##\s*(\d+\.)\s*(.+)$/gm, "## $1 $2");

  formatted = commonFormatters.convertLabelValueToList(formatted);

  // Handle checklist items (☐, ☑, ✓, ✗, etc.)
  formatted = formatted.replace(/^[☐☑✓✗✔✘]\s*/gm, "- ");

  formatted = commonFormatters.normalizeBullets(formatted);
  formatted = commonFormatters.ensureHeadingSpacing(formatted);

  return formatted;
}

/**
 * Format generic artifacts (contracts, blueprints, etc.)
 */
function formatGenericArtifact(content: string): string {
  let formatted = handleCodeFences(content);
  formatted = commonFormatters.normalizeBullets(formatted);
  return formatted;
}

/**
 * Final cleanup - applied after type-specific formatting
 */
function finalCleanup(content: string): string {
  return content
    // Remove excessive blank lines (more than 2)
    .replace(/\n{4,}/g, "\n\n\n")
    // Remove trailing whitespace from lines
    .replace(/[ \t]+$/gm, "")
    // Ensure content starts and ends cleanly
    .trim()
    // Remove any remaining raw JSON that leaked through
    .replace(/^\s*\{\s*"[\s\S]{20,}?\}\s*$/gm, (match) => {
      // Only remove if it looks like database/internal JSON
      if (/"(id|version|status|artifact_type|content)":/i.test(match)) {
        return "";
      }
      return match;
    });
}
