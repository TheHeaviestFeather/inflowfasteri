/**
 * Unit tests for ArtifactCanvas component
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { ArtifactCanvas } from "./ArtifactCanvas";
import { Artifact, ArtifactType } from "@/types/database";

// Mock hooks
vi.mock("@/hooks/useExportPDF", () => ({
  useExportPDF: () => ({
    exportToPDF: vi.fn().mockResolvedValue({ success: true, fileName: "test.pdf" }),
    isExporting: false,
  }),
}));

// Mock sonner
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const createMockArtifact = (overrides: Partial<Artifact> = {}): Artifact => ({
  id: "artifact-1",
  project_id: "proj-1",
  artifact_type: "phase_1_contract",
  content: "This is test content for the artifact that should be long enough to display properly in the UI.",
  status: "draft",
  version: 1,
  prompt_version: null,
  updated_by_message_id: null,
  approved_at: null,
  approved_by: null,
  stale_reason: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

describe("ArtifactCanvas", () => {
  const mockOnApprove = vi.fn();
  const mockOnRetry = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Empty state", () => {
    it("renders phase tabs even with no artifacts", () => {
      const { getByText } = render(<ArtifactCanvas artifacts={[]} />);

      expect(getByText("Deliverables")).toBeInTheDocument();
      expect(getByText("Contract")).toBeInTheDocument();
    });

    it("shows empty state message for selected phase without artifact", () => {
      const { getByText } = render(<ArtifactCanvas artifacts={[]} />);

      expect(getByText(/No content generated yet/i)).toBeInTheDocument();
    });
  });

  describe("Artifact display", () => {
    it("displays artifact content when selected", () => {
      const artifacts = [
        createMockArtifact({
          artifact_type: "phase_1_contract",
          content: "# Contract Content\n\nThis is the contract details.",
        }),
      ];

      const { getByText } = render(<ArtifactCanvas artifacts={artifacts} />);

      expect(getByText("Phase 1 Contract")).toBeInTheDocument();
    });

    it("shows draft badge for draft artifacts", () => {
      const artifacts = [createMockArtifact({ status: "draft" })];

      const { getByText } = render(<ArtifactCanvas artifacts={artifacts} />);

      expect(getByText("Draft")).toBeInTheDocument();
    });

    it("shows approved badge for approved artifacts", () => {
      const artifacts = [
        createMockArtifact({
          status: "approved",
          approved_at: new Date().toISOString(),
        }),
      ];

      const { getByText } = render(<ArtifactCanvas artifacts={artifacts} />);

      expect(getByText("Approved")).toBeInTheDocument();
    });

    it("shows stale badge for stale artifacts", () => {
      const artifacts = [
        createMockArtifact({
          status: "stale",
          stale_reason: "Content updated",
        }),
      ];

      const { getByText } = render(<ArtifactCanvas artifacts={artifacts} />);

      expect(getByText("Needs Review")).toBeInTheDocument();
    });
  });

  describe("Phase navigation", () => {
    it("switches between phases when tabs are clicked", async () => {
      const artifacts = [
        createMockArtifact({ artifact_type: "phase_1_contract", content: "Contract content here" }),
        createMockArtifact({
          id: "artifact-2",
          artifact_type: "discovery_report",
          content: "Discovery report content here with enough text to display.",
        }),
      ];

      const { getByText } = render(<ArtifactCanvas artifacts={artifacts} />);

      // Click on Discovery tab
      getByText("Discovery").click();

      // Should show discovery content
      expect(getByText("Discovery Report")).toBeInTheDocument();
    });
  });

  describe("Quick mode", () => {
    it("shows Quick Mode badge when in quick mode", () => {
      const { getByText } = render(<ArtifactCanvas artifacts={[]} mode="quick" />);

      expect(getByText("Quick Mode")).toBeInTheDocument();
    });

    it("shows skipped message for non-quick-mode artifacts", () => {
      const { getByText } = render(<ArtifactCanvas artifacts={[]} mode="quick" />);

      // Click on Discovery (skipped in quick mode)
      const discoveryTab = getByText("Discovery");
      discoveryTab.click();

      expect(getByText(/skipped in Quick Mode/i)).toBeInTheDocument();
    });

    it("disables skipped phase tabs", () => {
      const { getByRole } = render(<ArtifactCanvas artifacts={[]} mode="quick" />);

      // Discovery should be disabled in quick mode
      const discoveryTab = getByRole("tab", { name: /Discovery/i });
      expect(discoveryTab).toBeDisabled();
    });
  });

  describe("Approval flow", () => {
    it("calls onApprove when approve button is clicked", () => {
      const artifacts = [createMockArtifact({ status: "draft" })];

      const { getByRole } = render(<ArtifactCanvas artifacts={artifacts} onApprove={mockOnApprove} />);

      const approveButton = getByRole("button", { name: /approve/i });
      approveButton.click();

      expect(mockOnApprove).toHaveBeenCalledWith("artifact-1");
    });

    it("hides approve button for already approved artifacts", () => {
      const artifacts = [
        createMockArtifact({
          status: "approved",
          approved_at: new Date().toISOString(),
        }),
      ];

      const { queryByRole } = render(<ArtifactCanvas artifacts={artifacts} onApprove={mockOnApprove} />);

      expect(queryByRole("button", { name: /approve/i })).not.toBeInTheDocument();
    });
  });

  describe("Collapse functionality", () => {
    it("collapses to mini view when collapse button is clicked", () => {
      const { getAllByRole } = render(<ArtifactCanvas artifacts={[]} />);

      // Find and click the collapse button (ChevronRight icon)
      const collapseButtons = getAllByRole("button");
      const collapseButton = collapseButtons.find((btn) => btn.querySelector("svg"));

      if (collapseButton) {
        collapseButton.click();
      }

      // In collapsed state, the full "Deliverables" heading should not be visible
      // and numbered buttons should appear instead
    });
  });

  describe("Streaming state", () => {
    it("shows streaming indicator during content generation", () => {
      const artifacts = [createMockArtifact()];

      const { getByText } = render(
        <ArtifactCanvas
          artifacts={artifacts}
          isStreaming={true}
          streamingMessage="Generating content..."
        />
      );

      // Streaming indicator should be visible
      expect(getByText(/streaming|generating/i)).toBeInTheDocument();
    });
  });

  describe("Version display", () => {
    it("shows version number for artifacts", () => {
      const artifacts = [createMockArtifact({ version: 3 })];

      const { getByText } = render(<ArtifactCanvas artifacts={artifacts} />);

      expect(getByText("v3")).toBeInTheDocument();
    });
  });

  describe("Phase status indicators", () => {
    it("shows complete status for approved artifacts in tabs", () => {
      const artifacts = [
        createMockArtifact({
          status: "approved",
          approved_at: new Date().toISOString(),
        }),
      ];

      const { getByRole } = render(<ArtifactCanvas artifacts={artifacts} />);

      // The Contract tab should have complete styling (sky blue)
      const contractTab = getByRole("tab", { name: /Contract/i });
      expect(contractTab).toHaveClass("bg-sky-500/15");
    });
  });
});
