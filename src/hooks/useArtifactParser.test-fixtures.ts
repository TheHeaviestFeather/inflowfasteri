/**
 * Test fixtures for artifact parser
 * These test the JSON extraction and artifact parsing logic
 */

import { ArtifactType } from "@/types/database";

export interface ParserTestFixture {
  name: string;
  description: string;
  input: string;
  expectedArtifacts: Array<{
    type: ArtifactType;
    contentContains?: string[];
  }>;
  shouldNotFind?: ArtifactType[];
}

export const PARSER_TEST_FIXTURES: ParserTestFixture[] = [
  {
    name: "Multi-JSON-block response",
    description: "AI response with STATE JSON followed by archive JSON block",
    input: `I will now draft the Design Strategy Document.

✅ Saved.
Awaiting approval: design_strategy
\`\`\`json
{
  "mode": "STANDARD",
  "pipeline_stage": "Design Strategy Document",
  "artifacts": {
    "phase_1_contract": {
      "Project Title": "Sample Project",
      "Target Audience": "Test Users"
    },
    "design_strategy": {
      "Project Title": "Design Strategy for Sample Project",
      "Overall Goal": "Create effective training",
      "Learning Objectives": ["Recall key concepts", "Apply procedures"]
    }
  },
  "approved_artifacts": {
    "phase_1_contract": true
  },
  "awaiting_approval_for": "design_strategy"
}
\`\`\`
\`\`\`json
{
  "phase_1_contract": {
    "Project Title": "Sample Project"
  }
}
\`\`\``,
    expectedArtifacts: [
      { type: "phase_1_contract", contentContains: ["Project Title", "Sample Project"] },
      { type: "design_strategy", contentContains: ["Design Strategy", "Learning Objectives"] },
    ],
  },

  {
    name: "Truncated JSON block",
    description: "JSON that got cut off mid-stream",
    input: `Processing your request...

\`\`\`json
{
  "mode": "STANDARD",
  "artifacts": {
    "discovery_report": {
      "Key Findings": ["Finding 1", "Finding 2"],
      "Recommendations": ["Rec 1", "Rec 2"]
    },
    "learner_persona": {
      "Name": "Test Learner",
      "Goals": ["Goal 1"`,
    expectedArtifacts: [
      { type: "discovery_report", contentContains: ["Key Findings", "Finding 1"] },
    ],
    shouldNotFind: ["learner_persona"],
  },

  {
    name: "STATE prefix JSON block",
    description: "JSON with explicit STATE: prefix",
    input: `Here is the current state:

STATE: \`\`\`json
{
  "pipeline_stage": "Discovery",
  "artifacts": {
    "discovery_report": {
      "Title": "Discovery Insights",
      "Summary": "Key insights from stakeholder interviews"
    }
  }
}
\`\`\``,
    expectedArtifacts: [
      { type: "discovery_report", contentContains: ["Discovery Insights", "stakeholder interviews"] },
    ],
  },

  {
    name: "DELIVERABLE pattern",
    description: "Explicit DELIVERABLE marker in content",
    input: `**DELIVERABLE: Phase 1 Contract**

**Project Title:** New Training Initiative
**Target Audience:** Sales Team
**Performance Gap:** Current close rate is 20%, target is 30%

---

✅ Saved.`,
    expectedArtifacts: [
      { type: "phase_1_contract", contentContains: ["Project Title", "Target Audience", "Performance Gap"] },
    ],
  },

  {
    name: "Markdown header pattern",
    description: "Artifact identified by markdown header",
    input: `## Learner Persona

**Name:** Experienced Sales Rep
**Role:** Field Sales Representative
**Goals:**
- Meet quarterly targets
- Build customer relationships

---

Next step: Design Strategy`,
    expectedArtifacts: [
      { type: "learner_persona", contentContains: ["Experienced Sales Rep", "Field Sales"] },
    ],
  },

  {
    name: "Multiple artifacts in one response",
    description: "Response containing several artifacts",
    input: `\`\`\`json
{
  "artifacts": {
    "phase_1_contract": {
      "Title": "Contract for Training",
      "Scope": "Full program"
    },
    "discovery_report": {
      "Findings": ["Issue A", "Issue B"],
      "Verdict": "Proceed with training"
    },
    "learner_persona": {
      "Name": "Typical Learner",
      "Background": "Entry level employee"
    }
  }
}
\`\`\``,
    expectedArtifacts: [
      { type: "phase_1_contract", contentContains: ["Contract for Training"] },
      { type: "discovery_report", contentContains: ["Issue A", "Proceed with training"] },
      { type: "learner_persona", contentContains: ["Typical Learner", "Entry level"] },
    ],
  },

  {
    name: "Empty artifact values",
    description: "Artifacts object with null values should be skipped",
    input: `\`\`\`json
{
  "artifacts": {
    "phase_1_contract": {
      "Title": "Valid Contract"
    },
    "design_strategy": null,
    "design_blueprint": null
  }
}
\`\`\``,
    expectedArtifacts: [
      { type: "phase_1_contract", contentContains: ["Valid Contract"] },
    ],
    shouldNotFind: ["design_strategy", "design_blueprint"],
  },

  {
    name: "PIRR pattern recognition",
    description: "Performance Improvement Recommendation Report variations",
    input: `## Performance Improvement Recommendation Report

**Report Title:** Analysis of Training Gaps
**Executive Summary:** This report outlines key recommendations...
**Recommendations:**
- Implement job aids
- Increase supervisor coaching`,
    expectedArtifacts: [
      { type: "performance_recommendation_report", contentContains: ["Training Gaps", "Recommendations"] },
    ],
  },

  {
    name: "Nested object formatting",
    description: "Deeply nested JSON should be formatted properly",
    input: `\`\`\`json
{
  "artifacts": {
    "discovery_report": {
      "Stakeholder Interviews": {
        "Manager Feedback": {
          "Quote 1": "We need faster onboarding",
          "Quote 2": "Training is too long"
        },
        "Employee Feedback": {
          "Quote 1": "Instructions unclear",
          "Quote 2": "No time to practice"
        }
      },
      "Environmental Factors": ["Time pressure", "Outdated tools"]
    }
  }
}
\`\`\``,
    expectedArtifacts: [
      { type: "discovery_report", contentContains: ["Stakeholder Interviews", "Manager Feedback", "faster onboarding"] },
    ],
  },

  {
    name: "Invalid JSON with valid artifacts block",
    description: "Malformed outer JSON but valid artifacts section",
    input: `\`\`\`json
{
  "mode": "STANDARD",
  "artifacts": {
    "scenario_bank": {
      "Scenarios": [
        {"Title": "Scenario 1", "Description": "User encounters error"},
        {"Title": "Scenario 2", "Description": "User completes task"}
      ]
    }
  }
  "broken_field": missing quotes
}
\`\`\``,
    expectedArtifacts: [
      { type: "scenario_bank", contentContains: ["Scenario 1", "User encounters error"] },
    ],
  },

  {
    name: "Archive JSON block ignored",
    description: "Second JSON block without artifacts should be ignored",
    input: `\`\`\`json
{
  "artifacts": {
    "assessment_kit": {
      "Questions": ["Q1", "Q2", "Q3"],
      "Passing Score": "80%"
    }
  }
}
\`\`\`
\`\`\`json
{
  "archived_data": "this should be ignored",
  "old_version": true
}
\`\`\``,
    expectedArtifacts: [
      { type: "assessment_kit", contentContains: ["Questions", "Passing Score"] },
    ],
  },

  {
    name: "Mixed patterns in single response",
    description: "Both DELIVERABLE and JSON patterns present",
    input: `**DELIVERABLE: Final Audit**

The audit has been completed successfully.

**Compliance Status:** Passed
**Areas of Excellence:** Clear objectives, engaging content

\`\`\`json
{
  "artifacts": {
    "final_audit": {
      "Status": "Complete",
      "Score": 95
    }
  }
}
\`\`\``,
    expectedArtifacts: [
      { type: "final_audit", contentContains: ["Compliance Status"] },
    ],
  },
];

/**
 * Run parser test fixtures
 */
export function runParserTests(
  parseFunction: (content: string) => Array<{ type: ArtifactType; content: string }>
): { passed: number; failed: number; results: Array<{ fixture: string; passed: boolean; errors: string[] }> } {
  const results: Array<{ fixture: string; passed: boolean; errors: string[] }> = [];
  let passed = 0;
  let failed = 0;

  for (const fixture of PARSER_TEST_FIXTURES) {
    const parsed = parseFunction(fixture.input);
    const errors: string[] = [];

    // Check expected artifacts were found
    for (const expected of fixture.expectedArtifacts) {
      const found = parsed.find((p) => p.type === expected.type);
      if (!found) {
        errors.push(`Missing expected artifact: ${expected.type}`);
      } else if (expected.contentContains) {
        for (const pattern of expected.contentContains) {
          if (!found.content.includes(pattern)) {
            errors.push(`Artifact ${expected.type} missing content: "${pattern}"`);
          }
        }
      }
    }

    // Check artifacts that should NOT be found
    if (fixture.shouldNotFind) {
      for (const type of fixture.shouldNotFind) {
        const found = parsed.find((p) => p.type === type);
        if (found) {
          errors.push(`Unexpected artifact found: ${type}`);
        }
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
