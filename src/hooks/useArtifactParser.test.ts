/**
 * Unit tests for extractArtifactContent()
 * Covers all 4 parsing strategies: DELIVERABLE, HEADER, STATE_JSON, FUZZY_FALLBACK
 */

import { describe, it, expect } from "vitest";

// Re-implement the core extraction logic for testing
// (In a real setup, we'd export this from the hook file)
import { ArtifactType, VALID_ARTIFACT_TYPES, isValidArtifactType } from "@/types/database";
import { MIN_ARTIFACT_CONTENT_LENGTH } from "@/lib/constants";

const ARTIFACT_TYPE_MAP: Record<string, ArtifactType> = {
  phase_1_contract: "phase_1_contract",
  "phase 1 contract": "phase_1_contract",
  "phase 1: contract": "phase_1_contract",
  contract: "phase_1_contract",
  discovery_report: "discovery_report",
  "discovery report": "discovery_report",
  "discovery insights report": "discovery_report",
  discovery: "discovery_report",
  learner_persona: "learner_persona",
  "learner persona": "learner_persona",
  persona: "learner_persona",
  design_strategy: "design_strategy",
  "design strategy": "design_strategy",
  strategy: "design_strategy",
  design_blueprint: "design_blueprint",
  "design blueprint": "design_blueprint",
  blueprint: "design_blueprint",
  scenario_bank: "scenario_bank",
  "scenario bank": "scenario_bank",
  scenarios: "scenario_bank",
  assessment_kit: "assessment_kit",
  "assessment kit": "assessment_kit",
  assessment: "assessment_kit",
  final_audit: "final_audit",
  "final audit": "final_audit",
  audit: "final_audit",
  performance_recommendation_report: "performance_recommendation_report",
  "performance recommendation report": "performance_recommendation_report",
  "performance report": "performance_recommendation_report",
  pirr: "performance_recommendation_report",
  prr: "performance_recommendation_report",
};

function normalizeArtifactType(name: string): ArtifactType | null {
  const normalized = name.toLowerCase().trim();
  const mapped = ARTIFACT_TYPE_MAP[normalized];
  if (mapped && VALID_ARTIFACT_TYPES.has(mapped)) return mapped;
  if (isValidArtifactType(normalized)) return normalized;
  return null;
}

function cleanContent(content: string): string {
  return content
    .replace(/\n---\s*$/g, "")
    .replace(/\n✅\s*Saved\.[\s\S]*$/gi, "")
    .replace(/\nSTATE[\s\S]*$/gi, "")
    .replace(/\nAwaiting approval:[\s\S]*$/gi, "")
    .replace(/\nNext[\s\S]*$/gi, "")
    .replace(/\nCommands:[\s\S]*$/gi, "")
    .trim();
}

function extractSection(content: string, startIndex: number, endMarkers: RegExp[]): string {
  let endIndex = content.length;
  for (const marker of endMarkers) {
    const match = content.slice(startIndex).search(marker);
    if (match !== -1 && startIndex + match < endIndex) {
      endIndex = startIndex + match;
    }
  }
  return content.slice(startIndex, endIndex);
}

interface ParsedArtifact {
  type: ArtifactType;
  content: string;
  status: "draft" | "pending_approval";
}

