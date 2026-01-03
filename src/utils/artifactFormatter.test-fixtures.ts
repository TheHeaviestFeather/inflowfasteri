/**
 * Test fixtures for artifact formatter
 * These represent real-world malformed content patterns we've encountered
 */

import { ArtifactType } from "@/types/database";

export interface TestFixture {
  name: string;
  description: string;
  artifactType: ArtifactType;
  input: string;
  expectedPatterns: string[]; // Patterns that SHOULD appear in output
  unexpectedPatterns: string[]; // Patterns that should NOT appear in output
}

export const FORMATTER_TEST_FIXTURES: TestFixture[] = [
  {
    name: "Trailing status metadata",
    description: "Content with database status artifact at the end",
    artifactType: "discovery_report",
    input: `## Discovery Report

This is the main content of the report.

### Key Findings
- Finding 1
- Finding 2

status:draft]]`,
    expectedPatterns: ["## Discovery Report", "Key Findings", "Finding 1"],
    unexpectedPatterns: ["status:draft", "]]"],
  },

  {
    name: "Leaked JSON code block",
    description: "JSON data block that leaked into content",
    artifactType: "discovery_report",
    input: `## Discovery Report

Some initial content here.

\`\`\`json
{
  "id": "abc123",
  "version": 2,
  "status": "draft"
}
\`\`\`

### Actual Content
This is what should remain.`,
    expectedPatterns: ["## Discovery Report", "Actual Content", "should remain"],
    unexpectedPatterns: ["```json", '"id":', '"version":'],
  },

  {
    name: "Unclosed code fence",
    description: "Code fence that was never closed (truncation)",
    artifactType: "discovery_report",
    input: `## Discovery Report

### Section One
Content before the broken fence.

\`\`\`
This content got marked as code
but it's actually prose content
that should be displayed normally.

### Section Two
More important content here.`,
    expectedPatterns: ["Section One", "Section Two", "important content"],
    unexpectedPatterns: [],
  },

  {
    name: "Stakeholder quotes as bullets",
    description: "Quotes that should become blockquotes",
    artifactType: "discovery_report",
    input: `## Stakeholder Feedback

- "The current system is too slow for our needs."
- "We need better reporting capabilities."
"This quote has no bullet"

### Attributed Quotes
- "Training takes too long" - Senior Manager
"Onboarding is confusing" — HR Director`,
    expectedPatterns: [
      "> \"The current system",
      "> \"We need better",
      "> \"Training takes too long\"",
      "— Senior Manager",
    ],
    unexpectedPatterns: [],
  },

  {
    name: "Mixed bullet formats",
    description: "Various bullet point styles that should normalize",
    artifactType: "discovery_report",
    input: `## Findings

• Unicode bullet point
◦ Hollow bullet
▪ Square bullet
▸ Triangle bullet
- Normal dash
* Asterisk`,
    expectedPatterns: ["- Unicode", "- Hollow", "- Square", "- Triangle", "- Normal"],
    unexpectedPatterns: ["•", "◦", "▪", "▸"],
  },

  {
    name: "Bold labels as list items",
    description: "Bold key-value pairs that should become list items",
    artifactType: "discovery_report",
    input: `## Overview

**Project Name:** Learning Management System
**Client:** Acme Corp
**Duration:** 6 months

### Details
1. **Phase 1:** Discovery
2. **Phase 2:** Design`,
    expectedPatterns: [
      "- **Project Name:** Learning",
      "- **Client:** Acme",
      "1. **Phase 1:**",
    ],
    unexpectedPatterns: [],
  },

  {
    name: "STATE block leakage",
    description: "Internal state object that leaked into content",
    artifactType: "discovery_report",
    input: `## Report

STATE: {
  "currentPhase": "discovery",
  "artifacts": []
}

### Actual Content
This is what matters.`,
    expectedPatterns: ["## Report", "Actual Content", "what matters"],
    unexpectedPatterns: ["STATE:", "currentPhase", "artifacts"],
  },

  {
    name: "Excessive newlines",
    description: "Content with too many blank lines",
    artifactType: "discovery_report",
    input: `## Section One

Content here.




## Section Two



More content.`,
    expectedPatterns: ["## Section One", "## Section Two"],
    unexpectedPatterns: [],
  },

  {
    name: "All-caps headings",
    description: "Headings in ALL CAPS that should become ## headings",
    artifactType: "discovery_report",
    input: `EXECUTIVE SUMMARY

This is the summary content.

KEY FINDINGS:

Finding details here.

**RECOMMENDATIONS**

Recommendation content.`,
    expectedPatterns: ["## EXECUTIVE SUMMARY", "## KEY FINDINGS", "## RECOMMENDATIONS"],
    unexpectedPatterns: [],
  },

  {
    name: "Nested formatting issues",
    description: "Bold within heading markers",
    artifactType: "discovery_report",
    input: `### **Section Title**

Content here.

## **Another Title**

More content.`,
    expectedPatterns: ["### Section Title", "## Another Title"],
    unexpectedPatterns: ["### **", "## **"],
  },

  {
    name: "Orphaned JSON object",
    description: "Raw JSON object without code fence",
    artifactType: "discovery_report",
    input: `## Report

{
  "id": "artifact-123",
  "version": 1,
  "status": "draft",
  "content": "..."
}

### Real Content
This should remain.`,
    expectedPatterns: ["## Report", "Real Content", "should remain"],
    unexpectedPatterns: ['"id": "artifact', '"status": "draft"'],
  },

  {
    name: "Valid code block preservation",
    description: "Actual code that should be preserved",
    artifactType: "design_blueprint",
    input: `## Technical Spec

Here's the component structure:

\`\`\`typescript
interface Props {
  title: string;
  onSubmit: () => void;
}
\`\`\`

Continue with specs.`,
    expectedPatterns: ["```typescript", "interface Props", "```"],
    unexpectedPatterns: [],
  },
];

/**
 * Run all test fixtures and return results
 */
export function runFormatterTests(
  formatter: (content: string, type: ArtifactType) => string
): { passed: number; failed: number; results: Array<{ fixture: string; passed: boolean; errors: string[] }> } {
  const results: Array<{ fixture: string; passed: boolean; errors: string[] }> = [];
  let passed = 0;
  let failed = 0;

  for (const fixture of FORMATTER_TEST_FIXTURES) {
    const output = formatter(fixture.input, fixture.artifactType);
    const errors: string[] = [];

    // Check expected patterns are present
    for (const pattern of fixture.expectedPatterns) {
      if (!output.includes(pattern)) {
        errors.push(`Missing expected pattern: "${pattern}"`);
      }
    }

    // Check unexpected patterns are absent
    for (const pattern of fixture.unexpectedPatterns) {
      if (output.includes(pattern)) {
        errors.push(`Found unexpected pattern: "${pattern}"`);
      }
    }

    const testPassed = errors.length === 0;
    if (testPassed) {
      passed++;
    } else {
      failed++;
    }

    results.push({
      fixture: fixture.name,
      passed: testPassed,
      errors,
    });
  }

  return { passed, failed, results };
}
