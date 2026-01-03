/**
 * Dedicated artifact content formatter
 * Handles cleaning and normalizing artifact content for display
 */

import { ArtifactType } from "@/types/database";

/**
 * Format artifact content based on type
 * Discovery Reports get special handling for their complex structure
 */
export function formatArtifactContent(content: string, artifactType: ArtifactType): string {
  // First apply universal cleanup
  let formatted = universalCleanup(content);
  
  // Apply type-specific formatting
  switch (artifactType) {
    case "discovery_report":
      formatted = formatDiscoveryReport(formatted);
      break;
    case "learner_persona":
      formatted = formatPersona(formatted);
      break;
    case "performance_recommendation_report":
      formatted = formatPerformanceReport(formatted);
      break;
    default:
      formatted = formatGenericArtifact(formatted);
  }
  
  return finalCleanup(formatted);
}

/**
 * Universal cleanup applied to all artifact types
 * Removes database artifacts, status metadata, and obvious junk
 */
function universalCleanup(content: string): string {
  let cleaned = content;
  
  // Remove trailing status:draft]] or similar database query artifacts
  cleaned = cleaned.replace(/\s*status:\s*\w+\]*\]*\s*$/gi, "");
  cleaned = cleaned.replace(/\[\[.*?status:\s*\w+.*?\]\]/gi, "");
  
  // Remove STATE: { ... } blocks (internal state leakage)
  cleaned = cleaned.replace(/STATE:\s*\{[\s\S]*?\}\s*/gi, "");
  
  // Remove artifact_type markers that leaked through
  cleaned = cleaned.replace(/artifact_type:\s*["']?\w+["']?\s*/gi, "");
  
  // Remove version/id markers
  cleaned = cleaned.replace(/\b(version|updated_at|created_at|id):\s*["']?[\w\d-]+["']?\s*/gi, "");
  
  return cleaned;
}

/**
 * Handle fenced code blocks - either remove or contain them properly
 */
function handleCodeFences(content: string): string {
  let result = content;
  
  // Pattern 1: ```json blocks with actual JSON data (remove entirely - internal data)
  result = result.replace(/```json\s*\n?\{[\s\S]*?\}\s*\n?```/gi, "");
  
  // Pattern 2: Empty or whitespace-only code blocks
  result = result.replace(/```\w*\s*\n?\s*\n?```/gi, "");
  
  // Pattern 3: Unclosed code fences (common truncation issue)
  // If we find ``` followed by content but no closing ```, remove the fence marker
  result = result.replace(/```(\w*)\n([\s\S]*?)(?=\n##|\n\*\*[A-Z]|$)/gi, (match, lang, codeContent) => {
    // Check if there's a closing fence
    if (!match.includes("```", 3)) {
      // No closing fence - this is broken, return the content without fences
      return codeContent.trim();
    }
    return match;
  });
  
  // Pattern 4: Properly closed code blocks that contain prose (mismarked as code)
  result = result.replace(/```\s*\n((?:(?!```)[^\n]*\n)*?)```/g, (match, innerContent) => {
    // If the content looks like prose (has sentences, not code), extract it
    const isProse = /[.!?]\s|^\s*[-*]\s|^\s*#{1,4}\s/m.test(innerContent);
    const isCode = /[{}\[\];]|function\s|const\s|let\s|var\s|=>/m.test(innerContent);
    
    if (isProse && !isCode) {
      return "\n" + innerContent.trim() + "\n";
    }
    return match;
  });
  
  return result;
}

/**
 * Format Discovery Report specifically
 * These have complex nested structures with stakeholder quotes, bullets, etc.
 */
function formatDiscoveryReport(content: string): string {
  let formatted = handleCodeFences(content);
  
  // Normalize headings - ensure consistent format
  // Convert various heading formats to standard markdown
  formatted = formatted.replace(/^([A-Z][A-Z\s&]+):?\s*$/gm, "\n## $1\n");
  formatted = formatted.replace(/^\*\*([A-Z][A-Z\s&]+)\*\*:?\s*$/gm, "\n## $1\n");
  
  // Normalize section headings (### format)
  formatted = formatted.replace(/^###\s*\*\*(.+?)\*\*\s*$/gm, "### $1");
  formatted = formatted.replace(/^##\s*\*\*(.+?)\*\*\s*$/gm, "## $1");
  
  // Convert numbered items with bold labels to proper list format
  // "1. **Label:** Value" stays as is (already good)
  // "**Label:** Value" on its own line becomes a list item
  formatted = formatted.replace(/^(?!\d+\.)\s*\*\*([^*:]+):\*\*\s+(.+)$/gm, "- **$1:** $2");
  
  // Handle stakeholder quotes - convert to blockquotes
  // Pattern: - "Quote text" or just "Quote text" at start of line
  formatted = formatted.replace(/^\s*[-•]\s*"([^"]+)"\s*$/gm, '\n> "$1"\n');
  formatted = formatted.replace(/^\s*"([^"]+)"\s*$/gm, '\n> "$1"\n');
  
  // Handle attributed quotes: "Quote" - Attribution or "Quote" — Attribution
  formatted = formatted.replace(/^\s*[-•]?\s*"([^"]+)"\s*[-—–]\s*(.+)$/gm, '\n> "$1"\n> — $2\n');
  
  // Normalize bullet points - ensure consistent format
  formatted = formatted.replace(/^[•◦▪▸►]\s*/gm, "- ");
  
  // Fix nested bullets (ensure proper indentation)
  formatted = formatted.replace(/^(\s+)[•◦▪▸►]\s*/gm, "$1- ");
  
  // Clean up key-value pairs that should be on same line
  formatted = formatted.replace(/^\*\*([^*:]+):\*\*\s*\n\s*([^\n-#*])/gm, "**$1:** $2");
  
  // Ensure sections have proper spacing
  formatted = formatted.replace(/\n(##[^\n]+)\n(?!\n)/g, "\n\n$1\n\n");
  formatted = formatted.replace(/\n(###[^\n]+)\n(?!\n)/g, "\n\n$1\n\n");
  
  return formatted;
}

/**
 * Format Learner Persona specifically
 */
function formatPersona(content: string): string {
  let formatted = handleCodeFences(content);
  
  // Similar normalization as discovery report
  formatted = formatted.replace(/^([A-Z][A-Z\s&]+):?\s*$/gm, "\n## $1\n");
  formatted = formatted.replace(/^\*\*([A-Z][A-Z\s&]+)\*\*:?\s*$/gm, "\n## $1\n");
  formatted = formatted.replace(/^(?!\d+\.)\s*\*\*([^*:]+):\*\*\s+(.+)$/gm, "- **$1:** $2");
  
  return formatted;
}

/**
 * Format Performance Improvement Recommendation Report
 * Has complex structure with key-value pairs, indented sections, and pipe-delimited tables
 */
function formatPerformanceReport(content: string): string {
  let formatted = handleCodeFences(content);
  
  // Handle pipe-delimited recommendation rows - convert to structured list items
  // Pattern: **Category:** X | **Description:** Y | **Impact On Gap:** Z | **Responsibility:** W
  formatted = formatted.replace(
    /^\s*-?\s*\*\*Category:\*\*\s*([^|]+)\s*\|\s*\*\*Description:\*\*\s*([^|]+)\s*\|\s*\*\*Impact On Gap:\*\*\s*([^|]+)\s*\|\s*\*\*Responsibility:\*\*\s*(.+)$/gm,
    (_, category, description, impact, responsibility) => {
      return `#### ${category.trim()}\n- **Description:** ${description.trim()}\n- **Impact:** ${impact.trim()}\n- **Responsibility:** ${responsibility.trim()}`;
    }
  );
  
  // Handle simpler pipe-delimited patterns (3 fields)
  formatted = formatted.replace(
    /^\s*-?\s*\*\*([^:*]+):\*\*\s*([^|]+)\s*\|\s*\*\*([^:*]+):\*\*\s*([^|]+)\s*\|\s*\*\*([^:*]+):\*\*\s*(.+)$/gm,
    (_, label1, val1, label2, val2, label3, val3) => {
      return `- **${label1.trim()}:** ${val1.trim()}\n  - **${label2.trim()}:** ${val2.trim()}\n  - **${label3.trim()}:** ${val3.trim()}`;
    }
  );
  
  // Handle top-level **Label:** Value (like **Report Title:** or **Executive Summary:**)
  formatted = formatted.replace(/^\*\*Report Title:\*\*\s+(.+)$/gm, "# $1");
  formatted = formatted.replace(/^\*\*Executive Summary:\*\*\s+(.+)$/gm, "## Executive Summary\n$1");
  formatted = formatted.replace(/^\*\*Recommendations:\*\*\s*$/gm, "## Recommendations");
  formatted = formatted.replace(/^\*\*([^*:]+):\*\*\s*$/gm, "## $1");
  
  // Normalize top-level headers (### to ##)
  formatted = formatted.replace(/^###\s+(.+)$/gm, "## $1");
  
  // Handle indented **Label:** Value pairs - convert to proper nested bullets
  formatted = formatted.replace(/^  \*\*([^*:]+):\*\*\s*$/gm, "### $1");
  formatted = formatted.replace(/^  \*\*([^*:]+):\*\*\s+(.+)$/gm, "- **$1:** $2");
  
  // Four-space indent (deeper nesting)
  formatted = formatted.replace(/^    -\s*\*\*([^*:]+):\*\*\s+(.+)$/gm, "  - **$1:** $2");
  formatted = formatted.replace(/^    \*\*([^*:]+):\*\*\s+(.+)$/gm, "  - **$1:** $2");
  formatted = formatted.replace(/^    -\s+(.+)$/gm, "  - $1");
  
  // Convert remaining top-level **Label:** Value to list items
  formatted = formatted.replace(/^\*\*([^*:]+):\*\*\s+(.+)$/gm, "- **$1:** $2");
  
  // Normalize bullet points
  formatted = formatted.replace(/^[•◦▪▸►]\s*/gm, "- ");
  
  return formatted;
}

/**
 * Format generic artifacts (contracts, blueprints, etc.)
 */
function formatGenericArtifact(content: string): string {
  let formatted = handleCodeFences(content);
  
  // Light touch - just normalize obvious issues
  formatted = formatted.replace(/^[•◦▪▸►]\s*/gm, "- ");
  
  return formatted;
}

/**
 * Final cleanup - applied after type-specific formatting
 */
function finalCleanup(content: string): string {
  let cleaned = content;
  
  // Remove excessive blank lines (more than 2)
  cleaned = cleaned.replace(/\n{4,}/g, "\n\n\n");
  
  // Remove trailing whitespace from lines
  cleaned = cleaned.replace(/[ \t]+$/gm, "");
  
  // Ensure content starts and ends cleanly
  cleaned = cleaned.trim();
  
  // Remove any remaining raw JSON that leaked through
  // Only if it's clearly orphaned JSON (not in a code block)
  cleaned = cleaned.replace(/^\s*\{\s*"[\s\S]{20,}?\}\s*$/gm, (match) => {
    // Only remove if it looks like database/internal JSON
    if (/"(id|version|status|artifact_type|content)":/i.test(match)) {
      return "";
    }
    return match;
  });
  
  return cleaned;
}
