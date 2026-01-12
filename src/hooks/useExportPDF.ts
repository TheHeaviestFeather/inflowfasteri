import { useCallback, useState } from "react";
import { jsPDF } from "jspdf";
import { Artifact, ArtifactType, ARTIFACT_ORDER, ARTIFACT_LABELS, QUICK_MODE_ARTIFACTS, isSkippedInQuickMode } from "@/types/database";
import { formatArtifactContent } from "@/utils/artifactFormatter";
import { createLogger } from "@/lib/logger";

const exportLogger = createLogger("ExportPDF");

interface UseExportPDFOptions {
  projectName?: string;
  mode?: "standard" | "quick";
}

export function useExportPDF({ projectName = "Project", mode = "standard" }: UseExportPDFOptions) {
  const [isExporting, setIsExporting] = useState(false);

  const stripMarkdown = (text: string): string => {
    return text
      // Remove headers
      .replace(/^#{1,6}\s+/gm, "")
      // Remove bold/italic
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/__([^_]+)__/g, "$1")
      .replace(/_([^_]+)_/g, "$1")
      // Remove inline code
      .replace(/`([^`]+)`/g, "$1")
      // Remove links but keep text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      // Remove blockquotes
      .replace(/^>\s*/gm, "")
      // Clean up bullet points
      .replace(/^[-\*]\s+/gm, "• ")
      // Clean up numbered lists
      .replace(/^\d+\.\s+/gm, "  ")
      // Remove horizontal rules
      .replace(/^[-*_]{3,}$/gm, "")
      // Clean up extra whitespace
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  };

  const exportToPDF = useCallback(async (artifacts: Artifact[]) => {
    setIsExporting(true);
    
    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      const contentWidth = pageWidth - margin * 2;
      let yPosition = margin;

      // Title Page
      doc.setFontSize(24);
      doc.setFont("helvetica", "bold");
      doc.text(projectName, pageWidth / 2, 60, { align: "center" });
      
      doc.setFontSize(14);
      doc.setFont("helvetica", "normal");
      doc.text("Training Design Package", pageWidth / 2, 75, { align: "center" });
      
      doc.setFontSize(10);
      doc.setTextColor(128, 128, 128);
      doc.text(`Generated on ${new Date().toLocaleDateString()}`, pageWidth / 2, 90, { align: "center" });
      doc.text(`Mode: ${mode === "quick" ? "Quick" : "Standard"}`, pageWidth / 2, 97, { align: "center" });
      
      // Get relevant artifacts based on mode
      const relevantOrder = mode === "quick" ? QUICK_MODE_ARTIFACTS : ARTIFACT_ORDER;
      const approvedArtifacts = relevantOrder
        .map(type => artifacts.find(a => a.artifact_type === type && a.status === "approved"))
        .filter((a): a is Artifact => a !== undefined);

      doc.setTextColor(100, 100, 100);
      doc.text(`${approvedArtifacts.length} approved deliverables included`, pageWidth / 2, 104, { align: "center" });

      // Table of Contents
      doc.addPage();
      yPosition = margin;
      
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("Table of Contents", margin, yPosition);
      yPosition += 15;

      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      
      approvedArtifacts.forEach((artifact, index) => {
        const label = ARTIFACT_LABELS[artifact.artifact_type];
        doc.text(`${index + 1}. ${label}`, margin + 5, yPosition);
        yPosition += 8;
      });

      // Content Pages
      for (const artifact of approvedArtifacts) {
        doc.addPage();
        yPosition = margin;

        // Section Header
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 64, 175); // Blue color
        doc.text(ARTIFACT_LABELS[artifact.artifact_type], margin, yPosition);
        yPosition += 10;

        // Underline
        doc.setDrawColor(30, 64, 175);
        doc.setLineWidth(0.5);
        doc.line(margin, yPosition - 5, pageWidth - margin, yPosition - 5);
        yPosition += 5;

        // Content
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0, 0, 0);

        const formattedContent = formatArtifactContent(artifact.content, artifact.artifact_type);
        const cleanContent = stripMarkdown(formattedContent);
        
        // Split content into lines that fit the page width
        const lines = doc.splitTextToSize(cleanContent, contentWidth);
        
        for (const line of lines) {
          // Check if we need a new page
          if (yPosition > pageHeight - margin - 10) {
            doc.addPage();
            yPosition = margin;
          }
          
          doc.text(line, margin, yPosition);
          yPosition += 5;
        }

        // Add metadata footer
        yPosition = pageHeight - margin;
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Version ${artifact.version} • Approved ${new Date(artifact.approved_at!).toLocaleDateString()}`, margin, yPosition);
      }

      // Save the PDF
      const fileName = `${projectName.replace(/[^a-zA-Z0-9]/g, "_")}_Deliverables.pdf`;
      doc.save(fileName);
      
      return { success: true, fileName };
    } catch (error) {
      exportLogger.error("PDF export error", { error });
      return { success: false, error };
    } finally {
      setIsExporting(false);
    }
  }, [projectName, mode]);

  return { exportToPDF, isExporting };
}
