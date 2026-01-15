/**
 * Integration tests for useArtifactParserV2 hook
 * Tests artifact parsing, saving, streaming preview, and session state extraction
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useArtifactParserV2, isPreviewArtifact } from "./useArtifactParserV2";
import { Artifact, ArtifactType } from "@/types/database";

// Mock supabase
const mockUpdate = vi.fn();
const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockSingle = vi.fn();
const mockEq = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      update: mockUpdate,
      insert: mockInsert,
    })),
  },
}));

// Mock logger
vi.mock("@/lib/logger", () => ({
  parserLogger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("useArtifactParserV2", () => {
  const projectId = "project-123";

  // Sample artifact for testing
  const createMockArtifact = (overrides = {}): Artifact => ({
    id: "artifact-1",
    project_id: projectId,
    artifact_type: "phase_1_contract" as ArtifactType,
    content: "Existing artifact content here with enough length",
    status: "draft",
    version: 1,
    prompt_version: null,
    updated_by_message_id: null,
    approved_at: null,
    approved_by: null,
    stale_reason: null,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  });

  // Valid AI response JSON
  const createValidResponse = (overrides = {}) => ({
    message: "Here is your artifact",
    artifact: {
      type: "phase_1_contract",
      title: "Phase 1 Contract",
      content:
        "This is the artifact content with sufficient length to pass validation",
      status: "draft",
    },
    state: {
      mode: "STANDARD",
      pipeline_stage: "phase_1_contract",
    },
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock chain
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ single: mockSingle });
    mockInsert.mockReturnValue({ select: mockSelect });
  });

  describe("parseResponse", () => {
    it("should parse valid JSON response", () => {
      const { result } = renderHook(() => useArtifactParserV2(projectId));
      const response = JSON.stringify(createValidResponse());

      const parsed = result.current.parseResponse(response);

      expect(parsed.success).toBe(true);
      expect(parsed.response?.message).toBe("Here is your artifact");
      expect(parsed.response?.artifact?.type).toBe("phase_1_contract");
    });

    it("should parse response with markdown code block wrapper", () => {
      const { result } = renderHook(() => useArtifactParserV2(projectId));
      const response = "```json\n" + JSON.stringify(createValidResponse()) + "\n```";

      const parsed = result.current.parseResponse(response);

      expect(parsed.success).toBe(true);
      expect(parsed.response?.message).toBe("Here is your artifact");
    });

    it("should parse response with just ``` wrapper", () => {
      const { result } = renderHook(() => useArtifactParserV2(projectId));
      const response = "```\n" + JSON.stringify(createValidResponse()) + "\n```";

      const parsed = result.current.parseResponse(response);

      expect(parsed.success).toBe(true);
    });

    it("should handle response without artifact", () => {
      const { result } = renderHook(() => useArtifactParserV2(projectId));
      const response = JSON.stringify({
        message: "Just a message, no artifact",
      });

      const parsed = result.current.parseResponse(response);

      expect(parsed.success).toBe(true);
      expect(parsed.response?.message).toBe("Just a message, no artifact");
      expect(parsed.response?.artifact).toBeUndefined();
    });

    it("should handle response with state only", () => {
      const { result } = renderHook(() => useArtifactParserV2(projectId));
      const response = JSON.stringify({
        message: "State update",
        state: {
          mode: "QUICK",
          pipeline_stage: "discovery_report",
        },
      });

      const parsed = result.current.parseResponse(response);

      expect(parsed.success).toBe(true);
      expect(parsed.response?.state?.mode).toBe("QUICK");
      expect(parsed.response?.state?.pipeline_stage).toBe("discovery_report");
    });

    it("should fail on invalid JSON", () => {
      const { result } = renderHook(() => useArtifactParserV2(projectId));

      const parsed = result.current.parseResponse("not valid json at all");

      expect(parsed.success).toBe(false);
      expect(parsed.error).toBeDefined();
    });

    it("should fail when message field is missing", () => {
      const { result } = renderHook(() => useArtifactParserV2(projectId));
      const response = JSON.stringify({
        artifact: {
          type: "phase_1_contract",
          title: "Test",
          content: "Content that is long enough to pass validation check",
        },
      });

      const parsed = result.current.parseResponse(response);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("message");
    });

    it("should fail on invalid artifact type", () => {
      const { result } = renderHook(() => useArtifactParserV2(projectId));
      const response = JSON.stringify({
        message: "Test",
        artifact: {
          type: "invalid_type",
          title: "Test",
          content: "Content that is long enough to pass validation check",
        },
      });

      const parsed = result.current.parseResponse(response);

      expect(parsed.success).toBe(false);
    });

    it("should fail on artifact content too short", () => {
      const { result } = renderHook(() => useArtifactParserV2(projectId));
      const response = JSON.stringify({
        message: "Test",
        artifact: {
          type: "phase_1_contract",
          title: "Test",
          content: "Too short", // Less than 20 chars
        },
      });

      const parsed = result.current.parseResponse(response);

      expect(parsed.success).toBe(false);
    });

    it("should handle escaped newlines in content", () => {
      const { result } = renderHook(() => useArtifactParserV2(projectId));
      const contentWithNewlines = "Line 1\\nLine 2\\nLine 3 with enough content to pass";
      const response = JSON.stringify({
        message: "Test with newlines",
        artifact: {
          type: "phase_1_contract",
          title: "Test",
          content: contentWithNewlines,
        },
      });

      const parsed = result.current.parseResponse(response);

      expect(parsed.success).toBe(true);
    });

    it("should extract JSON from text with leading content", () => {
      const { result } = renderHook(() => useArtifactParserV2(projectId));
      const response =
        'Here is my response:\n\n' + JSON.stringify(createValidResponse());

      const parsed = result.current.parseResponse(response);

      expect(parsed.success).toBe(true);
    });
  });

  describe("saveArtifact", () => {
    it("should create new artifact when none exists", async () => {
      const newArtifact: Artifact = createMockArtifact({ id: "new-id" });
      mockSingle.mockResolvedValue({ data: newArtifact, error: null });

      const { result } = renderHook(() => useArtifactParserV2(projectId));

      const saved = await result.current.saveArtifact(
        {
          type: "phase_1_contract",
          title: "New Contract",
          content: "New content that is long enough for validation",
          status: "draft",
        },
        [] // No existing artifacts
      );

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          project_id: projectId,
          artifact_type: "phase_1_contract",
          status: "draft",
          version: 1,
        })
      );
      expect(saved).toEqual(newArtifact);
    });

    it("should update existing artifact when content differs", async () => {
      const existingArtifact = createMockArtifact();
      const updatedArtifact: Artifact = {
        ...existingArtifact,
        content: "Updated content",
        version: 2,
      };
      mockSingle.mockResolvedValue({ data: updatedArtifact, error: null });

      const { result } = renderHook(() => useArtifactParserV2(projectId));

      const saved = await result.current.saveArtifact(
        {
          type: "phase_1_contract",
          title: "Updated Contract",
          content: "Completely different content that is long enough",
          status: "draft",
        },
        [existingArtifact]
      );

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "Completely different content that is long enough",
          version: 2,
        })
      );
      expect(saved).toEqual(updatedArtifact);
    });

    it("should return existing artifact when content is unchanged", async () => {
      const existingArtifact = createMockArtifact();

      const { result } = renderHook(() => useArtifactParserV2(projectId));

      const saved = await result.current.saveArtifact(
        {
          type: "phase_1_contract",
          title: "Same Contract",
          content: existingArtifact.content, // Same content
          status: "draft",
        },
        [existingArtifact]
      );

      expect(mockUpdate).not.toHaveBeenCalled();
      expect(mockInsert).not.toHaveBeenCalled();
      expect(saved).toEqual(existingArtifact);
    });

    it("should mark approved artifact as stale when updated", async () => {
      const approvedArtifact = createMockArtifact({ status: "approved" });
      const staleArtifact: Artifact = {
        ...approvedArtifact,
        status: "stale",
        stale_reason: "Content updated",
      };
      mockSingle.mockResolvedValue({ data: staleArtifact, error: null });

      const { result } = renderHook(() => useArtifactParserV2(projectId));

      await result.current.saveArtifact(
        {
          type: "phase_1_contract",
          title: "Updated",
          content: "New content for the approved artifact that is long enough",
          status: "draft",
        },
        [approvedArtifact]
      );

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "stale",
          stale_reason: "Content updated",
        })
      );
    });

    it("should return null when projectId is missing", async () => {
      const { result } = renderHook(() => useArtifactParserV2(null));

      const saved = await result.current.saveArtifact(
        {
          type: "phase_1_contract",
          title: "Test",
          content: "Content long enough for validation purposes",
          status: "draft",
        },
        []
      );

      expect(saved).toBeNull();
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it("should return null on database error", async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: "DB error" },
      });

      const { result } = renderHook(() => useArtifactParserV2(projectId));

      const saved = await result.current.saveArtifact(
        {
          type: "phase_1_contract",
          title: "Test",
          content: "Content long enough for validation purposes",
          status: "draft",
        },
        []
      );

      expect(saved).toBeNull();
    });
  });

  describe("processAIResponse", () => {
    it("should parse and save artifact from valid response", async () => {
      const savedArtifact = createMockArtifact();
      mockSingle.mockResolvedValue({ data: savedArtifact, error: null });

      const { result } = renderHook(() => useArtifactParserV2(projectId));
      const response = JSON.stringify(createValidResponse());

      const artifacts = await result.current.processAIResponse(response, []);

      expect(artifacts).toHaveLength(1);
      expect(artifacts[0]).toEqual(savedArtifact);
    });

    it("should return empty array when parsing fails", async () => {
      const { result } = renderHook(() => useArtifactParserV2(projectId));

      const artifacts = await result.current.processAIResponse(
        "invalid json",
        []
      );

      expect(artifacts).toHaveLength(0);
    });

    it("should return empty array when no artifact in response", async () => {
      const { result } = renderHook(() => useArtifactParserV2(projectId));
      const response = JSON.stringify({ message: "Just a message" });

      const artifacts = await result.current.processAIResponse(response, []);

      expect(artifacts).toHaveLength(0);
    });
  });

  describe("getStreamingArtifactPreview", () => {
    it("should extract artifact from complete streaming JSON", () => {
      const { result } = renderHook(() => useArtifactParserV2(projectId));
      const streaming = JSON.stringify(createValidResponse());

      const preview = result.current.getStreamingArtifactPreview(streaming, []);

      expect(preview).toHaveLength(1);
      expect(preview[0].artifact_type).toBe("phase_1_contract");
      expect(isPreviewArtifact(preview[0])).toBe(true);
    });

    it("should update existing artifact during streaming", () => {
      const { result } = renderHook(() => useArtifactParserV2(projectId));
      const existingArtifact = createMockArtifact();
      const streaming = JSON.stringify(
        createValidResponse({
          artifact: {
            type: "phase_1_contract",
            title: "Updated",
            content: "New streaming content that is long enough for tests",
            status: "draft",
          },
        })
      );

      const preview = result.current.getStreamingArtifactPreview(streaming, [
        existingArtifact,
      ]);

      expect(preview).toHaveLength(1);
      expect(preview[0].content).toBe(
        "New streaming content that is long enough for tests"
      );
    });

    it("should extract artifact from partial JSON stream", () => {
      const { result } = renderHook(() => useArtifactParserV2(projectId));
      // Simulate partial streaming - JSON not complete yet
      const partialStream = `{
        "message": "Generating...",
        "artifact": {
          "type": "discovery_report",
          "title": "Discovery",
          "content": "This is partial content being streamed that is long enough to show in preview`;

      const preview = result.current.getStreamingArtifactPreview(
        partialStream,
        []
      );

      expect(preview).toHaveLength(1);
      expect(preview[0].artifact_type).toBe("discovery_report");
      expect(preview[0].content).toContain("partial content");
    });

    it("should preserve non-preview artifacts", () => {
      const { result } = renderHook(() => useArtifactParserV2(projectId));
      const existingArtifact = createMockArtifact({
        artifact_type: "learner_persona",
      });

      const streaming = JSON.stringify(
        createValidResponse({
          artifact: {
            type: "phase_1_contract",
            title: "New",
            content: "New content for a different artifact type",
            status: "draft",
          },
        })
      );

      const preview = result.current.getStreamingArtifactPreview(streaming, [
        existingArtifact,
      ]);

      expect(preview).toHaveLength(2);
      expect(preview.find((a) => a.artifact_type === "learner_persona")).toBeDefined();
      expect(preview.find((a) => a.artifact_type === "phase_1_contract")).toBeDefined();
    });

    it("should ignore content shorter than 50 characters in partial stream", () => {
      const { result } = renderHook(() => useArtifactParserV2(projectId));
      const shortContent = `{
        "message": "Generating...",
        "artifact": {
          "type": "discovery_report",
          "title": "Discovery",
          "content": "Too short`;

      const preview = result.current.getStreamingArtifactPreview(
        shortContent,
        []
      );

      // Should not create preview for short content
      expect(preview).toHaveLength(0);
    });

    it("should handle escaped characters in streaming content", () => {
      const { result } = renderHook(() => useArtifactParserV2(projectId));
      const streamWithEscapes = `{
        "message": "Test",
        "artifact": {
          "type": "phase_1_contract",
          "title": "Test",
          "content": "Line 1\\nLine 2\\nLine 3\\n\\nThis has enough content for preview display purposes`;

      const preview = result.current.getStreamingArtifactPreview(
        streamWithEscapes,
        []
      );

      expect(preview).toHaveLength(1);
      expect(preview[0].content).toContain("Line 1");
    });
  });

  describe("getMessageText", () => {
    it("should extract message from response", () => {
      const { result } = renderHook(() => useArtifactParserV2(projectId));
      const response = {
        message: "This is the message",
        artifact: undefined,
        state: undefined,
      };

      const message = result.current.getMessageText(response);

      expect(message).toBe("This is the message");
    });
  });

  describe("getSessionState", () => {
    it("should extract state from response", () => {
      const { result } = renderHook(() => useArtifactParserV2(projectId));
      const response = {
        message: "Test",
        state: {
          mode: "QUICK" as const,
          pipeline_stage: "design_blueprint",
        },
      };

      const state = result.current.getSessionState(response);

      expect(state?.mode).toBe("QUICK");
      expect(state?.pipeline_stage).toBe("design_blueprint");
    });

    it("should return null when no state in response", () => {
      const { result } = renderHook(() => useArtifactParserV2(projectId));
      const response = {
        message: "Test",
      };

      const state = result.current.getSessionState(response);

      expect(state).toBeNull();
    });
  });

  describe("isPreviewArtifact", () => {
    it("should identify preview artifacts", () => {
      const previewArtifact = {
        ...createMockArtifact(),
        id: "preview-phase_1_contract",
        isPreview: true as const,
      };

      expect(isPreviewArtifact(previewArtifact)).toBe(true);
    });

    it("should return false for regular artifacts", () => {
      const regularArtifact = createMockArtifact();

      expect(isPreviewArtifact(regularArtifact)).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("should handle response with next_actions", () => {
      const { result } = renderHook(() => useArtifactParserV2(projectId));
      const response = JSON.stringify({
        message: "Complete",
        next_actions: ["Review artifact", "Proceed to next phase"],
      });

      const parsed = result.current.parseResponse(response);

      expect(parsed.success).toBe(true);
      expect(parsed.response?.next_actions).toHaveLength(2);
    });

    it("should handle all valid artifact types", () => {
      const { result } = renderHook(() => useArtifactParserV2(projectId));

      const validTypes = [
        "phase_1_contract",
        "discovery_report",
        "learner_persona",
        "design_strategy",
        "design_blueprint",
        "scenario_bank",
        "assessment_kit",
        "final_audit",
        "performance_recommendation_report",
      ];

      validTypes.forEach((type) => {
        const response = JSON.stringify({
          message: `Creating ${type}`,
          artifact: {
            type,
            title: `Test ${type}`,
            content: `Content for ${type} that is long enough to pass validation`,
          },
        });

        const parsed = result.current.parseResponse(response);
        expect(parsed.success).toBe(true);
        expect(parsed.response?.artifact?.type).toBe(type);
      });
    });

    it("should handle threshold_percent in state", () => {
      const { result } = renderHook(() => useArtifactParserV2(projectId));
      const response = JSON.stringify({
        message: "Progress update",
        state: {
          mode: "STANDARD",
          pipeline_stage: "design_strategy",
          threshold_percent: 75,
        },
      });

      const parsed = result.current.parseResponse(response);

      expect(parsed.success).toBe(true);
      expect(parsed.response?.state?.threshold_percent).toBe(75);
    });

    it("should reject threshold_percent outside 0-100 range", () => {
      const { result } = renderHook(() => useArtifactParserV2(projectId));
      const response = JSON.stringify({
        message: "Invalid threshold",
        state: {
          mode: "STANDARD",
          pipeline_stage: "design_strategy",
          threshold_percent: 150,
        },
      });

      const parsed = result.current.parseResponse(response);

      expect(parsed.success).toBe(false);
    });
  });
});