function extractArtifactContent(content: string): { artifacts: ParsedArtifact[]; strategies: string[] } {
  const artifacts: ParsedArtifact[] = [];
  const foundTypes = new Set<ArtifactType>();
  const strategies: string[] = [];

  const endMarkers = [
    /\*\*DELIVERABLE:/gi,
    /STATE\s*:?\s*\n```json/gi,
    /\n---\s*\n✅/g,
    /\n✅\s*Saved\./gi,
  ];

  // Strategy 1: DELIVERABLE
  const deliverablePattern = /\*\*DELIVERABLE:\s*([^*\n]+)\*\*/gi;
  let match;
  while ((match = deliverablePattern.exec(content)) !== null) {
    const typeName = match[1].trim();
    const startIndex = match.index + match[0].length;
    let artifactContent = extractSection(content, startIndex, endMarkers);
    artifactContent = cleanContent(artifactContent);
    const type = normalizeArtifactType(typeName);
    if (type && artifactContent.length > MIN_ARTIFACT_CONTENT_LENGTH && !foundTypes.has(type)) {
      foundTypes.add(type);
      artifacts.push({ type, content: artifactContent, status: "draft" });
      if (!strategies.includes("DELIVERABLE")) strategies.push("DELIVERABLE");
    }
  }

  // Strategy 2: HEADER
  const headerPattern =
    /#{2,3}\s*(Phase\s*\d*:?\s*)?(Contract|Discovery(?:\s*Insights)?\s*Report|Learner\s*Persona|Design\s*Strategy(?:\s*Document)?|Design\s*Blueprint|Scenario\s*Bank|Assessment\s*Kit|Final\s*(?:Design\s*)?Audit|Performance.*?Report|PIRR|PRR)[:\s]*\n/gi;
  while ((match = headerPattern.exec(content)) !== null) {
    const typeName = ((match[1] || "") + match[2]).trim();
    const startIndex = match.index + match[0].length;
    let artifactContent = extractSection(content, startIndex, [
      ...endMarkers,
      /#{2,3}\s*(?:Phase|Contract|Discovery|Learner|Design|Scenario|Assessment|Final|Performance|PIRR|PRR)/gi,
    ]);
    artifactContent = cleanContent(artifactContent);
    const type = normalizeArtifactType(typeName);
    if (type && artifactContent.length > MIN_ARTIFACT_CONTENT_LENGTH && !foundTypes.has(type)) {
      foundTypes.add(type);
      artifacts.push({ type, content: artifactContent, status: "draft" });
      if (!strategies.includes("HEADER")) strategies.push("HEADER");
    }
  }

  // Strategy 3: STATE_JSON
  const stateJsonMatch = content.match(/STATE\s*:?\s*\n```json\s*([\s\S]*?)```/i);
  if (stateJsonMatch) {
    try {
      const stateJson = JSON.parse(stateJsonMatch[1].trim());
      if (stateJson.artifacts && typeof stateJson.artifacts === "object") {
        for (const [key, value] of Object.entries(stateJson.artifacts)) {
          const type = normalizeArtifactType(key);
          if (type && !foundTypes.has(type)) {
            let contentStr = "";
            if (typeof value === "string" && value.length > MIN_ARTIFACT_CONTENT_LENGTH) {
              contentStr = value;
            } else if (typeof value === "object" && value !== null) {
              const obj = value as Record<string, unknown>;
              if (typeof obj.content === "string" && obj.content.length > MIN_ARTIFACT_CONTENT_LENGTH) {
                contentStr = obj.content;
              } else {
                contentStr = JSON.stringify(value, null, 2);
                if (contentStr.length <= MIN_ARTIFACT_CONTENT_LENGTH) continue;
              }
            }
            if (contentStr) {
              foundTypes.add(type);
              artifacts.push({ type, content: contentStr, status: "draft" });
              if (!strategies.includes("STATE_JSON")) strategies.push("STATE_JSON");
            }
          }
        }
      }
    } catch {
      // Invalid JSON
    }
  }

  // Strategy 4: FUZZY_FALLBACK
  if (artifacts.length === 0 && content.length > 500) {
    const fuzzyPatterns: { pattern: RegExp; type: ArtifactType }[] = [
      { pattern: /(?:^|\n)#+\s*(?:Phase\s*1|Project)\s*Contract/i, type: "phase_1_contract" },
      { pattern: /(?:^|\n)#+\s*Discovery\s*(?:Insights?)?\s*Report/i, type: "discovery_report" },
      { pattern: /(?:^|\n)#+\s*Learner\s*Persona/i, type: "learner_persona" },
      { pattern: /(?:^|\n)#+\s*Design\s*Strategy/i, type: "design_strategy" },
      { pattern: /(?:^|\n)#+\s*Design\s*Blueprint/i, type: "design_blueprint" },
      { pattern: /(?:^|\n)#+\s*Scenario\s*Bank/i, type: "scenario_bank" },
      { pattern: /(?:^|\n)#+\s*Assessment\s*Kit/i, type: "assessment_kit" },
      { pattern: /(?:^|\n)#+\s*Final\s*(?:Design\s*)?Audit/i, type: "final_audit" },
      { pattern: /(?:^|\n)#+\s*Performance.*Report/i, type: "performance_recommendation_report" },
    ];

    for (const { pattern, type } of fuzzyPatterns) {
      if (foundTypes.has(type)) continue;
      const fuzzyMatch = content.match(pattern);
      if (fuzzyMatch && fuzzyMatch.index !== undefined) {
        const startIndex = fuzzyMatch.index + fuzzyMatch[0].length;
        let artifactContent = extractSection(content, startIndex, endMarkers);
        artifactContent = cleanContent(artifactContent);
        if (artifactContent.length > MIN_ARTIFACT_CONTENT_LENGTH) {
          foundTypes.add(type);
          artifacts.push({ type, content: artifactContent, status: "draft" });
          if (!strategies.includes("FUZZY_FALLBACK")) strategies.push("FUZZY_FALLBACK");
        }
      }
    }
  }

  return { artifacts, strategies };
}

// ============= TESTS =============

describe("extractArtifactContent", () => {
  describe("Strategy 1: DELIVERABLE format", () => {
    it("extracts artifact from **DELIVERABLE: Type** pattern", () => {
      const input = `**DELIVERABLE: Phase 1 Contract**

**Project Title:** Sales Training Initiative
**Target Audience:** Sales Representatives
**Performance Gap:** Current conversion rate is 15%, target is 25%

---

✅ Saved.`;

      const { artifacts, strategies } = extractArtifactContent(input);

      expect(strategies).toContain("DELIVERABLE");
      expect(artifacts).toHaveLength(1);
      expect(artifacts[0].type).toBe("phase_1_contract");
      expect(artifacts[0].content).toContain("Project Title");
      expect(artifacts[0].content).toContain("Sales Training Initiative");
    });

    it("extracts multiple artifacts from DELIVERABLE patterns", () => {
      const input = `**DELIVERABLE: Discovery Report**

Key findings from stakeholder interviews.
- Finding 1: Lack of training materials
- Finding 2: No performance support

---

**DELIVERABLE: Learner Persona**

**Name:** Junior Sales Rep
**Experience:** 0-2 years
**Goals:** Meet quota, learn products

---

✅ Saved.`;

      const { artifacts, strategies } = extractArtifactContent(input);

      expect(strategies).toContain("DELIVERABLE");
      expect(artifacts).toHaveLength(2);
      expect(artifacts.map((a) => a.type)).toContain("discovery_report");
      expect(artifacts.map((a) => a.type)).toContain("learner_persona");
    });

    it("handles variations in type naming", () => {
      const cases = [
        { input: "**DELIVERABLE: Contract**", expected: "phase_1_contract" },
        { input: "**DELIVERABLE: Design Blueprint**", expected: "design_blueprint" },
        { input: "**DELIVERABLE: Final Audit**", expected: "final_audit" },
        { input: "**DELIVERABLE: Performance Report**", expected: "performance_recommendation_report" },
      ];

      for (const { input, expected } of cases) {
        const fullInput = `${input}\n\nThis is substantial content that should be extracted. It needs to be long enough to pass the minimum length check for valid artifacts.`;
        const { artifacts } = extractArtifactContent(fullInput);
        expect(artifacts[0]?.type).toBe(expected);
      }
    });
  });

  describe("Strategy 2: HEADER format", () => {
    it("extracts artifact from ## Header pattern", () => {
      const input = `## Learner Persona

**Name:** Experienced Manager
**Role:** Regional Sales Manager
**Goals:**
- Lead team to quota
- Develop junior reps

---

Next step: Design Strategy`;

      const { artifacts, strategies } = extractArtifactContent(input);

      expect(strategies).toContain("HEADER");
      expect(artifacts).toHaveLength(1);
      expect(artifacts[0].type).toBe("learner_persona");
      expect(artifacts[0].content).toContain("Experienced Manager");
    });

    it("extracts artifact from ### Header pattern", () => {
      const input = `### Design Strategy Document

**Approach:** Scenario-based learning
**Duration:** 4 hours total
**Delivery:** Virtual instructor-led

This strategy focuses on practical application.`;

      const { artifacts, strategies } = extractArtifactContent(input);

      expect(strategies).toContain("HEADER");
      expect(artifacts[0].type).toBe("design_strategy");
    });

    it("handles Phase prefix in headers", () => {
      const input = `## Phase 1: Contract

**Project:** New Hire Onboarding
**Stakeholder:** HR Director
**Timeline:** Q1 2024`;

      const { artifacts } = extractArtifactContent(input);

      expect(artifacts[0]?.type).toBe("phase_1_contract");
    });

    it("stops at next header", () => {
      const input = `## Design Blueprint

Blueprint content here with detailed modules.
Module 1: Introduction
Module 2: Core Skills

## Scenario Bank

Scenario content that should be separate.
Scenario 1: Customer complaint`;

      const { artifacts } = extractArtifactContent(input);

      expect(artifacts).toHaveLength(2);
      expect(artifacts[0].content).not.toContain("Scenario content");
      expect(artifacts[1].content).toContain("Customer complaint");
    });
  });

  describe("Strategy 3: STATE_JSON format", () => {
    it("extracts artifacts from STATE JSON block", () => {
      const input = `Here is the current state:

STATE:
\`\`\`json
{
  "mode": "STANDARD",
  "pipeline_stage": "Discovery",
  "artifacts": {
    "discovery_report": {
      "Title": "Discovery Insights Report",
      "Summary": "Key findings from analysis phase including stakeholder interviews and data review"
    }
  }
}
\`\`\``;

      const { artifacts, strategies } = extractArtifactContent(input);

      expect(strategies).toContain("STATE_JSON");
      expect(artifacts).toHaveLength(1);
      expect(artifacts[0].type).toBe("discovery_report");
    });

    it("extracts multiple artifacts from STATE JSON", () => {
      const input = `STATE
\`\`\`json
{
  "artifacts": {
    "phase_1_contract": {
      "Project": "Safety Training",
      "Audience": "Factory Workers",
      "Gap": "Incident rate too high"
    },
    "discovery_report": {
      "Findings": ["No refresher training", "Outdated materials"],
      "Recommendations": ["Update content", "Add simulations"]
    }
  }
}
\`\`\``;

      const { artifacts } = extractArtifactContent(input);

      expect(artifacts.length).toBeGreaterThanOrEqual(2);
      expect(artifacts.map((a) => a.type)).toContain("phase_1_contract");
      expect(artifacts.map((a) => a.type)).toContain("discovery_report");
    });

    it("skips null artifact values", () => {
      const input = `STATE:
\`\`\`json
{
  "artifacts": {
    "phase_1_contract": {
      "Title": "Valid Contract with enough content to pass minimum length check"
    },
    "design_strategy": null,
    "design_blueprint": null
  }
}
\`\`\``;

      const { artifacts } = extractArtifactContent(input);

      expect(artifacts).toHaveLength(1);
      expect(artifacts[0].type).toBe("phase_1_contract");
    });

    it("handles malformed JSON gracefully", () => {
      const input = `STATE:
\`\`\`json
{
  "artifacts": {
    "discovery_report": {
      "Title": "Report"
    }
  broken json here
}
\`\`\``;

      // Should not throw
      const { artifacts } = extractArtifactContent(input);
      expect(artifacts).toHaveLength(0); // Can't parse, returns empty
    });
  });

  describe("Strategy 4: FUZZY_FALLBACK", () => {
    it("extracts artifact using fuzzy matching when other strategies fail", () => {
      // Create content long enough (>500 chars) to trigger fuzzy
      const input = `# Project Contract

This is a detailed contract document for the training initiative.

**Project Overview:**
The goal of this project is to improve customer service skills across the organization. We will develop a comprehensive training program that addresses key skill gaps identified in recent performance reviews.

**Scope:**
- Initial assessment
- Content development
- Pilot delivery
- Full rollout

**Timeline:**
- Phase 1: 4 weeks
- Phase 2: 6 weeks
- Phase 3: 8 weeks

**Success Metrics:**
- Customer satisfaction scores improve by 15%
- First call resolution increases by 20%`;

      const { artifacts, strategies } = extractArtifactContent(input);

      expect(strategies).toContain("FUZZY_FALLBACK");
      expect(artifacts[0]?.type).toBe("phase_1_contract");
    });

    it("does not trigger fuzzy for short content", () => {
      const input = `# Contract

Short content only.`;

      const { artifacts } = extractArtifactContent(input);

      expect(artifacts).toHaveLength(0);
    });
  });

  describe("Edge cases", () => {
    it("returns empty array for content with no artifacts", () => {
      const input = `This is just a regular message with no artifact markers or patterns.`;

      const { artifacts } = extractArtifactContent(input);

      expect(artifacts).toHaveLength(0);
    });

    it("deduplicates artifacts by type", () => {
      const input = `**DELIVERABLE: Phase 1 Contract**

First version of contract with project details and scope information.

---

**DELIVERABLE: Phase 1 Contract**

Second version should be ignored since we already have this type.`;

      const { artifacts } = extractArtifactContent(input);

      expect(artifacts).toHaveLength(1);
    });

    it("cleans trailing markers from content", () => {
      const input = `**DELIVERABLE: Assessment Kit**

**Questions:**
1. What is the first step?
2. How do you handle objections?

**Passing Score:** 80%

---

✅ Saved.
Awaiting approval: assessment_kit`;

      const { artifacts } = extractArtifactContent(input);

      expect(artifacts[0].content).not.toContain("✅ Saved");
      expect(artifacts[0].content).not.toContain("Awaiting approval");
    });

    it("handles PIRR/PRR abbreviations", () => {
      const input = `## PIRR

This Performance Improvement Recommendation Report provides analysis and suggestions for enhancing the training program effectiveness based on evaluation data.`;

      const { artifacts } = extractArtifactContent(input);

      expect(artifacts[0]?.type).toBe("performance_recommendation_report");
    });
  });

  describe("Priority order", () => {
    it("prefers DELIVERABLE over HEADER when both present", () => {
      const input = `## Phase 1 Contract

Header version content here.

**DELIVERABLE: Phase 1 Contract**

Deliverable version content which should take precedence over the header version.

---`;

      const { artifacts, strategies } = extractArtifactContent(input);

      // DELIVERABLE runs first, so it captures the artifact
      expect(strategies[0]).toBe("DELIVERABLE");
      expect(artifacts).toHaveLength(1);
      expect(artifacts[0].content).toContain("Deliverable version");
    });
  });
});
